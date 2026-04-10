import styles from "./DebugPanel.module.css";

interface DebugPanelProps {
  debugMsg: string | null;
  opponentMoveDebug: string | null;
  llmDebugMsg: string | null;
  explanationPending: boolean;
}

export function DebugPanel({ debugMsg, opponentMoveDebug, llmDebugMsg, explanationPending }: DebugPanelProps) {
  const showEngine = debugMsg || opponentMoveDebug;
  const showLlm = explanationPending || llmDebugMsg;
  if (!showEngine && !showLlm) return null;

  return (
    <>
      {showEngine && (
        <div className={styles.panel}>
          <span className={styles.label}>Engine Timing</span>
          {opponentMoveDebug && <p className={styles.msg}>{opponentMoveDebug}</p>}
          {debugMsg && <p className={styles.msg}>{debugMsg}</p>}
        </div>
      )}
      {showLlm && (
        <div className={styles.panel}>
          <span className={styles.label}>LLM</span>
          {explanationPending
            ? <p className={styles.pending}>Polling...</p>
            : <p className={styles.msg}>{llmDebugMsg}</p>
          }
        </div>
      )}
    </>
  );
}
