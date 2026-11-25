import * as THREE from 'three';
import type { ArtworkItem, FrameStyle, RoomShape, WallTheme } from '../types/museum';
import {
  CROSS_WING_DEPTH,
  CROSS_WING_HALF_DEPTH,
  CROSS_WING_HALF_WIDTH,
  DOOR_HEIGHT,
  DOOR_WIDTH,
  formatAccessionNumber,
  getArtworkPlacement,
  getResolvedRoomName,
  HALL_HEIGHT,
  ROOM_DEPTH,
  ROOM_HALF_WIDTH,
  ROOM_WIDTH,
  toRomanNumeral,
  type MuseumLayout,
  type RoomDefinition,
} from '../museum/layout';
import {
  createDoorSignboardTexture,
  createFallbackArtworkTexture,
  createMarbleFloorTextures,
  createPlaqueTexture,
  createPlasterWallTexture,
} from './proceduralTextures';
import { EXIT_DOOR_ID } from '../museum/outdoorWorld';

export interface DoorRig {
  id: string;
  fromRoomIndex: number;
  toRoomIndex: number;
  leftPivot: THREE.Group;
  rightPivot: THREE.Group;
  currentAngle: number;
}

export interface BuiltMuseum {
  group: THREE.Group;
  interactables: THREE.Object3D[];
  doors: DoorRig[];
  dispose: () => void;
}

const WALL_PALETTES: Record<
  WallTheme,
  {
    wall: string;
    ceiling: string;
    trim: number;
    baseboard: number;
    accentWall: number;
    inlay: number;
    fog: number;
  }
> = {
  alabaster: {
    wall: '#EAE4DA',
    ceiling: '#E5DED3',
    trim: 0xd0c6b7,
    baseboard: 0x3b2d23,
    accentWall: 0xe0d8cb,
    inlay: 0xd2c7b7,
    fog: 0xe6dfd4,
  },
  travertine: {
    wall: '#DFD5C6',
    ceiling: '#D6CBB9',
    trim: 0xbeaf9a,
    baseboard: 0x2f251d,
    accentWall: 0xd4c8b6,
    inlay: 0xc2b39e,
    fog: 0xd9cfc0,
  },
  charcoal: {
    wall: '#2A2724',
    ceiling: '#1F1D1B',
    trim: 0x453f39,
    baseboard: 0x161412,
    accentWall: 0x332f2b,
    inlay: 0x3a342e,
    fog: 0x221f1c,
  },
};

const FRAME_COLORS: Record<FrameStyle, { color: number; metalness: number; roughness: number }> = {
  bronze: { color: 0xa67c46, metalness: 0.78, roughness: 0.28 },
  walnut: { color: 0x4b3121, metalness: 0.08, roughness: 0.56 },
  obsidian: { color: 0x1e1c1a, metalness: 0.22, roughness: 0.36 },
  alabaster: { color: 0xece7de, metalness: 0.05, roughness: 0.62 },
};

/**
 * Constructs a distinctive procedural 3D flower vase & floral arrangement
 * on an architectural plinth, tailored to each room's design style.
 */
