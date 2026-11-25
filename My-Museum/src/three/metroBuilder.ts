import * as THREE from 'three';
import {
  METRO_SEATS,
  METRO_STATIONS,
  METRO_TRACK_WAYPOINTS,
  type MetroStation,
} from '../museum/metroSystem';

export interface MetroTrainRig {
  root: THREE.Group;
  headlights: THREE.Mesh[];
  tailLights: THREE.Mesh[];
}

export interface BuiltMetroSystem {
  group: THREE.Group;
  trainRig: MetroTrainRig;
}

interface MetroBuilderParams {
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T;
  trackMat: <T extends THREE.Material>(m: T) => T;
  trackTex: <T extends THREE.Texture>(t: T) => T;
  interactables: THREE.Object3D[];
  maxAnisotropy: number;
}

export function buildMetroSystem({
  trackGeo,
  trackMat,
  trackTex,
  interactables,
}: MetroBuilderParams): BuiltMetroSystem {
  const group = new THREE.Group();
  group.name = 'metro-system';

  // ─────────────────────────────────────────────────────────────────────────
  // Materials
  // ─────────────────────────────────────────────────────────────────────────
  const concretePillarMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x8a929a, roughness: 0.88 })
  );
  const viaductDeckMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x4a525a, roughness: 0.82 })
  );
  const railSteelMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xd4d8dc, roughness: 0.28, metalness: 0.85 })
  );
  const thirdRailMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.45 })
  );
  const catenaryPoleMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.65, metalness: 0.75 })
  );
  const platformFloorMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.42 })
  );
  const stationWallMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.35 })
  );
  const glassScreenMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.42,
      roughness: 0.1,
    })
  );
  const canopyRoofMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x065f46, roughness: 0.35, metalness: 0.55 })
  );
  const turnstileGreenMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.3, emissive: 0x059669, emissiveIntensity: 0.4 })
  );
  const stationClockGlowMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfef08a, emissiveIntensity: 0.5 })
  );
  const trainSeatFabricMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.65 })
  );
  const trainSeatAccentMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x0891b2, roughness: 0.65 })
  );
  const trainSeatFrameMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.25 })
  );
  const trainFloorMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 })
  );
  const trainAisleMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 })
  );
  const trainCeilingLightMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.95 })
  );
  const trainInteriorWallMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 })
  );
  const trainWindowGlassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.16,
      roughness: 0.05,
      metalness: 0.1,
      depthWrite: false,
    })
  );
  const trainPoleMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.2 })
  );
  const trainYellowHandrailMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35 })
  );
  const trainGangwayBellowsMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 })
  );
  const pisDisplayMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x022c22, emissive: 0x059669, emissiveIntensity: 0.6 })
  );

  // Helper for text sign textures
  const makeSignTex = (line1: string, line2: string, bg = '#065F46', fg = '#FEF08A') => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1024, 256);

    ctx.strokeStyle = '#FDE047';
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, 1008, 240);

    ctx.fillStyle = fg;
    ctx.font = 'bold 54px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(line1, 512, 85);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 36px monospace';
    ctx.fillText(line2, 512, 168);

    const tex = trackTex(new THREE.CanvasTexture(canvas));
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return trackMat(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35 }));
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 1. ELEVATED VIADUCT PILLARS, DECK & DUAL STEEL RAILS (High Elevation y = 12.0m)
  // ─────────────────────────────────────────────────────────────────────────
  const viaductGroup = new THREE.Group();
  const pts = METRO_TRACK_WAYPOINTS;

  // Build continuous concrete viaduct slabs between consecutive waypoints at y = 12.0m
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    const segLen = Math.hypot(dx, dz);
    const midX = (p1.x + p2.x) / 2;
    const midZ = (p1.z + p2.z) / 2;
    const ang = Math.atan2(dx, dz);

    // Concrete Viaduct Deck Box (width 5.4m, thickness 0.65m) at high elevation y = 11.65m
    const deck = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(5.4, 0.65, segLen)),
      viaductDeckMat
    );
    deck.position.set(midX, 11.65, midZ);
    deck.rotation.y = ang;
    viaductGroup.add(deck);

    // Parapet safety crash barriers on both edges
    for (const side of [-2.6, 2.6]) {
      const barrier = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.25, 0.9, segLen)),
        concretePillarMat
      );
      barrier.position.set(midX + Math.cos(ang) * side, 12.35, midZ - Math.sin(ang) * side);
      barrier.rotation.y = ang;
      viaductGroup.add(barrier);
    }

    // Dual Steel Rail Lines (Left track & Right track for bidirectional flow)
    for (const trackOffset of [-1.3, 1.3]) {
      // 2 steel running rails per track at y = 12.08m
      for (const railOffset of [-0.42, 0.42]) {
        const rail = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(0.12, 0.16, segLen)),
          railSteelMat
        );
        const ox = Math.cos(ang) * (trackOffset + railOffset);
        const oz = -Math.sin(ang) * (trackOffset + railOffset);
        rail.position.set(midX + ox, 12.08, midZ + oz);
        rail.rotation.y = ang;
        viaductGroup.add(rail);
      }

      // Third power rail (750V DC conductor with yellow cover)
      const thirdRail = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.16, 0.18, segLen)),
        thirdRailMat
      );
      const tox = Math.cos(ang) * (trackOffset + (trackOffset < 0 ? -0.75 : 0.75));
      const toz = -Math.sin(ang) * (trackOffset + (trackOffset < 0 ? -0.75 : 0.75));
      thirdRail.position.set(midX + tox, 12.12, midZ + toz);
      thirdRail.rotation.y = ang;
      viaductGroup.add(thirdRail);
    }
  }

  // Cylindrical Concrete Viaduct Support Pillars every ~24m (Rising from ground y=0 to y=11.4m)
  for (let x = -365; x <= 195; x += 24) {
    let pz = 63.0;
    if (x <= -300) {
      pz = 61.5;
    } else if (x <= 0) {
      const t = (x - (-300)) / (0 - (-300));
      pz = 61.5 + t * (63.0 - 61.5);
    }

    // Skip pillar if inside station concourse
    if (Math.abs(x - (-300)) < 12 || Math.abs(x - 0) < 12 || Math.abs(x - 172) < 12) {
      continue;
    }

    // Ground-to-deck grand cylindrical column (height 11.4m, radius 0.75m)
    const col = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.72, 0.85, 11.4, 16)),
      concretePillarMat
    );
    col.position.set(x, 5.7, pz);
    viaductGroup.add(col);

    // Flanged Crosshead T-Capital supporting the elevated deck
    const cap = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(5.2, 0.7, 1.8)),
      concretePillarMat
    );
    cap.position.set(x, 11.4, pz);
    viaductGroup.add(cap);

    // Overhead Catenary Mast & Gantry (Steel mast rising to y = 15.8m)
    const mast = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.1, 0.12, 4.2, 8)),
      catenaryPoleMat
    );
    mast.position.set(x, 14.0, pz + 2.7);
    viaductGroup.add(mast);

    const mastArm = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.1, 0.1, 5.2)),
      catenaryPoleMat
    );
    mastArm.position.set(x, 15.8, pz);
    viaductGroup.add(mastArm);
  }

  group.add(viaductGroup);

  // ─────────────────────────────────────────────────────────────────────────
  // 2. THREE ELEVATED 2-STOREY METRO STATIONS (Platform at y = 12.0m)
  // ─────────────────────────────────────────────────────────────────────────

  const npcSkinMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xc89870, roughness: 0.7 }));
  const npcHairMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 }));

  const addPassengerNPC = (
    parent: THREE.Group,
    x: number,
    y: number,
    z: number,
    yaw: number,
    shirtColor = 0x2563eb,
    pantsColor = 0x1e293b,
    isSitting = false
  ) => {
    const npc = new THREE.Group();
    npc.position.set(x, y, z);
    npc.rotation.y = yaw;

    const shirtMat = trackMat(new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.6 }));
    const pantsMat = trackMat(new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.7 }));

    if (isSitting) {
      const torso = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.5, 0.65, 0.28)), shirtMat);
      torso.position.set(0, 0.72, 0);
      npc.add(torso);

      const head = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.16, 10, 8)), npcSkinMat);
      head.position.set(0, 1.18, 0);
      npc.add(head);

      const hair = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.17, 8, 8)), npcHairMat);
      hair.position.set(0, 1.25, -0.02);
      npc.add(hair);

      const legs = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.42, 0.45, 0.45)), pantsMat);
      legs.position.set(0, 0.35, 0.15);
      npc.add(legs);
    } else {
      const legs = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.38, 0.85, 0.25)), pantsMat);
      legs.position.set(0, 0.42, 0);
      npc.add(legs);

      const torso = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.5, 0.7, 0.28)), shirtMat);
      torso.position.set(0, 1.15, 0);
      npc.add(torso);

      const head = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.16, 10, 8)), npcSkinMat);
      head.position.set(0, 1.65, 0);
      npc.add(head);

      const hair = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.17, 8, 8)), npcHairMat);
      hair.position.set(0, 1.72, -0.02);
      npc.add(hair);
    }

    parent.add(npc);
    return npc;
  };

  const buildStation = (st: MetroStation) => {
    const sGrp = new THREE.Group();
    sGrp.position.set(st.x, 0, st.z);

    const pb = st.platformBounds;
    const platW = pb.maxX - pb.minX;
    const platD = pb.maxZ - pb.minZ;
    const platY = st.platformY; // 12.0m

    // A) 2nd Floor Elevated Platform Deck at y = 12.0m
    const platMesh = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(platW, 0.45, platD)),
      platformFloorMat
    );
    platMesh.position.set(0, platY - 0.05, 0);
    sGrp.add(platMesh);

    // Yellow safety tactile edge tiles along track sides
    for (const zSide of [-platD / 2 + 0.35, platD / 2 - 0.35]) {
      const tileLine = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(platW, 0.05, 0.45)),
        thirdRailMat
      );
      tileLine.position.set(0, platY + 0.2, zSide);
      sGrp.add(tileLine);
    }

    // Platform Screen Doors (PSD) glass barriers with sliding door gaps
    for (const zSide of [-platD / 2 + 0.7, platD / 2 - 0.7]) {
      const psd = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(platW - 4, 1.8, 0.12)),
        glassScreenMat
      );
      psd.position.set(0, platY + 1.05, zSide);
      sGrp.add(psd);
    }

    // B) Arched Station Canopy Roof & Steel Trusses at y = 15.8m
    const roof = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(platD / 2 + 0.8, platD / 2 + 0.8, platW + 2, 24, 1, false, 0, Math.PI)),
      canopyRoofMat
    );
    roof.rotation.z = Math.PI / 2;
    roof.rotation.y = Math.PI / 2;
    roof.position.set(0, platY + 3.8, 0);
    sGrp.add(roof);

    // Roof skylight glass strip down the center
    const skylight = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(platW + 1, 0.1, 2.8)),
      glassScreenMat
    );
    skylight.position.set(0, platY + 4.6, 0);
    sGrp.add(skylight);

    // C) Station Platform Amenities: Benches, Station Clock & LED Departure Display
    for (const bx of [-platW / 4, platW / 4]) {
      const bench = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(2.4, 0.45, 0.8)),
        catenaryPoleMat
      );
      bench.position.set(bx, platY + 0.38, 0);
      sGrp.add(bench);
    }

    // Central Double-sided Hanging Analog Station Clock
    const clock = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.5, 0.5, 0.25, 16)),
      stationClockGlowMat
    );
    clock.rotation.z = Math.PI / 2;
    clock.position.set(0, platY + 2.8, 0);
    sGrp.add(clock);

    // D) Ground Floor Concourse & Ticket Counter ("TICKET COUNTER IN FRONT, STAIRS BEHIND IT")
    const sb = st.stairsBounds;
    const stairMinZ = sb.minZ - st.z;
    const stairMaxZ = sb.maxZ - st.z;
    const stairW = sb.maxX - sb.minX;

    // Orientation: CTG has concourse on +Z side (towards Grand Market).
    // Museum and Cox's have concourse on -Z side (towards Museum plaza and Beach).
    const isNorthEntrance = st.ticketCounterPos.z < st.z;
    const entryDir = isNorthEntrance ? -1 : 1;
    const concourseZ = st.ticketCounterPos.z - st.z; // Center of ticket counter

    const concourse = new THREE.Group();
    // Position concourse floor and lobby
    const lobbyCenterZ = entryDir * 14.5;
    concourse.position.set(0, st.groundY, 0);

    // Concourse marble floor spanning from entrance to turnstiles
    const floor = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(stairW + 8, 0.2, 9.0)),
      stationWallMat
    );
    floor.position.set(0, 0.1, lobbyCenterZ);
    concourse.add(floor);

    // Grand Entrance Portal Arch & Station Signboard facing the street
    const grandPortal = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(stairW + 7.5, 5.2, 0.5)),
      canopyRoofMat
    );
    grandPortal.position.set(0, 2.6, entryDir * 18.2);
    concourse.add(grandPortal);

    const portalSignMat = makeSignTex(
      st.banglaName,
      `${st.name.toUpperCase()} · ENTRANCE & TICKET LOBBY`,
      '#065f46',
      '#fef08a'
    );
    const portalSign = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(stairW + 6.2, 1.25, 0.2)),
      portalSignMat
    );
    portalSign.position.set(0, 4.4, entryDir * 18.5);
    portalSign.userData.metroTicketStation = st.id;
    interactables.push(portalSign);
    concourse.add(portalSign);

    // 1. TICKET COUNTER IN FRONT: Island counter desk facing the entrance
    const counterDeskZ = entryDir * 14.5;
    const counterDesk = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(4.4, 1.1, 1.4)),
      canopyRoofMat
    );
    counterDesk.position.set(0, 0.55, counterDeskZ);
    counterDesk.userData.metroTicketStation = st.id;
    interactables.push(counterDesk);
    concourse.add(counterDesk);

    // Glass sneeze guard on ticket counter
    const glassGuard = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(4.2, 0.85, 0.08)),
      glassScreenMat
    );
    glassGuard.position.set(0, 1.5, counterDeskZ);
    glassGuard.userData.metroTicketStation = st.id;
    interactables.push(glassGuard);
    concourse.add(glassGuard);

    // Station Master / Ticket Officer NPC behind counter facing the entrance
    const npcTorso = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.6, 0.75, 0.35)),
      catenaryPoleMat
    );
    npcTorso.position.set(0, 1.45, counterDeskZ - entryDir * 0.9);
    concourse.add(npcTorso);

    const npcHead = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.18, 12, 10)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0xba845d, roughness: 0.7 }))
    );
    npcHead.position.set(0, 1.95, counterDeskZ - entryDir * 0.9);
    concourse.add(npcHead);

    // Ticket Counter Signboard
    const counterSignMat = makeSignTex(
      'মেট্রোরেল টিকিট কাউন্টার',
      'TICKET & MRT PASS COUNTER [E or Click to Buy]',
      '#065f46',
      '#fef08a'
    );
    const counterSign = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(4.8, 0.95, 0.15)),
      counterSignMat
    );
    counterSign.position.set(0, 2.8, counterDeskZ);
    counterSign.userData.metroTicketStation = st.id;
    interactables.push(counterSign);
    concourse.add(counterSign);

    // 2. BEHIND TICKET COUNTER: Automated Turnstiles (AFC Speed Gates) with green LED indicator arrows
    const turnstileZ = entryDir * 11.2;
    for (const tx of [-2.2, 2.2]) {
      const turnstile = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.35, 1.05, 1.8)),
        catenaryPoleMat
      );
      turnstile.position.set(tx, 0.55, turnstileZ);
      concourse.add(turnstile);

      const led = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.15, 0.08, 0.15)),
        turnstileGreenMat
      );
      led.position.set(tx, 1.1, turnstileZ);
      concourse.add(led);
    }

    sGrp.add(concourse);

    // E) STAIRS BEHIND TICKET COUNTER LEADING DIRECTLY TOWARDS TRAIN TRACKS
    // ("SIRI TO HBE TICKIT COUNTER ER PICHER DIKE AR SEKHNE THEKE SIRITA JABE TRAINT ER LINER DIKE UTHA NAMAR WAYTAU JNO BUJHA JAY")
    const stairEntryZ = isNorthEntrance ? stairMinZ - 0.8 : stairMaxZ + 0.8;

    // Overhead Wayfinding Portal Sign right at the foot of the stairs behind the turnstiles
    const stairSignMat = makeSignTex(
      '⬆ ট্রেনের লাইনে ওঠার সিঁড়ি | TO ELEVATED TRAIN TRACKS ⬆',
      '⬅ বামে উঠুন [UP ⬆] · ডানে নামুন [⬇ DOWN] ডানে ➡',
      '#065f46',
      '#fef08a'
    );
    const stairSign = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(stairW + 1.2, 1.1, 0.2)),
      stairSignMat
    );
    stairSign.position.set(0, 3.8, stairEntryZ);
    sGrp.add(stairSign);

    // 22 Wide, Straight, Realistic Steps climbing continuously towards the train tracks (z -> 0)
    const stairSteps = 22;
    const stairDz = Math.abs(stairMaxZ - stairMinZ) / stairSteps;
    const stairDy = (platY - st.groundY) / stairSteps;
    const stepWidth = 6.0;

    for (let s = 0; s < stairSteps; s++) {
      const stepY = st.groundY + s * stairDy + stairDy / 2;
      const stepZ = isNorthEntrance
        ? stairMinZ + s * stairDz + stairDz / 2
        : stairMaxZ - s * stairDz - stairDz / 2;

      // Main stone tread
      const stepMesh = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(stepWidth, stairDy + 0.04, stairDz + 0.08)),
        stationWallMat
      );
      stepMesh.position.set(0, stepY, stepZ);
      sGrp.add(stepMesh);

      // Dedicated 2-Lane Step Edge Illumination:
      // Left lane (x < 0): Green LED arrow strip for UP lane ("⬆ ওপরে ট্রেনের প্ল্যাটফর্মে ওঠার লেন")
      const upEdge = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(stepWidth / 2 - 0.25, 0.035, 0.08)),
        turnstileGreenMat
      );
      const edgeZ = isNorthEntrance ? stepZ + stairDz / 2 - 0.04 : stepZ - stairDz / 2 + 0.04;
      upEdge.position.set(-stepWidth / 4, stepY + stairDy / 2 + 0.018, edgeZ);
      sGrp.add(upEdge);

      // Right lane (x > 0): Amber/Gold LED arrow strip for DOWN lane ("⬇ নিচে নামার লেন")
      const downEdge = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(stepWidth / 2 - 0.25, 0.035, 0.08)),
        thirdRailMat
      );
      downEdge.position.set(stepWidth / 4, stepY + stairDy / 2 + 0.018, edgeZ);
      sGrp.add(downEdge);

      // Central divider stainless steel handrail separating UP & DOWN lanes
      if (s % 2 === 0) {
        const centerPost = new THREE.Mesh(
          trackGeo(new THREE.CylinderGeometry(0.035, 0.035, 1.1, 8)),
          catenaryPoleMat
        );
        centerPost.position.set(0, stepY + 0.6, stepZ);
        sGrp.add(centerPost);
      }

      // Outer glass balustrades along both flanks
      if (s % 3 === 0) {
        for (const sideX of [-stepWidth / 2 - 0.12, stepWidth / 2 + 0.12]) {
          const post = new THREE.Mesh(
            trackGeo(new THREE.CylinderGeometry(0.04, 0.04, 1.15, 8)),
            catenaryPoleMat
          );
          post.position.set(sideX, stepY + 0.6, stepZ);
          sGrp.add(post);

          const sideGlass = new THREE.Mesh(
            trackGeo(new THREE.BoxGeometry(0.05, 0.9, stairDz * 3.1)),
            glassScreenMat
          );
          sideGlass.position.set(sideX, stepY + 0.55, stepZ);
          sGrp.add(sideGlass);
        }
      }
    }

    // Express Panoramic Glass Elevator Shaft beside the stairs
    const liftX = stepWidth / 2 + 2.2;
    const liftZ = (stairMinZ + stairMaxZ) / 2;
    const liftShaft = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(2.6, platY - st.groundY + 2.0, 2.6)),
      glassScreenMat
    );
    liftShaft.position.set(liftX, (platY + st.groundY) / 2, liftZ);
    liftShaft.userData.metroTicketStation = st.id;
    interactables.push(liftShaft);
    sGrp.add(liftShaft);

    // Elevator steel frame corner pillars
    for (const cx of [-1.25, 1.25]) {
      for (const cz of [-1.25, 1.25]) {
        const pillar = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(0.12, platY - st.groundY + 2.0, 0.12)),
          catenaryPoleMat
        );
        pillar.position.set(liftX + cx, (platY + st.groundY) / 2, liftZ + cz);
        sGrp.add(pillar);
      }
    }

    // Lift floor indicator LED sign
    const liftSignMat = makeSignTex(
      'লিফট | 1F ➔ 2F',
      'EXPRESS GLASS LIFT [E]',
      '#065f46',
      '#fef08a'
    );
    const liftSign = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(2.2, 0.6, 0.1)),
      liftSignMat
    );
    liftSign.position.set(liftX, st.groundY + 2.5, liftZ + entryDir * 1.35);
    liftSign.userData.metroTicketStation = st.id;
    interactables.push(liftSign);
    sGrp.add(liftSign);

    // F) SPACIOUS 2ND-FLOOR PASSENGER WAITING CONCOURSE / OBSERVATION LOUNGE CONNECTED TO PLATFORM
    // Wide passenger waiting deck before boarding the train (16m wide along X, 10m deep along Z at y = 12.0m)
    const loungeZ = isNorthEntrance ? stairMaxZ + 3.0 : stairMinZ - 3.0;
    const waitingLoungeDeck = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(16.0, 0.42, 10.0)),
      stationWallMat
    );
    waitingLoungeDeck.position.set(0, platY - 0.05, loungeZ);
    sGrp.add(waitingLoungeDeck);

    // Top Landing Directional Signboard at 2nd floor platform
    const topSignMat = makeSignTex(
      '🚉 ২য় তলা প্ল্যাটফর্ম ও ট্রেন বোর্ডিং 🚉',
      '⬇ নিচতলায় নামার সিঁড়ি | STAIRS DOWN TO GROUND CONCOURSE ⬇',
      '#065f46',
      '#fef08a'
    );
    const topSign = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(stairW + 1.0, 1.0, 0.2)),
      topSignMat
    );
    const topSignZ = isNorthEntrance ? stairMaxZ + 0.8 : stairMinZ - 0.8;
    topSign.position.set(0, platY + 3.2, topSignZ);
    sGrp.add(topSign);

    // Panoramic clear glass balustrades around the waiting lounge (with scenic views)
    for (const sideX of [-8.0, 8.0]) {
      const sideGlass = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.12, 1.25, 10.0)),
        glassScreenMat
      );
      sideGlass.position.set(sideX, platY + 0.62, loungeZ);
      sGrp.add(sideGlass);
    }

    // Outer back glass balustrade
    const backGlass = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(16.0, 1.25, 0.12)),
      glassScreenMat
    );
    backGlass.position.set(0, platY + 0.62, loungeZ + entryDir * 4.9);
    sGrp.add(backGlass);

    // Waiting lounge benches for passengers to relax
    for (const lx of [-4.5, 4.5]) {
      const loungeBench = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(3.2, 0.45, 0.8)),
        catenaryPoleMat
      );
      loungeBench.position.set(lx, platY + 0.35, loungeZ + entryDir * 2.0);
      sGrp.add(loungeBench);
    }

    // Digital departures and arrivals LED display in the waiting lounge
    const departuresDisplay = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(4.5, 0.95, 0.15)),
      pisDisplayMat
    );
    departuresDisplay.position.set(0, platY + 2.8, loungeZ + entryDir * 4.5);
    sGrp.add(departuresDisplay);

    // G) PASSENGER NPCS AROUND THE STATION ("MANUSH JNO THAKE ASHE PASE")
    // 1. NPCs on Ground Floor Ticket Concourse
    addPassengerNPC(sGrp, -1.8, st.groundY, counterDeskZ + entryDir * 2.0, isNorthEntrance ? Math.PI : 0, 0xdc2626, 0x1e293b, false); // Queuing at counter
    addPassengerNPC(sGrp, 1.8, st.groundY, counterDeskZ + entryDir * 1.6, isNorthEntrance ? -Math.PI / 4 : Math.PI / 6, 0x2563eb, 0x334155, false);  // Checking smartphone
    addPassengerNPC(sGrp, -3.2, st.groundY, turnstileZ - entryDir * 0.8, isNorthEntrance ? 0 : Math.PI, 0xd97706, 0x0f172a, false); // Walking past turnstiles
    addPassengerNPC(sGrp, 3.0, st.groundY, counterDeskZ + entryDir * 0.5, isNorthEntrance ? Math.PI / 2 : -Math.PI / 2, 0x059669, 0x1e293b, false); // Approaching counter

    // 2. NPCs climbing & descending on the 2-lane stairs:
    // Climbing UP on the left lane (x = -1.4, facing towards tracks)
    addPassengerNPC(
      sGrp,
      -1.4,
      st.groundY + 4.2,
      isNorthEntrance ? stairMinZ + 8 * stairDz : stairMaxZ - 8 * stairDz,
      isNorthEntrance ? 0 : Math.PI,
      0x7c3aed,
      0x334155,
      false
    );
    // Walking DOWN on the right lane (x = 1.4, facing towards exit)
    addPassengerNPC(
      sGrp,
      1.4,
      st.groundY + 8.2,
      isNorthEntrance ? stairMinZ + 15 * stairDz : stairMaxZ - 15 * stairDz,
      isNorthEntrance ? Math.PI : 0,
      0x0891b2,
      0x1e293b,
      false
    );

    // 3. NPCs in the 2nd-Floor Waiting Lounge Deck (y = 12.0m)
    addPassengerNPC(sGrp, -4.5, platY, loungeZ + entryDir * 2.0, isNorthEntrance ? Math.PI : 0, 0xec4899, 0x0f172a, true);             // Sitting on bench
    addPassengerNPC(sGrp, 4.5, platY, loungeZ + entryDir * 2.0, isNorthEntrance ? Math.PI : 0, 0x2563eb, 0x1e293b, true);              // Sitting on bench
    addPassengerNPC(sGrp, -6.5, platY, loungeZ - entryDir * 1.5, Math.PI / 2, 0xdc2626, 0x334155, false);  // Looking out at scenery
    addPassengerNPC(sGrp, 6.5, platY, loungeZ - entryDir * 1.5, -Math.PI / 2, 0x059669, 0x0f172a, false); // Looking out at scenery

    // 4. NPCs on the Boarding Platform beside the Metro Train
    addPassengerNPC(sGrp, -10.0, platY, entryDir * 0.8, isNorthEntrance ? 0 : Math.PI, 0xd97706, 0x1e293b, false); // Waiting by PSD doors
    addPassengerNPC(sGrp, 10.0, platY, entryDir * 0.8, isNorthEntrance ? 0 : Math.PI, 0x7c3aed, 0x334155, false); // Waiting with luggage
    addPassengerNPC(sGrp, 0.0, platY, -entryDir * platD / 4, isNorthEntrance ? Math.PI : 0, 0x0891b2, 0x1e293b, false); // Looking at train tracks

    group.add(sGrp);
  };

  for (const st of METRO_STATIONS) {
    buildStation(st);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. SLEEK 3-COACH BANGLADESH METRO RAIL TRAIN (EMU)
  // ─────────────────────────────────────────────────────────────────────────
  const trainRoot = new THREE.Group();
  trainRoot.name = 'metro-train-root';
  trainRoot.userData.metroTrain = true;

  const trainBodyMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25, metalness: 0.35 })
  );
  const trainGreenStripeMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.3, metalness: 0.2 })
  );
  const trainRedStripeMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35 })
  );
  const trainDarkMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.45 })
  );
  const trainHeadlightMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfef08a, emissiveIntensity: 1.0 })
  );
  const trainTailLightMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.0 })
  );

  const coachLength = 15.5;
  const coachWidth = 3.2;
  const coachHeight = 3.35;
  const coachSpacing = 0.8;

  const headlights: THREE.Mesh[] = [];
  const tailLights: THREE.Mesh[] = [];

  // Build 3 walk-through coaches: Lead (+Z, c=1), Middle (0, c=0), Trailing (-Z, c=-1)
  for (let c = -1; c <= 1; c++) {
    const coach = new THREE.Group();
    const cz = c * (coachLength + coachSpacing);
    coach.position.set(0, 0, cz);

    // 1. Walkable Coach Floor at y = 0.55m
    const floor = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(coachWidth - 0.1, 0.15, coachLength)),
      trainFloorMat
    );
    floor.position.y = 0.55;
    floor.userData.metroTrain = true;
    interactables.push(floor);
    coach.add(floor);

    // Contrasting center walking aisle strip
    const aisle = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(1.2, 0.02, coachLength)),
      trainAisleMat
    );
    aisle.position.y = 0.63;
    aisle.userData.metroTrain = true;
    coach.add(aisle);

    // 2. Ceiling & Roof with bright LED lighting panels
    const ceiling = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(coachWidth - 0.1, 0.15, coachLength)),
      trainInteriorWallMat
    );
    ceiling.position.y = 3.25;
    coach.add(ceiling);

    // Curved outer aerodynamic roof shell
    const outerRoof = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(coachWidth, 0.2, coachLength)),
      trainBodyMat
    );
    outerRoof.position.y = 3.4;
    coach.add(outerRoof);

    // Parallel LED ceiling light strip panels (bright transit lighting)
    for (const lx of [-0.65, 0.65]) {
      const ledStrip = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.25, 0.04, coachLength - 1.2)),
        trainCeilingLightMat
      );
      ledStrip.position.set(lx, 3.18, 0);
      coach.add(ledStrip);
    }

    // 3. Side Walls & Large Panoramic Clear Glass Windows
    for (const side of [-coachWidth / 2, coachWidth / 2]) {
      const isLeft = side < 0;
      const normX = isLeft ? -1 : 1;

      // Lower wall panel (floor to window sill: y = 0.55m to 1.35m)
      const lowerWall = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.12, 0.8, coachLength)),
        trainBodyMat
      );
      lowerWall.position.set(side, 0.95, 0);
      lowerWall.userData.metroTrain = true;
      coach.add(lowerWall);

      // Exterior signature green livery band
      const greenBand = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.04, 0.42, coachLength)),
        trainGreenStripeMat
      );
      greenBand.position.set(side + normX * 0.06, 1.05, 0);
      coach.add(greenBand);

      // Exterior red speed accent pinstripe
      const redStripe = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.04, 0.08, coachLength)),
        trainRedStripeMat
      );
      redStripe.position.set(side + normX * 0.06, 0.8, 0);
      coach.add(redStripe);

      // Upper wall frieze (above windows to ceiling: y = 2.65m to 3.25m)
      const upperWall = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.12, 0.6, coachLength)),
        trainBodyMat
      );
      upperWall.position.set(side, 2.95, 0);
      coach.add(upperWall);

      // Window bays & Clear Panoramic Windows (y = 1.35m to 2.65m, height 1.3m)
      // 3 large viewing window bays along the coach for crystal clear outdoor viewing
      for (const wz of [-5.0, 0, 5.0]) {
        const winPane = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(0.04, 1.25, 3.4)),
          trainWindowGlassMat
        );
        winPane.position.set(side, 2.0, wz);
        winPane.userData.metroTrain = true;
        interactables.push(winPane);
        coach.add(winPane);
      }

      // Vertical window divider pillars
      for (const pz of [-7.0, -3.1, -1.9, 1.9, 3.1, 7.0]) {
        const col = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(0.14, 1.3, 0.22)),
          trainBodyMat
        );
        col.position.set(side, 2.0, pz);
        coach.add(col);
      }

      // Passenger sliding doors at z = -2.5 and +2.5
      for (const dz of [-2.5, 2.5]) {
        const doorGlass = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(0.06, 1.9, 0.95)),
          glassScreenMat
        );
        doorGlass.position.set(side, 1.6, dz);
        doorGlass.userData.metroTrain = true;
        coach.add(doorGlass);
      }
    }

    // 4. Passenger Seats from METRO_SEATS (BSA JAY)
    const coachSeats = METRO_SEATS.filter((s) => s.coachIndex === c);
    for (const s of coachSeats) {
      const seatGrp = new THREE.Group();
      const relZ = s.localZ - cz;
      seatGrp.position.set(s.localX, 0.55, relZ);

      // Seat cushion (width 0.58m, height 0.14m, depth 0.65m)
      const cushion = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.58, 0.14, 0.65)),
        trainSeatFabricMat
      );
      cushion.position.set(0, 0.42, 0);
      cushion.userData.isMetroSeat = true;
      cushion.userData.metroSeatId = s.id;
      cushion.userData.metroSeatLabel = s.label;
      interactables.push(cushion);
      seatGrp.add(cushion);

      // Ergonomic backrest against the window wall
      const backrest = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.1, 0.62, 0.65)),
        trainSeatAccentMat
      );
      const backX = s.side === 'left' ? -0.25 : 0.25;
      backrest.position.set(backX, 0.75, 0);
      seatGrp.add(backrest);

      // Chrome armrests & legs
      const leg = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.55, 0.35, 0.08)),
        trainSeatFrameMat
      );
      leg.position.set(0, 0.18, 0);
      seatGrp.add(leg);

      coach.add(seatGrp);
    }

    // 5. Stainless Steel Grab Stanchions & Overhead Handrails
    for (const pz of [-5.2, 0, 5.2]) {
      for (const px of [-0.85, 0.85]) {
        const stanchion = new THREE.Mesh(
          trackGeo(new THREE.CylinderGeometry(0.025, 0.025, 2.65, 8)),
          trainPoleMat
        );
        stanchion.position.set(px, 1.9, pz);
        coach.add(stanchion);
      }
    }

    // Horizontal overhead rail down both sides with yellow grab loops
    for (const rx of [-0.85, 0.85]) {
      const rail = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.02, 0.02, coachLength - 1.5, 8)),
        trainPoleMat
      );
      rail.rotation.x = Math.PI / 2;
      rail.position.set(rx, 2.65, 0);
      coach.add(rail);

      // Hanging yellow straps
      for (let gz = -6.0; gz <= 6.0; gz += 1.5) {
        const strap = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(0.04, 0.22, 0.04)),
          trainYellowHandrailMat
        );
        strap.position.set(rx, 2.52, gz);
        coach.add(strap);
      }
    }

    // 6. Dynamic Electronic Passenger Info Display (PIS) above doors
    for (const pz of [-2.5, 2.5]) {
      const pisMesh = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(1.6, 0.22, 0.05)),
        pisDisplayMat
      );
      pisMesh.position.set(0, 2.85, pz);
      coach.add(pisMesh);
    }

    // 7. Rooftop AC Pods & Undercarriage Bogies
    for (const acZ of [-3.8, 3.8]) {
      const acPod = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(1.8, 0.38, 3.2)),
        trainDarkMat
      );
      acPod.position.set(0, coachHeight + 0.25, acZ);
      coach.add(acPod);
    }

    // Dual 2-axle steel wheel bogies under each coach
    for (const bz of [-coachLength / 3, coachLength / 3]) {
      const bogieFrame = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(2.4, 0.25, 2.2)),
        trainDarkMat
      );
      bogieFrame.position.set(0, 0.25, bz);
      coach.add(bogieFrame);

      for (const wz of [-0.75, 0.75]) {
        for (const wx of [-1.15, 1.15]) {
          const wheel = new THREE.Mesh(
            trackGeo(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 16)),
            railSteelMat
          );
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(wx, 0.25, bz + wz);
          coach.add(wheel);
        }
      }
    }

    // 8. Lead Cab Nose & Windshield (c === 1)
    if (c === 1) {
      // Driver bulkhead with viewing window from passenger cabin into cab
      const bulkhead = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(coachWidth - 0.2, 2.5, 0.15)),
        trainInteriorWallMat
      );
      bulkhead.position.set(0, 1.85, coachLength / 2 - 0.1);
      coach.add(bulkhead);

      const cabWindow = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(1.4, 0.9, 0.1)),
        trainWindowGlassMat
      );
      cabWindow.position.set(0, 2.1, coachLength / 2 - 0.1);
      coach.add(cabWindow);

      // Streamlined aerodynamic front nose
      const nose = new THREE.Mesh(
        trackGeo(new THREE.ConeGeometry(coachWidth / 2, 2.8, 4)),
        trainBodyMat
      );
      nose.rotation.x = Math.PI / 2;
      nose.rotation.y = Math.PI / 4;
      nose.position.set(0, coachHeight / 2 + 0.25, coachLength / 2 + 1.4);
      coach.add(nose);

      // Front panoramic clear driver windshield
      const windshield = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(coachWidth * 0.75, 1.1, 0.15)),
        trainWindowGlassMat
      );
      windshield.rotation.x = -Math.PI / 8;
      windshield.position.set(0, 2.2, coachLength / 2 + 1.2);
      coach.add(windshield);

      // Dual High-Intensity LED Headlights
      for (const lx of [-0.95, 0.95]) {
        const hl = new THREE.Mesh(
          trackGeo(new THREE.SphereGeometry(0.2, 12, 10)),
          trainHeadlightMat
        );
        hl.position.set(lx, 1.25, coachLength / 2 + 2.1);
        coach.add(hl);
        headlights.push(hl);
      }
    }

    // 9. Trailing Cab Taillights (c === -1)
    if (c === -1) {
      for (const lx of [-0.95, 0.95]) {
        const tl = new THREE.Mesh(
          trackGeo(new THREE.SphereGeometry(0.2, 12, 10)),
          trainTailLightMat
        );
        tl.position.set(lx, 1.25, -coachLength / 2 - 0.05);
        coach.add(tl);
        tailLights.push(tl);
      }
    }

    // 10. Rooftop Diamond Pantograph on Middle Coach (c === 0)
    if (c === 0) {
      const panto = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6)),
        catenaryPoleMat
      );
      panto.rotation.z = Math.PI / 6;
      panto.position.set(0, coachHeight + 1.45, 0);
      coach.add(panto);

      const pantoHead = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(2.6, 0.08, 0.5)),
        railSteelMat
      );
      pantoHead.position.set(0, coachHeight + 2.6, 0);
      coach.add(pantoHead);
    }

    trainRoot.add(coach);
  }

  // 11. Connecting Gangway Bellows between coaches (allowing continuous walk-through)
  for (const gz of [-coachLength / 2 - coachSpacing / 2, coachLength / 2 + coachSpacing / 2]) {
    const bellows = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(2.2, 2.6, coachSpacing + 0.1)),
      trainGangwayBellowsMat
    );
    bellows.position.set(0, 1.9, gz);
    trainRoot.add(bellows);

    const bellowsFloor = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(1.4, 0.12, coachSpacing + 0.1)),
      trainFloorMat
    );
    bellowsFloor.position.set(0, 0.55, gz);
    bellowsFloor.userData.metroTrain = true;
    interactables.push(bellowsFloor);
    trainRoot.add(bellowsFloor);
  }

  // Initial train placement at Station 1 (Chittagong Grand Market Right Flank at high elevated y = 12.0m)
  trainRoot.position.set(-300, 12.0, 61.5);
  group.add(trainRoot);

  return {
    group,
    trainRig: {
      root: trainRoot,
      headlights,
      tailLights,
    },
  };
}
