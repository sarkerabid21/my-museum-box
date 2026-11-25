import * as THREE from 'three';
import {
  COASTER_WAYPOINTS,
  computeCoasterPoseAtT,
  sampleCoasterSpline,
  type CoasterPose,
  type CoasterState,
} from '../museum/rollerCoaster';

export interface BuiltRollerCoaster {
  group: THREE.Group;
  interactables: THREE.Object3D[];
  leadCar: THREE.Group;
  middleCar: THREE.Group;
  rearCar: THREE.Group;
  /**
   * Updates coaster train positioning, wheel spins, NPC cheers,
   * walking adults, and fast-running children in the park.
   */
  update: (
    delta: number,
    elapsed: number,
    state: CoasterState
  ) => {
    leadPose: CoasterPose;
  };
  dispose: () => void;
}

interface ParkCrowdPedestrian {
  root: THREE.Group;
  isChild: boolean;
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
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
}

/**
 * Builds a seated cheering NPC rider for the passenger coaster cars.
 */
function buildCoasterNpc(
  shirtHex: number,
  skinHex: number,
  hairHex: number,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T
): { root: THREE.Group; leftArm: THREE.Mesh; rightArm: THREE.Mesh } {
  const root = new THREE.Group();
  const shirtMat = trackMat(new THREE.MeshStandardMaterial({ color: shirtHex, roughness: 0.65 }));
  const skinMat = trackMat(new THREE.MeshStandardMaterial({ color: skinHex, roughness: 0.6 }));
  const hairMat = trackMat(new THREE.MeshStandardMaterial({ color: hairHex, roughness: 0.85 }));

  const torso = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.38, 0.44, 0.24)), shirtMat);
  torso.position.y = 0.24;
  root.add(torso);

  const head = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.14, 10, 8)), skinMat);
  head.position.y = 0.6;
  root.add(head);

  const hair = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.145, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55)),
    hairMat
  );
  hair.position.set(0, 0.62, -0.01);
  root.add(hair);

  // Raised hands cheering!
  const armGeo = trackGeo(new THREE.CylinderGeometry(0.04, 0.038, 0.42, 6));
  const leftArm = new THREE.Mesh(armGeo, shirtMat);
  leftArm.position.set(-0.25, 0.58, 0.05);
  leftArm.rotation.z = 0.42;
  root.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, shirtMat);
  rightArm.position.set(0.25, 0.58, 0.05);
  rightArm.rotation.z = -0.42;
  root.add(rightArm);

  return { root, leftArm, rightArm };
}

/**
 * Builds walking adult or fast-running child NPC for the East Park atmosphere.
 */
function buildParkPedestrian(
  isChild: boolean,
  shirtHex: number,
  pantsHex: number,
  skinHex: number,
  hairHex: number,
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  speed: number,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T
): ParkCrowdPedestrian {
  const root = new THREE.Group();
  const scale = isChild ? 0.68 : 1.0;
  root.scale.set(scale, scale, scale);

  const shirtMat = trackMat(new THREE.MeshStandardMaterial({ color: shirtHex, roughness: 0.7 }));
  const pantsMat = trackMat(new THREE.MeshStandardMaterial({ color: pantsHex, roughness: 0.75 }));
  const skinMat = trackMat(new THREE.MeshStandardMaterial({ color: skinHex, roughness: 0.65 }));
  const hairMat = trackMat(new THREE.MeshStandardMaterial({ color: hairHex, roughness: 0.85 }));

  const torsoH = 0.52;
  const torso = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.38, torsoH, 0.22)), shirtMat);
  torso.position.y = 0.74;
  root.add(torso);

  const head = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.14, 10, 8)), skinMat);
  head.position.y = 1.15;
  root.add(head);

  const hair = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.145, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55)),
    hairMat
  );
  hair.position.set(0, 1.17, -0.01);
  root.add(hair);

  const legGeo = trackGeo(new THREE.CylinderGeometry(0.06, 0.055, 0.54, 8));
  const leftLeg = new THREE.Mesh(legGeo, pantsMat);
  leftLeg.position.set(-0.11, 0.27, 0);
  root.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, pantsMat);
  rightLeg.position.set(0.11, 0.27, 0);
  root.add(rightLeg);

  const armGeo = trackGeo(new THREE.CylinderGeometry(0.045, 0.04, 0.46, 6));
  const leftArm = new THREE.Mesh(armGeo, shirtMat);
  leftArm.position.set(-0.25, 0.78, 0);
  root.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, shirtMat);
  rightArm.position.set(0.25, 0.78, 0);
  root.add(rightArm);

  const startX = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
  const startZ = bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ);
  const ang = Math.random() * Math.PI * 2;

  return {
    root,
    isChild,
    minX: bounds.minX,
    maxX: bounds.maxX,
    minZ: bounds.minZ,
    maxZ: bounds.maxZ,
    x: startX,
    z: startZ,
    dirX: Math.cos(ang),
    dirZ: Math.sin(ang),
    speed,
    phase: Math.random() * Math.PI * 2,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
  };
}

