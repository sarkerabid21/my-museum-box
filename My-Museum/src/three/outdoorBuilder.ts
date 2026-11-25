import * as THREE from 'three';
import {
  FOOTPATH_NORTH_Z,
  FOOTPATH_SOUTH_Z,
  GARDEN_FOUNTAINS,
  ROAD_CENTER_Z,
  ROAD_NORTH_Z,
  ROAD_SOUTH_Z,
  WORLD_MAX_X,
  WORLD_MIN_X,
  type TrafficVehicleState,
  type VehicleKind,
} from '../museum/outdoorWorld';
import { HALL_HEIGHT, ROOM_HALF_WIDTH, ROOM_WIDTH, type MuseumLayout } from '../museum/layout';
import { createContactShadowTexture } from './proceduralTextures';
import { buildMetroSystem, type MetroTrainRig } from './metroBuilder';
import { buildKashmirEnvironment, type KashmirBuildResult } from './kashmirBuilder';

export interface VehicleRig {
  id: string;
  kind: VehicleKind;
  root: THREE.Group;
  wheels: THREE.Object3D[];
  driverGroup: THREE.Group;
  riderSeatLocal: THREE.Vector3;
  passengerSeatLocal: THREE.Vector3;
}

export interface PedestrianRig {
  id: string;
  root: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  x: number;
  z: number;
  dir: 1 | -1;
  speed: number;
  phase: number;
  sidewalkZ: number;
  minX: number;
  maxX: number;
}

export interface BuiltOutdoorWorld {
  group: THREE.Group;
  vehicleRigs: Map<string, VehicleRig>;
  pedestrians: PedestrianRig[];
  ejectedDriverRig: PedestrianRig;
  interactables: THREE.Object3D[];
  metroTrainRig?: MetroTrainRig;
  kashmir?: KashmirBuildResult;
  dispose: () => void;
}

function createRoadAsphaltTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 512;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Realistic sun-baked asphalt base
  ctx.fillStyle = '#33363B';
  ctx.fillRect(0, 0, w, h);

  // Subtle mineral aggregate speckles
  for (let i = 0; i < 1600; i++) {
    const x = (i * 73) % w;
    const y = (i * 137) % h;
    const shade = i % 3 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(12,14,18,0.12)';
    ctx.fillStyle = shade;
    ctx.fillRect(x, y, 2, 2);
  }

  // Subtle tire-wear tracks along both lanes
  ctx.fillStyle = 'rgba(20,22,26,0.18)';
  ctx.fillRect(0, 96, w, 46);
  ctx.fillRect(0, 368, w, 46);

  // Crisp white outer shoulder lines
  ctx.fillStyle = '#E7E4DC';
  ctx.fillRect(0, 14, w, 7);
  ctx.fillRect(0, h - 21, w, 7);

  // Double amber-yellow highway center divider
  ctx.fillStyle = '#EAB308';
  ctx.fillRect(0, h / 2 - 11, w, 7);
  ctx.fillRect(0, h / 2 + 4, w, 7);

  // Dashed lane guidance ticks
  ctx.fillStyle = 'rgba(241, 240, 236, 0.72)';
  for (let x = 24; x < w; x += 128) {
    ctx.fillRect(x, 124, 58, 5);
    ctx.fillRect(x, h - 129, 58, 5);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(22, 1);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createSidewalkTileTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#C9C1B4';
  ctx.fillRect(0, 0, size, size);

  const tiles = 4;
  const step = size / tiles;
  for (let r = 0; r < tiles; r++) {
    for (let c = 0; c < tiles; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#D2CABE' : '#C4BBB0';
      ctx.fillRect(c * step + 2, r * step + 2, step - 4, step - 4);
    }
  }
  ctx.strokeStyle = 'rgba(84, 76, 68, 0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= tiles; i++) {
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step, size);
    ctx.moveTo(0, i * step);
    ctx.lineTo(size, i * step);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(44, 1.5);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createGrassTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#4E7D44';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 900; i++) {
    const x = (i * 89) % size;
    const y = (i * 53) % size;
    ctx.fillStyle =
      i % 3 === 0 ? '#5D8F50' : i % 3 === 1 ? '#416D38' : '#6A9B59';
    ctx.fillRect(x, y, 4 + (i % 6), 3 + (i % 5));
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(36, 24);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createHighwaySignTexture(options: {
  title: string;
  subtitle: string;
  badge: string;
  arrow: 'left' | 'right' | 'center';
  bgHex: string;
  accentHex: string;
  maxAnisotropy: number;
}): THREE.CanvasTexture {
  const w = 1024;
  const h = 384;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = options.bgHex;
  ctx.fillRect(0, 0, w, h);

  // Crisp highway sign reflective white border
  ctx.strokeStyle = '#F8FAFC';
  ctx.lineWidth = 14;
  ctx.strokeRect(18, 18, w - 36, h - 36);

  // Accent badge pill bar at top
  ctx.fillStyle = options.accentHex;
  ctx.fillRect(48, 44, 210, 62);
  ctx.fillStyle = '#111827';
  ctx.font = '800 34px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(options.badge, 153, 86);

  // Direction arrow
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.font = '700 84px "Plus Jakarta Sans", sans-serif';
  const arrowStr =
    options.arrow === 'left'
      ? `←  ${options.title}`
      : options.arrow === 'right'
        ? `${options.title}  →`
        : options.title;
  ctx.fillText(arrowStr, w / 2, 224);

  ctx.fillStyle = '#E2E8F0';
  ctx.font = '600 36px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(options.subtitle, w / 2, 310);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = options.maxAnisotropy;
  return tex;
}

function createExteriorMuseumFacadeSign(title: string, maxAnisotropy: number): THREE.CanvasTexture {
  const w = 1024;
  const h = 220;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1E1A16';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#D4A86A';
  ctx.lineWidth = 8;
  ctx.strokeRect(12, 12, w - 24, h - 24);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#FAF5EC';
  ctx.font = '700 66px Georgia, serif';
  ctx.fillText(title.toUpperCase().slice(0, 22), w / 2, 118);

  ctx.fillStyle = '#D4A86A';
  ctx.font = '600 24px "JetBrains Mono", monospace';
  ctx.fillText('FINE ART GALLERY  ·  BOTANICAL COURTYARD', w / 2, 174);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

const _instDummy = new THREE.Object3D();
const _instColor = new THREE.Color();

/**
 * Populates tropical Bangladeshi trees (Krishnachura flame trees, lush Mango shade trees,
 * and coastal Royal Palms) using batched InstancedMesh layers with per-instance color tinting
 * and grounded bottom-center pivots — preserving rich multi-part silhouettes at minimal draw calls.
 */
function buildInstancedTrees(
  specs: ReadonlyArray<{ x: number; z: number; style: 'krishnachura' | 'mango' | 'palm'; scale: number }>,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T,
  barkMat: THREE.Material
): THREE.Group {
  const grp = new THREE.Group();

  const nonPalms = specs.filter((s) => s.style !== 'palm');
  const krishnas = specs.filter((s) => s.style === 'krishnachura');
  const palms = specs.filter((s) => s.style === 'palm');

  // 1. Non-palm trunks + root flares (1 draw call)
  if (nonPalms.length > 0) {
    const trunkMesh = new THREE.InstancedMesh(
      trackGeo(new THREE.CylinderGeometry(0.24, 0.44, 2.9, 8)),
      barkMat,
      nonPalms.length
    );
    nonPalms.forEach((t, i) => {
      _instDummy.position.set(t.x, 1.45 * t.scale, t.z);
      _instDummy.rotation.set(0, (i * 1.1) % Math.PI, 0);
      _instDummy.scale.set(t.scale, t.scale, t.scale);
      _instDummy.updateMatrix();
      trunkMesh.setMatrixAt(i, _instDummy.matrix);
    });
    trunkMesh.instanceMatrix.needsUpdate = true;
    trunkMesh.computeBoundingSphere();
    grp.add(trunkMesh);

    // 2. Multi-cluster leafy green crowns (4 clusters per tree, 1 draw call total!)
    const leafGeo = trackGeo(new THREE.DodecahedronGeometry(1.5, 1));
    const leafMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0.0 })
    );
    const crownOffsets: Array<[number, number, number, number, number]> = [
      [0, 4.15, 0, 1.2, 0.82],
      [1.15, 3.65, 0.6, 0.9, 0.68],
      [-1.15, 3.7, 0.5, 0.92, 0.7],
      [0.1, 3.85, -1.05, 0.88, 0.68],
    ];
    const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, nonPalms.length * crownOffsets.length);
    let idx = 0;
    const leafGreens = [0x2f6834, 0x3b7638, 0x2a5f30, 0x44803d];
    nonPalms.forEach((t, ti) => {
      crownOffsets.forEach(([ox, oy, oz, rScale, sy], ci) => {
        _instDummy.position.set(t.x + ox * t.scale, oy * t.scale, t.z + oz * t.scale);
        _instDummy.rotation.set(0, (ti + ci) * 0.7, 0);
        _instDummy.scale.set(rScale * t.scale, sy * t.scale, rScale * t.scale);
        _instDummy.updateMatrix();
        leafMesh.setMatrixAt(idx, _instDummy.matrix);
        _instColor.setHex(leafGreens[(ti + ci) % leafGreens.length]);
        leafMesh.setColorAt(idx, _instColor);
        idx++;
      });
    });
    leafMesh.instanceMatrix.needsUpdate = true;
    if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true;
    leafMesh.computeBoundingSphere();
    grp.add(leafMesh);
  }

  // 3. Flame-orange Krishnachura blossom clusters (1 draw call)
  if (krishnas.length > 0) {
    const bloomGeo = trackGeo(new THREE.DodecahedronGeometry(0.95, 0));
    const bloomMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.64, metalness: 0.02 })
    );
    const bOffsets: Array<[number, number, number]> = [
      [0.85, 4.5, 0.8],
      [-0.9, 4.4, 0.75],
      [0.05, 5.05, 0.1],
      [0.95, 4.1, -0.65],
    ];
    const bloomMesh = new THREE.InstancedMesh(bloomGeo, bloomMat, krishnas.length * bOffsets.length);
    let bIdx = 0;
    const flameColors = [0xe64a19, 0xf57c00, 0xd84315, 0xff7043];
    krishnas.forEach((t, ti) => {
      bOffsets.forEach(([ox, oy, oz], bi) => {
        _instDummy.position.set(t.x + ox * t.scale, oy * t.scale, t.z + oz * t.scale);
        _instDummy.rotation.set(0, (ti + bi) * 0.8, 0);
        _instDummy.scale.set(1.2 * t.scale, 0.58 * t.scale, 1.2 * t.scale);
        _instDummy.updateMatrix();
        bloomMesh.setMatrixAt(bIdx, _instDummy.matrix);
        _instColor.setHex(flameColors[(ti + bi) % flameColors.length]);
        bloomMesh.setColorAt(bIdx, _instColor);
        bIdx++;
      });
    });
    bloomMesh.instanceMatrix.needsUpdate = true;
    if (bloomMesh.instanceColor) bloomMesh.instanceColor.needsUpdate = true;
    bloomMesh.computeBoundingSphere();
    grp.add(bloomMesh);
  }

  // 4. Coastal Royal Palms: slender trunks + arching fronds (2 draw calls total)
  if (palms.length > 0) {
    const pTrunk = new THREE.InstancedMesh(
      trackGeo(new THREE.CylinderGeometry(0.15, 0.27, 6.2, 8)),
      barkMat,
      palms.length
    );
    const frondMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x3b7a3e, roughness: 0.72, metalness: 0.02 })
    );
    const pFrond = new THREE.InstancedMesh(
      trackGeo(new THREE.BoxGeometry(0.36, 0.07, 2.75)),
      frondMat,
      palms.length * 6
    );
    let fIdx = 0;
    palms.forEach((t, ti) => {
      _instDummy.position.set(t.x, 3.1 * t.scale, t.z);
      _instDummy.rotation.set(0, 0, -0.04);
      _instDummy.scale.set(t.scale, t.scale, t.scale);
      _instDummy.updateMatrix();
      pTrunk.setMatrixAt(ti, _instDummy.matrix);

      const crownY = 6.1 * t.scale;
      for (let f = 0; f < 6; f++) {
        const a = (f / 6) * Math.PI * 2 + ti * 0.4;
        const reach = 1.35 * t.scale;
        _instDummy.position.set(
          t.x + Math.sin(a) * reach,
          crownY - 0.15 * t.scale,
          t.z + Math.cos(a) * reach
        );
        _instDummy.rotation.set(0.28, a, 0);
        _instDummy.scale.set(t.scale, t.scale, t.scale);
        _instDummy.updateMatrix();
        pFrond.setMatrixAt(fIdx++, _instDummy.matrix);
      }
    });
    pTrunk.instanceMatrix.needsUpdate = true;
    pTrunk.computeBoundingSphere();
    pFrond.instanceMatrix.needsUpdate = true;
    pFrond.computeBoundingSphere();
    grp.add(pTrunk);
    grp.add(pFrond);
  }

  return grp;
}

/**
 * Batched Street Lamp Posts along both sides of the highway (3 InstancedMesh draw calls total!)
 */
function buildInstancedLampPosts(
  specs: ReadonlyArray<{ x: number; z: number; facingRoadSign: 1 | -1 }>,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  poleMat: THREE.Material,
  glowMat: THREE.Material
): THREE.Group {
  const grp = new THREE.Group();
  const count = specs.length;
  if (count === 0) return grp;

  const shafts = new THREE.InstancedMesh(
    trackGeo(new THREE.CylinderGeometry(0.07, 0.14, 5.5, 8)),
    poleMat,
    count
  );
  const arms = new THREE.InstancedMesh(
    trackGeo(new THREE.BoxGeometry(0.09, 0.09, 1.38)),
    poleMat,
    count
  );
  const lamps = new THREE.InstancedMesh(
    trackGeo(new THREE.SphereGeometry(0.2, 8, 6)),
    glowMat,
    count
  );

  specs.forEach((s, i) => {
    _instDummy.position.set(s.x, 2.89, s.z);
    _instDummy.rotation.set(0, 0, 0);
    _instDummy.scale.set(1, 1, 1);
    _instDummy.updateMatrix();
    shafts.setMatrixAt(i, _instDummy.matrix);

    _instDummy.position.set(s.x, 5.68, s.z + s.facingRoadSign * 0.65);
    _instDummy.rotation.set(-s.facingRoadSign * 0.08, 0, 0);
    _instDummy.scale.set(1, 1, 1);
    _instDummy.updateMatrix();
    arms.setMatrixAt(i, _instDummy.matrix);

    _instDummy.position.set(s.x, 5.56, s.z + s.facingRoadSign * 1.25);
    _instDummy.rotation.set(0, 0, 0);
    _instDummy.scale.set(1.15, 0.68, 1.15);
    _instDummy.updateMatrix();
    lamps.setMatrixAt(i, _instDummy.matrix);
  });

  shafts.instanceMatrix.needsUpdate = true;
  shafts.computeBoundingSphere();
  arms.instanceMatrix.needsUpdate = true;
  arms.computeBoundingSphere();
  lamps.instanceMatrix.needsUpdate = true;
  lamps.computeBoundingSphere();

  grp.add(shafts, arms, lamps);
  return grp;
}

