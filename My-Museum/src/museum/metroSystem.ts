/**
 * Metro Rail System (চট্টগ্রাম <-> মিউজিয়াম গ্যালারি <-> কক্সবাজার)
 *
 * Provides a high-speed, elevated 2nd-floor double-track metro transit network
 * connecting Chittagong Zero Point & Grand Market to Museum Gallery and Cox's Bazar Sea Beach.
 *
 * Features:
 * - 3 Walkable 2-storey Metro Stations with ground-floor ticket counters and 2nd-floor platforms (y = 6.8m).
 * - Continuous viaduct spline and realistic train kinematic simulation.
 * - Interactive ticket purchasing (Single Journey / MRT Rapid Pass).
 * - Full boarding and disembarking at all 3 stations with in-train passenger information announcements.
 */

export interface MetroStation {
  id: 'station-ctg' | 'station-museum' | 'station-coxs';
  name: string;
  banglaName: string;
  x: number;
  z: number;
  platformY: number; // Elevated 2nd-floor platform height (6.8m)
  groundY: number;
  // Spatial bounds for 2nd floor platform
  platformBounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  // Spatial bounds for walkable stairs from ground (y=0) to platform (y=6.8)
  stairsBounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  ticketCounterPos: {
    x: number;
    y: number;
    z: number;
  };
}

export const METRO_STATIONS: ReadonlyArray<MetroStation> = [
  {
    id: 'station-ctg',
    name: 'Chittagong Hill View Grand Market & Zero Point Metro Station',
    banglaName: 'চট্টগ্রাম গ্র্যান্ড মার্কেট ও জিরো পয়েন্ট স্টেশন',
    x: -300.0,
    z: 61.5,
    platformY: 12.0,
    groundY: 0.05,
    platformBounds: {
      minX: -318.0,
      maxX: -282.0,
      minZ: 54.5,
      maxZ: 68.5,
    },
    stairsBounds: {
      minX: -307.0,
      maxX: -293.0,
      minZ: 63.5,
      maxZ: 71.5,
    },
    ticketCounterPos: {
      x: -300.0,
      y: 0.1,
      z: 76.5,
    },
  },
  {
    id: 'station-museum',
    name: 'Museum Gallery Central Metro Station',
    banglaName: 'মিউজিয়াম গ্যালারি সেন্ট্রাল স্টেশন',
    x: 0.0,
    z: 63.0,
    platformY: 12.0,
    groundY: 0.14,
    platformBounds: {
      minX: -18.0,
      maxX: 18.0,
      minZ: 56.0,
      maxZ: 70.0,
    },
    stairsBounds: {
      minX: -7.0,
      maxX: 7.0,
      minZ: 53.0,
      maxZ: 61.0,
    },
    ticketCounterPos: {
      x: 0.0,
      y: 0.14,
      z: 48.0,
    },
  },
  {
    id: 'station-coxs',
    name: 'Cox\'s Bazar Sea Beach Central Metro Station',
    banglaName: 'কক্সবাজার সী-বিচ সেন্ট্রাল স্টেশন',
    x: 172.0,
    z: 63.0,
    platformY: 12.0,
    groundY: 0.05,
    platformBounds: {
      minX: 154.0,
      maxX: 190.0,
      minZ: 56.0,
      maxZ: 70.0,
    },
    stairsBounds: {
      minX: 165.0,
      maxX: 179.0,
      minZ: 53.0,
      maxZ: 61.0,
    },
    ticketCounterPos: {
      x: 172.0,
      y: 0.05,
      z: 48.0,
    },
  },
];

export interface MetroWaypoint {
  x: number;
  y: number;
  z: number;
}

/**
 * Viaduct elevated track spline waypoints from West (near Chittagong Zero Point)
 * to East (Cox's Bazar Sea Beach terminal).
 * Runs at high elevated height y = 12.0m completely above trees, street lamps, highway vehicles, and roofs with zero overlap.
 */
