'use client';

export interface BgEngineProgress {
  percent: number;
  message: string;
}

export type BgModelType = 'isnet' | 'isnet_fp16';

export interface BgRemovalOptions {
  model?: BgModelType; // 'isnet' (FP32 - Highest quality) or 'isnet_fp16'
  feather?: number;    // Feather edge radius in pixels (default 3.0)
}

/**
 * Removes background from an image source (File, Blob, or URL)
 * entirely inside the user's browser using client-side WebAssembly / WebGPU.
 * Uses a 4-tier resilient execution fallback:
 *   1. Local WebGPU
 *   2. Local WebAssembly CPU
 *   3. CDN WebGPU
 *   4. CDN WebAssembly CPU
 */
export async function removeBackgroundClient(
  imageSource: Blob | File | string,
  onProgress?: (progress: BgEngineProgress) => void,
  options?: BgRemovalOptions
): Promise<{ rawBlob: Blob; featheredBlob: Blob }> {
  if (typeof window === 'undefined') {
    throw new Error('Background removal engine must run client-side in the browser.');
  }

  const selectedModel = options?.model || 'isnet';
  const featherRadius = options?.feather ?? 3.0;

  // Dynamic import to prevent any SSR / Node execution issues
  const { removeBackground } = await import('@imgly/background-removal');

  const cdnPath = 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/';
  const localPath = `${window.location.origin}/bg-removal-data/`;

  // Check if local public files are accessible
  let hasLocalAssets = false;
  try {
    const probe = await fetch(`${localPath}resources.json`);
    if (probe.ok) {
      const data = await probe.json();
      if (data[`/models/${selectedModel}`] || data['/models/isnet_fp16']) {
        hasLocalAssets = true;
      }
    }
  } catch {
    hasLocalAssets = false;
  }

  const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;

  // Execution attempts in order of speed and independence
  const attempts: Array<{ publicPath: string; device: 'gpu' | 'cpu'; label: string }> = [];

  if (hasLocalAssets) {
    if (hasWebGPU) {
      attempts.push({ publicPath: localPath, device: 'gpu', label: 'Local WebGPU' });
    }
    attempts.push({ publicPath: localPath, device: 'cpu', label: 'Local CPU (WASM)' });
  }

  if (hasWebGPU) {
    attempts.push({ publicPath: cdnPath, device: 'gpu', label: 'CDN WebGPU' });
  }
  attempts.push({ publicPath: cdnPath, device: 'cpu', label: 'CDN CPU (WASM)' });

  let rawBlob: Blob | null = null;
  let lastError: unknown = null;

  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    try {
      if (onProgress && i > 0) {
        onProgress({ percent: 10, message: `Switching to ${attempt.label}...` });
      }

      const config = {
        publicPath: attempt.publicPath,
        model: selectedModel,
        debug: false,
        device: attempt.device,
        progress: (key: string, current: number, total: number) => {
          if (!onProgress) return;
          const pct = total > 0 ? Math.min(98, Math.round((current / total) * 100)) : 0;
          const lowerKey = (key || '').toLowerCase();

          let message = 'Processing image...';
          if (lowerKey.includes('fetch') || lowerKey.includes('model') || lowerKey.includes('wasm') || lowerKey.includes('data')) {
            message = `Loading model (${selectedModel}): ${pct}%`;
          } else if (lowerKey.includes('compute') || lowerKey.includes('inference') || lowerKey.includes('session')) {
            message = `Inference (${attempt.device.toUpperCase()}): ${pct}%`;
          } else {
            message = `Processing: ${pct}%`;
          }

          onProgress({ percent: pct, message });
        },
        output: {
          format: 'image/png' as const,
          quality: 1.0,
        },
      };

      rawBlob = await removeBackground(imageSource, config);
      if (rawBlob) break;
    } catch (err) {
      console.warn(`${attempt.label} failed:`, err);
      lastError = err;
    }
  }

  if (!rawBlob) {
    const errorMsg = lastError instanceof Error ? lastError.message : 'Unknown background removal error';
    throw new Error(`Background removal failed across all engines: ${errorMsg}`);
  }

  // Apply edge feathering post-processing
  let featheredBlob = rawBlob;
  if (featherRadius > 0 && typeof imageSource !== 'string') {
    try {
      if (onProgress) {
        onProgress({ percent: 99, message: 'Refining & feathering edges...' });
      }
      featheredBlob = await applyFeatherToResult(imageSource, rawBlob, featherRadius);
    } catch (fErr) {
      console.warn('Edge feathering fallback to raw blob:', fErr);
      featheredBlob = rawBlob;
    }
  }

  if (onProgress) {
    onProgress({ percent: 100, message: 'Complete' });
  }

  return { rawBlob, featheredBlob };
}

