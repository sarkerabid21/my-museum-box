import {
  clampPlayerPosition,
  DOOR_WALL_BUFFER,
  DOOR_WIDTH,
  ROOM_HALF_WIDTH,
  WALL_COLLISION_MARGIN,
  type DoorDefinition,
  type MuseumLayout,
} from './layout';
import { normalizeAngle, shortestAngleDelta } from './cameraSteering';
import { isInsideAmusementPark } from './amusementPark';
import {
  computeWaterTowerStairY,
  SWIMMING_POOL_BOUNDS,
  WATER_TOWER_STAIRS,
} from './waterRide';
import { computeMarketElevation } from './marketWorld';
import { computeMetroElevation } from './metroSystem';
import { computeKashmirElevation } from './kashmirWorld';

export const EXIT_DOOR_ID = 'door-exit-outside';

// Outdoor world spatial coordinates (meters) — Vast Open-World from Cox's Bazar to CTG & Kashmir
export const WORLD_MIN_X = -820;
export const WORLD_MAX_X = 225;
export const GARDEN_START_Z = 9.0;
export const FOOTPATH_NORTH_Z = 24.5;
export const ROAD_NORTH_Z = 28.0;
export const ROAD_CENTER_Z = 35.0;
export const ROAD_SOUTH_Z = 42.0;
export const FOOTPATH_SOUTH_Z = 45.5;
export const WORLD_MAX_Z = 135.0;

export const LANE_WESTBOUND_Z = 31.6; // Heading -X toward Chittagong (CTG)
export const LANE_EASTBOUND_Z = 38.4; // Heading +X toward Cox's Bazar (COXS)

export const CTG_ZONE_THRESHOLD_X = -54;
export const COXS_ZONE_THRESHOLD_X = 54;

export const VEHICLE_HAIL_RADIUS = 22.0;
export const INITIAL_WALLET_BDT = 5000;

export type WorldZoneId = 'museum' | 'garden' | 'park' | 'road' | 'ctg' | 'coxs' | 'kashmir';

export interface WorldZoneInfo {
  id: WorldZoneId;
  symbol: 'MUSEUM' | 'GARDEN' | 'PARK' | 'ROAD' | 'CTG' | 'COXS' | 'KASHMIR';
  label: string;
}

export type VehicleKind = 'rickshaw' | 'bike' | 'car' | 'speedboat';
export type RideDestination = 'ctg' | 'coxs' | 'kashmir' | 'freeroam';

export interface TrafficVehicleState {
  id: string;
  kind: VehicleKind;
  title: string;
  driverName: string;
  primaryColor: number;
  accentColor: number;
  x: number;
  z: number;
  yaw: number; // Three.js Y rotation (0 = +Z, +PI/2 = +X, -PI/2 = -X)
  dir: 1 | -1; // +1 = Eastbound (+X, Cox's Bazar), -1 = Westbound (-X, Chittagong)
  laneZ: number;
  cruiseSpeed: number;
  currentSpeed: number;
  status: 'cruising' | 'stopped_talking' | 'player_driving';
  stolen: boolean;
  driverEjected: boolean;
  minX?: number;
  maxX?: number;
}

export interface VehicleTalkSession {
  vehicleId: string;
  kind: VehicleKind;
  vehicleTitle: string;
  driverName: string;
  destination: RideDestination;
  askingFare: number;
  minFare: number;
  bargainStep: number;
  driverLine: string;
  canBargainMore: boolean;
}

export interface DrivingInput {
  throttle: number; // +1 (W/Up), -1 (S/Down), 0
  steer: number; // +1 (Left: A/ArrowLeft), -1 (Right: D/ArrowRight), 0
  boost: boolean;
}

export interface DrivingKinematicsState {
  x: number;
  z: number;
  yaw: number;
  speed: number;
  camYaw: number;
}

export interface DrivingStepResult {
  x: number;
  z: number;
  yaw: number;
  speed: number;
  camYaw: number;
  wheelSpinDelta: number;
}

export const GARDEN_FOUNTAINS: ReadonlyArray<{ x: number; z: number; radius: number }> = [
  { x: -11.5, z: 16.8, radius: 2.35 },
  { x: 11.5, z: 16.8, radius: 2.35 },
];

export const VEHICLE_SPECS: Record<
  VehicleKind,
  {
    title: string;
    maxSpeed: number;
    boostSpeed: number;
    accel: number;
    turnRate: number;
    baseFare: Record<RideDestination, number>;
    minFareRatio: number;
  }