// ─────────────────────────────────────────────────────────────────────────────
// CTG CITY APPROACH — Winding road route with city scene, bridge over river, & hills
// Route description:
// 1. Straight heading west (x ~ -25 to -48) - OPEN sky across West Amusement Park
// 2. City entrance: buildings emerge ahead, road curves left (towards south)
// 3. Turns and goes straight through vibrant city: Towers, Sweet Shop, Jewelry Shop, Shopping Mall on both sides
// 4. Turns again and heads toward river & majestic Arch/Girder Bridge over flowing blue water
// 5. Crosses bridge, passes scenic port buildings & ascends into Chittagong's green rolling hills
// ─────────────────────────────────────────────────────────────────────────────
function buildCtgCityApproach(
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T,
  maxAnisotropy: number,
  interactables?: THREE.Object3D[]
): THREE.Group {
  const grp = new THREE.Group();

  // ── Materials ──────────────────────────────────────────────────────────────
  // Pitch-black asphalt matching the main museum highway texture and color tone
  const roadMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x181a1f, roughness: 0.88, metalness: 0.04 })
  );
  // Double amber-yellow highway center divider
  const yellowStripeMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.65 })
  );
  // Crisp white highway shoulder line
  const whiteShoulderMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xe7e4dc, roughness: 0.72 })
  );
  const curbMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xbdb7ab, roughness: 0.88 })
  );
  const concreteMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xc4beb1, roughness: 0.9, metalness: 0.02 })
  );
  const creamWallMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xf4ece1, roughness: 0.84, metalness: 0.02 })
  );
  const terracottaMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xb85838, roughness: 0.78, metalness: 0.04 })
  );
  const sweetPinkMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xf89c9c, roughness: 0.8, metalness: 0.02 })
  );
  const jewelryGoldMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xdfa010, roughness: 0.28, metalness: 0.82 })
  );
  const mallBlueMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.35, metalness: 0.4 })
  );
  const glassBlueMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.12, metalness: 0.8 })
  );
  const darkMetalMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.35, metalness: 0.78 })
  );
  const warmGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffe6a3,
      emissive: new THREE.Color(0xffcd58),
      emissiveIntensity: 0.65,
      roughness: 0.2,
    })
  );
  const brightOrangeMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xe66012, roughness: 0.75 })
  );
  const riverWaterMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.12,
      metalness: 0.45,
    })
  );
  const bridgeTrussMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.42, metalness: 0.65 }) // Classic red-orange steel truss bridge
  );
  const greenHillMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x236830, roughness: 0.94 })
  );
  const woodDeckMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x82542a, roughness: 0.82 })
  );
  const boatWhiteMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.32, metalness: 0.08 })
  );
  const boatNavyMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35, metalness: 0.15 })
  );
  const boatRedMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.42 })
  );
  const boatGreenMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.42 })
  );
  const hazardYellowMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.45 })
  );
  const lifebuoyOrangeMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.48 })
  );
  const skinMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xd49b6a, roughness: 0.85 })
  );
  const clothWhiteMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.72 })
  );
  const clothBlueMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.7 })
  );

  // Helper for text signboards
  const makeSignBoard = (title: string, sub: string, bg: string, textCol: string, w = 512, h = 160) => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = textCol;
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, w / 2, h * 0.4);
    if (sub) {
      ctx.font = '24px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(sub, w / 2, h * 0.78);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    return trackMat(
      new THREE.MeshStandardMaterial({
        map: tex,
        emissiveMap: tex,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.35,
        roughness: 0.35,
      })
    );
  };

  // Helper: Samples points along a cubic Bezier curve for ultra-smooth highway arcs
  const sampleCubicBezier = (
    p0: [number, number],
    p1: [number, number],
    p2: [number, number],
    p3: [number, number],
    samples: number
  ): Array<{ x: number; z: number }> => {
    const pts: Array<{ x: number; z: number }> = [];
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const mt = 1 - t;
      const x =
        mt * mt * mt * p0[0] +
        3 * mt * mt * t * p1[0] +
        3 * mt * t * t * p2[0] +
        t * t * t * p3[0];
      const z =
        mt * mt * mt * p0[1] +
        3 * mt * mt * t * p1[1] +
        3 * mt * t * t * p2[1] +
        t * t * t * p3[1];
      pts.push({ x, z });
    }
    return pts;
  };

  // Helper: Generates mathematically smooth, continuous road meshes with seamless pitch-black asphalt,
  // continuous double amber-yellow center divider lines, white outer shoulder lines, and curved curbstones!
  const createCurvedRoadMesh = (
    points: Array<{ x: number; z: number; y?: number }>,
    width: number,
    baseElevY = 0.03
  ) => {
    const roadGroup = new THREE.Group();
    const N = points.length;
    if (N < 2) return roadGroup;

    // Normals per vertex
    const normals: Array<{ x: number; z: number }> = [];
    for (let i = 0; i < N; i++) {
      let dx = 0;
      let dz = 0;
      if (i === 0) {
        dx = points[1].x - points[0].x;
        dz = points[1].z - points[0].z;
      } else if (i === N - 1) {
        dx = points[N - 1].x - points[N - 2].x;
        dz = points[N - 1].z - points[N - 2].z;
      } else {
        dx = points[i + 1].x - points[i - 1].x;
        dz = points[i + 1].z - points[i - 1].z;
      }
      const len = Math.hypot(dx, dz) || 1;
      normals.push({ x: -dz / len, z: dx / len });
    }

    // 1. Deep Pitch-Black Asphalt Road Surface Geometry
    const posArr: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const halfW = width / 2;
    let dist = 0;

    for (let i = 0; i < N; i++) {
      if (i > 0) {
        dist += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
      }
      const p = points[i];
      const n = normals[i];
      const yVal = p.y !== undefined ? p.y : baseElevY;
      posArr.push(p.x + n.x * halfW, yVal, p.z + n.z * halfW);
      uvs.push(0, dist * 0.15);
      posArr.push(p.x - n.x * halfW, yVal, p.z - n.z * halfW);
      uvs.push(1, dist * 0.15);

      if (i < N - 1) {
        const v0 = i * 2;
        const v1 = i * 2 + 1;
        const v2 = (i + 1) * 2;
        const v3 = (i + 1) * 2 + 1;
        indices.push(v0, v1, v2);
        indices.push(v2, v1, v3);
      }
    }

    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    roadGeo.setIndex(indices);
    roadGeo.computeVertexNormals();
    roadGroup.add(new THREE.Mesh(trackGeo(roadGeo), roadMat));

    // 2. Continuous Double Amber-Yellow Center Divider Stripes (Exact match with highway)
    for (const stripeOffset of [0.12, -0.12]) {
      const yPos: number[] = [];
      const yIdx: number[] = [];
      let yVCount = 0;
      const stripeW = 0.08;

      for (let i = 0; i < N - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const n0 = normals[i];
        const n1 = normals[i + 1];
        const y0 = (p0.y !== undefined ? p0.y : baseElevY) + 0.008;
        const y1 = (p1.y !== undefined ? p1.y : baseElevY) + 0.008;

        const off0 = stripeOffset;
        yPos.push(p0.x + n0.x * (off0 + stripeW), y0, p0.z + n0.z * (off0 + stripeW));
        yPos.push(p0.x + n0.x * (off0 - stripeW), y0, p0.z + n0.z * (off0 - stripeW));
        yPos.push(p1.x + n1.x * (off0 + stripeW), y1, p1.z + n1.z * (off0 + stripeW));
        yPos.push(p1.x + n1.x * (off0 - stripeW), y1, p1.z + n1.z * (off0 - stripeW));

        yIdx.push(yVCount, yVCount + 1, yVCount + 2);
        yIdx.push(yVCount + 2, yVCount + 1, yVCount + 3);
        yVCount += 4;
      }

      if (yPos.length > 0) {
        const yGeo = new THREE.BufferGeometry();
        yGeo.setAttribute('position', new THREE.Float32BufferAttribute(yPos, 3));
        yGeo.setIndex(yIdx);
        yGeo.computeVertexNormals();
        roadGroup.add(new THREE.Mesh(trackGeo(yGeo), yellowStripeMat));
      }
    }

    // 3. Crisp White Outer Shoulder Lines along left & right edges
    for (const side of [1, -1]) {
      const sPos: number[] = [];
      const sIdx: number[] = [];
      let sVCount = 0;
      const shoulderDist = halfW - 0.42;
      const lineW = 0.08;

      for (let i = 0; i < N - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const n0 = normals[i];
        const n1 = normals[i + 1];
        const y0 = (p0.y !== undefined ? p0.y : baseElevY) + 0.007;
        const y1 = (p1.y !== undefined ? p1.y : baseElevY) + 0.007;

        sPos.push(p0.x + n0.x * (shoulderDist * side + lineW), y0, p0.z + n0.z * (shoulderDist * side + lineW));
        sPos.push(p0.x + n0.x * (shoulderDist * side - lineW), y0, p0.z + n0.z * (shoulderDist * side - lineW));
        sPos.push(p1.x + n1.x * (shoulderDist * side + lineW), y1, p1.z + n1.z * (shoulderDist * side + lineW));
        sPos.push(p1.x + n1.x * (shoulderDist * side - lineW), y1, p1.z + n1.z * (shoulderDist * side - lineW));

        sIdx.push(sVCount, sVCount + 1, sVCount + 2);
        sIdx.push(sVCount + 2, sVCount + 1, sVCount + 3);
        sVCount += 4;
      }

      if (sPos.length > 0) {
        const sGeo = new THREE.BufferGeometry();
        sGeo.setAttribute('position', new THREE.Float32BufferAttribute(sPos, 3));
        sGeo.setIndex(sIdx);
        sGeo.computeVertexNormals();
        roadGroup.add(new THREE.Mesh(trackGeo(sGeo), whiteShoulderMat));
      }
    }

    // 4. Continuous Left and Right Curbstones along the curve
    for (const side of [1, -1]) {
      const cPos: number[] = [];
      const cIdx: number[] = [];
      let cVCount = 0;
      const curbThick = 0.45;

      for (let i = 0; i < N - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const n0 = normals[i];
        const n1 = normals[i + 1];
        const yTop0 = (p0.y !== undefined ? p0.y : baseElevY) + 0.16;
        const yTop1 = (p1.y !== undefined ? p1.y : baseElevY) + 0.16;

        const in0_x = p0.x + n0.x * (halfW * side);
        const in0_z = p0.z + n0.z * (halfW * side);
        const out0_x = p0.x + n0.x * (halfW * side + curbThick * side);
        const out0_z = p0.z + n0.z * (halfW * side + curbThick * side);

        const in1_x = p1.x + n1.x * (halfW * side);
        const in1_z = p1.z + n1.z * (halfW * side);
        const out1_x = p1.x + n1.x * (halfW * side + curbThick * side);
        const out1_z = p1.z + n1.z * (halfW * side + curbThick * side);

        cPos.push(in0_x, yTop0, in0_z);
        cPos.push(out0_x, yTop0, out0_z);
        cPos.push(in1_x, yTop1, in1_z);
        cPos.push(out1_x, yTop1, out1_z);

        cIdx.push(cVCount, cVCount + 1, cVCount + 2);
        cIdx.push(cVCount + 2, cVCount + 1, cVCount + 3);
        cVCount += 4;
      }

      if (cPos.length > 0) {
        const cGeo = new THREE.BufferGeometry();
        cGeo.setAttribute('position', new THREE.Float32BufferAttribute(cPos, 3));
        cGeo.setIndex(cIdx);
        cGeo.computeVertexNormals();
        roadGroup.add(new THREE.Mesh(trackGeo(cGeo), curbMat));
      }
    }

    grp.add(roadGroup);
  };

  // ═════════════════════════════════════════════════════════════════════════
  // 1. WINDING HIGHWAY ROUTE TOWARDS CHITTAGONG (Black Road Itself Curves Smoothly!)
  // (1) Straight highway from museum ends at x = -40, where the black road begins its curve
  // (2) Smooth Curve 1: Sweeps naturally from heading West to South-West (Mor 1, 20 smooth slices)
  // (3) Avenue: Head south-west through green trees and streetlamps (x = -84 to -94, z = 54 to 62)
  // (4) Smooth Curve 2: Sweeps naturally from South-West to West along z = 68 (Mor 2, 20 smooth slices)
  // (5) Grand Boulevard: Straight down city center flanked by Towers, Sweet Shop, Jewelry & Mega Mall
  // (6) Pre-Bridge Grand Signboard: "WELCOME TO CHITTAGONG" at x = -195.5, z = 68 (Facing traffic!)
  // (7) Bridge Approach Ramp & Karnaphuli Steel Truss Bridge over wide river
  // (8) Post-Bridge highway continuing past port warehouses into green rolling mountains (x: -242 to -320)
  // ═════════════════════════════════════════════════════════════════════════

  // Segment 1: Heading west from highway into turn approach (x = -40 to -50)
  createCurvedRoadMesh([
    { x: -40, z: 35 },
    { x: -45, z: 35 },
    { x: -50, z: 35 },
  ], 9.6);

  // Turn 1 (Mor 1): Smooth highway curve sweeping left towards south-west (x: -50 -> -84, z: 35 -> 54)
  const turn1Pts = sampleCubicBezier(
    [-50, 35],
    [-66, 35],
    [-78, 44],
    [-84, 54],
    20
  );
  createCurvedRoadMesh(turn1Pts, 9.6);

  // Segment 2: Scenic avenue heading south-west (x: -84 -> -94, z: 54 -> 62)
  createCurvedRoadMesh([
    { x: -84, z: 54 },
    { x: -89, z: 58 },
    { x: -94, z: 62 },
  ], 9.6);

  // Turn 2 (Mor 2): Smooth highway curve sweeping into the Grand City Boulevard at z = 68 (x: -94 -> -112)
  const turn2Pts = sampleCubicBezier(
    [-94, 62],
    [-100, 66.5],
    [-105, 68],
    [-112, 68],
    20
  );
  createCurvedRoadMesh(turn2Pts, 9.6);

  // Segment 3: Grand City Downtown Boulevard (z = 68, x: -112 to -195.5)
  createCurvedRoadMesh([
    { x: -112, z: 68 },
    { x: -132, z: 68 },
    { x: -152, z: 68 },
    { x: -174, z: 68 },
    { x: -195.5, z: 68 },
  ], 9.6);

  // Segment 4: Bridge Approach Ramp up to elevation y = 0.55m (x: -195.5 to -206)
  createCurvedRoadMesh([
    { x: -195.5, z: 68, y: 0.03 },
    { x: -201, z: 68, y: 0.28 },
    { x: -206, z: 68, y: 0.55 },
  ], 9.6);

  // Segment 5: Karnaphuli Bridge Deck across river (x: -206 to -234 at y = 0.55m)
  createCurvedRoadMesh([
    { x: -206, z: 68, y: 0.55 },
    { x: -220, z: 68, y: 0.55 },
    { x: -234, z: 68, y: 0.55 },
  ], 9.6);

  // Segment 6: Bridge Exit Ramp down to ground (x: -234 to -242)
  createCurvedRoadMesh([
    { x: -234, z: 68, y: 0.55 },
    { x: -238, z: 68, y: 0.28 },
    { x: -242, z: 68, y: 0.03 },
  ], 9.6);

  // Segment 7: Post-bridge highway through Port area ascending into Chittagong Hills (x: -242 to -370)
  createCurvedRoadMesh([
    { x: -242, z: 68 },
    { x: -275, z: 68 },
    { x: -310, z: 68 },
    { x: -340, z: 68 },
    { x: -370, z: 68 },
  ], 9.6);

  // Segment 8: Chittagong Zero Point Grand Roundabout 360-degree loop (Center at x = -395, z = 68, R = 21m)
  // Continuous circular 4-lane roadway with deep black asphalt and double yellow center lines
  const rbtSteps = 16;
  const rbtRadius = 21.0;
  const rbtPoints: Array<{ x: number; z: number }> = [];
  for (let i = 0; i <= rbtSteps; i++) {
    const th = (i / rbtSteps) * Math.PI * 2;
    rbtPoints.push({
      x: -395 + Math.cos(th) * rbtRadius,
      z: 68 + Math.sin(th) * rbtRadius,
    });
  }
  for (let i = 0; i < rbtSteps; i += 2) {
    createCurvedRoadMesh([
      rbtPoints[i],
      rbtPoints[i + 1],
      rbtPoints[(i + 2) % (rbtSteps + 1)],
    ], 10.2);
  }

  // Segment 9: Chittagong Scenic Mountain Loop & U-turn on Far West (x: -416 to -435)
  createCurvedRoadMesh([
    { x: -416, z: 68 },
    { x: -428, z: 64 },
    { x: -435, z: 76 },
    { x: -424, z: 88 },
    { x: -406, z: 86 },
  ], 9.2);

  // Segment 10: Chittagong Central Bus/Car Terminal Approach Lane (South from Roundabout)
  createCurvedRoadMesh([
    { x: -395, z: 89 },
    { x: -395, z: 104 },
  ], 11.0);

  // ═════════════════════════════════════════════════════════════════════════
  // 2. CITY STREETSCAPE (DOWNTOWN SHOPS & TOWERS ON BOTH SIDES OF BOULEVARD)
  // City boulevard runs along z = 68 (heading west x = -105 to -190)
  // SOUTH SIDE: z = 80..86 (facing north towards road -Z)
  // NORTH SIDE: z = 54..58 (facing south towards road +Z)
  // ═════════════════════════════════════════════════════════════════════════

  // --- [SOUTH SIDE SHOPS & TOWERS (z ~ 80 - 90)] ---

  // 1) মিষ্টির দোকান — BIKRAMPUR MISHTI GHAR (x = -118, z = 82)
  {
    const b = new THREE.Group();
    b.position.set(-118, 0, 82);
    // Main building body
    const body = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(11, 5.8, 8)), sweetPinkMat);
    body.position.y = 2.9;
    b.add(body);
    // Slanted striped awning facing road (north, -Z)
    const awning = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(11.5, 0.3, 3.2)), brightOrangeMat);
    awning.position.set(0, 3.8, -4.4);
    awning.rotation.x = -0.35;
    b.add(awning);
    // Glowing display showcase for sweets
    const windowGlass = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(9.4, 2.8, 0.2)), warmGlowMat);
    windowGlass.position.set(0, 1.8, -4.02);
    b.add(windowGlass);
    // Sweet display trays inside showcase
    for (let s = -3; s <= 3; s++) {
      const sweetTray = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.2, 0.16, 0.7)), jewelryGoldMat);
      sweetTray.position.set(s * 1.35, 1.4, -3.7);
      b.add(sweetTray);
    }
    // Signboard: "বিক্রমপুর মিষ্টি ভাণ্ডার"
    const signMat = makeSignBoard('বিক্রমপুর মিষ্টি ভাণ্ডার', 'AUTHENTIC SWEETS & ROSHOGOLLA', '#991b1b', '#fef08a', 600, 160);
    const sign = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(10.2, 1.4, 0.2)), signMat);
    sign.position.set(0, 4.8, -4.05);
    b.add(sign);
    grp.add(b);
  }

  // 2) জুয়েলারি শপ — AL-AMIN JEWELLERS & GOLD PALACE (x = -138, z = 82)
  {
    const b = new THREE.Group();
    b.position.set(-138, 0, 82);
    // Grand marble & cream facade
    const body = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(12, 7.2, 8.5)), creamWallMat);
    body.position.y = 3.6;
    b.add(body);
    // Royal Gold trim cornices
    const goldTop = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(12.6, 0.7, 9.0)), jewelryGoldMat);
    goldTop.position.y = 7.5;
    b.add(goldTop);
    // Golden ornate columns
    for (const px of [-5.0, -1.7, 1.7, 5.0]) {
      const col = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.3, 0.35, 6.6, 12)), jewelryGoldMat);
      col.position.set(px, 3.3, -4.3);
      b.add(col);
    }
    // Jewel display window
    const jewelWindow = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(10.2, 3.4, 0.2)), warmGlowMat);
    jewelWindow.position.set(0, 2.2, -4.28);
    b.add(jewelWindow);
    // Signboard: "সোনার বাংলা জুয়েলার্স"
    const goldSignMat = makeSignBoard('সোনার বাংলা জুয়েলার্স', '22K KADAM GOLD & DIAMONDS', '#854d0e', '#fef08a', 600, 160);
    const sign = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(10.8, 1.4, 0.2)), goldSignMat);
    sign.position.set(0, 5.8, -4.32);
    b.add(sign);
    grp.add(b);
  }

  // 3) আকাশচুম্বী সিটি টাওয়ার — CTG SKYLINE TOWER (x = -162, z = 86)
  {
    const b = new THREE.Group();
    b.position.set(-162, 0, 86);
    // Base podium
    const base = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(18, 6.0, 15)), concreteMat);
    base.position.y = 3.0;
    b.add(base);
    // Glass highrise tower
    const tower = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(13.5, 42, 12)), glassBlueMat);
    tower.position.y = 27.0;
    b.add(tower);
    // Architectural horizontal floors & solar louvers
    for (let f = 0; f < 11; f++) {
      const band = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(14.2, 0.45, 12.8)), darkMetalMat);
      band.position.y = 8.0 + f * 3.8;
      b.add(band);
    }
    // Spire
    const spire = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.12, 1.0, 12.0, 8)), darkMetalMat);
    spire.position.y = 54.0;
    b.add(spire);
    // Tower Signboard
    const towerSignMat = makeSignBoard('CTG SKYLINE TOWER', 'FINANCIAL & TECH HUB', '#0f172a', '#38bdf8', 600, 160);
    const sign = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(11.5, 1.6, 0.2)), towerSignMat);
    sign.position.set(0, 5.2, -7.6);
    b.add(sign);
    grp.add(b);
  }

  // --- [NORTH SIDE SHOPS, SHOPPING MALL & OFFICES (z ~ 50 - 56, facing south +Z)] ---

  // 4) গ্র্যান্ড শপিং মল — CHITTAGONG MEGA MALL (x = -124, z = 40)
  {
    const b = new THREE.Group();
    b.position.set(-124, 0, 40);
    // Massive 2-story mall facade
    const mainMall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(26, 10.5, 12)), mallBlueMat);
    mainMall.position.y = 5.25;
    b.add(mainMall);
    // Entrance Atrium canopy facing road (+Z)
    const atrium = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(14, 5.0, 2.5)), glassBlueMat);
    atrium.position.set(0, 2.5, 6.1);
    b.add(atrium);
    // Glowing ground storefronts
    const sf = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(23, 4.0, 0.2)), warmGlowMat);
    sf.position.set(0, 2.5, 6.08);
    b.add(sf);
    // Upper floor windows row
    for (let i = -4; i <= 4; i++) {
      const win = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.2, 3.0, 0.2)), warmGlowMat);
      win.position.set(i * 2.8, 7.8, 6.08);
      b.add(win);
    }
    // Roof billboard / Mega signboard
    const mallSignMat = makeSignBoard('CHITTAGONG MEGA MALL', 'FASHION · FOOD COURT · CINEPLEX', '#1e3a8a', '#fbbf24', 800, 180);
    const sign = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(18, 2.8, 0.3)), mallSignMat);
    sign.position.set(0, 11.2, 6.15);
    b.add(sign);
    grp.add(b);
  }

  // 5) ইলেকট্রনিক্স ও কাপড়ের মার্কেট (x = -148, z = 40)
  {
    const b = new THREE.Group();
    b.position.set(-148, 0, 40);
    const body = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(14, 7.5, 10)), terracottaMat);
    body.position.y = 3.75;
    b.add(body);
    // Glowing shop doors facing road (+Z)
    for (const sx of [-4.5, -1.5, 1.5, 4.5]) {
      const door = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.4, 3.2, 0.2)), warmGlowMat);
      door.position.set(sx, 2.0, 5.08);
      b.add(door);
    }
    // Signboard: "নিউ মার্কেট কমপ্লেক্স"
    const mktSign = makeSignBoard('নিউ মার্কেট কমপ্লেক্স', 'CLOTHING & ELECTRONICS', '#14532d', '#86efac', 600, 160);
    const s = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(12.0, 1.4, 0.2)), mktSign);
    s.position.set(0, 6.0, 5.12);
    b.add(s);
    grp.add(b);
  }

  // 6) কর্ণফুলী ব্যাংক ও কর্পোরেট ভবন (x = -170, z = 40)
  {
    const b = new THREE.Group();
    b.position.set(-170, 0, 40);
    const bank = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(15, 11.0, 10)), creamWallMat);
    bank.position.y = 5.5;
    b.add(bank);
    // Classical pillars
    for (const px of [-5.2, -1.7, 1.7, 5.2]) {
      const col = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.38, 0.42, 9.2, 10)), concreteMat);
      col.position.set(px, 4.6, 5.1);
      b.add(col);
    }
    const bankSign = makeSignBoard('কর্ণফুলী ব্যাংক লিমিটেড', 'PORT BRANCH · CTG', '#0c4a6e', '#38bdf8', 600, 160);
    const bs = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(12.5, 1.4, 0.2)), bankSign);
    bs.position.set(0, 9.8, 5.12);
    b.add(bs);
    grp.add(b);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 3. KARNAPHULI RIVER, LAUNCH TERMINAL & SCENIC TRUSS BRIDGE
  // Features requested by user:
  // (1) River water flows under bridge AND bends behind city buildings on both sides
  // (2) Behind southern buildings (z = 88 to 125, x = -110 to -210) hosts the Launch Terminal
  // (3) Moored large passenger launch (MV Karnaphuli), speedboats, terminal piers, waiting passengers
  // (4) STRICT VEHICLE BARRIER: vehicles cannot enter the Launch Terminal or river water
  // (5) GRAND SIGNBOARD BEFORE BRIDGE: "WELCOME TO CHITTAGONG" overhead gantry sign at x = -196
  // ═════════════════════════════════════════════════════════════════════════

  // --- [A. RIVER WATER EXTENSION (Under Bridge, Behind City & Flowing to Cox's Bazar Ocean)] ---
  // (1) Main river channel under the bridge (x = -220, z = 15 to 125)
  const riverMain = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(36, 110)), riverWaterMat);
  riverMain.rotation.x = -Math.PI / 2;
  riverMain.position.set(-220, 0.015, 70);
  grp.add(riverMain);

  // (2) Launch Terminal Basin behind South buildings (x = -110 to -208, z = 90 to 124)
  const riverLaunchBasin = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(100, 35)), riverWaterMat);
  riverLaunchBasin.rotation.x = -Math.PI / 2;
  riverLaunchBasin.position.set(-159, 0.014, 107.5);
  grp.add(riverLaunchBasin);

  // (3) Grand River Parkway behind the Gallery's Opposite Buildings (x = -110 to +130, z = 88 to 116)
  // Distance from opposite street buildings (z <= 62) is 26m! "GALLERYR SMNER BUILDING GULOR THEKE AREKTU DUR DYE"
  const riverCentral = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(242, 28)), riverWaterMat);
  riverCentral.rotation.x = -Math.PI / 2;
  riverCentral.position.set(10, 0.014, 102);
  grp.add(riverCentral);

  // (4) River Delta / Estuary merging directly into Cox's Bazar Ocean (x = 125 to 175, z = 75 to 120)
  // "COX ER PANIR SATHE MILITO HBE"
  const riverEstuary = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(54, 45)), riverWaterMat);
  riverEstuary.rotation.x = -Math.PI / 2;
  riverEstuary.position.set(152, 0.014, 97.5);
  grp.add(riverEstuary);

  // Scenic Coastal Wooden Footbridge across the river estuary before entering Cox's ocean (x = 128, z = 102)
  const footbridge = new THREE.Group();
  footbridge.position.set(128, 0, 102);
  const fbDeck = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.6, 0.35, 30)), woodDeckMat);
  fbDeck.position.y = 0.55;
  footbridge.add(fbDeck);
  for (const fbx of [-1.7, 1.7]) {
    for (let fbz = -14; fbz <= 14; fbz += 3.5) {
      const post = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 6)), darkMetalMat);
      post.position.set(fbx, 1.1, fbz);
      footbridge.add(post);
    }
  }
  grp.add(footbridge);

  // (5) River stone embankment wall along northern riverbank (z = 88, x = -110 to +128)
  const northRiverWall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(238, 0.9, 1.4)), concreteMat);
  northRiverWall.position.set(9, 0.45, 88.0);
  grp.add(northRiverWall);

  // (6) River water curving behind North buildings in CTG (x = -115 to -206, z = 16 to 44)
  const riverNorthBasin = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(92, 28)), riverWaterMat);
  riverNorthBasin.rotation.x = -Math.PI / 2;
  riverNorthBasin.position.set(-160, 0.014, 30);
  grp.add(riverNorthBasin);

  // River stone embankment walls around the road corridor
  for (const bx of [-236.5, -203.5]) {
    // North embankment segment
    const wallN = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.6, 1.0, 20)), concreteMat);
    wallN.position.set(bx, 0.5, 52);
    grp.add(wallN);
    // South embankment segment
    const wallS = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.6, 1.0, 16)), concreteMat);
    wallS.position.set(bx, 0.5, 78);
    grp.add(wallS);
  }

  // --- [B. GRAND OVERHEAD HIGHWAY SIGNBOARD BEFORE BRIDGE ("WELCOME TO CHITTAGONG")] ---
  // Positioned at x = -195.5, z = 68 spanning over the 9.6m road with 4.5m vertical clearance
  // FRONT FACE POINTS DIRECTLY TO +X (EAST), FACING APPROACHING DRIVERS HEADING TO CHITTAGONG!
  {
    const gantry = new THREE.Group();
    gantry.position.set(-195.5, 0, 68);

    // Two heavy structural steel lattice columns on north and south sides of the road
    for (const cz of [-6.8, 6.8]) {
      // Concrete impact footing
      const footing = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.4, 0.9, 1.4)), concreteMat);
      footing.position.set(0, 0.45, cz);
      gantry.add(footing);

      // Steel vertical column
      const col = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.7, 7.8, 0.7)), darkMetalMat);
      col.position.set(0, 4.35, cz);
      gantry.add(col);

      // Warning hazard stripes on lower column
      const stripe = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.74, 1.4, 0.74)), hazardYellowMat);
      stripe.position.set(0, 1.6, cz);
      gantry.add(stripe);
    }

    // Overhead horizontal steel truss beam spanning across the road (z: -7.4 to +7.4)
    const topTruss = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.8, 0.8, 14.8)), darkMetalMat);
    topTruss.position.set(0, 7.6, 0);
    gantry.add(topTruss);

    // Signboard Body Box spanning across the road (thickness 0.38m along X, height 2.9m along Y, width 13.2m along Z)
    const signBox = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.38, 2.9, 13.2)),
      darkMetalMat
    );
    signBox.position.set(0, 6.0, 0);
    gantry.add(signBox);

    // FRONT FACE: Directly facing EAST (+X), so oncoming drivers heading to Chittagong see it in front!
    // In Three.js, rotating PlaneGeometry by +Math.PI / 2 rotates its normal (0, 0, 1) into (1, 0, 0) (+X)!
    const signTexMat = makeSignBoard(
      'WELCOME TO CHITTAGONG',
      'স্বাগতম · বন্দর নগরী চট্টগ্রাম · কর্ণফুলী সেতু · GATEWAY TO CTG',
      '#065f46',
      '#fef08a',
      1024,
      220
    );
    const frontPlaneGeo = trackGeo(new THREE.PlaneGeometry(13.0, 2.7));
    const frontFace = new THREE.Mesh(frontPlaneGeo, signTexMat);
    frontFace.position.set(0.2, 6.0, 0);
    frontFace.rotation.y = Math.PI / 2; // Normal points to +X (East, facing oncoming drivers)!
    gantry.add(frontFace);

    // BACK FACE: Facing WEST (-X), for drivers heading back towards Dhaka
    const backSignTexMat = makeSignBoard(
      'WELCOME TO DHAKA',
      'রাজধানী ঢাকায় স্বাগতম · শুভ যাত্রা · DRIVE SAFELY',
      '#1e3a8a',
      '#fef08a',
      1024,
      220
    );
    const backFace = new THREE.Mesh(frontPlaneGeo, backSignTexMat);
    backFace.position.set(-0.2, 6.0, 0);
    backFace.rotation.y = -Math.PI / 2; // Normal points to -X
    gantry.add(backFace);

    // 4 Overhead floodlight fixtures pointing down onto the front face
    for (const fz of [-4.5, -1.5, 1.5, 4.5]) {
      const floodArm = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.2, 0.12, 0.12)), darkMetalMat);
      floodArm.position.set(0.6, 7.4, fz);
      gantry.add(floodArm);

      const floodFixture = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.35, 0.2, 0.35)), darkMetalMat);
      floodFixture.position.set(1.1, 7.3, fz);
      gantry.add(floodFixture);

      const floodBulb = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.12, 8, 6)), warmGlowMat);
      floodBulb.position.set(1.1, 7.15, fz);
      gantry.add(floodBulb);
    }

    grp.add(gantry);
  }

  // --- [C. GRAND STEEL TRUSS BRIDGE ACROSS KARNAPHULI RIVER] ---
  {
    const bridgeGroup = new THREE.Group();
    bridgeGroup.position.set(-220, 0, 68);

    // Bridge deck platform
    const deck = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(29, 0.85, 10.6)), concreteMat);
    deck.position.y = 0.55;
    bridgeGroup.add(deck);

    // River stone pillars underneath holding the bridge deck
    for (const px of [-8.5, 8.5]) {
      for (const pz of [-3.8, 3.8]) {
        const pillar = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.4, 1.6, 5.5, 12)), concreteMat);
        pillar.position.set(px, -0.6, pz);
        bridgeGroup.add(pillar);
      }
    }

    // Steel truss girders on both sides of the bridge (North and South sides)
    for (const sideZ of [-5.5, 5.5]) {
      // Bottom chord
      const botChord = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(29, 0.4, 0.4)), bridgeTrussMat);
      botChord.position.set(0, 1.2, sideZ);
      bridgeGroup.add(botChord);

      // Top chord
      const topChord = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(23, 0.4, 0.4)), bridgeTrussMat);
      topChord.position.set(0, 5.2, sideZ);
      bridgeGroup.add(topChord);

      // Diagonal and vertical steel truss beams
      for (let tx = -11.0; tx <= 11.0; tx += 2.75) {
        const vert = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.14, 0.14, 4.0, 8)), bridgeTrussMat);
        vert.position.set(tx, 3.2, sideZ);
        bridgeGroup.add(vert);
      }
      for (let tx = -9.6; tx <= 9.6; tx += 2.75) {
        const diag = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.12, 0.12, 4.8, 8)), bridgeTrussMat);
        diag.position.set(tx, 3.2, sideZ);
        diag.rotation.z = Math.PI / 4;
        bridgeGroup.add(diag);
      }

      // Decorative overhead bridge entrance portal arch
      for (const ex of [-14.0, 14.0]) {
        const portalCol = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.6, 5.8, 0.6)), bridgeTrussMat);
        portalCol.position.set(ex, 2.9, sideZ);
        bridgeGroup.add(portalCol);
      }
    }

    // Overhead cross-bracing beams spanning across bridge
    for (const ox of [-11.0, -5.5, 0, 5.5, 11.0]) {
      const crossBeam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.35, 0.35, 11.4)), bridgeTrussMat);
      crossBeam.position.set(ox, 5.3, 0);
      bridgeGroup.add(crossBeam);
    }

    // Bridge Name plaque
    const bridgeSignMat = makeSignBoard('কর্ণফুলী সেতু', 'KARNAPHULI BRIDGE · CHITTAGONG', '#047857', '#ffffff', 600, 140);
    const bSign = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.2, 1.4, 6.0)), bridgeSignMat);
    bSign.position.set(14.2, 4.2, 0);
    bSign.rotation.y = Math.PI / 2;
    bridgeGroup.add(bSign);

    grp.add(bridgeGroup);
  }

  // --- [D. KARNAPHULI LAUNCH TERMINAL (লঞ্চ ও স্পিডবোট টার্মিনাল · সদরঘাট ঘাট)] ---
  {
    const terminal = new THREE.Group();

    // 1. Quayside retaining wall along the riverbank (z = 89.2, x = -112 to -207)
    const quayWall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(96, 1.2, 1.4)), concreteMat);
    quayWall.position.set(-159, 0.5, 89.2);
    terminal.add(quayWall);

    // Concrete quayside promenade for pedestrians (z: 86 to 89, x: -112 to -207)
    const promenade = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(96, 3.2)), concreteMat);
    promenade.rotation.x = -Math.PI / 2;
    promenade.position.set(-159, 0.25, 87.5);
    terminal.add(promenade);

    // Pedestrian Walkway connecting city boulevard (z = 74) to Terminal Promenade (z = 86) at x = -148
    const walkway = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(7.5, 13.5)), concreteMat);
    walkway.rotation.x = -Math.PI / 2;
    walkway.position.set(-148, 0.04, 80.0);
    terminal.add(walkway);

    // STRICT VEHICLE BARRIER: Concrete bollards & barrier across pedestrian entrance (z = 75.5)
    // Completely physically and visually prevents vehicles from driving onto the terminal!
    for (let bx = -151.2; bx <= -144.8; bx += 1.6) {
      const bollard = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.22, 0.25, 0.95, 10)), hazardYellowMat);
      bollard.position.set(bx, 0.48, 75.5);
      terminal.add(bollard);
      const cap = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.22, 8, 6)), darkMetalMat);
      cap.position.set(bx, 0.95, 75.5);
      terminal.add(cap);
    }
    // High-visibility Warning Sign: "NO VEHICLES ALLOWED - PEDESTRIANS & PASSENGERS ONLY"
    const barrierSignMat = makeSignBoard(
      '🛑 যানবাহন প্রবেশ সম্পূর্ণ নিষেধ',
      'শুধুমাত্র লঞ্চ যাত্রী ও পথচারীদের জন্য · NO VEHICLES ALLOWED',
      '#991b1b',
      '#fef08a',
      700,
      160
    );
    const bSign = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.2, 1.2, 0.15)), barrierSignMat);
    bSign.position.set(-148, 2.1, 75.5);
    terminal.add(bSign);
    for (const px of [-151.0, -145.0]) {
      const pole = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 8)), darkMetalMat);
      pole.position.set(px, 1.1, 75.5);
      terminal.add(pole);
    }

    // 2. WALK-THROUGH PASSENGER TERMINAL & TICKET COUNTER BUILDING (x = -148, z = 85.5)
    // Walkable indoor lobby allowing players to enter from city street (z = 81.5),
    // walk through between counters & turnstiles, and exit out the south portal (z = 89.5)
    // directly onto the quayside speedboat pier!
    const tbGroup = new THREE.Group();
    tbGroup.position.set(-148, 0, 85.5);

    // Marble floor tile
    const tbFloor = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(9.6, 8.4)), concreteMat);
    tbFloor.rotation.x = -Math.PI / 2;
    tbFloor.position.y = 0.05;
    tbGroup.add(tbFloor);

    // Left (West) exterior wall
    const tbWallW = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.35, 3.8, 8.4)), creamWallMat);
    tbWallW.position.set(-4.65, 1.9, 0);
    tbGroup.add(tbWallW);

    // Right (East) exterior wall
    const tbWallE = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.35, 3.8, 8.4)), creamWallMat);
    tbWallE.position.set(4.65, 1.9, 0);
    tbGroup.add(tbWallE);

    // North (Street) facade flanks (central 3.4m doorway is completely OPEN and walkable!)
    const tbNorthLeft = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.0, 3.8, 0.35)), creamWallMat);
    tbNorthLeft.position.set(-3.2, 1.9, -4.1);
    tbGroup.add(tbNorthLeft);
    const tbNorthRight = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.0, 3.8, 0.35)), creamWallMat);
    tbNorthRight.position.set(3.2, 1.9, -4.1);
    tbGroup.add(tbNorthRight);
    // North lintel above open entrance portal
    const tbNorthLintel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.6, 0.8, 0.4)), creamWallMat);
    tbNorthLintel.position.set(0, 3.4, -4.1);
    tbGroup.add(tbNorthLintel);

    // South (Dock) facade flanks (central 3.4m doorway is completely OPEN to quayside and speedboat!)
    const tbSouthLeft = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.0, 3.8, 0.35)), creamWallMat);
    tbSouthLeft.position.set(-3.2, 1.9, 4.1);
    tbGroup.add(tbSouthLeft);
    const tbSouthRight = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.0, 3.8, 0.35)), creamWallMat);
    tbSouthRight.position.set(3.2, 1.9, 4.1);
    tbGroup.add(tbSouthRight);
    // South lintel above exit portal
    const tbSouthLintel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.6, 0.8, 0.4)), creamWallMat);
    tbSouthLintel.position.set(0, 3.4, 4.1);
    tbGroup.add(tbSouthLintel);

    // Terminal Roof Canopy
    const tbRoof = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(10.2, 0.4, 9.2)), mallBlueMat);
    tbRoof.position.set(0, 3.9, 0);
    tbGroup.add(tbRoof);

    // Interior Ticket Counter Desks on the West side
    const deskW = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.2, 1.1, 4.5)), woodDeckMat);
    deskW.position.set(-3.8, 0.55, 0);
    tbGroup.add(deskW);
    // Glass barrier on counter
    const glassW = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.08, 0.8, 4.3)), glassBlueMat);
    glassW.position.set(-3.2, 1.5, 0);
    tbGroup.add(glassW);

    // Interior Waiting Benches on the East side
    const benchE = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.2, 0.45, 4.5)), woodDeckMat);
    benchE.position.set(3.8, 0.25, 0);
    tbGroup.add(benchE);

    // LED Departure Board hanging from ceiling in corridor
    const depBoardMat = makeSignBoard(
      'স্পিডবোট ও লঞ্চ ছাড়ার সময়সূচী',
      'কক্সবাজার (স্পিডবোট) · বরিশাল · চাঁদপুর · প্রতি ১০ মিনিট পর পর',
      '#0f172a',
      '#38bdf8',
      700,
      160
    );
    const depBoard = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.8, 0.9, 0.15)), depBoardMat);
    depBoard.position.set(0, 3.0, 0);
    tbGroup.add(depBoard);

    // North Signboard: "লঞ্চ ও স্পিডবোট টিকিট কাউন্টার ও প্যাসেঞ্জার টার্মিনাল"
    const tbSignMat = makeSignBoard(
      'লঞ্চ ও স্পিডবোট টিকিট কাউন্টার ও টার্মিনাল',
      'ঢাকা · বরিশাল · চাঁদপুর · কক্সবাজার এক্সপ্রেস',
      '#1e3a8a',
      '#fef08a',
      750,
      160
    );
    const tbSign = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(7.2, 1.2, 0.2)), tbSignMat);
    tbSign.position.set(0, 3.3, -4.3);
    tbGroup.add(tbSign);

    // South Signboard: "ঘাটের পথ · TO SPEEDBOAT & LAUNCH JETTY ➜"
    const tbSouthSignMat = makeSignBoard(
      'ঘাটে প্রবেশের পথ ➜',
      'TO SPEEDBOAT & LAUNCH JETTY · সরাসরি ঘাটে যান',
      '#065f46',
      '#fef08a',
      650,
      150
    );
    const tbSouthSign = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.4, 1.1, 0.2)), tbSouthSignMat);
    tbSouthSign.position.set(0, 3.3, 4.3);
    tbGroup.add(tbSouthSign);

    terminal.add(tbGroup);

    // 3. Passenger Waiting Pavilion (ছাউনি) at x = -163, z = 86.5
    const shedRoof = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(13.5, 0.3, 4.8)), terracottaMat);
    shedRoof.position.set(-163, 3.4, 86.5);
    terminal.add(shedRoof);
    for (const sx of [-168.5, -163, -157.5]) {
      for (const sz of [84.5, 88.5]) {
        const pillar = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.12, 0.14, 3.3, 8)), darkMetalMat);
        pillar.position.set(sx, 1.65, sz);
        terminal.add(pillar);
      }
    }
    // Wooden waiting benches inside shed
    for (const bx of [-166, -163, -160]) {
      const bench = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.4, 0.45, 0.65)), woodDeckMat);
      bench.position.set(bx, 0.45, 86.5);
      terminal.add(bench);
    }

    // 4. Jetties / Boarding Piers extending into the river water
    // Pier 1 (Main Passenger Launch Jetty): x = -172, z: 89 to 114 (Length 25m, Width 4.5m)
    const pier1 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.5, 0.4, 25)), woodDeckMat);
    pier1.position.set(-172, 0.25, 101.5);
    terminal.add(pier1);
    // Pier 1 timber support piles underneath
    for (let pz = 92; pz <= 112; pz += 4.0) {
      for (const px of [-173.8, -170.2]) {
        const pile = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.18, 0.22, 2.8, 8)), concreteMat);
        pile.position.set(px, -0.6, pz);
        terminal.add(pile);
      }
    }
    // Pier 1 Safety handrails
    for (let pz = 91; pz <= 113; pz += 3.2) {
      for (const sideX of [-174.2, -169.8]) {
        const post = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 6)), darkMetalMat);
        post.position.set(sideX, 0.85, pz);
        terminal.add(post);
      }
    }
    // Mooring bollards & Orange Lifebuoys on Pier 1
    for (const pz of [95, 102, 109]) {
      const bollard = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.14, 0.16, 0.45, 8)), darkMetalMat);
      bollard.position.set(-169.8, 0.6, pz);
      terminal.add(bollard);

      const buoy = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.24, 0.07, 8, 16)), lifebuoyOrangeMat);
      buoy.position.set(-174.2, 0.9, pz);
      terminal.add(buoy);
    }

    // Pier 2 (Secondary Cargo & Coastal Jetty): x = -196, z: 89 to 112 (Length 23m, Width 4.0m)
    const pier2 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.0, 0.4, 23)), woodDeckMat);
    pier2.position.set(-196, 0.25, 100.5);
    terminal.add(pier2);

    // Pier 3 (Speedboat Floating Pontoon Slips): x = -136, z: 89 to 108 (Length 19m, Width 3.5m)
    const pier3 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.5, 0.35, 19)), woodDeckMat);
    pier3.position.set(-136, 0.2, 98.5);
    terminal.add(pier3);

    // 5. MOORED VESSELS IN THE RIVER WATER

    // Vessel 1: "MV KARNAPHULI" (এম ভি কর্ণফুলী এক্সপ্রেস) — Majestic Double-Decker Passenger Launch
    // Positioned alongside Pier 1 at x = -166, z = 103 (Length 27m, Width 7.2m)
    {
      const launch = new THREE.Group();
      launch.position.set(-166, 0, 103);

      // Lower Hull (Dark navy keel + bold red waterline band + white topsides)
      const keel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.6, 0.8, 26)), boatNavyMat);
      keel.position.y = -0.15;
      launch.add(keel);

      const waterline = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.8, 0.35, 26.4)), boatRedMat);
      waterline.position.y = 0.35;
      launch.add(waterline);

      const hullUpper = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(7.0, 1.4, 27)), boatWhiteMat);
      hullUpper.position.y = 1.15;
      launch.add(hullUpper);

      // Pointed clipper bow cone at north (+Z or -Z depending on heading; heading south +Z)
      const bow = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(3.5, 5.0, 8)), boatWhiteMat);
      bow.rotation.x = Math.PI / 2;
      bow.position.set(0, 1.1, 14.8);
      launch.add(bow);

      // Deck 1: Main Passenger Saloon with glowing window rows
      const saloon = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.4, 2.2, 22)), boatWhiteMat);
      saloon.position.y = 2.8;
      launch.add(saloon);
      // Saloon windows
      for (const sideX of [-3.22, 3.22]) {
        for (let wz = -8.5; wz <= 8.5; wz += 2.2) {
          const win = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.12, 0.9, 1.3)), warmGlowMat);
          win.position.set(sideX, 2.85, wz);
          launch.add(win);
        }
      }

      // Deck 2: Upper VIP Passenger Promenade Deck
      const upperDeckFloor = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.8, 0.25, 23)), boatWhiteMat);
      upperDeckFloor.position.y = 3.95;
      launch.add(upperDeckFloor);

      const upperCabin = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5.4, 1.9, 16)), boatWhiteMat);
      upperCabin.position.y = 4.95;
      launch.add(upperCabin);
      // Upper deck windows
      for (const sideX of [-2.72, 2.72]) {
        for (let wz = -6; wz <= 6; wz += 2.4) {
          const win = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.12, 0.8, 1.2)), warmGlowMat);
          win.position.set(sideX, 5.0, wz);
          launch.add(win);
        }
      }

      // Deck 3: Captain's Wheelhouse & Bridge (Forward at z = 6.5)
      const wheelhouse = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.8, 1.6, 3.8)), creamWallMat);
      wheelhouse.position.set(0, 6.75, 6.5);
      launch.add(wheelhouse);
      const bridgeWindow = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.4, 0.8, 0.15)), glassBlueMat);
      bridgeWindow.position.set(0, 6.8, 8.42);
      launch.add(bridgeWindow);

      // Marine Smokestack / Funnel (Red with black top cap)
      const funnel = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.7, 0.85, 2.4, 10)), boatRedMat);
      funnel.position.set(0, 6.9, -1.8);
      launch.add(funnel);
      const funnelCap = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.78, 0.78, 0.4, 10)), darkMetalMat);
      funnelCap.position.set(0, 8.1, -1.8);
      launch.add(funnelCap);

      // Radar scanner mast on wheelhouse roof
      const mast = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.08, 0.1, 2.8, 8)), darkMetalMat);
      mast.position.set(0, 8.8, 6.5);
      launch.add(mast);
      const radar = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.6, 0.16, 0.3)), boatWhiteMat);
      radar.position.set(0, 9.8, 6.5);
      launch.add(radar);

      // Stern Flagpole flying Bangladeshi National Flag
      const flagPole = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.04, 0.05, 3.2, 6)), darkMetalMat);
      flagPole.position.set(0, 5.2, -12.5);
      launch.add(flagPole);
      // Green field with red circle flag
      const flagGreen = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.04, 0.9, 1.5)), boatGreenMat);
      flagGreen.position.set(0.02, 5.8, -13.2);
      launch.add(flagGreen);
      const flagRedCircle = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 12)), boatRedMat);
      flagRedCircle.rotation.z = Math.PI / 2;
      flagRedCircle.position.set(0.02, 5.8, -13.2);
      launch.add(flagRedCircle);

      // Passenger Boarding Gangway connecting Pier 1 (-172) to Launch (-166) at z = 97
      const gangway = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.0, 0.2, 1.8)), woodDeckMat);
      gangway.position.set(-3.2, 2.0, -6.0);
      launch.add(gangway);
      // Gangway railings
      for (const gz of [-6.8, -5.2]) {
        const rail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.0, 0.08, 0.08)), darkMetalMat);
        rail.position.set(-3.2, 2.6, gz);
        launch.add(rail);
      }

      // Name signboard on launch superstructure: "MV KARNAPHULI"
      const launchSignMat = makeSignBoard('এম ভি কর্ণফুলী', 'MV KARNAPHULI EXPRESS', '#0f172a', '#facc15', 500, 140);
      const lSign = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.12, 0.8, 5.2)), launchSignMat);
      lSign.position.set(-3.25, 4.0, 1.0);
      launch.add(lSign);

      terminal.add(launch);
    }

    // Vessel 2: "MV SURMA" (এম ভি সুরমা) — Coastal Cargo & Passenger Vessel
    // Alongside Pier 2 at x = -191, z = 102
    {
      const launch2 = new THREE.Group();
      launch2.position.set(-191, 0, 102);

      const hull2 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5.8, 1.8, 22)), boatGreenMat);
      hull2.position.y = 0.9;
      launch2.add(hull2);

      const bow2 = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(2.9, 4.0, 8)), boatGreenMat);
      bow2.rotation.x = Math.PI / 2;
      bow2.position.set(0, 0.9, 12.0);
      launch2.add(bow2);

      const cabin2 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5.0, 2.0, 13)), boatWhiteMat);
      cabin2.position.y = 2.6;
      launch2.add(cabin2);

      const funnel2 = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.5, 0.6, 1.8, 8)), boatNavyMat);
      funnel2.position.set(0, 4.2, -2.5);
      launch2.add(funnel2);

      terminal.add(launch2);
    }

    // 6. MODERN FAST SPEEDBOATS MOORED AT PIER 3 PONTOONS

    // Speedboat 1 (White & Blue Sports Speedboat) at x = -132, z = 97
    {
      const sb1 = new THREE.Group();
      sb1.position.set(-132, 0, 97);

      // V-Hull fiberglass body
      const sbHull = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.3, 0.75, 6.8)), boatWhiteMat);
      sbHull.position.y = 0.38;
      sb1.add(sbHull);

      // Sharp pointed bow
      const sbBow = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(1.15, 2.2, 6)), boatWhiteMat);
      sbBow.rotation.x = Math.PI / 2;
      sbBow.position.set(0, 0.38, 4.2);
      sb1.add(sbBow);

      // Blue racing stripe on gunwale
      const sbStripe = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.35, 0.16, 7.0)), clothBlueMat);
      sbStripe.position.y = 0.65;
      sb1.add(sbStripe);

      // Curved tinted aerodynamic windshield
      const sbWindshield = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.0, 0.55, 0.15)), glassBlueMat);
      sbWindshield.position.set(0, 0.95, 1.4);
      sbWindshield.rotation.x = -0.3;
      sb1.add(sbWindshield);

      // Passenger bucket seats (Red leather)
      for (const sz of [0.4, -1.0, -2.2]) {
        for (const sx of [-0.65, 0.65]) {
          const seat = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.52, 0.45, 0.48)), boatRedMat);
          seat.position.set(sx, 0.65, sz);
          sb1.add(seat);
        }
      }

      // Twin Yamaha outboard engines at transom
      for (const ox of [-0.6, 0.6]) {
        const engine = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.35, 0.85, 0.5)), darkMetalMat);
        engine.position.set(ox, 0.55, -3.7);
        sb1.add(engine);
        const prop = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 6)), hazardYellowMat);
        prop.rotation.x = Math.PI / 2;
        prop.position.set(ox, 0.2, -3.98);
        sb1.add(prop);
      }

      terminal.add(sb1);
    }

    // Speedboat 2 (Yellow & Black Sport Speedboat) at x = -132, z = 104
    {
      const sb2 = new THREE.Group();
      sb2.position.set(-132, 0, 104);

      const sbHull2 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.2, 0.7, 6.2)), hazardYellowMat);
      sbHull2.position.y = 0.38;
      sb2.add(sbHull2);

      const sbBow2 = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(1.1, 2.0, 6)), hazardYellowMat);
      sbBow2.rotation.x = Math.PI / 2;
      sbBow2.position.set(0, 0.38, 3.8);
      sb2.add(sbBow2);

      const sbWindshield2 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.8, 0.5, 0.12)), glassBlueMat);
      sbWindshield2.position.set(0, 0.9, 1.2);
      sbWindshield2.rotation.x = -0.3;
      sb2.add(sbWindshield2);

      const engine2 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.4, 0.8, 0.5)), darkMetalMat);
      engine2.position.set(0, 0.55, -3.4);
      sb2.add(engine2);

      terminal.add(sb2);
    }

    // Speedboat 3 (Cyan & White Speedboat) at x = -140, z = 103
    {
      const sb3 = new THREE.Group();
      sb3.position.set(-140, 0, 103);

      const sbHull3 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.2, 0.7, 6.0)), glassBlueMat);
      sbHull3.position.y = 0.38;
      sb3.add(sbHull3);

      const engine3 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.4, 0.8, 0.5)), darkMetalMat);
      engine3.position.set(0, 0.55, -3.3);
      sb3.add(engine3);

      terminal.add(sb3);
    }

    // 7. PASSENGERS & CREW (মানুষ ও যাত্রী)
    // Stylized human figures walking on pier, waiting on benches, launch captain & boatman
    const addHumanFigure = (
      px: number,
      py: number,
      pz: number,
      shirt: THREE.Material,
      pants: THREE.Material,
      yaw = 0,
      sitting = false
    ) => {
      const fig = new THREE.Group();
      fig.position.set(px, py, pz);
      fig.rotation.y = yaw;

      if (sitting) {
        const torso = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.38, 0.48, 0.22)), shirt);
        torso.position.y = 0.65;
        fig.add(torso);
        const head = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.13, 8, 8)), skinMat);
        head.position.y = 1.05;
        fig.add(head);
        const thighs = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.34, 0.16, 0.36)), pants);
        thighs.position.set(0, 0.42, 0.16);
        fig.add(thighs);
        const shins = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.32, 0.38, 0.16)), pants);
        shins.position.set(0, 0.2, 0.32);
        fig.add(shins);
      } else {
        const torso = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.38, 0.54, 0.22)), shirt);
        torso.position.y = 0.98;
        fig.add(torso);
        const head = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.13, 8, 8)), skinMat);
        head.position.y = 1.38;
        fig.add(head);
        const legs = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.34, 0.68, 0.2)), pants);
        legs.position.y = 0.34;
        fig.add(legs);
      }
      terminal.add(fig);
    };

    // Passenger with rolling suitcase walking along Pier 1 toward launch gangway
    addHumanFigure(-171.5, 0.45, 95.0, clothBlueMat, darkMetalMat, Math.PI);
    const suitcase = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.32, 0.48, 0.24)), boatRedMat);
    suitcase.position.set(-171.0, 0.68, 95.2);
    terminal.add(suitcase);

    // Second passenger walking onto Pier 1
    addHumanFigure(-172.5, 0.45, 99.0, brightOrangeMat, darkMetalMat, Math.PI);

    // Ship Captain in white maritime uniform near the launch gangway
    addHumanFigure(-170.0, 0.45, 97.0, clothWhiteMat, clothWhiteMat, -Math.PI / 2);
    const capHat = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 8)), clothWhiteMat);
    capHat.position.set(-170.0, 1.9, 97.0);
    terminal.add(capHat);

    // Speedboat Pilot in orange life jacket on Pier 3 pontoon
    addHumanFigure(-135.5, 0.38, 97.0, lifebuoyOrangeMat, darkMetalMat, Math.PI / 2);

    // Passengers sitting on waiting shed benches
    addHumanFigure(-166.0, 0.25, 86.4, clothWhiteMat, clothBlueMat, 0, true);
    addHumanFigure(-163.0, 0.25, 86.4, sweetPinkMat, darkMetalMat, 0, true);

    // Passengers standing near ticket counter
    addHumanFigure(-146.5, 0.25, 83.0, clothBlueMat, concreteMat, -Math.PI * 0.7);
    addHumanFigure(-149.5, 0.25, 83.2, brightOrangeMat, darkMetalMat, -Math.PI * 0.3);

    grp.add(terminal);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 4. POST-BRIDGE BUILDINGS & CHITTAGONG HILLS (পাহাড় ও বন্দর এলাকা)
  // Plenty of room between bridge (x = -220) and hills (x = -280 to -340)!
  // ═════════════════════════════════════════════════════════════════════════

  // ═════════════════════════════════════════════════════════════════════════
  // 4. CHITTAGONG GRAND HILL MARKET & SHOPPING COMPLEX (চট্টগ্রাম গ্র্যান্ড মার্কেট)
  // 2-Storey walkable shopping complex across the bridge amidst the green hills (x: -251 to -278, z: 75 to 96)
  // Ground floor: Hijab, Borkha, Shoes & Watch shops + Grand Staircase & Glass Lift
  // 2nd floor: T-Shirt & Jeans Pant shops + Hill view balcony lounge
  // ═════════════════════════════════════════════════════════════════════════
  {
    const market = new THREE.Group();
    market.position.set(-264.5, 0, 85.5);

    // 1. FLOOR 1: GROUND LEVEL (১ম তলা)
    const f1Floor = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(27, 21)), concreteMat);
    f1Floor.rotation.x = -Math.PI / 2;
    f1Floor.position.y = 0.05;
    market.add(f1Floor);

    // Decorative polished marble floor inlay
    const f1Inlay = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(25, 19)), creamWallMat);
    f1Inlay.rotation.x = -Math.PI / 2;
    f1Inlay.position.y = 0.06;
    market.add(f1Inlay);

    // 2. EXTERIOR WALLS (Width 27m along X, Depth 21m along Z, Height 9.2m)
    // East Wall (x = 13.5, local)
    const wallE = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.4, 9.2, 21)), concreteMat);
    wallE.position.set(13.5, 4.6, 0);
    market.add(wallE);

    // West Wall (x = -13.5, local)
    const wallW = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.4, 9.2, 21)), concreteMat);
    wallW.position.set(-13.5, 4.6, 0);
    market.add(wallW);

    // South Wall (z = 10.5, local - towards hills)
    const wallS = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(27.4, 9.2, 0.4)), concreteMat);
    wallS.position.set(0, 4.6, 10.5);
    market.add(wallS);

    // Scenic viewing glass windows on south wall for the 2nd floor balcony
    const southGlass = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(16, 3.2, 0.2)), glassBlueMat);
    southGlass.position.set(0, 6.2, 10.4);
    market.add(southGlass);

    // North Facade (z = -10.5, local - facing highway road)
    // Left & Right entrance flanks with display show windows
    const northFlankL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(9.5, 9.2, 0.4)), creamWallMat);
    northFlankL.position.set(-8.75, 4.6, -10.5);
    market.add(northFlankL);

    const northFlankR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(9.5, 9.2, 0.4)), creamWallMat);
    northFlankR.position.set(8.75, 4.6, -10.5);
    market.add(northFlankR);

    // Large glass storefront display windows on facade flanks
    for (const fx of [-8.75, 8.75]) {
      const win1 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(7.2, 2.8, 0.2)), warmGlowMat);
      win1.position.set(fx, 2.0, -10.65);
      market.add(win1);

      const win2 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(7.2, 2.8, 0.2)), warmGlowMat);
      win2.position.set(fx, 6.2, -10.65);
      market.add(win2);
    }

    // Overhead lintel above central entrance (leaving 8.0m wide open entrance portal!)
    const northLintel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(8.4, 3.2, 0.8)), creamWallMat);
    northLintel.position.set(0, 7.6, -10.5);
    market.add(northLintel);

    // Grand Entrance Arch Columns
    for (const cx of [-4.2, 4.2]) {
      const col = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.45, 0.55, 6.2, 12)), jewelryGoldMat);
      col.position.set(cx, 3.1, -10.6);
      market.add(col);
    }

    // Grand Market Roof Billboard & Signboard facing the road
    const marketSignMat = makeSignBoard(
      'চট্টগ্রাম হিল ভিউ গ্র্যান্ড মার্কেট',
      'CHITTAGONG GRAND MARKET · ২য় তলা বিশিষ্ট আধুনিক বাজার · FASHION MALL',
      '#1e3a8a',
      '#facc15',
      900,
      200
    );
    const mSign = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(16, 2.6, 0.3)), marketSignMat);
    mSign.position.set(0, 8.2, -10.8);
    market.add(mSign);

    // Welcome Portal banner at entrance
    const welcomeSignMat = makeSignBoard(
      'স্বাগতম · মার্কেট প্রবেশদ্বার',
      '১ম ও ২য় তলা শপিং এরিয়া · হিজাব, বোরকা, টি-শার্ট, প্যান্ট, জুতা ও ঘড়ি',
      '#065f46',
      '#ffffff',
      750,
      150
    );
    const wSign = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(7.8, 1.1, 0.2)), welcomeSignMat);
    wSign.position.set(0, 5.2, -10.6);
    market.add(wSign);

    // 3. FLOOR 2: UPPER LEVEL GALLERIA (২য় তলা, y = 4.25m)
    // Platform spanning with central open atrium void (width 7m, depth 8m)
    const f2North = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(26.6, 0.3, 7.0)), concreteMat);
    f2North.position.set(0, 4.25, -6.5);
    market.add(f2North);

    const f2South = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(26.6, 0.3, 7.0)), concreteMat);
    f2South.position.set(0, 4.25, 6.5);
    market.add(f2South);

    const f2WestWing = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(9.8, 0.3, 7.0)), concreteMat);
    f2WestWing.position.set(-8.4, 4.25, 0);
    market.add(f2WestWing);

    const f2EastWing = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(9.8, 0.3, 7.0)), concreteMat);
    f2EastWing.position.set(8.4, 4.25, 0);
    market.add(f2EastWing);

    // Golden safety railings / balustrades around the open central atrium
    for (const az of [-3.0, 3.0]) {
      const rail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(7.0, 0.95, 0.1)), jewelryGoldMat);
      rail.position.set(0, 4.85, az);
      market.add(rail);
    }
    for (const ax of [-3.5, 3.5]) {
      const rail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 0.95, 6.0)), jewelryGoldMat);
      rail.position.set(ax, 4.85, 0);
      market.add(rail);
    }

    // 4. ROOF & SKYLIGHT ATRIUM DOME (y = 9.2m)
    const roof = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(27.4, 0.4, 21.4)), mallBlueMat);
    roof.position.set(0, 9.2, 0);
    market.add(roof);

    // Glass Atrium Dome
    const dome = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(8.5, 0.6, 9.5)), glassBlueMat);
    dome.position.set(0, 9.4, 0);
    market.add(dome);

    // 5. GRAND STAIRCASE CLIMBING TO 2ND FLOOR (সিঁড়ি)
    // Starts at z = -0.5 (world z = 85.0), ascends smoothly to z = 7.5 (world z = 93.0) from y = 0.05 to 4.25
    const stairSteps = 14;
    for (let s = 0; s < stairSteps; s++) {
      const frac = s / (stairSteps - 1);
      const sy = 0.15 + frac * 4.1;
      const sz = -0.5 + frac * 8.0;
      const step = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.2, 0.3, 0.65)), woodDeckMat);
      step.position.set(-8.0, sy, sz);
      market.add(step);
    }
    // Staircase handrail
    const stairRailL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 0.12, 10.2)), darkMetalMat);
    stairRailL.position.set(-10.1, 2.9, 3.5);
    stairRailL.rotation.x = 0.44;
    market.add(stairRailL);
    const stairRailR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 0.12, 10.2)), darkMetalMat);
    stairRailR.position.set(-5.9, 2.9, 3.5);
    stairRailR.rotation.x = 0.44;
    market.add(stairRailR);

    // Directional Sign at foot of stairs
    const stairSignMat = makeSignBoard('২য় তলায় ওঠার সিঁড়ি ➜', 'UP TO 2ND FLOOR · টি-শার্ট ও জিন্স প্যান্ট কর্নার', '#1e3a8a', '#fef08a', 650, 140);
    const stSign = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.6, 0.9, 0.12)), stairSignMat);
    stSign.position.set(-8.0, 2.4, -1.2);
    market.add(stSign);

    // 6. MODERN GLASS CAPSULE ELEVATOR / LIFT (লিফট)
    {
      const liftShaft = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.6, 1.6, 9.0, 12)), glassBlueMat);
      liftShaft.position.set(10.5, 4.6, 0);
      market.add(liftShaft);

      const liftCab = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.4, 1.4, 2.6, 12)), jewelryGoldMat);
      liftCab.position.set(10.5, 1.4, 0);
      if (interactables) {
        liftCab.userData.marketElevator = true;
        interactables.push(liftCab);
      }
      market.add(liftCab);

      const liftSignMat = makeSignBoard('লিফট / LIFT', '১ম তলা ⇄ ২য় তলা', '#0f172a', '#38bdf8', 400, 120);
      const lSign = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.8, 0.6, 0.1)), liftSignMat);
      lSign.position.set(10.5, 3.2, -1.7);
      market.add(lSign);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 7. SHOPS & STALLS ON FLOOR 1 (১ম তলা)
    // ═════════════════════════════════════════════════════════════════════════

    // Stall 1: "মদিনা হিজাব ও বোরকা হাউস" (x = -258, z = 80.5 => local x = 6.5, z = -5.0)
    {
      const stall = new THREE.Group();
      stall.position.set(6.5, 0, -5.0);

      // Shop counter desk
      const counter = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.2, 1.1, 1.4)), sweetPinkMat);
      counter.position.set(0, 0.55, 0);
      stall.add(counter);

      // Glass display showcases on counter for Hijabs & Borkhas
      const glassCase = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.0, 0.7, 1.2)), glassBlueMat);
      glassCase.position.set(0, 1.35, 0);
      stall.add(glassCase);

      // Mannequins wearing Borkhas & Hijabs
      for (const [mx, color] of [
        [-1.4, 0x1e1b4b], // Black Dubai Borkha
        [1.4, 0x831843],  // Deep maroon Borkha
      ] as [number, number][]) {
        const manGown = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.3, 0.55, 1.6, 8)), trackMat(new THREE.MeshStandardMaterial({ color, roughness: 0.7 })));
        manGown.position.set(mx, 1.6, -1.2);
        stall.add(manGown);

        const manHijab = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.24, 8, 8)), sweetPinkMat);
        manHijab.position.set(mx, 2.5, -1.2);
        stall.add(manHijab);
      }

      // Signboard: "মদিনা হিজাব ও বোরকা হাউস"
      const signMat = makeSignBoard('মদিনা হিজাব ও বোরকা হাউস', 'তুর্কি সিল্ক হিজাব ও দুবাই বোরকা কালেকশন · DOKAN 101', '#831843', '#fef08a', 700, 160);
      const sign = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.8, 1.1, 0.15)), signMat);
      sign.position.set(0, 3.2, -1.2);
      stall.add(sign);

      // Interactive items on counter: Hijab & Borkha
      const hijabHit = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.8, 1.2, 1.2)), sweetPinkMat);
      hijabHit.position.set(-1.0, 1.1, 0);
      hijabHit.visible = false;
      hijabHit.userData.marketItemId = 'item-hijab-1';
      if (interactables) interactables.push(hijabHit);
      stall.add(hijabHit);

      const borkhaHit = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.8, 1.2, 1.2)), sweetPinkMat);
      borkhaHit.position.set(1.0, 1.1, 0);
      borkhaHit.visible = false;
      borkhaHit.userData.marketItemId = 'item-borkha-1';
      if (interactables) interactables.push(borkhaHit);
      stall.add(borkhaHit);

      market.add(stall);
    }

    // Stall 2: "রয়্যাল ফুটওয়্যার ও এপেক্স জুতা" (x = -272, z = 80.5 => local x = -7.0, z = -5.0)
    {
      const stall = new THREE.Group();
      stall.position.set(-7.0, 0, -5.0);

      // Tiered shoe shelving units
      const shelf = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.2, 2.2, 1.2)), woodDeckMat);
      shelf.position.set(0, 1.1, -1.2);
      stall.add(shelf);

      // Shoe boxes & leather shoe pairs displayed
      for (const sy of [0.5, 1.1, 1.7]) {
        for (let sx = -1.5; sx <= 1.5; sx += 0.8) {
          const shoe = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.35, 0.18, 0.45)), darkMetalMat);
          shoe.position.set(sx, sy, -0.6);
          stall.add(shoe);
        }
      }

      // Shop counter desk
      const counter = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.6, 1.0, 0.9)), creamWallMat);
      counter.position.set(0, 0.5, 0.2);
      stall.add(counter);

      const signMat = makeSignBoard('রয়্যাল ফুটওয়্যার · এপেক্স ও বাটা', '১০০% খাঁটি চামড়ার জুতা ও ক্যাজুয়াল স্নিকার্স · DOKAN 102', '#78350f', '#fef08a', 700, 160);
      const sign = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.8, 1.1, 0.15)), signMat);
      sign.position.set(0, 3.2, -1.2);
      stall.add(sign);

      // Interactive item for Shoes
      const shoesHit = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.6, 1.4, 1.2)), woodDeckMat);
      shoesHit.position.set(0, 1.0, 0);
      shoesHit.visible = false;
      shoesHit.userData.marketItemId = 'item-shoes-1';
      if (interactables) interactables.push(shoesHit);
      stall.add(shoesHit);

      market.add(stall);
    }

    // Stall 3: "টাইম জোন লাক্সারি ওয়াচ কর্নার" (x = -258, z = 89.5 => local x = 6.5, z = 4.0)
    {
      const stall = new THREE.Group();
      stall.position.set(6.5, 0, 4.0);

      // Luxury velvet counter showcase
      const counter = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.2, 1.1, 1.4)), darkMetalMat);
      counter.position.set(0, 0.55, 0);
      stall.add(counter);

      const glassTop = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.0, 0.6, 1.2)), glassBlueMat);
      glassTop.position.set(0, 1.3, 0);
      stall.add(glassTop);

      // Gold & Silver luxury watches inside showcase
      for (let wx = -1.4; wx <= 1.4; wx += 0.7) {
        const watch = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.14, 0.14, 0.12, 10)), jewelryGoldMat);
        watch.position.set(wx, 1.15, 0);
        stall.add(watch);
      }

      const signMat = makeSignBoard('টাইম জোন লাক্সারি ওয়াচ', 'রোলেক্স ক্রোনোগ্রাফ ও গোল্ডেন হাতঘড়ি গ্যালারি · DOKAN 103', '#0f172a', '#fbbf24', 700, 160);
      const sign = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.8, 1.1, 0.15)), signMat);
      sign.position.set(0, 3.2, 1.2);
      stall.add(sign);

      // Interactive item for Watch
      const watchHit = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.8, 1.4, 1.4)), darkMetalMat);
      watchHit.position.set(0, 1.0, 0);
      watchHit.visible = false;
      watchHit.userData.marketItemId = 'item-watch-1';
      if (interactables) interactables.push(watchHit);
      stall.add(watchHit);

      market.add(stall);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 8. SHOPS & STALLS ON FLOOR 2 (২য় তলা, y = 4.25m)
    // ═════════════════════════════════════════════════════════════════════════

    // Stall 4: "ঢাকা ফ্যাশন টি-শার্ট হাব" (local x = 6.5, y = 4.25, z = -4.0)
    {
      const stall = new THREE.Group();
      stall.position.set(6.5, 4.25, -4.0);

      // Chrome T-Shirt hanging racks
      for (const rx of [-1.5, 1.5]) {
        const rack = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 2.2, 2.6)), darkMetalMat);
        rack.position.set(rx, 1.1, -1.0);
        stall.add(rack);
      }
      const topBar = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.1, 0.08, 0.08)), darkMetalMat);
      topBar.position.set(0, 2.1, -1.0);
      stall.add(topBar);

      // Hanging colorful T-Shirts (Blue, Red, Yellow, Green)
      for (let tx = -1.2; tx <= 1.2; tx += 0.5) {
        const tshMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.6 }));
        const tShirt = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.35, 1.1, 0.08)), tshMat);
        tShirt.position.set(tx, 1.45, -1.0);
        stall.add(tShirt);
      }

      // Display counter
      const counter = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.6, 1.0, 1.2)), creamWallMat);
      counter.position.set(0, 0.5, 0.6);
      stall.add(counter);

      const signMat = makeSignBoard('ঢাকা ফ্যাশন টি-শার্ট হাব', '১০০% সুতি প্রিন্টেড ও পোলো টি-শার্ট · DOKAN 201', '#1e3a8a', '#fef08a', 700, 160);
      const sign = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.8, 1.1, 0.15)), signMat);
      sign.position.set(0, 3.2, -1.2);
      stall.add(sign);

      // Interactive item for T-Shirt
      const tshirtHit = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.8, 1.6, 1.8)), mallBlueMat);
      tshirtHit.position.set(0, 1.0, 0);
      tshirtHit.visible = false;
      tshirtHit.userData.marketItemId = 'item-tshirt-1';
      if (interactables) interactables.push(tshirtHit);
      stall.add(tshirtHit);

      market.add(stall);
    }

    // Stall 5: "ডেনিম প্লাস প্যান্ট ও জিন্স কর্নার" (local x = -7.0, y = 4.25, z = -4.0)
    {
      const stall = new THREE.Group();
      stall.position.set(-7.0, 4.25, -4.0);

      // Folded jeans shelving units
      const shelf = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.2, 2.2, 1.2)), woodDeckMat);
      shelf.position.set(0, 1.1, -1.2);
      stall.add(shelf);

      // Folded denim pants in cubbies
      for (const py of [0.5, 1.1, 1.7]) {
        for (let px = -1.4; px <= 1.4; px += 0.7) {
          const pant = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.5, 0.22, 0.6)), mallBlueMat);
          pant.position.set(px, py, -0.6);
          stall.add(pant);
        }
      }

      // Counter desk
      const counter = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.6, 1.0, 1.0)), darkMetalMat);
      counter.position.set(0, 0.5, 0.6);
      stall.add(counter);

      const signMat = makeSignBoard('ডেনিম প্লাস জিন্স ও প্যান্ট', 'স্লিম-ফিট স্ট্রেচ ডেনিম জিন্স ও গ্যাবার্ডিন প্যান্ট · DOKAN 202', '#0c4a6e', '#38bdf8', 700, 160);
      const sign = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.8, 1.1, 0.15)), signMat);
      sign.position.set(0, 3.2, -1.2);
      stall.add(sign);

      // Interactive item for Pant
      const pantHit = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.8, 1.6, 1.8)), concreteMat);
      pantHit.position.set(0, 1.0, 0);
      pantHit.visible = false;
      pantHit.userData.marketItemId = 'item-pant-1';
      if (interactables) interactables.push(pantHit);
      stall.add(pantHit);

      market.add(stall);
    }

    // Stall 6: 2nd Floor Hill View Balcony & Terrace Cafe (local z = 7.5, y = 4.25)
    {
      const balcony = new THREE.Group();
      balcony.position.set(0, 4.25, 7.5);

      // Wooden cafe tables and chairs overlooking the hills
      for (const bx of [-6.0, 0, 6.0]) {
        const table = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.75, 0.75, 0.85, 12)), woodDeckMat);
        table.position.set(bx, 0.42, 0);
        balcony.add(table);

        for (const cz of [-0.9, 0.9]) {
          const chair = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.42, 0.45, 0.42)), darkMetalMat);
          chair.position.set(bx, 0.35, cz);
          balcony.add(chair);
        }
      }

      const balcSignMat = makeSignBoard('পাহাড় ভিউ ব্যালকনি ও রিফ্রেশমেন্ট', 'SCENIC HILLTOP BALCONY & CAFE · সুন্দর চট্টগ্রাম পাহাড় দর্শন', '#065f46', '#ffffff', 700, 140);
      const bSign = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.4, 0.9, 0.1)), balcSignMat);
      bSign.position.set(0, 2.5, 2.4);
      balcony.add(bSign);

      market.add(balcony);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 9. SHOPKEEPERS & SHOPPERS (মানুষজন ও দোকানদার)
    // ═════════════════════════════════════════════════════════════════════════
    const addMarketNPC = (
      px: number,
      py: number,
      pz: number,
      shirt: THREE.Material,
      pants: THREE.Material,
      yaw = 0
    ) => {
      const fig = new THREE.Group();
      fig.position.set(px, py, pz);
      fig.rotation.y = yaw;

      const torso = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.38, 0.54, 0.22)), shirt);
      torso.position.y = 0.98;
      fig.add(torso);

      const head = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.13, 8, 8)), trackMat(new THREE.MeshStandardMaterial({ color: 0xba845d, roughness: 0.72 })));
      head.position.y = 1.38;
      fig.add(head);

      const legs = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.34, 0.68, 0.2)), pants);
      legs.position.y = 0.34;
      fig.add(legs);

      market.add(fig);
    };

    // Shopkeeper 1: ফারহানা আপা (হিজাব ও বোরকা দোকান)
    addMarketNPC(6.5, 0.05, -6.2, sweetPinkMat, darkMetalMat, 0);

    // Shopkeeper 2: শফিক ভাই (জুতার দোকান)
    addMarketNPC(-7.0, 0.05, -6.2, terracottaMat, darkMetalMat, 0);

    // Shopkeeper 3: তানভীর ভাই (ঘড়ির দোকান)
    addMarketNPC(6.5, 0.05, 5.2, jewelryGoldMat, concreteMat, Math.PI);

    // Shopkeeper 4: রাকিব ভাই (টি-শার্ট হাব, ২য় তলা)
    addMarketNPC(6.5, 4.25, -5.2, mallBlueMat, darkMetalMat, 0);

    // Shopkeeper 5: জামাল ভাই (প্যান্ট ও জিন্স, ২য় তলা)
    addMarketNPC(-7.0, 4.25, -5.2, darkMetalMat, mallBlueMat, 0);

    // Shoppers browsing on 1st Floor
    addMarketNPC(4.0, 0.05, -4.5, brightOrangeMat, darkMetalMat, -Math.PI / 2);
    addMarketNPC(-4.5, 0.05, -4.5, creamWallMat, darkMetalMat, Math.PI / 2);
    addMarketNPC(0, 0.05, -2.0, mallBlueMat, concreteMat, Math.PI);
    addMarketNPC(4.5, 0.05, 3.5, terracottaMat, darkMetalMat, -Math.PI / 4);

    // Shoppers on 2nd Floor
    addMarketNPC(4.0, 4.25, -3.5, sweetPinkMat, concreteMat, -Math.PI / 2);
    addMarketNPC(-4.5, 4.25, -3.5, jewelryGoldMat, darkMetalMat, Math.PI / 2);
    addMarketNPC(0, 4.25, 6.5, creamWallMat, mallBlueMat, 0);

    grp.add(market);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 5. CHITTAGONG CITY CENTER & ZERO POINT GRAND ROUNDABOUT (জিরো পয়েন্ট চত্বর)
  // Highway destination: Grand Roundabout at x = -395, z = 68 with landmark monument,
  // illuminated fountain, palm plaza, and Chittagong Central Bus/Car Terminal
  // ═════════════════════════════════════════════════════════════════════════
  {
    const zeroPoint = new THREE.Group();
    zeroPoint.position.set(-395, 0, 68);

    // 1) Circular Raised Center Plaza (Radius 15.5m, Height 0.35m)
    const plaza = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(15.5, 15.8, 0.35, 32)), concreteMat);
    plaza.position.y = 0.18;
    zeroPoint.add(plaza);

    // Outer decorative curb ring
    const curb = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(15.6, 0.22, 8, 32)), creamWallMat);
    curb.rotation.x = Math.PI / 2;
    curb.position.y = 0.36;
    zeroPoint.add(curb);

    // 2) Central Grand Fountain (Radius 6.5m) with blue water pool
    const fountainBasin = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(6.5, 6.8, 0.6, 24)), creamWallMat);
    fountainBasin.position.y = 0.55;
    zeroPoint.add(fountainBasin);

    const fountainWater = new THREE.Mesh(trackGeo(new THREE.CircleGeometry(6.2, 24)), riverWaterMat);
    fountainWater.rotation.x = -Math.PI / 2;
    fountainWater.position.y = 0.82;
    zeroPoint.add(fountainWater);

    // Fountain Central Spire Tier
    const tier2 = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(3.2, 3.6, 0.9, 20)), creamWallMat);
    tier2.position.y = 1.25;
    zeroPoint.add(tier2);

    const waterTier2 = new THREE.Mesh(trackGeo(new THREE.CircleGeometry(3.0, 20)), riverWaterMat);
    waterTier2.rotation.x = -Math.PI / 2;
    waterTier2.position.y = 1.72;
    zeroPoint.add(waterTier2);

    // Fountain spray jets
    for (let s = 0; s < 8; s++) {
      const sa = (s / 8) * Math.PI * 2;
      const jet = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.04, 0.08, 1.6, 6)), glassBlueMat);
      jet.position.set(Math.cos(sa) * 4.6, 1.6, Math.sin(sa) * 4.6);
      jet.rotation.z = Math.cos(sa) * 0.25;
      jet.rotation.x = Math.sin(sa) * 0.25;
      zeroPoint.add(jet);
    }

    // 3) Landmark Monument: "চট্টগ্রাম জিরো পয়েন্ট স্মৃতিস্তম্ভ" (Tri-Sail Freedom & Port Beacon)
    // Three soaring curved architectural sails rising 18m, 24m, and 30m into the sky!
    const sailMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.18, metalness: 0.15 })
    );
    for (let si = 0; si < 3; si++) {
      const ang = (si / 3) * Math.PI * 2 + Math.PI / 6;
      const sailHeight = 18 + si * 6;
      const sail = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.8, sailHeight, 2.6)),
        sailMat
      );
      sail.position.set(Math.cos(ang) * 1.5, sailHeight / 2 + 1.2, Math.sin(ang) * 1.5);
      sail.rotation.y = -ang;
      sail.rotation.z = Math.cos(ang) * 0.08;
      zeroPoint.add(sail);
    }

    // Monument Golden Crest Star at peak (y = 31m)
    const starCrest = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(1.2, 0)), jewelryGoldMat);
    starCrest.position.y = 31.2;
    zeroPoint.add(starCrest);

    // Monument Grand Plaque facing East (oncoming traffic from Highway)
    const zpSignMat = makeSignBoard(
      'চট্টগ্রাম জিরো পয়েন্ট',
      'বাণিজ্যিক রাজধানী ও বন্দর নগরী চট্টগ্রাম · ZERO POINT CTG',
      '#065f46',
      '#fef08a',
      800,
      180
    );
    // East-facing Plinth & Front Plaque (Directly faces East (+X) oncoming traffic straight-on)
    const plinthEast = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.28, 2.6, 11.0)), concreteMat);
    plinthEast.position.set(8.5, 2.2, 0);
    zeroPoint.add(plinthEast);

    const zpSignEast = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(10.5, 2.4)), zpSignMat);
    zpSignEast.position.set(8.66, 2.2, 0);
    zpSignEast.rotation.y = Math.PI / 2; // Normal points East (+X) directly towards oncoming traffic
    zeroPoint.add(zpSignEast);

    // West-facing Plinth & Front Plaque (Directly faces West (-X) oncoming traffic straight-on)
    const plinthWest = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.28, 2.6, 11.0)), concreteMat);
    plinthWest.position.set(-8.5, 2.2, 0);
    zeroPoint.add(plinthWest);

    const zpSignWest = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(10.5, 2.4)), zpSignMat);
    zpSignWest.position.set(-8.66, 2.2, 0);
    zpSignWest.rotation.y = -Math.PI / 2; // Normal points West (-X) directly towards oncoming traffic
    zeroPoint.add(zpSignWest);

    // Decorative ring of royal palm trees around plaza perimeter
    for (let p = 0; p < 8; p++) {
      const pa = (p / 8) * Math.PI * 2;
      const px = Math.cos(pa) * 13.0;
      const pz = Math.sin(pa) * 13.0;

      const trunk = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.2, 0.28, 6.5, 8)), concreteMat);
      trunk.position.set(px, 3.4, pz);
      zeroPoint.add(trunk);

      const frond = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(2.4, 2.2, 8)), greenHillMat);
      frond.position.set(px, 6.8, pz);
      zeroPoint.add(frond);
    }

    // Plaza floodlights illuminating monument & soaring beams
    for (let f = 0; f < 6; f++) {
      const fa = (f / 6) * Math.PI * 2;
      const fl = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.09, 0.1, 4.2, 6)), darkMetalMat);
      fl.position.set(Math.cos(fa) * 10.5, 2.1, Math.sin(fa) * 10.5);
      zeroPoint.add(fl);
      const lamp = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.25, 8, 6)), warmGlowMat);
      lamp.position.set(Math.cos(fa) * 10.5, 4.3, Math.sin(fa) * 10.5);
      zeroPoint.add(lamp);

      // Angled spotlight beam illuminating 31m golden star crest
      const spotBeam = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.04, 0.6, 26, 8)),
        glassBlueMat
      );
      spotBeam.position.set(Math.cos(fa) * 5.2, 16.5, Math.sin(fa) * 5.2);
      spotBeam.rotation.z = -Math.cos(fa) * 0.28;
      spotBeam.rotation.x = Math.sin(fa) * 0.28;
      zeroPoint.add(spotBeam);
    }

    grp.add(zeroPoint);
  }

  // 6) CHITTAGONG CENTRAL BUS & CAR TERMINAL (চট্টগ্রাম সেন্ট্রাল টার্মিনাল · South at x = -395, z = 106)
  {
    const term = new THREE.Group();
    term.position.set(-395, 0, 106);

    // Terminal main building concourse (width 26m, height 8.5m, depth 10m)
    const concourse = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(26, 8.5, 10)), mallBlueMat);
    concourse.position.y = 4.25;
    term.add(concourse);

    // Glass curtain wall entrance facing North (-Z toward Roundabout)
    const termGlass = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(20, 5.2, 0.25)), glassBlueMat);
    termGlass.position.set(0, 3.2, -5.1);
    term.add(termGlass);

    // Terminal Clock Tower (Square tower rising 18m)
    const clockTower = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5.2, 18, 5.2)), creamWallMat);
    clockTower.position.set(-10, 9.0, -2.5);
    term.add(clockTower);
    const clockFace = new THREE.Mesh(trackGeo(new THREE.CircleGeometry(1.4, 16)), warmGlowMat);
    clockFace.position.set(-10, 15.5, -5.12);
    term.add(clockFace);

    // Terminal Roof Billboard: "চট্টগ্রাম সেন্ট্রাল বাস ও কার টার্মিনাল"
    const termSignMat = makeSignBoard(
      'চট্টগ্রাম সেন্ট্রাল টার্মিনাল',
      'CHITTAGONG CENTRAL TERMINAL · বাস ও গাড়ি পার্কিং',
      '#1e3a8a',
      '#fbbf24',
      850,
      180
    );
    const termSign = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(18, 2.4, 0.3)), termSignMat);
    termSign.position.set(2, 9.6, -5.15);
    term.add(termSign);

    // Passenger bus shelter canopy
    const busShelter = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(24, 0.35, 5.5)), terracottaMat);
    busShelter.position.set(0, 4.4, -8.5);
    term.add(busShelter);
    for (const sx of [-10, -3.3, 3.3, 10]) {
      const col = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.12, 0.14, 4.4, 8)), darkMetalMat);
      col.position.set(sx, 2.2, -10.8);
      term.add(col);
    }

    grp.add(term);
  }

  // Layered green rolling hills of Chittagong beyond the river
  // Mathematically arranged to frame the landscape WITHOUT clipping or overlapping:
  // 1) Market building (x: -278 to -251, z: 75 to 96) is 100% free of hill overlap
  // 2) Chittagong Zero Point Roundabout (x: -395, z: 68, r: 25) is 100% open and visible
  // 3) Highway corridor (z: 60 to 76) is completely unobstructed
  const hillData: Array<[number, number, number, number]> = [
    // --- North Mountain Range (z <= 25, high rolling peaks in the northern distance) ---
    [-275, -18, 34, 25],
    [-315, -15, 40, 28],
    [-365, -16, 46, 32],
    [-425, -18, 52, 38], // Northwest mountain framing Zero Point from the north

    // --- South Mountain Range (Set back behind Market at z >= 148 & south of highway) ---
    [-265, 150, 36, 26], // Directly south of market (base stops at z = 114, market ends at z = 96: 18m clear buffer!)
    [-305, 155, 40, 30], // South-southwest of market (base stops at z = 115)
    [-355, 158, 44, 32], // Mid-south mountain (base stops at z = 114)
    [-425, 162, 42, 32], // Southwest mountain framing Zero Point & Bus Terminal from south (base stops at z = 120)

    // --- Western Horizon Mountain Backdrop (Positioned well north & south of highway corridor: z <= -35 and z >= 165) ---
    [-480, -35, 40, 42],  // Northwest mountain backdrop (base stops at z = 5, highway is at z >= 64: 59m buffer!)
    [-485, 165, 45, 42], // Southwest mountain backdrop (base stops at z = 120, highway is at z <= 72: 48m buffer!)
  ];
  for (const [hx, hz, hr, hy] of hillData) {
    const hill = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(hr, hy, 16)), greenHillMat);
    hill.position.set(hx, hy / 2 - 0.5, hz);
    grp.add(hill);
  }

  // Roadside streetlamps placed cleanly along city sidewalks & Chittagong Highway
  for (const [lx, lz] of [
    [-60, 42],
    [-74, 51],
    [-88, 62],
    [-115, 75.5],
    [-135, 75.5],
    [-155, 75.5],
    [-175, 75.5],
    [-195, 75.5],
    [-242, 75.5],
    [-268, 75.5],
    [-300, 75.5],
    [-335, 75.5],
    [-370, 75.5],
    [-418, 68.0],
  ] as [number, number][]) {
    const pole = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.08, 0.1, 5.5, 8)), darkMetalMat);
    pole.position.set(lx, 2.75, lz);
    grp.add(pole);
    const head = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.24, 8, 6)), warmGlowMat);
    head.position.set(lx, 5.5, lz);
    grp.add(head);
  }

  return grp;
}

