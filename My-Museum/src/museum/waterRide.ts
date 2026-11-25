/**
 * Water Ride (Tsunami Water Slide & Swimming Pool Aquapark) Simulation:
 * - High-speed curved water flume spline (from 9.5m tower down to swimming pool)
 * - Energy & water-lubricated gravity sliding physics
 * - Exact forward look tangent & banking for immersive first-person slider view
 * - Animated swimming pool visitors (swimmers kicking & treading water)
 * - Kids playing with balloons and running along the poolside promenade
 */

export interface WaterSlideWaypoint {
  x: number;
  y: number;
  z: number;
  roll: number; // Inward bank angle along flume (radians)
}

export interface WaterSlidePose {
  x: number;
  y: number;
  z: number;
  fwdX: number; // Normalized forward look direction
  fwdY: number;
  fwdZ: number;
  yaw: number;
  pitch: number;
  rotX: number;
  roll: number;
  speed: number;
  isSplashdown: boolean;
}

export type WaterSlideStateKind =
  | 'idle_docked'
  | 'sliding'
  | 'splashdown'
  | 'pool_float';

export interface WaterSlideState {
  state: WaterSlideStateKind;
  t: number;             // Flume progression 0..1
  speed: number;         // Current speed in m/s
  splashTimer: number;   // Seconds remaining in splashdown
  rideCount: number;
}

// Flume Waypoints: Grand 95m Winding Aqualoop Water Slide!
// Starts on Tower (y = 10.5m) on dry land (x = -74.5, z = 5.5),
// sweeps through a dramatic north panoramic hairpin loop, swoops east in an overhead glide,
// executes a thrilling figure-8 reverse corkscrew over the dry promenade,
// and dives into the Grand Resort Swimming Pool (x: -69.0 to -53.5)!
export const WATER_SLIDE_WAYPOINTS: ReadonlyArray<WaterSlideWaypoint> = [
  // 1. Tower Launch Basin (wooden launch tub on 10.5m top deck, rushing north)
  { x: -74.5, y: 10.5, z: 5.5, roll: 0.0 },
  // 2. High-speed north exit shoot accelerating down
  { x: -74.8, y: 9.8, z: 3.2, roll: -0.18 },
  // 3. Thrilling wide panoramic loop banking west-north in mid-air
  { x: -77.2, y: 9.0, z: 1.0, roll: -0.45 },
  // 4. Hairpin northern apex curve high above the park entrance
  { x: -74.5, y: 8.3, z: -1.2, roll: -0.52 },
  // 5. High-speed banked transition swinging eastward
  { x: -68.8, y: 7.6, z: -0.5, roll: 0.35 },
  // 6. Sweeping banked turn curving south-east with view of the museum facade
  { x: -63.5, y: 6.8, z: 1.8, roll: 0.48 },
  // 7. Long fast glide overhead above the park gardens
  { x: -60.8, y: 6.0, z: 4.8, roll: 0.36 },
  // 8. Reverse figure-8 S-curve diving west over the plaza
  { x: -63.2, y: 5.2, z: 7.8, roll: -0.35 },
  // 9. Thrilling corkscrew drop sweeping west over the sun lounger promenade
  { x: -69.5, y: 4.4, z: 9.5, roll: -0.45 },
  // 10. Banked horseshoe curve turning back south towards the swimming pool
  { x: -73.2, y: 3.6, z: 11.8, roll: 0.28 },
  // 11. High-speed plunge dive swooping south-east
  { x: -69.8, y: 2.7, z: 13.8, roll: 0.42 },
  // 12. Diving directly over the pool coping rim into the central swim lane
  { x: -65.0, y: 1.8, z: 15.2, roll: 0.25 },
  // 13. Flume leveling out smoothly just above pool water surface
  { x: -61.25, y: 1.0, z: 16.2, roll: 0.08 },
  // 14. Dramatic Splashdown! Enters sparkling pool water with spray
  { x: -61.25, y: 0.45, z: 17.5, roll: 0.0 },
  // 15. Skimming run-out across the deep blue swimming pool
  { x: -61.25, y: 0.42, z: 19.2, roll: 0.0 },
  // 16. Gentle floating dock at south pool rim
  { x: -61.25, y: 0.42, z: 20.0, roll: 0.0 },
];

