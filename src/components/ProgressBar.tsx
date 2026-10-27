'use client';

import React from 'react';
import { Loader2, XCircle, Clock, Zap, AlertTriangle } from 'lucide-react';
import { ExtractionProgress } from '../lib/types';
import { formatTimecode } from '../lib/utils';

interface ProgressBarProps {
  progress: ExtractionProgress;
  onCancel: () => void;
  watchdogNudges: number;
}

export function ProgressBar({ progress, onCancel, watchdogNudges }: ProgressBarProps) {
  const percentRounded = Math.min(100, Math.max(0, progress.percent)).toFixed(1);

  return (
    <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-blue-200 dark:border-blue-900/60 p-4 sm:p-5 shadow-lg shadow-blue-500/5 backdrop-blur-sm transition-all animate-in fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Extracting Frame Sequence
              </h3>
              <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                {percentRounded}%
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              Frame {progress.current} of {progress.total}
            </p>
          </div>
        </div>

        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-900/50 transition-colors"
        >
          <XCircle className="w-3.5 h-3.5" />
          Cancel Extraction
        </button>
      </div>

      {/* Progress Track */}
      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden mb-3 relative">
        <div
          className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 rounded-full transition-all duration-150"
          style={{ width: `${percentRounded}%` }}
        />
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
        <div className="bg-slate-50 dark:bg-slate-950/50 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800/60">
          <span className="text-[10px] text-slate-400 block">Decode Speed</span>
          <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-500" />
            {progress.fps.toFixed(1)} FPS
          </span>
        </div>

        <div className="bg-slate-50 dark:bg-slate-950/50 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800/60">
          <span className="text-[10px] text-slate-400 block">Elapsed Time</span>
          <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
            <Clock className="w-3 h-3 text-blue-500" />
            {formatTimecode(progress.elapsedMs / 1000)}
          </span>
        </div>

        <div className="bg-slate-50 dark:bg-slate-950/50 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800/60">
          <span className="text-[10px] text-slate-400 block">Estimated Remaining</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">
            {progress.etaMs > 0 ? formatTimecode(progress.etaMs / 1000) : 'Calculating...'}
          </span>
        </div>

        <div className="bg-slate-50 dark:bg-slate-950/50 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800/60">
          <span className="text-[10px] text-slate-400 block">Watchdog Nudges</span>
          <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
            <AlertTriangle className={`w-3 h-3 ${watchdogNudges > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
            {watchdogNudges}
          </span>
        </div>
      </div>
    </div>
  );
}