/**
 * Builds varied architectural buildings along the opposite side of the road (z >= 47)
 * so every building has a distinct silhouette, roof form, material roughness & character.
 */
function buildOppositeStreetBuildings(
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T
): THREE.Group {
  const grp = new THREE.Group();

  const glassMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x3b6e8c, roughness: 0.14, metalness: 0.72 })
  );
  const warmGlassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffe6b3,
      emissive: new THREE.Color(0xffd28a),
      emissiveIntensity: 0.35,
      roughness: 0.2,
      metalness: 0.3,
    })
  );
  const darkMetalMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x26292e, roughness: 0.36, metalness: 0.74 })
  );
  const creamPlasterMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xeae1d0, roughness: 0.85, metalness: 0.02 })
  );
  const terracottaMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xb95c42, roughness: 0.78, metalness: 0.04 })
  );
  const concreteMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xc8c3ba, roughness: 0.88, metalness: 0.02 })
  );
  const timberMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x7c4d2b, roughness: 0.62, metalness: 0.06 })
  );
  const turquoiseMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x16808a, roughness: 0.38, metalness: 0.24 })
  );
  const mintPastelMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xc2d8cc, roughness: 0.82, metalness: 0.02 })
  );
  const ochreMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xd9a14a, roughness: 0.74, metalness: 0.04 })
  );

  // [Removed old buildings at x=-68 and x=-84 so the western side is entirely dedicated to the new open Amusement Park front & realistic city route]

  // [Building 2: Heritage Terracotta Colonial Arcade removed so Museum Gallery Central Metro Station is placed directly on this prime plot across the road, keeping the front gallery road 100% open and unobstructed]

  // 3. Stepped Ziggurat / Cantilevered Modernist Plaza (x = -36, z = 76)
  {
    const b = new THREE.Group();
    b.position.set(-36, 0, 76);
    const tier1 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(16.5, 4.8, 11.5)), concreteMat);
    tier1.position.y = 2.4;
    b.add(tier1);
    const tier2 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(13.2, 4.6, 9.4)), creamPlasterMat);
    tier2.position.set(1.2, 7.1, 0.5);
    b.add(tier2);
    const tier3 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(9.2, 4.2, 7.6)), ochreMat);
    tier3.position.set(-1.1, 11.5, 0.8);
    b.add(tier3);
    // Vertical timber sun-breaker louvers
    for (let i = -5; i <= 5; i++) {
      const fin = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 4.3, 0.7)), timberMat);
      fin.position.set(1.2 + i * 1.15, 7.1, -4.35);
      b.add(fin);
    }
    // Ground floor glowing gallery shopfront
    const storefront = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(13.8, 3.1, 0.2)), warmGlassMat);
    storefront.position.set(0, 1.9, -5.76);
    b.add(storefront);
    grp.add(b);
  }

  // 4. Domed Heritage Cultural Pavilion (x = 36, z = 76)
  {
    const b = new THREE.Group();
    b.position.set(36, 0, 76);
    const hall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(14.5, 8.2, 11.5)), creamPlasterMat);
    hall.position.y = 4.1;
    b.add(hall);
    const drum = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(4.6, 4.8, 2.2, 18)), creamPlasterMat);
    drum.position.y = 9.3;
    b.add(drum);
    const dome = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(4.65, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2)),
      turquoiseMat
    );
    dome.position.y = 10.3;
    b.add(dome);
    const finial = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.06, 0.14, 2.1, 8)), ochreMat);
    finial.position.y = 15.8;
    b.add(finial);
    // Twin corner slender turrets
    for (const s of [-1, 1]) {
      const turret = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.62, 0.72, 12.6, 12)), creamPlasterMat);
      turret.position.set(s * 6.8, 6.3, -5.2);
      b.add(turret);
      const cap = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.82, 1.8, 12)), turquoiseMat);
      cap.position.set(s * 6.8, 13.5, -5.2);
      b.add(cap);
    }
    const archGlass = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.6, 5.0, 0.25)), warmGlassMat);
    archGlass.position.set(0, 2.7, -5.76);
    b.add(archGlass);
    grp.add(b);
  }

  // 5. A-Frame & Striped-Awning Boutique Café / Bookstore Row (x = 62, z = 76)
  {
    const b = new THREE.Group();
    b.position.set(62, 0, 76);
    const base = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(15.2, 5.2, 9.6)), mintPastelMat);
    base.position.y = 2.6;
    b.add(base);
    // Dual triangular pitched gable roofs
    for (const gx of [-3.8, 3.8]) {
      const gable = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.05, 5.6, 4.4, 3)), terracottaMat);
      gable.position.set(gx, 7.4, 0);
      gable.rotation.y = Math.PI / 6;
      gable.scale.set(1.0, 1.0, 1.3);
      b.add(gable);
    }
    // Striped café awnings overhanging front shop windows
    const awning1 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.4, 0.22, 2.1)), terracottaMat);
    awning1.position.set(-3.8, 3.5, -5.4);
    awning1.rotation.x = 0.28;
    b.add(awning1);
    const awning2 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.4, 0.22, 2.1)), turquoiseMat);
    awning2.position.set(3.8, 3.5, -5.4);
    awning2.rotation.x = 0.28;
    b.add(awning2);
    const cafeGlass = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(13.2, 2.5, 0.2)), warmGlassMat);
    cafeGlass.position.set(0, 1.65, -4.82);
    b.add(cafeGlass);
    grp.add(b);
  }

  // 6. L-Shaped Contemporary Balcony Tower (x = 88, z = 76)
  {
    const b = new THREE.Group();
    b.position.set(88, 0, 76);
    const wingA = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(11.5, 16.0, 9.8)), creamPlasterMat);
    wingA.position.set(-2.5, 8.0, 0);
    b.add(wingA);
    const wingB = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(8.5, 11.4, 11.2)), glassMat);
    wingB.position.set(5.2, 5.7, -0.6);
    b.add(wingB);
    // Offset protruding balconies
    for (let fl = 0; fl < 4; fl++) {
      const slab = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.2, 0.34, 2.1)), ochreMat);
      slab.position.set(-2.5 + (fl % 2 === 0 ? -1.4 : 1.4), 3.6 + fl * 3.4, -5.3);
      b.add(slab);
    }
    grp.add(b);
  }

  // [Chittagong Hillside Port Warehouse removed from here and cleanly integrated after Karnaphuli bridge]

  // 8. Cox's Bazar Coastal Resort Villa (x = 114, z = 76)
  {
    const b = new THREE.Group();
    b.position.set(114, 0, 76);
    const villa = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(15, 6.6, 9.2)), creamPlasterMat);
    villa.position.y = 3.3;
    b.add(villa);
    const waveRoof = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(16.8, 0.55, 11.2)), turquoiseMat);
    waveRoof.position.y = 6.9;
    waveRoof.rotation.z = 0.08;
    b.add(waveRoof);
    const glassFront = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(12.8, 4.4, 0.22)), glassMat);
    glassFront.position.set(0, 3.1, -4.62);
    b.add(glassFront);
    grp.add(b);
  }

  return grp;
}

