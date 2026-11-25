import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { AvatarConfig } from '../types/museum';
import { isAbidSignatureAvatar } from '../museum/exclusiveAvatar';
import {
  createAbidPlaidTexture,
  createContactShadowTexture,
  createNameplateTexture,
} from './proceduralTextures';

export interface AvatarRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  leftKneePivot?: THREE.Group;
  rightKneePivot?: THREE.Group;
  leftForearmPivot?: THREE.Group;
  rightForearmPivot?: THREE.Group;
  stridePhase: number;
  maxLegSwing: number;
  mixer?: THREE.AnimationMixer;
  isCustomGlb?: boolean;
  dispose: () => void;
}

export interface AvatarBuildOptions {
  showNameplate?: boolean;
  showContactShadow?: boolean;
  nameplateSubtitle?: string;
  statusTone?: 'default' | 'active' | 'standing';
}

/**
 * Builds a high-craft composite procedural 3D human avatar (16+ distinct sculpted parts)
 * differentiated cleanly by Gender ('man' vs 'woman'), hair style, tailored wardrobe,
 * skin tone, colors, and curator accessories. Pivoted flush at bottom-center (y = 0).
 */
export function buildAvatarRig(
  config: AvatarConfig,
  options?: AvatarBuildOptions
): AvatarRig {
  if (isAbidSignatureAvatar(config)) {
    return buildAbidSignatureRig(config, options);
  }

  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const isWoman = config.gender === 'woman';
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

  // Materials with calibrated PBR roughness/metalness contrast
  const skinMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(config.skinTone),
      roughness: 0.62,
      metalness: 0.02,
    })
  );

  const hairMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(config.hairColor),
      roughness: 0.52,
      metalness: 0.08,
    })
  );

  const outfitMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(config.outfitColor),
      roughness: 0.82,
      metalness: 0.04,
      side: THREE.DoubleSide,
    })
  );

  const accentMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(config.accentColor),
      roughness: 0.72,
      metalness: 0.05,
    })
  );

  const trouserColor = new THREE.Color(config.outfitColor).multiplyScalar(0.55);
  const trouserMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: trouserColor,
      roughness: 0.86,
      metalness: 0.02,
      side: THREE.DoubleSide,
    })
  );

  const shoeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x221b17,
      roughness: 0.34,
      metalness: 0.12,
    })
  );

  const metalMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xc99a5b,
      roughness: 0.24,
      metalness: 0.88,
    })
  );

  const darkEyeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x161412,
      roughness: 0.18,
      metalness: 0.1,
    })
  );

  // Contact shadow disc grounded at y = 0.015
  if (options?.showContactShadow !== false) {
    const shadowTex = trackTex(createContactShadowTexture());
    const shadowPlane = new THREE.Mesh(
      trackGeo(new THREE.CircleGeometry(0.46, 24)),
      trackMat(
        new THREE.MeshBasicMaterial({
          map: shadowTex,
          transparent: true,
          depthWrite: false,
          opacity: 0.7,
        })
      )
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.015;
    root.add(shadowPlane);
  }

  // --- LEGS (Articulated from Hip at y = 0.86) ---
  const isSkirted =
    isWoman &&
    (config.outfitStyle === 'dress' ||
      config.outfitStyle === 'coat' ||
      config.outfitStyle === 'blazer_skirt');
  const hipY = isWoman ? 0.85 : 0.88;
  const hipSpread = isWoman ? 0.082 : 0.118;

  const makeLeg = (side: -1 | 1) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * hipSpread, hipY, 0);

    const upperRadiusTop = isWoman ? 0.056 : 0.082;
    const upperRadiusBot = isWoman ? 0.045 : 0.066;
    const legUpperMat =
      isWoman && (config.outfitStyle === 'dress' || config.outfitStyle === 'blazer_skirt')
        ? skinMat
        : trouserMat;

    // For long dresses/coats, keep upper thigh enclosed cleanly inside skirt volume
    if (!isSkirted || config.outfitStyle === 'blazer_skirt') {
      const thigh = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(upperRadiusTop, upperRadiusBot, 0.42, 14)),
        legUpperMat
      );
      thigh.position.y = -0.21;
      thigh.castShadow = true;
      pivot.add(thigh);
    } else {
      const innerThigh = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.046, 0.042, 0.22, 12)),
        legUpperMat
      );
      innerThigh.position.y = -0.31;
      pivot.add(innerThigh);
    }

    const calf = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(upperRadiusBot * 0.96, isWoman ? 0.036 : 0.054, 0.38, 14)),
      legUpperMat
    );
    calf.position.y = -0.58;
    calf.castShadow = true;
    pivot.add(calf);

    // Sculpted Shoe / Boot
    const shoeBase = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(isWoman ? 0.092 : 0.11, isWoman ? 0.075 : 0.08, 0.22)),
      shoeMat
    );
    shoeBase.position.set(0, -hipY + (isWoman ? 0.042 : 0.04), 0.045);
    shoeBase.castShadow = true;
    pivot.add(shoeBase);

    const toeCap = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(isWoman ? 0.046 : 0.055, 12, 10)),
      shoeMat
    );
    toeCap.scale.set(1, 0.72, 1.1);
    toeCap.position.set(0, -hipY + 0.038, 0.145);
    pivot.add(toeCap);

    if (isWoman) {
      // Sculpted low gallery heel
      const heel = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.02, 0.015, 0.045, 8)),
        shoeMat
      );
      heel.position.set(0, -hipY + 0.022, -0.04);
      pivot.add(heel);
    }

    bodyGroup.add(pivot);
    return pivot;
  };

  const leftLegPivot = makeLeg(-1);
  const rightLegPivot = makeLeg(1);

  // --- TORSO, PELVIS & GENDER-SPECIFIC SILHOUETTE ---
  if (isWoman) {
    // Sculpted Woman Silhouette: tapered waist, structured bust/upper torso, tailored skirt/dress/coat
    const upperTorso = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.185, 0.135, 0.44, 18)),
      outfitMat
    );
    upperTorso.scale.set(1.05, 1, 0.76);
    upperTorso.position.y = 1.24;
    upperTorso.castShadow = true;
    bodyGroup.add(upperTorso);

    // Waist belt accent with bronze clasp
    const belt = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.142, 0.146, 0.055, 18)),
      accentMat
    );
    belt.scale.set(1.04, 1, 0.78);
    belt.position.y = 1.01;
    bodyGroup.add(belt);

    const clasp = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.055, 0.045, 0.022)), metalMat);
    clasp.position.set(0, 1.01, 0.115);
    bodyGroup.add(clasp);

    // Inner blouse / neckline trim
    const blouseV = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.088, 0.048, 0.2, 12)),
      accentMat
    );
    blouseV.position.set(0, 1.35, 0.065);
    blouseV.scale.set(1, 1, 0.55);
    bodyGroup.add(blouseV);

    if (config.outfitStyle === 'dress') {
      // Flowing Pleated Midi Dress (generous bell silhouette prevents any leg clipping)
      const dressPoints = [
        new THREE.Vector2(0.142, 1.0),
        new THREE.Vector2(0.205, 0.85),
        new THREE.Vector2(0.262, 0.62),
        new THREE.Vector2(0.305, 0.35),
      ];
      const dressMesh = new THREE.Mesh(
        trackGeo(new THREE.LatheGeometry(dressPoints, 24)),
        outfitMat
      );
      dressMesh.scale.set(1.0, 1, 0.98);
      dressMesh.castShadow = true;
      bodyGroup.add(dressMesh);
    } else if (config.outfitStyle === 'coat') {
      // Tailored Long Gallery Coat with structured lapels
      const coatPoints = [
        new THREE.Vector2(0.146, 1.0),
        new THREE.Vector2(0.205, 0.82),
        new THREE.Vector2(0.265, 0.44),
      ];
      const coatSkirt = new THREE.Mesh(
        trackGeo(new THREE.LatheGeometry(coatPoints, 22)),
        outfitMat
      );
      coatSkirt.scale.set(1.02, 1, 0.96);
      coatSkirt.castShadow = true;
      bodyGroup.add(coatSkirt);

      // Coat lapels
      for (const s of [-1, 1]) {
        const lapel = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(0.055, 0.26, 0.025)),
          outfitMat
        );
        lapel.position.set(s * 0.072, 1.32, 0.11);
        lapel.rotation.z = s * 0.22;
        bodyGroup.add(lapel);
      }
    } else {
      // Curator Blazer & A-Line Skirt
      const skirt = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.155, 0.255, 0.48, 22)),
        trouserMat
      );
      skirt.scale.set(1.04, 1, 0.98);
      skirt.position.y = 0.76;
      skirt.castShadow = true;
      bodyGroup.add(skirt);

      const blazerPeplum = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.148, 0.185, 0.16, 18)),
        outfitMat
      );
      blazerPeplum.scale.set(1.06, 1, 0.86);
      blazerPeplum.position.y = 0.94;
      bodyGroup.add(blazerPeplum);
    }
  } else {
    // Sculpted Man Silhouette: broader architectural shoulders, tailored blazer/overcoat/knit
    const chest = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.235, 0.185, 0.52, 18)),
      outfitMat
    );
    chest.scale.set(1.06, 1, 0.68);
    chest.position.y = 1.24;
    chest.castShadow = true;
    bodyGroup.add(chest);

    // Pelvis / Waistband
    const waist = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.186, 0.182, 0.16, 16)),
      trouserMat
    );
    waist.scale.set(1.04, 1, 0.7);
    waist.position.y = 0.93;
    bodyGroup.add(waist);

    // Leather belt + bronze buckle
    const belt = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.192, 0.192, 0.045, 18)),
      shoeMat
    );
    belt.scale.set(1.04, 1, 0.72);
    belt.position.y = 0.99;
    bodyGroup.add(belt);

    const buckle = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.052, 0.042, 0.025)), metalMat);
    buckle.position.set(0, 0.99, 0.135);
    bodyGroup.add(buckle);

    if (config.outfitStyle === 'blazer' || config.outfitStyle === 'trench') {
      // Crisp inner shirt V-front & tie/collar detail
      const shirt = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.092, 0.036, 0.28, 12)),
        accentMat
      );
      shirt.scale.set(1, 1, 0.55);
      shirt.position.set(0, 1.34, 0.088);
      bodyGroup.add(shirt);

      // Tailored structured lapels
      for (const s of [-1, 1]) {
        const lapel = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(0.068, 0.3, 0.028)),
          outfitMat
        );
        lapel.position.set(s * 0.082, 1.32, 0.128);
        lapel.rotation.z = s * 0.18;
        bodyGroup.add(lapel);
      }

      if (config.outfitStyle === 'trench') {
        // Extended Gallery Overcoat hem
        const coatHem = new THREE.Mesh(
          trackGeo(new THREE.CylinderGeometry(0.195, 0.228, 0.44, 18)),
          outfitMat
        );
        coatHem.scale.set(1.05, 1, 0.74);
        coatHem.position.y = 0.78;
        coatHem.castShadow = true;
        bodyGroup.add(coatHem);
      }
    } else {
      // Studio Knit Turtleneck Collar
      const collar = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.082, 0.094, 0.11, 16)),
        accentMat
      );
      collar.position.y = 1.52;
      bodyGroup.add(collar);
    }
  }

  // --- ARMS (Articulated from Shoulder Pivot) ---
  const shoulderY = isWoman ? 1.40 : 1.44;
  const shoulderX = isWoman ? 0.205 : 0.256;

  const makeArm = (side: -1 | 1) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * shoulderX, shoulderY, 0);

    const shoulderCap = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(isWoman ? 0.052 : 0.064, 12, 10)),
      outfitMat
    );
    pivot.add(shoulderCap);

    const upperArm = new THREE.Mesh(
      trackGeo(
        new THREE.CylinderGeometry(
          isWoman ? 0.048 : 0.058,
          isWoman ? 0.04 : 0.05,
          0.29,
          12
        )
      ),
      outfitMat
    );
    upperArm.position.y = -0.15;
    upperArm.castShadow = true;
    pivot.add(upperArm);

    const forearm = new THREE.Mesh(
      trackGeo(
        new THREE.CylinderGeometry(
          isWoman ? 0.039 : 0.048,
          isWoman ? 0.032 : 0.038,
          0.26,
          12
        )
      ),
      outfitMat
    );
    forearm.position.y = -0.41;
    forearm.castShadow = true;
    pivot.add(forearm);

    // Cuff accent
    const cuff = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(isWoman ? 0.035 : 0.042, isWoman ? 0.034 : 0.041, 0.035, 12)),
      accentMat
    );
    cuff.position.y = -0.53;
    pivot.add(cuff);

    const hand = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(isWoman ? 0.036 : 0.044, 10, 10)),
      skinMat
    );
    hand.scale.set(0.85, 1.15, 0.72);
    hand.position.y = -0.59;
    pivot.add(hand);

    bodyGroup.add(pivot);
    return pivot;
  };

  const leftArmPivot = makeArm(-1);
  const rightArmPivot = makeArm(1);

  // --- NECK & HEAD GROUP ---
  const headGroup = new THREE.Group();
  headGroup.position.set(0, isWoman ? 1.56 : 1.6, 0);
  bodyGroup.add(headGroup);

  const neck = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(isWoman ? 0.046 : 0.058, isWoman ? 0.054 : 0.066, 0.13, 12)),
    skinMat
  );
  neck.position.y = -0.04;
  headGroup.add(neck);

  // Sculpted Head Cranium + Jawline
  const head = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(isWoman ? 0.128 : 0.136, 20, 18)),
    skinMat
  );
  head.scale.set(isWoman ? 0.92 : 0.96, 1.08, 0.98);
  head.position.y = 0.11;
  head.castShadow = true;
  headGroup.add(head);

  // Ears
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.024, 8, 8)), skinMat);
    ear.scale.set(0.5, 1.2, 0.8);
    ear.position.set(s * (isWoman ? 0.118 : 0.128), 0.1, -0.005);
    headGroup.add(ear);
  }

  // Facial Features: Eyes, Eyebrows, Nose, Mouth
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.013, 10, 10)), darkEyeMat);
    eye.position.set(s * 0.043, 0.125, 0.118);
    headGroup.add(eye);

    const brow = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.036, 0.008, 0.01)),
      hairMat
    );
    brow.position.set(s * 0.044, 0.152, 0.12);
    brow.rotation.z = s * (isWoman ? -0.08 : 0.04);
    headGroup.add(brow);
  }

  const nose = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.014, 0.042, 8)), skinMat);
  nose.position.set(0, 0.098, 0.132);
  nose.rotation.x = Math.PI * 0.14;
  headGroup.add(nose);

  const mouthMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: isWoman ? 0x9e4b47 : 0x7c483d,
      roughness: 0.48,
      metalness: 0.05,
    })
  );
  const mouth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.044, 0.011, 0.01)), mouthMat);
  mouth.position.set(0, 0.055, 0.121);
  headGroup.add(mouth);

  // --- SCULPTED 3D HAIR BY GENDER & STYLE ---
  // Tilted crown cap keeps the forehead, eyebrows, eyes, and glasses completely clear
  const hairBase = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(isWoman ? 0.132 : 0.138, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.44)),
    hairMat
  );
  hairBase.scale.set(0.95, 1.02, 1.0);
  hairBase.position.set(0, 0.145, -0.022);
  hairBase.rotation.x = -0.34;
  hairBase.castShadow = true;
  headGroup.add(hairBase);

  // Back-of-head cranial hair volume (leaves front face clean)
  const hairBackCrown = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(isWoman ? 0.126 : 0.13, 18, 14)),
    hairMat
  );
  hairBackCrown.scale.set(0.94, 1.02, 0.84);
  hairBackCrown.position.set(0, 0.128, -0.044);
  headGroup.add(hairBackCrown);

  if (isWoman) {
    if (config.hairStyle === 'flowing') {
      const backCascade = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.118, 0.145, 0.38, 16)),
        hairMat
      );
      backCascade.scale.set(1.06, 1, 0.52);
      backCascade.position.set(0, -0.04, -0.075);
      headGroup.add(backCascade);

      for (const s of [-1, 1]) {
        const sideLock = new THREE.Mesh(
          trackGeo(new THREE.CylinderGeometry(0.038, 0.028, 0.34, 10)),
          hairMat
        );
        sideLock.position.set(s * 0.108, -0.01, 0.01);
        sideLock.rotation.z = s * 0.08;
        headGroup.add(sideLock);
      }
    } else if (config.hairStyle === 'bob') {
      const bobBack = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.134, 0.124, 0.21, 18, 1, false, Math.PI * 0.3, Math.PI * 1.4)),
        hairMat
      );
      bobBack.position.set(0, 0.06, -0.012);
      headGroup.add(bobBack);
    } else if (config.hairStyle === 'bun') {
      const chignon = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.076, 14, 12)), hairMat);
      chignon.position.set(0, 0.245, -0.075);
      headGroup.add(chignon);

      const hairPin = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.005, 0.005, 0.17, 6)),
        metalMat
      );
      hairPin.position.set(0, 0.245, -0.075);
      hairPin.rotation.z = Math.PI * 0.38;
      headGroup.add(hairPin);
    } else {
      // Shoulder Waves
      for (const s of [-1, 1]) {
        const wave = new THREE.Mesh(
          trackGeo(new THREE.SphereGeometry(0.068, 12, 12)),
          hairMat
        );
        wave.scale.set(0.72, 1.9, 0.9);
        wave.position.set(s * 0.112, 0.03, -0.015);
        headGroup.add(wave);
      }
      const waveBack = new THREE.Mesh(
        trackGeo(new THREE.SphereGeometry(0.115, 14, 12)),
        hairMat
      );
      waveBack.scale.set(1.05, 1.35, 0.65);
      waveBack.position.set(0, 0.02, -0.078);
      headGroup.add(waveBack);
    }
  } else {
    if (config.hairStyle === 'swept') {
      const sweep = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.155, 0.062, 0.17)), hairMat);
      sweep.position.set(0, 0.235, 0.012);
      sweep.rotation.x = -0.16;
      headGroup.add(sweep);
    } else if (config.hairStyle === 'curly') {
      const offsets = [
        [0, 0.24, 0.02],
        [-0.065, 0.23, 0.01],
        [0.065, 0.23, 0.01],
        [-0.04, 0.245, -0.045],
        [0.04, 0.245, -0.045],
        [0, 0.225, 0.075],
      ];
      for (const [ox, oy, oz] of offsets) {
        const curl = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.048, 10, 10)), hairMat);
        curl.position.set(ox, oy, oz);
        headGroup.add(curl);
      }
    } else if (config.hairStyle === 'taper') {
      const crown = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.16, 0.045, 0.145)),
        hairMat
      );
      crown.position.set(0, 0.225, 0.02);
      crown.rotation.z = -0.08;
      headGroup.add(crown);
    }
    // 'crop' uses the clean fitted base cap
  }

  // --- CURATOR ACCESSORIES ---
  if (config.accessory === 'glasses') {
    const frameMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x3b2618,
        roughness: 0.22,
        metalness: 0.4,
      })
    );
    for (const s of [-1, 1]) {
      const rim = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.028, 0.0045, 8, 18)), frameMat);
      rim.position.set(s * 0.043, 0.125, 0.132);
      headGroup.add(rim);

      const temple = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.005, 0.006, 0.11)), frameMat);
      temple.position.set(s * 0.072, 0.126, 0.08);
      headGroup.add(temple);
    }
    const bridge = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.028, 0.006, 0.006)), frameMat);
    bridge.position.set(0, 0.128, 0.134);
    headGroup.add(bridge);
  } else if (config.accessory === 'scarf') {
    const scarfRing = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(isWoman ? 0.092 : 0.108, 0.032, 10, 20)),
      accentMat
    );
    scarfRing.rotation.x = Math.PI / 2;
    scarfRing.position.set(0, isWoman ? 1.49 : 1.53, 0.01);
    bodyGroup.add(scarfRing);

    const scarfTail = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.078, 0.28, 0.022)),
      accentMat
    );
    scarfTail.position.set(0.055, isWoman ? 1.33 : 1.37, isWoman ? 0.125 : 0.145);
    scarfTail.rotation.z = -0.1;
    bodyGroup.add(scarfTail);
  } else if (config.accessory === 'lanyard') {
    const strap = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.09, 0.006, 6, 16)),
      metalMat
    );
    strap.rotation.x = Math.PI * 0.34;
    strap.position.set(0, isWoman ? 1.42 : 1.45, 0.05);
    bodyGroup.add(strap);

    const badge = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.062, 0.084, 0.008)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0xf7f5f0, roughness: 0.4 }))
    );
    badge.position.set(0, isWoman ? 1.24 : 1.28, isWoman ? 0.135 : 0.16);
    bodyGroup.add(badge);
  }

  // Optional floating museum nameplate sprite
  if (options?.showNameplate) {
    const labelTex = trackTex(
      createNameplateTexture(
        config.displayName || 'Visitor',
        options.nameplateSubtitle ??
          (config.gender === 'woman' ? 'Woman · Visitor' : 'Man · Visitor'),
        options.statusTone ?? 'default'
      )
    );
    const spriteMat = trackMat(
      new THREE.SpriteMaterial({
        map: labelTex,
        transparent: true,
        depthTest: false,
      })
    );
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(0.92, 0.23, 1);
    sprite.position.set(0, 2.08, 0);
    root.add(sprite);
  }

  return {
    root,
    bodyGroup,
    headGroup,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    stridePhase: 0,
    maxLegSwing: isSkirted ? 0.26 : 0.48,
    dispose: () => {
      for (const item of disposables) {
        item.dispose();
      }
    },
  };
}

