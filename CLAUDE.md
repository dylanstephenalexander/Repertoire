# CLAUDE.md

## Response Style
- Plans: maximally concise, grammar optional. End with unresolved questions.
- Code: quality > speed. Never proceed to implementation without a passing design review.

## Review Style
- No filler praise ("Great idea!", "That's a smart approach").
- If something is wrong or suboptimal, say so directly and first.
- Critique code and decisions as if shipping quality is the only metric.

## Project
Chess openings trainer (React/TS + FastAPI + Stockfish). Target user: all skill levels (~200–2000+ Elo).

## Stack
- Backend: FastAPI (Python)
- Frontend: React (TypeScript)
- Engine: Stockfish v18 (eval + move analysis, multipv)
- Testing: pytest (backend), React Testing Library (frontend)
- Linting: Ruff

## Dev setup
```bash
# Backend
brew install stockfish
export STOCKFISH_PATH=$(which stockfish)
cd backend && python -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload

# Frontend
cd frontend && npm install && npm run dev   # http://localhost:5173
cd frontend && npm test                    # vitest (jsdom)
```

Tests requiring a real engine are gated on `STOCKFISH_PATH`:
```bash
STOCKFISH_PATH=$(which stockfish) python -m pytest tests/
```

## Workflow (mandatory)
For every feature:
1. Propose: folder structure, data models, API contract, and open questions.
2. Wait for explicit approval.
3. Implement exactly what was approved — nothing more.
4. Write tests before marking complete.
5. Tests must pass before moving to the next feature.

## Code Standards
- Modular, clean architecture. Easy to refactor.
- No unnecessary dependencies.
- No vibe coding. If something feels hacky, flag it.

## Move Explanations (critical UX rule)
Explanations must match the user's skill level.
- Beginner: plain English, no jargon. BAD: "You lost tempo" GOOD: "This move lets your opponent attack your queen for free"
- Advanced: engine output (centipawn loss, depth, lines) is appropriate

## Elo & Difficulty
- Study Mode: Elo-agnostic. Always drills theoretically correct moves.
- Elo is adjustable any time (settings, not buried in menus) — relevant when Chaos Mode is implemented.

## MVP Features (in order)
1. Study Mode (color + opening selection, accuracy score)
2. Move Feedback System (Stockfish-powered, beginner-friendly)
3. Evaluation Bar

## Next to Implement

**QoL Pass**

1. **Board UX — Drag Precision**: `react-chessboard` drag sensitivity is too tight — requires pixel-perfect placement, causing pieces to snap back if dropped slightly off-square. Also, rapid moves when it's the user's turn can fail silently (move rejected, piece snaps back with no feedback). Investigate `react-chessboard` drop tolerance options; add a visible "illegal move" flash or shake animation so the user knows why a move was rejected rather than wondering if it registered.

2. **Sound Effects**: Add sound effects for moves. Use the standard chess sound set (move, capture, check, castle, game-end). Differentiate by move type — detect from the move result or SAN. Keep a global mute toggle.

3. **View Previous Moves**: Should be able to iterate through previous moves within a game. Back to Start, Back to Current, Back One Move, Forward One Move. View-only — cannot replay from that position. Moves should be stored alongside their eval/feedback so Stockfish does not need to recalculate.

4. **Captured Pieces Display**: Show pieces taken by each side, sorted by value. Standard chess UI convention. Derives entirely from move history (no engine call needed) — compute from `move_history` using python-chess on the backend or chess.js on the frontend.

