import * as THREE from 'three';
import {
  CharacterProfile,
  HairStyle,
  InitialPropType,
  RevealPropType,
  VisualAppearance,
} from '../types';

export interface AvatarRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  initialPropGroup: THREE.Group;
  revealPropGroup: THREE.Group;
  companionGroup: THREE.Group;
  matchRing?: THREE.Mesh;
}

// Cache procedural label textures by key to keep 60fps and avoid re-generating canvas textures
const labelTextureCache = new Map<string, THREE.CanvasTexture>();

function createLabelTexture(
  key: string,
  bgColor: string,
  borderColor: string,
  mainText: string,
  subText: string,
  textColor = '#ffffff'
): THREE.CanvasTexture {
  const cached = labelTextureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 12;
    ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 44px "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif';
    ctx.fillText(mainText, canvas.width / 2, subText ? 62 : 80);

    if (subText) {
      ctx.font = '800 28px "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif';
      ctx.fillText(subText, canvas.width / 2, 114);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  labelTextureCache.set(key, texture);
  return texture;
}

function createQRTexture(): THREE.CanvasTexture {
  const key = '__qr_board__';
  const cached = labelTextureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 192;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 192, 192);
    ctx.strokeStyle = '#ff2a85';
    ctx.lineWidth = 10;
    ctx.strokeRect(6, 6, 180, 180);

    ctx.fillStyle = '#141424';
    const cell = 16;
    // Finder patterns
    const drawFinder = (ox: number, oy: number) => {
      ctx.fillRect(ox, oy, cell * 3, cell * 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ox + cell * 0.5, oy + cell * 0.5, cell * 2, cell * 2);
      ctx.fillStyle = '#141424';
      ctx.fillRect(ox + cell, oy + cell, cell, cell);
    };
    drawFinder(24, 24);
    drawFinder(120, 24);
    drawFinder(24, 120);

    // Deterministic data dots
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if ((r < 3 && c < 3) || (r < 3 && c > 4) || (r > 4 && c < 3)) continue;
        if ((r * 7 + c * 13) % 3 !== 0) {
          ctx.fillRect(24 + c * 18, 24 + r * 18, 13, 13);
        }
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  labelTextureCache.set(key, tex);
  return tex;
}

function makeToonMaterial(
  color: string | number,
  roughness = 0.55,
  metalness = 0.08,
  emissive?: string | number,
  emissiveIntensity = 0
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
  });
  if (emissive !== undefined) {
    mat.emissive = new THREE.Color(emissive);
    mat.emissiveIntensity = emissiveIntensity;
  }
  return mat;
}

function buildHairMesh(style: HairStyle, hairColor: string): THREE.Group {
  const group = new THREE.Group();
  const mat = makeToonMaterial(hairColor, 0.48, 0.05);

  // Base skull cap
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.245, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
    mat
  );
  cap.position.y = 0.02;
  group.add(cap);

  switch (style) {
    case 'short': {
      const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.11, 0.14), mat);
      fringe.position.set(0, 0.14, 0.17);
      fringe.rotation.x = 0.2;
      group.add(fringe);
      break;
    }
    case 'bob': {
      const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.34, 0.34), mat);
      sideL.position.set(-0.21, -0.02, 0.0);
      sideL.rotation.z = 0.1;
      const sideR = sideL.clone();
      sideR.position.x = 0.21;
      sideR.rotation.z = -0.1;
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.32, 0.14), mat);
      back.position.set(0, -0.02, -0.17);
      const bangs = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.12), mat);
      bangs.position.set(0, 0.14, 0.18);
      group.add(sideL, sideR, back, bangs);
      break;
    }
    case 'long': {
      const backLong = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.64, 0.16), mat);
      backLong.position.set(0, -0.2, -0.17);
      const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.52, 0.24), mat);
      sideL.position.set(-0.22, -0.12, 0.02);
      const sideR = sideL.clone();
      sideR.position.x = 0.22;
      const bangs = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.11, 0.12), mat);
      bangs.position.set(0, 0.14, 0.18);
      group.add(backLong, sideL, sideR, bangs);
      break;
    }
    case 'ponytail': {
      const tieMat = makeToonMaterial('#ff5d8f', 0.4, 0.1);
      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.025, 8, 16), tieMat);
      tie.position.set(0.17, 0.08, -0.2);
      tie.rotation.y = 0.45;
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.42, 10), mat);
      tail.position.set(0.27, -0.05, -0.24);
      tail.rotation.set(-2.25, 0.35, -0.52);
      const bangs = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.11, 0.12), mat);
      bangs.position.set(0, 0.14, 0.18);
      group.add(tie, tail, bangs);
      break;
    }
    case 'parted': {
      const partL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.13, 0.16), mat);
      partL.position.set(-0.1, 0.15, 0.16);
      partL.rotation.z = 0.25;
      const partR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.13, 0.16), mat);
      partR.position.set(0.12, 0.14, 0.16);
      partR.rotation.z = -0.22;
      group.add(partL, partR);
      break;
    }
    case 'bun': {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), mat);
      bun.position.set(0, 0.29, -0.08);
      const bangs = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.11), mat);
      bangs.position.set(0, 0.14, 0.18);
      group.add(bun, bangs);
      break;
    }
    case 'spiky': {
      for (let i = -2; i <= 2; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.22, 6), mat);
        spike.position.set(i * 0.08, 0.25, 0.04 - Math.abs(i) * 0.03);
        spike.rotation.z = -i * 0.28;
        spike.rotation.x = 0.22;
        group.add(spike);
      }
      break;
    }
    case 'waves': {
      const backWave = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.54, 0.18), mat);
      backWave.position.set(0, -0.14, -0.16);
      const curlL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.46, 10), mat);
      curlL.position.set(-0.22, -0.1, 0.05);
      const curlR = curlL.clone();
      curlR.position.x = 0.22;
      group.add(backWave, curlL, curlR);
      break;
    }
  }

  return group;
}

