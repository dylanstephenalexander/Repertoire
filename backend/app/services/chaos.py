import random
import uuid
from dataclasses import dataclass, field

import chess

from app.engine.maia import MaiaEngine, available_maia_models, lc0_available
from app.engine.stockfish import FEEDBACK_DEPTH
from app.models.chaos import (
    ChaosOpponentMoveResponse,
    ChaosMoveResponse,
    ChaosStartResponse,
)
from app.models.feedback import AnalysisLine, Feedback
from app.services.feedback import (
    ALTERNATIVE_THRESHOLD_CP,
    build_alternative_feedback,
    build_mistake_feedback,
)
from app.services.opening_detect import detect_opening
from app.services.sessions import get_engine  # shared Stockfish instance

# In-memory chaos session store
_chaos_sessions: dict[str, "_ChaosSession"] = {}

# Maia engines: lazy-loaded per elo_band, kept alive for the server lifetime
_maia_engines: dict[int, MaiaEngine] = {}

# Sentinel value for "use full-strength Stockfish"
STOCKFISH_BAND = 2000


@dataclass
class _ChaosSession:
    session_id: str
    user_color: str        # "white" | "black"
    elo_band: int
    skill_level: str
    current_fen: str
    move_history: list[str] = field(default_factory=list)
    opening_name: str | None = None  # most specific name confirmed so far


def engine_status() -> dict:
    return {
        "lc0": lc0_available(),
        "maia_models": available_maia_models(),
    }


def create_chaos_session(
    color: str,
    elo_band: int,
    skill_level: str,
) -> ChaosStartResponse:
    if color == "random":
        color = random.choice(["white", "black"])

    session = _ChaosSession(
        session_id=str(uuid.uuid4()),
        user_color=color,
        elo_band=elo_band,
        skill_level=skill_level,
        current_fen=chess.Board().fen(),
    )
    _chaos_sessions[session.session_id] = session
    return ChaosStartResponse(
        session_id=session.session_id,
        fen=session.current_fen,
        user_color=color,
    )


def process_chaos_move(
    session_id: str,
    uci_move: str,
    feedback_enabled: bool,
) -> ChaosMoveResponse:
    session = _chaos_sessions.get(session_id)
    if session is None:
        raise KeyError(f"Chaos session not found: {session_id}")

    board = chess.Board(session.current_fen)
    try:
        move = chess.Move.from_uci(uci_move)
        if move not in board.legal_moves:
            raise ValueError(f"Illegal move: {uci_move}")
    except Exception as exc:
        raise ValueError(str(exc))

    played_san = board.san(move)
    pre_fen = session.current_fen
    board.push(move)
    new_fen = board.fen()

    session.move_history.append(uci_move)
    session.current_fen = new_fen

    # Opening detection — keep updating while in theory (more specific names come later)
    opening_hit = detect_opening(new_fen)
    if opening_hit is not None:
        session.opening_name = opening_hit

    feedback: Feedback | None = None
    if feedback_enabled:
        feedback = _build_chaos_feedback(pre_fen, new_fen, played_san, uci_move, session.skill_level)

    return ChaosMoveResponse(
        fen=new_fen,
        feedback=feedback,
        opening_name=session.opening_name,
        in_theory=opening_hit is not None,
    )


def get_chaos_opponent_move(session_id: str) -> ChaosOpponentMoveResponse:
    session = _chaos_sessions.get(session_id)
    if session is None:
        raise KeyError(f"Chaos session not found: {session_id}")

    uci_move = _get_engine_move(session.current_fen, session.elo_band)

    board = chess.Board(session.current_fen)
    move = chess.Move.from_uci(uci_move)
    if move not in board.legal_moves:
        raise ValueError(f"Engine returned illegal move: {uci_move}")

    board.push(move)
    new_fen = board.fen()

    session.move_history.append(uci_move)
    session.current_fen = new_fen

    opening_hit = detect_opening(new_fen)
    if opening_hit is not None:
        session.opening_name = opening_hit

    return ChaosOpponentMoveResponse(
        uci_move=uci_move,
        fen=new_fen,
        opening_name=session.opening_name,
        in_theory=opening_hit is not None,
    )


def clear_chaos_sessions() -> None:
    """For testing only."""
    _chaos_sessions.clear()


def stop_all_maia_engines() -> None:
    """Called during app shutdown."""
    for engine in _maia_engines.values():
        engine.stop()
    _maia_engines.clear()


# ------------------------------------------------------------------
# Internal helpers
# ------------------------------------------------------------------

def _get_engine_move(fen: str, elo_band: int) -> str:
    if elo_band >= STOCKFISH_BAND:
        engine = get_engine()
        if engine is None:
            raise ValueError("Stockfish engine not available")
        result = engine.analyse(fen, multipv=1, depth=15)
        move = result.get("best_move")
        if not move:
            raise ValueError("Stockfish returned no move")
        return move

    # Maia — lazy-load engine for this band
    if elo_band not in _maia_engines:
        maia = MaiaEngine(elo_band)
        maia.start()
        _maia_engines[elo_band] = maia

    return _maia_engines[elo_band].best_move(fen)


def _build_chaos_feedback(
    pre_fen: str,
    post_fen: str,
    played_san: str,
    uci_move: str,
    skill_level: str,
) -> Feedback | None:
    engine = get_engine()
    if engine is None:
        return None

    try:
        pre_eval = engine.analyse(pre_fen, depth=FEEDBACK_DEPTH)
        post_eval = engine.analyse(post_fen, depth=FEEDBACK_DEPTH)
    except Exception:
        return None

    pre_cp = pre_eval.get("eval_cp") or 0
    post_cp = post_eval.get("eval_cp") or 0
    cp_loss = max(0, pre_cp + post_cp)

    if cp_loss <= ALTERNATIVE_THRESHOLD_CP:
        return None  # Good move — no feedback needed

    pre_board = chess.Board(pre_fen)
    lines = _to_analysis_lines(pre_eval.get("lines", []), pre_board)
    best_san = lines[0].move_san if lines else (pre_eval.get("best_move") or uci_move)

    return build_mistake_feedback(skill_level, played_san, best_san, cp_loss, lines=lines)


def _to_analysis_lines(raw_lines: list[dict], board: chess.Board) -> list[AnalysisLine]:
    result = []
    for raw in raw_lines:
        uci = raw.get("move_uci", "")
        cp = raw.get("cp", 0)
        try:
            san = board.san(chess.Move.from_uci(uci))
        except Exception:
            san = uci
        result.append(AnalysisLine(move_uci=uci, move_san=san, cp=cp))
    return result
