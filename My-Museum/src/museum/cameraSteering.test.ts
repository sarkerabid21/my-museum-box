import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeForwardYaw,
  normalizeAngle,
  shortestAngleDelta,
  stepPlayerSteering,
} from './cameraSteering';

test('normalizeAngle wraps large angles cleanly into [-PI, PI]', () => {
  const a = normalizeAngle(Math.PI * 3.5);
  assert.ok(a >= -Math.PI && a <= Math.PI);
  assert.ok(Math.abs(a - -Math.PI / 2) < 1e-6);
});

test('shortestAngleDelta crosses PI boundary without 360-degree spin', () => {
  const delta = shortestAngleDelta(Math.PI - 0.1, -Math.PI + 0.1);
  assert.ok(Math.abs(delta - 0.2) < 1e-6);
});

test('turning left rotates both camera yaw and 3D avatar yaw smoothly left', () => {
  let state = { camYaw: 0, avatarYaw: computeForwardYaw(0) };
  for (let i = 0; i < 15; i++) {
    const res = stepPlayerSteering({ forward: 0, turn: 1, sprint: false }, state, 0.05);
    state = { camYaw: res.camYaw, avatarYaw: res.avatarYaw };
    assert.ok(res.animSpeed > 0, 'turning in place should trigger natural pivot step animation');
  }
  assert.ok(state.camYaw > 1.0, 'camera yaw should rotate left (positive)');
  const expectedAvatarYaw = computeForwardYaw(state.camYaw);
  assert.ok(
    Math.abs(shortestAngleDelta(state.avatarYaw, expectedAvatarYaw)) < 0.25,
    'avatar heading should follow rotated camera heading'
  );
});

test('turning right while walking forward curves both camera and movement vector right', () => {
  const initial = { camYaw: 0, avatarYaw: computeForwardYaw(0) };
  const step = stepPlayerSteering({ forward: 1, turn: -1, sprint: false }, initial, 0.1);
  assert.ok(step.camYaw < 0, 'camera yaw should rotate right (negative)');
  assert.ok(step.moveDirX > 0, 'walking forward while turning right should curve toward +X');
  assert.ok(step.moveDirZ < 0, 'walking forward should still advance toward -Z');
  assert.equal(step.isMoving, true);
  assert.equal(step.isTurning, true);
});

test('no input leaves camera and avatar heading unchanged (preserves manual mouse orbit)', () => {
  const state = { camYaw: 1.2, avatarYaw: -0.4 };
  const step = stepPlayerSteering({ forward: 0, turn: 0, sprint: false }, state, 0.05);
  assert.equal(step.camYaw, 1.2);
  assert.equal(step.avatarYaw, -0.4);
  assert.equal(step.walkSpeed, 0);
  assert.equal(step.animSpeed, 0);
});
