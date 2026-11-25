import { computeCoasterPoseAtT } from './rollerCoaster';
import { computeWaterSlidePoseAtT } from './waterRide';

export type AmusementRideKind = 'dolna' | 'chorki' | 'coaster' | 'waterslide';
export type ParkSide = 'west' | 'east';

export interface AmusementRideDefinition {
  id: string;
  kind: AmusementRideKind;
  side: ParkSide;
  title: string;
  banglishHint: string;
  x: number;
  z: number;
  hubY: number;
  armLength: number; // Pendulum chain length (dolna) or wheel radius (chorki)
  phase: number;
  interactRadius: number;
  dismountX: number;
  dismountZ: number;
}

export const AMUSEMENT_PARK_BOUNDS = {
  west: { minX: -82, maxX: -24, minZ: 1.5, maxZ: 21.5, centerX: -53, centerZ: 11.5 },
  east: { minX: 24, maxX: 85, minZ: 1.5, maxZ: 21.5, centerX: 54, centerZ: 11.5 },
} as const;

export const AMUSEMENT_RIDES: ReadonlyArray<AmusementRideDefinition> = [
  {
    id: 'ride-west-dolna',
    kind: 'dolna',
    side: 'west',
    title: 'West Park Dolna',
    banglishHint: 'Dolnay Uthun (Swing Ride)',
    x: -31.5,
    z: 12.0,
    hubY: 5.2,
    armLength: 3.85,
    phase: 0.0,
    interactRadius: 7.4,
    dismountX: -31.5,
    dismountZ: 19.0,
  },
  {
    id: 'ride-west-chorki',
    kind: 'chorki',
    side: 'west',
    title: 'West Park Chorki',
    banglishHint: 'Chorkite Uthun (Ferris Wheel)',
    x: -44.0,
    z: 10.5,
    hubY: 7.6,
    armLength: 5.6,
    phase: 0.0,
    interactRadius: 8.6,
    dismountX: -44.0,
    dismountZ: 18.0,
  },
  {
    id: 'ride-east-dolna',
    kind: 'dolna',
    side: 'east',
    title: 'East Park Dolna',
    banglishHint: 'Dolnay Uthun (Swing Ride)',
    x: 31.5,
    z: 12.0,
    hubY: 5.2,
    armLength: 3.85,
    phase: 1.35,
    interactRadius: 7.4,
    dismountX: 31.5,
    dismountZ: 19.0,
  },
  {
    id: 'ride-east-chorki',
    kind: 'chorki',
    side: 'east',
    title: 'East Park Chorki',
    banglishHint: 'Chorkite Uthun (Ferris Wheel)',
    x: 44.0,
    z: 10.5,
    hubY: 7.6,
    armLength: 5.6,
    phase: 0.9,
    interactRadius: 8.6,
    dismountX: 44.0,
    dismountZ: 18.0,
  },
  {
    id: 'ride-east-coaster',
    kind: 'coaster',
    side: 'east',
    title: 'East Park Roller Coaster',
    banglishHint: 'Rolar Coster e Uthun (Thrill Ride)',
    x: 61.0,
    z: 20.5,
    hubY: 2.2,
    armLength: 0,
    phase: 0,
    interactRadius: 8.8,
    dismountX: 61.0,
    dismountZ: 22.8,
  },
  {
    id: 'ride-west-waterslide',
    kind: 'waterslide',
    side: 'west',
    title: 'Tsunami Water Slide & Pool',
    banglishHint: 'Water Slide e Uthun (Pool Splash Ride)',
    x: -75.0,
    z: 5.5,
    hubY: 10.5,
    armLength: 0,
    phase: 0,
    interactRadius: 8.5,
    dismountX: -54.5,
    dismountZ: 16.0,
  },
];

export function isInsideAmusementPark(x: number, z: number): ParkSide | null {
  if (
    x >= AMUSEMENT_PARK_BOUNDS.west.minX &&
    x <= AMUSEMENT_PARK_BOUNDS.west.maxX &&
    z >= AMUSEMENT_PARK_BOUNDS.west.minZ &&
    z <= AMUSEMENT_PARK_BOUNDS.west.maxZ
  ) {
    return 'west';
  }
  if (
    x >= AMUSEMENT_PARK_BOUNDS.east.minX &&
    x <= AMUSEMENT_PARK_BOUNDS.east.maxX &&
    z >= AMUSEMENT_PARK_BOUNDS.east.minZ &&
    z <= AMUSEMENT_PARK_BOUNDS.east.maxZ
  ) {
    return 'east';
  }
  return null;
}

export function findNearestAmusementRide(
  px: number,
  pz: number,
  rides: ReadonlyArray<AmusementRideDefinition> = AMUSEMENT_RIDES
): AmusementRideDefinition | null {
  let nearest: AmusementRideDefinition | null = null;
  let bestDist = Infinity;
  for (const ride of rides) {
    const dist = Math.hypot(px - ride.x, pz - ride.z);
    if (dist <= ride.interactRadius && dist < bestDist) {
      bestDist = dist;
      nearest = ride;
    }
  }
  return nearest;
}

export function getAmusementRideById(id: string): AmusementRideDefinition | null {
  return AMUSEMENT_RIDES.find((r) => r.id === id) ?? null;
}

/**
 * Smooth sinusoidal pendulum angle (radians) for a Dolna swing seat.
 * Holding W / Shift boosts swing height gently up to ~55 degrees.
 */