> = {
  rickshaw: {
    title: 'Cycle Rickshaw',
    maxSpeed: 8.2,
    boostSpeed: 10.4,
    accel: 7.5,
    turnRate: 2.15,
    baseFare: { ctg: 120, coxs: 150, kashmir: 260, freeroam: 80 },
    minFareRatio: 0.62,
  },
  bike: {
    title: 'Motorbike',
    maxSpeed: 16.5,
    boostSpeed: 21.5,
    accel: 13.5,
    turnRate: 2.35,
    baseFare: { ctg: 220, coxs: 260, kashmir: 420, freeroam: 140 },
    minFareRatio: 0.68,
  },
  car: {
    title: 'Private Car',
    maxSpeed: 19.5,
    boostSpeed: 25.0,
    accel: 12.0,
    turnRate: 1.95,
    baseFare: { ctg: 450, coxs: 520, kashmir: 850, freeroam: 300 },
    minFareRatio: 0.72,
  },
  speedboat: {
    title: 'Speedboat',
    maxSpeed: 24.0,
    boostSpeed: 32.0,
    accel: 16.0,
    turnRate: 2.2,
    baseFare: { ctg: 280, coxs: 380, kashmir: 550, freeroam: 200 },
    minFareRatio: 0.65,
  },
};

export function getExitDoorDefinition(layout: MuseumLayout): DoorDefinition {
  return {
    id: EXIT_DOOR_ID,
    fromRoomIndex: 0,
    toRoomIndex: -1,
    x: 0,
    z: layout.southWallZ,
    width: DOOR_WIDTH,
    height: 3.9,
  };
}

/**
 * Classifies the player's current world zone for the HUD and Minimap symbols:
 * - Inside museum rooms -> MUSEUM
 * - Outside in front garden -> GARDEN
 * - On highway West side (<= -54m) -> CTG (Chittagong)
 * - On highway East side (>= +54m) -> COXS (Cox's Bazar)
 * - Central museum highway -> ROAD
 */
export function getWorldZone(x: number, z: number): WorldZoneInfo {
  const parkSide = isInsideAmusementPark(x, z);
  if (parkSide) {
    return {
      id: 'park',
      symbol: 'PARK',
      label: parkSide === 'west' ? 'West Amusement Park' : 'East Amusement Park',
    };
  }
  if (z <= GARDEN_START_Z + 0.25 && Math.abs(x) <= ROOM_HALF_WIDTH + 0.9) {
    return { id: 'museum', symbol: 'MUSEUM', label: 'My Museum' };
  }
  if (x <= -430) {
    if (x <= -650) {
      return { id: 'kashmir', symbol: 'KASHMIR', label: 'Gulmarg Ski Slopes & Gondola' };
    }
    if (x <= -580) {
      return { id: 'kashmir', symbol: 'KASHMIR', label: 'Kashmir Frozen Dal Lake & Snow Arena' };
    }
    return { id: 'kashmir', symbol: 'KASHMIR', label: 'Kashmir Mountain Pass & Alpine Chalets' };
  }
  if (x <= -350) {
    return { id: 'ctg', symbol: 'CTG', label: 'Chittagong Zero Point' };
  }
  if (x >= -278 && x <= -251 && z >= 75 && z <= 96) {
    return { id: 'ctg', symbol: 'CTG', label: 'Chittagong Grand Market' };
  }
  if (x <= -100 && x >= -215 && z >= 84) {
    return { id: 'ctg', symbol: 'CTG', label: 'Karnaphuli Launch Terminal' };
  }
  if (x <= CTG_ZONE_THRESHOLD_X) {
    return { id: 'ctg', symbol: 'CTG', label: 'Chittagong Highway' };
  }
  if (x >= COXS_ZONE_THRESHOLD_X) {
    return { id: 'coxs', symbol: 'COXS', label: "Cox's Bazar Road" };
  }
  if (z < FOOTPATH_NORTH_Z) {
    return { id: 'garden', symbol: 'GARDEN', label: 'Museum Garden' };
  }
  return { id: 'road', symbol: 'ROAD', label: 'Chittagong–Cox Highway' };
}

/**
 * Finds the nearest door (including inter-room doors AND the Room 1 outdoor exit door).
 */
export function findNearestAnyDoor(
  x: number,
  z: number,
  layout: MuseumLayout,
  radius = 5.2
): DoorDefinition | null {
  const allDoors = [...layout.doors, getExitDoorDefinition(layout)];
  let nearest: DoorDefinition | null = null;
  let bestDist = radius;
  for (const door of allDoors) {
    const d = Math.hypot(x - door.x, z - door.z);
    if (d <= bestDist) {
      bestDist = d;
      nearest = door;
    }
  }
  return nearest;
}

/**
 * Unified collision clamping for both indoor multi-room museum AND the full outdoor
 * garden, footpaths, Chittagong–Cox's Bazar highway, and exterior perimeter.
 */