/**
 * Builds an iconic 3-12 part composite Bangladeshi vehicle with spinning wheels,
 * contact shadow, headlights/taillights, and removable seated driver.
 * Local forward is ALWAYS +Z.
 */
function buildVehicleRig(
  state: TrafficVehicleState,
  shadowTex: THREE.Texture,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T,
  interactables: THREE.Object3D[]
): VehicleRig {
  const root = new THREE.Group();
  const wheels: THREE.Object3D[] = [];
  const driverGroup = new THREE.Group();

  const bodyMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: state.primaryColor,
      roughness: state.kind === 'car' ? 0.24 : 0.36,
      metalness: state.kind === 'car' ? 0.52 : 0.25,
    })
  );
  const accentMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: state.accentColor,
      roughness: 0.45,
      metalness: 0.2,
    })
  );
  const tireMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1a1b1e, roughness: 0.88, metalness: 0.06 })
  );
  const rimMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xd4d8de, roughness: 0.22, metalness: 0.85 })
  );
  const chromeMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xbfc7d1, roughness: 0.18, metalness: 0.9 })
  );
  const headlightMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfff8dc,
      emissive: new THREE.Color(0xffeaa0),
      emissiveIntensity: 1.15,
      roughness: 0.18,
    })
  );
  const taillightMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      emissive: new THREE.Color(0xef4444),
      emissiveIntensity: 0.95,
      roughness: 0.25,
    })
  );
  const skinMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xba845d, roughness: 0.72 }));
  const shirtMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: state.kind === 'rickshaw' ? 0x1d4ed8 : state.kind === 'bike' ? 0x1f2937 : 0xe2e8f0,
      roughness: 0.78,
    })
  );
  const hairMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x171412, roughness: 0.85 }));

  const makeWheel = (radius: number, width: number, x: number, y: number, z: number) => {
    const wGrp = new THREE.Group();
    wGrp.position.set(x, y, z);
    const tire = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(radius, radius, width, 16)),
      tireMat
    );
    tire.rotation.z = Math.PI / 2;
    wGrp.add(tire);
    const rim = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(radius * 0.56, radius * 0.56, width + 0.02, 12)),
      rimMat
    );
    rim.rotation.z = Math.PI / 2;
    wGrp.add(rim);
    root.add(wGrp);
    wheels.push(wGrp);
  };

  const makeSeatedDriver = (yOffset: number, zOffset: number, hasHelmet: boolean) => {
    const torso = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.42, 0.52, 0.24)), shirtMat);
    torso.position.set(0, yOffset + 0.26, zOffset);
    driverGroup.add(torso);

    const head = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.145, 12, 10)),
      hasHelmet ? accentMat : skinMat
    );
    head.position.set(0, yOffset + 0.66, zOffset);
    driverGroup.add(head);

    if (!hasHelmet) {
      const cap = new THREE.Mesh(
        trackGeo(new THREE.SphereGeometry(0.15, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55)),
        hairMat
      );
      cap.position.set(0, yOffset + 0.68, zOffset - 0.01);
      driverGroup.add(cap);
    }

    // Arms reaching forward toward handlebars / steering wheel
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.045, 0.04, 0.44, 8)), shirtMat);
      arm.position.set(s * 0.24, yOffset + 0.34, zOffset + 0.18);
      arm.rotation.x = Math.PI * 0.36;
      driverGroup.add(arm);
    }
  };

  let riderSeatLocal = new THREE.Vector3(0, 0.9, 0.3);
  let passengerSeatLocal = new THREE.Vector3(0, 1.0, -0.5);
  let shadowRadiusX = 1.4;
  let shadowRadiusZ = 2.0;

  if (state.kind === 'rickshaw') {
    // 3-Wheeled Colorful Bangladeshi Cycle Rickshaw (front bicycle fork at +Z, passenger hood at -Z)
    makeWheel(0.42, 0.09, 0, 0.42, 1.12); // Front bicycle wheel
    makeWheel(0.45, 0.1, -0.68, 0.45, -0.62); // Rear left wheel
    makeWheel(0.45, 0.1, 0.68, 0.45, -0.62); // Rear right wheel

    // Floor chassis & rear passenger tub
    const deck = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.16, 0.12, 1.45)), accentMat);
    deck.position.set(0, 0.48, -0.52);
    deck.userData.vehicleId = state.id;
    interactables.push(deck);
    root.add(deck);

    // Painted decorative rickshaw seat back & side guards
    const seatBox = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.12, 0.56, 0.72)), bodyMat);
    seatBox.position.set(0, 0.82, -0.78);
    seatBox.userData.vehicleId = state.id;
    interactables.push(seatBox);
    root.add(seatBox);

    const cushion = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.04, 0.16, 0.62)), accentMat);
    cushion.position.set(0, 1.12, -0.74);
    root.add(cushion);

    // Iconic folding domed hood/canopy (bright crimson/teal with gold trim)
    const hoodBack = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.18, 0.96, 0.12)), bodyMat);
    hoodBack.position.set(0, 1.56, -1.16);
    hoodBack.userData.vehicleId = state.id;
    interactables.push(hoodBack);
    root.add(hoodBack);

    const hoodRoof = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.62, 0.62, 1.2, 14, 1, false, 0, Math.PI)),
      bodyMat
    );
    hoodRoof.rotation.z = Math.PI / 2;
    hoodRoof.position.set(0, 1.88, -0.72);
    hoodRoof.userData.vehicleId = state.id;
    interactables.push(hoodRoof);
    root.add(hoodRoof);

    // Golden rear rickshaw art panel
    const artPlate = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.92, 0.44, 0.06)), accentMat);
    artPlate.position.set(0, 0.82, -1.18);
    root.add(artPlate);

    // Front bicycle frame bar, saddle post & handlebars
    const mainBar = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.035, 0.035, 1.35, 8)), chromeMat);
    mainBar.rotation.x = Math.PI / 2 - 0.14;
    mainBar.position.set(0, 0.78, 0.45);
    root.add(mainBar);

    const fork = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.032, 0.032, 0.95, 8)), chromeMat);
    fork.position.set(0, 0.85, 1.04);
    fork.rotation.x = -0.22;
    root.add(fork);

    const handleBar = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.024, 0.024, 0.74, 8)), chromeMat);
    handleBar.rotation.z = Math.PI / 2;
    handleBar.position.set(0, 1.28, 0.94);
    root.add(handleBar);

    const lamp = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.08, 8, 6)), headlightMat);
    lamp.position.set(0, 1.18, 1.12);
    root.add(lamp);

    makeSeatedDriver(0.92, 0.42, false);
    riderSeatLocal = new THREE.Vector3(0, 0.96, 0.42);
    passengerSeatLocal = new THREE.Vector3(0, 1.08, -0.7);
    shadowRadiusX = 1.05;
    shadowRadiusZ = 1.65;
  } else if (state.kind === 'bike') {
    // Sporty Commuter Motorbike
    makeWheel(0.38, 0.14, 0, 0.38, 0.82); // Front wheel
    makeWheel(0.38, 0.16, 0, 0.38, -0.78); // Rear wheel

    const chassis = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.38, 0.42, 1.25)), tireMat);
    chassis.position.set(0, 0.62, 0.02);
    chassis.userData.vehicleId = state.id;
    interactables.push(chassis);
    root.add(chassis);

    // Sculpted metallic fuel tank
    const tank = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.46, 0.34, 0.68)), bodyMat);
    tank.position.set(0, 0.96, 0.24);
    tank.userData.vehicleId = state.id;
    interactables.push(tank);
    root.add(tank);

    // Stepped rider seat
    const seat = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.36, 0.16, 0.86)), tireMat);
    seat.position.set(0, 0.86, -0.42);
    root.add(seat);

    // Twin front forks, cowl & handlebars
    for (const s of [-1, 1]) {
      const fork = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.03, 0.03, 0.88, 8)), chromeMat);
      fork.position.set(s * 0.12, 0.82, 0.72);
      fork.rotation.x = -0.26;
      root.add(fork);
    }
    const cowl = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.34, 0.32, 0.36)), bodyMat);
    cowl.position.set(0, 1.08, 0.74);
    cowl.userData.vehicleId = state.id;
    interactables.push(cowl);
    root.add(cowl);

    const hbar = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.022, 0.022, 0.78, 8)), chromeMat);
    hbar.rotation.z = Math.PI / 2;
    hbar.position.set(0, 1.18, 0.56);
    root.add(hbar);

    // Chrome exhaust pipe
    const exhaust = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.055, 0.045, 0.85, 8)), chromeMat);
    exhaust.rotation.x = Math.PI / 2 - 0.12;
    exhaust.position.set(0.24, 0.44, -0.58);
    root.add(exhaust);

    const headLamp = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.22, 0.14, 0.08)), headlightMat);
    headLamp.position.set(0, 1.08, 0.94);
    root.add(headLamp);

    const tailLamp = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 0.1, 0.08)), taillightMat);
    tailLamp.position.set(0, 0.92, -0.92);
    root.add(tailLamp);

    makeSeatedDriver(0.86, -0.18, true);
    riderSeatLocal = new THREE.Vector3(0, 0.9, -0.18);
    passengerSeatLocal = new THREE.Vector3(0, 0.94, -0.55);
    shadowRadiusX = 0.72;
    shadowRadiusZ = 1.45;
  } else if (state.kind === 'car') {
    // Sleek Sedan Car
    makeWheel(0.38, 0.24, -0.96, 0.38, 1.38);
    makeWheel(0.38, 0.24, 0.96, 0.38, 1.38);
    makeWheel(0.38, 0.24, -0.96, 0.38, -1.32);
    makeWheel(0.38, 0.24, 0.96, 0.38, -1.32);

    // Sculpted lower body hull
    const lowerHull = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.04, 0.68, 4.35)), bodyMat);
    lowerHull.position.set(0, 0.74, 0);
    lowerHull.castShadow = true;
    lowerHull.userData.vehicleId = state.id;
    interactables.push(lowerHull);
    root.add(lowerHull);

    // Front & rear bumpers
    const bumperGeo = trackGeo(new THREE.BoxGeometry(2.08, 0.24, 0.24));
    const frontBumper = new THREE.Mesh(bumperGeo, accentMat);
    frontBumper.position.set(0, 0.44, 2.18);
    root.add(frontBumper);
    const rearBumper = new THREE.Mesh(bumperGeo, accentMat);
    rearBumper.position.set(0, 0.44, -2.18);
    root.add(rearBumper);

    // Tapered upper cabin greenhouse
    const cabin = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.76, 0.62, 2.24)), bodyMat);
    cabin.position.set(0, 1.36, -0.18);
    cabin.userData.vehicleId = state.id;
    interactables.push(cabin);
    root.add(cabin);

    const glassMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x1e2b38, roughness: 0.12, metalness: 0.78 })
    );
    const windshield = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.66, 0.5, 2.3)), glassMat);
    windshield.position.set(0, 1.34, -0.18);
    root.add(windshield);

    // Headlights & Taillights
    for (const s of [-1, 1]) {
      const hl = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.42, 0.16, 0.08)), headlightMat);
      hl.position.set(s * 0.68, 0.78, 2.18);
      root.add(hl);

      const tl = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.44, 0.16, 0.08)), taillightMat);
      tl.position.set(s * 0.68, 0.78, -2.18);
      root.add(tl);
    }

    // Front radiator grille
    const grille = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.76, 0.24, 0.08)), chromeMat);
    grille.position.set(0, 0.72, 2.19);
    root.add(grille);

    makeSeatedDriver(0.84, 0.12, false);
    riderSeatLocal = new THREE.Vector3(0.36, 0.85, 0.08);
    passengerSeatLocal = new THREE.Vector3(-0.36, 0.85, -0.4);
    shadowRadiusX = 1.48;
    shadowRadiusZ = 2.6;
  } else {
    // High-performance Water Speedboat (spans Karnaphuli river & Cox's ocean)
    const hullMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: state.primaryColor,
        roughness: 0.18,
        metalness: 0.35,
      })
    );
    const lowerHull = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.4, 0.75, 5.8)), hullMat);
    lowerHull.position.set(0, 0.42, 0);
    lowerHull.userData.vehicleId = state.id;
    interactables.push(lowerHull);
    root.add(lowerHull);

    // Pointed sports bow wedge
    const bowCone = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(1.2, 2.2, 8)), hullMat);
    bowCone.rotation.x = Math.PI / 2;
    bowCone.position.set(0, 0.42, 3.8);
    bowCone.userData.vehicleId = state.id;
    interactables.push(bowCone);
    root.add(bowCone);

    // Decorative racing stripes along gunwale
    const stripe = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.45, 0.16, 6.0)), accentMat);
    stripe.position.set(0, 0.72, 0.2);
    root.add(stripe);

    // Curved tinted aerodynamic windshield
    const marineGlassMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.1,
        metalness: 0.85,
        transparent: true,
        opacity: 0.8,
      })
    );
    const windshield = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.1, 0.6, 0.15)), marineGlassMat);
    windshield.position.set(0, 1.05, 1.2);
    windshield.rotation.x = -0.32;
    root.add(windshield);

    // Cockpit deck & bucket seats
    for (const sz of [0.1, -1.1]) {
      for (const sx of [-0.6, 0.6]) {
        const seat = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.55, 0.48, 0.5)), accentMat);
        seat.position.set(sx, 0.68, sz);
        root.add(seat);
      }
    }

    // Steering wheel & dashboard
    const dash = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.6, 0.35, 0.4)), tireMat);
    dash.position.set(0, 0.85, 1.0);
    root.add(dash);

    // Twin Yamaha outboard engines on the stern transom
    for (const ox of [-0.65, 0.65]) {
      const engine = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.38, 0.9, 0.52)), tireMat);
      engine.position.set(ox, 0.62, -3.1);
      root.add(engine);

      // Spinning propeller on the lower engine housing (added to wheels array so it spins with velocity!)
      const propGroup = new THREE.Group();
      propGroup.position.set(ox, 0.22, -3.42);
      for (let p = 0; p < 3; p++) {
        const blade = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.08, 0.32, 0.02)), accentMat);
        blade.rotation.z = (p * Math.PI * 2) / 3;
        propGroup.add(blade);
      }
      root.add(propGroup);
      wheels.push(propGroup);
    }

    // Marine navigation lights (Green starboard right, Red port left)
    const portLight = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.06, 6, 6)), taillightMat);
    portLight.position.set(-1.18, 0.84, 1.8);
    root.add(portLight);

    const stbdMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: new THREE.Color(0x059669),
        emissiveIntensity: 1.0,
      })
    );
    const stbdLight = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.06, 6, 6)), stbdMat);
    stbdLight.position.set(1.18, 0.84, 1.8);
    root.add(stbdLight);

    makeSeatedDriver(0.72, 0.1, false);
    riderSeatLocal = new THREE.Vector3(0.48, 0.72, 0.1);
    passengerSeatLocal = new THREE.Vector3(-0.48, 0.72, 0.1);
    shadowRadiusX = 1.5;
    shadowRadiusZ = 2.8;
  }

  root.add(driverGroup);

  // Grounded contact shadow disc beneath vehicle (no Z-fighting)
  const shadow = new THREE.Mesh(
    trackGeo(new THREE.CircleGeometry(1, 20)),
    trackMat(
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.52,
      })
    )
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(shadowRadiusX, shadowRadiusZ, 1);
  shadow.position.y = 0.045;
  root.add(shadow);

  root.position.set(state.x, 0.02, state.z);
  root.rotation.y = state.yaw;

  return {
    id: state.id,
    kind: state.kind,
    root,
    wheels,
    driverGroup,
    riderSeatLocal,
    passengerSeatLocal,
  };
}

