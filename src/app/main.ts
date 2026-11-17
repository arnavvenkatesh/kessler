import './index.css';
import { formatDateString, civilFromDays, daysFromCivil } from '../core/calendar';
import { generateDaily } from '../core/generate';
import { simulate } from '../core/sim';
import { solve, type SolveResult } from '../core/solver';
import type { Board, SimEvent, SimResult } from '../core/types';
import { sound } from './audio/synth';
import { InputManager } from './input/inputManager';
import { PlaybackEngine, type PlaybackSpeed, type PlaybackStatus } from './playback/playbackEngine';
import { drawFullFrame, type CursorState } from './render/boardRenderer';
import { fx } from './render/fx';
import { PALETTE } from './render/palette';
import { computeGrade, drawGradeGlyph, generateShareText, type Grade } from './share/grade';
import { generateConstellationName, generateConstellationPng } from './share/constellation';
import { dailyStore, type DailyAttempt, type PlayerStats } from './storage/dailyStore';
import { TUTORIAL_STAGES, type TutorialStage } from './tutorial/tutorialBoards';
import { LayoutEngine } from './ui/layout';
import { OrbitMapModal } from './ui/orbitMapModal';
import { HintsModal } from './ui/hintsModal';
import { recordLevelCompletion, type Medal } from './storage/campaignStore';
import { drawMedal } from './render/shapes';
import type { CampaignLevel } from '../../tools/gen-campaign';
import type { BoundingBox } from '../core/hints';
import campaignLevelsData from '../../data/campaign/levels.json';

function getTodayDateString(): string {
  const today = new Date();
  return formatDateString(today.getFullYear(), today.getMonth() + 1, today.getDate());
}

