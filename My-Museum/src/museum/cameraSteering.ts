export interface SteeringInput {
  forward: number; // +1 (W / Up), -1 (S / Down), 0
  turn: number; // +1 (Left: A / ArrowLeft / Q), -1 (Right: D / ArrowRight / E), 0
  sprint: boolean;
}

export interface SteeringState {
  camYaw: number;
  avatarYaw: number;
}

export interface SteeringStepResult {
  camYaw: number;
  avatarYaw: number;
  moveDirX: number;
  moveDirZ: number;
  walkSpeed: number;
  animSpeed: number;
  isTurning: boolean;
  isMoving: boolean;
}

export const DEFAULT_WALK_SPEED = 4.8;
export const SPRINT_WALK_SPEED = 7.4;
export const CAMERA_TURN_SPEED = 2.05; // radians/sec when turning left or right

/**
 * Wraps any angle in radians strictly into [-PI, PI].
 * Keeps Firestore presence yaw values bounded and avoids wrap-around jumps.
 */
export function normalizeAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * Returns the signed shortest angular delta from `from` to `to` in [-PI, PI].
 */
export function shortestAngleDelta(from: number, to: number): number {
  return normalizeAngle(to - from);
}

/**
 * Computes the avatar Y rotation matching the camera's forward look vector (-sin(camYaw), -cos(camYaw)).
 */
export function computeForwardYaw(camYaw: number): number {
  return normalizeAngle(Math.atan2(-Math.sin(camYaw), -Math.cos(camYaw)));
}

/**
 * Advances third-person / first-person player heading and camera yaw together:
 * - Turning left (A / ArrowLeft / Q / mobile left) rotates BOTH camera & 3D avatar smoothly left.
 * - Turning right (D / ArrowRight / E / mobile right) rotates BOTH camera & 3D avatar smoothly right.
 * - Walking forward/back moves along the rotated camera axis so steering feels natural and cohesive.
 */
export function stepPlayerSteering(
  input: SteeringInput,
  state: SteeringState,
  delta: number
): SteeringStepResult {
  const dt = Math.min(Math.max(delta, 0.001), 0.1);
  const turn = Math.max(-1, Math.min(1, input.turn));
  const forward = Math.max(-1, Math.min(1, input.forward));

  const isTurning = Math.abs(turn) > 0.01;
  const isMoving = Math.abs(forward) > 0.01;

  // Rotate camera smoothly left/right whenever left/right steering is held
  const nextCamYaw = isTurning
    ? normalizeAngle(state.camYaw + turn * CAMERA_TURN_SPEED * dt)
    : normalizeAngle(state.camYaw);

  const forwardX = -Math.sin(nextCamYaw);
  const forwardZ = -Math.cos(nextCamYaw);

  const moveDirX = isMoving ? forwardX * Math.sign(forward) : 0;
  const moveDirZ = isMoving ? forwardZ * Math.sign(forward) : 0;
  const walkSpeed = isMoving ? (input.sprint ? SPRINT_WALK_SPEED : DEFAULT_WALK_SPEED) : 0;

  let nextAvatarYaw = normalizeAngle(state.avatarYaw);
  if (isMoving || isTurning) {
    const baseFacing = computeForwardYaw(nextCamYaw);
    const desiredAvatarYaw =
      isMoving && forward < 0 ? normalizeAngle(baseFacing + Math.PI) : baseFacing;
    const yawDiff = shortestAngleDelta(nextAvatarYaw, desiredAvatarYaw);
    const yawLerp = 1 - Math.exp(-13 * dt);
    nextAvatarYaw = normalizeAngle(nextAvatarYaw + yawDiff * yawLerp);
  }

  // Gentle foot-pivot stride animation when turning in place so the 3D model rotates naturally
  const animSpeed = isMoving ? walkSpeed : isTurning ? 1.65 : 0;

  return {
    camYaw: nextCamYaw,
    avatarYaw: nextAvatarYaw,
    moveDirX,
    moveDirZ,
    walkSpeed,
    animSpeed,
    isTurning,
    isMoving,
  };
}