## Post-MVP Ideas
- **Game Review**: fetch past games from chess.com public API (`api.chess.com/pub/player/{username}/games/{year}/{month}`, no auth needed for public games), run move-by-move through local Stockfish, annotate blunders/mistakes/inaccuracies with "better was X" suggestions. Bypasses chess.com's depth-limited premium review using the user's own engine. Infrastructure (Stockfish, board rendering) is already in place — the work is the annotation UI.
- **Chaos Mode**: opponent scales to user's current Elo (UCI_LimitStrength + UCI_Elo). Two-request pattern — user move then separate `opponent_move` so frontend controls animation timing. Suggest Elo adjustment after session based on performance. Note: `UCI_LimitStrength` has a floor of ~1320 Elo and doesn't simulate human-like mistakes well at lower ratings — consider **Maia Chess** for sub-1600 play. Maia is a neural net trained on millions of human games at specific Elo bands (1100–1900), predicts the move a human at that level would actually play (blunders included), and is UCI-compatible (drop-in replacement for the opponent engine at low Elos). See: [lczero.org/play/infrastructure/maia/](https://lczero.org/play/infrastructure/maia/).
- **Promotion Picker UI**: currently `resolveMove` in `Board.tsx` always promotes to queen (hardcoded). A real picker should appear when a pawn reaches the back rank — show the four piece options (Q/R/B/N), let the user click one, then send the 5-char UCI. `react-chessboard` has a built-in `promotionDialogVariant` option; alternatively render a custom overlay. The seam is already clean: `useSession.move()` already handles 5-char UCI strings.
- **LLM Move Explanations**: replace hardcoded feedback templates in `backend/app/services/feedback.py` with Claude API calls. The `build_*_feedback` functions are the right seam — add `pre_move_fen: str` param and swap templates for a prompt. Needs `ANTHROPIC_API_KEY` env var; template strings stay as fallback when key is absent. Prompt shape: "In this position [FEN], the player moved [played_san] instead of [best_san] (-[cp_loss]cp). Explain in one sentence for a [skill_level] player." Would produce "You shouldn't move your knight there because the Queen can take it" style explanations naturally.
- **Desktop App (Electron/Tauri)**: bundle as a native desktop app so Stockfish, lc0, and Maia weights ship inside the package — no user install steps. Two viable options: **Electron** (Chromium + Node, larger bundle ~150MB but mature, easiest FastAPI sidecar story), **Tauri** (Rust shell + system WebView, ~10MB, faster startup, slightly more work for Python sidecar). FastAPI runs as a child process spawned by the shell on app launch; stdout/stderr piped for crash recovery. Stockfish + lc0 binaries go in `resources/` and are extracted to app data dir on first launch. Auto-update via Electron's built-in updater or Tauri updater plugin. Key remaining work: code-sign (macOS notarization required for Gatekeeper), platform-specific binary bundles (macOS arm64/x86_64 universal, Windows x64, Linux AppImage), Python bundling via PyInstaller or cx_Freeze to produce a single FastAPI executable (removes Python runtime dependency — preferred for distribution).
- **Settings Panel**: eval bar toggle, feedback toggle, skill level selector — currently scattered. Consolidate into a `Settings/` slide-in panel (gear icon in sidebar). Designed for extensibility: each setting is a row, easy to add new ones. **Notation mode** (AN / English / Both) is currently hardcoded to "readable" (`App.tsx` — `const notationMode: NotationMode = "readable"`); the `translateExplanation` utility and `NotationMode` type are fully implemented, just needs a settings toggle to expose it.
- **Sub-1100 Opponents**: Maia's floor is 1100. For lower Elos: (1) clamp to Maia-1100 with a UI note, (2) Stockfish `UCI_LimitStrength` (unrealistic, misses tactics randomly not human-like), (3) community Maia-extending weights covering 800–1000 when available. Revisit when bundling for distribution.
- **Deterministic Move Explanations**: LLM hallucinations make Gemini unreliable as the primary explanation source. Better approach: derive verifiable facts from python-chess (`_derive_tactical_facts` in `sessions.py` is already the skeleton — detects hanging pieces and opponent captures), format them directly into the explanation string. Cases to cover: (1) moved piece now hanging — done; (2) opponent's best reply captures a piece — done; (3) piece the moved piece was defending is now undefended (discovered weakness — `board.attackers()` before vs after); (4) moved piece is pinned against the king. Anything not matched falls back to a clean template. LLM stays as optional polish layer but should not be the primary path.
- **LLM Move Explanations**: Gemini is wired up (`backend/app/services/llm.py`). Currently unreliable — tends to produce vague or generic sentences even with FEN + tactical facts grounding. Kept around in case a better use is found (e.g. opening name trivia, study tips). Not the primary explanation path.
- **Sound Effects**: moved to Next to Implement.
- **View Previous Moves**: moved to Next to Implement.
- **Board UX — Drag Precision**: moved to Next to Implement.

## Architecture

```
Browser (React/TS) ↔ FastAPI (Python) ↔ Stockfish (UCI subprocess)
```

Stockfish runs as a long-lived child process (stdin/stdout UCI). Single instance for MVP, pooled later if needed.

## Folder Structure

```
repertoire/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── routers/
│   │   │   ├── openings.py
│   │   │   ├── analysis.py
│   │   │   └── session.py
│   │   ├── engine/
│   │   │   ├── stockfish.py     # UCI wrapper
│   │   │   └── eval.py
│   │   ├── models/
│   │   │   ├── opening.py
│   │   │   ├── session.py
│   │   │   └── feedback.py
│   │   ├── services/
│   │   │   ├── openings.py
│   │   │   ├── feedback.py      # skill-aware explanations
│   │   │   └── difficulty.py
│   │   └── data/
│   │       └── openings.tsv     # source of truth for opening theory (committed)
│   └── tests/
└── frontend/
    └── src/
        ├── components/
        │   ├── Board/
        │   ├── EvalBar/
        │   ├── Feedback/
        │   ├── OpeningSelector/
        │   └── Settings/
        ├── hooks/
        ├── api/
        └── types/
```

## API Contract (approved)

```
GET  /openings                                          → [{ id, name, color, variations: [{id, name}] }]
GET  /openings/{opening_id}/variations/{variation_id}/tree → move tree

POST /session/start                   → { opening_id, variation_id, color, mode, elo?, skill_level }
                                      ← { session_id, fen, to_move }
POST /session/{id}/move               → { uci_move }
                                      ← { result, feedback, eval_cp?, best_move?, fen }
POST /session/{id}/opponent_move      ← { uci_move, fen }
GET  /session/{id}/state              → { fen, score, move_history, mode, ... }

POST /analysis/eval                   → { fen }
                                      ← { lines: [{move_uci, move_san, cp}], eval_cp, depth }
```

## Data Models (approved)

**Opening hierarchy**
- `Opening { id, name, color, variations: [VariationSummary] }`
- `VariationTree { id, opening_id, name, color, moves: dict }`

**Session (in-memory)**
```python
id, opening_id, variation_id, color, mode, elo, skill_level,
current_fen, move_history, score, tree_cursor
```

**Feedback**
```python
quality: "correct" | "alternative" | "mistake" | "blunder"
explanation: str                   # skill-level-appropriate
centipawn_loss: int | None
lines: list[AnalysisLine] | None   # top N engine candidates (pre-move position)
```

**AnalysisLine**
```python
move_uci: str   # e.g. "e2e4"
move_san: str   # e.g. "e4"
cp: int         # centipawns for side to move
```

**Opening data**
- Source: `backend/app/data/openings.tsv` — committed, columns: `opening_id, opening_name, opening_color, variation_id, variation_name, eco, pgn`
- Parsed with python-chess at startup; UCI tries built in memory and `lru_cache`d
- To refresh from upstream lichess: `python scripts/fetch_openings.py` (requires network)
- JSON files are generated artifacts — gitignored, do not commit

## Key Design Decisions (approved)

- **Sessions**: in-memory. Elo persisted in `localStorage` on frontend only.
- **Stockfish**: bundled binary (macOS), path configurable via env var for other platforms.
- **Board**: `react-chessboard` + `chess.js`. Note: react-chessboard v3 uses `<Chessboard options={{...}} />` — all props are inside the `options` object, not flat props.
- **Skill level + Elo**: stored in session, decoupled. `elo` controls engine strength; `skill_level` controls explanation style. Optional per-request override for skill_level.
- **Move feedback logic**:
  - In-tree → "correct"
  - Off-tree, cp_loss ≤ 25 → "mainline was X, but yours is fine too"
  - Off-tree, cp_loss > 25 → mistake/blunder + explanation
  - Threshold (25cp) is tunable at implementation time
- **MVP openings**: Italian Game, Sicilian Najdorf, Queen's Gambit, Ruy López, French Defence
- **Frontend styling**: plain CSS modules (`.module.css` per component). No inline styles. No CSS framework.
- **Opponent move UX**: after a correct user move, show "Thinking..." for ~1s, then POST `/opponent_move` and animate the response. Simulates game feel.
- **Opening selector**: modal overlay on app start; dismissed once a session begins.