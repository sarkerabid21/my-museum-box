import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateMuseumLayout } from './layout.ts';
import {
  acceptRideFare,
  changeTalkDestination,
  clampWorldPosition,
  createInitialTrafficVehicles,
  createTalkSession,
  executeVehicleTakeover,
  EXIT_DOOR_ID,
  findNearestAnyDoor,
  findNearestHailVehicle,
  getWorldZone,
  INITIAL_WALLET_BDT,
  negotiateTalkSession,
  projectWorldToMinimap,
  stepVehicleDriving,
} from './outdoorWorld.ts';

describe('Outdoor World Exit Door, Collision & Minimap Zones', () => {
  it('blocks leaving Room 1 when exit door is closed and allows walking outside once opened', () => {
    const layout = calculateMuseumLayout(4); // 1 room, southWallZ = 9.0

    // Closed exit door blocks stepping out to z = 11.0
    const blocked = clampWorldPosition(0, 11.0, layout, new Set(), 7.8, 0);
    assert.ok(blocked.z < layout.southWallZ, 'Closed exit door must keep player inside Room 1');

    // Opening door-exit-outside allows walking smoothly outside into the garden
    const openSet = new Set([EXIT_DOOR_ID]);
    const outside = clampWorldPosition(0, 11.0, layout, openSet, 8.6, 0);
    assert.equal(outside.z, 11.0);

    // Can also walk freely down to the highway and out to Chittagong & Coxs Bazar
    const highway = clampWorldPosition(-75, 34, layout, openSet, 34, -70);
    assert.equal(highway.x, -75);
    assert.equal(highway.z, 34);

    // Nearest door detector picks up the exit door near Room 1 south portal
    const nearExit = findNearestAnyDoor(0.2, 7.6, layout);
    assert.equal(nearExit?.id, EXIT_DOOR_ID);
  });

  it('classifies MUSEUM, GARDEN, ROAD, CTG, and COXS zones accurately and projects to minimap', () => {
    assert.equal(getWorldZone(0, 2.0).symbol, 'MUSEUM');
    assert.equal(getWorldZone(0, 16.0).symbol, 'GARDEN');
    assert.equal(getWorldZone(0, 35.0).symbol, 'ROAD');
    assert.equal(getWorldZone(-72, 35.0).symbol, 'CTG');
    assert.equal(getWorldZone(72, 35.0).symbol, 'COXS');

    const ctgPt = projectWorldToMinimap(-90, 35, 200, 120);
    const museumPt = projectWorldToMinimap(0, 0, 200, 120);
    const coxsPt = projectWorldToMinimap(90, 35, 200, 120);
    assert.ok(ctgPt.mx < museumPt.mx && museumPt.mx < coxsPt.mx, 'CTG west < Museum center < COXS east');
    assert.ok(museumPt.my < ctgPt.my, 'Museum north of highway on minimap');
  });

  it('keeps player inside Grand Cross Hall (Room 3) wings to view wall artworks without being ejected outside', () => {
    // 3 rooms: Room 1 (8), Room 2 (8), Room 3 (Cross Hall, 18 works) -> total 34
    const layout = calculateMuseumLayout(24);
    const crossHall = layout.rooms[2];
    assert.ok(crossHall.isCrossHall, 'Room 3 must be a Grand Cross Hall');

    // Cross Hall center is around z = -41
    const centerZ = crossHall.centerZ;
    const allDoorsOpen = new Set(layout.doors.map((d) => d.id));

    // Player walks deep into the West Wing (x = -15.4) to examine wall artworks
    const westWingWalk = clampWorldPosition(-15.4, centerZ, layout, allDoorsOpen, centerZ, -14.0);
    assert.ok(
      Math.abs(westWingWalk.x - (-15.4)) < 0.5,
      `Player in West Wing must stay near x = -15.4, got ${westWingWalk.x}`
    );
    assert.ok(
      Math.abs(westWingWalk.z - centerZ) < 1.0,
      `Player must stay deep inside Room 3 (near ${centerZ}), never ejected to outdoor z=1.8! Got ${westWingWalk.z}`
    );

    // Player walks deep into the East Wing (x = +15.4)
    const eastWingWalk = clampWorldPosition(15.4, centerZ, layout, allDoorsOpen, centerZ, 14.0);
    assert.ok(
      Math.abs(eastWingWalk.x - 15.4) < 0.5,
      `Player in East Wing must stay near x = 15.4, got ${eastWingWalk.x}`
    );
    assert.ok(
      Math.abs(eastWingWalk.z - centerZ) < 1.0,
      `Player must stay deep inside Room 3, never ejected outside! Got ${eastWingWalk.z}`
    );

    // Walking right up to the far West end wall (x = -18.0)
    const farEndWalk = clampWorldPosition(-18.0, centerZ, layout, allDoorsOpen, centerZ, -17.0);
    assert.ok(farEndWalk.x <= -17.0, `Player must be able to approach the far West wall, got ${farEndWalk.x}`);
    assert.ok(
      Math.abs(farEndWalk.z - centerZ) < 1.0,
      `Player at far West wall must stay in Room 3, got ${farEndWalk.z}`
    );
  });
});

