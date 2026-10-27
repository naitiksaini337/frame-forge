export type FpsPreset = 10 | 24 | 30 | 45 | 60;

export type ImageFormat = 'image/webp' | 'image/png' | 'image/jpeg';

export type ScalePreset = 'orig' | '4k' | '1080p' | '720p' | '480p' | 'custom';

export interface VideoMetadata {
  file: File | null;
  name: string;
  url: string;
  duration: number;
  width: number;
  height: number;
  size: number;
}

export interface ExtractedFrame {
  id: string;
  index: number;
  timestamp: number;
  blob: Blob;
  url: string;
  size: number;
  filename: string;
  selected: boolean;
}

export interface HardwareTelemetry {
  ramUsedBytes: number;
  ramTotalBytes: number;
  inMemoryBlobBytes: number;
  cpuCores: number;
  loopLatencyMs: number;
  decodeFps: number;
  diskUsedBytes: number;
  diskTotalBytes: number;
  gpuRenderer: string;
}

export interface ExtractionProgress {
  current: number;
  total: number;
  percent: number;
  fps: number;
  elapsedMs: number;
  etaMs: number;
}

export interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