export const SLIDE_TOTAL_LENGTH = 95.0; // Over 95 meters of winding, looping aquatube
export const SPLASHDOWN_PROGRESS = 0.82; // t >= 0.82 plunges into the swimming pool water

// Grand Resort Swimming Pool Geometry Bounds (x: -69.0 to -53.5, z: 11.5 to 20.5)
// Completely separate from the staircase (stairs are at x = -75.0, > 4.5m away on dry land!)
// and completely separate from Chorki (Chorki is at x = -45.0, > 2.9m away on dry land!)
export const SWIMMING_POOL_BOUNDS = {
  minX: -69.0,
  maxX: -53.5,
  minZ: 11.5,
  maxZ: 20.5,
  waterY: 0.42,
  depth: 1.45,
} as const;

export const WATER_TOWER_COORDS = {
  platformX: -75.0,
  platformY: 10.5,
  platformZ: 5.5,
  stairsStartX: -75.0,
  stairsStartZ: 18.0,
  interactRadius: 6.5,
} as const;

/**
 * Walkable Staircase Geometry & Elevation:
 * 100% on dry ground outside the pool (x: -76.5 to -73.5, z: 3.8 to 18.0).
 * Continuous heightfield so player can physically walk up step-by-step
 * from the ground (y = 0 at z = 18.0) to the 10.5m high Aqua Launch Tower!
 */
export const WATER_TOWER_STAIRS = {
  minX: -76.5,
  maxX: -73.5,
  centerX: -75.0,
  topDeckMinZ: 3.8,
  topDeckMaxZ: 7.1,
  upperFlightMinZ: 7.1,
  upperFlightMaxZ: 11.8,
  landingMinZ: 11.8,
  landingMaxZ: 13.0,
  lowerFlightMinZ: 13.0,
  lowerFlightMaxZ: 18.0,
  groundY: 0.0,
  landingY: 5.25,
  platformY: 10.5,
} as const;

export function computeWaterTowerStairY(x: number, z: number): number {
  if (x < WATER_TOWER_STAIRS.minX || x > WATER_TOWER_STAIRS.maxX) {
    return 0;
  }
  // 1. Top Observation & Slide Launch Deck (y = 10.5m)
  if (z >= WATER_TOWER_STAIRS.topDeckMinZ && z <= WATER_TOWER_STAIRS.topDeckMaxZ) {
    return WATER_TOWER_STAIRS.platformY;
  }
  // 2. Upper Stair Flight (rising from 5.25m at z=11.8 to 10.5m at z=7.1)
  if (z > WATER_TOWER_STAIRS.topDeckMaxZ && z < WATER_TOWER_STAIRS.landingMinZ) {
    const frac =
      (WATER_TOWER_STAIRS.landingMinZ - z) /
      (WATER_TOWER_STAIRS.landingMinZ - WATER_TOWER_STAIRS.topDeckMaxZ);
    return (
      WATER_TOWER_STAIRS.landingY +
      frac * (WATER_TOWER_STAIRS.platformY - WATER_TOWER_STAIRS.landingY)
    );
  }
  // 3. Mid-Flight Rest Landing (y = 5.25m)
  if (z >= WATER_TOWER_STAIRS.landingMinZ && z <= WATER_TOWER_STAIRS.landingMaxZ) {
    return WATER_TOWER_STAIRS.landingY;
  }
  // 4. Lower Stair Flight (rising from 0m at z=18.0 to 5.25m at z=13.0)
  if (z > WATER_TOWER_STAIRS.landingMaxZ && z <= WATER_TOWER_STAIRS.lowerFlightMaxZ) {
    const frac =
      (WATER_TOWER_STAIRS.lowerFlightMaxZ - z) /
      (WATER_TOWER_STAIRS.lowerFlightMaxZ - WATER_TOWER_STAIRS.landingMaxZ);
    return frac * WATER_TOWER_STAIRS.landingY;
  }
  return 0;
}

