import {
  ActiveMatchHUDItem,
  CharacterProfile,
  ContactEventPayload,
  DifficultyConfig,
  DifficultyId,
  EncounterRecord,
} from '../types';
import { DIFFICULTY_CONFIGS, buildShuffledDeck } from '../data/characters';
import { soundEngine } from '../audio/soundEngine';
import { portraitStudio } from '../ui/portraitStudio';
import { MatchingAppUI } from '../ui/matchingAppUI';
import { SidewalkScene } from '../scene/sidewalkScene';

const BEST_SCORE_KEY_PREFIX = 'sr_best_score_';

export class GameController {
  private rootEl: HTMLElement;
  private selectedDifficulty: DifficultyId = 'normal';
  private config: DifficultyConfig = DIFFICULTY_CONFIGS.normal;

  private matchingUI!: MatchingAppUI;
  private sidewalkScene!: SidewalkScene;

  private isPlaying = false;
  private remainingSec = 75;
  private elapsedSec = 0;
  private isRush = false;
  private lastTickSecond = -1;
  private lastSwipeTimeSec = 0;

  private score = 0;
  private goodCombo = 0;
  private maxCombo = 0;
  private lastGoodContactTimeSec = -99;

  private nextInstanceId = 1;
  private records: Map<number, EncounterRecord> = new Map();
  private activeMatchCount = 0;

  private keysHeld: Set<string> = new Set();
  private touchSteerPointerId: number | null = null;
  private touchSteerStartX = 0;
  private touchSteerBaseNormX = 0;
  private touchDirectTargetX: number | null = null;
  private buttonSteerDir = 0;

  // DOM references
  private scoreValEl!: HTMLElement;
  private comboBadgeEl!: HTMLElement;
  private timerValEl!: HTMLElement;
  private timerBarFillEl!: HTMLElement;
  private timerWrapEl!: HTMLElement;
  private activeStreetBadgeEl!: HTMLElement;
  private diffBadgeEl!: HTMLElement;
  private overheadLayerEl!: HTMLElement;
  private streetQueueEl!: HTMLElement;
  private toastLayerEl!: HTMLElement;
  private steerThumbEl!: HTMLElement;
  private titleModalEl!: HTMLElement;
  private resultModalEl!: HTMLElement;
  private hudBgmBtn!: HTMLButtonElement;
  private hudSeBtn!: HTMLButtonElement;

  private badgeEls: Map<number, HTMLElement> = new Map();
  private lastFrameTime = performance.now();

  constructor(rootEl: HTMLElement) {
    this.rootEl = rootEl;
    this.buildShellDOM();
    this.initSubsystems();
    this.bindGlobalControls();
    this.updateAudioButtonsUI();
    this.refreshTitleBestScore();

    // Start render loop
    requestAnimationFrame((now) => this.loop(now));
  }

