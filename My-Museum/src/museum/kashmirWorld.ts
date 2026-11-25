/**
 * Kashmir World: Seamless Alpine Mountain Route, Gondola Cable Car,
 * Interactive Snowman Crafting, NPC Snowball Fights, and Ice Skating/Skiing Physics.
 */

export interface KashmirWaypoint {
  x: number;
  y: number;
  z: number;
  label: string;
}

/**
 * Scenic highway spline connecting CTG Zero Point (x = -395)
 * through the mountain pass into Kashmir Valley and Gulmarg Ski Slopes (x = -750).
 */
export const KASHMIR_HIGHWAY_WAYPOINTS: ReadonlyArray<KashmirWaypoint> = [
  { x: -395.0, y: 0.05, z: 68.0, label: 'CTG Zero Point Roundabout' },
  { x: -430.0, y: 0.15, z: 68.0, label: 'Mountain Pass Gateway & Lush CTG Green Foothills' },
  { x: -470.0, y: 1.20, z: 66.0, label: 'Winding Mountain Pass & Pine Forest Transition' },
  { x: -510.0, y: 2.30, z: 64.0, label: 'Kashmir Valley Entrance & First Frost Ground' },
  { x: -550.0, y: 3.10, z: 66.0, label: 'Alpine Wooden Chalet Village & Kahwa Stalls' },
  { x: -610.0, y: 3.50, z: 68.0, label: 'Frozen Dal Lake & Snowman Crafting Arena' },
  { x: -670.0, y: 3.80, z: 72.0, label: 'Gulmarg Gondola Base Station & Ski Resort' },
  { x: -740.0, y: 4.20, z: 75.0, label: 'Glacier Pass & High Alpine Vista' },
];

export const KASHMIR_BOUNDS = {
  minX: -820.0,
  maxX: -430.0,
  minZ: -30.0,
  maxZ: 210.0,
  snowLineX: -505.0, // West of this line is pure snow-covered terrain!
};

export type KashmirSubZone =
  | 'transition'
  | 'village'
  | 'frozen_lake'
  | 'snowman_arena'
  | 'gondola_base'
  | 'gondola_summit'
  | 'ski_slope';

export function getKashmirSubZone(x: number, z: number, y = 0): KashmirSubZone {
  if (x > -510) return 'transition';
  if (x >= -580 && x <= -510) return 'village';
  if (x >= -645 && x <= -580 && z <= 62) return 'frozen_lake';
  if (x >= -645 && x <= -580 && z > 62) return 'snowman_arena';
  if (x >= -700 && x <= -645 && z >= 110 && z <= 140) return 'gondola_base';
  if (y >= 25.0 || (x <= -730 && z >= 165)) return 'gondola_summit';
  return 'ski_slope';
}

/**
 * Calculates continuous walkable/drivable elevation across the Kashmir landscape,
 * including mountain ski slopes, highway, and elevated structures.
 */
export function computeKashmirElevation(x: number, z: number, currentY = 0): number {
  if (x > -430) return 0.05;

  // 1. Frozen Dal Lake ice sheet: flat mirror ice at y = 2.85m
  if (x >= -645 && x <= -580 && z >= 15 && z <= 60) {
    return 2.85;
  }

  // 2. Gondola Base Terminal, Ticket Counter & Boarding Platform (x: -676 to -654, z: 112 to 136)
  // Perfectly level ground floor for ticket counter + stairs to 2nd floor platform with ZERO mountain overlap!
  if (x >= -676 && x <= -654 && z >= 112 && z <= 136) {
    // Boarding stairs climbing from ground floor (y = 3.8) to elevated platform (y = 4.8)
    if (z >= 120 && z <= 126 && x >= -669 && x <= -661) {
      const stairT = (z - 120) / 6.0;
      return 3.8 + stairT * 1.0;
    }
    // 2nd Floor Boarding Platform deck at z >= 125
    if (z >= 125 && currentY >= 4.2) {
      return 4.8;
    }
    return 3.8; // Ground floor, Ticket Counter, and entrance plaza
  }

  // 3. Gondola Summit Platform (x: -768 to -742, z: 175 to 195)
  if (x >= -768 && x <= -742 && z >= 175 && z <= 195) {
    if (currentY >= 25.0) {
      return 36.0; // Summit observation platform deck
    }
  }

  // 4. Gulmarg Mountain Ski Slopes (x: -780 to -650, z: 110 to 205)
  // Continuous downhill slope descending from summit y = 36m down to base y = 3.8m
  if (x <= -650 && z >= 110) {
    const slopeProgress = Math.max(0, Math.min(1, (z - 110) / 80.0));
    const westProgress = Math.max(0, Math.min(1, (-650 - x) / 110.0));
    const slopeY = 3.8 + (slopeProgress * 0.65 + westProgress * 0.35) * 32.2;
    return slopeY;
  }

  // 4. Highway corridor spline elevation interpolation
  if (z >= 58 && z <= 78) {
    const pts = KASHMIR_HIGHWAY_WAYPOINTS;
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      if (x <= p1.x && x >= p2.x) {
        const factor = (x - p1.x) / (p2.x - p1.x);
        return p1.y + factor * (p2.y - p1.y);
      }
    }
  }

  // 5. Natural undulating snowy foothills
  const distFromPass = Math.max(0, -430 - x);
  const baseElev = Math.min(3.8, distFromPass * 0.025);
  const hillSway = Math.sin(x * 0.04) * Math.cos(z * 0.04) * 0.8;
  return Math.max(0.1, baseElev + hillSway);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. INTERACTIVE SNOWMAN CRAFTING SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

