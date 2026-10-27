'use client';

import React, { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, Layers, Image as ImageIcon, FileText } from 'lucide-react';
import { FpsPreset, ImageFormat, ScalePreset } from '../lib/types';
import { formatBytes, generateFrameFilename } from '../lib/utils';

interface SettingsPanelProps {
  fps: FpsPreset;
  onFpsChange: (fps: FpsPreset) => void;
  format: ImageFormat;
  onFormatChange: (format: ImageFormat) => void;
  quality: number;
  onQualityChange: (quality: number) => void;
  scalePreset: ScalePreset;
  onScalePresetChange: (preset: ScalePreset) => void;
  customWidth: number;
  customHeight: number;
  onCustomDimensionsChange: (w: number, h: number) => void;
  customNamePrefix: string;
  onCustomNamePrefixChange: (prefix: string) => void;
  namingPattern: string;
  onNamingPatternChange: (pattern: string) => void;
  splitBatchSize: number;
  onSplitBatchSizeChange: (batch: number) => void;
  includeManifest: boolean;
  onIncludeManifestChange: (include: boolean) => void;
  totalEstimatedFrames: number;
  estTotalBytes: number;
  estPerFrameBytes: number;
  spaceSavingsPct: number;
  targetWidth: number;
  targetHeight: number;
  videoName: string;
  isExtracting: boolean;
  onStartExtraction: () => void;
  hasVideo: boolean;
}