function buildCenterpieceFlowerVase(
  shape: RoomShape,
  roomCenterZ: number,
  wallTheme: WallTheme,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T,
  brassMat: THREE.Material,
  trimMat: THREE.Material
): THREE.Group {
  const grp = new THREE.Group();
  grp.position.set(0, 0, roomCenterZ);

  const darkPlinthMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: wallTheme === 'charcoal' ? 0x3c3630 : 0xded6ca,
      roughness: 0.42,
      metalness: 0.08,
    })
  );

  // Pedestal base tailored to room architecture
  if (shape === 'rotunda') {
    const base = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.02, 1.12, 0.2, 24)), trimMat);
    base.position.y = 0.1;
    base.receiveShadow = true;
    grp.add(base);

    const col = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.76, 0.84, 0.72, 24)), darkPlinthMat);
    col.position.y = 0.56;
    col.castShadow = true;
    col.receiveShadow = true;
    grp.add(col);

    const cap = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.92, 0.86, 0.1, 24)), brassMat);
    cap.position.y = 0.96;
    grp.add(cap);
  } else if (shape === 'atrium') {
    const base = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.05, 1.05, 0.18, 8)), trimMat);
    base.position.y = 0.09;
    grp.add(base);

    const col = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.82, 0.9, 0.74, 8)), darkPlinthMat);
    col.position.y = 0.55;
    col.castShadow = true;
    grp.add(col);

    const cap = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.96, 0.9, 0.1, 8)), trimMat);
    cap.position.y = 0.96;
    grp.add(cap);
  } else if (shape === 'salon') {
    const walnutMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x3e271a, roughness: 0.48, metalness: 0.1 })
    );
    const base = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.64, 0.18, 1.64)), walnutMat);
    base.position.y = 0.09;
    grp.add(base);

    const col = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.32, 0.74, 1.32)), darkPlinthMat);
    col.position.y = 0.55;
    col.castShadow = true;
    grp.add(col);

    const trimRing = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.42, 0.07, 1.42)), brassMat);
    trimRing.position.y = 0.95;
    grp.add(trimRing);
  } else if (shape === 'cross_hall') {
    // Grand Cross / X-Hall monumental octagonal pedestal with gilded step ring
    const step = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.38, 1.48, 0.2, 8)), trimMat);
    step.position.y = 0.1;
    step.receiveShadow = true;
    grp.add(step);

    const col = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.02, 1.12, 0.78, 8)), darkPlinthMat);
    col.position.y = 0.59;
    col.castShadow = true;
    col.receiveShadow = true;
    grp.add(col);

    const cap = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.18, 1.1, 0.1, 8)), brassMat);
    cap.position.y = 1.02;
    grp.add(cap);
  } else {
    // Modernist Pavilion stepped travertine block
    const step1 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.85, 0.18, 1.35)), trimMat);
    step1.position.y = 0.09;
    grp.add(step1);

    const body = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.45, 0.76, 1.05)), darkPlinthMat);
    body.position.y = 0.56;
    body.castShadow = true;
    grp.add(body);

    const topPlate = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.52, 0.06, 1.12)), brassMat);
    topPlate.position.y = 0.97;
    grp.add(topPlate);
  }

  const vaseBaseY = shape === 'cross_hall' ? 1.07 : 1.01;
  const stemMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x3b5234, roughness: 0.78 }));
  const leafMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x45633d, roughness: 0.68 }));

  if (shape === 'rotunda') {
    // 1. Celadon Porcelain Amphora + White & Blush Magnolias
    const pts = [
      new THREE.Vector2(0.01, 0.0),
      new THREE.Vector2(0.24, 0.02),
      new THREE.Vector2(0.22, 0.12),
      new THREE.Vector2(0.42, 0.42),
      new THREE.Vector2(0.45, 0.68),
      new THREE.Vector2(0.32, 0.95),
      new THREE.Vector2(0.18, 1.12),
      new THREE.Vector2(0.25, 1.24),
      new THREE.Vector2(0.21, 1.26),
    ];
    const vaseMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x7f9e8d, roughness: 0.22, metalness: 0.08 })
    );
    const vase = new THREE.Mesh(trackGeo(new THREE.LatheGeometry(pts, 24)), vaseMat);
    vase.position.y = vaseBaseY;
    vase.castShadow = true;
    grp.add(vase);

    // Gilded bronze rim & twin handles
    const rim = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.23, 0.025, 10, 24)), brassMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = vaseBaseY + 1.24;
    grp.add(rim);

    for (const s of [-1, 1]) {
      const handle = new THREE.Mesh(
        trackGeo(new THREE.TorusGeometry(0.18, 0.024, 8, 18, Math.PI * 1.15)),
        brassMat
      );
      handle.position.set(s * 0.34, vaseBaseY + 0.86, 0);
      handle.rotation.z = s === 1 ? -Math.PI * 0.55 : Math.PI * 0.4;
      grp.add(handle);
    }

    // White Magnolia blossoms & deep green leaves
    const petalMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xfaf5ec, roughness: 0.45 }));
    const blushMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xecd2cb, roughness: 0.48 }));
    const stamenMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xd9a13b, roughness: 0.4 }));
    const stemGeo = trackGeo(new THREE.CylinderGeometry(0.015, 0.022, 0.72, 6));
    const leafGeo = trackGeo(new THREE.SphereGeometry(0.14, 8, 6));
    const petalGeo = trackGeo(new THREE.SphereGeometry(0.09, 8, 6));

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const spread = i < 2 ? 0.14 : 0.34 + (i % 3) * 0.08;
      const h = 0.58 + (i % 3) * 0.16;
      const tipX = Math.cos(angle) * spread;
      const tipZ = Math.sin(angle) * spread;
      const tipY = vaseBaseY + 1.18 + h;

      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.set(tipX * 0.5, vaseBaseY + 1.14 + h * 0.45, tipZ * 0.5);
      stem.rotation.z = -tipX * 0.9;
      stem.rotation.x = tipZ * 0.9;
      grp.add(stem);

      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.scale.set(1.3, 0.35, 0.75);
      leaf.position.set(tipX * 0.72, vaseBaseY + 1.32 + (i % 2) * 0.15, tipZ * 0.72);
      leaf.rotation.y = angle;
      grp.add(leaf);

      // Multi-petal magnolia bloom
      const bloom = new THREE.Group();
      bloom.position.set(tipX, tipY, tipZ);
      for (let p = 0; p < 5; p++) {
        const pa = (p / 5) * Math.PI * 2;
        const pet = new THREE.Mesh(petalGeo, i % 3 === 0 ? blushMat : petalMat);
        pet.scale.set(1.15, 0.5, 0.78);
        pet.position.set(Math.cos(pa) * 0.075, 0.02, Math.sin(pa) * 0.075);
        pet.rotation.y = -pa;
        bloom.add(pet);
      }
      const core = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.045, 8, 6)), stamenMat);
      core.position.y = 0.03;
      bloom.add(core);
      grp.add(bloom);
    }
  } else if (shape === 'atrium') {
    // 2. Sculpted Terracotta Urn + Olive Branches & Golden Pampas Plumes
    const pts = [
      new THREE.Vector2(0.01, 0.0),
      new THREE.Vector2(0.28, 0.02),
      new THREE.Vector2(0.46, 0.34),
      new THREE.Vector2(0.52, 0.66),
      new THREE.Vector2(0.44, 0.94),
      new THREE.Vector2(0.32, 1.08),
      new THREE.Vector2(0.39, 1.18),
      new THREE.Vector2(0.34, 1.2),
    ];
    const terraMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0xb66242, roughness: 0.76, metalness: 0.04 })
    );
    const urn = new THREE.Mesh(trackGeo(new THREE.LatheGeometry(pts, 22)), terraMat);
    urn.position.y = vaseBaseY;
    urn.castShadow = true;
    grp.add(urn);

    const pampasMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xe6d3b3, roughness: 0.92 }));
    const oliveLeafMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x6c8260, roughness: 0.72 }));
    const plumeGeo = trackGeo(new THREE.ConeGeometry(0.11, 0.56, 8));
    const stalkGeo = trackGeo(new THREE.CylinderGeometry(0.014, 0.02, 0.95, 6));
    const oliveGeo = trackGeo(new THREE.SphereGeometry(0.12, 7, 5));

    for (let i = 0; i < 9; i++) {
      const angle = (i / 9) * Math.PI * 2;
      const isPlume = i % 2 === 0;
      const r = isPlume ? 0.28 + (i % 3) * 0.07 : 0.42;
      const h = isPlume ? 0.85 + (i % 3) * 0.14 : 0.52;
      const tx = Math.cos(angle) * r;
      const tz = Math.sin(angle) * r;

      const stalk = new THREE.Mesh(stalkGeo, stemMat);
      stalk.position.set(tx * 0.45, vaseBaseY + 1.12 + h * 0.4, tz * 0.45);
      stalk.rotation.z = -tx * 0.75;
      stalk.rotation.x = tz * 0.75;
      grp.add(stalk);

      if (isPlume) {
        const plume = new THREE.Mesh(plumeGeo, pampasMat);
        plume.position.set(tx, vaseBaseY + 1.15 + h, tz);
        plume.rotation.z = -tx * 0.6;
        plume.rotation.x = tz * 0.6;
        grp.add(plume);
      } else {
        for (let k = 0; k < 3; k++) {
          const leaf = new THREE.Mesh(oliveGeo, oliveLeafMat);
          leaf.scale.set(1.5, 0.35, 0.6);
          leaf.position.set(
            tx * (0.65 + k * 0.18),
            vaseBaseY + 1.24 + k * 0.16,
            tz * (0.65 + k * 0.18)
          );
          leaf.rotation.y = angle + k * 0.4;
          grp.add(leaf);
        }
      }
    }
  } else if (shape === 'salon') {
    // 3. Cobalt & Gold Chinoiserie Baluster Vase + Crimson & Blush Peonies
    const pts = [
      new THREE.Vector2(0.01, 0.0),
      new THREE.Vector2(0.28, 0.02),
      new THREE.Vector2(0.25, 0.14),
      new THREE.Vector2(0.46, 0.48),
      new THREE.Vector2(0.49, 0.78),
      new THREE.Vector2(0.24, 1.06),
      new THREE.Vector2(0.22, 1.24),
      new THREE.Vector2(0.32, 1.34),
      new THREE.Vector2(0.28, 1.36),
    ];
    const cobaltMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x1e3c72, roughness: 0.18, metalness: 0.14 })
    );
    const vase = new THREE.Mesh(trackGeo(new THREE.LatheGeometry(pts, 24)), cobaltMat);
    vase.position.y = vaseBaseY;
    vase.castShadow = true;
    grp.add(vase);

    // Gilded chinoiserie bands
    for (const [ry, rad] of [
      [0.14, 0.26],
      [1.06, 0.25],
      [1.34, 0.31],
    ]) {
      const band = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(rad, 0.022, 8, 24)), brassMat);
      band.rotation.x = Math.PI / 2;
      band.position.y = vaseBaseY + ry;
      grp.add(band);
    }

    const peonyColors = [0x9e2a3b, 0xd8838f, 0xf4dfd8, 0xb83b4d];
    const peonyMats = peonyColors.map((c) =>
      trackMat(new THREE.MeshStandardMaterial({ color: c, roughness: 0.56 }))
    );
    const peonyGeo = trackGeo(new THREE.DodecahedronGeometry(0.14, 1));
    const leafGeo = trackGeo(new THREE.SphereGeometry(0.14, 7, 5));

    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const tier = i < 4 ? 0 : 1;
      const rad = tier === 0 ? 0.18 : 0.4;
      const yOff = tier === 0 ? 1.68 : 1.48 + (i % 2) * 0.1;
      const bx = Math.cos(angle) * rad;
      const bz = Math.sin(angle) * rad;

      const peony = new THREE.Mesh(peonyGeo, peonyMats[i % peonyMats.length]);
      peony.position.set(bx, vaseBaseY + yOff, bz);
      peony.scale.set(1.1, 0.85, 1.1);
      grp.add(peony);

      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.scale.set(1.4, 0.35, 0.85);
      leaf.position.set(bx * 1.18, vaseBaseY + yOff - 0.14, bz * 1.18);
      leaf.rotation.y = angle;
      grp.add(leaf);
    }
  } else {
    // 4. Pavilion: Brushed Bronze Ribbed Architectural Vessel + White Orchids & Eucalyptus
    const pts = [
      new THREE.Vector2(0.01, 0.0),
      new THREE.Vector2(0.26, 0.02),
      new THREE.Vector2(0.36, 0.25),
      new THREE.Vector2(0.32, 0.5),
      new THREE.Vector2(0.38, 0.78),
      new THREE.Vector2(0.24, 1.08),
      new THREE.Vector2(0.28, 1.22),
      new THREE.Vector2(0.23, 1.24),
    ];
    const bronzeVaseMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x8f6b42, roughness: 0.28, metalness: 0.82 })
    );
    const vessel = new THREE.Mesh(trackGeo(new THREE.LatheGeometry(pts, 16)), bronzeVaseMat);
    vessel.position.y = vaseBaseY;
    vessel.castShadow = true;
    grp.add(vessel);

    const orchidMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xfdfbf7, roughness: 0.38 }));
    const orchidLipMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xc97b63, roughness: 0.45 }));
    const eucMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x62807a, roughness: 0.65 }));
    const stemGeo = trackGeo(new THREE.CylinderGeometry(0.014, 0.018, 1.05, 6));
    const orchidGeo = trackGeo(new THREE.SphereGeometry(0.085, 8, 6));
    const eucGeo = trackGeo(new THREE.CylinderGeometry(0.075, 0.075, 0.016, 8));

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + 0.3;
      const spread = 0.36;
      const sx = Math.cos(angle) * spread;
      const sz = Math.sin(angle) * spread;

      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.set(sx * 0.45, vaseBaseY + 1.48, sz * 0.45);
      stem.rotation.z = -sx * 0.85;
      stem.rotation.x = sz * 0.85;
      grp.add(stem);

      // Cascading white orchid blossoms along the arching stem
      for (let b = 0; b < 3; b++) {
        const frac = 0.58 + b * 0.24;
        const ox = sx * frac;
        const oz = sz * frac;
        const oy = vaseBaseY + 1.42 + b * 0.22;

        const blossom = new THREE.Mesh(orchidGeo, orchidMat);
        blossom.scale.set(1.3, 0.85, 0.45);
        blossom.position.set(ox, oy, oz);
        blossom.rotation.y = angle;
        grp.add(blossom);

        const lip = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.032, 6, 6)), orchidLipMat);
        lip.position.set(ox, oy - 0.01, oz);
        grp.add(lip);
      }

      // Eucalyptus round leaves
      const euc = new THREE.Mesh(eucGeo, eucMat);
      euc.position.set(sx * 0.52, vaseBaseY + 1.32, sz * 0.52);
      euc.rotation.z = 0.4;
      grp.add(euc);
    }
  }

  if (shape === 'cross_hall') {
    // Add an elevated golden crown ring + festive royal lily plumes atop the Cross Hall centerpiece
    const crownRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.46, 0.032, 10, 24)), brassMat);
    crownRing.rotation.x = Math.PI / 2;
    crownRing.position.y = vaseBaseY + 0.72;
    grp.add(crownRing);

    const lilyMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xfff8ec, roughness: 0.36 }));
    const rubyMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.48 }));
    const lilyGeo = trackGeo(new THREE.ConeGeometry(0.11, 0.24, 6));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const flower = new THREE.Mesh(lilyGeo, i % 2 === 0 ? lilyMat : rubyMat);
      flower.position.set(Math.cos(a) * 0.48, vaseBaseY + 1.72 + (i % 2) * 0.18, Math.sin(a) * 0.48);
      flower.rotation.z = -Math.cos(a) * 0.45;
      flower.rotation.x = Math.sin(a) * 0.45;
      grp.add(flower);
    }
  }

  return grp;
}

