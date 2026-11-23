import { CharacterProfile } from '../types';
import { portraitStudio } from './portraitStudio';

export interface MatchingAppCallbacks {
  onSwipeRight: (character: CharacterProfile) => void;
  onSwipeLeft: (character: CharacterProfile) => void;
}

export class MatchingAppUI {
  private container: HTMLElement;
  private callbacks: MatchingAppCallbacks;
  private deck: CharacterProfile[] = [];
  private currentIndex = 0;

  private cardStageEl!: HTMLElement;
  private activeCardEl: HTMLElement | null = null;
  private nextCardEl: HTMLElement | null = null;
  private deckCountEl!: HTMLElement;
  private matchCountEl!: HTMLElement;
  private pulseBannerEl!: HTMLElement;

  private activePointerId: number | null = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private currentDx = 0;
  private currentDy = 0;
  private isAnimatingOut = false;
  private enabled = false;
  private totalSwipedRight = 0;

  constructor(container: HTMLElement, callbacks: MatchingAppCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.buildDOM();
    this.bindEvents();
  }

  private buildDOM(): void {
    this.container.innerHTML = `
      <div class="phone-frame" id="matching-phone-frame">
        <div class="app-header">
          <div class="app-brand">
            <span class="app-brand-icon">💘</span>
            <span class="app-brand-title">PairWalk</span>
            <span class="app-brand-sub">即会いマッチング</span>
          </div>
          <div class="app-stats-pills">
            <span class="app-pill" id="app-match-count" title="右画面へ送り出した人数">待ち合わせ 0人</span>
            <span class="app-pill app-pill-muted" id="app-deck-count">候補 --</span>
          </div>
        </div>

        <div class="app-nudge-banner" id="app-nudge-banner">
          👉 右スワイプで即・右の歩道に登場！プロフィールから当たりを予想しよう
        </div>

        <div class="card-stage" id="card-stage"></div>

        <div class="card-actions">
          <button type="button" class="btn-swipe btn-nope" id="btn-swipe-left" aria-label="会わない（左スワイプ）">
            <span class="btn-swipe-icon">✕</span>
            <span class="btn-swipe-text">会わない</span>
            <span class="btn-swipe-sub">左スワイプ</span>
          </button>
          <button type="button" class="btn-swipe btn-like" id="btn-swipe-right" aria-label="会う（右スワイプ）">
            <span class="btn-swipe-icon">💚</span>
            <span class="btn-swipe-text">会う！</span>
            <span class="btn-swipe-sub">右スワイプで歩道へ</span>
          </button>
        </div>
      </div>
    `;

    this.cardStageEl = this.container.querySelector('#card-stage') as HTMLElement;
    this.deckCountEl = this.container.querySelector('#app-deck-count') as HTMLElement;
    this.matchCountEl = this.container.querySelector('#app-match-count') as HTMLElement;
    this.pulseBannerEl = this.container.querySelector('#app-nudge-banner') as HTMLElement;
  }