function buildHatMesh(hat: 'beret' | 'cap' | 'none' | undefined, accentColor: string): THREE.Group | null {
  if (!hat || hat === 'none') return null;
  const group = new THREE.Group();
  const mat = makeToonMaterial(accentColor, 0.45, 0.1);

  if (hat === 'beret') {
    const beret = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.1, 16), mat);
    beret.position.set(0.04, 0.24, 0);
    beret.rotation.z = -0.18;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.05, 6), mat);
    stem.position.set(0.06, 0.3, 0);
    group.add(beret, stem);
  } else if (hat === 'cap') {
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.255, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
      mat
    );
    dome.position.y = 0.08;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.035, 0.22), mat);
    visor.position.set(0, 0.14, 0.25);
    visor.rotation.x = 0.15;
    group.add(dome, visor);
  }
  return group;
}

function buildGlassesMesh(): THREE.Group {
  const group = new THREE.Group();
  const frameMat = makeToonMaterial('#1e2230', 0.25, 0.6);
  const lensMat = new THREE.MeshStandardMaterial({
    color: '#a8e6ff',
    roughness: 0.15,
    metalness: 0.3,
    transparent: true,
    opacity: 0.55,
  });

  const rimL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.025), frameMat);
  rimL.position.set(-0.09, 0.03, 0.23);
  const rimR = rimL.clone();
  rimR.position.x = 0.09;

  const lensL = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.065), lensMat);
  lensL.position.set(-0.09, 0.03, 0.245);
  const lensR = lensL.clone();
  lensR.position.x = 0.09;

  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.02), frameMat);
  bridge.position.set(0, 0.04, 0.23);

  group.add(rimL, rimR, lensL, lensR, bridge);
  return group;
}

function buildInitialProp(propType: InitialPropType, accentColor: string): THREE.Group {
  const group = new THREE.Group();
  // Position relative to character body front-right hand area so it is clearly visible from camera
  group.position.set(0.38, 0.96, 0.32);

  switch (propType) {
    case 'coffee': {
      const cup = new THREE.Mesh(
        new THREE.CylinderGeometry(0.085, 0.065, 0.22, 12),
        makeToonMaterial('#fff8f0', 0.4)
      );
      const sleeve = new THREE.Mesh(
        new THREE.CylinderGeometry(0.088, 0.074, 0.1, 12),
        makeToonMaterial('#c68b59', 0.6)
      );
      const lid = new THREE.Mesh(
        new THREE.CylinderGeometry(0.092, 0.09, 0.035, 12),
        makeToonMaterial('#2b2d38', 0.3)
      );
      lid.position.y = 0.12;
      group.add(cup, sleeve, lid);
      break;
    }
    case 'book': {
      const cover = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.3, 0.06),
        makeToonMaterial(accentColor || '#3a6ea5', 0.45)
      );
      const pages = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.28, 0.045),
        makeToonMaterial('#fffdf6', 0.6)
      );
      pages.position.x = 0.015;
      group.add(cover, pages);
      break;
    }
    case 'phone': {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.25, 0.025),
        makeToonMaterial('#1c1f2b', 0.2, 0.5)
      );
      const screen = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.22, 0.03),
        makeToonMaterial('#6bf2ff', 0.2, 0.1, '#48d8ff', 0.7)
      );
      body.rotation.x = -0.35;
      screen.rotation.x = -0.35;
      group.add(body, screen);
      break;
    }
    case 'camera': {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.18, 0.14),
        makeToonMaterial('#252834', 0.35, 0.4)
      );
      const lens = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.075, 0.12, 14),
        makeToonMaterial('#10141f', 0.15, 0.7, '#3ab5ff', 0.25)
      );
      lens.rotation.x = Math.PI / 2;
      lens.position.z = 0.1;
      const flash = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.05, 0.06),
        makeToonMaterial('#fff5cc', 0.2, 0.2, '#ffe066', 0.5)
      );
      flash.position.set(0, 0.11, 0.02);
      group.add(body, lens, flash);
      break;
    }
    case 'bag': {
      const bag = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.34, 0.14),
        makeToonMaterial(accentColor || '#ff6b9d', 0.45)
      );
      bag.position.y = -0.14;
      const handle = new THREE.Mesh(
        new THREE.TorusGeometry(0.07, 0.015, 8, 16, Math.PI),
        makeToonMaterial('#ffffff', 0.4)
      );
      handle.position.y = 0.04;
      group.add(bag, handle);
      break;
    }
    case 'bouquet': {
      const wrap = new THREE.Mesh(
        new THREE.ConeGeometry(0.16, 0.34, 10),
        makeToonMaterial('#ffe6ef', 0.45)
      );
      wrap.rotation.x = Math.PI;
      wrap.position.y = -0.04;
      group.add(wrap);
      const colors = ['#ff3b77', '#ffbe3b', '#ff75b5', '#fff066'];
      for (let i = 0; i < 4; i++) {
        const flower = new THREE.Mesh(
          new THREE.SphereGeometry(0.075, 10, 10),
          makeToonMaterial(colors[i % colors.length], 0.35)
        );
        const angle = (i / 4) * Math.PI * 2;
        flower.position.set(Math.cos(angle) * 0.07, 0.14, Math.sin(angle) * 0.07);
        group.add(flower);
      }
      break;
    }
    case 'map': {
      const panelL = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.26, 0.02),
        makeToonMaterial('#fff8d6', 0.5)
      );
      panelL.position.x = -0.07;
      panelL.rotation.y = 0.25;
      const panelR = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.26, 0.02),
        makeToonMaterial('#a7e8bd', 0.5)
      );
      panelR.position.x = 0.07;
      panelR.rotation.y = -0.25;
      group.add(panelL, panelR);
      break;
    }
    case 'umbrella': {
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.015, 0.58, 10),
        makeToonMaterial(accentColor || '#3898ff', 0.4)
      );
      shaft.position.y = -0.14;
      const handle = new THREE.Mesh(
        new THREE.TorusGeometry(0.045, 0.014, 8, 12, Math.PI),
        makeToonMaterial('#3d2616', 0.5)
      );
      handle.position.set(0.04, 0.16, 0);
      group.add(shaft, handle);
      break;
    }
    case 'briefcase': {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.25, 0.1),
        makeToonMaterial('#3c2d24', 0.4, 0.25)
      );
      box.position.y = -0.12;
      const clasp = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.04, 0.115),
        makeToonMaterial('#ffd166', 0.2, 0.8)
      );
      clasp.position.y = 0.01;
      group.add(box, clasp);
      break;
    }
    case 'cake_box': {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.22, 0.26),
        makeToonMaterial('#fff5f8', 0.45)
      );
      const ribbonH = new THREE.Mesh(
        new THREE.BoxGeometry(0.29, 0.05, 0.27),
        makeToonMaterial('#ff477e', 0.35)
      );
      const ribbonV = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.23, 0.27),
        makeToonMaterial('#ff477e', 0.35)
      );
      group.add(box, ribbonH, ribbonV);
      break;
    }
    case 'soccer_ball': {
      const ball = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.15, 1),
        makeToonMaterial('#ffffff', 0.4)
      );
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.12, 0.03, 6, 12),
        makeToonMaterial('#1d202b', 0.4)
      );
      group.add(ball, band);
      break;
    }
    case 'art_frame': {
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.38, 0.04),
        makeToonMaterial('#e0a938', 0.3, 0.65)
      );
      const canvas = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.31, 0.05),
        makeToonMaterial('#7056ff', 0.4, 0.1, '#ff61c7', 0.3)
      );
      group.add(frame, canvas);
      break;
    }
    case 'watch': {
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.08, 0.025, 8, 16),
        makeToonMaterial('#ffd700', 0.2, 0.85, '#ffae00', 0.35)
      );
      const dial = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.075, 0.04, 14),
        makeToonMaterial('#fff9d6', 0.2, 0.7, '#ffd700', 0.45)
      );
      dial.rotation.x = Math.PI / 2;
      dial.position.z = 0.05;
      group.add(band, dial);
      break;
    }
    case 'jewelry_box': {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.16, 0.22),
        makeToonMaterial('#6d1a42', 0.35, 0.2)
      );
      const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.075, 0),
        makeToonMaterial('#5df2ff', 0.1, 0.3, '#5df2ff', 0.75)
      );
      gem.position.y = 0.11;
      group.add(box, gem);
      break;
    }
  }

  return group;
}