  private buildShellDOM(): void {
    this.rootEl.innerHTML = `
      <header class="top-hud" id="top-hud">
        <div class="hud-left">
          <div class="hud-logo">💘 スワイプ・ランデブー！</div>
          <span class="hud-diff-badge" id="hud-diff-badge">ふつう</span>
          <div class="hud-score-box">
            <span class="hud-score-label">SCORE</span>
            <span class="hud-score-value" id="hud-score-val">0</span>
          </div>
          <div class="hud-combo" id="hud-combo-badge">誠実コンボ x1.0</div>
        </div>

        <div class="hud-center" id="hud-timer-wrap">
          <div class="hud-timer-top">
            <span class="hud-timer-label" id="hud-timer-label">残り時間</span>
            <span class="hud-timer-val" id="hud-timer-val">75.0s</span>
          </div>
          <div class="hud-timer-track">
            <div class="hud-timer-fill" id="hud-timer-fill"></div>
          </div>
        </div>

        <div class="hud-right">
          <div class="hud-street-count" id="hud-street-count" title="現在3D歩道を歩いてきているマッチング人数">
            🚶 歩道接近中: <strong>0</strong>人
          </div>
          <button type="button" class="hud-icon-btn" id="hud-btn-bgm" title="BGM オン/オフ">🎵 BGM</button>
          <button type="button" class="hud-icon-btn" id="hud-btn-se" title="効果音 オン/オフ">🔊 SE</button>
          <button type="button" class="hud-icon-btn hud-btn-title" id="hud-btn-menu" title="タイトル画面へ戻る">🏠 タイトル</button>
        </div>
      </header>

      <main class="split-stage" id="split-stage">
        <section class="left-pane" id="left-pane" aria-label="マッチングアプリ画面"></section>

        <section class="right-pane" id="right-pane" aria-label="3D歩道アクション画面">
          <div class="three-container" id="three-container"></div>
          <div class="street-queue-strip" id="street-queue-strip"></div>
          <div class="overhead-layer" id="overhead-layer"></div>
          <div class="contact-toast-layer" id="contact-toast-layer"></div>

          <div class="steering-hud" id="steering-touch-zone">
            <button type="button" class="steer-edge-btn" id="btn-steer-left" aria-label="左へ移動">◀ A / ←</button>
            <div class="steer-track-wrap">
              <div class="steer-track-label">左右移動（A・D / 矢印キー / 右画面ドラッグ）</div>
              <div class="steer-track-bar">
                <div class="steer-thumb" id="steer-thumb">🏃</div>
              </div>
            </div>
            <button type="button" class="steer-edge-btn" id="btn-steer-right" aria-label="右へ移動">D / → ▶</button>
          </div>
        </section>
      </main>

      <!-- Title Modal -->
      <div class="modal-backdrop" id="title-modal">
        <div class="title-modal">
          <div class="title-hero-banner">
            <img src="./assets/title_hero.jpg" alt="スワイプ・ランデブー！" class="title-hero-img" />
            <div class="title-hero-overlay">
              <span class="title-genre-pill">マッチングアプリ × 3D歩道アクション</span>
              <h1 class="title-main-heading">スワイプ・ランデブー！</h1>
              <p class="title-sub-heading">〜右スワイプしたら即エンカウント！左で選び、右で捌く同時進行スコアアタック〜</p>
            </div>
          </div>

          <div class="title-body">
            <div class="rule-cards-grid">
              <div class="rule-card">
                <div class="rule-card-title">📱 左画面：マッチング選別</div>
                <p class="rule-card-desc">
                  写真・自己紹介・目印を見て<strong>右スワイプ（会う💚）</strong>すると即座に右の歩道奥に登場！<strong>左スワイプ（会わない✕）</strong>なら登場しません（スワイプ自体は±0点）。
                </p>
              </div>
              <div class="rule-card">
                <div class="rule-card-title">🏃 右画面：3D歩道で見極め接触</div>
                <p class="rule-card-desc">
                  近づくと相手の本性が判明！<strong>当たり（+1,000点〜）</strong>に接触し、<strong>外れ（-600点）</strong>と<strong>業者（-1,200点）</strong>は左右移動で回避！当たりを見逃しても減点なし（±0点）。
                </p>
              </div>
            </div>

            <div class="title-controls-row">
              <div class="difficulty-selector">
                <div class="section-mini-label">難易度を選択</div>
                <div class="diff-cards">
                  <button type="button" class="diff-card selected" id="diff-normal" data-diff="normal">
                    <div class="diff-card-header">
                      <span class="diff-card-name">🌱 ふつう</span>
                      <span class="diff-card-best" id="best-score-normal">BEST: 0</span>
                    </div>
                    <p class="diff-card-desc">初見でも左右の同時操作と相手の挙動見極めを気持ちよく楽しめる標準モード</p>
                  </button>
                  <button type="button" class="diff-card" id="diff-hard" data-diff="hard">
                    <div class="diff-card-header">
                      <span class="diff-card-name">🔥 難しい</span>
                      <span class="diff-card-best" id="best-score-hard">BEST: 0</span>
                    </div>
                    <p class="diff-card-desc">週末ラッシュ！接近速度アップ＆クセの強い相手と通行人が交錯する高難度モード</p>
                  </button>
                </div>
              </div>

              <div class="audio-settings-box">
                <div class="section-mini-label">サウンド設定（個別ON/OFF）</div>
                <button type="button" class="audio-toggle-btn active" id="btn-toggle-bgm">
                  <span class="audio-toggle-icon">🎵</span>
                  <span class="audio-toggle-text">BGM: ON</span>
                </button>
                <button type="button" class="audio-toggle-btn active" id="btn-toggle-se">
                  <span class="audio-toggle-icon">🔊</span>
                  <span class="audio-toggle-text">効果音: ON</span>
                </button>
              </div>
            </div>

            <div class="title-start-row">
              <button type="button" class="btn-start-game" id="btn-start-game">
                🚀 ゲームスタート！（75秒スコアアタック）
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Result Modal -->
      <div class="modal-backdrop hidden" id="result-modal">
        <div class="result-modal" id="result-modal-content"></div>
      </div>
    `;

    this.scoreValEl = this.rootEl.querySelector('#hud-score-val') as HTMLElement;
    this.comboBadgeEl = this.rootEl.querySelector('#hud-combo-badge') as HTMLElement;
    this.timerValEl = this.rootEl.querySelector('#hud-timer-val') as HTMLElement;
    this.timerBarFillEl = this.rootEl.querySelector('#hud-timer-fill') as HTMLElement;
    this.timerWrapEl = this.rootEl.querySelector('#hud-timer-wrap') as HTMLElement;
    this.activeStreetBadgeEl = this.rootEl.querySelector('#hud-street-count') as HTMLElement;
    this.diffBadgeEl = this.rootEl.querySelector('#hud-diff-badge') as HTMLElement;
    this.overheadLayerEl = this.rootEl.querySelector('#overhead-layer') as HTMLElement;
    this.streetQueueEl = this.rootEl.querySelector('#street-queue-strip') as HTMLElement;
    this.toastLayerEl = this.rootEl.querySelector('#contact-toast-layer') as HTMLElement;
    this.steerThumbEl = this.rootEl.querySelector('#steer-thumb') as HTMLElement;
    this.titleModalEl = this.rootEl.querySelector('#title-modal') as HTMLElement;
    this.resultModalEl = this.rootEl.querySelector('#result-modal') as HTMLElement;
    this.hudBgmBtn = this.rootEl.querySelector('#hud-btn-bgm') as HTMLButtonElement;
    this.hudSeBtn = this.rootEl.querySelector('#hud-btn-se') as HTMLButtonElement;
  }