export function computeDolnaSwingAngle(
  elapsedSec: number,
  phase = 0,
  boostActive = false
): number {
  const maxArc = boostActive ? 0.92 : 0.62;
  const freq = boostActive ? 2.05 : 1.75;
  return Math.sin(elapsedSec * freq + phase) * maxArc;
}

/**
 * Continuous rotation angle (radians) for a Chorki Ferris wheel.
 */
export function computeChorkiWheelAngle(
  elapsedSec: number,
  phase = 0,
  boostActive = false
): number {
  const angVel = boostActive ? 0.68 : 0.38;
  return elapsedSec * angVel + phase;
}

/**
 * Computes exact world-space coordinates for the player's seat on either a Dolna or Chorki,
 * keeping riders grounded above y >= 0.8 and rising smoothly up to ~13m on the Chorki!
 */
export function computeRideSeatWorldPosition(
  ride: AmusementRideDefinition,
  elapsedSec: number,
  boostActive = false
): { x: number; y: number; z: number; yaw: number; pitch: number; roll: number } {
  if (ride.kind === 'coaster') {
    const p = computeCoasterPoseAtT(0, 0);
    return { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, roll: p.roll };
  }

  if (ride.kind === 'waterslide') {
    const p = computeWaterSlidePoseAtT(0, 0);
    return { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, roll: p.roll };
  }

  if (ride.kind === 'dolna') {
    const swingAngle = computeDolnaSwingAngle(elapsedSec, ride.phase, boostActive);
    // Player sits in the right-side bench (local +1.35 on X), swinging back & forth along Z
    const seatX = ride.x + 1.35;
    const seatY = ride.hubY - Math.cos(swingAngle) * ride.armLength;
    const seatZ = ride.z + Math.sin(swingAngle) * ride.armLength;
    return { x: seatX, y: seatY, z: seatZ, yaw: 0, pitch: -swingAngle, roll: 0 };
  }

  // Chorki (Ferris Wheel): wheel spins in the X-Y plane so riders see the Museum & Highway!
  const wheelAngle = computeChorkiWheelAngle(elapsedSec, ride.phase, boostActive);
  // Boarding cabin sits at local rim angle = -PI/2 (bottom boarding point at angle = 0)
  const rimAngle = wheelAngle - Math.PI / 2;
  const centerX = ride.x + Math.cos(rimAngle) * ride.armLength;
  // Inside the gondola cabin (floor base is at -1.25, bench seat is at -0.98 below pivot gy)
  const cabinSeatY = ride.hubY + Math.sin(rimAngle) * ride.armLength - 0.98;
  // Player sits comfortably on the left bench inside the cabin
  const seatX = centerX - 0.32;
  return { x: seatX, y: cabinSeatY, z: ride.z, yaw: 0, pitch: 0, roll: 0 };
}

/**
 * Computes exact world-space coordinates for a co-visitor / companion seated alongside
 * the host player in any active amusement ride (Chorki cabin, Dolna boat, Coaster, or Water Slide).
 */
export function computeCompanionRideSeatPosition(
  ride: AmusementRideDefinition,
  elapsedSec: number,
  boostActive = false
): { x: number; y: number; z: number; yaw: number; pitch: number; roll: number } {
  if (ride.kind === 'coaster') {
    const p = computeCoasterPoseAtT(0, 0);
    const rightX = -Math.cos(p.yaw);
    const rightZ = Math.sin(p.yaw);
    return {
      x: p.x + p.fwdX * 0.36 + rightX * 0.28,
      y: p.y + 0.14 + p.fwdY * 0.36,
      z: p.z + p.fwdZ * 0.36 + rightZ * 0.28,
      yaw: p.yaw,
      pitch: p.pitch,
      roll: p.roll,
    };
  }

  if (ride.kind === 'waterslide') {
    const p = computeWaterSlidePoseAtT(0, 0);
    const fwdX = Math.sin(p.yaw);
    const fwdZ = Math.cos(p.yaw);
    return {
      x: p.x - fwdX * 0.75,
      y: p.y + 0.12 - p.fwdY * 0.75,
      z: p.z - fwdZ * 0.75,
      yaw: p.yaw,
      pitch: p.pitch,
      roll: p.roll,
    };
  }

  if (ride.kind === 'dolna') {
    const swingAngle = computeDolnaSwingAngle(elapsedSec, ride.phase, boostActive);
    // Companion sits on the facing left-side bench (local -1.35 on X), swinging synchronously
    const seatX = ride.x - 1.35;
    const seatY = ride.hubY - Math.cos(swingAngle) * ride.armLength;
    const seatZ = ride.z + Math.sin(swingAngle) * ride.armLength;
    return { x: seatX, y: seatY, z: seatZ, yaw: Math.PI, pitch: swingAngle, roll: 0 };
  }

  // Chorki (Ferris Wheel): companion sits side-by-side on the right bench inside the SAME cabin!
  const wheelAngle = computeChorkiWheelAngle(elapsedSec, ride.phase, boostActive);
  const rimAngle = wheelAngle - Math.PI / 2;
  const centerX = ride.x + Math.cos(rimAngle) * ride.armLength;
  const cabinSeatY = ride.hubY + Math.sin(rimAngle) * ride.armLength - 0.98;
  const seatX = centerX + 0.32;
  return { x: seatX, y: cabinSeatY, z: ride.z, yaw: 0, pitch: 0, roll: 0 };
}