/**
 * Builds Abid's exclusive, fully articulated 3D signature character strictly matching his
 * 360-degree Tripo showcase: burgundy/indigo plaid rolled-sleeve untucked shirt, dark wristwatch
 * on the left wrist, crisp ivory tailored chinos, charcoal-grey casual sneakers with off-white
 * rubber soles, golden-brown complexion, sculpted dark beard & moustache, thick side-swept
 * jet-black hair, and thin rose-silver rectangular eyeglasses.
 */
function buildAbidSignatureRig(
  config: AvatarConfig,
  options?: AvatarBuildOptions
): AvatarRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

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

  // Calibrated PBR materials matched to Abid's reference turnaround
  const skinMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xb87d58,
      roughness: 0.58,
      metalness: 0.02,
    })
  );

  const hairMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x161515,
      roughness: 0.48,
      metalness: 0.06,
    })
  );

  const beardMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1a1717,
      roughness: 0.76,
      metalness: 0.02,
    })
  );

  const plaidTex = trackTex(createAbidPlaidTexture(2.6, 2.6));
  const shirtMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: plaidTex,
      roughness: 0.82,
      metalness: 0.03,
      side: THREE.DoubleSide,
    })
  );

  const sleevePlaidTex = trackTex(createAbidPlaidTexture(1.5, 1.5));
  const sleeveMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: sleevePlaidTex,
      roughness: 0.82,
      metalness: 0.03,
    })
  );

  const placketMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x451b26,
      roughness: 0.82,
      metalness: 0.03,
    })
  );

  const buttonMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x20181a,
      roughness: 0.35,
      metalness: 0.12,
    })
  );

  const chinoMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf1eee7,
      roughness: 0.84,
      metalness: 0.02,
    })
  );

  const sneakerUpperMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x34373d,
      roughness: 0.64,
      metalness: 0.04,
    })
  );

  const sneakerSoleMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xece9e0,
      roughness: 0.76,
      metalness: 0.02,
    })
  );

  const watchBandMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x262a30,
      roughness: 0.45,
      metalness: 0.18,
    })
  );

  const watchBezelMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x5c636e,
      roughness: 0.28,
      metalness: 0.72,
    })
  );

  const watchDialMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x101216,
      roughness: 0.16,
      metalness: 0.25,
    })
  );

  const glassesFrameMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xdec2b4,
      roughness: 0.22,
      metalness: 0.78,
    })
  );

  const glassesLensMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf4f7fb,
      roughness: 0.08,
      metalness: 0.12,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    })
  );

  const darkEyeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x171311,
      roughness: 0.16,
      metalness: 0.1,
    })
  );

  const scleraMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf5f2ec,
      roughness: 0.3,
      metalness: 0.0,
    })
  );

  const lipMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x864c40,
      roughness: 0.52,
      metalness: 0.04,
    })
  );

  // Soft grounded contact shadow at y = 0.015
  if (options?.showContactShadow !== false) {
    const shadowTex = trackTex(createContactShadowTexture());
    const shadowPlane = new THREE.Mesh(
      trackGeo(new THREE.CircleGeometry(0.46, 24)),
      trackMat(
        new THREE.MeshBasicMaterial({
          map: shadowTex,
          transparent: true,
          depthWrite: false,
          opacity: 0.72,
        })
      )
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.015;
    root.add(shadowPlane);
  }

  // --- LEGS: Ivory tailored chinos + charcoal sneakers with crisp white soles ---
  const hipY = 0.88;
  const hipSpread = 0.114;

  const makeLeg = (side: -1 | 1) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * hipSpread, hipY, 0);

    // Thigh (tailored chino from hip y=0 down to knee y=-0.42)
    const thigh = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.080, 0.065, 0.42, 16)),
      chinoMat
    );
    thigh.position.y = -0.21;
    thigh.castShadow = true;
    pivot.add(thigh);

    // Articulated knee pivot located at y = -0.42
    const kneePivot = new THREE.Group();
    kneePivot.position.set(0, -0.42, 0);
    pivot.add(kneePivot);

    // Subtle sculpted knee cap
    const kneeCap = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.052, 12, 10)),
      chinoMat
    );
    kneeCap.scale.set(0.95, 1.05, 0.82);
    kneeCap.position.set(0, 0, 0.012);
    kneeCap.castShadow = true;
    kneePivot.add(kneeCap);

    // Calf / tapered lower chino (from y=0 to y=-0.36 in kneePivot)
    const calf = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.063, 0.049, 0.36, 16)),
      chinoMat
    );
    calf.position.y = -0.18;
    calf.castShadow = true;
    kneePivot.add(calf);

    // Subtle ankle cuff roll
    const ankleHem = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.052, 0.051, 0.032, 16)),
      chinoMat
    );
    ankleHem.position.y = -0.36;
    kneePivot.add(ankleHem);

    // Bare ankle bridge into sneaker collar
    const ankle = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.041, 0.039, 0.042, 12)),
      skinMat
    );
    ankle.position.y = -0.385;
    kneePivot.add(ankle);

    // Crisp off-white rubber sneaker outsole (sole bottom at y = -0.46 in kneePivot, flush with floor at y=0)
    const soleBase = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.114, 0.026, 0.245)),
      sneakerSoleMat
    );
    soleBase.position.set(0, -0.46 + 0.013, 0.05);
    soleBase.castShadow = true;
    kneePivot.add(soleBase);

    const soleToe = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.056, 0.057, 0.026, 14)),
      sneakerSoleMat
    );
    soleToe.position.set(0, -0.46 + 0.013, 0.168);
    kneePivot.add(soleToe);

    // Dark charcoal sneaker upper
    const shoeUpper = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.106, 0.064, 0.215)),
      sneakerUpperMat
    );
    shoeUpper.position.set(0, -0.46 + 0.056, 0.042);
    shoeUpper.castShadow = true;
    kneePivot.add(shoeUpper);

    const shoeToe = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.054, 14, 12)),
      sneakerUpperMat
    );
    shoeToe.scale.set(0.98, 0.68, 1.18);
    shoeToe.position.set(0, -0.46 + 0.048, 0.148);
    shoeToe.castShadow = true;
    kneePivot.add(shoeToe);

    // Crisp lace / tongue highlight
    for (let i = 0; i < 3; i++) {
      const lace = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.042, 0.006, 0.009)),
        sneakerSoleMat
      );
      lace.position.set(0, -0.46 + 0.088 - i * 0.008, 0.095 + i * 0.024);
      lace.rotation.x = 0.25;
      kneePivot.add(lace);
    }

    bodyGroup.add(pivot);
    return { pivot, kneePivot };
  };

  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);
  const leftLegPivot = leftLeg.pivot;
  const rightLegPivot = rightLeg.pivot;
  const leftKneePivot = leftLeg.kneePivot;
  const rightKneePivot = rightLeg.kneePivot;

  // --- PELVIS (Ivory chino seat seamlessly tucked under untucked shirt hem) ---
  const pelvis = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.180, 0.176, 0.17, 18)),
    chinoMat
  );
  pelvis.scale.set(1.04, 1, 0.72);
  pelvis.position.y = 0.91;
  pelvis.castShadow = true;
  bodyGroup.add(pelvis);

  // --- TORSO: Seamless LatheGeometry Untucked Burgundy & Deep-Indigo Plaid Button-Down Shirt ---
  // Calibrated profile: hem sits at y = 0.865 (above knee & hip rotation line) preventing thigh clipping
  const shirtProfile = [
    new THREE.Vector2(0.205, 0.865), // untucked shirt hem bottom
    new THREE.Vector2(0.200, 0.93),
    new THREE.Vector2(0.196, 1.03),
    new THREE.Vector2(0.214, 1.24),
    new THREE.Vector2(0.228, 1.38),
    new THREE.Vector2(0.214, 1.445),
    new THREE.Vector2(0.155, 1.485),
    new THREE.Vector2(0.088, 1.505), // collar neckline base
  ];
  const torsoMain = new THREE.Mesh(
    trackGeo(new THREE.LatheGeometry(shirtProfile, 28)),
    shirtMat
  );
  torsoMain.scale.set(1.06, 1, 0.68);
  torsoMain.castShadow = true;
  bodyGroup.add(torsoMain);

  // Center front button placket & 5 small dark buttons seated cleanly along chest contour
  const placket = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.028, 0.56, 0.014)),
    placketMat
  );
  placket.position.set(0, 1.135, 0.151);
  placket.rotation.x = -0.025;
  bodyGroup.add(placket);

  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const by = 1.36 - t * 0.45;
    const bz = 0.161 - t * 0.008;
    const btn = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.006, 0.006, 0.008, 10)),
      buttonMat
    );
    btn.rotation.x = Math.PI / 2;
    btn.position.set(0, by, bz);
    bodyGroup.add(btn);
  }

  // Open-top spread collar + warm visible upper throat V
  const openChestV = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.062, 0.022, 0.13, 12)),
    skinMat
  );
  openChestV.scale.set(1, 1, 0.62);
  openChestV.position.set(0, 1.475, 0.072);
  bodyGroup.add(openChestV);

  const collarBack = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.084, 0.096, 0.072, 18, 1, true, Math.PI * 0.35, Math.PI * 1.3)),
    shirtMat
  );
  collarBack.position.set(0, 1.515, -0.006);
  bodyGroup.add(collarBack);

  for (const s of [-1, 1]) {
    const collarPoint = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.062, 0.068, 0.014)),
      shirtMat
    );
    collarPoint.position.set(s * 0.056, 1.488, 0.098);
    collarPoint.rotation.z = s * 0.44;
    collarPoint.rotation.y = -s * 0.3;
    bodyGroup.add(collarPoint);
  }

  // --- ARMS: Rolled-Up 3/4 Plaid Sleeves + Bare Forearms + Left Wristwatch ---
  const shoulderY = 1.398;
  const shoulderX = 0.252; // calibrated from 0.236 to ensure arms clear the torso silhouette cleanly

  const makeArm = (side: -1 | 1) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * shoulderX, shoulderY, 0);

    // Shoulder cap (plaid, smoothly tucked into shoulder slope)
    const cap = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.06, 14, 12)),
      sleeveMat
    );
    cap.scale.set(0.96, 1.04, 0.94);
    cap.castShadow = true;
    pivot.add(cap);

    // Upper sleeve (plaid, extending down to elbow at y = -0.265)
    const upperSleeve = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.056, 0.049, 0.265, 14)),
      sleeveMat
    );
    upperSleeve.position.y = -0.132;
    upperSleeve.castShadow = true;
    pivot.add(upperSleeve);

    // Articulated forearm pivot located at elbow (y = -0.265)
    const forearmPivot = new THREE.Group();
    forearmPivot.position.set(0, -0.265, 0);
    pivot.add(forearmPivot);

    // Rolled-up plaid cuff band right below elbow
    const rolledCuff = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.053, 0.050, 0.052, 14)),
      sleeveMat
    );
    rolledCuff.position.y = -0.01;
    rolledCuff.castShadow = true;
    forearmPivot.add(rolledCuff);

    // Bare warm golden-brown forearm
    const forearm = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.042, 0.033, 0.25, 14)),
      skinMat
    );
    forearm.position.y = -0.145;
    forearm.castShadow = true;
    forearmPivot.add(forearm);

    // Anatomical left wrist (side === 1 when facing +Z) wears dark wristwatch
    if (side === 1) {
      const strap = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.0375, 0.0365, 0.024, 14)),
        watchBandMat
      );
      strap.position.y = -0.245;
      forearmPivot.add(strap);

      const watchCase = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.02, 0.02, 0.012, 14)),
        watchBezelMat
      );
      watchCase.rotation.z = Math.PI / 2;
      watchCase.position.set(0.036, -0.245, 0.01);
      forearmPivot.add(watchCase);

      const watchDial = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.016, 0.016, 0.0135, 14)),
        watchDialMat
      );
      watchDial.rotation.z = Math.PI / 2;
      watchDial.position.set(0.037, -0.245, 0.01);
      forearmPivot.add(watchDial);
    }

    // Sculpted hand & thumb
    const hand = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.041, 12, 10)),
      skinMat
    );
    hand.scale.set(0.82, 1.18, 0.68);
    hand.position.y = -0.315;
    hand.castShadow = true;
    forearmPivot.add(hand);

    const thumb = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.011, 0.01, 0.042, 8)),
      skinMat
    );
    thumb.position.set(-side * 0.028, -0.295, 0.022);
    thumb.rotation.z = side * 0.35;
    thumb.rotation.x = 0.25;
    forearmPivot.add(thumb);

    bodyGroup.add(pivot);
    return { pivot, forearmPivot };
  };

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);
  const leftArmPivot = leftArm.pivot;
  const rightArmPivot = rightArm.pivot;
  const leftForearmPivot = leftArm.forearmPivot;
  const rightForearmPivot = rightArm.forearmPivot;

  // --- NECK, HEAD, BEARD/MOUSTACHE, HAIR & ROSE-SILVER GLASSES ---
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.59, 0);
  bodyGroup.add(headGroup);

  const neck = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.056, 0.065, 0.14, 14)),
    skinMat
  );
  neck.position.y = -0.045;
  headGroup.add(neck);

  // Sculpted head cranium + natural oval jawline
  const head = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.135, 24, 20)),
    skinMat
  );
  head.scale.set(0.95, 1.1, 0.99);
  head.position.y = 0.115;
  head.castShadow = true;
  headGroup.add(head);

  // Ears
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.024, 10, 10)), skinMat);
    ear.scale.set(0.46, 1.24, 0.82);
    ear.position.set(s * 0.128, 0.106, -0.006);
    headGroup.add(ear);
  }

  // Expressive Eyes & Eyebrows
  for (const s of [-1, 1]) {
    const sclera = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.0155, 10, 10)), scleraMat);
    sclera.scale.set(1.25, 0.72, 0.55);
    sclera.position.set(s * 0.044, 0.126, 0.116);
    headGroup.add(sclera);

    const iris = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.0105, 10, 10)), darkEyeMat);
    iris.position.set(s * 0.044, 0.126, 0.122);
    headGroup.add(iris);

    const brow = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.041, 0.0095, 0.012)),
      hairMat
    );
    brow.position.set(s * 0.045, 0.155, 0.121);
    brow.rotation.z = s * 0.04;
    headGroup.add(brow);
  }

  // Sculpted Nose
  const noseBridge = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.017, 0.044, 0.022)),
    skinMat
  );
  noseBridge.position.set(0, 0.112, 0.127);
  noseBridge.rotation.x = -0.14;
  headGroup.add(noseBridge);

  const noseTip = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.014, 10, 10)), skinMat);
  noseTip.scale.set(1.12, 0.84, 0.92);
  noseTip.position.set(0, 0.09, 0.137);
  headGroup.add(noseTip);

  // Subtle friendly mouth
  const mouth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.044, 0.009, 0.01)), lipMat);
  mouth.position.set(0, 0.056, 0.124);
  headGroup.add(mouth);

  // Contoured Dark-Black Moustache & Sleek Tightly-Fitted Jawline/Chin Beard
  for (const s of [-1, 1]) {
    const stacheHalf = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.016, 10, 8)),
      beardMat
    );
    stacheHalf.scale.set(1.45, 0.42, 0.58);
    stacheHalf.position.set(s * 0.017, 0.07, 0.125);
    stacheHalf.rotation.z = -s * 0.18;
    stacheHalf.rotation.y = -s * 0.2;
    headGroup.add(stacheHalf);

    // Tapered sideburn blending hair cleanly down to the jawline beard
    const sideburn = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.014, 0.011, 0.095, 10)),
      hairMat
    );
    sideburn.scale.set(0.55, 1, 1.35);
    sideburn.position.set(s * 0.119, 0.112, 0.014);
    headGroup.add(sideburn);
  }

  // Single sleek contoured chin-jaw beard shell hugging the exact oval lower skull curve
  const jawBeardShell = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.138, 24, 18, 0, Math.PI * 2, Math.PI * 0.57, Math.PI * 0.43)),
    beardMat
  );
  jawBeardShell.scale.set(0.955, 1.09, 1.005);
  jawBeardShell.position.set(0, 0.112, 0.005);
  jawBeardShell.rotation.x = 0.24;
  headGroup.add(jawBeardShell);

  const soulPatch = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.016, 10, 8)),
    beardMat
  );
  soulPatch.scale.set(1.1, 0.65, 0.55);
  soulPatch.position.set(0, 0.042, 0.124);
  headGroup.add(soulPatch);

  // Thick Jet-Black Textured Modern Hair (fuller side-swept top, smoothly tapered sides & back)
  const hairCap = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.141, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.49)),
    hairMat
  );
  hairCap.scale.set(0.98, 1.06, 1.02);
  hairCap.position.set(0, 0.146, -0.018);
  hairCap.rotation.x = -0.3;
  hairCap.castShadow = true;
  headGroup.add(hairCap);

  // Back cranial hair cleanly covering nape
  const hairBack = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.134, 18, 14)),
    hairMat
  );
  hairBack.scale.set(0.97, 1.05, 0.86);
  hairBack.position.set(0, 0.134, -0.04);
  hairBack.castShadow = true;
  headGroup.add(hairBack);

  // Smooth upper-temple side hair bridging cap cleanly into sideburns
  for (const s of [-1, 1]) {
    const templeHair = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.056, 12, 10)),
      hairMat
    );
    templeHair.scale.set(0.45, 1.05, 1.25);
    templeHair.position.set(s * 0.114, 0.168, 0.004);
    headGroup.add(templeHair);
  }

  // Textured fuller swept crown waves matching Abid's silhouette
  const crownWaveMain = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.088, 16, 12)),
    hairMat
  );
  crownWaveMain.scale.set(1.24, 0.62, 1.24);
  crownWaveMain.position.set(-0.015, 0.236, 0.018);
  crownWaveMain.rotation.z = 0.12;
  crownWaveMain.rotation.x = -0.14;
  crownWaveMain.castShadow = true;
  headGroup.add(crownWaveMain);

  const crownWaveRight = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.068, 12, 10)),
    hairMat
  );
  crownWaveRight.scale.set(1.06, 0.56, 1.15);
  crownWaveRight.position.set(0.056, 0.226, 0.012);
  crownWaveRight.rotation.z = -0.18;
  headGroup.add(crownWaveRight);

  const frontQuiff = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.056, 12, 10)),
    hairMat
  );
  frontQuiff.scale.set(1.42, 0.54, 0.92);
  frontQuiff.position.set(-0.022, 0.222, 0.078);
  frontQuiff.rotation.x = -0.22;
  frontQuiff.rotation.z = 0.1;
  headGroup.add(frontQuiff);

  // Thin Rose-Silver Metallic Rectangular Eyeglasses with flush corner-to-ear temples
  const lensW = 0.056;
  const lensH = 0.036;
  const frameT = 0.0042;
  const lensZ = 0.14;
  const lensY = 0.126;

  for (const s of [-1, 1]) {
    const cx = s * 0.046;
    const outerX = cx + s * (lensW / 2);

    const topBar = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(lensW + frameT, frameT, frameT)),
      glassesFrameMat
    );
    topBar.position.set(cx, lensY + lensH / 2, lensZ);
    headGroup.add(topBar);

    const botBar = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(lensW + frameT, frameT, frameT)),
      glassesFrameMat
    );
    botBar.position.set(cx, lensY - lensH / 2, lensZ);
    headGroup.add(botBar);

    const outerBar = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(frameT, lensH, frameT)),
      glassesFrameMat
    );
    outerBar.position.set(outerX, lensY, lensZ);
    headGroup.add(outerBar);

    const innerBar = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(frameT, lensH, frameT)),
      glassesFrameMat
    );
    innerBar.position.set(cx - s * (lensW / 2), lensY, lensZ);
    headGroup.add(innerBar);

    const lensPane = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(lensW - 0.004, lensH - 0.004)),
      glassesLensMat
    );
    lensPane.position.set(cx, lensY, lensZ - 0.001);
    headGroup.add(lensPane);

    // Flush hinge & slender rose-silver temple extending directly from outer corner to ear
    const endPiece = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.022, frameT, frameT)),
      glassesFrameMat
    );
    endPiece.position.set(outerX + s * 0.011, lensY + 0.004, lensZ);
    headGroup.add(endPiece);

    const temple = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.0038, 0.0044, 0.145)),
      glassesFrameMat
    );
    temple.position.set(outerX + s * 0.033, lensY + 0.002, 0.07);
    temple.rotation.y = -s * 0.17;
    headGroup.add(temple);
  }

  // Nasal bridge connecting the two rectangular frames
  const bridge = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.036, frameT, frameT)),
    glassesFrameMat
  );
  bridge.position.set(0, lensY + 0.005, lensZ + 0.002);
  headGroup.add(bridge);

  // Floating nameplate sprite in museum view
  if (options?.showNameplate) {
    const labelTex = trackTex(
      createNameplateTexture(
        config.displayName || 'Ashfaq Sarker Abid',
        options.nameplateSubtitle ?? 'Exclusive 3D Model',
        options.statusTone ?? 'default'
      )
    );
    const spriteMat = trackMat(
      new THREE.SpriteMaterial({
        map: labelTex,
        transparent: true,
        depthTest: false,
      })
    );
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(0.96, 0.24, 1);
    sprite.position.set(0, 2.08, 0);
    root.add(sprite);
  }

  return {
    root,
    bodyGroup,
    headGroup,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    leftKneePivot,
    rightKneePivot,
    leftForearmPivot,
    rightForearmPivot,
    stridePhase: 0,
    maxLegSwing: 0.38,
    dispose: () => {
      for (const item of disposables) {
        item.dispose();
      }
    },
  };
}

