export type CharacterCategory = 'good' | 'bad' | 'scam';

export type ClueStrength = 'strong' | 'medium' | 'weak';

export type PhotoTheme = 'cafe' | 'park' | 'lounge' | 'street' | 'night' | 'library';

export type HairStyle =
  | 'short'
  | 'bob'
  | 'long'
  | 'ponytail'
  | 'parted'
  | 'bun'
  | 'spiky'
  | 'waves';

export type InitialPropType =
  | 'coffee'
  | 'book'
  | 'phone'
  | 'camera'
  | 'bag'
  | 'bouquet'
  | 'map'
  | 'umbrella'
  | 'briefcase'
  | 'cake_box'
  | 'soccer_ball'
  | 'art_frame'
  | 'watch'
  | 'jewelry_box';

export type RevealPropType =
  | 'cafe_map_open'
  | 'two_menus'
  | 'open_umbrella'
  | 'polite_gift'
  | 'catfish_board'
  | 'fake_id_fan'
  | 'live_rec_rig'
  | 'giant_speech_x'
  | 'beer_mug_push'
  | 'schedule_board'
  | 'bill_invoice'
  | 'crypto_chart'
  | 'contract_scrolls'
  | 'pyramid_cake'
  | 'bar_neon_sign'
  | 'art_price_tag'
  | 'wire_transfer_alert'
  | 'qr_board'
  | 'none';

export type BehaviorArchetype =
  // Good (当たり) behaviors
  | 'polite_wait'       // Slows down, waves warmly, waits steadily in lane
  | 'pace_match'        // Gently aligns to a nearby clear lane at comfortable speed
  | 'yield_wave'        // Steps aside for pedestrians first, then waves politely
  | 'shy_bow'           // Bows nervously, pauses or drifts slightly shyly
  | 'umbrella_shelter'  // Opens umbrella and offers shelter in lane
  | 'menu_choice'       // Holds up two menus calmly and smiles
  // Bad (外れ) behaviors
  | 'catfish_flip'      // Flips a giant profile photo cutout revealing "別人!"
  | 'phone_zombie'      // Stares at phone, wanders diagonally without looking
  | 'speech_barrage'    // Emits giant noisy speech bubbles & X marks while advancing
  | 'pushy_chase'       // Accelerates and homes toward player's lane aggressively
  | 'entourage_wall'    // Spawns 2 noisy friends beside them forming a wide trio
  | 'live_streamer'     // Raises flashing [REC LIVE] rig and lunges toward player
  | 'rude_mock'         // Points rudely with X mark and swerves unpredictably
  | 'late_dash'         // Sprints in late while pointing angrily at watch/schedule
  // Scam (業者) behaviors
  | 'crypto_chart'      // Pulls out giant 3D upward chart & zig-zags to intercept
  | 'contract_fan'      // Unfolds 3 giant pink contract scrolls & homes in
  | 'mentor_ambush'     // Summons a suited "Mentor (師匠)" behind them & advances fast
  | 'bar_sign_block'    // Drags a neon [BAR 料金表なし] signboard sweeping across lane
  | 'pyramid_box'       // Cake box / ball transforms into glowing pyramid diagram
  | 'art_price_tag'     // Reveals a 1,000,000円 price tag on art/jewelry & lunges
  | 'wire_transfer';    // Flashes [至急送金] alert board & dashes forward

export interface VisualAppearance {
  genderStyle: 'feminine' | 'masculine' | 'neutral';
  skinColor: string;
  hairStyle: HairStyle;
  hairColor: string;
  topColor: string;
  bottomColor: string;
  accentColor: string;
  glasses?: boolean;
  hat?: 'beret' | 'cap' | 'none';
  initialProp: InitialPropType;
  revealProp: RevealPropType;
  /**
   * If set, the profile photo shows an intentionally altered/filtered look
   * (e.g. heavy glamour sparkles or different hair/top color) to represent profile fraud.
   */
  photoDisguise?: {
    hairColor?: string;
    topColor?: string;
    heavyFilter?: boolean;
    decoyLabel?: string;
  };
}

export interface CharacterProfile {
  id: string;
  name: string;
  age: number;
  occupation: string;
  tagline: string;
  bio: string;
  tags: [string, string, string];
  /** Short visual clothing/prop hint shown on card so player can spot them in 3D */
  spotHint: string;
  category: CharacterCategory;
  clueLevel: ClueStrength;
  behavior: BehaviorArchetype;
  appearance: VisualAppearance;
  photoTheme: PhotoTheme;
  /** Very short comic action text shown on 3D reveal (max ~10 chars) */
  revealBark: string;
  /** Headline shown when contacting this character */
  contactTitle: string;
  /** Explanation of why this character was Good / Bad / Scam */
  contactDetail: string;
  baseScore: number;
}

export type DifficultyId = 'normal' | 'hard';

export interface DifficultyConfig {
  id: DifficultyId;
  label: string;
  subtitle: string;
  description: string;
  durationSec: number;
  rushDurationSec: number;
  /** Time in seconds for a matched character to walk from spawn (-46m) to player (0m) */
  approachTimeSec: number;
  /** Z distance at which matched character triggers their Phase-2 signature behavior */
  revealDistanceZ: number;
  /** Player lateral movement speed (units/sec) */
  playerLateralSpeed: number;
  /** Visual forward scrolling speed of sidewalk (units/sec) */
  roadScrollSpeed: number;
  /** Interval between ambient pedestrian spawns (sec) */
  pedestrianSpawnInterval: number;
  /** Maximum simultaneous pedestrians on sidewalk */
  maxPedestrians: number;
  /** Speed multiplier for match lateral homing/weaving */
  matchActionIntensity: number;
  /** Deck ratio weights */
  deckWeights: {
    good: number;
    bad: number;
    scam: number;
  };
}

export type EncounterOutcome =
  | 'contacted'
  | 'avoided'
  | 'approaching'
  | 'swiped_left';

export interface EncounterRecord {
  instanceId: number;
  character: CharacterProfile;
  swipedRight: boolean;
  outcome: EncounterOutcome;
  scoreDelta: number;
  comboAtContact: number;
  timestampSec: number;
}

export interface ContactEventPayload {
  instanceId: number;
  character: CharacterProfile;
  scoreDelta: number;
  comboCount: number;
  isMultiMeet: boolean;
  worldPosition: { x: number; y: number; z: number };
}

export interface ActiveMatchHUDItem {
  instanceId: number;
  character: CharacterProfile;
  /** Normalized progress from 0 (far spawn) to 1 (at player Z) */
  progress: number;
  /** Normalized X lane position from -1 (left edge) to +1 (right edge) */
  normalizedX: number;
  isRevealed: boolean;
  screenX: number;
  screenY: number;
  visible: boolean;
}