export type SnowmanHat = 'none' | 'top_hat' | 'beanie' | 'santa' | 'cone';
export type SnowmanScarf = 'none' | 'red_wool' | 'blue_striped' | 'golden_silk';

export interface SnowmanCustomization {
  hat: SnowmanHat;
  scarf: SnowmanScarf;
  carrotNose: boolean;
  stickArms: boolean;
  coalEyes: boolean;
  coalButtons: boolean;
}

export type SnowmanBuildPhase =
  | 'idle'
  | 'rolling_base'
  | 'rolling_torso'
  | 'rolling_head'
  | 'customizing'
  | 'completed';

export interface SnowmanBuilderState {
  phase: SnowmanBuildPhase;
  x: number;
  z: number;
  y: number;
  baseRadius: number;    // Target: 0.75m
  torsoRadius: number;   // Target: 0.52m
  headRadius: number;    // Target: 0.35m
  customization: SnowmanCustomization;
}

export interface BuiltSnowman {
  id: string;
  x: number;
  y: number;
  z: number;
  baseRadius: number;
  torsoRadius: number;
  headRadius: number;
  customization: SnowmanCustomization;
  createdAt: number;
}

export function createSnowmanBuilderState(x: number, z: number, y = 3.2): SnowmanBuilderState {
  return {
    phase: 'rolling_base',
    x,
    z,
    y,
    baseRadius: 0.25,
    torsoRadius: 0.15,
    headRadius: 0.1,
    customization: {
      hat: 'top_hat',
      scarf: 'red_wool',
      carrotNose: true,
      stickArms: true,
      coalEyes: true,
      coalButtons: true,
    },
  };
}

export function rollSnowball(state: SnowmanBuilderState, distanceMeters: number): SnowmanBuilderState {
  const s = { ...state };
  const growth = distanceMeters * 0.12;

  if (s.phase === 'rolling_base') {
    s.baseRadius = Math.min(0.75, s.baseRadius + growth);
    if (s.baseRadius >= 0.75) {
      s.phase = 'rolling_torso';
    }
  } else if (s.phase === 'rolling_torso') {
    s.torsoRadius = Math.min(0.52, s.torsoRadius + growth);
    if (s.torsoRadius >= 0.52) {
      s.phase = 'rolling_head';
    }
  } else if (s.phase === 'rolling_head') {
    s.headRadius = Math.min(0.35, s.headRadius + growth);
    if (s.headRadius >= 0.35) {
      s.phase = 'customizing';
    }
  }
  return s;
}

export function customizeSnowman(
  state: SnowmanBuilderState,
  options: Partial<SnowmanCustomization>
): SnowmanBuilderState {
  return {
    ...state,
    customization: {
      ...state.customization,
      ...options,
    },
  };
}