describe('Traffic Vehicles, Fare Bargaining, Chintai & Driving Kinematics', () => {
  it('spawns rickshaws, bikes, and cars and finds the nearest hail-able vehicle on the road', () => {
    const vehicles = createInitialTrafficVehicles();
    const kinds = new Set(vehicles.map((v) => v.kind));
    assert.ok(kinds.has('rickshaw') && kinds.has('bike') && kinds.has('car') && kinds.has('speedboat'));

    // Inside museum cannot hail outdoor traffic
    assert.equal(findNearestHailVehicle(0, 4, vehicles), null);

    // Standing near the rickshaw at x=-14, z=38.4 finds it
    const near = findNearestHailVehicle(-12, 35, vehicles);
    assert.equal(near?.id, 'veh-rickshaw-1');
  });

  it('supports fare negotiation, destination switching, payment, and chintai takeover', () => {
    const vehicles = createInitialTrafficVehicles();
    const rickshaw = vehicles.find((v) => v.kind === 'rickshaw')!;

    const session0 = createTalkSession(rickshaw, 'ctg');
    assert.equal(session0.askingFare, 120);
    assert.equal(session0.canBargainMore, true);

    const session1 = negotiateTalkSession(session0);
    assert.ok(session1.askingFare < session0.askingFare, 'Bargaining must reduce fare');

    const switched = changeTalkDestination(session1, 'coxs');
    assert.equal(switched.destination, 'coxs');
    assert.equal(switched.askingFare, 150);

    const paid = acceptRideFare(switched, INITIAL_WALLET_BDT);
    assert.equal(paid.ok, true);
    assert.equal(paid.nextWallet, INITIAL_WALLET_BDT - 150);

    // Chintai takeover sets player_driving, stolen=true, and ejects driver onto footpath
    const chintai = executeVehicleTakeover(rickshaw);
    assert.equal(chintai.updatedVehicle.status, 'player_driving');
    assert.equal(chintai.updatedVehicle.stolen, true);
    assert.ok(chintai.shoutLine.length > 10);
    assert.ok(chintai.ejectedPos.z >= 24 && chintai.ejectedPos.z <= 46);
  });

  it('rotates BOTH vehicle heading and camera yaw smoothly when steering while driving', () => {
    let state = { x: 0, z: 35, yaw: Math.PI / 2, speed: 5, camYaw: -Math.PI / 2 };
    const startYaw = state.yaw;
    const startCam = state.camYaw;

    for (let i = 0; i < 20; i++) {
      const next = stepVehicleDriving('bike', { throttle: 1, steer: 1, boost: false }, state, 0.05);
      state = { x: next.x, z: next.z, yaw: next.yaw, speed: next.speed, camYaw: next.camYaw };
    }

    assert.ok(state.yaw !== startYaw, 'Vehicle yaw must turn left');
    assert.ok(state.camYaw !== startCam, 'Camera yaw must follow vehicle steering');
    assert.ok(state.speed > 6, 'Bike must accelerate under throttle');
  });

  it('drives speedboat smoothly on water channel and navigates towards Coxs Bazar ocean', () => {
    let boatState = { x: -140, z: 96, yaw: Math.PI / 2, speed: 0, camYaw: -Math.PI / 2 };
    for (let i = 0; i < 30; i++) {
      const step = stepVehicleDriving('speedboat', { throttle: 1, steer: 0, boost: true }, boatState, 0.05);
      boatState = { x: step.x, z: step.z, yaw: step.yaw, speed: step.speed, camYaw: step.camYaw };
    }
    assert.ok(boatState.x > -140, 'Speedboat moves Eastbound (+X) along the river channel');
    assert.ok(boatState.speed > 10, 'Speedboat accelerates rapidly on water');
  });
});