function createSignPanel(
  width: number,
  height: number,
  texture: THREE.CanvasTexture,
  frameColor: string
): THREE.Group {
  const g = new THREE.Group();
  const backing = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.08, height + 0.08, 0.06),
    makeToonMaterial(frameColor, 0.3, 0.3, frameColor, 0.25)
  );
  const faceMat = new THREE.MeshBasicMaterial({ map: texture });
  const front = new THREE.Mesh(new THREE.PlaneGeometry(width, height), faceMat);
  front.position.z = 0.036;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(width, height), faceMat);
  back.position.z = -0.036;
  back.rotation.y = Math.PI;
  g.add(backing, front, back);
  return g;
}

function buildRevealProp(propType: RevealPropType, appearance: VisualAppearance): THREE.Group {
  const group = new THREE.Group();
  group.visible = false;

  switch (propType) {
    case 'cafe_map_open': {
      const tex = createLabelTexture('cafe_map', '#fff8e7', '#2fb879', 'CAFE MAP', 'すぐ近く!', '#1b5e3c');
      const board = createSignPanel(0.82, 0.56, tex, '#2fb879');
      board.position.set(0.35, 1.32, 0.45);
      group.add(board);
      break;
    }
    case 'two_menus': {
      const texA = createLabelTexture('menu_a', '#ff7a59', '#ffffff', 'CAFE', 'MENU A', '#ffffff');
      const texB = createLabelTexture('menu_b', '#38b6ff', '#ffffff', 'BISTRO', 'MENU B', '#ffffff');
      const menuA = createSignPanel(0.46, 0.58, texA, '#ffffff');
      menuA.position.set(-0.34, 1.32, 0.42);
      menuA.rotation.z = 0.15;
      const menuB = createSignPanel(0.46, 0.58, texB, '#ffffff');
      menuB.position.set(0.34, 1.32, 0.42);
      menuB.rotation.z = -0.15;
      group.add(menuA, menuB);
      break;
    }
    case 'open_umbrella': {
      const dome = new THREE.Mesh(
        new THREE.ConeGeometry(0.88, 0.42, 12),
        makeToonMaterial(appearance.accentColor || '#ff6b9d', 0.35, 0.1, appearance.accentColor || '#ff6b9d', 0.18)
      );
      dome.position.set(0.15, 2.18, 0.12);
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 1.05, 8),
        makeToonMaterial('#e6e9f0', 0.3, 0.6)
      );
      shaft.position.set(0.15, 1.55, 0.12);
      group.add(dome, shaft);
      break;
    }
    case 'polite_gift': {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.42, 0.42),
        makeToonMaterial('#fff0f5', 0.35)
      );
      box.position.set(0, 1.18, 0.48);
      const ribbon = new THREE.Mesh(
        new THREE.BoxGeometry(0.48, 0.12, 0.44),
        makeToonMaterial('#ff3377', 0.3, 0.1, '#ff3377', 0.3)
      );
      ribbon.position.copy(box.position);
      const bow = new THREE.Mesh(
        new THREE.TorusKnotGeometry(0.12, 0.035, 32, 8),
        makeToonMaterial('#ff3377', 0.3, 0.1, '#ff3377', 0.35)
      );
      bow.position.set(0, 1.45, 0.48);
      group.add(box, ribbon, bow);
      break;
    }
    case 'catfish_board': {
      const label = appearance.photoDisguise?.decoyLabel || '別人!?';
      const tex = createLabelTexture(
        `catfish_${label}`,
        '#20142c',
        '#ff2e93',
        label,
        '写真と違う!!',
        '#ffeb3b'
      );
      const board = createSignPanel(1.05, 0.72, tex, '#ff2e93');
      board.position.set(0, 1.55, 0.52);
      group.add(board);
      break;
    }
    case 'fake_id_fan': {
      const colors = ['#ff4d6d', '#ffb703', '#7209b7'];
      for (let i = -1; i <= 1; i++) {
        const tex = createLabelTexture(`fake_id_${i}`, colors[i + 1], '#ffffff', 'PRO-FILE', '設定崩壊!?', '#ffffff');
        const card = createSignPanel(0.52, 0.38, tex, '#ffffff');
        card.position.set(i * 0.36, 1.48 + (1 - Math.abs(i)) * 0.1, 0.48);
        card.rotation.z = -i * 0.32;
        group.add(card);
      }
      break;
    }
    case 'live_rec_rig': {
      const stick = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 1.0, 8),
        makeToonMaterial('#2b2d42', 0.3, 0.6)
      );
      stick.position.set(0.48, 1.5, 0.42);
      stick.rotation.z = -0.35;

      const ringLight = new THREE.Mesh(
        new THREE.TorusGeometry(0.24, 0.035, 10, 20),
        makeToonMaterial('#ffffff', 0.1, 0.1, '#ff1e42', 0.85)
      );
      ringLight.position.set(0.66, 1.96, 0.52);

      const tex = createLabelTexture('rec_live', '#d90429', '#ffffff', '● REC', '無断配信中!', '#ffffff');
      const badge = createSignPanel(0.75, 0.44, tex, '#ffccd5');
      badge.position.set(-0.28, 1.9, 0.45);
      group.add(stick, ringLight, badge);
      break;
    }
    case 'giant_speech_x': {
      const barMat = makeToonMaterial('#ff1744', 0.25, 0.1, '#ff1744', 0.55);
      const bar1 = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.18, 0.14), barMat);
      bar1.rotation.z = Math.PI / 4;
      const bar2 = bar1.clone();
      bar2.rotation.z = -Math.PI / 4;
      const xGroup = new THREE.Group();
      xGroup.add(bar1, bar2);
      xGroup.position.set(0, 1.72, 0.52);
      group.add(xGroup);
      break;
    }
    case 'beer_mug_push': {
      for (const side of [-0.32, 0.32]) {
        const mug = new THREE.Group();
        const glass = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.15, 0.38, 12),
          makeToonMaterial('#ffb703', 0.25, 0.1, '#ff9f1c', 0.3)
        );
        const foam = new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 10, 10),
          makeToonMaterial('#ffffff', 0.4)
        );
        foam.position.y = 0.2;
        mug.add(glass, foam);
        mug.position.set(side, 1.3, 0.52);
        group.add(mug);
      }
      break;
    }
    case 'schedule_board': {
      const tex = createLabelTexture('schedule_late', '#fff0f3', '#d90429', '大遅刻!!', '逆ギレ中', '#d90429');
      const board = createSignPanel(0.88, 0.56, tex, '#d90429');
      board.position.set(0, 1.62, 0.48);
      group.add(board);
      break;
    }
    case 'bill_invoice': {
      const tex = createLabelTexture('bill_invoice', '#fffdf0', '#e63946', '請求書', '全額おごって!', '#d90429');
      const scroll = createSignPanel(0.74, 0.92, tex, '#e63946');
      scroll.position.set(0.32, 1.38, 0.48);
      group.add(scroll);
      break;
    }
    case 'crypto_chart': {
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(1.15, 0.72, 0.06),
        makeToonMaterial('#0b132b', 0.3, 0.4, '#1c2541', 0.4)
      );
      board.position.set(0, 1.65, 0.46);
      group.add(board);

      const barColors = ['#00f5d4', '#00bbf9', '#fee440', '#f15bb5'];
      for (let i = 0; i < 4; i++) {
        const h = 0.2 + i * 0.14;
        const candle = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, h, 0.1),
          makeToonMaterial(barColors[i], 0.2, 0.2, barColors[i], 0.65)
        );
        candle.position.set(-0.34 + i * 0.23, 1.44 + h / 2, 0.52);
        group.add(candle);
      }
      break;
    }
    case 'contract_scrolls': {
      for (let i = -1; i <= 1; i++) {
        const tex = createLabelTexture(`contract_${i}`, '#ffe5ec', '#ff0a54', '高額契約書', '今すぐサイン!', '#a4133c');
        const scroll = createSignPanel(0.56, 0.82, tex, '#ff0a54');
        scroll.position.set(i * 0.48, 1.48 + (1 - Math.abs(i)) * 0.08, 0.48);
        scroll.rotation.z = -i * 0.28;
        group.add(scroll);
      }
      break;
    }
    case 'pyramid_cake': {
      const pyr = new THREE.Mesh(
        new THREE.ConeGeometry(0.56, 0.85, 4),
        makeToonMaterial('#ffd166', 0.2, 0.5, '#ff9f1c', 0.65)
      );
      pyr.position.set(0, 1.75, 0.48);
      pyr.rotation.y = Math.PI / 4;
      group.add(pyr);
      break;
    }
    case 'bar_neon_sign': {
      const tex = createLabelTexture('bar_neon', '#19002e', '#ff007f', 'BAR 勧誘', '料金表なし!!', '#00f5d4');
      const sign = createSignPanel(1.3, 0.72, tex, '#ff007f');
      sign.position.set(0, 1.56, 0.52);
      group.add(sign);
      break;
    }
    case 'art_price_tag': {
      const tex = createLabelTexture('art_price', '#fff8d6', '#d90429', '¥1,000,000', '特別ローン可!', '#d90429');
      const tag = createSignPanel(1.08, 0.64, tex, '#ffb703');
      tag.position.set(0, 1.62, 0.52);
      group.add(tag);
      break;
    }
    case 'wire_transfer_alert': {
      const tex = createLabelTexture('wire_alert', '#ff0a54', '#ffbe0b', '至急送金!!', '口座ロック解除', '#ffffff');
      const board = createSignPanel(1.06, 0.66, tex, '#ffbe0b');
      board.position.set(0, 1.66, 0.52);
      group.add(board);
      break;
    }
    case 'qr_board': {
      const qrTex = createQRTexture();
      const board = createSignPanel(0.84, 0.84, qrTex, '#ff007f');
      board.position.set(0, 1.58, 0.52);
      group.add(board);
      break;
    }
    case 'car_key_wave': {
      // Giant comical car key fob & flashing unlock waves
      const fob = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.62, 0.14),
        makeToonMaterial('#1f2233', 0.25, 0.5)
      );
      fob.position.set(0.32, 1.55, 0.45);
      fob.rotation.z = -0.25;
      const keyBlade = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.48, 0.05),
        makeToonMaterial('#dfe6f0', 0.18, 0.85)
      );
      keyBlade.position.set(0.44, 2.02, 0.45);
      keyBlade.rotation.z = -0.25;
      const btnRed = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.06, 12),
        makeToonMaterial('#ff3b5c', 0.2, 0.2, '#ff3b5c', 0.6)
      );
      btnRed.rotation.x = Math.PI / 2;
      btnRed.position.set(0.32, 1.62, 0.53);
      const tex = createLabelTexture('car_key', '#1f2233', '#ffae19', '車乗って!', '今すぐドライブ', '#ffda44');
      const board = createSignPanel(0.92, 0.48, tex, '#ffae19');
      board.position.set(-0.18, 2.15, 0.36);
      group.add(fob, keyBlade, btnRed, board);
      break;
    }
    case 'forced_arrow': {
      // Giant red 3D forced direction arrow sign blocking path
      const shaft = new THREE.Mesh(
        new THREE.BoxGeometry(0.95, 0.24, 0.1),
        makeToonMaterial('#ff2a55', 0.3, 0.15, '#ff2a55', 0.4)
      );
      shaft.position.set(-0.1, 1.72, 0.52);
      const head = new THREE.Mesh(
        new THREE.ConeGeometry(0.32, 0.48, 4),
        makeToonMaterial('#ff2a55', 0.3, 0.15, '#ff2a55', 0.45)
      );
      head.rotation.z = -Math.PI / 2;
      head.position.set(0.56, 1.72, 0.52);
      const tex = createLabelTexture('forced_arrow', '#ffe4ea', '#ff2a55', '強制案内!', 'こっちの店へ', '#c9184a');
      const board = createSignPanel(0.96, 0.48, tex, '#ff2a55');
      board.position.set(0.0, 2.22, 0.42);
      group.add(shaft, head, board);
      break;
    }
    case 'sidejob_banner': {
      // Wide flashy "月収UP! 副業講座" glowing banner
      const tex = createLabelTexture('sidejob_banner', '#fff6c9', '#ff007f', '月収UP講座!', 'スマホで簡単副業', '#b8005a');
      const board = createSignPanel(1.38, 0.72, tex, '#ff007f');
      board.position.set(0, 1.74, 0.52);
      const poleL = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 1.5, 8),
        makeToonMaterial('#ffd700', 0.2, 0.7)
      );
      poleL.position.set(-0.62, 1.28, 0.5);
      const poleR = poleL.clone();
      poleR.position.x = 0.62;
      group.add(board, poleL, poleR);
      break;
    }
    case 'catalog_burst': {
      // Fan of 5 glossy luxury product catalogs bursting outward
      const colors = ['#ff4778', '#ffd166', '#4cc9f0', '#9d4edd', '#2ce69b'];
      for (let i = -2; i <= 2; i++) {
        const tex = createLabelTexture(
          `cat_${i}`,
          '#ffffff',
          colors[i + 2],
          i === 0 ? '高級商材' : '購入枠',
          i === 0 ? '今だけ50万' : 'CATALOG',
          '#1e1b2e'
        );
        const card = createSignPanel(0.46, 0.62, tex, colors[i + 2]);
        card.position.set(i * 0.24, 1.58 + (2 - Math.abs(i)) * 0.1, 0.5 + Math.abs(i) * 0.04);
        card.rotation.z = -i * 0.26;
        group.add(card);
      }
      break;
    }
    case 'none':
    default:
      break;
  }

  return group;
}