/**
 * Creates an HTMLImageElement from a Blob or URL.
 */
export function loadImageElement(source: Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const isBlob = source instanceof Blob;
    const url = isBlob ? URL.createObjectURL(source) : source;

    img.onload = () => {
      if (isBlob) URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      if (isBlob) URL.revokeObjectURL(url);
      reject(new Error('Failed to load image element'));
    };
    img.src = url;
  });
}

/**
 * Extracts a 2D grayscale alpha mask canvas from an existing transparent image.
 */
export function extractAlphaMaskCanvas(transparentImg: HTMLImageElement): HTMLCanvasElement {
  const width = transparentImg.naturalWidth || transparentImg.width;
  const height = transparentImg.naturalHeight || transparentImg.height;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get 2D canvas context');

  ctx.drawImage(transparentImg, 0, 0);
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // Transform RGBA to grayscale mask where Alpha becomes RGB brightness and Alpha is 255
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    data[i] = alpha;     // R
    data[i + 1] = alpha; // G
    data[i + 2] = alpha; // B
    data[i + 3] = 255;   // Full alpha for the mask canvas
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Applies edge feathering (softening) to an alpha mask canvas.
 * Uses hardware-accelerated CSS canvas blur filter.
 */
export function refineMaskEdges(
  maskCanvas: HTMLCanvasElement,
  featherRadius: number = 2.5
): HTMLCanvasElement {
  if (featherRadius <= 0) return maskCanvas;

  const width = maskCanvas.width;
  const height = maskCanvas.height;

  const feathered = document.createElement('canvas');
  feathered.width = width;
  feathered.height = height;
  const fCtx = feathered.getContext('2d', { willReadFrequently: true });
  if (!fCtx) return maskCanvas;

  // Apply smooth edge blur filter
  fCtx.filter = `blur(${featherRadius}px)`;
  fCtx.drawImage(maskCanvas, 0, 0);
  fCtx.filter = 'none';

  return feathered;
}

/**
 * Re-applies edge feathering to an original image with raw cutout mask,
 * returning a new transparent PNG Blob with smooth feathered boundaries.
 */
export async function applyFeatherToResult(
  originalSource: Blob | File | HTMLImageElement,
  cutoutSource: Blob | HTMLImageElement,
  featherRadius: number = 2.5
): Promise<Blob> {
  const [origImg, cutoutImg] = await Promise.all([
    originalSource instanceof HTMLImageElement ? originalSource : loadImageElement(originalSource),
    cutoutSource instanceof HTMLImageElement ? cutoutSource : loadImageElement(cutoutSource),
  ]);

  // Extract raw mask
  const rawMask = extractAlphaMaskCanvas(cutoutImg);

  // Apply feather filter
  const featheredMask = refineMaskEdges(rawMask, featherRadius);

  // Composite with original color channels
  return compositeImageWithMask(origImg, featheredMask);
}

/**
 * Combines the original color image with an edited alpha mask canvas,
 * producing a transparent PNG Blob. Handles dimension scaling automatically.
 */
export async function compositeImageWithMask(
  originalImg: HTMLImageElement,
  maskCanvas: HTMLCanvasElement
): Promise<Blob> {
  const width = originalImg.naturalWidth || originalImg.width;
  const height = originalImg.naturalHeight || originalImg.height;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get 2D canvas context');

  // Step 1: Draw the original image RGB
  ctx.drawImage(originalImg, 0, 0);

  // Step 2: Ensure mask canvas matches original image dimensions
  let alignedMaskCanvas = maskCanvas;
  if (maskCanvas.width !== width || maskCanvas.height !== height) {
    alignedMaskCanvas = document.createElement('canvas');
    alignedMaskCanvas.width = width;
    alignedMaskCanvas.height = height;
    const alignedCtx = alignedMaskCanvas.getContext('2d');
    alignedCtx?.drawImage(maskCanvas, 0, 0, width, height);
  }

  // Step 3: Get image data and apply mask as alpha
  const origData = ctx.getImageData(0, 0, width, height);
  const maskCtx = alignedMaskCanvas.getContext('2d', { willReadFrequently: true });
  if (!maskCtx) throw new Error('Could not get mask canvas context');
  const maskData = maskCtx.getImageData(0, 0, width, height);

  const origPixels = origData.data;
  const maskPixels = maskData.data;

  for (let i = 0; i < origPixels.length; i += 4) {
    origPixels[i + 3] = maskPixels[i]; // Use R value of mask as alpha
  }

  ctx.putImageData(origData, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to generate PNG blob from canvas'));
        }
      },
      'image/png',
      1.0
    );
  });
}
