import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Car,
  ChevronDown,
  ChevronUp,
  DoorClosed,
  DoorOpen,
  Eye,
  FolderKanban,
  Home,
  MessageSquare,
  Palette,
  Pencil,
  Plus,
  Sparkles,
  Users,
} from 'lucide-react';
import type {
  ArtworkItem,
  AvatarConfig,
  MuseumMember,
  MuseumMeta,
  VisitorPresence,
  WallTheme,
} from '../types/museum';
import {
  calculateMuseumLayout,
  getArtworkPlacement,
  getDoorId,
  getResolvedRoomName,
  getRoomIndexAtZ,
  toRomanNumeral,
  type DoorDefinition,
  type MuseumLayout,
} from '../museum/layout';
import {
  normalizeAngle,
  shortestAngleDelta,
  stepPlayerSteering,
} from '../museum/cameraSteering';
import {
  acceptRideFare,
  changeTalkDestination,
  clampWorldPosition,
  computeOutdoorElevation,
  createInitialTrafficVehicles,
  createTalkSession,
  executeVehicleTakeover,
  EXIT_DOOR_ID,
  findNearestAnyDoor,
  findNearestHailVehicle,
  getWorldZone,
  INITIAL_WALLET_BDT,
  negotiateTalkSession,
  stepVehicleDriving,
  WORLD_MAX_X,
  WORLD_MIN_X,
  type RideDestination,
  type TrafficVehicleState,
  type VehicleTalkSession,
  type WorldZoneInfo,
} from '../museum/outdoorWorld';
import {
  resolveMuseumCompanionAvatars,
  type CompanionAvatarEntry,
} from '../museum/trustedCircle';
import {
  animateAvatarRig,
  buildAvatarRig,
  buildCustomGlbAvatarRig,
  type AvatarRig,
} from '../three/avatarBuilder';
import { buildMuseumArchitecture, type BuiltMuseum, type DoorRig } from '../three/museumBuilder';
import { buildOutdoorWorld, type BuiltOutdoorWorld } from '../three/outdoorBuilder';
import {
  computeCompanionRideSeatPosition,
  computeRideSeatWorldPosition,
  computeDolnaSwingAngle,
  computeChorkiWheelAngle,
  findNearestAmusementRide,
  getAmusementRideById,
  type AmusementRideDefinition,
} from '../museum/amusementPark';
import {
  computeCoasterPoseAtT,
  createInitialCoasterState,
  stepCoasterSimulation,
  type CoasterState,
} from '../museum/rollerCoaster';
import {
  computeWaterSlidePoseAtT,
  createInitialWaterSlideState,
  stepWaterSlideSimulation,
  type WaterSlideState,
} from '../museum/waterRide';
import { buildAmusementParks, type BuiltAmusementParks } from '../three/amusementParkBuilder';
import { createAfterDrawScheduler, detectSoftwareGl } from '../three/webglUtils';
import { WorldMinimap } from './WorldMinimap';
import { VehicleTalkModal } from './VehicleTalkModal';
import {
  buyMarketItem,
  createMarketSession,
  findNearestMarketItem,
  MARKET_ITEMS,
  negotiateMarketPrice,
  type MarketItem,
  type MarketShopSession,
} from '../museum/marketWorld';
import { MarketShopModal } from './MarketShopModal';
import {
  METRO_SEATS,
  clampTrainLocalAisle,
  computeMetroPoseAtT,
  convertTrainLocalToWorld,
  createInitialMetroTrainState,
  findNearestMetroSeat,
  findNearestMetroStation,
  isNearMetroTrain,
  stepMetroSimulation,
  type MetroPose,
  type MetroSeat,
  type MetroTicket,
  type MetroTrainState,
} from '../museum/metroSystem';
import { MetroTicketModal } from './MetroTicketModal';
import {
  createInitialGondolaSystemState,
  createInitialWinterKinematics,
  createSnowball,
  createSnowmanBuilderState,
  customizeSnowman,
  finalizeSnowman,
  findBoardableGondola,
  INITIAL_KASHMIR_NPCS,
  rollSnowball,
  stepGondolaSimulation,
  stepSkiPhysics,
  stepSnowballs,
  type BuiltSnowman,
  type GondolaSystemState,
  type SnowballFighterNPC,
  type SnowballProjectile,
  type SnowmanCustomization,
  type WinterActivityMode,
  type WinterKinematicsState,
} from '../museum/kashmirWorld';
import { SnowmanBuilderModal } from './SnowmanBuilderModal';

interface Museum3DViewProps {
  museum: MuseumMeta;
  avatar: AvatarConfig;
  selfUid?: string | null;
  selfEmail?: string | null;
  customGlbBuffer?: ArrayBuffer | null;
  artworks: ArtworkItem[];
  members: MuseumMember[];
  liveVisitors: VisitorPresence[];
  showInvitedIn3D: boolean;
  canCurate: boolean;
  canRenameRooms: boolean;
  teleportTargetId: string | null;
  onClearTeleport: () => void;
  onSelectArtwork: (artwork: ArtworkItem, slotIndex: number) => void;
  onRequestRenameRoom: (roomIndex: number) => void;
  onNotify?: (msg: string) => void;
  onOpenCatalog: () => void;
  onOpenUpload: () => void;
  onOpenAccess: () => void;
  onReturnHome: () => void;
  onChangeWallTheme: (theme: WallTheme) => void;
  onPositionBroadcast?: (
    x: number,
    z: number,
    yaw: number,
    ridingRideId?: string | null,
    ridingVehicleId?: string | null
  ) => void;
  onPresenceOffline?: (x: number, z: number, yaw: number) => void;
  isPaused?: boolean;
}

// Reusable scratch vectors allocated outside render loop (zero GC)
const _camDesired = new THREE.Vector3();
const _camLook = new THREE.Vector3();
const _skyTarget = new THREE.Color();
const _seatOffset = new THREE.Vector3();

const OUTDOOR_SKY_HEX = 0xc9e2f5;

const THEME_FOG_COLOR: Record<WallTheme, number> = {
  alabaster: 0xeae4da,
  travertine: 0xdfd5c7,
  charcoal: 0x1e1c1a,
};

interface HoverPrompt {
  kind:
    | 'artwork'
    | 'door'
    | 'signboard'
    | 'expansion'
    | 'vehicle'
    | 'ride'
    | 'market'
    | 'elevator'
    | 'metro'
    | 'metroTicket'
    | 'gondola';
  label: string;
}

function getCompanionVisualSignature(v: CompanionAvatarEntry): string {
  return [
    v.displayName,
    v.gender,
    v.skinTone,
    v.hairStyle,
    v.hairColor,
    v.outfitStyle,
    v.outfitColor,
    v.accentColor,
    v.accessory,
    v.isActive ? 'active' : 'standing',
  ].join('|');
}

// Responsive notification HUD placement: on mobile/tablets (<md), positioned at top next to the Minimap!
// In mobile landscape: right beside the map (top-2.5 right-[144px] / sm:right-[234px]).
// In mobile portrait: right under the map in the top-right corner (top-[102px] right-2.5).
// On desktop (md+): centered horizontally above the bottom controls.
const PROMPT_HUD_POSITION =
  "max-md:fixed max-md:z-30 max-md:landscape:top-2.5 max-md:landscape:right-[144px] sm:max-md:landscape:right-[234px] max-md:portrait:top-[102px] max-md:portrait:right-2.5 max-md:max-w-[calc(100vw-154px)] max-md:portrait:max-w-[calc(100vw-20px)] max-md:text-[11px] max-md:px-2.5 max-md:py-1.5 md:absolute md:top-auto md:right-auto md:bottom-[116px] md:left-1/2 md:-translate-x-1/2 md:z-20 md:max-w-none";