export function clampWorldPosition(
  x: number,
  z: number,
  layout: MuseumLayout,
  openDoorIds?: ReadonlySet<string>,
  prevZ?: number,
  prevX?: number,
  isDriving = false
): { x: number; z: number } {
  const refZ = prevZ !== undefined ? prevZ : z;
  const refX = prevX !== undefined ? prevX : x;
  const exitOpen = Boolean(openDoorIds?.has(EXIT_DOOR_ID));
  const doorHalfPass = DOOR_WIDTH / 2 - 0.52;

  // Driving stays outdoors along the highway, city streets, river bridge & CTG approach
  if (isDriving) {
    const cx = Math.min(WORLD_MAX_X - 2.0, Math.max(WORLD_MIN_X + 2.0, x));
    let cz = z;
    if (cx < -45) {
      if (cx <= -202 && cx >= -238) {
        // Restricted to the Karnaphuli Bridge deck (width 9.6m centered at z = 68)
        cz = Math.min(72.5, Math.max(63.5, cz));
      } else if (cx < -238) {
        // Chittagong City Center & Zero Point Grand Roundabout
        cz = Math.min(88.0, Math.max(48.0, cz));
      } else {
        // Western city roads: vehicles cannot enter Launch Terminal or river (z > 74.8 is pedestrian only)
        cz = Math.min(74.8, Math.max(FOOTPATH_NORTH_Z + 1.2, cz));
      }
    } else {
      cz = Math.min(ROAD_SOUTH_Z - 0.7, Math.max(FOOTPATH_NORTH_Z + 1.2, cz));
    }
    return { x: cx, z: cz };
  }

  const museumOuterHalfW = ROOM_HALF_WIDTH + 0.85;
  const wasInsideMuseum =
    Math.abs(refX) <= museumOuterHalfW && refZ <= layout.southWallZ;
  const wantsOutside = z > layout.southWallZ - DOOR_WALL_BUFFER;
  const wantsInside =
    z < layout.southWallZ + DOOR_WALL_BUFFER && Math.abs(x) <= museumOuterHalfW;
  const inExitOpening = Math.abs(x) <= doorHalfPass;

  // Transition through Room 1 South Exit Door (z = 9.0)
  if (wasInsideMuseum) {
    if (wantsOutside && !(exitOpen && inExitOpening)) {
      // Stay clamped inside the indoor museum
      return clampPlayerPosition(
        x,
        Math.min(z, layout.southWallZ - WALL_COLLISION_MARGIN - 0.12),
        layout,
        openDoorIds,
        refZ,
        refX,
        false
      );
    }
    if (z <= layout.southWallZ) {
      // Moving inside rooms (including Cross Hall wings) or approaching open exit doorway
      return clampPlayerPosition(
        x,
        z,
        layout,
        openDoorIds,
        refZ,
        refX,
        exitOpen && inExitOpening
      );
    }
    // Just stepped cleanly out through the open exit door into the garden!
    return {
      x: Math.min(doorHalfPass, Math.max(-doorHalfPass, x)),
      z,
    };
  }

  // Currently outside in the Garden / Road / CTG / COXS world
  let cx = Math.min(WORLD_MAX_X, Math.max(WORLD_MIN_X, x));
  let cz = Math.min(WORLD_MAX_Z, z);

  // Prevent walking back through solid Museum exterior walls except via the open exit door
  const museumOuterSouthZ = layout.southWallZ + 0.75;
  const museumOuterNorthZ = layout.northWallZ - 0.85;

  if (cz < museumOuterSouthZ && Math.abs(cx) < museumOuterHalfW) {
    if (exitOpen && inExitOpening && wantsInside && refZ >= layout.southWallZ - 0.2) {
      // Entering back through the open museum door!
      return {
        x: Math.min(doorHalfPass, Math.max(-doorHalfPass, cx)),
        z: cz,
      };
    }
    // Push outside the museum exterior wall
    if (Math.abs(refX) >= museumOuterHalfW - 0.15) {
      cx = refX < 0 ? -museumOuterHalfW : museumOuterHalfW;
    } else {
      cz = Math.max(cz, museumOuterSouthZ);
    }
  } else if (Math.abs(cx) < museumOuterHalfW && cz < museumOuterNorthZ) {
    cz = museumOuterNorthZ;
  }

  // Keep player cleanly inside the front garden, highway & both West/East Amusement Parks flanking the museum
  if (Math.abs(cx) >= museumOuterHalfW && cz < 1.8 && cx > -430) {
    cz = 1.8;
  } else if (cx <= -430) {
    cz = Math.min(205.0, Math.max(-25.0, cz));
  }

  // Push smoothly around the two ornamental garden fountains
  for (const f of GARDEN_FOUNTAINS) {
    const dx = cx - f.x;
    const dz = cz - f.z;
    const dist = Math.hypot(dx, dz);
    if (dist < f.radius) {
      if (dist < 0.001) {
        cz = f.z + f.radius;
      } else {
        const s = f.radius / dist;
        cx = f.x + dx * s;
        cz = f.z + dz * s;
      }
    }
  }

  // Keep player safe within handrails when climbing/standing on the elevated water tower stairs/platform
  const stairY = computeWaterTowerStairY(cx, cz);
  if (stairY > 0.4) {
    cx = Math.max(
      WATER_TOWER_STAIRS.minX + 0.32,
      Math.min(WATER_TOWER_STAIRS.maxX - 0.32, cx)
    );
    cz = Math.max(WATER_TOWER_STAIRS.topDeckMinZ + 0.32, cz);
  }

  return { x: cx, z: cz };
}