/**
 * Constructs a decorative corner planter (used in Atrium & Salon rooms).
 */
function buildCornerPlanter(
  x: number,
  z: number,
  style: 'olive' | 'fern',
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T,
  trimMat: THREE.Material
): THREE.Group {
  const grp = new THREE.Group();
  grp.position.set(x, 0, z);

  const potMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: style === 'olive' ? 0xb06c4f : 0x3b3530,
      roughness: 0.65,
    })
  );
  const pot = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.42, 0.3, 0.68, 14)), potMat);
  pot.position.y = 0.34;
  grp.add(pot);

  const soil = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.39, 0.39, 0.04, 14)),
    trimMat
  );
  soil.position.y = 0.67;
  grp.add(soil);

  const trunkMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x5c4433, roughness: 0.85 }));
  const canopyMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: style === 'olive' ? 0x5a7351 : 0x3c5d41,
      roughness: 0.75,
    })
  );

  if (style === 'olive') {
    const trunk = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.05, 0.07, 1.35, 8)), trunkMat);
    trunk.position.y = 1.32;
    grp.add(trunk);

    for (const [cx, cy, cz, r] of [
      [0, 2.05, 0, 0.42],
      [0.24, 1.85, 0.16, 0.32],
      [-0.22, 1.9, -0.18, 0.34],
      [0.05, 2.28, -0.1, 0.28],
    ]) {
      const puff = new THREE.Mesh(trackGeo(new THREE.DodecahedronGeometry(r, 1)), canopyMat);
      puff.position.set(cx, cy, cz);
      grp.add(puff);
    }
  } else {
    const frondGeo = trackGeo(new THREE.SphereGeometry(0.28, 7, 5));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const frond = new THREE.Mesh(frondGeo, canopyMat);
      frond.scale.set(1.6, 0.42, 0.72);
      frond.position.set(Math.cos(a) * 0.28, 0.94 + (i % 2) * 0.16, Math.sin(a) * 0.28);
      frond.rotation.y = -a;
      frond.rotation.z = 0.28;
      grp.add(frond);
    }
  }

  return grp;
}

/**
 * Builds an interactive double-leaf architectural door with hinged pivots,
 * bronze pull handles, and clickable room-name signboards mounted above the lintel.
 */
