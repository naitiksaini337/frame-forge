'use client';

import React from 'react';
import { Film, Sparkles, RotateCcw, Moon, Sun } from 'lucide-react';

interface HeaderProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onReset: () => void;
  onGenerateSynth: () => void;
  isSynthesizing: boolean;
  hasVideo: boolean;
  isExtracting: boolean;
}

export function Header({
  isDarkMode,
  onToggleTheme,
  onReset,
  onGenerateSynth,
  isSynthesizing,
  hasVideo,
  isExtracting,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-[#090d16]/80 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 shadow-md shadow-blue-500/20 text-white">
            <Film className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                Frame Forge
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/50">
                PRO
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              High-Speed Browser Video Frame Archiver
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Synth Test Clip */}
          <button
            onClick={onGenerateSynth}
            disabled={isSynthesizing || isExtracting}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            title="Generate a 10s 60FPS calibration video directly in browser"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
            {isSynthesizing ? 'Synthesizing...' : 'Quick Synth (60FPS)'}
          </button>

          {/* Reset All */}
          <button
            onClick={onReset}
            disabled={isExtracting || (!hasVideo && !isSynthesizing)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            title="Reset video, extraction parameters, and frame gallery"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset All</span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors"
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>
        </div>
      </div>
    </header>
  );
}