/**
 * Loads an exported binary .GLB 3D character mesh (e.g. exported from Tripo Studio) via GLTFLoader,
 * normalizes its height to 1.76m, centers & grounds it flush at y = 0, hooks up embedded walk
 * animations if present, and provides smooth locomotion motion even for static unrigged meshes.
 */
export async function buildCustomGlbAvatarRig(
  glbBuffer: ArrayBuffer,
  config: AvatarConfig,
  options?: { showNameplate?: boolean; showContactShadow?: boolean }
): Promise<AvatarRig> {
  const loader = new GLTFLoader();
  const gltf = await new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>(
    (resolve, reject) => {
      loader.parse(
        glbBuffer.slice(0),
        '',
        (result) => resolve(result),
        (err) => reject(err instanceof Error ? err : new Error('Invalid GLB 3D model file'))
      );
    }
  );

  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

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

  const model = gltf.scene;
  model.updateMatrixWorld(true);
  const rawBox = new THREE.Box3().setFromObject(model);
  const rawSize = new THREE.Vector3();
  const rawCenter = new THREE.Vector3();
  rawBox.getSize(rawSize);
  rawBox.getCenter(rawCenter);

  const targetHeight = 1.76;
  const maxDim = Math.max(rawSize.y, 0.001);
  const scale = targetHeight / maxDim;
  model.scale.setScalar(scale);

  // Re-measure after scaling so feet rest flush at y = 0 and X/Z are centered
  model.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(model);
  const scaledCenter = new THREE.Vector3();
  scaledBox.getCenter(scaledCenter);
  model.position.set(-scaledCenter.x, -scaledBox.min.y, -scaledCenter.z);

  model.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (m && 'envMapIntensity' in m) {
          (m as THREE.MeshStandardMaterial).envMapIntensity = 0.72;
        }
      }
    }
  });

  bodyGroup.add(model);

  // Soft grounded contact shadow
  if (options?.showContactShadow !== false) {
    const shadowTex = trackTex(createContactShadowTexture());
    const shadowPlane = new THREE.Mesh(
      trackGeo(new THREE.CircleGeometry(0.48, 24)),
      trackMat(
        new THREE.MeshBasicMaterial({
          map: shadowTex,
          transparent: true,
          depthWrite: false,
          opacity: 0.72,
        })
      )
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.015;
    root.add(shadowPlane);
  }

  // Optional floating nameplate sprite
  if (options?.showNameplate) {
    const labelTex = trackTex(
      createNameplateTexture(
        config.displayName || 'Ashfaq Sarker Abid',
        'Custom Tripo GLB Model'
      )
    );
    const spriteMat = trackMat(
      new THREE.SpriteMaterial({
        map: labelTex,
        transparent: true,
        depthTest: false,
      })
    );
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(0.96, 0.24, 1);
    sprite.position.set(0, 2.08, 0);
    root.add(sprite);
  }

  // Optional embedded skeletal animation mixer (if the exported GLB is rigged)
  let mixer: THREE.AnimationMixer | undefined;
  if (gltf.animations && gltf.animations.length > 0) {
    mixer = new THREE.AnimationMixer(model);
    const preferred =
      gltf.animations.find((clip) => /walk|stride|run|move/i.test(clip.name)) ??
      gltf.animations[0];
    const action = mixer.clipAction(preferred);
    action.play();
  }

  // Placeholder pivot groups satisfy the shared AvatarRig interface
  const headGroup = new THREE.Group();
  const leftArmPivot = new THREE.Group();
  const rightArmPivot = new THREE.Group();
  const leftLegPivot = new THREE.Group();
  const rightLegPivot = new THREE.Group();

  return {
    root,
    bodyGroup,
    headGroup,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    stridePhase: 0,
    maxLegSwing: 0.48,
    mixer,
    isCustomGlb: true,
    dispose: () => {
      mixer?.stopAllAction();
      model.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry?.dispose();
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const mat of mats) {
            if (!mat) continue;
            const std = mat as THREE.MeshStandardMaterial;
            std.map?.dispose();
            std.normalMap?.dispose();
            std.roughnessMap?.dispose();
            std.metalnessMap?.dispose();
            std.aoMap?.dispose();
            std.emissiveMap?.dispose();
            mat.dispose();
          }
        }
      });
      for (const item of disposables) {
        item.dispose();
      }
    },
  };
}