export function finalizeSnowman(state: SnowmanBuilderState): BuiltSnowman {
  return {
    id: `snowman-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    x: state.x,
    y: state.y,
    z: state.z,
    baseRadius: Math.max(0.55, state.baseRadius),
    torsoRadius: Math.max(0.38, state.torsoRadius),
    headRadius: Math.max(0.25, state.headRadius),
    customization: { ...state.customization },
    createdAt: Date.now(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. SNOWBALL FIGHT & PROJECTILE PHYSICS
// ─────────────────────────────────────────────────────────────────────────────

export interface SnowballProjectile {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  thrownBy: 'player' | 'npc';
  radius: number;
  lifetimeSeconds: number;
  active: boolean;
}

export interface SnowballFighterNPC {
  id: string;
  name: string;
  banglaTitle: string;
  x: number;
  y: number;
  z: number;
  hitCount: number;
  lastThrowTime: number;
  cooldownSeconds: number;
  reactionLine: string;
}

export const INITIAL_KASHMIR_NPCS: ReadonlyArray<SnowballFighterNPC> = [
  {
    id: 'npc-kashmir-arif',
    name: 'Arif Khan',
    banglaTitle: 'আরিফ (কাশ্মীর লোকাল গাইড)',
    x: -608.0,
    y: 3.5,
    z: 78.0,
    hitCount: 0,
    lastThrowTime: 0,
    cooldownSeconds: 2.8,
    reactionLine: 'স্বাগতম কাশ্মীরে! আমার দিকে বরফের গোলা ছুঁড়ে দেখুন তো!',
  },
  {
    id: 'npc-kashmir-fatima',
    name: 'Fatima Begum',
    banglaTitle: 'ফাতিমা (স্নোবল চ্যাম্পিয়ন)',
    x: -616.0,
    y: 3.5,
    z: 88.0,
    hitCount: 0,
    lastThrowTime: 0,
    cooldownSeconds: 2.2,
    reactionLine: 'দারুণ নিশানা! কিন্তু এবার আমার বরফের গোলা বাঁচান!',
  },
  {
    id: 'npc-kashmir-tariq',
    name: 'Tariq Butt',
    banglaTitle: 'তারিক (গুলমার্গ স্কি ট্রেইনার)',
    x: -624.0,
    y: 3.5,
    z: 72.0,
    hitCount: 0,
    lastThrowTime: 0,
    cooldownSeconds: 3.0,
    reactionLine: 'হাহাহা কী চমৎকার বরফ যুদ্ধ! আবার মারুন!',
  },
  {
    id: 'npc-kashmir-zoya',
    name: 'Zoya Mir',
    banglaTitle: 'জোয়া (স্নোম্যান ডিজাইনার)',
    x: -602.0,
    y: 3.5,
    z: 92.0,
    hitCount: 0,
    lastThrowTime: 0,
    cooldownSeconds: 2.5,
    reactionLine: 'আমার স্নোম্যানটিকে বাঁচিয়ে খেলুন কিন্তু!',
  },
];

export function createSnowball(
  origin: { x: number; y: number; z: number },
  direction: { x: number; y: number; z: number },
  speed = 22.0,
  thrownBy: 'player' | 'npc' = 'player'
): SnowballProjectile {
  const len = Math.hypot(direction.x, direction.y, direction.z) || 1;
  const nx = direction.x / len;
  const ny = direction.y / len;
  const nz = direction.z / len;

  return {
    id: `sb-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    x: origin.x + nx * 0.8,
    y: origin.y + ny * 0.8 + 0.3,
    z: origin.z + nz * 0.8,
    vx: nx * speed,
    vy: ny * speed + 2.5, // Natural lob arc!
    vz: nz * speed,
    thrownBy,
    radius: 0.14,
    lifetimeSeconds: 3.8,
    active: true,
  };
}

export interface SnowballStepResult {
  updatedSnowballs: SnowballProjectile[];
  updatedNPCs: SnowballFighterNPC[];
  playerHit: boolean;
  splashes: Array<{ x: number; y: number; z: number; hitType: 'terrain' | 'npc' | 'player' }>;
}

