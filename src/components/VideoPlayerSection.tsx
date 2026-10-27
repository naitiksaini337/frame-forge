'use client';

import React, { useRef, useState, useEffect } from 'react';
import { UploadCloud, Play, Pause, RefreshCw, Sparkles } from 'lucide-react';
import { VideoMetadata } from '../lib/types';
import { formatTimecode } from '../lib/utils';

interface VideoPlayerSectionProps {
  metadata: VideoMetadata | null;
  onFileSelected: (file: File) => void;
  onGenerateSynth: () => void;
  isSynthesizing: boolean;
  startTime: number;
  endTime: number;
  onRangeChange: (start: number, end: number) => void;
  onResetVideo: () => void;
  isExtracting: boolean;
}

export function VideoPlayerSection({
  metadata,
  onFileSelected,
  onGenerateSynth,
  isSynthesizing,
  startTime,
  endTime,
  onRangeChange,
  onResetVideo,
  isExtracting,
}: VideoPlayerSectionProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onEnded = () => setIsPlaying(false);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('ended', onEnded);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, [metadata]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
  };

  const handleSeek = (time: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('video/')) {
        onFileSelected(file);
      }
    }
  };

  // Minimalist Dropzone
  if (!metadata) {
    return (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`rounded-2xl border-2 border-dashed p-8 sm:p-12 text-center transition-all bg-white/60 dark:bg-slate-900/40 backdrop-blur-sm ${
          isDragging
            ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/20'
            : 'border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              onFileSelected(e.target.files[0]);
            }
          }}
        />

        <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
            <UploadCloud className="w-6 h-6" />
          </div>

          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
            Drop your video file here
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-5">
            MP4, WebM, MOV, MKV • Processed locally in browser
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-sm cursor-pointer"
            >
              Browse Video
            </button>

            <button
              onClick={onGenerateSynth}
              disabled={isSynthesizing}
              className="px-3.5 py-2 text-xs font-medium rounded-xl text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              {isSynthesizing ? 'Creating...' : 'Try 60FPS Demo'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const duration = metadata.duration || 10;
  const span = Math.max(0, endTime - startTime);

  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/50 backdrop-blur-sm p-4 sm:p-5 shadow-sm transition-all flex flex-col gap-4">
      {/* File Info Bar */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-xs sm:max-w-md">
            {metadata.name}
          </span>
          <span className="font-mono text-slate-400 text-[11px] shrink-0">
            {metadata.width}×{metadata.height} • {formatTimecode(duration)}
          </span>
        </div>

        <button
          onClick={onResetVideo}
          disabled={isExtracting}
          className="text-[11px] font-medium text-slate-400 hover:text-rose-500 transition-colors flex items-center gap-1 disabled:opacity-40 cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" />
          Change
        </button>
      </div>

      {/* Video Viewport */}
      <div className="relative rounded-xl overflow-hidden bg-black aspect-video max-h-[300px] flex items-center justify-center group">
        <video
          ref={videoRef}
          src={metadata.url}
          className="w-full h-full object-contain"
          playsInline
        />

        {/* Play/Pause Button */}
        <button
          onClick={togglePlay}
          className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 cursor-pointer hover:scale-105"
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </button>

        {/* Bottom Scrubber Bar */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2.5 pt-6 flex flex-col gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
          <input
            type="range"
            min={0}
            max={duration}
            step={0.01}
            value={currentTime}
            onChange={(e) => handleSeek(parseFloat(e.target.value))}
            className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex items-center justify-between text-[10px] font-mono text-white/90">
            <span>{formatTimecode(currentTime)}</span>
            <span>{formatTimecode(duration)}</span>
          </div>
        </div>
      </div>

      {/* Simplified Range Trimmer */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Range:</span>
          <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
            {startTime.toFixed(2)}s → {endTime.toFixed(2)}s
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            ({span.toFixed(2)}s window)
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onRangeChange(currentTime, Math.max(currentTime, endTime))}
            className="px-2 py-0.5 text-[11px] rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
          >
            Start at {currentTime.toFixed(1)}s
          </button>
          <button
            onClick={() => onRangeChange(Math.min(startTime, currentTime), currentTime)}
            className="px-2 py-0.5 text-[11px] rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
          >
            End at {currentTime.toFixed(1)}s
          </button>
          <button
            onClick={() => onRangeChange(0, duration)}
            className="px-2 py-0.5 text-[11px] rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors cursor-pointer"
          >
            Full (100%)
          </button>
        </div>
      </div>
    </div>
  );
}