/**
 * Smoothly animates walking stride or gentle idle breathing without allocating garbage.
 */
export function animateAvatarRig(
  rig: AvatarRig,
  speed: number,
  elapsed: number,
  delta: number,
  options?: { standStill?: boolean }
): void {
  const standStill = Boolean(options?.standStill);
  const isMoving = !standStill && speed > 0.08;
  const clampedDelta = Math.min(delta, 0.1);
  const damping = 1 - Math.exp(-10 * clampedDelta);

  if (rig.isCustomGlb) {
    if (rig.mixer) {
      rig.mixer.update(isMoving ? clampedDelta * Math.max(0.85, speed * 0.32) : 0);
    }
    if (isMoving) {
      rig.stridePhase += clampedDelta * Math.min(11, 5.5 + speed * 1.15);
      const bob = Math.abs(Math.cos(rig.stridePhase)) * (rig.mixer ? 0.018 : 0.048);
      const swayZ = Math.sin(rig.stridePhase) * (rig.mixer ? 0.018 : 0.042);
      const leanX = rig.mixer ? 0.02 : 0.05;
      rig.bodyGroup.position.y += (bob - rig.bodyGroup.position.y) * damping;
      rig.bodyGroup.rotation.z += (swayZ - rig.bodyGroup.rotation.z) * damping;
      rig.bodyGroup.rotation.x += (leanX - rig.bodyGroup.rotation.x) * damping;
    } else {
      const breathe = standStill ? 0 : Math.sin(elapsed * 2.1) * 0.008;
      rig.bodyGroup.position.y += (breathe - rig.bodyGroup.position.y) * damping;
      rig.bodyGroup.rotation.z += (0 - rig.bodyGroup.rotation.z) * damping;
      rig.bodyGroup.rotation.x += (0 - rig.bodyGroup.rotation.x) * damping;
    }
    return;
  }

  if (isMoving) {
    // Natural human cadence: ~1.8 to 2.2 steps/sec calibrated to walking speed
    rig.stridePhase += clampedDelta * Math.min(8.8, 3.8 + speed * 0.68);
    const maxSwing = Math.min(0.38, rig.maxLegSwing);
    const swing = Math.sin(rig.stridePhase) * maxSwing;
    const armSwing = Math.sin(rig.stridePhase) * 0.32;
    const bob = Math.abs(Math.sin(rig.stridePhase)) * 0.022;
    const swayZ = Math.sin(rig.stridePhase) * 0.016;
    const forwardLean = Math.min(0.045, 0.018 + speed * 0.005);

    // Natural hip rotation
    rig.leftLegPivot.rotation.x += (swing - rig.leftLegPivot.rotation.x) * damping;
    rig.rightLegPivot.rotation.x += (-swing - rig.rightLegPivot.rotation.x) * damping;

    // Natural knee articulation: bends backward when leg swings forward, straightens when planting
    const leftKneeBend = Math.max(0, -swing) * 0.85;
    const rightKneeBend = Math.max(0, swing) * 0.85;
    if (rig.leftKneePivot) {
      rig.leftKneePivot.rotation.x += (leftKneeBend - rig.leftKneePivot.rotation.x) * damping;
    }
    if (rig.rightKneePivot) {
      rig.rightKneePivot.rotation.x += (rightKneeBend - rig.rightKneePivot.rotation.x) * damping;
    }

    // Natural arm swing with relaxed elbow flex
    rig.leftArmPivot.rotation.x += (-armSwing - rig.leftArmPivot.rotation.x) * damping;
    rig.rightArmPivot.rotation.x += (armSwing - rig.rightArmPivot.rotation.x) * damping;
    const leftElbowBend = 0.12 + Math.abs(armSwing) * 0.28;
    const rightElbowBend = 0.12 + Math.abs(armSwing) * 0.28;
    if (rig.leftForearmPivot) {
      rig.leftForearmPivot.rotation.x += (leftElbowBend - rig.leftForearmPivot.rotation.x) * damping;
    }
    if (rig.rightForearmPivot) {
      rig.rightForearmPivot.rotation.x += (rightElbowBend - rig.rightForearmPivot.rotation.x) * damping;
    }

    // Organic torso locomotion: vertical bob, gentle lateral pelvic sway, slight forward lean
    rig.bodyGroup.position.y += (bob - rig.bodyGroup.position.y) * damping;
    rig.bodyGroup.rotation.z += (swayZ - rig.bodyGroup.rotation.z) * damping;
    rig.bodyGroup.rotation.x += (forwardLean - rig.bodyGroup.rotation.x) * damping;
  } else {
    const breathe = standStill ? 0 : Math.sin(elapsed * 2.1) * 0.006;
    const armIdle = standStill ? 0 : 0.035 * Math.sin(elapsed * 1.4);
    rig.leftLegPivot.rotation.x += (0 - rig.leftLegPivot.rotation.x) * damping;
    rig.rightLegPivot.rotation.x += (0 - rig.rightLegPivot.rotation.x) * damping;
    if (rig.leftKneePivot) {
      rig.leftKneePivot.rotation.x += (0 - rig.leftKneePivot.rotation.x) * damping;
    }
    if (rig.rightKneePivot) {
      rig.rightKneePivot.rotation.x += (0 - rig.rightKneePivot.rotation.x) * damping;
    }
    rig.leftArmPivot.rotation.x += (armIdle - rig.leftArmPivot.rotation.x) * damping;
    rig.rightArmPivot.rotation.x += (-armIdle - rig.rightArmPivot.rotation.x) * damping;
    if (rig.leftForearmPivot) {
      rig.leftForearmPivot.rotation.x += (0.08 - rig.leftForearmPivot.rotation.x) * damping;
    }
    if (rig.rightForearmPivot) {
      rig.rightForearmPivot.rotation.x += (0.08 - rig.rightForearmPivot.rotation.x) * damping;
    }
    rig.bodyGroup.position.y += (breathe - rig.bodyGroup.position.y) * damping;
    rig.bodyGroup.rotation.z += (0 - rig.bodyGroup.rotation.z) * damping;
    rig.bodyGroup.rotation.x += (0 - rig.bodyGroup.rotation.x) * damping;
  }
}
