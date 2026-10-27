'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import JSZip from 'jszip';
import { Header } from '../components/Header';
import { ResourceMonitor } from '../components/ResourceMonitor';
import { VideoPlayerSection } from '../components/VideoPlayerSection';
import { SettingsPanel } from '../components/SettingsPanel';
import { ProgressBar } from '../components/ProgressBar';
import { FramesGallery } from '../components/FramesGallery';
import { LightboxModal } from '../components/LightboxModal';
import {
  FpsPreset,
  ImageFormat,
  ScalePreset,
  VideoMetadata,
  ExtractedFrame,
  HardwareTelemetry,
  ExtractionProgress,
  PerformanceMemory,
} from '../lib/types';
import {
  probeTrueVideoDuration,
  seekAndDecodeFrame,
  generateSyntheticTestClip,
  calculateTargetResolution,
  estimateExtractionMetrics,
  generateFrameFilename,
  detectGpuRenderer,
} from '../lib/utils';

export default function FrameForgePage() {
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Video state
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  // Extraction Settings
  const [fps, setFps] = useState<FpsPreset>(30); // 10, 24, 30, 45, 60
  const [format, setFormat] = useState<ImageFormat>('image/webp');
  const [quality, setQuality] = useState(0.92);
  const [scalePreset, setScalePreset] = useState<ScalePreset>('orig');
  const [customWidth, setCustomWidth] = useState(1920);
  const [customHeight, setCustomHeight] = useState(1080);
  const [customNamePrefix, setCustomNamePrefix] = useState('frame');
  const [namingPattern, setNamingPattern] = useState('{name}_{index:5}');
  const [splitBatchSize, setSplitBatchSize] = useState(0);
  const [includeManifest, setIncludeManifest] = useState(true);

  // Progress & Execution State
  const [isExtracting, setIsExtracting] = useState(false);
  const [watchdogNudges, setWatchdogNudges] = useState(0);
  const [progress, setProgress] = useState<ExtractionProgress>({
    current: 0,
    total: 0,
    percent: 0,
    fps: 0,
    elapsedMs: 0,
    etaMs: 0,
  });

  // Frames & Gallery State
  const [frames, setFrames] = useState<ExtractedFrame[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [zipDownloadStatus, setZipDownloadStatus] = useState('');

  // Hardware Telemetry State
  const [telemetry, setTelemetry] = useState<HardwareTelemetry>(() => ({
    ramUsedBytes: 0,
    ramTotalBytes: 0,
    inMemoryBlobBytes: 0,
    cpuCores: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 8 : 8,
    loopLatencyMs: 16.6,
    decodeFps: 0,
    diskUsedBytes: 0,
    diskTotalBytes: 0,
    gpuRenderer: detectGpuRenderer(),
  }));

  // Offscreen Video & Canvas DOM references
  const offscreenVideoRef = useRef<HTMLVideoElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cancelRequestedRef = useRef(false);

  // Synchronize Dark Theme class on <html>
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Target Resolution calculation
  const targetDims = calculateTargetResolution(
    scalePreset,
    videoMetadata?.width || 1920,
    videoMetadata?.height || 1080,
    customWidth,
    customHeight
  );

  // Live Sizing Metrics estimation
  const estMetrics = estimateExtractionMetrics(
    startTime,
    endTime,
    fps,
    format,
    quality,
    targetDims.width,
    targetDims.height
  );

  // Hardware Profiler loop
  useEffect(() => {
    let lastTime = performance.now();
    let animId: number;

    const measureHeartbeat = (now: number) => {
      const delta = now - lastTime;
      lastTime = now;
      if (delta > 0 && delta < 1000) {
        setTelemetry((prev) => ({
          ...prev,
          loopLatencyMs: parseFloat(((prev.loopLatencyMs * 0.8) + (delta * 0.2)).toFixed(1)),
        }));
      }
      animId = requestAnimationFrame(measureHeartbeat);
    };
    animId = requestAnimationFrame(measureHeartbeat);

    const statsTimer = setInterval(async () => {
      let usedHeap = 0;
      let totalHeap = 0;
      if (typeof window !== 'undefined') {
        const perfWithMem = performance as unknown as { memory?: PerformanceMemory };
        if (perfWithMem.memory) {
          usedHeap = perfWithMem.memory.usedJSHeapSize;
          totalHeap = perfWithMem.memory.jsHeapSizeLimit;
        }
      }

      let diskUsed = 0;
      let diskTotal = 0;
      if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
        try {
          const est = await navigator.storage.estimate();
          diskUsed = est.usage || 0;
          diskTotal = est.quota || 0;
        } catch {
          // ignore
        }
      }

      setTelemetry((prev) => ({
        ...prev,
        ramUsedBytes: usedHeap,
        ramTotalBytes: totalHeap,
        diskUsedBytes: diskUsed,
        diskTotalBytes: diskTotal,
      }));
    }, 2000);

    return () => {
      cancelAnimationFrame(animId);
      clearInterval(statsTimer);
    };
  }, []);

  // Calculate in-memory blob size dynamically
  const inMemoryBlobBytes = frames.reduce((acc, f) => acc + f.size, 0);

  // Handle Video Loading
  const handleLoadVideo = useCallback(async (fileOrBlob: File | Blob, customName?: string) => {
    if (videoMetadata?.url) {
      URL.revokeObjectURL(videoMetadata.url);
    }
    frames.forEach((f) => URL.revokeObjectURL(f.url));
    setFrames([]);

    const url = URL.createObjectURL(fileOrBlob);
    const videoName =
      customName ||
      ('name' in fileOrBlob ? (fileOrBlob as File).name.replace(/\.[^/.]+$/, '') : 'video');

    const tempVideo = document.createElement('video');
    tempVideo.src = url;
    tempVideo.preload = 'metadata';

    await new Promise((resolve) => {
      tempVideo.onloadedmetadata = resolve;
    });

    const trueDuration = await probeTrueVideoDuration(tempVideo);
    const duration = trueDuration > 0 ? trueDuration : (tempVideo.duration || 10);
    const width = tempVideo.videoWidth || 1920;
    const height = tempVideo.videoHeight || 1080;

    const meta: VideoMetadata = {
      file: 'name' in fileOrBlob ? (fileOrBlob as File) : null,
      name: videoName,
      url,
      duration,
      width,
      height,
      size: fileOrBlob.size,
    };

    setVideoMetadata(meta);
    setStartTime(0);
    setEndTime(duration);
    setCustomNamePrefix(videoName);
  }, [videoMetadata, frames]);

  // Handle Quick Synth (10s 60FPS calibration clip)
  const handleQuickSynth = async () => {
    try {
      setIsSynthesizing(true);
      const { blob, name } = await generateSyntheticTestClip(10);
      await handleLoadVideo(blob, name);
    } catch (err) {
      console.error('Synthetic generation error:', err);
    } finally {
      setIsSynthesizing(false);
    }
  };

  // Reset All
  const handleReset = () => {
    if (videoMetadata?.url) {
      URL.revokeObjectURL(videoMetadata.url);
    }
    frames.forEach((f) => URL.revokeObjectURL(f.url));
    setFrames([]);
    setVideoMetadata(null);
    setStartTime(0);
    setEndTime(0);
    setIsExtracting(false);
    setLightboxIndex(null);
  };

  // Start Extraction Pipeline
  const handleStartExtraction = async () => {
    if (!videoMetadata || isExtracting) return;

    frames.forEach((f) => URL.revokeObjectURL(f.url));
    setFrames([]);
    setWatchdogNudges(0);
    cancelRequestedRef.current = false;
    setIsExtracting(true);

    const interval = 1 / fps;
    const timestamps: number[] = [];
    let t = startTime;
    while (t <= endTime + 0.0001) {
      timestamps.push(t);
      t += interval;
    }

    const total = timestamps.length;
    if (total === 0) {
      setIsExtracting(false);
      return;
    }

    let videoEl = offscreenVideoRef.current;
    if (!videoEl) {
      videoEl = document.createElement('video');
      videoEl.crossOrigin = 'anonymous';
      videoEl.preload = 'auto';
      videoEl.playsInline = true;
      offscreenVideoRef.current = videoEl;
    }
    videoEl.src = videoMetadata.url;

    let canvas = offscreenCanvasRef.current;
    if (!canvas) {
      canvas = document.createElement('canvas');
      offscreenCanvasRef.current = canvas;
    }
    canvas.width = targetDims.width;
    canvas.height = targetDims.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      setIsExtracting(false);
      return;
    }

    const startTimeEpoch = performance.now();
    const newFrames: ExtractedFrame[] = [];

    for (let i = 0; i < total; i++) {
      if (cancelRequestedRef.current) break;

      const targetTime = timestamps[i];
      const decodeResult = await seekAndDecodeFrame(
        videoEl,
        targetTime,
        videoMetadata.duration,
        canvas,
        ctx,
        format,
        quality,
        () => setWatchdogNudges((n) => n + 1)
      );

      const frameBlob = decodeResult.blob;
      const frameUrl = URL.createObjectURL(frameBlob);
      const filename = generateFrameFilename(
        namingPattern,
        customNamePrefix,
        videoMetadata.name,
        i + 1,
        targetTime,
        format
      );

      const frameObj: ExtractedFrame = {
        id: `f_${i + 1}_${Date.now()}`,
        index: i + 1,
        timestamp: targetTime,
        blob: frameBlob,
        url: frameUrl,
        size: frameBlob.size,
        filename,
        selected: true,
      };

      newFrames.push(frameObj);

      const count = i + 1;
      const percent = (count / total) * 100;
      const elapsedMs = performance.now() - startTimeEpoch;
      const currentFps = count / (elapsedMs / 1000);
      const remainingFrames = total - count;
      const etaMs = currentFps > 0 ? (remainingFrames / currentFps) * 1000 : 0;

      setProgress({
        current: count,
        total,
        percent,
        fps: currentFps,
        elapsedMs,
        etaMs,
      });

      setTelemetry((prev) => ({ ...prev, decodeFps: currentFps }));
    }

    setFrames(newFrames);
    setIsExtracting(false);
  };

  // Cancel Extraction
  const handleCancelExtraction = () => {
    cancelRequestedRef.current = true;
    setIsExtracting(false);
  };

  // Toggle Frame Selection
  const handleToggleSelect = (id: string) => {
    setFrames((prev) =>
      prev.map((f) => (f.id === id ? { ...f, selected: !f.selected } : f))
    );
  };

  const handleSelectAll = () => {
    setFrames((prev) => prev.map((f) => ({ ...f, selected: true })));
  };

  const handleDeselectAll = () => {
    setFrames((prev) => prev.map((f) => ({ ...f, selected: false })));
  };

  // Single Frame Download
  const handleDownloadSingleFrame = (frame: ExtractedFrame) => {
    const a = document.createElement('a');
    a.href = frame.url;
    a.download = frame.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Download Multi-Part ZIP Archives
  const handleDownloadZip = async (selectedOnly = false) => {
    const targetFrames = selectedOnly ? frames.filter((f) => f.selected) : frames;
    if (targetFrames.length === 0) return;

    setIsDownloadingZip(true);
    const batchSize = splitBatchSize > 0 ? splitBatchSize : targetFrames.length;
    const totalParts = Math.ceil(targetFrames.length / batchSize);

    for (let partIdx = 0; partIdx < totalParts; partIdx++) {
      const start = partIdx * batchSize;
      const end = Math.min(start + batchSize, targetFrames.length);
      const chunk = targetFrames.slice(start, end);

      setZipDownloadStatus(`Packaging Part ${partIdx + 1} of ${totalParts}...`);

      const zip = new JSZip();

      chunk.forEach((frame) => {
        zip.file(frame.filename, frame.blob);
      });

      if (includeManifest) {
        const manifest = {
          generator: 'Frame Forge Pro',
          sourceVideo: videoMetadata?.name,
          probedDuration: videoMetadata?.duration,
          part: partIdx + 1,
          totalParts,
          framesInPart: chunk.length,
          totalFrames: targetFrames.length,
          fps,
          resolution: `${targetDims.width}x${targetDims.height}`,
          namingPattern,
          customNamePrefix,
          frames: chunk.map((f) => ({
            index: f.index,
            filename: f.filename,
            timestamp: f.timestamp,
            sizeBytes: f.size,
          })),
        };
        zip.file('manifest.json', JSON.stringify(manifest, null, 2));
      }

      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
      const partSuffix = totalParts > 1 ? `_part${partIdx + 1}_of_${totalParts}` : '';
      const zipFilename = `${videoMetadata?.name || 'video'}_frames${partSuffix}.zip`;

      const downloadUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = zipFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);

      await new Promise((r) => setTimeout(r, 600));
    }

    setIsDownloadingZip(false);
    setZipDownloadStatus('');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#07090e] transition-colors">
      {/* Top Header */}
      <Header
        isDarkMode={isDarkMode}
        onToggleTheme={() => setIsDarkMode((prev) => !prev)}
        onReset={handleReset}
        onGenerateSynth={handleQuickSynth}
        isSynthesizing={isSynthesizing}
        hasVideo={!!videoMetadata}
        isExtracting={isExtracting}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-5 flex flex-col gap-4">
        {/* Minimalist System Telemetry Ribbon */}
        <ResourceMonitor
          telemetry={{ ...telemetry, inMemoryBlobBytes }}
          framesCount={frames.length}
          estTotalBytes={estMetrics.totalBytes}
          isExtracting={isExtracting}
        />

        {/* Workspace: Responsive Dual-Pane or Stack */}
        <div className={`grid grid-cols-1 ${videoMetadata ? 'lg:grid-cols-12' : ''} gap-4 items-start`}>
          {/* Left Column: Video Ingestion / Player */}
          <div className={videoMetadata ? 'lg:col-span-6 flex flex-col gap-4' : 'w-full'}>
            <VideoPlayerSection
              metadata={videoMetadata}
              onFileSelected={(file) => handleLoadVideo(file)}
              onGenerateSynth={handleQuickSynth}
              isSynthesizing={isSynthesizing}
              startTime={startTime}
              endTime={endTime}
              onRangeChange={(start, end) => {
                setStartTime(start);
                setEndTime(end);
              }}
              onResetVideo={handleReset}
              isExtracting={isExtracting}
            />
          </div>

          {/* Right Column: Settings & Extract Action */}
          <div className={videoMetadata ? 'lg:col-span-6 flex flex-col gap-4' : 'w-full'}>
            <SettingsPanel
              fps={fps}
              onFpsChange={setFps}
              format={format}
              onFormatChange={setFormat}
              quality={quality}
              onQualityChange={setQuality}
              scalePreset={scalePreset}
              onScalePresetChange={setScalePreset}
              customWidth={customWidth}
              customHeight={customHeight}
              onCustomDimensionsChange={(w, h) => {
                setCustomWidth(w);
                setCustomHeight(h);
              }}
              customNamePrefix={customNamePrefix}
              onCustomNamePrefixChange={setCustomNamePrefix}
              namingPattern={namingPattern}
              onNamingPatternChange={setNamingPattern}
              splitBatchSize={splitBatchSize}
              onSplitBatchSizeChange={setSplitBatchSize}
              includeManifest={includeManifest}
              onIncludeManifestChange={setIncludeManifest}
              totalEstimatedFrames={estMetrics.totalFrames}
              estTotalBytes={estMetrics.totalBytes}
              estPerFrameBytes={estMetrics.bytesPerFrame}
              spaceSavingsPct={estMetrics.spaceSavingsPct}
              targetWidth={targetDims.width}
              targetHeight={targetDims.height}
              videoName={videoMetadata?.name || ''}
              isExtracting={isExtracting}
              onStartExtraction={handleStartExtraction}
              hasVideo={!!videoMetadata}
            />
          </div>
        </div>

        {/* Progress Display Bar (while extracting) */}
        {isExtracting && (
          <ProgressBar
            progress={progress}
            onCancel={handleCancelExtraction}
            watchdogNudges={watchdogNudges}
          />
        )}

        {/* Extracted Frame Gallery */}
        <FramesGallery
          frames={frames}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          onDownloadFrame={handleDownloadSingleFrame}
          onDownloadZip={handleDownloadZip}
          onOpenLightbox={(idx) => setLightboxIndex(idx)}
          isDownloadingZip={isDownloadingZip}
          zipDownloadStatus={zipDownloadStatus}
        />
      </main>

      {/* Lightbox Modal with Flipbook Animation */}
      <LightboxModal
        key={lightboxIndex ?? 'closed'}
        frames={frames}
        initialIndex={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onDownloadFrame={handleDownloadSingleFrame}
      />
    </div>
  );
}
