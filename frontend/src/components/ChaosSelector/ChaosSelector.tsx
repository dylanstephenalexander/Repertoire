import { useEffect, useState } from "react";
import type { ChaosStartParams } from "../../api/chaos";
import styles from "./ChaosSelector.module.css";

interface ChaosSelectorProps {
  onStart: (params: ChaosStartParams) => void;
  onBack: () => void;
  lc0Available: boolean;
  availableModels: number[];
}

const ELO_BANDS = [1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000] as const;
type ColorChoice = "white" | "black" | "random";

export function ChaosSelector({
  onStart,
  onBack,
  lc0Available,
  availableModels,
}: ChaosSelectorProps) {
  const [eloBand, setEloBand] = useState<number | null>(null);
  const [color, setColor] = useState<ColorChoice>("random");

  // Persist last-used Elo band
  useEffect(() => {
    const saved = localStorage.getItem("chaos_elo_band");
    if (saved) setEloBand(Number(saved));
  }, []);

  function handleStart() {
    if (!eloBand) return;
    localStorage.setItem("chaos_elo_band", String(eloBand));
    onStart({ color, elo_band: eloBand });
  }

  function bandLabel(band: number) {
    return band >= 2000 ? "2000+" : String(band);
  }

  function isBandDisabled(band: number) {
    if (band >= 2000) return false; // Stockfish — always available
    return !lc0Available || !availableModels.includes(band);
  }

  const canStart = !!eloBand && !isBandDisabled(eloBand);

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <button className={styles.backBtn} onClick={onBack}>← Back</button>
          <h1 className={styles.title}>Play vs Maia</h1>
        </div>

        {!lc0Available && (
          <div className={styles.warning}>
            <strong>lc0 not found.</strong> Maia models require lc0 to run.
            Install it and set <code>LC0_PATH</code>, or select 2000+ to play
            against full-strength Stockfish.
          </div>
        )}

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Opponent Elo</h2>
          <div className={styles.eloGrid}>
            {ELO_BANDS.map((band) => {
              const disabled = isBandDisabled(band);
              return (
                <button
                  key={band}
                  className={`${styles.eloBtn} ${eloBand === band ? styles.selected : ""} ${disabled ? styles.disabled : ""}`}
                  onClick={() => !disabled && setEloBand(band)}
                  disabled={disabled}
                >
                  {bandLabel(band)}
                </button>
              );
            })}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Play as</h2>
          <div className={styles.colorRow}>
            {(["white", "black", "random"] as const).map((c) => (
              <button
                key={c}
                className={`${styles.chip} ${color === c ? styles.selected : ""}`}
                onClick={() => setColor(c)}
              >
                {c === "random" ? "Random" : c.charAt(0).toUpperCase() + c.slice(1)}
              </button>
            ))}
          </div>
        </section>

        <button
          className={styles.startButton}
          disabled={!canStart}
          onClick={handleStart}
        >
          Start
        </button>
      </div>
    </div>
  );
}
