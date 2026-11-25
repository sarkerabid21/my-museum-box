import * as THREE from 'three';
import { formatArchivalDate } from '../museum/layout';

export function createMarbleFloorTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d')!;

  // Base warm travertine / limestone tile tone
  ctx.fillStyle = '#E6E0D5';
  ctx.fillRect(0, 0, size, size);

  // Subtle tile-to-tile tonal variation (2x2 stone slabs)
  const tileTones = ['#EAE4DA', '#E3DDD1', '#E5DFD4', '#E8E2D7'];
  const half = size / 2;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      ctx.fillStyle = tileTones[row * 2 + col];
      ctx.fillRect(col * half + 2, row * half + 2, half - 4, half - 4);
    }
  }

  // Organic mineral veining
  ctx.strokeStyle = 'rgba(154, 141, 124, 0.16)';
  for (let i = 0; i < 28; i++) {
    ctx.lineWidth = 0.8 + (i % 3) * 0.7;
    ctx.beginPath();
    let x = (i * 73) % size;
    let y = (i * 139) % size;
    ctx.moveTo(x, y);
    for (let s = 0; s < 5; s++) {
      x += 34 + ((i + s * 17) % 28);
      y += ((s % 2 === 0 ? 1 : -1) * (10 + ((i * 7) % 18)));
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Subtle architectural grout joints
  ctx.strokeStyle = 'rgba(120, 110, 96, 0.35)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(half, 0);
  ctx.lineTo(half, size);
  ctx.moveTo(0, half);
  ctx.lineTo(size, half);
  ctx.stroke();
  ctx.strokeRect(1, 1, size - 2, size - 2);

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = maxAnisotropy;

  // Matching bump map for tile seams & gentle stone relief
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;
  bCtx.fillStyle = '#D8D8D8';
  bCtx.fillRect(0, 0, size, size);
  bCtx.strokeStyle = '#606060';
  bCtx.lineWidth = 3;
  bCtx.beginPath();
  bCtx.moveTo(half, 0);
  bCtx.lineTo(half, size);
  bCtx.moveTo(0, half);
  bCtx.lineTo(size, half);
  bCtx.stroke();
  bCtx.strokeRect(1, 1, size - 2, size - 2);

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.anisotropy = maxAnisotropy;

  return { map, bumpMap };
}

export function createPlasterWallTexture(
  baseHex: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);

  // Soft Venetian lime plaster mottling
  for (let i = 0; i < 420; i++) {
    const x = (i * 97) % size;
    const y = (i * 53) % size;
    const r = 4 + (i % 14);
    const light = i % 2 === 0;
    ctx.fillStyle = light ? 'rgba(255,255,255,0.032)' : 'rgba(28,25,23,0.028)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(18, 15, 12, 0.55)');
  grad.addColorStop(0.55, 'rgba(18, 15, 12, 0.22)');
  grad.addColorStop(1, 'rgba(18, 15, 12, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createPlaqueTexture(
  title: string,
  artist: string,
  dateCaptured: string,
  accession: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#FAF8F4';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#C9BFA9';
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, w - 16, h - 16);

  ctx.fillStyle = '#8A5A2B';
  ctx.font = '600 18px "JetBrains Mono", monospace';
  ctx.fillText(accession, 28, 46);

  ctx.fillStyle = '#1C1917';
  ctx.font = '600 32px Georgia, serif';
  const cleanTitle = title.length > 26 ? `${title.slice(0, 25)}…` : title;
  ctx.fillText(cleanTitle, 28, 102);

  ctx.fillStyle = '#57534E';
  ctx.font = '500 24px sans-serif';
  const cleanArtist = artist.length > 30 ? `${artist.slice(0, 29)}…` : artist;
  ctx.fillText(cleanArtist, 28, 152);

  ctx.fillStyle = '#78716C';
  ctx.font = '400 20px sans-serif';
  ctx.fillText(formatArchivalDate(dateCaptured), 28, 206);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

export function createNameplateTexture(
  displayName: string,
  genderLabel: string,
  statusTone: 'default' | 'active' | 'standing' = 'default'
): THREE.CanvasTexture {
  const w = 384;
  const h = 96;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, w, h);

  // Clean museum obsidian label bar (sharp architectural corners, static indicator only)
  ctx.fillStyle = statusTone === 'standing' ? 'rgba(24, 21, 18, 0.78)' : 'rgba(24, 21, 18, 0.90)';
  ctx.fillRect(16, 12, w - 32, h - 24);
  ctx.strokeStyle =
    statusTone === 'active'
      ? 'rgba(110, 231, 183, 0.85)'
      : statusTone === 'standing'
        ? 'rgba(168, 162, 158, 0.52)'
        : 'rgba(201, 154, 91, 0.72)';
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 12, w - 32, h - 24);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#F7F4EE';
  ctx.font = '600 24px "Plus Jakarta Sans", sans-serif';
  const name = displayName.length > 18 ? `${displayName.slice(0, 17)}…` : displayName;
  ctx.fillText(name, w / 2, 47);

  ctx.fillStyle =
    statusTone === 'active'
      ? '#6EE7B7'
      : statusTone === 'standing'
        ? '#A8A29E'
        : '#D4B282';
  ctx.font = '500 15px "JetBrains Mono", monospace';
  ctx.fillText(genderLabel.toUpperCase(), w / 2, 70);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createFallbackArtworkTexture(title: string): THREE.CanvasTexture {
  const w = 512;
  const h = 384;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#E8E2D6');
  grad.addColorStop(1, '#CFC5B4');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#8A5A2B';
  ctx.lineWidth = 3;
  ctx.strokeRect(24, 24, w - 48, h - 48);

  ctx.fillStyle = '#292524';
  ctx.textAlign = 'center';
  ctx.font = '600 28px Georgia, serif';
  ctx.fillText(title.slice(0, 26), w / 2, h / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createDoorSignboardTexture(
  roomNumberLabel: string,
  roomName: string,
  hintText: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const w = 1024;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Rich architectural dark walnut & obsidian signboard background
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#231D19');
  grad.addColorStop(1, '#151210');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Double gilded brass museum border
  ctx.strokeStyle = '#C99A5B';
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, w - 20, h - 20);

  ctx.strokeStyle = 'rgba(201, 154, 91, 0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(22, 22, w - 44, h - 44);

  // Corner decorative brass diamonds
  ctx.fillStyle = '#D9B37C';
  for (const [cx, cy] of [
    [34, 34],
    [w - 34, 34],
    [34, h - 34],
    [w - 34, h - 34],
  ]) {
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.textAlign = 'center';

  // Top Room Number label
  ctx.fillStyle = '#D9B37C';
  ctx.font = '600 24px "JetBrains Mono", monospace';
  ctx.fillText(roomNumberLabel.toUpperCase(), w / 2, 70);

  // Main Custom Room Name
  ctx.fillStyle = '#FAF6EE';
  const cleanName = roomName.trim().slice(0, 34) || 'Gallery Room';
  const fontSize = cleanName.length > 24 ? 44 : 56;
  ctx.font = `600 ${fontSize}px Georgia, serif`;
  ctx.fillText(cleanName, w / 2, 148);

  // Subtle bottom interactive hint
  ctx.fillStyle = '#B8A896';
  ctx.font = '500 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(hintText, w / 2, 206);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

/**
 * Generates a woven burgundy, claret, and deep indigo-navy plaid shirt texture
 * matching Abid's personal 3D showcase shirt pattern (SRGBColorSpace, seamless tiling).
 */
export function createAbidPlaidTexture(repeatX = 3, repeatY = 3): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Rich maroon/burgundy base cloth
  ctx.fillStyle = '#5F2334';
  ctx.fillRect(0, 0, size, size);

  // Broad deep indigo-slate vertical & horizontal tartan bands
  ctx.fillStyle = 'rgba(26, 36, 60, 0.72)';
  ctx.fillRect(0, 0, 62, size);
  ctx.fillRect(128, 0, 52, size);
  ctx.fillStyle = 'rgba(24, 32, 54, 0.65)';
  ctx.fillRect(0, 0, size, 58);
  ctx.fillRect(0, 128, size, 50);

  // Warm claret-crimson secondary check bands
  ctx.fillStyle = 'rgba(130, 42, 64, 0.56)';
  ctx.fillRect(72, 0, 44, size);
  ctx.fillRect(192, 0, 48, size);
  ctx.fillRect(0, 70, size, 42);
  ctx.fillRect(0, 190, size, 48);

  // Fine dark navy/charcoal overcheck accent lines
  ctx.fillStyle = 'rgba(18, 22, 34, 0.85)';
  for (const pos of [26, 32, 152, 214]) {
    ctx.fillRect(pos, 0, 3, size);
    ctx.fillRect(0, pos, size, 3);
  }

  // Subtle dusty-blue & rose micro-stripe threads
  ctx.fillStyle = 'rgba(116, 134, 168, 0.34)';
  for (const pos of [94, 218]) {
    ctx.fillRect(pos, 0, 2, size);
    ctx.fillRect(0, pos, size, 2);
  }
  ctx.fillStyle = 'rgba(168, 72, 92, 0.36)';
  for (const pos of [64, 184]) {
    ctx.fillRect(pos, 0, 2, size);
    ctx.fillRect(0, pos, size, 2);
  }

  // Subtle twill cotton fabric weave grain
  ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
  for (let y = 0; y < size; y += 4) {
    ctx.fillRect(0, y, size, 1);
  }
  ctx.fillStyle = 'rgba(0, 0, 0, 0.045)';
  for (let x = 0; x < size; x += 4) {
    ctx.fillRect(x, 0, 1, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  return texture;
}


