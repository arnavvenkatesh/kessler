import { PALETTE } from '../render/palette';
import { drawMedal } from '../render/shapes';
import { loadCampaignData, type CampaignData, type Medal } from '../storage/campaignStore';
import campaignLevelsData from '../../../data/campaign/levels.json';
import type { CampaignLevel } from '../../../tools/gen-campaign';

export interface OrbitMapCallbacks {
  onSelectLevel: (level: CampaignLevel) => void;
  onClose: () => void;
}

export class OrbitMapModal {
  private container: HTMLElement;
  private callbacks: OrbitMapCallbacks;
  private selectedLevelId: number;
  private selectedOrbit: number;
  private levels: CampaignLevel[];
  private campaignData: CampaignData;

  constructor(container: HTMLElement, callbacks: OrbitMapCallbacks, initialLevelId = 1) {
    this.container = container;
    this.callbacks = callbacks;
    this.levels = campaignLevelsData as CampaignLevel[];
    this.campaignData = loadCampaignData();
    this.selectedLevelId = Math.min(initialLevelId, this.campaignData.unlockedLevel);
    const selectedLevel = this.levels.find((l) => l.id === this.selectedLevelId);
    this.selectedOrbit = selectedLevel ? selectedLevel.orbit : 1;
  }

  public render(): void {
    this.campaignData = loadCampaignData();
    const currentLevel =
      this.levels.find((l) => l.id === this.selectedLevelId) ?? this.levels[0]!;
    const orbitLevels = this.levels.filter((l) => l.orbit === this.selectedOrbit);

    const orbitNames = [
      'Low Earth Orbit',
      'Molniya Ellipse',
      'Geostationary Ring',
      'Polar Patrol',
      'Graveyard Shell',
      'Lagrange Junction',
    ];

    this.container.style.display = 'flex';
    this.container.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-box" style="max-width: 680px; width: 95%;">
          <div class="modal-header">
            <div class="modal-title">ORBITS // CAMPAIGN MAP</div>
            <button id="btn-close-orbits" class="btn" style="padding: 4px 10px;">&times;</button>
          </div>

          <div class="modal-body" style="padding: 12px 16px;">
            <!-- Orbit Selector Tabs -->
            <div style="display: flex; gap: 4px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 12px; border-bottom: 1px solid var(--grid);">
              ${[1, 2, 3, 4, 5, 6]
                .map((orbNum) => {
                  const isActive = orbNum === this.selectedOrbit;
                  const isOrbitUnlocked = this.levels
                    .filter((l) => l.orbit === orbNum)
                    .some((l) => l.id <= this.campaignData.unlockedLevel);
                  return `
                  <button class="btn orbit-tab ${isActive ? 'btn-primary' : ''}" 
                          data-orbit="${orbNum}" 
                          style="font-size: 11px; padding: 5px 8px; white-space: nowrap; ${
                            !isOrbitUnlocked ? 'opacity: 0.5;' : ''
                          }">
                    ORBIT ${orbNum}: ${orbitNames[orbNum - 1]?.split(' ')[0]}
                  </button>
                `;
                })
                .join('')}
            </div>

            <!-- Orbit Description Banner -->
            <div style="background: var(--void); padding: 8px 12px; border: 1px solid var(--grid); margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-family: var(--font-display); font-size: 16px; font-weight: 700; color: ${PALETTE.chalk};">
                  ORBIT ${this.selectedOrbit} // ${orbitNames[this.selectedOrbit - 1]}
                </div>
                <div style="font-size: 11px; color: var(--dust);">
                  ${this.getOrbitMechanicDescription(this.selectedOrbit)}
                </div>
              </div>
              <div style="font-size: 12px; font-weight: 700; color: ${PALETTE.solar};">
                ${this.getOrbitMedalCount(this.selectedOrbit)} / 10 MEDALS
              </div>
            </div>

            <!-- Level Node Grid (10 levels for current orbit) -->
            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 16px;">
              ${orbitLevels
                .map((lvl) => {
                  const isUnlocked = lvl.id <= this.campaignData.unlockedLevel;
                  const isSelected = lvl.id === this.selectedLevelId;
                  const record = this.campaignData.levels[lvl.id];
                  const medal: Medal = record?.medal ?? 'none';

                  let borderCol = 'var(--grid)';
                  let bgCol = 'var(--hull)';
                  if (isSelected) {
                    borderCol = PALETTE.ember;
                    bgCol = 'var(--grid)';
                  } else if (isUnlocked) {
                    borderCol = medal !== 'none' ? PALETTE.solar : PALETTE.coolant;
                  }

                  return `
                  <button class="level-node-btn" data-level="${lvl.id}" ${!isUnlocked ? 'disabled' : ''}
                          style="background: ${bgCol}; border: 1px solid ${borderCol}; padding: 8px 4px; display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: ${
                            isUnlocked ? 'pointer' : 'not-allowed'
                          }; opacity: ${isUnlocked ? '1' : '0.4'};">
                    <span style="font-family: var(--font-mono); font-size: 11px; color: ${
                      isSelected ? PALETTE.ember : isUnlocked ? PALETTE.chalk : PALETTE.dust
                    }; font-weight: 700;">
                      LVL ${lvl.id}
                    </span>
                    <canvas id="medal-canvas-${lvl.id}" width="24" height="24" style="display: block;"></canvas>
                    <span style="font-size: 9px; color: var(--dust); text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px;">
                      ${isUnlocked ? (record?.completed ? `${record.score}` : 'READY') : 'LOCKED'}
                    </span>
                  </button>
                `;
                })
                .join('')}
            </div>

            <!-- Selected Level Inspector Card -->
            <div style="background: var(--void); border: 1px solid var(--grid); padding: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                <div>
                  <div style="font-family: var(--font-display); font-size: 18px; font-weight: 700; color: ${PALETTE.chalk};">
                    MISSION ${currentLevel.id}: ${currentLevel.name.toUpperCase()}
                  </div>
                  <div style="font-size: 11px; color: ${PALETTE.coolant}; font-weight: 600;">
                    ${currentLevel.board.w}x${currentLevel.board.h} MATRIX · SPARK: ${currentLevel.board.spark}${
                      currentLevel.board.mutator ? ` · MUTATOR: ${currentLevel.board.mutator}` : ''
                    }
                  </div>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 10px; color: var(--dust);">TARGET GOAL</div>
                  <div style="font-size: 14px; font-weight: 700; color: ${PALETTE.solar};">
                    ${currentLevel.goalType === 'beacons' ? `IGNITE ${currentLevel.targetValue} BEACONS` : `PAR: ${currentLevel.targetValue} PTS`}
                  </div>
                </div>
              </div>

              <div style="font-size: 12px; color: var(--chalk); margin-bottom: 12px; line-height: 1.4;">
                ${currentLevel.briefing}
              </div>

              <!-- Medal Thresholds bar -->
              <div style="display: flex; gap: 8px; margin-bottom: 12px; font-size: 11px;">
                <div style="flex: 1; background: var(--hull); padding: 4px 8px; border: 1px solid var(--grid); display: flex; align-items: center; justify-content: space-between;">
                  <span style="color: ${PALETTE.rust}; font-weight: 700;">BRONZE</span>
                  <span>${currentLevel.medalThresholds.bronze}</span>
                </div>
                <div style="flex: 1; background: var(--hull); padding: 4px 8px; border: 1px solid var(--grid); display: flex; align-items: center; justify-content: space-between;">
                  <span style="color: ${PALETTE.chalk}; font-weight: 700;">SILVER</span>
                  <span>${currentLevel.medalThresholds.silver}</span>
                </div>
                <div style="flex: 1; background: var(--hull); padding: 4px 8px; border: 1px solid var(--grid); display: flex; align-items: center; justify-content: space-between;">
                  <span style="color: ${PALETTE.solar}; font-weight: 700;">GOLD</span>
                  <span>${currentLevel.medalThresholds.gold}</span>
                </div>
              </div>

              <button id="btn-launch-level" class="btn btn-primary" style="width: 100%; padding: 8px 12px; font-size: 14px; font-weight: 700; letter-spacing: 0.08em;">
                ${this.campaignData.levels[currentLevel.id]?.completed ? 'REPLAY MISSION' : 'LAUNCH MISSION'}
              </button>
            </div>
          </div>

          <div class="modal-footer" style="padding: 8px 16px;">
            <button id="btn-close-orbits-bottom" class="btn">BACK TO BRIDGE</button>
          </div>
        </div>
      </div>
    `;

    // Render medal glyphs on level node canvases
    for (const lvl of orbitLevels) {
      const cvs = document.getElementById(`medal-canvas-${lvl.id}`) as HTMLCanvasElement | null;
      if (cvs) {
        const cCtx = cvs.getContext('2d');
        if (cCtx) {
          const record = this.campaignData.levels[lvl.id];
          const medalType = record?.completed ? (record.medal ?? 'none') : 'none';
          drawMedal(cCtx, 12, 12, 8, medalType);
        }
      }
    }

    this.attachEvents();
  }

  private attachEvents(): void {
    document.getElementById('btn-close-orbits')?.addEventListener('click', () => {
      this.callbacks.onClose();
    });
    document.getElementById('btn-close-orbits-bottom')?.addEventListener('click', () => {
      this.callbacks.onClose();
    });

    // Orbit tab switching
    const tabs = this.container.querySelectorAll('.orbit-tab');
    for (let i = 0; i < tabs.length; i++) {
      tabs[i]?.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const orbNum = Number.parseInt(target.getAttribute('data-orbit') || '1', 10);
        this.selectedOrbit = orbNum;
        // Select first level of that orbit
        const firstOfOrbit = (orbNum - 1) * 10 + 1;
        this.selectedLevelId = Math.min(firstOfOrbit, this.campaignData.unlockedLevel);
        this.render();
      });
    }

    // Level selection
    const levelBtns = this.container.querySelectorAll('.level-node-btn');
    for (let i = 0; i < levelBtns.length; i++) {
      levelBtns[i]?.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const lvlId = Number.parseInt(target.getAttribute('data-level') || '1', 10);
        this.selectedLevelId = lvlId;
        this.render();
      });
    }

    // Launch level
    document.getElementById('btn-launch-level')?.addEventListener('click', () => {
      const selected = this.levels.find((l) => l.id === this.selectedLevelId);
      if (selected) {
        this.callbacks.onSelectLevel(selected);
      }
    });
  }

  private getOrbitMechanicDescription(orbit: number): string {
    switch (orbit) {
      case 1:
        return 'Fundamentals: Cinder rocks, singularity hazards, and chain reaction cascades.';
      case 2:
        return 'Deflection: Angled mirrors (/ and \\) and diagonal crystal shards.';
      case 3:
        return 'Target Arrays: High-value Beacons and multi-ray convergence bonuses.';
      case 4:
        return 'Penetration: Piercing Lances igniting all bodies along full orbital axes.';
      case 5:
        return 'Armor & Timing: Plated double hulls and 3-tick delayed countdown fuses.';
      case 6:
        return 'Anomalies: Spatial wormhole loops, solar wind drag, and twin spark detonations.';
      default:
        return '';
    }
  }

  private getOrbitMedalCount(orbit: number): number {
    const orbitLevels = this.levels.filter((l) => l.orbit === orbit);
    return orbitLevels.filter(
      (l) => this.campaignData.levels[l.id]?.completed && this.campaignData.levels[l.id]?.medal !== 'none',
    ).length;
  }
}
