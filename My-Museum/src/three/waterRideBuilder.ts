import * as THREE from 'three';
import {
  computeWaterSlidePoseAtT,
  sampleWaterSlideSpline,
  WATER_SLIDE_WAYPOINTS,
  SWIMMING_POOL_BOUNDS,
  WATER_TOWER_COORDS,
  POOL_SWIMMERS,
  type WaterSlidePose,
  type WaterSlideState,
} from '../museum/waterRide';

export interface BuiltWaterRide {
  group: THREE.Group;
  interactables: THREE.Object3D[];
  inflatableTube: THREE.Group;
  update: (
    delta: number,
    elapsed: number,
    state: WaterSlideState
  ) => {
    sliderPose: WaterSlidePose;
  };
  dispose: () => void;
}

interface PoolSwimmerRig {
  root: THREE.Group;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  swimStyle: 'freestyle' | 'ring_float' | 'tread';
  phase: number;
  baseX: number;
  baseZ: number;
}

interface BalloonKidRig {
  root: THREE.Group;
  balloon: THREE.Mesh;
  string: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  x: number;
  z: number;
  dirX: number;
  dirZ: number;
  speed: number;
  phase: number;
}

export function buildWaterRide(maxAnisotropy: number): BuiltWaterRide {
  const group = new THREE.Group();
  const interactables: THREE.Object3D[] = [];
  const disposables: { dispose: () => void }[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.push(m);
    return m;
  };
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    disposables.push(t);
    return t;
  };

  // Materials
  const waterCyanMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x06b6d4, // Vivid Cyan Fiberglass
      roughness: 0.18,
      metalness: 0.15,
      side: THREE.DoubleSide,
    })
  );
  const waterFlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.1,
      metalness: 0.2,
      transparent: true,
      opacity: 0.88,
    })
  );
  const poolWaterMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Sparkling Blue Pool Water
      roughness: 0.08,
      metalness: 0.25,
      transparent: true,
      opacity: 0.82,
    })
  );
  const poolTileMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe0f2fe, // Light Sky Pool Tile
      roughness: 0.32,
      metalness: 0.1,
    })
  );
  const poolRimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf8fafc, // White Coping Stone Edge
      roughness: 0.42,
    })
  );
  const timberMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x92400e, // Rich Teak Timber
      roughness: 0.72,
    })
  );
  const whiteSteelMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.35,
      metalness: 0.45,
    })
  );
  const chromeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.15,
      metalness: 0.9,
    })
  );
  const yellowTubeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfacc15, // Bright Sunshine Yellow
      roughness: 0.28,
      metalness: 0.12,
    })
  );
  const coralTubeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf43f5e, // Bright Coral Magenta
      roughness: 0.28,
      metalness: 0.12,
    })
  );

  // =========================================================================
  // 1. GRAND RESORT SWIMMING POOL (x: -68.0 to -54.0, z: 11.5 to 20.5, depth 1.45m)
  // Situated on the spacious outer west park zone with 100% dry separation from the staircase!
  // =========================================================================
  const poolCenter = {
    x: (SWIMMING_POOL_BOUNDS.minX + SWIMMING_POOL_BOUNDS.maxX) / 2, // -61.0
    z: (SWIMMING_POOL_BOUNDS.minZ + SWIMMING_POOL_BOUNDS.maxZ) / 2, // 16.0
  };
  const poolW = SWIMMING_POOL_BOUNDS.maxX - SWIMMING_POOL_BOUNDS.minX; // 14.0m
  const poolL = SWIMMING_POOL_BOUNDS.maxZ - SWIMMING_POOL_BOUNDS.minZ; // 9.0m

  // Pool Floor (Deep Blue Mosaic Tile, solid impermeable block from y = -0.95 to y = 0.04)
  // Completely conceals ground meadow (y = -0.05) underneath with crystal-clear pool water!
  const poolFloor = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(poolW - 0.1, 0.98, poolL - 0.1)),
    poolTileMat
  );
  poolFloor.position.set(poolCenter.x, 0.04 - 0.98 / 2, poolCenter.z);
  poolFloor.receiveShadow = true;
  group.add(poolFloor);

  // Swimming Lane Divider Strips on Pool Floor
  const laneMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0369a1, // Deep Ocean Blue Lane Stripe
      roughness: 0.4,
    })
  );
  for (const lx of [-4.2, -1.4, 1.4, 4.2]) {
    const laneStrip = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.24, 0.015, poolL - 0.8)),
      laneMat
    );
    laneStrip.position.set(poolCenter.x + lx, 0.048, poolCenter.z);
    group.add(laneStrip);
  }

  // Sparkling Blue Water Surface
  const waterPlane = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(poolW - 0.12, poolL - 0.12)),
    poolWaterMat
  );
  waterPlane.rotation.x = -Math.PI / 2;
  waterPlane.position.set(poolCenter.x, SWIMMING_POOL_BOUNDS.waterY, poolCenter.z);
  waterPlane.userData.rideId = 'ride-west-waterslide';
  interactables.push(waterPlane);
  group.add(waterPlane);

  // Pool Walls
  for (const sx of [-poolW / 2, poolW / 2]) {
    const wall = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.35, 1.35, poolL + 0.35)),
      poolTileMat
    );
    wall.position.set(poolCenter.x + sx, -0.05, poolCenter.z);
    group.add(wall);
  }
  for (const sz of [-poolL / 2, poolL / 2]) {
    const wall = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(poolW + 0.35, 1.35, 0.35)),
      poolTileMat
    );
    wall.position.set(poolCenter.x, -0.05, poolCenter.z + sz);
    group.add(wall);
  }

  // Raised Coping Stone Edge Around Pool Perimeter
  const rimThick = 0.65;
  for (const sx of [-poolW / 2 - rimThick / 2, poolW / 2 + rimThick / 2]) {
    const rim = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(rimThick, 0.28, poolL + rimThick * 2)),
      poolRimMat
    );
    rim.position.set(poolCenter.x + sx, 0.48, poolCenter.z);
    group.add(rim);
  }
  for (const sz of [-poolL / 2 - rimThick / 2, poolL / 2 + rimThick / 2]) {
    const rim = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(poolW + rimThick * 2, 0.28, rimThick)),
      poolRimMat
    );
    rim.position.set(poolCenter.x, 0.48, poolCenter.z + sz);
    group.add(rim);
  }

  // 4 Chrome Entry Ladders with grab rails around the pool
  const ladderPositions: Array<[number, number]> = [
    [poolCenter.x - 4.5, poolCenter.z + poolL / 2 + 0.05],
    [poolCenter.x + 4.5, poolCenter.z + poolL / 2 + 0.05],
    [poolCenter.x - 4.5, poolCenter.z - poolL / 2 - 0.05],
    [poolCenter.x + 4.5, poolCenter.z - poolL / 2 - 0.05],
  ];
  for (const [lx, lz] of ladderPositions) {
    const ladderGrp = new THREE.Group();
    ladderGrp.position.set(lx, 0, lz);
    for (const rx of [-0.28, 0.28]) {
      const rail = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.024, 0.024, 1.45, 8)), chromeMat);
      rail.position.set(rx, 0.62, 0);
      ladderGrp.add(rail);
    }
    for (let r = 0; r < 3; r++) {
      const rung = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.018, 0.018, 0.56, 8)), chromeMat);
      rung.rotation.z = Math.PI / 2;
      rung.position.set(0, 0.15 + r * 0.26, 0);
      ladderGrp.add(rung);
    }
    group.add(ladderGrp);
  }

  // Poolside Diving Board on East Wall
  const divingBoard = new THREE.Group();
  divingBoard.position.set(poolCenter.x + poolW / 2 + 0.4, 0, poolCenter.z);
  for (const dz of [-0.35, 0.35]) {
    const stand = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.04, 0.04, 0.95, 8)), chromeMat);
    stand.position.set(0, 0.48, dz);
    divingBoard.add(stand);
  }
  const plank = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.4, 0.08, 0.7)), poolRimMat);
  plank.position.set(-0.85, 0.95, 0);
  divingBoard.add(plank);
  group.add(divingBoard);

  // Poolside Sun Loungers with Beach Umbrellas along the dry promenade between pool and stairs
  const umbrellaColors = [0x0284c7, 0xfacc15, 0xf43f5e, 0x10b981];
  for (let u = 0; u < 3; u++) {
    const loungerZ = poolCenter.z - 3.0 + u * 3.0;
    const lounger = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.6, 0.25, 0.75)), timberMat);
    lounger.position.set(-71.2, 0.15, loungerZ);
    group.add(lounger);

    // Umbrella pole & canopy
    const uMat = trackMat(new THREE.MeshStandardMaterial({ color: umbrellaColors[u % umbrellaColors.length], roughness: 0.45 }));
    const uPole = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 8)), whiteSteelMat);
    uPole.position.set(-71.2, 1.2, loungerZ + 0.75);
    group.add(uPole);
    const uCanopy = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(1.2, 0.55, 12)), uMat);
    uCanopy.position.set(-71.2, 2.35, loungerZ + 0.75);
    group.add(uCanopy);
  }

  // =========================================================================
  // 2. AQUA LAUNCH TOWER & FULLY WALKABLE STAIRCASE (0 -> 10.5m)
  // 100% on dry ground outside the pool (x: -75.0, z: 3.8 to 18.0)
  // =========================================================================
  const towerRoot = new THREE.Group();
  towerRoot.position.set(0, 0, 0); // Position directly in world coords for exact walkability

  // Top Observation & Slide Launch Deck (Centered at x: -75.0, y: 10.5, z: 5.5)
  const deckX = -75.0;
  const deckZ = 5.5;
  const deckW = 4.6;
  const deckL = 3.2;
  const topDeck = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(deckW, 0.35, deckL)), timberMat);
  topDeck.position.set(deckX, WATER_TOWER_COORDS.platformY, deckZ);
  topDeck.userData.rideId = 'ride-west-waterslide';
  interactables.push(topDeck);
  towerRoot.add(topDeck);

  // 4 Tower Corner Steel Columns from Ground (y = 0) to 10.5m
  const colOffsets: Array<[number, number]> = [
    [-1.9, -1.3],
    [1.9, -1.3],
    [-1.9, 1.3],
    [1.9, 1.3],
  ];
  for (const [cx, cz] of colOffsets) {
    const col = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.2, 0.28, WATER_TOWER_COORDS.platformY, 8)),
      whiteSteelMat
    );
    col.position.set(deckX + cx, WATER_TOWER_COORDS.platformY / 2, deckZ + cz);
    towerRoot.add(col);
  }

  // Top Deck Chrome Safety Railings
  // North railing
  const nRail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(deckW, 0.08, 0.08)), chromeMat);
  nRail.position.set(deckX, 11.45, deckZ - deckL / 2);
  towerRoot.add(nRail);
  // West railing
  const wRail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.08, 0.08, deckL)), chromeMat);
  wRail.position.set(deckX - deckW / 2, 11.45, deckZ);
  towerRoot.add(wRail);
  // East railing (towards Chorki promenade)
  const eRail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.08, 0.08, deckL)), chromeMat);
  eRail.position.set(deckX + deckW / 2, 11.45, deckZ);
  towerRoot.add(eRail);

  // Weather Canopy Overhead at 13.5m with fluttering park pennants
  const canopyMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 }));
  const canopy = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(deckW + 0.6, 0.15, deckL + 0.6)), canopyMat);
  canopy.position.set(deckX, 13.5, deckZ);
  towerRoot.add(canopy);
  for (const [cx, cz] of colOffsets) {
    const post = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.06, 0.06, 3.0, 6)), timberMat);
    post.position.set(deckX + cx, 12.0, deckZ + cz);
    towerRoot.add(post);
  }
  // Pennant flags atop canopy
  const flagMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 }));
  for (const fx of [-1.5, 0, 1.5]) {
    const flag = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.25, 0.75, 4)), flagMat);
    flag.position.set(deckX + fx, 13.9, deckZ);
    towerRoot.add(flag);
  }

  // Aqua Slide Wooden Launch Basin on the top deck
  const launchTub = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.6, 0.5, 1.8)), waterCyanMat);
  launchTub.position.set(-74.5, 10.65, 6.0);
  launchTub.userData.rideId = 'ride-west-waterslide';
  interactables.push(launchTub);
  towerRoot.add(launchTub);

  // Flowing launch water effect
  const tubWater = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(1.3, 1.5)), waterFlowMat);
  tubWater.rotation.x = -Math.PI / 2;
  tubWater.position.set(-74.5, 10.85, 6.0);
  towerRoot.add(tubWater);

  // -------------------------------------------------------------------------
  // FULLY WALKABLE STAIRCASE: LOWER FLIGHT (0 -> 5.25m, z: 18.0 -> 13.0)
  // Situated 100% on dry ground outside the swimming pool!
  // -------------------------------------------------------------------------
  const lowerStepCount = 16;
  const stairW = 2.4;
  for (let i = 0; i < lowerStepCount; i++) {
    const frac = (i + 0.5) / lowerStepCount;
    const stepZ = 18.0 - frac * (18.0 - 13.0);
    const stepY = frac * 5.25;
    const step = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(stairW, 0.16, 0.32)), timberMat);
    step.position.set(deckX, stepY, stepZ);
    step.userData.rideId = 'ride-west-waterslide';
    interactables.push(step);
    towerRoot.add(step);
  }

  // Lower Flight Left & Right Handrails & Stringers
  for (const side of [-1, 1]) {
    const hx = deckX + (side * stairW) / 2;
    const railLen = Math.hypot(18.0 - 13.0, 5.25);
    const railAngle = -Math.atan2(5.25, 18.0 - 13.0);
    const handrail = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.04, 0.04, railLen, 8)), chromeMat);
    handrail.position.set(hx, 5.25 / 2 + 0.9, (18.0 + 13.0) / 2);
    handrail.rotation.x = railAngle;
    towerRoot.add(handrail);

    // Balusters
    for (let b = 0; b <= 5; b++) {
      const bFrac = b / 5;
      const bZ = 18.0 - bFrac * (18.0 - 13.0);
      const bY = bFrac * 5.25;
      const baluster = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6)), whiteSteelMat);
      baluster.position.set(hx, bY + 0.45, bZ);
      towerRoot.add(baluster);
    }
  }

  // -------------------------------------------------------------------------
  // MID-FLIGHT REST LANDING (y = 5.25m, z: 11.8 -> 13.0)
  // -------------------------------------------------------------------------
  const midLanding = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(stairW + 0.4, 0.24, 1.4)), timberMat);
  midLanding.position.set(deckX, 5.25, 12.4);
  midLanding.userData.rideId = 'ride-west-waterslide';
  interactables.push(midLanding);
  towerRoot.add(midLanding);

  // Mid landing safety rails on side
  for (const side of [-1, 1]) {
    const lx = deckX + (side * (stairW + 0.4)) / 2;
    const lRail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.06, 0.06, 1.4)), chromeMat);
    lRail.position.set(lx, 6.15, 12.4);
    towerRoot.add(lRail);
  }

  // -------------------------------------------------------------------------
  // UPPER FLIGHT (5.25m -> 10.5m, z: 11.8 -> 7.1)
  // -------------------------------------------------------------------------
  const upperStepCount = 14;
  for (let i = 0; i < upperStepCount; i++) {
    const frac = (i + 0.5) / upperStepCount;
    const stepZ = 11.8 - frac * (11.8 - 7.1);
    const stepY = 5.25 + frac * (10.5 - 5.25);
    const step = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(stairW, 0.16, 0.32)), timberMat);
    step.position.set(deckX, stepY, stepZ);
    step.userData.rideId = 'ride-west-waterslide';
    interactables.push(step);
    towerRoot.add(step);
  }

  // Upper Flight Handrails & Stringers
  for (const side of [-1, 1]) {
    const hx = deckX + (side * stairW) / 2;
    const railLen = Math.hypot(11.8 - 7.1, 5.25);
    const railAngle = -Math.atan2(5.25, 11.8 - 7.1);
    const handrail = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.04, 0.04, railLen, 8)), chromeMat);
    handrail.position.set(hx, 5.25 + 5.25 / 2 + 0.9, (11.8 + 7.1) / 2);
    handrail.rotation.x = railAngle;
    towerRoot.add(handrail);

    // Balusters
    for (let b = 0; b <= 4; b++) {
      const bFrac = b / 4;
      const bZ = 11.8 - bFrac * (11.8 - 7.1);
      const bY = 5.25 + bFrac * 5.25;
      const baluster = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6)), whiteSteelMat);
      baluster.position.set(hx, bY + 0.45, bZ);
      towerRoot.add(baluster);
    }
  }

  // -------------------------------------------------------------------------
  // GROUND ENTRANCE SIGNBOARD (at dry ground level z = 18.5)
  // -------------------------------------------------------------------------
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 1024;
  signCanvas.height = 256;
  const sCtx = signCanvas.getContext('2d')!;
  sCtx.fillStyle = '#0284C7';
  sCtx.fillRect(0, 0, 1024, 256);
  sCtx.strokeStyle = '#FDE047';
  sCtx.lineWidth = 14;
  sCtx.strokeRect(12, 12, 1000, 232);
  sCtx.textAlign = 'center';
  sCtx.fillStyle = '#FFFFFF';
  sCtx.font = '800 54px "Plus Jakarta Sans", sans-serif';
  sCtx.fillText('TSUNAMI WATER SLIDE', 512, 100);
  sCtx.fillStyle = '#FDE047';
  sCtx.font = '700 28px "JetBrains Mono", monospace';
  sCtx.fillText('WALK UP STAIRS TO 10.5M LAUNCH TOWER · [E]', 512, 180);

  const signTex = trackTex(new THREE.CanvasTexture(signCanvas));
  signTex.colorSpace = THREE.SRGBColorSpace;
  signTex.anisotropy = maxAnisotropy;

  const signArch = new THREE.Group();
  signArch.position.set(deckX, 0, 18.5);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.08, 0.08, 3.4, 8)), timberMat);
    post.position.set((side * (stairW + 0.6)) / 2, 1.7, 0);
    signArch.add(post);
  }
  const signBoard = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(3.6, 0.9)),
    trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: signTex,
        roughness: 0.35,
      })
    )
  );
  signBoard.position.set(0, 2.75, 0);
  signBoard.userData.rideId = 'ride-west-waterslide';
  interactables.push(signBoard);
  signArch.add(signBoard);
  towerRoot.add(signArch);

  group.add(towerRoot);

  // =========================================================================
  // 3. CURVED WATER SLIDE FLUME CHUTE (Spline Tube)
  // =========================================================================
  const sampleCount = 220;
  const flumePts: THREE.Vector3[] = [];
  const flumePillars: Array<[number, number, number]> = [];

  for (let i = 0; i <= sampleCount; i++) {
    const t = i / sampleCount;
    const s = sampleWaterSlideSpline(t, WATER_SLIDE_WAYPOINTS);
    flumePts.push(new THREE.Vector3(s.x, s.y, s.z));
    // Support columns: place only on dry land, NEVER inside the pool basin!
    if (i > 4 && i < sampleCount - 12 && i % 10 === 0) {
      const insidePool =
        s.x >= SWIMMING_POOL_BOUNDS.minX - 0.2 &&
        s.x <= SWIMMING_POOL_BOUNDS.maxX + 0.2 &&
        s.z >= SWIMMING_POOL_BOUNDS.minZ - 0.2 &&
        s.z <= SWIMMING_POOL_BOUNDS.maxZ + 0.2;
      if (!insidePool && s.y > 1.2) {
        flumePillars.push([s.x, s.y, s.z]);
      }
    }
  }

  const flumeCurve = new THREE.CatmullRomCurve3(flumePts, false);
  // Outer Cyan Chute Tube (high-resolution 260 segments)
  const flumeMesh = new THREE.Mesh(
    trackGeo(new THREE.TubeGeometry(flumeCurve, 260, 0.72, 12, false)),
    waterCyanMat
  );
  flumeMesh.userData.rideId = 'ride-west-waterslide';
  interactables.push(flumeMesh);
  group.add(flumeMesh);

  // Inner Flowing Water Ribbon
  const waterRibbonMesh = new THREE.Mesh(
    trackGeo(new THREE.TubeGeometry(flumeCurve, 260, 0.65, 10, false)),
    waterFlowMat
  );
  group.add(waterRibbonMesh);

  // Support Trestles down to ground
  for (const [px, py, pz] of flumePillars) {
    const col = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.12, 0.16, py, 8)),
      whiteSteelMat
    );
    col.position.set(px, py / 2, pz);
    group.add(col);
  }

  // =========================================================================
  // 4. INFLATABLE TANDEM DUAL-RIDER ADVENTURE TUBE (Player & Companion Ride Together!)
  // =========================================================================
  const inflatableTube = new THREE.Group();

  // Front Ring (Host Player Cockpit)
  const frontRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.55, 0.22, 10, 24)), yellowTubeMat);
  frontRing.rotation.x = Math.PI / 2;
  frontRing.position.z = 0;
  inflatableTube.add(frontRing);

  // Rear Ring (Companion / Co-visitor Cockpit)
  const rearRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.52, 0.21, 10, 24)), coralTubeMat);
  rearRing.rotation.x = Math.PI / 2;
  rearRing.position.z = -0.75;
  inflatableTube.add(rearRing);

  // Inflatable Coupling Bridge between front & rear cockpits
  const bridge = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.36, 0.20, 0.45)), yellowTubeMat);
  bridge.position.set(0, 0, -0.38);
  inflatableTube.add(bridge);

  // Inflatable Grip Handles for both front and rear seats
  for (const zOff of [0, -0.75]) {
    for (const sx of [-0.55, 0.55]) {
      const handle = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.022, 0.022, 0.32, 6)), timberMat);
      handle.position.set(sx, 0.14, zOff);
      inflatableTube.add(handle);
    }
  }
  inflatableTube.userData.rideId = 'ride-west-waterslide';
  interactables.push(inflatableTube);
  group.add(inflatableTube);

  // Splash Particle System (for dramatic water spray in pool!)
  const splashCount = 36;
  const splashGeo = trackGeo(new THREE.SphereGeometry(0.08, 6, 6));
  const splashMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      roughness: 0.1,
      transparent: true,
      opacity: 0.85,
    })
  );
  const splashGroup = new THREE.Group();
  const splashVelocities: THREE.Vector3[] = [];
  for (let i = 0; i < splashCount; i++) {
    const sp = new THREE.Mesh(splashGeo, splashMat);
    splashGroup.add(sp);
    splashVelocities.push(
      new THREE.Vector3(
        (Math.random() - 0.5) * 4.2,
        2.5 + Math.random() * 3.8,
        (Math.random() - 0.5) * 4.2
      )
    );
  }
  splashGroup.visible = false;
  group.add(splashGroup);

  // =========================================================================
  // 5. ANIMATED SWIMMERS IN THE POOL
  // =========================================================================
  const swimmerRigs: PoolSwimmerRig[] = [];
  const skinMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xd4a07a, roughness: 0.6 }));
  const hairMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.8 }));

  for (const sc of POOL_SWIMMERS) {
    const sGrp = new THREE.Group();
    sGrp.position.set(sc.x, 0.38, sc.z);

    const head = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.13, 8, 8)), skinMat);
    head.position.y = 0.22;
    sGrp.add(head);

    const hair = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.135, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.5)),
      hairMat
    );
    hair.position.set(0, 0.23, -0.02);
    sGrp.add(hair);

    const armGeo = trackGeo(new THREE.CylinderGeometry(0.035, 0.035, 0.36, 6));
    const leftArm = new THREE.Mesh(armGeo, skinMat);
    leftArm.position.set(-0.22, 0.12, 0.1);
    sGrp.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, skinMat);
    rightArm.position.set(0.22, 0.12, 0.1);
    sGrp.add(rightArm);

    const legGeo = trackGeo(new THREE.CylinderGeometry(0.04, 0.035, 0.42, 6));
    const leftLeg = new THREE.Mesh(legGeo, skinMat);
    leftLeg.position.set(-0.1, -0.15, -0.22);
    sGrp.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, skinMat);
    rightLeg.position.set(0.1, -0.15, -0.22);
    sGrp.add(rightLeg);

    if (sc.swimStyle === 'ring_float') {
      const ringMat = trackMat(new THREE.MeshStandardMaterial({ color: sc.color, roughness: 0.3 }));
      const ring = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.38, 0.14, 8, 16)), ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.05;
      sGrp.add(ring);
    }

    group.add(sGrp);
    swimmerRigs.push({
      root: sGrp,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      swimStyle: sc.swimStyle,
      phase: sc.swimPhase,
      baseX: sc.x,
      baseZ: sc.z,
    });
  }

  // =========================================================================
  // 6. KIDS RUNNING & PLAYING WITH BALLOONS / BEACH BALLS
  // =========================================================================
  const balloonKids: BalloonKidRig[] = [];
  const balloonColors = [0xf43f5e, 0x3b82f6, 0x10b981, 0xf59e0b];
  const kidBounds = { minX: -76.0, maxX: -56.0, minZ: 13.0, maxZ: 21.5 };

  for (let k = 0; k < 4; k++) {
    const kGrp = new THREE.Group();
    const bColor = balloonColors[k % balloonColors.length];
    const bMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: bColor,
        roughness: 0.22,
        metalness: 0.15,
      })
    );
    const shirtMat = trackMat(new THREE.MeshStandardMaterial({ color: bColor, roughness: 0.65 }));
    const pantsMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.7 }));

    // Child Torso
    const torso = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.3, 0.38, 0.18)), shirtMat);
    torso.position.y = 0.45;
    kGrp.add(torso);

    // Child Head
    const head = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.12, 8, 8)), skinMat);
    head.position.y = 0.75;
    kGrp.add(head);

    // Legs
    const lGeo = trackGeo(new THREE.CylinderGeometry(0.045, 0.04, 0.38, 6));
    const leftLeg = new THREE.Mesh(lGeo, pantsMat);
    leftLeg.position.set(-0.09, 0.19, 0);
    kGrp.add(leftLeg);

    const rightLeg = new THREE.Mesh(lGeo, pantsMat);
    rightLeg.position.set(0.09, 0.19, 0);
    kGrp.add(rightLeg);

    // Arms
    const aGeo = trackGeo(new THREE.CylinderGeometry(0.032, 0.03, 0.34, 6));
    const leftArm = new THREE.Mesh(aGeo, shirtMat);
    leftArm.position.set(-0.2, 0.48, 0);
    kGrp.add(leftArm);

    const rightArm = new THREE.Mesh(aGeo, shirtMat);
    rightArm.position.set(0.2, 0.48, 0.08);
    rightArm.rotation.x = -Math.PI * 0.45; // Holding balloon string up!
    kGrp.add(rightArm);

    // Floating Balloon or Bouncing Beach Ball
    const isBall = k % 2 === 1;
    const balloon = new THREE.Mesh(
      trackGeo(isBall ? new THREE.SphereGeometry(0.24, 10, 10) : new THREE.SphereGeometry(0.22, 10, 10)),
      bMat
    );
    balloon.position.set(0.22, isBall ? 0.38 : 1.35, 0.22);
    kGrp.add(balloon);

    const strGeo = trackGeo(new THREE.CylinderGeometry(0.005, 0.005, 0.7, 4));
    const string = new THREE.Mesh(strGeo, whiteSteelMat);
    string.position.set(0.22, 0.95, 0.16);
    string.visible = !isBall;
    kGrp.add(string);

    const startX = kidBounds.minX + Math.random() * (kidBounds.maxX - kidBounds.minX);
    const startZ = kidBounds.minZ + Math.random() * (kidBounds.maxZ - kidBounds.minZ);
    const ang = Math.random() * Math.PI * 2;

    group.add(kGrp);
    balloonKids.push({
      root: kGrp,
      balloon,
      string,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      minX: kidBounds.minX,
      maxX: kidBounds.maxX,
      minZ: kidBounds.minZ,
      maxZ: kidBounds.maxZ,
      x: startX,
      z: startZ,
      dirX: Math.cos(ang),
      dirZ: Math.sin(ang),
      speed: 3.2,
      phase: Math.random() * Math.PI * 2,
    });
  }

  // =========================================================================
  // UPDATE LOOP (Every Frame)
  // =========================================================================
  const update = (
    delta: number,
    elapsed: number,
    state: WaterSlideState
  ): { sliderPose: WaterSlidePose } => {
    const dt = Math.min(Math.max(delta, 0.001), 0.1);

    // 1. Water Slide Inflatable Tube Pose
    const sliderPose = computeWaterSlidePoseAtT(state.t, state.speed);
    inflatableTube.position.set(sliderPose.x, sliderPose.y, sliderPose.z);
    inflatableTube.rotation.set(sliderPose.rotX, sliderPose.yaw, sliderPose.roll, 'YXZ');

    // Splashdown particles activation
    if (state.state === 'splashdown') {
      splashGroup.visible = true;
      splashGroup.position.set(sliderPose.x, 0.44, sliderPose.z);
      for (let i = 0; i < splashGroup.children.length; i++) {
        const sp = splashGroup.children[i];
        const v = splashVelocities[i];
        sp.position.x += v.x * dt;
        sp.position.y += v.y * dt;
        sp.position.z += v.z * dt;
        v.y -= 9.81 * dt; // Gravity
        if (sp.position.y < 0) {
          sp.position.set(0, 0, 0);
          v.y = 2.5 + Math.random() * 3.5;
        }
      }
    } else {
      splashGroup.visible = false;
      for (let i = 0; i < splashGroup.children.length; i++) {
        splashGroup.children[i].position.set(0, 0, 0);
      }
    }

    // 2. Animated Swimmers in the Pool
    for (const sw of swimmerRigs) {
      const bob = Math.sin(elapsed * 2.8 + sw.phase) * 0.06;
      sw.root.position.y = 0.38 + bob;
      if (sw.swimStyle === 'freestyle') {
        const stroke = Math.sin(elapsed * 4.2 + sw.phase);
        sw.leftArm.rotation.x = stroke * 0.85;
        sw.rightArm.rotation.x = -stroke * 0.85;
        sw.leftLeg.rotation.x = Math.cos(elapsed * 6.5 + sw.phase) * 0.45;
        sw.rightLeg.rotation.x = -Math.cos(elapsed * 6.5 + sw.phase) * 0.45;
        // Glide gently in pool
        sw.root.position.z = sw.baseZ + Math.sin(elapsed * 0.4 + sw.phase) * 1.2;
      } else if (sw.swimStyle === 'ring_float') {
        sw.root.rotation.z = Math.sin(elapsed * 1.8 + sw.phase) * 0.08;
        sw.leftLeg.rotation.x = Math.sin(elapsed * 2.2 + sw.phase) * 0.22;
        sw.rightLeg.rotation.x = -Math.sin(elapsed * 2.2 + sw.phase) * 0.22;
      } else {
        // Treading water
        sw.leftArm.rotation.z = -0.4 + Math.sin(elapsed * 3.5 + sw.phase) * 0.35;
        sw.rightArm.rotation.z = 0.4 - Math.sin(elapsed * 3.5 + sw.phase) * 0.35;
      }
    }

    // 3. Kids Running & Playing with Balloons / Bouncing Beach Balls
    for (const kid of balloonKids) {
      kid.x += kid.dirX * kid.speed * dt;
      kid.z += kid.dirZ * kid.speed * dt;

      if (kid.x < kid.minX || kid.x > kid.maxX) {
        kid.dirX *= -1;
        kid.x = Math.max(kid.minX, Math.min(kid.maxX, kid.x));
      }
      if (kid.z < kid.minZ || kid.z > kid.maxZ) {
        kid.dirZ *= -1;
        kid.z = Math.max(kid.minZ, Math.min(kid.maxZ, kid.z));
      }

      const stride = Math.sin(elapsed * 10.5 + kid.phase);
      const hop = Math.abs(Math.sin(elapsed * 10.5 + kid.phase)) * 0.11;
      kid.root.position.set(kid.x, 0.02 + hop, kid.z);
      kid.root.rotation.y = Math.atan2(kid.dirX, kid.dirZ);

      kid.leftLeg.rotation.x = stride * 0.52;
      kid.rightLeg.rotation.x = -stride * 0.52;
      kid.leftArm.rotation.x = -stride * 0.42;

      // Animate balloon sway or beach ball bounce
      if (kid.string.visible) {
        kid.balloon.position.x = 0.22 + Math.sin(elapsed * 3.2 + kid.phase) * 0.08;
        kid.balloon.position.y = 1.35 + Math.cos(elapsed * 4.1 + kid.phase) * 0.06;
      } else {
        // Beach ball bouncing off hands!
        const bHop = Math.abs(Math.sin(elapsed * 6.5 + kid.phase)) * 0.45;
        kid.balloon.position.y = 0.38 + bHop;
      }
    }

    return { sliderPose };
  };

  return {
    group,
    interactables,
    inflatableTube,
    update,
    dispose: () => {
      for (const d of disposables) {
        d.dispose();
      }
    },
  };
}
