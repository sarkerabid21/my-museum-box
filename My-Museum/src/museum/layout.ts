import type {
  ArtworkItem,
  DateSortOrder,
  Gender,
  MemberRole,
  RoomShape,
} from '../types/museum';

export const ARTWORKS_PER_ROOM = 8;
export const ARTWORKS_PER_CROSS_HALL = 18;
export const CYCLE_ROOM_COUNT = 3; // 2 small rooms + 1 grand Cross/X hall
export const CYCLE_ARTWORK_CAPACITY = ARTWORKS_PER_ROOM * 2 + ARTWORKS_PER_CROSS_HALL; // 34
export const MIN_ROOMS = 1;
export const ROOM_WIDTH = 16.4;
export const ROOM_HALF_WIDTH = ROOM_WIDTH / 2;
export const ROOM_DEPTH = 18.0;
export const ROOM_HALF_DEPTH = ROOM_DEPTH / 2;
export const CROSS_HALL_DEPTH = 28.0;
export const CROSS_HALL_HALF_DEPTH = CROSS_HALL_DEPTH / 2;
export const CROSS_WING_WIDTH = 36.4; // Extends 10m West & 10m East beyond central nave
export const CROSS_WING_HALF_WIDTH = CROSS_WING_WIDTH / 2;
export const CROSS_WING_DEPTH = 12.8;
export const CROSS_WING_HALF_DEPTH = CROSS_WING_DEPTH / 2;
export const HALL_HEIGHT = 6.4;
export const DOOR_WIDTH = 3.4;
export const DOOR_HEIGHT = 3.9;
export const DOOR_INTERACT_RADIUS = 5.2;
export const WALL_COLLISION_MARGIN = 1.05;
export const DOOR_WALL_BUFFER = 0.78;
export const PEDESTAL_COLLISION_RADIUS = 1.48;

export const STANDARD_ROOM_SHAPES: RoomShape[] = ['rotunda', 'atrium', 'salon', 'pavilion'];
export const ROOM_SHAPES: RoomShape[] = ['rotunda', 'atrium', 'cross_hall', 'salon', 'pavilion'];

export interface RoomDefinition {
  index: number;
  roomNumber: number;
  romanNumeral: string;
  shape: RoomShape;
  isCrossHall: boolean;
  capacity: number;
  startArtworkIndex: number;
  depth: number;
  wingHalfWidth: number;
  wingHalfDepth: number;
  defaultName: string;
  architectureSubtitle: string;
  vaseLabel: string;
  centerZ: number;
  southZ: number;
  northZ: number;
}

export interface DoorDefinition {
  id: string;
  fromRoomIndex: number;
  toRoomIndex: number;
  x: number;
  z: number;
  width: number;
  height: number;
}

export interface PedestalObstacle {
  roomIndex: number;
  x: number;
  z: number;
  radius: number;
}

export interface MuseumLayout {
  artworkCount: number;
  roomCount: number;
  totalWallSlots: number;
  roomWidth: number;
  roomDepth: number;
  hallHeight: number;
  southWallZ: number;
  northWallZ: number;
  totalLength: number;
  rooms: RoomDefinition[];
  doors: DoorDefinition[];
  pedestals: PedestalObstacle[];
}

export interface ArtworkPlacement {
  index: number;
  roomIndex: number;
  roomNumber: number;
  slotInRoom: number; // 0..7 for standard rooms, 0..17 for Cross/X halls
  wallSide: 'west' | 'east' | 'north' | 'south';
  wallLabel: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  standPoint: {
    x: number;
    z: number;
    yaw: number;
  };
}

