export interface CoasterWaypoint {
  x: number;
  y: number;
  z: number;
  roll?: number; // Optional banking override in radians
}

export interface CoasterPose {
  x: number;
  y: number;
  z: number;
  tx: number;
  ty: number;
  tz: number;
  fwdX: number; // Normalized forward direction unit vector along track
  fwdY: number;
  fwdZ: number;
  yaw: number;   // Y-axis rotation (heading)
  pitch: number; // Mathematical pitch in radians (positive when climbing upward, negative when diving downward)
  rotX: number;  // Three.js Euler X rotation (-pitch) for realistic nose tilt
  roll: number;  // Z-axis bank (leaning into turns)
  speed: number; // Current instantaneous speed in m/s
  height: number;
}

export type CoasterRideState =
  | 'docked_empty'
  | 'docked_boarded'
  | 'countdown'
  | 'climbing'
  | 'racing'
  | 'braking';

export interface CoasterState {
  state: CoasterRideState;
  t: number;             // Track progression 0..1
  speed: number;         // Current speed in m/s
  countdownSeconds: number; // Countdown before launch
  lapCount: number;
  boostActive: boolean;
}

// Mega Closed-loop track layout situated on the East Amusement Park (x: 56.5 to 83.5, z: -0.5 to 20.5)
// Positioned beside the Chorki (Chorki is at x = 45.0, wheel ends at x = 50.6) with zero overlap!
// Features a 24.5m Sky Crest, 85-degree mega first drop, overbanked hammerhead, camelback airtime hills & corkscrew!
export const COASTER_WAYPOINTS: ReadonlyArray<CoasterWaypoint> = [
  // 1. Station Platform (boarding & disembarking zone, flat & straight, centered at x: 61, z: 20.5)
  { x: 58.0, y: 2.2, z: 20.5, roll: 0.0 },
  { x: 64.0, y: 2.2, z: 20.5, roll: 0.0 },
  // 2. Turn entering the motorized lift hill
  { x: 71.0, y: 2.8, z: 19.5, roll: 0.15 },
  { x: 76.0, y: 4.2, z: 17.5, roll: 0.08 },
  // 3. Mega Chain Lift Hill (steep motorized climb soaring up to 24.5m high!)
  { x: 80.0, y: 9.5, z: 14.0, roll: 0.0 },
  { x: 82.5, y: 16.8, z: 9.5, roll: 0.0 },
  { x: 83.5, y: 24.5, z: 4.5, roll: 0.0 }, // CREST: 24.5 METERS HIGH!
  // 4. Pre-drop crest curve (smooth inward bank)
  { x: 81.5, y: 24.0, z: 1.2, roll: 0.35 },
  { x: 76.0, y: 22.2, z: -0.5, roll: 0.45 },
  // 5. VONGKOR 85-DEGREE MEGA FIRST DROP (Plunges from 24.5m to 2.4m, speed rockets to >90 km/h!)
  { x: 70.0, y: 12.5, z: 0.5, roll: 0.30 },
  { x: 64.0, y: 2.4, z: 2.5, roll: 0.15 },
  // 6. High-Speed Overbanked Turn / Sky Hammerhead
  { x: 57.5, y: 8.5, z: 5.5, roll: -0.55 },
  { x: 56.5, y: 15.2, z: 9.5, roll: -0.65 },
  { x: 58.5, y: 11.0, z: 13.5, roll: -0.42 },
  // 7. Camelback Airtime Hill (rising high and diving with zero-g weightlessness)
  { x: 63.5, y: 3.2, z: 15.8, roll: 0.12 },
  { x: 69.5, y: 11.5, z: 14.5, roll: 0.20 },
  { x: 75.0, y: 3.5, z: 11.0, roll: -0.25 },
  // 8. Thrilling Banked S-Curve & Serpentine Dive
  { x: 74.0, y: 7.2, z: 6.5, roll: 0.55 },
  { x: 68.0, y: 4.8, z: 8.5, roll: -0.38 },
  { x: 61.5, y: 2.8, z: 12.0, roll: 0.15 },
  // 9. Magnetic Eddy-Current Brake Run & Smooth Docking Approach
  { x: 56.5, y: 2.2, z: 16.0, roll: -0.05 },
  { x: 56.5, y: 2.2, z: 19.5, roll: 0.0 },
];

export const TOTAL_TRACK_APPROX_LENGTH = 215.0; // Over 215 meters of mega steel track!
export const STATION_PROGRESS_START = 0.0;
export const LIFT_HILL_START = 0.09;
export const CREST_PROGRESS = 0.27;
export const BRAKE_RUN_START = 0.88;

/**
 * Catmull-Rom cubic interpolation for 4 points.
 */
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

/**
 * Samples continuous 3D position and tangent vector on the closed-loop spline at progress t in [0, 1].
 */
export function sampleCoasterSpline(
  t: number,
  waypoints: ReadonlyArray<CoasterWaypoint> = COASTER_WAYPOINTS
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
  const normT = ((t % 1) + 1) % 1;
  const p = normT * n;
  const idx = Math.floor(p);
  const u = p - idx;

  const i0 = (idx - 1 + n) % n;
  const i1 = idx % n;
  const i2 = (idx + 1) % n;
  const i3 = (idx + 2) % n;

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

  const r0 = w0.roll ?? 0;
  const r1 = w1.roll ?? 0;
  const r2 = w2.roll ?? 0;
  const r3 = w3.roll ?? 0;
  const roll = catmullRom1D(r0, r1, r2, r3, u);

  return { x, y, z, tx, ty, tz, roll };
}

