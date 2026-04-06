import type { MoveAnnotation, MoveQuality } from "../../types";
import styles from "./GameReview.module.css";

interface MoveListProps {
  moves: MoveAnnotation[];
  currentIndex: number;
  onSelect: (index: number) => void;
}

const QUALITY_LABEL: Record<MoveQuality, string> = {
  best: "",
  good: "",
  inaccuracy: "?!",
  mistake: "?",
  blunder: "??",
};

export function MoveList({ moves, currentIndex, onSelect }: MoveListProps) {
  // Group moves into pairs (white + black per row)
  const rows: Array<{ number: number; white: MoveAnnotation | null; black: MoveAnnotation | null; wIdx: number; bIdx: number }> = [];

  for (let i = 0; i < moves.length; ) {
    const wMove = moves[i].color === "white" ? moves[i] : null;
    const wIdx = moves[i].color === "white" ? i : -1;
    if (wMove) {
      const bMove = i + 1 < moves.length ? moves[i + 1] : null;
      const bIdx = bMove ? i + 1 : -1;
      rows.push({ number: moves[i].move_number, white: wMove, black: bMove, wIdx, bIdx });
      i += bMove ? 2 : 1;
    } else {
      // Game started mid-move (shouldn't happen in standard chess, but handle it)
      rows.push({ number: moves[i].move_number, white: null, black: moves[i], wIdx: -1, bIdx: i });
      i += 1;
    }
  }

  return (
    <div className={styles.moveList}>
      {rows.map((row) => (
        <div key={row.number} className={styles.moveRow}>
          <span className={styles.moveNumber}>{row.number}.</span>
          <MoveCell
            annotation={row.white}
            index={row.wIdx}
            isActive={currentIndex === row.wIdx}
            onSelect={onSelect}
          />
          <MoveCell
            annotation={row.black}
            index={row.bIdx}
            isActive={currentIndex === row.bIdx}
            onSelect={onSelect}
          />
        </div>
      ))}
    </div>
  );
}

function MoveCell({
  annotation,
  index,
  isActive,
  onSelect,
}: {
  annotation: MoveAnnotation | null;
  index: number;
  isActive: boolean;
  onSelect: (i: number) => void;
}) {
  if (!annotation) return <span className={styles.moveCell} />;

  const badge = QUALITY_LABEL[annotation.quality];
  const qualityClass = styles[`quality_${annotation.quality}`] ?? "";

  return (
    <button
      className={`${styles.moveCell} ${qualityClass} ${isActive ? styles.activeMove : ""}`}
      onClick={() => index >= 0 && onSelect(index)}
    >
      {annotation.move_san}
      {badge && <sup className={styles.qualityBadge}>{badge}</sup>}
    </button>
  );
}
