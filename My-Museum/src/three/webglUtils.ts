import * as THREE from 'three';

let cachedSoftwareGl: boolean | null = null;

export function detectSoftwareGl(): boolean {
  if (cachedSoftwareGl !== null) return cachedSoftwareGl;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) {
      cachedSoftwareGl = true;
      return true;
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    cachedSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    return cachedSoftwareGl;
  } catch {
    cachedSoftwareGl = true;
    return true;
  }
}

export function createAfterDrawScheduler(
  renderer: THREE.WebGLRenderer,
  getTimerSetter: (id: number) => void
): (cb: () => void) => void {
  return (cb: () => void) => {
    const gl = renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync !== 'function') {
      getTimerSetter(window.setTimeout(cb, 105));
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    let polls = 0;
    const poll = () => {
      polls++;
      const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
      if (state === gl.UNSIGNALED && polls < 40) {
        getTimerSetter(window.setTimeout(poll, 5));
      } else {
        if (sync) gl.deleteSync(sync);
        getTimerSetter(window.setTimeout(cb, 105));
      }
    };
    getTimerSetter(window.setTimeout(poll, 5));
  };
}

/**
 * Compresses an uploaded user photo into a crisp museum-ready JPEG Data URL (< 320KB)
 * and automatically infers the closest museum frame aspect ratio ('4:3', '3:4', or '1:1').
 */
export async function compressUploadedImage(
  file: File
): Promise<{ dataUrl: string; aspectRatio: '4:3' | '3:4' | '1:1' }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Selected file is not a valid image.'));
      img.onload = () => {
        const ratio = img.width / Math.max(1, img.height);
        const aspectRatio: '4:3' | '3:4' | '1:1' =
          ratio > 1.15 ? '4:3' : ratio < 0.85 ? '3:4' : '1:1';

        const maxDim = 920;
        let w = img.width;
        let h = img.height;
        if (w > h && w > maxDim) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else if (h >= w && h > maxDim) {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable.'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);

        let quality = 0.82;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > 360000 && quality > 0.4) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve({ dataUrl, aspectRatio });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