function catmullRom1D(p0: number, p1: number, p2: number, p3: number, u: number): number {
  const u2 = u * u;
  const u3 = u2 * u;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * u +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * u3)
  );
}

function catmullRomDerivative1D(p0: number, p1: number, p2: number, p3: number, u: number): number {
  const u2 = u * u;
  return (
    0.5 *
    (-p0 +
      p2 +
      2 * (2 * p0 - 5 * p1 + 4 * p2 - p3) * u +
      3 * (-p0 + 3 * p1 - 3 * p2 + p3) * u2)
  );
}

export function sampleWaterSlideSpline(
  t: number,
  waypoints: ReadonlyArray<WaterSlideWaypoint> = WATER_SLIDE_WAYPOINTS
): {
  x: number;
  y: number;
  z: number;
  tx: number;
  ty: number;
  tz: number;
  roll: number;
} {
  const n = waypoints.length;
  const clampedT = Math.max(0, Math.min(1, t));
  const p = clampedT * (n - 1);
  const idx = Math.min(Math.floor(p), n - 2);
  const u = p - idx;

  const i0 = Math.max(0, idx - 1);
  const i1 = idx;
  const i2 = Math.min(n - 1, idx + 1);
  const i3 = Math.min(n - 1, idx + 2);

  const w0 = waypoints[i0];
  const w1 = waypoints[i1];
  const w2 = waypoints[i2];
  const w3 = waypoints[i3];

  const x = catmullRom1D(w0.x, w1.x, w2.x, w3.x, u);
  const y = catmullRom1D(w0.y, w1.y, w2.y, w3.y, u);
  const z = catmullRom1D(w0.z, w1.z, w2.z, w3.z, u);

  const tx = catmullRomDerivative1D(w0.x, w1.x, w2.x, w3.x, u);
  const ty = catmullRomDerivative1D(w0.y, w1.y, w2.y, w3.y, u);
  const tz = catmullRomDerivative1D(w0.z, w1.z, w2.z, w3.z, u);

  const roll = catmullRom1D(w0.roll, w1.roll, w2.roll, w3.roll, u);

  return { x, y, z, tx, ty, tz, roll };
}

/**
 * Computes exact 6-DOF slider pose with guaranteed forward look vector.
 */
export function computeWaterSlidePoseAtT(
  t: number,
  speed = 8.0,
  waypoints: ReadonlyArray<WaterSlideWaypoint> = WATER_SLIDE_WAYPOINTS
): WaterSlidePose {
  const s = sampleWaterSlideSpline(t, waypoints);
  const hLen = Math.hypot(s.tx, s.tz) || 1e-5;
  const tLen = Math.hypot(s.tx, s.ty, s.tz) || 1e-5;

  const fwdX = s.tx / tLen;
  const fwdY = s.ty / tLen;
  const fwdZ = s.tz / tLen;

  const yaw = Math.atan2(s.tx, s.tz);
  const pitch = Math.atan2(s.ty, hLen);
  const rotX = -pitch;

  return {
    x: s.x,
    y: s.y,
    z: s.z,
    fwdX,
    fwdY,
    fwdZ,
    yaw,
    pitch,
    rotX,
    roll: s.roll,
    speed,
    isSplashdown: t >= SPLASHDOWN_PROGRESS,
  };
}

/**
 * Calculates instantaneous water slide velocity.
 * Rapid water-lubricated gravity acceleration down the flume drops,
 * followed by rapid hydrodynamic braking upon plunging into the swimming pool!
 */
export function computeWaterSlideVelocity(t: number): number {
  if (t < 0.08) {
    return 3.2; // Push-off from launch tub
  }
  if (t < SPLASHDOWN_PROGRESS) {
    // Water slide kinetic acceleration: v = sqrt(v0^2 + 2 * g * drop * 0.85)
    const drop = Math.max(0, WATER_TOWER_COORDS.platformY - sampleWaterSlideSpline(t).y);
    const v = Math.sqrt(12.0 + 2 * 9.81 * drop * 0.85);
    return Math.min(14.5, Math.max(4.0, v));
  }
  // Splashdown hydrodynamic braking
  const poolFrac = (t - SPLASHDOWN_PROGRESS) / (1.0 - SPLASHDOWN_PROGRESS);
  const vSplash = 11.5 * (1.0 - poolFrac * 0.82);
  return Math.max(1.8, vSplash);
}

