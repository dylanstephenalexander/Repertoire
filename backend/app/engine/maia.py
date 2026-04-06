import os
import shutil
import subprocess
import threading
from pathlib import Path

# lc0 binary: env var → PATH → empty (not available)
LC0_PATH: str = (
    os.environ.get("LC0_PATH", "")
    or shutil.which("lc0")
    or ""
)

# Maia weight files: maia-{elo}.pb.gz
MAIA_MODELS_DIR = Path(
    os.environ.get("MAIA_MODELS_DIR", "")
    or Path(__file__).parent.parent / "data" / "maia"
)

MAIA_ELO_BANDS = [1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900]


def lc0_available() -> bool:
    return bool(LC0_PATH) and Path(LC0_PATH).exists()


def available_maia_models() -> list[int]:
    if not MAIA_MODELS_DIR.exists():
        return []
    return sorted(
        band for band in MAIA_ELO_BANDS
        if (MAIA_MODELS_DIR / f"maia-{band}.pb.gz").exists()
    )


class MaiaEngine:
    """
    Thin UCI wrapper around lc0 running Maia weights.
    Returns best_move only — no multipv, no eval.
    Not thread-safe — callers must serialize access.
    """

    def __init__(self, elo_band: int):
        self._elo_band = elo_band
        self._weights = str(MAIA_MODELS_DIR / f"maia-{elo_band}.pb.gz")
        self._proc: subprocess.Popen | None = None
        self._lock = threading.Lock()

    def start(self) -> None:
        self._proc = subprocess.Popen(
            [LC0_PATH, f"--weights={self._weights}"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            bufsize=1,
        )
        self._send("uci")
        self._wait_for("uciok")
        self._send("isready")
        self._wait_for("readyok")

    def stop(self) -> None:
        if self._proc:
            try:
                self._send("quit")
                self._proc.wait(timeout=3)
            except Exception:
                self._proc.kill()
            self._proc = None

    def best_move(self, fen: str, moves: list[str] | None = None) -> str:
        """
        Return lc0's top move for the position.
        Uses nodes=1 — Maia is a policy network, one forward pass is sufficient.
        """
        with self._lock:
            if moves:
                self._send(f"position fen {fen} moves {' '.join(moves)}")
            else:
                self._send(f"position fen {fen}")
            self._send("go nodes 1")
            return self._collect_bestmove()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _send(self, cmd: str) -> None:
        assert self._proc and self._proc.stdin
        self._proc.stdin.write(cmd + "\n")
        self._proc.stdin.flush()

    def _readline(self) -> str:
        assert self._proc and self._proc.stdout
        return self._proc.stdout.readline().strip()

    def _wait_for(self, token: str) -> None:
        while True:
            if self._readline().startswith(token):
                return

    def _collect_bestmove(self) -> str:
        while True:
            line = self._readline()
            if line.startswith("bestmove"):
                parts = line.split()
                return parts[1] if len(parts) > 1 else ""
