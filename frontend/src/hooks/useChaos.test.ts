import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useChaos, _setThinkingDelayForTest } from "./useChaos";

beforeEach(() => { _setThinkingDelayForTest(0); });


// ---------------------------------------------------------------------------
// Mock API layer
// ---------------------------------------------------------------------------

vi.mock("../api/chaos", () => ({
  fetchEngineStatus: vi.fn(),
  startChaos: vi.fn(),
  sendChaosMove: vi.fn(),
  fetchChaosOpponentMove: vi.fn(),
  fetchChaosExplanation: vi.fn().mockResolvedValue({ explanation: null, llm_debug: null }),
}));

import * as chaosApi from "../api/chaos";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const AFTER_E4_FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
const AFTER_E5_FEN = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";

const DEFAULT_PARAMS = {
  color: "white" as const,
  elo_band: 1500,
};

const GOOD_MOVE_RESP = {
  fen: AFTER_E4_FEN,
  feedback: null,
  opening_name: null,
  in_theory: false,
  debug_msg: null,
};

const OPPONENT_MOVE_RESP_E5 = {
  uci_move: "e7e5",
  fen: AFTER_E5_FEN,
  opening_name: null,
  in_theory: false,
  opponent_move_time: null,
  opponent_engine: null,
};

const MISTAKE_FEEDBACK = {
  quality: "mistake" as const,
  explanation: "That loses material.",
  centipawn_loss: 80,
  lines: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// checkEngineStatus
// ---------------------------------------------------------------------------

describe("checkEngineStatus", () => {
  it("populates engineStatus from API response", async () => {
    vi.mocked(chaosApi.fetchEngineStatus).mockResolvedValue({
      lc0: true,
      maia_models: [1100, 1200, 1300],
    });

    const { result } = renderHook(() => useChaos());
    await act(async () => { await result.current.checkEngineStatus(); });

    expect(result.current.engineStatus?.lc0).toBe(true);
    expect(result.current.engineStatus?.maiaModels).toEqual([1100, 1200, 1300]);
  });

  it("sets lc0: false on fetch error", async () => {
    vi.mocked(chaosApi.fetchEngineStatus).mockRejectedValue(new Error("network"));

    const { result } = renderHook(() => useChaos());
    await act(async () => { await result.current.checkEngineStatus(); });

    expect(result.current.engineStatus?.lc0).toBe(false);
    expect(result.current.engineStatus?.maiaModels).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// beginChaos
// ---------------------------------------------------------------------------

describe("beginChaos", () => {
  it("starts session with playing status for white", async () => {
    vi.mocked(chaosApi.startChaos).mockResolvedValue({
      session_id: "abc",
      fen: START_FEN,
      user_color: "white",
    });

    const { result } = renderHook(() => useChaos());
    await act(async () => { await result.current.beginChaos(DEFAULT_PARAMS); });

    expect(result.current.chaosSession?.status).toBe("playing");
    expect(result.current.chaosSession?.userColor).toBe("white");
    expect(result.current.chaosSession?.feedbackEnabled).toBe(true);
  });

  it("feedback is enabled by default", async () => {
    vi.mocked(chaosApi.startChaos).mockResolvedValue({
      session_id: "abc",
      fen: START_FEN,
      user_color: "white",
    });

    const { result } = renderHook(() => useChaos());
    await act(async () => { await result.current.beginChaos(DEFAULT_PARAMS); });

    expect(result.current.chaosSession?.feedbackEnabled).toBe(true);
  });

  it("triggers opponent move when playing as black", async () => {
    vi.mocked(chaosApi.startChaos).mockResolvedValue({
      session_id: "abc",
      fen: START_FEN,
      user_color: "black",
    });
    vi.mocked(chaosApi.fetchChaosOpponentMove).mockResolvedValue({
      uci_move: "e2e4",
      fen: AFTER_E4_FEN,
      opening_name: null,
      in_theory: false,
      opponent_move_time: null,
      opponent_engine: null,
    });

    const { result } = renderHook(() => useChaos());
    act(() => { result.current.beginChaos({ ...DEFAULT_PARAMS, color: "black" }); });

    await waitFor(
      () => expect(chaosApi.fetchChaosOpponentMove).toHaveBeenCalledWith("abc"),
      { timeout: 2500 },
    );
    await waitFor(
      () => expect(result.current.chaosSession?.fen).toBe(AFTER_E4_FEN),
      { timeout: 2500 },
    );
  });

  it("does NOT trigger opponent move when playing as white", async () => {
    vi.mocked(chaosApi.startChaos).mockResolvedValue({
      session_id: "abc",
      fen: START_FEN,
      user_color: "white",
    });

    const { result } = renderHook(() => useChaos());
    await act(async () => { await result.current.beginChaos(DEFAULT_PARAMS); });

    expect(chaosApi.fetchChaosOpponentMove).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// chaosMove
// ---------------------------------------------------------------------------

describe("chaosMove", () => {
  async function startWhiteSession() {
    vi.mocked(chaosApi.startChaos).mockResolvedValue({
      session_id: "abc",
      fen: START_FEN,
      user_color: "white",
    });
    const hook = renderHook(() => useChaos());
    await act(async () => { await hook.result.current.beginChaos(DEFAULT_PARAMS); });
    return hook;
  }

  it("applies optimistic FEN immediately", async () => {
    const { result } = await startWhiteSession();
    vi.mocked(chaosApi.sendChaosMove).mockReturnValue(new Promise(() => {}));

    act(() => { result.current.chaosMove("e2e4"); });
    expect(result.current.chaosSession?.fen).not.toBe(START_FEN);
  });

  it("updates fen and clears feedback after confirmed move", async () => {
    const { result } = await startWhiteSession();

    vi.mocked(chaosApi.sendChaosMove).mockResolvedValue(GOOD_MOVE_RESP);
    vi.mocked(chaosApi.fetchChaosOpponentMove).mockResolvedValue(OPPONENT_MOVE_RESP_E5);

    await act(async () => { await result.current.chaosMove("e2e4"); });

    await waitFor(
      () => expect(result.current.chaosSession?.fen).toBe(AFTER_E5_FEN),
      { timeout: 2500 },
    );
    expect(result.current.chaosSession?.feedback).toBeNull();
  });

  it("stores feedback from move response before opponent moves", async () => {
    const { result } = await startWhiteSession();

    vi.mocked(chaosApi.sendChaosMove).mockResolvedValue({
      ...GOOD_MOVE_RESP,
      feedback: MISTAKE_FEEDBACK,
    });
    // Opponent move never resolves — lets us assert feedback mid-flight
    vi.mocked(chaosApi.fetchChaosOpponentMove).mockReturnValue(new Promise(() => {}));

    act(() => { result.current.chaosMove("e2e4"); });

    await waitFor(
      () => expect(result.current.chaosSession?.feedback?.quality).toBe("mistake"),
      { timeout: 2500 },
    );
  });

  it("stores opening name when returned", async () => {
    const { result } = await startWhiteSession();

    vi.mocked(chaosApi.sendChaosMove).mockResolvedValue({
      ...GOOD_MOVE_RESP,
      opening_name: "King's Pawn Game",
      in_theory: true,
    });
    vi.mocked(chaosApi.fetchChaosOpponentMove).mockResolvedValue({
      ...OPPONENT_MOVE_RESP_E5,
      opening_name: "King's Pawn Game",
      in_theory: true,
    });

    await act(async () => { await result.current.chaosMove("e2e4"); });

    await waitFor(
      () => expect(result.current.chaosSession?.openingName).toBe("King's Pawn Game"),
      { timeout: 2500 },
    );
  });

  it("ignores move() when not in playing status", async () => {
    const { result } = await startWhiteSession();
    act(() => { result.current.resign(); });

    vi.clearAllMocks();
    await act(async () => { await result.current.chaosMove("e2e4"); });

    expect(chaosApi.sendChaosMove).not.toHaveBeenCalled();
  });

  it("passes feedbackEnabled to API", async () => {
    const { result } = await startWhiteSession();

    vi.mocked(chaosApi.sendChaosMove).mockResolvedValue(GOOD_MOVE_RESP);
    vi.mocked(chaosApi.fetchChaosOpponentMove).mockResolvedValue(OPPONENT_MOVE_RESP_E5);

    await act(async () => { await result.current.chaosMove("e2e4"); });

    expect(chaosApi.sendChaosMove).toHaveBeenCalledWith("abc", "e2e4", true);
  });
});

// ---------------------------------------------------------------------------
// toggleFeedback
// ---------------------------------------------------------------------------

describe("toggleFeedback", () => {
  it("toggles feedbackEnabled off and on", async () => {
    vi.mocked(chaosApi.startChaos).mockResolvedValue({
      session_id: "abc",
      fen: START_FEN,
      user_color: "white",
    });

    const { result } = renderHook(() => useChaos());
    await act(async () => { await result.current.beginChaos(DEFAULT_PARAMS); });

    expect(result.current.chaosSession?.feedbackEnabled).toBe(true);

    act(() => { result.current.toggleFeedback(); });
    expect(result.current.chaosSession?.feedbackEnabled).toBe(false);

    act(() => { result.current.toggleFeedback(); });
    expect(result.current.chaosSession?.feedbackEnabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resign
// ---------------------------------------------------------------------------

describe("resign", () => {
  it("sets status to complete", async () => {
    vi.mocked(chaosApi.startChaos).mockResolvedValue({
      session_id: "abc",
      fen: START_FEN,
      user_color: "white",
    });

    const { result } = renderHook(() => useChaos());
    await act(async () => { await result.current.beginChaos(DEFAULT_PARAMS); });

    expect(result.current.chaosSession?.status).toBe("playing");

    act(() => { result.current.resign(); });
    expect(result.current.chaosSession?.status).toBe("complete");
  });
});

// ---------------------------------------------------------------------------
// Draw detection
// ---------------------------------------------------------------------------

describe("draw detection", () => {
  async function startWhiteSession() {
    vi.mocked(chaosApi.startChaos).mockResolvedValue({
      session_id: "abc",
      fen: START_FEN,
      user_color: "white",
    });
    const hook = renderHook(() => useChaos());
    await act(async () => { await hook.result.current.beginChaos(DEFAULT_PARAMS); });
    return hook;
  }

  it("sets status complete and quality draw on stalemate FEN after user move", async () => {
    const STALEMATE_FEN = "k7/8/1QK5/8/8/8/8/8 b - - 0 1";
    const { result } = await startWhiteSession();

    vi.mocked(chaosApi.sendChaosMove).mockResolvedValue({
      fen: STALEMATE_FEN,
      feedback: null,
      opening_name: null,
      in_theory: false,
      debug_msg: null,
    });

    await act(async () => { await result.current.chaosMove("e2e4"); });

    expect(result.current.chaosSession?.status).toBe("complete");
    expect(result.current.chaosSession?.feedback?.quality).toBe("draw");
    expect(result.current.chaosSession?.feedback?.explanation).toMatch(/stalemate/i);
  });

  it("sets status complete and quality checkmate on checkmate FEN after opponent move", async () => {
    const CHECKMATE_FEN = "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3";
    const { result } = await startWhiteSession();

    vi.mocked(chaosApi.sendChaosMove).mockResolvedValue({
      fen: AFTER_E4_FEN,
      feedback: null,
      opening_name: null,
      in_theory: false,
      debug_msg: null,
    });
    vi.mocked(chaosApi.fetchChaosOpponentMove).mockResolvedValue({
      uci_move: "d8h4",
      fen: CHECKMATE_FEN,
      opening_name: null,
      in_theory: false,
      opponent_move_time: 0.1,
      opponent_engine: "Maia",
    });

    await act(async () => { await result.current.chaosMove("e2e4"); });

    await waitFor(
      () => expect(result.current.chaosSession?.status).toBe("complete"),
      { timeout: 2500 },
    );
    expect(result.current.chaosSession?.feedback?.quality).toBe("checkmate");
  });
});

// ---------------------------------------------------------------------------
// LLM explanation polling — only polls once, aborts previous on new mistake
// ---------------------------------------------------------------------------

describe("LLM explanation polling", () => {
  async function startWhiteSession() {
    vi.mocked(chaosApi.startChaos).mockResolvedValue({
      session_id: "abc",
      fen: START_FEN,
      user_color: "white",
    });
    const hook = renderHook(() => useChaos());
    await act(async () => { await hook.result.current.beginChaos(DEFAULT_PARAMS); });
    return hook;
  }

  it("polls explanation after a mistake and resolves llmDebugMsg", async () => {
    const { result } = await startWhiteSession();

    vi.mocked(chaosApi.sendChaosMove).mockResolvedValue({
      fen: AFTER_E4_FEN,
      feedback: MISTAKE_FEEDBACK,
      opening_name: null,
      in_theory: false,
      debug_msg: null,
    });
    vi.mocked(chaosApi.fetchChaosOpponentMove).mockReturnValue(new Promise(() => {}));

    let pollCount = 0;
    vi.mocked(chaosApi.fetchChaosExplanation).mockImplementation(() => {
      pollCount++;
      if (pollCount < 2) return Promise.resolve({ explanation: null, llm_debug: null });
      return Promise.resolve({ explanation: "Knight is hanging.", llm_debug: "gemini-2.0-flash — OK\n\nKnight is hanging." });
    });

    act(() => { result.current.chaosMove("e2e4"); });

    await waitFor(
      () => expect(result.current.chaosSession?.llmDebugMsg).toContain("OK"),
      { timeout: 8000 },
    );
    expect(result.current.chaosSession?.explanationPending).toBe(false);
  }, 10000);

  it("stops polling once explanation is received — does not keep calling", async () => {
    const { result } = await startWhiteSession();

    vi.mocked(chaosApi.sendChaosMove).mockResolvedValue({
      fen: AFTER_E4_FEN,
      feedback: MISTAKE_FEEDBACK,
      opening_name: null,
      in_theory: false,
      debug_msg: null,
    });
    vi.mocked(chaosApi.fetchChaosOpponentMove).mockReturnValue(new Promise(() => {}));

    let callCount = 0;
    vi.mocked(chaosApi.fetchChaosExplanation).mockImplementation(() => {
      callCount++;
      return Promise.resolve({ explanation: "Blunder.", llm_debug: "gemini-2.0-flash — OK\n\nBlunder." });
    });

    act(() => { result.current.chaosMove("e2e4"); });

    await waitFor(() => expect(result.current.chaosSession?.llmDebugMsg).toContain("OK"), { timeout: 5000 });

    // Polling stopped promptly — should be a small number, not 12 (the old bug)
    expect(callCount).toBeLessThan(3);
  }, 10000);

  it("does not poll for a good move", async () => {
    const { result } = await startWhiteSession();

    vi.mocked(chaosApi.sendChaosMove).mockResolvedValue({
      fen: AFTER_E4_FEN,
      feedback: null,
      opening_name: null,
      in_theory: false,
      debug_msg: null,
    });
    vi.mocked(chaosApi.fetchChaosOpponentMove).mockResolvedValue(OPPONENT_MOVE_RESP_E5);

    await act(async () => { await result.current.chaosMove("e2e4"); });
    await waitFor(() => expect(result.current.chaosSession?.fen).toBe(AFTER_E5_FEN), { timeout: 2500 });

    expect(chaosApi.fetchChaosExplanation).not.toHaveBeenCalled();
  });

  it("aborts previous poll when a second mistake is made", async () => {
    const { result } = await startWhiteSession();

    // Both moves return mistake feedback; opponent never moves
    vi.mocked(chaosApi.sendChaosMove).mockResolvedValue({
      fen: AFTER_E4_FEN,
      feedback: MISTAKE_FEEDBACK,
      opening_name: null,
      in_theory: false,
      debug_msg: null,
    });
    vi.mocked(chaosApi.fetchChaosOpponentMove).mockReturnValue(new Promise(() => {}));

    // First poll: never resolves (simulates slow LLM)
    let callCount = 0;
    vi.mocked(chaosApi.fetchChaosExplanation).mockImplementation(() => {
      callCount++;
      return new Promise(() => {}); // never resolves
    });

    // Make first mistake
    act(() => { result.current.chaosMove("e2e4"); });
    await waitFor(() => expect(result.current.chaosSession?.explanationPending).toBe(true), { timeout: 2500 });

    // Advance time to trigger first poll interval
    const callsAfterFirst = callCount;

    // Make second mistake — should abort the first poll
    act(() => { result.current.chaosMove("d2d4"); });
    await waitFor(() => expect(result.current.chaosSession?.explanationPending).toBe(true), { timeout: 2500 });

    // Give some time — second poll starts fresh; first poll should stop accumulating calls
    await new Promise((r) => setTimeout(r, 1200));
    const callsAfterSecond = callCount;

    // The aborted first loop should have stopped; only the second loop is running
    // Both loops were pending — but the first should be aborted, so calls should be bounded
    // (not 2x the rate of a single loop)
    expect(callsAfterSecond - callsAfterFirst).toBeLessThanOrEqual(2);
  });
});