/**
 * Calculates full 6-DOF pose (position + yaw, pitch, roll) of a coaster cart at spline progression t.
 */
export function computeCoasterPoseAtT(
  t: number,
  speed = 10,
  waypoints: ReadonlyArray<CoasterWaypoint> = COASTER_WAYPOINTS
): CoasterPose {
  const s = sampleCoasterSpline(t, waypoints);
  const hLen = Math.hypot(s.tx, s.tz) || 1e-5;
  const tLen = Math.hypot(s.tx, s.ty, s.tz) || 1e-5;

  // Normalized 3D forward direction unit vector along track
  const fwdX = s.tx / tLen;
  const fwdY = s.ty / tLen;
  const fwdZ = s.tz / tLen;

  // Yaw angle in Three.js coordinate system (0 is +Z, +PI/2 is +X)
  const yaw = Math.atan2(s.tx, s.tz);
  // Mathematical pitch (positive tilts nose upward when climbing, negative when diving downward)
  const pitch = Math.atan2(s.ty, hLen);
  // Three.js Euler X rotation: with local +Z forward and 'YXZ' order, rotation.x = -pitch tilts the 3D model's nose upward!
  const rotX = -pitch;
  // Roll angle (banking lean)
  const roll = s.roll;

  return {
    x: s.x,
    y: s.y,
    z: s.z,
    tx: s.tx,
    ty: s.ty,
    tz: s.tz,
    fwdX,
    fwdY,
    fwdZ,
    yaw,
    pitch,
    rotX,
    roll,
    speed,
    height: s.y,
  };
}

/**
 * Calculates instantaneous coaster velocity based on track height and energy conservation.
 */
export function computeCoasterVelocity(t: number, boostActive = false): number {
  const normT = ((t % 1) + 1) % 1;

  // Station zone: crawling speed
  if (normT < LIFT_HILL_START) {
    return 3.2;
  }

  // Chain Lift Hill: motorized steady mechanical climb
  if (normT < CREST_PROGRESS) {
    return boostActive ? 6.2 : 4.4;
  }

  // Brake Run: smooth friction deceleration
  if (normT >= BRAKE_RUN_START) {
    const brakeFraction = (normT - BRAKE_RUN_START) / (1.0 - BRAKE_RUN_START);
    const brakeSpeed = 16.0 * (1.0 - brakeFraction * 0.82);
    return Math.max(2.8, brakeSpeed);
  }

  // Gravity-driven racing segment (crest down to drops and hills)
  const s = sampleCoasterSpline(normT);
  const maxHeight = 24.5;
  const heightDrop = Math.max(0, maxHeight - s.y);
  // v = sqrt(v0^2 + 2 * g * h_drop * efficiency)
  const baseV0 = 5.2;
  const gravity = 9.81;
  const efficiency = 0.88;
  let v = Math.sqrt(baseV0 * baseV0 + 2 * gravity * heightDrop * efficiency);

  if (boostActive) {
    v *= 1.30;
  }

  return Math.min(27.0, Math.max(4.5, v));
}

/**
 * Advances the roller coaster simulation state forward by dt seconds.
 */
export function stepCoasterSimulation(
  state: CoasterState,
  dt: number,
  hasPlayerBoarded: boolean
): CoasterState {
  const next: CoasterState = { ...state };
  const delta = Math.min(Math.max(dt, 0.001), 0.1);

  if (!hasPlayerBoarded && (state.state === 'docked_boarded' || state.state === 'countdown')) {
    // If player left before launch, reset to waiting
    next.state = 'docked_empty';
    next.countdownSeconds = 3.0;
    next.speed = 0;
    return next;
  }

  switch (state.state) {
    case 'docked_empty': {
      next.t = 0.0;
      next.speed = 0;
      next.countdownSeconds = 3.0;
      if (hasPlayerBoarded) {
        next.state = 'docked_boarded';
      }
      break;
    }

    case 'docked_boarded': {
      next.state = 'countdown';
      next.countdownSeconds = 3.0;
      break;
    }

    case 'countdown': {
      next.countdownSeconds = Math.max(0, state.countdownSeconds - delta);
      if (next.countdownSeconds <= 0) {
        next.state = 'climbing';
      }
      break;
    }

    case 'climbing':
    case 'racing':
    case 'braking': {
      const v = computeCoasterVelocity(state.t, state.boostActive);
      next.speed = v;

      // dt * speed / total_length
      const dtStep = (v * delta) / TOTAL_TRACK_APPROX_LENGTH;
      next.t += dtStep;

      if (next.t >= 1.0) {
        next.t = 0.0;
        next.lapCount += 1;
        next.state = 'docked_boarded';
        next.countdownSeconds = 3.0;
        next.speed = 0;
      } else if (next.t >= BRAKE_RUN_START) {
        next.state = 'braking';
      } else if (next.t >= CREST_PROGRESS) {
        next.state = 'racing';
      } else {
        next.state = 'climbing';
      }
      break;
    }
  }

  return next;
}

/**
 * Creates the initial coaster simulation state.
 */
export function createInitialCoasterState(): CoasterState {
  return {
    state: 'docked_empty',
    t: 0.0,
    speed: 0,
    countdownSeconds: 3.0,
    lapCount: 0,
    boostActive: false,
  };
}