function buildMiniFigure(
  skinColor: string,
  hairColor: string,
  topColor: string,
  bottomColor: string,
  sunglasses = false
): THREE.Group {
  const fig = new THREE.Group();

  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.58, 0.28),
    makeToonMaterial(topColor, 0.5)
  );
  torso.position.y = 1.04;

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 14, 12),
    makeToonMaterial(skinColor, 0.45)
  );
  head.position.y = 1.56;

  const hair = buildHairMesh('short', hairColor);
  hair.position.y = 1.56;

  const legL = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.075, 0.68, 10),
    makeToonMaterial(bottomColor, 0.55)
  );
  legL.position.set(-0.13, 0.38, 0);
  const legR = legL.clone();
  legR.position.x = 0.13;

  const armL = new THREE.Mesh(
    new THREE.CylinderGeometry(0.068, 0.06, 0.5, 10),
    makeToonMaterial(topColor, 0.5)
  );
  armL.position.set(-0.32, 1.06, 0.08);
  armL.rotation.z = 0.35;
  const armR = armL.clone();
  armR.position.x = 0.32;
  armR.rotation.z = -0.35;

  fig.add(torso, head, hair, legL, legR, armL, armR);

  if (sunglasses) {
    const shades = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.08, 0.05),
      makeToonMaterial('#0b0c10', 0.15, 0.8)
    );
    shades.position.set(0, 1.58, 0.21);
    const tie = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.34, 0.04),
      makeToonMaterial('#ffd700', 0.25, 0.6, '#ffaa00', 0.35)
    );
    tie.position.set(0, 1.06, 0.16);
    fig.add(shades, tie);
  }

  return fig;
}

