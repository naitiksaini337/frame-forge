'use client';

import React, { useState } from 'react';
import { Download, CheckSquare, Square, Eye, Archive } from 'lucide-react';
import { ExtractedFrame } from '../lib/types';
import { formatBytes, formatTimecode } from '../lib/utils';

interface FramesGalleryProps {
  frames: ExtractedFrame[];
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDownloadFrame: (frame: ExtractedFrame) => void;
  onDownloadZip: (selectedOnly: boolean) => void;
  onOpenLightbox: (index: number) => void;
  isDownloadingZip: boolean;
  zipDownloadStatus: string;
}

export function FramesGallery({
  frames,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onDownloadFrame,
  onDownloadZip,
  onOpenLightbox,
  isDownloadingZip,
  zipDownloadStatus,
}: FramesGalleryProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 48; // Paginate for ultra-smooth 60fps rendering even with 2000+ frames

  if (frames.length === 0) return null;

  const selectedCount = frames.filter((f) => f.selected).length;
  const totalFrames = frames.length;
  const totalBytes = frames.reduce((acc, f) => acc + f.size, 0);

  const totalPages = Math.max(1, Math.ceil(totalFrames / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const pageFrames = frames.slice(startIndex, startIndex + pageSize);

  return (
    <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm backdrop-blur-sm transition-all flex flex-col gap-4">
      {/* Gallery Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
              Extracted Frames Gallery
            </h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/50">
              {totalFrames} Frames ({formatBytes(totalBytes)})
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {selectedCount > 0
              ? `${selectedCount} of ${totalFrames} frames selected for export`
              : 'All frames selected for packaging'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Select all / none */}
          <button
            onClick={selectedCount === totalFrames ? onDeselectAll : onSelectAll}
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors flex items-center gap-1.5"
          >
            {selectedCount === totalFrames ? (
              <>
                <Square className="w-3.5 h-3.5 text-slate-400" />
                <span>Deselect All</span>
              </>
            ) : (
              <>
                <CheckSquare className="w-3.5 h-3.5 text-blue-500" />
                <span>Select All</span>
              </>
            )}
          </button>

          {/* Open Flipbook Lightbox */}
          <button
            onClick={() => onOpenLightbox(0)}
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg text-indigo-700 dark:text-indigo-300 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-900/50 transition-colors flex items-center gap-1.5"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Flipbook Inspector</span>
          </button>

          {/* Download Selected or Download All ZIP */}
          <button
            onClick={() => onDownloadZip(selectedCount > 0 && selectedCount < totalFrames)}
            disabled={isDownloadingZip}
            className="px-3.5 py-1.5 text-xs font-bold rounded-lg text-white bg-blue-600 hover:bg-blue-700 active:scale-95 shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>
              {isDownloadingZip
                ? zipDownloadStatus || 'Packaging ZIP...'
                : selectedCount > 0 && selectedCount < totalFrames
                ? `Download Selected (${selectedCount}) ZIP`
                : `Download All (${totalFrames}) ZIP`}
            </span>
          </button>
        </div>
      </div>

      {/* Frame Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {pageFrames.map((frame, localIdx) => {
          const globalIdx = startIndex + localIdx;
          return (
            <div
              key={frame.id}
              className={`group relative rounded-xl overflow-hidden border bg-slate-50 dark:bg-slate-950/60 transition-all ${
                frame.selected
                  ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              {/* Thumbnail Container */}
              <div
                onClick={() => onOpenLightbox(globalIdx)}
                className="aspect-video w-full overflow-hidden bg-black/40 cursor-pointer relative"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={frame.url}
                  alt={frame.filename}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />

                {/* Hover overlay hint */}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <span className="p-1.5 rounded-full bg-white/80 dark:bg-black/80 text-slate-900 dark:text-white backdrop-blur-sm">
                    <Eye className="w-4 h-4" />
                  </span>
                </div>
              </div>

              {/* Selection Checkbox */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect(frame.id);
                }}
                className="absolute top-1.5 left-1.5 z-10 p-1 rounded-md bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm transition-transform active:scale-90"
                aria-label="Select frame"
              >
                {frame.selected ? (
                  <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
                ) : (
                  <Square className="w-3.5 h-3.5 text-white/70" />
                )}
              </button>

              {/* Single Download Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDownloadFrame(frame);
                }}
                className="absolute top-1.5 right-1.5 z-10 p-1 rounded-md bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm transition-transform active:scale-90 opacity-0 group-hover:opacity-100"
                title={`Download ${frame.filename}`}
              >
                <Download className="w-3.5 h-3.5 text-white" />
              </button>

              {/* Meta Footer */}
              <div className="p-2 text-[10px] font-mono flex items-center justify-between text-slate-500 dark:text-slate-400 border-t border-slate-200/60 dark:border-slate-800/60">
                <span className="font-bold text-slate-800 dark:text-slate-200 truncate mr-1">
                  #{String(frame.index).padStart(4, '0')}
                </span>
                <span className="text-slate-400 shrink-0">
                  {formatTimecode(frame.timestamp)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Controls (if more than 1 page) */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            Showing {startIndex + 1}–{Math.min(startIndex + pageSize, totalFrames)} of {totalFrames} frames
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-300"
            >
              Previous
            </button>
            <span className="px-2 font-mono text-slate-600 dark:text-slate-300">
              {safePage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-300"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