function getCountdownToMidnight(): string {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
  const diffSec = Math.max(0, Math.floor((tomorrow.getTime() - now.getTime()) / 1000));
  const h = Math.floor(diffSec / 3600).toString().padStart(2, '0');
  const m = Math.floor((diffSec % 3600) / 60).toString().padStart(2, '0');
  const s = (diffSec % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function getWeekdayShort(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const days = daysFromCivil(y ?? 2026, m ?? 1, d ?? 1);
  const dayOfWeek = (days + 3) % 7; // 0 = Mon ... 6 = Sun
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][dayOfWeek] ?? 'Mon';
}

function initApp(): void {
  const root = document.getElementById('app');
  if (!root) return;

  // Hash route parsing for archive dates (#YYYY-MM-DD)
  let currentDateStr = getTodayDateString();
  const hash = window.location.hash.replace('#', '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(hash)) {
    currentDateStr = hash;
  }

  const isOfficialDaily = currentDateStr === getTodayDateString();
  const dailyData = generateDaily(currentDateStr);
  let initialBoard: Board = {
    ...dailyData.board,
    cells: [...dailyData.board.cells],
  };

  // Solver optimal line precomputed for grade benchmark
  let solverResult: SolveResult | null = null;
  function getSolverResult(): SolveResult {
    if (!solverResult) {
      solverResult = solve(initialBoard);
    }
    return solverResult;
  }

  // Active attempt and stats state
  let lockedAttempt: DailyAttempt | null = isOfficialDaily ? dailyStore.getDailyAttempt(currentDateStr) : null;
  let playerStats: PlayerStats = dailyStore.getStats();

  root.innerHTML = `
    <header>
      <div class="brand-title">
        <span>KESSLER</span>
        <span class="brand-subtitle" id="header-subtitle">// SECTOR ${dailyData.dateStr}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 6px;">
        <button id="btn-orbits" class="btn" style="padding: 4px 8px; font-size: 11px; border-color: ${PALETTE.solar}; color: ${PALETTE.solar};">ORBITS</button>
        <button id="btn-hints" class="btn" style="padding: 4px 8px; font-size: 11px; border-color: ${PALETTE.coolant}; color: ${PALETTE.coolant};">HINT</button>
        <button id="btn-manual" class="btn" style="padding: 4px 8px; font-size: 11px;">MANUAL</button>
        <button id="btn-archive" class="btn" style="padding: 4px 8px; font-size: 11px;">ARCHIVE</button>
        <button id="btn-stats" class="btn" style="padding: 4px 8px; font-size: 11px;">STATS</button>
        <button id="btn-audio" class="btn" style="padding: 4px 8px; font-size: 11px;">
          ${sound.muted ? 'AUDIO: OFF' : 'AUDIO: ON'}
        </button>
      </div>
    </header>

    <main>
      <div class="viewport-container" id="board-viewport">
        <canvas id="stage-canvas"></canvas>
      </div>

      <aside class="hud-panel">
        <div class="hud-stat-box">
          <div class="hud-stat-label">SECTOR CODE</div>
          <div class="hud-stat-value" id="hud-sector">#${dailyData.dayNumber}</div>
        </div>

        <div class="hud-stat-box">
          <div class="hud-stat-label">GRID SPECIFICATION</div>
          <div class="hud-stat-value" id="hud-grid-dim">${initialBoard.w}x${initialBoard.h} MATRIX</div>
        </div>

        <div class="hud-stat-box">
          <div class="hud-stat-label" id="hud-card3-label">ACTIVE SPARK</div>
          <div class="hud-stat-value" id="hud-spark" style="color: ${PALETTE.ember};">${initialBoard.spark}</div>
        </div>

        <div class="hud-stat-box">
          <div class="hud-stat-label" id="hud-card4-label">TARGET RETICLE</div>
          <div class="hud-stat-value" id="hud-coord" style="color: ${PALETTE.coolant};">[-- , --]</div>
        </div>

        <div class="hud-stat-box">
          <div class="hud-stat-label" style="margin-bottom: 8px;">PLAYBACK CONTROLS</div>
          <div class="hud-controls">
            <button id="speed-1x" class="btn btn-active">1X</button>
            <button id="speed-2x" class="btn">2X</button>
            <button id="speed-skip" class="btn">SKIP</button>
          </div>
          <div style="display: flex; gap: 8px; margin-top: 8px;">
            <button id="btn-show-report" class="btn btn-primary" style="display: none; flex: 1;">VIEW REPORT</button>
            <button id="btn-replay" class="btn" style="display: none; flex: 1; border-color: ${PALETTE.solar}; color: ${PALETTE.solar};">REPLAY</button>
          </div>
        </div>

        <div class="hud-instructions" id="hud-instructions-box">
          <div style="color: ${PALETTE.chalk}; font-weight: 600; margin-bottom: 6px;">FLIGHT CONTROLS</div>
          <div><kbd>&larr;&uarr;&rarr;&darr;</kbd> or Mouse: Target</div>
          <div><kbd>SPACE</kbd> or Click: Detonate Spark</div>
          <div><kbd>R</kbd>: Rotate Spark orientation</div>
          <div id="attempt-status-banner" style="margin-top: 8px; font-weight: 700; color: ${PALETTE.solar};">
            ${lockedAttempt ? 'OFFICIAL TRANSMISSION LOCKED · REPLAY MODE' : 'OFFICIAL ATTEMPT · ONE MOVE PER DAY'}
          </div>
        </div>
      </aside>
    </main>

    <!-- Modal Dialog Container -->
    <div id="modal-container" style="display: none;"></div>
  `;

  const canvas = document.getElementById('stage-canvas') as HTMLCanvasElement | null;
  const viewport = document.getElementById('board-viewport') as HTMLElement | null;
  const modalContainer = document.getElementById('modal-container') as HTMLElement | null;

  const btnAudio = document.getElementById('btn-audio') as HTMLButtonElement | null;
  const btnManual = document.getElementById('btn-manual') as HTMLButtonElement | null;
  const btnArchive = document.getElementById('btn-archive') as HTMLButtonElement | null;
  const btnStats = document.getElementById('btn-stats') as HTMLButtonElement | null;
  const btnOrbits = document.getElementById('btn-orbits') as HTMLButtonElement | null;
  const btnHints = document.getElementById('btn-hints') as HTMLButtonElement | null;
  const btnShowReport = document.getElementById('btn-show-report') as HTMLButtonElement | null;
  const btnReplay = document.getElementById('btn-replay') as HTMLButtonElement | null;

  let currentCampaignLevel: CampaignLevel | null = null;
  let highlightedZone: BoundingBox | null = null;

  const speed1xBtn = document.getElementById('speed-1x') as HTMLButtonElement | null;
  const speed2xBtn = document.getElementById('speed-2x') as HTMLButtonElement | null;
  const speedSkipBtn = document.getElementById('speed-skip') as HTMLButtonElement | null;

  const card3Label = document.getElementById('hud-card3-label');
  const card4Label = document.getElementById('hud-card4-label');
  const sparkEl = document.getElementById('hud-spark');
  const coordEl = document.getElementById('hud-coord');
  const attemptStatusBanner = document.getElementById('attempt-status-banner');

  if (!canvas || !viewport || !modalContainer) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const cursor: CursorState = {
    x: Math.floor(initialBoard.w / 2),
    y: Math.floor(initialBoard.h / 2),
    active: true,
    rot: 0,
  };

  const layout = new LayoutEngine(canvas, viewport);

  // Playback engine
  const playback = new PlaybackEngine({
    onTick: (tick, maxTick, score, destroyed) => {
      if (playback.status === 'playing' || playback.status === 'paused') {
        if (card3Label) card3Label.textContent = 'TELEMETRY: CASCADE';
        if (sparkEl) sparkEl.textContent = `TICK ${tick} / ${maxTick}`;
        if (card4Label) card4Label.textContent = 'CASCADE SCORE';
        if (coordEl) coordEl.textContent = `${score.toLocaleString()} PTS (${destroyed} DEBRIS)`;
      } else if (playback.status === 'finished') {
        if (card3Label) card3Label.textContent = 'CHAIN COMPLETED';
        if (sparkEl) sparkEl.textContent = `${destroyed} DEBRIS DESTROYED`;
        if (card4Label) card4Label.textContent = 'TOTAL SCORE';
        if (coordEl) coordEl.textContent = `${score.toLocaleString()} PTS`;
      }
    },
    onStatusChange: (status: PlaybackStatus) => {
      if (status === 'finished') {
        if (btnReplay) btnReplay.style.display = 'block';
        if (btnShowReport) btnShowReport.style.display = 'block';
      } else if (status === 'playing') {
        if (btnReplay) btnReplay.style.display = 'none';
        if (btnShowReport) btnShowReport.style.display = 'none';
      } else if (status === 'idle') {
        if (btnReplay) btnReplay.style.display = lockedAttempt ? 'block' : 'none';
        if (btnShowReport) btnShowReport.style.display = lockedAttempt ? 'block' : 'none';
        if (card3Label) card3Label.textContent = 'ACTIVE SPARK';
        if (sparkEl) {
          sparkEl.textContent =
            initialBoard.spark === 'LANCE'
              ? cursor.rot === 1
                ? 'LANCE (VERT)'
                : 'LANCE (HORIZ)'
              : initialBoard.spark;
        }
        if (card4Label) card4Label.textContent = 'TARGET RETICLE';
        if (coordEl) {
          coordEl.textContent = `[${cursor.x.toString().padStart(2, '0')}, ${cursor.y.toString().padStart(2, '0')}]`;
        }
      }
    },
  });

  playback.setCellPixelResolver((gx, gy) => {
    const currentLayout = layout.getLayout();
    const maxAvailable = Math.min(currentLayout.containerWidth - 32, currentLayout.containerHeight - 32);
    const cellSize = Math.max(24, Math.floor(maxAvailable / Math.max(initialBoard.w, initialBoard.h)));
    const boardSizePx = cellSize * initialBoard.w;
    const offsetX = Math.floor((currentLayout.containerWidth - boardSizePx) / 2);
    const offsetY = Math.floor((currentLayout.containerHeight - boardSizePx) / 2);
    return [
      offsetX + gx * cellSize + cellSize / 2,
      offsetY + gy * cellSize + cellSize / 2,
    ];
  });

  function redraw(): void {
    if (!ctx) return;
    const currentLayout = layout.getLayout();
    const activeBoard = playback.currentBoard ?? initialBoard;
    const isPlaying = playback.status === 'playing' || playback.status === 'paused';

    const metrics = drawFullFrame(
      ctx,
      currentLayout.containerWidth,
      currentLayout.containerHeight,
      activeBoard,
      cursor,
      isPlaying,
      highlightedZone,
    );
    inputManager.updateMetrics(metrics, initialBoard.w, initialBoard.h);
  }

  // Last run results for modal display
  let lastRunResult: {
    attempt: DailyAttempt;
    events: SimEvent[];
  } | null = null;

  function executeRun(x: number, y: number, rot: 0 | 1): void {
    sound.initOnGesture();
    sound.playSparkSet();

    const sim = simulate(initialBoard, { x, y, rot });
    const bestScore = getSolverResult().bestScore;
    const gradeRes = computeGrade(sim.score, bestScore);

    if (currentCampaignLevel) {
      const level = currentCampaignLevel;
      let medal: Medal = 'none';
      if (sim.score >= level.medalThresholds.gold) {
        medal = 'gold';
      } else if (sim.score >= level.medalThresholds.silver) {
        medal = 'silver';
      } else if (sim.score >= level.medalThresholds.bronze) {
        medal = 'bronze';
      }

      recordLevelCompletion(level.id, sim.score, medal);

      playback.load(initialBoard, sim);
      playback.play();

      const checkFinish = setInterval(() => {
        if (playback.status === 'finished') {
          clearInterval(checkFinish);
          setTimeout(() => {
            showCampaignResultModal(level, sim, medal);
          }, 300);
        }
      }, 100);
      return;
    }

    const attempt: DailyAttempt = {
      dateStr: currentDateStr,
      dayNumber: dailyData.dayNumber,
      placement: { x, y, rot },
      score: sim.score,
      destroyed: sim.destroyed,
      lastTick: sim.lastTick,
      grade: gradeRes.grade,
      percent: gradeRes.percent,
      simHash: sim.hash,
      timestamp: Date.now(),
    };

    // Lock official attempt if playing today's official board
    if (isOfficialDaily && !lockedAttempt) {
      playerStats = dailyStore.saveDailyAttempt(attempt);
      lockedAttempt = attempt;
      if (attemptStatusBanner) {
        attemptStatusBanner.textContent = 'OFFICIAL TRANSMISSION LOCKED · REPLAY MODE';
      }
    }

    lastRunResult = { attempt, events: sim.events };

    playback.load(initialBoard, sim);
    playback.play();

    // Hook auto-popup of results modal when this run finishes
    const checkFinish = setInterval(() => {
      if (playback.status === 'finished') {
        clearInterval(checkFinish);
        setTimeout(() => {
          showResultModal(attempt, sim.events);
        }, 300);
      }
    }, 100);
  }

  // --- Modal Screens Implementation ---

  function closeModal(): void {
    if (!modalContainer) return;
    modalContainer.style.display = 'none';
    modalContainer.innerHTML = '';
  }

  function showResultModal(attempt: DailyAttempt, events: SimEvent[]): void {
    if (!modalContainer) return;
    const constName = generateConstellationName(attempt.simHash);
    const scoreDisplay = (attempt.score / 10).toFixed(1);
    const weekdayStr = getWeekdayShort(attempt.dateStr);

    modalContainer.style.display = 'flex';
    modalContainer.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-box">
          <div class="modal-header">
            <div class="modal-title">MISSION DEBRIEF // #${attempt.dayNumber}</div>
            <button id="btn-close-modal" class="btn" style="padding: 4px 10px;">&times;</button>
          </div>

          <div class="modal-body">
            <div class="grade-panel">
              <canvas id="modal-glyph-canvas" width="80" height="80" style="display: block;"></canvas>
              <div>
                <div class="grade-badge-title" style="color: ${
                  attempt.grade === 'PERFECT'
                    ? PALETTE.solar
                    : attempt.grade === 'NOVA'
                    ? PALETTE.ember
                    : attempt.grade === 'FLARE'
                    ? PALETTE.coolant
                    : PALETTE.chalk
                };">${attempt.grade} · ${attempt.percent}%</div>
                <div style="font-size: 12px; color: var(--dust); letter-spacing: 0.08em;">
                  CONSTELLATION: ${constName.toUpperCase()}
                </div>
              </div>
            </div>

            <div class="stats-grid">
              <div class="stat-cell">
                <div class="stat-cell-label">SCORE</div>
                <div class="stat-cell-value">${scoreDisplay}</div>
              </div>
              <div class="stat-cell">
                <div class="stat-cell-label">CHAIN DEPTH</div>
                <div class="stat-cell-value">${attempt.lastTick} TICKS</div>
              </div>
              <div class="stat-cell">
                <div class="stat-cell-label">DESTROYED</div>
                <div class="stat-cell-value">${attempt.destroyed} DEBRIS</div>
              </div>
            </div>

            <div class="toast-banner" id="share-toast">TRANSMISSION COPIED TO CLIPBOARD</div>
          </div>

          <div class="modal-footer">
            <button id="btn-perfect-line" class="btn" style="border-color: ${PALETTE.solar}; color: ${PALETTE.solar};">
              SEE THE PERFECT LINE
            </button>
            <button id="btn-share-text" class="btn btn-primary">
              SHARE TRANSMISSION
            </button>
            <button id="btn-download-chart" class="btn">
              CHART PNG (1080x1350)
            </button>
          </div>
        </div>
      </div>
    `;

    // Render grade glyph into modal canvas
    const glyphCanvas = document.getElementById('modal-glyph-canvas') as HTMLCanvasElement | null;
    if (glyphCanvas) {
      const gCtx = glyphCanvas.getContext('2d');
      if (gCtx) {
        drawGradeGlyph(gCtx, attempt.grade, 40, 40, 36);
      }
    }

    document.getElementById('btn-close-modal')?.addEventListener('click', closeModal);

    // See the Perfect Line (optimal solver replay)
    document.getElementById('btn-perfect-line')?.addEventListener('click', () => {
      closeModal();
      const solution = getSolverResult();
      playback.load(initialBoard, solution.bestResult);
      playback.play();
    });

    // Share plain text
    document.getElementById('btn-share-text')?.addEventListener('click', () => {
      const shareText = generateShareText({
        dayNumber: attempt.dayNumber,
        weekdayStr,
        grade: attempt.grade,
        percent: attempt.percent,
        chainDepth: attempt.lastTick,
        scoreDisplay,
        constellationName: constName,
        url: window.location.origin + window.location.pathname,
      });

      if (navigator.clipboard) {
        void navigator.clipboard.writeText(shareText).then(() => {
          const toast = document.getElementById('share-toast');
          if (toast) {
            toast.style.display = 'block';
            setTimeout(() => {
              toast.style.display = 'none';
            }, 2500);
          }
        });
      }
    });

    // Download 1080x1350 PNG Constellation Chart
    document.getElementById('btn-download-chart')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-download-chart') as HTMLButtonElement | null;
      if (btn) btn.textContent = 'GENERATING PNG...';

      const blob = await generateConstellationPng({
        dayNumber: attempt.dayNumber,
        dateStr: attempt.dateStr,
        grade: attempt.grade,
        percent: attempt.percent,
        scoreDisplay,
        chainDepth: attempt.lastTick,
        destroyedCount: attempt.destroyed,
        events,
        boardW: initialBoard.w,
        boardH: initialBoard.h,
        simHash: attempt.simHash,
      });

      if (btn) btn.textContent = 'CHART PNG (1080x1350)';

      if (blob) {
        // Try Web Share API with file if supported, otherwise download
        const file = new File([blob], `kessler-sector-${attempt.dayNumber}.png`, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          void navigator.share({
            files: [file],
            title: `KESSLER #${attempt.dayNumber}`,
            text: `Constellation: ${constName}`,
          });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `kessler-sector-${attempt.dayNumber}.png`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }
    });
  }

  // --- Stats Modal ---
  function showStatsModal(): void {
    if (!modalContainer) return;
    playerStats = dailyStore.getStats();
    modalContainer.style.display = 'flex';
    modalContainer.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-box">
          <div class="modal-header">
            <div class="modal-title">PILOT TELEMETRY // STATS</div>
            <button id="btn-close-modal" class="btn" style="padding: 4px 10px;">&times;</button>
          </div>

          <div class="modal-body">
            <div class="stats-grid" style="grid-template-columns: repeat(2, 1fr);">
              <div class="stat-cell">
                <div class="stat-cell-label">CURRENT STREAK</div>
                <div class="stat-cell-value" style="color: ${PALETTE.ember};">${playerStats.currentStreak} DAYS</div>
              </div>
              <div class="stat-cell">
                <div class="stat-cell-label">MAX STREAK</div>
                <div class="stat-cell-value">${playerStats.maxStreak} DAYS</div>
              </div>
              <div class="stat-cell">
                <div class="stat-cell-label">MISSIONS PLAYED</div>
                <div class="stat-cell-value">${playerStats.totalPlayed}</div>
              </div>
              <div class="stat-cell">
                <div class="stat-cell-label">BEST CHAIN</div>
                <div class="stat-cell-value" style="color: ${PALETTE.coolant};">${playerStats.bestChain} TICKS</div>
              </div>
            </div>

            <div style="font-size: 11px; color: var(--dust); letter-spacing: 0.08em; margin-top: 10px;">
              GRADE CLASSIFICATION DISTRIBUTION
            </div>

            <div style="display: flex; flex-direction: column; gap: 6px;">
              ${(['PERFECT', 'NOVA', 'FLARE', 'SPARK', 'DUD'] as Grade[])
                .map((g) => {
                  const count = playerStats.grades[g] ?? 0;
                  return `
                  <div style="display: flex; align-items: center; justify-content: space-between; background: var(--void); padding: 6px 12px; border: 1px solid var(--grid);">
                    <span style="font-weight: 700; color: ${
                      g === 'PERFECT' ? PALETTE.solar : g === 'NOVA' ? PALETTE.ember : PALETTE.chalk
                    };">${g}</span>
                    <span style="font-family: var(--font-display); font-size: 18px; font-weight: 700;">${count}</span>
                  </div>
                `;
                })
                .join('')}
            </div>

            <div style="background: var(--void); padding: 10px; border: 1px solid var(--grid); text-align: center; color: var(--coolant); font-size: 12px;">
              NEXT SECTOR UNLOCKS IN: <span id="modal-countdown" style="font-weight: 700;">${getCountdownToMidnight()}</span>
            </div>
          </div>

          <div class="modal-footer">
            <button id="btn-close-modal-bottom" class="btn btn-primary">CLOSE</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-close-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-close-modal-bottom')?.addEventListener('click', closeModal);
  }

  // --- Interactive Tutorial Modal & Runner ---
  function showTutorialModal(): void {
    if (!modalContainer) return;
    modalContainer.style.display = 'flex';
    modalContainer.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-box">
          <div class="modal-header">
            <div class="modal-title">FLIGHT MANUAL // TUTORIAL</div>
            <button id="btn-close-modal" class="btn" style="padding: 4px 10px;">&times;</button>
          </div>

          <div class="modal-body">
            <div style="font-size: 13px; color: var(--dust); line-height: 1.5;">
              Three hands-on flight stages introduce chain reaction mechanics, mirror deflections, and gravitational hazards.
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${TUTORIAL_STAGES.map(
                (stage) => `
                <div style="background: var(--void); border: 1px solid var(--grid); padding: 12px; display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <div style="color: ${PALETTE.solar}; font-weight: 700; font-size: 13px;">${stage.title}</div>
                    <div style="color: var(--dust); font-size: 11px; margin-top: 2px;">${stage.subtitle}</div>
                  </div>
                  <button class="btn btn-start-stage" data-stage="${stage.id}" style="padding: 6px 12px;">ENGAGE</button>
                </div>
              `,
              ).join('')}
            </div>
          </div>

          <div class="modal-footer">
            <button id="btn-close-modal-bottom" class="btn">RETURN TO MISSION</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-close-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-close-modal-bottom')?.addEventListener('click', closeModal);

    document.querySelectorAll('.btn-start-stage').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = Number((e.currentTarget as HTMLElement).getAttribute('data-stage'));
        const stage = TUTORIAL_STAGES.find((s) => s.id === id);
        if (stage) {
          loadTutorialStage(stage);
        }
      });
    });
  }

  function loadTutorialStage(stage: TutorialStage): void {
    closeModal();
    initialBoard = {
      ...stage.board,
      cells: [...stage.board.cells],
    };
    solverResult = null;
    cursor.x = 0;
    cursor.y = 0;
    cursor.rot = 0;

    const subEl = document.getElementById('header-subtitle');
    if (subEl) subEl.textContent = `// ${stage.title}`;
    const dimEl = document.getElementById('hud-grid-dim');
    if (dimEl) dimEl.textContent = `${initialBoard.w}x${initialBoard.h} MATRIX`;
    const sectorEl = document.getElementById('hud-sector');
    if (sectorEl) sectorEl.textContent = `TUTORIAL`;
    const banner = document.getElementById('attempt-status-banner');
    if (banner) {
      banner.textContent = `${stage.brief} ${stage.hint}`;
    }

    playback.load(initialBoard, { score: 0, destroyed: 0, lastTick: 0, events: [], hash: '' });
    layout.updateCanvasSize();
    redraw();
  }

  // --- Archive Modal ---
  function showArchiveModal(): void {
    if (!modalContainer) return;
    const todayDays = daysFromCivil(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      new Date().getDate(),
    );

    const pastDays: { dateStr: string; label: string }[] = [];
    for (let i = 1; i <= 14; i++) {
      const [y, m, d] = civilFromDays(todayDays - i);
      const ds = formatDateString(y, m, d);
      pastDays.push({ dateStr: ds, label: `SECTOR ${ds}` });
    }

    modalContainer.style.display = 'flex';
    modalContainer.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-box">
          <div class="modal-header">
            <div class="modal-title">MISSION ARCHIVE // HISTORICAL SECTORS</div>
            <button id="btn-close-modal" class="btn" style="padding: 4px 10px;">&times;</button>
          </div>

          <div class="modal-body">
            <div style="font-size: 12px; color: var(--dust); margin-bottom: 8px;">
              Select a past sector to practice or review. Archive runs are unranked.
            </div>

            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; max-height: 300px; overflow-y: auto;">
              ${pastDays
                .map(
                  (p) => `
                <button class="btn btn-archive-date" data-date="${p.dateStr}" style="padding: 8px; text-align: left; font-size: 11px;">
                  ${p.label}
                </button>
              `,
                )
                .join('')}
            </div>
          </div>

          <div class="modal-footer">
            <button id="btn-close-modal-bottom" class="btn">CLOSE</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-close-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-close-modal-bottom')?.addEventListener('click', closeModal);

    document.querySelectorAll('.btn-archive-date').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const ds = (e.currentTarget as HTMLElement).getAttribute('data-date');
        if (ds) {
          window.location.hash = ds;
          window.location.reload();
        }
      });
    });
  }

  // --- Campaign (Orbits) & Hints Implementation ---

  function loadCampaignLevel(level: CampaignLevel): void {
    currentCampaignLevel = level;
    initialBoard = {
      ...level.board,
      cells: [...level.board.cells],
    };
    solverResult = null;
    highlightedZone = null;
    lockedAttempt = null;

    cursor.x = Math.floor(initialBoard.w / 2);
    cursor.y = Math.floor(initialBoard.h / 2);
    cursor.rot = 0;

    const subtitleEl = document.getElementById('header-subtitle');
    if (subtitleEl) {
      subtitleEl.textContent = `// ORBIT ${level.orbit} · ${level.name.toUpperCase()}`;
    }
    const sectorEl = document.getElementById('hud-sector');
    if (sectorEl) {
      sectorEl.textContent = `ORB ${level.orbit} · #${level.id}`;
    }
    const gridDimEl = document.getElementById('hud-grid-dim');
    if (gridDimEl) {
      gridDimEl.textContent = `${initialBoard.w}x${initialBoard.h} MATRIX`;
    }
    if (card3Label) card3Label.textContent = 'ACTIVE SPARK';
    if (sparkEl) sparkEl.textContent = initialBoard.spark;
    if (card4Label) card4Label.textContent = 'MISSION GOAL';
    if (coordEl) {
      coordEl.textContent =
        level.goalType === 'beacons'
          ? `IGNITE ${level.targetValue} BEACONS`
          : `PAR: ${level.targetValue} PTS`;
    }
    if (attemptStatusBanner) {
      attemptStatusBanner.textContent = `CAMPAIGN MISSION ${level.id} · GOAL: ${
        level.goalType === 'beacons'
          ? `IGNITE ${level.targetValue} BEACONS`
          : `PAR: ${level.targetValue} PTS`
      }`;
    }

    playback.load(initialBoard, {
      score: 0,
      destroyed: 0,
      lastTick: 0,
      events: [],
      hash: '00000000',
    });

    layout.updateCanvasSize();
    redraw();
    closeModal();
  }

  function showCampaignResultModal(level: CampaignLevel, sim: SimResult, medal: Medal): void {
    if (!modalContainer) return;
    const scoreDisplay = (sim.score / 10).toFixed(1);
    const parDisplay = (level.targetValue / 10).toFixed(1);

    modalContainer.style.display = 'flex';
    modalContainer.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-box" style="max-width: 500px; width: 90%;">
          <div class="modal-header">
            <div class="modal-title">ORBIT ${level.orbit} · LVL ${level.id} // DEBRIEF</div>
            <button id="btn-close-modal" class="btn" style="padding: 4px 10px;">&times;</button>
          </div>

          <div class="modal-body">
            <div class="grade-panel" style="gap: 16px;">
              <canvas id="campaign-medal-canvas" width="64" height="64" style="display: block;"></canvas>
              <div>
                <div class="grade-badge-title" style="color: ${
                  medal === 'gold'
                    ? PALETTE.solar
                    : medal === 'silver'
                    ? PALETTE.chalk
                    : medal === 'bronze'
                    ? PALETTE.rust
                    : PALETTE.dust
                };">
                  ${medal !== 'none' ? `${medal.toUpperCase()} MEDAL AWARDED` : 'MISSION COMPLETED'}
                </div>
                <div style="font-size: 12px; color: var(--dust); letter-spacing: 0.08em; margin-top: 4px;">
                  ${level.name.toUpperCase()} · ${sim.destroyed} DEBRIS CLEARED
                </div>
              </div>
            </div>

            <div class="stats-grid">
              <div class="stat-cell">
                <div class="stat-cell-label">SCORE</div>
                <div class="stat-cell-value" style="color: ${PALETTE.solar};">${scoreDisplay}</div>
              </div>
              <div class="stat-cell">
                <div class="stat-cell-label">PAR TARGET</div>
                <div class="stat-cell-value">${parDisplay}</div>
              </div>
              <div class="stat-cell">
                <div class="stat-cell-label">CHAIN DEPTH</div>
                <div class="stat-cell-value" style="color: ${PALETTE.coolant};">${sim.lastTick} TICKS</div>
              </div>
            </div>
          </div>

          <div class="modal-footer" style="flex-wrap: wrap; gap: 6px;">
            <button id="btn-campaign-replay" class="btn">REPLAY</button>
            <button id="btn-campaign-perfect" class="btn" style="border-color: ${PALETTE.solar}; color: ${PALETTE.solar};">
              PERFECT LINE
            </button>
            ${
              level.id < 60
                ? `<button id="btn-campaign-next" class="btn btn-primary">NEXT LEVEL &rarr;</button>`
                : ''
            }
            <button id="btn-campaign-map" class="btn">ORBIT MAP</button>
          </div>
        </div>
      </div>
    `;

    // Render large medal glyph on canvas
    const cvs = document.getElementById('campaign-medal-canvas') as HTMLCanvasElement | null;
    if (cvs) {
      const mCtx = cvs.getContext('2d');
      if (mCtx) {
        drawMedal(mCtx, 32, 32, 22, medal);
      }
    }

    document.getElementById('btn-close-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-campaign-replay')?.addEventListener('click', () => {
      closeModal();
      loadCampaignLevel(level);
    });
    document.getElementById('btn-campaign-perfect')?.addEventListener('click', () => {
      closeModal();
      const sol = getSolverResult();
      cursor.x = sol.best.x;
      cursor.y = sol.best.y;
      cursor.rot = sol.best.rot ?? 0;
      executeRun(sol.best.x, sol.best.y, sol.best.rot ?? 0);
    });
    document.getElementById('btn-campaign-next')?.addEventListener('click', () => {
      const nextLvl = (campaignLevelsData as CampaignLevel[]).find((l) => l.id === level.id + 1);
      if (nextLvl) {
        loadCampaignLevel(nextLvl);
      }
    });
    document.getElementById('btn-campaign-map')?.addEventListener('click', () => {
      closeModal();
      showOrbitsModal();
    });
  }

  function showOrbitsModal(): void {
    if (!modalContainer) return;
    const modal = new OrbitMapModal(
      modalContainer,
      {
        onSelectLevel: (lvl) => loadCampaignLevel(lvl),
        onClose: () => closeModal(),
      },
      currentCampaignLevel?.id ?? 1,
    );
    modal.render();
  }

  function showHintsModal(): void {
    if (!modalContainer) return;
    const initialTier = currentCampaignLevel
      ? 0
      : 0;
    const modal = new HintsModal(
      modalContainer,
      initialBoard,
      getSolverResult(),
      {
        onHighlightZone: (bounds) => {
          highlightedZone = bounds;
          redraw();
        },
        onClose: () => closeModal(),
      },
      currentCampaignLevel?.id,
      initialTier,
    );
    modal.render();
  }

  // --- Button Event Listeners ---
  btnOrbits?.addEventListener('click', () => {
    sound.initOnGesture();
    showOrbitsModal();
  });

  btnHints?.addEventListener('click', () => {
    sound.initOnGesture();
    showHintsModal();
  });
  btnManual?.addEventListener('click', () => {
    sound.initOnGesture();
    showTutorialModal();
  });

  btnArchive?.addEventListener('click', () => {
    sound.initOnGesture();
    showArchiveModal();
  });

  btnStats?.addEventListener('click', () => {
    sound.initOnGesture();
    showStatsModal();
  });

  btnShowReport?.addEventListener('click', () => {
    sound.initOnGesture();
    if (lockedAttempt && lastRunResult) {
      showResultModal(lockedAttempt, lastRunResult.events);
    } else if (lockedAttempt) {
      // Re-simulate to get events for modal
      const sim = simulate(initialBoard, lockedAttempt.placement);
      showResultModal(lockedAttempt, sim.events);
    }
  });

  btnAudio?.addEventListener('click', () => {
    sound.initOnGesture();
    const muted = sound.toggleMute();
    btnAudio.textContent = muted ? 'AUDIO: OFF' : 'AUDIO: ON';
  });

  document.querySelector('.brand-title')?.addEventListener('click', () => {
    if (currentCampaignLevel) {
      currentCampaignLevel = null;
      initialBoard = { ...dailyData.board, cells: [...dailyData.board.cells] };
      solverResult = null;
      highlightedZone = null;
      lockedAttempt = dailyStore.getDailyAttempt(currentDateStr);
      cursor.x = Math.floor(initialBoard.w / 2);
      cursor.y = Math.floor(initialBoard.h / 2);
      cursor.rot = 0;
      const subtitleEl = document.getElementById('header-subtitle');
      if (subtitleEl) subtitleEl.textContent = `// SECTOR ${dailyData.dateStr}`;
      const sectorEl = document.getElementById('hud-sector');
      if (sectorEl) sectorEl.textContent = `#${dailyData.dayNumber}`;
      const gridDimEl = document.getElementById('hud-grid-dim');
      if (gridDimEl) gridDimEl.textContent = `${initialBoard.w}x${initialBoard.h} MATRIX`;
      if (card3Label) card3Label.textContent = 'ACTIVE SPARK';
      if (sparkEl) sparkEl.textContent = initialBoard.spark;
      if (card4Label) card4Label.textContent = 'TARGET RETICLE';
      if (coordEl)
        coordEl.textContent = `[${cursor.x.toString().padStart(2, '0')}, ${cursor.y
          .toString()
          .padStart(2, '0')}]`;
      if (attemptStatusBanner) {
        attemptStatusBanner.textContent = lockedAttempt
          ? 'OFFICIAL TRANSMISSION LOCKED · REPLAY MODE'
          : 'OFFICIAL ATTEMPT · ONE MOVE PER DAY';
      }
      playback.load(initialBoard, { score: 0, destroyed: 0, lastTick: 0, events: [], hash: '' });
      layout.updateCanvasSize();
      redraw();
    }
  });

  // Speed controls
  function updateSpeedButtons(speed: PlaybackSpeed): void {
    playback.setSpeed(speed);
    speed1xBtn?.classList.toggle('btn-active', speed === '1x');
    speed2xBtn?.classList.toggle('btn-active', speed === '2x');
    speedSkipBtn?.classList.toggle('btn-active', speed === 'skip');
  }

  speed1xBtn?.addEventListener('click', () => {
    sound.initOnGesture();
    updateSpeedButtons('1x');
  });

  speed2xBtn?.addEventListener('click', () => {
    sound.initOnGesture();
    updateSpeedButtons('2x');
  });

  speedSkipBtn?.addEventListener('click', () => {
    sound.initOnGesture();
    updateSpeedButtons('skip');
  });

  btnReplay?.addEventListener('click', () => {
    sound.initOnGesture();
    if (lockedAttempt) {
      executeRun(lockedAttempt.placement.x, lockedAttempt.placement.y, lockedAttempt.placement.rot ?? 0);
    } else {
      playback.restart();
    }
  });

  const inputManager = new InputManager(canvas, {
    onCursorMove: (newCursor) => {
      if (playback.status === 'playing') return;
      cursor.x = newCursor.x;
      cursor.y = newCursor.y;
      cursor.active = true;

      if (coordEl && playback.status === 'idle') {
        coordEl.textContent = `[${cursor.x.toString().padStart(2, '0')}, ${cursor.y.toString().padStart(2, '0')}]`;
      }
    },
    onPlace: (x, y, rot) => {
      if (playback.status === 'playing') return;
      const idx = y * initialBoard.w + x;
      if (initialBoard.cells[idx] !== null && initialBoard.cells[idx] !== undefined) {
        return; // Non-empty cell cannot receive Spark
      }
      executeRun(x, y, rot);
    },
    onRotate: (rot) => {
      if (playback.status === 'playing') return;
      cursor.rot = rot;
      if (sparkEl && playback.status === 'idle') {
        if (initialBoard.spark === 'LANCE') {
          sparkEl.textContent = rot === 1 ? 'LANCE (VERT)' : 'LANCE (HORIZ)';
        } else {
          sparkEl.textContent = initialBoard.spark;
        }
      }
    },
    onUndo: () => {
      if (!lockedAttempt && playback.status === 'finished') {
        playback.load(initialBoard, { score: 0, destroyed: 0, lastTick: 0, events: [], hash: '' });
      }
    },
  });

  // Global gesture listeners
  window.addEventListener('pointerdown', () => sound.initOnGesture(), { once: true });
  window.addEventListener('keydown', () => sound.initOnGesture(), { once: true });

  layout.onResize(() => {
    redraw();
  });

  layout.updateCanvasSize();
  redraw();

  // If already locked today, prepare replay
  if (lockedAttempt) {
    if (btnShowReport) btnShowReport.style.display = 'block';
    if (btnReplay) btnReplay.style.display = 'block';
  }

  // Animation frame loop
  let lastTimestamp = performance.now();
  function animationLoop(timestamp: number): void {
    const dt = Math.min(100, timestamp - lastTimestamp);
    lastTimestamp = timestamp;

    playback.update(dt);
    fx.update(dt);
    redraw();

    requestAnimationFrame(animationLoop);
  }

  requestAnimationFrame(animationLoop);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