function buildCoreHumanoid(
  skinColor: string,
  hairStyle: HairStyle,
  hairColor: string,
  topColor: string,
  bottomColor: string,
  accentColor: string,
  genderStyle: 'feminine' | 'masculine' | 'neutral',
  glasses?: boolean,
  hat?: 'beret' | 'cap' | 'none'
): {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
} {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const skinMat = makeToonMaterial(skinColor, 0.48, 0.05);
  const topMat = makeToonMaterial(topColor, 0.5, 0.08);
  const bottomMat = makeToonMaterial(bottomColor, 0.55, 0.08);
  const accentMat = makeToonMaterial(accentColor, 0.42, 0.12);
  const shoeMat = makeToonMaterial('#262936', 0.45, 0.15);

  // Torso
  const torsoWidth = genderStyle === 'masculine' ? 0.52 : genderStyle === 'feminine' ? 0.44 : 0.48;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(torsoWidth, 0.6, 0.28), topMat);
  torso.position.y = 1.06;
  torso.castShadow = true;
  bodyGroup.add(torso);

  // Accent collar / scarf / lapel so character's accentColor is super readable
  const collar = new THREE.Mesh(
    new THREE.BoxGeometry(torsoWidth + 0.05, 0.13, 0.31),
    accentMat
  );
  collar.position.set(0, 1.32, 0.01);
  bodyGroup.add(collar);

  // If feminine style, add a stylish flared hem/skirt or waist belt
  if (genderStyle === 'feminine') {
    const skirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.31, 0.3, 14),
      bottomMat
    );
    skirt.position.y = 0.72;
    bodyGroup.add(skirt);
  } else {
    const hip = new THREE.Mesh(
      new THREE.BoxGeometry(torsoWidth * 0.96, 0.18, 0.27),
      bottomMat
    );
    hip.position.y = 0.74;
    bodyGroup.add(hip);
  }

  // Head Group
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.6, 0);
  bodyGroup.add(headGroup);

  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.235, 16, 14), skinMat);
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // Expressive eyes & blush on +Z face
  const eyeMat = makeToonMaterial('#181a24', 0.2, 0.2);
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), eyeMat);
  eyeL.position.set(-0.082, 0.02, 0.215);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.082;

  const blushMat = makeToonMaterial('#ff8fab', 0.5, 0.0);
  const blushL = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), blushMat);
  blushL.scale.set(1.3, 0.7, 0.5);
  blushL.position.set(-0.13, -0.035, 0.205);
  const blushR = blushL.clone();
  blushR.position.x = 0.13;

  headGroup.add(eyeL, eyeR, blushL, blushR);

  // Hair
  const hairGroup = buildHairMesh(hairStyle, hairColor);
  headGroup.add(hairGroup);

  // Optional Glasses
  if (glasses) {
    headGroup.add(buildGlassesMesh());
  }

  // Optional Hat
  const hatMesh = buildHatMesh(hat, accentColor);
  if (hatMesh) {
    headGroup.add(hatMesh);
  }

  // Arms (pivoted at shoulder y = 1.30)
  const shoulderX = torsoWidth / 2 + 0.085;
  const leftArm = new THREE.Group();
  leftArm.position.set(-shoulderX, 1.3, 0);
  const leftSleeve = new THREE.Mesh(
    new THREE.CylinderGeometry(0.078, 0.068, 0.44, 10),
    topMat
  );
  leftSleeve.position.y = -0.2;
  const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 10), skinMat);
  leftHand.position.y = -0.45;
  leftArm.add(leftSleeve, leftHand);
  bodyGroup.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(shoulderX, 1.3, 0);
  const rightSleeve = new THREE.Mesh(
    new THREE.CylinderGeometry(0.078, 0.068, 0.44, 10),
    topMat
  );
  rightSleeve.position.y = -0.2;
  const rightHand = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 10), skinMat);
  rightHand.position.y = -0.45;
  rightArm.add(rightSleeve, rightHand);
  bodyGroup.add(rightArm);

  // Legs (pivoted at hip y = 0.70)
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.13, 0.7, 0);
  const leftPant = new THREE.Mesh(
    new THREE.CylinderGeometry(0.095, 0.078, 0.62, 10),
    bottomMat
  );
  leftPant.position.y = -0.31;
  const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.11, 0.24), shoeMat);
  leftShoe.position.set(0, -0.64, 0.04);
  leftLeg.add(leftPant, leftShoe);
  bodyGroup.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.13, 0.7, 0);
  const rightPant = new THREE.Mesh(
    new THREE.CylinderGeometry(0.095, 0.078, 0.62, 10),
    bottomMat
  );
  rightPant.position.y = -0.31;
  const rightShoe = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.11, 0.24), shoeMat);
  rightShoe.position.set(0, -0.64, 0.04);
  rightLeg.add(rightPant, rightShoe);
  bodyGroup.add(rightLeg);

  return {
    root,
    bodyGroup,
    headGroup,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
  };
}