/**
 * Heightfield elevation across the outdoor world:
 * - Returns walkable staircase / platform height (0 -> 10.5m) when ascending the Aqua Tower
 * - Returns swimming pool water level (y = 0.42m) when inside the swimming pool
 * - Returns raised sidewalk height (y = 0.14m) along the highway footpaths
 * - Returns ground level (y = 0.0m) everywhere else
 */
export function computeOutdoorElevation(x: number, z: number, currentY = 0): number {
  if (x <= -430) {
    return computeKashmirElevation(x, z, currentY);
  }

  const metroY = computeMetroElevation(x, z, currentY);
  if (metroY > 0) return metroY;

  const stairY = computeWaterTowerStairY(x, z);
  if (stairY > 0) return stairY;

  const marketY = computeMarketElevation(x, z, currentY);
  if (marketY > 0) return marketY;

  if (
    x >= SWIMMING_POOL_BOUNDS.minX &&
    x <= SWIMMING_POOL_BOUNDS.maxX &&
    z >= SWIMMING_POOL_BOUNDS.minZ &&
    z <= SWIMMING_POOL_BOUNDS.maxZ
  ) {
    return SWIMMING_POOL_BOUNDS.waterY;
  }

  // Karnaphuli Bridge elevation ramp & deck (bridge deck is at y = 0.55m, ramp from x = -198 to -234, z: 62 to 74)
  if (x <= -196 && x >= -238 && Math.abs(z - 68) <= 5.8) {
    if (x <= -206 && x >= -234) {
      return 0.55; // Main bridge deck
    }
    if (x > -206) {
      // East approach ramp up to bridge: x from -196 (y=0) to -206 (y=0.55)
      const t = (x - (-196)) / (-206 - (-196));
      return t * 0.55;
    }
    // West approach ramp down from bridge: x from -234 (y=0.55) to -238 (y=0)
    const t = (x - (-238)) / (-234 - (-238));
    return t * 0.55;
  }

  // Launch Terminal & South Riverfront boardwalk & footbridge (x: -210 to 135, z: 88 to 116)
  if (x >= -210 && x <= 135 && z >= 88 && z <= 116) {
    return 0.25; // Raised wooden/stone pier deck above river water
  }

  if (z >= FOOTPATH_NORTH_Z && z <= ROAD_NORTH_Z) return 0.14;
  if (z >= ROAD_SOUTH_Z && z <= FOOTPATH_SOUTH_Z) return 0.14;
  return 0.0;
}

/**
 * Deterministic fleet of rickshaws, motorbikes, and cars patrolling both highway lanes.
 */
