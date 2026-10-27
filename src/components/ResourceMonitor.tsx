'use client';

import React, { useState } from 'react';
import { Cpu, Database, HardDrive, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { HardwareTelemetry } from '../lib/types';
import { formatBytes } from '../lib/utils';

interface ResourceMonitorProps {
  telemetry: HardwareTelemetry;
  framesCount: number;
  estTotalBytes: number;
  isExtracting: boolean;
}

export function ResourceMonitor({
  telemetry,
  framesCount,
  estTotalBytes,
  isExtracting,
}: ResourceMonitorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const ramPercent =
    telemetry.ramTotalBytes > 0
      ? Math.min(100, Math.round((telemetry.ramUsedBytes / telemetry.ramTotalBytes) * 100))
      : 5;

  const freeDisk = Math.max(0, telemetry.diskTotalBytes - telemetry.diskUsedBytes);

  return (
    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/40 backdrop-blur-sm transition-all overflow-hidden text-xs">
      {/* Compact Minimalist Ribbon (Always Visible) */}
      <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 select-none">
        {/* Left: Status & Quick Metrics */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isExtracting ? 'bg-blue-400' : 'bg-emerald-400'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isExtracting ? 'bg-blue-500' : 'bg-emerald-500'}`}></span>
            </span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 text-[11px] uppercase tracking-wider">
              {isExtracting ? 'Engine Active' : 'System Ready'}
            </span>
          </div>

          {/* Micro Telemetry Items */}
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <Database className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-slate-400">RAM:</span>
            <span className="text-slate-800 dark:text-slate-200 font-medium">
              {telemetry.ramTotalBytes > 0
                ? `${formatBytes(telemetry.ramUsedBytes)} (${ramPercent}%)`
                : `${formatBytes(telemetry.inMemoryBlobBytes || 0)}`}
            </span>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <Cpu className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-slate-400">CPU:</span>
            <span className="text-slate-800 dark:text-slate-200 font-medium">
              {telemetry.cpuCores}c • {telemetry.loopLatencyMs}ms
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1.5 font-mono text-[11px]">
            <HardDrive className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-slate-400">Disk:</span>
            <span className="text-slate-800 dark:text-slate-200 font-medium">
              {telemetry.diskTotalBytes > 0 ? `${formatBytes(freeDisk)} Free` : 'Direct Storage'}
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-1.5 font-mono text-[11px]">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-slate-400">GPU:</span>
            <span className="text-slate-800 dark:text-slate-200 font-medium truncate max-w-[180px]" title={telemetry.gpuRenderer}>
              {telemetry.gpuRenderer.split(' ')[0]} (Accel)
            </span>
          </div>
        </div>

        {/* Right: Expand Details Toggle */}
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
        >
          <span>{isExpanded ? 'Hide Details' : 'Details'}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expanded Detailed Grid (Collapsible) */}
      {isExpanded && (
        <div className="border-t border-slate-200/60 dark:border-slate-800/60 p-3 sm:p-4 bg-slate-50/50 dark:bg-slate-950/40 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-in fade-in duration-150">
          {/* RAM Detail */}
          <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60">
            <div className="text-[10px] text-slate-400 uppercase tracking-wide font-medium flex items-center justify-between mb-1">
              <span>RAM Allocation</span>
              <span className="text-blue-500 font-mono">{ramPercent}%</span>
            </div>
            <div className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
              {telemetry.ramTotalBytes > 0
                ? `${formatBytes(telemetry.ramUsedBytes)} / ${formatBytes(telemetry.ramTotalBytes)}`
                : `${formatBytes(telemetry.inMemoryBlobBytes)} Active`}
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full mt-2 overflow-hidden">
              <div className="bg-blue-500 h-full rounded-full transition-all" style={{ width: `${ramPercent}%` }} />
            </div>
            <div className="text-[10px] text-slate-500 mt-1 truncate">
              {framesCount > 0 ? `${framesCount} frames in RAM buffer` : 'Heap buffer optimal'}
            </div>
          </div>

          {/* CPU Detail */}
          <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60">
            <div className="text-[10px] text-slate-400 uppercase tracking-wide font-medium flex items-center justify-between mb-1">
              <span>CPU & Threads</span>
              <span className="text-indigo-500 font-mono">{telemetry.cpuCores} Cores</span>
            </div>
            <div className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
              {telemetry.loopLatencyMs}ms Loop Latency
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full mt-2 overflow-hidden">
              <div className="bg-indigo-500 h-full rounded-full w-4/5" />
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Engine: {isExtracting ? `${telemetry.decodeFps.toFixed(1)} FPS Active` : 'Standby'}
            </div>
          </div>

          {/* Disk Detail */}
          <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60">
            <div className="text-[10px] text-slate-400 uppercase tracking-wide font-medium flex items-center justify-between mb-1">
              <span>Disk Space</span>
              <span className="text-emerald-500 font-mono">Available</span>
            </div>
            <div className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
              {telemetry.diskTotalBytes > 0 ? `${formatBytes(freeDisk)} Free` : 'Browser API'}
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full mt-2 overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full w-1/12" />
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Required: ~{formatBytes(estTotalBytes)}
            </div>
          </div>

          {/* GPU Detail */}
          <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60">
            <div className="text-[10px] text-slate-400 uppercase tracking-wide font-medium flex items-center justify-between mb-1">
              <span>GPU Pipeline</span>
              <span className="text-amber-500 font-mono">Accelerated</span>
            </div>
            <div className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 truncate" title={telemetry.gpuRenderer}>
              {telemetry.gpuRenderer}
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full mt-2 overflow-hidden">
              <div className="bg-amber-500 h-full rounded-full w-full" />
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Canvas 2D: Hardware Accelerated
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