function buildDoorwayAssembly(options: {
  z: number;
  isInteractivePassage: boolean;
  doorId?: string;
  fromRoomIndex?: number;
  toRoomIndex?: number;
  southSign?: { roomIndex: number; roomName: string; hint: string };
  northSign?: { roomIndex: number; roomName: string; hint: string };
  wallMat: THREE.Material;
  trimMat: THREE.Material;
  brassMat: THREE.Material;
  maxAnisotropy: number;
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T;
  trackMat: <T extends THREE.Material>(m: T) => T;
  trackTex: <T extends THREE.Texture>(t: T) => T;
  interactables: THREE.Object3D[];
}): { group: THREE.Group; doorRig?: DoorRig } {
  const {
    z,
    isInteractivePassage,
    doorId,
    fromRoomIndex,
    toRoomIndex,
    southSign,
    northSign,
    wallMat,
    trimMat,
    brassMat,
    maxAnisotropy,
    trackGeo,
    trackMat,
    trackTex,
    interactables,
  } = options;

  const grp = new THREE.Group();
  grp.position.set(0, 0, z);

  const wallThickness = 0.42;
  const sideSpan = (ROOM_WIDTH - DOOR_WIDTH) / 2;

  // For inter-room partitions, build real left/right walls + top lintel around the open doorway!
  if (isInteractivePassage) {
    const sideWallGeo = trackGeo(new THREE.BoxGeometry(sideSpan, HALL_HEIGHT, wallThickness));
    const leftWall = new THREE.Mesh(sideWallGeo, wallMat);
    leftWall.position.set(-(DOOR_WIDTH / 2 + sideSpan / 2), HALL_HEIGHT / 2, 0);
    leftWall.receiveShadow = true;
    grp.add(leftWall);

    const rightWall = new THREE.Mesh(sideWallGeo, wallMat);
    rightWall.position.set(DOOR_WIDTH / 2 + sideSpan / 2, HALL_HEIGHT / 2, 0);
    rightWall.receiveShadow = true;
    grp.add(rightWall);

    const lintelHeight = HALL_HEIGHT - DOOR_HEIGHT;
    const lintel = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(DOOR_WIDTH + 0.1, lintelHeight, wallThickness)),
      wallMat
    );
    lintel.position.set(0, DOOR_HEIGHT + lintelHeight / 2, 0);
    grp.add(lintel);
  }

  // Architectural Walnut & Bronze Door Frame (Jambs + Header Architrave)
  const frameWoodMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x35241a, roughness: 0.44, metalness: 0.12 })
  );
  const doorPanelMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x452f21, roughness: 0.42, metalness: 0.1 })
  );
  const glassPaneMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x9aa9b6,
      roughness: 0.18,
      metalness: 0.42,
    })
  );

  const jambGeo = trackGeo(new THREE.BoxGeometry(0.24, DOOR_HEIGHT + 0.12, wallThickness + 0.14));
  for (const s of [-1, 1]) {
    const jamb = new THREE.Mesh(jambGeo, frameWoodMat);
    jamb.position.set(s * (DOOR_WIDTH / 2 + 0.08), (DOOR_HEIGHT + 0.12) / 2, 0);
    grp.add(jamb);
  }
  const header = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(DOOR_WIDTH + 0.54, 0.26, wallThickness + 0.18)),
    frameWoodMat
  );
  header.position.set(0, DOOR_HEIGHT + 0.12, 0);
  grp.add(header);

  const headerBrass = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(DOOR_WIDTH + 0.62, 0.05, wallThickness + 0.22)),
    brassMat
  );
  headerBrass.position.set(0, DOOR_HEIGHT + 0.26, 0);
  grp.add(headerBrass);

  // Double-Leaf Hinged Doors
  const leafWidth = DOOR_WIDTH / 2 - 0.07;
  const leafHeight = DOOR_HEIGHT - 0.06;
  const leafThick = 0.1;

  const createDoorLeaf = (side: 'left' | 'right') => {
    const pivot = new THREE.Group();
    const isLeft = side === 'left';
    pivot.position.set(isLeft ? -(DOOR_WIDTH / 2 - 0.04) : DOOR_WIDTH / 2 - 0.04, 0, 0);

    const xCenter = isLeft ? leafWidth / 2 : -leafWidth / 2;
    const leafBody = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(leafWidth, leafHeight, leafThick)),
      doorPanelMat
    );
    leafBody.position.set(xCenter, leafHeight / 2, 0);
    leafBody.castShadow = true;
    if (doorId) {
      leafBody.userData.doorId = doorId;
      interactables.push(leafBody);
    } else {
      leafBody.userData.expansionDoor = true;
      interactables.push(leafBody);
    }
    pivot.add(leafBody);

    // Upper frosted museum glass inset panel (both faces)
    const glass = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(leafWidth - 0.36, 1.55, leafThick + 0.02)),
      glassPaneMat
    );
    glass.position.set(xCenter, 2.55, 0);
    if (doorId) {
      glass.userData.doorId = doorId;
      interactables.push(glass);
    }
    pivot.add(glass);

    // Lower decorative molding frame
    const lowerPanel = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(leafWidth - 0.36, 1.15, leafThick + 0.03)),
      frameWoodMat
    );
    lowerPanel.position.set(xCenter, 0.92, 0);
    pivot.add(lowerPanel);

    // Vertical Brass Pull Handles on BOTH sides of the leaf
    const handleX = isLeft ? leafWidth - 0.18 : -(leafWidth - 0.18);
    const handleGeo = trackGeo(new THREE.CylinderGeometry(0.024, 0.024, 0.68, 10));
    for (const zSide of [-1, 1]) {
      const handle = new THREE.Mesh(handleGeo, brassMat);
      handle.position.set(handleX, 1.48, zSide * (leafThick / 2 + 0.07));
      pivot.add(handle);
    }

    return pivot;
  };

  const leftPivot = createDoorLeaf('left');
  const rightPivot = createDoorLeaf('right');
  grp.add(leftPivot);
  grp.add(rightPivot);

  // Helper to mount a clickable 3D Room Name Signboard above the doorway
  const mountSignboard = (
    spec: { roomIndex: number; roomName: string; hint: string },
    facing: 'south' | 'north'
  ) => {
    const signW = 3.55;
    const signH = 0.88;
    const signY = DOOR_HEIGHT + 0.92;
    const signZ = facing === 'south' ? wallThickness / 2 + 0.1 : -(wallThickness / 2 + 0.1);
    const rotY = facing === 'south' ? 0 : Math.PI;

    const signFrame = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(signW + 0.14, signH + 0.14, 0.08)),
      brassMat
    );
    signFrame.position.set(0, signY, signZ - (facing === 'south' ? 0.03 : -0.03));
    grp.add(signFrame);

    const signTex = trackTex(
      createDoorSignboardTexture(
        spec.roomIndex < 0 ? 'OUTDOOR EXIT' : `Room ${toRomanNumeral(spec.roomIndex + 1)}`,
        spec.roomName,
        spec.hint,
        maxAnisotropy
      )
    );
    const signPlane = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(signW, signH)),
      trackMat(
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: signTex,
          emissive: new THREE.Color(0xffffff),
          emissiveMap: signTex,
          emissiveIntensity: 0.35,
          roughness: 0.88,
          metalness: 0.0,
        })
      )
    );
    signPlane.position.set(0, signY, signZ + (facing === 'south' ? 0.025 : -0.025));
    signPlane.rotation.y = rotY;
    if (spec.roomIndex < 0 && doorId) {
      signPlane.userData.doorId = doorId;
    } else {
      signPlane.userData.renameRoomIndex = spec.roomIndex;
      signPlane.userData.renameRoomName = spec.roomName;
    }
    grp.add(signPlane);
    interactables.push(signPlane);
  };

  if (southSign) {
    mountSignboard(southSign, 'south');
  }
  if (northSign) {
    mountSignboard(northSign, 'north');
  }

  let doorRig: DoorRig | undefined;
  if (isInteractivePassage && doorId && fromRoomIndex !== undefined && toRoomIndex !== undefined) {
    doorRig = {
      id: doorId,
      fromRoomIndex,
      toRoomIndex,
      leftPivot,
      rightPivot,
      currentAngle: 0,
    };
  }

  // Subtle architectural threshold strip across doorway floor
  const threshold = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(DOOR_WIDTH + 0.2, 0.025, wallThickness + 0.12)),
    trimMat
  );
  threshold.position.set(0, 0.012, 0);
  grp.add(threshold);

  return { group: grp, doorRig };
}

/**
 * Adds room-specific shape architecture (chamfered octagonal corners, arched bays,
 * walnut wainscoting, modernist fins, custom ceilings & floor inlays, flower vase centerpiece).
 */