export function createProtagonistRig(): AvatarRig {
  const core = buildCoreHumanoid(
    '#ffe0cc',
    'spiky',
    '#1f263d',
    '#00e5ff', // bright cyan jacket
    '#1f2937', // sleek dark pants
    '#ffffff', // crisp white hoodie trim
    'neutral'
  );

  // Add white racing stripes & backpack on the back (-Z in local space, visible when protagonist faces -Z)
  const backStripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.56, 0.3),
    makeToonMaterial('#ffffff', 0.35)
  );
  backStripe.position.set(0, 1.06, 0);
  core.bodyGroup.add(backStripe);

  // Stylish urban daypack on back
  const backpack = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.44, 0.2),
    makeToonMaterial('#ff3b8d', 0.4, 0.15, '#ff3b8d', 0.15)
  );
  backpack.position.set(0, 1.05, -0.22);
  const packPocket = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.2, 0.08),
    makeToonMaterial('#ffe600', 0.35, 0.1)
  );
  packPocket.position.set(0, 0.96, -0.33);
  core.bodyGroup.add(backpack, packPocket);

  // Headphones around neck
  const headphoneBand = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.032, 8, 18),
    makeToonMaterial('#ffffff', 0.25, 0.4)
  );
  headphoneBand.rotation.x = Math.PI / 2;
  headphoneBand.position.set(0, 1.37, 0);
  const cupL = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.065, 0.05, 12),
    makeToonMaterial('#00f5d4', 0.2, 0.3, '#00f5d4', 0.5)
  );
  cupL.rotation.z = Math.PI / 2;
  cupL.position.set(-0.18, 1.38, 0.04);
  const cupR = cupL.clone();
  cupR.position.x = 0.18;
  core.bodyGroup.add(headphoneBand, cupL, cupR);

  // Subtle cyan foot ring under protagonist so player lane position is ultra-crisp
  const playerRing = new THREE.Mesh(
    new THREE.RingGeometry(0.38, 0.5, 24),
    new THREE.MeshBasicMaterial({
      color: '#00f5ff',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    })
  );
  playerRing.rotation.x = -Math.PI / 2;
  playerRing.position.y = 0.025;
  core.root.add(playerRing);

  // Protagonist faces down the avenue (-Z) away from camera
  core.root.rotation.y = Math.PI;

  const initialPropGroup = new THREE.Group();
  const revealPropGroup = new THREE.Group();
  const companionGroup = new THREE.Group();
  core.bodyGroup.add(initialPropGroup, revealPropGroup);
  core.root.add(companionGroup);

  return {
    ...core,
    initialPropGroup,
    revealPropGroup,
    companionGroup,
    matchRing: playerRing,
  };
}

