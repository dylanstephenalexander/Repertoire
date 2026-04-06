import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Board, resolveMove } from "./Board";

// react-chessboard uses ResizeObserver which jsdom doesn't provide
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal("ResizeObserver", MockResizeObserver);

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// ---------------------------------------------------------------------------
// resolveMove — unit tests (no React)
// ---------------------------------------------------------------------------

describe("resolveMove", () => {
  it("returns UCI for a legal pawn move", () => {
    expect(resolveMove(STARTING_FEN, "e2", "e4")).toBe("e2e4");
  });

  it("returns null for an illegal move", () => {
    expect(resolveMove(STARTING_FEN, "e2", "e5")).toBeNull();
  });

  it("returns null when moving opponent's piece", () => {
    expect(resolveMove(STARTING_FEN, "e7", "e5")).toBeNull();
  });

  it("appends promotion piece for pawn promotion", () => {
    // White pawn on e7, about to promote
    const fen = "8/4P3/8/8/8/8/8/4K2k w - - 0 1";
    const uci = resolveMove(fen, "e7", "e8");
    expect(uci).toBe("e7e8q");
  });

  it("resolves king-onto-own-rook as castling (kingside)", () => {
    // White has kingside castling rights, king on e1, rook on h1
    const fen = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1";
    expect(resolveMove(fen, "e1", "h1")).toBe("e1g1");
  });

  it("resolves king-onto-own-rook as castling (queenside)", () => {
    const fen = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1";
    expect(resolveMove(fen, "e1", "a1")).toBe("e1c1");
  });

  it("returns null if king drags onto rook but castling not available", () => {
    // Castling rights stripped
    const fen = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w - - 0 1";
    expect(resolveMove(fen, "e1", "h1")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Board component — render / disabled
// ---------------------------------------------------------------------------

describe("Board component", () => {
  it("renders without crashing", () => {
    render(
      <Board
        fen={STARTING_FEN}
        orientation="white"
        onMove={vi.fn()}
        disabled={false}
      />
    );
    // react-chessboard renders a div wrapper — just check it mounts
    expect(document.querySelector('[data-testid], canvas, .cg-wrap, div')).toBeTruthy();
  });
});
