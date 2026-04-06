import httpx

LICHESS_EXPLORER_URL = "https://explorer.lichess.ovh/lichess"

# FEN → opening name or None. Cached for the server lifetime.
# Opening positions repeat constantly; cache hit rate is very high.
_cache: dict[str, str | None] = {}


def detect_opening(fen: str) -> str | None:
    """
    Query the lichess opening explorer for the name of this position.
    Returns the opening name (e.g. "Ruy Lopez: Morphy Defense") or None
    if the position is out of theory or the request fails.
    """
    # Normalise: strip move clocks so transpositions share a cache entry
    normalised = _normalise_fen(fen)

    if normalised in _cache:
        return _cache[normalised]

    try:
        resp = httpx.get(
            LICHESS_EXPLORER_URL,
            params={"fen": normalised, "moves": 0, "topGames": 0, "recentGames": 0},
            timeout=2.0,
        )
        resp.raise_for_status()
        data = resp.json()
        opening = data.get("opening")
        name: str | None = opening.get("name") if opening else None
    except Exception:
        # Network error, timeout, or bad response — don't cache, just return None
        return None

    _cache[normalised] = name
    return name


def _normalise_fen(fen: str) -> str:
    """Strip halfmove clock and fullmove number — irrelevant for opening detection."""
    parts = fen.split(" ")
    return " ".join(parts[:4]) if len(parts) >= 4 else fen
