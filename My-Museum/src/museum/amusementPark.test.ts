import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AMUSEMENT_RIDES,
  computeChorkiWheelAngle,
  computeCompanionRideSeatPosition,
  computeDolnaSwingAngle,
  computeRideSeatWorldPosition,
  findNearestAmusementRide,
  isInsideAmusementPark,
} from './amusementPark.ts';

describe('Twin Amusement Parks (West & East Dolna & Chorki)', () => {
  it('places both a Dolna and a Chorki on both West and East sides of the museum', () => {
    const westRides = AMUSEMENT_RIDES.filter((r) => r.side === 'west');
    const eastRides = AMUSEMENT_RIDES.filter((r) => r.side === 'east');
    assert.equal(westRides.length, 3);
    assert.equal(eastRides.length, 3);
    assert.deepEqual(
      westRides.map((r) => r.kind).sort(),
      ['chorki', 'dolna', 'waterslide']
    );
    assert.deepEqual(
      eastRides.map((r) => r.kind).sort(),
      ['chorki', 'coaster', 'dolna']
    );
    assert.equal(isInsideAmusementPark(-38, 12), 'west');
    assert.equal(isInsideAmusementPark(38, 12), 'east');
    assert.equal(isInsideAmusementPark(0, 14), null);
  });

  it('finds the nearest rideable Dolna or Chorki within boarding distance', () => {
    const nearWestDolna = findNearestAmusementRide(-31.5, 16.0);
    assert.equal(nearWestDolna?.id, 'ride-west-dolna');

    const nearWestWaterSlide = findNearestAmusementRide(-75.0, 6.5);
    assert.equal(nearWestWaterSlide?.id, 'ride-west-waterslide');

    const nearEastChorki = findNearestAmusementRide(44.0, 12.0);
    assert.equal(nearEastChorki?.id, 'ride-east-chorki');

    const nearEastCoaster = findNearestAmusementRide(61.0, 20.5);
    assert.equal(nearEastCoaster?.id, 'ride-east-coaster');

    assert.equal(findNearestAmusementRide(0, 15), null);
  });

  it('animates Dolna pendulum arc and Chorki full 360 elevation smoothly', () => {
    const westDolna = AMUSEMENT_RIDES.find((r) => r.id === 'ride-west-dolna')!;
    const a0 = computeDolnaSwingAngle(0, 0, false);
    const aPeak = computeDolnaSwingAngle(Math.PI / (2 * 1.75), 0, false);
    const aBoostPeak = computeDolnaSwingAngle(Math.PI / (2 * 2.05), 0, true);
    assert.ok(Math.abs(a0) < 0.001);
    assert.ok(aPeak > 0.55 && aBoostPeak > aPeak, 'Boosting Dolna increases swing height');

    const seatAtRest = computeRideSeatWorldPosition(westDolna, 0, false);
    const seatAtSwing = computeRideSeatWorldPosition(westDolna, Math.PI / (2 * 1.75), false);
    assert.ok(seatAtSwing.y > seatAtRest.y, 'Dolna seat rises as it swings outward');
    assert.ok(seatAtSwing.z > seatAtRest.z, 'Dolna seat travels forward on positive swing');

    const westChorki = AMUSEMENT_RIDES.find((r) => r.id === 'ride-west-chorki')!;
    const cAngle1 = computeChorkiWheelAngle(0, 0, false);
    const cAngle2 = computeChorkiWheelAngle(4, 0, false);
    assert.ok(cAngle2 > cAngle1, 'Chorki wheel rotates continuously');

    const bottomPos = computeRideSeatWorldPosition(westChorki, 0, false);
    const topPos = computeRideSeatWorldPosition(westChorki, Math.PI / 0.38, false);
    assert.ok(bottomPos.y > 0.8 && bottomPos.y < 2.0, 'Chorki cabin starts low near boarding platform inside cabin');
    assert.ok(topPos.y > 11.5, 'Chorki cabin climbs high over the museum and road');

    // Verify companion seat inside the cabin side-by-side with player
    const compPos = computeCompanionRideSeatPosition(westChorki, 0, false);
    assert.ok(Math.abs(compPos.y - bottomPos.y) < 0.01, 'Companion sits at identical cabin bench elevation');
    assert.ok(compPos.x > bottomPos.x, 'Companion sits on adjacent right bench inside the cabin');

    // Verify Dolna companion seat on facing bench
    const compDolna = computeCompanionRideSeatPosition(westDolna, 0, false);
    assert.equal(compDolna.x, westDolna.x - 1.35, 'Companion sits on facing left bench');
  });
});
