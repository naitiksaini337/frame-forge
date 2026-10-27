import { FpsPreset, ImageFormat, ScalePreset } from './types';

export function formatBytes(bytes: number): string {
  if (bytes <= 0 || isNaN(bytes)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1);
  return `${val} ${units[i]}`;
}

export function formatTimecode(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00.000';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

export function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-]/g, '_').replace(/_+/g, '_').toLowerCase();
}

export function getFileExtension(format: ImageFormat): string {
  switch (format) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
    default:
      return 'webp';
  }
}

export function generateFrameFilename(
  pattern: string,
  customPrefix: string,
  videoName: string,
  index: number,
  timestamp: number,
  format: ImageFormat
): string {
  const ext = getFileExtension(format);
  const cleanPrefix = sanitizeName(customPrefix || 'frame');
  const cleanVideoName = sanitizeName(videoName || 'video');

  const idx5 = String(index).padStart(5, '0');
  const idx4 = String(index).padStart(4, '0');
  const idx6 = String(index).padStart(6, '0');

  const mins = Math.floor(timestamp / 60);
  const secs = Math.floor(timestamp % 60);
  const ms = Math.floor((timestamp % 1) * 1000);
  const timecodeSlug = `${String(mins).padStart(2, '0')}m${String(secs).padStart(2, '0')}s${String(ms).padStart(3, '0')}ms`;

  const result = pattern
    .replace('{name}', cleanPrefix)
    .replace('{videoname}', cleanVideoName)
    .replace('{index:6}', idx6)
    .replace('{index:5}', idx5)
    .replace('{index:4}', idx4)
    .replace('{index}', String(index))
    .replace('{timecode}', timecodeSlug);

  return `${result}.${ext}`;
}

export function calculateTargetResolution(
  preset: ScalePreset,
  sourceWidth: number,
  sourceHeight: number,
  customW: number,
  customH: number
): { width: number; height: number } {
  const origW = sourceWidth || 1920;
  const origH = sourceHeight || 1080;
  const aspect = origW / origH;

  switch (preset) {
    case '4k':
      return { width: 3840, height: Math.round(3840 / aspect) };
    case '1080p':
      return { width: 1920, height: Math.round(1920 / aspect) };
    case '720p':
      return { width: 1280, height: Math.round(1280 / aspect) };
    case '480p':
      return { width: 854, height: Math.round(854 / aspect) };
    case 'custom':
      return { width: Math.max(16, customW || 1920), height: Math.max(16, customH || 1080) };
    case 'orig':
    default:
      return { width: origW, height: origH };
  }
}

export function estimateExtractionMetrics(
  startTime: number,
  endTime: number,
  fps: FpsPreset,
  format: ImageFormat,
  quality: number,
  width: number,
  height: number
) {
  const duration = Math.max(0, endTime - startTime);
  const totalFrames = duration > 0 && fps > 0 ? Math.floor(duration * fps) + 1 : 0;
  const pixels = (width || 1920) * (height || 1080);

  let bytesPerFrame = 250000;
  if (format === 'image/png') {
    bytesPerFrame = pixels * 0.82; // PNG lossless bitmap overhead
  } else if (format === 'image/jpeg') {
    bytesPerFrame = pixels * (0.05 + 0.14 * quality);
  } else if (format === 'image/webp') {
    bytesPerFrame = pixels * (0.03 + 0.08 * quality);
  }

  const pngReferenceBytes = pixels * 0.82;
  const spaceSavingsPct =
    format === 'image/png'
      ? 0
      : Math.max(0, Math.min(95, Math.round((1 - bytesPerFrame / pngReferenceBytes) * 100)));

  const totalBytes = totalFrames * bytesPerFrame;
  const rawCanvasBufferBytes = pixels * 4;

  return {
    totalFrames,
    bytesPerFrame,
    totalBytes,
    rawCanvasBufferBytes,
    spaceSavingsPct,
    pixels,
  };
}

/**
 * Probes the true video duration by seeking to 1e101 to bypass WebM/Chromium 3s duration truncation
 */
export async function probeTrueVideoDuration(videoEl: HTMLVideoElement): Promise<number> {
  return new Promise((resolve) => {
    let timeoutId: NodeJS.Timeout | null = null;

    const cleanup = () => {
      videoEl.removeEventListener('seeked', onSeeked);
      videoEl.removeEventListener('error', onError);
    };

    const finish = (val: number) => {
      if (timeoutId) clearTimeout(timeoutId);
      cleanup();
      videoEl.currentTime = 0;
      resolve(Number.isFinite(val) && val > 0 ? val : (Number.isFinite(videoEl.duration) ? videoEl.duration : 10));
    };

    const onSeeked = () => {
      const trueEnd = videoEl.currentTime > 0 ? videoEl.currentTime : videoEl.duration;
      finish(trueEnd);
    };

    const onError = () => {
      finish(videoEl.duration);
    };

    videoEl.addEventListener('seeked', onSeeked, { once: true });
    videoEl.addEventListener('error', onError, { once: true });

    timeoutId = setTimeout(() => {
      finish(videoEl.duration);
    }, 1500);

    try {
      videoEl.currentTime = 1e101;
    } catch {
      finish(videoEl.duration);
    }
  });
}

/**
 * 3-Stage seek watchdog with +1.5ms nudge to ensure exact timestamp landing
 */