  private bindEvents(): void {
    const btnLeft = this.container.querySelector('#btn-swipe-left') as HTMLButtonElement;
    const btnRight = this.container.querySelector('#btn-swipe-right') as HTMLButtonElement;

    const handleLeftBtn = (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
      btnLeft.blur();
      this.triggerSwipe('left');
    };
    const handleRightBtn = (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
      btnRight.blur();
      this.triggerSwipe('right');
    };

    btnLeft.addEventListener('pointerdown', handleLeftBtn);
    btnLeft.addEventListener('click', handleLeftBtn);

    btnRight.addEventListener('pointerdown', handleRightBtn);
    btnRight.addEventListener('click', handleRightBtn);

    this.cardStageEl.addEventListener('pointerdown', (e: PointerEvent) => {
      if (!this.enabled || this.isAnimatingOut || !this.activeCardEl) return;
      if (this.activePointerId !== null) return;
      this.activePointerId = e.pointerId;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.currentDx = 0;
      this.currentDy = 0;
      this.activeCardEl.style.transition = 'none';
      try {
        this.cardStageEl.setPointerCapture(e.pointerId);
      } catch {
        // Ignore pointer capture errors on synthetic events
      }
    });

    this.cardStageEl.addEventListener('pointermove', (e: PointerEvent) => {
      if (e.pointerId !== this.activePointerId || !this.activeCardEl || this.isAnimatingOut) return;
      this.currentDx = e.clientX - this.dragStartX;
      this.currentDy = (e.clientY - this.dragStartY) * 0.35;
      this.applyDragTransform(this.currentDx, this.currentDy);
    });

    const endDrag = (e: PointerEvent) => {
      if (e.pointerId !== this.activePointerId) return;
      this.activePointerId = null;
      try {
        if (this.cardStageEl.hasPointerCapture(e.pointerId)) {
          this.cardStageEl.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore
      }
      if (!this.activeCardEl || this.isAnimatingOut) return;

      const threshold = Math.min(82, this.cardStageEl.clientWidth * 0.22);
      if (this.currentDx >= threshold) {
        this.triggerSwipe('right');
      } else if (this.currentDx <= -threshold) {
        this.triggerSwipe('left');
      } else {
        // Snap back smoothly
        this.activeCardEl.style.transition = 'transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1)';
        this.activeCardEl.style.transform = 'translate3d(0px, 0px, 0) rotate(0deg)';
        const likeStamp = this.activeCardEl.querySelector('.stamp-like') as HTMLElement | null;
        const nopeStamp = this.activeCardEl.querySelector('.stamp-nope') as HTMLElement | null;
        if (likeStamp) likeStamp.style.opacity = '0';
        if (nopeStamp) nopeStamp.style.opacity = '0';
        if (this.nextCardEl) {
          this.nextCardEl.style.transition = 'transform 0.22s ease, opacity 0.22s ease';
          this.nextCardEl.style.transform = 'scale(0.94) translateY(10px)';
          this.nextCardEl.style.opacity = '0.72';
        }
      }
      this.currentDx = 0;
      this.currentDy = 0;
    };

    this.cardStageEl.addEventListener('pointerup', endDrag);
    this.cardStageEl.addEventListener('pointercancel', endDrag);
  }

  private applyDragTransform(dx: number, dy: number): void {
    if (!this.activeCardEl) return;
    const rot = Math.max(-18, Math.min(18, dx * 0.075));
    this.activeCardEl.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${rot}deg)`;

    const likeStamp = this.activeCardEl.querySelector('.stamp-like') as HTMLElement | null;
    const nopeStamp = this.activeCardEl.querySelector('.stamp-nope') as HTMLElement | null;
    const ratio = Math.min(1, Math.abs(dx) / 85);

    if (dx > 12) {
      if (likeStamp) likeStamp.style.opacity = String(ratio);
      if (nopeStamp) nopeStamp.style.opacity = '0';
    } else if (dx < -12) {
      if (nopeStamp) nopeStamp.style.opacity = String(ratio);
      if (likeStamp) likeStamp.style.opacity = '0';
    } else {
      if (likeStamp) likeStamp.style.opacity = '0';
      if (nopeStamp) nopeStamp.style.opacity = '0';
    }

    if (this.nextCardEl) {
      const scale = 0.94 + ratio * 0.06;
      const ty = 10 - ratio * 10;
      this.nextCardEl.style.transition = 'none';
      this.nextCardEl.style.transform = `scale(${scale}) translateY(${ty}px)`;
      this.nextCardEl.style.opacity = String(0.72 + ratio * 0.28);
    }
  }

  public setDeck(deck: CharacterProfile[]): void {
    this.deck = deck.slice();
    this.currentIndex = 0;
    this.totalSwipedRight = 0;
    this.isAnimatingOut = false;
    this.activePointerId = null;
    this.renderCards();
    this.updateCounters();
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public setNudgeHighlight(active: boolean, text?: string): void {
    if (text) {
      this.pulseBannerEl.textContent = text;
    }
    this.pulseBannerEl.classList.toggle('nudge-active', active);
  }

  public getCurrentCharacter(): CharacterProfile | null {
    if (this.deck.length === 0) return null;
    return this.deck[this.currentIndex % this.deck.length];
  }

  public triggerSwipe(direction: 'left' | 'right'): void {
    if (!this.enabled || this.isAnimatingOut || !this.activeCardEl) return;
    const character = this.getCurrentCharacter();
    if (!character) return;

    this.isAnimatingOut = true;
    this.activePointerId = null;

    const card = this.activeCardEl;
    const likeStamp = card.querySelector('.stamp-like') as HTMLElement | null;
    const nopeStamp = card.querySelector('.stamp-nope') as HTMLElement | null;

    if (direction === 'right') {
      if (likeStamp) likeStamp.style.opacity = '1';
      if (nopeStamp) nopeStamp.style.opacity = '0';
      this.totalSwipedRight++;
      this.callbacks.onSwipeRight(character);
    } else {
      if (nopeStamp) nopeStamp.style.opacity = '1';
      if (likeStamp) likeStamp.style.opacity = '0';
      this.callbacks.onSwipeLeft(character);
    }

    const flyX = direction === 'right' ? 360 : -360;
    const flyRot = direction === 'right' ? 22 : -22;
    card.style.transition = 'transform 0.21s cubic-bezier(0.22, 0.85, 0.36, 1), opacity 0.21s ease';
    card.style.transform = `translate3d(${flyX}px, ${this.currentDy - 12}px, 0) rotate(${flyRot}deg)`;
    card.style.opacity = '0';

    if (this.nextCardEl) {
      this.nextCardEl.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
      this.nextCardEl.style.transform = 'scale(1) translateY(0px)';
      this.nextCardEl.style.opacity = '1';
    }

    this.currentIndex = (this.currentIndex + 1) % this.deck.length;
    this.updateCounters();

    window.setTimeout(() => {
      this.isAnimatingOut = false;
      this.renderCards();
    }, 195);
  }

  private updateCounters(): void {
    this.matchCountEl.textContent = `待ち合わせ ${this.totalSwipedRight}人`;
    const remaining = Math.max(1, this.deck.length - (this.currentIndex % this.deck.length));
    this.deckCountEl.textContent = `候補 #${(this.currentIndex % this.deck.length) + 1}`;
    void remaining;
  }

