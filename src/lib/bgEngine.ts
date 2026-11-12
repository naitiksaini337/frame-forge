'use client';

export interface BgEngineProgress {
  percent: number;
  message: string;
}

/**
 * Removes background from an image source (File, Blob, or URL)
 * entirely inside the user's browser using client-side WebAssembly / WebGPU.
 */
export async function removeBackgroundClient(
  imageSource: Blob | File | string,
  onProgress?: (progress: BgEngineProgress) => void
): Promise<Blob> {
  if (typeof window === 'undefined') {
    throw new Error('Background removal engine must run client-side in the browser.');
  }

  // Dynamic import to prevent any SSR / Node execution issues
  const { removeBackground } = await import('@imgly/background-removal');

  // Determine public asset path for local WebAssembly & Model weights
  const assetPath = `${window.location.origin}/bg-removal-data/`;

  const config = {
    publicPath: assetPath,
    debug: false,
    device: ('gpu' in navigator ? 'gpu' : 'cpu') as 'gpu' | 'cpu',
    progress: (key: string, current: number, total: number) => {
      if (!onProgress) return;
      
      const pct = total > 0 ? Math.min(99, Math.round((current / total) * 100)) : 0;
      const lowerKey = (key || '').toLowerCase();

      let message = 'Processing image...';
      if (lowerKey.includes('fetch') || lowerKey.includes('model') || lowerKey.includes('wasm') || lowerKey.includes('data')) {
        message = `Downloading model: ${pct}%`;
      } else if (lowerKey.includes('compute') || lowerKey.includes('inference') || lowerKey.includes('session')) {
        message = `Processing inference: ${pct}%`;
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

  try {
    const resultBlob = await removeBackground(imageSource, config);
    if (onProgress) {
      onProgress({ percent: 100, message: 'Complete' });
    }
    return resultBlob;
  } catch (err: unknown) {
    // If GPU fails, fallback to CPU device
    if (config.device === 'gpu') {
      try {
        console.warn('WebGPU execution failed, falling back to WebAssembly CPU:', err);
        const fallbackConfig = { ...config, device: 'cpu' as const };
        const resultBlob = await removeBackground(imageSource, fallbackConfig);
        if (onProgress) {
          onProgress({ percent: 100, message: 'Complete' });
        }
        return resultBlob;
      } catch (fallbackErr) {
        throw fallbackErr;
      }
    }
    throw err;
  }
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
    img.onerror = (e) => {
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

