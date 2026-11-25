import * as THREE from 'three';
import {
  AMUSEMENT_RIDES,
  computeChorkiWheelAngle,
  computeDolnaSwingAngle,
  type AmusementRideDefinition,
} from '../museum/amusementPark';
import {
  buildRollerCoaster,
  type BuiltRollerCoaster,
} from './rollerCoasterBuilder';
import {
  type CoasterPose,
  type CoasterState,
} from '../museum/rollerCoaster';
import {
  buildWaterRide,
  type BuiltWaterRide,
} from './waterRideBuilder';
import {
  type WaterSlidePose,
  type WaterSlideState,
} from '../museum/waterRide';

export interface BuiltAmusementParks {
  group: THREE.Group;
  interactables: THREE.Object3D[];
  coaster: BuiltRollerCoaster;
  waterRide: BuiltWaterRide;
  /**
   * Animates West & East Chorkis (Ferris Wheels), Dolnas (Pendulum Swings),
   * companion park swings, East Park Roller Coaster, West Park Water Slide,
   * swimming pool visitors, and park crowds.
   */
  update: (
    delta: number,
    elapsed: number,
    options: {
      boostActive: boolean;
      coasterState: CoasterState;
      waterSlideState: WaterSlideState;
    }
  ) => {
    coasterPose: CoasterPose;
    waterSlidePose: WaterSlidePose;
  };
  dispose: () => void;
}

function createParkBannerTexture(
  title: string,
  subtitle: string,
  bgHex: string,
  accentHex: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const w = 1024;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 12;
  ctx.strokeRect(14, 14, w - 28, h - 28);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 60px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(title, w / 2, 118);

  ctx.fillStyle = accentHex;
  ctx.font = '700 30px "JetBrains Mono", monospace';
  ctx.fillText(subtitle, w / 2, 194);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Seated NPC rider with cheerful pose (cheering arms or holding handrail),
 * placed inside gondolas, dolna boats, and mini-swings so people are visibly riding!
 */
function buildSeatedParkNpc(
  shirtHex: number,
  skinHex: number,
  armsUp: boolean,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T
): THREE.Group {
  const g = new THREE.Group();
  const shirtMat = trackMat(new THREE.MeshStandardMaterial({ color: shirtHex, roughness: 0.72 }));
  const skinMat = trackMat(new THREE.MeshStandardMaterial({ color: skinHex, roughness: 0.65 }));
  const hairMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x191614, roughness: 0.85 }));

  const torso = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.36, 0.44, 0.22)), shirtMat);
  torso.position.y = 0.24;
  g.add(torso);

  const head = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.135, 10, 8)), skinMat);
  head.position.y = 0.6;
  g.add(head);

  const hair = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.14, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55)),
    hairMat
  );
  hair.position.set(0, 0.62, -0.01);
  g.add(hair);

  const armGeo = trackGeo(new THREE.CylinderGeometry(0.038, 0.035, 0.38, 6));
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(armGeo, shirtMat);
    if (armsUp) {
      arm.position.set(s * 0.24, 0.56, 0.04);
      arm.rotation.z = -s * 0.42;
    } else {
      arm.position.set(s * 0.22, 0.32, 0.14);
      arm.rotation.x = Math.PI * 0.34;
    }
    g.add(arm);
  }
  return g;
}

/**
 * Builds Twin Amusement Parks on BOTH sides (West & East) of the Museum!
 * Each side features:
 * - A grand Chorki (Ferris Wheel) with 8 rotating gondolas and cheering NPC riders
 * - A giant Boro Dolna (pendulum swing boat) with 4 cheering NPC riders
 * - Companion classic park chain-swings with swinging NPC riders
 * - Boarding decks, illuminated signs, and interactable ride targets
 */
