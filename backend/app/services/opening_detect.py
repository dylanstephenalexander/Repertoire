"""
Local opening detection built from openings.tsv.

For each row in the TSV, replays the PGN and records the FINAL position's
FEN → opening name.  Only terminal positions are named — intermediate
positions (e.g. after 1.e4 alone) intentionally return None.

When multiple rows reach the same terminal FEN, the name from the longest
PGN wins (deepest / most specific variation).

No network calls — deterministic, fast, testable.
"""

import csv
import io
from functools import lru_cache
from pathlib import Path

import chess
import chess.pgn

_TSV_PATH = Path(__file__).parent.parent / "data" / "openings.tsv"


def _normalise_fen(fen: str) -> str:
    """Strip halfmove clock and fullmove number — irrelevant for opening identity."""
    parts = fen.split(" ")
    return " ".join(parts[:4]) if len(parts) >= 4 else fen


@lru_cache(maxsize=None)
def _build_lookup() -> dict[str, str]:
    """
    Parse openings.tsv once and return a {normalised_fen: name} mapping.

    Only the terminal FEN of each PGN is recorded.  When two rows share a
    terminal FEN (e.g. transpositions), the longer PGN (more specific) wins.
    """
    lookup: dict[str, tuple[str, int]] = {}  # fen -> (name, move_count)

    rows = list(csv.DictReader(_TSV_PATH.open(encoding="utf-8"), delimiter="\t"))
    for row in rows:
        pgn_text = row.get("pgn", "").strip()
        opening_name = row.get("opening_name", "").strip()
        variation_name = row.get("variation_name", "").strip()

        if not pgn_text:
            continue

        if variation_name and variation_name != opening_name:
            display_name = f"{opening_name}: {variation_name}"
        else:
            display_name = opening_name

        try:
            game = chess.pgn.read_game(io.StringIO(pgn_text))
            if game is None:
                continue
            board = game.board()
            move_count = 0
            for move in game.mainline_moves():
                board.push(move)
                move_count += 1
        except Exception:
            continue

        if move_count == 0:
            continue

        fen = _normalise_fen(board.fen())
        existing = lookup.get(fen)
        if existing is None or move_count >= existing[1]:
            lookup[fen] = (display_name, move_count)

    return {fen: name for fen, (name, _) in lookup.items()}


def detect_opening(fen: str) -> str | None:
    """
    Return the opening name for this position, or None if not in our book.
    """
    normalised = _normalise_fen(fen)
    return _build_lookup().get(normalised)