export function createInitialTrafficVehicles(): TrafficVehicleState[] {
  const templates: Array<{
    id: string;
    kind: VehicleKind;
    driverName: string;
    primaryColor: number;
    accentColor: number;
    x: number;
    dir: 1 | -1;
    cruiseSpeed: number;
    customZ?: number;
    minX?: number;
    maxX?: number;
  }> = [
    // ── Sector 1: Central Museum Front & Cox's Bazar Coastal Highway (x: -45 to 175) ──
    {
      id: 'veh-rickshaw-1',
      kind: 'rickshaw',
      driverName: 'Kamal Mama',
      primaryColor: 0xc92a3e,
      accentColor: 0xf4c430,
      x: -14,
      dir: 1,
      cruiseSpeed: 4.4,
      minX: -45,
      maxX: 110,
    },
    {
      id: 'veh-bike-1',
      kind: 'bike',
      driverName: 'Rafiq Rider',
      primaryColor: 0x1d4ed8,
      accentColor: 0xe5e7eb,
      x: 24,
      dir: -1,
      cruiseSpeed: 8.6,
      minX: -45,
      maxX: 110,
    },
    {
      id: 'veh-car-1',
      kind: 'car',
      driverName: 'Sohel Driver',
      primaryColor: 0xede9e1,
      accentColor: 0x1e293b,
      x: -40,
      dir: 1,
      cruiseSpeed: 9.8,
      minX: -45,
      maxX: 125,
    },
    {
      id: 'veh-rickshaw-2',
      kind: 'rickshaw',
      driverName: 'Babul Bhai',
      primaryColor: 0x0f766e,
      accentColor: 0xf97316,
      x: 56,
      dir: -1,
      cruiseSpeed: 4.1,
      minX: -45,
      maxX: 120,
    },
    {
      id: 'veh-car-2',
      kind: 'car',
      driverName: 'Tariq Chacha',
      primaryColor: 0x7c2d12,
      accentColor: 0xd4b282,
      x: 88,
      dir: -1,
      cruiseSpeed: 9.4,
      minX: 20,
      maxX: 175,
    },
    {
      id: 'veh-bike-2',
      kind: 'bike',
      driverName: 'Nayeem',
      primaryColor: 0xb91c1c,
      accentColor: 0x111827,
      x: 125,
      dir: 1,
      cruiseSpeed: 8.9,
      minX: 45,
      maxX: 175,
    },
    {
      id: 'veh-rickshaw-3',
      kind: 'rickshaw',
      driverName: 'Jashim Mama',
      primaryColor: 0x15803d,
      accentColor: 0xfacc15,
      x: 155,
      dir: -1,
      cruiseSpeed: 4.2,
      minX: 65,
      maxX: 175,
    },
    {
      id: 'veh-car-coxs',
      kind: 'car',
      driverName: 'Milon Tourist Driver',
      primaryColor: 0x0284c7,
      accentColor: 0xfef08a,
      x: 168,
      dir: 1,
      cruiseSpeed: 9.6,
      minX: 85,
      maxX: 178,
    },
    {
      id: 'veh-speedboat-1',
      kind: 'speedboat',
      driverName: 'Alamgir Majhi',
      primaryColor: 0x0284c7,
      accentColor: 0xfacc15,
      x: -140,
      dir: 1,
      cruiseSpeed: 0,
      customZ: 96.0,
      minX: -200,
      maxX: 180,
    },

    // ── Sector 2: Chittagong City Approach & Launch Ghat (x: -180 to -45) ──
    {
      id: 'veh-ctg-taxi-1',
      kind: 'car',
      driverName: 'Salam Taxi Driver',
      primaryColor: 0xfacc15,
      accentColor: 0x0f172a,
      x: -75,
      dir: -1,
      cruiseSpeed: 9.2,
      customZ: 73.0,
      minX: -175,
      maxX: -45,
    },
    {
      id: 'veh-ctg-bike-1',
      kind: 'bike',
      driverName: 'Faruk Express',
      primaryColor: 0xd97706,
      accentColor: 0x1e293b,
      x: -110,
      dir: 1,
      cruiseSpeed: 8.8,
      customZ: 75.5,
      minX: -175,
      maxX: -45,
    },
    {
      id: 'veh-ctg-rickshaw-1',
      kind: 'rickshaw',
      driverName: 'Anowar Mama',
      primaryColor: 0x9333ea,
      accentColor: 0xfde047,
      x: -150,
      dir: -1,
      cruiseSpeed: 4.3,
      customZ: 74.0,
      minX: -180,
      maxX: -55,
    },

    // ── Sector 3: Grand Market & Metro Station 2 (x: -320 to -180) ──
    {
      id: 'veh-market-rickshaw-1',
      kind: 'rickshaw',
      driverName: 'Mojid Mama',
      primaryColor: 0xe11d48,
      accentColor: 0x38bdf8,
      x: -210,
      dir: 1,
      cruiseSpeed: 4.2,
      customZ: 72.0,
      minX: -325,
      maxX: -180,
    },
    {
      id: 'veh-market-car-1',
      kind: 'car',
      driverName: 'Kabir CTG Driver',
      primaryColor: 0x2563eb,
      accentColor: 0xf1f5f9,
      x: -255,
      dir: -1,
      cruiseSpeed: 9.5,
      customZ: 69.5,
      minX: -325,
      maxX: -180,
    },
    {
      id: 'veh-market-bike-1',
      kind: 'bike',
      driverName: 'Shuvo Rider',
      primaryColor: 0x059669,
      accentColor: 0x111827,
      x: -290,
      dir: 1,
      cruiseSpeed: 9.0,
      customZ: 72.0,
      minX: -330,
      maxX: -180,
    },

    // ── Sector 4: Chittagong Zero Point Roundabout & Central Bus Terminal (x: -430 to -320) ──
    {
      id: 'veh-zp-car-1',
      kind: 'car',
      driverName: 'Ratan CTG Express',
      primaryColor: 0x475569,
      accentColor: 0xfbbf24,
      x: -350,
      dir: 1,
      cruiseSpeed: 9.3,
      customZ: 67.5,
      minX: -425,
      maxX: -320,
    },
    {
      id: 'veh-zp-bike-1',
      kind: 'bike',
      driverName: 'Tanvir Port Rider',
      primaryColor: 0x18181b,
      accentColor: 0xef4444,
      x: -380,
      dir: -1,
      cruiseSpeed: 8.7,
      customZ: 70.0,
      minX: -425,
      maxX: -320,
    },
    {
      id: 'veh-zp-rickshaw-1',
      kind: 'rickshaw',
      driverName: 'Akbar Mama',
      primaryColor: 0xca8a04,
      accentColor: 0x10b981,
      x: -410,
      dir: 1,
      cruiseSpeed: 4.1,
      customZ: 67.5,
      minX: -428,
      maxX: -330,
    },
    {
      id: 'veh-ctg-parked-car',
      kind: 'car',
      driverName: 'Chittagong Cruiser (Ready to Drive)',
      primaryColor: 0x0284c7,
      accentColor: 0xfacc15,
      x: -395,
      dir: -1,
      cruiseSpeed: 0,
      customZ: 74.0,
      minX: -428,
      maxX: -45,
    },

    // ── Sector 5: Kashmir Scenic Alpine Mountain Highway (x: -740 to -430) ──
    {
      id: 'veh-kashmir-parked-jeep',
      kind: 'car',
      driverName: 'Alpine Mountain 4x4 Jeep (Ready to Drive)',
      primaryColor: 0xb91c1c,
      accentColor: 0xfef08a,
      x: -438,
      dir: -1,
      cruiseSpeed: 0,
      customZ: 65.0,
      minX: -740,
      maxX: -430,
    },
    {
      id: 'veh-kashmir-jeep-1',
      kind: 'car',
      driverName: 'Bashir Chacha',
      primaryColor: 0x166534,
      accentColor: 0xfacc15,
      x: -460,
      dir: -1,
      cruiseSpeed: 9.6,
      customZ: 65.5,
      minX: -735,
      maxX: -435,
    },
    {
      id: 'veh-kashmir-bike-1',
      kind: 'bike',
      driverName: 'Imran Snow Rider',
      primaryColor: 0x0284c7,
      accentColor: 0xffffff,
      x: -530,
      dir: 1,
      cruiseSpeed: 8.8,
      customZ: 67.0,
      minX: -735,
      maxX: -435,
    },
    {
      id: 'veh-kashmir-car-1',
      kind: 'car',
      driverName: 'Gulzar Alpine Sedan',
      primaryColor: 0xf8fafc,
      accentColor: 0x1e3a8a,
      x: -590,
      dir: -1,
      cruiseSpeed: 9.4,
      customZ: 67.0,
      minX: -735,
      maxX: -435,
    },
    {
      id: 'veh-kashmir-jeep-2',
      kind: 'car',
      driverName: 'Shabbir Resort SUV',
      primaryColor: 0x1e3a5f,
      accentColor: 0xe11d48,
      x: -650,
      dir: 1,
      cruiseSpeed: 9.8,
      customZ: 70.0,
      minX: -735,
      maxX: -435,
    },
    {
      id: 'veh-kashmir-car-2',
      kind: 'car',
      driverName: 'Farooq Valley Taxi',
      primaryColor: 0xb45309,
      accentColor: 0xfde047,
      x: -710,
      dir: -1,
      cruiseSpeed: 9.2,
      customZ: 73.5,
      minX: -735,
      maxX: -435,
    },
  ];

  return templates.map((t) => {
    const laneZ = 'customZ' in t && typeof t.customZ === 'number' ? t.customZ : t.dir === 1 ? LANE_EASTBOUND_Z : LANE_WESTBOUND_Z;
    return {
      id: t.id,
      kind: t.kind,
      title: VEHICLE_SPECS[t.kind].title,
      driverName: t.driverName,
      primaryColor: t.primaryColor,
      accentColor: t.accentColor,
      x: t.x,
      z: laneZ,
      yaw: t.dir === 1 ? Math.PI / 2 : -Math.PI / 2,
      dir: t.dir,
      laneZ,
      cruiseSpeed: t.cruiseSpeed,
      currentSpeed: t.cruiseSpeed,
      status: 'cruising',
      stolen: false,
      driverEjected: false,
      minX: t.minX,
      maxX: t.maxX,
    };
  });
}

