import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ARTWORKS_PER_ROOM,
  calculateMuseumLayout,
  clampPlayerPosition,
  findNearbyDoor,
  getArtworkPlacement,
  getDoorId,
  getResolvedRoomName,
  getRoomIndexAtZ,
  groupArtworksByDate,
  ROOM_DEPTH,
  sortArtworksByDate,
  validateAccessGrant,
  validateArtworkInput,
  validateRoomName,
} from './layout.ts';
import type { ArtworkItem } from '../types/museum.ts';

function makeArtwork(overrides: Partial<ArtworkItem>): ArtworkItem {
  return {
    id: overrides.id ?? 'a1',
    museumId: 'm1',
    ownerId: 'u1',
    uploadedBy: 'u1',
    uploadedByName: 'Curator',
    title: overrides.title ?? 'Untitled',
    artist: overrides.artist ?? 'Artist',
    dateCaptured: overrides.dateCaptured ?? '2026-01-01',
    notes: overrides.notes ?? '',
    imageUrl: overrides.imageUrl ?? '/src/assets/images/test.jpg',
    aspectRatio: '4:3',
    frameStyle: 'bronze',
    isOpenByCode: false,
    viewerEmails: [],
  };
}

describe('Multi-room 2-small + 1-Grand-Cross-Hall (8-8-18) expansion & room styles', () => {
  it('follows the repeating 2 small rooms (8 each) -> 1 Grand Cross/X Hall (18 works) cycle', () => {
    const empty = calculateMuseumLayout(0);
    assert.equal(empty.roomCount, 1);
    assert.equal(empty.totalWallSlots, 8);
    assert.equal(empty.doors.length, 0);
    assert.equal(empty.rooms[0].shape, 'rotunda');
    assert.equal(empty.rooms[0].isCrossHall, false);

    const sixteenWorks = calculateMuseumLayout(16);
    assert.equal(sixteenWorks.roomCount, 2);
    assert.equal(sixteenWorks.totalWallSlots, 16);
    assert.equal(sixteenWorks.doors.length, 1);
    assert.deepEqual(
      sixteenWorks.rooms.map((r) => [r.shape, r.capacity]),
      [
        ['rotunda', 8],
        ['atrium', 8],
      ]
    );
    assert.equal(sixteenWorks.doors[0].id, getDoorId(0, 1));

    // Artwork #17 opens Room 3: Grand Cross / X-Shaped Hall with 18 wall slots (total 8+8+18 = 34)
    const seventeenWorks = calculateMuseumLayout(17);
    assert.equal(seventeenWorks.roomCount, 3);
    assert.equal(seventeenWorks.totalWallSlots, 34);
    assert.equal(seventeenWorks.rooms[2].shape, 'cross_hall');
    assert.equal(seventeenWorks.rooms[2].isCrossHall, true);
    assert.equal(seventeenWorks.rooms[2].capacity, 18);

    // Full 34 works still fit inside the first 3 rooms (8 + 8 + 18)
    const thirtyFourWorks = calculateMuseumLayout(34);
    assert.equal(thirtyFourWorks.roomCount, 3);
    assert.equal(thirtyFourWorks.totalWallSlots, 34);

    // Artwork #35 returns to a standard small 8-slot room (Room 4), #43 opens Room 5 (8), #51 opens 2nd Grand Cross Hall (Room 6, 18)!
    const thirtyFiveWorks = calculateMuseumLayout(35);
    assert.equal(thirtyFiveWorks.roomCount, 4);
    assert.equal(thirtyFiveWorks.totalWallSlots, 42);
    assert.deepEqual(
      thirtyFiveWorks.rooms.map((r) => [r.shape, r.capacity]),
      [
        ['rotunda', 8],
        ['atrium', 8],
        ['cross_hall', 18],
        ['salon', 8],
      ]
    );

    const fiftyOneWorks = calculateMuseumLayout(51);
    assert.equal(fiftyOneWorks.roomCount, 6);
    assert.equal(fiftyOneWorks.totalWallSlots, 68);
    assert.deepEqual(
      fiftyOneWorks.rooms.map((r) => [r.shape, r.capacity]),
      [
        ['rotunda', 8],
        ['atrium', 8],
        ['cross_hall', 18],
        ['salon', 8],
        ['pavilion', 8],
        ['cross_hall', 18],
      ]
    );
  });

  it('places 8 non-overlapping artworks in small rooms and 18 non-overlapping artworks across all wings of the Cross Hall', () => {
    const seenCoords = new Set<string>();
    // Verify all 42 slots across Room 1 (8), Room 2 (8), Room 3 Cross Hall (18), and Room 4 (8)
    for (let i = 0; i < 42; i++) {
      const p = getArtworkPlacement(i);
      const key = `${p.x.toFixed(2)},${p.z.toFixed(2)}`;
      assert.equal(seenCoords.has(key), false, `Duplicate wall slot at ${key}`);
      seenCoords.add(key);
    }

    const slot6 = getArtworkPlacement(6);
    const slot7 = getArtworkPlacement(7);
    assert.equal(slot6.wallSide, 'north');
    assert.equal(slot7.wallSide, 'north');
    assert.ok(slot6.x < -2.5 && slot7.x > 2.5, 'North artworks must clear central doorway');

    const slot8 = getArtworkPlacement(8);
    assert.equal(slot8.roomIndex, 1);
    assert.equal(slot8.roomNumber, 2);
    assert.ok(slot8.z < -ROOM_DEPTH / 2, '9th artwork must sit inside Room 2');

    // Artwork indices 16..33 all live inside Room 3 (Grand Cross Hall), spanning West & East wings!
    const crossPlacements = Array.from({ length: 18 }, (_, k) => getArtworkPlacement(16 + k));
    assert.ok(crossPlacements.every((p) => p.roomIndex === 2 && p.roomNumber === 3));
    assert.ok(crossPlacements.some((p) => p.x < -14), 'West wing must hold artworks');
    assert.ok(crossPlacements.some((p) => p.x > 14), 'East wing must hold artworks');

    // Artwork index 34 moves into Room 4 (small room again)
    const slot34 = getArtworkPlacement(34);
    assert.equal(slot34.roomIndex, 3);
    assert.equal(slot34.slotInRoom, 0);
  });

  it('blocks closed doors, allows open doorways, and clamps cruciform Cross Hall wings & re-entrant corners', () => {
    const layout = calculateMuseumLayout(20); // Rooms 1, 2, 3 (Cross Hall)
    const door = layout.doors[0];
    assert.equal(door.z, -9.0);

    // Closed door blocks moving from Room 1 (z = -7.5) into Room 2 (z = -10.5)
    const closedAttempt = clampPlayerPosition(0, -10.5, layout, new Set(), -7.5);
    assert.ok(closedAttempt.z > door.z, 'Closed door must stop player on the South side');
    assert.equal(getRoomIndexAtZ(closedAttempt.z, layout), 0);

    // Opening the door lets the player walk straight through the doorway into Room 2
    const openAttempt = clampPlayerPosition(0, -10.5, layout, new Set([door.id]), -7.5);
    assert.equal(openAttempt.z, -10.5);
    assert.equal(getRoomIndexAtZ(openAttempt.z, layout), 1);

    // Even when open, walking into the solid partition wall away from the doorway (x = 4.5) is blocked
    const wallHit = clampPlayerPosition(4.5, -10.5, layout, new Set([door.id]), -7.5);
    assert.ok(wallHit.z > door.z, 'Partition wall outside doorway must remain solid');

    // Inside Room 3 (Grand Cross Hall): walking out into the wide West Wing (-15, centerZ) is allowed!
    const crossHall = layout.rooms[2];
    const allOpen = new Set(layout.doors.map((d) => d.id));
    const inWestWing = clampPlayerPosition(-15.0, crossHall.centerZ, layout, allOpen, crossHall.centerZ, -14.0);
    assert.equal(inWestWing.x, -15.0, 'Must be able to walk deep into Cross Hall West wing');
    assert.equal(inWestWing.z, crossHall.centerZ);

    // Attempting to walk out of the West wing north wall into the exterior corner gets clamped inside wing Z
    const wingCornerHit = clampPlayerPosition(
      -15.0,
      crossHall.northZ + 2.0,
      layout,
      allOpen,
      crossHall.centerZ,
      -15.0
    );
    assert.ok(
      wingCornerHit.z >= crossHall.centerZ - crossHall.wingHalfDepth + 1.0,
      'Wing north wall must block cutting into exterior re-entrant corner'
    );

    // Nearby door detector finds door-0-1 when approaching it
    const nearby = findNearbyDoor(0.3, -7.2, layout);
    assert.equal(nearby?.id, door.id);
    assert.equal(findNearbyDoor(0, 4.0, layout), null);
  });

  it('resolves custom room names and validates room name edits', () => {
    assert.equal(getResolvedRoomName(0), 'Grand Rotunda');
    assert.equal(getResolvedRoomName(1, { '1': 'Botanical Sanctuary' }), 'Botanical Sanctuary');
    assert.equal(getResolvedRoomName(1, { '1': '   ' }), 'Botanical Atrium');
    assert.equal(getResolvedRoomName(2), 'Grand Cross Hall');

    assert.equal(validateRoomName('').valid, false);
    assert.equal(validateRoomName('A'.repeat(61)).valid, false);
    assert.equal(validateRoomName('Family Memories Hall').valid, true);
  });
});