export function SettingsPanel({
  fps,
  onFpsChange,
  format,
  onFormatChange,
  quality,
  onQualityChange,
  scalePreset,
  onScalePresetChange,
  customWidth,
  customHeight,
  onCustomDimensionsChange,
  customNamePrefix,
  onCustomNamePrefixChange,
  namingPattern,
  onNamingPatternChange,
  splitBatchSize,
  onSplitBatchSizeChange,
  includeManifest,
  onIncludeManifestChange,
  totalEstimatedFrames,
  estTotalBytes,
  spaceSavingsPct,
  targetWidth,
  targetHeight,
  videoName,
  isExtracting,
  onStartExtraction,
  hasVideo,
}: SettingsPanelProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Exactly 5 FPS presets requested by user
  const fpsPresets: FpsPreset[] = [10, 24, 30, 45, 60];

  const livePreviewFilename = generateFrameFilename(
    namingPattern,
    customNamePrefix,
    videoName || 'sample',
    1,
    0,
    format
  );

  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/50 backdrop-blur-sm p-4 sm:p-6 shadow-sm transition-all flex flex-col gap-5">
      {/* Primary Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left: Frame Rate Presets */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-500" />
              Frame Rate (FPS)
            </label>
            <span className="text-[11px] font-mono text-slate-400">
              {(1 / fps).toFixed(3)}s / frame
            </span>
          </div>

          <div className="grid grid-cols-5 gap-1.5 p-1 bg-slate-100 dark:bg-slate-950/60 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
            {fpsPresets.map((rate) => {
              const active = fps === rate;
              return (
                <button
                  key={rate}
                  type="button"
                  onClick={() => onFpsChange(rate)}
                  disabled={isExtracting}
                  className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-900/50'
                  } disabled:opacity-40 cursor-pointer`}
                >
                  {rate}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Image Format & Quality */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
              Image Format
            </label>
            {spaceSavingsPct > 0 ? (
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                ~{spaceSavingsPct}% smaller
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                Lossless
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-950/60 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
            {[
              { id: 'image/webp', label: 'WebP' },
              { id: 'image/png', label: 'PNG' },
              { id: 'image/jpeg', label: 'JPEG' },
            ].map((fmt) => {
              const active = format === fmt.id;
              return (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => onFormatChange(fmt.id as ImageFormat)}
                  disabled={isExtracting}
                  className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                    active
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-900/50'
                  } disabled:opacity-40 cursor-pointer`}
                >
                  {fmt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 2: Resolution & Custom Prefix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Resolution Selector */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Resolution
            </label>
            <span className="text-[11px] font-mono text-slate-400">
              {targetWidth} × {targetHeight}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 dark:bg-slate-950/60 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
            {[
              { id: 'orig', label: 'Original' },
              { id: '1080p', label: '1080p' },
              { id: '720p', label: '720p' },
              { id: '480p', label: '480p' },
              { id: '4k', label: '4K' },
              { id: 'custom', label: 'Custom' },
            ].map((res) => {
              const active = scalePreset === res.id;
              return (
                <button
                  key={res.id}
                  type="button"
                  onClick={() => onScalePresetChange(res.id as ScalePreset)}
                  disabled={isExtracting}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                    active
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  } disabled:opacity-40 cursor-pointer`}
                >
                  {res.label}
                </button>
              );
            })}
          </div>

          {scalePreset === 'custom' && (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="number"
                min={64}
                max={7680}
                value={customWidth}
                onChange={(e) => onCustomDimensionsChange(parseInt(e.target.value) || 1920, customHeight)}
                className="w-1/2 px-2.5 py-1 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                placeholder="Width"
              />
              <span className="text-slate-400 font-bold text-xs">×</span>
              <input
                type="number"
                min={64}
                max={4320}
                value={customHeight}
                onChange={(e) => onCustomDimensionsChange(customWidth, parseInt(e.target.value) || 1080)}
                className="w-1/2 px-2.5 py-1 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                placeholder="Height"
              />
            </div>
          )}
        </div>

        {/* Custom Naming Prefix & Live Filename */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-amber-500" />
              Filename Prefix
            </label>
            <span className="font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              {livePreviewFilename}
            </span>
          </div>

          <div className="relative">
            <input
              type="text"
              value={customNamePrefix}
              placeholder="e.g. shot_01, frame, scene"
              onChange={(e) => onCustomNamePrefixChange(e.target.value)}
              disabled={isExtracting}
              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Advanced Options Collapsible (Pattern & Split ZIP) */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setShowAdvanced((prev) => !prev)}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
        >
          {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span>{showAdvanced ? 'Hide Advanced Options' : 'Advanced Packaging Options'}</span>
        </button>

        {showAdvanced && (
          <div className="mt-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in text-xs">
            {/* Pattern */}
            <div>
              <label className="text-[11px] text-slate-400 font-medium block mb-1">
                Token Pattern
              </label>
              <select
                value={namingPattern}
                onChange={(e) => onNamingPatternChange(e.target.value)}
                disabled={isExtracting}
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
              >
                <option value="{name}_{index:5}">{'{name}_{index:5}'}</option>
                <option value="{videoname}_{name}_{index:5}">{'{videoname}_{name}_{index:5}'}</option>
                <option value="{name}_frame_{index:4}">{'{name}_frame_{index:4}'}</option>
                <option value="{name}_{timecode}">{'{name}_{timecode}'}</option>
              </select>
            </div>

            {/* Split ZIP */}
            <div>
              <label className="text-[11px] text-slate-400 font-medium block mb-1">
                Batch ZIP Partitioning
              </label>
              <select
                value={splitBatchSize}
                onChange={(e) => onSplitBatchSizeChange(parseInt(e.target.value) || 0)}
                disabled={isExtracting}
                className="w-full px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
              >
                <option value={0}>Single ZIP (All frames)</option>
                <option value={250}>Split every 250 frames</option>
                <option value={500}>Split every 500 frames</option>
                <option value={1000}>Split every 1000 frames</option>
              </select>
            </div>

            {/* Quality Slider (for lossy formats) */}
            {format !== 'image/png' && (
              <div className="sm:col-span-2 pt-1">
                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                  <span>Compression Quality: {Math.round(quality * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={1.0}
                  step={0.02}
                  value={quality}
                  onChange={(e) => onQualityChange(parseFloat(e.target.value))}
                  className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>
            )}

            {/* Manifest Checkbox */}
            <div className="sm:col-span-2 pt-1">
              <label className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeManifest}
                  onChange={(e) => onIncludeManifestChange(e.target.checked)}
                  disabled={isExtracting}
                  className="w-3.5 h-3.5 rounded text-blue-600 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
                <span>Include manifest.json in ZIP archives</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Action Footer: Live Estimated Summary & Extract Button */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Estimated pill */}
        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
          Est. Output: <span className="font-bold text-slate-900 dark:text-slate-100">{totalEstimatedFrames.toLocaleString()} frames</span> • <span className="font-bold text-blue-600 dark:text-blue-400">~{formatBytes(estTotalBytes)}</span>
        </div>

        {/* Primary CTA */}
        <button
          type="button"
          onClick={onStartExtraction}
          disabled={!hasVideo || isExtracting || totalEstimatedFrames <= 0}
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs tracking-wider uppercase text-white bg-blue-600 hover:bg-blue-500 active:scale-95 shadow-md shadow-blue-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{hasVideo ? `Extract ${totalEstimatedFrames.toLocaleString()} Frames` : 'Load Video to Extract'}</span>
        </button>
      </div>
    </div>
  );
}