export function stepSnowballs(
  snowballs: SnowballProjectile[],
  npcs: SnowballFighterNPC[],
  playerPos: { x: number; y: number; z: number },
  dt: number
): SnowballStepResult {
  const gravity = -9.8;
  const updatedSnowballs: SnowballProjectile[] = [];
  const updatedNPCs = npcs.map((n) => ({ ...n }));
  const splashes: Array<{ x: number; y: number; z: number; hitType: 'terrain' | 'npc' | 'player' }> = [];
  let playerHit = false;

  for (const b of snowballs) {
    if (!b.active) continue;

    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    b.vy += gravity * dt;
    b.lifetimeSeconds -= dt;

    const terrainY = computeKashmirElevation(b.x, b.z, b.y);

    // Hit ground/snow
    if (b.y <= terrainY + 0.1 || b.lifetimeSeconds <= 0) {
      b.active = false;
      splashes.push({ x: b.x, y: terrainY, z: b.z, hitType: 'terrain' });
      continue;
    }

    // Check hit against player (if thrown by NPC)
    if (b.thrownBy === 'npc') {
      const dPlayer = Math.hypot(b.x - playerPos.x, b.y - (playerPos.y + 1.1), b.z - playerPos.z);
      if (dPlayer < 0.75) {
        b.active = false;
        playerHit = true;
        splashes.push({ x: b.x, y: b.y, z: b.z, hitType: 'player' });
        continue;
      }
    }

    // Check hit against NPCs (if thrown by player)
    if (b.thrownBy === 'player') {
      let hitNpc = false;
      for (const npc of updatedNPCs) {
        const dNpc = Math.hypot(b.x - npc.x, b.y - (npc.y + 1.1), b.z - npc.z);
        if (dNpc < 0.85) {
          b.active = false;
          hitNpc = true;
          npc.hitCount += 1;
          splashes.push({ x: b.x, y: b.y, z: b.z, hitType: 'npc' });
          break;
        }
      }
      if (hitNpc) continue;
    }

    updatedSnowballs.push(b);
  }

  return {
    updatedSnowballs,
    updatedNPCs,
    playerHit,
    splashes,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. MOUNTAIN GONDOLA CABLE CAR SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

export interface GondolaStation {
  id: 'base' | 'summit';
  name: string;
  banglaName: string;
  x: number;
  y: number;
  z: number;
  platformBounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
}

export const GONDOLA_BASE_STATION: GondolaStation = {
  id: 'base',
  name: 'Gulmarg Valley Gondola Base Station & Ticket Counter',
  banglaName: 'গুলমার্গ ভ্যালি গন্ডোলা টার্মিনাল ও টিকেট কাউন্টার',
  x: -665.0,
  y: 5.9,
  z: 125.0,
  platformBounds: {
    minX: -676.0,
    maxX: -654.0,
    minZ: 117.0,
    maxZ: 133.0,
  },
};

export const GONDOLA_SUMMIT_STATION: GondolaStation = {
  id: 'summit',
  name: 'Apharwat Peak High Alpine Summit Station',
  banglaName: 'আফরওয়াত পিক হাই আলপাইন সামিট স্টেশন',
  x: -755.0,
  y: 38.1,
  z: 185.0,
  platformBounds: {
    minX: -768.0,
    maxX: -742.0,
    minZ: 175.0,
    maxZ: 195.0,
  },
};

export interface GondolaCabinState {
  cabinId: number;
  progressT: number; // 0..1 (0 = Base, 0.5 = Summit, 1 = back to Base)
  x: number;
  y: number;
  z: number;
  swayRoll: number;
}

export interface GondolaSystemState {
  cabins: GondolaCabinState[];
  playerRidingCabinId: number | null;
}

export function createInitialGondolaSystemState(): GondolaSystemState {
  const ts = [0.05, 0.32, 0.55, 0.82];
  return {
    cabins: ts.map((progressT, cabinId) => {
      const pose = computeGondolaPoseAtT(progressT);
      return {
        cabinId,
        progressT,
        x: pose.x,
        y: pose.y,
        z: pose.z,
        swayRoll: 0,
      };
    }),
    playerRidingCabinId: null,
  };
}

export function computeGondolaPoseAtT(t: number): { x: number; y: number; z: number } {
  const normT = ((t % 1.0) + 1.0) % 1.0;
  const pBase = GONDOLA_BASE_STATION;
  const pSummit = GONDOLA_SUMMIT_STATION;

  if (normT <= 0.5) {
    // Climbing UP towards summit (progress 0 -> 0.5)
    const f = normT / 0.5;
    const catenarySag = Math.sin(f * Math.PI) * -1.8; // Realistic cable catenary sag!
    return {
      x: pBase.x + f * (pSummit.x - pBase.x) - 1.2,
      y: pBase.y + f * (pSummit.y - pBase.y) + catenarySag,
      z: pBase.z + f * (pSummit.z - pBase.z),
    };
  } else {
    // Returning DOWN towards valley base (progress 0.5 -> 1.0)
    const f = (normT - 0.5) / 0.5;
    const catenarySag = Math.sin(f * Math.PI) * -1.8;
    return {
      x: pSummit.x + f * (pBase.x - pSummit.x) + 1.2,
      y: pSummit.y + f * (pBase.y - pSummit.y) + catenarySag,
      z: pSummit.z + f * (pBase.z - pSummit.z),
    };
  }
}

export function stepGondolaSimulation(
  state: GondolaSystemState,
  dt: number,
  timeSec: number
): GondolaSystemState {
  const speedT = 0.015 * dt; // One full scenic loop in ~66 seconds
  const cabins = state.cabins.map((c) => {
    const nextT = (c.progressT + speedT) % 1.0;
    const pos = computeGondolaPoseAtT(nextT);
    const sway = Math.sin(timeSec * 2.0 + c.cabinId) * 0.035;
    return {
      ...c,
      progressT: nextT,
      x: pos.x,
      y: pos.y,
      z: pos.z,
      swayRoll: sway,
    };
  });

  return {
    ...state,
    cabins,
  };
}

export function findBoardableGondola(
  playerPos: { x: number; y: number; z: number },
  cabins: GondolaCabinState[]
): GondolaCabinState | null {
  for (const c of cabins) {
    const dx = c.x - playerPos.x;
    const dz = c.z - playerPos.z;
    const dy = c.y - playerPos.y;
    // Within boarding proximity at platform or dock
    if (Math.hypot(dx, dz) < 4.8 && Math.abs(dy) < 4.2) {
      return c;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. MOUNTAIN SKIING & ICE SKATING PHYSICS
// ─────────────────────────────────────────────────────────────────────────────

export type WinterActivityMode = 'walk' | 'skate' | 'ski';

export interface WinterKinematicsState {
  mode: WinterActivityMode;
  speed: number;
  carveAngle: number;
  headingYaw: number;
  isGrounded: boolean;
  airborneYVelocity: number;
}

export function createInitialWinterKinematics(): WinterKinematicsState {
  return {
    mode: 'walk',
    speed: 0,
    carveAngle: 0,
    headingYaw: 0,
    isGrounded: true,
    airborneYVelocity: 0,
  };
}

export function stepSkiPhysics(
  state: WinterKinematicsState,
  inputs: { forward: boolean; backward: boolean; left: boolean; right: boolean; jump: boolean },
  currentSlopeFactor: number,
  dt: number
): WinterKinematicsState {
  let { speed, carveAngle, headingYaw, isGrounded, airborneYVelocity, mode } = state;

  if (mode === 'ski') {
    // Downhill gravity acceleration on slopes
    const slopeAccel = Math.max(0, currentSlopeFactor) * 11.5;
    const frictionDecay = isGrounded ? 0.25 : 0.05;

    if (inputs.forward) {
      speed += (6.0 + slopeAccel) * dt;
    } else {
      speed += (slopeAccel * 0.8) * dt;
    }

    if (inputs.backward) {
      // Snowplow brake!
      speed = Math.max(0, speed - 15.0 * dt);
    }

    speed *= Math.exp(-frictionDecay * dt);
    speed = Math.min(22.0, Math.max(0, speed)); // Max speed 22 m/s (~79 km/h)

    // Carving turns
    if (inputs.left) {
      headingYaw += (2.2 / (1.0 + speed * 0.05)) * dt;
      carveAngle = Math.min(0.35, carveAngle + 2.5 * dt);
    } else if (inputs.right) {
      headingYaw -= (2.2 / (1.0 + speed * 0.05)) * dt;
      carveAngle = Math.max(-0.35, carveAngle - 2.5 * dt);
    } else {
      carveAngle *= Math.pow(0.8, dt * 60);
    }

    // Jumping off moguls / ramps
    if (inputs.jump && isGrounded && speed > 4.0) {
      isGrounded = false;
      airborneYVelocity = 5.5;
    }

    if (!isGrounded) {
      airborneYVelocity -= 9.8 * dt;
      if (airborneYVelocity <= 0) {
        isGrounded = true;
        airborneYVelocity = 0;
      }
    }
  } else if (mode === 'skate') {
    // Ice skating: low friction glide
    const frictionDecay = 0.08;
    if (inputs.forward) {
      speed = Math.min(12.0, speed + 7.0 * dt);
    } else if (inputs.backward) {
      speed = Math.max(0, speed - 10.0 * dt);
    }
    speed *= Math.exp(-frictionDecay * dt);

    if (inputs.left) headingYaw += 2.8 * dt;
    if (inputs.right) headingYaw -= 2.8 * dt;
  }

  return {
    mode,
    speed,
    carveAngle,
    headingYaw,
    isGrounded,
    airborneYVelocity,
  };
}
