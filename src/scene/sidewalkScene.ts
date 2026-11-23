import * as THREE from 'three';
import {
  ActiveMatchHUDItem,
  CharacterProfile,
  ContactEventPayload,
  DifficultyConfig,
} from '../types';
import {
  animateAvatarWalk,
  AvatarRig,
  createCharacterRig,
  createPedestrianRig,
  createProtagonistRig,
} from './avatarFactory';

export interface SidewalkCallbacks {
  onMatchContact: (payload: ContactEventPayload) => void;
  onMatchAvoided: (instanceId: number, character: CharacterProfile) => void;
  onMatchRevealed: (instanceId: number, character: CharacterProfile, bark: string) => void;
  onPedestrianBump: (x: number) => void;
}

type PedestrianArchetype = 'steady_walk' | 'window_stop' | 'diagonal_drift' | 'pair_walk';

interface ActivePedestrian {
  rig: AvatarRig;
  x: number;
  z: number;
  baseX: number;
  speedZ: number;
  driftVx: number;
  archetype: PedestrianArchetype;
  animOffset: number;
  pauseTimer: number;
  hasPaused: boolean;
}

interface ActiveMatchedEntity {
  instanceId: number;
  character: CharacterProfile;
  rig: AvatarRig;
  x: number;
  z: number;
  spawnX: number;
  targetLaneX: number;
  elapsed: number;
  spawnScale: number;
  revealPopTimer: number;
  latePauseTimer: number;
  isRevealed: boolean;
  contacted: boolean;
  avoided: boolean;
  exitTimer: number;
  zigPhase: number;
}

interface BurstParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  rotSpeed: THREE.Vector3;
  age: number;
  maxAge: number;
}

const DEFAULT_DIFFICULTY: DifficultyConfig = {
  id: 'normal',
  label: 'NORMAL',
  subtitle: '表参道サンセット',
  description: 'Standard difficulty',
  durationSec: 75,
  rushDurationSec: 15,
  approachTimeSec: 7.0,
  revealDistanceZ: 24,
  playerLateralSpeed: 6.8,
  roadScrollSpeed: 6.5,
  pedestrianSpawnInterval: 2.1,
  maxPedestrians: 7,
  matchActionIntensity: 1.0,
  deckWeights: { good: 42, bad: 33, scam: 25 },
};

const SPAWN_Z = -46;
const PROTAGONIST_Z = -0.85;
const PLAYER_MAX_X = 3.65;
const SIDEWALK_HALF_W = 4.5;

export class SidewalkScene {
  private container: HTMLElement;
  private callbacks: SidewalkCallbacks;
  private config: DifficultyConfig = DEFAULT_DIFFICULTY;

  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;

  private protagonist: AvatarRig;
  private playerX = 0;
  private playerVelX = 0;
  private inputAxis = 0;
  private directTargetX: number | null = null;

  private bumpSlowTimer = 0;
  private bumpInvulnTimer = 0;
  private bumpKnockVx = 0;

  private cameraShakeTime = 0;
  private cameraShakeIntensity = 0;
  private baseCameraPos = new THREE.Vector3(0, 4.45, 7.6);
  private cameraLookTarget = new THREE.Vector3(0, 1.0, -10.8);

  private envSegments: THREE.Group[] = [];
  private readonly segmentLength = 12;
  private readonly numSegments = 7;

  private activeMatches: ActiveMatchedEntity[] = [];
  private pedestrians: ActivePedestrian[] = [];
  private particles: BurstParticle[] = [];

  private pedestrianSpawnTimer = 0.8;
  private pedestrianSeed = 1;
  private totalElapsed = 0;

  private projVec = new THREE.Vector3();

  constructor(container: HTMLElement, callbacks: SidewalkCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#ff8c61');
    this.scene.fog = new THREE.FogExp2('#ff8a65', 0.0145);

    const width = Math.max(1, container.clientWidth || window.innerWidth);
    const height = Math.max(1, container.clientHeight || window.innerHeight);

    this.camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 130);
    this.camera.position.copy(this.baseCameraPos);
    this.camera.lookAt(this.cameraLookTarget);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    container.innerHTML = '';
    container.appendChild(this.renderer.domElement);

    this.setupLighting();
    this.buildSkyBackdrop();
    this.buildScrollingAvenue();

