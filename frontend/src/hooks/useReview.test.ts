import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useReview } from "./useReview";

vi.mock("../api/review", () => ({
  fetchGames: vi.fn(),
  analyseGame: vi.fn(),
}));

import * as reviewApi from "../api/review";

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const AFTER_E4_FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

const MOCK_GAME = {
  url: "https://chess.com/game/1",
  pgn: "[Event \"Test\"]\n1. e4 *",
  white: "alice",
  black: "bob",
  result: "1-0",
  date: "2024-01-01",
  time_class: "rapid",
};

const MOCK_ANNOTATION = {
  move_number: 1,
  color: "white" as const,
  move_san: "e4",
  move_uci: "e2e4",
  quality: "best" as const,
  cp_loss: null,
  best_move_san: null,
  explanation: null,
  fen_before: STARTING_FEN,
  eval_cp: 30,
};

const MOCK_REVIEW = {
  white: "alice",
  black: "bob",
  result: "1-0",
  moves: [MOCK_ANNOTATION],
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe("initial state", () => {
  it("starts idle with no games or review", () => {
    const { result } = renderHook(() => useReview());
    expect(result.current.state.phase).toBe("idle");
    expect(result.current.state.games).toEqual([]);
    expect(result.current.state.review).toBeNull();
    expect(result.current.currentFen).toBe(STARTING_FEN);
    expect(result.current.currentEvalCp).toBeNull();
    expect(result.current.currentAnnotation).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// loadGames
// ---------------------------------------------------------------------------

describe("loadGames", () => {
  it("transitions to selecting with games on success", async () => {
    vi.mocked(reviewApi.fetchGames).mockResolvedValue([MOCK_GAME]);

    const { result } = renderHook(() => useReview());
    await act(async () => {
      await result.current.loadGames({ username: "alice", source: "chess.com", year: 2024, month: 1 });
    });

    expect(result.current.state.phase).toBe("selecting");
    expect(result.current.state.games).toHaveLength(1);
    expect(result.current.state.games[0].white).toBe("alice");
  });

  it("sets error and returns to idle on failure", async () => {
    vi.mocked(reviewApi.fetchGames).mockRejectedValue(new Error("404 Not Found"));

    const { result } = renderHook(() => useReview());
    await act(async () => {
      await result.current.loadGames({ username: "nobody", source: "lichess" });
    });

    expect(result.current.state.phase).toBe("idle");
    expect(result.current.state.error).toContain("Not Found");
  });

  it("sets phase to fetching during load", async () => {
    let resolvePromise!: (v: typeof MOCK_GAME[]) => void;
    vi.mocked(reviewApi.fetchGames).mockReturnValue(new Promise((r) => { resolvePromise = r; }));

    const { result } = renderHook(() => useReview());
    act(() => { result.current.loadGames({ username: "alice", source: "lichess" }); });

    expect(result.current.state.phase).toBe("fetching");
    await act(async () => { resolvePromise([MOCK_GAME]); });
  });
});

// ---------------------------------------------------------------------------
// analyse
// ---------------------------------------------------------------------------

describe("analyse", () => {
  it("transitions to reviewing with review data on success", async () => {
    vi.mocked(reviewApi.analyseGame).mockResolvedValue(MOCK_REVIEW);

    const { result } = renderHook(() => useReview());
    await act(async () => {
      await result.current.analyse("[Event \"Test\"]\n1. e4 *");
    });

    expect(result.current.state.phase).toBe("reviewing");
    expect(result.current.state.review).toEqual(MOCK_REVIEW);
    expect(result.current.state.currentMoveIndex).toBe(-1);
  });

  it("returns to selecting with error on failure", async () => {
    vi.mocked(reviewApi.fetchGames).mockResolvedValue([MOCK_GAME]);
    vi.mocked(reviewApi.analyseGame).mockRejectedValue(new Error("Engine unavailable"));

    const { result } = renderHook(() => useReview());
    await act(async () => {
      await result.current.loadGames({ username: "alice", source: "lichess" });
    });
    await act(async () => {
      await result.current.analyse("pgn");
    });

    expect(result.current.state.phase).toBe("selecting");
    expect(result.current.state.error).toContain("Engine unavailable");
  });
});

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

describe("navigation", () => {
  async function setupReviewing() {
    vi.mocked(reviewApi.analyseGame).mockResolvedValue(MOCK_REVIEW);
    const hook = renderHook(() => useReview());
    await act(async () => {
      await hook.result.current.analyse("pgn");
    });
    return hook;
  }

  it("currentFen is starting FEN at index -1", async () => {
    const { result } = await setupReviewing();
    expect(result.current.state.currentMoveIndex).toBe(-1);
    expect(result.current.currentFen).toBe(STARTING_FEN);
  });

  it("nextMove advances index and updates currentFen", async () => {
    const { result } = await setupReviewing();
    act(() => result.current.nextMove());

    expect(result.current.state.currentMoveIndex).toBe(0);
    expect(result.current.currentFen).toBe(AFTER_E4_FEN);
  });

  it("prevMove at -1 stays at -1", async () => {
    const { result } = await setupReviewing();
    act(() => result.current.prevMove());
    expect(result.current.state.currentMoveIndex).toBe(-1);
  });

  it("nextMove at last move does not go past end", async () => {
    const { result } = await setupReviewing();
    act(() => result.current.nextMove()); // 0
    act(() => result.current.nextMove()); // still 0 (only 1 move)
    expect(result.current.state.currentMoveIndex).toBe(0);
  });

  it("goToMove sets index directly", async () => {
    const { result } = await setupReviewing();
    act(() => result.current.goToMove(0));
    expect(result.current.state.currentMoveIndex).toBe(0);
  });

  it("currentAnnotation is null at start", async () => {
    const { result } = await setupReviewing();
    expect(result.current.currentAnnotation).toBeNull();
  });

  it("currentAnnotation is set after nextMove", async () => {
    const { result } = await setupReviewing();
    act(() => result.current.nextMove());
    expect(result.current.currentAnnotation).toEqual(MOCK_ANNOTATION);
  });

  it("currentEvalCp reflects annotation eval_cp after advancing", async () => {
    const { result } = await setupReviewing();
    act(() => result.current.nextMove());
    expect(result.current.currentEvalCp).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// reset
// ---------------------------------------------------------------------------

describe("reset", () => {
  it("returns to initial idle state", async () => {
    vi.mocked(reviewApi.analyseGame).mockResolvedValue(MOCK_REVIEW);

    const { result } = renderHook(() => useReview());
    await act(async () => {
      await result.current.analyse("pgn");
    });
    act(() => result.current.reset());

    expect(result.current.state.phase).toBe("idle");
    expect(result.current.state.review).toBeNull();
    expect(result.current.currentFen).toBe(STARTING_FEN);
  });
});
