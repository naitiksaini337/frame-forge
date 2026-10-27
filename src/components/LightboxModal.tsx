'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Copy,
  Check,
} from 'lucide-react';
import { ExtractedFrame } from '../lib/types';
import { formatBytes, formatTimecode } from '../lib/utils';

interface LightboxModalProps {
  frames: ExtractedFrame[];
  initialIndex: number | null;
  onClose: () => void;
  onDownloadFrame: (frame: ExtractedFrame) => void;
}

export function LightboxModal({
  frames,
  initialIndex,
  onClose,
  onDownloadFrame,
}: LightboxModalProps) {
  const [currentIndex, setCurrentIndex] = useState<number>(initialIndex ?? 0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackFps, setPlaybackFps] = useState(24);
  const [copied, setCopied] = useState(false);
  const animFrameRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  // Flipbook player loop
  useEffect(() => {
    if (!isPlaying || frames.length <= 1) return;

    lastTickRef.current = performance.now();
    const intervalMs = 1000 / playbackFps;

    const tick = (now: number) => {
      if (now - lastTickRef.current >= intervalMs) {
        lastTickRef.current = now;
        setCurrentIndex((prev) => (prev + 1) % frames.length);
      }
      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, playbackFps, frames.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        setCurrentIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight') {
        setCurrentIndex((prev) => Math.min(frames.length - 1, prev + 1));
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [frames.length, onClose]);

  if (initialIndex === null || frames.length === 0) return null;

  const currentFrame = frames[currentIndex] || frames[0];

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && currentFrame.blob) {
        // PNG or JPEG direct clipboard write
        const item = new ClipboardItem({ [currentFrame.blob.type]: currentFrame.blob });
        await navigator.clipboard.write([item]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Fallback
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in">
      <div className="relative w-full max-w-5xl bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 text-white bg-slate-900/60">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold text-blue-400 bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800/60">
              #{String(currentIndex + 1).padStart(5, '0')} / {frames.length}
            </span>
            <span className="text-xs font-mono font-medium truncate max-w-xs sm:max-w-md text-slate-300">
              {currentFrame.filename}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400 mr-2 hidden sm:inline">
              {formatTimecode(currentFrame.timestamp)} • {formatBytes(currentFrame.size)}
            </span>

            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Copy Image to Clipboard"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>

            <button
              onClick={() => onDownloadFrame(currentFrame)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Download Frame"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Frame Canvas / Image Viewport */}
        <div className="flex-1 min-h-[300px] max-h-[68vh] overflow-hidden bg-black/60 flex items-center justify-center p-2 relative select-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentFrame.url}
            alt={currentFrame.filename}
            className="max-h-full max-w-full object-contain rounded-lg shadow-lg"
          />
        </div>

        {/* Flipbook Controls Footer */}
        <div className="px-4 py-3 bg-slate-900/80 border-t border-slate-800 flex flex-col gap-2">
          {/* Scrubber */}
          <input
            type="range"
            min={0}
            max={frames.length - 1}
            value={currentIndex}
            onChange={(e) => {
              setIsPlaying(false);
              setCurrentIndex(parseInt(e.target.value) || 0);
            }}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
            {/* Stepper Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentIndex(0);
                }}
                disabled={currentIndex === 0}
                className="p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-40 transition-colors"
                title="First Frame"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentIndex((prev) => Math.max(0, prev - 1));
                }}
                disabled={currentIndex === 0}
                className="p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-40 transition-colors"
                title="Previous Frame (Left Arrow)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsPlaying((p) => !p)}
                className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                title="Play/Pause Flipbook (Space)"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? 'Pause' : 'Flipbook Play'}</span>
              </button>

              <button
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentIndex((prev) => Math.min(frames.length - 1, prev + 1));
                }}
                disabled={currentIndex === frames.length - 1}
                className="p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-40 transition-colors"
                title="Next Frame (Right Arrow)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentIndex(frames.length - 1);
                }}
                disabled={currentIndex === frames.length - 1}
                className="p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-40 transition-colors"
                title="Last Frame"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>

            {/* Playback FPS Rate */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-mono">Speed:</span>
              <div className="flex items-center gap-1">
                {[12, 24, 30, 60].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => setPlaybackFps(rate)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium transition-colors ${
                      playbackFps === rate
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {rate}fps
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
