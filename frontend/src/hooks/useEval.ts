import { useEffect, useState } from "react";
import { Chess } from "chess.js";
import { fetchEval } from "../api/analysis";

interface EvalState {
  evalCp: number | null;
  loading: boolean;
}

/** Resolve terminal positions without hitting the engine. */
function terminalEval(fen: string): number | null {
  try {
    const chess = new Chess(fen);
    if (chess.isCheckmate()) {
      // The side to move is mated — from white POV: +30000 if black is mated, -30000 if white
      return chess.turn() === "w" ? -30000 : 30000;
    }
    if (chess.isDraw() || chess.isStalemate()) return 0;
  } catch {
    // invalid FEN — fall through to engine
  }
  return null;
}

export function useEval(fen: string | null): EvalState {
  const [state, setState] = useState<EvalState>({ evalCp: null, loading: false });

  useEffect(() => {
    if (!fen) return;

    // Short-circuit terminal positions — no engine call needed
    const terminal = terminalEval(fen);
    if (terminal !== null) {
      setState({ evalCp: terminal, loading: false });
      return;
    }

    let cancelled = false;

    const timer = setTimeout(() => {
      setState({ evalCp: null, loading: true });

      fetchEval(fen)
        .then((resp) => {
          if (!cancelled) {
            setState({ evalCp: resp.eval_cp, loading: false });
          }
        })
        .catch(() => {
          if (!cancelled) {
            setState({ evalCp: null, loading: false });
          }
        });
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [fen]);

  return state;
}