/**
 * Composite multi-part footpath pedestrian with articulated walking limbs.
 */
function buildPedestrianRig(
  id: string,
  shirtHex: number,
  pantsHex: number,
  skinHex: number,
  x: number,
  sidewalkZ: number,
  dir: 1 | -1,
  speed: number,
  shadowTex: THREE.Texture,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T,
  minX?: number,
  maxX?: number
): PedestrianRig {
  const root = new THREE.Group();
  const shirtMat = trackMat(new THREE.MeshStandardMaterial({ color: shirtHex, roughness: 0.78 }));
  const pantsMat = trackMat(new THREE.MeshStandardMaterial({ color: pantsHex, roughness: 0.84 }));
  const skinMat = trackMat(new THREE.MeshStandardMaterial({ color: skinHex, roughness: 0.68 }));
  const hairMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1b1715, roughness: 0.85 }));
  const shoeMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x22201e, roughness: 0.5 }));

  const torso = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.42, 0.56, 0.22)), shirtMat);
  torso.position.y = 1.06;
  torso.castShadow = true;
  root.add(torso);

  const head = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.145, 12, 10)), skinMat);
  head.position.y = 1.5;
  root.add(head);

  const hair = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.15, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.58)),
    hairMat
  );
  hair.position.set(0, 1.52, -0.01);
  root.add(hair);

  const makeLimb = (
    w: number,
    h: number,
    mat: THREE.Material,
    pivotX: number,
    pivotY: number,
    withShoe: boolean
  ) => {
    const pivot = new THREE.Group();
    pivot.position.set(pivotX, pivotY, 0);
    const mesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(w, h, w)), mat);
    mesh.position.y = -h / 2;
    pivot.add(mesh);
    if (withShoe) {
      const shoe = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(w + 0.02, 0.09, w + 0.08)), shoeMat);
      shoe.position.set(0, -h + 0.045, 0.03);
      pivot.add(shoe);
    }
    root.add(pivot);
    return pivot;
  };

  const leftLeg = makeLimb(0.14, 0.78, pantsMat, -0.11, 0.78, true);
  const rightLeg = makeLimb(0.14, 0.78, pantsMat, 0.11, 0.78, true);
  const leftArm = makeLimb(0.11, 0.54, shirtMat, -0.28, 1.28, false);
  const rightArm = makeLimb(0.11, 0.54, shirtMat, 0.28, 1.28, false);

  const shadow = new THREE.Mesh(
    trackGeo(new THREE.CircleGeometry(0.38, 14)),
    trackMat(
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.44,
      })
    )
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  root.add(shadow);

  root.position.set(x, 0.14, sidewalkZ);
  root.rotation.y = dir === 1 ? Math.PI / 2 : -Math.PI / 2;

  return {
    id,
    root,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    x,
    z: sidewalkZ,
    dir,
    speed,
    phase: Math.abs(x) * 0.37,
    sidewalkZ,
    minX: minX ?? x - 25,
    maxX: maxX ?? x + 25,
  };
}