  private initSubsystems(): void {
    const leftPane = this.rootEl.querySelector('#left-pane') as HTMLElement;
    const threeContainer = this.rootEl.querySelector('#three-container') as HTMLElement;

    this.matchingUI = new MatchingAppUI(leftPane, {
      onSwipeRight: (character) => this.handleSwipeRight(character),
      onSwipeLeft: (character) => this.handleSwipeLeft(character),
    });

    this.sidewalkScene = new SidewalkScene(threeContainer, {
      onMatchContact: (payload) => this.handleMatchContact(payload),
      onMatchAvoided: (instanceId, character) => this.handleMatchAvoided(instanceId, character),
      onMatchRevealed: (instanceId, character, bark) =>
        this.handleMatchRevealed(instanceId, character, bark),
      onPedestrianBump: () => this.handlePedestrianBump(),
    });

    // Preload portrait backdrops and populate initial preview deck
    portraitStudio.preload().then(() => {
      this.matchingUI.setDeck(buildShuffledDeck(this.selectedDifficulty));
    });
  }

  private bindGlobalControls(): void {
    // Difficulty selection on Title Screen
    const diffBtns = this.rootEl.querySelectorAll('.diff-card');
    diffBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const diff = (btn as HTMLElement).dataset.diff as DifficultyId;
        if (!diff) return;
        this.selectedDifficulty = diff;
        diffBtns.forEach((b) => b.classList.toggle('selected', b === btn));
        soundEngine.unlock();
        soundEngine.playSwipeLeft();
      });
    });

    // Audio toggles (Title & HUD)
    const toggleBgm = (e: Event) => {
      (e.currentTarget as HTMLElement | null)?.blur();
      soundEngine.unlock();
      soundEngine.toggleBgm();
      this.updateAudioButtonsUI();
    };
    const toggleSe = (e: Event) => {
      (e.currentTarget as HTMLElement | null)?.blur();
      soundEngine.unlock();
      soundEngine.toggleSe();
      if (soundEngine.seEnabled) soundEngine.playSwipeRight();
      this.updateAudioButtonsUI();
    };

    this.rootEl.querySelector('#btn-toggle-bgm')?.addEventListener('click', toggleBgm);
    this.rootEl.querySelector('#btn-toggle-se')?.addEventListener('click', toggleSe);
    this.hudBgmBtn.addEventListener('click', toggleBgm);
    this.hudSeBtn.addEventListener('click', toggleSe);

    // Return to title button
    this.rootEl.querySelector('#hud-btn-menu')?.addEventListener('click', (e) => {
      (e.currentTarget as HTMLElement | null)?.blur();
      this.showTitleScreen();
    });

    // Start game CTA
    this.rootEl.querySelector('#btn-start-game')?.addEventListener('click', (e) => {
      (e.currentTarget as HTMLElement | null)?.blur();
      soundEngine.unlock();
      this.startGame(this.selectedDifficulty);
    });

    // Keyboard controls (PC: A/D or ArrowLeft/ArrowRight for right screen; optional Q/E for quick left swipe)
    window.addEventListener('keydown', (e) => {
      if (!this.isPlaying) return;
      const code = e.code;
      if (code === 'KeyA' || code === 'ArrowLeft') {
        e.preventDefault();
        this.keysHeld.add('left');
        this.touchDirectTargetX = null;
      } else if (code === 'KeyD' || code === 'ArrowRight') {
        e.preventDefault();
        this.keysHeld.add('right');
        this.touchDirectTargetX = null;
      } else if (code === 'KeyQ') {
        e.preventDefault();
        this.matchingUI.triggerSwipe('left');
      } else if (code === 'KeyE') {
        e.preventDefault();
        this.matchingUI.triggerSwipe('right');
      }
    });

    window.addEventListener('keyup', (e) => {
      const code = e.code;
      if (code === 'KeyA' || code === 'ArrowLeft') {
        this.keysHeld.delete('left');
      } else if (code === 'KeyD' || code === 'ArrowRight') {
        this.keysHeld.delete('right');
      }
    });

    // Edge steering hold buttons
    const btnLeft = this.rootEl.querySelector('#btn-steer-left') as HTMLButtonElement;
    const btnRight = this.rootEl.querySelector('#btn-steer-right') as HTMLButtonElement;

    const bindHoldBtn = (btn: HTMLButtonElement, dir: number) => {
      btn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        btn.blur();
        this.buttonSteerDir = dir;
        this.touchDirectTargetX = null;
      });
      const clear = () => {
        if (this.buttonSteerDir === dir) this.buttonSteerDir = 0;
      };
      btn.addEventListener('pointerup', clear);
      btn.addEventListener('pointercancel', clear);
      btn.addEventListener('pointerleave', clear);
    };
    bindHoldBtn(btnLeft, -1);
    bindHoldBtn(btnRight, 1);

    // Right Pane Touch / Mouse Drag Steering (independent pointerId so simultaneous multi-touch with left thumb works!)
    const rightPane = this.rootEl.querySelector('#right-pane') as HTMLElement;
    rightPane.addEventListener('pointerdown', (e: PointerEvent) => {
      if (!this.isPlaying) return;
      // Ignore if clicking edge buttons
      if ((e.target as HTMLElement).closest('.steer-edge-btn')) return;
      if (this.touchSteerPointerId !== null) return;

      this.touchSteerPointerId = e.pointerId;
      this.touchSteerStartX = e.clientX;
      this.touchSteerBaseNormX = this.sidewalkScene.getPlayerNormalizedX();
      this.touchDirectTargetX = this.touchSteerBaseNormX * 3.65;
      try {
        rightPane.setPointerCapture(e.pointerId);
      } catch {
        // Ignore on synthetic events
      }
    });

    rightPane.addEventListener('pointermove', (e: PointerEvent) => {
      if (e.pointerId !== this.touchSteerPointerId || !this.isPlaying) return;
      const paneWidth = Math.max(240, rightPane.clientWidth);
      const deltaNorm = ((e.clientX - this.touchSteerStartX) / (paneWidth * 0.42)) * 1.0;
      const clampedNorm = Math.max(-1, Math.min(1, this.touchSteerBaseNormX + deltaNorm));
      this.touchDirectTargetX = clampedNorm * 3.65;
    });

    const endRightSteer = (e: PointerEvent) => {
      if (e.pointerId !== this.touchSteerPointerId) return;
      this.touchSteerPointerId = null;
      this.touchDirectTargetX = null;
      try {
        if (rightPane.hasPointerCapture(e.pointerId)) {
          rightPane.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore
      }
    };
    rightPane.addEventListener('pointerup', endRightSteer);
    rightPane.addEventListener('pointercancel', endRightSteer);

    window.addEventListener('resize', () => {
      this.sidewalkScene.resize();
    });
  }

  private updateAudioButtonsUI(): void {
    const bgmOn = soundEngine.bgmEnabled;
    const seOn = soundEngine.seEnabled;

    const titleBgm = this.rootEl.querySelector('#btn-toggle-bgm');
    if (titleBgm) {
      titleBgm.classList.toggle('active', bgmOn);
      const txt = titleBgm.querySelector('.audio-toggle-text');
      if (txt) txt.textContent = `BGM: ${bgmOn ? 'ON' : 'OFF'}`;
    }

    const titleSe = this.rootEl.querySelector('#btn-toggle-se');
    if (titleSe) {
      titleSe.classList.toggle('active', seOn);
      const txt = titleSe.querySelector('.audio-toggle-text');
      if (txt) txt.textContent = `効果音: ${seOn ? 'ON' : 'OFF'}`;
    }

    this.hudBgmBtn.classList.toggle('muted', !bgmOn);
    this.hudBgmBtn.textContent = bgmOn ? '🎵 BGM ON' : '🔇 BGM OFF';

    this.hudSeBtn.classList.toggle('muted', !seOn);
    this.hudSeBtn.textContent = seOn ? '🔊 SE ON' : '🔈 SE OFF';
  }

  private getBestScore(diff: DifficultyId): number {
    try {
      const val = localStorage.getItem(`${BEST_SCORE_KEY_PREFIX}${diff}`);
      return val ? parseInt(val, 10) || 0 : 0;
    } catch {
      return 0;
    }
  }

  private saveBestScore(diff: DifficultyId, newScore: number): boolean {
    const prev = this.getBestScore(diff);
    if (newScore > prev) {
      try {
        localStorage.setItem(`${BEST_SCORE_KEY_PREFIX}${diff}`, String(newScore));
      } catch {
        // Ignore storage quota errors
      }
      return true;
    }
    return false;
  }

  private refreshTitleBestScore(): void {
    const normEl = this.rootEl.querySelector('#best-score-normal');
    const hardEl = this.rootEl.querySelector('#best-score-hard');
    if (normEl) normEl.textContent = `BEST: ${this.getBestScore('normal').toLocaleString()}`;
    if (hardEl) hardEl.textContent = `BEST: ${this.getBestScore('hard').toLocaleString()}`;
  }

  public showTitleScreen(): void {
    this.isPlaying = false;
    this.matchingUI.setEnabled(false);
    soundEngine.stopBgm();
    this.refreshTitleBestScore();
    this.titleModalEl.classList.remove('hidden');
    this.resultModalEl.classList.add('hidden');
  }

  public startGame(difficulty: DifficultyId): void {
    this.selectedDifficulty = difficulty;
    this.config = DIFFICULTY_CONFIGS[difficulty];

    this.isPlaying = true;
    this.remainingSec = this.config.durationSec;
    this.elapsedSec = 0;
    this.isRush = false;
    this.lastTickSecond = -1;
    this.lastSwipeTimeSec = 0;

    this.score = 0;
    this.goodCombo = 0;
    this.maxCombo = 0;
    this.lastGoodContactTimeSec = -99;
    this.nextInstanceId = 1;
    this.records.clear();
    this.activeMatchCount = 0;

    this.keysHeld.clear();
    this.touchSteerPointerId = null;
    this.touchDirectTargetX = null;
    this.buttonSteerDir = 0;

    this.overheadLayerEl.innerHTML = '';
    this.streetQueueEl.innerHTML = '';
    this.toastLayerEl.innerHTML = '';
    this.badgeEls.clear();

    this.diffBadgeEl.textContent = this.config.label;
    this.diffBadgeEl.className = `hud-diff-badge diff-${difficulty}`;

    this.sidewalkScene.setDifficulty(this.config);
    this.sidewalkScene.reset();

    const deck = buildShuffledDeck(difficulty);
    this.matchingUI.setDeck(deck);
    this.matchingUI.setEnabled(true);
    this.matchingUI.setNudgeHighlight(
      false,
      '👉 右スワイプで即・歩道に登場！プロフィールから当たりを予想しよう',
    );

    this.titleModalEl.classList.add('hidden');
    this.resultModalEl.classList.add('hidden');

    this.updateHUD();
    soundEngine.startBgm(difficulty);
  }

  private handleSwipeRight(character: CharacterProfile): void {
    if (!this.isPlaying) return;
    this.lastSwipeTimeSec = this.elapsedSec;
    soundEngine.playSwipeRight();

    const instanceId = this.nextInstanceId++;
    this.records.set(instanceId, {
      instanceId,
      character,
      swipedRight: true,
      outcome: 'approaching',
      scoreDelta: 0,
      comboAtContact: 0,
      timestampSec: this.elapsedSec,
    });

    // Spawn immediately in far distance of 3D sidewalk
    this.sidewalkScene.spawnMatchedCharacter(character, instanceId);
    window.setTimeout(() => {
      if (this.isPlaying) soundEngine.playMatchSpawn();
    }, 110);

    this.matchingUI.setNudgeHighlight(
      false,
      `💘 ${character.name}さんが右画面の歩道奥に登場！（目印: ${character.spotHint}）`,
    );
    this.spawnLaunchArcToast(character);
  }

  private handleSwipeLeft(character: CharacterProfile): void {
    if (!this.isPlaying) return;
    this.lastSwipeTimeSec = this.elapsedSec;
    soundEngine.playSwipeLeft();

    const instanceId = this.nextInstanceId++;
    this.records.set(instanceId, {
      instanceId,
      character,
      swipedRight: false,
      outcome: 'swiped_left',
      scoreDelta: 0,
      comboAtContact: 0,
      timestampSec: this.elapsedSec,
    });
  }

  private spawnLaunchArcToast(character: CharacterProfile): void {
    const pill = document.createElement('div');
    pill.className = 'match-launch-pill';
    const miniUrl = portraitStudio.getMiniAvatarDataUrl(character);
    pill.innerHTML = `
      <img src="${miniUrl}" alt="" class="launch-pill-avatar" />
      <span>💘 <strong>${this.escapeHtml(character.name)}</strong> が歩道の奥に登場！</span>
    `;
    this.toastLayerEl.appendChild(pill);
    window.setTimeout(() => pill.remove(), 1500);
  }

  private handleMatchRevealed(
    instanceId: number,
    character: CharacterProfile,
    _bark: string,
  ): void {
    if (!this.isPlaying) return;
    soundEngine.playBehaviorReveal(character.category);
    const badge = this.badgeEls.get(instanceId);
    if (badge) {
      badge.classList.add('revealed');
    }
  }

  private handleMatchContact(payload: ContactEventPayload): void {
    if (!this.isPlaying) return;
    const { instanceId, character } = payload;
    const rec = this.records.get(instanceId);

    let delta = character.baseScore;
    let isMultiMeet = false;

    if (character.category === 'good') {
      this.goodCombo++;
      if (this.goodCombo > this.maxCombo) this.maxCombo = this.goodCombo;

      const mult =
        this.goodCombo === 1
          ? 1.0
          : this.goodCombo === 2
            ? 1.2
            : this.goodCombo === 3
              ? 1.5
              : 1.8;
      delta = Math.round(character.baseScore * mult);

      if (this.elapsedSec - this.lastGoodContactTimeSec <= 2.0) {
        delta += 400;
        isMultiMeet = true;
      }
      this.lastGoodContactTimeSec = this.elapsedSec;
      soundEngine.playContactGood(this.goodCombo);
    } else if (character.category === 'bad') {
      this.goodCombo = 0;
      delta = character.baseScore; // -600
      soundEngine.playContactBad();
    } else {
      this.goodCombo = 0;
      delta = character.baseScore; // -1200
      soundEngine.playContactScam();
    }

    this.score += delta;

    if (rec) {
      rec.outcome = 'contacted';
      rec.scoreDelta = delta;
      rec.comboAtContact = this.goodCombo;
    }

    // Remove floating badge immediately on contact
    const badge = this.badgeEls.get(instanceId);
    if (badge) {
      badge.remove();
      this.badgeEls.delete(instanceId);
    }

    this.spawnContactResultToast(character, delta, this.goodCombo, isMultiMeet);
    this.updateHUD();
  }

  private handleMatchAvoided(instanceId: number, _character: CharacterProfile): void {
    const rec = this.records.get(instanceId);
    if (rec && rec.outcome === 'approaching') {
      rec.outcome = 'avoided';
      rec.scoreDelta = 0; // Strictly 0 score change for avoiding/missing ANY character
    }
    const badge = this.badgeEls.get(instanceId);
    if (badge) {
      badge.remove();
      this.badgeEls.delete(instanceId);
    }
  }

  private handlePedestrianBump(): void {
    if (!this.isPlaying) return;
    soundEngine.playPedestrianBump();
    const existingBump = this.toastLayerEl.querySelector('.contact-toast.bump');
    if (existingBump) existingBump.remove();

    const toast = document.createElement('div');
    toast.className = 'contact-toast bump';
    toast.innerHTML = `
      <div class="toast-headline">💦 一般通行人と接触！（±0点・減速）</div>
    `;
    this.toastLayerEl.appendChild(toast);
    window.setTimeout(() => toast.remove(), 1100);
  }

  private spawnContactResultToast(
    character: CharacterProfile,
    delta: number,
    combo: number,
    isMultiMeet: boolean,
  ): void {
    const toast = document.createElement('div');
    toast.className = `contact-toast ${character.category}`;

    const sign = delta >= 0 ? `+${delta.toLocaleString()}` : delta.toLocaleString();
    const catLabel =
      character.category === 'good'
        ? '✨ 当たり！'
        : character.category === 'bad'
          ? '💥 外れ！'
          : '🚨 業者！';
    const extraTags: string[] = [];
    if (character.category === 'good' && combo >= 2) {
      extraTags.push(`🔥 ${combo}連続コンボ！`);
    }
    if (isMultiMeet) {
      extraTags.push(`💖 ダブルランデブー +400!`);
    }

    const miniUrl = portraitStudio.getMiniAvatarDataUrl(character);

    toast.innerHTML = `
      <div class="toast-top-row">
        <img src="${miniUrl}" alt="" class="toast-avatar" />
        <div class="toast-title-col">
          <div class="toast-badge-line">
            <span class="toast-cat-pill">${catLabel}</span>
            <span class="toast-name">${this.escapeHtml(character.name)}</span>
            <span class="toast-score-delta">${sign}点</span>
          </div>
          <div class="toast-contact-title">${this.escapeHtml(character.contactTitle)}</div>
        </div>
      </div>
      <div class="toast-detail">${this.escapeHtml(character.contactDetail)}</div>
      ${
        extraTags.length > 0
          ? `<div class="toast-extra-row">${extraTags.join(' / ')}</div>`
          : ''
      }
    `;

    this.toastLayerEl.appendChild(toast);
    const allToasts = this.toastLayerEl.querySelectorAll('.contact-toast:not(.bump)');
    if (allToasts.length > 2) {
      allToasts[0].remove();
    }
    window.setTimeout(() => toast.remove(), 2700);
  }

  private updateHUD(): void {
    this.scoreValEl.textContent = this.score.toLocaleString();
    this.scoreValEl.classList.toggle('negative', this.score < 0);

    const mult =
      this.goodCombo <= 1
        ? 'x1.0'
        : this.goodCombo === 2
          ? 'x1.2'
          : this.goodCombo === 3
            ? 'x1.5'
            : 'x1.8';
    this.comboBadgeEl.textContent =
      this.goodCombo >= 2 ? `🔥 誠実コンボ ${this.goodCombo}連続 (${mult})` : `誠実コンボ ${mult}`;
    this.comboBadgeEl.classList.toggle('combo-hot', this.goodCombo >= 2);

    this.timerValEl.textContent = `${Math.max(0, this.remainingSec).toFixed(1)}s`;
    const pct = Math.max(0, Math.min(100, (this.remainingSec / this.config.durationSec) * 100));
    this.timerBarFillEl.style.width = `${pct}%`;
    this.timerWrapEl.classList.toggle('rush', this.isRush);
    const timerLabel = this.rootEl.querySelector('#hud-timer-label');
    if (timerLabel) {
      timerLabel.textContent = this.isRush ? '🔥 週末RUSH!' : '残り時間';
    }

    this.activeStreetBadgeEl.innerHTML = `🚶 歩道接近中: <strong>${this.activeMatchCount}</strong>人`;
  }

  private syncOverheadBadges(items: ActiveMatchHUDItem[]): void {
    this.activeMatchCount = items.length;
    const activeIds = new Set<number>();

    // Sort foreground (highest progress) to background (lowest progress) for anti-overlap layout
    const sorted = items.slice().sort((a, b) => b.progress - a.progress);
    const placedBoxes: Array<{ x: number; y: number }> = [];

    for (const item of sorted) {
      activeIds.add(item.instanceId);
      let badge = this.badgeEls.get(item.instanceId);
      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'match-badge';
        const miniUrl = portraitStudio.getMiniAvatarDataUrl(item.character);
        badge.innerHTML = `
          <div class="match-badge-main">
            <img src="${miniUrl}" alt="" class="match-badge-avatar" />
            <div class="match-badge-text">
              <span class="match-badge-name">💗 ${this.escapeHtml(item.character.name)}</span>
              <span class="match-badge-hint">${this.escapeHtml(item.character.spotHint)}</span>
            </div>
          </div>
          <div class="match-badge-bark">${this.escapeHtml(item.character.revealBark)}</div>
        `;
        this.overheadLayerEl.appendChild(badge);
        this.badgeEls.set(item.instanceId, badge);
      }

      badge.classList.toggle('revealed', item.isRevealed);
      if (!item.visible) {
        badge.style.display = 'none';
      } else {
        badge.style.display = 'flex';
        let drawX = item.screenX;
        let drawY = item.screenY;

        // De-overlap against closer badges in screen space
        for (let pass = 0; pass < 4; pass++) {
          let collided = false;
          for (const box of placedBoxes) {
            if (Math.abs(drawX - box.x) < 122 && Math.abs(drawY - box.y) < 38) {
              drawY = box.y - 39;
              drawX += drawX >= box.x ? 10 : -10;
              collided = true;
            }
          }
          if (!collided) break;
        }
        drawY = Math.max(44, drawY);
        placedBoxes.push({ x: drawX, y: drawY });

        const scale = item.isRevealed ? 0.92 + item.progress * 0.14 : 0.72 + item.progress * 0.2;
        badge.style.transform = `translate3d(${Math.round(drawX)}px, ${Math.round(drawY)}px, 0) translate(-50%, -100%) scale(${scale.toFixed(2)})`;
        badge.style.zIndex = String(Math.round(100 + item.progress * 100));
      }
    }

    for (const [id, el] of this.badgeEls.entries()) {
      if (!activeIds.has(id)) {
        el.remove();
        this.badgeEls.delete(id);
      }
    }

    this.streetQueueEl.innerHTML = sorted
      .slice(0, 6)
      .map((item) => {
        const miniUrl = portraitStudio.getMiniAvatarDataUrl(item.character);
        const pct = Math.round(item.progress * 100);
        return `
          <div class="queue-chip ${item.isRevealed ? 'revealed' : ''}">
            <img src="${miniUrl}" alt="" class="queue-chip-img" />
            <span class="queue-chip-name">${this.escapeHtml(item.character.name)}</span>
            <span class="queue-chip-bar"><i style="width:${pct}%"></i></span>
          </div>
        `;
      })
      .join('');
  }

  public stepSimulation(dt: number): void {
    if (!this.isPlaying) return;
    this.elapsedSec += dt;
    this.remainingSec = Math.max(0, this.config.durationSec - this.elapsedSec);

    if (!this.isRush && this.remainingSec <= this.config.rushDurationSec) {
      this.isRush = true;
      soundEngine.setRushMode(true);
    }

    const ceilSec = Math.ceil(this.remainingSec);
    if (ceilSec <= 5 && ceilSec >= 1 && ceilSec !== this.lastTickSecond) {
      this.lastTickSecond = ceilSec;
      soundEngine.playCountdownTick(ceilSec === 1);
    }

    if (this.activeMatchCount === 0 && this.elapsedSec - this.lastSwipeTimeSec > 4.2) {
      this.matchingUI.setNudgeHighlight(
        true,
        '⚡ 歩道に待ち合わせ相手がいません！左のカードを右スワイプして呼び出そう！',
      );
    }

    let axis = 0;
    if (this.keysHeld.has('left')) axis -= 1;
    if (this.keysHeld.has('right')) axis += 1;
    if (this.buttonSteerDir !== 0) axis = this.buttonSteerDir;

    this.sidewalkScene.setPlayerInput(axis, this.touchDirectTargetX);
    const hudItems = this.sidewalkScene.update(dt, this.isRush);
    this.syncOverheadBadges(hudItems);

    const normX = this.sidewalkScene.getPlayerNormalizedX();
    const thumbPct = 50 + normX * 42;
    this.steerThumbEl.style.left = `${thumbPct}%`;

    this.updateHUD();

    if (this.remainingSec <= 0) {
      this.finishGame();
    }
  }

  private loop(now: number): void {
    const rawDt = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;
    const dt = Math.min(0.08, Math.max(0.001, rawDt));

    if (this.isPlaying) {
      this.stepSimulation(dt);
    } else {
      // Idle preview scroll only
      (this.sidewalkScene as unknown as { update: (dt: number, isRush: boolean, idle?: boolean) => void }).update(
        dt * 0.35,
        false,
        true,
      );
    }

    this.sidewalkScene.render();
    requestAnimationFrame((nextNow) => this.loop(nextNow));
  }

  private finishGame(): void {
    this.isPlaying = false;
    this.matchingUI.setEnabled(false);
    soundEngine.stopBgm();
    soundEngine.playFinishFanfare();

    const isNewBest = this.saveBestScore(this.selectedDifficulty, this.score);
    const bestScore = this.getBestScore(this.selectedDifficulty);

    const allRecs = Array.from(this.records.values());
    const metGood = allRecs.filter(
      (r) => r.outcome === 'contacted' && r.character.category === 'good',
    ).length;
    const hitBad = allRecs.filter(
      (r) => r.outcome === 'contacted' && r.character.category === 'bad',
    ).length;
    const hitScam = allRecs.filter(
      (r) => r.outcome === 'contacted' && r.character.category === 'scam',
    ).length;
    const avoidedDanger = allRecs.filter(
      (r) =>
        r.outcome === 'avoided' &&
        (r.character.category === 'bad' || r.character.category === 'scam'),
    ).length;
    const passedLeft = allRecs.filter((r) => r.outcome === 'swiped_left').length;

    const { rank, title, comment } = this.evaluateRank(
      this.score,
      metGood,
      hitBad,
      hitScam,
      avoidedDanger,
    );

    const streetRecs = allRecs.filter(
      (r) =>
        r.outcome === 'contacted' ||
        r.outcome === 'avoided' ||
        r.outcome === 'approaching',
    );

    const reviewListHtml =
      streetRecs.length === 0
        ? `<div class="review-empty">右スワイプで歩道に登場した人物がいませんでした。次は積極的に右スワイプして会ってみよう！</div>`
        : streetRecs
            .map((r) => {
              const c = r.character;
              const miniUrl = portraitStudio.getMiniAvatarDataUrl(c);
              const catBadge =
                c.category === 'good'
                  ? '<span class="rev-cat good">✨ 当たり</span>'
                  : c.category === 'bad'
                    ? '<span class="rev-cat bad">💥 外れ</span>'
                    : '<span class="rev-cat scam">🚨 業者</span>';

              const outcomeLabel =
                r.outcome === 'contacted'
                  ? `<span class="rev-outcome contacted">接触 (${r.scoreDelta >= 0 ? '+' : ''}${r.scoreDelta.toLocaleString()}点)</span>`
                  : r.outcome === 'avoided'
                    ? `<span class="rev-outcome avoided">華麗にスルー (±0点)</span>`
                    : `<span class="rev-outcome avoided">到着前タイムアップ (±0点)</span>`;

              return `
                <div class="review-item ${c.category}">
                  <img src="${miniUrl}" alt="" class="review-avatar" />
                  <div class="review-info">
                    <div class="review-top-line">
                      ${catBadge}
                      <strong class="review-name">${this.escapeHtml(c.name)} (${c.age}歳・${this.escapeHtml(c.occupation)})</strong>
                      ${outcomeLabel}
                    </div>
                    <div class="review-headline">${this.escapeHtml(c.contactTitle)}</div>
                    <div class="review-detail">${this.escapeHtml(c.contactDetail)}</div>
                  </div>
                </div>
              `;
            })
            .join('');

    const contentEl = this.rootEl.querySelector('#result-modal-content') as HTMLElement;
    contentEl.innerHTML = `
      <div class="result-header">
        <div class="result-rank-badge rank-${rank}">${rank}</div>
        <div class="result-title-group">
          <div class="result-mode-line">
            <span>難易度: ${this.config.label}</span>
            ${isNewBest ? '<span class="new-record-pill">🏆 NEW RECORD!</span>' : ''}
          </div>
          <h2 class="result-catch">${this.escapeHtml(title)}</h2>
          <p class="result-comment">${this.escapeHtml(comment)}</p>
        </div>
        <div class="result-score-box">
          <span class="result-score-label">FINAL SCORE</span>
          <span class="result-score-value" id="result-final-score">${this.score.toLocaleString()}</span>
          <span class="result-best-sub">自己ベスト: ${bestScore.toLocaleString()}</span>
        </div>
      </div>

      <div class="result-stats-grid">
        <div class="stat-box good">
          <span class="stat-label">✨ 当たり接触</span>
          <span class="stat-val">${metGood}人</span>
        </div>
        <div class="stat-box bad">
          <span class="stat-label">💥 外れ接触</span>
          <span class="stat-val">${hitBad}人</span>
        </div>
        <div class="stat-box scam">
          <span class="stat-label">🚨 業者接触</span>
          <span class="stat-val">${hitScam}人</span>
        </div>
        <div class="stat-box neutral">
          <span class="stat-label">🛡️ 危険を歩道回避</span>
          <span class="stat-val">${avoidedDanger}人</span>
        </div>
        <div class="stat-box neutral">
          <span class="stat-label">🔥 最大誠実コンボ</span>
          <span class="stat-val">${this.maxCombo}連続 (左見送り${passedLeft}人)</span>
        </div>
      </div>

      <div class="review-section">
        <div class="review-section-title">📖 今日のマッチング振り返り図鑑（歩道に登場した相手と真相）</div>
        <div class="review-list">${reviewListHtml}</div>
      </div>

      <div class="result-actions">
        <button type="button" class="btn-result-retry" id="btn-retry">
          🔄 同じ難易度でもう一回遊ぶ！
        </button>
        <button type="button" class="btn-result-title" id="btn-back-title">
          🏠 タイトル・難易度選択へ
        </button>
      </div>
    `;

    contentEl.querySelector('#btn-retry')?.addEventListener('click', () => {
      soundEngine.unlock();
      this.startGame(this.selectedDifficulty);
    });
    contentEl.querySelector('#btn-back-title')?.addEventListener('click', () => {
      soundEngine.unlock();
      this.showTitleScreen();
    });

    this.resultModalEl.classList.remove('hidden');
  }

  private evaluateRank(
    score: number,
    metGood: number,
    hitBad: number,
    hitScam: number,
    avoidedDanger: number,
  ): { rank: string; title: string; comment: string } {
    if (score >= 7000) {
      return {
        rank: 'S',
        title: '伝説のランデブー・マスター！',
        comment: `誠実な相手を次々と見抜きながら、歩道の危険人物も華麗に完封！見事な左右同時さばきです！`,
      };
    }
    if (score >= 4200) {
      return {
        rank: 'A',
        title: '敏腕マッチング目利きランナー！',
        comment: `${metGood}人の好印象な相手と出会い、怪しい勧誘や迷惑行為も冷静にかわしました！`,
      };
    }
    if (score >= 1800) {
      return {
        rank: 'B',
        title: '街角エンカウント奮闘中！',
        comment:
          hitScam > 0
            ? `良い出会いもありましたが、業者の勧誘（-1,200点）が痛手！近づいた時の巨大グラフや契約書に注目！`
            : `堅実な立ち回り！もう少し積極的に右スワイプして連続コンボを狙うとスコアが跳ね上がります！`,
      };
    }
    return {
      rank: 'C',
      title: '波乱万丈の待ち合わせストリート…！',
      comment:
        metGood === 0
          ? `まずはプロフィールで場所や時間を相談してくれる相手を右スワイプして、歩道で手を振る人に近づこう！`
          : `外れ（${hitBad}人）や業者（${hitScam}人）の猛攻に巻き込まれました！怪しい動きを見たらすぐ逆車線へ退避！（回避成功${avoidedDanger}人）`,
    };
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
