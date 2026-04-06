import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MoveList } from "./MoveList";
import type { MoveAnnotation } from "../../types";

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const AFTER_E4_FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

const E4: MoveAnnotation = {
  move_number: 1,
  color: "white",
  move_san: "e4",
  move_uci: "e2e4",
  quality: "best",
  cp_loss: null,
  best_move_san: null,
  explanation: null,
  fen_before: STARTING_FEN,
  eval_cp: 30,
};

const E5: MoveAnnotation = {
  move_number: 1,
  color: "black",
  move_san: "e5",
  move_uci: "e7e5",
  quality: "blunder",
  cp_loss: 200,
  best_move_san: "c5",
  explanation: "e5 is a blunder.",
  fen_before: AFTER_E4_FEN,
  eval_cp: -30,
};

const NF3: MoveAnnotation = {
  move_number: 2,
  color: "white",
  move_san: "Nf3",
  move_uci: "g1f3",
  quality: "mistake",
  cp_loss: 80,
  best_move_san: "Nc3",
  explanation: "Nf3 is a mistake.",
  fen_before: STARTING_FEN, // not accurate but fine for test
  eval_cp: 20,
};

describe("MoveList", () => {
  it("renders move SANs", () => {
    render(<MoveList moves={[E4, E5]} currentIndex={-1} onSelect={vi.fn()} />);
    expect(screen.getByText("e4")).toBeInTheDocument();
    expect(screen.getByText("e5")).toBeInTheDocument();
  });

  it("renders move numbers", () => {
    render(<MoveList moves={[E4, E5]} currentIndex={-1} onSelect={vi.fn()} />);
    expect(screen.getByText("1.")).toBeInTheDocument();
  });

  it("renders blunder badge ??", () => {
    render(<MoveList moves={[E4, E5]} currentIndex={-1} onSelect={vi.fn()} />);
    expect(screen.getByText("??")).toBeInTheDocument();
  });

  it("renders mistake badge ?", () => {
    render(<MoveList moves={[E4, NF3]} currentIndex={-1} onSelect={vi.fn()} />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("does not render badge for best moves", () => {
    render(<MoveList moves={[E4]} currentIndex={-1} onSelect={vi.fn()} />);
    // Best has empty badge — no ✓ rendered
    expect(screen.queryByText("✓")).not.toBeInTheDocument();
  });

  it("calls onSelect with correct index on click", async () => {
    const onSelect = vi.fn();
    render(<MoveList moves={[E4, E5]} currentIndex={-1} onSelect={onSelect} />);
    await userEvent.click(screen.getByText("e5"));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("applies activeMove style to current index", () => {
    const { container } = render(
      <MoveList moves={[E4, E5]} currentIndex={0} onSelect={vi.fn()} />
    );
    const buttons = container.querySelectorAll("button");
    // First move button (e4) should have activeMove class
    expect(buttons[0].className).toMatch(/activeMove/);
    expect(buttons[1].className).not.toMatch(/activeMove/);
  });

  it("groups white and black moves on the same row", () => {
    const { container } = render(
      <MoveList moves={[E4, E5]} currentIndex={-1} onSelect={vi.fn()} />
    );
    // One row for move 1
    const rows = container.querySelectorAll("[class*='moveRow']");
    expect(rows).toHaveLength(1);
  });

  it("handles multiple move numbers correctly", () => {
    render(<MoveList moves={[E4, E5, NF3]} currentIndex={-1} onSelect={vi.fn()} />);
    expect(screen.getByText("1.")).toBeInTheDocument();
    expect(screen.getByText("2.")).toBeInTheDocument();
  });
});