/**
 * Finds the nearest cruising or stopped vehicle within hailing distance of the player.
 */
export function findNearestHailVehicle(
  px: number,
  pz: number,
  vehicles: ReadonlyArray<TrafficVehicleState>,
  maxRadius = VEHICLE_HAIL_RADIUS
): TrafficVehicleState | null {
  if (pz < GARDEN_START_Z + 8) return null;
  let best: TrafficVehicleState | null = null;
  let bestDist = maxRadius;
  for (const v of vehicles) {
    if (v.status === 'player_driving') continue;
    const dist = Math.hypot(v.x - px, v.z - pz);
    if (dist <= bestDist) {
      bestDist = dist;
      best = v;
    }
  }
  return best;
}

/**
 * Starts a fare negotiation conversation when the player hails & stops a vehicle.
 */
export function createTalkSession(
  vehicle: TrafficVehicleState,
  destination: RideDestination = 'ctg'
): VehicleTalkSession {
  const spec = VEHICLE_SPECS[vehicle.kind];
  const askingFare = spec.baseFare[destination];
  const minFare = Math.round((askingFare * spec.minFareRatio) / 10) * 10;
  const destLabel =
    destination === 'ctg'
      ? 'Chittagong (CTG)'
      : destination === 'coxs'
        ? "Cox's Bazar (COXS)"
        : destination === 'kashmir'
          ? 'Kashmir Valley & Gulmarg (KASHMIR)'
          : 'ei road e ghurte';

  const greeting =
    vehicle.kind === 'rickshaw'
      ? `Assalamu Alaikum mama! ${destLabel} jaben? ৳${askingFare} taka lagbe.`
      : vehicle.kind === 'bike'
        ? `Bhai kothay jaben? ${destLabel} gele ৳${askingFare} taka den, ekhon e niye jai.`
        : vehicle.kind === 'speedboat'
          ? `Ahlan wa sahlan! Speedboat e ${destLabel} jaben? Nodi ar shagor pari dibo ৳${askingFare} takay!`
          : `Sir, AC gari ache! ${destLabel} drop korbo ৳${askingFare} takay.`;

  return {
    vehicleId: vehicle.id,
    kind: vehicle.kind,
    vehicleTitle: vehicle.title,
    driverName: vehicle.driverName,
    destination,
    askingFare,
    minFare,
    bargainStep: 0,
    driverLine: greeting,
    canBargainMore: askingFare > minFare,
  };
}