export const METRO_TRACK_WAYPOINTS: ReadonlyArray<MetroWaypoint> = [
  // Western turnback & buffer zone near Zero Point (x = -365)
  { x: -365.0, y: 12.0, z: 61.5 },
  // Station 1: Chittagong Grand Market (x = -300, on the right flank of Grand Market towards Zero Point)
  { x: -300.0, y: 12.0, z: 61.5 },
  // East of Grand Market towards Karnaphuli river
  { x: -246.0, y: 12.0, z: 61.5 },
  // River crossing over Karnaphuli river (parallel to road truss bridge)
  { x: -210.0, y: 12.0, z: 61.5 },
  // CTG City Approach open transit corridor
  { x: -160.0, y: 12.0, z: 62.0 },
  { x: -110.0, y: 12.0, z: 62.5 },
  { x: -50.0, y: 12.0, z: 63.0 },
  // Station 2: Museum Gallery Central (x = 0, placed in building plot across road)
  { x: 0.0, y: 12.0, z: 63.0 },
  // East highway corridor towards Cox's Bazar
  { x: 60.0, y: 12.0, z: 63.0 },
  { x: 120.0, y: 12.0, z: 63.0 },
  // Station 3: Cox's Bazar Sea Beach (x = 172)
  { x: 172.0, y: 12.0, z: 63.0 },
  // Eastern turnback & buffer zone (x = 195)
  { x: 195.0, y: 12.0, z: 63.0 },
];

export interface MetroPose {
  x: number;
  y: number;
  z: number;
  fwdX: number;
  fwdY: number;
  fwdZ: number;
  yaw: number;
  pitch: number;
  speed: number;
}

export type MetroTrainPhase =
  | 'docked_doors_open'
  | 'doors_closing'
  | 'cruising'
  | 'approaching';

export interface MetroTrainState {
  progressT: number;        // Track parameter 0..1
  direction: 1 | -1;        // +1 = Eastbound (to Cox's), -1 = Westbound (to CTG)
  speed: number;            // Current speed in m/s
  phase: MetroTrainPhase;
  dwellTimerSeconds: number;// Countdown timer during station stop
  currentStationId: string | null;
  nextStationId: string;
  announcementLine: string;
}

export interface MetroTicket {
  id: string;
  ticketType: 'single' | 'pass';
  fromStationName: string;
  toStationName: string;
  priceBdt: number;
  purchaseTimestamp: number;
}

export function createInitialMetroTrainState(): MetroTrainState {
  return {
    progressT: 0.091, // Starts at Station 1: Chittagong Grand Market (Right Flank at x = -300)
    direction: 1,
    speed: 0,
    phase: 'docked_doors_open',
    dwellTimerSeconds: 8.0,
    currentStationId: 'station-ctg',
    nextStationId: 'station-museum',
    announcementLine: '🚉 চট্টগ্রাম হিল ভিউ গ্র্যান্ড মার্কেট ও জিরো পয়েন্ট স্টেশন! ট্রেন উপস্থিত, দরজা খোলা হয়েছে।',
  };
}

/**
 * Computes catmull-rom style pose along the metro viaduct track at normalized progress t (0..1).
 */
export function computeMetroPoseAtT(t: number, speed = 0): MetroPose {
  const pts = METRO_TRACK_WAYPOINTS;
  const n = pts.length;
  const clampedT = Math.max(0, Math.min(1, t));

  const rawIdx = clampedT * (n - 1);
  const i0 = Math.floor(rawIdx);
  const i1 = Math.min(n - 1, i0 + 1);
  const localT = rawIdx - i0;

  const p0 = pts[Math.max(0, i0 - 1)];
  const p1 = pts[i0];
  const p2 = pts[i1];
  const p3 = pts[Math.min(n - 1, i1 + 1)];

  // Catmull-Rom spline interpolation
  const t2 = localT * localT;
  const t3 = t2 * localT;

  const f0 = -0.5 * t3 + t2 - 0.5 * localT;
  const f1 = 1.5 * t3 - 2.5 * localT * localT + 1.0;
  const f2 = -1.5 * t3 + 2.0 * t2 + 0.5 * localT;
  const f3 = 0.5 * t3 - 0.5 * t2;

  const x = p0.x * f0 + p1.x * f1 + p2.x * f2 + p3.x * f3;
  const y = p0.y * f0 + p1.y * f1 + p2.y * f2 + p3.y * f3;
  const z = p0.z * f0 + p1.z * f1 + p2.z * f2 + p3.z * f3;

  // Tangent derivative
  const df0 = -1.5 * t2 + 2.0 * localT - 0.5;
  const df1 = 4.5 * t2 - 5.0 * localT;
  const df2 = -4.5 * t2 + 4.0 * localT + 0.5;
  const df3 = 1.5 * t2 - 1.0 * localT;

  let tx = p0.x * df0 + p1.x * df1 + p2.x * df2 + p3.x * df3;
  let ty = p0.y * df0 + p1.y * df1 + p2.y * df2 + p3.y * df3;
  let tz = p0.z * df0 + p1.z * df1 + p2.z * df2 + p3.z * df3;

  const len = Math.hypot(tx, ty, tz) || 1;
  tx /= len;
  ty /= len;
  tz /= len;

  // Standard yaw where 0 is -Z, Math.PI/2 is +X
  const yaw = Math.atan2(tx, tz);
  const pitch = Math.asin(Math.max(-1, Math.min(1, ty)));

  return {
    x,
    y,
    z,
    fwdX: tx,
    fwdY: ty,
    fwdZ: tz,
    yaw,
    pitch,
    speed,
  };
}