export function Museum3DView({
  museum,
  avatar,
  selfUid = null,
  selfEmail = null,
  customGlbBuffer = null,
  artworks,
  members,
  liveVisitors,
  showInvitedIn3D,
  canCurate,
  canRenameRooms,
  teleportTargetId,
  onClearTeleport,
  onSelectArtwork,
  onRequestRenameRoom,
  onNotify,
  onOpenCatalog,
  onOpenUpload,
  onOpenAccess,
  onReturnHome,
  onChangeWallTheme,
  onPositionBroadcast,
  onPresenceOffline,
  isPaused = false,
}: Museum3DViewProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [cameraMode, setCameraMode] = useState<'third' | 'first'>('third');
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [currentRoomIndex, setCurrentRoomIndex] = useState(0);
  const [hoveredPrompt, setHoveredPrompt] = useState<HoverPrompt | null>(null);
  const [nearbyDoor, setNearbyDoor] = useState<DoorDefinition | null>(null);
  const [openDoorList, setOpenDoorList] = useState<string[]>([]);
  const [presenceNowMs, setPresenceNowMs] = useState(() => Date.now());

  // Outdoor real-world HUD, minimap, wallet, vehicle interaction & driving state
  const [worldZone, setWorldZone] = useState<WorldZoneInfo>(() => getWorldZone(0, 4.5));
  const [minimapSnap, setMinimapSnap] = useState<{
    x: number;
    z: number;
    yaw: number;
    vehicles: Array<Pick<TrafficVehicleState, 'id' | 'kind' | 'x' | 'z' | 'status'>>;
  }>(() => ({
    x: 0,
    z: 4.5,
    yaw: Math.PI,
    vehicles: [],
  }));
  const [nearbyVehicle, setNearbyVehicle] = useState<{
    id: string;
    title: string;
    driverName: string;
  } | null>(null);
  const [talkSession, setTalkSession] = useState<VehicleTalkSession | null>(null);
  const [talkError, setTalkError] = useState<string | null>(null);
  const [walletBdt, setWalletBdt] = useState<number>(INITIAL_WALLET_BDT);
  const [drivingVehicleInfo, setDrivingVehicleInfo] = useState<{
    id: string;
    title: string;
    stolen: boolean;
  } | null>(null);
  const [marketSession, setMarketSession] = useState<MarketShopSession | null>(null);
  const [nearbyMarketItem, setNearbyMarketItem] = useState<MarketItem | null>(null);
  const [purchasedItems, setPurchasedItems] = useState<string[]>([]);
  const [activeRideInfo, setActiveRideInfo] = useState<{
    id: string;
    title: string;
    banglishHint: string;
  } | null>(null);
  const [nearbyRide, setNearbyRide] = useState<AmusementRideDefinition | null>(null);
  const [coasterRideState, setCoasterRideState] = useState<{
    state: string;
    speed: number;
    countdownSeconds: number;
  }>({ state: 'docked_empty', speed: 0, countdownSeconds: 3 });
  const [waterSlideRideState, setWaterSlideRideState] = useState<WaterSlideState>(createInitialWaterSlideState());
  const [metroTrainState, setMetroTrainState] = useState<MetroTrainState>(createInitialMetroTrainState());
  const metroTrainStateRef = useRef<MetroTrainState>(createInitialMetroTrainState());
  const [isRidingMetro, setIsRidingMetro] = useState(false);
  const isRidingMetroRef = useRef(false);
  const [nearbyMetroSeat, setNearbyMetroSeat] = useState<MetroSeat | null>(null);
  const nearbyMetroSeatRef = useRef<MetroSeat | null>(null);
  const [isSeatedOnMetro, setIsSeatedOnMetro] = useState(false);
  const isSeatedOnMetroRef = useRef(false);
  const seatedMetroSeatRef = useRef<MetroSeat | null>(null);
  const metroLocalPosRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });
  const [ticketModalStationId, setTicketModalStationId] = useState<string | null>(null);
  const [metroTicket, setMetroTicket] = useState<MetroTicket | null>(null);
  const [nearbyMetroBoardable, setNearbyMetroBoardable] = useState<boolean>(false);
  const lastMetroAnnounceRef = useRef<string>('');
  const metroPoseRef = useRef<MetroPose>(computeMetroPoseAtT(0.19, 0));
  const prevMetroYawRef = useRef<number | null>(null);

  // Kashmir Snow World States & Kinematics
  const [winterMode, setWinterMode] = useState<WinterActivityMode>('walk');
  const winterModeRef = useRef<WinterActivityMode>('walk');
  winterModeRef.current = winterMode;
  const winterKinematicsRef = useRef<WinterKinematicsState>(createInitialWinterKinematics());
  const [snowballCount, setSnowballCount] = useState<number>(10);
  const snowballCountRef = useRef<number>(10);
  snowballCountRef.current = snowballCount;
  const snowballProjectilesRef = useRef<SnowballProjectile[]>([]);
  const snowballNPCsRef = useRef<SnowballFighterNPC[]>([...INITIAL_KASHMIR_NPCS]);
  const [gondolaSysState, setGondolaSysState] = useState<GondolaSystemState>(createInitialGondolaSystemState());
  const gondolaSysRef = useRef<GondolaSystemState>(createInitialGondolaSystemState());
  const [isRidingGondola, setIsRidingGondola] = useState<boolean>(false);
  const isRidingGondolaRef = useRef<boolean>(false);
  isRidingGondolaRef.current = isRidingGondola;
  const ridingGondolaCabinIdRef = useRef<number | null>(null);
  const [isSnowmanModalOpen, setIsSnowmanModalOpen] = useState<boolean>(false);
  const builtSnowmenListRef = useRef<BuiltSnowman[]>([]);
  const [nearbyGondolaBoardable, setNearbyGondolaBoardable] = useState<boolean>(false);
  const [nearbyGondolaCounter, setNearbyGondolaCounter] = useState<boolean>(false);
  const [isInKashmirZone, setIsInKashmirZone] = useState<boolean>(false);
  const [isInCtgZone, setIsInCtgZone] = useState<boolean>(false);

  // Periodically refresh heartbeat window so disconnected visitors transition cleanly to standing
  useEffect(() => {
    const id = window.setInterval(() => setPresenceNowMs(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, []);

  const layout = useMemo(() => calculateMuseumLayout(artworks.length), [artworks.length]);

  const currentRoom = layout.rooms[currentRoomIndex] ?? layout.rooms[0];
  const currentRoomName = getResolvedRoomName(currentRoom.index, museum.roomNames);

  // Merge real-time Firestore active visitors + offline standing 3D models (zero fake patrolling)
  const companionVisitors = useMemo<CompanionAvatarEntry[]>(
    () =>
      resolveMuseumCompanionAvatars({
        museum,
        liveVisitors,
        members,
        showInvitedIn3D,
        selfUid,
        selfEmail,
        nowMs: presenceNowMs,
      }),
    [museum, liveVisitors, members, showInvitedIn3D, selfUid, selfEmail, presenceNowMs]
  );

  const activeCompanionCount = useMemo(
    () => companionVisitors.filter((v) => v.isActive).length,
    [companionVisitors]
  );

  // Refs bridging React state into stable single-mount WebGL loop
  const layoutRef = useRef<MuseumLayout>(layout);
  layoutRef.current = layout;
  const artworksRef = useRef(artworks);
  artworksRef.current = artworks;
  const roomNamesRef = useRef(museum.roomNames);
  roomNamesRef.current = museum.roomNames;
  const cameraModeRef = useRef(cameraMode);
  cameraModeRef.current = cameraMode;
  const onSelectArtworkRef = useRef(onSelectArtwork);
  onSelectArtworkRef.current = onSelectArtwork;
  const onRequestRenameRoomRef = useRef(onRequestRenameRoom);
  onRequestRenameRoomRef.current = onRequestRenameRoom;
  const onNotifyRef = useRef(onNotify);
  onNotifyRef.current = onNotify;
  const onPositionBroadcastRef = useRef(onPositionBroadcast);
  onPositionBroadcastRef.current = onPositionBroadcast;
  const onPresenceOfflineRef = useRef(onPresenceOffline);
  onPresenceOfflineRef.current = onPresenceOffline;
  const isPausedRef = useRef(
    isPaused || Boolean(talkSession) || Boolean(marketSession) || Boolean(ticketModalStationId)
  );
  isPausedRef.current =
    isPaused || Boolean(talkSession) || Boolean(marketSession) || Boolean(ticketModalStationId);
  const wallThemeRef = useRef<WallTheme>(museum.wallTheme);
  wallThemeRef.current = museum.wallTheme;
  const resumeLoopRef = useRef<(() => void) | null>(null);
  const renderOnceRef = useRef<(() => void) | null>(null);
  const clearKeysRef = useRef<(() => void) | null>(null);
  const rootContainerRef = useRef<HTMLDivElement | null>(null);

  const openDoorIdsRef = useRef<Set<string>>(new Set());
  const doorRigsRef = useRef<DoorRig[]>([]);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const builtMuseumRef = useRef<BuiltMuseum | null>(null);
  const builtOutdoorRef = useRef<BuiltOutdoorWorld | null>(null);
  const builtAmusementRef = useRef<BuiltAmusementParks | null>(null);
  const interactablesRef = useRef<THREE.Object3D[]>([]);
  const playerRigRef = useRef<AvatarRig | null>(null);
  const playerSlotRef = useRef<THREE.Group | null>(null);
  const companionsSlotRef = useRef<THREE.Group | null>(null);

  // Live outdoor vehicles, driving state, and ejected driver animation timer
  const trafficVehiclesRef = useRef<TrafficVehicleState[]>(createInitialTrafficVehicles());
  const drivingVehicleIdRef = useRef<string | null>(null);
  const activeRideIdRef = useRef<string | null>(null);
  const coasterStateRef = useRef<CoasterState>(createInitialCoasterState());
  const waterSlideStateRef = useRef<WaterSlideState>(createInitialWaterSlideState());
  const ejectedDriverTimerRef = useRef<number>(0);
  const companionRigsRef = useRef<
    Map<
      string,
      {
        rig: AvatarRig;
        visitor: CompanionAvatarEntry;
        visualSignature: string;
        targetX: number;
        targetZ: number;
        targetYaw: number;
      }
    >
  >(new Map());
  const ridingCompanionUidRef = useRef<string | null>(null);
  const [ridingCompanionName, setRidingCompanionName] = useState<string | null>(null);
  const lastDismountTimeRef = useRef<number>(0);

  const toggleCompanionRide = useCallback(() => {
    if (!activeRideIdRef.current && !drivingVehicleIdRef.current) return;
    if (ridingCompanionUidRef.current) {
      const compUid = ridingCompanionUidRef.current;
      const compEntry = companionRigsRef.current.get(compUid);
      const ps = playerStateRef.current;
      if (compEntry) {
        compEntry.targetX = ps.x + 1.2;
        compEntry.targetZ = ps.z;
        compEntry.targetYaw = ps.yaw;
        const gy = computeOutdoorElevation(compEntry.targetX, compEntry.targetZ);
        compEntry.rig.root.position.set(compEntry.targetX, gy, compEntry.targetZ);
        compEntry.rig.root.rotation.set(0, compEntry.targetYaw, 0);
        compEntry.rig.bodyGroup.position.set(0, 0, 0);
        compEntry.rig.bodyGroup.rotation.set(0, 0, 0);
        compEntry.rig.headGroup.rotation.set(0, 0, 0);
        compEntry.rig.leftLegPivot.rotation.set(0, 0, 0);
        compEntry.rig.rightLegPivot.rotation.set(0, 0, 0);
        compEntry.rig.leftArmPivot.rotation.set(0, 0, 0);
        compEntry.rig.rightArmPivot.rotation.set(0, 0, 0);
        animateAvatarRig(compEntry.rig, 0, 0, 0, { standStill: true });
      }
      ridingCompanionUidRef.current = null;
      setRidingCompanionName(null);
      onNotifyRef.current?.('Companion stepped off.');
    } else {
      let picked: { uid: string; name: string } | null = null;
      for (const [uid, entry] of companionRigsRef.current.entries()) {
        if (entry.visitor.isActive) {
          picked = { uid, name: entry.visitor.displayName };
          break;
        }
      }
      if (!picked) {
        for (const [uid, entry] of companionRigsRef.current.entries()) {
          picked = { uid, name: entry.visitor.displayName };
          break;
        }
      }
      if (picked) {
        ridingCompanionUidRef.current = picked.uid;
        setRidingCompanionName(picked.name);
        onNotifyRef.current?.(`${picked.name} joined you on the ride!`);
      }
    }
  }, []);
  const toggleCompanionRideRef = useRef(toggleCompanionRide);
  toggleCompanionRideRef.current = toggleCompanionRide;

  // Mutable player kinematics state — spawn inside Room 1 South bay facing North toward the vase & doorway
  const playerStateRef = useRef({
    x: 0,
    y: 0,
    z: 4.5,
    yaw: Math.PI, // Avatar faces -Z (into the room)
    camYaw: 0,
    camPitch: 0.12,
    speed: 0,
    lastBroadcast: 0,
    lastBroadcastX: Number.NaN,
    lastBroadcastZ: Number.NaN,
    lastBroadcastYaw: Number.NaN,
  });

  // Mobile/D-pad and Touch Virtual Joystick input state
  const virtualKeysRef = useRef<Record<string, boolean>>({});
  const joystickInputRef = useRef<{ forward: number; turn: number }>({ forward: 0, turn: 0 });
  const isMobileSprintRef = useRef<boolean>(false);
  const [isMobileSprint, setIsMobileSprint] = useState<boolean>(false);
  const [joystickState, setJoystickState] = useState<{
    active: boolean;
    knobX: number;
    knobY: number;
  }>({
    active: false,
    knobX: 0,
    knobY: 0,
  });

  const toggleDoorById = useCallback((doorId: string) => {
    const next = new Set(openDoorIdsRef.current);
    const opening = !next.has(doorId);
    if (opening) {
      next.add(doorId);
    } else {
      next.delete(doorId);
    }
    openDoorIdsRef.current = next;
    setOpenDoorList(Array.from(next));

    if (doorId === EXIT_DOOR_ID) {
      onNotifyRef.current?.(
        opening
          ? 'Main exit door opened — step outside into the Museum Garden & Chittagong–Cox highway!'
          : 'Main exit door closed.'
      );
      return;
    }

    const doorDef = layoutRef.current.doors.find((d) => d.id === doorId);
    if (doorDef) {
      const targetName = getResolvedRoomName(doorDef.toRoomIndex, roomNamesRef.current);
      onNotifyRef.current?.(
        opening
          ? `Door opened — walk straight through into ${targetName}.`
          : `Door to ${targetName} closed.`
      );
    }
  }, []);

  const toggleDoorByIdRef = useRef(toggleDoorById);
  toggleDoorByIdRef.current = toggleDoorById;

  const stopAndTalkToVehicle = useCallback((vehicleId?: string) => {
    if (drivingVehicleIdRef.current) return;
    const ps = playerStateRef.current;
    const list = trafficVehiclesRef.current;
    const target = vehicleId
      ? list.find((v) => v.id === vehicleId && v.status !== 'player_driving') ?? null
      : findNearestHailVehicle(ps.x, ps.z, list);
    if (!target) return;

    if (target.kind === 'speedboat') {
      boardSpeedboatRef.current(target.id);
      return;
    }

    target.status = 'stopped_talking';
    target.currentSpeed = 0;
    const defaultDest: RideDestination = ps.x < 0 ? 'coxs' : 'ctg';
    setTalkError(null);
    setTalkSession(createTalkSession(target, defaultDest));
    onNotifyRef.current?.(`Stopped ${target.driverName}'s ${target.title}. Negotiate fare or take over!`);
  }, []);

  const stopAndTalkRef = useRef(stopAndTalkToVehicle);
  stopAndTalkRef.current = stopAndTalkToVehicle;

  const boardSpeedboat = useCallback((vehicleId: string) => {
    if (drivingVehicleIdRef.current) return;
    const v = trafficVehiclesRef.current.find((item) => item.id === vehicleId);
    if (!v) return;
    drivingVehicleIdRef.current = v.id;
    v.status = 'player_driving';
    v.currentSpeed = 0;
    const outdoor = builtOutdoorRef.current;
    const rig = outdoor?.vehicleRigs.get(v.id);
    if (rig) {
      rig.driverGroup.visible = false;
    }
    playerStateRef.current.x = v.x;
    playerStateRef.current.z = v.z;
    playerStateRef.current.camYaw = normalizeAngle(v.yaw + Math.PI);
    setDrivingVehicleInfo({ id: v.id, title: v.title, stolen: false });
    setTalkSession(null);
    setTalkError(null);
    onPositionBroadcastRef.current?.(
      playerStateRef.current.x,
      playerStateRef.current.z,
      playerStateRef.current.yaw,
      activeRideIdRef.current ?? null,
      v.id
    );
    onNotifyRef.current?.(`Speedboat e uthechen! [W/S] chalan, [A/D] ghurun, [Shift] Nitro Boost, [F] get off.`);
  }, []);

  const boardSpeedboatRef = useRef(boardSpeedboat);
  boardSpeedboatRef.current = boardSpeedboat;

  const boardOrDriveNearbyVehicle = useCallback((targetVehicleId?: string) => {
    if (drivingVehicleIdRef.current) return;
    if (activeRideIdRef.current) exitRideRef.current();
    if (isRidingMetroRef.current) exitMetroRef.current();
    if (isRidingGondolaRef.current) exitGondolaRef.current();

    const ps = playerStateRef.current;
    const list = trafficVehiclesRef.current;
    let v = targetVehicleId
      ? list.find((item) => item.id === targetVehicleId) ?? null
      : findNearestHailVehicle(ps.x, ps.z, list, 36.0);

    if (!v) {
      let closestDist = Infinity;
      for (const item of list) {
        if (item.status === 'player_driving' || item.kind === 'speedboat') continue;
        const d = Math.hypot(item.x - ps.x, item.z - ps.z);
        if (d < closestDist) {
          closestDist = d;
          v = item;
        }
      }
    }

    if (v) {
      if (Math.hypot(v.x - ps.x, v.z - ps.z) > 16.0) {
        v.x = ps.x + (v.dir === 1 ? -3.8 : 3.8);
        v.z = ps.z > 50 ? (ps.z > 60 ? 68.0 : ps.z) : 35.0;
        v.yaw = v.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
      }
      drivingVehicleIdRef.current = v.id;
      v.status = 'player_driving';
      v.currentSpeed = 0;
      v.stolen = true;
      const outdoor = builtOutdoorRef.current;
      const rig = outdoor?.vehicleRigs.get(v.id);
      if (rig) {
        rig.driverGroup.visible = false;
      }
      ps.x = v.x;
      ps.z = v.z;
      ps.camYaw = normalizeAngle(v.yaw + Math.PI);
      setDrivingVehicleInfo({ id: v.id, title: v.title, stolen: true });
      setTalkSession(null);
      setTalkError(null);
      onNotifyRef.current?.(`🚗 ${v.driverName}-এর ${v.title}-এ উঠেছেন! W/A/S/D বা তীর চিহ্ন দিয়ে চালান, নামতে [F/Space]।`);
    }
  }, []);
  const boardOrDriveRef = useRef(boardOrDriveNearbyVehicle);
  boardOrDriveRef.current = boardOrDriveNearbyVehicle;

  const exitCurrentVehicle = useCallback(() => {
    const vid = drivingVehicleIdRef.current;
    if (!vid) return;
    lastDismountTimeRef.current = performance.now();
    const vehicle = trafficVehiclesRef.current.find((v) => v.id === vid);
    if (vehicle) {
      vehicle.status = 'cruising';
      vehicle.currentSpeed = vehicle.cruiseSpeed * 0.5;
      vehicle.stolen = false;
      vehicle.driverEjected = false;
      const rig = builtOutdoorRef.current?.vehicleRigs.get(vehicle.id);
      if (rig) {
        rig.driverGroup.visible = true;
      }
      // Step player safely onto the north edge of the road beside the vehicle, or dock/beach for speedboat
      playerStateRef.current.x = vehicle.x;
      if (vehicle.kind === 'speedboat') {
        playerStateRef.current.z = vehicle.x > 120 ? 82.0 : 88.5;
      } else {
        playerStateRef.current.z = Math.max(25.8, vehicle.z - 2.3);
      }
      playerStateRef.current.speed = 0;
    }
    if (playerRigRef.current) {
      const rig = playerRigRef.current;
      rig.root.rotation.set(0, Math.PI, 0);
      rig.bodyGroup.position.set(0, 0, 0);
      rig.bodyGroup.rotation.set(0, 0, 0);
      rig.headGroup.rotation.set(0, 0, 0);
      rig.leftLegPivot.rotation.set(0, 0, 0);
      rig.rightLegPivot.rotation.set(0, 0, 0);
      rig.leftArmPivot.rotation.set(0, 0, 0);
      rig.rightArmPivot.rotation.set(0, 0, 0);
      animateAvatarRig(rig, 0, 0, 0, { standStill: true });
    }
    if (ridingCompanionUidRef.current) {
      const compEntry = companionRigsRef.current.get(ridingCompanionUidRef.current);
      if (compEntry && !compEntry.visitor.ridingVehicleId) {
        compEntry.targetX = vehicle ? vehicle.x + 1.2 : playerStateRef.current.x + 1.2;
        compEntry.targetZ = vehicle
          ? (vehicle.kind === 'speedboat' ? (vehicle.x > 120 ? 82.0 : 88.5) : Math.max(25.8, vehicle.z - 2.3))
          : playerStateRef.current.z;
        compEntry.targetYaw = 0;
        compEntry.rig.root.position.set(compEntry.targetX, 0, compEntry.targetZ);
        compEntry.rig.root.rotation.set(0, 0, 0);
        compEntry.rig.bodyGroup.position.set(0, 0, 0);
        compEntry.rig.bodyGroup.rotation.set(0, 0, 0);
        compEntry.rig.headGroup.rotation.set(0, 0, 0);
        compEntry.rig.leftLegPivot.rotation.set(0, 0, 0);
        compEntry.rig.rightLegPivot.rotation.set(0, 0, 0);
        compEntry.rig.leftArmPivot.rotation.set(0, 0, 0);
        compEntry.rig.rightArmPivot.rotation.set(0, 0, 0);
        animateAvatarRig(compEntry.rig, 0, 0, 0, { standStill: true });
      }
      ridingCompanionUidRef.current = null;
      setRidingCompanionName(null);
    }
    drivingVehicleIdRef.current = null;
    setDrivingVehicleInfo(null);
    onPositionBroadcastRef.current?.(
      playerStateRef.current.x,
      playerStateRef.current.z,
      playerStateRef.current.yaw,
      activeRideIdRef.current ?? null,
      null
    );
    onNotifyRef.current?.('Stepped out of the vehicle.');
  }, []);

  const exitVehicleRef = useRef(exitCurrentVehicle);
  exitVehicleRef.current = exitCurrentVehicle;

  const mountAmusementRide = useCallback((rideId: string) => {
    if (drivingVehicleIdRef.current) return;
    if (performance.now() - lastDismountTimeRef.current < 900) return;
    const ride = getAmusementRideById(rideId);
    if (!ride) return;
    activeRideIdRef.current = ride.id;

    // Check if another active visitor is already riding this ride
    let existingRider: { uid: string; name: string } | null = null;
    for (const [uid, entry] of companionRigsRef.current.entries()) {
      if (entry.visitor.ridingRideId === ride.id) {
        existingRider = { uid, name: entry.visitor.displayName };
        break;
      }
    }
    if (existingRider) {
      ridingCompanionUidRef.current = existingRider.uid;
      setRidingCompanionName(existingRider.name);
    } else {
      ridingCompanionUidRef.current = null;
      setRidingCompanionName(null);
    }

    onPositionBroadcastRef.current?.(
      playerStateRef.current.x,
      playerStateRef.current.z,
      playerStateRef.current.yaw,
      ride.id,
      null
    );

    if (ride.id === 'ride-east-coaster') {
      coasterStateRef.current = {
        ...createInitialCoasterState(),
        state: 'docked_boarded',
      };
      setCoasterRideState({
        state: 'docked_boarded',
        speed: 0,
        countdownSeconds: 3,
      });
      onNotifyRef.current?.(
        existingRider
          ? `${existingRider.name} er sathe Roller Coaster e uthlen! 3 seconds por launch hobe! [Shift] Turbo · [F] Get Off`
          : `${ride.title} e uthlen! 3 seconds por launch hobe! [Shift] Turbo · [F] Get Off`
      );
    } else if (ride.id === 'ride-west-waterslide') {
      waterSlideStateRef.current = {
        ...createInitialWaterSlideState(),
        state: 'sliding',
        speed: 3.5,
      };
      setWaterSlideRideState(waterSlideStateRef.current);
      onNotifyRef.current?.(
        existingRider
          ? `🌊 ${existingRider.name} er sathe Water Slide এ স্লাইড শুরু হয়েছে! পুলের দিকে যাচ্ছেন... [F] Get Off`
          : '🌊 Tsunami Water Slide এ স্লাইড শুরু হয়েছে! পুলের দিকে যাচ্ছেন... [F] Get Off'
      );
    } else {
      onNotifyRef.current?.(
        existingRider
          ? `${existingRider.name} er sathe ${ride.title} e uthlen! [Shift / W] Speed Boost · [F] / [E] Get Off`
          : `${ride.title} e uthlen! [Shift / W] Speed Boost · [F] / [E] Get Off`
      );
    }
    setActiveRideInfo({ id: ride.id, title: ride.title, banglishHint: ride.banglishHint });
  }, []);
  const mountRideRef = useRef(mountAmusementRide);
  mountRideRef.current = mountAmusementRide;

  const exitCurrentRide = useCallback(() => {
    const rid = activeRideIdRef.current;
    if (!rid) return;
    lastDismountTimeRef.current = performance.now();
    const ride = getAmusementRideById(rid);
    activeRideIdRef.current = null;
    setActiveRideInfo(null);
    if (rid === 'ride-east-coaster') {
      coasterStateRef.current = createInitialCoasterState();
      setCoasterRideState({ state: 'docked_empty', speed: 0, countdownSeconds: 3 });
    }
    if (rid === 'ride-west-waterslide') {
      waterSlideStateRef.current = createInitialWaterSlideState();
      setWaterSlideRideState(createInitialWaterSlideState());
    }
    if (ride) {
      playerStateRef.current.x = ride.dismountX;
      playerStateRef.current.z = ride.dismountZ;
      playerStateRef.current.speed = 0;
    }
    if (playerRigRef.current) {
      const rig = playerRigRef.current;
      rig.root.rotation.set(0, Math.PI, 0);
      rig.bodyGroup.position.set(0, 0, 0);
      rig.bodyGroup.rotation.set(0, 0, 0);
      rig.headGroup.rotation.set(0, 0, 0);
      rig.leftLegPivot.rotation.set(0, 0, 0);
      rig.rightLegPivot.rotation.set(0, 0, 0);
      rig.leftArmPivot.rotation.set(0, 0, 0);
      rig.rightArmPivot.rotation.set(0, 0, 0);
      animateAvatarRig(rig, 0, 0, 0, { standStill: true });
    }
    if (ridingCompanionUidRef.current) {
      const compEntry = companionRigsRef.current.get(ridingCompanionUidRef.current);
      if (compEntry && ride && !compEntry.visitor.ridingRideId) {
        compEntry.targetX = ride.dismountX + 1.2;
        compEntry.targetZ = ride.dismountZ;
        compEntry.targetYaw = 0;
        compEntry.rig.root.position.set(compEntry.targetX, 0, compEntry.targetZ);
        compEntry.rig.root.rotation.set(0, 0, 0);
        compEntry.rig.bodyGroup.position.set(0, 0, 0);
        compEntry.rig.bodyGroup.rotation.set(0, 0, 0);
        compEntry.rig.headGroup.rotation.set(0, 0, 0);
        compEntry.rig.leftLegPivot.rotation.set(0, 0, 0);
        compEntry.rig.rightLegPivot.rotation.set(0, 0, 0);
        compEntry.rig.leftArmPivot.rotation.set(0, 0, 0);
        compEntry.rig.rightArmPivot.rotation.set(0, 0, 0);
        animateAvatarRig(compEntry.rig, 0, 0, 0, { standStill: true });
      }
      ridingCompanionUidRef.current = null;
      setRidingCompanionName(null);
    }
    onPositionBroadcastRef.current?.(
      playerStateRef.current.x,
      playerStateRef.current.z,
      playerStateRef.current.yaw,
      null,
      drivingVehicleIdRef.current ?? null
    );
    onNotifyRef.current?.('Stepped off the ride.');
  }, []);
  const exitRideRef = useRef(exitCurrentRide);
  exitRideRef.current = exitCurrentRide;

  const handleCloseTalk = useCallback(() => {
    if (talkSession) {
      const v = trafficVehiclesRef.current.find((item) => item.id === talkSession.vehicleId);
      if (v && v.status === 'stopped_talking') {
        v.status = 'cruising';
        v.currentSpeed = v.cruiseSpeed * 0.6;
      }
    }
    setTalkSession(null);
    setTalkError(null);
  }, [talkSession]);

  const handleSelectTalkDest = useCallback((dest: RideDestination) => {
    setTalkError(null);
    setTalkSession((prev) => (prev ? changeTalkDestination(prev, dest) : null));
  }, []);

  const handleBargainFare = useCallback(() => {
    setTalkError(null);
    setTalkSession((prev) => (prev ? negotiateTalkSession(prev) : null));
  }, []);

  const handlePayAndRide = useCallback(() => {
    if (!talkSession) return;
    const result = acceptRideFare(talkSession, walletBdt);
    if (!result.ok) {
      setTalkError(result.message);
      return;
    }
    const v = trafficVehiclesRef.current.find((item) => item.id === talkSession.vehicleId);
    if (!v) return;

    setWalletBdt(result.nextWallet);
    v.status = 'player_driving';
    v.stolen = false;
    v.driverEjected = false;
    // Point vehicle toward the chosen highway destination cleanly
    if (talkSession.destination === 'ctg' || talkSession.destination === 'kashmir') {
      v.yaw = -Math.PI / 2;
      v.dir = -1;
    } else if (talkSession.destination === 'coxs') {
      v.yaw = Math.PI / 2;
      v.dir = 1;
    }
    v.currentSpeed = 0;
    const rig = builtOutdoorRef.current?.vehicleRigs.get(v.id);
    if (rig) {
      rig.driverGroup.visible = true;
    }
    drivingVehicleIdRef.current = v.id;
    let existingRider: { uid: string; name: string } | null = null;
    for (const [uid, entry] of companionRigsRef.current.entries()) {
      if (entry.visitor.ridingVehicleId === v.id) {
        existingRider = { uid, name: entry.visitor.displayName };
        break;
      }
    }
    if (existingRider) {
      ridingCompanionUidRef.current = existingRider.uid;
      setRidingCompanionName(existingRider.name);
    } else {
      ridingCompanionUidRef.current = null;
      setRidingCompanionName(null);
    }
    playerStateRef.current.x = v.x;
    playerStateRef.current.z = v.z;
    playerStateRef.current.camYaw = normalizeAngle(v.yaw + Math.PI);
    setDrivingVehicleInfo({ id: v.id, title: v.title, stolen: false });
    setTalkSession(null);
    setTalkError(null);
    onPositionBroadcastRef.current?.(
      playerStateRef.current.x,
      playerStateRef.current.z,
      playerStateRef.current.yaw,
      activeRideIdRef.current ?? null,
      v.id
    );
    onNotifyRef.current?.(result.message);
  }, [talkSession, walletBdt]);

  const handleChintaiTakeover = useCallback(() => {
    if (!talkSession) return;
    const vIdx = trafficVehiclesRef.current.findIndex((item) => item.id === talkSession.vehicleId);
    if (vIdx < 0) return;

    const current = trafficVehiclesRef.current[vIdx];
    const { updatedVehicle, shoutLine, ejectedPos } = executeVehicleTakeover(current);
    trafficVehiclesRef.current[vIdx] = updatedVehicle;

    const outdoor = builtOutdoorRef.current;
    const rig = outdoor?.vehicleRigs.get(updatedVehicle.id);
    if (rig) {
      rig.driverGroup.visible = false;
    }
    if (outdoor?.ejectedDriverRig) {
      outdoor.ejectedDriverRig.x = ejectedPos.x;
      outdoor.ejectedDriverRig.z = ejectedPos.z;
      outdoor.ejectedDriverRig.sidewalkZ = ejectedPos.z;
      outdoor.ejectedDriverRig.root.position.set(ejectedPos.x, 0.14, ejectedPos.z);
      outdoor.ejectedDriverRig.root.visible = true;
      ejectedDriverTimerRef.current = 12;
    }

    drivingVehicleIdRef.current = updatedVehicle.id;
    let existingRider: { uid: string; name: string } | null = null;
    for (const [uid, entry] of companionRigsRef.current.entries()) {
      if (entry.visitor.ridingVehicleId === updatedVehicle.id) {
        existingRider = { uid, name: entry.visitor.displayName };
        break;
      }
    }
    if (existingRider) {
      ridingCompanionUidRef.current = existingRider.uid;
      setRidingCompanionName(existingRider.name);
    } else {
      ridingCompanionUidRef.current = null;
      setRidingCompanionName(null);
    }
    playerStateRef.current.x = updatedVehicle.x;
    playerStateRef.current.z = updatedVehicle.z;
    playerStateRef.current.camYaw = normalizeAngle(updatedVehicle.yaw + Math.PI);
    setDrivingVehicleInfo({ id: updatedVehicle.id, title: updatedVehicle.title, stolen: true });
    setTalkSession(null);
    setTalkError(null);
    onPositionBroadcastRef.current?.(
      playerStateRef.current.x,
      playerStateRef.current.z,
      playerStateRef.current.yaw,
      activeRideIdRef.current ?? null,
      updatedVehicle.id
    );
    onNotifyRef.current?.(shoutLine);
  }, [talkSession]);

  const handleBargainPrice = useCallback(() => {
    if (!marketSession) return;
    setMarketSession((prev) => (prev ? negotiateMarketPrice(prev) : null));
  }, [marketSession]);

  const handleBuyMarketItem = useCallback(() => {
    if (!marketSession) return;
    const res = buyMarketItem(marketSession, walletBdt);
    if (res.ok) {
      setWalletBdt(res.nextWallet);
      setPurchasedItems((prev) => [...prev, marketSession.item.banglaName]);
      setMarketSession(null);
    }
    onNotifyRef.current?.(res.message);
  }, [marketSession, walletBdt]);

  const handleCloseMarket = useCallback(() => {
    setMarketSession(null);
  }, []);

  const mountMetroTrain = useCallback(() => {
    if (drivingVehicleIdRef.current) exitVehicleRef.current();
    if (activeRideIdRef.current) exitRideRef.current();

    setIsRidingMetro(true);
    isRidingMetroRef.current = true;
    metroLocalPosRef.current = { x: 0, z: 0 };
    isSeatedOnMetroRef.current = false;
    setIsSeatedOnMetro(false);
    seatedMetroSeatRef.current = null;
    prevMetroYawRef.current = null;

    const pose = metroPoseRef.current;
    prevMetroYawRef.current = pose.yaw;
    const world = convertTrainLocalToWorld(pose, 0, 0, 0.55);
    playerStateRef.current.x = world.x;
    playerStateRef.current.y = world.y;
    playerStateRef.current.z = world.z;
    playerStateRef.current.yaw = pose.yaw;
    playerStateRef.current.camYaw = pose.yaw;
    playerStateRef.current.camPitch = 0.05;

    onNotifyRef.current?.('🚇 মেট্রোরেলের ভেতরে উঠেছেন! কোচে হাঁটুন [W/S/A/D], জানালার সিটে বসুন [C], এবং বাইরে দেখুন।');
  }, []);
  const mountMetroRef = useRef(mountMetroTrain);
  mountMetroRef.current = mountMetroTrain;

  const sitOnMetroSeat = useCallback((seat?: MetroSeat | null) => {
    const s = seat ?? nearbyMetroSeatRef.current;
    if (!s) return;
    isSeatedOnMetroRef.current = true;
    setIsSeatedOnMetro(true);
    seatedMetroSeatRef.current = s;
    metroLocalPosRef.current = { x: s.localX, z: s.localZ };
    onNotifyRef.current?.(`💺 ${s.label} এ বসেছেন! জানালা দিয়ে বাইরের দৃশ্য দেখুন। উঠতে [Space] বা [C] চাপুন।`);
  }, []);
  const sitOnMetroSeatRef = useRef(sitOnMetroSeat);
  sitOnMetroSeatRef.current = sitOnMetroSeat;

  const standUpFromMetroSeat = useCallback(() => {
    if (!isSeatedOnMetroRef.current) return;
    isSeatedOnMetroRef.current = false;
    setIsSeatedOnMetro(false);
    seatedMetroSeatRef.current = null;
    prevMetroYawRef.current = null;
    metroLocalPosRef.current.x = 0;
    onNotifyRef.current?.('🚶 সিট থেকে উঠে দাঁড়িয়েছেন। কোচের ভেতর স্বচ্ছ জানালা দিয়ে চারপাশ দেখতে পারেন।');
  }, []);
  const standUpFromMetroSeatRef = useRef(standUpFromMetroSeat);
  standUpFromMetroSeatRef.current = standUpFromMetroSeat;

  const exitMetroTrain = useCallback(() => {
    setIsRidingMetro(false);
    isRidingMetroRef.current = false;
    isSeatedOnMetroRef.current = false;
    setIsSeatedOnMetro(false);
    seatedMetroSeatRef.current = null;
    prevMetroYawRef.current = null;

    const pose = metroPoseRef.current;
    playerStateRef.current.x = pose.x;
    playerStateRef.current.y = 12.0;
    playerStateRef.current.z = pose.z - 1.8;
    playerStateRef.current.speed = 0;

    onNotifyRef.current?.('🚉 মেট্রোরেল থেকে স্টেশনের ২য় তলা প্ল্যাটফর্মে নিরাপদে নেমে এসেছেন!');
  }, []);
  const exitMetroRef = useRef(exitMetroTrain);
  exitMetroRef.current = exitMetroTrain;

  const mountGondolaCabin = useCallback((cabinId: number) => {
    if (drivingVehicleIdRef.current) exitVehicleRef.current();
    if (activeRideIdRef.current) exitRideRef.current();
    if (isRidingMetroRef.current) exitMetroRef.current();

    isRidingGondolaRef.current = true;
    ridingGondolaCabinIdRef.current = cabinId;
    setIsRidingGondola(true);
    onNotifyRef.current?.('🚡 গন্ডোলা ক্যাবল কারে উঠেছেন! ৩৬০° মনোরম কাশ্মীরের তুষার উপত্যকা ও পাইন বনের দৃশ্য উপভোগ করুন।');
  }, []);
  const mountGondolaRef = useRef(mountGondolaCabin);
  mountGondolaRef.current = mountGondolaCabin;

  const exitGondolaCabin = useCallback(() => {
    if (!isRidingGondolaRef.current) return;
    isRidingGondolaRef.current = false;
    ridingGondolaCabinIdRef.current = null;
    setIsRidingGondola(false);
    const ps = playerStateRef.current;
    ps.y = computeOutdoorElevation(ps.x, ps.z, ps.y);
    onNotifyRef.current?.('🚡 গন্ডোলা থেকে স্টেশনের প্ল্যাটফর্মে নিরাপদে নেমে এসেছেন।');
  }, []);
  const exitGondolaRef = useRef(exitGondolaCabin);
  exitGondolaRef.current = exitGondolaCabin;

  const buyGondolaTicket = useCallback(() => {
    setWalletBdt((prev) => Math.max(0, prev - 100));
    onNotifyRef.current?.(
      '🎫 গুলমার্গ গন্ডোলা কেবল কারের টিকেট সংগ্রহ করা হয়েছে (১০০৳)! সিঁড়ি দিয়ে ২য় তলা বোর্ডিং প্ল্যাটফর্মে যান এবং কেবল কারে উঠুন।'
    );
  }, []);
  const buyGondolaTicketRef = useRef(buyGondolaTicket);
  buyGondolaTicketRef.current = buyGondolaTicket;

  const throwSnowballAction = useCallback(() => {
    if (snowballCountRef.current <= 0) {
      onNotifyRef.current?.('❄️ আপনার বরফের গোলা শেষ! মাটিতে জমে থাকা বরফ থেকে গোলা তৈরি করুন।');
      return;
    }
    const ps = playerStateRef.current;
    const lookDir = {
      x: -Math.sin(ps.camYaw) * Math.cos(ps.camPitch),
      y: Math.sin(ps.camPitch),
      z: -Math.cos(ps.camYaw) * Math.cos(ps.camPitch),
    };
    const origin = { x: ps.x, y: ps.y + 1.2, z: ps.z };
    const sb = createSnowball(origin, lookDir, 24.0, 'player');
    snowballProjectilesRef.current.push(sb);
    snowballCountRef.current -= 1;
    setSnowballCount(snowballCountRef.current);
    onNotifyRef.current?.('🎯 বরফের গোলা ছোঁড়া হয়েছে!');
  }, []);
  const throwSnowballRef = useRef(throwSnowballAction);
  throwSnowballRef.current = throwSnowballAction;

  const handleBuildSnowman = useCallback((customization: SnowmanCustomization) => {
    const ps = playerStateRef.current;
    let bState = createSnowmanBuilderState(ps.x + 1.2, ps.z, ps.y);
    bState = rollSnowball(bState, 6.0);
    bState = rollSnowball(bState, 5.0);
    bState = rollSnowball(bState, 4.0);
    bState = customizeSnowman(bState, customization);
    const finished = finalizeSnowman(bState);

    builtSnowmenListRef.current.push(finished);
    if (builtOutdoorRef.current?.kashmir) {
      const mesh = builtOutdoorRef.current.kashmir.createBuiltSnowmanMesh(finished);
      sceneRef.current?.add(mesh);
    }
    setIsSnowmanModalOpen(false);
    onNotifyRef.current?.('☃️ আপনার তৈরি স্নোম্যান সফলভাবে তুষার উপত্যকায় স্থাপন করা হয়েছে!');
  }, []);

  const toggleWinterMode = useCallback(() => {
    setWinterMode((prev) => {
      const next = prev === 'walk' ? 'ski' : prev === 'ski' ? 'skate' : 'walk';
      winterModeRef.current = next;
      winterKinematicsRef.current.mode = next;
      if (next === 'ski') {
        onNotifyRef.current?.('🎿 স্কি মোড সক্রিয়! ঢালু পাহাড়ে তীব্র গতিতে গ্লাইড করুন [W/S/A/D/Space]।');
      } else if (next === 'skate') {
        onNotifyRef.current?.('⛸️ আইস স্কেটিং মোড সক্রিয়! ডাল লেকের বরফে মসৃণভাবে স্কেটিং করুন।');
      } else {
        onNotifyRef.current?.('🚶 সাধারণ হাঁটা মোডে ফিরে এসেছেন।');
      }
      return next;
    });
  }, []);
  const toggleWinterModeRef = useRef(toggleWinterMode);
  toggleWinterModeRef.current = toggleWinterMode;

  const handleTicketPurchased = useCallback((ticket: MetroTicket, nextWallet: number) => {
    setWalletBdt(nextWallet);
    setMetroTicket(ticket);
    setTicketModalStationId(null);
    onNotifyRef.current?.(
      ticket.ticketType === 'pass'
        ? '🎫 মেট্রোরেল র‍্যাপিড স্মার্ট পাস সক্রিয় হয়েছে! আনলিমিটেড ভ্রমণ করতে পারবেন।'
        : `🎫 ${ticket.fromStationName} থেকে ${ticket.toStationName} এর মেট্রোরেল টিকিট ক্রয় সম্পন্ন!`
    );
  }, []);

  const handleTeleportToAmusementPark = useCallback(() => {
    if (activeRideIdRef.current) {
      exitRideRef.current();
    }
    if (drivingVehicleIdRef.current) {
      exitVehicleRef.current();
    }
    setOpenDoorList((prev) => {
      const next = new Set(prev);
      next.add(EXIT_DOOR_ID);
      openDoorIdsRef.current = next;
      return Array.from(next);
    });

    const ps = playerStateRef.current;
    // When coming from museum (or east side), jump to West Park Arch facing the park!
    // If already in West Park, cycle to East Park Arch!
    const targetWest = ps.x > -15;
    if (targetWest) {
      ps.x = -18.2;
      ps.z = 11.5;
      ps.y = 1.5;
      ps.yaw = -Math.PI / 2; // Face West directly toward the AMUSEMENT PARK entrance arch & attractions!
      ps.camYaw = -Math.PI / 2;
      ps.camPitch = 0.05;
      ps.speed = 0;
      setMinimapSnap((prev) => ({ ...prev, x: -18.2, z: 11.5, yaw: -Math.PI / 2 }));
      onNotifyRef.current?.('🎡 Amusement Park এর তোরণের সামনে পৌঁছে গেছেন! (ব্যানার: AMUSEMENT PARK)');
    } else {
      ps.x = 18.2;
      ps.z = 11.5;
      ps.y = 1.5;
      ps.yaw = Math.PI / 2; // Face East directly toward the East AMUSEMENT PARK entrance arch & Roller Coaster!
      ps.camYaw = Math.PI / 2;
      ps.camPitch = 0.05;
      ps.speed = 0;
      setMinimapSnap((prev) => ({ ...prev, x: 18.2, z: 11.5, yaw: Math.PI / 2 }));
      onNotifyRef.current?.('🎢 East Amusement Park এর তোরণের সামনে পৌঁছে গেছেন! (ব্যানার: AMUSEMENT PARK)');
    }
  }, []);

  const handleTeleportToCoaster = useCallback(() => {
    if (activeRideIdRef.current) {
      exitRideRef.current();
    }
    if (drivingVehicleIdRef.current) {
      exitVehicleRef.current();
    }
    setOpenDoorList((prev) => {
      const next = new Set(prev);
      next.add(EXIT_DOOR_ID);
      openDoorIdsRef.current = next;
      return Array.from(next);
    });

    const ps = playerStateRef.current;
    ps.x = 61.0;
    ps.z = 22.8;
    ps.y = 1.5;
    ps.yaw = 0; // Face North directly towards the coaster station platform & waiting train!
    ps.camYaw = 0;
    ps.camPitch = 0.08;
    ps.speed = 0;

    setMinimapSnap((prev) => ({ ...prev, x: 61.0, z: 22.8, yaw: 0 }));
    onNotifyRef.current?.('🎢 Cyclone Roller Coaster এ পৌঁছে গেছেন! ট্রেনে উঠতে [E] কি চাপুন।');
  }, []);

  const handleTeleportToWestPark = useCallback(() => {
    if (activeRideIdRef.current) {
      exitRideRef.current();
    }
    if (drivingVehicleIdRef.current) {
      exitVehicleRef.current();
    }
    setOpenDoorList((prev) => {
      const next = new Set(prev);
      next.add(EXIT_DOOR_ID);
      openDoorIdsRef.current = next;
      return Array.from(next);
    });

    const ps = playerStateRef.current;
    ps.x = -38.0;
    ps.z = 16.5;
    ps.y = 1.5;
    ps.yaw = 0;
    ps.camYaw = 0;
    ps.camPitch = 0.05;
    ps.speed = 0;

    setMinimapSnap((prev) => ({ ...prev, x: -38.0, z: 16.5, yaw: 0 }));
    onNotifyRef.current?.('🎡 West Amusement Park এ পৌঁছে গেছেন (দোলনা ও চরকি)!');
  }, []);

  const handleTeleportToWaterSlide = useCallback(() => {
    if (activeRideIdRef.current) {
      exitRideRef.current();
    }
    if (drivingVehicleIdRef.current) {
      exitVehicleRef.current();
    }
    setOpenDoorList((prev) => {
      const next = new Set(prev);
      next.add(EXIT_DOOR_ID);
      openDoorIdsRef.current = next;
      return Array.from(next);
    });

    const ps = playerStateRef.current;
    // Teleport to the walkable stairs entrance on the outer west park zone
    ps.x = -75.0;
    ps.z = 18.5;
    ps.y = 0.0;
    ps.yaw = Math.PI; // Looking north facing the staircase and aqua tower!
    ps.camYaw = Math.PI;
    ps.camPitch = 0.15;
    ps.speed = 0;

    setMinimapSnap((prev) => ({ ...prev, x: -75.0, z: 18.5, yaw: Math.PI }));
    onNotifyRef.current?.('🌊 Tsunami Water Slide ও সুইমিং পুলে পৌঁছে গেছেন! সিঁড়ি বেয়ে উপরে উঠুন অথবা পুলে উপভোগ করুন।');
  }, []);

  const handleTeleportToMuseum = useCallback(() => {
    if (activeRideIdRef.current) {
      exitRideRef.current();
    }
    if (drivingVehicleIdRef.current) {
      exitVehicleRef.current();
    }

    const ps = playerStateRef.current;
    ps.x = 0;
    ps.z = 0;
    ps.y = 1.5;
    ps.yaw = 0;
    ps.camYaw = 0;
    ps.camPitch = 0;
    ps.speed = 0;

    setMinimapSnap((prev) => ({ ...prev, x: 0, z: 0, yaw: 0 }));
    onNotifyRef.current?.('🏛️ মিউজিয়াম রুম ১-এ ফিরে এসেছেন।');
  }, []);

  // Mount WebGLRenderer & Walkable Multi-Room 3D Museum Scene ONCE
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    const width = Math.max(320, container.clientWidth);
    const height = Math.max(320, container.clientHeight);
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 0.65 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.94;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    const fogHex = THEME_FOG_COLOR[museum.wallTheme];
    renderer.setClearColor(fogHex, 1);
    scene.background = new THREE.Color(fogHex);
    scene.fog = new THREE.FogExp2(fogHex, 0.01);
    sceneRef.current = scene;

    // Studio environment map for metallic bronze frames, marble & glazed flower vases (hardware GPU)
    let envTex: THREE.Texture | null = null;
    if (!isSoftwareGl) {
      const pmrem = new THREE.PMREMGenerator(renderer);
      envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTex;
      pmrem.dispose();
    }

    const camera = new THREE.PerspectiveCamera(56, width / height, 0.1, 750);
    camera.position.set(0, 2.2, 7.8);
    camera.lookAt(0, 1.7, -4);

    // Calibrated architectural + outdoor sunlight rig (<= 1 shadow caster, <= 4 dynamic room lights)
    const hemiLight = new THREE.HemisphereLight(0xf2f7ff, 0x7b7262, isSoftwareGl ? 1.05 : 0.72);
    scene.add(hemiLight);

    const keyDir = new THREE.DirectionalLight(0xfff1dc, 1.15);
    keyDir.position.set(16, 26, 22);
    keyDir.castShadow = !isSoftwareGl;
    keyDir.shadow.mapSize.set(1024, 1024);
    keyDir.shadow.camera.near = 1;
    keyDir.shadow.camera.far = 95;
    keyDir.shadow.camera.left = -28;
    keyDir.shadow.camera.right = 28;
    keyDir.shadow.camera.top = 28;
    keyDir.shadow.camera.bottom = -28;
    keyDir.shadow.bias = -0.0005;
    keyDir.shadow.normalBias = 0.02;
    scene.add(keyDir);

    const roomLights: THREE.PointLight[] = [];
    const lightCount = isSoftwareGl ? 2 : 4;
    for (let i = 0; i < lightCount; i++) {
      const pt = new THREE.PointLight(0xffe7c6, isSoftwareGl ? 7.2 : 8.0, 24, 1.7);
      pt.position.set(0, 5.2, -i * 10);
      scene.add(pt);
      roomLights.push(pt);
    }

    const playerSlot = new THREE.Group();
    scene.add(playerSlot);
    playerSlotRef.current = playerSlot;

    const companionsSlot = new THREE.Group();
    scene.add(companionsSlot);
    companionsSlotRef.current = companionsSlot;

    // Keyboard & Pointer controls (WASD + Arrows + Q/E turn + Shift fast + F / Space open door)
    const keys: Record<string, boolean> = {};
    const clearAllKeys = () => {
      for (const prop of Object.keys(keys)) {
        keys[prop] = false;
      }
      for (const prop of Object.keys(virtualKeysRef.current)) {
        virtualKeysRef.current[prop] = false;
      }
      joystickInputRef.current = { forward: 0, turn: 0 };
    };
    clearKeysRef.current = () => {
      clearAllKeys();
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      loopActive = false;
    };

    let isDragging = false;
    let dragMoved = false;
    let lastPointerX = 0;
    let lastPointerY = 0;
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    let lastHoverRaycast = 0;

    const mapKeyName = (e: KeyboardEvent): string[] => {
      const codes = [e.code];
      const lower = e.key.toLowerCase();
      if (lower === 'w') codes.push('KeyW');
      else if (lower === 's') codes.push('KeyS');
      else if (lower === 'a') codes.push('KeyA');
      else if (lower === 'd') codes.push('KeyD');
      else if (lower === 'q') codes.push('KeyQ');
      else if (lower === 'e') codes.push('KeyE');
      else if (lower === 't') codes.push('KeyT');
      else if (lower === 'f') codes.push('KeyF');
      else if (lower === 'j') codes.push('KeyJ');
      return codes;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isPausedRef.current) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown' ||
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight' ||
        e.code === 'Space'
      ) {
        e.preventDefault();
      }

      const mapped = mapKeyName(e);
      for (const code of mapped) {
        keys[code] = true;
      }

      // [Q] key to throw snowball in Kashmir or outdoor world
      if ((mapped.includes('KeyQ') || e.code === 'KeyQ') && !e.repeat) {
        throwSnowballRef.current();
        return;
      }

      // [R] key to open snowman crafting customizer
      if ((mapped.includes('KeyR') || e.code === 'KeyR') && !e.repeat) {
        if (playerStateRef.current.x <= -430) {
          setIsSnowmanModalOpen(true);
          return;
        }
      }

      // [K] key to toggle ski / skate / walk mode
      if ((mapped.includes('KeyK') || e.code === 'KeyK') && !e.repeat) {
        if (playerStateRef.current.x <= -430) {
          toggleWinterModeRef.current();
          return;
        }
      }

      // [J] key to invite or dismiss companion on ride or vehicle
      if ((mapped.includes('KeyJ') || e.code === 'KeyJ') && !e.repeat) {
        toggleCompanionRideRef.current();
        return;
      }

      // [C] key to sit down on nearest metro seat or stand up
      if ((mapped.includes('KeyC') || e.code === 'KeyC') && !e.repeat) {
        if (isRidingMetroRef.current) {
          if (isSeatedOnMetroRef.current) {
            standUpFromMetroSeatRef.current();
          } else if (nearbyMetroSeatRef.current) {
            sitOnMetroSeatRef.current(nearbyMetroSeatRef.current);
          }
          return;
        }
      }

      // Escape key to safely get off active ride, vehicle or metro train
      if (e.code === 'Escape' && !e.repeat) {
        if (isRidingGondolaRef.current) {
          exitGondolaRef.current();
          return;
        }
        if (isRidingMetroRef.current) {
          exitMetroRef.current();
          return;
        }
        if (activeRideIdRef.current) {
          exitRideRef.current();
          return;
        }
        if (drivingVehicleIdRef.current) {
          exitVehicleRef.current();
          return;
        }
      }

      // [E] or [T] to ride nearest Dolna / Chorki, Metro Train, sit on Metro Seat, or stop Rickshaw / Bike / Car to talk!
      if ((mapped.includes('KeyE') || mapped.includes('KeyT')) && !e.repeat) {
        if (isRidingGondolaRef.current) {
          exitGondolaRef.current();
          return;
        }
        const ps = playerStateRef.current;
        if (Math.hypot(ps.x - (-665), ps.z - 120.2) < 4.5 && Math.abs(ps.y - 3.8) < 2.0) {
          buyGondolaTicketRef.current();
          return;
        }
        const bCabin = findBoardableGondola({ x: ps.x, y: ps.y, z: ps.z }, gondolaSysRef.current.cabins);
        if (bCabin) {
          mountGondolaRef.current(bCabin.cabinId);
          return;
        }
        if (isRidingMetroRef.current) {
          if (isSeatedOnMetroRef.current) {
            standUpFromMetroSeatRef.current();
            return;
          } else if (nearbyMetroSeatRef.current) {
            sitOnMetroSeatRef.current(nearbyMetroSeatRef.current);
            return;
          }
        }
        if (activeRideIdRef.current) {
          exitRideRef.current();
          return;
        }
        if (drivingVehicleIdRef.current) {
          exitVehicleRef.current();
          return;
        }
        if (isNearMetroTrain(ps.x, ps.y, ps.z, metroPoseRef.current, 8.5)) {
          mountMetroRef.current();
          return;
        }
        const nearMetroSt = findNearestMetroStation(ps.x, ps.z, 6.0);
        if (nearMetroSt && Math.hypot(ps.x - nearMetroSt.ticketCounterPos.x, ps.z - nearMetroSt.ticketCounterPos.z) < 4.2) {
          setTicketModalStationId(nearMetroSt.id);
          return;
        }
        const nearRide = findNearestAmusementRide(ps.x, ps.z);
        if (nearRide) {
          mountRideRef.current(nearRide.id);
          return;
        }
        // If user pressed T, directly hop in and drive the vehicle!
        if (mapped.includes('KeyT')) {
          boardOrDriveRef.current();
          return;
        }
        const nearVeh = findNearestHailVehicle(ps.x, ps.z, trafficVehiclesRef.current, 24.0);
        if (nearVeh) {
          if (nearVeh.cruiseSpeed === 0 && nearVeh.driverName.includes('Ready to Drive')) {
            boardOrDriveRef.current(nearVeh.id);
          } else {
            stopAndTalkRef.current(nearVeh.id);
          }
          return;
        }
        const nearMarket = findNearestMarketItem(ps.x, ps.y, ps.z);
        if (nearMarket) {
          setMarketSession(createMarketSession(nearMarket));
          return;
        }
        if (Math.hypot(ps.x - (-254), ps.z - 85) < 3.2) {
          if (ps.y > 2.0) {
            ps.y = 0.05;
            onNotifyRef.current?.('🛗 লিফটে চড়ে নিচতলায় (১ম তলা) নেমে এলেন!');
          } else {
            ps.y = 4.25;
            onNotifyRef.current?.('🛗 লিফটে চড়ে দোতলায় (২য় তলা) উঠে গেলেন!');
          }
          return;
        }
      }

      // Dedicated keyboard key [F] or [Space] to open/close nearby door or hop off ride / vehicle / metro!
      if ((mapped.includes('KeyF') || e.code === 'Space') && !e.repeat) {
        if (isRidingMetroRef.current) {
          exitMetroRef.current();
          return;
        }
        if (activeRideIdRef.current) {
          exitRideRef.current();
          return;
        }
        if (drivingVehicleIdRef.current) {
          exitVehicleRef.current();
          return;
        }
        const ps = playerStateRef.current;
        const curLayout = layoutRef.current;
        const near = findNearestAnyDoor(ps.x, ps.z, curLayout);
        if (near) {
          toggleDoorByIdRef.current(near.id);
        } else if (Math.abs(ps.z - curLayout.northWallZ) < 4.5 && Math.abs(ps.x) < 3.4) {
          const nextRoomNum = toRomanNumeral(curLayout.roomCount + 1);
          onNotifyRef.current?.(
            `Room ${nextRoomNum} automatically opens behind this door once you add more than ${curLayout.totalWallSlots} artworks.`
          );
        }
      }

      if (e.code === 'KeyV') {
        setCameraMode((prev) => (prev === 'third' ? 'first' : 'third'));
      } else if (e.code === 'KeyH') {
        setDockCollapsed((prev) => !prev);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      for (const code of mapKeyName(e)) {
        keys[code] = false;
      }
    };

    let movePointerId: number | null = null;
    let moveStartX = 0;
    let moveStartY = 0;

    let lookPointerId: number | null = null;
    let lastLookX = 0;
    let lastLookY = 0;

    const onPointerDown = (e: PointerEvent) => {
      if (
        document.activeElement instanceof HTMLElement &&
        document.activeElement !== rootContainerRef.current
      ) {
        document.activeElement.blur();
      }
      rootContainerRef.current?.focus({ preventScroll: true });

      const rect = renderer.domElement.getBoundingClientRect();
      const isTouch = e.pointerType === 'touch';
      const isLeftSide = isTouch && e.clientX < rect.left + rect.width * 0.52;

      if (isLeftSide) {
        // Left-side touch on mobile -> Instant Virtual Joystick Movement
        movePointerId = e.pointerId;
        moveStartX = e.clientX;
        moveStartY = e.clientY;
        dragMoved = false;
        joystickInputRef.current = { forward: 0, turn: 0 };
        setJoystickState({
          active: true,
          knobX: 0,
          knobY: 0,
        });
      } else {
        // Right-side touch on mobile or mouse anywhere -> Camera Look & Interact
        lookPointerId = e.pointerId;
        isDragging = true;
        dragMoved = false;
        lastLookX = e.clientX;
        lastLookY = e.clientY;
        lastPointerX = e.clientX;
        lastPointerY = e.clientY;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerId === movePointerId) {
        const dx = e.clientX - moveStartX;
        const dy = e.clientY - moveStartY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragMoved = true;
        const maxR = 48;
        const dist = Math.hypot(dx, dy);
        const clampedDist = Math.min(dist, maxR);
        const angle = Math.atan2(dy, dx);
        const normX = clampedDist > 0 ? (Math.cos(angle) * clampedDist) / maxR : 0;
        const normY = clampedDist > 0 ? (Math.sin(angle) * clampedDist) / maxR : 0;

        // Pushing UP (-dy) moves forward (+1), pulling DOWN (+dy) moves backward (-1)
        // Pushing LEFT (-dx) steers left (+1), pushing RIGHT (+dx) steers right (-1)
        joystickInputRef.current = {
          forward: -normY,
          turn: -normX,
        };
        setJoystickState({
          active: true,
          knobX: normX * maxR,
          knobY: normY * maxR,
        });
        return;
      }

      if (e.pointerId === lookPointerId || (lookPointerId === null && isDragging)) {
        const dx = e.clientX - lastLookX;
        const dy = e.clientY - lastLookY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved = true;
        lastLookX = e.clientX;
        lastLookY = e.clientY;
        lastPointerX = e.clientX;
        lastPointerY = e.clientY;
        playerStateRef.current.camYaw = normalizeAngle(
          playerStateRef.current.camYaw - dx * 0.0055
        );
        playerStateRef.current.camPitch = THREE.MathUtils.clamp(
          playerStateRef.current.camPitch + dy * 0.0038,
          -0.25,
          0.62
        );
        return;
      }

      const now = performance.now();
      if (now - lastHoverRaycast < 90) return;
      lastHoverRaycast = now;
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(interactablesRef.current, false);
      if (hits.length > 0 && hits[0].distance < 24) {
        const ud = hits[0].object.userData;
        if (typeof ud.rideId === 'string') {
          const ride = getAmusementRideById(ud.rideId);
          renderer.domElement.style.cursor = 'pointer';
          setHoveredPrompt(
            ride ? { kind: 'ride', label: `${ride.title} [E to Ride]` } : null
          );
          return;
        }
        if (typeof ud.vehicleId === 'string') {
          const foundVeh = trafficVehiclesRef.current.find((v) => v.id === ud.vehicleId);
          renderer.domElement.style.cursor = 'pointer';
          setHoveredPrompt(
            foundVeh
              ? { kind: 'vehicle', label: `${foundVeh.driverName}'s ${foundVeh.title} [E]` }
              : null
          );
          return;
        }
        if (typeof ud.marketItemId === 'string') {
          const mItem = MARKET_ITEMS.find((it) => it.id === ud.marketItemId);
          renderer.domElement.style.cursor = 'pointer';
          setHoveredPrompt(
            mItem
              ? { kind: 'market', label: `${mItem.icon} ${mItem.banglaName} - ${mItem.stallName} [E or Click]` }
              : null
          );
          return;
        }
        if (ud.marketElevator) {
          renderer.domElement.style.cursor = 'pointer';
          setHoveredPrompt({
            kind: 'elevator',
            label: '🛗 মার্কেট ক্যাপসুল লিফট [E or Click]',
          });
          return;
        }
        if (typeof ud.metroTicketStation === 'string') {
          renderer.domElement.style.cursor = 'pointer';
          setHoveredPrompt({
            kind: 'metroTicket',
            label: 'মেট্রোরেল টিকিট ও স্মার্ট পাস কাউন্টার [E or Click]',
          });
          return;
        }
        if (ud.isMetroSeat) {
          renderer.domElement.style.cursor = 'pointer';
          setHoveredPrompt({
            kind: 'metro',
            label: isSeatedOnMetroRef.current
              ? 'সিট থেকে উঠুন [Space or Click]'
              : `সিটে বসুন: ${ud.metroSeatLabel ?? 'Seat'} [Click]`,
          });
          return;
        }
        if (ud.metroTrain) {
          renderer.domElement.style.cursor = 'pointer';
          setHoveredPrompt({
            kind: 'metro',
            label: isRidingMetroRef.current
              ? 'মেট্রোরেল থেকে নামুন [E or Click]'
              : 'চট্টগ্রাম-কক্সবাজার এক্সপ্রেস মেট্রোরেল [E or Click]',
          });
          return;
        }
        if (ud.isGondolaTicketCounter) {
          renderer.domElement.style.cursor = 'pointer';
          setHoveredPrompt({
            kind: 'gondola',
            label: '🎫 গুলমার্গ গন্ডোলা টিকেট কাউন্টার [E বা ক্লিক করুন]',
          });
          return;
        }
        if (ud.isGondolaCabin || ud.isGondolaBase || ud.isGondolaSummit) {
          renderer.domElement.style.cursor = 'pointer';
          setHoveredPrompt({
            kind: 'gondola',
            label: isRidingGondolaRef.current
              ? '🚡 গন্ডোলা কেবল কার থেকে নামুন [E]'
              : '🚡 গুলমার্গ মাউন্টেন গন্ডোলা কেবল কার [E বা T]',
          });
          return;
        }
        if (typeof ud.renameRoomIndex === 'number') {
          renderer.domElement.style.cursor = 'pointer';
          setHoveredPrompt({
            kind: 'signboard',
            label: getResolvedRoomName(ud.renameRoomIndex, roomNamesRef.current),
          });
          return;
        }
        if (typeof ud.doorId === 'string') {
          renderer.domElement.style.cursor = 'pointer';
          const isOpen = openDoorIdsRef.current.has(ud.doorId);
          setHoveredPrompt({
            kind: 'door',
            label:
              ud.doorId === EXIT_DOOR_ID
                ? isOpen
                  ? 'Close Outdoor Exit Door [F]'
                  : 'Open Exit Door to Garden & Road [F]'
                : isOpen
                  ? 'Close Door [F]'
                  : 'Open Door [F]',
          });
          return;
        }
        if (ud.expansionDoor) {
          renderer.domElement.style.cursor = 'pointer';
          setHoveredPrompt({
            kind: 'expansion',
            label: `Add >${layoutRef.current.totalWallSlots} artworks to unlock next room`,
          });
          return;
        }
        if (typeof ud.artworkId === 'string') {
          const found = artworksRef.current.find((a) => a.id === ud.artworkId);
          renderer.domElement.style.cursor = 'pointer';
          setHoveredPrompt(found ? { kind: 'artwork', label: found.title } : null);
          return;
        }
      }
      renderer.domElement.style.cursor = 'grab';
      setHoveredPrompt(null);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerId === movePointerId) {
        movePointerId = null;
        joystickInputRef.current = { forward: 0, turn: 0 };
        setJoystickState({ active: false, knobX: 0, knobY: 0 });
      }
      if (e.pointerId === lookPointerId || lookPointerId === null) {
        lookPointerId = null;
        const wasClick = isDragging && !dragMoved;
        isDragging = false;
        if (!wasClick) return;

        const rect = renderer.domElement.getBoundingClientRect();
        pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointerNdc, camera);
        const hits = raycaster.intersectObjects(interactablesRef.current, false);
      if (hits.length > 0) {
        const ud = hits[0].object.userData;
        if (typeof ud.rideId === 'string') {
          mountRideRef.current(ud.rideId);
          return;
        }
        if (typeof ud.vehicleId === 'string') {
          stopAndTalkRef.current(ud.vehicleId);
          return;
        }
        if (typeof ud.marketItemId === 'string') {
          const mItem = MARKET_ITEMS.find((it) => it.id === ud.marketItemId);
          if (mItem) {
            setMarketSession(createMarketSession(mItem));
            return;
          }
        }
        if (ud.marketElevator) {
          const ps = playerStateRef.current;
          if (ps.y > 2.0) {
            ps.y = 0.05;
            onNotifyRef.current?.('🛗 লিফটে চড়ে নিচতলায় (১ম তলা) নেমে এলেন!');
          } else {
            ps.y = 4.25;
            onNotifyRef.current?.('🛗 লিফটে চড়ে দোতলায় (২য় তলা) উঠে গেলেন!');
          }
          return;
        }
        if (typeof ud.metroTicketStation === 'string') {
          setTicketModalStationId(ud.metroTicketStation);
          return;
        }
        if (ud.isMetroSeat) {
          if (isRidingMetroRef.current) {
            if (isSeatedOnMetroRef.current) {
              standUpFromMetroSeatRef.current();
            } else {
              const seatId = ud.metroSeatId as string;
              const targetSeat = METRO_SEATS.find((s) => s.id === seatId);
              if (targetSeat) {
                sitOnMetroSeatRef.current(targetSeat);
              }
            }
          } else {
            mountMetroRef.current();
          }
          return;
        }
        if (ud.metroTrain) {
          if (isRidingMetroRef.current) {
            exitMetroRef.current();
          } else {
            mountMetroRef.current();
          }
          return;
        }
        if (ud.isGondolaTicketCounter) {
          buyGondolaTicketRef.current();
          return;
        }
        if (ud.isGondolaCabin || ud.isGondolaBase || ud.isGondolaSummit) {
          if (isRidingGondolaRef.current) {
            exitGondolaRef.current();
          } else {
            const cabinId = typeof ud.cabinId === 'number' ? ud.cabinId : 0;
            mountGondolaRef.current(cabinId);
          }
          return;
        }
        if (typeof ud.renameRoomIndex === 'number') {
          onRequestRenameRoomRef.current(ud.renameRoomIndex);
          return;
        }
        if (typeof ud.doorId === 'string') {
          toggleDoorByIdRef.current(ud.doorId);
          return;
        }
        if (ud.expansionDoor) {
          const nextNum = toRomanNumeral(layoutRef.current.roomCount + 1);
          onNotifyRef.current?.(
            `Room ${nextNum} opens automatically when you add more than ${layoutRef.current.totalWallSlots} artworks.`
          );
          return;
        }
        if (typeof ud.artworkId === 'string') {
          const idx = artworksRef.current.findIndex((a) => a.id === ud.artworkId);
          if (idx >= 0) {
            onSelectArtworkRef.current(artworksRef.current[idx], idx);
          }
        }
      }
    }
  };

    const onResize = () => {
      if (!container) return;
      const w = Math.max(320, container.clientWidth);
      const h = Math.max(320, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.render(scene, camera);
    };

    const onPointerCancel = (e: PointerEvent) => {
      if (e.pointerId === movePointerId) {
        movePointerId = null;
        joystickInputRef.current = { forward: 0, turn: 0 };
        setJoystickState({ active: false, knobX: 0, knobY: 0 });
      }
      if (e.pointerId === lookPointerId) {
        lookPointerId = null;
        isDragging = false;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearAllKeys);
    window.addEventListener('resize', onResize);
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);

    rootContainerRef.current?.focus({ preventScroll: true });

    const onContextLost = (e: Event) => e.preventDefault();
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    const startTimeMs = performance.now();
    let prevTimeMs = startTimeMs;
    let frameId = 0;
    let disposed = false;
    let lastHudCheck = 0;

    const afterDraw = createAfterDrawScheduler(renderer, (id) => {
      frameId = id;
    });

    let loopActive = false;
    let frameCount = 0;

    const tick = () => {
      if (disposed) return;
      if (isPausedRef.current) {
        loopActive = false;
        return;
      }
      loopActive = true;
      const nowMs = performance.now();
      const delta = Math.min(Math.max((nowMs - prevTimeMs) / 1000, 0.001), 0.1);
      prevTimeMs = nowMs;
      const elapsed = (nowMs - startTimeMs) / 1000;
      const ps = playerStateRef.current;
      const curLayout = layoutRef.current;
      const openDoors = openDoorIdsRef.current;

      // Smoothly animate double-leaf doors swinging open/closed
      const doorLerp = 1 - Math.exp(-8 * delta);
      for (const rig of doorRigsRef.current) {
        const targetAngle = openDoors.has(rig.id) ? Math.PI * 0.48 : 0;
        rig.currentAngle += (targetAngle - rig.currentAngle) * doorLerp;
        rig.leftPivot.rotation.y = -rig.currentAngle;
        rig.rightPivot.rotation.y = rig.currentAngle;
      }

      const k = keys;
      const vk = virtualKeysRef.current;
      const keyForward =
        (k.KeyW || k.ArrowUp || vk.up ? 1 : 0) -
        (k.KeyS || k.ArrowDown || vk.down ? 1 : 0);
      const keyTurn =
        (k.KeyA || k.ArrowLeft || k.KeyQ || vk.left ? 1 : 0) -
        (k.KeyD || k.ArrowRight || vk.right ? 1 : 0);

      const joyForward = joystickInputRef.current.forward;
      const joyTurn = joystickInputRef.current.turn;

      const forwardIn = Math.abs(joyForward) > 0.05 ? joyForward : keyForward;
      const turnIn = Math.abs(joyTurn) > 0.05 ? joyTurn : keyTurn;
      const sprintActive = Boolean(k.ShiftLeft || k.ShiftRight || isMobileSprintRef.current);

      const activeVehicleId = drivingVehicleIdRef.current;
      const activeVehicle = activeVehicleId
        ? trafficVehiclesRef.current.find((v) => v.id === activeVehicleId) ?? null
        : null;
      const outdoor = builtOutdoorRef.current;
      const playerRig = playerRigRef.current;

      const boostActive = Boolean(k.ShiftLeft || k.ShiftRight || k.KeyW || k.ArrowUp || vk.up);
      const isRidingCoaster = activeRideIdRef.current === 'ride-east-coaster';
      const isRidingWaterSlide = activeRideIdRef.current === 'ride-west-waterslide';

      coasterStateRef.current = stepCoasterSimulation(coasterStateRef.current, delta, isRidingCoaster);
      coasterStateRef.current.boostActive = boostActive;

      waterSlideStateRef.current = stepWaterSlideSimulation(waterSlideStateRef.current, delta, isRidingWaterSlide);

      const amusementResult = builtAmusementRef.current?.update(delta, elapsed, {
        boostActive,
        coasterState: coasterStateRef.current,
        waterSlideState: waterSlideStateRef.current,
      });
      const coasterPose = amusementResult?.coasterPose ?? computeCoasterPoseAtT(0, 0);
      const waterSlidePose = amusementResult?.waterSlidePose ?? computeWaterSlidePoseAtT(0, 0);

      // Advance elevated Metro Rail simulation (Chittagong <-> Museum <-> Cox's Bazar)
      const nextMetro = stepMetroSimulation(metroTrainStateRef.current, delta);
      metroTrainStateRef.current = nextMetro;
      const mPose = computeMetroPoseAtT(nextMetro.progressT, nextMetro.speed);
      metroPoseRef.current = mPose;

      if (builtOutdoorRef.current?.metroTrainRig) {
        const mRig = builtOutdoorRef.current.metroTrainRig;
        mRig.root.position.set(mPose.x, mPose.y, mPose.z);
        mRig.root.rotation.set(mPose.pitch, mPose.yaw, 0, 'YXZ');
      }

      // Advance Kashmir Gondola simulation, snowfall particles, and snowball physics
      if (builtOutdoorRef.current?.kashmir) {
        const kash = builtOutdoorRef.current.kashmir;
        const nextGondola = stepGondolaSimulation(gondolaSysRef.current, delta, elapsed);
        gondolaSysRef.current = nextGondola;

        for (let i = 0; i < kash.gondolaCabins.length; i++) {
          const cabinData = nextGondola.cabins[i];
          const cabinMesh = kash.gondolaCabins[i];
          if (cabinData && cabinMesh) {
            cabinMesh.position.set(cabinData.x, cabinData.y, cabinData.z);
            cabinMesh.rotation.z = cabinData.swayRoll;
          }
        }

        kash.updateSnowParticles(delta, camera.position);

        if (snowballProjectilesRef.current.length > 0) {
          const sbRes = stepSnowballs(
            snowballProjectilesRef.current,
            snowballNPCsRef.current,
            { x: ps.x, y: ps.y, z: ps.z },
            delta
          );
          snowballProjectilesRef.current = sbRes.updatedSnowballs;
          snowballNPCsRef.current = sbRes.updatedNPCs;
          if (sbRes.playerHit) {
            onNotifyRef.current?.('❄️ আপনাকে বরফের গোলা দিয়ে আঘাত করা হয়েছে! (Snowball Hit!)');
          }
          for (const sp of sbRes.splashes) {
            if (sp.hitType === 'npc') {
              onNotifyRef.current?.('🎯 দারুণ নিশানা! বরফের গোলা সরাসরি আঘাত করেছে!');
            }
          }
        }
      }

      setIsInKashmirZone(ps.x <= -430);
      setIsInCtgZone(ps.x <= -45 && ps.x > -430);
      const bCabin = findBoardableGondola({ x: ps.x, y: ps.y, z: ps.z }, gondolaSysRef.current.cabins);
      setNearbyGondolaBoardable(bCabin !== null);
      const isNearCounter = Math.hypot(ps.x - (-665), ps.z - 120.2) < 4.5 && Math.abs(ps.y - 3.8) < 2.0;
      setNearbyGondolaCounter(isNearCounter);

      if (isRidingGondolaRef.current && ridingGondolaCabinIdRef.current !== null) {
        const cabin = gondolaSysRef.current.cabins[ridingGondolaCabinIdRef.current];
        if (cabin) {
          ps.x = cabin.x;
          ps.y = cabin.y - 0.75;
          ps.z = cabin.z;
          ps.speed = 4.2;
          if (Math.abs(turnIn) > 0.05) {
            ps.camYaw = normalizeAngle(ps.camYaw + turnIn * 2.2 * delta);
          }
          if (Math.abs(forwardIn) > 0.05) {
            ps.camPitch = THREE.MathUtils.clamp(ps.camPitch + forwardIn * 1.5 * delta, -0.65, 0.65);
          }
          if (playerRig) {
            playerRig.root.position.set(cabin.x, cabin.y - 0.75, cabin.z);
            playerRig.root.visible = cameraModeRef.current === 'third';
            playerRig.leftLegPivot.rotation.set(-Math.PI / 2 + 0.1, -0.05, 0);
            playerRig.rightLegPivot.rotation.set(-Math.PI / 2 + 0.1, 0.05, 0);
            playerRig.leftArmPivot.rotation.set(-0.55, 0, 0.12);
            playerRig.rightArmPivot.rotation.set(-0.55, 0, -0.12);
            playerRig.bodyGroup.position.set(0, -0.22, 0);
            animateAvatarRig(playerRig, 0, elapsed, delta, { standStill: true });
          }
        }
      } else if (winterModeRef.current === 'ski' || winterModeRef.current === 'skate') {
        const currentSlope = (computeOutdoorElevation(ps.x - 1.5, ps.z, ps.y) - computeOutdoorElevation(ps.x + 1.5, ps.z, ps.y)) / 3.0;
        const nextSki = stepSkiPhysics(
          winterKinematicsRef.current,
          {
            forward: forwardIn > 0,
            backward: forwardIn < 0,
            left: turnIn > 0,
            right: turnIn < 0,
            jump: Boolean(k.Space),
          },
          currentSlope,
          delta
        );
        winterKinematicsRef.current = nextSki;
        ps.speed = nextSki.speed;
        ps.yaw = nextSki.headingYaw;
        ps.camYaw = nextSki.headingYaw;
        ps.x += -Math.sin(nextSki.headingYaw) * nextSki.speed * delta;
        ps.z += -Math.cos(nextSki.headingYaw) * nextSki.speed * delta;
        const groundY = computeOutdoorElevation(ps.x, ps.z, ps.y);
        ps.y = groundY + nextSki.airborneYVelocity;

        const clamped = clampWorldPosition(
          ps.x,
          ps.z,
          curLayout,
          openDoors,
          ps.z,
          ps.x,
          false
        );
        ps.x = clamped.x;
        ps.z = clamped.z;

        if (playerRig) {
          playerRig.root.position.set(ps.x, ps.y, ps.z);
          playerRig.root.rotation.set(0, ps.yaw, nextSki.carveAngle);
          playerRig.root.visible = cameraModeRef.current === 'third';
          animateAvatarRig(playerRig, nextSki.speed > 0.5 ? 2.5 : 0, elapsed, delta);
        }
      } else if (isRidingMetroRef.current) {
        if (!isSeatedOnMetroRef.current) {
          // Walking inside the train aisle
          const walkSpeed = 3.6;
          const nextLocalZ = metroLocalPosRef.current.z + forwardIn * walkSpeed * delta;
          const nextLocalX = metroLocalPosRef.current.x - turnIn * walkSpeed * delta;
          const clamped = clampTrainLocalAisle(nextLocalX, nextLocalZ);
          metroLocalPosRef.current.x = clamped.localX;
          metroLocalPosRef.current.z = clamped.localZ;

          const nearSeat = findNearestMetroSeat(clamped.localX, clamped.localZ, 1.4);
          nearbyMetroSeatRef.current = nearSeat;
          setNearbyMetroSeat(nearSeat);
        } else {
          if (forwardIn !== 0 || turnIn !== 0) {
            standUpFromMetroSeatRef.current();
          }
        }

        const seated = isSeatedOnMetroRef.current;
        const world = convertTrainLocalToWorld(
          mPose,
          metroLocalPosRef.current.x,
          metroLocalPosRef.current.z,
          seated ? 0.45 : 0.55
        );
        ps.x = world.x;
        ps.y = world.y;
        ps.z = world.z;
        ps.yaw = mPose.yaw;
        ps.speed = nextMetro.speed;

        if (prevMetroYawRef.current !== null) {
          const dYaw = normalizeAngle(mPose.yaw - prevMetroYawRef.current);
          ps.camYaw = normalizeAngle(ps.camYaw + dYaw);
        }
        prevMetroYawRef.current = mPose.yaw;

        // Position player avatar rig inside train coach
        if (playerRig) {
          playerRig.root.position.set(world.x, world.y, world.z);
          playerRig.root.rotation.y = mPose.yaw;
          playerRig.root.visible = cameraModeRef.current === 'third';
          if (seated) {
            animateAvatarRig(playerRig, 0, elapsed, delta, { standStill: true });
          } else {
            const isWalkingInAisle = forwardIn !== 0 || turnIn !== 0;
            animateAvatarRig(playerRig, isWalkingInAisle ? 1.5 : 0, elapsed, delta);
          }
        }
      } else if (activeVehicle) {
        // Player is driving or riding a Rickshaw, Motorbike, or Car on the highway!
        const driveStep = stepVehicleDriving(
          activeVehicle.kind,
          {
            throttle: forwardIn,
            steer: turnIn,
            boost: Boolean(k.ShiftLeft || k.ShiftRight),
          },
          {
            x: activeVehicle.x,
            z: activeVehicle.z,
            yaw: activeVehicle.yaw,
            speed: activeVehicle.currentSpeed,
            camYaw: ps.camYaw,
          },
          delta
        );

        activeVehicle.x = driveStep.x;
        activeVehicle.z = driveStep.z;
        activeVehicle.yaw = driveStep.yaw;
        activeVehicle.currentSpeed = driveStep.speed;

        ps.x = driveStep.x;
        ps.z = driveStep.z;
        ps.yaw = driveStep.yaw;
        ps.camYaw = driveStep.camYaw;
        ps.speed = Math.abs(driveStep.speed);

        const vRig = outdoor?.vehicleRigs.get(activeVehicle.id);
        if (vRig) {
          const vehElevY =
            activeVehicle.kind === 'speedboat'
              ? 0.04
              : computeOutdoorElevation(activeVehicle.x, activeVehicle.z);
          vRig.root.position.set(activeVehicle.x, vehElevY + 0.02, activeVehicle.z);
          vRig.root.rotation.y = activeVehicle.yaw;
          for (const w of vRig.wheels) {
            w.rotation.x += driveStep.wheelSpinDelta;
          }
          if (playerRig) {
            const seatLocal = activeVehicle.stolen ? vRig.riderSeatLocal : vRig.passengerSeatLocal;
            _seatOffset.copy(seatLocal).applyAxisAngle(THREE.Object3D.DEFAULT_UP, activeVehicle.yaw);
            playerRig.root.position.set(
              activeVehicle.x + _seatOffset.x,
              vehElevY + seatLocal.y - 0.65,
              activeVehicle.z + _seatOffset.z
            );
            playerRig.root.rotation.y = activeVehicle.yaw;
            // Inside a sedan car keep exterior clean; on rickshaw/motorbike show seated avatar clearly!
            playerRig.root.visible =
              cameraModeRef.current === 'third' && activeVehicle.kind !== 'car';
            animateAvatarRig(playerRig, 0, elapsed, delta, { standStill: true });
          }
        }
      } else if (activeRideIdRef.current) {
        // Player is riding an amusement ride — allow turning camera smoothly with A/D or Arrow keys
        if (Math.abs(turnIn) > 0.05) {
          ps.camYaw = normalizeAngle(ps.camYaw + turnIn * 2.2 * delta);
        }
        if (activeRideIdRef.current === 'ride-east-coaster') {
          // Player is riding the East Park Cyclone Roller Coaster in the lead car!
          ps.x = coasterPose.x;
          ps.z = coasterPose.z;
          ps.yaw = coasterPose.yaw;
          ps.speed = coasterPose.speed;
          if (playerRig) {
            const rightX = -Math.cos(coasterPose.yaw);
            const rightZ = Math.sin(coasterPose.yaw);
            // Position player firmly seated inside the front-left passenger seat of the lead car
            playerRig.root.position.set(
              coasterPose.x + coasterPose.fwdX * 0.36 - rightX * 0.26,
              coasterPose.y + 0.14 + coasterPose.fwdY * 0.36,
              coasterPose.z + coasterPose.fwdZ * 0.36 - rightZ * 0.26
            );
            playerRig.root.rotation.set(coasterPose.rotX, coasterPose.yaw, coasterPose.roll, 'YXZ');
            playerRig.root.visible = cameraModeRef.current === 'third';

            // Natural Seated Coaster Pose ("bse thaki not daray"):
            // Bend legs forward 90 degrees at hips, lower torso into bucket seat, grip lap bar!
            playerRig.leftLegPivot.rotation.set(-Math.PI / 2 + 0.08, -0.06, 0);
            playerRig.rightLegPivot.rotation.set(-Math.PI / 2 + 0.08, 0.06, 0);
            if (boostActive || coasterPose.speed > 16.0) {
              // Thrill pose: arms held high in the air during high speed drops!
              playerRig.leftArmPivot.rotation.set(-2.4, 0, 0.35);
              playerRig.rightArmPivot.rotation.set(-2.4, 0, -0.35);
            } else {
              // Holding safety lap bar
              playerRig.leftArmPivot.rotation.set(-0.95, 0.12, 0.15);
              playerRig.rightArmPivot.rotation.set(-0.95, -0.12, -0.15);
            }
            playerRig.bodyGroup.rotation.set(-0.15, 0, 0);
            playerRig.bodyGroup.position.set(0, -0.28, 0);
            playerRig.headGroup.rotation.set(0.12, 0, 0);
          }
        } else if (activeRideIdRef.current === 'ride-west-waterslide') {
          // Player is sliding down the Tsunami Water Slide in the inflatable tube!
          ps.x = waterSlidePose.x;
          ps.z = waterSlidePose.z;
          ps.yaw = waterSlidePose.yaw;
          ps.speed = waterSlidePose.speed;
          if (playerRig) {
            // Lower avatar firmly seated inside the yellow inflatable donut tube
            playerRig.root.position.set(
              waterSlidePose.x,
              waterSlidePose.y - 0.12,
              waterSlidePose.z
            );
            playerRig.root.rotation.set(waterSlidePose.rotX, waterSlidePose.yaw, waterSlidePose.roll, 'YXZ');
            playerRig.root.visible = cameraModeRef.current === 'third';

            // Natural Seated / Reclined Sliding Pose ("bose suye"):
            // Recline torso backward, legs extended forward inside tube, arms holding handles!
            playerRig.leftLegPivot.rotation.set(-1.42, -0.12, 0);
            playerRig.rightLegPivot.rotation.set(-1.42, 0.12, 0);
            playerRig.leftArmPivot.rotation.set(-0.68, 0, 0.28);
            playerRig.rightArmPivot.rotation.set(-0.68, 0, -0.28);
            playerRig.bodyGroup.rotation.set(-0.35, 0, 0);
            playerRig.bodyGroup.position.set(0, -0.26, 0);
            playerRig.headGroup.rotation.set(0.24, 0, 0);
          }
        } else {
          // Dolna (Pendulum Swing) or Chorki (Ferris Wheel)
          const ride = getAmusementRideById(activeRideIdRef.current);
          if (ride) {
            const seatPose = computeRideSeatWorldPosition(ride, elapsed, boostActive);
            ps.x = seatPose.x;
            ps.z = seatPose.z;
            ps.yaw = seatPose.yaw;
            ps.speed = 0;
            if (playerRig) {
              playerRig.root.position.set(seatPose.x, seatPose.y - 0.22, seatPose.z);
              playerRig.root.rotation.set(seatPose.pitch, seatPose.yaw, seatPose.roll, 'YXZ');
              playerRig.root.visible = cameraModeRef.current === 'third';
              playerRig.bodyGroup.rotation.set(0, 0, 0);
              playerRig.bodyGroup.position.set(0, -0.25, 0);
              playerRig.headGroup.rotation.set(0, 0, 0);
              playerRig.leftLegPivot.rotation.set(-Math.PI / 2 + 0.12, -0.05, 0);
              playerRig.rightLegPivot.rotation.set(-Math.PI / 2 + 0.12, 0.05, 0);
              playerRig.leftArmPivot.rotation.set(-0.75, 0, 0.15);
              playerRig.rightArmPivot.rotation.set(-0.75, 0, -0.15);
            }
          }
        }
      } else {
        const steering = stepPlayerSteering(
          {
            forward: forwardIn,
            turn: turnIn,
            sprint: sprintActive,
          },
          {
            camYaw: ps.camYaw,
            avatarYaw: ps.yaw,
          },
          delta
        );

        ps.camYaw = steering.camYaw;
        ps.yaw = steering.avatarYaw;

        if (steering.isMoving) {
          const tryX = ps.x + steering.moveDirX * steering.walkSpeed * delta;
          const tryZ = ps.z + steering.moveDirZ * steering.walkSpeed * delta;
          let nextPos = clampWorldPosition(tryX, tryZ, curLayout, openDoors, ps.z, ps.x, false);

          // Smoothly glide around central floral vase plinth if walking straight into it indoors
          if (ps.z < curLayout.southWallZ) {
            const nearPedestal = curLayout.pedestals.some(
              (p) => Math.hypot(tryX - p.x, tryZ - p.z) < p.radius + 0.15
            );
            const movedDist = Math.hypot(nextPos.x - ps.x, nextPos.z - ps.z);
            if (nearPedestal && movedDist < steering.walkSpeed * delta * 0.35 && !steering.isTurning) {
              const slideDir = ps.x >= 0 ? 1 : -1;
              nextPos = clampWorldPosition(
                ps.x + slideDir * steering.walkSpeed * 0.9 * delta,
                tryZ,
                curLayout,
                openDoors,
                ps.z,
                ps.x,
                false
              );
            }
          }

          ps.x = nextPos.x;
          ps.z = nextPos.z;
        }

        ps.speed = steering.animSpeed;

        // Update player avatar rig transform & stride animation
        if (playerRig) {
          const groundY = computeOutdoorElevation(ps.x, ps.z, ps.y);
          ps.y = groundY;
          playerRig.root.position.set(ps.x, groundY, ps.z);
          playerRig.root.rotation.y = ps.yaw;
          playerRig.root.visible = cameraModeRef.current === 'third';
          playerRig.headGroup.rotation.set(0, 0, 0);
          playerRig.leftLegPivot.rotation.y = 0;
          playerRig.leftLegPivot.rotation.z = 0;
          playerRig.rightLegPivot.rotation.y = 0;
          playerRig.rightLegPivot.rotation.z = 0;
          playerRig.leftArmPivot.rotation.y = 0;
          playerRig.leftArmPivot.rotation.z = 0;
          playerRig.rightArmPivot.rotation.y = 0;
          playerRig.rightArmPivot.rotation.z = 0;
          animateAvatarRig(playerRig, ps.speed, elapsed, delta);
        }
      }

      // Advance autonomous highway traffic (Rickshaws, Motorbikes, Cars) with lane spacing
      const vehicles = trafficVehiclesRef.current;
      for (let i = 0; i < vehicles.length; i++) {
        const v = vehicles[i];
        if (v.status === 'player_driving') continue;
        if (v.kind === 'speedboat') {
          // Speedboat floats gently at dock pontoon slip with river wave sway
          const rig = outdoor?.vehicleRigs.get(v.id);
          if (rig) {
            const sway = Math.sin(elapsed * 2.0) * 0.03;
            rig.root.position.set(v.x, 0.04 + sway, v.z);
            rig.root.rotation.y = v.yaw;
            rig.root.rotation.z = Math.sin(elapsed * 1.5) * 0.02;
          }
          continue;
        }

        let targetSpeed = v.status === 'stopped_talking' ? 0 : v.cruiseSpeed;
        if (v.status === 'cruising') {
          // Maintain safe gap behind any slower/stopped vehicle in the same lane
          for (let j = 0; j < vehicles.length; j++) {
            if (i === j) continue;
            const other = vehicles[j];
            if (Math.abs(other.z - v.z) > 2.2) continue;
            const aheadDist = (other.x - v.x) * v.dir;
            if (aheadDist > 0 && aheadDist < 9.5) {
              targetSpeed = Math.min(targetSpeed, aheadDist < 5.5 ? 0 : other.currentSpeed * 0.6);
            }
          }
        }

        v.currentSpeed += (targetSpeed - v.currentSpeed) * (1 - Math.exp(-5 * delta));
        v.x += v.dir * v.currentSpeed * delta;
        v.z += (v.laneZ - v.z) * (1 - Math.exp(-3 * delta));
        const desiredYaw = v.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
        v.yaw = normalizeAngle(v.yaw + shortestAngleDelta(v.yaw, desiredYaw) * (1 - Math.exp(-6 * delta)));

        // Autonomous patrol vehicles cruise along designated sector bounds across all roads
        const autoMinX = typeof v.minX === 'number' ? v.minX : -46;
        const autoMaxX = typeof v.maxX === 'number' ? v.maxX : 175;
        if (v.dir === 1 && v.x > autoMaxX) {
          v.x = autoMinX;
        } else if (v.dir === -1 && v.x < autoMinX) {
          v.x = autoMaxX;
        }

        const rig = outdoor?.vehicleRigs.get(v.id);
        if (rig) {
          const elevY = computeOutdoorElevation(v.x, v.z, 0);
          rig.root.position.set(v.x, elevY + 0.02, v.z);
          rig.root.rotation.y = v.yaw;
          const spin = v.currentSpeed * delta * 2.2;
          for (const w of rig.wheels) {
            w.rotation.x += spin;
          }
        }
      }

      // Advance walking footpath pedestrians & any ejected driver waving on the footpath
      if (outdoor) {
        for (const ped of outdoor.pedestrians) {
          ped.x += ped.dir * ped.speed * delta;
          if (ped.x > ped.maxX) {
            ped.x = ped.maxX;
            ped.dir = -1;
          } else if (ped.x < ped.minX) {
            ped.x = ped.minX;
            ped.dir = 1;
          }
          const pedElevY = computeOutdoorElevation(ped.x, ped.sidewalkZ, 0);
          ped.root.position.set(ped.x, pedElevY + 0.14, ped.sidewalkZ);
          ped.root.rotation.y = ped.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
          const stride = Math.sin(elapsed * ped.speed * 3.4 + ped.phase);
          ped.leftLeg.rotation.x = stride * 0.45;
          ped.rightLeg.rotation.x = -stride * 0.45;
          ped.leftArm.rotation.x = -stride * 0.34;
          ped.rightArm.rotation.x = stride * 0.34;
        }

        if (ejectedDriverTimerRef.current > 0) {
          ejectedDriverTimerRef.current = Math.max(0, ejectedDriverTimerRef.current - delta);
          const ed = outdoor.ejectedDriverRig;
          const wave = Math.sin(elapsed * 12);
          ed.leftArm.rotation.x = -2.4 + wave * 0.35;
          ed.rightArm.rotation.x = -2.4 - wave * 0.35;
          ed.root.rotation.y = Math.atan2(ps.x - ed.x, ps.z - ed.z);
          if (ejectedDriverTimerRef.current <= 0) {
            ed.root.visible = false;
          }
        }
      }

      // Animate co-visitors: active online users walk/turn smoothly in real time; offline users stand straight in place.
      // If a companion or another active player is riding a ride or vehicle, position and pose them accurately!
      let companionIdx = 0;
      companionRigsRef.current.forEach((entry) => {
        const compRideId = entry.visitor?.ridingRideId ?? null;
        const compVehId = entry.visitor?.ridingVehicleId ?? null;
        const isManuallyInvited =
          entry.visitor?.uid === ridingCompanionUidRef.current &&
          (Boolean(activeVehicle) || Boolean(activeRideIdRef.current));

        if (!entry.visitor) {
          companionIdx++;
          return;
        }

        if (compRideId) {
          const ride = getAmusementRideById(compRideId);
          if (ride) {
            const isSharingWithHost = activeRideIdRef.current === ride.id;
            if (isSharingWithHost && ridingCompanionUidRef.current !== entry.visitor.uid) {
              ridingCompanionUidRef.current = entry.visitor.uid;
              setRidingCompanionName(entry.visitor.displayName);
            }

            if (ride.kind === 'coaster') {
              const rightX = -Math.cos(coasterPose.yaw);
              const rightZ = Math.sin(coasterPose.yaw);
              const sideOffset = isSharingWithHost ? 0.26 : -0.26;
              entry.rig.root.position.set(
                coasterPose.x + coasterPose.fwdX * 0.36 + rightX * sideOffset,
                coasterPose.y + 0.14 + coasterPose.fwdY * 0.36,
                coasterPose.z + coasterPose.fwdZ * 0.36 + rightZ * sideOffset
              );
              entry.rig.root.rotation.set(coasterPose.rotX, coasterPose.yaw, coasterPose.roll, 'YXZ');
              entry.rig.root.visible = true;

              entry.rig.bodyGroup.position.set(0, -0.28, 0);
              entry.rig.bodyGroup.rotation.set(-0.15, 0, 0);
              entry.rig.headGroup.rotation.set(0.12, 0, 0);
              entry.rig.leftLegPivot.rotation.set(-Math.PI / 2 + 0.08, -0.06, 0);
              entry.rig.rightLegPivot.rotation.set(-Math.PI / 2 + 0.08, 0.06, 0);
              if (boostActive || coasterPose.speed > 16.0) {
                entry.rig.leftArmPivot.rotation.set(-2.4, 0, 0.35);
                entry.rig.rightArmPivot.rotation.set(-2.4, 0, -0.35);
              } else {
                entry.rig.leftArmPivot.rotation.set(-0.95, -0.12, -0.15);
                entry.rig.rightArmPivot.rotation.set(-0.95, 0.12, 0.15);
              }
            } else if (ride.kind === 'waterslide') {
              if (isSharingWithHost) {
                const fwdX = Math.sin(waterSlidePose.yaw);
                const fwdZ = Math.cos(waterSlidePose.yaw);
                entry.rig.root.position.set(
                  waterSlidePose.x - fwdX * 0.75,
                  waterSlidePose.y + 0.12 - waterSlidePose.fwdY * 0.75,
                  waterSlidePose.z - fwdZ * 0.75
                );
              } else {
                entry.rig.root.position.set(
                  waterSlidePose.x,
                  waterSlidePose.y - 0.12,
                  waterSlidePose.z
                );
              }
              entry.rig.root.rotation.set(
                waterSlidePose.rotX ?? 0,
                waterSlidePose.yaw,
                waterSlidePose.roll,
                'YXZ'
              );
              entry.rig.root.visible = true;

              entry.rig.leftLegPivot.rotation.set(-1.42, -0.12, 0);
              entry.rig.rightLegPivot.rotation.set(-1.42, 0.12, 0);
              entry.rig.leftArmPivot.rotation.set(-0.68, 0, 0.28);
              entry.rig.rightArmPivot.rotation.set(-0.68, 0, -0.28);
              entry.rig.bodyGroup.rotation.set(-0.35, 0, 0);
              entry.rig.bodyGroup.position.set(0, -0.26, 0);
              entry.rig.headGroup.rotation.set(0.24, 0, 0);
            } else {
              // Dolna or Chorki
              const pose = isSharingWithHost
                ? computeCompanionRideSeatPosition(ride, elapsed, boostActive)
                : computeRideSeatWorldPosition(ride, elapsed, boostActive);
              entry.rig.root.position.set(pose.x, pose.y - 0.22, pose.z);
              entry.rig.root.rotation.set(pose.pitch, pose.yaw, pose.roll, 'YXZ');
              entry.rig.root.visible = true;
              entry.rig.bodyGroup.position.set(0, -0.25, 0);
              entry.rig.bodyGroup.rotation.set(0, 0, 0);
              entry.rig.headGroup.rotation.set(0, 0, 0);
              entry.rig.leftLegPivot.rotation.set(-Math.PI / 2 + 0.12, -0.05, 0);
              entry.rig.rightLegPivot.rotation.set(-Math.PI / 2 + 0.12, 0.05, 0);
              entry.rig.leftArmPivot.rotation.set(-0.75, 0, 0.15);
              entry.rig.rightArmPivot.rotation.set(-0.75, 0, -0.15);
            }
          }
        } else if (compVehId) {
          const veh = vehicles.find((v) => v.id === compVehId);
          if (veh) {
            const isSharingWithHost = drivingVehicleIdRef.current === veh.id;
            if (isSharingWithHost && ridingCompanionUidRef.current !== entry.visitor.uid) {
              ridingCompanionUidRef.current = entry.visitor.uid;
              setRidingCompanionName(entry.visitor.displayName);
            }
            const vRig = outdoor?.vehicleRigs.get(veh.id);
            if (vRig) {
              let seatLocal = isSharingWithHost
                ? (veh.kind === 'car'
                    ? new THREE.Vector3(-0.36, 0.85, 0.08)
                    : veh.kind === 'rickshaw' && !veh.stolen
                    ? new THREE.Vector3(0.28, 1.08, -0.7)
                    : vRig.passengerSeatLocal)
                : (veh.stolen ? vRig.riderSeatLocal : vRig.passengerSeatLocal);

              const cOffset = new THREE.Vector3().copy(seatLocal).applyAxisAngle(THREE.Object3D.DEFAULT_UP, veh.yaw);
              entry.rig.root.position.set(veh.x + cOffset.x, seatLocal.y - 0.65, veh.z + cOffset.z);
              entry.rig.root.rotation.set(0, veh.yaw, 0);
              entry.rig.root.visible = true;

              entry.rig.bodyGroup.position.set(0, -0.25, 0);
              entry.rig.bodyGroup.rotation.set(0, 0, 0);
              entry.rig.headGroup.rotation.set(0, 0, 0);
              entry.rig.leftLegPivot.rotation.set(-Math.PI / 2 + 0.1, -0.05, 0);
              entry.rig.rightLegPivot.rotation.set(-Math.PI / 2 + 0.1, 0.05, 0);
              if (veh.kind === 'bike') {
                entry.rig.leftArmPivot.rotation.set(-0.62, 0, 0.14);
                entry.rig.rightArmPivot.rotation.set(-0.62, 0, -0.14);
              } else {
                entry.rig.leftArmPivot.rotation.set(-0.72, 0, 0.15);
                entry.rig.rightArmPivot.rotation.set(-0.72, 0, -0.15);
              }
            }
          }
        } else if (isManuallyInvited) {
          if (activeVehicle) {
            const vRig = outdoor?.vehicleRigs.get(activeVehicle.id);
            if (vRig) {
              let compSeatLocal = vRig.passengerSeatLocal;
              if (activeVehicle.kind === 'car') {
                compSeatLocal = new THREE.Vector3(-0.36, 0.85, 0.08);
              } else if (activeVehicle.kind === 'rickshaw' && !activeVehicle.stolen) {
                compSeatLocal = new THREE.Vector3(0.28, 1.08, -0.7);
              }
              const cOffset = new THREE.Vector3().copy(compSeatLocal).applyAxisAngle(THREE.Object3D.DEFAULT_UP, activeVehicle.yaw);
              entry.rig.root.position.set(
                activeVehicle.x + cOffset.x,
                compSeatLocal.y - 0.65,
                activeVehicle.z + cOffset.z
              );
              entry.rig.root.rotation.set(0, activeVehicle.yaw, 0);
              entry.rig.root.visible = true;

              entry.rig.bodyGroup.position.set(0, -0.25, 0);
              entry.rig.bodyGroup.rotation.set(0, 0, 0);
              entry.rig.headGroup.rotation.set(0, 0, 0);
              entry.rig.leftLegPivot.rotation.set(-Math.PI / 2 + 0.1, -0.05, 0);
              entry.rig.rightLegPivot.rotation.set(-Math.PI / 2 + 0.1, 0.05, 0);
              if (activeVehicle.kind === 'bike') {
                entry.rig.leftArmPivot.rotation.set(-0.62, 0, 0.14);
                entry.rig.rightArmPivot.rotation.set(-0.62, 0, -0.14);
              } else {
                entry.rig.leftArmPivot.rotation.set(-0.72, 0, 0.15);
                entry.rig.rightArmPivot.rotation.set(-0.72, 0, -0.15);
              }
            }
          } else if (activeRideIdRef.current === 'ride-east-coaster') {
            const rightX = -Math.cos(coasterPose.yaw);
            const rightZ = Math.sin(coasterPose.yaw);
            entry.rig.root.position.set(
              coasterPose.x + coasterPose.fwdX * 0.36 + rightX * 0.26,
              coasterPose.y + 0.14 + coasterPose.fwdY * 0.36,
              coasterPose.z + coasterPose.fwdZ * 0.36 + rightZ * 0.26
            );
            entry.rig.root.rotation.set(coasterPose.rotX, coasterPose.yaw, coasterPose.roll, 'YXZ');
            entry.rig.root.visible = true;

            entry.rig.bodyGroup.position.set(0, -0.25, 0);
            entry.rig.bodyGroup.rotation.set(0, 0, 0);
            entry.rig.headGroup.rotation.set(0, 0, 0);
            entry.rig.leftLegPivot.rotation.set(-Math.PI / 2 + 0.08, -0.06, 0);
            entry.rig.rightLegPivot.rotation.set(-Math.PI / 2 + 0.08, 0.06, 0);
            if (boostActive || coasterPose.speed > 16.0) {
              entry.rig.leftArmPivot.rotation.set(-2.4, 0, 0.35);
              entry.rig.rightArmPivot.rotation.set(-2.4, 0, -0.35);
            } else {
              entry.rig.leftArmPivot.rotation.set(-0.95, -0.12, -0.15);
              entry.rig.rightArmPivot.rotation.set(-0.95, 0.12, 0.15);
            }
          } else if (activeRideIdRef.current === 'ride-west-waterslide') {
            const fwdX = Math.sin(waterSlidePose.yaw);
            const fwdZ = Math.cos(waterSlidePose.yaw);
            entry.rig.root.position.set(
              waterSlidePose.x - fwdX * 0.75,
              waterSlidePose.y + 0.12 - waterSlidePose.fwdY * 0.75,
              waterSlidePose.z - fwdZ * 0.75
            );
            entry.rig.root.rotation.set(
              waterSlidePose.rotX ?? 0,
              waterSlidePose.yaw,
              waterSlidePose.roll,
              'YXZ'
            );
            entry.rig.root.visible = true;

            entry.rig.leftLegPivot.rotation.set(-1.42, -0.12, 0);
            entry.rig.rightLegPivot.rotation.set(-1.42, 0.12, 0);
            entry.rig.leftArmPivot.rotation.set(-0.68, 0, 0.28);
            entry.rig.rightArmPivot.rotation.set(-0.68, 0, -0.28);
            entry.rig.bodyGroup.rotation.set(-0.35, 0, 0);
            entry.rig.bodyGroup.position.set(0, -0.26, 0);
            entry.rig.headGroup.rotation.set(0.24, 0, 0);
          } else if (activeRideIdRef.current) {
            const ride = getAmusementRideById(activeRideIdRef.current);
            if (ride) {
              const compSeatPose = computeCompanionRideSeatPosition(ride, elapsed, boostActive);
              entry.rig.root.position.set(compSeatPose.x, compSeatPose.y - 0.22, compSeatPose.z);
              entry.rig.root.rotation.set(compSeatPose.pitch, compSeatPose.yaw, compSeatPose.roll, 'YXZ');
              entry.rig.root.visible = true;
              entry.rig.bodyGroup.position.set(0, -0.25, 0);
              entry.rig.bodyGroup.rotation.set(0, 0, 0);
              entry.rig.headGroup.rotation.set(0, 0, 0);
              entry.rig.leftLegPivot.rotation.set(-Math.PI / 2 + 0.12, -0.05, 0);
              entry.rig.rightLegPivot.rotation.set(-Math.PI / 2 + 0.12, 0.05, 0);
              entry.rig.leftArmPivot.rotation.set(-0.75, 0, 0.15);
              entry.rig.rightArmPivot.rotation.set(-0.75, 0, -0.15);
            }
          }
        } else {
          // Standing or walking on foot: cleanly reset avatar body & limb rotations
          if (ridingCompanionUidRef.current === entry.visitor.uid) {
            ridingCompanionUidRef.current = null;
            setRidingCompanionName(null);
          }
          entry.rig.headGroup.rotation.set(0, 0, 0);
          entry.rig.leftLegPivot.rotation.y = 0;
          entry.rig.leftLegPivot.rotation.z = 0;
          entry.rig.rightLegPivot.rotation.y = 0;
          entry.rig.rightLegPivot.rotation.z = 0;
          entry.rig.leftArmPivot.rotation.y = 0;
          entry.rig.leftArmPivot.rotation.z = 0;
          entry.rig.rightArmPivot.rotation.y = 0;
          entry.rig.rightArmPivot.rotation.z = 0;

          if (entry.visitor.isActive) {
            const lerpAlpha = 1 - Math.exp(-8 * delta);
            const dx = entry.targetX - entry.rig.root.position.x;
            const dz = entry.targetZ - entry.rig.root.position.z;
            entry.rig.root.position.x += dx * lerpAlpha;
            entry.rig.root.position.z += dz * lerpAlpha;

            const yawDelta = shortestAngleDelta(entry.rig.root.rotation.y, entry.targetYaw);
            entry.rig.root.rotation.y = normalizeAngle(
              entry.rig.root.rotation.y + yawDelta * lerpAlpha
            );

            const distSpeed = Math.hypot(dx, dz) * 4.2 + Math.abs(yawDelta) * 0.9;
            animateAvatarRig(entry.rig, Math.min(7.5, distSpeed), elapsed + companionIdx, delta);
          } else {
            // Offline / standby member: settle straight at their saved position and stand completely still
            const settleAlpha = 1 - Math.exp(-6 * delta);
            entry.rig.root.position.x += (entry.targetX - entry.rig.root.position.x) * settleAlpha;
            entry.rig.root.position.z += (entry.targetZ - entry.rig.root.position.z) * settleAlpha;
            const yawDelta = shortestAngleDelta(entry.rig.root.rotation.y, entry.targetYaw);
            entry.rig.root.rotation.y = normalizeAngle(
              entry.rig.root.rotation.y + yawDelta * settleAlpha
            );
            animateAvatarRig(entry.rig, 0, elapsed + companionIdx, delta, { standStill: true });
          }
        }
        companionIdx++;
      });

      // Smoothly blend sky & fog between Museum interior gallery palette and warm Outdoor daylight sky
      const isOutdoors = ps.z > curLayout.southWallZ + 0.25;
      _skyTarget.setHex(isOutdoors ? OUTDOOR_SKY_HEX : THEME_FOG_COLOR[wallThemeRef.current]);
      if (scene.background instanceof THREE.Color) {
        scene.background.lerp(_skyTarget, 1 - Math.exp(-4.5 * delta));
        renderer.setClearColor(scene.background, 1);
      }
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.lerp(_skyTarget, 1 - Math.exp(-4.5 * delta));
        const targetDensity = isOutdoors ? 0.0012 : 0.01;
        scene.fog.density += (targetDensity - scene.fog.density) * (1 - Math.exp(-4 * delta));
      }

      // Keep dynamic room lights centered on the player's current & adjacent rooms
      const activeRoomIdx = getRoomIndexAtZ(ps.z, curLayout);
      const activeRoom = curLayout.rooms[activeRoomIdx] ?? curLayout.rooms[0];
      if (roomLights[0]) roomLights[0].position.set(0, 5.4, activeRoom.centerZ + 4.2);
      if (roomLights[1]) roomLights[1].position.set(0, 5.4, activeRoom.centerZ - 4.2);
      const nextRoom = curLayout.rooms[activeRoomIdx + 1] ?? activeRoom;
      const prevRoom = curLayout.rooms[activeRoomIdx - 1] ?? activeRoom;
      if (roomLights[2]) roomLights[2].position.set(0, 5.4, nextRoom.centerZ);
      if (roomLights[3]) roomLights[3].position.set(0, 5.4, prevRoom.centerZ);

      const activeRide = activeRideIdRef.current ? getAmusementRideById(activeRideIdRef.current) : null;
      const rideSeatPose = activeRide ? computeRideSeatWorldPosition(activeRide, elapsed, boostActive) : null;

      // Smooth damped Third-Person or First-Person Camera (clamped indoors, wide scenic follow outdoors/driving/rides)
      const camDamp = 1 - Math.exp(-10 * delta);
      if (activeRideIdRef.current === 'ride-east-coaster') {
        const fwdX = coasterPose.fwdX;
        const fwdY = coasterPose.fwdY;
        const fwdZ = coasterPose.fwdZ;

        if (cameraModeRef.current === 'first') {
          // Immersive front-row cockpit view looking forward along the track!
          const eyeX = coasterPose.x + fwdX * 0.36;
          const eyeY = coasterPose.y + 0.94 + fwdY * 0.36;
          const eyeZ = coasterPose.z + fwdZ * 0.36;
          _camDesired.set(eyeX, eyeY, eyeZ);
          camera.position.copy(_camDesired);

          // Look target is 20 meters AHEAD along the track tangent!
          const lookDist = 20.0;
          _camLook.set(
            eyeX + fwdX * lookDist,
            eyeY + fwdY * lookDist,
            eyeZ + fwdZ * lookDist
          );

          // Bank the camera into curves realistically using track normal & banked up vector
          const hLen = Math.hypot(fwdX, fwdZ) || 1e-5;
          const normH = new THREE.Vector3(-fwdZ / hLen, 0, fwdX / hLen);
          const baseUp = new THREE.Vector3().crossVectors(normH, new THREE.Vector3(fwdX, fwdY, fwdZ)).normalize();

          const cosR = Math.cos(coasterPose.roll);
          const sinR = Math.sin(coasterPose.roll);
          camera.up.set(
            normH.x * -sinR + baseUp.x * cosR,
            normH.y * -sinR + baseUp.y * cosR,
            normH.z * -sinR + baseUp.z * cosR
          ).normalize();

          camera.lookAt(_camLook);
        } else {
          // Cinematic chase camera tracking smoothly behind the coaster train looking forward down the track!
          const chaseDist = 7.2;
          const chaseHeight = 2.6;
          const desiredX = coasterPose.x - fwdX * chaseDist;
          const desiredZ = coasterPose.z - fwdZ * chaseDist;
          const desiredY = coasterPose.y + chaseHeight;
          _camDesired.set(desiredX, desiredY, desiredZ);
          camera.position.lerp(_camDesired, 1 - Math.exp(-14 * delta));

          camera.up.set(0, 1, 0);
          _camLook.set(
            coasterPose.x + fwdX * 4.5,
            coasterPose.y + 0.85 + fwdY * 4.5,
            coasterPose.z + fwdZ * 4.5
          );
          camera.lookAt(_camLook);
        }
      } else if (activeRideIdRef.current === 'ride-west-waterslide') {
        const fwdX = waterSlidePose.fwdX;
        const fwdY = waterSlidePose.fwdY;
        const fwdZ = waterSlidePose.fwdZ;

        if (cameraModeRef.current === 'first') {
          // IMMERSIVE FORWARD SLIDER POV: Look straight down the flume towards the pool!
          const eyeX = waterSlidePose.x;
          const eyeY = waterSlidePose.y + 0.65;
          const eyeZ = waterSlidePose.z;
          _camDesired.set(eyeX, eyeY, eyeZ);
          camera.position.copy(_camDesired);

          const lookDist = 18.0;
          _camLook.set(
            eyeX + fwdX * lookDist,
            eyeY + fwdY * lookDist,
            eyeZ + fwdZ * lookDist
          );

          // Bank camera into the flume curve
          const hLen = Math.hypot(fwdX, fwdZ) || 1e-5;
          const normH = new THREE.Vector3(-fwdZ / hLen, 0, fwdX / hLen);
          const baseUp = new THREE.Vector3().crossVectors(normH, new THREE.Vector3(fwdX, fwdY, fwdZ)).normalize();

          const cosR = Math.cos(waterSlidePose.roll);
          const sinR = Math.sin(waterSlidePose.roll);
          camera.up.set(
            normH.x * -sinR + baseUp.x * cosR,
            normH.y * -sinR + baseUp.y * cosR,
            normH.z * -sinR + baseUp.z * cosR
          ).normalize();

          camera.lookAt(_camLook);
        } else {
          // Cinematic chase camera following behind the slider tube down the flume
          const chaseDist = 4.8;
          const chaseHeight = 2.0;
          const desiredX = waterSlidePose.x - fwdX * chaseDist;
          const desiredZ = waterSlidePose.z - fwdZ * chaseDist;
          const desiredY = waterSlidePose.y + chaseHeight;
          _camDesired.set(desiredX, desiredY, desiredZ);
          camera.position.lerp(_camDesired, 1 - Math.exp(-14 * delta));

          camera.up.set(0, 1, 0);
          _camLook.set(
            waterSlidePose.x + fwdX * 3.5,
            waterSlidePose.y + 0.4 + fwdY * 3.5,
            waterSlidePose.z + fwdZ * 3.5
          );
          camera.lookAt(_camLook);
        }
      } else if (isRidingMetroRef.current) {
        const seated = isSeatedOnMetroRef.current;
        if (cameraModeRef.current === 'first') {
          const eyeY = ps.y + (seated ? 0.95 : 1.62);
          _camDesired.set(ps.x, eyeY, ps.z);
          camera.position.copy(_camDesired);
          camera.up.set(0, 1, 0);
          _camLook.set(
            ps.x - Math.sin(ps.camYaw) * 12,
            eyeY - Math.sin(ps.camPitch) * 4.5,
            ps.z - Math.cos(ps.camYaw) * 12
          );
          camera.lookAt(_camLook);
        } else {
          const chaseDist = seated ? 2.6 : 3.4;
          const desiredX = ps.x + Math.sin(ps.camYaw) * chaseDist;
          const desiredZ = ps.z + Math.cos(ps.camYaw) * chaseDist;
          const desiredY = ps.y + (seated ? 1.3 : 1.7) + Math.sin(ps.camPitch) * 1.2;
          _camDesired.set(desiredX, desiredY, desiredZ);
          camera.position.lerp(_camDesired, 1 - Math.exp(-12 * delta));
          camera.up.set(0, 1, 0);
          _camLook.set(ps.x, ps.y + (seated ? 0.75 : 1.2), ps.z);
          camera.lookAt(_camLook);
        }
      } else if (isRidingGondolaRef.current && ridingGondolaCabinIdRef.current !== null) {
        const cabin = gondolaSysRef.current.cabins[ridingGondolaCabinIdRef.current];
        const cabinX = cabin ? cabin.x : ps.x;
        const cabinY = cabin ? cabin.y : ps.y;
        const cabinZ = cabin ? cabin.z : ps.z;

        if (cameraModeRef.current === 'first') {
          // Inside-cabin panoramic observation view through clear glass panes!
          const eyeY = cabinY + 0.15;
          _camDesired.set(cabinX, eyeY, cabinZ);
          camera.position.copy(_camDesired);
          camera.up.set(0, 1, 0);
          _camLook.set(
            cabinX - Math.sin(ps.camYaw) * 16,
            eyeY - Math.sin(ps.camPitch) * 8,
            cabinZ - Math.cos(ps.camYaw) * 16
          );
          camera.lookAt(_camLook);
        } else {
          // Third-person chase camera right outside the panoramic gondola cabin
          const chaseDist = 4.2;
          const desiredX = cabinX + Math.sin(ps.camYaw) * chaseDist;
          const desiredZ = cabinZ + Math.cos(ps.camYaw) * chaseDist;
          const desiredY = cabinY + 1.6 + Math.sin(ps.camPitch) * 1.5;
          _camDesired.set(desiredX, desiredY, desiredZ);
          camera.position.lerp(_camDesired, 1 - Math.exp(-14 * delta));
          camera.up.set(0, 1, 0);
          _camLook.set(cabinX, cabinY + 0.2, cabinZ);
          camera.lookAt(_camLook);
        }
      } else {
        camera.up.set(0, 1, 0);
        const curGroundY = computeOutdoorElevation(ps.x, ps.z, ps.y);
        if (cameraModeRef.current === 'first') {
          const eyeY = rideSeatPose
            ? rideSeatPose.y + 1.25
            : activeVehicle
              ? 1.75
              : curGroundY + 1.66;
          _camDesired.set(ps.x, eyeY, ps.z);
          camera.position.lerp(_camDesired, camDamp);
          _camLook.set(
            ps.x - Math.sin(ps.camYaw) * 8,
            eyeY - Math.sin(ps.camPitch) * 3.5,
            ps.z - Math.cos(ps.camYaw) * 8
          );
          camera.lookAt(_camLook);
        } else {
          const dist = rideSeatPose
            ? activeRide?.kind === 'chorki'
              ? 7.2
              : 5.6
            : activeVehicle
              ? activeVehicle.kind === 'car'
                ? 6.8
                : 5.2
              : isOutdoors
                ? 4.8
                : 3.8;
          const desiredX = ps.x + Math.sin(ps.camYaw) * dist;
          const desiredZ = ps.z + Math.cos(ps.camYaw) * dist;
          const clampedCam =
            isOutdoors || rideSeatPose
              ? { x: desiredX, z: desiredZ }
              : clampWorldPosition(
                  desiredX,
                  desiredZ,
                  curLayout,
                  openDoors,
                  ps.z,
                  ps.x,
                  false
                );
          const baseY = rideSeatPose
            ? rideSeatPose.y + 2.1
            : activeVehicle
              ? curGroundY + 2.65
              : curGroundY + (isOutdoors ? 2.35 : 2.08);
          const desiredY = baseY + Math.sin(ps.camPitch) * 1.1;
          _camDesired.set(clampedCam.x, desiredY, clampedCam.z);
          camera.position.lerp(_camDesired, camDamp);

          _camLook.set(
            ps.x - Math.sin(ps.camYaw) * 3.2,
            rideSeatPose
              ? rideSeatPose.y + 1.1
              : activeVehicle
                ? curGroundY + 1.55
                : curGroundY + 1.66,
            ps.z - Math.cos(ps.camYaw) * 3.2
          );
          camera.lookAt(_camLook);
        }
      }

      // Throttled HUD room, zone, minimap, door & nearby vehicle indicator (~3.5Hz)
      if (nowMs - lastHudCheck > 280) {
        lastHudCheck = nowMs;
        const curZone = getWorldZone(ps.x, ps.z);
        container.dataset.playerX = ps.x.toFixed(2);
        container.dataset.playerZ = ps.z.toFixed(2);
        container.dataset.playerYaw = ps.yaw.toFixed(3);
        container.dataset.camYaw = ps.camYaw.toFixed(3);
        container.dataset.currentRoom = String(activeRoomIdx);
        container.dataset.zone = curZone.id;
        container.dataset.zoneSymbol = curZone.symbol;
        setCurrentRoomIndex(activeRoomIdx);
        setWorldZone((prev) => (prev.id === curZone.id ? prev : curZone));
        setMinimapSnap({
          x: ps.x,
          z: ps.z,
          yaw: ps.yaw,
          vehicles: vehicles.map((v) => ({
            id: v.id,
            kind: v.kind,
            x: v.x,
            z: v.z,
            status: v.status,
          })),
        });

        if (activeRideIdRef.current === 'ride-east-coaster') {
          setCoasterRideState({
            state: coasterStateRef.current.state,
            speed: coasterStateRef.current.speed,
            countdownSeconds: coasterStateRef.current.countdownSeconds,
          });
        }
        if (activeRideIdRef.current === 'ride-west-waterslide') {
          setWaterSlideRideState({ ...waterSlideStateRef.current });
        }

        const nearRide =
          activeVehicle || activeRideIdRef.current ? null : findNearestAmusementRide(ps.x, ps.z);
        setNearbyRide((prev) => (prev?.id === nearRide?.id ? prev : nearRide));

        const near =
          activeVehicle || activeRideIdRef.current ? null : findNearestAnyDoor(ps.x, ps.z, curLayout);
        setNearbyDoor((prev) => (prev?.id === near?.id ? prev : near));

        const nearVeh =
          activeVehicle || activeRideIdRef.current
            ? null
            : findNearestHailVehicle(ps.x, ps.z, vehicles, 24.0);
        setNearbyVehicle((prev) => {
          if (!nearVeh) return prev ? null : prev;
          if (prev?.id === nearVeh.id) return prev;
          return { id: nearVeh.id, title: nearVeh.title, driverName: nearVeh.driverName };
        });

        const nearMItem =
          activeVehicle || activeRideIdRef.current
            ? null
            : findNearestMarketItem(ps.x, ps.y, ps.z, 3.8);
        setNearbyMarketItem((prev) => (prev?.id === nearMItem?.id ? prev : nearMItem));

        const canBoardMetro =
          !isRidingMetroRef.current &&
          !activeVehicle &&
          !activeRideIdRef.current &&
          isNearMetroTrain(ps.x, ps.y, ps.z, metroPoseRef.current, 8.5);
        setNearbyMetroBoardable(canBoardMetro);
        setMetroTrainState({ ...metroTrainStateRef.current });

        if (
          metroTrainStateRef.current.announcementLine &&
          metroTrainStateRef.current.announcementLine !== lastMetroAnnounceRef.current
        ) {
          lastMetroAnnounceRef.current = metroTrainStateRef.current.announcementLine;
          onNotifyRef.current?.(metroTrainStateRef.current.announcementLine);
        }
      }

      const movedSinceBroadcast =
        Number.isNaN(ps.lastBroadcastX) ||
        Math.hypot(ps.x - ps.lastBroadcastX, ps.z - ps.lastBroadcastZ) > 0.03 ||
        Math.abs(shortestAngleDelta(ps.lastBroadcastYaw || 0, ps.yaw)) > 0.04;
      const sinceBroadcast = nowMs - ps.lastBroadcast;
      if ((movedSinceBroadcast && sinceBroadcast > 260) || sinceBroadcast > 6000) {
        ps.lastBroadcast = nowMs;
        ps.lastBroadcastX = ps.x;
        ps.lastBroadcastZ = ps.z;
        ps.lastBroadcastYaw = ps.yaw;
        onPositionBroadcastRef.current?.(
          ps.x,
          ps.z,
          ps.yaw,
          activeRideIdRef.current ?? null,
          drivingVehicleIdRef.current ?? null
        );
      }

      try {
        renderer.render(scene, camera);
        frameCount++;
        if (frameCount <= 5 || frameCount % 30 === 0) {
          container.dataset.frames = String(frameCount);
        }
      } catch (err) {
        console.error('Museum3DView render error:', err);
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    renderOnceRef.current = () => {
      if (disposed) return;
      try {
        renderer.render(scene, camera);
        frameCount++;
        container.dataset.frames = String(frameCount);
      } catch (err) {
        console.error('Museum3DView renderOnce error:', err);
      }
    };

    resumeLoopRef.current = () => {
      if (disposed || loopActive || isPausedRef.current) return;
      prevTimeMs = performance.now();
      loopActive = true;
      if (isSoftwareGl) {
        renderOnceRef.current?.();
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    if (!isPausedRef.current) {
      loopActive = true;
      if (isSoftwareGl) {
        renderOnceRef.current();
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    const onPageHide = () => {
      const ps = playerStateRef.current;
      onPresenceOfflineRef.current?.(ps.x, ps.z, ps.yaw);
    };
    window.addEventListener('pagehide', onPageHide);

    return () => {
      const ps = playerStateRef.current;
      onPresenceOfflineRef.current?.(ps.x, ps.z, ps.yaw);
      disposed = true;
      resumeLoopRef.current = null;
      renderOnceRef.current = null;
      clearKeysRef.current = null;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearAllKeys);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      builtMuseumRef.current?.dispose();
      builtMuseumRef.current = null;
      builtOutdoorRef.current?.dispose();
      builtOutdoorRef.current = null;
      builtAmusementRef.current?.dispose();
      builtAmusementRef.current = null;
      playerRigRef.current?.dispose();
      playerRigRef.current = null;
      companionRigsRef.current.forEach((c) => c.rig.dispose());
      companionRigsRef.current.clear();
      envTex?.dispose();
      renderer.dispose();
      sceneRef.current = null;
      rendererRef.current = null;
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Pause/clear held keys when overlays or Vehicle Talk modal open; resume & refocus immediately when closed
  useEffect(() => {
    if (isPaused || talkSession || marketSession || ticketModalStationId) {
      clearKeysRef.current?.();
    } else {
      resumeLoopRef.current?.();
      rootContainerRef.current?.focus({ preventScroll: true });
    }
  }, [isPaused, talkSession, marketSession, ticketModalStationId]);

  // Dynamically rebuild multi-room architecture + real-world outdoor garden & highway
  useEffect(() => {
    const scene = sceneRef.current;
    const renderer = rendererRef.current;
    if (!scene || !renderer) return;

    const fogHex = THEME_FOG_COLOR[museum.wallTheme];
    renderer.setClearColor(fogHex, 1);
    scene.background = new THREE.Color(fogHex);
    scene.fog = new THREE.FogExp2(fogHex, 0.01);

    if (builtMuseumRef.current) {
      scene.remove(builtMuseumRef.current.group);
      builtMuseumRef.current.dispose();
    }
    if (builtOutdoorRef.current) {
      scene.remove(builtOutdoorRef.current.group);
      builtOutdoorRef.current.dispose();
    }
    if (builtAmusementRef.current) {
      scene.remove(builtAmusementRef.current.group);
      builtAmusementRef.current.dispose();
    }

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const built = buildMuseumArchitecture(
      layout,
      artworks,
      museum.wallTheme,
      maxAniso,
      museum.roomNames,
      () => renderOnceRef.current?.()
    );

    const outdoor = buildOutdoorWorld(
      layout,
      museum.title,
      trafficVehiclesRef.current,
      maxAniso
    );

    const amusement = buildAmusementParks(maxAniso);

    // Restore already-open door leaf angles seamlessly across rebuilds
    for (const rig of built.doors) {
      if (openDoorIdsRef.current.has(rig.id)) {
        rig.currentAngle = Math.PI * 0.48;
        rig.leftPivot.rotation.y = -rig.currentAngle;
        rig.rightPivot.rotation.y = rig.currentAngle;
      }
    }

    scene.add(built.group);
    scene.add(outdoor.group);
    scene.add(amusement.group);
    builtMuseumRef.current = built;
    builtOutdoorRef.current = outdoor;
    builtAmusementRef.current = amusement;
    interactablesRef.current = [
      ...built.interactables,
      ...outdoor.interactables,
      ...amusement.interactables,
    ];
    doorRigsRef.current = built.doors;

    // Ensure player remains safely inside indoor/outdoor layout bounds
    const clamped = clampWorldPosition(
      playerStateRef.current.x,
      playerStateRef.current.z,
      layout,
      openDoorIdsRef.current,
      playerStateRef.current.z,
      playerStateRef.current.x,
      Boolean(drivingVehicleIdRef.current)
    );
    playerStateRef.current.x = clamped.x;
    playerStateRef.current.z = clamped.z;
    renderOnceRef.current?.();
  }, [layout, artworks, museum.wallTheme, museum.roomNames, museum.title]);

  // Rebuild player 3D avatar when user's avatar configuration or exclusive GLB changes
  useEffect(() => {
    const slot = playerSlotRef.current;
    if (!slot) return;
    let cancelled = false;

    const mountRig = (rig: AvatarRig) => {
      if (cancelled) {
        rig.dispose();
        return;
      }
      if (playerRigRef.current) {
        slot.remove(playerRigRef.current.root);
        playerRigRef.current.dispose();
      }
      rig.root.position.set(playerStateRef.current.x, 0, playerStateRef.current.z);
      rig.root.rotation.y = playerStateRef.current.yaw;
      slot.add(rig.root);
      playerRigRef.current = rig;
      renderOnceRef.current?.();
    };

    if (customGlbBuffer) {
      void buildCustomGlbAvatarRig(customGlbBuffer, avatar, {
        showNameplate: true,
        showContactShadow: true,
      })
        .then(mountRig)
        .catch(() => {
          mountRig(buildAvatarRig(avatar, { showNameplate: true, showContactShadow: true }));
        });
    } else {
      mountRig(buildAvatarRig(avatar, { showNameplate: true, showContactShadow: true }));
    }

    return () => {
      cancelled = true;
    };
  }, [avatar, customGlbBuffer]);

  // Sync live active & offline standing 3D avatars in the museum
  useEffect(() => {
    const slot = companionsSlotRef.current;
    if (!slot) return;

    const activeIds = new Set(companionVisitors.map((v) => v.uid));
    companionRigsRef.current.forEach((entry, uid) => {
      if (!activeIds.has(uid)) {
        slot.remove(entry.rig.root);
        entry.rig.dispose();
        companionRigsRef.current.delete(uid);
      }
    });

    for (const v of companionVisitors) {
      const visualSignature = getCompanionVisualSignature(v);
      const existing = companionRigsRef.current.get(v.uid);
      if (existing && existing.visualSignature === visualSignature) {
        existing.targetX = v.x;
        existing.targetZ = v.z;
        existing.targetYaw = v.yaw;
        existing.visitor = v;
      } else {
        const startX = existing ? existing.rig.root.position.x : v.x;
        const startZ = existing ? existing.rig.root.position.z : v.z;
        const startYaw = existing ? existing.rig.root.rotation.y : v.yaw;
        if (existing) {
          slot.remove(existing.rig.root);
          existing.rig.dispose();
        }
        const rig = buildAvatarRig(
          {
            displayName: v.displayName,
            gender: v.gender,
            skinTone: v.skinTone,
            hairStyle: v.hairStyle,
            hairColor: v.hairColor,
            outfitStyle: v.outfitStyle,
            outfitColor: v.outfitColor,
            accentColor: v.accentColor,
            accessory: v.accessory,
          },
          {
            showNameplate: true,
            showContactShadow: true,
            nameplateSubtitle: v.isActive ? 'Active · Live' : 'Standing · Offline',
            statusTone: v.isActive ? 'active' : 'standing',
          }
        );
        rig.root.position.set(startX, 0, startZ);
        rig.root.rotation.y = startYaw;
        slot.add(rig.root);
        companionRigsRef.current.set(v.uid, {
          rig,
          visitor: v,
          visualSignature,
          targetX: v.x,
          targetZ: v.z,
          targetYaw: v.yaw,
        });
      }
    }
    renderOnceRef.current?.();
  }, [companionVisitors]);

  // Teleport avatar cleanly in front of an artwork selected from the Catalog (and auto-open doors to its room)
  useEffect(() => {
    if (!teleportTargetId) return;
    const idx = artworks.findIndex((a) => a.id === teleportTargetId);
    if (idx >= 0) {
      const placement = getArtworkPlacement(idx);
      if (placement.roomIndex > 0) {
        const nextOpen = new Set(openDoorIdsRef.current);
        for (let r = 0; r < placement.roomIndex; r++) {
          nextOpen.add(getDoorId(r, r + 1));
        }
        openDoorIdsRef.current = nextOpen;
        setOpenDoorList(Array.from(nextOpen));
      }

      playerStateRef.current.x = placement.standPoint.x;
      playerStateRef.current.z = placement.standPoint.z;
      const lookYaw =
        placement.wallSide === 'west'
          ? Math.PI / 2
          : placement.wallSide === 'east'
            ? -Math.PI / 2
            : placement.wallSide === 'south'
              ? Math.PI
              : 0;
      playerStateRef.current.camYaw = lookYaw;
      playerStateRef.current.yaw =
        placement.wallSide === 'west'
          ? -Math.PI / 2
          : placement.wallSide === 'east'
            ? Math.PI / 2
            : placement.wallSide === 'south'
              ? 0
              : Math.PI;
    }
    onClearTeleport();
  }, [teleportTargetId, artworks, onClearTeleport]);

  const cycleTheme = () => {
    const order: WallTheme[] = ['alabaster', 'travertine', 'charcoal'];
    const next = order[(order.indexOf(museum.wallTheme) + 1) % order.length];
    onChangeWallTheme(next);
  };

  const setVirtualKey = (dir: string, active: boolean) => {
    virtualKeysRef.current[dir] = active;
  };

  const nearbyDoorIsOpen = nearbyDoor ? openDoorList.includes(nearbyDoor.id) : false;
  const isNearbyExitDoor = nearbyDoor?.id === EXIT_DOOR_ID;
  const nearbyDoorTargetRoomIndex = nearbyDoor
    ? currentRoomIndex === nearbyDoor.fromRoomIndex
      ? nearbyDoor.toRoomIndex
      : nearbyDoor.fromRoomIndex
    : 0;
  const nearbyDoorTargetName = nearbyDoor
    ? isNearbyExitDoor
      ? worldZone.id === 'museum'
        ? 'Outdoor Garden & Highway'
        : getResolvedRoomName(0, museum.roomNames)
      : getResolvedRoomName(nearbyDoorTargetRoomIndex, museum.roomNames)
    : '';

  return (
    <div
      ref={rootContainerRef}
      tabIndex={0}
      className="relative w-screen h-screen overflow-hidden bg-[#1C1917] select-none outline-none touch-none"
      data-testid="museum-3d-view"
      data-rooms={layout.roomCount}
      data-current-room={currentRoomIndex}
      data-zone={worldZone.id}
      data-zone-symbol={worldZone.symbol}
      data-driving={drivingVehicleInfo?.id ?? ''}
      data-open-doors={openDoorList.join(',')}
      data-artworks={artworks.length}
      data-visitors={companionVisitors.length + 1}
    >
      {/* Dedicated WebGL Mount Container */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Minimal Top-Left Museum & Active Location Placard */}
      <div className="absolute top-2.5 left-2.5 sm:top-4 sm:left-4 z-10 pointer-events-auto bg-[#181512]/92 text-[#F7F5F0] px-2.5 py-2 sm:px-4 sm:py-2.5 border border-stone-700/80 max-w-[calc(100vw-9.75rem)] sm:max-w-[min(450px,calc(100vw-16rem))]">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="font-editorial text-sm sm:text-lg font-semibold leading-tight truncate">
                {worldZone.id === 'museum'
                  ? `Room ${currentRoom.romanNumeral} · ${currentRoomName}`
                  : `${worldZone.symbol} · ${worldZone.label}`}
              </h1>
              {worldZone.id === 'museum' && canRenameRooms && (
                <button
                  type="button"
                  onClick={() => onRequestRenameRoom(currentRoom.index)}
                  aria-label={`Rename Room ${currentRoom.romanNumeral}`}
                  title="Rename this room signboard"
                  className="p-0.5 sm:p-1 text-stone-400 hover:text-[#E8CFA6] transition-colors cursor-pointer shrink-0"
                >
                  <Pencil className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </button>
              )}
            </div>
            <p className="text-[10px] sm:text-xs text-stone-300 font-mono tabular-nums mt-0.5 truncate">
              {artworks.length}/{layout.totalWallSlots} Walls · {activeCompanionCount + 1} Active
              {companionVisitors.length > activeCompanionCount
                ? ` · ${companionVisitors.length - activeCompanionCount} Standing`
                : ''}
            </p>
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleTeleportToAmusementPark}
              aria-label="Teleport in front of Amusement Park"
              title="Jump right in front of the Amusement Park entrance arch"
              className="inline-flex items-center gap-1 sm:gap-1.5 px-3 py-1 sm:px-3.5 sm:py-1.5 bg-gradient-to-r from-rose-600 via-amber-600 to-sky-600 hover:from-rose-500 hover:via-amber-500 hover:to-sky-500 text-white text-[11px] sm:text-xs font-bold border border-amber-300/80 shadow-md transition-all active:scale-95 cursor-pointer whitespace-nowrap animate-pulse hover:animate-none"
            >
              <span className="text-sm">🎡</span>
              <span>Amusement Park</span>
            </button>
            {worldZone.id !== 'museum' && (
              <button
                type="button"
                onClick={handleTeleportToMuseum}
                aria-label="Return to Museum Gallery"
                title="Return inside Museum Room 1"
                className="inline-flex items-center gap-1 px-2 py-1 sm:py-1.5 bg-[#8A5A2B] hover:bg-[#A6723B] text-white text-[11px] sm:text-xs font-medium border border-[#D4B282] transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>🏛️</span>
                <span>Gallery</span>
              </button>
            )}
            <button
              type="button"
              onClick={onReturnHome}
              aria-label="Return to Avatar Studio"
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 bg-stone-800 hover:bg-stone-700 text-[11px] sm:text-xs font-medium text-stone-100 border border-stone-600 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Home className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline">Studio</span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Side Minimap with Museum, CTG & COXS Symbols (compact on mobile) */}
      <WorldMinimap
        playerX={minimapSnap.x}
        playerZ={minimapSnap.z}
        playerYaw={minimapSnap.yaw}
        zone={worldZone}
        vehicles={minimapSnap.vehicles}
        walletBdt={walletBdt}
        hasCrossHall={layout.rooms.some((r) => r.isCrossHall)}
        drivingLabel={
          drivingVehicleInfo
            ? `${drivingVehicleInfo.stolen ? 'Chintai · ' : ''}${drivingVehicleInfo.title}`
            : null
        }
        metroTrainPos={metroPoseRef.current}
        onTeleport={(targetX, targetZ, label) => {
          if (isRidingMetroRef.current) exitMetroRef.current();
          if (activeRideIdRef.current) exitRideRef.current();
          if (drivingVehicleIdRef.current) exitVehicleRef.current();
          if (isRidingGondolaRef.current) exitGondolaRef.current();
          if (targetZ > layout.southWallZ || targetX <= -430) {
            setOpenDoorList((prev) => {
              const next = new Set(prev);
              next.add(EXIT_DOOR_ID);
              openDoorIdsRef.current = next;
              return Array.from(next);
            });
          }
          const ps = playerStateRef.current;
          ps.x = targetX;
          ps.z = targetZ;
          ps.y = computeOutdoorElevation(targetX, targetZ, 0);
          ps.yaw = targetX <= -430 ? -Math.PI / 2 : 0;
          ps.camYaw = targetX <= -430 ? -Math.PI / 2 : 0;
          ps.speed = 0;
          setMinimapSnap((prev) => ({ ...prev, x: targetX, z: targetZ, yaw: ps.yaw }));
          onNotifyRef.current?.(`Teleported to ${label}`);
        }}
      />

      {/* Active Amusement Park Ride Banner (Dolna / Chorki / Roller Coaster) */}
      {activeRideInfo && (
        <div
          className={`bg-[#181512]/95 text-[#F7F5F0] border border-rose-500 shadow-2xl flex items-center gap-2 sm:gap-3 ${PROMPT_HUD_POSITION}`}
          data-testid="ride-banner"
        >
          <Sparkles className="w-4 h-4 text-rose-300 shrink-0" />
          <span className="text-xs whitespace-nowrap max-md:whitespace-normal max-md:line-clamp-2">
            {activeRideInfo.id === 'ride-east-coaster' ? (
              coasterRideState.state === 'countdown' ? (
                <>
                  Launching in{' '}
                  <strong className="text-amber-300 font-mono text-sm">
                    {Math.max(1, Math.ceil(coasterRideState.countdownSeconds))}s
                  </strong>
                  ... Hold tight!
                </>
              ) : coasterRideState.state === 'docked_boarded' ? (
                <>
                  Roller Coaster docked at station · Press{' '}
                  <kbd className="px-1.5 py-0.5 bg-stone-800 border border-stone-600 font-mono text-rose-300">
                    F
                  </kbd>{' '}
                  to Get Off
                </>
              ) : (
                <>
                  Riding <strong className="text-rose-300">{activeRideInfo.title}</strong> · Speed:{' '}
                  <strong className="text-amber-300 font-mono">
                    {Math.round(coasterRideState.speed * 3.6)} km/h
                  </strong>{' '}
                  · [Shift] Turbo · [F] Get Off
                </>
              )
            ) : activeRideInfo.id === 'ride-west-waterslide' ? (
              <>
                Sliding down <strong className="text-cyan-300">{activeRideInfo.title}</strong> · Speed:{' '}
                <strong className="text-amber-300 font-mono">
                  {Math.round(waterSlideRideState.speed * 3.6)} km/h
                </strong>{' '}
                {waterSlideRideState.state === 'splashdown' && (
                  <span className="text-cyan-200 font-bold animate-pulse">💦 SPLASH!!</span>
                )}
                {waterSlideRideState.state === 'pool_float' && (
                  <span className="text-emerald-300 font-bold">🏊 Floating in Pool</span>
                )}
                {' '}· [F] Exit to Deck
              </>
            ) : (
              <>
                Riding <strong className="text-rose-300">{activeRideInfo.title}</strong> · W / Shift Speed Boost · F / E Get Off
              </>
            )}
            {ridingCompanionName && (
              <span className="ml-2 px-1.5 py-0.5 bg-rose-950/90 border border-rose-400 text-rose-200 rounded text-[11px] font-semibold">
                👥 With {ridingCompanionName}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={toggleCompanionRide}
            className="px-2 py-0.5 bg-stone-800 hover:bg-stone-700 text-[11px] text-rose-200 border border-rose-500/40 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {ridingCompanionName ? 'Dismiss [J]' : 'Invite Companion [J]'}
          </button>
          <button
            type="button"
            onClick={exitCurrentRide}
            className="px-2.5 py-1 bg-rose-700 hover:bg-rose-600 text-white text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-md"
          >
            Get Off [F]
          </button>
        </div>
      )}

      {/* Active Driving Banner (with Dismount Button) */}
      {!activeRideInfo && drivingVehicleInfo && (
        <div
          className={`bg-[#181512]/95 text-[#F7F5F0] border border-[#C99A5B] shadow-2xl flex items-center gap-2 sm:gap-3 ${PROMPT_HUD_POSITION}`}
          data-testid="driving-banner"
        >
          <Car className="w-4 h-4 text-[#E8CFA6] shrink-0" />
          <span className="text-xs whitespace-nowrap max-md:whitespace-normal max-md:line-clamp-2">
            Driving <strong className="text-[#E8CFA6]">{drivingVehicleInfo.title}</strong>
            {drivingVehicleInfo.stolen ? ' (Chintai)' : ''} · W/S Gas · A/D Steer · Shift Boost
            {ridingCompanionName && (
              <span className="ml-2 px-1.5 py-0.5 bg-amber-950/90 border border-amber-400 text-amber-200 rounded text-[11px] font-semibold">
                👥 With {ridingCompanionName}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={toggleCompanionRide}
            className="px-2 py-0.5 bg-stone-800 hover:bg-stone-700 text-[11px] text-[#E8CFA6] border border-[#C99A5B]/40 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {ridingCompanionName ? 'Dismiss [J]' : 'Invite Companion [J]'}
          </button>
          <button
            type="button"
            onClick={exitCurrentVehicle}
            className="px-2.5 py-1 bg-[#8A5A2B] hover:bg-[#9E6833] text-white text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-md"
          >
            Get Off [F]
          </button>
        </div>
      )}

      {/* Nearby Amusement Park Ride (Dolna / Chorki) Prompt */}
      {!drivingVehicleInfo && !activeRideInfo && nearbyRide && (
        <div
          className={`bg-[#181512]/95 text-[#F7F5F0] border border-rose-500/80 shadow-2xl flex items-center gap-2 sm:gap-3 ${PROMPT_HUD_POSITION}`}
          data-testid="amusement-ride-prompt"
        >
          <Sparkles className="w-4 h-4 text-rose-300 shrink-0" />
          {(() => {
            const existingRider = companionVisitors.find(
              (cv) => cv.ridingRideId === nearbyRide.id
            );
            return (
              <>
                <span className="text-xs whitespace-nowrap max-md:whitespace-normal max-md:line-clamp-2">
                  Press <kbd className="px-1.5 py-0.5 bg-stone-800 border border-stone-600 font-mono text-rose-300">E</kbd> to ride{' '}
                  <strong className="text-rose-200">{nearbyRide.title}</strong>
                  {existingRider ? (
                    <span className="ml-1 text-amber-300 font-bold">
                      (Join with {existingRider.displayName})
                    </span>
                  ) : (
                    ` — ${nearbyRide.banglishHint}`
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => mountAmusementRide(nearbyRide.id)}
                  className="px-2.5 py-1 bg-rose-700 hover:bg-rose-600 text-white text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-md"
                >
                  {existingRider ? `Join ${existingRider.displayName} [E]` : 'Ride [E]'}
                </button>
              </>
            );
          })()}
        </div>
      )}

      {/* Nearby Passing Vehicle Stop & Talk Prompt */}
      {!drivingVehicleInfo && !activeRideInfo && !nearbyRide && nearbyVehicle && !talkSession && (
        <div
          className={`bg-[#181512]/95 text-[#F7F5F0] border border-emerald-500/80 shadow-2xl flex items-center gap-2 sm:gap-3 ${PROMPT_HUD_POSITION}`}
          data-testid="vehicle-hail-prompt"
        >
          <MessageSquare className="w-4 h-4 text-emerald-300 shrink-0" />
          <span className="text-xs whitespace-nowrap max-md:whitespace-normal max-md:line-clamp-2">
            Press <kbd className="px-1.5 py-0.5 bg-stone-800 border border-stone-600 font-mono text-emerald-300">E</kbd> to stop{' '}
            <strong className="text-emerald-200">{nearbyVehicle.title}</strong> ({nearbyVehicle.driverName}) — Talk / Vara / Chintai
          </span>
          <button
            type="button"
            onClick={() => stopAndTalkToVehicle(nearbyVehicle.id)}
            className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-md"
          >
            Stop &amp; Talk [E]
          </button>
        </div>
      )}

      {/* Nearby Grand Market Shop Stall Prompt */}
      {!drivingVehicleInfo && !activeRideInfo && !nearbyRide && nearbyMarketItem && !marketSession && (
        <div
          className={`bg-[#181512]/95 text-[#F7F5F0] border-2 border-[#EAB308] shadow-2xl flex items-center gap-2 sm:gap-3 ${PROMPT_HUD_POSITION}`}
          data-testid="market-shop-prompt"
        >
          <span className="text-xl shrink-0">{nearbyMarketItem.icon}</span>
          <span className="text-xs whitespace-nowrap max-md:whitespace-normal max-md:line-clamp-2">
            <kbd className="px-1.5 py-0.5 bg-stone-800 border border-stone-600 font-mono text-amber-300">E</kbd> কি চাপুন{' '}
            <strong className="text-amber-200">{nearbyMarketItem.stallName}</strong>-এ {nearbyMarketItem.banglaName} কেনাকাটা ও দরদাম করতে
          </span>
          <button
            type="button"
            onClick={() => setMarketSession(createMarketSession(nearbyMarketItem))}
            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-md"
          >
            দোকানে ঢুকুন [E]
          </button>
        </div>
      )}

      {/* Metro Riding HUD */}
      {isRidingMetro && (
        <div
          className="absolute top-20 left-1/2 -translate-x-1/2 z-20 bg-emerald-950/92 text-emerald-100 border-2 border-emerald-400 px-5 py-2.5 rounded-sm shadow-2xl flex items-center gap-4 backdrop-blur-sm pointer-events-auto"
          data-testid="metro-riding-hud"
        >
          <div className="flex items-center gap-2 font-bold text-emerald-300">
            <span className="text-xl">🚇</span>
            <span>চট্টগ্রাম-কক্সবাজার এক্সপ্রেস</span>
          </div>
          <div className="text-xs font-mono text-emerald-200 border-l border-emerald-600/60 pl-3">
            গতি: <strong>{Math.round(metroTrainState.speed * 3.6)} km/h</strong> · পরবর্তী গন্তব্য:{' '}
            <strong className="text-amber-300">
              {metroTrainState.nextStationId === 'station-museum'
                ? 'মিউজিয়াম গ্যালারি সেন্ট্রাল'
                : metroTrainState.nextStationId === 'station-coxs'
                  ? 'কক্সবাজার সী-বিচ সেন্ট্রাল'
                  : 'চট্টগ্রাম গ্র্যান্ড মার্কেট ও জিরো পয়েন্ট'}
            </strong>
            <span className="ml-2 text-emerald-300 font-sans">
              [{isSeatedOnMetro ? '💺 সিটে বসে বাইরে দেখছেন' : '🚶 কোচে হাঁটছেন'}]
            </span>
          </div>
          {isSeatedOnMetro ? (
            <button
              type="button"
              onClick={standUpFromMetroSeat}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs rounded-sm cursor-pointer active:scale-95 transition-all shadow-md"
            >
              উঠে দাঁড়ান [C / Space]
            </button>
          ) : nearbyMetroSeat ? (
            <button
              type="button"
              onClick={() => sitOnMetroSeat(nearbyMetroSeat)}
              className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-sm cursor-pointer active:scale-95 transition-all shadow-md animate-pulse"
            >
              {nearbyMetroSeat.label} এ বসুন [C]
            </button>
          ) : null}
          <button
            type="button"
            onClick={exitMetroTrain}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-sm cursor-pointer active:scale-95 transition-all shadow-md"
          >
            স্টেশনে নামুন [F / Esc]
          </button>
        </div>
      )}

      {/* Nearby Metro Train Boarding Prompt */}
      {!drivingVehicleInfo && !activeRideInfo && !isRidingMetro && nearbyMetroBoardable && (
        <div
          className={`bg-emerald-950/95 text-emerald-100 border-2 border-emerald-400 shadow-2xl flex items-center gap-2 sm:gap-3 animate-pulse pointer-events-auto ${PROMPT_HUD_POSITION}`}
          data-testid="metro-board-prompt"
        >
          <span className="text-xl shrink-0">🚇</span>
          <span className="text-xs whitespace-nowrap max-md:whitespace-normal max-md:line-clamp-2">
            <kbd className="px-1.5 py-0.5 bg-stone-900 border border-emerald-400 font-mono text-emerald-300 font-bold">E</kbd> কি চাপুন{' '}
            <strong className="text-emerald-300">মেট্রোরেলে চড়ে বসতে</strong> (Chittagong &harr; Museum &harr; Cox&apos;s Bazar)
          </span>
          <button
            type="button"
            onClick={mountMetroTrain}
            className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs rounded-sm cursor-pointer active:scale-95 transition-all shadow-md shrink-0 whitespace-nowrap"
          >
            ট্রেনে উঠুন [E]
          </button>
        </div>
      )}

      {/* Active Mountain Gondola Cable Car Ride Banner */}
      {isRidingGondola && (
        <div
          className={`bg-emerald-950/95 text-emerald-100 border-2 border-emerald-400 shadow-2xl flex items-center gap-2.5 sm:gap-3.5 animate-pulse pointer-events-auto rounded ${PROMPT_HUD_POSITION}`}
          data-testid="gondola-ride-banner"
        >
          <span className="text-xl shrink-0">🚡</span>
          <div className="flex flex-col text-left max-md:max-w-[150px]">
            <span className="text-xs font-bold text-amber-300 truncate">
              গুলমার্গ গন্ডোলা কেবল কার (Apharwat Peak)
            </span>
            <span className="text-[11px] text-emerald-200 truncate">
              ৩৬০° প্যানোরামিক তুষার ভিউ
            </span>
          </div>
          <button
            type="button"
            onClick={() => setCameraMode((prev) => (prev === 'first' ? 'third' : 'first'))}
            className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-sm cursor-pointer active:scale-95 transition-all shadow whitespace-nowrap shrink-0"
          >
            {cameraMode === 'first' ? '👁️ 3rd Person' : '👁️ 1st Person'} [C]
          </button>
          <button
            type="button"
            onClick={exitGondolaCabin}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-sm cursor-pointer active:scale-95 transition-all shadow-md whitespace-nowrap shrink-0"
          >
            নামুন [E]
          </button>
        </div>
      )}

      {/* Nearby Gondola Ticket Counter Prompt */}
      {!drivingVehicleInfo && !activeRideInfo && !isRidingMetro && !isRidingGondola && nearbyGondolaCounter && (
        <div
          className={`bg-sky-950/95 text-sky-100 border-2 border-sky-400 shadow-2xl flex items-center gap-2 sm:gap-3 animate-pulse pointer-events-auto rounded ${PROMPT_HUD_POSITION}`}
          data-testid="gondola-counter-prompt"
        >
          <span className="text-xl shrink-0">🎫</span>
          <span className="text-xs whitespace-nowrap max-md:whitespace-normal max-md:line-clamp-2">
            <kbd className="px-1.5 py-0.5 bg-stone-900 border border-sky-400 font-mono text-sky-300 font-bold">E</kbd> কি চাপুন{' '}
            <strong className="text-sky-300">গুলমার্গ গন্ডোলা টিকেট কাউন্টারে</strong> (১০০৳ / ফ্রি রাইড)
          </span>
          <button
            type="button"
            onClick={buyGondolaTicket}
            className="px-3 py-1 bg-sky-500 hover:bg-sky-400 text-stone-950 font-bold text-xs rounded-sm cursor-pointer active:scale-95 transition-all shadow-md shrink-0 whitespace-nowrap"
          >
            টিকেট কাটুন [E]
          </button>
        </div>
      )}

      {/* Nearby Vehicle Board / Drive Prompt */}
      {!drivingVehicleInfo && !activeRideInfo && !isRidingMetro && !isRidingGondola && nearbyVehicle && (
        <div
          className={`bg-amber-950/95 text-amber-100 border-2 border-amber-400 shadow-2xl flex items-center gap-2 sm:gap-3 animate-pulse pointer-events-auto ${PROMPT_HUD_POSITION}`}
          data-testid="vehicle-board-prompt"
        >
          <span className="text-xl shrink-0">🚗</span>
          <span className="text-xs whitespace-nowrap max-md:whitespace-normal max-md:line-clamp-2">
            <kbd className="px-1.5 py-0.5 bg-stone-900 border border-amber-400 font-mono text-amber-300 font-bold">E</kbd> ভাড়া दरদাম /{' '}
            <kbd className="px-1.5 py-0.5 bg-stone-900 border border-amber-400 font-mono text-amber-300 font-bold">T</kbd> কি চাপুন{' '}
            <strong className="text-amber-300">{nearbyVehicle.title}-এ উঠতে</strong>
          </span>
          <button
            type="button"
            onClick={() => boardOrDriveNearbyVehicle(nearbyVehicle.id)}
            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs rounded-sm cursor-pointer shadow active:scale-95 transition-all shrink-0 whitespace-nowrap"
          >
            গাড়ি চালান [T]
          </button>
        </div>
      )}

      {/* Nearby Gondola Boarding Prompt */}
      {!drivingVehicleInfo && !activeRideInfo && !isRidingMetro && !isRidingGondola && nearbyGondolaBoardable && (
        <div
          className={`bg-emerald-950/95 text-emerald-100 border-2 border-emerald-400 shadow-2xl flex items-center gap-2 sm:gap-3 animate-pulse pointer-events-auto ${PROMPT_HUD_POSITION}`}
          data-testid="gondola-board-prompt"
        >
          <span className="text-xl shrink-0">🚡</span>
          <span className="text-xs whitespace-nowrap max-md:whitespace-normal max-md:line-clamp-2">
            <kbd className="px-1.5 py-0.5 bg-stone-900 border border-emerald-400 font-mono text-emerald-300 font-bold">E</kbd> কি চাপুন{' '}
            <strong className="text-emerald-300">গন্ডোলা ক্যাবল কারে উঠতে</strong> (Valley Base &harr; Apharwat Peak)
          </span>
          <button
            type="button"
            onClick={() => {
              const bCabin = findBoardableGondola({ x: playerStateRef.current.x, y: playerStateRef.current.y, z: playerStateRef.current.z }, gondolaSysRef.current.cabins);
              if (bCabin) mountGondolaCabin(bCabin.cabinId);
            }}
            className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs rounded-sm cursor-pointer active:scale-95 transition-all shadow-md shrink-0 whitespace-nowrap"
          >
            গন্ডোলায় উঠুন [E]
          </button>
        </div>
      )}

      {/* Kashmir Snow World Interactive Action Bar */}
      {isInKashmirZone && !isRidingGondola && !isRidingMetro && !drivingVehicleInfo && (
        <div
          className="absolute top-20 left-4 z-20 bg-stone-950/90 text-cyan-100 border border-cyan-400/70 px-3.5 py-2.5 shadow-2xl backdrop-blur-md flex flex-wrap items-center gap-2.5 pointer-events-auto"
          data-testid="kashmir-action-bar"
        >
          <div className="flex items-center gap-1.5 font-bold text-xs text-cyan-300 border-r border-cyan-700/60 pr-2">
            <span>❄️ কাশ্মীর তুষার উপত্যকা</span>
          </div>

          {/* Snowball Throw Button */}
          <button
            type="button"
            onClick={throwSnowballAction}
            className="px-2.5 py-1 bg-cyan-700 hover:bg-cyan-600 text-white font-bold text-xs rounded flex items-center gap-1 cursor-pointer shadow active:scale-95 transition-all"
            title="বরফের গোলা ছুঁড়ুন [Q]"
          >
            <span>❄️ বরফের গোলা ({snowballCount}) [Q]</span>
          </button>

          {/* Snowman Builder Button */}
          <button
            type="button"
            onClick={() => setIsSnowmanModalOpen(true)}
            className="px-2.5 py-1 bg-blue-700 hover:bg-blue-600 text-white font-bold text-xs rounded flex items-center gap-1 cursor-pointer shadow active:scale-95 transition-all"
            title="স্নোম্যান তৈরি করুন [R]"
          >
            <span>☃️ স্নোম্যান বানান [R]</span>
          </button>

          {/* Ski / Skate Mode Toggle Button */}
          <button
            type="button"
            onClick={toggleWinterMode}
            className={`px-2.5 py-1 font-bold text-xs rounded flex items-center gap-1 cursor-pointer shadow active:scale-95 transition-all ${
              winterMode === 'ski'
                ? 'bg-amber-600 hover:bg-amber-500 text-white ring-2 ring-amber-300'
                : winterMode === 'skate'
                  ? 'bg-sky-600 hover:bg-sky-500 text-white ring-2 ring-sky-300'
                  : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
            }`}
            title="স্কি / স্কেটিং মোড [K]"
          >
            <span>
              {winterMode === 'ski'
                ? '🎿 স্কি মোড (Skiing)'
                : winterMode === 'skate'
                  ? '⛸️ স্কেটিং মোড (Skating)'
                  : '🚶 হাঁটা মোড (Walking)'}{' '}
              [K]
            </span>
          </button>

          {/* Mountain 4x4 Jeep / Vehicle Drive Button */}
          <button
            type="button"
            onClick={() => boardOrDriveNearbyVehicle()}
            className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded flex items-center gap-1 cursor-pointer shadow active:scale-95 transition-all"
            title="মাউন্টেন জিপ / গাড়িতে উঠুন [T]"
          >
            <span>🚙</span>
            <span>জিপ / গাড়ি চালান [T]</span>
          </button>

          {/* Gondola Cable Car Platform & Ticket Counter Button */}
          <button
            type="button"
            onClick={() => {
              const bCabin = findBoardableGondola({ x: playerStateRef.current.x, y: playerStateRef.current.y, z: playerStateRef.current.z }, gondolaSysRef.current.cabins);
              if (bCabin) {
                mountGondolaCabin(bCabin.cabinId);
              } else {
                const ps = playerStateRef.current;
                ps.x = -665.0;
                ps.y = 4.8;
                ps.z = 127.0;
                ps.yaw = Math.PI;
                ps.camYaw = Math.PI;
                onNotifyRef.current?.('🚡 গুলমার্গ গন্ডোলা কেবল কার টার্মিনাল বোর্ডিং প্ল্যাটফর্মে পৌঁছে গেছেন!');
              }
            }}
            className="px-2.5 py-1 bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs rounded flex items-center gap-1 cursor-pointer shadow active:scale-95 transition-all"
            title="গন্ডোলা কেবল কার প্ল্যাটফর্মে যান বা উঠুন"
          >
            <span>🚡 কেবল কার কাউন্টার ও প্ল্যাটফর্ম</span>
          </button>
        </div>
      )}

      {/* CTG Highway & Grand Market Interactive Action Bar */}
      {isInCtgZone && !drivingVehicleInfo && !isRidingMetro && !isRidingGondola && (
        <div
          className="absolute top-20 left-4 z-20 bg-stone-950/90 text-amber-100 border border-amber-500/70 px-3.5 py-2.5 shadow-2xl backdrop-blur-md flex flex-wrap items-center gap-2.5 pointer-events-auto"
          data-testid="ctg-action-bar"
        >
          <div className="flex items-center gap-1.5 font-bold text-xs text-amber-300 border-r border-amber-700/60 pr-2">
            <span>🛣️ চট্টগ্রাম হাইওয়ে করিডোর</span>
          </div>
          <button
            type="button"
            onClick={() => boardOrDriveNearbyVehicle()}
            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs rounded flex items-center gap-1 cursor-pointer shadow active:scale-95 transition-all"
            title="ট্যাক্সি / গাড়িতে উঠুন [T]"
          >
            <span>🚗</span>
            <span>গাড়ি চালান [T]</span>
          </button>
          <button
            type="button"
            onClick={() => {
              const nearMarket = findNearestMarketItem(playerStateRef.current.x, playerStateRef.current.y, playerStateRef.current.z);
              if (nearMarket) setMarketSession(createMarketSession(nearMarket));
              else {
                playerStateRef.current.x = -265;
                playerStateRef.current.z = 72;
                playerStateRef.current.y = 0.05;
                onNotifyRef.current?.('🛍️ চট্টগ্রাম গ্র্যান্ড মার্কেটের সামনে পৌঁছালেন!');
              }
            }}
            className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded flex items-center gap-1 cursor-pointer shadow active:scale-95 transition-all"
            title="গ্র্যান্ড মার্কেটে কেনাকাটা"
          >
            <span>🛍️</span>
            <span>গ্র্যান্ড মার্কেট</span>
          </button>
        </div>
      )}

      {/* Snowman Builder & Customizer Modal */}
      {isSnowmanModalOpen && (
        <SnowmanBuilderModal
          onBuild={handleBuildSnowman}
          onClose={() => setIsSnowmanModalOpen(false)}
        />
      )}

      {/* Nearby Door Keyboard & Click Prompt (including Room 1 Outdoor Exit Door) */}
      {!drivingVehicleInfo && !activeRideInfo && !nearbyRide && !nearbyVehicle && nearbyDoor && (
        <div
          className={`bg-[#181512]/95 text-[#F7F5F0] border border-[#C99A5B] shadow-2xl flex items-center gap-2 sm:gap-3 ${PROMPT_HUD_POSITION}`}
          data-testid="door-prompt"
        >
          {nearbyDoorIsOpen ? (
            <DoorOpen className="w-4 h-4 text-[#E8CFA6] shrink-0" />
          ) : (
            <DoorClosed className="w-4 h-4 text-[#E8CFA6] shrink-0" />
          )}
          <span className="text-xs whitespace-nowrap max-md:whitespace-normal max-md:line-clamp-2">
            Press <kbd className="px-1.5 py-0.5 bg-stone-800 border border-stone-600 font-mono text-[#E8CFA6]">F</kbd> or{' '}
            <kbd className="px-1.5 py-0.5 bg-stone-800 border border-stone-600 font-mono text-[#E8CFA6]">Space</kbd> to{' '}
            {nearbyDoorIsOpen ? 'close' : 'open'} door to{' '}
            <strong className="text-[#E8CFA6]">{nearbyDoorTargetName}</strong>
          </span>
          <button
            type="button"
            onClick={() => toggleDoorById(nearbyDoor.id)}
            className="px-2.5 py-1 bg-[#8A5A2B] hover:bg-[#9E6833] text-white text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-md"
          >
            {nearbyDoorIsOpen ? 'Close Door' : isNearbyExitDoor ? 'Open Exit Door' : 'Open Door'}
          </button>
        </div>
      )}

      {/* Subtle Hover Prompt for Artworks, Door Signboards, Doors, or Street Vehicles */}
      {hoveredPrompt && (
        <div className={`pointer-events-none bg-[#181512]/92 text-[#F7F5F0] px-4 py-2 border border-[#C99A5B]/60 text-xs whitespace-nowrap ${PROMPT_HUD_POSITION}`}>
          {hoveredPrompt.kind === 'artwork' && (
            <>
              Click to inspect <span className="font-semibold text-[#E8CFA6]">{hoveredPrompt.label}</span>
            </>
          )}
          {hoveredPrompt.kind === 'signboard' && (
            <>
              Click signboard to rename <span className="font-semibold text-[#E8CFA6]">{hoveredPrompt.label}</span>
            </>
          )}
          {hoveredPrompt.kind === 'door' && (
            <>
              Click or press [F] — <span className="font-semibold text-[#E8CFA6]">{hoveredPrompt.label}</span>
            </>
          )}
          {hoveredPrompt.kind === 'vehicle' && (
            <>
              Click or press [E] to Stop &amp; Talk — <span className="font-semibold text-emerald-300">{hoveredPrompt.label}</span>
            </>
          )}
          {hoveredPrompt.kind === 'ride' && (
            <>
              Click or press [E] to Ride — <span className="font-semibold text-rose-300">{hoveredPrompt.label}</span>
            </>
          )}
          {hoveredPrompt.kind === 'market' && (
            <>
              দোকানে কেনাকাটা ও দরদাম করুন — <span className="font-semibold text-pink-300">{hoveredPrompt.label}</span>
            </>
          )}
          {hoveredPrompt.kind === 'elevator' && (
            <>
              তলায় উঠানামা করুন — <span className="font-semibold text-amber-300">{hoveredPrompt.label}</span>
            </>
          )}
          {hoveredPrompt.kind === 'metroTicket' && (
            <>
              টিকিট ও পাস কাটুন — <span className="font-semibold text-emerald-300">{hoveredPrompt.label}</span>
            </>
          )}
          {hoveredPrompt.kind === 'metro' && (
            <>
              মেট্রোরেলে ভ্রমণ করুন — <span className="font-semibold text-emerald-300">{hoveredPrompt.label}</span>
            </>
          )}
          {hoveredPrompt.kind === 'expansion' && (
            <span className="text-[#E8CFA6]">{hoveredPrompt.label}</span>
          )}
        </div>
      )}

      {/* Vehicle Stop, Fare Negotiation & Chintai Modal */}
      {talkSession && (
        <VehicleTalkModal
          session={talkSession}
          walletBdt={walletBdt}
          errorText={talkError}
          onSelectDestination={handleSelectTalkDest}
          onBargain={handleBargainFare}
          onPayAndRide={handlePayAndRide}
          onChintai={handleChintaiTakeover}
          onClose={handleCloseTalk}
        />
      )}

      {/* Chittagong Hill View Grand Market Shopping & Bargaining Modal */}
      {marketSession && (
        <MarketShopModal
          session={marketSession}
          walletBdt={walletBdt}
          onBargain={handleBargainPrice}
          onBuy={handleBuyMarketItem}
          onClose={handleCloseMarket}
        />
      )}

      {/* Metro Rail Automatic Ticket & MRT Pass Counter Modal */}
      {ticketModalStationId && (
        <MetroTicketModal
          currentStationId={ticketModalStationId}
          walletBdt={walletBdt}
          onTicketPurchased={handleTicketPurchased}
          onClose={() => setTicketModalStationId(null)}
        />
      )}

      {/* Floating Purchased Items Shopping Bag Badge */}
      {purchasedItems.length > 0 && (
        <div
          className="absolute top-20 right-4 z-20 bg-[#181512]/92 border border-pink-500/50 px-3 py-2 shadow-2xl backdrop-blur-sm pointer-events-auto"
          title="আপনার কেনাকাটার ব্যাগ"
        >
          <div className="font-bold flex items-center gap-1.5 mb-1 text-pink-300 text-xs">
            <span>🛍️ শপিং ব্যাগ ({purchasedItems.length})</span>
          </div>
          <div className="text-[11px] text-stone-200 flex flex-wrap gap-1 max-w-[210px]">
            {purchasedItems.map((name, i) => (
              <span key={i} className="bg-stone-800/80 px-1.5 py-0.5 border border-stone-600/70 text-emerald-300">
                ✓ {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Mobile Virtual Analog Movement Joystick (Bottom-Left) */}
      <div
        className="fixed bottom-6 left-6 z-30 md:hidden pointer-events-auto touch-none select-none"
        aria-label="Mobile Movement Joystick"
      >
        <div
          className={`relative w-28 h-28 rounded-full border-2 transition-all duration-150 flex items-center justify-center shadow-2xl backdrop-blur-md ${
            joystickState.active
              ? 'bg-amber-950/75 border-amber-400 scale-105 shadow-amber-500/25 ring-2 ring-amber-400/40'
              : 'bg-stone-950/60 border-stone-600/70'
          }`}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture?.(e.pointerId);
            const rect = e.currentTarget.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const dx = e.clientX - centerX;
            const dy = e.clientY - centerY;
            const maxR = 44;
            const dist = Math.hypot(dx, dy);
            const clampedDist = Math.min(dist, maxR);
            const angle = Math.atan2(dy, dx);
            const normX = clampedDist > 0 ? (Math.cos(angle) * clampedDist) / maxR : 0;
            const normY = clampedDist > 0 ? (Math.sin(angle) * clampedDist) / maxR : 0;
            joystickInputRef.current = { forward: -normY, turn: -normX };
            setJoystickState({ active: true, knobX: normX * maxR, knobY: normY * maxR });
          }}
          onPointerMove={(e) => {
            if (!joystickState.active) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const dx = e.clientX - centerX;
            const dy = e.clientY - centerY;
            const maxR = 44;
            const dist = Math.hypot(dx, dy);
            const clampedDist = Math.min(dist, maxR);
            const angle = Math.atan2(dy, dx);
            const normX = clampedDist > 0 ? (Math.cos(angle) * clampedDist) / maxR : 0;
            const normY = clampedDist > 0 ? (Math.sin(angle) * clampedDist) / maxR : 0;
            joystickInputRef.current = { forward: -normY, turn: -normX };
            setJoystickState({ active: true, knobX: normX * maxR, knobY: normY * maxR });
          }}
          onPointerUp={() => {
            joystickInputRef.current = { forward: 0, turn: 0 };
            setJoystickState({ active: false, knobX: 0, knobY: 0 });
          }}
          onPointerCancel={() => {
            joystickInputRef.current = { forward: 0, turn: 0 };
            setJoystickState({ active: false, knobX: 0, knobY: 0 });
          }}
        >
          {/* Compass / Direction markers */}
          <span className="absolute top-1 text-[9px] font-bold text-amber-200/80 pointer-events-none select-none">▲ সামনে</span>
          <span className="absolute bottom-1 text-[9px] font-bold text-amber-200/80 pointer-events-none select-none">▼ পেছনে</span>
          <span className="absolute left-1.5 text-[9px] font-bold text-amber-200/80 pointer-events-none select-none">◀</span>
          <span className="absolute right-1.5 text-[9px] font-bold text-amber-200/80 pointer-events-none select-none">▶</span>

          {/* Floating Joystick Thumb Knob */}
          <div
            className={`w-12 h-12 rounded-full border-2 shadow-lg flex items-center justify-center transition-transform duration-75 select-none pointer-events-none ${
              joystickState.active
                ? 'bg-amber-500 border-amber-200 text-stone-950 scale-110 shadow-amber-400/50'
                : 'bg-stone-700/85 border-stone-400 text-stone-200'
            }`}
            style={{
              transform: `translate(${joystickState.knobX}px, ${joystickState.knobY}px)`,
            }}
          >
            <span className="text-xs font-bold pointer-events-none">🕹️</span>
          </div>
        </div>
      </div>

      {/* Mobile Touch Quick Action Cluster (Bottom-Right) */}
      <div
        className="fixed bottom-6 right-6 z-30 md:hidden flex flex-col items-end gap-2 pointer-events-auto touch-none select-none"
        aria-label="Mobile Action Buttons"
      >
        <div className="flex items-center gap-2">
          {/* Fast Run / Sprint Toggle Button */}
          <button
            type="button"
            onClick={() => {
              const next = !isMobileSprint;
              setIsMobileSprint(next);
              isMobileSprintRef.current = next;
            }}
            className={`w-11 h-11 rounded-full border shadow-lg flex items-center justify-center font-bold text-xs transition-all active:scale-90 ${
              isMobileSprint
                ? 'bg-amber-500 border-amber-300 text-stone-950 ring-2 ring-amber-400'
                : 'bg-stone-900/85 border-stone-600 text-stone-200'
            }`}
            title="দৌড় / স্প্রিন্ট মোড"
          >
            🏃
          </button>

          {/* Camera View Toggle Button (1st / 3rd Person) */}
          <button
            type="button"
            onClick={() => setCameraMode((prev) => (prev === 'third' ? 'first' : 'third'))}
            className="w-11 h-11 rounded-full border border-sky-400/70 bg-stone-900/85 text-sky-200 shadow-lg flex items-center justify-center font-bold text-xs active:scale-90 transition-all"
            title="ক্যামেরা ভিউ বদলান (1st / 3rd Person)"
          >
            👁️
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Action / Interact Button (E) */}
          <button
            type="button"
            onClick={() => {
              if (isRidingGondolaRef.current) {
                exitGondolaRef.current();
                return;
              }
              if (isRidingMetroRef.current) {
                if (isSeatedOnMetroRef.current) {
                  standUpFromMetroSeatRef.current();
                } else {
                  exitMetroRef.current();
                }
                return;
              }
              if (activeRideIdRef.current) {
                exitRideRef.current();
                return;
              }
              if (drivingVehicleIdRef.current) {
                exitVehicleRef.current();
                return;
              }
              if (nearbyMetroBoardable) {
                mountMetroRef.current();
                return;
              }
              if (nearbyMarketItem) {
                setMarketSession(createMarketSession(nearbyMarketItem));
                return;
              }
              const ps = playerStateRef.current;
              if (nearbyDoor) {
                toggleDoorByIdRef.current(nearbyDoor.id);
                return;
              }
              if (nearbyGondolaCounter || (Math.hypot(ps.x - (-665), ps.z - 120.2) < 4.5 && Math.abs(ps.y - 3.8) < 2.0)) {
                buyGondolaTicketRef.current();
                return;
              }
              const bCabin = findBoardableGondola({ x: ps.x, y: ps.y, z: ps.z }, gondolaSysRef.current.cabins);
              if (bCabin) {
                mountGondolaRef.current(bCabin.cabinId);
                return;
              }
              if (nearbyVehicle) {
                boardOrDriveNearbyVehicle(nearbyVehicle.id);
                return;
              }
              if (nearbyRide) {
                mountRideRef.current(nearbyRide.id);
                return;
              }
            }}
            className="w-13 h-13 rounded-full border-2 border-emerald-400 bg-emerald-950/90 text-emerald-200 shadow-xl flex items-center justify-center font-bold text-xs active:scale-90 transition-all cursor-pointer"
            title="অ্যাকশন / চড়া / কথা বলা [E]"
          >
            <span className="flex flex-col items-center leading-none">
              <span className="text-sm">🚪</span>
              <span className="text-[9px] mt-0.5">অ্যাকশন</span>
            </span>
          </button>

          {/* Drive / Vehicle Board Button (T) */}
          <button
            type="button"
            onClick={() => boardOrDriveNearbyVehicle()}
            className="w-13 h-13 rounded-full border-2 border-amber-400 bg-amber-950/90 text-amber-200 shadow-xl flex items-center justify-center font-bold text-xs active:scale-90 transition-all cursor-pointer"
            title="গাড়িতে উঠুন / চালান [T]"
          >
            <span className="flex flex-col items-center leading-none">
              <span className="text-sm">🚗</span>
              <span className="text-[9px] mt-0.5">ড্রাইভ</span>
            </span>
          </button>
        </div>
      </div>

      {/* Collapsible Unified Bottom Control Dock */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center max-w-[96vw]">
        <button
          type="button"
          onClick={() => setDockCollapsed((v) => !v)}
          aria-expanded={!dockCollapsed}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#181512]/90 text-stone-300 hover:text-white border border-b-0 border-stone-700 text-xs transition-colors cursor-pointer whitespace-nowrap"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              Show Controls
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              Hide Controls
            </>
          )}
        </button>

        {!dockCollapsed && (
          <nav
            aria-label="Museum controls"
            className="bg-[#181512]/92 text-[#F7F5F0] border border-stone-700 px-3 py-2 flex flex-wrap items-center justify-center gap-2 shadow-2xl"
          >
            {canCurate && (
              <button
                type="button"
                onClick={onOpenUpload}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#8A5A2B] hover:bg-[#9E6833] text-white text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Artwork
              </button>
            )}

            <button
              type="button"
              onClick={onOpenCatalog}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-100 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <FolderKanban className="w-3.5 h-3.5 text-[#D4B282]" />
              Catalog by Date ({artworks.length})
            </button>

            <button
              type="button"
              onClick={onOpenAccess}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-100 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Users className="w-3.5 h-3.5 text-[#D4B282]" />
              Share Access
            </button>

            <button
              type="button"
              onClick={() => setCameraMode((m) => (m === 'third' ? 'first' : 'third'))}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-100 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Eye className="w-3.5 h-3.5 text-[#D4B282]" />
              {cameraMode === 'third' ? '3rd Person' : '1st Person'}
            </button>

            <button
              type="button"
              onClick={cycleTheme}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-100 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 capitalize"
            >
              <Palette className="w-3.5 h-3.5 text-[#D4B282]" />
              {museum.wallTheme}
            </button>

            <span className="hidden xl:inline-block text-xs text-stone-400 pl-2 border-l border-stone-700 whitespace-nowrap">
              W/S Walk/Drive/Boost · A/D Turn &amp; Rotate View · F Door/Exit · E Ride / Talk Vehicle
            </span>
          </nav>
        )}
      </div>
    </div>
  );
}