describe('Chronological date sorting & grouping', () => {
  const works = [
    makeArtwork({ id: 'old', title: 'Ancient Gate', dateCaptured: '2024-03-11' }),
    makeArtwork({ id: 'mid-b', title: 'Breeze', dateCaptured: '2025-08-20' }),
    makeArtwork({ id: 'mid-a', title: 'Atelier', dateCaptured: '2025-08-20' }),
    makeArtwork({ id: 'new', title: 'Winter Peak', dateCaptured: '2026-11-12' }),
  ];

  it('sorts newest-first and oldest-first deterministically', () => {
    const newest = sortArtworksByDate(works, 'newest');
    assert.deepEqual(
      newest.map((w) => w.id),
      ['new', 'mid-a', 'mid-b', 'old']
    );

    const oldest = sortArtworksByDate(works, 'oldest');
    assert.deepEqual(
      oldest.map((w) => w.id),
      ['old', 'mid-a', 'mid-b', 'new']
    );
  });

  it('groups artworks by archival date', () => {
    const groups = groupArtworksByDate(works, 'newest');
    assert.equal(groups.length, 3);
    assert.equal(groups[0].dateKey, '2026-11-12');
    assert.equal(groups[1].dateKey, '2025-08-20');
    assert.equal(groups[1].items.length, 2);
  });
});

