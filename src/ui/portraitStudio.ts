import {
  CharacterProfile,
  HairStyle,
  InitialPropType,
  PhotoTheme,
} from '../types';

const PHOTO_THEMES: PhotoTheme[] = [
  'cafe',
  'park',
  'lounge',
  'street',
  'night',
  'library',
];

const THEME_BADGE_LABELS: Record<PhotoTheme, string> = {
  cafe: '☕ CAFE SNAP',
  park: '🌿 PARK WALK',
  lounge: '🍸 LOUNGE',
  street: '🏙️ CITY SNAP',
  night: '🌙 NIGHT VIEW',
  library: '📚 BOOK & CAFE',
};

const PROP_BADGE_LABELS: Record<InitialPropType, string> = {
  coffee: '☕ カフェラテ',
  book: '📖 愛読書',
  phone: '📱 スマホ',
  camera: '📷 一眼カメラ',
  bag: '👜 お気に入り鞄',
  bouquet: '💐 花束',
  map: '🗺️ 街歩きマップ',
  umbrella: '☂️ 傘',
  briefcase: '💼 ビジネス鞄',
  cake_box: '🍰 ケーキ箱',
  soccer_ball: '⚽ サッカーボール',
  art_frame: '🖼️ アート額縁',
  watch: '⌚ 高級腕時計',
  jewelry_box: '💎 宝石ケース',
};

export class PortraitStudio {
  private bgImages = new Map<PhotoTheme, HTMLImageElement>();
  private portraitCache = new Map<string, string>();
  private portraitUsedRealBg = new Map<string, boolean>();
  private miniAvatarCache = new Map<string, string>();
  private preloadPromise: Promise<void> | null = null;

  public preload(): Promise<void> {
    if (this.preloadPromise) {
      return this.preloadPromise;
    }

    const tasks = PHOTO_THEMES.map((theme) => {
      return new Promise<void>((resolve) => {
        if (this.bgImages.has(theme)) {
          resolve();
          return;
        }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        let settled = false;
        const finish = (loaded: boolean) => {
          if (settled) return;
          settled = true;
          if (loaded && img.naturalWidth > 0) {
            this.bgImages.set(theme, img);
          }
          resolve();
        };
        img.onload = () => finish(true);
        img.onerror = () => finish(false);
        img.src = `./assets/bg_${theme}.jpg`;
        // Safety fallback timeout so preload never hangs
        window.setTimeout(() => finish(img.complete && img.naturalWidth > 0), 3500);
      });
    });

    this.preloadPromise = Promise.all(tasks).then(() => undefined);
    return this.preloadPromise;
  }

  public getPortraitDataUrl(character: CharacterProfile): string {
    const hasRealBg = this.bgImages.has(character.photoTheme);
    const cached = this.portraitCache.get(character.id);
    if (cached && (this.portraitUsedRealBg.get(character.id) || !hasRealBg)) {
      return cached;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return '';
    }

    this.renderPortrait(ctx, canvas.width, canvas.height, character);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    this.portraitCache.set(character.id, dataUrl);
    this.portraitUsedRealBg.set(character.id, hasRealBg);
    return dataUrl;
  }

  public getMiniAvatarDataUrl(character: CharacterProfile): string {
    const cached = this.miniAvatarCache.get(character.id);
    if (cached) {
      return cached;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return '';
    }

    this.renderMiniAvatar(ctx, canvas.width, canvas.height, character);
    const dataUrl = canvas.toDataURL('image/png');
    this.miniAvatarCache.set(character.id, dataUrl);
    return dataUrl;
  }

  private renderPortrait(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    character: CharacterProfile
  ): void {
    const { appearance, photoTheme } = character;
    const disguise = appearance.photoDisguise;
    const effectiveHairColor = disguise?.hairColor || appearance.hairColor;
    const effectiveTopColor = disguise?.topColor || appearance.topColor;
    const isHeavyFilter = Boolean(disguise);

    // 1. Draw Nano Banana photographic backdrop (or rich procedural fallback)
    const bgImg = this.bgImages.get(photoTheme);
    if (bgImg && bgImg.naturalWidth > 0) {
      this.drawCoverImage(ctx, bgImg, w, h);
    } else {
      this.drawProceduralBackdrop(ctx, w, h, photoTheme);
    }

    // 2. Warm dating-app color grading & ambient bokeh
    this.drawThemeColorGrading(ctx, w, h, photoTheme, isHeavyFilter);

    // 3. If photoDisguise is active, render soft-focus glamour halo behind bust
    if (isHeavyFilter) {
      this.drawGlamourBackAura(ctx, w, h);
    }

    // 4. Draw stylized 3D-shaded character bust matching 3D avatar
    ctx.save();
    this.drawCharacterBust(ctx, {
      cx: w * 0.48,
      headY: h * 0.42,
      scale: 1.0,
      genderStyle: appearance.genderStyle,
      skinColor: appearance.skinColor,
      hairStyle: appearance.hairStyle,
      hairColor: effectiveHairColor,
      topColor: effectiveTopColor,
      bottomColor: appearance.bottomColor,
      accentColor: appearance.accentColor,
      glasses: Boolean(appearance.glasses),
      hat: appearance.hat || 'none',
      initialProp: appearance.initialProp,
      isGlamourFilter: isHeavyFilter,
      seed: this.hashString(character.id),
    });
    ctx.restore();

    // 5. If photoDisguise is set, draw over-the-top sparkle stars & filter lens flare
    if (isHeavyFilter) {
      this.drawGlamourForegroundFX(
        ctx,
        w,
        h,
        disguise?.decoyLabel
      );
    }

    // 6. Top & bottom gradient scrims + corner photo badges
    this.drawPhotoOverlays(ctx, w, h, character);
  }