function buildRoomSpecificArchitecture(
  room: RoomDefinition,
  wallTheme: WallTheme,
  wallMat: THREE.Material,
  trimMat: THREE.Material,
  baseboardMat: THREE.Material,
  brassMat: THREE.Material,
  skylightMat: THREE.Material,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T
): THREE.Group {
  const grp = new THREE.Group();
  const palette = WALL_PALETTES[wallTheme];
  const cz = room.centerZ;

  // Unique floor inlay per room shape (offset +0.018 on Y to avoid Z-fighting)
  const inlayMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: palette.inlay,
      roughness: 0.42,
      metalness: 0.06,
    })
  );

  if (room.shape === 'rotunda') {
    // 1. GRAND ROTUNDA: Chamfered octagonal corners + circular oculus dome + circular floor medallion
    const medallion = new THREE.Mesh(trackGeo(new THREE.RingGeometry(1.5, 4.4, 36)), inlayMat);
    medallion.rotation.x = -Math.PI / 2;
    medallion.position.set(0, 0.018, cz);
    grp.add(medallion);

    const brassRing = new THREE.Mesh(trackGeo(new THREE.RingGeometry(4.4, 4.54, 36)), brassMat);
    brassRing.rotation.x = -Math.PI / 2;
    brassRing.position.set(0, 0.022, cz);
    grp.add(brassRing);

    // 4 Diagonal Chamfered Corner Walls creating an octagonal room plan
    const chamferGeo = trackGeo(new THREE.BoxGeometry(3.2, HALL_HEIGHT, 0.36));
    const chamferCorners: [number, number, number][] = [
      [-ROOM_HALF_WIDTH + 1.05, room.southZ - 1.05, Math.PI / 4],
      [ROOM_HALF_WIDTH - 1.05, room.southZ - 1.05, -Math.PI / 4],
      [-ROOM_HALF_WIDTH + 1.05, room.northZ + 1.05, -Math.PI / 4],
      [ROOM_HALF_WIDTH - 1.05, room.northZ + 1.05, Math.PI / 4],
    ];
    for (const [cx, cornerZ, rotY] of chamferCorners) {
      const chamfer = new THREE.Mesh(chamferGeo, wallMat);
      chamfer.position.set(cx, HALL_HEIGHT / 2, cornerZ);
      chamfer.rotation.y = rotY;
      grp.add(chamfer);

      const pilaster = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.24, 0.26, HALL_HEIGHT - 0.4, 14)),
        trimMat
      );
      pilaster.position.set(cx, HALL_HEIGHT / 2, cornerZ);
      grp.add(pilaster);
    }

    // Circular Oculus Skylight + Brass Dome Ring
    const oculusGlow = new THREE.Mesh(trackGeo(new THREE.CircleGeometry(3.9, 32)), skylightMat);
    oculusGlow.rotation.x = Math.PI / 2;
    oculusGlow.position.set(0, HALL_HEIGHT - 0.05, cz);
    grp.add(oculusGlow);

    const oculusRim = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(4.0, 0.16, 12, 36)), trimMat);
    oculusRim.rotation.x = Math.PI / 2;
    oculusRim.position.set(0, HALL_HEIGHT - 0.12, cz);
    grp.add(oculusRim);

    const brassOculus = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(3.85, 0.045, 8, 36)), brassMat);
    brassOculus.rotation.x = Math.PI / 2;
    brassOculus.position.set(0, HALL_HEIGHT - 0.22, cz);
    grp.add(brassOculus);
  } else if (room.shape === 'atrium') {
    // 2. BOTANICAL ATRIUM: Conservatory trusses + arched column bays + 4 corner olive trees
    const atriumBorder = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(ROOM_WIDTH - 4.4, ROOM_DEPTH - 4.2)),
      inlayMat
    );
    atriumBorder.rotation.x = -Math.PI / 2;
    atriumBorder.position.set(0, 0.018, cz);
    grp.add(atriumBorder);

    // Conservatory glass skylight + dark bronze roof truss ribs
    const glassRoof = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(9.6, 12.6)), skylightMat);
    glassRoof.rotation.x = Math.PI / 2;
    glassRoof.position.set(0, HALL_HEIGHT - 0.05, cz);
    grp.add(glassRoof);

    const trussMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x3b332d, roughness: 0.4, metalness: 0.58 })
    );
    for (const tz of [-5.2, -1.75, 1.75, 5.2]) {
      const beam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(10.2, 0.22, 0.18)), trussMat);
      beam.position.set(0, HALL_HEIGHT - 0.16, cz + tz);
      grp.add(beam);
    }
    for (const tx of [-4.8, 0, 4.8]) {
      const spine = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, 0.2, 13.0)), trussMat);
      spine.position.set(tx, HALL_HEIGHT - 0.16, cz);
      grp.add(spine);
    }

    // 4 Corner Potted Olive Trees framing the Botanical Atrium
    const planterOffsetX = ROOM_HALF_WIDTH - 1.15;
    for (const [px, pz] of [
      [-planterOffsetX, room.southZ - 1.3],
      [planterOffsetX, room.southZ - 1.3],
      [-planterOffsetX, room.northZ + 1.3],
      [planterOffsetX, room.northZ + 1.3],
    ]) {
      grp.add(buildCornerPlanter(px, pz, 'olive', trackGeo, trackMat, trimMat));
    }
  } else if (room.shape === 'salon') {
    // 3. IMPERIAL SALON: Walnut wainscoting dado panels, coffered ceiling, framed carpet inlay
    const salonMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x3d281c, roughness: 0.48, metalness: 0.08 })
    );

    const floorRug = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(9.2, 11.4)),
      trackMat(
        new THREE.MeshStandardMaterial({
          color: wallTheme === 'charcoal' ? 0x382824 : 0xd8cbbd,
          roughness: 0.65,
        })
      )
    );
    floorRug.rotation.x = -Math.PI / 2;
    floorRug.position.set(0, 0.018, cz);
    grp.add(floorRug);

    // Walnut dado rail + wainscoting along side walls
    const dadoGeo = trackGeo(new THREE.BoxGeometry(0.14, 1.05, ROOM_DEPTH - 0.8));
    const railGeo = trackGeo(new THREE.BoxGeometry(0.18, 0.08, ROOM_DEPTH - 0.8));
    for (const s of [-1, 1]) {
      const dado = new THREE.Mesh(dadoGeo, salonMat);
      dado.position.set(s * (ROOM_HALF_WIDTH - 0.06), 0.525, cz);
      grp.add(dado);

      const rail = new THREE.Mesh(railGeo, brassMat);
      rail.position.set(s * (ROOM_HALF_WIDTH - 0.08), 1.08, cz);
      grp.add(rail);
    }

    // Coffered ceiling beams + central lantern skylight
    const lantern = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(6.8, 8.8)), skylightMat);
    lantern.rotation.x = Math.PI / 2;
    lantern.position.set(0, HALL_HEIGHT - 0.05, cz);
    grp.add(lantern);

    for (const bz of [-4.6, 4.6]) {
      const beam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(ROOM_WIDTH, 0.38, 0.45)), trimMat);
      beam.position.set(0, HALL_HEIGHT - 0.19, cz + bz);
      grp.add(beam);
    }
    for (const bx of [-3.6, 3.6]) {
      const beam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.45, 0.38, ROOM_DEPTH)), trimMat);
      beam.position.set(bx, HALL_HEIGHT - 0.19, cz);
      grp.add(beam);
    }

    // Subtle corner ferns in dark ceramic pots
    const px = ROOM_HALF_WIDTH - 1.1;
    grp.add(buildCornerPlanter(-px, room.southZ - 1.25, 'fern', trackGeo, trackMat, trimMat));
    grp.add(buildCornerPlanter(px, room.southZ - 1.25, 'fern', trackGeo, trackMat, trimMat));
  } else if (room.shape === 'cross_hall') {
    // 5. GRAND CROSS / X-SHAPED HALL (18 artworks):
    //    Monumental cruciform (+) + diagonal X floor inlay, intersecting X-rib skylight ceiling,
    //    four grand classical crossing columns, and wide East/West transept wings!
    const darkInlayMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: wallTheme === 'charcoal' ? 0x3b3530 : 0xcfc4b2,
        roughness: 0.38,
        metalness: 0.1,
      })
    );

    // Cruciform (+) stone avenue runners along North-South nave & East-West transept wings
    const nsRunner = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(5.6, room.depth - 3.2)),
      inlayMat
    );
    nsRunner.rotation.x = -Math.PI / 2;
    nsRunner.position.set(0, 0.016, cz);
    grp.add(nsRunner);

    const ewRunner = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(CROSS_WING_HALF_WIDTH * 2 - 3.6, 5.6)),
      inlayMat
    );
    ewRunner.rotation.x = -Math.PI / 2;
    ewRunner.position.set(0, 0.018, cz);
    grp.add(ewRunner);

    // Bold Diagonal "X" Architectural Floor Mosaic Beams across the Grand Crossing
    const diagBarGeo = trackGeo(new THREE.PlaneGeometry(1.45, 16.2));
    const diagTrimGeo = trackGeo(new THREE.PlaneGeometry(0.16, 16.4));
    for (const angle of [Math.PI / 4, -Math.PI / 4]) {
      const xBar = new THREE.Mesh(diagBarGeo, darkInlayMat);
      xBar.rotation.x = -Math.PI / 2;
      xBar.rotation.z = angle;
      xBar.position.set(0, 0.022, cz);
      grp.add(xBar);

      const xBrass = new THREE.Mesh(diagTrimGeo, brassMat);
      xBrass.rotation.x = -Math.PI / 2;
      xBrass.rotation.z = angle;
      xBrass.position.set(0, 0.025, cz);
      grp.add(xBrass);
    }

    // Central Octagonal Brass Medallion encircling the centerpiece plinth
    const medRing = new THREE.Mesh(trackGeo(new THREE.RingGeometry(4.6, 4.82, 8)), brassMat);
    medRing.rotation.x = -Math.PI / 2;
    medRing.position.set(0, 0.026, cz);
    grp.add(medRing);

    // Four Monumental Classical Columns framing the 4 inner corners of the Cross / X intersection
    const colShaftGeo = trackGeo(new THREE.CylinderGeometry(0.42, 0.48, HALL_HEIGHT - 0.72, 16));
    const colBaseGeo = trackGeo(new THREE.BoxGeometry(1.18, 0.36, 1.18));
    const colCapGeo = trackGeo(new THREE.BoxGeometry(1.18, 0.32, 1.18));
    const crossingCorners: Array<[number, number]> = [
      [-ROOM_HALF_WIDTH + 0.52, cz - CROSS_WING_HALF_DEPTH + 0.52],
      [ROOM_HALF_WIDTH - 0.52, cz - CROSS_WING_HALF_DEPTH + 0.52],
      [-ROOM_HALF_WIDTH + 0.52, cz + CROSS_WING_HALF_DEPTH - 0.52],
      [ROOM_HALF_WIDTH - 0.52, cz + CROSS_WING_HALF_DEPTH - 0.52],
    ];
    for (const [cx, cornerZ] of crossingCorners) {
      const colBase = new THREE.Mesh(colBaseGeo, trimMat);
      colBase.position.set(cx, 0.18, cornerZ);
      grp.add(colBase);

      const colShaft = new THREE.Mesh(colShaftGeo, wallMat);
      colShaft.position.set(cx, HALL_HEIGHT / 2, cornerZ);
      colShaft.castShadow = true;
      grp.add(colShaft);

      const colCap = new THREE.Mesh(colCapGeo, brassMat);
      colCap.position.set(cx, HALL_HEIGHT - 0.18, cornerZ);
      grp.add(colCap);
    }

    // Overhead Illuminated "X" & Cruciform Skylights + Intersecting Diagonal Architectural Ribs
    const ribMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x3b2c22, roughness: 0.42, metalness: 0.25 })
    );
    const nsSky = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(3.2, room.depth - 5.2)), skylightMat);
    nsSky.rotation.x = Math.PI / 2;
    nsSky.position.set(0, HALL_HEIGHT - 0.05, cz);
    grp.add(nsSky);

    const ewSky = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(CROSS_WING_HALF_WIDTH * 2 - 5.2, 3.2)),
      skylightMat
    );
    ewSky.rotation.x = Math.PI / 2;
    ewSky.position.set(0, HALL_HEIGHT - 0.055, cz);
    grp.add(ewSky);

    // Diagonal X ceiling skylight strips + bold bronze-trimmed intersecting X beams!
    for (const angle of [Math.PI / 4, -Math.PI / 4]) {
      const xRib = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.42, 0.34, 17.6)), ribMat);
      xRib.position.set(0, HALL_HEIGHT - 0.18, cz);
      xRib.rotation.y = angle;
      grp.add(xRib);

      const xBrassLine = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 0.06, 17.6)), brassMat);
      xBrassLine.position.set(0, HALL_HEIGHT - 0.36, cz);
      xBrassLine.rotation.y = angle;
      grp.add(xBrassLine);
    }

    const centerOculus = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(3.4, 0.14, 10, 32)), brassMat);
    centerOculus.rotation.x = Math.PI / 2;
    centerOculus.position.set(0, HALL_HEIGHT - 0.22, cz);
    grp.add(centerOculus);

    // Corner olive planters framing the far West & East transept wings
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        grp.add(
          buildCornerPlanter(
            sx * (CROSS_WING_HALF_WIDTH - 1.15),
            cz + sz * (CROSS_WING_HALF_DEPTH - 1.15),
            'olive',
            trackGeo,
            trackMat,
            trimMat
          )
        );
      }
    }
  } else {
    // 4. SCULPTURE PAVILION: Modernist vertical light fins, linear twin skylights, geometric runner
    const slateMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: wallTheme === 'charcoal' ? 0x3b3733 : 0xcfc7ba,
        roughness: 0.4,
        metalness: 0.12,
      })
    );
    const runner = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(5.2, ROOM_DEPTH - 2.6)), slateMat);
    runner.rotation.x = -Math.PI / 2;
    runner.position.set(0, 0.018, cz);
    grp.add(runner);

    // Twin architectural linear skylights + oak floating ceiling baffles
    const oakMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x9b7a56, roughness: 0.55, metalness: 0.06 })
    );
    for (const sx of [-3.4, 3.4]) {
      const strip = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(2.1, ROOM_DEPTH - 3.6)), skylightMat);
      strip.rotation.x = Math.PI / 2;
      strip.position.set(sx, HALL_HEIGHT - 0.05, cz);
      grp.add(strip);
    }
    for (let i = -3; i <= 3; i++) {
      const baffle = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.2, 0.28, 0.18)), oakMat);
      baffle.position.set(0, HALL_HEIGHT - 0.18, cz + i * 2.1);
      grp.add(baffle);
    }

    // Sculptural vertical dividing fins between the 3 side-wall artworks
    const finGeo = trackGeo(new THREE.BoxGeometry(0.45, HALL_HEIGHT - 0.5, 0.16));
    for (const s of [-1, 1]) {
      for (const fz of [-2.35, 2.35]) {
        const fin = new THREE.Mesh(finGeo, oakMat);
        fin.position.set(s * (ROOM_HALF_WIDTH - 0.24), HALL_HEIGHT / 2, cz + fz);
        grp.add(fin);
      }
    }
  }

  // Subtle side baseboards for standard rooms without Salon wainscoting
  if (room.shape !== 'salon' && room.shape !== 'cross_hall') {
    const baseGeo = trackGeo(new THREE.BoxGeometry(0.12, 0.3, room.depth - 0.5));
    for (const s of [-1, 1]) {
      const base = new THREE.Mesh(baseGeo, baseboardMat);
      base.position.set(s * (ROOM_HALF_WIDTH - 0.04), 0.15, cz);
      grp.add(base);
    }
  }

  // Room-specific sculptural Flower Vase Centerpiece
  grp.add(
    buildCenterpieceFlowerVase(
      room.shape,
      cz,
      wallTheme,
      trackGeo,
      trackMat,
      brassMat,
      trimMat
    )
  );

  return grp;
}