export function buildAmusementParks(maxAnisotropy: number): BuiltAmusementParks {
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

  // Shared PBR materials
  const steelMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.35, metalness: 0.75 }));
  const whiteSteelMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.36, metalness: 0.45 }));
  const redMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.32, metalness: 0.35 }));
  const goldMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.28, metalness: 0.72 }));
  const royalBlueMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.34, metalness: 0.35 }));
  const woodMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.68, metalness: 0.05 }));
  const plazaMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xd6cab8, roughness: 0.82, metalness: 0.02 }));

  // Helper: Park Entrance Archway
  const buildWelcomeArch = (
    x: number,
    z: number,
    rotY: number,
    title: string,
    subtitle: string,
    bgHex: string,
    accentHex: string
  ) => {
    const arch = new THREE.Group();
    arch.position.set(x, 0, z);
    arch.rotation.y = rotY;
    for (const sx of [-3.4, 3.4]) {
      const col = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.26, 0.32, 5.2, 10)), whiteSteelMat);
      col.position.set(sx, 2.6, 0);
      arch.add(col);
      const orb = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.36, 10, 8)), goldMat);
      orb.position.set(sx, 5.35, 0);
      arch.add(orb);
    }
    const boardTex = trackTex(createParkBannerTexture(title, subtitle, bgHex, accentHex, maxAnisotropy));
    const boardMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: boardTex,
        emissive: new THREE.Color(0xffffff),
        emissiveMap: boardTex,
        emissiveIntensity: 0.24,
        roughness: 0.42,
      })
    );
    const frame = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(7.2, 1.55, 0.22)), steelMat);
    frame.position.set(0, 4.75, 0);
    arch.add(frame);
    const front = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(7.0, 1.42)), boardMat);
    front.position.set(0, 4.75, 0.12);
    arch.add(front);
    const back = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(7.0, 1.42)), boardMat);
    back.position.set(0, 4.75, -0.12);
    back.rotation.y = Math.PI;
    arch.add(back);
    group.add(arch);
  };

  // 1. Plazas & Arches on BOTH sides of the Museum
  // West Plaza frames all attractions (Dolna, Chorki, Water Tower & Pool)
  // Built as 4 non-overlapping paved slabs framing the Grand Swimming Pool so no ground plane cuts into the pool basin!
  const poolMinX = -69.0;
  const poolMaxX = -53.5;
  const poolMinZ = 11.5;
  const poolMaxZ = 20.5;
  const westTotalMinX = -81.0;
  const westTotalMaxX = -21.0;
  const westTotalMinZ = -1.5;
  const westTotalMaxZ = 24.5;

  // North Slab (above pool & chorki/dolna): x: -81 to -21, z: -1.5 to 11.5
  const northW = westTotalMaxX - westTotalMinX;
  const northL = poolMinZ - westTotalMinZ;
  const northPlaza = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(northW, northL)), plazaMat);
  northPlaza.rotation.x = -Math.PI / 2;
  northPlaza.position.set((westTotalMinX + westTotalMaxX) / 2, 0.025, (westTotalMinZ + poolMinZ) / 2);
  northPlaza.receiveShadow = true;
  group.add(northPlaza);

  // South Slab (below pool along road sidewalk): x: -81 to -21, z: 20.5 to 24.5
  const southW = westTotalMaxX - westTotalMinX;
  const southL = westTotalMaxZ - poolMaxZ;
  const southPlaza = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(southW, southL)), plazaMat);
  southPlaza.rotation.x = -Math.PI / 2;
  southPlaza.position.set((westTotalMinX + westTotalMaxX) / 2, 0.025, (poolMaxZ + westTotalMaxZ) / 2);
  southPlaza.receiveShadow = true;
  group.add(southPlaza);

  // East Slab (between Museum/Dolna/Chorki and Pool east edge): x: -53.5 to -21, z: 11.5 to 20.5
  const eastW = westTotalMaxX - poolMaxX;
  const eastL = poolMaxZ - poolMinZ;
  const eastPlazaWestPark = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(eastW, eastL)), plazaMat);
  eastPlazaWestPark.rotation.x = -Math.PI / 2;
  eastPlazaWestPark.position.set((poolMaxX + westTotalMaxX) / 2, 0.025, (poolMinZ + poolMaxZ) / 2);
  eastPlazaWestPark.receiveShadow = true;
  group.add(eastPlazaWestPark);

  // West Slab (dry promenade between Pool west edge and outer park edge): x: -81 to -69, z: 11.5 to 20.5
  const westW = poolMinX - westTotalMinX;
  const westL = poolMaxZ - poolMinZ;
  const westPlazaWestPark = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(westW, westL)), plazaMat);
  westPlazaWestPark.rotation.x = -Math.PI / 2;
  westPlazaWestPark.position.set((westTotalMinX + poolMinX) / 2, 0.025, (poolMinZ + poolMaxZ) / 2);
  westPlazaWestPark.receiveShadow = true;
  group.add(westPlazaWestPark);

  // East Plaza: Expanded across all 3 non-overlapping attractions: Dolna (31.5) -> Chorki (45.0) -> Mega Coaster (58.0 to 84.0)
  const eastPlaza = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(64, 26)), plazaMat);
  eastPlaza.rotation.x = -Math.PI / 2;
  eastPlaza.position.set(53.0, 0.025, 11.5);
  eastPlaza.receiveShadow = true;
  group.add(eastPlaza);

  buildWelcomeArch(-22, 11.5, Math.PI / 2, 'AMUSEMENT PARK', 'WATER SLIDE · CHORKI · DOLNA · POOL', '#0284C7', '#FDE047');
  buildWelcomeArch(22, 11.5, -Math.PI / 2, 'AMUSEMENT PARK', 'ROLLER COASTER · CHORKI · DOLNA', '#9F1239', '#FDE047');

  // Animation hooks
  interface ChorkiRig {
    ride: AmusementRideDefinition;
    wheelGroup: THREE.Group;
    gondolaPivots: THREE.Group[];
  }
  interface DolnaRig {
    ride: AmusementRideDefinition;
    pivotGroup: THREE.Group;
  }
  const chorkiRigs: ChorkiRig[] = [];
  const dolnaRigs: DolnaRig[] = [];
  const miniSwingPivots: THREE.Group[] = [];

  const gondolaColors = [0xef4444, 0xf59e0b, 0x10b981, 0x0ea5e9, 0x8b5cf6, 0xec4899, 0x14b8a6, 0xf97316];

  // 2. Build Chorki (Ferris Wheel) & Dolna (Pendulum Swing) for each ride definition
  for (const ride of AMUSEMENT_RIDES) {
    if (ride.kind === 'chorki') {
      const chorkiRoot = new THREE.Group();
      chorkiRoot.position.set(ride.x, 0, ride.z);

      // Support A-frame legs
      const legGeo = trackGeo(new THREE.CylinderGeometry(0.24, 0.34, 12.6, 10));
      for (const sz of [-1.45, 1.45]) {
        for (const sx of [-1, 1]) {
          const leg = new THREE.Mesh(legGeo, whiteSteelMat);
          leg.position.set(sx * 2.75, 5.75, sz);
          leg.rotation.z = sx * 0.42;
          chorkiRoot.add(leg);
        }
        const footing = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(10.8, 0.45, 0.9)), steelMat);
        footing.position.set(0, 0.225, sz);
        chorkiRoot.add(footing);
      }

      // Central axle
      const axle = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.45, 0.45, 3.6, 14)), goldMat);
      axle.rotation.x = Math.PI / 2;
      axle.position.set(0, ride.hubY, 0);
      chorkiRoot.add(axle);

      // Wheel group spinning in X-Y plane
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(0, ride.hubY, 0);

      const rimGeo = trackGeo(new THREE.TorusGeometry(ride.armLength, 0.2, 10, 40));
      const innerRimGeo = trackGeo(new THREE.TorusGeometry(ride.armLength * 0.58, 0.11, 8, 32));
      for (const rz of [-0.95, 0.95]) {
        const rim = new THREE.Mesh(rimGeo, redMat);
        rim.position.z = rz;
        rim.userData.rideId = ride.id;
        interactables.push(rim);
        wheelGroup.add(rim);

        const innerRim = new THREE.Mesh(innerRimGeo, goldMat);
        innerRim.position.z = rz;
        wheelGroup.add(innerRim);
      }

      // 8 spokes and 8 gondolas (with NPC riders inside)
      const gondolaCount = 8;
      const gondolaPivots: THREE.Group[] = [];
      const spokeGeo = trackGeo(new THREE.CylinderGeometry(0.08, 0.08, ride.armLength * 2, 8));

      for (let i = 0; i < gondolaCount; i++) {
        const angle = (i / gondolaCount) * Math.PI * 2;
        if (i < gondolaCount / 2) {
          for (const rz of [-0.95, 0.95]) {
            const spoke = new THREE.Mesh(spokeGeo, whiteSteelMat);
            spoke.rotation.z = angle;
            spoke.position.z = rz;
            wheelGroup.add(spoke);
          }
        }

        const gx = Math.cos(angle) * ride.armLength;
        const gy = Math.sin(angle) * ride.armLength;

        // Gondola hanger bar
        const bar = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.07, 0.07, 2.05, 8)), steelMat);
        bar.rotation.x = Math.PI / 2;
        bar.position.set(gx, gy, 0);
        wheelGroup.add(bar);

        // Gondola pivot (keeps cabin upright via gravity counter-rotation)
        const gPivot = new THREE.Group();
        gPivot.position.set(gx, gy, 0);

        const cabinMat = trackMat(
          new THREE.MeshStandardMaterial({
            color: gondolaColors[i % gondolaColors.length],
            roughness: 0.36,
            metalness: 0.18,
          })
        );

        // 1. Cabin floor base tray (y: -1.25, thickness: 0.12)
        const cabinFloor = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.55, 0.12, 1.35)), cabinMat);
        cabinFloor.position.y = -1.25;
        cabinFloor.userData.rideId = ride.id;
        interactables.push(cabinFloor);
        gPivot.add(cabinFloor);

        // 2. Waist-high protective balustrade / walls around bottom (from y = -1.25 to -0.80)
        // Front & Back safety walls
        const frontWall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.55, 0.45, 0.06)), cabinMat);
        frontWall.position.set(0, -1.02, 0.64);
        frontWall.userData.rideId = ride.id;
        interactables.push(frontWall);
        gPivot.add(frontWall);

        const backWall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.55, 0.45, 0.06)), cabinMat);
        backWall.position.set(0, -1.02, -0.64);
        gPivot.add(backWall);

        // Left & Right side walls
        for (const sx of [-0.74, 0.74]) {
          const sideWall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.06, 0.45, 1.22)), cabinMat);
          sideWall.position.set(sx, -1.02, 0);
          gPivot.add(sideWall);
        }

        // 3. Two comfortable wooden passenger benches inside the cabin:
        // Left bench (Host player seat: x = -0.34) & Right bench (Companion seat: x = +0.34)
        for (const sx of [-0.34, 0.34]) {
          const bench = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.52, 0.12, 1.05)), woodMat);
          bench.position.set(sx, -1.13, 0);
          gPivot.add(bench);
        }

        // 4. Polished Brass Safety Handrails on front & back (y: -0.78)
        for (const sz of [-0.64, 0.64]) {
          const rail = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.024, 0.024, 1.52, 8)), goldMat);
          rail.rotation.z = Math.PI / 2;
          rail.position.set(0, -0.78, sz);
          gPivot.add(rail);
        }

        // 5. Four slender golden corner pillars up to canopy (height 1.50m from -1.25 to +0.25)
        for (const sx of [-0.72, 0.72]) {
          for (const sz of [-0.62, 0.62]) {
            const pillar = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.026, 0.026, 1.50, 6)), goldMat);
            pillar.position.set(sx, -0.50, sz);
            gPivot.add(pillar);
          }
        }

        // 6. Overhead Pagoda / Pyramid Canopy Roof (y: +0.38, giving ample 1.5m interior headroom!)
        const roofTrim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.62, 0.06, 1.42)), goldMat);
        roofTrim.position.y = 0.22;
        gPivot.add(roofTrim);

        const roof = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(1.25, 0.46, 4)), goldMat);
        roof.rotation.y = Math.PI / 4;
        roof.position.y = 0.45;
        gPivot.add(roof);

        const finial = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.08, 8, 8)), whiteSteelMat);
        finial.position.y = 0.72;
        gPivot.add(finial);

        // Put cheering NPC riders in some cabins so rides are lively, but leave boarding cabin (index 6, angle = 3pi/2) completely empty!
        if (i === 0 || i === 2 || i === 4) {
          const npc = buildSeatedParkNpc(
            gondolaColors[(i + 3) % gondolaColors.length],
            i % 2 === 0 ? 0xc68e65 : 0xd4a07a,
            i % 4 === 0,
            trackGeo,
            trackMat
          );
          npc.position.set(0.34, -1.08, 0);
          gPivot.add(npc);
        }

        wheelGroup.add(gPivot);
        gondolaPivots.push(gPivot);
      }

      chorkiRoot.add(wheelGroup);

      // Boarding deck & interactive signboard
      const chorkiDeck = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.6, 0.34, 2.8)), woodMat);
      chorkiDeck.position.set(0, 0.17, 3.8);
      chorkiDeck.userData.rideId = ride.id;
      interactables.push(chorkiDeck);
      chorkiRoot.add(chorkiDeck);

      const signTex = trackTex(
        createParkBannerTexture(ride.title.toUpperCase(), 'PRESS [E] TO RIDE', '#B91C1C', '#FDE047', maxAnisotropy)
      );
      const chorkiSign = new THREE.Mesh(
        trackGeo(new THREE.PlaneGeometry(3.8, 0.95)),
        trackMat(new THREE.MeshStandardMaterial({ color: 0xffffff, map: signTex, roughness: 0.45 }))
      );
      chorkiSign.position.set(0, 2.4, 5.15);
      chorkiSign.userData.rideId = ride.id;
      interactables.push(chorkiSign);
      chorkiRoot.add(chorkiSign);

      for (const sx of [-1.7, 1.7]) {
        const p = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 8)), steelMat);
        p.position.set(sx, 1.3, 5.1);
        chorkiRoot.add(p);
      }

      group.add(chorkiRoot);
      chorkiRigs.push({ ride, wheelGroup, gondolaPivots });
    } else if (ride.kind === 'dolna') {
      // 3. Giant Boro Dolna (Pendulum Swing)
      const dolnaRoot = new THREE.Group();
      dolnaRoot.position.set(ride.x, 0, ride.z);

      const dLegGeo = trackGeo(new THREE.CylinderGeometry(0.22, 0.3, 9.8, 10));
      for (const sz of [-2.2, 2.2]) {
        for (const sx of [-1, 1]) {
          const leg = new THREE.Mesh(dLegGeo, royalBlueMat);
          leg.position.set(sx * 2.1, 4.45, sz);
          leg.rotation.z = sx * 0.42;
          dolnaRoot.add(leg);
        }
      }
      const topAxle = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.28, 0.28, 5.2, 12)), goldMat);
      topAxle.rotation.x = Math.PI / 2;
      topAxle.position.set(0, ride.hubY, 0);
      dolnaRoot.add(topAxle);

      // Pendulum pivot group swinging on X axis (swinging in Z-direction)
      const pivotGroup = new THREE.Group();
      pivotGroup.position.set(0, ride.hubY, 0);

      for (const sz of [-1.2, 1.2]) {
        const arm = new THREE.Mesh(
          trackGeo(new THREE.CylinderGeometry(0.09, 0.09, ride.armLength, 8)),
          whiteSteelMat
        );
        arm.position.set(0, -ride.armLength / 2, sz);
        pivotGroup.add(arm);
      }

      const boatHull = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5.2, 1.15, 2.35)), royalBlueMat);
      boatHull.position.set(0, -ride.armLength, 0);
      boatHull.userData.rideId = ride.id;
      interactables.push(boatHull);
      pivotGroup.add(boatHull);

      const boatTrim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5.45, 0.2, 2.48)), goldMat);
      boatTrim.position.set(0, -ride.armLength + 0.56, 0);
      pivotGroup.add(boatTrim);

      for (const sx of [-1, 1]) {
        const prow = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.92, 1.65, 4)), redMat);
        prow.position.set(sx * 3.05, -ride.armLength + 0.42, 0);
        prow.rotation.z = -sx * 0.52;
        pivotGroup.add(prow);
      }

      // Cheering NPC Riders in center of Dolna Boat (leaving benches sx: +1.35 and sx: -1.35 open for player & companion!)
      const dolnaNpcOffsets: Array<[number, number, number]> = [
        [0.0, -0.55, 0xec4899],
        [0.0, 0.55, 0xfacc15],
      ];
      for (const [nx, nz, shirt] of dolnaNpcOffsets) {
        const npc = buildSeatedParkNpc(shirt, 0xc78f66, true, trackGeo, trackMat);
        npc.position.set(nx, -ride.armLength + 0.32, nz);
        pivotGroup.add(npc);
      }

      dolnaRoot.add(pivotGroup);

      // Dolna Boarding Deck & Sign
      const dolnaDeck = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.4, 0.3, 2.2)), woodMat);
      dolnaDeck.position.set(0, 0.15, 4.1);
      dolnaDeck.userData.rideId = ride.id;
      interactables.push(dolnaDeck);
      dolnaRoot.add(dolnaDeck);

      const dolnaSignTex = trackTex(
        createParkBannerTexture(ride.title.toUpperCase(), 'PRESS [E] TO SWING', '#1D4ED8', '#FDE047', maxAnisotropy)
      );
      const dolnaSign = new THREE.Mesh(
        trackGeo(new THREE.PlaneGeometry(3.6, 0.9)),
        trackMat(new THREE.MeshStandardMaterial({ color: 0xffffff, map: dolnaSignTex, roughness: 0.45 }))
      );
      dolnaSign.position.set(0, 2.35, 5.2);
      dolnaSign.userData.rideId = ride.id;
      interactables.push(dolnaSign);
      dolnaRoot.add(dolnaSign);

      for (const sx of [-1.6, 1.6]) {
        const p = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.06, 0.06, 2.5, 8)), steelMat);
        p.position.set(sx, 1.25, 5.15);
        dolnaRoot.add(p);
      }

      group.add(dolnaRoot);
      dolnaRigs.push({ ride, pivotGroup });
    }
  }

  // 4. Companion Park Chain-Swings with seated NPC riders on BOTH West and East sides
  for (const sideX of [-27.5, 27.5]) {
    const swGrp = new THREE.Group();
    swGrp.position.set(sideX, 0, 16.5);
    for (const sx of [-2.4, 2.4]) {
      for (const sz of [-0.9, 0.9]) {
        const leg = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.06, 0.07, 3.6, 8)), redMat);
        leg.position.set(sx, 1.75, sz);
        leg.rotation.x = -Math.sign(sz) * 0.25;
        swGrp.add(leg);
      }
    }
    const bar = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.07, 0.07, 5.2, 8)), goldMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.y = 3.45;
    swGrp.add(bar);

    for (const [idx, sx] of [-1.05, 1.05].entries()) {
      const piv = new THREE.Group();
      piv.position.set(sx, 3.45, 0);
      for (const rx of [-0.32, 0.32]) {
        const chain = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.018, 0.018, 2.45, 6)), steelMat);
        chain.position.set(rx, -1.22, 0);
        piv.add(chain);
      }
      const seat = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.76, 0.08, 0.34)), woodMat);
      seat.position.y = -2.45;
      piv.add(seat);
      const rider = buildSeatedParkNpc(idx === 0 ? 0x0ea5e9 : 0xf43f5e, 0xc89268, false, trackGeo, trackMat);
      rider.position.set(0, -2.4, 0);
      piv.add(rider);
      swGrp.add(piv);
      miniSwingPivots.push(piv);
    }
    group.add(swGrp);
  }

  // 5. East Park Cyclone Roller Coaster & Crowd (Walking Adults & Running Kids)
  const coaster = buildRollerCoaster(maxAnisotropy);
  group.add(coaster.group);
  interactables.push(...coaster.interactables);

  // 6. West Park Tsunami Water Slide & Swimming Pool Aquapark
  const waterRide = buildWaterRide(maxAnisotropy);
  group.add(waterRide.group);
  interactables.push(...waterRide.interactables);

  // Update loop: runs every frame
  const update = (
    delta: number,
    elapsed: number,
    options: {
      boostActive: boolean;
      coasterState: CoasterState;
      waterSlideState: WaterSlideState;
    }
  ): { coasterPose: CoasterPose; waterSlidePose: WaterSlidePose } => {
    // Animate Chorkis (Ferris Wheels) and keep gondolas upright
    for (const c of chorkiRigs) {
      const wheelAngle = computeChorkiWheelAngle(elapsed, c.ride.phase, options.boostActive);
      c.wheelGroup.rotation.z = wheelAngle;
      for (let i = 0; i < c.gondolaPivots.length; i++) {
        // Counter-rotate each gondola cabin so gravity keeps it hanging straight down
        c.gondolaPivots[i].rotation.z = -wheelAngle + Math.sin(elapsed * 1.4 + i) * 0.04;
      }
    }

    // Animate Dolnas (pendulum swing along Z axis by rotating on X)
    for (const d of dolnaRigs) {
      const swingAngle = computeDolnaSwingAngle(elapsed, d.ride.phase, options.boostActive);
      d.pivotGroup.rotation.x = -swingAngle;
    }

    // Animate companion mini swings
    for (let i = 0; i < miniSwingPivots.length; i++) {
      miniSwingPivots[i].rotation.x = Math.sin(elapsed * 2.1 + i * 0.8) * 0.44;
    }

    // Animate Roller Coaster Train & Park Crowd
    const { leadPose } = coaster.update(delta, elapsed, options.coasterState);
    // Animate Water Slide, Swimming Pool Swimmers, and Balloon-playing Kids
    const { sliderPose } = waterRide.update(delta, elapsed, options.waterSlideState);

    return { coasterPose: leadPose, waterSlidePose: sliderPose };
  };

  return {
    group,
    interactables,
    coaster,
    waterRide,
    update,
    dispose: () => {
      coaster.dispose();
      waterRide.dispose();
      for (const d of disposables) {
        d.dispose();
      }
    },
  };
}
