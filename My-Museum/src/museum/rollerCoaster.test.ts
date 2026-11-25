import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  COASTER_WAYPOINTS,
  computeCoasterPoseAtT,
  computeCoasterVelocity,
  createInitialCoasterState,
  sampleCoasterSpline,
  stepCoasterSimulation,
} from './rollerCoaster.ts';

describe('Roller Coaster Spline, Energy Physics & Ride State Machine', () => {
  it('generates a smooth continuous closed-loop track matching waypoints', () => {
    assert.ok(COASTER_WAYPOINTS.length >= 8);
    const pStart = sampleCoasterSpline(0.0);
    const pEnd = sampleCoasterSpline(1.0);

    // Closed loop continuity: t=0 and t=1 must match seamlessly
    assert.ok(Math.abs(pStart.x - pEnd.x) < 0.001);
    assert.ok(Math.abs(pStart.y - pEnd.y) < 0.001);
    assert.ok(Math.abs(pStart.z - pEnd.z) < 0.001);
    assert.ok(Math.abs(pStart.tx - pEnd.tx) < 0.001);
    assert.ok(Math.abs(pStart.ty - pEnd.ty) < 0.001);
    assert.ok(Math.abs(pStart.tz - pEnd.tz) < 0.001);

    // Track rises to crest > 15m and drops below 3m
    let maxY = -Infinity;
    let minY = Infinity;
    for (let i = 0; i < 100; i++) {
      const p = sampleCoasterSpline(i / 100);
      maxY = Math.max(maxY, p.y);
      minY = Math.min(minY, p.y);
    }
    assert.ok(maxY > 15.0, 'Coaster crest rises above 15m');
    assert.ok(minY < 3.0, 'Coaster drop reaches ground elevation under 3m');
  });

  it('calculates proper 6-DOF cart orientation (pitch, yaw, banking roll)', () => {
    const poseAtStation = computeCoasterPoseAtT(0.02);
    // Station is flat (pitch near zero)
    assert.ok(Math.abs(poseAtStation.pitch) < 0.2);

    const poseAtLift = computeCoasterPoseAtT(0.20);
    // Lift hill pitches upward (positive pitch, upward forward vector, negative rotX in Three.js)
    assert.ok(poseAtLift.pitch > 0.35, 'Cart pitches upward on lift hill');
    assert.ok(poseAtLift.fwdY > 0.3, 'Forward vector points upward towards crest');
    assert.ok(poseAtLift.rotX < -0.35, 'Three.js Euler rotX is negative so nose tilts up');

    const poseAtDrop = computeCoasterPoseAtT(0.41);
    // Mega Drop pitches steeply downward (negative pitch, downward forward vector, positive rotX in Three.js)
    assert.ok(poseAtDrop.pitch < -0.3, 'Cart pitches steeply downward on drop');
    assert.ok(poseAtDrop.fwdY < -0.3, 'Forward vector points downward on drop');
    assert.ok(poseAtDrop.rotX > 0.3, 'Three.js Euler rotX is positive so nose tilts down');

    // Overbanked curve has inward banking roll
    const poseAtBank = computeCoasterPoseAtT(0.55);
    assert.ok(Math.abs(poseAtBank.roll) > 0.25, 'Cart banks into high-speed curve');
  });

  it('provides a 24.5m mega crest beside Chorki with zero overlap', () => {
    // Coaster track spans outer east zone (x >= 55.0)
    for (const wp of COASTER_WAYPOINTS) {
      assert.ok(wp.x >= 55.0, `Waypoint at x=${wp.x} is on the outer east side (x >= 55)`);
      assert.ok(wp.z >= -2.0 && wp.z <= 22.0, `Waypoint at z=${wp.z} stays safely in park`);
    }

    // Zero overlap with East Chorki (Chorki center is x=45.0, wheel radius 5.6m, outer edge x=50.6)
    const chorkiOuterEdgeX = 50.6;
    const minCoasterX = Math.min(...COASTER_WAYPOINTS.map((w) => w.x));
    assert.ok(
      minCoasterX > chorkiOuterEdgeX + 4.0,
      'Coaster is separated from Chorki wheel by at least 4m wide dry promenade'
    );

    // Terrifying mega crest height: 24.5m
    const maxCoasterY = Math.max(...COASTER_WAYPOINTS.map((w) => w.y));
    assert.ok(maxCoasterY >= 24.0, 'Mega crest height is over 24m');
  });

  it('simulates realistic energy physics: slow lift hill and high-speed drop acceleration', () => {
    const vLift = computeCoasterVelocity(0.2);
    const vCrest = computeCoasterVelocity(0.38);
    const vDropBottom = computeCoasterVelocity(0.62);

    assert.ok(vLift > 3.0 && vLift < 7.0, 'Lift hill speed is steady and controlled');
    assert.ok(vDropBottom > 13.0, 'Drop accelerates train to thrilling high speed (>45 km/h)');
    assert.ok(vDropBottom > vCrest, 'Train is much faster at the bottom of drop than at crest');

    const vBoosted = computeCoasterVelocity(0.62, true);
    assert.ok(vBoosted > vDropBottom, 'Holding speed boost increases coaster speed');
  });

  it('manages ride lifecycle: waiting -> boarding -> countdown -> climbing -> racing -> braking -> docking', () => {
    let s = createInitialCoasterState();
    assert.equal(s.state, 'docked_empty');

    // Player boards coaster at station
    s = stepCoasterSimulation(s, 0.1, true);
    assert.equal(s.state, 'docked_boarded');

    // Countdown begins
    s = stepCoasterSimulation(s, 0.1, true);
    assert.equal(s.state, 'countdown');
    assert.ok(s.countdownSeconds <= 3.0);

    // Step countdown past 3 seconds
    for (let i = 0; i < 35; i++) {
      s = stepCoasterSimulation(s, 0.1, true);
    }
    assert.equal(s.state, 'climbing');
    assert.ok(s.t > 0, 'Coaster has launched onto the track');

    // Advance through the entire loop until it docks back at station
    let iterations = 0;
    while (s.state !== 'docked_boarded' && iterations < 500) {
      s = stepCoasterSimulation(s, 0.1, true);
      iterations++;
    }
    assert.equal(s.state, 'docked_boarded', 'Coaster completed the loop and docked safely at station');
    assert.equal(s.lapCount, 1);
  });
});
