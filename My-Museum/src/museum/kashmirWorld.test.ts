import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KASHMIR_HIGHWAY_WAYPOINTS,
  KASHMIR_BOUNDS,
  getKashmirSubZone,
  computeKashmirElevation,
  createSnowmanBuilderState,
  rollSnowball,
  customizeSnowman,
  finalizeSnowman,
  createSnowball,
  stepSnowballs,
  INITIAL_KASHMIR_NPCS,
  GONDOLA_BASE_STATION,
  GONDOLA_SUMMIT_STATION,
  createInitialGondolaSystemState,
  computeGondolaPoseAtT,
  stepGondolaSimulation,
  findBoardableGondola,
  createInitialWinterKinematics,
  stepSkiPhysics,
} from './kashmirWorld';

test('Kashmir Highway corridor connects seamlessly from CTG Zero Point into Kashmir peaks', () => {
  assert.ok(KASHMIR_HIGHWAY_WAYPOINTS.length >= 7, 'Must have at least 7 scenic waypoints');
  assert.equal(KASHMIR_HIGHWAY_WAYPOINTS[0].x, -395.0, 'Starts at CTG Zero Point');
  assert.ok(KASHMIR_HIGHWAY_WAYPOINTS[KASHMIR_HIGHWAY_WAYPOINTS.length - 1].x <= -740.0, 'Extends deep into Kashmir');

  // Verify elevations and subzones across the journey
  assert.equal(getKashmirSubZone(-450, 68), 'transition');
  assert.equal(getKashmirSubZone(-540, 68), 'village');
  assert.equal(getKashmirSubZone(-610, 40), 'frozen_lake');
  assert.equal(getKashmirSubZone(-610, 80), 'snowman_arena');
  assert.equal(getKashmirSubZone(-665, 125), 'gondola_base');
  assert.equal(getKashmirSubZone(-755, 185, 36.0), 'gondola_summit');
  assert.equal(getKashmirSubZone(-720, 120), 'ski_slope');
});

test('computeKashmirElevation: continuous elevation on frozen lake, highway, and mountain ski slopes', () => {
  // Frozen Dal Lake is flat ice sheet at y = 2.85m
  const lakeY = computeKashmirElevation(-610, 35, 0);
  assert.equal(lakeY, 2.85, 'Dal Lake ice should be at y = 2.85m');

  // Summit platform deck is at y = 36.0m when player is up there
  const summitY = computeKashmirElevation(-755, 185, 30.0);
  assert.equal(summitY, 36.0, 'Gondola summit deck must be 36.0m');

  // Gulmarg ski slope descends continuously from mountain summit to valley resort
  const highSlopeY = computeKashmirElevation(-720, 160, 20.0);
  const midSlopeY = computeKashmirElevation(-680, 120, 10.0);
  const lowSlopeY = computeKashmirElevation(-655, 95, 4.0);
  assert.ok(highSlopeY > midSlopeY, `High slope (${highSlopeY}) must be higher than mid slope (${midSlopeY})`);
  assert.ok(midSlopeY > lowSlopeY, `Mid slope (${midSlopeY}) must be higher than low slope (${lowSlopeY})`);
});

test('Interactive Snowman Builder: roll snowball to grow, stack tiers, customize, and finish', () => {
  let builder = createSnowmanBuilderState(-610, 75, 3.5);
  assert.equal(builder.phase, 'rolling_base');
  assert.equal(builder.baseRadius, 0.25);

  // Roll base snowball by walking 5 meters
  builder = rollSnowball(builder, 5.0);
  assert.ok(builder.baseRadius >= 0.75, 'Base snowball should have grown to full size');
  assert.equal(builder.phase, 'rolling_torso');

  // Roll torso snowball
  builder = rollSnowball(builder, 4.0);
  assert.ok(builder.torsoRadius >= 0.52, 'Torso snowball should have grown to full size');
  assert.equal(builder.phase, 'rolling_head');

  // Roll head snowball
  builder = rollSnowball(builder, 3.0);
  assert.ok(builder.headRadius >= 0.35, 'Head snowball should have grown to full size');
  assert.equal(builder.phase, 'customizing');

  // Customize accessories
  builder = customizeSnowman(builder, {
    hat: 'beanie',
    scarf: 'golden_silk',
    carrotNose: true,
    stickArms: true,
  });
  assert.equal(builder.customization.hat, 'beanie');
  assert.equal(builder.customization.scarf, 'golden_silk');

  // Finalize snowman
  const finished = finalizeSnowman(builder);
  assert.ok(finished.id.startsWith('snowman-'));
  assert.equal(finished.customization.hat, 'beanie');
  assert.equal(finished.x, -610);
});