  private renderMiniAvatar(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    character: CharacterProfile
  ): void {
    const { appearance, photoTheme } = character;
    const cx = w / 2;
    const cy = h / 2;
    const radius = w / 2 - 2;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    // Theme-tinted circular backdrop
    const palette = this.getThemeColors(photoTheme);
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, palette.top);
    bgGrad.addColorStop(1, palette.bottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Soft backlight behind head
    const glow = ctx.createRadialGradient(cx, cy - 4, 4, cx, cy, radius);
    glow.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
    glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // Draw scaled head-and-shoulders (using actual 3D street colors so street badge matches avatar)
    this.drawCharacterBust(ctx, {
      cx: cx,
      headY: h * 0.48,
      scale: 0.34,
      genderStyle: appearance.genderStyle,
      skinColor: appearance.skinColor,
      hairStyle: appearance.hairStyle,
      hairColor: appearance.hairColor,
      topColor: appearance.topColor,
      bottomColor: appearance.bottomColor,
      accentColor: appearance.accentColor,
      glasses: Boolean(appearance.glasses),
      hat: appearance.hat || 'none',
      initialProp: undefined,
      isGlamourFilter: false,
      seed: this.hashString(character.id),
    });

    ctx.restore();

    // Crisp circular rim border
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 1, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.94)';
    ctx.stroke();
    ctx.restore();
  }

  private drawCoverImage(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    w: number,
    h: number
  ): void {
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const scale = Math.max(w / iw, h / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (w - dw) * 0.5;
    const dy = (h - dh) * 0.35;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  private getThemeColors(theme: PhotoTheme): {
    top: string;
    mid: string;
    bottom: string;
    bokeh: string;
  } {
    switch (theme) {
      case 'cafe':
        return {
          top: '#f6d5b0',
          mid: '#d79969',
          bottom: '#6f4731',
          bokeh: 'rgba(255, 240, 200, 0.32)',
        };
      case 'park':
        return {
          top: '#a9e2f5',
          mid: '#8fd694',
          bottom: '#3d7b52',
          bokeh: 'rgba(240, 255, 210, 0.35)',
        };
      case 'lounge':
        return {
          top: '#3b2439',
          mid: '#7b3e57',
          bottom: '#221527',
          bokeh: 'rgba(255, 195, 130, 0.34)',
        };
      case 'street':
        return {
          top: '#9ec8f8',
          mid: '#f4c7a1',
          bottom: '#6f6a7c',
          bokeh: 'rgba(255, 245, 230, 0.3)',
        };
      case 'night':
        return {
          top: '#162040',
          mid: '#2c3d6b',
          bottom: '#101528',
          bokeh: 'rgba(255, 175, 110, 0.38)',
        };
      case 'library':
        return {
          top: '#dec09c',
          mid: '#a37752',
          bottom: '#4c3424',
          bokeh: 'rgba(255, 234, 195, 0.28)',
        };
    }
  }

  private drawProceduralBackdrop(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    theme: PhotoTheme
  ): void {
    const palette = this.getThemeColors(theme);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, palette.top);
    grad.addColorStop(0.55, palette.mid);
    grad.addColorStop(1, palette.bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Architectural / scenic shapes in soft depth-of-field
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(28, 70, 120, 320);
    ctx.fillRect(w - 140, 50, 110, 360);

    // Bokeh lights
    const bokehSpots = [
      { x: 85, y: 120, r: 36 },
      { x: 165, y: 85, r: 24 },
      { x: 375, y: 110, r: 44 },
      { x: 410, y: 205, r: 28 },
      { x: 65, y: 245, r: 30 },
      { x: 330, y: 260, r: 22 },
    ];
    for (const spot of bokehSpots) {
      const bGrad = ctx.createRadialGradient(
        spot.x,
        spot.y,
        2,
        spot.x,
        spot.y,
        spot.r
      );
      bGrad.addColorStop(0, palette.bokeh);
      bGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = bGrad;
      ctx.beginPath();
      ctx.arc(spot.x, spot.y, spot.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawThemeColorGrading(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    theme: PhotoTheme,
    isHeavyFilter: boolean
  ): void {
    ctx.save();
    // Subtle warm golden-hour wash
    const wash = ctx.createLinearGradient(0, 0, w, h);
    if (isHeavyFilter) {
      wash.addColorStop(0, 'rgba(255, 215, 235, 0.25)');
      wash.addColorStop(0.5, 'rgba(255, 240, 220, 0.14)');
      wash.addColorStop(1, 'rgba(210, 140, 185, 0.26)');
    } else if (theme === 'night' || theme === 'lounge') {
      wash.addColorStop(0, 'rgba(35, 25, 55, 0.16)');
      wash.addColorStop(1, 'rgba(255, 165, 110, 0.14)');
    } else {
      wash.addColorStop(0, 'rgba(255, 245, 225, 0.16)');
      wash.addColorStop(1, 'rgba(245, 165, 130, 0.12)');
    }
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);

    // Subtle photographic vignette + center portrait spotlight
    const vig = ctx.createRadialGradient(
      w * 0.5,
      h * 0.42,
      w * 0.24,
      w * 0.5,
      h * 0.48,
      w * 0.78
    );
    vig.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
    vig.addColorStop(0.65, 'rgba(0, 0, 0, 0.04)');
    vig.addColorStop(1, 'rgba(18, 12, 20, 0.38)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  private drawGlamourBackAura(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number
  ): void {
    ctx.save();
    const aura = ctx.createRadialGradient(
      w * 0.48,
      h * 0.42,
      20,
      w * 0.48,
      h * 0.42,
      210
    );
    aura.addColorStop(0, 'rgba(255, 250, 245, 0.75)');
    aura.addColorStop(0.45, 'rgba(255, 182, 222, 0.42)');
    aura.addColorStop(0.78, 'rgba(255, 218, 145, 0.22)');
    aura.addColorStop(1, 'rgba(255, 182, 222, 0)');
    ctx.fillStyle = aura;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  private drawCharacterBust(
    ctx: CanvasRenderingContext2D,
    opts: {
      cx: number;
      headY: number;
      scale: number;
      genderStyle: 'feminine' | 'masculine' | 'neutral';
      skinColor: string;
      hairStyle: HairStyle;
      hairColor: string;
      topColor: string;
      bottomColor: string;
      accentColor: string;
      glasses: boolean;
      hat: 'beret' | 'cap' | 'none';
      initialProp?: InitialPropType;
      isGlamourFilter: boolean;
      seed: number;
    }
  ): void {
    const {
      cx,
      headY,
      scale,
      genderStyle,
      skinColor,
      hairStyle,
      hairColor,
      topColor,
      accentColor,
      glasses,
      hat,
      initialProp,
      isGlamourFilter,
      seed,
    } = opts;

    ctx.save();
    ctx.translate(cx, headY);
    ctx.scale(scale, scale);

    const headRx = genderStyle === 'masculine' ? 68 : 65;
    const headRy = genderStyle === 'masculine' ? 76 : 73;
    const shoulderHalfW =
      genderStyle === 'masculine' ? 142 : genderStyle === 'feminine' ? 122 : 132;
    const neckY = 58;
    const shoulderY = 102;

    // Soft drop shadow behind character bust for depth separation from background
    const backShadow = ctx.createRadialGradient(0, 50, 30, 0, 65, 185);
    backShadow.addColorStop(0, 'rgba(15, 10, 18, 0.32)');
    backShadow.addColorStop(1, 'rgba(15, 10, 18, 0)');
    ctx.fillStyle = backShadow;
    ctx.beginPath();
    ctx.arc(0, 55, 185, 0, Math.PI * 2);
    ctx.fill();

    // 1. Back hair layer
    this.drawHairBack(ctx, hairStyle, hairColor, headRx, headRy);

    // 2. Neck & cast shadow
    const neckW = genderStyle === 'masculine' ? 42 : 34;
    const neckGrad = ctx.createLinearGradient(-neckW, neckY, neckW, neckY + 55);
    neckGrad.addColorStop(0, this.adjustColor(skinColor, 8));
    neckGrad.addColorStop(0.55, skinColor);
    neckGrad.addColorStop(1, this.adjustColor(skinColor, -26));
    ctx.fillStyle = neckGrad;
    this.roundRectPath(ctx, -neckW * 0.5, neckY - 8, neckW, 64, 14);
    ctx.fill();

    // Chin shadow on neck
    ctx.fillStyle = 'rgba(45, 22, 18, 0.18)';
    ctx.beginPath();
    ctx.ellipse(0, neckY + 8, neckW * 0.48, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3. Torso & 3D outfit matching topColor & accentColor
    this.drawTorsoOutfit(
      ctx,
      shoulderY,
      shoulderHalfW,
      topColor,
      accentColor,
      skinColor,
      genderStyle,
      seed
    );

    // 4. Ears
    this.drawEars(ctx, headRx, skinColor);

    // 5. 3D Shaded Head & Face
    this.drawHeadAndFace(
      ctx,
      headRx,
      headRy,
      skinColor,
      hairColor,
      accentColor,
      genderStyle,
      isGlamourFilter
    );

    // 6. Front Hair & bangs
    this.drawHairFront(ctx, hairStyle, hairColor, accentColor, headRx, headRy, genderStyle);

    // 7. Glasses (if worn)
    if (glasses) {
      this.drawGlasses(ctx, headRx, accentColor);
    }

    // 8. Hat (if worn)
    if (hat && hat !== 'none') {
      this.drawHat(ctx, hat, accentColor, topColor, headRx, headRy);
    }

    // 9. Held initialProp in foreground hand
    if (initialProp) {
      this.drawInitialPropWithHand(
        ctx,
        initialProp,
        skinColor,
        accentColor,
        topColor
      );
    }

    ctx.restore();
  }

  private drawTorsoOutfit(
    ctx: CanvasRenderingContext2D,
    shoulderY: number,
    shoulderHalfW: number,
    topColor: string,
    accentColor: string,
    skinColor: string,
    genderStyle: 'feminine' | 'masculine' | 'neutral',
    seed: number
  ): void {
    const torsoBottom = 355;

    // Main outer top / jacket shape
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-shoulderHalfW * 0.35, shoulderY - 12);
    ctx.quadraticCurveTo(
      -shoulderHalfW * 0.96,
      shoulderY - 2,
      -shoulderHalfW,
      shoulderY + 58
    );
    ctx.lineTo(-shoulderHalfW * 1.06, torsoBottom);
    ctx.lineTo(shoulderHalfW * 1.06, torsoBottom);
    ctx.lineTo(shoulderHalfW, shoulderY + 58);
    ctx.quadraticCurveTo(
      shoulderHalfW * 0.96,
      shoulderY - 2,
      shoulderHalfW * 0.35,
      shoulderY - 12
    );
    ctx.closePath();

    const topGrad = ctx.createLinearGradient(
      -shoulderHalfW,
      shoulderY,
      shoulderHalfW,
      torsoBottom
    );
    topGrad.addColorStop(0, this.adjustColor(topColor, 24));
    topGrad.addColorStop(0.45, topColor);
    topGrad.addColorStop(1, this.adjustColor(topColor, -34));
    ctx.fillStyle = topGrad;
    ctx.fill();

    // 3D rim light on left shoulder edge
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.stroke();

    // Collar / inner shirt / accent details so accentColor is clearly visible
    ctx.clip();

    // Inner neckline skin V
    ctx.fillStyle = this.adjustColor(skinColor, -8);
    ctx.beginPath();
    ctx.moveTo(-22, shoulderY - 14);
    ctx.lineTo(0, shoulderY + 28);
    ctx.lineTo(22, shoulderY - 14);
    ctx.closePath();
    ctx.fill();

    // Inner shirt / accent vest or collar trim
    const accentGrad = ctx.createLinearGradient(0, shoulderY, 0, torsoBottom);
    accentGrad.addColorStop(0, this.adjustColor(accentColor, 18));
    accentGrad.addColorStop(1, this.adjustColor(accentColor, -22));
    ctx.fillStyle = accentGrad;

    if (genderStyle === 'masculine' || seed % 2 === 0) {
      // Smart jacket lapels + accent inner shirt / tie strip
      ctx.beginPath();
      ctx.moveTo(-26, shoulderY - 10);
      ctx.lineTo(-14, shoulderY + 185);
      ctx.lineTo(14, shoulderY + 185);
      ctx.lineTo(26, shoulderY - 10);
      ctx.closePath();
      ctx.fill();

      // Lapel folds in darker topColor
      ctx.fillStyle = this.adjustColor(topColor, -24);
      ctx.beginPath();
      ctx.moveTo(-24, shoulderY - 10);
      ctx.lineTo(-48, shoulderY + 42);
      ctx.lineTo(-28, shoulderY + 62);
      ctx.lineTo(-14, shoulderY + 115);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(24, shoulderY - 10);
      ctx.lineTo(48, shoulderY + 42);
      ctx.lineTo(28, shoulderY + 62);
      ctx.lineTo(14, shoulderY + 115);
      ctx.closePath();
      ctx.fill();
    } else {
      // Stylish blouse collar / ribbon / cardigan accent
      ctx.beginPath();
      ctx.moveTo(-36, shoulderY - 6);
      ctx.quadraticCurveTo(0, shoulderY + 48, 36, shoulderY - 6);
      ctx.lineTo(24, shoulderY + 170);
      ctx.lineTo(-24, shoulderY + 170);
      ctx.closePath();
      ctx.fill();

      // Pendant or collar ribbon
      ctx.fillStyle = this.adjustColor(accentColor, 40);
      ctx.beginPath();
      ctx.arc(0, shoulderY + 34, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Subtle sleeve seams for 3D avatar look
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.16)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-shoulderHalfW * 0.68, shoulderY + 18);
    ctx.quadraticCurveTo(
      -shoulderHalfW * 0.56,
      shoulderY + 95,
      -shoulderHalfW * 0.65,
      torsoBottom
    );
    ctx.moveTo(shoulderHalfW * 0.68, shoulderY + 18);
    ctx.quadraticCurveTo(
      shoulderHalfW * 0.56,
      shoulderY + 95,
      shoulderHalfW * 0.65,
      torsoBottom
    );
    ctx.stroke();

    ctx.restore();
  }

  private drawEars(
    ctx: CanvasRenderingContext2D,
    headRx: number,
    skinColor: string
  ): void {
    const earY = 8;
    for (const dir of [-1, 1]) {
      ctx.save();
      ctx.translate(dir * (headRx - 3), earY);
      ctx.fillStyle =
        dir === -1
          ? this.adjustColor(skinColor, 6)
          : this.adjustColor(skinColor, -16);
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 18, dir * 0.15, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = this.adjustColor(skinColor, -28);
      ctx.beginPath();
      ctx.ellipse(dir * 2, 1, 5, 9, dir * 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawHeadAndFace(
    ctx: CanvasRenderingContext2D,
    headRx: number,
    headRy: number,
    skinColor: string,
    hairColor: string,
    accentColor: string,
    genderStyle: 'feminine' | 'masculine' | 'neutral',
    isGlamourFilter: boolean
  ): void {
    ctx.save();

    // Smooth 3D head egg/oval contour
    ctx.beginPath();
    ctx.moveTo(0, -headRy);
    ctx.bezierCurveTo(
      headRx * 0.95,
      -headRy,
      headRx * 1.04,
      -headRy * 0.1,
      headRx * 0.92,
      headRy * 0.35
    );
    ctx.bezierCurveTo(
      headRx * 0.78,
      headRy * 0.78,
      headRx * 0.34,
      headRy,
      0,
      headRy
    );
    ctx.bezierCurveTo(
      -headRx * 0.34,
      headRy,
      -headRx * 0.78,
      headRy * 0.78,
      -headRx * 0.92,
      headRy * 0.35
    );
    ctx.bezierCurveTo(
      -headRx * 1.04,
      -headRy * 0.1,
      -headRx * 0.95,
      -headRy,
      0,
      -headRy
    );
    ctx.closePath();

    const faceGrad = ctx.createRadialGradient(
      -headRx * 0.28,
      -headRy * 0.25,
      10,
      0,
      0,
      headRy * 1.25
    );
    faceGrad.addColorStop(
      0,
      this.adjustColor(skinColor, isGlamourFilter ? 26 : 18)
    );
    faceGrad.addColorStop(0.6, skinColor);
    faceGrad.addColorStop(1, this.adjustColor(skinColor, -22));
    ctx.fillStyle = faceGrad;
    ctx.fill();

    // Subtle 3D jawline outline
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = this.adjustColor(skinColor, -34);
    ctx.stroke();

    // Cheek blush
    const blushAlpha = isGlamourFilter
      ? 0.42
      : genderStyle === 'feminine'
        ? 0.26
        : genderStyle === 'masculine'
          ? 0.07
          : 0.14;
    for (const dir of [-1, 1]) {
      const bx = dir * 34;
      const by = 18;
      const blushGrad = ctx.createRadialGradient(bx, by, 2, bx, by, 18);
      blushGrad.addColorStop(0, `rgba(255, 115, 135, ${blushAlpha})`);
      blushGrad.addColorStop(1, 'rgba(255, 115, 135, 0)');
      ctx.fillStyle = blushGrad;
      ctx.beginPath();
      ctx.arc(bx, by, 18, 0, Math.PI * 2);
      ctx.fill();
    }

    // Eyes
    const eyeX = 25;
    const eyeY = 2;
    const eyeRx = isGlamourFilter ? 13.5 : genderStyle === 'feminine' ? 12 : 10.5;
    const eyeRy = isGlamourFilter ? 14.5 : genderStyle === 'feminine' ? 12.5 : 10;

    for (const dir of [-1, 1]) {
      const ex = dir * eyeX;

      // Sclera
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, eyeRx, eyeRy, 0, 0, Math.PI * 2);
      ctx.fill();

      // Iris
      const irisColor = isGlamourFilter
        ? accentColor
        : this.adjustColor(hairColor, 15);
      const irisGrad = ctx.createLinearGradient(
        ex,
        eyeY - eyeRy,
        ex,
        eyeY + eyeRy
      );
      irisGrad.addColorStop(0, this.adjustColor(irisColor, -25));
      irisGrad.addColorStop(0.6, irisColor);
      irisGrad.addColorStop(1, this.adjustColor(irisColor, 35));
      ctx.fillStyle = irisGrad;
      ctx.beginPath();
      ctx.ellipse(ex, eyeY + 1, eyeRx * 0.72, eyeRy * 0.78, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pupil
      ctx.fillStyle = '#1b1622';
      ctx.beginPath();
      ctx.arc(ex, eyeY + 1, eyeRx * 0.36, 0, Math.PI * 2);
      ctx.fill();

      // Main specular catchlight
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex - 3.5, eyeY - 3.5, isGlamourFilter ? 4.2 : 3.2, 0, Math.PI * 2);
      ctx.fill();

      // Secondary bottom catchlight
      ctx.beginPath();
      ctx.arc(ex + 3.2, eyeY + 4.2, isGlamourFilter ? 2.4 : 1.7, 0, Math.PI * 2);
      ctx.fill();

      // Upper lash line
      ctx.strokeStyle = this.adjustColor(hairColor, -45);
      ctx.lineWidth = genderStyle === 'feminine' || isGlamourFilter ? 3.4 : 2.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(ex, eyeY + 2, eyeRx, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();

      // Eyebrow
      ctx.strokeStyle = this.adjustColor(hairColor, -20);
      ctx.lineWidth = genderStyle === 'masculine' ? 3.8 : 2.8;
      ctx.beginPath();
      ctx.moveTo(ex - dir * 12, eyeY - eyeRy - 6);
      ctx.quadraticCurveTo(
        ex,
        eyeY - eyeRy - 11,
        ex + dir * 13,
        eyeY - eyeRy - 5
      );
      ctx.stroke();
    }

    // 3D Nose highlight & shadow
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.ellipse(-1.5, 16, 2.2, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = this.adjustColor(skinColor, -38);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 12);
    ctx.lineTo(2.5, 22);
    ctx.lineTo(-2, 24);
    ctx.stroke();

    // Warm confident dating-app smile
    ctx.strokeStyle =
      genderStyle === 'feminine' || isGlamourFilter
        ? '#d14b66'
        : this.adjustColor(skinColor, -55);
    ctx.lineWidth = genderStyle === 'feminine' || isGlamourFilter ? 3.2 : 2.6;
    ctx.beginPath();
    ctx.arc(0, 31, 13, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();

    if (genderStyle === 'feminine' || isGlamourFilter) {
      // Subtle lower lip gloss highlight
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 34, 6, Math.PI * 0.25, Math.PI * 0.75);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawHairBack(
    ctx: CanvasRenderingContext2D,
    hairStyle: HairStyle,
    hairColor: string,
    headRx: number,
    headRy: number
  ): void {
    ctx.save();
    const backGrad = ctx.createLinearGradient(0, -headRy, 0, headRy + 120);
    backGrad.addColorStop(0, this.adjustColor(hairColor, 10));
    backGrad.addColorStop(0.5, hairColor);
    backGrad.addColorStop(1, this.adjustColor(hairColor, -35));
    ctx.fillStyle = backGrad;

    if (hairStyle === 'long') {
      ctx.beginPath();
      ctx.moveTo(-headRx * 1.05, -15);
      ctx.quadraticCurveTo(
        -headRx * 1.25,
        headRy + 65,
        -headRx * 0.85,
        headRy + 145
      );
      ctx.lineTo(headRx * 0.85, headRy + 145);
      ctx.quadraticCurveTo(
        headRx * 1.25,
        headRy + 65,
        headRx * 1.05,
        -15
      );
      ctx.closePath();
      ctx.fill();
    } else if (hairStyle === 'waves') {
      ctx.beginPath();
      ctx.moveTo(-headRx * 1.08, -15);
      ctx.bezierCurveTo(
        -headRx * 1.4,
        35,
        -headRx * 0.9,
        85,
        -headRx * 1.25,
        headRy + 130
      );
      ctx.lineTo(headRx * 1.25, headRy + 130);
      ctx.bezierCurveTo(
        headRx * 0.9,
        85,
        headRx * 1.4,
        35,
        headRx * 1.08,
        -15
      );
      ctx.closePath();
      ctx.fill();
    } else if (hairStyle === 'bob') {
      ctx.beginPath();
      ctx.ellipse(0, 14, headRx * 1.16, headRy * 0.95, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (hairStyle === 'ponytail') {
      // Side/high energetic ponytail visible behind head
      ctx.beginPath();
      ctx.moveTo(headRx * 0.55, -headRy * 0.65);
      ctx.bezierCurveTo(
        headRx * 1.55,
        -headRy * 0.85,
        headRx * 1.65,
        25,
        headRx * 1.15,
        headRy + 55
      );
      ctx.bezierCurveTo(
        headRx * 0.85,
        35,
        headRx * 0.75,
        -10,
        headRx * 0.45,
        -headRy * 0.35
      );
      ctx.closePath();
      ctx.fill();
    } else if (hairStyle === 'bun') {
      // High top bun with highlight
      const bunGrad = ctx.createRadialGradient(
        -8,
        -headRy - 24,
        4,
        0,
        -headRy - 18,
        32
      );
      bunGrad.addColorStop(0, this.adjustColor(hairColor, 28));
      bunGrad.addColorStop(0.6, hairColor);
      bunGrad.addColorStop(1, this.adjustColor(hairColor, -30));
      ctx.fillStyle = bunGrad;
      ctx.beginPath();
      ctx.arc(0, -headRy - 16, 29, 0, Math.PI * 2);
      ctx.fill();
    } else if (hairStyle === 'spiky') {
      // Outer spiky silhouette crown
      ctx.beginPath();
      const spikes = 9;
      for (let i = 0; i <= spikes; i++) {
        const angle = Math.PI * 0.95 + (Math.PI * 1.1 * i) / spikes;
        const r = i % 2 === 0 ? headRx * 1.32 : headRx * 1.04;
        const sx = Math.cos(angle) * r;
        const sy = Math.sin(angle) * r - 10;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  private drawHairFront(
    ctx: CanvasRenderingContext2D,
    hairStyle: HairStyle,
    hairColor: string,
    accentColor: string,
    headRx: number,
    headRy: number,
    genderStyle: 'feminine' | 'masculine' | 'neutral'
  ): void {
    ctx.save();

    const hairGrad = ctx.createLinearGradient(
      -headRx,
      -headRy - 15,
      headRx,
      headRy * 0.5
    );
    hairGrad.addColorStop(0, this.adjustColor(hairColor, 26));
    hairGrad.addColorStop(0.5, hairColor);
    hairGrad.addColorStop(1, this.adjustColor(hairColor, -28));
    ctx.fillStyle = hairGrad;

    // Crown cap base
    ctx.beginPath();
    ctx.arc(0, -8, headRx * 1.05, Math.PI * 0.96, Math.PI * 2.04);

    if (hairStyle === 'parted') {
      // Swept side-part bangs
      ctx.quadraticCurveTo(headRx * 0.7, -18, headRx * 0.98, 5);
      ctx.quadraticCurveTo(headRx * 0.25, -34, -headRx * 0.25, -45);
      ctx.quadraticCurveTo(-headRx * 0.65, -20, -headRx * 0.98, 8);
    } else if (hairStyle === 'spiky') {
      // Jagged energetic bangs
      ctx.lineTo(headRx * 0.95, 2);
      ctx.lineTo(headRx * 0.55, -28);
      ctx.lineTo(headRx * 0.25, -8);
      ctx.lineTo(0, -34);
      ctx.lineTo(-headRx * 0.28, -6);
      ctx.lineTo(-headRx * 0.62, -28);
      ctx.lineTo(-headRx * 0.98, 4);
    } else {
      // Layered bangs for short, bob, long, ponytail, bun, waves
      ctx.lineTo(headRx * 0.98, 6);
      ctx.quadraticCurveTo(headRx * 0.65, -18, headRx * 0.38, -14);
      ctx.quadraticCurveTo(headRx * 0.15, -30, 0, -14);
      ctx.quadraticCurveTo(-headRx * 0.2, -30, -headRx * 0.42, -15);
      ctx.quadraticCurveTo(-headRx * 0.72, -18, -headRx * 0.98, 6);
    }
    ctx.closePath();
    ctx.fill();

    // Side locks framing face (omit long hanging locks for masculine bun)
    const showSideLocks =
      hairStyle === 'bob' ||
      hairStyle === 'long' ||
      hairStyle === 'waves' ||
      hairStyle === 'ponytail' ||
      (hairStyle === 'bun' && genderStyle !== 'masculine');

    if (showSideLocks) {
      const lockLen =
        hairStyle === 'bob'
          ? headRy * 0.92
          : hairStyle === 'long' || hairStyle === 'waves'
            ? headRy * 1.35
            : headRy * 0.56;
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(dir * (headRx * 0.86), -25);
        ctx.quadraticCurveTo(
          dir * (headRx * 1.12),
          lockLen * 0.45,
          dir * (headRx * 0.76),
          lockLen
        );
        ctx.quadraticCurveTo(
          dir * (headRx * 0.66),
          lockLen * 0.4,
          dir * (headRx * 0.72),
          -15
        );
        ctx.closePath();
        ctx.fill();
      }
    }

    // Hair tie / band accent for bun only (subtler band on masculine bun; ponytail tie sits behind head so it doesn't clash with hats)
    if (hairStyle === 'bun') {
      ctx.strokeStyle =
        genderStyle === 'masculine' ? this.adjustColor(hairColor, -22) : accentColor;
      ctx.lineWidth = genderStyle === 'masculine' ? 4 : 5;
      ctx.beginPath();
      ctx.ellipse(0, -headRy + 3, 21, 5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Glossy 3D hair highlight arc
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, -6, headRx * 0.78, Math.PI * 1.18, Math.PI * 1.76);
    ctx.stroke();

    ctx.restore();
  }

  private drawGlasses(
    ctx: CanvasRenderingContext2D,
    headRx: number,
    accentColor: string
  ): void {
    ctx.save();
    const eyeX = 25;
    const eyeY = 2;
    const rx = 18;
    const ry = 14;

    // Subtle lens tint
    ctx.fillStyle = 'rgba(210, 235, 255, 0.18)';
    for (const dir of [-1, 1]) {
      this.roundRectPath(ctx, dir * eyeX - rx, eyeY - ry, rx * 2, ry * 2, 7);
      ctx.fill();
    }

    // Lens reflection streak
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 2.2;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(dir * eyeX - 9, eyeY - 8);
      ctx.lineTo(dir * eyeX - 1, eyeY + 6);
      ctx.stroke();
    }

    // Frames
    ctx.strokeStyle = '#241f2b';
    ctx.lineWidth = 3.2;
    for (const dir of [-1, 1]) {
      this.roundRectPath(ctx, dir * eyeX - rx, eyeY - ry, rx * 2, ry * 2, 7);
      ctx.stroke();
    }

    // Bridge & temples
    ctx.beginPath();
    ctx.moveTo(-eyeX + rx, eyeY - 2);
    ctx.quadraticCurveTo(0, eyeY - 6, eyeX - rx, eyeY - 2);
    ctx.moveTo(-eyeX - rx, eyeY - 3);
    ctx.lineTo(-headRx * 0.95, eyeY - 1);
    ctx.moveTo(eyeX + rx, eyeY - 3);
    ctx.lineTo(headRx * 0.95, eyeY - 1);
    ctx.stroke();

    // Accent corner rivets
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.arc(-eyeX - rx + 3, eyeY - ry + 4, 2, 0, Math.PI * 2);
    ctx.arc(eyeX + rx - 3, eyeY - ry + 4, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawHat(
    ctx: CanvasRenderingContext2D,
    hat: 'beret' | 'cap',
    accentColor: string,
    topColor: string,
    headRx: number,
    headRy: number
  ): void {
    ctx.save();
    const hatColor = accentColor || topColor;

    if (hat === 'beret') {
      ctx.translate(4, -headRy + 12);
      ctx.rotate(0.11);

      const beretGrad = ctx.createRadialGradient(-18, -16, 8, 0, 0, headRx * 1.25);
      beretGrad.addColorStop(0, this.adjustColor(hatColor, 32));
      beretGrad.addColorStop(0.65, hatColor);
      beretGrad.addColorStop(1, this.adjustColor(hatColor, -34));
      ctx.fillStyle = beretGrad;

      ctx.beginPath();
      ctx.ellipse(0, -6, headRx * 1.12, 30, 0, 0, Math.PI * 2);
      ctx.fill();

      // Beret stem
      ctx.strokeStyle = this.adjustColor(hatColor, -30);
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -34);
      ctx.lineTo(5, -43);
      ctx.stroke();

      // Headband rim
      ctx.fillStyle = this.adjustColor(hatColor, -42);
      this.roundRectPath(ctx, -headRx * 0.86, 8, headRx * 1.72, 10, 4);
      ctx.fill();
    } else if (hat === 'cap') {
      // Sporty cap crown
      const capGrad = ctx.createLinearGradient(
        -headRx,
        -headRy - 20,
        headRx,
        -headRy + 30
      );
      capGrad.addColorStop(0, this.adjustColor(hatColor, 26));
      capGrad.addColorStop(0.6, hatColor);
      capGrad.addColorStop(1, this.adjustColor(hatColor, -32));
      ctx.fillStyle = capGrad;

      ctx.beginPath();
      ctx.arc(0, -headRy + 26, headRx * 1.03, Math.PI, Math.PI * 2);
      ctx.closePath();
      ctx.fill();

      // Curved visor bill
      ctx.fillStyle = this.adjustColor(hatColor, -22);
      ctx.beginPath();
      ctx.moveTo(-headRx * 1.04, -headRy + 25);
      ctx.quadraticCurveTo(
        0,
        -headRy + 6,
        headRx * 1.16,
        -headRy + 30
      );
      ctx.quadraticCurveTo(
        0,
        -headRy + 22,
        -headRx * 1.04,
        -headRy + 25
      );
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  private drawInitialPropWithHand(
    ctx: CanvasRenderingContext2D,
    prop: InitialPropType,
    skinColor: string,
    accentColor: string,
    topColor: string
  ): void {
    ctx.save();
    // Foreground position slightly inward on right side of character bust so narrow cards never crop props
    const px = 86;
    const py = 165;
    ctx.translate(px, py);

    // Subtle soft glow behind held prop so player spots it immediately
    const propGlow = ctx.createRadialGradient(0, 0, 6, 0, 0, 64);
    propGlow.addColorStop(0, 'rgba(255, 255, 255, 0.38)');
    propGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = propGlow;
    ctx.beginPath();
    ctx.arc(0, 0, 64, 0, Math.PI * 2);
    ctx.fill();

    switch (prop) {
      case 'coffee': {
        // Takeaway coffee cup
        ctx.fillStyle = '#f8f5f0';
        ctx.beginPath();
        ctx.moveTo(-20, -24);
        ctx.lineTo(20, -24);
        ctx.lineTo(15, 28);
        ctx.lineTo(-15, 28);
        ctx.closePath();
        ctx.fill();

        // Kraft sleeve
        ctx.fillStyle = '#c68b59';
        ctx.beginPath();
        ctx.moveTo(-18, -8);
        ctx.lineTo(18, -8);
        ctx.lineTo(16, 14);
        ctx.lineTo(-16, 14);
        ctx.closePath();
        ctx.fill();

        // Cafe emblem
        ctx.fillStyle = '#2e6f40';
        ctx.beginPath();
        ctx.arc(0, 3, 6, 0, Math.PI * 2);
        ctx.fill();

        // Lid
        ctx.fillStyle = '#ffffff';
        this.roundRectPath(ctx, -23, -31, 46, 8, 4);
        ctx.fill();

        // Warm steam
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(-6, -36);
        ctx.quadraticCurveTo(-12, -46, -4, -55);
        ctx.moveTo(6, -36);
        ctx.quadraticCurveTo(12, -46, 4, -55);
        ctx.stroke();
        break;
      }

      case 'book': {
        // Hardcover book with bookmark
        ctx.rotate(-0.12);
        ctx.fillStyle = accentColor;
        this.roundRectPath(ctx, -26, -32, 52, 64, 6);
        ctx.fill();

        // Cream page block
        ctx.fillStyle = '#fff9eb';
        this.roundRectPath(ctx, -20, -28, 42, 56, 4);
        ctx.fill();

        // Front cover
        ctx.fillStyle = this.adjustColor(accentColor, -15);
        this.roundRectPath(ctx, -24, -28, 38, 56, 4);
        ctx.fill();

        // Gold title emblem
        ctx.strokeStyle = '#ffd875';
        ctx.lineWidth = 2;
        this.roundRectPath(ctx, -17, -18, 24, 34, 3);
        ctx.stroke();
        break;
      }

      case 'phone': {
        // Smartphone held at angle
        ctx.rotate(-0.15);
        ctx.fillStyle = '#1c1e26';
        this.roundRectPath(ctx, -18, -34, 36, 68, 8);
        ctx.fill();

        const screenGrad = ctx.createLinearGradient(-15, -28, 15, 28);
        screenGrad.addColorStop(0, '#ff7eb3');
        screenGrad.addColorStop(1, '#7afcff');
        ctx.fillStyle = screenGrad;
        this.roundRectPath(ctx, -15, -28, 30, 56, 5);
        ctx.fill();

        // Heart icon on screen
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, -2, 7, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'camera': {
        // Retro SLR camera
        ctx.fillStyle = '#2b2d38';
        this.roundRectPath(ctx, -30, -18, 60, 40, 7);
        ctx.fill();

        // Silver top plate
        ctx.fillStyle = '#d8dde6';
        this.roundRectPath(ctx, -30, -22, 60, 11, 4);
        ctx.fill();

        // Lens barrel
        ctx.fillStyle = '#14161d';
        ctx.beginPath();
        ctx.arc(2, 3, 17, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#e2e6ef';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Lens glass reflection
        ctx.fillStyle = '#4ea8de';
        ctx.beginPath();
        ctx.arc(-2, -1, 7, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'bag': {
        // Structured handbag
        ctx.strokeStyle = this.adjustColor(accentColor, -25);
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.arc(0, -18, 16, Math.PI, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = accentColor;
        this.roundRectPath(ctx, -28, -18, 56, 44, 8);
        ctx.fill();

        // Flap & gold clasp
        ctx.fillStyle = this.adjustColor(accentColor, 15);
        this.roundRectPath(ctx, -28, -18, 56, 20, 8);
        ctx.fill();

        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.arc(0, 2, 5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'bouquet': {
        // Wrapped flower bouquet
        ctx.fillStyle = '#f9dcc4';
        ctx.beginPath();
        ctx.moveTo(0, 34);
        ctx.lineTo(-28, -12);
        ctx.lineTo(28, -12);
        ctx.closePath();
        ctx.fill();

        // Ribbon bow
        ctx.fillStyle = '#e63946';
        ctx.beginPath();
        ctx.arc(0, 12, 7, 0, Math.PI * 2);
        ctx.fill();

        // Colorful blossoms
        const blooms = [
          { x: -14, y: -16, c: '#ff5d8f' },
          { x: 0, y: -22, c: '#ffb703' },
          { x: 14, y: -16, c: '#ff758f' },
          { x: -7, y: -8, c: '#ffd166' },
          { x: 8, y: -8, c: '#ff4d6d' },
        ];
        for (const b of blooms) {
          ctx.fillStyle = b.c;
          ctx.beginPath();
          ctx.arc(b.x, b.y, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fff3b0';
          ctx.beginPath();
          ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 'map': {
        // Unfolded street/cafe map
        ctx.fillStyle = '#fff8e7';
        this.roundRectPath(ctx, -28, -24, 56, 46, 4);
        ctx.fill();

        // Map grid & route
        ctx.strokeStyle = '#90be6d';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-20, 12);
        ctx.lineTo(-4, -8);
        ctx.lineTo(18, 4);
        ctx.stroke();

        // Red destination pin
        ctx.fillStyle = '#e63946';
        ctx.beginPath();
        ctx.arc(14, -4, 7, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'umbrella': {
        // Folded stylish umbrella
        ctx.rotate(0.18);
        ctx.strokeStyle = '#8d5524';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, -34);
        ctx.lineTo(0, 28);
        ctx.arc(-8, 28, 8, 0, Math.PI);
        ctx.stroke();

        ctx.fillStyle = accentColor;
        ctx.beginPath();
        ctx.moveTo(0, -36);
        ctx.lineTo(-14, 14);
        ctx.lineTo(14, 14);
        ctx.closePath();
        ctx.fill();
        break;
      }

      case 'briefcase': {
        // Business briefcase
        ctx.strokeStyle = '#3d2b1f';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, -20, 12, Math.PI, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#5c3d2e';
        this.roundRectPath(ctx, -30, -18, 60, 42, 6);
        ctx.fill();

        // Brass latches
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(-16, -4, 7, 10);
        ctx.fillRect(9, -4, 7, 10);
        break;
      }

      case 'cake_box': {
        // Patisserie cake box with ribbon
        ctx.fillStyle = '#fff5f7';
        this.roundRectPath(ctx, -26, -16, 52, 40, 5);
        ctx.fill();

        ctx.fillStyle = '#ff6b8b';
        ctx.fillRect(-26, 0, 52, 8);
        ctx.fillRect(-4, -16, 8, 40);

        // Top ribbon bow
        ctx.beginPath();
        ctx.ellipse(-9, -20, 9, 5, -0.3, 0, Math.PI * 2);
        ctx.ellipse(9, -20, 9, 5, 0.3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'soccer_ball': {
        // Classic soccer ball
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 25, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#222222';
        ctx.stroke();

        // Center & edge pentagons
        ctx.fillStyle = '#1d1e24';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.arc(-16, -10, 5, 0, Math.PI * 2);
        ctx.arc(16, -10, 5, 0, Math.PI * 2);
        ctx.arc(0, 18, 5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'art_frame': {
        // Ornate gold art frame
        ctx.fillStyle = '#d4af37';
        this.roundRectPath(ctx, -28, -32, 56, 64, 5);
        ctx.fill();

        const artGrad = ctx.createLinearGradient(-20, -24, 20, 24);
        artGrad.addColorStop(0, '#7209b7');
        artGrad.addColorStop(0.5, '#f72585');
        artGrad.addColorStop(1, '#4cc9f0');
        ctx.fillStyle = artGrad;
        ctx.fillRect(-21, -25, 42, 50);
        break;
      }

      case 'watch': {
        // Raised wrist with gleaming luxury watch
        ctx.fillStyle = skinColor;
        this.roundRectPath(ctx, -14, -28, 28, 56, 12);
        ctx.fill();

        // Watch strap
        ctx.fillStyle = '#b8860b';
        ctx.fillRect(-16, -8, 32, 16);

        // Watch dial
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#14213d';
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();

        // Watch hands + sparkle
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -8);
        ctx.moveTo(0, 0);
        ctx.lineTo(6, 2);
        ctx.stroke();
        this.drawSparkleStar(ctx, 14, -14, 9, '#fff9c4');
        break;
      }

      case 'jewelry_box': {
        // Open velvet jewelry box with sparkling gem
        ctx.fillStyle = '#590d22';
        this.roundRectPath(ctx, -24, -6, 48, 28, 6);
        ctx.fill();

        ctx.fillStyle = '#800f2f';
        this.roundRectPath(ctx, -22, -26, 44, 20, 6);
        ctx.fill();

        // Sparkling diamond/gem
        ctx.fillStyle = '#48cae4';
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.lineTo(11, -3);
        ctx.lineTo(0, 8);
        ctx.lineTo(-11, -3);
        ctx.closePath();
        ctx.fill();
        this.drawSparkleStar(ctx, 0, -14, 12, '#ffffff');
        break;
      }
    }

    // 3D Hand holding the prop at the bottom edge
    ctx.fillStyle = skinColor;
    ctx.strokeStyle = this.adjustColor(skinColor, -32);
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(-6, 24, 16, 12, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Sleeve cuff beneath hand
    ctx.fillStyle = topColor;
    this.roundRectPath(ctx, -22, 32, 32, 22, 6);
    ctx.fill();

    ctx.restore();
  }

  private drawGlamourForegroundFX(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    label?: string
  ): void {
    ctx.save();

    // Diagonal glamour lens flare
    const flare = ctx.createLinearGradient(0, 0, w, h * 0.65);
    flare.addColorStop(0, 'rgba(255, 255, 255, 0.34)');
    flare.addColorStop(0.3, 'rgba(255, 190, 230, 0.16)');
    flare.addColorStop(0.6, 'rgba(255, 235, 160, 0.12)');
    flare.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = flare;
    ctx.fillRect(0, 0, w, h);

    // Over-the-top anime sparkles around face
    const stars = [
      { x: 96, y: 150, s: 22, c: '#fff6b3' },
      { x: 378, y: 135, s: 26, c: '#ffffff' },
      { x: 115, y: 270, s: 16, c: '#ffc4eb' },
      { x: 365, y: 245, s: 20, c: '#fff6b3' },
      { x: 70, y: 205, s: 14, c: '#ffffff' },
      { x: 405, y: 195, s: 15, c: '#ffc4eb' },
      { x: 160, y: 105, s: 18, c: '#ffffff' },
      { x: 318, y: 102, s: 17, c: '#fff6b3' },
    ];
    for (const st of stars) {
      this.drawSparkleStar(ctx, st.x, st.y, st.s, st.c);
    }

    // Subtle beauty filter watermark pill in top-left only if decoyLabel is set
    if (label) {
      ctx.font = '700 13px "Noto Sans JP", sans-serif';
      const textW = ctx.measureText(label).width;
      const pillW = textW + 24;
      ctx.fillStyle = 'rgba(255, 105, 180, 0.28)';
      this.roundRectPath(ctx, 16, 16, pillW, 26, 13);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 28, 29);
    }

    ctx.restore();
  }

  private drawPhotoOverlays(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    character: CharacterProfile
  ): void {
    ctx.save();

    // Top subtle gradient scrim
    const topScrim = ctx.createLinearGradient(0, 0, 0, 76);
    topScrim.addColorStop(0, 'rgba(10, 12, 18, 0.34)');
    topScrim.addColorStop(1, 'rgba(10, 12, 18, 0)');
    ctx.fillStyle = topScrim;
    ctx.fillRect(0, 0, w, 76);

    // Bottom gradient scrim for card readability
    const bottomScrim = ctx.createLinearGradient(0, h - 165, 0, h);
    bottomScrim.addColorStop(0, 'rgba(12, 14, 22, 0)');
    bottomScrim.addColorStop(0.55, 'rgba(12, 14, 22, 0.38)');
    bottomScrim.addColorStop(1, 'rgba(12, 14, 22, 0.76)');
    ctx.fillStyle = bottomScrim;
    ctx.fillRect(0, h - 165, w, 165);

    // Top-center theme location pill (stays safely inside crop on both landscape & portrait mobile)
    const themeLabel = THEME_BADGE_LABELS[character.photoTheme];
    ctx.font = '700 13px "Noto Sans JP", sans-serif';
    const tw = ctx.measureText(themeLabel).width + 22;
    const tx = Math.round((w - tw) / 2);
    const ty = 14;

    ctx.fillStyle = 'rgba(18, 20, 28, 0.56)';
    this.roundRectPath(ctx, tx, ty, tw, 26, 13);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(themeLabel, tx + 11, ty + 13);

    ctx.restore();
  }

  private drawSparkleStar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    color: string
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.quadraticCurveTo(size * 0.18, -size * 0.18, size, 0);
    ctx.quadraticCurveTo(size * 0.18, size * 0.18, 0, size);
    ctx.quadraticCurveTo(-size * 0.18, size * 0.18, -size, 0);
    ctx.quadraticCurveTo(-size * 0.18, -size * 0.18, 0, -size);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private roundRectPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  private adjustColor(hex: string, amount: number): string {
    const clean = hex.replace('#', '').trim();
    const full =
      clean.length === 3
        ? clean
            .split('')
            .map((c) => c + c)
            .join('')
        : clean.padEnd(6, '0').slice(0, 6);
    const num = parseInt(full, 16);
    if (Number.isNaN(num)) return hex;
    const r = Math.max(0, Math.min(255, ((num >> 16) & 0xff) + amount));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount));
    const b = Math.max(0, Math.min(255, (num & 0xff) + amount));
    return `rgb(${r}, ${g}, ${b})`;
  }

  private hashString(str: string): number {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
  }
}

export const portraitStudio = new PortraitStudio();