/**
 * Switches the destination during an active talk session and recalculates the quote.
 */
export function changeTalkDestination(
  session: VehicleTalkSession,
  destination: RideDestination
): VehicleTalkSession {
  const spec = VEHICLE_SPECS[session.kind];
  const askingFare = spec.baseFare[destination];
  const minFare = Math.round((askingFare * spec.minFareRatio) / 10) * 10;
  const destLabel =
    destination === 'ctg'
      ? 'Chittagong (CTG)'
      : destination === 'coxs'
        ? "Cox's Bazar (COXS)"
        : destination === 'kashmir'
          ? 'Kashmir Valley & Gulmarg (KASHMIR)'
          : 'local ghurte';

  return {
    ...session,
    destination,
    askingFare,
    minFare,
    bargainStep: 0,
    canBargainMore: askingFare > minFare,
    driverLine: `${destLabel} gele ৳${askingFare} taka lagbe bhai. Ki bolen?`,
  };
}

/**
 * Interactive Banglish fare haggling ("Vara Komao").
 */
export function negotiateTalkSession(session: VehicleTalkSession): VehicleTalkSession {
  if (!session.canBargainMore || session.askingFare <= session.minFare) {
    return {
      ...session,
      canBargainMore: false,
      driverLine: `Na bhai, ৳${session.minFare} er niche jawa jabe na! Tel ar khoroch onek beshi.`,
    };
  }

  const nextStep = session.bargainStep + 1;
  const drop = Math.max(10, Math.round(((session.askingFare - session.minFare) * 0.55) / 10) * 10);
  const nextFare = Math.max(session.minFare, session.askingFare - drop);
  const canBargainMore = nextFare > session.minFare && nextStep < 3;

  const line = canBargainMore
    ? `Achha apnar jonno ৳${nextFare} taka den mama, tar cheye kom hobe na.`
    : `Thik ache bhai, last kotha ৳${nextFare} taka! Er kom korle loss hobe, uthe poren!`;

  return {
    ...session,
    askingFare: nextFare,
    bargainStep: nextStep,
    canBargainMore,
    driverLine: line,
  };
}

/**
 * Pays the agreed fare and deducts BDT from the player's wallet.
 */
export function acceptRideFare(
  session: VehicleTalkSession,
  walletBdt: number
): { ok: boolean; nextWallet: number; message: string } {
  if (walletBdt < session.askingFare) {
    return {
      ok: false,
      nextWallet: walletBdt,
      message: `Not enough balance (৳${walletBdt}). Try bargaining or take over the vehicle!`,
    };
  }
  const destText =
    session.destination === 'ctg'
      ? 'Chittagong (CTG)'
      : session.destination === 'coxs'
        ? "Cox's Bazar (COXS)"
        : 'the highway';
  return {
    ok: true,
    nextWallet: walletBdt - session.askingFare,
    message: `Paid ৳${session.askingFare} to ${session.driverName}. Driving ${session.vehicleTitle} toward ${destText}! Press [F] to get off.`,
  };
}

/**
 * Performs a GTA-style vehicle takeover ("Chintai") where the driver hops out shouting
 * and the player takes immediate control of the Rickshaw, Motorbike, or Car.
 */
export function executeVehicleTakeover(vehicle: TrafficVehicleState): {
  updatedVehicle: TrafficVehicleState;
  shoutLine: string;
  ejectedPos: { x: number; z: number };
} {
  const shoutLine =
    vehicle.kind === 'rickshaw'
      ? `${vehicle.driverName}: "Areh bhai! Amar rickshaw chintai kore koi jan?! Help!"`
      : vehicle.kind === 'bike'
        ? `${vehicle.driverName}: "Ei! Amar bike niye palaichen ken?! Thamun!"`
        : vehicle.kind === 'speedboat'
          ? `${vehicle.driverName}: "Ei! Amar speedboat chintai kore nodite palaichen?! Police daken!"`
          : `${vehicle.driverName}: "Chintai! Amar gari niye gelo! Keu thaman!"`;

  const footpathZ = vehicle.z < ROAD_CENTER_Z ? FOOTPATH_NORTH_Z + 1.4 : FOOTPATH_SOUTH_Z - 1.4;

  return {
    updatedVehicle: {
      ...vehicle,
      status: 'player_driving',
      stolen: true,
      driverEjected: true,
      currentSpeed: 0,
    },
    shoutLine,
    ejectedPos: {
      x: Math.max(WORLD_MIN_X + 4, Math.min(WORLD_MAX_X - 4, vehicle.x)),
      z: footpathZ,
    },
  };
}

