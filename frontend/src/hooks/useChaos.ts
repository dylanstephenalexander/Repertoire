import { useCallback, useRef, useState } from "react";
import { Chess } from "chess.js";
import {
  fetchChaosOpponentMove,
  fetchEngineStatus,
  sendChaosMove,
  startChaos,
} from "../api/chaos";
import type { ChaosStartParams } from "../api/chaos";
import type { Feedback } from "../types";

type ChaosStatus =
  | "idle"
  | "opponent_thinking"
  | "playing"
  | "complete";

interface ChaosState {
  sessionId: string;
  fen: string;
  userColor: "white" | "black";
  status: ChaosStatus;
  feedback: Feedback | null;
  openingName: string | null;
  inTheory: boolean;
  eloBand: number;
  feedbackEnabled: boolean;
}

interface EngineStatus {
  lc0: boolean;
  maiaModels: number[];
}

interface UseChaosReturn {
  chaosSession: ChaosState | null;
  engineStatus: EngineStatus | null;
  checkEngineStatus: () => Promise<void>;
  beginChaos: (params: ChaosStartParams) => Promise<void>;
  chaosMove: (uciMove: string) => Promise<void>;
  toggleFeedback: () => void;
  resign: () => void;
}

const MIN_THINKING_MS = 500;

export function useChaos(): UseChaosReturn {
  const [chaosSession, setChaosSession] = useState<ChaosState | null>(null);
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);
  const lastParams = useRef<ChaosStartParams | null>(null);

  const checkEngineStatus = useCallback(async () => {
    try {
      const resp = await fetchEngineStatus();
      setEngineStatus({ lc0: resp.lc0, maiaModels: resp.maia_models });
    } catch {
      setEngineStatus({ lc0: false, maiaModels: [] });
    }
  }, []);

  const triggerOpponentMove = useCallback(
    async (sessionId: string) => {
      setChaosSession((s) =>
        s ? { ...s, status: "opponent_thinking" } : s
      );

      const [resp] = await Promise.all([
        fetchChaosOpponentMove(sessionId).catch(() => null),
        new Promise((r) => setTimeout(r, MIN_THINKING_MS)),
      ]);

      if (resp) {
        setChaosSession((s) =>
          s
            ? {
                ...s,
                fen: resp.fen,
                status: "playing",
                openingName: resp.opening_name ?? s.openingName,
                inTheory: resp.in_theory,
              }
            : s
        );
      } else {
        setChaosSession((s) => (s ? { ...s, status: "complete" } : s));
      }
    },
    []
  );

  const beginChaos = useCallback(
    async (params: ChaosStartParams) => {
      lastParams.current = params;
      const resp = await startChaos(params);
      const initial: ChaosState = {
        sessionId: resp.session_id,
        fen: resp.fen,
        userColor: resp.user_color,
        status: "playing",
        feedback: null,
        openingName: null,
        inTheory: false,
        eloBand: params.elo_band,
        feedbackEnabled: true,
      };
      setChaosSession(initial);

      if (resp.user_color === "black") {
        await triggerOpponentMove(resp.session_id);
      }
    },
    [triggerOpponentMove]
  );

  const chaosMove = useCallback(
    async (uciMove: string) => {
      if (!chaosSession || chaosSession.status !== "playing") return;

      // Optimistic update
      const chess = new Chess(chaosSession.fen);
      chess.move({
        from: uciMove.slice(0, 2),
        to: uciMove.slice(2, 4),
        promotion: uciMove.length === 5 ? uciMove[4] : undefined,
      });
      const optimisticFen = chess.fen();
      setChaosSession((s) => (s ? { ...s, fen: optimisticFen, feedback: null } : s));

      const resp = await sendChaosMove(
        chaosSession.sessionId,
        uciMove,
        chaosSession.feedbackEnabled,
      );

      setChaosSession((s) =>
        s
          ? {
              ...s,
              fen: resp.fen,
              feedback: resp.feedback ?? null,
              openingName: resp.opening_name ?? s.openingName,
              inTheory: resp.in_theory,
            }
          : s
      );

      await triggerOpponentMove(chaosSession.sessionId);
    },
    [chaosSession, triggerOpponentMove]
  );

  const toggleFeedback = useCallback(() => {
    setChaosSession((s) =>
      s ? { ...s, feedbackEnabled: !s.feedbackEnabled } : s
    );
  }, []);

  const resign = useCallback(() => {
    setChaosSession((s) => (s ? { ...s, status: "complete" } : s));
  }, []);

  const clearChaosSession = useCallback(() => {
    setChaosSession(null);
    lastParams.current = null;
  }, []);

  const restartChaos = useCallback(async () => {
    if (!lastParams.current) return;
    await beginChaos(lastParams.current);
  }, [beginChaos]);

  return {
    chaosSession,
    engineStatus,
    checkEngineStatus,
    beginChaos,
    chaosMove,
    toggleFeedback,
    resign,
    clearChaosSession,
    restartChaos,
  };
}