/**
 * Step water slide simulation lifecycle.
 */
export function stepWaterSlideSimulation(
  state: WaterSlideState,
  dt: number,
  hasPlayerBoarded: boolean
): WaterSlideState {
  const next: WaterSlideState = { ...state };
  const delta = Math.min(Math.max(dt, 0.001), 0.1);

  switch (state.state) {
    case 'idle_docked': {
      next.t = 0.0;
      next.speed = 0;
      next.splashTimer = 0;
      if (hasPlayerBoarded) {
        next.state = 'sliding';
        next.speed = 3.5;
        next.t += (3.5 * delta) / SLIDE_TOTAL_LENGTH;
      }
      break;
    }

    case 'sliding': {
      const v = computeWaterSlideVelocity(next.t);
      next.speed = v;
      next.t += (v * delta) / SLIDE_TOTAL_LENGTH;

      if (next.t >= SPLASHDOWN_PROGRESS && next.t < 1.0) {
        next.state = 'splashdown';
        next.splashTimer = 2.4;
      } else if (next.t >= 1.0) {
        next.t = 1.0;
        next.state = 'pool_float';
        next.speed = 0.5;
        next.splashTimer = 3.0;
      }
      break;
    }

    case 'splashdown': {
      const v = computeWaterSlideVelocity(next.t);
      next.speed = v;
      next.t = Math.min(1.0, next.t + (v * delta) / SLIDE_TOTAL_LENGTH);
      next.splashTimer = Math.max(0, next.splashTimer - delta);

      if (next.t >= 1.0 || next.splashTimer <= 0) {
        next.state = 'pool_float';
        next.splashTimer = 3.0;
        next.speed = 0.6;
      }
      break;
    }

    case 'pool_float': {
      next.speed = 0.4;
      next.splashTimer = Math.max(0, next.splashTimer - delta);
      if (next.splashTimer <= 0) {
        // Ready to reset or dismount
        next.state = 'idle_docked';
        next.t = 0.0;
        next.rideCount += 1;
      }
      break;
    }
  }

  return next;
}

export function createInitialWaterSlideState(): WaterSlideState {
  return {
    state: 'idle_docked',
    t: 0.0,
    speed: 0,
    splashTimer: 0,
    rideCount: 0,
  };
}

// Swimmer definition inside the pool
export interface PoolSwimmerConfig {
  id: string;
  x: number;
  z: number;
  swimStyle: 'freestyle' | 'ring_float' | 'tread';
  color: number;
  swimPhase: number;
  speed: number;
}

export const POOL_SWIMMERS: ReadonlyArray<PoolSwimmerConfig> = [
  { id: 'swimmer-1', x: -65.5, z: 14.5, swimStyle: 'ring_float', color: 0xfacc15, swimPhase: 0.0, speed: 0.4 },
  { id: 'swimmer-2', x: -58.2, z: 15.5, swimStyle: 'freestyle', color: 0x06b6d4, swimPhase: 1.4, speed: 0.9 },
  { id: 'swimmer-3', x: -64.0, z: 18.5, swimStyle: 'ring_float', color: 0xf43f5e, swimPhase: 2.8, speed: 0.35 },
  { id: 'swimmer-4', x: -57.5, z: 17.2, swimStyle: 'tread', color: 0x10b981, swimPhase: 4.1, speed: 0.3 },
  { id: 'swimmer-5', x: -56.5, z: 19.5, swimStyle: 'freestyle', color: 0x8b5cf6, swimPhase: 5.5, speed: 0.85 },
  { id: 'swimmer-6', x: -63.5, z: 13.2, swimStyle: 'ring_float', color: 0x38bdf8, swimPhase: 0.8, speed: 0.38 },
];