/**
 * Dynamically constructs the complete multi-room 3D museum from layout, artworks,
 * wallTheme, and custom room names. Every room holds 8 artwork walls, features its own
 * distinct architectural shape & procedural flower vase centerpiece, and connects via
 * interactive hinged double-leaf doors with clickable room-name signboards above each door.
 */
export function buildMuseumArchitecture(
  layout: MuseumLayout,
  artworks: ArtworkItem[],
  wallTheme: WallTheme,
  maxAnisotropy: number,
  roomNames?: Record<string, string>,
  onTextureReady?: () => void
): BuiltMuseum {
  const group = new THREE.Group();
  const interactables: THREE.Object3D[] = [];
  const doors: DoorRig[] = [];
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

  const palette = WALL_PALETTES[wallTheme];
  const centerZ = (layout.southWallZ + layout.northWallZ) / 2;

  // --- FLOOR (Veined Travertine Marble Tiles) ---
  const floorTex = createMarbleFloorTextures(maxAnisotropy);
  trackTex(floorTex.map);
  trackTex(floorTex.bumpMap);
  floorTex.map.repeat.set(ROOM_WIDTH / 3.4, layout.totalLength / 3.4);
  floorTex.bumpMap.repeat.set(ROOM_WIDTH / 3.4, layout.totalLength / 3.4);

  const floorMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: floorTex.map,
      bumpMap: floorTex.bumpMap,
      bumpScale: 0.015,
      roughness: 0.28,
      metalness: 0.06,
    })
  );

  const floor = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(ROOM_WIDTH, layout.totalLength)),
    floorMat
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, centerZ);
  floor.receiveShadow = true;
  group.add(floor);

  // --- SHARED ARCHITECTURAL MATERIALS ---
  const wallTex = trackTex(createPlasterWallTexture(palette.wall, maxAnisotropy));
  wallTex.repeat.set(layout.totalLength / 6, 2);

  const wallMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: wallTex,
      roughness: 0.88,
      metalness: 0.02,
    })
  );

  const trimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: palette.trim,
      roughness: 0.58,
      metalness: 0.08,
    })
  );

  const baseboardMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: palette.baseboard,
      roughness: 0.48,
      metalness: 0.1,
    })
  );

  const brassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xc2975c,
      roughness: 0.24,
      metalness: 0.88,
    })
  );

  const ceilingMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: palette.ceiling,
      roughness: 0.9,
      metalness: 0.02,
    })
  );

  const skylightMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfffcf5,
      emissive: new THREE.Color(0xfff5e4),
      emissiveIntensity: wallTheme === 'charcoal' ? 0.55 : 0.84,
      roughness: 0.2,
      metalness: 0.05,
    })
  );

  // --- OUTER PERIMETER SHELL (PER-ROOM RECTANGULAR OR CRUCIFORM CROSS / X-HALL) ---
  const endWallGeo = trackGeo(new THREE.BoxGeometry(ROOM_WIDTH + 0.84, HALL_HEIGHT, 0.42));
  const northEndWall = new THREE.Mesh(endWallGeo, wallMat);
  northEndWall.position.set(0, HALL_HEIGHT / 2, layout.northWallZ - 0.21);
  northEndWall.receiveShadow = true;
  group.add(northEndWall);

  // Separate tiled floor material for Cross Hall wings so marble tile scale stays crisp
  const wingArmLen = CROSS_WING_HALF_WIDTH - ROOM_HALF_WIDTH; // 10.0m each wing
  const wingFloorTex = createMarbleFloorTextures(maxAnisotropy);
  trackTex(wingFloorTex.map);
  trackTex(wingFloorTex.bumpMap);
  wingFloorTex.map.repeat.set(wingArmLen / 3.4, CROSS_WING_DEPTH / 3.4);
  wingFloorTex.bumpMap.repeat.set(wingArmLen / 3.4, CROSS_WING_DEPTH / 3.4);
  const wingFloorMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: wingFloorTex.map,
      bumpMap: wingFloorTex.bumpMap,
      bumpScale: 0.015,
      roughness: 0.28,
      metalness: 0.06,
    })
  );

  const ceiling = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(ROOM_WIDTH + 0.4, layout.totalLength + 0.4)),
    ceilingMat
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, HALL_HEIGHT, centerZ);
  group.add(ceiling);

  // Build per-room outer walls, cruciform Cross-Hall transept wings & distinct room interiors
  for (const room of layout.rooms) {
    if (!room.isCrossHall) {
      const sideGeo = trackGeo(new THREE.BoxGeometry(0.42, HALL_HEIGHT, room.depth));
      const corniceGeo = trackGeo(new THREE.BoxGeometry(0.24, 0.26, room.depth));
      for (const s of [-1, 1]) {
        const w = new THREE.Mesh(sideGeo, wallMat);
        w.position.set(s * (ROOM_HALF_WIDTH + 0.21), HALL_HEIGHT / 2, room.centerZ);
        w.receiveShadow = true;
        group.add(w);

        const cornice = new THREE.Mesh(corniceGeo, trimMat);
        cornice.position.set(s * (ROOM_HALF_WIDTH - 0.1), HALL_HEIGHT - 0.13, room.centerZ);
        group.add(cornice);
      }
    } else {
      // Cruciform Cross / X-Hall shell: South & North arm side walls + wide West & East transept wings!
      const armDepth = (room.depth - CROSS_WING_DEPTH) / 2; // 7.6m each arm
      const armWallGeo = trackGeo(new THREE.BoxGeometry(0.42, HALL_HEIGHT, armDepth));
      const wingSideWallGeo = trackGeo(new THREE.BoxGeometry(wingArmLen + 0.42, HALL_HEIGHT, 0.42));
      const wingEndWallGeo = trackGeo(new THREE.BoxGeometry(0.42, HALL_HEIGHT, CROSS_WING_DEPTH + 0.84));
      const wingFloorGeo = trackGeo(new THREE.PlaneGeometry(wingArmLen, CROSS_WING_DEPTH));
      const wingCeilGeo = trackGeo(new THREE.PlaneGeometry(wingArmLen + 0.4, CROSS_WING_DEPTH + 0.4));

      for (const sx of [-1, 1]) {
        // South-Arm & North-Arm side walls flanking the central nave
        for (const sz of [-1, 1]) {
          const armZ = room.centerZ + sz * (CROSS_WING_HALF_DEPTH + armDepth / 2);
          const armWall = new THREE.Mesh(armWallGeo, wallMat);
          armWall.position.set(sx * (ROOM_HALF_WIDTH + 0.21), HALL_HEIGHT / 2, armZ);
          armWall.receiveShadow = true;
          group.add(armWall);
        }

        // Transept Wing Floor & Ceiling (non-overlapping with central nave floor)
        const wingCenterX = sx * (ROOM_HALF_WIDTH + wingArmLen / 2);
        const wFloor = new THREE.Mesh(wingFloorGeo, wingFloorMat);
        wFloor.rotation.x = -Math.PI / 2;
        wFloor.position.set(wingCenterX, 0, room.centerZ);
        wFloor.receiveShadow = true;
        group.add(wFloor);

        const wCeil = new THREE.Mesh(wingCeilGeo, ceilingMat);
        wCeil.rotation.x = Math.PI / 2;
        wCeil.position.set(wingCenterX, HALL_HEIGHT, room.centerZ);
        group.add(wCeil);

        // Transept Wing South & North Walls + baseboards + upper cornices
        for (const sz of [-1, 1]) {
          const wingWallZ = room.centerZ + sz * (CROSS_WING_HALF_DEPTH + 0.21);
          const wingSideWall = new THREE.Mesh(wingSideWallGeo, wallMat);
          wingSideWall.position.set(wingCenterX, HALL_HEIGHT / 2, wingWallZ);
          wingSideWall.receiveShadow = true;
          group.add(wingSideWall);

          const wBase = new THREE.Mesh(
            trackGeo(new THREE.BoxGeometry(wingArmLen, 0.3, 0.12)),
            baseboardMat
          );
          wBase.position.set(wingCenterX, 0.15, room.centerZ + sz * (CROSS_WING_HALF_DEPTH - 0.04));
          group.add(wBase);

          const wCornice = new THREE.Mesh(
            trackGeo(new THREE.BoxGeometry(wingArmLen, 0.26, 0.24)),
            trimMat
          );
          wCornice.position.set(wingCenterX, HALL_HEIGHT - 0.13, room.centerZ + sz * (CROSS_WING_HALF_DEPTH - 0.1));
          group.add(wCornice);
        }

        // Far West / Far East Wing End Wall
        const endX = sx * (CROSS_WING_HALF_WIDTH + 0.21);
        const wingEndWall = new THREE.Mesh(wingEndWallGeo, wallMat);
        wingEndWall.position.set(endX, HALL_HEIGHT / 2, room.centerZ);
        wingEndWall.receiveShadow = true;
        group.add(wingEndWall);

        const endBase = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(0.12, 0.3, CROSS_WING_DEPTH)),
          baseboardMat
        );
        endBase.position.set(sx * (CROSS_WING_HALF_WIDTH - 0.04), 0.15, room.centerZ);
        group.add(endBase);
      }
    }

    group.add(
      buildRoomSpecificArchitecture(
        room,
        wallTheme,
        wallMat,
        trimMat,
        baseboardMat,
        brassMat,
        skylightMat,
        trackGeo,
        trackMat
      )
    );
  }

  // --- BUILD INTERACTIVE CONNECTING DOORS BETWEEN ROOMS ---
  for (const door of layout.doors) {
    const fromName = getResolvedRoomName(door.fromRoomIndex, roomNames);
    const toName = getResolvedRoomName(door.toRoomIndex, roomNames);
    const assembly = buildDoorwayAssembly({
      z: door.z,
      isInteractivePassage: true,
      doorId: door.id,
      fromRoomIndex: door.fromRoomIndex,
      toRoomIndex: door.toRoomIndex,
      southSign: {
        roomIndex: door.toRoomIndex,
        roomName: toName,
        hint: 'Press [F] or Click Door · Click Sign to Rename',
      },
      northSign: {
        roomIndex: door.fromRoomIndex,
        roomName: fromName,
        hint: 'Press [F] or Click Door · Click Sign to Rename',
      },
      wallMat,
      trimMat,
      brassMat,
      maxAnisotropy,
      trackGeo,
      trackMat,
      trackTex,
      interactables,
    });
    group.add(assembly.group);
    if (assembly.doorRig) {
      doors.push(assembly.doorRig);
    }
  }

  // --- ROOM 1 SOUTH EXIT DOOR TO OUTDOOR GARDEN & REAL-WORLD HIGHWAY ---
  const firstRoomName = getResolvedRoomName(0, roomNames);
  const southPortal = buildDoorwayAssembly({
    z: layout.southWallZ,
    isInteractivePassage: true,
    doorId: EXIT_DOOR_ID,
    fromRoomIndex: 0,
    toRoomIndex: -1,
    northSign: {
      roomIndex: -1,
      roomName: 'Garden & Highway Exit',
      hint: 'Press [F] or Click Door to Step Outside',
    },
    southSign: {
      roomIndex: 0,
      roomName: firstRoomName,
      hint: 'Press [F] or Click Door to Enter Museum',
    },
    wallMat,
    trimMat,
    brassMat,
    maxAnisotropy,
    trackGeo,
    trackMat,
    trackTex,
    interactables,
  });
  group.add(southPortal.group);
  if (southPortal.doorRig) {
    doors.push(southPortal.doorRig);
  }

  // --- FINAL ROOM NORTH EXPANSION PORTAL DOOR + CLICKABLE SIGNBOARD ---
  const lastRoom = layout.rooms[layout.rooms.length - 1];
  const lastRoomName = getResolvedRoomName(lastRoom.index, roomNames);
  const nextRoomNumeral = toRomanNumeral(lastRoom.roomNumber + 1);
  const northPortal = buildDoorwayAssembly({
    z: layout.northWallZ + 0.08,
    isInteractivePassage: false,
    southSign: {
      roomIndex: lastRoom.index,
      roomName: lastRoomName,
      hint: `Click Sign to Rename · Add >${layout.totalWallSlots} Works to Open Room ${nextRoomNumeral}`,
    },
    wallMat,
    trimMat,
    brassMat,
    maxAnisotropy,
    trackGeo,
    trackMat,
    trackTex,
    interactables,
  });
  group.add(northPortal.group);

  // --- FRAMED ARTWORKS ON 8 WALL SLOTS PER ROOM ---
  const textureLoader = new THREE.TextureLoader();
  textureLoader.setCrossOrigin('anonymous');

  const matBoardMaterial = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xfaf7f0, roughness: 0.9, metalness: 0.0 })
  );
  const lampBarMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfff3dc,
      emissive: new THREE.Color(0xffe9c2),
      emissiveIntensity: 1.2,
      roughness: 0.2,
    })
  );

  for (let slot = 0; slot < layout.totalWallSlots; slot++) {
    const placement = getArtworkPlacement(slot);
    const artwork = artworks[slot];

    const slotGroup = new THREE.Group();
    slotGroup.position.set(placement.x, placement.y, placement.z);
    slotGroup.rotation.y = placement.rotY;

    if (!artwork) {
      const outline = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(2.35, 1.75, 0.03)),
        trackMat(
          new THREE.MeshStandardMaterial({
            color: wallTheme === 'charcoal' ? 0x35312d : 0xe4ddd2,
            roughness: 0.85,
          })
        )
      );
      slotGroup.add(outline);

      const hook = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 10)),
        brassMat
      );
      hook.rotation.x = Math.PI / 2;
      hook.position.set(0, 0.68, 0.03);
      slotGroup.add(hook);

      group.add(slotGroup);
      continue;
    }

    // Slightly more compact framing on North/South walls so frames clear doorways & wing pairs gracefully
    const scale = placement.wallSide === 'north' || placement.wallSide === 'south' ? 0.88 : 1.0;
    const artW =
      (artwork.aspectRatio === '3:4' ? 1.85 : artwork.aspectRatio === '1:1' ? 2.15 : 2.65) * scale;
    const artH =
      (artwork.aspectRatio === '3:4' ? 2.4 : artwork.aspectRatio === '1:1' ? 2.15 : 2.0) * scale;
    const frameBorder = 0.13;
    const matMargin = 0.15;
    const outerW = artW + (frameBorder + matMargin) * 2;
    const outerH = artH + (frameBorder + matMargin) * 2;

    const fSpec = FRAME_COLORS[artwork.frameStyle] ?? FRAME_COLORS.bronze;
    const frameMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: fSpec.color,
        roughness: fSpec.roughness,
        metalness: fSpec.metalness,
      })
    );

    const topBar = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(outerW, frameBorder, 0.14)),
      frameMat
    );
    topBar.position.set(0, outerH / 2 - frameBorder / 2, 0.07);
    slotGroup.add(topBar);

    const botBar = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(outerW, frameBorder, 0.14)),
      frameMat
    );
    botBar.position.set(0, -outerH / 2 + frameBorder / 2, 0.07);
    slotGroup.add(botBar);

    const leftBar = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(frameBorder, outerH - frameBorder * 2, 0.14)),
      frameMat
    );
    leftBar.position.set(-outerW / 2 + frameBorder / 2, 0, 0.07);
    slotGroup.add(leftBar);

    const rightBar = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(frameBorder, outerH - frameBorder * 2, 0.14)),
      frameMat
    );
    rightBar.position.set(outerW / 2 - frameBorder / 2, 0, 0.07);
    slotGroup.add(rightBar);

    const matPlane = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(artW + matMargin * 2, artH + matMargin * 2, 0.05)),
      matBoardMaterial
    );
    matPlane.position.set(0, 0, 0.03);
    slotGroup.add(matPlane);

    const fallbackTex = trackTex(createFallbackArtworkTexture(artwork.title));
    const artMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: fallbackTex,
        roughness: 0.62,
        metalness: 0.02,
      })
    );

    const artPlane = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(artW, artH)), artMat);
    artPlane.position.set(0, 0, 0.068);
    artPlane.userData.artworkId = artwork.id;
    slotGroup.add(artPlane);
    interactables.push(artPlane);

    if (artwork.imageUrl) {
      textureLoader.load(
        artwork.imageUrl,
        (loadedTex) => {
          loadedTex.colorSpace = THREE.SRGBColorSpace;
          loadedTex.anisotropy = maxAnisotropy;
          if (artwork.cropMargin && artwork.cropMargin > 0) {
            const m = artwork.cropMargin;
            loadedTex.repeat.set(1 - m * 2, 1 - m * 2);
            loadedTex.offset.set(m, m);
          }
          trackTex(loadedTex);
          artMat.map = loadedTex;
          artMat.needsUpdate = true;
          onTextureReady?.();
        },
        undefined,
        () => {
          // Keep clean fallback canvas texture
        }
      );
    }

    // Brass Museum Picture Light Bar above frame
    const lampArm = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.08, 0.08, 0.32)),
      brassMat
    );
    lampArm.position.set(0, outerH / 2 + 0.2, 0.15);
    slotGroup.add(lampArm);

    const lampHood = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.038, 0.042, Math.min(1.2, artW * 0.52), 12)),
      brassMat
    );
    lampHood.rotation.z = Math.PI / 2;
    lampHood.position.set(0, outerH / 2 + 0.2, 0.32);
    slotGroup.add(lampHood);

    const lampGlow = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(Math.min(1.1, artW * 0.48), 0.024, 0.04)),
      lampBarMat
    );
    lampGlow.position.set(0, outerH / 2 + 0.16, 0.32);
    slotGroup.add(lampGlow);

    // Museum Wall Accession Plaque (below-center on North walls to save horizontal room; right side on West/East)
    const accession = formatAccessionNumber(artwork.dateCaptured, slot);
    const plaqueTex = trackTex(
      createPlaqueTexture(artwork.title, artwork.artist, artwork.dateCaptured, accession, maxAnisotropy)
    );
    const plaque = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.58, 0.29, 0.025)),
      trackMat(
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: plaqueTex,
          roughness: 0.5,
          metalness: 0.04,
        })
      )
    );
    if (placement.wallSide === 'north' || placement.wallSide === 'south') {
      plaque.position.set(0, -outerH / 2 - 0.28, 0.02);
    } else {
      plaque.position.set(outerW / 2 + 0.38, -outerH / 2 + 0.32, 0.02);
    }
    plaque.userData.artworkId = artwork.id;
    slotGroup.add(plaque);
    interactables.push(plaque);

    group.add(slotGroup);
  }

  return {
    group,
    interactables,
    doors,
    dispose: () => {
      for (const d of disposables) {
        d.dispose();
      }
    },
  };
}