describe('Input validation for uploads and shared access', () => {
  it('validates artwork form inputs cleanly', () => {
    const invalid = validateArtworkInput({
      title: '   ',
      artist: '',
      dateCaptured: 'invalid-date',
      imageUrl: '',
      notes: '',
    });
    assert.equal(invalid.valid, false);
    assert.ok(invalid.errors.title);
    assert.ok(invalid.errors.artist);
    assert.ok(invalid.errors.dateCaptured);
    assert.ok(invalid.errors.imageUrl);

    const valid = validateArtworkInput({
      title: 'Evening Courtyard',
      artist: 'Clara',
      dateCaptured: '2026-07-08',
      imageUrl: '/src/assets/images/test.jpg',
      notes: 'Natural dusk lighting.',
    });
    assert.equal(valid.valid, true);
  });

  it('prevents duplicate visitor emails and validates gender selection', () => {
    const dup = validateAccessGrant({
      email: 'Clara@Gallery.Example',
      displayName: 'Clara',
      role: 'visitor',
      gender: 'woman',
      existingEmails: ['clara@gallery.example'],
    });
    assert.equal(dup.valid, false);
    assert.ok(dup.errors.email);

    const ok = validateAccessGrant({
      email: 'alex@example.com',
      displayName: 'Alex Mercer',
      role: 'curator',
      gender: 'man',
      existingEmails: ['clara@gallery.example'],
    });
    assert.equal(ok.valid, true);
  });
});
