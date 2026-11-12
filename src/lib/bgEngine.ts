'use client';

export interface BgEngineProgress {
  percent: number;
  message: string;
}

export type BgModelType = 'isnet' | 'isnet_fp16';

export interface BgRemovalOptions {
  model?: BgModelType; // 'isnet' (FP32 - Highest quality) or 'isnet_fp16'
  feather?: number;    // Feather edge radius in pixels (default 2.5)
}

/**
 * Removes background from an image source (File, Blob, or URL)
 * entirely inside the user's browser using client-side WebAssembly / WebGPU.
 * Uses ISNet (full FP32 precision) by default for best edge fidelity and applies
 * anti-aliasing edge feathering.
 */
export async function removeBackgroundClient(
  imageSource: Blob | File | string,
  onProgress?: (progress: BgEngineProgress) => void,
  options?: BgRemovalOptions
): Promise<{ rawBlob: Blob; featheredBlob: Blob }> {
  if (typeof window === 'undefined') {
    throw new Error('Background removal engine must run client-side in the browser.');
  }

  const selectedModel = options?.model || 'isnet'; // Default to ISNet full FP32
  const featherRadius = options?.feather ?? 2.5;   // Default 2.5px smooth feathering

  // Dynamic import to prevent any SSR / Node execution issues
  const { removeBackground } = await import('@imgly/background-removal');

  // Determine public asset path for local WebAssembly & Model weights with CDN fallback
  const cdnFallbackPath = 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/';
  let assetPath = `${window.location.origin}/bg-removal-data/`;

  try {
    const probe = await fetch(`${window.location.origin}/bg-removal-data/resources.json`);
    if (probe.ok) {
      const data = await probe.json();
      // Ensure the model exists in the resources manifest
      const targetModelKey = `/models/${selectedModel}`;
      if (!data[targetModelKey] && !data['/models/isnet_fp16']) {
        assetPath = cdnFallbackPath;
      }
    } else {
      assetPath = cdnFallbackPath;
    }
  } catch {
    assetPath = cdnFallbackPath;
  }

  const config = {
    publicPath: assetPath,
    model: selectedModel,
    debug: false,
    device: ('gpu' in navigator ? 'gpu' : 'cpu') as 'gpu' | 'cpu',
    progress: (key: string, current: number, total: number) => {
      if (!onProgress) return;

      const pct = total > 0 ? Math.min(99, Math.round((current / total) * 100)) : 0;
      const lowerKey = (key || '').toLowerCase();

      let message = 'Processing image...';
      if (lowerKey.includes('fetch') || lowerKey.includes('model') || lowerKey.includes('wasm') || lowerKey.includes('data')) {
        message = `Downloading model (${selectedModel}): ${pct}%`;
      } else if (lowerKey.includes('compute') || lowerKey.includes('inference') || lowerKey.includes('session')) {
        message = `Neural inference (${selectedModel}): ${pct}%`;
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

  let rawBlob: Blob;

  try {
    rawBlob = await removeBackground(imageSource, config);
  } catch (err: unknown) {
    // If local asset had an issue, fallback to official CDN
    if (config.publicPath !== cdnFallbackPath) {
      try {
        console.warn('Local asset execution failed, retrying with official CDN:', err);
        const fallbackConfig = { ...config, publicPath: cdnFallbackPath };
        rawBlob = await removeBackground(imageSource, fallbackConfig);
      } catch (cdnErr) {
        console.warn('CDN retry also failed:', cdnErr);
        throw cdnErr;
      }
    } else if (config.device === 'gpu') {
      // If GPU fails, fallback to CPU device
      try {
        console.warn('WebGPU execution failed, falling back to WebAssembly CPU:', err);
        const fallbackConfig = { ...config, device: 'cpu' as const };
        rawBlob = await removeBackground(imageSource, fallbackConfig);
      } catch (fallbackErr) {
        throw fallbackErr;
      }
    } else {
      throw err;
    }
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
 * producing a transparent PNG Blob.
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

  // Step 2: Get original image data and mask image data
  const origData = ctx.getImageData(0, 0, width, height);
  const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
  if (!maskCtx) throw new Error('Could not get mask canvas context');
  const maskData = maskCtx.getImageData(0, 0, width, height);

  const origPixels = origData.data;
  const maskPixels = maskData.data;

  // Step 3: Apply mask's red channel (or brightness) as the new alpha channel
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
