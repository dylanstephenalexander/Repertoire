"""Unit tests for StockfishEngine._collect_multipv_result parsing logic."""
from app.engine.stockfish import StockfishEngine


def _engine_with_output(lines: list[str]) -> StockfishEngine:
    """Construct a StockfishEngine that reads from a canned list of lines."""
    engine = object.__new__(StockfishEngine)
    it = iter(lines)
    engine._readline = lambda: next(it)
    return engine


MULTIPV_OUTPUT = [
    "info depth 15 multipv 1 score cp 30 pv e2e4 e7e5",
    "info depth 15 multipv 2 score cp 25 pv d2d4 d7d5",
    "info depth 15 multipv 3 score cp 20 pv g1f3 g8f6",
    "bestmove e2e4 ponder e7e5",
]


def test_collect_multipv_parses_three_lines():
    result = _engine_with_output(MULTIPV_OUTPUT)._collect_multipv_result()
    assert len(result["lines"]) == 3
    assert result["eval_cp"] == 30
    assert result["best_move"] == "e2e4"


def test_collect_multipv_lines_order():
    result = _engine_with_output(MULTIPV_OUTPUT)._collect_multipv_result()
    assert result["lines"][0]["move_uci"] == "e2e4"
    assert result["lines"][1]["move_uci"] == "d2d4"
    assert result["lines"][2]["move_uci"] == "g1f3"


def test_collect_multipv_mate_positive():
    """Positive mate score should map to +30000 cp."""
    lines = [
        "info depth 10 multipv 1 score mate 3 pv d1h5 g8f6 h5f7",
        "bestmove d1h5",
    ]
    result = _engine_with_output(lines)._collect_multipv_result()
    assert result["eval_cp"] == 30000
    assert result["lines"][0]["cp"] == 30000
    assert result["best_move"] == "d1h5"


def test_collect_multipv_mate_negative():
    """Negative mate score (being mated) should map to -30000 cp."""
    lines = [
        "info depth 10 multipv 1 score mate -2 pv e8g8",
        "bestmove e8g8",
    ]
    result = _engine_with_output(lines)._collect_multipv_result()
    assert result["eval_cp"] == -30000
    assert result["lines"][0]["cp"] == -30000


def test_collect_multipv_fewer_than_3_lines():
    """Positions with fewer than 3 legal moves return only available lines."""
    lines = [
        "info depth 5 multipv 1 score cp 50 pv e2e4",
        "bestmove e2e4",
    ]
    result = _engine_with_output(lines)._collect_multipv_result()
    assert len(result["lines"]) == 1
    assert result["best_move"] == "e2e4"


def test_collect_multipv_empty_result():
    """No info lines before bestmove → eval_cp None and empty lines list."""
    result = _engine_with_output(["bestmove (none)"])._collect_multipv_result()
    assert result["eval_cp"] is None
    assert result["best_move"] is None
    assert result["lines"] == []
