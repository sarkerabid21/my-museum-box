/**
 * Kashmir 3D Environment Builder:
 * Hyper-realistic Unreal Engine 5 aesthetic alpine landscape,
 * scenic highway mountain pass, snow-covered pine forests,
 * frozen Dal Lake ice rink, Gondola Cable Car system,
 * snowman crafting arena, snowball-fight NPCs, and ski slopes.
 */

import * as THREE from 'three';
import {
  KASHMIR_HIGHWAY_WAYPOINTS,
  GONDOLA_BASE_STATION,
  GONDOLA_SUMMIT_STATION,
  INITIAL_KASHMIR_NPCS,
  type BuiltSnowman,
  type GondolaCabinState,
} from '../museum/kashmirWorld';

export interface KashmirBuildResult {
  group: THREE.Group;
  gondolaCabins: THREE.Group[];
  gondolaCables: THREE.LineSegments;
  snowParticles: THREE.Points;
  updateSnowParticles: (dt: number, cameraPos: THREE.Vector3) => void;
  npcMeshes: Map<string, THREE.Group>;
  createBuiltSnowmanMesh: (snowman: BuiltSnowman) => THREE.Group;
}

export function buildKashmirEnvironment(
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T,
  interactables: THREE.Object3D[]
): KashmirBuildResult {
  const group = new THREE.Group();

  // ─────────────────────────────────────────────────────────────────────────
  // MATERIALS (High-fidelity textures, specular snow, reflective ice)
  // ─────────────────────────────────────────────────────────────────────────
  const snowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.82,
      metalness: 0.05,
    })
  );

  const snowSparkleMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.35,
      metalness: 0.18,
    })
  );

  const frozenIceMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      roughness: 0.08,
      metalness: 0.55,
      transparent: true,
      opacity: 0.88,
    })
  );

  const darkAsphaltMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.75,
      metalness: 0.1,
    })
  );

  const yellowLineMat = trackMat(
    new THREE.MeshBasicMaterial({ color: 0xfacc15 })
  );

  const woodChaletMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.85,
    })
  );

  const chaletRoofMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1e3a5f,
      roughness: 0.6,
    })
  );

  const warmWindowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: new THREE.Color(0xfbbf24),
      emissiveIntensity: 0.65,
      roughness: 0.2,
    })
  );

  const pineBarkMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x451a03,
      roughness: 0.9,
    })
  );

  const pineNeedleMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x14532d,
      roughness: 0.8,
    })
  );

  const steelCableMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.85,
      roughness: 0.25,
    })
  );

  const gondolaGlassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf0fdf4,
      roughness: 0.02,
      metalness: 0.05,
      transparent: true,
      opacity: 0.10,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );

  const mountainRockMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.95,
      metalness: 0.1,
    })
  );

  // Helper for crisp Bengali / English signboards
  const makeSignTex = (title: string, subtitle: string, bg: string, text: string): THREE.Material => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = text;
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

    ctx.fillStyle = text;
    ctx.font = 'bold 58px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, 512, 85);

    ctx.font = 'bold 36px sans-serif';
    ctx.fillText(subtitle, 512, 175);

    const tex = new THREE.CanvasTexture(canvas);
    return trackMat(new THREE.MeshBasicMaterial({ map: tex }));
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 1. TRANSITION PASS & HIGHWAY CORRIDOR (CTG Zero Point -> Kashmir)
  // ─────────────────────────────────────────────────────────────────────────
  // Grand Mountain Arch Gateway at x = -430
  const passArch = new THREE.Group();
  passArch.position.set(-430, 0, 68);

  const pL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.0, 14.0, 4.0)), mountainRockMat);
  pL.position.set(0, 7.0, -11.0);
  passArch.add(pL);

  const pR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.0, 14.0, 4.0)), mountainRockMat);
  pR.position.set(0, 7.0, 11.0);
  passArch.add(pR);

  const archSpan = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.5, 4.0, 26.0)), mountainRockMat);
  archSpan.position.set(0, 12.0, 0);
  passArch.add(archSpan);

  // Grand Mountain Arch Gateway Banners (Mounted flush across the arch facing directly from the front)
  const signEastMat = makeSignTex(
    'স্বাগতম কাশ্মীর · ভূস্বর্গ ও তুষার উপত্যকা',
    'WELCOME TO KASHMIR · PARADISE ON EARTH · GULMARG & DAL LAKE',
    '#064e3b',
    '#fef08a'
  );
  // East-facing banner backing frame (Spanning along Z across the roadway)
  const bannerBackingEast = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 3.4, 18.4)), mountainRockMat);
  bannerBackingEast.position.set(2.28, 12.0, 0);
  passArch.add(bannerBackingEast);

  // East-facing banner plane (Normal points directly at +X, viewable straight from the front oncoming from CTG)
  const gatewaySignEast = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(18.0, 3.2)), signEastMat);
  gatewaySignEast.position.set(2.38, 12.0, 0);
  gatewaySignEast.rotation.y = Math.PI / 2;
  passArch.add(gatewaySignEast);

  // West-facing banner backing frame & sign (Normal points directly at -X, viewable straight from the front returning from Kashmir)
  const signWestMat = makeSignTex(
    'বিদায় কাশ্মীর · আবার আসবেন',
    'BON VOYAGE KASHMIR · SAFE TRAVELS TO CHITTAGONG ZERO POINT',
    '#064e3b',
    '#fef08a'
  );
  const bannerBackingWest = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 3.4, 18.4)), mountainRockMat);
  bannerBackingWest.position.set(-2.28, 12.0, 0);
  passArch.add(bannerBackingWest);

  const gatewaySignWest = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(18.0, 3.2)), signWestMat);
  gatewaySignWest.position.set(-2.38, 12.0, 0);
  gatewaySignWest.rotation.y = -Math.PI / 2;
  passArch.add(gatewaySignWest);

  group.add(passArch);

  // Smooth curved highway road from CTG Zero Point (-395) to Gulmarg Resort (-750)
  const pts = KASHMIR_HIGHWAY_WAYPOINTS;
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    const segLen = Math.hypot(dx, dz);
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const midZ = (p1.z + p2.z) / 2;
    const ang = Math.atan2(dx, dz);

    const roadSeg = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(9.6, 0.12, segLen + 0.1)),
      darkAsphaltMat
    );
    roadSeg.position.set(midX, midY, midZ);
    roadSeg.rotation.y = ang;
    group.add(roadSeg);

    // Double yellow center divider line
    const yLine = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.24, 0.14, segLen + 0.1)),
      yellowLineMat
    );
    yLine.position.set(midX, midY + 0.01, midZ);
    yLine.rotation.y = ang;
    group.add(yLine);

    // Guardrails along mountain drop
    for (const side of [-5.2, 5.2]) {
      const tox = Math.cos(ang) * side;
      const toz = -Math.sin(ang) * side;
      const guardrail = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.18, 0.85, segLen)),
        steelCableMat
      );
      guardrail.position.set(midX + tox, midY + 0.45, midZ + toz);
      guardrail.rotation.y = ang;
      group.add(guardrail);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. SNOW TERRAIN & FROZEN DAL LAKE
  // ─────────────────────────────────────────────────────────────────────────
  // Vast White Snow Ground (x: -430 to -820, z: -30 to 210)
  const snowGround = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(390, 240, 32, 32)),
    snowMat
  );
  snowGround.rotation.x = -Math.PI / 2;
  snowGround.position.set(-625, 2.5, 90);
  group.add(snowGround);

  // Frozen Dal Lake (Ice Sheet at x: -640 to -580, z: 18 to 60)
  const lakeIce = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(60, 0.25, 42)),
    frozenIceMat
  );
  lakeIce.position.set(-610, 2.85, 39);
  lakeIce.userData.isDalLakeIce = true;
  interactables.push(lakeIce);
  group.add(lakeIce);

  // Dal Lake Ice Rink wooden barrier & festive flags
  const rinkFence = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(62, 0.75, 44)),
    woodChaletMat
  );
  rinkFence.position.set(-610, 3.1, 39);
  group.add(rinkFence);

  const lakeSign = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(10, 2.0, 0.2)),
    makeSignTex(
      'ডাল লেক আইস স্কেটিং রিংক · DAL LAKE',
      'FROZEN DAL LAKE ICE SKATING & GLIDING RINK',
      '#1e3a8a',
      '#ffffff'
    )
  );
  lakeSign.position.set(-610, 4.8, 17.5);
  group.add(lakeSign);

  // ─────────────────────────────────────────────────────────────────────────
  // 3. SNOW-COVERED HIMALAYAN PINE FORESTS
  // ─────────────────────────────────────────────────────────────────────────
  const pineCoords: Array<[number, number, number]> = [
    // Along mountain pass
    [-445, 45, 1.2], [-455, 88, 1.4], [-465, 40, 1.8], [-475, 95, 2.0],
    [-485, 35, 2.3], [-495, 105, 2.5], [-505, 30, 2.6],
    // Surrounding Dal Lake & Chalet Village
    [-530, 25, 3.0], [-545, 15, 3.0], [-565, 12, 3.0], [-580, 8, 3.0],
    [-595, 10, 3.0], [-625, 12, 3.0], [-640, 20, 3.0],
    // Surrounding Gondola base & ski slopes (Relocated to prevent any overlap with station, promenade, or cables)
    [-650, 105, 3.8], [-652, 110, 3.8], [-680, 130, 8.5], [-706, 145, 12.0],
    [-710, 160, 18.0], [-725, 175, 24.0], [-740, 185, 30.0],
    [-635, 110, 4.0], [-645, 135, 6.5], [-660, 155, 10.5],
  ];

  for (const [px, pz, py] of pineCoords) {
    const tree = new THREE.Group();
    tree.position.set(px, py, pz);

    // Trunk
    const trunk = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.35, 0.5, 4.5, 8)), pineBarkMat);
    trunk.position.y = 2.25;
    tree.add(trunk);

    // 3 Foliage Tiers with Thick Procedural Snow Caps
    const tiers = [
      { r: 3.5, h: 4.0, y: 4.5 },
      { r: 2.6, h: 3.5, y: 7.0 },
      { r: 1.6, h: 2.8, y: 9.2 },
    ];
    for (const t of tiers) {
      // Green Pine Needles
      const foliage = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(t.r, t.h, 8)), pineNeedleMat);
      foliage.position.y = t.y;
      tree.add(foliage);

      // Heavy White Snow Cap resting on the foliage
      const snowCap = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(t.r * 1.05, t.h * 0.45, 8)), snowSparkleMat);
      snowCap.position.y = t.y + t.h * 0.28;
      tree.add(snowCap);
    }
    group.add(tree);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. ALPINE CHALETS & HOT KASHMIRI KAHWA TEA STALLS
  // ─────────────────────────────────────────────────────────────────────────
  for (const [cx, cz, rot] of [
    [-540, 85, 0],
    [-560, 88, 0.2],
    [-535, 45, Math.PI],
    [-555, 42, Math.PI - 0.2],
  ] as [number, number, number][]) {
    const chalet = new THREE.Group();
    chalet.position.set(cx, 3.1, cz);
    chalet.rotation.y = rot;

    // Wooden Cabin Walls (Width 10m, Depth 8m, Height 5.5m)
    const walls = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(10, 5.5, 8)), woodChaletMat);
    walls.position.y = 2.75;
    chalet.add(walls);

    // Steep Alpine A-Frame Roof (Width 11m, Depth 9m)
    const roof = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(7.5, 4.5, 4)), chaletRoofMat);
    roof.position.y = 7.2;
    roof.rotation.y = Math.PI / 4;
    chalet.add(roof);

    // Thick Snow Covering on Roof
    const roofSnow = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(7.8, 4.6, 4)), snowSparkleMat);
    roofSnow.position.y = 7.35;
    roofSnow.rotation.y = Math.PI / 4;
    chalet.add(roofSnow);

    // Warm glowing windows
    for (const wx of [-3.2, 3.2]) {
      const win = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.8, 1.8, 0.1)), warmWindowMat);
      win.position.set(wx, 2.8, 4.05);
      chalet.add(win);
    }

    // Traditional Stone Chimney
    const chimney = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.1, 4.8, 1.1)), mountainRockMat);
    chimney.position.set(3.0, 7.5, 1.5);
    chalet.add(chimney);

    group.add(chalet);
  }

  // Kashmiri Kahwa Tea Stall Signboard
  const kahwaSign = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(6.5, 1.4, 0.2)),
    makeSignTex(
      'কাশ্মীরি জাফরান কাওয়া ও চা · KAHWA',
      'HOT KASHMIRI KAHWA, SAFFRON TEA & DRY FRUITS',
      '#78350f',
      '#fef08a'
    )
  );
  kahwaSign.position.set(-540, 5.5, 80.8);
  group.add(kahwaSign);

  // ─────────────────────────────────────────────────────────────────────────
  // 5. SNOWMAN CRAFTING & SNOWBALL BATTLE ARENA
  // ─────────────────────────────────────────────────────────────────────────
  // Snow barricades & mounds for friendly snowball battles (x: -635 to -585, z: 65 to 105)
  const arena = new THREE.Group();
  arena.position.set(-610, 3.5, 85);

  const arenaSign = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(14, 2.2, 0.3)),
    makeSignTex(
      'স্নোম্যান তৈরি ও বরফ যুদ্ধ এরিনা',
      'SNOWMAN CRAFTING & MULTIPLAYER SNOWBALL FIGHT ARENA',
      '#065f46',
      '#ffffff'
    )
  );
  arenaSign.position.set(0, 4.5, -16.0);
  arena.add(arenaSign);

  // Snow battle ramparts & chest-high barriers
  for (const [bx, bz, bw] of [
    [-8, -6, 7], [8, -6, 7],
    [-10, 8, 8], [10, 8, 8],
    [0, 14, 10], [0, -14, 10],
  ] as [number, number, number][]) {
    const rampart = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(bw, 1.25, 1.4)),
      snowSparkleMat
    );
    rampart.position.set(bx, 0.62, bz);
    arena.add(rampart);
  }
  group.add(arena);

  // Function to dynamically build customized snowman models
  const createBuiltSnowmanMesh = (sm: BuiltSnowman): THREE.Group => {
    const smGrp = new THREE.Group();
    smGrp.position.set(sm.x, sm.y, sm.z);

    // Base sphere
    const bGeo = trackGeo(new THREE.SphereGeometry(sm.baseRadius, 16, 12));
    const base = new THREE.Mesh(bGeo, snowSparkleMat);
    base.position.y = sm.baseRadius;
    smGrp.add(base);

    // Torso sphere
    const tGeo = trackGeo(new THREE.SphereGeometry(sm.torsoRadius, 16, 12));
    const torso = new THREE.Mesh(tGeo, snowSparkleMat);
    const torsoY = sm.baseRadius * 1.65 + sm.torsoRadius;
    torso.position.y = torsoY;
    smGrp.add(torso);

    // Head sphere
    const hGeo = trackGeo(new THREE.SphereGeometry(sm.headRadius, 16, 12));
    const head = new THREE.Mesh(hGeo, snowSparkleMat);
    const headY = torsoY + sm.torsoRadius * 0.8 + sm.headRadius;
    head.position.y = headY;
    smGrp.add(head);

    // Accessories
    const darkCoalMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 }));
    const orangeCarrotMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.5 }));
    const redScarfMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.7 }));
    const goldScarfMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.6 }));

    // Carrot Nose
    if (sm.customization.carrotNose) {
      const carrot = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.06, 0.28, 8)), orangeCarrotMat);
      carrot.rotation.x = Math.PI / 2;
      carrot.position.set(0, headY, sm.headRadius + 0.12);
      smGrp.add(carrot);
    }

    // Coal Eyes
    if (sm.customization.coalEyes) {
      for (const ex of [-0.09, 0.09]) {
        const eye = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.035, 8, 6)), darkCoalMat);
        eye.position.set(ex, headY + 0.08, sm.headRadius * 0.9);
        smGrp.add(eye);
      }
    }

    // Coal Buttons
    if (sm.customization.coalButtons) {
      for (const by of [-0.12, 0.0, 0.12]) {
        const btn = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.038, 8, 6)), darkCoalMat);
        btn.position.set(0, torsoY + by, sm.torsoRadius * 0.95);
        smGrp.add(btn);
      }
    }

    // Stick Arms
    if (sm.customization.stickArms) {
      for (const dir of [-1, 1]) {
        const arm = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.025, 0.03, 0.85, 6)), pineBarkMat);
        arm.position.set(dir * (sm.torsoRadius + 0.35), torsoY + 0.1, 0);
        arm.rotation.z = dir * -Math.PI / 3;
        smGrp.add(arm);
      }
    }

    // Scarf
    if (sm.customization.scarf !== 'none') {
      const sMat = sm.customization.scarf === 'golden_silk' ? goldScarfMat : redScarfMat;
      const scarf = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(sm.torsoRadius * 0.78, 0.07, 8, 16)), sMat);
      scarf.position.y = torsoY + sm.torsoRadius * 0.82;
      scarf.rotation.x = Math.PI / 2;
      smGrp.add(scarf);
    }

    // Hat
    if (sm.customization.hat === 'top_hat') {
      const brim = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(sm.headRadius * 1.3, sm.headRadius * 1.3, 0.04, 16)), darkCoalMat);
      brim.position.y = headY + sm.headRadius * 0.95;
      smGrp.add(brim);

      const crown = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(sm.headRadius * 0.75, sm.headRadius * 0.75, 0.42, 16)), darkCoalMat);
      crown.position.y = headY + sm.headRadius * 0.95 + 0.21;
      smGrp.add(crown);
    } else if (sm.customization.hat === 'beanie') {
      const beanie = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(sm.headRadius * 1.05, 12, 8)), redScarfMat);
      beanie.position.y = headY + sm.headRadius * 0.4;
      smGrp.add(beanie);
    }

    return smGrp;
  };

  // Pre-place 2 showcase snowmen in the arena
  const prebuilt1 = createBuiltSnowmanMesh({
    id: 'sm-showcase-1',
    x: -614.0,
    y: 3.5,
    z: 82.0,
    baseRadius: 0.75,
    torsoRadius: 0.52,
    headRadius: 0.35,
    customization: {
      hat: 'top_hat',
      scarf: 'red_wool',
      carrotNose: true,
      stickArms: true,
      coalEyes: true,
      coalButtons: true,
    },
    createdAt: 0,
  });
  group.add(prebuilt1);

  const prebuilt2 = createBuiltSnowmanMesh({
    id: 'sm-showcase-2',
    x: -606.0,
    y: 3.5,
    z: 94.0,
    baseRadius: 0.65,
    torsoRadius: 0.45,
    headRadius: 0.30,
    customization: {
      hat: 'beanie',
      scarf: 'golden_silk',
      carrotNose: true,
      stickArms: true,
      coalEyes: true,
      coalButtons: true,
    },
    createdAt: 0,
  });
  group.add(prebuilt2);

  // ─────────────────────────────────────────────────────────────────────────
  // 6. SNOWBALL FIGHTER NPCS
  // ─────────────────────────────────────────────────────────────────────────
  const npcMeshes = new Map<string, THREE.Group>();
  const clothPhiranMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.8 }));
  const clothFleeceMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.8 }));
  const skinMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.7 }));

  for (const npc of INITIAL_KASHMIR_NPCS) {
    const npcGrp = new THREE.Group();
    npcGrp.position.set(npc.x, npc.y, npc.z);

    // Warm winter Phiran / Coat
    const body = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.38, 0.48, 1.35, 12)),
      npc.id.includes('fatima') || npc.id.includes('zoya') ? clothFleeceMat : clothPhiranMat
    );
    body.position.y = 0.9;
    npcGrp.add(body);

    // Head with warm beanie
    const head = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.22, 12, 10)), skinMat);
    head.position.y = 1.75;
    npcGrp.add(head);

    const beanie = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.24, 0.22, 10)), clothFleeceMat);
    beanie.position.y = 1.92;
    npcGrp.add(beanie);

    // Winter muffler scarf
    const scarf = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.25, 0.08, 8, 16)), warmWindowMat);
    scarf.position.y = 1.6;
    scarf.rotation.x = Math.PI / 2;
    npcGrp.add(scarf);

    // Overhead Name Tag & Interaction Prompt
    const npcTag = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(2.4, 0.45, 0.08)),
      makeSignTex(npc.name, npc.banglaTitle, '#1e293b', '#38bdf8')
    );
    npcTag.position.y = 2.45;
    npcGrp.add(npcTag);

    npcGrp.userData.kashmirNpcId = npc.id;
    interactables.push(npcGrp);
    group.add(npcGrp);
    npcMeshes.set(npc.id, npcGrp);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 7. GULMARG GONDOLA CABLE CAR SYSTEM
  // ─────────────────────────────────────────────────────────────────────────
  // A) Valley Base Terminal & 2-Level Ticket Counter Station at x = -665, z = 125
  const baseSt = new THREE.Group();
  baseSt.position.set(GONDOLA_BASE_STATION.x, 0, GONDOLA_BASE_STATION.z);

  // 1. Ground Floor Plinth & Foundation (y = 3.6 to 3.8m)
  const basePlinth = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(22, 0.4, 20)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 }))
  );
  basePlinth.position.set(0, 3.6, 0);
  baseSt.add(basePlinth);

  // 2. Open Alpine Chalet Timber Structural Frame (Columns & Beams)
  for (const cx of [-9.8, 9.8]) {
    for (const cz of [-8.8, 0, 8.8]) {
      const col = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.5, 7.0, 0.5)),
        woodChaletMat
      );
      col.position.set(cx, 7.3, cz);
      baseSt.add(col);
    }
  }

  // 3. Grand Front Entrance Marquee Signboard (Facing South towards Promenade & Highway)
  const baseSign = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(18, 2.0, 0.2)),
    makeSignTex(
      'গুলমার্গ গন্ডোলা কেবল কার টার্মিনাল ও টিকেট কাউন্টার',
      'GULMARG ALPINE GONDOLA TERMINAL & TICKET COUNTER · TO APHARWAT SUMMIT',
      '#065f46',
      '#ffffff'
    )
  );
  baseSign.position.set(0, 6.8, -9.1);
  baseSign.userData.isGondolaBase = true;
  interactables.push(baseSign);
  baseSt.add(baseSign);

  // 4. Ground Floor Ticket Counter Booth (কাউন্টার) at z = -4.5
  const counterDesk = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(7.2, 1.15, 1.4)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.7 }))
  );
  counterDesk.position.set(0, 4.38, -4.5);
  counterDesk.userData.isGondolaTicketCounter = true;
  interactables.push(counterDesk);
  baseSt.add(counterDesk);

  const counterTop = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(7.4, 0.1, 1.5)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.25 }))
  );
  counterTop.position.set(0, 4.98, -4.5);
  baseSt.add(counterTop);

  // Counter Glass Screen with ticket speak-holes
  const counterGlass = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(7.0, 1.25, 0.06)),
    gondolaGlassMat
  );
  counterGlass.position.set(0, 5.62, -4.5);
  baseSt.add(counterGlass);

  // Ticket Counter Overhead Illuminated Sign
  const counterSign = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(7.0, 0.9, 0.15)),
    makeSignTex(
      '🎫 টিকেট কাউন্টার · TICKET COUNTER',
      'সাধারণ টিকেট: ১০০৳ · মাউন্টেন পাস: ২৫০৳ · প্রেস [E]',
      '#1e3a8a',
      '#facc15'
    )
  );
  counterSign.position.set(0, 6.45, -4.5);
  counterSign.userData.isGondolaTicketCounter = true;
  interactables.push(counterSign);
  baseSt.add(counterSign);

  // Attendant NPC inside ticket booth
  const attendant = new THREE.Group();
  attendant.position.set(0, 3.8, -5.2);
  const attBody = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.35, 0.45, 1.35, 10)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x065f46, roughness: 0.7 }))
  );
  attBody.position.y = 0.9;
  attendant.add(attBody);
  const attHead = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.2, 10, 10)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.6 }))
  );
  attHead.position.y = 1.75;
  attendant.add(attHead);
  baseSt.add(attendant);

  // Turnstile automated entry gates at z = -2.5
  for (const gx of [-2.4, 2.4]) {
    const turnstile = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(1.8, 1.0, 0.35)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 }))
    );
    turnstile.position.set(gx, 4.3, -2.5);
    baseSt.add(turnstile);

    const passLight = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.08, 8, 8)),
      trackMat(new THREE.MeshBasicMaterial({ color: 0x22c55e }))
    );
    passLight.position.set(gx, 4.85, -2.5);
    baseSt.add(passLight);
  }

  // 5. Boarding Stairs (সিঁড়ি) ascending from Ground (y=3.8) to 2nd Floor Platform (y=4.8)
  const stairSteps = 8;
  for (let s = 0; s < stairSteps; s++) {
    const sf = s / (stairSteps - 1);
    const stepMesh = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(4.2, 0.125, 0.45)),
      woodChaletMat
    );
    stepMesh.position.set(0, 3.85 + sf * 0.95, -1.8 + s * 0.45);
    baseSt.add(stepMesh);
  }

  // Staircase Handrails
  for (const hx of [-2.15, 2.15]) {
    const rail = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.04, 0.04, 4.2, 8)),
      steelCableMat
    );
    rail.rotation.x = Math.atan2(0.95, 3.15);
    rail.position.set(hx, 4.85, -0.2);
    baseSt.add(rail);
  }

  // Stairway Direction Sign
  const stairSign = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(4.2, 0.5, 0.1)),
    makeSignTex(
      '⬆️ ২য় তলা গন্ডোলা বোর্ডিং প্ল্যাটফর্ম',
      'STAIRS TO 2ND FLOOR BOARDING PLATFORM',
      '#0f172a',
      '#38bdf8'
    )
  );
  stairSign.position.set(0, 5.5, -2.0);
  baseSt.add(stairSign);

  // 6. 2nd Floor Elevated Boarding Platform Deck (y = 4.8m)
  const platformDeck = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(19, 0.35, 12)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x5a3825, roughness: 0.65 }))
  );
  platformDeck.position.set(0, 4.75, 4.0);
  baseSt.add(platformDeck);

  // Safety Yellow Boarding Edge Line along docking side
  const safetyStripe = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(18.8, 0.02, 0.35)),
    trackMat(new THREE.MeshBasicMaterial({ color: 0xfacc15 }))
  );
  safetyStripe.position.set(0, 4.93, 2.2);
  baseSt.add(safetyStripe);

  // Glass Safety Balustrade along Platform perimeter
  for (const bz of [9.8]) {
    const balustrade = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(18.6, 1.1, 0.04)),
      gondolaGlassMat
    );
    balustrade.position.set(0, 5.5, bz);
    baseSt.add(balustrade);
  }
  for (const bx of [-9.2, 9.2]) {
    const sideBal = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.04, 1.1, 11.6)),
      gondolaGlassMat
    );
    sideBal.position.set(bx, 5.5, 4.0);
    baseSt.add(sideBal);
  }

  // Boarding Dock Sign
  const dockSign = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(6.5, 0.8, 0.1)),
    makeSignTex(
      '🚡 কেবল কার বোর্ডিং গেট · BOARDING DOCK',
      'প্রেস [E] বা [T] চেপে গন্ডোলা কেবল কারে উঠুন',
      '#065f46',
      '#facc15'
    )
  );
  dockSign.position.set(0, 6.8, 2.0);
  dockSign.userData.isGondolaBase = true;
  interactables.push(dockSign);
  baseSt.add(dockSign);

  // Waiting Benches on Platform
  for (const bx of [-6.0, 6.0]) {
    const bench = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(3.2, 0.45, 0.65)),
      woodChaletMat
    );
    bench.position.set(bx, 5.15, 7.5);
    baseSt.add(bench);
  }

  // 7. Gabled Swiss Chalet Roof Canopy (y = 10.5m)
  const baseRoof = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(23, 0.7, 21)),
    chaletRoofMat
  );
  baseRoof.position.set(0, 10.5, 0);
  baseSt.add(baseRoof);

  group.add(baseSt);

  // Scenic Pedestrian Promenade connecting Highway (z = 72) to Gondola Base Station (z = 125)
  const walkwayGeo = trackGeo(new THREE.BoxGeometry(5.2, 0.15, 46));
  const walkwayMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 }));
  const walkway = new THREE.Mesh(walkwayGeo, walkwayMat);
  walkway.position.set(-665, 3.82, 95);
  group.add(walkway);

  // Warm promenade lanterns along both sides of walkway
  for (const lz of [78, 90, 102, 114]) {
    for (const side of [-3.0, 3.0]) {
      const lampPost = new THREE.Group();
      lampPost.position.set(-665 + side, 3.8, lz);
      const post = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.08, 0.1, 3.2, 8)), darkAsphaltMat);
      post.position.y = 1.6;
      lampPost.add(post);

      const bulb = new THREE.Mesh(
        trackGeo(new THREE.SphereGeometry(0.2, 8, 8)),
        trackMat(new THREE.MeshBasicMaterial({ color: 0xfde047 }))
      );
      bulb.position.y = 3.3;
      lampPost.add(bulb);
      group.add(lampPost);
    }
  }

  // B) Summit Peak Station at x = -755, z = 185, y = 38.1m
  const summitSt = new THREE.Group();
  summitSt.position.set(GONDOLA_SUMMIT_STATION.x, 0, GONDOLA_SUMMIT_STATION.z);

  const sumBuilding = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(22, 6.5, 18)),
    mountainRockMat
  );
  sumBuilding.position.set(0, 36.0, 0);
  summitSt.add(sumBuilding);

  const sumSign = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(18, 1.8, 0.2)),
    makeSignTex(
      'আফরওয়াত সামিট পিক টার্মিনাল ও অবজারভেশন ডেক (উচ্চতা ৩,৯৫০ মি.)',
      'APHARWAT SUMMIT PEAK GONDOLA TERMINAL & OBSERVATION DECK',
      '#1e3a8a',
      '#facc15'
    )
  );
  sumSign.position.set(0, 40.5, -9.1);
  sumSign.userData.isGondolaSummit = true;
  interactables.push(sumSign);
  summitSt.add(sumSign);
  group.add(summitSt);

  // C) Intermediate Steel Lattice Pylon Towers (Positioned between Base z=125 and Summit z=185)
  for (const [tx, tz, ty, th] of [
    [-695, 145, 12.0, 18.0],
    [-725, 165, 22.0, 18.0],
  ] as [number, number, number, number][]) {
    const pylon = new THREE.Group();
    pylon.position.set(tx, ty, tz);

    const mast = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.4, 0.9, th, 8)), steelCableMat);
    mast.position.y = th / 2;
    pylon.add(mast);

    const crossArm = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.5, 0.5, 1.2)), steelCableMat);
    crossArm.position.y = th - 0.25;
    pylon.add(crossArm);

    // Cable Pulleys
    for (const px of [-2.4, 2.4]) {
      const pulley = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.45, 0.45, 0.2, 12)), darkAsphaltMat);
      pulley.rotation.z = Math.PI / 2;
      pulley.position.set(px, th - 0.5, 0);
      pylon.add(pulley);
    }
    group.add(pylon);
  }

  // D) Continuous Aerial Cables
  const cablePts: number[] = [];
  const cableSteps = 24;
  for (let i = 0; i < cableSteps; i++) {
    const f1 = i / cableSteps;
    const f2 = (i + 1) / cableSteps;
    const sag1 = Math.sin(f1 * Math.PI) * -1.8;
    const sag2 = Math.sin(f2 * Math.PI) * -1.8;

    for (const offset of [-1.2, 1.2]) {
      const x1 = GONDOLA_BASE_STATION.x + f1 * (GONDOLA_SUMMIT_STATION.x - GONDOLA_BASE_STATION.x) + offset;
      const y1 = GONDOLA_BASE_STATION.y + f1 * (GONDOLA_SUMMIT_STATION.y - GONDOLA_BASE_STATION.y) + sag1 + 2.9;
      const z1 = GONDOLA_BASE_STATION.z + f1 * (GONDOLA_SUMMIT_STATION.z - GONDOLA_BASE_STATION.z);

      const x2 = GONDOLA_BASE_STATION.x + f2 * (GONDOLA_SUMMIT_STATION.x - GONDOLA_BASE_STATION.x) + offset;
      const y2 = GONDOLA_BASE_STATION.y + f2 * (GONDOLA_SUMMIT_STATION.y - GONDOLA_BASE_STATION.y) + sag2 + 2.9;
      const z2 = GONDOLA_BASE_STATION.z + f2 * (GONDOLA_SUMMIT_STATION.z - GONDOLA_BASE_STATION.z);

      cablePts.push(x1, y1, z1, x2, y2, z2);
    }
  }

  const cableGeo = trackGeo(new THREE.BufferGeometry());
  cableGeo.setAttribute('position', new THREE.Float32BufferAttribute(cablePts, 3));
  const gondolaCables = new THREE.LineSegments(
    cableGeo,
    trackMat(new THREE.LineBasicMaterial({ color: 0x475569, linewidth: 2 }))
  );
  group.add(gondolaCables);

  // E) 4 Panoramic Hollow Glass Observation Gondola Cabins
  const cabinColors = [0xdc2626, 0x2563eb, 0x16a34a, 0xf59e0b];
  const seatMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x831843, roughness: 0.6 }));
  const lampFixtureMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xfef08a }));
  const gondolaCabins: THREE.Group[] = [];

  for (let i = 0; i < 4; i++) {
    const cGrp = new THREE.Group();

    // Cabin Body Structure (Width 2.2m, Height 2.4m, Depth 2.2m)
    const bodyMat = trackMat(new THREE.MeshStandardMaterial({ color: cabinColors[i], roughness: 0.35, metalness: 0.3 }));

    // Floor Base (Hollow pod bottom)
    const basePod = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.2, 0.22, 2.2)), bodyMat);
    basePod.position.y = -1.1;
    cGrp.add(basePod);

    // Roof Canopy
    const roofPod = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.2, 0.25, 2.2)), bodyMat);
    roofPod.position.y = 1.1;
    cGrp.add(roofPod);

    // Thin Structural Corner Pillars (Leaving panoramic 360 view unobstructed)
    for (const [px, pz] of [[-1.04, -1.04], [1.04, -1.04], [-1.04, 1.04], [1.04, 1.04]]) {
      const post = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.06, 2.0, 0.06)), bodyMat);
      post.position.set(px, 0.0, pz);
      cGrp.add(post);
    }

    // Panoramic 4-Sided Ultra-Clear Glass Panes (DoubleSide, pristine clarity for breathtaking mountain views)
    // Front window (+Z)
    const winFront = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.98, 1.95, 0.02)), gondolaGlassMat);
    winFront.position.set(0, 0.0, 1.04);
    cGrp.add(winFront);

    // Back window (-Z)
    const winBack = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.98, 1.95, 0.02)), gondolaGlassMat);
    winBack.position.set(0, 0.0, -1.04);
    cGrp.add(winBack);

    // Left window (-X)
    const winLeft = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.02, 1.95, 1.98)), gondolaGlassMat);
    winLeft.position.set(-1.04, 0.0, 0);
    cGrp.add(winLeft);

    // Right window (+X)
    const winRight = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.02, 1.95, 1.98)), gondolaGlassMat);
    winRight.position.set(1.04, 0.0, 0);
    cGrp.add(winRight);

    // Interior Passenger Bench Seats (Comfortable cabin seats facing each other)
    for (const sz of [-0.65, 0.65]) {
      const seat = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.6, 0.35, 0.45)), seatMat);
      seat.position.set(0, -0.65, sz);
      cGrp.add(seat);
    }

    // Cabin Ceiling Ambient Lamp
    const ceilingLamp = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 12)),
      lampFixtureMat
    );
    ceilingLamp.position.set(0, 0.95, 0);
    cGrp.add(ceilingLamp);

    // Suspension Hanger Arm & Cable Clamp (Attaches directly to cable at y = 2.9m)
    const hanger = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 8)), steelCableMat);
    hanger.position.set(0, 2.0, 0);
    cGrp.add(hanger);

    const clamp = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.3, 0.3, 0.8)), steelCableMat);
    clamp.position.set(0, 2.9, 0);
    cGrp.add(clamp);

    cGrp.userData.isGondolaCabin = true;
    cGrp.userData.cabinId = i;
    interactables.push(cGrp);
    group.add(cGrp);
    gondolaCabins.push(cGrp);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 8. DYNAMIC SNOWFALL PARTICLE SYSTEM
  // ─────────────────────────────────────────────────────────────────────────
  const snowFlakeCount = 1800;
  const snowPos = new Float32Array(snowFlakeCount * 3);
  const snowVelocities = new Float32Array(snowFlakeCount);

  for (let i = 0; i < snowFlakeCount; i++) {
    snowPos[i * 3 + 0] = (Math.random() - 0.5) * 120;
    snowPos[i * 3 + 1] = Math.random() * 45;
    snowPos[i * 3 + 2] = (Math.random() - 0.5) * 120;
    snowVelocities[i] = 1.2 + Math.random() * 2.4; // Fall speed 1.2 - 3.6 m/s
  }

  const snowGeo = trackGeo(new THREE.BufferGeometry());
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));

  // Circular soft snowflake texture
  const snowCanvas = document.createElement('canvas');
  snowCanvas.width = 32;
  snowCanvas.height = 32;
  const sCtx = snowCanvas.getContext('2d')!;
  const grad = sCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.5, 'rgba(235, 245, 255, 0.7)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, 32, 32);
  const snowTex = new THREE.CanvasTexture(snowCanvas);

  const snowMatPoints = trackMat(
    new THREE.PointsMaterial({
      size: 0.45,
      map: snowTex,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );

  const snowParticles = new THREE.Points(snowGeo, snowMatPoints);
  group.add(snowParticles);

  const updateSnowParticles = (dt: number, cameraPos: THREE.Vector3) => {
    // Only animate snowflakes when camera is near or inside Kashmir (x <= -410)
    if (cameraPos.x > -400) {
      snowParticles.visible = false;
      return;
    }
    snowParticles.visible = true;
    snowParticles.position.set(cameraPos.x, 0, cameraPos.z);

    const posAttr = snowGeo.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    for (let i = 0; i < snowFlakeCount; i++) {
      const idx = i * 3;
      arr[idx + 1] -= snowVelocities[i] * dt;
      // Gentle horizontal drift
      arr[idx + 0] += Math.sin(arr[idx + 1] * 0.15) * 0.4 * dt;
      arr[idx + 2] += Math.cos(arr[idx + 1] * 0.15) * 0.3 * dt;

      // Wrap back to top when reaching ground
      if (arr[idx + 1] <= 0.2) {
        arr[idx + 1] = 40.0;
        arr[idx + 0] = (Math.random() - 0.5) * 110;
        arr[idx + 2] = (Math.random() - 0.5) * 110;
      }
    }
    posAttr.needsUpdate = true;
  };

  return {
    group,
    gondolaCabins,
    gondolaCables,
    snowParticles,
    updateSnowParticles,
    npcMeshes,
    createBuiltSnowmanMesh,
  };
}