/**
 * Builds a single aerodynamic coaster car (chassis, fiberglass shell, seats, lap bar, bogie wheels).
 */
function buildCoasterCarMesh(
  carIndex: number,
  bodyColorHex: number,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T
): { carGroup: THREE.Group; passengerRider?: { root: THREE.Group; leftArm: THREE.Mesh; rightArm: THREE.Mesh } } {
  const carGroup = new THREE.Group();

  const bodyMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: bodyColorHex,
      roughness: 0.28,
      metalness: 0.35,
    })
  );
  const trimMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.32, metalness: 0.65 }));
  const blackMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.55 }));
  const chromeMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.18, metalness: 0.85 }));

  // Main Car Body Shell
  const body = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.42, 0.58, 2.15)), bodyMat);
  body.position.y = 0.42;
  body.castShadow = true;
  body.receiveShadow = true;
  carGroup.add(body);

  // Aerodynamic Sloped Nose on the lead car!
  if (carIndex === 0) {
    const nose = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.72, 0.85, 4)), bodyMat);
    nose.rotation.y = Math.PI / 4;
    nose.rotation.x = -Math.PI / 2;
    nose.position.set(0, 0.42, 1.48);
    carGroup.add(nose);

    // Glowing front headlights
    const hlMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: new THREE.Color(0xfef08a),
        emissiveIntensity: 0.85,
        roughness: 0.1,
      })
    );
    for (const sx of [-0.42, 0.42]) {
      const hl = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.11, 8, 8)), hlMat);
      hl.position.set(sx, 0.48, 1.35);
      carGroup.add(hl);
    }
  }

  // Dual bucket seats (black padded upholstery)
  for (const sz of [-0.35, 0.38]) {
    const seatBack = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.08, 0.58, 0.14)), blackMat);
    seatBack.position.set(0, 0.72, sz - 0.26);
    carGroup.add(seatBack);
    const seatBase = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.08, 0.16, 0.48)), blackMat);
    seatBase.position.set(0, 0.46, sz);
    carGroup.add(seatBase);
  }

  // Chrome Safety Lap Bars
  for (const sz of [-0.35, 0.38]) {
    const lapBar = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.032, 0.032, 1.05, 8)), chromeMat);
    lapBar.rotation.z = Math.PI / 2;
    lapBar.position.set(0, 0.68, sz + 0.12);
    carGroup.add(lapBar);
  }

  // Golden Racing Stripes along the flanks
  for (const sx of [-0.72, 0.72]) {
    const stripe = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.04, 0.12, 1.85)), trimMat);
    stripe.position.set(sx, 0.48, 0);
    carGroup.add(stripe);
  }

  // Steel Chassis Bogie Flanged Wheels clamped to rails
  const wheelGeo = trackGeo(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12));
  for (const sx of [-0.58, 0.58]) {
    for (const sz of [-0.75, 0.75]) {
      const w = new THREE.Mesh(wheelGeo, chromeMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(sx, 0.12, sz);
      carGroup.add(w);
    }
  }

  let passengerRider: { root: THREE.Group; leftArm: THREE.Mesh; rightArm: THREE.Mesh } | undefined;
  // If passenger car (cars 1 and 2), add cheering seated NPC rider!
  if (carIndex > 0) {
    const shirtHex = carIndex === 1 ? 0x0284c7 : 0xe11d48; // Blue or Magenta
    const skinHex = carIndex === 1 ? 0xc89066 : 0xdba87e;
    const hairHex = carIndex === 1 ? 0x1f2937 : 0x78350f;
    passengerRider = buildCoasterNpc(shirtHex, skinHex, hairHex, trackGeo, trackMat);
    passengerRider.root.position.set(0.24, 0.48, -0.32);
    carGroup.add(passengerRider.root);
  }

  return { carGroup, passengerRider };
}

