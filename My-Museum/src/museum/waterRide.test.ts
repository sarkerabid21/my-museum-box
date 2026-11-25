import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  WATER_SLIDE_WAYPOINTS,
  computeWaterSlidePoseAtT,
  computeWaterSlideVelocity,
  createInitialWaterSlideState,
  sampleWaterSlideSpline,
  stepWaterSlideSimulation,
  SWIMMING_POOL_BOUNDS,
  WATER_TOWER_COORDS,
  computeWaterTowerStairY,
} from './waterRide';

describe('Water Slide & Swimming Pool Aquapark Simulation', () => {
  it('starts at the high tower platform and terminates in the swimming pool', () => {
    const startPose = sampleWaterSlideSpline(0.0);
    const endPose = sampleWaterSlideSpline(1.0);

    // Tower launch height should be near 9.5m
    assert.ok(Math.abs(startPose.y - WATER_TOWER_COORDS.platformY) < 0.5);
    // End should plunge into swimming pool basin
    assert.ok(endPose.y < 0.8, 'Slide ends low near the pool surface');
    assert.ok(
      endPose.x >= SWIMMING_POOL_BOUNDS.minX && endPose.x <= SWIMMING_POOL_BOUNDS.maxX,
      'Splashdown is horizontally within swimming pool'
    );
    assert.ok(
      endPose.z >= SWIMMING_POOL_BOUNDS.minZ && endPose.z <= SWIMMING_POOL_BOUNDS.maxZ,
      'Splashdown is in pool along Z'
    );
  });

  it('calculates proper forward look vector and pitch for slider POV', () => {
    const poseAtDrop = computeWaterSlidePoseAtT(0.45);
    // Downward slope on flume drop
    assert.ok(poseAtDrop.fwdY < -0.1, 'Forward vector points downward along slide slope');
    assert.ok(poseAtDrop.pitch < -0.1, 'Pitch angle is negative on drop');
    assert.ok(poseAtDrop.rotX > 0.1, 'Three.js rotX is positive so slider tilts forward into drop');

    // Unit vector length should equal 1
    const len = Math.hypot(poseAtDrop.fwdX, poseAtDrop.fwdY, poseAtDrop.fwdZ);
    assert.ok(Math.abs(len - 1.0) < 0.001);
  });

  it('accelerates rapidly down the flume and brakes upon hitting pool water', () => {
    const vLaunch = computeWaterSlideVelocity(0.05);
    const vDrop = computeWaterSlideVelocity(0.65);
    const vSplash = computeWaterSlideVelocity(0.95);

    assert.ok(vDrop > vLaunch + 4.0, 'Slider accelerates rapidly down flume drops (>8 m/s)');
    assert.ok(vSplash < vDrop * 0.45, 'Water resistance rapidly brakes slider in the pool');
  });

  it('progresses smoothly through slide, splashdown, and pool float lifecycle', () => {
    let s = createInitialWaterSlideState();
    assert.equal(s.state, 'idle_docked');

    // Board slide
    s = stepWaterSlideSimulation(s, 0.1, true);
    assert.equal(s.state, 'sliding');
    assert.ok(s.t > 0);

    // Step through to splashdown
    let iters = 0;
    while (s.state === 'sliding' && iters < 200) {
      s = stepWaterSlideSimulation(s, 0.1, true);
      iters++;
    }
    assert.equal(s.state, 'splashdown');
    assert.ok(s.splashTimer > 0);

    // Step through splashdown to pool float
    while (s.state === 'splashdown' && iters < 300) {
      s = stepWaterSlideSimulation(s, 0.1, true);
      iters++;
    }
    assert.equal(s.state, 'pool_float');
  });

  it('calculates continuous walkable staircase elevation (0 to 10.5m) for player ascent', () => {
    // 1. Ground level at bottom of stairs (z >= 18.0)
    assert.equal(computeWaterTowerStairY(-75.0, 18.2), 0);
    assert.equal(computeWaterTowerStairY(-75.0, 18.0), 0);

    // 2. Ascending lower flight (z: 18.0 -> 13.0)
    const midLowerY = computeWaterTowerStairY(-75.0, 15.5);
    assert.ok(midLowerY > 2.0 && midLowerY < 3.5, 'Smooth elevation halfway up lower flight');

    // 3. Mid landing deck (z: 13.0 -> 11.8)
    assert.equal(computeWaterTowerStairY(-75.0, 12.4), 5.25);

    // 4. Ascending upper flight (z: 11.8 -> 7.1)
    const midUpperY = computeWaterTowerStairY(-75.0, 9.45);
    assert.ok(midUpperY > 7.0 && midUpperY < 8.8, 'Smooth elevation halfway up upper flight');

    // 5. Top observation & slide launch deck (z: 7.1 -> 3.8)
    assert.equal(computeWaterTowerStairY(-75.0, 5.5), 10.5);
    assert.equal(computeWaterTowerStairY(-75.0, 4.0), 10.5);

    // 6. Outside stair width corridor returns 0
    assert.equal(computeWaterTowerStairY(-60.0, 5.0), 0);
    assert.equal(computeWaterTowerStairY(-80.0, 5.0), 0);
  });

  it('provides an enlarged resort swimming pool on the empty outer west side with zero overlap', () => {
    const poolWidth = SWIMMING_POOL_BOUNDS.maxX - SWIMMING_POOL_BOUNDS.minX;
    const poolLength = SWIMMING_POOL_BOUNDS.maxZ - SWIMMING_POOL_BOUNDS.minZ;
    assert.ok(poolWidth >= 15.0, 'Pool is over 15 meters wide');
    assert.ok(poolLength >= 6.5, 'Pool is over 6.5 meters long');

    // Tower, stairs and pool are situated on the empty outer west side
    // Chorki is at x = -45.0 (wheel extends to -50.6m), so zero overlap!
    assert.ok(SWIMMING_POOL_BOUNDS.maxX <= -53.0, 'Pool is situated west of Chorki with zero overlap');
    assert.ok(WATER_TOWER_COORDS.platformX <= -70.0, 'Tower is situated west of Chorki with zero overlap');

    // Dry land separation: stairs are completely outside the pool water
    assert.ok(
      SWIMMING_POOL_BOUNDS.minX > WATER_TOWER_COORDS.platformX + 4.0,
      'Stairs and tower are separated from pool water by a wide dry promenade'
    );
  });
});