export function createCharacterRig(profile: CharacterProfile): AvatarRig {
  const { appearance } = profile;
  const core = buildCoreHumanoid(
    appearance.skinColor,
    appearance.hairStyle,
    appearance.hairColor,
    appearance.topColor,
    appearance.bottomColor,
    appearance.accentColor,
    appearance.genderStyle,
    appearance.glasses,
    appearance.hat
  );

  // Neutral glowing double match ring at feet (warm white + gold/pink so matched characters stand out from pedestrians without spoiling good/bad/scam)
  const outerRingMat = new THREE.MeshBasicMaterial({
    color: '#ffcf56',
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.88,
  });
  const matchRing = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.62, 28), outerRingMat);
  matchRing.rotation.x = -Math.PI / 2;
  matchRing.position.y = 0.03;

  const innerRing = new THREE.Mesh(
    new THREE.RingGeometry(0.3, 0.4, 24),
    new THREE.MeshBasicMaterial({
      color: '#fff7e6',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
    })
  );
  matchRing.add(innerRing);

  const glowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.62, 24),
    new THREE.MeshBasicMaterial({
      color: '#ff85b3',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.22,
    })
  );
  glowDisc.position.z = -0.005;
  matchRing.add(glowDisc);

  core.root.add(matchRing);

  // Build initialPropGroup
  const initialPropGroup = buildInitialProp(appearance.initialProp, appearance.accentColor);
  core.bodyGroup.add(initialPropGroup);

  // Build revealPropGroup (starts hidden, revealed at Phase 2 distance)
  const revealPropGroup = buildRevealProp(appearance.revealProp, appearance);
  core.bodyGroup.add(revealPropGroup);

  // Build companionGroup for 'entourage_wall' or 'mentor_ambush'
  const companionGroup = new THREE.Group();
  companionGroup.visible = false;
  if (profile.behavior === 'entourage_wall') {
    const friendL = buildMiniFigure('#f5cfa8', '#ff9f1c', '#7209b7', '#2b2d42', false);
    friendL.position.set(-0.92, 0, -0.15);
    const friendR = buildMiniFigure('#f5cfa8', '#ffbe0b', '#f72585', '#2b2d42', false);
    friendR.position.set(0.92, 0, -0.15);
    companionGroup.add(friendL, friendR);
  } else if (profile.behavior === 'mentor_ambush') {
    const mentor = buildMiniFigure('#eac096', '#11131a', '#141824', '#141824', true);
    mentor.scale.setScalar(1.14);
    mentor.position.set(0.84, 0, -0.35);
    companionGroup.add(mentor);
  }
  core.root.add(companionGroup);

  return {
    ...core,
    initialPropGroup,
    revealPropGroup,
    companionGroup,
    matchRing,
  };
}

export function createPedestrianRig(seed: number): AvatarRig {
  const mutedTops = ['#6c757d', '#5c677d', '#7f7979', '#6b705c', '#5e6472', '#8a817c'];
  const mutedBottoms = ['#343a40', '#3d405b', '#495057', '#2b2d42', '#4a4e69'];
  const mutedHair = ['#22222b', '#3b322c', '#2f2e33', '#463f3a'];
  const hairStyles: HairStyle[] = ['short', 'bob', 'parted', 'bun'];

  const idx = Math.abs(Math.floor(seed));
  const topColor = mutedTops[idx % mutedTops.length];
  const bottomColor = mutedBottoms[(idx * 3) % mutedBottoms.length];
  const hairColor = mutedHair[(idx * 5) % mutedHair.length];
  const hairStyle = hairStyles[(idx * 7) % hairStyles.length];
  const genderStyle = idx % 2 === 0 ? 'masculine' : 'feminine';

  const core = buildCoreHumanoid(
    '#edd2b5',
    hairStyle,
    hairColor,
    topColor,
    bottomColor,
    '#8d99ae',
    genderStyle,
    idx % 4 === 0,
    'none'
  );

  const initialPropGroup = new THREE.Group();
  const revealPropGroup = new THREE.Group();
  const companionGroup = new THREE.Group();
  core.bodyGroup.add(initialPropGroup, revealPropGroup);
  core.root.add(companionGroup);

  return {
    ...core,
    initialPropGroup,
    revealPropGroup,
    companionGroup,
  };
}