/**
 * Approximate track t parameters for the 3 stations.
 */
export const STATION_PROGRESS_T: Record<string, number> = {
  'station-ctg': 0.091,    // x = -300 (Right flank of Grand Market)
  'station-museum': 0.65,  // x = 0
  'station-coxs': 0.94,    // x = 172
};

const CRUISE_SPEED_MPS = 22.0; // Cruise speed ~ 79 km/h
const TRACK_LENGTH_METERS = 570.0;
const STATION_DWELL_SECONDS = 9.0;

/**
 * Advances metro train physical kinematics and station schedule by delta seconds.
 */
export function stepMetroSimulation(
  state: MetroTrainState,
  delta: number
): MetroTrainState {
  const dt = Math.max(0.001, Math.min(0.1, delta));
  let { progressT, direction, speed, phase, dwellTimerSeconds, currentStationId, nextStationId, announcementLine } = state;

  const stationEntries = Object.entries(STATION_PROGRESS_T);

  if (phase === 'docked_doors_open') {
    dwellTimerSeconds -= dt;
    speed = 0;
    if (dwellTimerSeconds <= 1.8) {
      phase = 'doors_closing';
      announcementLine = '⚠️ দরজা বন্ধ হচ্ছে, ট্রেন ছেড়ে যাচ্ছে! সাবধানে দাঁড়ান।';
    }
  } else if (phase === 'doors_closing') {
    dwellTimerSeconds -= dt;
    speed = 0;
    if (dwellTimerSeconds <= 0) {
      phase = 'cruising';
      currentStationId = null;
      // Determine next station
      if (direction === 1) {
        if (progressT < STATION_PROGRESS_T['station-museum'] - 0.05) {
          nextStationId = 'station-museum';
          announcementLine = '🚇 ট্রেন ছুটছে কক্সবাজারের অভিমুখে। পরবর্তী স্টেশন: মিউজিয়াম গ্যালারি।';
        } else {
          nextStationId = 'station-coxs';
          announcementLine = '🚇 ট্রেন ছুটছে সাগরপারের অভিমুখে। পরবর্তী স্টেশন: কক্সবাজার সী-বিচ সেন্ট্রাল।';
        }
      } else {
        if (progressT > STATION_PROGRESS_T['station-museum'] + 0.05) {
          nextStationId = 'station-museum';
          announcementLine = '🚇 ট্রেন ছুটছে চট্টগ্রামের অভিমুখে। পরবর্তী স্টেশন: মিউজিয়াম গ্যালারি।';
        } else {
          nextStationId = 'station-ctg';
          announcementLine = '🚇 ট্রেন ছুটছে পাহাড় ও নদীপারের অভিমুখে। পরবর্তী স্টেশন: চট্টগ্রাম গ্র্যান্ড মার্কেট।';
        }
      }
    }
  } else {
    // Check proximity to any station in current travel direction
    let targetStation: { id: string; t: number } | null = null;
    for (const [id, stT] of stationEntries) {
      const distT = (stT - progressT) * direction;
      if (distT > 0 && distT < 0.08) {
        targetStation = { id, t: stT };
        break;
      }
    }

    if (targetStation) {
      const distT = Math.abs(targetStation.t - progressT);
      if (distT < 0.006) {
        // Dock at station!
        phase = 'docked_doors_open';
        speed = 0;
        progressT = targetStation.t;
        dwellTimerSeconds = STATION_DWELL_SECONDS;
        currentStationId = targetStation.id;

        const stObj = METRO_STATIONS.find((s) => s.id === targetStation?.id);
        const stName = stObj ? stObj.banglaName : targetStation.id;
        announcementLine = `🚉 ${stName} এ ট্রেন পৌঁছেছে! দরজা খোলা হয়েছে, সাবধানে নামুন।`;

        // Reverse direction at terminal stations
        if (targetStation.id === 'station-coxs') {
          direction = -1;
          nextStationId = 'station-museum';
        } else if (targetStation.id === 'station-ctg') {
          direction = 1;
          nextStationId = 'station-museum';
        }
      } else {
        // Decelerating approach
        phase = 'approaching';
        const targetSpeed = Math.max(3.5, CRUISE_SPEED_MPS * (distT / 0.08));
        speed = Math.max(targetSpeed, speed - 12.0 * dt);
      }
    } else {
      // Normal cruising: smooth acceleration up to CRUISE_SPEED_MPS
      phase = 'cruising';
      speed = Math.min(CRUISE_SPEED_MPS, speed + 7.5 * dt);
    }

    // Advance progressT
    const deltaT = (speed * dt) / TRACK_LENGTH_METERS;
    progressT += deltaT * direction;

    // Boundary check at track endpoints
    if (progressT >= 0.98) {
      progressT = 0.98;
      direction = -1;
    } else if (progressT <= 0.02) {
      progressT = 0.02;
      direction = 1;
    }
  }

  return {
    progressT,
    direction,
    speed,
    phase,
    dwellTimerSeconds,
    currentStationId,
    nextStationId,
    announcementLine,
  };
}