/**
 * Builds the complete visual Roller Coaster Ride and Park Crowd system:
 * - Continuous dual tubular steel rails + central spine pipe
 * - Instanced track cross-ties & grounded support trestles
 * - Starting station house & boarding platform with glowing signboard
 * - 3-car articulated coaster train (lead car + 2 passenger cars)
 * - Animated walking adults and joyful running children in the East Park
 */
export function buildRollerCoaster(maxAnisotropy: number): BuiltRollerCoaster {
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

  // PBR Materials
  const railMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xdc2626, // Vivid Crimson Racing Red
      roughness: 0.22,
      metalness: 0.78,
    })
  );
  const spineMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1e293b, // Deep Charcoal Steel Spine
      roughness: 0.32,
      metalness: 0.85,
    })
  );
  const sleeperMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Golden High-Vis Support Ties
      roughness: 0.35,
      metalness: 0.65,
    })
  );
  const pillarMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf1f5f9, // Clean White Steel Columns
      roughness: 0.35,
      metalness: 0.45,
    })
  );
  const woodMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.68, metalness: 0.05 }));
  const steelMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.35, metalness: 0.75 }));

  // =========================================================================
  // 1. VISUAL SPLINE TRACK (DUAL RAILS + SPINE PIPE + SLEEPERS + PILLARS)
  // =========================================================================
  const sampleCount = 280;
  const leftRailPts: THREE.Vector3[] = [];
  const rightRailPts: THREE.Vector3[] = [];
  const spinePts: THREE.Vector3[] = [];

  interface SleeperData {
    pos: THREE.Vector3;
    yaw: number;
    pitch: number;
    roll: number;
  }
  interface PillarData {
    x: number;
    topY: number;
    z: number;
  }

  const sleepers: SleeperData[] = [];
  const pillars: PillarData[] = [];

  const halfGauge = 0.54;

  for (let i = 0; i < sampleCount; i++) {
    const t = i / sampleCount;
    const s = sampleCoasterSpline(t, COASTER_WAYPOINTS);
    const center = new THREE.Vector3(s.x, s.y, s.z);

    const hLen = Math.hypot(s.tx, s.tz) || 1e-5;
    // Tangent unit vector
    const tLen = Math.hypot(s.tx, s.ty, s.tz) || 1e-5;
    const T = new THREE.Vector3(s.tx / tLen, s.ty / tLen, s.tz / tLen);

    // Horizontal normal perpendicular to tangent
    const normH = new THREE.Vector3(-s.tz / hLen, 0, s.tx / hLen);
    // Up vector
    const Up = new THREE.Vector3().crossVectors(normH, T).normalize();

    // Apply banking roll to normal and up vectors
    const cosR = Math.cos(s.roll);
    const sinR = Math.sin(s.roll);
    const N = new THREE.Vector3()
      .addScaledVector(normH, cosR)
      .addScaledVector(Up, sinR)
      .normalize();
    const U = new THREE.Vector3()
      .addScaledVector(normH, -sinR)
      .addScaledVector(Up, cosR)
      .normalize();

    // Left Rail, Right Rail & Central Spine points
    const leftPt = new THREE.Vector3()
      .copy(center)
      .addScaledVector(N, -halfGauge)
      .addScaledVector(U, 0.08);
    const rightPt = new THREE.Vector3()
      .copy(center)
      .addScaledVector(N, halfGauge)
      .addScaledVector(U, 0.08);
    const spinePt = new THREE.Vector3()
      .copy(center)
      .addScaledVector(U, -0.22);

    leftRailPts.push(leftPt);
    rightRailPts.push(rightPt);
    spinePts.push(spinePt);

    // Sleeper cross-ties every 2 samples (~1.5m)
    if (i % 2 === 0) {
      const yaw = Math.atan2(s.tx, s.tz);
      const pitch = -Math.atan2(s.ty, hLen);
      sleepers.push({ pos: center.clone().addScaledVector(U, -0.06), yaw, pitch, roll: s.roll });
    }

    // Grounded support pillars every 6 samples (~4.5m)
    if (i % 6 === 0) {
      pillars.push({ x: s.x, topY: s.y - 0.28, z: s.z });
    }
  }

  // Smooth closed-loop tubular rails
  const leftCurve = new THREE.CatmullRomCurve3(leftRailPts, true);
  const rightCurve = new THREE.CatmullRomCurve3(rightRailPts, true);
  const spineCurve = new THREE.CatmullRomCurve3(spinePts, true);

  const leftRailMesh = new THREE.Mesh(
    trackGeo(new THREE.TubeGeometry(leftCurve, 320, 0.052, 8, true)),
    railMat
  );
  leftRailMesh.userData.rideId = 'ride-east-coaster';
  interactables.push(leftRailMesh);
  group.add(leftRailMesh);

  const rightRailMesh = new THREE.Mesh(
    trackGeo(new THREE.TubeGeometry(rightCurve, 320, 0.052, 8, true)),
    railMat
  );
  rightRailMesh.userData.rideId = 'ride-east-coaster';
  interactables.push(rightRailMesh);
  group.add(rightRailMesh);

  const spineMesh = new THREE.Mesh(
    trackGeo(new THREE.TubeGeometry(spineCurve, 320, 0.11, 10, true)),
    spineMat
  );
  spineMesh.userData.rideId = 'ride-east-coaster';
  interactables.push(spineMesh);
  group.add(spineMesh);

  // Instanced Sleepers (Cross-Ties) for 60 instances in 1 draw call!
  const sleeperGeo = trackGeo(new THREE.BoxGeometry(1.24, 0.065, 0.12));
  const sleeperInstanced = new THREE.InstancedMesh(sleeperGeo, sleeperMat, sleepers.length);
  const _dummy = new THREE.Object3D();
  for (let i = 0; i < sleepers.length; i++) {
    const sl = sleepers[i];
    _dummy.position.copy(sl.pos);
    _dummy.rotation.set(sl.pitch, sl.yaw, sl.roll, 'YXZ');
    _dummy.updateMatrix();
    sleeperInstanced.setMatrixAt(i, _dummy.matrix);
  }
  sleeperInstanced.instanceMatrix.needsUpdate = true;
  group.add(sleeperInstanced);

  // Grounded Pillars down to y = 0
  const colGeo = trackGeo(new THREE.CylinderGeometry(0.18, 0.22, 1, 10));
  for (const pil of pillars) {
    const h = Math.max(0.6, pil.topY);
    const col = new THREE.Mesh(colGeo, pillarMat);
    col.scale.set(1, h, 1);
    col.position.set(pil.x, h / 2, pil.z);
    group.add(col);

    // Concrete base footing
    const footing = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.85, 0.32, 0.85)), steelMat);
    footing.position.set(pil.x, 0.16, pil.z);
    group.add(footing);
  }

  // =========================================================================
  // 2. STARTING STATION & BOARDING PLATFORM (AT X: 61, Z: 20.5)
  // =========================================================================
  const stationRoot = new THREE.Group();
  stationRoot.position.set(61.0, 0, 20.5);

  // Raised timber boarding deck
  const deck = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(9.2, 0.36, 4.2)), woodMat);
  deck.position.set(0, 1.15, 0);
  deck.userData.rideId = 'ride-east-coaster';
  interactables.push(deck);
  stationRoot.add(deck);

  // Safety railings along station edge
  for (const sz of [-1.95, 1.95]) {
    const rail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(9.0, 0.08, 0.08)), sleeperMat);
    rail.position.set(0, 2.0, sz);
    stationRoot.add(rail);
    for (let rx = -4.0; rx <= 4.0; rx += 1.6) {
      const post = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.04, 0.04, 0.85, 8)), steelMat);
      post.position.set(rx, 1.58, sz);
      stationRoot.add(post);
    }
  }

  // Boarding access stairs from ground up to deck (y = 1.33)
  for (let s = 0; s < 4; s++) {
    const step = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.8, 0.26, 0.45)), woodMat);
    step.position.set(0, 0.13 + s * 0.26, 2.3 + s * 0.42);
    step.userData.rideId = 'ride-east-coaster';
    interactables.push(step);
    stationRoot.add(step);
  }

  // Covered station canopy roof on 4 golden pillars
  for (const sx of [-4.2, 4.2]) {
    for (const sz of [-1.9, 1.9]) {
      const col = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.12, 0.14, 3.8, 10)), sleeperMat);
      col.position.set(sx, 3.05, sz);
      stationRoot.add(col);
    }
  }
  const canopy = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(5.8, 1.4, 4)), railMat);
  canopy.rotation.y = Math.PI / 4;
  canopy.position.set(0, 5.4, 0);
  stationRoot.add(canopy);

  // Station Banner Signboard
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 1024;
  signCanvas.height = 256;
  const sCtx = signCanvas.getContext('2d')!;
  sCtx.fillStyle = '#991B1B';
  sCtx.fillRect(0, 0, 1024, 256);
  sCtx.strokeStyle = '#FDE047';
  sCtx.lineWidth = 14;
  sCtx.strokeRect(12, 12, 1000, 232);
  sCtx.textAlign = 'center';
  sCtx.fillStyle = '#FFFFFF';
  sCtx.font = '800 58px "Plus Jakarta Sans", sans-serif';
  sCtx.fillText('CYCLONE ROLLER COASTER', 512, 116);
  sCtx.fillStyle = '#FDE047';
  sCtx.font = '700 32px "JetBrains Mono", monospace';
  sCtx.fillText('PRESS [E] TO BOARD THE RIDE', 512, 192);

  const signTex = trackTex(new THREE.CanvasTexture(signCanvas));
  signTex.colorSpace = THREE.SRGBColorSpace;
  signTex.anisotropy = maxAnisotropy;

  const signBoard = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(5.4, 1.35)),
    trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: signTex,
        emissive: new THREE.Color(0xffffff),
        emissiveMap: signTex,
        emissiveIntensity: 0.28,
        roughness: 0.35,
      })
    )
  );
  signBoard.position.set(0, 4.35, 2.05);
  signBoard.userData.rideId = 'ride-east-coaster';
  interactables.push(signBoard);
  stationRoot.add(signBoard);

  group.add(stationRoot);

  // =========================================================================
  // 3. 3-CAR ARTICULATED ROLLER COASTER TRAIN
  // =========================================================================
  const trainGroup = new THREE.Group();

  const car0 = buildCoasterCarMesh(0, 0xdc2626, trackGeo, trackMat); // Lead Engine Car
  car0.carGroup.userData.rideId = 'ride-east-coaster';
  interactables.push(car0.carGroup);
  trainGroup.add(car0.carGroup);

  const car1 = buildCoasterCarMesh(1, 0x0284c7, trackGeo, trackMat); // Passenger Car 1
  car1.carGroup.userData.rideId = 'ride-east-coaster';
  interactables.push(car1.carGroup);
  trainGroup.add(car1.carGroup);

  const car2 = buildCoasterCarMesh(2, 0xe11d48, trackGeo, trackMat); // Passenger Car 2
  car2.carGroup.userData.rideId = 'ride-east-coaster';
  interactables.push(car2.carGroup);
  trainGroup.add(car2.carGroup);

  group.add(trainGroup);

  // =========================================================================
  // 4. PARK CROWD: WALKING ADULTS & RUNNING CHILDREN IN THE EAST PARK PLAZA
  // =========================================================================
  const crowdPedestrians: ParkCrowdPedestrian[] = [];
  const eastParkBounds = { minX: 25.0, maxX: 82.0, minZ: 5.0, maxZ: 22.0 };

  // 4 Walking Adults strolling leisurely
  const adultColors: Array<[number, number, number, number]> = [
    [0x2563eb, 0x1f2937, 0xc68e65, 0x191614], // Blue shirt
    [0x16a34a, 0x374151, 0xd4a07a, 0x3f2e21], // Green shirt
    [0x9333ea, 0x111827, 0xbe8257, 0x0f172a], // Purple shirt
    [0xd97706, 0x4b5563, 0xdcb08b, 0x451a03], // Amber shirt
  ];
  for (const [shirt, pants, skin, hair] of adultColors) {
    const ped = buildParkPedestrian(false, shirt, pants, skin, hair, eastParkBounds, 1.4, trackGeo, trackMat);
    group.add(ped.root);
    crowdPedestrians.push(ped);
  }

  // 4 Joyful Running Kids (bright lime, sunny yellow, cyan, hot orange) with fast arm-pumps!
  const childColors: Array<[number, number, number, number]> = [
    [0x84cc16, 0x1e3a8a, 0xc58c64, 0x1c1917], // Lime shirt
    [0xfacc15, 0x4338ca, 0xdb9f77, 0x7c2d12], // Yellow shirt
    [0x06b6d4, 0x312e81, 0xbb7e54, 0x0a0a0a], // Cyan shirt
    [0xf97316, 0x1e1b4b, 0xd59e74, 0x581c87], // Orange shirt
  ];
  for (const [shirt, pants, skin, hair] of childColors) {
    const ped = buildParkPedestrian(true, shirt, pants, skin, hair, eastParkBounds, 3.4, trackGeo, trackMat);
    group.add(ped.root);
    crowdPedestrians.push(ped);
  }

  // Update simulation loop
  const update = (
    delta: number,
    elapsed: number,
    state: CoasterState
  ): { leadPose: CoasterPose } => {
    const dt = Math.min(Math.max(delta, 0.001), 0.1);

    // Update 3 Coaster Cars poses along track spline
    const t0 = state.t;
    const t1 = ((t0 - 0.038) % 1 + 1) % 1;
    const t2 = ((t0 - 0.076) % 1 + 1) % 1;

    const leadPose = computeCoasterPoseAtT(t0, state.speed);
    const midPose = computeCoasterPoseAtT(t1, state.speed);
    const rearPose = computeCoasterPoseAtT(t2, state.speed);

    car0.carGroup.position.set(leadPose.x, leadPose.y, leadPose.z);
    car0.carGroup.rotation.set(leadPose.rotX, leadPose.yaw, leadPose.roll, 'YXZ');

    car1.carGroup.position.set(midPose.x, midPose.y, midPose.z);
    car1.carGroup.rotation.set(midPose.rotX, midPose.yaw, midPose.roll, 'YXZ');

    car2.carGroup.position.set(rearPose.x, rearPose.y, rearPose.z);
    car2.carGroup.rotation.set(rearPose.rotX, rearPose.yaw, rearPose.roll, 'YXZ');

    // Animate passenger screams and cheering arm waves during high-speed segments
    const isRacing = state.state === 'racing';
    const waveFreq = isRacing ? 16.0 : 6.0;
    const waveAmp = isRacing ? 0.35 : 0.12;

    if (car1.passengerRider) {
      const w1 = Math.sin(elapsed * waveFreq);
      car1.passengerRider.leftArm.rotation.x = -0.45 + w1 * waveAmp;
      car1.passengerRider.rightArm.rotation.x = -0.45 - w1 * waveAmp;
    }
    if (car2.passengerRider) {
      const w2 = Math.cos(elapsed * waveFreq + 1.2);
      car2.passengerRider.leftArm.rotation.x = -0.45 + w2 * waveAmp;
      car2.passengerRider.rightArm.rotation.x = -0.45 - w2 * waveAmp;
    }

    // Animate Park Crowd: Walking Adults & Running Kids
    for (const ped of crowdPedestrians) {
      ped.x += ped.dirX * ped.speed * dt;
      ped.z += ped.dirZ * ped.speed * dt;

      // Bounce within plaza bounds
      if (ped.x < ped.minX || ped.x > ped.maxX) {
        ped.dirX *= -1;
        ped.x = Math.max(ped.minX, Math.min(ped.maxX, ped.x));
      }
      if (ped.z < ped.minZ || ped.z > ped.maxZ) {
        ped.dirZ *= -1;
        ped.z = Math.max(ped.minZ, Math.min(ped.maxZ, ped.z));
      }

      const strideFreq = ped.isChild ? 10.5 : 4.5;
      const stride = Math.sin(elapsed * strideFreq + ped.phase);
      const hop = ped.isChild ? Math.abs(Math.sin(elapsed * strideFreq + ped.phase)) * 0.12 : 0;

      ped.root.position.set(ped.x, 0.02 + hop, ped.z);
      ped.root.rotation.y = Math.atan2(ped.dirX, ped.dirZ);

      // Running kids swing arms and legs with wide energetic arcs!
      const legAmp = ped.isChild ? 0.82 : 0.44;
      const armAmp = ped.isChild ? 0.72 : 0.34;
      ped.leftLeg.rotation.x = stride * legAmp;
      ped.rightLeg.rotation.x = -stride * legAmp;
      ped.leftArm.rotation.x = -stride * armAmp;
      ped.rightArm.rotation.x = stride * armAmp;
    }

    return { leadPose };
  };

  return {
    group,
    interactables,
    leadCar: car0.carGroup,
    middleCar: car1.carGroup,
    rearCar: car2.carGroup,
    update,
    dispose: () => {
      for (const d of disposables) {
        d.dispose();
      }
    },
  };
}