export interface DateGroup {
  dateKey: string; // YYYY-MM-DD
  label: string;
  items: ArtworkItem[];
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

const ROMAN_NUMERALS = [
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX',
  'XXI', 'XXII', 'XXIII', 'XXIV', 'XXV',
];

const ROOM_STYLE_META: Record<
  RoomShape,
  { defaultTitle: string; subtitle: string; vaseLabel: string }
> = {
  rotunda: {
    defaultTitle: 'Grand Rotunda',
    subtitle: 'Octagonal Dome Hall',
    vaseLabel: 'Celadon Amphora & White Magnolias',
  },
  atrium: {
    defaultTitle: 'Botanical Atrium',
    subtitle: 'Arched Glass Conservatory',
    vaseLabel: 'Terracotta Urn & Olive Pampas',
  },
  salon: {
    defaultTitle: 'Imperial Salon',
    subtitle: 'Coffered Walnut Gallery',
    vaseLabel: 'Cobalt Chinoiserie Vase & Peonies',
  },
  pavilion: {
    defaultTitle: 'Sculpture Pavilion',
    subtitle: 'Modernist Light-Fin Hall',
    vaseLabel: 'Brushed Bronze Vessel & Orchids',
  },
  cross_hall: {
    defaultTitle: 'Grand Cross Hall',
    subtitle: 'Cruciform X-Wing Pavilion (18 Works)',
    vaseLabel: 'Imperial Gilded Lotus Urn & Lilies',
  },
};

export function toRomanNumeral(num: number): string {
  return ROMAN_NUMERALS[num - 1] ?? String(num);
}

/**
 * Every 3rd room (0-based index 2, 5, 8, ...) is a Grand Cross / X-shaped Hall
 * holding 18 artworks, repeating after every 2 standard 8-artwork rooms.
 */
export function isCrossHallRoomIndex(roomIndex: number): boolean {
  const safe = Math.max(0, Math.floor(roomIndex));
  return safe % CYCLE_ROOM_COUNT === 2;
}

export function getRoomCapacity(roomIndex: number): number {
  return isCrossHallRoomIndex(roomIndex) ? ARTWORKS_PER_CROSS_HALL : ARTWORKS_PER_ROOM;
}

export function getRoomDepth(roomIndex: number): number {
  return isCrossHallRoomIndex(roomIndex) ? CROSS_HALL_DEPTH : ROOM_DEPTH;
}

export function getRoomShape(roomIndex: number): RoomShape {
  const safe = Math.max(0, Math.floor(roomIndex));
  if (isCrossHallRoomIndex(safe)) {
    return 'cross_hall';
  }
  // Count how many standard small rooms precede this roomIndex so small rooms cycle cleanly
  const standardOrdinal = safe - Math.floor(safe / CYCLE_ROOM_COUNT);
  return STANDARD_ROOM_SHAPES[standardOrdinal % STANDARD_ROOM_SHAPES.length];
}

export function getDefaultRoomName(roomIndex: number): string {
  const safe = Math.max(0, Math.floor(roomIndex));
  const shape = getRoomShape(safe);
  const base = ROOM_STYLE_META[shape].defaultTitle;
  if (shape === 'cross_hall') {
    const crossOrdinal = Math.floor(safe / CYCLE_ROOM_COUNT);
    return crossOrdinal === 0 ? base : `${base} ${toRomanNumeral(crossOrdinal + 1)}`;
  }
  const standardOrdinal = safe - Math.floor(safe / CYCLE_ROOM_COUNT);
  const cycle = Math.floor(standardOrdinal / STANDARD_ROOM_SHAPES.length);
  return cycle === 0 ? base : `${base} ${toRomanNumeral(cycle + 1)}`;
}

export function getResolvedRoomName(
  roomIndex: number,
  customRoomNames?: Record<string, string>
): string {
  const custom = customRoomNames?.[String(roomIndex)]?.trim();
  if (custom) return custom.slice(0, 60);
  return getDefaultRoomName(roomIndex);
}

export function getDoorId(fromRoomIndex: number, toRoomIndex: number): string {
  return `door-${fromRoomIndex}-${toRoomIndex}`;
}

/**
 * Resolves the exact spatial Z bounds (southZ, centerZ, northZ) for any 0-based room index.
 * Room 0 always spans southZ = +9.0 .. northZ = -9.0 so Room 1's outdoor exit door remains anchored at z = +9.0.
 */
function getRoomZBounds(roomIndex: number): { southZ: number; centerZ: number; northZ: number; depth: number } {
  let cursorSouthZ = ROOM_HALF_DEPTH; // +9.0
  for (let r = 0; r < roomIndex; r++) {
    cursorSouthZ -= getRoomDepth(r);
  }
  const depth = getRoomDepth(roomIndex);
  const northZ = cursorSouthZ - depth;
  const centerZ = (cursorSouthZ + northZ) / 2;
  return { southZ: cursorSouthZ, centerZ, northZ, depth };
}

/**
 * Maps a 0-based global artwork slot index to its (roomIndex, slotInRoom) under the
 * repeating 2 small rooms (8 + 8) + 1 Grand Cross/X Hall (18) = 34-work cycle.
 */
export function resolveArtworkRoomSlot(artworkIndex: number): {
  roomIndex: number;
  slotInRoom: number;
  isCrossHall: boolean;
} {
  const safeIndex = Math.max(0, Math.floor(artworkIndex));
  const cycleIdx = Math.floor(safeIndex / CYCLE_ARTWORK_CAPACITY);
  const inCycle = safeIndex % CYCLE_ARTWORK_CAPACITY;

  if (inCycle < ARTWORKS_PER_ROOM) {
    return {
      roomIndex: cycleIdx * CYCLE_ROOM_COUNT,
      slotInRoom: inCycle,
      isCrossHall: false,
    };
  }
  if (inCycle < ARTWORKS_PER_ROOM * 2) {
    return {
      roomIndex: cycleIdx * CYCLE_ROOM_COUNT + 1,
      slotInRoom: inCycle - ARTWORKS_PER_ROOM,
      isCrossHall: false,
    };
  }
  return {
    roomIndex: cycleIdx * CYCLE_ROOM_COUNT + 2,
    slotInRoom: inCycle - ARTWORKS_PER_ROOM * 2,
    isCrossHall: true,
  };
}

/**
 * Pure procedural calculation for the multi-room expanding 3D museum.
 * Repeating architectural rhythm:
 *  - 2 standard small rooms (8 artwork walls each: Rooms 1 & 2)
 *  - 1 Grand Cross / X-shaped Hall Room (18 artwork walls: Room 3)
 *  - Then 2 more standard rooms (Rooms 4 & 5), 1 Grand Cross Hall (Room 6), etc.
 */
export function calculateMuseumLayout(artworkCount: number): MuseumLayout {
  const safeCount = Math.max(0, Math.floor(artworkCount));
  let roomCount = MIN_ROOMS;
  let totalWallSlots = getRoomCapacity(0);
  while (totalWallSlots < safeCount) {
    totalWallSlots += getRoomCapacity(roomCount);
    roomCount++;
  }

  const rooms: RoomDefinition[] = [];
  const doors: DoorDefinition[] = [];
  const pedestals: PedestalObstacle[] = [];

  let cursorSouthZ = ROOM_HALF_DEPTH; // Room 1 South Exit Door stays anchored at +9.0
  let artworkCursor = 0;

  for (let r = 0; r < roomCount; r++) {
    const isCrossHall = isCrossHallRoomIndex(r);
    const shape = getRoomShape(r);
    const meta = ROOM_STYLE_META[shape];
    const capacity = getRoomCapacity(r);
    const depth = getRoomDepth(r);
    const southZ = cursorSouthZ;
    const northZ = southZ - depth;
    const centerZ = (southZ + northZ) / 2;

    rooms.push({
      index: r,
      roomNumber: r + 1,
      romanNumeral: toRomanNumeral(r + 1),
      shape,
      isCrossHall,
      capacity,
      startArtworkIndex: artworkCursor,
      depth,
      wingHalfWidth: isCrossHall ? CROSS_WING_HALF_WIDTH : ROOM_HALF_WIDTH,
      wingHalfDepth: isCrossHall ? CROSS_WING_HALF_DEPTH : depth / 2,
      defaultName: getDefaultRoomName(r),
      architectureSubtitle: meta.subtitle,
      vaseLabel: meta.vaseLabel,
      centerZ,
      southZ,
      northZ,
    });

    pedestals.push({
      roomIndex: r,
      x: 0,
      z: centerZ,
      radius: isCrossHall ? PEDESTAL_COLLISION_RADIUS + 0.32 : PEDESTAL_COLLISION_RADIUS,
    });

    if (r < roomCount - 1) {
      doors.push({
        id: getDoorId(r, r + 1),
        fromRoomIndex: r,
        toRoomIndex: r + 1,
        x: 0,
        z: northZ,
        width: DOOR_WIDTH,
        height: DOOR_HEIGHT,
      });
    }

    cursorSouthZ = northZ;
    artworkCursor += capacity;
  }

  const southWallZ = rooms[0].southZ;
  const northWallZ = rooms[rooms.length - 1].northZ;
  const totalLength = southWallZ - northWallZ;

  return {
    artworkCount: safeCount,
    roomCount,
    totalWallSlots,
    roomWidth: ROOM_WIDTH,
    roomDepth: ROOM_DEPTH,
    hallHeight: HALL_HEIGHT,
    southWallZ,
    northWallZ,
    totalLength,
    rooms,
    doors,
    pedestals,
  };
}

/**
 * Computes exact 3D wall placement and optimal stand point for any artwork slot index:
 * - Standard Rooms (8 works): 3 West, 3 East, 2 North flanking walls.
 * - Grand Cross / X-Hall Rooms (18 works):
 *    - Slots 0–1: South Arm West & East walls
 *    - Slots 2–7: West Wing (2 South wall, 2 Far West end wall, 2 North wall)
 *    - Slots 8–13: East Wing (2 South wall, 2 Far East end wall, 2 North wall)
 *    - Slots 14–15: North Arm West & East walls
 *    - Slots 16–17: North-West & North-East flanking walls beside central doorway
 */
export function getArtworkPlacement(index: number): ArtworkPlacement {
  const safeIndex = Math.max(0, Math.floor(index));
  const { roomIndex, slotInRoom, isCrossHall } = resolveArtworkRoomSlot(safeIndex);
  const { centerZ, northZ } = getRoomZBounds(roomIndex);
  const sideWallX = ROOM_HALF_WIDTH - 0.16;

  if (!isCrossHall) {
    if (slotInRoom < 6) {
      const isWest = slotInRoom % 2 === 0;
      const row = Math.floor(slotInRoom / 2); // 0 = South, 1 = Center, 2 = North
      const zOffsets = [4.7, 0.0, -4.7];
      const rowLabels = ['South', 'Center', 'North'];
      const z = centerZ + zOffsets[row];
      const x = isWest ? -sideWallX : sideWallX;
      const rotY = isWest ? Math.PI / 2 : -Math.PI / 2;
      const standX = isWest ? -sideWallX + 3.2 : sideWallX - 3.2;
      const standYaw = isWest ? Math.PI / 2 : -Math.PI / 2;

      return {
        index: safeIndex,
        roomIndex,
        roomNumber: roomIndex + 1,
        slotInRoom,
        wallSide: isWest ? 'west' : 'east',
        wallLabel: `${isWest ? 'West' : 'East'} Wall · ${rowLabels[row]}`,
        x,
        y: 2.55,
        z,
        rotY,
        standPoint: { x: standX, z, yaw: standYaw },
      };
    }

    // Slots 6 & 7: North flanking walls beside the central doorway
    const isNorthWest = slotInRoom === 6;
    const x = isNorthWest ? -4.85 : 4.85;
    const z = northZ + 0.24;
    return {
      index: safeIndex,
      roomIndex,
      roomNumber: roomIndex + 1,
      slotInRoom,
      wallSide: 'north',
      wallLabel: isNorthWest ? 'North-West Wall' : 'North-East Wall',
      x,
      y: 2.55,
      z,
      rotY: 0,
      standPoint: { x, z: northZ + 3.4, yaw: 0 },
    };
  }

  // --- GRAND CROSS / X-HALL (18 non-overlapping museum walls!) ---
  const wingEndX = CROSS_WING_HALF_WIDTH - 0.18; // 18.02
  const wingSouthWallZ = centerZ + CROSS_WING_HALF_DEPTH - 0.18; // centerZ + 6.22
  const wingNorthWallZ = centerZ - CROSS_WING_HALF_DEPTH + 0.18; // centerZ - 6.22

  const crossSlots: Array<{
    wallSide: 'west' | 'east' | 'north' | 'south';
    wallLabel: string;
    x: number;
    z: number;
    rotY: number;
    standX: number;
    standZ: number;
    standYaw: number;
  }> = [
    // 0, 1: South Arm Side Walls
    {
      wallSide: 'west',
      wallLabel: 'South Arm · West Wall',
      x: -sideWallX,
      z: centerZ + 10.2,
      rotY: Math.PI / 2,
      standX: -sideWallX + 3.2,
      standZ: centerZ + 10.2,
      standYaw: Math.PI / 2,
    },
    {
      wallSide: 'east',
      wallLabel: 'South Arm · East Wall',
      x: sideWallX,
      z: centerZ + 10.2,
      rotY: -Math.PI / 2,
      standX: sideWallX - 3.2,
      standZ: centerZ + 10.2,
      standYaw: -Math.PI / 2,
    },
    // 2..7: West Wing (6 artworks)
    {
      wallSide: 'south',
      wallLabel: 'West Wing · South Inner Wall',
      x: -11.2,
      z: wingSouthWallZ,
      rotY: Math.PI,
      standX: -11.2,
      standZ: wingSouthWallZ - 3.2,
      standYaw: Math.PI,
    },
    {
      wallSide: 'south',
      wallLabel: 'West Wing · South Outer Wall',
      x: -15.4,
      z: wingSouthWallZ,
      rotY: Math.PI,
      standX: -15.4,
      standZ: wingSouthWallZ - 3.2,
      standYaw: Math.PI,
    },
    {
      wallSide: 'west',
      wallLabel: 'West Wing · End Wall South',
      x: -wingEndX,
      z: centerZ + 2.65,
      rotY: Math.PI / 2,
      standX: -wingEndX + 3.2,
      standZ: centerZ + 2.65,
      standYaw: Math.PI / 2,
    },
    {
      wallSide: 'west',
      wallLabel: 'West Wing · End Wall North',
      x: -wingEndX,
      z: centerZ - 2.65,
      rotY: Math.PI / 2,
      standX: -wingEndX + 3.2,
      standZ: centerZ - 2.65,
      standYaw: Math.PI / 2,
    },
    {
      wallSide: 'north',
      wallLabel: 'West Wing · North Outer Wall',
      x: -15.4,
      z: wingNorthWallZ,
      rotY: 0,
      standX: -15.4,
      standZ: wingNorthWallZ + 3.2,
      standYaw: 0,
    },
    {
      wallSide: 'north',
      wallLabel: 'West Wing · North Inner Wall',
      x: -11.2,
      z: wingNorthWallZ,
      rotY: 0,
      standX: -11.2,
      standZ: wingNorthWallZ + 3.2,
      standYaw: 0,
    },
    // 8..13: East Wing (6 artworks)
    {
      wallSide: 'south',
      wallLabel: 'East Wing · South Inner Wall',
      x: 11.2,
      z: wingSouthWallZ,
      rotY: Math.PI,
      standX: 11.2,
      standZ: wingSouthWallZ - 3.2,
      standYaw: Math.PI,
    },
    {
      wallSide: 'south',
      wallLabel: 'East Wing · South Outer Wall',
      x: 15.4,
      z: wingSouthWallZ,
      rotY: Math.PI,
      standX: 15.4,
      standZ: wingSouthWallZ - 3.2,
      standYaw: Math.PI,
    },
    {
      wallSide: 'east',
      wallLabel: 'East Wing · End Wall South',
      x: wingEndX,
      z: centerZ + 2.65,
      rotY: -Math.PI / 2,
      standX: wingEndX - 3.2,
      standZ: centerZ + 2.65,
      standYaw: -Math.PI / 2,
    },
    {
      wallSide: 'east',
      wallLabel: 'East Wing · End Wall North',
      x: wingEndX,
      z: centerZ - 2.65,
      rotY: -Math.PI / 2,
      standX: wingEndX - 3.2,
      standZ: centerZ - 2.65,
      standYaw: -Math.PI / 2,
    },
    {
      wallSide: 'north',
      wallLabel: 'East Wing · North Outer Wall',
      x: 15.4,
      z: wingNorthWallZ,
      rotY: 0,
      standX: 15.4,
      standZ: wingNorthWallZ + 3.2,
      standYaw: 0,
    },
    {
      wallSide: 'north',
      wallLabel: 'East Wing · North Inner Wall',
      x: 11.2,
      z: wingNorthWallZ,
      rotY: 0,
      standX: 11.2,
      standZ: wingNorthWallZ + 3.2,
      standYaw: 0,
    },
    // 14, 15: North Arm Side Walls
    {
      wallSide: 'west',
      wallLabel: 'North Arm · West Wall',
      x: -sideWallX,
      z: centerZ - 10.2,
      rotY: Math.PI / 2,
      standX: -sideWallX + 3.2,
      standZ: centerZ - 10.2,
      standYaw: Math.PI / 2,
    },
    {
      wallSide: 'east',
      wallLabel: 'North Arm · East Wall',
      x: sideWallX,
      z: centerZ - 10.2,
      rotY: -Math.PI / 2,
      standX: sideWallX - 3.2,
      standZ: centerZ - 10.2,
      standYaw: -Math.PI / 2,
    },
    // 16, 17: North Flanking Walls beside central doorway
    {
      wallSide: 'north',
      wallLabel: 'North Arm · North-West Wall',
      x: -4.85,
      z: northZ + 0.24,
      rotY: 0,
      standX: -4.85,
      standZ: northZ + 3.4,
      standYaw: 0,
    },
    {
      wallSide: 'north',
      wallLabel: 'North Arm · North-East Wall',
      x: 4.85,
      z: northZ + 0.24,
      rotY: 0,
      standX: 4.85,
      standZ: northZ + 3.4,
      standYaw: 0,
    },
  ];

  const chosen = crossSlots[slotInRoom] ?? crossSlots[0];
  return {
    index: safeIndex,
    roomIndex,
    roomNumber: roomIndex + 1,
    slotInRoom,
    wallSide: chosen.wallSide,
    wallLabel: chosen.wallLabel,
    x: chosen.x,
    y: 2.55,
    z: chosen.z,
    rotY: chosen.rotY,
    standPoint: { x: chosen.standX, z: chosen.standZ, yaw: chosen.standYaw },
  };
}

/**
 * Checks whether a 2D world coordinate (x, z) lies within the architectural footprint
 * of the multi-room museum (including cruciform Cross-Hall transept wings).
 */
export function isInsideMuseumFootprint(
  x: number,
  z: number,
  layout: MuseumLayout,
  buffer = 0.85
): boolean {
  if (z > layout.southWallZ + buffer || z < layout.northWallZ - buffer) {
    return false;
  }
  for (const room of layout.rooms) {
    if (z <= room.southZ + buffer && z >= room.northZ - buffer) {
      if (!room.isCrossHall) {
        if (Math.abs(x) <= ROOM_HALF_WIDTH + buffer) return true;
      } else {
        if (Math.abs(x) <= ROOM_HALF_WIDTH + buffer) return true;
        const wingMinZ = room.centerZ - room.wingHalfDepth - buffer;
        const wingMaxZ = room.centerZ + room.wingHalfDepth + buffer;
        if (z >= wingMinZ && z <= wingMaxZ && Math.abs(x) <= room.wingHalfWidth + buffer) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Returns the 0-based room index containing world coordinate Z.
 */
export function getRoomIndexAtZ(z: number, layout: MuseumLayout): number {
  for (const room of layout.rooms) {
    if (z <= room.southZ + 0.001 && z >= room.northZ - 0.001) {
      return room.index;
    }
  }
  return z > layout.southWallZ ? 0 : layout.roomCount - 1;
}

/**
 * Finds the nearest connecting door within interaction distance of the player.
 */
export function findNearbyDoor(
  x: number,
  z: number,
  layout: MuseumLayout,
  radius = DOOR_INTERACT_RADIUS
): DoorDefinition | null {
  let nearest: DoorDefinition | null = null;
  let bestDist = radius;
  for (const door of layout.doors) {
    const d = Math.hypot(x - door.x, z - door.z);
    if (d <= bestDist) {
      bestDist = d;
      nearest = door;
    }
  }
  return nearest;
}

/**
 * Clamps player or camera position inside room boundaries (including standard rectangular rooms
 * AND cruciform Grand Cross / X-Hall rooms with wide West & East wings), enforcing solid partition
 * walls, closed doors, re-entrant wing corners, and pushing smoothly around centerpieces.
 */
export function clampPlayerPosition(
  x: number,
  z: number,
  layout: MuseumLayout,
  openDoorIds?: ReadonlySet<string>,
  prevZ?: number,
  prevX?: number,
  allowSouthExit = false
): { x: number; z: number } {
  const naveMaxX = ROOM_HALF_WIDTH - WALL_COLLISION_MARGIN;
  const minZ = layout.northWallZ + WALL_COLLISION_MARGIN + 0.25;
  const maxZ = allowSouthExit
    ? layout.southWallZ + 1.2
    : layout.southWallZ - WALL_COLLISION_MARGIN - 0.25;

  let cx = x;
  let cz = Math.min(maxZ, Math.max(minZ, z));

  const doorHalfPass = DOOR_WIDTH / 2 - 0.52;

  // Enforce partition walls & closed doors between adjacent rooms
  for (const door of layout.doors) {
    const isDoorOpen = Boolean(openDoorIds?.has(door.id));
    const inDoorOpening = Math.abs(cx) <= doorHalfPass;
    const canPass = isDoorOpen && inDoorOpening;

    if (!canPass) {
      const refZ = prevZ !== undefined ? prevZ : cz;
      const wasSouth = refZ >= door.z;
      const crossedFromSouth = wasSouth && cz < door.z + DOOR_WALL_BUFFER;
      const crossedFromNorth = !wasSouth && cz > door.z - DOOR_WALL_BUFFER;
      const insideBand = Math.abs(cz - door.z) < DOOR_WALL_BUFFER;

      if (crossedFromSouth || (insideBand && wasSouth)) {
        cz = Math.max(cz, door.z + DOOR_WALL_BUFFER);
      } else if (crossedFromNorth || (insideBand && !wasSouth)) {
        cz = Math.min(cz, door.z - DOOR_WALL_BUFFER);
      }
    }
  }

  // Enforce room-specific horizontal bounds (standard rectangle OR cruciform Cross/X hall wings!)
  const activeRoom = layout.rooms[getRoomIndexAtZ(cz, layout)] ?? layout.rooms[0];
  if (!activeRoom.isCrossHall) {
    cx = Math.min(naveMaxX, Math.max(-naveMaxX, cx));
  } else {
    const wingMaxX = activeRoom.wingHalfWidth - WALL_COLLISION_MARGIN;
    const wingMinZ = activeRoom.centerZ - activeRoom.wingHalfDepth + WALL_COLLISION_MARGIN;
    const wingMaxZ = activeRoom.centerZ + activeRoom.wingHalfDepth - WALL_COLLISION_MARGIN;

    cx = Math.min(wingMaxX, Math.max(-wingMaxX, cx));

    // Re-entrant exterior corners outside the Cross/X footprint
    if (Math.abs(cx) > naveMaxX && (cz < wingMinZ || cz > wingMaxZ)) {
      const refX = prevX !== undefined ? prevX : cx;
      if (Math.abs(refX) <= naveMaxX + 0.05) {
        // Came from the North/South nave arm -> slide along nave side wall
        cx = cx < 0 ? -naveMaxX : naveMaxX;
      } else {
        // Came from inside the East/West wing -> slide along wing North/South wall
        cz = Math.min(wingMaxZ, Math.max(wingMinZ, cz));
      }
    }
  }

  // Push smoothly out of each room's central floral centerpiece plinth
  for (const ped of layout.pedestals) {
    const dx = cx - ped.x;
    const dz = cz - ped.z;
    const dist = Math.hypot(dx, dz);
    if (dist < ped.radius) {
      if (dist < 0.001) {
        cz = ped.z + ped.radius;
      } else {
        const scale = ped.radius / dist;
        cx = ped.x + dx * scale;
        cz = ped.z + dz * scale;
      }
    }
  }

  return { x: cx, z: cz };
}

/**
 * Deterministically sorts artworks chronologically by dateCaptured (YYYY-MM-DD).
 */
export function sortArtworksByDate(
  artworks: ArtworkItem[],
  order: DateSortOrder = 'newest'
): ArtworkItem[] {
  return [...artworks].sort((a, b) => {
    const dateCmp = a.dateCaptured.localeCompare(b.dateCaptured);
    if (dateCmp !== 0) {
      return order === 'newest' ? -dateCmp : dateCmp;
    }
    return a.title.localeCompare(b.title);
  });
}

export function formatArchivalDate(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatAccessionNumber(isoDate: string, index: number): string {
  const clean = isoDate.replace(/-/g, '.');
  const seq = String(index + 1).padStart(2, '0');
  return `ACC. ${clean}.${seq}`;
}

/**
 * Groups sorted artworks by their exact date for the chronological archive view.
 */
export function groupArtworksByDate(
  artworks: ArtworkItem[],
  order: DateSortOrder = 'newest'
): DateGroup[] {
  const sorted = sortArtworksByDate(artworks, order);
  const map = new Map<string, ArtworkItem[]>();

  for (const item of sorted) {
    const existing = map.get(item.dateCaptured);
    if (existing) {
      existing.push(item);
    } else {
      map.set(item.dateCaptured, [item]);
    }
  }

  return Array.from(map.entries()).map(([dateKey, items]) => ({
    dateKey,
    label: formatArchivalDate(dateKey),
    items,
  }));
}

export function validateRoomName(rawName: string): ValidationResult {
  const errors: Record<string, string> = {};
  const trimmed = rawName.trim();
  if (!trimmed) {
    errors.roomName = 'Please enter a room name.';
  } else if (trimmed.length > 60) {
    errors.roomName = 'Room name must be 60 characters or fewer.';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateArtworkInput(input: {
  title: string;
  artist: string;
  dateCaptured: string;
  imageUrl: string;
  notes: string;
}): ValidationResult {
  const errors: Record<string, string> = {};
  const title = input.title.trim();
  const artist = input.artist.trim();

  if (!title) {
    errors.title = 'Please enter an artwork title.';
  } else if (title.length > 120) {
    errors.title = 'Title must be 120 characters or fewer.';
  }

  if (!artist) {
    errors.artist = 'Please enter the creator or photographer name.';
  } else if (artist.length > 100) {
    errors.artist = 'Creator name must be 100 characters or fewer.';
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateCaptured)) {
    errors.dateCaptured = 'Choose a valid archival date (YYYY-MM-DD).';
  }

  if (!input.imageUrl || input.imageUrl.trim().length < 5) {
    errors.imageUrl = 'Please upload an image or choose a gallery sample.';
  } else if (input.imageUrl.length > 440000) {
    errors.imageUrl = 'Image payload is too large. Please choose a smaller photo.';
  }

  if (input.notes.length > 500) {
    errors.notes = 'Curatorial notes must be 500 characters or fewer.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateAccessGrant(input: {
  email: string;
  displayName: string;
  role: MemberRole;
  gender: Gender;
  existingEmails: string[];
}): ValidationResult {
  const errors: Record<string, string> = {};
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Enter a valid email address.';
  } else if (input.existingEmails.map((e) => e.toLowerCase()).includes(email)) {
    errors.email = 'This person already has access to your museum.';
  } else if (input.existingEmails.length >= 10) {
    errors.email = 'Maximum 10 invited visitors reached for this museum.';
  }

  if (!displayName) {
    errors.displayName = 'Enter the visitor name.';
  } else if (displayName.length > 80) {
    errors.displayName = 'Name must be 80 characters or fewer.';
  }

  if (input.role !== 'visitor' && input.role !== 'curator') {
    errors.role = 'Invalid role selected.';
  }

  if (input.gender !== 'man' && input.gender !== 'woman') {
    errors.gender = 'Select Man or Woman for visitor avatar.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function generateAccessCode(seed = ''): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  const source = seed || `${Date.now()}-${Math.random()}`;
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  for (let i = 0; i < 4; i++) {
    const idx = Math.abs((hash >>> (i * 7)) % alphabet.length);
    suffix += alphabet[idx];
  }
  return `MUS-${suffix}`;
}
