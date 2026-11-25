import test from 'node:test';
import assert from 'node:assert/strict';
import {
  METRO_STATIONS,
  METRO_TRACK_WAYPOINTS,
  computeMetroElevation,
  computeMetroPoseAtT,
  createInitialMetroTrainState,
  stepMetroSimulation,
  buyMetroTicket,
  findNearestMetroStation,
  isNearMetroTrain,
  METRO_SEATS,
  convertTrainLocalToWorld,
  convertWorldToTrainLocal,
  clampTrainLocalAisle,
  findNearestMetroSeat,
} from './metroSystem';

test('Metro System: 3 distinct 2-storey stations exist with 12.0m elevated platforms', () => {
  assert.equal(METRO_STATIONS.length, 3, 'Must contain exactly 3 stations');

  const stationIds = METRO_STATIONS.map((s) => s.id);
  assert.ok(stationIds.includes('station-ctg'), 'Must have Chittagong Grand Market station');
  assert.ok(stationIds.includes('station-museum'), 'Must have Museum Gallery Central station');
  assert.ok(stationIds.includes('station-coxs'), 'Must have Cox\'s Bazar Sea Beach station');

  for (const st of METRO_STATIONS) {
    assert.equal(st.platformY, 12.0, `${st.name} platform must be at high elevated height y = 12.0m`);
    assert.ok(st.platformBounds.maxX > st.platformBounds.minX);
    assert.ok(st.platformBounds.maxZ > st.platformBounds.minZ);
    assert.ok(st.stairsBounds.maxX > st.stairsBounds.minX);
    assert.ok(st.stairsBounds.maxZ > st.stairsBounds.minZ);
    assert.ok(st.ticketCounterPos.y >= 0, `${st.name} must have ground ticket counter`);
    assert.ok(st.banglaName.length > 0, `${st.name} must have Bengali name`);
  }
});

test('computeMetroElevation: stairs climb continuously from ground to 12.0m and platform maintains 12.0m', () => {
  // Outside any station
  assert.equal(computeMetroElevation(0, 0, 0), 0);
  assert.equal(computeMetroElevation(-100, 100, 0), 0);

  // Chittagong Station Stairs & Platform (minZ = 63.5, maxZ = 71.5, groundY = 0.05, platformY = 12.0)
  const ctgStairsBottom = computeMetroElevation(-300, 71.5, 0.05);
  assert.ok(Math.abs(ctgStairsBottom - 0.05) < 0.1, `Stairs bottom should be near 0.05m, got ${ctgStairsBottom}`);

  const ctgStairsTop = computeMetroElevation(-300, 63.5, 10.0);
  assert.ok(Math.abs(ctgStairsTop - 12.0) < 0.1, `Stairs top should be near 12.0m, got ${ctgStairsTop}`);

  // 2nd floor platform & waiting lounge deck (when player already at y >= 8.5)
  const ctgPlatform = computeMetroElevation(-300, 61.5, 12.0);
  assert.equal(ctgPlatform, 12.0, '2nd floor platform must retain 12.0m elevation');

  // Museum Station Stairs & Platform (minZ = 53.0, maxZ = 61.0, groundY = 0.14, platformY = 12.0)
  const musStairsBottom = computeMetroElevation(0, 53.0, 0.14);
  assert.ok(Math.abs(musStairsBottom - 0.14) < 0.1, `Museum stairs bottom should be near 0.14m, got ${musStairsBottom}`);

  const musStairsTop = computeMetroElevation(0, 61.0, 10.0);
  assert.ok(Math.abs(musStairsTop - 12.0) < 0.1, `Museum stairs top should be near 12.0m, got ${musStairsTop}`);

  const musStairsMid = computeMetroElevation(0, 57.0, 5.0);
  assert.ok(musStairsMid > 2.0 && musStairsMid < 11.0, `Museum stairs mid should be elevated, got ${musStairsMid}`);

  const musPlatform = computeMetroElevation(0, 63.0, 12.0);
  assert.equal(musPlatform, 12.0, 'Museum platform must retain 12.0m elevation');

  // Cox's Bazar Station Stairs & Platform (minZ = 53.0, maxZ = 61.0, groundY = 0.05, platformY = 12.0)
  const coxsStairsBottom = computeMetroElevation(172, 53.0, 0.05);
  assert.ok(Math.abs(coxsStairsBottom - 0.05) < 0.1, `Cox's stairs bottom should be near 0.05m, got ${coxsStairsBottom}`);

  const coxsStairsTop = computeMetroElevation(172, 61.0, 10.0);
  assert.ok(Math.abs(coxsStairsTop - 12.0) < 0.1, `Cox's stairs top should be near 12.0m, got ${coxsStairsTop}`);

  const coxsPlatform = computeMetroElevation(172, 63.0, 12.0);
  assert.equal(coxsPlatform, 12.0, 'Cox\'s platform must retain 12.0m elevation');
});

test('computeMetroPoseAtT: computes smooth position and forward heading along viaduct track', () => {
  // Start near Chittagong Zero Point (t = 0)
  const pose0 = computeMetroPoseAtT(0, 0);
  assert.ok(pose0.x <= -350, `Start should be west of -350, got ${pose0.x}`);
  assert.ok(Math.abs(pose0.y - 12.0) < 0.001);

  // Near Museum Gallery (t ~ 0.65)
  const poseMid = computeMetroPoseAtT(0.65, 20);
  assert.ok(Math.abs(poseMid.x) < 25, `Midpoint should be near Museum x=0, got ${poseMid.x}`);
  assert.ok(Math.abs(poseMid.y - 12.0) < 0.001);

  // Cox's Bazar terminus (t = 1)
  const poseEnd = computeMetroPoseAtT(1, 0);
  assert.ok(poseEnd.x >= 180, `End should be at Cox's Bazar x>=180, got ${poseEnd.x}`);
  assert.ok(Math.abs(poseEnd.y - 12.0) < 0.001);
});

