from pydantic import BaseModel

from app.models.feedback import Feedback


class EngineStatusResponse(BaseModel):
    lc0: bool
    maia_models: list[int]


class ChaosStartRequest(BaseModel):
    color: str           # "white" | "black" | "random"
    elo_band: int        # 1100–1900 for Maia, 2000 for full Stockfish
    skill_level: str = "intermediate"


class ChaosStartResponse(BaseModel):
    session_id: str
    fen: str
    user_color: str      # "white" | "black" — resolved if random


class ChaosMoveRequest(BaseModel):
    uci_move: str
    feedback_enabled: bool = True


class ChaosMoveResponse(BaseModel):
    fen: str
    feedback: Feedback | None = None
    opening_name: str | None = None   # most specific theory name seen so far
    in_theory: bool = False           # True if this exact position is in the explorer


class ChaosOpponentMoveResponse(BaseModel):
    uci_move: str
    fen: str
    opening_name: str | None = None
    in_theory: bool = False
