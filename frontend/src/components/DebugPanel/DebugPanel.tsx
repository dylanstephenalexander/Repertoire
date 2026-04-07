import styles from "./DebugPanel.module.css";

interface DebugPanelProps {
  debugMsg: string | null;
  opponentMoveDebug: string | null;
  llmDebugMsg: string | null;
}

export function DebugPanel({ debugMsg, opponentMoveDebug, llmDebugMsg }: DebugPanelProps) {
  if (!debugMsg && !opponentMoveDebug && !llmDebugMsg) return null;

  return (
    <>
      {(debugMsg || opponentMoveDebug) && (
        <div className={styles.panel}>
          <span className={styles.label}>Engine Timing</span>
          {opponentMoveDebug && <p className={styles.msg}>{opponentMoveDebug}</p>}
          {debugMsg && <p className={styles.msg}>{debugMsg}</p>}
        </div>
      )}
      {llmDebugMsg && (
        <div className={styles.panel}>
          <span className={styles.label}>LLM</span>
          <p className={styles.msg}>{llmDebugMsg}</p>
        </div>
      )}
    </>
  );
}