/**
 * Constructs the entire real-world exterior outside Room 1's South Exit Door:
 * - Classical museum facade & marble portico steps
 * - Lush botanical museum garden with fountains, flower beds, benches & tropical trees
 * - North & South pedestrian footpaths with walking citizens & street lamp posts
 * - Two-way asphalt highway with zebra crosswalk, live Rickshaws, Motorbikes & Cars
 * - Varied architectural buildings across the street
 * - Chittagong (CTG) hills & highway signs on the West end
 * - Cox's Bazar (COXS) coastal beach, ocean & highway signs on the East end
 */
export function buildOutdoorWorld(
  layout: MuseumLayout,
  museumTitle: string,
  initialVehicles: ReadonlyArray<TrafficVehicleState>,
  maxAnisotropy: number
): BuiltOutdoorWorld {
  const group = new THREE.Group();
  const interactables: THREE.Object3D[] = [];
  const vehicleRigs = new Map<string, VehicleRig>();
  const pedestrians: PedestrianRig[] = [];
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

  const shadowTex = trackTex(createContactShadowTexture());

  // --- 1. EXPANSIVE OUTDOOR GROUND & NATURAL HORIZON TERRAIN ---
  const grassTex = trackTex(createGrassTexture(maxAnisotropy));
  const grassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: grassTex,
      roughness: 0.94,
      metalness: 0.0,
    })
  );
  // Vast sprawling meadow ground plane covering museum, parks, expansive highway, winding city downtown, riverbanks & Chittagong horizon
  const frontMeadow = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(680, 360)), grassMat);
  frontMeadow.rotation.x = -Math.PI / 2;
  frontMeadow.position.set(-110, -0.05, 90.0);
  frontMeadow.receiveShadow = true;
  group.add(frontMeadow);

  // Side meadows flanking left & right of the museum building
  const sideMeadowGeo = trackGeo(new THREE.PlaneGeometry(165, layout.totalLength + 24));
  for (const s of [-1, 1]) {
    const sm = new THREE.Mesh(sideMeadowGeo, grassMat);
    sm.rotation.x = -Math.PI / 2;
    sm.position.set(s * (ROOM_HALF_WIDTH + 83.2), -0.05, (layout.southWallZ + layout.northWallZ) / 2 - 4);
    sm.receiveShadow = true;
    group.add(sm);
  }

  // --- 2. MUSEUM EXTERIOR CLASSICAL FACADE & PORTICO ---
  const facadeMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xe8dfd0, roughness: 0.72, metalness: 0.04 })
  );
  const stoneTrimMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xd0c4b1, roughness: 0.56, metalness: 0.06 })
  );
  const brassMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xc2975c, roughness: 0.25, metalness: 0.85 })
  );

  // Exterior cornice & parapet roof crowning the museum building
  const parapet = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(ROOM_WIDTH + 1.4, 0.95, layout.totalLength + 1.2)),
    stoneTrimMat
  );
  parapet.position.set(0, HALL_HEIGHT + 0.45, (layout.southWallZ + layout.northWallZ) / 2);
  group.add(parapet);

  // Classical 4-column Museum Portico framing the South Exit Door (z = 9.0..12.2)
  const porticoFloor = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(10.6, 0.14, 3.4)), stoneTrimMat);
  porticoFloor.position.set(0, 0.03, layout.southWallZ + 1.7);
  group.add(porticoFloor);

  const porticoCanopy = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(11.2, 0.62, 3.8)), facadeMat);
  porticoCanopy.position.set(0, 5.4, layout.southWallZ + 1.85);
  group.add(porticoCanopy);

  // Classical triangular pediment crowning the portico
  const pediment = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.1, 6.2, 1.55, 3)),
    facadeMat
  );
  pediment.rotation.y = Math.PI / 6;
  pediment.scale.set(1.15, 1, 0.35);
  pediment.position.set(0, 6.45, layout.southWallZ + 2.8);
  group.add(pediment);

  for (const cx of [-4.6, -2.35, 2.35, 4.6]) {
    const col = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.3, 0.36, 5.0, 14)), facadeMat);
    col.position.set(cx, 2.6, layout.southWallZ + 3.15);
    col.castShadow = true;
    group.add(col);
    const cap = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.86, 0.24, 0.86)), stoneTrimMat);
    cap.position.set(cx, 5.05, layout.southWallZ + 3.15);
    group.add(cap);
  }

  // Exterior Museum Title Signboard above portico
  const extSignTex = trackTex(createExteriorMuseumFacadeSign(museumTitle, maxAnisotropy));
  const extSign = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(7.2, 1.45)),
    trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: extSignTex,
        roughness: 0.45,
        metalness: 0.1,
      })
    )
  );
  extSign.position.set(0, 5.4, layout.southWallZ + 3.78);
  group.add(extSign);

  // --- 3. LUSH MUSEUM GARDEN, WALKWAY, FOUNTAINS, FLOWERS & TREES ---
  const stonePathMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xddd4c5, roughness: 0.64, metalness: 0.04 })
  );
  const centralWalk = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(7.4, FOOTPATH_NORTH_Z - layout.southWallZ + 0.6)),
    stonePathMat
  );
  centralWalk.rotation.x = -Math.PI / 2;
  centralWalk.position.set(0, 0.04, (layout.southWallZ + FOOTPATH_NORTH_Z) / 2);
  centralWalk.receiveShadow = true;
  group.add(centralWalk);

  // Cross-garden gravel paths linking both fountains
  const crossWalk = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(34, 2.6)), stonePathMat);
  crossWalk.rotation.x = -Math.PI / 2;
  crossWalk.position.set(0, 0.036, 16.8);
  group.add(crossWalk);

  // Twin tiered carved stone garden fountains with turquoise water
  const waterMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.12, metalness: 0.25 })
  );
  for (const f of GARDEN_FOUNTAINS) {
    const fGrp = new THREE.Group();
    fGrp.position.set(f.x, 0, f.z);
    const basin = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(2.05, 2.25, 0.56, 20)), stoneTrimMat);
    basin.position.y = 0.28;
    fGrp.add(basin);
    const water = new THREE.Mesh(trackGeo(new THREE.CircleGeometry(1.88, 20)), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.58;
    fGrp.add(water);
    const stem = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.28, 0.42, 1.3, 14)), facadeMat);
    stem.position.y = 0.95;
    fGrp.add(stem);
    const bowl = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.92, 0.34, 0.34, 16)), stoneTrimMat);
    bowl.position.y = 1.68;
    fGrp.add(bowl);
    const finial = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.22, 10, 8)), brassMat);
    finial.position.y = 2.02;
    fGrp.add(finial);
    group.add(fGrp);
  }

  // Vibrant flower beds & ornamental hedges flanking the central walkway
  const hedgeMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x2d5e31, roughness: 0.86 }));
  const flowerPalette = [0xf59e0b, 0xef4444, 0xec4899, 0xfbbf24, 0xf43f5e];
  const flowerMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.58 }));
  const flowerGeo = trackGeo(new THREE.DodecahedronGeometry(0.26, 0));
  const flowerMesh = new THREE.InstancedMesh(flowerGeo, flowerMat, 20);
  let flowerIdx = 0;

  const benchMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.62 }));
  for (const s of [-1, 1]) {
    // Low manicured garden hedge bordering the stone walk
    const hedge = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.7, 0.65, 9.6)), hedgeMat);
    hedge.position.set(s * 4.35, 0.32, 17.5);
    group.add(hedge);

    // Colorful marigold & hibiscus floral clusters along the garden edges (batched into 1 draw call)
    for (let i = 0; i < 10; i++) {
      const fx = s * (5.3 + (i % 3) * 1.45);
      const fz = 12.2 + i * 1.12;
      _instDummy.position.set(fx, 0.24, fz);
      _instDummy.rotation.set(0, i * 0.5, 0);
      _instDummy.scale.set(1.25, 0.85, 1.25);
      _instDummy.updateMatrix();
      flowerMesh.setMatrixAt(flowerIdx, _instDummy.matrix);
      _instColor.setHex(flowerPalette[i % flowerPalette.length]);
      flowerMesh.setColorAt(flowerIdx, _instColor);
      flowerIdx++;
    }

    // Garden benches facing the central avenue
    const bench = new THREE.Group();
    bench.position.set(s * 5.6, 0, 21.8);
    const seat = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.1, 0.1, 0.62)), benchMat);
    seat.position.y = 0.48;
    bench.add(seat);
    const back = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.1, 0.48, 0.08)), benchMat);
    back.position.set(0, 0.78, -0.26);
    bench.add(back);
    for (const lx of [-0.85, 0.85]) {
      const leg = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 0.48, 0.54)), stoneTrimMat);
      leg.position.set(lx, 0.24, 0);
      bench.add(leg);
    }
    group.add(bench);
  }
  flowerMesh.instanceMatrix.needsUpdate = true;
  if (flowerMesh.instanceColor) flowerMesh.instanceColor.needsUpdate = true;
  flowerMesh.computeBoundingSphere();
  group.add(flowerMesh);

  // Low Decorative Brick & Iron Garden Wall with Wide Open Gate at x ∈ [-5.5, 5.5]
  const brickMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x9b4d37, roughness: 0.82 }));
  const ironMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.38, metalness: 0.75 }));
  for (const s of [-1, 1]) {
    const wallLow = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(24, 0.85, 0.36)), brickMat);
    wallLow.position.set(s * 17.5, 0.42, FOOTPATH_NORTH_Z - 0.35);
    group.add(wallLow);

    const railTop = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(24, 0.08, 0.12)), ironMat);
    railTop.position.set(s * 17.5, 1.38, FOOTPATH_NORTH_Z - 0.35);
    group.add(railTop);

    // Grand gate pillars flanking the entrance
    const gatePillar = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.92, 2.35, 0.92)), facadeMat);
    gatePillar.position.set(s * 5.3, 1.175, FOOTPATH_NORTH_Z - 0.35);
    group.add(gatePillar);
    const gateOrb = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.28, 10, 8)),
      trackMat(
        new THREE.MeshStandardMaterial({
          color: 0xfff3d4,
          emissive: new THREE.Color(0xffe0a3),
          emissiveIntensity: 0.9,
          roughness: 0.2,
        })
      )
    );
    gateOrb.position.set(s * 5.3, 2.58, FOOTPATH_NORTH_Z - 0.35);
    group.add(gateOrb);
  }

  // Lush Tropical Trees (Krishnachura, Mango, Royal Palms) lining garden, avenue & both road ends
  const barkMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x543c2a, roughness: 0.92 }));
  const treeSpecs: Array<{ x: number; z: number; style: 'krishnachura' | 'mango' | 'palm'; scale: number }> = [
    // Garden showcase trees framing the Museum Courtyard (clear of West & East Parks)
    { x: -13.4, z: 12.0, style: 'krishnachura', scale: 1.12 },
    { x: 13.4, z: 12.0, style: 'krishnachura', scale: 1.12 },
    { x: -13.6, z: 22.0, style: 'mango', scale: 1.05 },
    { x: 13.6, z: 22.0, style: 'mango', scale: 1.05 },
    { x: -7.8, z: 12.6, style: 'palm', scale: 1.05 },
    { x: 7.8, z: 12.6, style: 'palm', scale: 1.05 },
    { x: 59.5, z: 13.5, style: 'palm', scale: 1.2 },
    // Roadside greenery toward Chittagong (Safely placed west of West Park boundary at x <= -85, keeping pool & rides 100% tree-free)
    { x: -86, z: 24.5, style: 'krishnachura', scale: 1.25 },
    { x: -96, z: 24.0, style: 'mango', scale: 1.3 },
    { x: -106, z: 24.0, style: 'palm', scale: 1.2 },
    // Roadside tropical palms toward Cox's Bazar (East)
    { x: 47, z: 23.0, style: 'palm', scale: 1.12 },
    { x: 58, z: 22.2, style: 'krishnachura', scale: 1.16 },
    { x: 68, z: 21.5, style: 'palm', scale: 1.18 },
    { x: 78, z: 21.2, style: 'palm', scale: 1.24 },
    { x: 90, z: 21.5, style: 'palm', scale: 1.2 },
    { x: 102, z: 22.5, style: 'palm', scale: 1.15 },
    // South footpath accent trees between opposite buildings
    { x: -45, z: 47.4, style: 'mango', scale: 0.95 },
    { x: -22.5, z: 47.2, style: 'krishnachura', scale: 0.92 },
    { x: 0, z: 47.4, style: 'palm', scale: 1.02 },
    { x: 23, z: 47.2, style: 'krishnachura', scale: 0.94 },
    { x: 45, z: 47.4, style: 'palm', scale: 1.08 },
    { x: 70, z: 47.4, style: 'palm', scale: 1.12 },
  ];
  group.add(buildInstancedTrees(treeSpecs, trackGeo, trackMat, barkMat));

  // --- 4. TWO-WAY ASPHALT HIGHWAY, ZEBRA CROSSING & FOOTPATHS ---
  const roadTex = trackTex(createRoadAsphaltTexture(maxAnisotropy));
  const roadMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: roadTex,
      roughness: 0.86,
      metalness: 0.04,
    })
  );
  // Central Highway spanning from x = -40 (where the smooth winding city route branches out) to east x = +128
  const roadMesh = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(168, ROAD_SOUTH_Z - ROAD_NORTH_Z)),
    roadMat
  );
  roadMesh.rotation.x = -Math.PI / 2;
  roadMesh.position.set(44, 0.02, ROAD_CENTER_Z);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  // Crisp White Zebra Crosswalk right outside the Museum Garden Gate (x = 0)
  const stripeMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf1efe8, roughness: 0.72 }));
  const stripeGeo = trackGeo(new THREE.PlaneGeometry(4.6, 0.65));
  for (let z = ROAD_NORTH_Z + 1.0; z <= ROAD_SOUTH_Z - 1.0; z += 1.45) {
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(0, 0.042, z);
    group.add(stripe);
  }

  // Raised North & South Pedestrian Footpaths
  const sidewalkTex = trackTex(createSidewalkTileTexture(maxAnisotropy));
  const sidewalkMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: sidewalkTex,
      roughness: 0.78,
      metalness: 0.02,
    })
  );
  // Raised Footpaths ending cleanly at x = -40 so the winding city road and street corners emerge naturally
  const curbGeo = trackGeo(new THREE.BoxGeometry(168, 0.14, 3.5));
  const northFootpath = new THREE.Mesh(curbGeo, sidewalkMat);
  northFootpath.position.set(44, 0.07, FOOTPATH_NORTH_Z + 1.75);
  northFootpath.receiveShadow = true;
  group.add(northFootpath);

  const southFootpath = new THREE.Mesh(curbGeo, sidewalkMat);
  southFootpath.position.set(44, 0.07, ROAD_SOUTH_Z + 1.75);
  southFootpath.receiveShadow = true;
  group.add(southFootpath);

  // --- 5. STREET LAMP POSTS ALONG BOTH SIDES OF THE HIGHWAY ---
  const lampGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfff6dc,
      emissive: new THREE.Color(0xffdf9e),
      emissiveIntensity: 1.35,
      roughness: 0.16,
    })
  );
  // --- 5. STREET LAMP POSTS ALONG HIGHWAY & FOOTPATHS ---
  // Place lamp posts cleanly on footpaths ONLY where highway actually exists (x >= -45)
  // to ensure zero lamp posts stand in the middle of roads or intersection turns!
  const lampSpecs: Array<{ x: number; z: number; facingRoadSign: 1 | -1 }> = [];
  for (let x = -40; x <= 96; x += 22) {
    if (Math.abs(x) < 4) continue; // Keep central museum gate view open
    lampSpecs.push({ x, z: ROAD_NORTH_Z - 0.75, facingRoadSign: 1 });
    lampSpecs.push({ x: x + 11, z: ROAD_SOUTH_Z + 0.75, facingRoadSign: -1 });
  }
  group.add(buildInstancedLampPosts(lampSpecs, trackGeo, ironMat, lampGlowMat));

  // --- 6. HIGHWAY SIGNS & LANDMARKS: CHITTAGONG (WEST) & COX'S BAZAR (EAST) ---
  const postMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.35, metalness: 0.78 })
  );

  // Roadside directional sign near museum pointing West -> CHITTAGONG (CTG)
  const buildRoadsideSign = (
    x: number,
    z: number,
    tex: THREE.CanvasTexture,
    rotY = 0
  ) => {
    const sGrp = new THREE.Group();
    sGrp.position.set(x, 0.14, z);
    sGrp.rotation.y = rotY;
    for (const px of [-1.45, 1.45]) {
      const post = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.08, 0.1, 4.4, 8)), postMat);
      post.position.set(px, 2.2, 0);
      sGrp.add(post);
    }
    const board = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(4.4, 1.65, 0.14)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 }))
    );
    board.position.set(0, 3.85, 0);
    sGrp.add(board);

    const faceMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: tex,
        emissive: new THREE.Color(0xffffff),
        emissiveMap: tex,
        emissiveIntensity: 0.22,
        roughness: 0.4,
      })
    );
    const front = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(4.32, 1.58)), faceMat);
    front.position.set(0, 3.85, 0.08);
    sGrp.add(front);

    const back = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(4.32, 1.58)), faceMat);
    back.position.set(0, 3.85, -0.08);
    back.rotation.y = Math.PI;
    sGrp.add(back);
    group.add(sGrp);
  };

  const ctgRoadSignTex = trackTex(
    createHighwaySignTexture({
      title: 'CHITTAGONG',
      subtitle: 'PORT CITY & GREEN HILLS · N1 WEST',
      badge: 'CTG',
      arrow: 'left',
      bgHex: '#0B5E3C',
      accentHex: '#FACC15',
      maxAnisotropy,
    })
  );
  const coxsRoadSignTex = trackTex(
    createHighwaySignTexture({
      title: "COX'S BAZAR",
      subtitle: 'MARINE DRIVE & SEA BEACH · N1 EAST',
      badge: 'COXS',
      arrow: 'right',
      bgHex: '#0C4A6E',
      accentHex: '#FACC15',
      maxAnisotropy,
    })
  );

  // Immediately visible directional highway signs flanking the Museum Road exit!
  buildRoadsideSign(-13.5, ROAD_NORTH_Z - 1.1, ctgRoadSignTex, Math.PI);
  buildRoadsideSign(13.5, ROAD_NORTH_Z - 1.1, coxsRoadSignTex, Math.PI);

  // Grand Overhead Highway Gantry Arch at CHITTAGONG (Relocated to x = -260, at the entrance to Chittagong Port & Hills)
  const buildHighwayGantry = (x: number, tex: THREE.CanvasTexture, zCenter = ROAD_CENTER_Z) => {
    const g = new THREE.Group();
    g.position.set(x, 0, zCenter);
    const span = ROAD_SOUTH_Z - ROAD_NORTH_Z + 1.8;
    for (const pz of [-span / 2, span / 2]) {
      const col = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.24, 0.3, 7.6, 12)), postMat);
      col.position.set(0, 3.8, pz);
      g.add(col);
    }
    const crossBeam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.45, 0.45, span + 0.8)), postMat);
    crossBeam.position.set(0, 7.3, 0);
    g.add(crossBeam);

    const signMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: tex,
        emissive: new THREE.Color(0xffffff),
        emissiveMap: tex,
        emissiveIntensity: 0.25,
        roughness: 0.38,
      })
    );
    const board = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 2.75, 8.6)), postMat);
    board.position.set(0, 6.45, 0);
    g.add(board);

    const eastFace = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(8.4, 2.62)), signMat);
    eastFace.position.set(0.14, 6.45, 0);
    eastFace.rotation.y = Math.PI / 2;
    g.add(eastFace);

    const westFace = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(8.4, 2.62)), signMat);
    westFace.position.set(-0.14, 6.45, 0);
    westFace.rotation.y = -Math.PI / 2;
    g.add(westFace);
    group.add(g);
  };

  buildHighwayGantry(
    -250,
    trackTex(
      createHighwaySignTexture({
        title: 'CHITTAGONG',
        subtitle: 'WELCOME TO CTG · HILL & PORT GATE',
        badge: 'CTG',
        arrow: 'center',
        bgHex: '#0B5E3C',
        accentHex: '#FACC15',
        maxAnisotropy,
      })
    ),
    65
  );

  buildHighwayGantry(
    -370,
    trackTex(
      createHighwaySignTexture({
        title: 'CHITTAGONG ZERO POINT',
        subtitle: 'স্বাগতম জিরো পয়েন্ট চত্বর · ZERO POINT ROUNDABOUT',
        badge: 'ZERO POINT',
        arrow: 'center',
        bgHex: '#065F46',
        accentHex: '#FEF08A',
        maxAnisotropy,
      })
    ),
    68
  );

  buildHighwayGantry(
    86,
    trackTex(
      createHighwaySignTexture({
        title: "COX'S BAZAR",
        subtitle: "WELCOME TO COXS · WORLD'S LONGEST BEACH",
        badge: 'COXS',
        arrow: 'center',
        bgHex: '#0369A1',
        accentHex: '#FDE047',
        maxAnisotropy,
      })
    )
  );

  // [Old hills at -116 removed - now grand rolling mountains placed far beyond the bridge at x = -280 to -340]

  // Cox's Bazar Golden Beach Sand & Shimmering Turquoise Ocean (East horizon landmark)
  const sandMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xe6cfa1, roughness: 0.9 }));
  const beach = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(66, 95)), sandMat);
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(126, 0.01, 35);
  group.add(beach);

  const oceanMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.16, metalness: 0.3 })
  );
  const ocean = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(95, 160)), oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(174, -0.01, 35);
  group.add(ocean);

  // Colorful beach umbrellas at Cox's Bazar shore
  for (const [ux, uz, color] of [
    [104, 16, 0xef4444],
    [108, 22, 0x0284c7],
    [105, 50, 0xf59e0b],
  ]) {
    const pole = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 8)), facadeMat);
    pole.position.set(ux, 1.25, uz);
    group.add(pole);
    const canopy = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(1.65, 0.65, 10)),
      trackMat(new THREE.MeshStandardMaterial({ color, roughness: 0.62 }))
    );
    canopy.position.set(ux, 2.55, uz);
    group.add(canopy);
  }

  // --- 7. VARIED ARCHITECTURAL BUILDINGS ACROSS THE ROAD ---
  group.add(buildOppositeStreetBuildings(trackGeo, trackMat));

  // --- 7b. CTG CITY APPROACH — winding road + Bangladeshi city streetscape ---
  group.add(buildCtgCityApproach(trackGeo, trackMat, maxAnisotropy, interactables));

  // --- 8. LIVE TRAFFIC VEHICLES (RICKSHAWS, MOTORBIKES, CARS) ---
  for (const vState of initialVehicles) {
    const rig = buildVehicleRig(vState, shadowTex, trackGeo, trackMat, interactables);
    group.add(rig.root);
    vehicleRigs.set(vState.id, rig);
  }

  // --- 9. WALKING FOOTPATH PEDESTRIANS ON ALL ROADS ---
  const pedSeeds: Array<{
    x: number;
    side?: 'north' | 'south';
    customZ?: number;
    dir: 1 | -1;
    speed: number;
    shirt: number;
    pants: number;
    skin: number;
    minX?: number;
    maxX?: number;
  }> = [
    // ── Sector 1: Central Museum Front Boulevard (x: -45 to 65) ──
    { x: -18, side: 'north', dir: 1, speed: 1.55, shirt: 0x0f766e, pants: 0x1e293b, skin: 0xc68e65, minX: -44, maxX: 60 },
    { x: 14, side: 'north', dir: -1, speed: 1.4, shirt: 0xb91c1c, pants: 0x334155, skin: 0xb87d56, minX: -44, maxX: 60 },
    { x: -38, side: 'north', dir: 1, speed: 1.7, shirt: 0xca8a04, pants: 0x1f2937, skin: 0xd19c76, minX: -44, maxX: 60 },
    { x: 42, side: 'north', dir: -1, speed: 1.5, shirt: 0x4338ca, pants: 0x1e293b, skin: 0xba8058, minX: -44, maxX: 65 },
    { x: -24, side: 'south', dir: -1, speed: 1.45, shirt: 0x15803d, pants: 0x1c1917, skin: 0xbc825b, minX: -44, maxX: 65 },
    { x: 8, side: 'south', dir: 1, speed: 1.65, shirt: 0xea580c, pants: 0x27272a, skin: 0xd09a74, minX: -44, maxX: 65 },
    { x: 34, side: 'south', dir: -1, speed: 1.5, shirt: 0x0369a1, pants: 0x1e293b, skin: 0xb47952, minX: -44, maxX: 65 },
    { x: 58, side: 'south', dir: 1, speed: 1.55, shirt: 0x7c3aed, pants: 0x292524, skin: 0xc68e65, minX: 10, maxX: 70 },

    // ── Sector 2: Cox's Bazar Coastal Highway & Beach Boardwalk (x: 65 to 175) ──
    { x: 78, side: 'north', dir: 1, speed: 1.6, shirt: 0x0284c7, pants: 0x38bdf8, skin: 0xc9936d, minX: 65, maxX: 125 },
    { x: 98, side: 'south', dir: -1, speed: 1.4, shirt: 0xf43f5e, pants: 0xfef08a, skin: 0xd09a74, minX: 70, maxX: 130 },
    { x: 118, customZ: 32.0, dir: 1, speed: 1.5, shirt: 0xfbbf24, pants: 0x0f172a, skin: 0xb87d56, minX: 95, maxX: 150 },
    { x: 135, customZ: 48.0, dir: -1, speed: 1.35, shirt: 0x10b981, pants: 0x1e293b, skin: 0xc68e65, minX: 110, maxX: 165 },
    { x: 152, customZ: 34.0, dir: 1, speed: 1.55, shirt: 0x8b5cf6, pants: 0xffffff, skin: 0xba8058, minX: 125, maxX: 175 },
    { x: 168, customZ: 44.0, dir: -1, speed: 1.45, shirt: 0x06b6d4, pants: 0x334155, skin: 0xd19c76, minX: 140, maxX: 178 },

    // ── Sector 3: Chittagong City Approach & Launch Ghat Quayside (x: -180 to -45) ──
    { x: -65, customZ: 74.0, dir: 1, speed: 1.5, shirt: 0xb45309, pants: 0x1e293b, skin: 0xc68e65, minX: -95, maxX: -48 },
    { x: -88, customZ: 76.0, dir: -1, speed: 1.45, shirt: 0x475569, pants: 0x0f172a, skin: 0xb87d56, minX: -120, maxX: -65 },
    { x: -115, customZ: 74.5, dir: 1, speed: 1.6, shirt: 0x047857, pants: 0x334155, skin: 0xd09a74, minX: -145, maxX: -90 },
    { x: -138, customZ: 87.5, dir: -1, speed: 1.4, shirt: 0xd97706, pants: 0x1e1e1e, skin: 0xbc825b, minX: -175, maxX: -115 },
    { x: -155, customZ: 87.5, dir: 1, speed: 1.5, shirt: 0x1d4ed8, pants: 0xf1f5f9, skin: 0xc9936d, minX: -180, maxX: -125 },
    { x: -172, customZ: 74.0, dir: -1, speed: 1.55, shirt: 0xbe123c, pants: 0x27272a, skin: 0xba8058, minX: -185, maxX: -140 },

    // ── Sector 4: Grand Market & Metro Station 2 Sidewalks (x: -320 to -180) ──
    { x: -205, customZ: 73.5, dir: 1, speed: 1.55, shirt: 0x0284c7, pants: 0x1e293b, skin: 0xc68e65, minX: -245, maxX: -185 },
    { x: -228, customZ: 69.0, dir: -1, speed: 1.4, shirt: 0x15803d, pants: 0x334155, skin: 0xd19c76, minX: -260, maxX: -200 },
    { x: -252, customZ: 74.0, dir: 1, speed: 1.65, shirt: 0xca8a04, pants: 0x0f172a, skin: 0xb87d56, minX: -285, maxX: -225 },
    { x: -270, customZ: 69.5, dir: -1, speed: 1.5, shirt: 0x7c3aed, pants: 0x1e293b, skin: 0xc9936d, minX: -300, maxX: -240 },
    { x: -292, customZ: 73.0, dir: 1, speed: 1.45, shirt: 0xe11d48, pants: 0x374151, skin: 0xd09a74, minX: -320, maxX: -265 },
    { x: -310, customZ: 70.0, dir: -1, speed: 1.6, shirt: 0x0f766e, pants: 0x18181b, skin: 0xbc825b, minX: -328, maxX: -280 },

    // ── Sector 5: Chittagong Zero Point Roundabout Plaza & Bus Terminal (x: -430 to -320) ──
    { x: -335, customZ: 67.5, dir: 1, speed: 1.5, shirt: 0x1e3a8a, pants: 0xf8fafc, skin: 0xc68e65, minX: -370, maxX: -325 },
    { x: -358, customZ: 70.5, dir: -1, speed: 1.45, shirt: 0x059669, pants: 0x1e293b, skin: 0xb87d56, minX: -390, maxX: -340 },
    { x: -380, customZ: 65.0, dir: 1, speed: 1.6, shirt: 0xd97706, pants: 0x334155, skin: 0xd19c76, minX: -410, maxX: -360 },
    { x: -395, customZ: 96.0, dir: -1, speed: 1.4, shirt: 0x9333ea, pants: 0x111827, skin: 0xba8058, minX: -420, maxX: -375 },
    { x: -412, customZ: 67.5, dir: 1, speed: 1.55, shirt: 0xbe185d, pants: 0x1e293b, skin: 0xc9936d, minX: -428, maxX: -385 },
    { x: -425, customZ: 70.5, dir: -1, speed: 1.5, shirt: 0x0284c7, pants: 0x27272a, skin: 0xd09a74, minX: -430, maxX: -395 },

    // ── Sector 6: Kashmir Scenic Alpine Mountain Highway (x: -740 to -430) ──
    { x: -455, customZ: 65.0, dir: 1, speed: 1.5, shirt: 0x1e3a5f, pants: 0x1e293b, skin: 0xc68e65, minX: -490, maxX: -435 },
    { x: -505, customZ: 66.0, dir: -1, speed: 1.45, shirt: 0x991b1b, pants: 0x0f172a, skin: 0xb87d56, minX: -540, maxX: -480 },
    { x: -552, customZ: 70.0, dir: 1, speed: 1.6, shirt: 0x166534, pants: 0x334155, skin: 0xd09a74, minX: -580, maxX: -520 },
    { x: -612, customZ: 62.0, dir: -1, speed: 1.4, shirt: 0x0369a1, pants: 0xf1f5f9, skin: 0xc9936d, minX: -640, maxX: -585 },
    { x: -665, customZ: 95.0, dir: 1, speed: 1.55, shirt: 0x7c2d12, pants: 0x1c1917, skin: 0xba8058, minX: -680, maxX: -650 },
    { x: -720, customZ: 72.0, dir: -1, speed: 1.5, shirt: 0x312e81, pants: 0x1e293b, skin: 0xd19c76, minX: -740, maxX: -690 },
  ];

  pedSeeds.forEach((p, idx) => {
    const sidewalkZ = typeof p.customZ === 'number'
      ? p.customZ
      : p.side === 'north' ? FOOTPATH_NORTH_Z + 1.6 : FOOTPATH_SOUTH_Z - 1.6;
    const rig = buildPedestrianRig(
      `ped-${idx}`,
      p.shirt,
      p.pants,
      p.skin,
      p.x,
      sidewalkZ,
      p.dir,
      p.speed,
      shadowTex,
      trackGeo,
      trackMat,
      p.minX,
      p.maxX
    );
    group.add(rig.root);
    pedestrians.push(rig);
  });

  // Reusable ejected driver NPC (hidden until the player performs a "Chintai" takeover!)
  const ejectedDriverRig = buildPedestrianRig(
    'ejected-driver',
    0xdc2626,
    0x1e293b,
    0xbc825b,
    0,
    FOOTPATH_NORTH_Z + 1.5,
    1,
    2.4,
    shadowTex,
    trackGeo,
    trackMat
  );
  ejectedDriverRig.root.visible = false;
  group.add(ejectedDriverRig.root);

  // Elevated 2-Storey Metro Rail System (Chittagong <-> Museum <-> Cox's Bazar)
  const metro = buildMetroSystem({
    trackGeo,
    trackMat,
    trackTex,
    interactables,
    maxAnisotropy,
  });
  group.add(metro.group);

  // Kashmir Snow Mountains, Gondola Cable Car, Frozen Dal Lake, Snowman & Snowball Arena
  const kashmir = buildKashmirEnvironment(
    trackGeo,
    trackMat,
    interactables
  );
  group.add(kashmir.group);

  // Guard bounds reference (avoid unused warning while preserving symmetry)
  void WORLD_MIN_X;
  void WORLD_MAX_X;

  return {
    group,
    vehicleRigs,
    pedestrians,
    ejectedDriverRig,
    interactables,
    metroTrainRig: metro.trainRig,
    kashmir,
    dispose: () => {
      for (const d of disposables) {
        d.dispose();
      }
    },
  };
}