export function animateAvatarWalk(
  rig: AvatarRig,
  elapsed: number,
  speed: number,
  state: 'walk' | 'wave' | 'bow' | 'chase' | 'panic' | 'stop' = 'walk'
): void {
  const freq = Math.max(3.5, Math.min(14, speed * 1.45));
  const phase = elapsed * freq;

  // Pulse matchRing if present
  if (rig.matchRing) {
    const pulse = 1 + Math.sin(elapsed * 5.2) * 0.07;
    rig.matchRing.scale.set(pulse, pulse, 1);
  }

  // Animate companions if visible
  if (rig.companionGroup.visible) {
    rig.companionGroup.children.forEach((child, idx) => {
      child.position.y = Math.abs(Math.sin(phase + idx * 1.3)) * 0.09;
      child.rotation.z = Math.sin(phase * 0.8 + idx) * 0.06;
    });
  }

  // Subtle floating animation on revealPropGroup when visible
  if (rig.revealPropGroup.visible) {
    rig.revealPropGroup.position.y = Math.sin(elapsed * 6.5) * 0.06;
    rig.revealPropGroup.rotation.z = Math.sin(elapsed * 4.5) * 0.05;
  }

  switch (state) {
    case 'stop': {
      rig.leftLeg.rotation.x = 0;
      rig.rightLeg.rotation.x = 0;
      rig.leftArm.rotation.x = 0;
      rig.rightArm.rotation.x = -0.25;
      rig.bodyGroup.position.y = Math.sin(elapsed * 2.5) * 0.02;
      rig.bodyGroup.rotation.x = 0;
      rig.bodyGroup.rotation.z = 0;
      rig.headGroup.rotation.y = Math.sin(elapsed * 1.8) * 0.18;
      rig.headGroup.rotation.x = 0;
      break;
    }
    case 'wave': {
      const legSwing = Math.sin(phase * 0.7) * 0.35;
      rig.leftLeg.rotation.x = legSwing;
      rig.rightLeg.rotation.x = -legSwing;
      rig.leftArm.rotation.x = -legSwing * 0.5;
      rig.leftArm.rotation.z = 0.08;
      // Right arm raised high waving warmly
      rig.rightArm.rotation.x = -2.45;
      rig.rightArm.rotation.z = -0.35 + Math.sin(elapsed * 10) * 0.35;
      rig.bodyGroup.position.y = Math.abs(Math.sin(phase * 0.7)) * 0.06;
      rig.bodyGroup.rotation.x = 0;
      rig.bodyGroup.rotation.z = Math.sin(elapsed * 5) * 0.04;
      rig.headGroup.rotation.z = Math.sin(elapsed * 5) * 0.08;
      rig.headGroup.rotation.x = 0;
      break;
    }
    case 'bow': {
      const legSwing = Math.sin(phase * 0.65) * 0.28;
      rig.leftLeg.rotation.x = legSwing;
      rig.rightLeg.rotation.x = -legSwing;
      rig.leftArm.rotation.x = -0.2;
      rig.rightArm.rotation.x = -0.35;
      rig.rightArm.rotation.z = 0;
      const bowAngle = (Math.sin(elapsed * 4.2) * 0.5 + 0.5) * 0.42;
      rig.bodyGroup.rotation.x = bowAngle;
      rig.headGroup.rotation.x = bowAngle * 0.5;
      rig.bodyGroup.position.y = Math.abs(Math.sin(phase * 0.65)) * 0.04;
      break;
    }
    case 'chase': {
      const fastPhase = elapsed * 13.5;
      const legSwing = Math.sin(fastPhase) * 0.78;
      rig.leftLeg.rotation.x = legSwing;
      rig.rightLeg.rotation.x = -legSwing;
      rig.leftArm.rotation.x = -legSwing * 0.9;
      rig.rightArm.rotation.x = -0.95 + Math.sin(fastPhase) * 0.35;
      rig.rightArm.rotation.z = 0;
      rig.bodyGroup.position.y = Math.abs(Math.sin(fastPhase)) * 0.11;
      rig.bodyGroup.rotation.x = 0.18;
      rig.bodyGroup.rotation.z = Math.sin(fastPhase * 0.5) * 0.08;
      rig.headGroup.rotation.x = -0.1;
      break;
    }
    case 'panic': {
      const fastPhase = elapsed * 15.0;
      const legSwing = Math.sin(fastPhase) * 0.72;
      rig.leftLeg.rotation.x = legSwing;
      rig.rightLeg.rotation.x = -legSwing;
      rig.leftArm.rotation.x = -1.8 + Math.sin(fastPhase) * 0.5;
      rig.leftArm.rotation.z = 0.4;
      rig.rightArm.rotation.x = -1.8 - Math.sin(fastPhase) * 0.5;
      rig.rightArm.rotation.z = -0.4;
      rig.bodyGroup.position.y = Math.abs(Math.sin(fastPhase)) * 0.1;
      rig.bodyGroup.rotation.z = Math.sin(elapsed * 12) * 0.12;
      rig.headGroup.rotation.y = Math.sin(elapsed * 14) * 0.25;
      break;
    }
    case 'walk':
    default: {
      const legSwing = Math.sin(phase) * 0.55;
      rig.leftLeg.rotation.x = legSwing;
      rig.rightLeg.rotation.x = -legSwing;
      rig.leftArm.rotation.x = -legSwing * 0.75;
      rig.leftArm.rotation.z = 0.05;
      // Right arm holds prop slightly forward if character has initialProp children
      const hasProp = rig.initialPropGroup.children.length > 0;
      rig.rightArm.rotation.x = hasProp ? -0.55 + legSwing * 0.25 : legSwing * 0.75;
      rig.rightArm.rotation.z = -0.05;
      rig.bodyGroup.position.y = Math.abs(Math.sin(phase)) * 0.075;
      rig.bodyGroup.rotation.x = 0;
      rig.bodyGroup.rotation.z = Math.sin(phase) * 0.035;
      rig.headGroup.rotation.x = 0;
      rig.headGroup.rotation.y = 0;
      rig.headGroup.rotation.z = 0;
      break;
    }
  }
}