  private renderCards(): void {
    this.cardStageEl.innerHTML = '';
    if (this.deck.length === 0) return;

    const currentChar = this.deck[this.currentIndex % this.deck.length];
    const nextChar = this.deck[(this.currentIndex + 1) % this.deck.length];

    if (nextChar) {
      this.nextCardEl = this.createCardElement(nextChar, true);
      this.cardStageEl.appendChild(this.nextCardEl);
    } else {
      this.nextCardEl = null;
    }

    this.activeCardEl = this.createCardElement(currentChar, false);
    this.cardStageEl.appendChild(this.activeCardEl);
  }

  private createCardElement(character: CharacterProfile, isNext: boolean): HTMLElement {
    const el = document.createElement('article');
    el.className = isNext ? 'profile-card next-card' : 'profile-card active-card';
    el.dataset.charId = character.id;

    const portraitUrl = portraitStudio.getPortraitDataUrl(character);
    const tagsHtml = character.tags
      .map((t) => `<span class="profile-tag">${this.escapeHtml(t)}</span>`)
      .join('');

    el.innerHTML = `
      <div class="card-photo-wrap">
        <img class="card-photo" src="${portraitUrl}" alt="${this.escapeHtml(character.name)}" draggable="false" />
        <div class="swipe-stamp stamp-like">会う！💚</div>
        <div class="swipe-stamp stamp-nope">見送る ✕</div>
        <div class="card-spot-hint" title="右画面の3D歩道で見分ける目印">
          <span class="spot-hint-icon">👀 目印:</span>
          <span class="spot-hint-text">${this.escapeHtml(character.spotHint)}</span>
        </div>
      </div>
      <div class="card-info">
        <div class="card-header-row">
          <div class="card-name-group">
            <h2 class="card-name">${this.escapeHtml(character.name)}</h2>
            <span class="card-age">${character.age}歳</span>
          </div>
          <span class="card-occupation">${this.escapeHtml(character.occupation)}</span>
        </div>
        <p class="card-tagline">「${this.escapeHtml(character.tagline)}」</p>
        <p class="card-bio">${this.escapeHtml(character.bio)}</p>
        <div class="card-tags">${tagsHtml}</div>
      </div>
    `;

    return el;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
