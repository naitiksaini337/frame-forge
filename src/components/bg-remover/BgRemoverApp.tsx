'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Layers,
  Image as ImageIcon,
  Cpu,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { SingleRemover } from './SingleRemover';
import { BatchRemover } from './BatchRemover';

export function BgRemoverApp() {
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');

  // Check WebGPU capability
  const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;

  return (
    <div className="space-y-6">
      {/* Feature Sub-Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-500" />
              AI Background Remover
            </h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/50">
              100% Client-Side
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl">
            High-precision neural matting running purely inside your browser using{' '}
            <strong className="text-slate-700 dark:text-slate-300">
              {hasWebGPU ? 'WebGPU Acceleration' : 'WebAssembly Multithreading'}
            </strong>
            . Zero API keys, zero cloud uploads.
          </p>
        </div>

        {/* Mode Selector Pill */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/90 p-1 rounded-xl border border-slate-200 dark:border-slate-700/80 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('single')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'single'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Single Photo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('batch')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'batch'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Batch Queue</span>
          </button>
        </div>
      </div>

      {/* Feature Content */}
      <div className="min-h-[480px]">
        {activeTab === 'single' ? <SingleRemover /> : <BatchRemover />}
      </div>
    </div>
  );
}