test('Snowball Fight Simulation: projectile trajectory, gravity, terrain impact, and NPC hits', () => {
  const origin = { x: -605.0, y: 3.5, z: 75.0 };
  const targetDir = { x: -1.0, y: 0.1, z: 0.0 };
  const snowball = createSnowball(origin, targetDir, 25.0, 'player');

  assert.equal(snowball.active, true);
  assert.ok(snowball.vx < 0, 'Velocity X should point towards target');
  assert.ok(snowball.vy > 0, 'Should have upward lob arc');

  // Simulate flight step
  const npcs = [...INITIAL_KASHMIR_NPCS];
  const step1 = stepSnowballs([snowball], npcs, { x: -500, y: 0, z: 0 }, 0.05);
  assert.equal(step1.updatedSnowballs.length, 1);
  assert.ok(step1.updatedSnowballs[0].y < snowball.y + 0.5);

  // Direct hit on Arif Khan
  const directSnowball: typeof snowball = {
    ...snowball,
    x: npcs[0].x - 0.2,
    y: npcs[0].y + 1.1,
    z: npcs[0].z,
    vx: 10,
    vy: 0,
    vz: 0,
  };
  const hitStep = stepSnowballs([directSnowball], npcs, { x: 0, y: 0, z: 0 }, 0.05);
  assert.equal(hitStep.updatedSnowballs.length, 0, 'Snowball should explode on impact');
  assert.equal(hitStep.updatedNPCs[0].hitCount, 1, 'Arif Khan hit count should increment');
  assert.equal(hitStep.splashes.length, 1);
  assert.equal(hitStep.splashes[0].hitType, 'npc');
});

test('Mountain Gondola Cable Car System: continuous looping kinematics and boarding', () => {
  let gondolaSys = createInitialGondolaSystemState();
  assert.equal(gondolaSys.cabins.length, 4, 'Must have 4 active gondola cabins');

  // Verify cabin poses at base and summit
  const basePose = computeGondolaPoseAtT(0.0);
  assert.ok(Math.abs(basePose.x - GONDOLA_BASE_STATION.x) < 2.0);
  assert.ok(Math.abs(basePose.y - GONDOLA_BASE_STATION.y) < 2.0);

  const summitPose = computeGondolaPoseAtT(0.5);
  assert.ok(Math.abs(summitPose.x - GONDOLA_SUMMIT_STATION.x) < 2.0);
  assert.ok(Math.abs(summitPose.y - GONDOLA_SUMMIT_STATION.y) < 2.0);

  // Advance simulation
  gondolaSys = stepGondolaSimulation(gondolaSys, 1.0, 10.0);
  assert.ok(gondolaSys.cabins[0].progressT > 0.05, 'Cabins should advance along cable');

  // Boarding check
  const boardable = findBoardableGondola({ x: gondolaSys.cabins[0].x + 0.5, y: gondolaSys.cabins[0].y, z: gondolaSys.cabins[0].z }, gondolaSys.cabins);
  assert.ok(boardable !== null, 'Should find boardable cabin when nearby');
});

test('Mountain Skiing & Ice Skating Physics: downhill acceleration, carving, jumping, and snowplow braking', () => {
  let kin = createInitialWinterKinematics();
  kin.mode = 'ski';

  // Accelerate downhill on steep slope
  kin = stepSkiPhysics(kin, { forward: true, backward: false, left: false, right: false, jump: false }, 0.8, 0.5);
  assert.ok(kin.speed > 5.0, 'Ski speed should accelerate downhill');

  // Carve turn left
  kin = stepSkiPhysics(kin, { forward: true, backward: false, left: true, right: false, jump: false }, 0.5, 0.2);
  assert.ok(kin.carveAngle > 0, 'Carve angle should lean into the turn');

  // Snowplow brake
  const prevSpeed = kin.speed;
  kin = stepSkiPhysics(kin, { forward: false, backward: true, left: false, right: false, jump: false }, 0.2, 0.5);
  assert.ok(kin.speed < prevSpeed, 'Speed should decrease upon snowplow braking');

  // Test ice skating mode
  kin.mode = 'skate';
  kin = stepSkiPhysics(kin, { forward: true, backward: false, left: false, right: false, jump: false }, 0, 0.5);
  assert.ok(kin.speed > 2.0, 'Skating speed should increase with low friction');
});