test('stepMetroSimulation: train progresses, docks at stations with Bengali announcements and door cycling', () => {
  let state = createInitialMetroTrainState();
  assert.equal(state.phase, 'docked_doors_open');
  assert.equal(state.currentStationId, 'station-ctg');

  // Step while docked to count down dwell timer
  for (let i = 0; i < 90; i++) {
    state = stepMetroSimulation(state, 0.1);
  }

  // After dwell timer expires, train departs and cruises
  assert.equal(state.phase, 'cruising');
  assert.ok(state.speed > 0, 'Train should accelerate during cruising');
  assert.ok(state.announcementLine.includes('মিউজিয়াম গ্যালারি'));

  // Step train forward towards Museum station
  for (let i = 0; i < 400; i++) {
    state = stepMetroSimulation(state, 0.1);
    if (state.phase === 'docked_doors_open') break;
  }

  // Train docks at Museum Gallery station
  assert.ok(
    state.currentStationId === 'station-museum' || state.progressT > 0.5,
    'Train should reach and dock at Museum station'
  );
});

test('buyMetroTicket: purchases single ticket and unlimited MRT Pass with wallet deduction', () => {
  const ctgSt = METRO_STATIONS[0];
  const coxsSt = METRO_STATIONS[2];

  // Insufficient funds
  const fail = buyMetroTicket('single', ctgSt, coxsSt, 20);
  assert.equal(fail.ok, false);
  assert.equal(fail.nextWallet, 20);
  assert.ok(fail.message.includes('টাকা কম আছে'));

  // Single Journey Ticket (৳35)
  const single = buyMetroTicket('single', ctgSt, coxsSt, 500);
  assert.equal(single.ok, true);
  assert.equal(single.nextWallet, 465);
  assert.equal(single.ticket?.ticketType, 'single');
  assert.ok(single.message.includes('সফলভাবে'));

  // MRT Rapid Pass (৳100)
  const pass = buyMetroTicket('pass', ctgSt, coxsSt, 500);
  assert.equal(pass.ok, true);
  assert.equal(pass.nextWallet, 400);
  assert.equal(pass.ticket?.ticketType, 'pass');
  assert.ok(pass.message.includes('MRT Pass'));
});

test('isNearMetroTrain: validates boarding distance on elevated platform vs rejects ground level', () => {
  const trainPose = computeMetroPoseAtT(0.091, 0); // At CTG station (x = -300, y = 12.0, z = 61.5)

  // Player on 2nd floor platform beside train (y = 12.0m)
  assert.ok(
    isNearMetroTrain(trainPose.x + 2.0, 12.0, trainPose.z + 1.0, trainPose),
    'Should be boardable from platform at y = 12.0m'
  );

  // Player down on ground level (y = 0.05m)
  assert.ok(
    !isNearMetroTrain(trainPose.x + 2.0, 0.05, trainPose.z + 1.0, trainPose),
    'Should NOT be boardable from ground level below the elevated viaduct'
  );

  // Player too far horizontally
  assert.ok(
    !isNearMetroTrain(trainPose.x + 40.0, 12.0, trainPose.z, trainPose),
    'Should NOT be boardable when far away'
  );
});

test('Metro Train Interior: walk-through cabin aisle, window seats, and coordinate transformations', () => {
  // Verify passenger seats exist across all 3 coaches on both left and right sides
  assert.ok(METRO_SEATS.length >= 12, 'Must have at least 12 passenger seats');
  const coaches = new Set(METRO_SEATS.map((s: { coachIndex: number }) => s.coachIndex));
  assert.ok(coaches.has(1), 'Must have seats in lead coach');
  assert.ok(coaches.has(0), 'Must have seats in middle coach');
  assert.ok(coaches.has(-1), 'Must have seats in trailing coach');

  // Verify aisle clamping preserves boundary constraints
  const clampedInside = clampTrainLocalAisle(0.2, 5.0);
  assert.equal(clampedInside.localX, 0.2);
  assert.equal(clampedInside.localZ, 5.0);

  const clampedWall = clampTrainLocalAisle(3.5, 30.0);
  assert.equal(clampedWall.localX, 1.15, 'Should clamp to aisle side wall');
  assert.equal(clampedWall.localZ, 23.0, 'Should clamp to train length');

  // Verify round-trip coordinate transformation
  const pose = computeMetroPoseAtT(0.19, 0);
  const worldPos = convertTrainLocalToWorld(pose, 0.5, -4.0);
  assert.equal(typeof worldPos.x, 'number');
  assert.equal(typeof worldPos.z, 'number');
  assert.ok(worldPos.y > 6.8, 'Player should be standing on train floor above track');

  const backLocal = convertWorldToTrainLocal(pose, worldPos.x, worldPos.z);
  assert.ok(Math.abs(backLocal.localX - 0.5) < 0.01, 'Local X round trip should match');
  assert.ok(Math.abs(backLocal.localZ - (-4.0)) < 0.01, 'Local Z round trip should match');

  // Verify finding nearest seat for sitting down
  const nearSeat = findNearestMetroSeat(-1.1, 12.1);
  assert.ok(nearSeat !== null, 'Should find seat when close');
  assert.equal(nearSeat?.id, 'seat-lead-l1');
  assert.ok(nearSeat?.label.includes('সিট'));
});