/**
 * Advances vehicle physics & synchronized camera heading while the player is driving
 * a Rickshaw, Motorbike, or Car. Turning left/right rotates BOTH the vehicle and camera smoothly!
 */
export function stepVehicleDriving(
  kind: VehicleKind,
  input: DrivingInput,
  state: DrivingKinematicsState,
  delta: number
): DrivingStepResult {
  const dt = Math.min(Math.max(delta, 0.001), 0.1);
  const spec = VEHICLE_SPECS[kind];
  const maxFwd = input.boost ? spec.boostSpeed : spec.maxSpeed;
  const maxRev = -spec.maxSpeed * 0.42;

  let speed = state.speed;
  if (Math.abs(input.throttle) > 0.01) {
    const targetSpeed = input.throttle > 0 ? maxFwd : maxRev;
    const rate = input.throttle > 0 ? spec.accel : spec.accel * 1.1;
    speed += Math.sign(targetSpeed - speed) * Math.min(Math.abs(targetSpeed - speed), rate * dt);
  } else {
    // Natural rolling friction
    const drag = Math.exp(-3.8 * dt);
    speed *= drag;
    if (Math.abs(speed) < 0.08) speed = 0;
  }

  let yaw = normalizeAngle(state.yaw);
  if (Math.abs(input.steer) > 0.01) {
    // Allow steering even from low speed so maneuvering on the road feels immediate & fun
    const steerScale = Math.abs(speed) > 0.4 ? Math.sign(speed) : 1;
    const turnAmount = input.steer * spec.turnRate * steerScale * dt;
    yaw = normalizeAngle(yaw + turnAmount);
  }

  // Vehicle local forward is +Z rotated by yaw -> (sin(yaw), cos(yaw))
  let nextX = state.x + Math.sin(yaw) * speed * dt;
  let nextZ = state.z + Math.cos(yaw) * speed * dt;

  if (kind === 'speedboat') {
    // Water network navigation (from Karnaphuli Bridge & Launch Terminal, through south river, into Cox's ocean)
    nextX = Math.min(220.0, Math.max(-236.0, nextX));
    nextZ = Math.min(125.0, Math.max(16.0, nextZ));

    // Keep speedboat inside valid connected water bodies:
    if (nextX > -100 && nextX < 125) {
      // Grand River Parkway south of opposite buildings
      nextZ = Math.min(116.0, Math.max(90.0, nextZ));
    } else if (nextX <= -100 && nextX >= -202) {
      // In CTG city reach: south launch basin or north river basin
      if (nextZ > 44 && nextZ < 88) {
        nextZ = state.z >= 66 ? Math.max(89.0, nextZ) : Math.min(43.0, nextZ);
      }
    }
  } else {
    // Road vehicles: rickshaw, bike, car
    nextX = Math.min(WORLD_MAX_X - 2.0, Math.max(WORLD_MIN_X + 2.0, nextX));
    let minDrivingZ = FOOTPATH_NORTH_Z + 1.2;
    let maxDrivingZ = ROAD_SOUTH_Z - 0.8;
    if (nextX < -45) {
      if (nextX <= -202 && nextX >= -238) {
        // Bridge deck: keep vehicles on the road corridor across water
        minDrivingZ = 63.5;
        maxDrivingZ = 72.5;
      } else if (nextX < -238) {
        // Chittagong City Center & Zero Point Grand Roundabout
        minDrivingZ = 48.0;
        maxDrivingZ = 88.0;
      } else {
        // Western city road: block vehicles from entering the Launch Terminal / river (z > 74.8)
        maxDrivingZ = 74.8;
      }
    }
    nextZ = Math.min(maxDrivingZ, Math.max(minDrivingZ, nextZ));
  }

  // Synchronize third-person camera behind the vehicle so turning left/right smoothly turns screen too!
  // Camera look vector is (-sin(camYaw), -cos(camYaw)); matching vehicle forward (sin(yaw), cos(yaw)) => camYaw = yaw + PI
  const desiredCamYaw = normalizeAngle(yaw + Math.PI);
  const camDelta = shortestAngleDelta(state.camYaw, desiredCamYaw);
  const camYaw = normalizeAngle(state.camYaw + camDelta * (1 - Math.exp(-7.5 * dt)));

  return {
    x: nextX,
    z: nextZ,
    yaw,
    speed,
    camYaw,
    wheelSpinDelta: speed * dt * 2.2,
  };
}

/**
 * Projects a world (x, z) coordinate cleanly into 2D minimap SVG coordinates.
 */
export function projectWorldToMinimap(
  x: number,
  z: number,
  mapWidth: number,
  mapHeight: number
): { mx: number; my: number } {
  const minX = -820;
  const maxX = 225;
  const minZ = -30;
  const maxZ = 200;

  const nx = Math.min(1, Math.max(0, (x - minX) / (maxX - minX)));
  const ny = Math.min(1, Math.max(0, (z - minZ) / (maxZ - minZ)));

  return {
    mx: nx * mapWidth,
    my: ny * mapHeight,
  };
}
