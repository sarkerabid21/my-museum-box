import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RotateCcw } from 'lucide-react';
import type { AvatarConfig } from '../types/museum';
import {
  buildAvatarRig,
  buildCustomGlbAvatarRig,
  type AvatarRig,
} from '../three/avatarBuilder';
import { createAfterDrawScheduler, detectSoftwareGl } from '../three/webglUtils';

interface AvatarPreview3DProps {
  avatar: AvatarConfig;
  customGlbBuffer?: ArrayBuffer | null;
  isExclusiveModel?: boolean;
}

export function AvatarPreview3D({
  avatar,
  customGlbBuffer = null,
  isExclusiveModel = false,
}: AvatarPreview3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const avatarSlotRef = useRef<THREE.Group | null>(null);
  const currentRigRef = useRef<AvatarRig | null>(null);
  const requestRenderRef = useRef<(() => void) | null>(null);
  const resetCameraRef = useRef<(() => void) | null>(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  // Mount Three.js studio turntable once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
        alpha: false,
      });
    } catch {
      setWebglUnavailable(true);
      return;
    }

    const width = Math.max(300, container.clientWidth);
    const height = Math.max(400, container.clientHeight);
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xebe6dd);
    scene.fog = new THREE.Fog(0xebe6dd, 9, 22);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 40);
    camera.position.set(0.45, 1.38, 3.45);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.98, 0);
    controls.enablePan = false;
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.minDistance = 2.1;
    controls.maxDistance = 5.0;
    controls.minPolarAngle = Math.PI * 0.22;
    controls.maxPolarAngle = Math.PI * 0.56;
    controls.update();

    // Warm/cool 3-point museum studio lighting
    const hemi = new THREE.HemisphereLight(0xf6f9ff, 0x8f7a64, 1.05);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff1dc, 1.7);
    keyLight.position.set(3.2, 5.4, 3.8);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 16;
    keyLight.shadow.camera.left = -2.5;
    keyLight.shadow.camera.right = 2.5;
    keyLight.shadow.camera.top = 2.5;
    keyLight.shadow.camera.bottom = -2.5;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xdce8f8, 0.78);
    rimLight.position.set(-3.2, 3.4, -3.5);
    scene.add(rimLight);

    // Sculpted Marble Exhibition Pedestal & Architectural Studio Backdrop
    const pedestalGeo = new THREE.CylinderGeometry(0.84, 0.92, 0.2, 36);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0xf7f3eb,
      roughness: 0.32,
      metalness: 0.06,
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = -0.1;
    pedestal.receiveShadow = true;
    scene.add(pedestal);

    const brassRingGeo = new THREE.TorusGeometry(0.86, 0.018, 12, 48);
    const brassRingMat = new THREE.MeshStandardMaterial({
      color: 0xc2975c,
      roughness: 0.24,
      metalness: 0.88,
    });
    const brassRing = new THREE.Mesh(brassRingGeo, brassRingMat);
    brassRing.rotation.x = Math.PI / 2;
    brassRing.position.y = -0.004;
    scene.add(brassRing);

    const studioFloorGeo = new THREE.CircleGeometry(8, 36);
    const studioFloorMat = new THREE.MeshStandardMaterial({
      color: 0xddd6c9,
      roughness: 0.5,
      metalness: 0.04,
    });
    const studioFloor = new THREE.Mesh(studioFloorGeo, studioFloorMat);
    studioFloor.rotation.x = -Math.PI / 2;
    studioFloor.position.y = -0.2;
    studioFloor.receiveShadow = true;
    scene.add(studioFloor);

    // Flat architectural limestone studio wall with subtle recessed molding behind avatar
    const backWallGeo = new THREE.BoxGeometry(8, 5, 0.2);
    const backWallMat = new THREE.MeshStandardMaterial({
      color: 0xe6dfd3,
      roughness: 0.86,
      metalness: 0.02,
    });
    const backWall = new THREE.Mesh(backWallGeo, backWallMat);
    backWall.position.set(0, 2.2, -2.4);
    scene.add(backWall);

    const moldingGeo = new THREE.BoxGeometry(2.6, 3.2, 0.06);
    const moldingMat = new THREE.MeshStandardMaterial({
      color: 0xd6cdc0,
      roughness: 0.72,
      metalness: 0.04,
    });
    const molding = new THREE.Mesh(moldingGeo, moldingMat);
    molding.position.set(0, 1.55, -2.28);
    scene.add(molding);

    const avatarSlot = new THREE.Group();
    scene.add(avatarSlot);
    avatarSlotRef.current = avatarSlot;

    // On-demand coalesced rendering; apply resize INSIDE draw frame so buffer is never wiped
    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let disposed = false;
    let pendingSize: { w: number; h: number } | null = null;

    const afterDraw = createAfterDrawScheduler(renderer, (id) => {
      frameId = id;
    });

    const drawNow = () => {
      if (disposed) return;
      if (pendingSize) {
        camera.aspect = pendingSize.w / pendingSize.h;
        camera.updateProjectionMatrix();
        renderer.setSize(pendingSize.w, pendingSize.h);
        pendingSize = null;
      }
      controls.update();
      renderer.render(scene, camera);
    };

    const requestRender = () => {
      if (disposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        if (disposed) return;
        renderDirty = false;
        drawNow();
        const done = () => {
          renderBusy = false;
          if (renderDirty && !disposed) requestRender();
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    };

    requestRenderRef.current = requestRender;
    resetCameraRef.current = () => {
      camera.position.set(0.45, 1.38, 3.45);
      controls.target.set(0, 0.98, 0);
      controls.update();
      requestRender();
    };

    const onControlChange = () => requestRender();
    controls.addEventListener('change', onControlChange);

    const onContextLost = (e: Event) => {
      e.preventDefault();
    };
    const onContextRestored = () => {
      requestRender();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const handleResize = () => {
      if (!container || disposed) return;
      const w = Math.max(280, container.clientWidth);
      const h = Math.max(360, container.clientHeight);
      pendingSize = { w, h };
      requestRender();
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Build initial rig right after mount & draw immediate first frame
    const initialRig = buildAvatarRig(avatar, { showNameplate: false, showContactShadow: true });
    avatarSlot.add(initialRig.root);
    currentRigRef.current = initialRig;
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }
    drawNow();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.removeEventListener('change', onControlChange);
      controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      currentRigRef.current?.dispose();
      currentRigRef.current = null;
      avatarSlotRef.current = null;
      requestRenderRef.current = null;
      resetCameraRef.current = null;
      pedestalGeo.dispose();
      pedestalMat.dispose();
      brassRingGeo.dispose();
      brassRingMat.dispose();
      studioFloorGeo.dispose();
      studioFloorMat.dispose();
      backWallGeo.dispose();
      backWallMat.dispose();
      moldingGeo.dispose();
      moldingMat.dispose();
      envTexture.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Hot-swap sculpted 3D avatar (or exclusive Tripo GLB) without tearing down WebGL
  useEffect(() => {
    const slot = avatarSlotRef.current;
    if (!slot) return;
    let cancelled = false;

    const mountRig = (nextRig: AvatarRig) => {
      if (cancelled) {
        nextRig.dispose();
        return;
      }
      if (currentRigRef.current) {
        slot.remove(currentRigRef.current.root);
        currentRigRef.current.dispose();
      }
      slot.add(nextRig.root);
      currentRigRef.current = nextRig;
      requestRenderRef.current?.();
    };

    if (customGlbBuffer) {
      void buildCustomGlbAvatarRig(customGlbBuffer, avatar, {
        showNameplate: false,
        showContactShadow: true,
      })
        .then(mountRig)
        .catch(() => {
          mountRig(buildAvatarRig(avatar, { showNameplate: false, showContactShadow: true }));
        });
    } else {
      mountRig(buildAvatarRig(avatar, { showNameplate: false, showContactShadow: true }));
    }

    return () => {
      cancelled = true;
    };
  }, [avatar, customGlbBuffer]);

  if (webglUnavailable) {
    return (
      <div className="w-full h-full min-h-[440px] bg-[#EBE6DD] border border-stone-200 flex flex-col items-center justify-center p-8 text-center">
        <p className="font-editorial text-2xl text-stone-900 mb-2">
          {avatar.displayName} ({avatar.gender === 'woman' ? 'Woman' : 'Man'})
        </p>
        <p className="text-sm text-stone-600">
          3D preview requires WebGL. Your avatar selections are saved and ready for the museum.
        </p>
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-full min-h-[440px] lg:min-h-[540px] bg-[#EBE6DD] border border-stone-200 overflow-hidden"
      data-testid="avatar-preview-stage"
      data-gender={avatar.gender}
      data-outfit={avatar.outfitStyle}
    >
      <div ref={mountRef} className="w-full h-full" />

      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
        <div className="bg-[#1C1917]/90 text-[#F7F5F0] px-3 py-1.5 text-xs tracking-wide">
          <span>{avatar.displayName || 'Curator'}</span>
          <span className="mx-2 text-stone-400" aria-hidden="true">·</span>
          <span className="text-[#D4B282]">
            {isExclusiveModel
              ? customGlbBuffer
                ? 'Exclusive Tripo GLB Model'
                : 'Exclusive 3D Model'
              : avatar.gender === 'woman'
                ? 'Woman 3D Model'
                : 'Man 3D Model'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => resetCameraRef.current?.()}
          aria-label="Reset 3D avatar camera view"
          className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F7F5F0]/95 text-stone-800 border border-stone-300 text-xs font-medium hover:bg-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset View
        </button>
      </div>

      <div className="absolute bottom-4 left-4 pointer-events-none text-xs text-stone-700 bg-[#F7F5F0]/92 px-3 py-1.5 border border-stone-300/80">
        Drag to rotate 360° · Scroll to zoom
      </div>
    </div>
  );
}