    this.protagonist = createProtagonistRig();
    this.protagonist.root.position.set(0, 0, PROTAGONIST_Z);
    this.scene.add(this.protagonist.root);
  }

  private setupLighting(): void {
    const hemiLight = new THREE.HemisphereLight('#ffe3b8', '#5e4368', 1.15);
    hemiLight.position.set(0, 20, 0);
    this.scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight('#ffae6b', 1.75);
    sunLight.position.set(-12, 18, 12);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 75;
    const d = 24;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    this.scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight('#ff5e97', 0.65);
    rimLight.position.set(10, 8, -25);
    this.scene.add(rimLight);
  }

  private buildSkyBackdrop(): void {
    // Sunset gradient backdrop canvas in far distance
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0.0, '#2b1b54');
      grad.addColorStop(0.32, '#8338ec');
      grad.addColorStop(0.62, '#ff5d8f');
      grad.addColorStop(0.85, '#ff9e00');
      grad.addColorStop(1.0, '#ffe599');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 256);
    }
    const skyTex = new THREE.CanvasTexture(canvas);
    const skyPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 65),
      new THREE.MeshBasicMaterial({ map: skyTex, fog: false })
    );
    skyPlane.position.set(0, 20, -72);
    this.scene.add(skyPlane);

    // Glowing golden setting sun disc at the end of Omotesando avenue
    const sunDisc = new THREE.Mesh(
      new THREE.CircleGeometry(9.5, 32),
      new THREE.MeshBasicMaterial({
        color: '#ffea85',
        transparent: true,
        opacity: 0.85,
        fog: false,
      })
    );
    sunDisc.position.set(0, 11.5, -69);
    this.scene.add(sunDisc);

    // Tokyo distant silhouette skyline
    const skylineMat = new THREE.MeshBasicMaterial({ color: '#391e4f' });
    const heights = [9, 14, 11, 18, 8, 12, 16, 10, 15, 11];
    for (let i = 0; i < heights.length; i++) {
      const h = heights[i];
      const b = new THREE.Mesh(new THREE.BoxGeometry(5.5, h, 2), skylineMat);
      b.position.set(-24 + i * 5.3, h / 2 - 1, -66);
      this.scene.add(b);
    }
  }

  private buildScrollingAvenue(): void {
    for (let i = 0; i < this.numSegments; i++) {
      const seg = this.createAvenueSegment(i);
      seg.position.z = 10 - i * this.segmentLength;
      this.envSegments.push(seg);
      this.scene.add(seg);
    }
  }

  private createAvenueSegment(index: number): THREE.Group {
    const group = new THREE.Group();
    const len = this.segmentLength;

    // Main paved sidewalk (-4.5 to +4.5)
    const sidewalkMat = new THREE.MeshStandardMaterial({
      color: index % 2 === 0 ? '#ead7c5' : '#e2cbb7',
      roughness: 0.78,
      metalness: 0.05,
    });
    const sidewalk = new THREE.Mesh(
      new THREE.BoxGeometry(SIDEWALK_HALF_W * 2, 0.3, len),
      sidewalkMat
    );
    sidewalk.position.set(0, -0.15, 0);
    sidewalk.receiveShadow = true;
    group.add(sidewalk);

    // Decorative tile strips & lane guides on sidewalk so lateral lanes are easy to judge
    const tileStripMat = new THREE.MeshStandardMaterial({
      color: '#d3b8a3',
      roughness: 0.8,
    });
    for (const laneX of [-2.4, 0, 2.4]) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.12, len), tileStripMat);
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(laneX, 0.006, 0);
      group.add(strip);
    }

    // Yellow tactile paving strip (点字ブロック) along the right curb side
    const tactileMat = new THREE.MeshStandardMaterial({
      color: '#f4c430',
      roughness: 0.55,
    });
    const tactile = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.02, len), tactileMat);
    tactile.position.set(3.45, 0.01, 0);
    group.add(tactile);

    // Stone curbs on left (-4.65) and right (+4.65)
    const curbMat = new THREE.MeshStandardMaterial({ color: '#9c928b', roughness: 0.7 });
    const curbL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.36, len), curbMat);
    curbL.position.set(-SIDEWALK_HALF_W - 0.15, -0.12, 0);
    const curbR = curbL.clone();
    curbR.position.x = SIDEWALK_HALF_W + 0.15;
    group.add(curbL, curbR);

    // Asphalt road on right side (+4.8 to +16)
    const roadMat = new THREE.MeshStandardMaterial({ color: '#353342', roughness: 0.85 });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(14, len), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(SIDEWALK_HALF_W + 7.1, -0.18, 0);
    group.add(road);

    // Dashed white road line
    const dash = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, len * 0.45),
      new THREE.MeshBasicMaterial({ color: '#fff3e6' })
    );
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(SIDEWALK_HALF_W + 3.6, -0.16, 0);
    group.add(dash);

    // Colorful Omotesando boutiques & cafe awnings on the left side (X < -4.8)
    const shopPalette = ['#ff6b8b', '#4ecdc4', '#ffb703', '#8338ec', '#fb5607', '#3a86ff'];
    const buildingPalette = ['#fff4e6', '#fde2e4', '#e2ece9', '#f8edeb', '#f1faee'];
    for (let s = 0; s < 2; s++) {
      const zOff = -len * 0.25 + s * (len * 0.5);
      const bColor = buildingPalette[(index * 2 + s) % buildingPalette.length];
      const aColor = shopPalette[(index * 3 + s) % shopPalette.length];

      const facade = new THREE.Mesh(
        new THREE.BoxGeometry(4.2, 7.5, len * 0.46),
        new THREE.MeshStandardMaterial({ color: bColor, roughness: 0.65 })
      );
      facade.position.set(-SIDEWALK_HALF_W - 2.35, 3.6, zOff);
      group.add(facade);

      // Warm glowing shop window
      const windowMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(len * 0.34, 2.4),
        new THREE.MeshStandardMaterial({
          color: '#fff3b0',
          emissive: '#ffbe0b',
          emissiveIntensity: 0.55,
          roughness: 0.2,
        })
      );
      windowMesh.rotation.y = Math.PI / 2;
      windowMesh.position.set(-SIDEWALK_HALF_W - 0.22, 1.5, zOff);
      group.add(windowMesh);

      // Striped / colorful boutique awning projecting slightly from building facade (kept clear of streetlamps)
      const awning = new THREE.Mesh(
        new THREE.BoxGeometry(0.82, 0.2, len * 0.34),
        new THREE.MeshStandardMaterial({ color: aColor, roughness: 0.45 })
      );
      awning.position.set(-SIDEWALK_HALF_W - 0.36, 2.85, zOff);
      awning.rotation.z = -0.22;
      group.add(awning);
    }

    // Zelkova street tree (ケヤキ並木) and glowing sunset streetlamps placed cleanly without intersecting awnings
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#5c4033', roughness: 0.8 });
    const leafColors = ['#ff9f1c', '#f77f00', '#fcbf49', '#e07a5f'];
    const foliageMat = new THREE.MeshStandardMaterial({
      color: leafColors[index % leafColors.length],
      roughness: 0.6,
    });

    for (const sideX of [-4.22, 4.38]) {
      const tree = new THREE.Group();
      // Place trees at segment ends (z = -len*0.48) and lamps at center gap (z = 0) between the two awnings
      tree.position.set(sideX, 0, -len * 0.46);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 2.5, 8), trunkMat);
      trunk.position.y = 1.25;
      const crown1 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.22, 1), foliageMat);
      crown1.position.set(0, 3.15, 0);
      const crown2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.92, 1), foliageMat);
      crown2.position.set(sideX > 0 ? 0.42 : -0.42, 3.72, 0.32);
      tree.add(trunk, crown1, crown2);
      group.add(tree);

      // Glowing sunset streetlamp sitting cleanly in the gap between shop awnings
      const lamp = new THREE.Group();
      lamp.position.set(sideX, 0, 0);
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, 3.4, 8),
        new THREE.MeshStandardMaterial({ color: '#2b2d42', metalness: 0.6, roughness: 0.35 })
      );
      pole.position.y = 1.7;
      const globe = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 12, 12),
        new THREE.MeshStandardMaterial({
          color: '#fff8d6',
          emissive: '#ffbe0b',
          emissiveIntensity: 1.1,
        })
      );
      globe.position.y = 3.5;
      lamp.add(pole, globe);
      group.add(lamp);
    }

    return group;
  }

  public setDifficulty(config: DifficultyConfig): void {
    this.config = config;
  }

  public reset(): void {
    for (const m of this.activeMatches) {
      this.scene.remove(m.rig.root);
    }
    this.activeMatches = [];

    for (const p of this.pedestrians) {
      this.scene.remove(p.rig.root);
    }
    this.pedestrians = [];

    for (const pt of this.particles) {
      this.scene.remove(pt.mesh);
    }
    this.particles = [];

    this.playerX = 0;
    this.playerVelX = 0;
    this.inputAxis = 0;
    this.directTargetX = null;
    this.bumpSlowTimer = 0;
    this.bumpInvulnTimer = 0;
    this.bumpKnockVx = 0;
    this.cameraShakeTime = 0;
    this.cameraShakeIntensity = 0;
    this.pedestrianSpawnTimer = 0.6;

    this.protagonist.root.position.set(0, 0, PROTAGONIST_Z);
    this.protagonist.root.rotation.set(0, Math.PI, 0);
  }

  public spawnMatchedCharacter(character: CharacterProfile, instanceId: number): void {
    // Pick a well-spaced lane in [-3.2, +3.2] avoiding recent matches near Z < -34
    const candidates = [-3.1, -2.1, -1.05, 0.0, 1.05, 2.1, 3.1];
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = candidates[i];
      candidates[i] = candidates[j];
      candidates[j] = tmp;
    }

    let chosenX = candidates[0];
    let bestMinDist = -1;
    for (const c of candidates) {
      let minDist = 999;
      for (const m of this.activeMatches) {
        if (m.z < -30) {
          const d = Math.abs(m.x - c);
          if (d < minDist) minDist = d;
        }
      }
      if (minDist > bestMinDist) {
        bestMinDist = minDist;
        chosenX = c;
      }
    }

    chosenX = THREE.MathUtils.clamp(chosenX + (Math.random() - 0.5) * 0.35, -3.3, 3.3);

    // If entourage_wall, keep center X within [-1.45, +1.45] so at least 3.2m of sidewalk is open on one side
    if (character.behavior === 'entourage_wall') {
      chosenX = THREE.MathUtils.clamp(chosenX, -1.45, 1.45);
    } else if (character.behavior === 'mentor_ambush') {
      chosenX = THREE.MathUtils.clamp(chosenX, -2.1, 1.8);
    }

    // Stagger Z depth on rapid right swipes so matches don't form an overlapping flat wall at Z = -46
    let minExistingZ = 0;
    for (const m of this.activeMatches) {
      if (m.z < minExistingZ) minExistingZ = m.z;
    }
    const spawnZ =
      minExistingZ < -41.0
        ? Math.max(-64, Math.min(SPAWN_Z, minExistingZ - 4.4))
        : SPAWN_Z;

    const rig = createCharacterRig(character);
    rig.root.position.set(chosenX, 0, spawnZ);
    rig.root.scale.setScalar(0.05);
    this.scene.add(rig.root);

    this.activeMatches.push({
      instanceId,
      character,
      rig,
      x: chosenX,
      z: spawnZ,
      spawnX: chosenX,
      targetLaneX: chosenX,
      elapsed: Math.random() * Math.PI * 2,
      spawnScale: 0.05,
      revealPopTimer: 0,
      latePauseTimer: 0,
      isRevealed: false,
      contacted: false,
      avoided: false,
      exitTimer: 0,
      zigPhase: Math.random() * Math.PI * 2,
    });
  }

  public setPlayerInput(moveAxis: number, directTargetX?: number | null): void {
    this.inputAxis = THREE.MathUtils.clamp(moveAxis, -1, 1);
    if (directTargetX !== undefined) {
      this.directTargetX =
        directTargetX === null
          ? null
          : THREE.MathUtils.clamp(directTargetX, -PLAYER_MAX_X, PLAYER_MAX_X);
    }
  }

  public getPlayerNormalizedX(): number {
    return THREE.MathUtils.clamp(this.playerX / PLAYER_MAX_X, -1, 1);
  }

  private spawnPedestrianGroup(): void {
    if (this.pedestrians.length >= this.config.maxPedestrians) return;

    const archetypes: PedestrianArchetype[] = [
      'steady_walk',
      'window_stop',
      'diagonal_drift',
      'pair_walk',
    ];
    const archetype = archetypes[this.pedestrianSeed % archetypes.length];
    this.pedestrianSeed++;

    // Choose a lane that doesn't overlap right on top of a newly spawned matched character
    let baseX = (Math.random() * 2 - 1) * 3.3;
    if (archetype === 'window_stop') {
      // Window shoppers walk near the left boutique windows or right curb trees
      baseX = Math.random() < 0.65 ? -3.35 : 3.35;
    }

    for (const m of this.activeMatches) {
      if (m.z < -34 && Math.abs(m.x - baseX) < 1.1) {
        baseX = baseX > 0 ? Math.max(-3.4, baseX - 1.5) : Math.min(3.4, baseX + 1.5);
      }
    }

    const createOne = (xPos: number, arch: PedestrianArchetype) => {
      const rig = createPedestrianRig(this.pedestrianSeed++);
      rig.root.position.set(xPos, 0, SPAWN_Z - 2);
      this.scene.add(rig.root);

      const speedZ = this.config.roadScrollSpeed * (0.85 + Math.random() * 0.25);
      const driftVx =
        arch === 'diagonal_drift' ? (xPos > 0 ? -0.55 : 0.55) : 0;

      this.pedestrians.push({
        rig,
        x: xPos,
        z: SPAWN_Z - 2,
        baseX: xPos,
        speedZ,
        driftVx,
        archetype: arch,
        animOffset: Math.random() * 10,
        pauseTimer: 0,
        hasPaused: false,
      });
    };

    if (archetype === 'pair_walk' && this.pedestrians.length + 2 <= this.config.maxPedestrians) {
      const center = THREE.MathUtils.clamp(baseX, -2.4, 2.4);
      createOne(center - 0.42, 'pair_walk');
      createOne(center + 0.42, 'pair_walk');
    } else {
      createOne(baseX, archetype === 'pair_walk' ? 'steady_walk' : archetype);
    }
  }

  private spawnContactParticles(x: number, y: number, z: number, isGood: boolean): void {
    const colors = isGood
      ? ['#ff3b8d', '#ffd166', '#00f5d4', '#ff85b3']
      : ['#ff1744', '#ffbe0b', '#9d4edd', '#ffffff'];
    const count = isGood ? 18 : 16;

    for (let i = 0; i < count; i++) {
      const color = colors[i % colors.length];
      const geom = isGood
        ? new THREE.OctahedronGeometry(0.14, 0)
        : new THREE.BoxGeometry(0.2, 0.24, 0.04);
      const mat = new THREE.MeshBasicMaterial({ color });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(x, y, z);

      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 2.2 + Math.random() * 3.4;
      const velocity = new THREE.Vector3(
        Math.cos(angle) * speed,
        2.4 + Math.random() * 3.2,
        Math.sin(angle) * speed * 0.6
      );
      const rotSpeed = new THREE.Vector3(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10
      );

      this.scene.add(mesh);
      this.particles.push({
        mesh,
        velocity,
        rotSpeed,
        age: 0,
        maxAge: 0.65 + Math.random() * 0.25,
      });
    }
  }

  private updateBehaviorMovement(
    m: ActiveMatchedEntity,
    dt: number,
    baseApproachSpeed: number
  ): { speedZ: number; animState: 'walk' | 'wave' | 'bow' | 'chase' | 'panic' | 'stop' } {
    let speedZ = baseApproachSpeed;
    let animState: 'walk' | 'wave' | 'bow' | 'chase' | 'panic' | 'stop' = 'walk';

    if (!m.isRevealed) {
      return { speedZ, animState };
    }

    const intensity = this.config.matchActionIntensity;
    // Cap homing speed and stop aggressive lateral tracking very close to Z=0 so player can always dodge with timely steering
    const canTrackPlayer = m.z < -2.2;
    const maxHomingSpeed = 1.9 * intensity;

    switch (m.character.behavior) {
      case 'polite_wait': {
        speedZ = baseApproachSpeed * 0.84;
        animState = 'wave';
        break;
      }
      case 'pace_match': {
        speedZ = baseApproachSpeed * 0.9;
        animState = 'wave';
        // Gently align toward a clear lane near playerX
        const desiredX = THREE.MathUtils.clamp(this.playerX, -3.1, 3.1);
        const diff = desiredX - m.x;
        m.x += THREE.MathUtils.clamp(diff * 1.6, -1.5, 1.5) * dt;
        break;
      }
      case 'yield_wave': {
        speedZ = baseApproachSpeed * 0.88;
        animState = 'wave';
        // Sidestep any nearby pedestrian
        for (const p of this.pedestrians) {
          if (Math.abs(p.z - m.z) < 3.0 && Math.abs(p.x - m.x) < 1.1) {
            const pushDir = m.x >= p.x ? 1 : -1;
            m.x += pushDir * 1.8 * dt;
          }
        }
        break;
      }
      case 'shy_bow': {
        speedZ = baseApproachSpeed * 0.84;
        animState = 'bow';
        // Drift ~1.0m shyly away from spawnX so player actively steers to meet them
        const shyOffset = m.spawnX > 0 ? -1.05 : 1.05;
        const target = THREE.MathUtils.clamp(m.spawnX + shyOffset, -3.2, 3.2);
        m.x += (target - m.x) * 2.2 * dt;
        break;
      }
      case 'umbrella_shelter':
      case 'menu_choice': {
        speedZ = baseApproachSpeed * 0.88;
        animState = 'walk';
        break;
      }
      case 'catfish_flip': {
        animState = 'panic';
        if (m.revealPopTimer < 0.55) {
          m.rig.revealPropGroup.rotation.y = (m.revealPopTimer / 0.55) * Math.PI * 2;
        } else {
          m.rig.revealPropGroup.rotation.y = 0;
        }
        if (canTrackPlayer) {
          m.targetLaneX += (this.playerX * 0.68 - m.targetLaneX) * 1.15 * dt;
        }
        m.x = m.targetLaneX + Math.sin(m.elapsed * 3.8 + m.zigPhase) * 1.15;
        break;
      }
      case 'phone_zombie': {
        animState = 'walk';
        const dir = m.spawnX > 0 ? -1 : 1;
        m.x += dir * 1.15 * intensity * dt;
        break;
      }
      case 'speech_barrage':
      case 'rude_mock': {
        animState = 'panic';
        if (canTrackPlayer) {
          m.targetLaneX += (this.playerX * 0.72 - m.targetLaneX) * 1.2 * dt;
        }
        m.x = m.targetLaneX + Math.sin(m.elapsed * 4.4 + m.zigPhase) * 1.3;
        break;
      }
      case 'pushy_chase':
      case 'live_streamer':
      case 'wire_transfer': {
        speedZ = baseApproachSpeed * 1.14;
        animState = 'chase';
        if (canTrackPlayer) {
          const diff = this.playerX - m.x;
          const step = THREE.MathUtils.clamp(diff * 2.4, -maxHomingSpeed, maxHomingSpeed);
          m.x += step * dt;
        }
        break;
      }
      case 'entourage_wall': {
        speedZ = baseApproachSpeed * 0.96;
        animState = 'walk';
        // Clamp center so 3-person wall (width ~2.6m) always leaves >= 3.2m of open sidewalk
        m.x = THREE.MathUtils.clamp(m.x, -1.45, 1.45);
        break;
      }
      case 'mentor_ambush': {
        speedZ = baseApproachSpeed * 1.12;
        animState = 'chase';
        if (canTrackPlayer) {
          const diff = this.playerX - m.x;
          const step = THREE.MathUtils.clamp(diff * 1.6, -1.35 * intensity, 1.35 * intensity);
          m.x = THREE.MathUtils.clamp(m.x + step * dt, -2.1, 1.8);
        }
        break;
      }
      case 'crypto_chart':
      case 'contract_fan':
      case 'pyramid_box':
      case 'art_price_tag': {
        speedZ = baseApproachSpeed * 1.06;
        animState = 'chase';
        if (canTrackPlayer) {
          const diff = this.playerX - m.x;
          const step = THREE.MathUtils.clamp(diff * 1.9, -1.55 * intensity, 1.55 * intensity);
          m.x += (step + Math.sin(m.elapsed * 4.0) * 0.55) * dt;
        }
        break;
      }
      case 'bar_sign_block': {
        speedZ = baseApproachSpeed * 0.98;
        animState = 'panic';
        if (canTrackPlayer) {
          const desiredCenter = THREE.MathUtils.clamp(this.playerX * 0.65, -2.0, 2.0);
          m.targetLaneX += (desiredCenter - m.targetLaneX) * 1.3 * dt;
        }
        m.x = m.targetLaneX + Math.sin(m.elapsed * 3.2 + m.zigPhase) * 1.6;
        break;
      }
      case 'late_dash': {
        if (m.latePauseTimer < 0.35) {
          m.latePauseTimer += dt;
          speedZ = baseApproachSpeed * 0.25;
          animState = 'panic';
          // Aim slightly toward player's lane during pause before dashing
          m.x += THREE.MathUtils.clamp((this.playerX * 0.78 - m.x) * 2.5, -2.2, 2.2) * dt;
        } else {
          speedZ = baseApproachSpeed * 1.48;
          animState = 'chase';
        }
        break;
      }
    }

    // Keep character within unified sidewalk bounds (-3.65 .. +3.65)
    if (m.character.behavior === 'entourage_wall') {
      m.x = THREE.MathUtils.clamp(m.x, -1.45, 1.45);
    } else if (m.character.behavior === 'mentor_ambush') {
      m.x = THREE.MathUtils.clamp(m.x, -2.1, 1.8);
    } else {
      m.x = THREE.MathUtils.clamp(m.x, -PLAYER_MAX_X, PLAYER_MAX_X);
    }

    return { speedZ, animState };
  }

  public update(dt: number, isRush: boolean, isIdlePreview = false): ActiveMatchHUDItem[] {
    const clampedDt = Math.min(dt, 0.1);
    this.totalElapsed += clampedDt;

    const rushMultiplier = isRush ? 1.15 : 1.0;
    const scrollSpeed = this.config.roadScrollSpeed * rushMultiplier;

    // 1. Scroll street environment segments seamlessly from Z = -58 to Z = +10
    const totalSpan = this.numSegments * this.segmentLength;
    for (const seg of this.envSegments) {
      seg.position.z += scrollSpeed * clampedDt;
      if (seg.position.z > 16) {
        seg.position.z -= totalSpan;
      }
    }

    // Idle preview mode (Title / Result modals): scroll street & walk protagonist calmly without collisions or shake
    if (isIdlePreview) {
      this.protagonist.root.position.set(this.playerX, 0, PROTAGONIST_Z);
      this.protagonist.root.rotation.set(0, Math.PI, 0);
      animateAvatarWalk(this.protagonist, this.totalElapsed, scrollSpeed, 'walk');
      this.camera.position.set(
        this.playerX * 0.25,
        this.baseCameraPos.y,
        this.baseCameraPos.z
      );
      this.camera.lookAt(this.playerX * 0.12, this.cameraLookTarget.y, this.cameraLookTarget.z);
      return [];
    }

    // 2. Update protagonist lateral movement & bump timers
    if (this.bumpSlowTimer > 0) {
      this.bumpSlowTimer = Math.max(0, this.bumpSlowTimer - clampedDt);
    }
    if (this.bumpInvulnTimer > 0) {
      this.bumpInvulnTimer = Math.max(0, this.bumpInvulnTimer - clampedDt);
    }

    const speedMult = this.bumpSlowTimer > 0 ? 0.58 : 1.0;
    const maxLatSpeed = this.config.playerLateralSpeed * speedMult;

    const prevX = this.playerX;
    if (this.directTargetX !== null) {
      const diff = this.directTargetX - this.playerX;
      const maxStep = maxLatSpeed * 1.55 * clampedDt;
      this.playerX += THREE.MathUtils.clamp(diff, -maxStep, maxStep);
    } else if (Math.abs(this.inputAxis) > 0.01) {
      this.playerX += this.inputAxis * maxLatSpeed * clampedDt;
    }

    if (Math.abs(this.bumpKnockVx) > 0.05) {
      this.playerX += this.bumpKnockVx * clampedDt;
      this.bumpKnockVx *= Math.pow(0.04, clampedDt);
    }

    this.playerX = THREE.MathUtils.clamp(this.playerX, -PLAYER_MAX_X, PLAYER_MAX_X);
    this.playerVelX = clampedDt > 0 ? (this.playerX - prevX) / clampedDt : 0;

    this.protagonist.root.position.set(this.playerX, 0, PROTAGONIST_Z);
    // Dynamic 3/4 lean when steering left/right + wobble when bumped
    const bumpWobble =
      this.bumpSlowTimer > 0 ? Math.sin(this.totalElapsed * 28) * 0.18 : 0;
    this.protagonist.root.rotation.y =
      Math.PI - THREE.MathUtils.clamp(this.playerVelX * 0.045, -0.32, 0.32);
    this.protagonist.root.rotation.z =
      -THREE.MathUtils.clamp(this.playerVelX * 0.025, -0.14, 0.14) + bumpWobble;

    animateAvatarWalk(
      this.protagonist,
      this.totalElapsed,
      scrollSpeed,
      this.bumpSlowTimer > 0 ? 'panic' : 'walk'
    );

    // 3. Spawn & update General Pedestrians
    this.pedestrianSpawnTimer -= clampedDt;
    if (this.pedestrianSpawnTimer <= 0) {
      this.spawnPedestrianGroup();
      this.pedestrianSpawnTimer =
        this.config.pedestrianSpawnInterval * (isRush ? 0.85 : 1.0);
    }

    for (let i = this.pedestrians.length - 1; i >= 0; i--) {
      const p = this.pedestrians[i];
      if (p.archetype === 'window_stop' && !p.hasPaused && p.z > -22 && p.z < -12) {
        p.hasPaused = true;
        p.pauseTimer = 1.4;
      }

      if (p.pauseTimer > 0) {
        p.pauseTimer -= clampedDt;
        p.z += scrollSpeed * 0.45 * clampedDt;
        animateAvatarWalk(p.rig, this.totalElapsed + p.animOffset, 1.0, 'stop');
      } else {
        p.z += p.speedZ * clampedDt;
        p.x = THREE.MathUtils.clamp(p.x + p.driftVx * clampedDt, -PLAYER_MAX_X, PLAYER_MAX_X);
        animateAvatarWalk(p.rig, this.totalElapsed + p.animOffset, p.speedZ, 'walk');
      }

      p.rig.root.position.set(p.x, 0, p.z);

      // Pedestrian collision check with player at PROTAGONIST_Z (with 0.45s invulnerability window)
      if (
        this.bumpInvulnTimer <= 0 &&
        Math.abs(p.z - PROTAGONIST_Z) < 0.78 &&
        Math.abs(p.x - this.playerX) < 0.68
      ) {
        this.bumpSlowTimer = 0.32;
        this.bumpInvulnTimer = 0.45;
        const pushDir = this.playerX >= p.x ? 1 : -1;
        this.bumpKnockVx = pushDir * 3.4;
        p.x -= pushDir * 0.45;
        this.triggerCameraShake(0.14, 0.16);
        this.callbacks.onPedestrianBump(this.playerX);
      }

      if (p.z > 5.5) {
        this.scene.remove(p.rig.root);
        this.pedestrians.splice(i, 1);
      }
    }

    // 4. Update active Matched Characters
    const baseApproachSpeed = (Math.abs(SPAWN_Z - PROTAGONIST_Z) / this.config.approachTimeSec) * rushMultiplier;
    const hudItems: ActiveMatchHUDItem[] = [];
    const width = Math.max(1, this.container.clientWidth || window.innerWidth);
    const height = Math.max(1, this.container.clientHeight || window.innerHeight);

    for (let i = this.activeMatches.length - 1; i >= 0; i--) {
      const m = this.activeMatches[i];
      m.elapsed += clampedDt;

      // Smooth spawn scale-in pop effect
      if (m.spawnScale < 1) {
        m.spawnScale = Math.min(1, m.spawnScale + clampedDt * 4.5);
        const overshoot =
          m.spawnScale < 1 ? 1 + Math.sin(m.spawnScale * Math.PI) * 0.15 : 1;
        m.rig.root.scale.setScalar(m.spawnScale * overshoot);
      }

      // Check Phase-2 reveal trigger at Z >= PROTAGONIST_Z - config.revealDistanceZ
      if (!m.isRevealed && m.z >= PROTAGONIST_Z - this.config.revealDistanceZ) {
        m.isRevealed = true;
        m.revealPopTimer = 0;
        m.rig.revealPropGroup.visible = true;
        if (m.rig.companionGroup.children.length > 0) {
          m.rig.companionGroup.visible = true;
        }
        this.callbacks.onMatchRevealed(m.instanceId, m.character, m.character.revealBark);
      }

      if (m.isRevealed) {
        m.revealPopTimer += clampedDt;
        const popScale =
          m.revealPopTimer < 0.28
            ? 0.2 + (m.revealPopTimer / 0.28) * 1.05
            : 1.0;
        m.rig.revealPropGroup.scale.setScalar(popScale);
        if (m.rig.companionGroup.visible) {
          m.rig.companionGroup.scale.setScalar(popScale);
        }
      }

      if (m.contacted) {
        m.exitTimer += clampedDt;
        m.z += baseApproachSpeed * 1.2 * clampedDt;
        m.rig.root.position.set(m.x, 0, m.z);
        m.rig.root.scale.setScalar(Math.max(0.01, 1 - m.exitTimer * 2.6));
        if (m.exitTimer > 0.38 || m.z > 4.5) {
          this.scene.remove(m.rig.root);
          this.activeMatches.splice(i, 1);
        }
        continue;
      }

      const { speedZ, animState } = this.updateBehaviorMovement(
        m,
        clampedDt,
        baseApproachSpeed
      );
      m.z += speedZ * clampedDt;
      m.rig.root.position.set(m.x, 0, m.z);

      animateAvatarWalk(m.rig, m.elapsed, speedZ, animState);

      // Determine hitRadius according to behavior archetype
      let hitRadius = m.character.category === 'good' ? 0.94 : 0.84;
      if (m.isRevealed) {
        if (m.character.behavior === 'entourage_wall') {
          hitRadius = 1.42;
        } else if (m.character.behavior === 'mentor_ambush') {
          hitRadius = 1.18;
        } else if (
          m.character.behavior === 'bar_sign_block' ||
          m.character.behavior === 'contract_fan'
        ) {
          hitRadius = 1.04;
        }
      }

      // Collision detection with protagonist at PROTAGONIST_Z
      if (
        !m.avoided &&
        Math.abs(m.z - PROTAGONIST_Z) < 1.05 &&
        Math.abs(m.x - this.playerX) < hitRadius
      ) {
        m.contacted = true;
        const isGood = m.character.category === 'good';
        if (!isGood) {
          this.triggerCameraShake(
            m.character.category === 'scam' ? 0.45 : 0.3,
            0.32
          );
        }

        this.spawnContactParticles(m.x, 1.4, PROTAGONIST_Z, isGood);

        // Final combo & multi-meet scoring is computed authoritatively by GameController
        this.callbacks.onMatchContact({
          instanceId: m.instanceId,
          character: m.character,
          scoreDelta: m.character.baseScore,
          comboCount: 0,
          isMultiMeet: false,
          worldPosition: { x: m.x, y: 1.4, z: m.z },
        });
        continue;
      }

      // Check if match passed PROTAGONIST_Z + 1.8 without contact -> avoided
      if (!m.avoided && m.z > PROTAGONIST_Z + 1.8) {
        m.avoided = true;
        this.callbacks.onMatchAvoided(m.instanceId, m.character);
      }

      // Remove once past Z > 4.5
      if (m.z > 4.5) {
        this.scene.remove(m.rig.root);
        this.activeMatches.splice(i, 1);
        continue;
      }

      // Project 3D head/overhead position (y = 2.6) to 2D screen coordinates
      this.projVec.set(m.x, 2.6, m.z);
      this.projVec.project(this.camera);

      const screenX = (this.projVec.x * 0.5 + 0.5) * width;
      const screenY = (-this.projVec.y * 0.5 + 0.5) * height;
      const progress = THREE.MathUtils.clamp(
        (m.z - SPAWN_Z) / Math.abs(SPAWN_Z - PROTAGONIST_Z),
        0,
        1
      );
      const normalizedX = THREE.MathUtils.clamp(m.x / PLAYER_MAX_X, -1, 1);
      const visible = !m.avoided && m.z <= PROTAGONIST_Z + 1.8 && this.projVec.z < 1.0;

      hudItems.push({
        instanceId: m.instanceId,
        character: m.character,
        progress,
        normalizedX,
        isRevealed: m.isRevealed,
        screenX,
        screenY,
        visible,
      });
    }

    // 5. Update 3D burst particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.age += clampedDt;
      if (pt.age >= pt.maxAge) {
        this.scene.remove(pt.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      pt.velocity.y -= 9.8 * clampedDt;
      pt.mesh.position.addScaledVector(pt.velocity, clampedDt);
      pt.mesh.rotation.x += pt.rotSpeed.x * clampedDt;
      pt.mesh.rotation.y += pt.rotSpeed.y * clampedDt;
      pt.mesh.rotation.z += pt.rotSpeed.z * clampedDt;
      const lifeRatio = 1 - pt.age / pt.maxAge;
      pt.mesh.scale.setScalar(Math.max(0.01, lifeRatio));
    }

    // 6. Update third-person camera tracking & shake
    let shakeX = 0;
    let shakeY = 0;
    if (this.cameraShakeTime > 0) {
      this.cameraShakeTime = Math.max(0, this.cameraShakeTime - clampedDt);
      shakeX = (Math.random() - 0.5) * 2 * this.cameraShakeIntensity;
      shakeY = (Math.random() - 0.5) * 2 * this.cameraShakeIntensity;
    }

    this.camera.position.set(
      this.playerX * 0.25 + shakeX,
      this.baseCameraPos.y + shakeY,
      this.baseCameraPos.z
    );
    this.camera.lookAt(this.playerX * 0.12, this.cameraLookTarget.y, this.cameraLookTarget.z);

    // Sort HUD items so closer characters are ordered predictably
    hudItems.sort((a, b) => a.progress - b.progress);
    return hudItems;
  }

  private triggerCameraShake(intensity: number, duration: number): void {
    this.cameraShakeIntensity = intensity;
    this.cameraShakeTime = duration;
  }

  public resize(): void {
    const width = Math.max(1, this.container.clientWidth || window.innerWidth);
    const height = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