/**
 * Calculates continuous walkable elevation for players climbing station stairs (0m -> 12.0m)
 * or walking on the elevated 2nd-floor station platform and waiting lounge (12.0m).
 */
export function computeMetroElevation(x: number, z: number, currentY = 0): number {
  for (const st of METRO_STATIONS) {
    const sb = st.stairsBounds;
    const pb = st.platformBounds;

    const inStairs = x >= sb.minX && x <= sb.maxX && z >= sb.minZ && z <= sb.maxZ;
    const inPlatform = x >= pb.minX && x <= pb.maxX && z >= pb.minZ && z <= pb.maxZ;

    // Inside station stairs zone (ground to 2nd floor 12.0m)
    if (inStairs) {
      const climbsTowardsMaxZ = st.ticketCounterPos.z < st.z;
      const stairT = climbsTowardsMaxZ
        ? (z - sb.minZ) / (sb.maxZ - sb.minZ)
        : (sb.maxZ - z) / (sb.maxZ - sb.minZ);
      const clampedT = Math.max(0, Math.min(1, stairT));
      const stairElev = st.groundY + clampedT * (st.platformY - st.groundY);

      // If player is at the top landing connecting into 2nd floor platform / waiting lounge
      if (inPlatform && currentY >= 8.5 && clampedT > 0.85) {
        return st.platformY;
      }
      return stairElev;
    }

    // Elevated 2nd floor platform & observation waiting lounge: player retains platform height (12.0m)
    if (inPlatform) {
      if (currentY >= 8.5 || Math.abs(currentY - st.platformY) < 3.2) {
        return st.platformY;
      }
    }
  }

  return 0;
}

/**
 * Finds if the player is currently inside any metro station platform.
 */
export function findCurrentMetroStation(px: number, pz: number): MetroStation | null {
  for (const st of METRO_STATIONS) {
    const pb = st.platformBounds;
    if (px >= pb.minX && px <= pb.maxX && pz >= pb.minZ && pz <= pb.maxZ) {
      return st;
    }
  }
  return null;
}

/**
 * Finds the nearest metro station within proximity of player (e.g. for ticketing or boarding).
 */