export async function seekAndDecodeFrame(
  videoEl: HTMLVideoElement,
  targetTime: number,
  duration: number,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  format: ImageFormat,
  quality: number,
  onNudge?: () => void
): Promise<{ blob: Blob; nudged: boolean }> {
  let attempt = 0;
  let currentSeek = Math.min(Math.max(0, targetTime), duration);
  const maxRetries = 3;

  while (attempt <= maxRetries) {
    try {
      await new Promise<void>((resolve, reject) => {
        let timer: NodeJS.Timeout | null = null;

        const cleanup = () => {
          if (timer) clearTimeout(timer);
          videoEl.removeEventListener('seeked', onSeeked);
          videoEl.removeEventListener('error', onError);
        };

        const onSeeked = () => {
          cleanup();
          if (videoEl.readyState >= 2) {
            resolve();
          } else {
            const onCanPlay = () => {
              videoEl.removeEventListener('canplay', onCanPlay);
              resolve();
            };
            videoEl.addEventListener('canplay', onCanPlay, { once: true });
            setTimeout(resolve, 200);
          }
        };

        const onError = (e: unknown) => {
          cleanup();
          reject(e instanceof Error ? e : new Error('Seek error'));
        };

        timer = setTimeout(() => {
          cleanup();
          reject(new Error('Seek watchdog timeout (>1200ms)'));
        }, 1200);

        videoEl.addEventListener('seeked', onSeeked, { once: true });
        videoEl.addEventListener('error', onError, { once: true });

        videoEl.currentTime = currentSeek;
      });

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b || new Blob()), format, quality);
      });

      return { blob, nudged: attempt > 0 };
    } catch {
      attempt++;
      if (onNudge) onNudge();
      if (attempt > maxRetries) {
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((b) => resolve(b || new Blob()), format, quality);
        });
        return { blob, nudged: true };
      }
      currentSeek = Math.min(duration, currentSeek + 0.0015);
    }
  }

  return { blob: new Blob(), nudged: false };
}

/**
 * Synthesizes a vibrant 60FPS calibration video directly in browser using Canvas & MediaRecorder
 */
export async function generateSyntheticTestClip(durationSec = 10): Promise<{ blob: Blob; name: string }> {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create 2d canvas context');

  const stream = canvas.captureStream(60);
  let mimeType = 'video/webm;codecs=vp9';
  if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm;codecs=vp8';
  if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 8000000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const totalFrames = durationSec * 60;
  let frameCount = 0;
  recorder.start();

  const ball = { x: 200, y: 320, vx: 8.5, vy: 6.5, r: 34 };

  return new Promise((resolve) => {
    const drawFrame = () => {
      if (frameCount >= totalFrames) {
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          resolve({ blob, name: `synth_60fps_${durationSec}s` });
        };
        recorder.stop();
        return;
      }

      const t = frameCount / 60;

      // Dark obsidian background
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Subtle tech grid
      ctx.strokeStyle = '#1a2234';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Title & badge
      ctx.fillStyle = '#38bdf8';
      ctx.font = '600 16px "Inter", sans-serif';
      ctx.fillText('FRAME FORGE · 60FPS SYNTHETIC CALIBRATION STREAM', 48, 56);

      // Large timecode
      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 70px "JetBrains Mono", monospace';
      ctx.fillText(formatTimecode(t), 48, 160);

      // Frame counter badge
      ctx.fillStyle = '#22c55e';
      ctx.font = '700 28px "JetBrains Mono", monospace';
      const fStr = String(frameCount + 1).padStart(5, '0');
      ctx.fillText(`FRAME #${fStr} / ${totalFrames}`, 48, 215);

      // Radar sweep
      const centerX = 980;
      const centerY = 360;
      const radius = 150;

      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();

      const angle = (frameCount % 60) * ((Math.PI * 2) / 60);
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius);
      ctx.stroke();

      // Bouncing colorful orb
      ball.x += ball.vx;
      ball.y += ball.vy;
      if (ball.x - ball.r < 48 || ball.x + ball.r > 740) ball.vx *= -1;
      if (ball.y - ball.r < 250 || ball.y + ball.r > 640) ball.vy *= -1;

      const hue = (frameCount * 3.5) % 360;
      ctx.fillStyle = `hsl(${hue}, 90%, 60%)`;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fill();

      // Color calibration bar
      const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#f43f5e', '#ffffff'];
      const barW = (canvas.width - 96) / colors.length;
      colors.forEach((col, idx) => {
        ctx.fillStyle = col;
        ctx.fillRect(48 + idx * barW, 660, barW - 6, 20);
      });

      frameCount++;
      requestAnimationFrame(drawFrame);
    };

    drawFrame();
  });
}

export function detectGpuRenderer(): string {
  if (typeof document === 'undefined') return 'Direct3D11 / Metal';
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        if (typeof renderer === 'string') {
          const clean = renderer
            .replace(/ANGLE \(/i, '')
            .replace(/\)$/, '')
            .replace(/Direct3D11 vs_\d_\d ps_\d_\d/i, 'D3D11')
            .trim();
          return clean.length > 34 ? clean.substring(0, 34) + '...' : clean;
        }
      }
    }
    return 'Canvas 2D Engine';
  } catch {
    return 'Direct3D11 / Metal';
  }
}