export function findNearestMetroStation(px: number, pz: number, maxDist = 32.0): MetroStation | null {
  let best: MetroStation | null = null;
  let bestDist = maxDist;

  for (const st of METRO_STATIONS) {
    const dist = Math.hypot(st.x - px, st.z - pz);
    if (dist <= bestDist) {
      bestDist = dist;
      best = st;
    }
  }

  return best;
}

/**
 * Checks if player is within boarding range of the docked metro train.
 */
export function isNearMetroTrain(
  px: number,
  py: number,
  pz: number,
  trainPose: MetroPose,
  maxDist = 9.5
): boolean {
  // Elevated height check (player should be on the 2nd-floor platform or close)
  if (Math.abs(py - trainPose.y) > 3.5) return false;
  return Math.hypot(px - trainPose.x, pz - trainPose.z) <= maxDist;
}

/**
 * Purchases a Metro ticket / MRT Pass and updates wallet.
 */
export function buyMetroTicket(
  ticketType: 'single' | 'pass',
  fromStation: MetroStation,
  toStation: MetroStation,
  walletBdt: number
): { ok: boolean; nextWallet: number; ticket: MetroTicket | null; message: string } {
  const price = ticketType === 'pass' ? 100 : 35;

  if (walletBdt < price) {
    return {
      ok: false,
      nextWallet: walletBdt,
      ticket: null,
      message: `টাকা কম আছে! টিকিটের মূল্য ৳${price}, আপনার ওয়ালেটে আছে ৳${walletBdt}।`,
    };
  }

  const ticket: MetroTicket = {
    id: `ticket-${Date.now()}`,
    ticketType,
    fromStationName: fromStation.banglaName,
    toStationName: toStation.banglaName,
    priceBdt: price,
    purchaseTimestamp: Date.now(),
  };

  return {
    ok: true,
    nextWallet: walletBdt - price,
    ticket,
    message: ticketType === 'pass'
      ? `অভিনন্দন! ৳১০০ দিয়ে মেট্রোরেল র‍্যাপিড স্মার্ট পাস (MRT Pass) কিনেছেন! আনলিমিটেড ভ্রমণ করতে পারবেন।`
      : `সফলভাবে ৳৩৫ দিয়ে ${fromStation.banglaName} থেকে ${toStation.banglaName} এর টিকিট কাটা হয়েছে! ট্রেনে উঠুন।`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Train Interior: Walk-in Cabin, Central Aisle & Passenger Window Seats
// ─────────────────────────────────────────────────────────────────────────────

export interface MetroSeat {
  id: string;
  coachIndex: -1 | 0 | 1;
  side: 'left' | 'right';
  localX: number;
  localZ: number;
  label: string;
}

export const METRO_SEATS: MetroSeat[] = [
  // ─── Lead Coach (Coach +1: z = 8.5 to 24.5) ───
  { id: 'seat-lead-l1', coachIndex: 1, side: 'left', localX: -1.2, localZ: 12.0, label: 'সিট ১-A (বাম জানালা)' },
  { id: 'seat-lead-r1', coachIndex: 1, side: 'right', localX: 1.2, localZ: 12.0, label: 'সিট ১-B (ডান জানালা)' },
  { id: 'seat-lead-l2', coachIndex: 1, side: 'left', localX: -1.2, localZ: 15.5, label: 'সিট ২-A (বাম জানালা)' },
  { id: 'seat-lead-r2', coachIndex: 1, side: 'right', localX: 1.2, localZ: 15.5, label: 'সিট ২-B (ডান জানালা)' },
  { id: 'seat-lead-l3', coachIndex: 1, side: 'left', localX: -1.2, localZ: 19.0, label: 'সিট ৩-A (ফ্রন্ট ভিউ)' },
  { id: 'seat-lead-r3', coachIndex: 1, side: 'right', localX: 1.2, localZ: 19.0, label: 'সিট ৩-B (ফ্রন্ট ভিউ)' },

  // ─── Middle Coach (Coach 0: z = -7.5 to 8.5) ───
  { id: 'seat-mid-l1', coachIndex: 0, side: 'left', localX: -1.2, localZ: -4.5, label: 'সিট ৪-A (প্যানোরামিক ভিউ)' },
  { id: 'seat-mid-r1', coachIndex: 0, side: 'right', localX: 1.2, localZ: -4.5, label: 'সিট ৪-B (প্যানোরামিক ভিউ)' },
  { id: 'seat-mid-l2', coachIndex: 0, side: 'left', localX: -1.2, localZ: 0.0, label: 'সিট ৫-A (সেন্ট্রাল কোচ)' },
  { id: 'seat-mid-r2', coachIndex: 0, side: 'right', localX: 1.2, localZ: 0.0, label: 'সিট ৫-B (সেন্ট্রাল কোচ)' },
  { id: 'seat-mid-l3', coachIndex: 0, side: 'left', localX: -1.2, localZ: 4.5, label: 'সিট ৬-A (প্যানোরামিক ভিউ)' },
  { id: 'seat-mid-r3', coachIndex: 0, side: 'right', localX: 1.2, localZ: 4.5, label: 'সিট ৬-B (প্যানোরামিক ভিউ)' },

  // ─── Trailing Coach (Coach -1: z = -24.5 to -8.5) ───
  { id: 'seat-trail-l1', coachIndex: -1, side: 'left', localX: -1.2, localZ: -12.0, label: 'সিট ৭-A (বাম জানালা)' },
  { id: 'seat-trail-r1', coachIndex: -1, side: 'right', localX: 1.2, localZ: -12.0, label: 'সিট ৭-B (ডান জানালা)' },
  { id: 'seat-trail-l2', coachIndex: -1, side: 'left', localX: -1.2, localZ: -15.5, label: 'সিট ৮-A (বাম জানালা)' },
  { id: 'seat-trail-r2', coachIndex: -1, side: 'right', localX: 1.2, localZ: -15.5, label: 'সিট ৮-B (ডান জানালা)' },
  { id: 'seat-trail-l3', coachIndex: -1, side: 'left', localX: -1.2, localZ: -19.0, label: 'সিট ৯-A (ব্যাক ভিউ)' },
  { id: 'seat-trail-r3', coachIndex: -1, side: 'right', localX: 1.2, localZ: -19.0, label: 'সিট ৯-B (ব্যাক ভিউ)' },
];

/**
 * Transforms a local train cabin coordinate (localX across aisle, localZ along coaches, localY floor)
 * into world coordinates based on the train's global pose and heading.
 */
export function convertTrainLocalToWorld(
  pose: MetroPose,
  localX: number,
  localZ: number,
  localY = 0.55
): { x: number; y: number; z: number } {
  const cosY = Math.cos(pose.yaw);
  const sinY = Math.sin(pose.yaw);

  const wx = pose.x + cosY * localX + sinY * localZ;
  const wz = pose.z - sinY * localX + cosY * localZ;
  const wy = pose.y + localY;

  return { x: wx, y: wy, z: wz };
}

/**
 * Transforms world coordinates into local train coordinates relative to the train's pose.
 */
export function convertWorldToTrainLocal(
  pose: MetroPose,
  worldX: number,
  worldZ: number
): { localX: number; localZ: number } {
  const dx = worldX - pose.x;
  const dz = worldZ - pose.z;
  const cosY = Math.cos(pose.yaw);
  const sinY = Math.sin(pose.yaw);

  // Inverse rotation of [ cosY  sinY ]
  //                     [ -sinY cosY ]
  // Inverse transpose:  [ cosY -sinY ]
  //                     [ sinY  cosY ]
  const localX = cosY * dx - sinY * dz;
  const localZ = sinY * dx + cosY * dz;

  return { localX, localZ };
}

/**
 * Clamps local player position inside the continuous walk-through aisle of the train.
 */
export function clampTrainLocalAisle(
  localX: number,
  localZ: number
): { localX: number; localZ: number } {
  return {
    localX: Math.max(-1.15, Math.min(1.15, localX)),
    localZ: Math.max(-23.0, Math.min(23.0, localZ)),
  };
}

/**
 * Finds the nearest passenger seat inside the train within interaction range.
 */
export function findNearestMetroSeat(
  localX: number,
  localZ: number,
  maxDist = 1.7
): MetroSeat | null {
  let closest: MetroSeat | null = null;
  let closestDist = maxDist;

  for (const s of METRO_SEATS) {
    const dist = Math.hypot(s.localX - localX, s.localZ - localZ);
    if (dist <= closestDist) {
      closestDist = dist;
      closest = s;
    }
  }

  return closest;
}

