'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  Download,
  FolderDown,
  Paintbrush,
  RotateCcw,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Archive,
  Play,
  Pause,
  RefreshCw,
  Eye,
  CheckCheck,
  Cpu,
  Wand2,
} from 'lucide-react';
import { Dropzone } from './Dropzone';
import { FolderPathInput } from './FolderPathInput';
import { MaskEditor } from './MaskEditor';
import { QueueItem, ProcessingStatus } from '../../types/bg-remover';
import { removeBackgroundClient, BgModelType } from '../../lib/bgEngine';
import { sanitizeOutputFilename, formatBytes } from '../../lib/fileValidation';
import { exportZip, downloadBlob, revokeObjectUrls } from '../../lib/zipUtils';

export function BatchRemover() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState<boolean>(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  // Model & Feathering settings for batch queue
  const [model, setModel] = useState<BgModelType>('isnet'); // Default FP32 Ultra Best Quality
  const [featherRadius, setFeatherRadius] = useState<number>(3.0); // Default 3.0px edge feathering

  // Mask Touch-Up Editor modal
  const [touchUpItem, setTouchUpItem] = useState<QueueItem | null>(null);

  // Batch Export state
  const [folderPath, setFolderPath] = useState('');
  const [isSavingAllLocal, setIsSavingAllLocal] = useState(false);
  const [saveAllProgress, setSaveAllProgress] = useState<{ current: number; total: number } | null>(null);
  const [saveAllResult, setSaveAllResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState<number>(0);

  // Track created object URLs for memory safety
  const trackedUrlsRef = useRef<Set<string>>(new Set());

  const createTrackedUrl = useCallback((blob: Blob): string => {
    const url = URL.createObjectURL(blob);
    trackedUrlsRef.current.add(url);
    return url;
  }, []);

  const revokeTrackedUrl = useCallback((url?: string) => {
    if (url && trackedUrlsRef.current.has(url)) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
      trackedUrlsRef.current.delete(url);
    }
  }, []);

  // Cleanup all tracked URLs on component unmount
  useEffect(() => {
    return () => {
      trackedUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      });
      trackedUrlsRef.current.clear();
    };
  }, []);

  // Append new files to the queue
  const handleFilesSelected = (files: File[]) => {
    const newItems: QueueItem[] = files.map((file) => {
      const thumbUrl = createTrackedUrl(file);
      return {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        file,
        name: file.name,
        size: file.size,
        thumbnailUrl: thumbUrl,
        status: 'queued',
        progress: 0,
      };
    });

    setQueue((prev) => [...prev, ...newItems]);
    setIsProcessingQueue(true);
  };

  // Strict Sequential Queue Runner (concurrency = 1)
  useEffect(() => {
    if (!isProcessingQueue || activeItemId) return;

    // Find first queued item
    const nextItem = queue.find((item) => item.status === 'queued');
    if (!nextItem) {
      // All items in queue have been processed or errored
      setIsProcessingQueue(false);
      return;
    }

    const currentId = nextItem.id;
    setActiveItemId(currentId);

    // Mark as processing
    setQueue((prev) =>
      prev.map((item) =>
        item.id === currentId
          ? { ...item, status: 'processing', progress: 5, progressText: 'Preparing...' }
          : item
      )
    );

    // Process image strictly one at a time
    (async () => {
      try {
        const { rawBlob, featheredBlob } = await removeBackgroundClient(
          nextItem.file,
          (p) => {
            setQueue((prev) =>
              prev.map((item) =>
                item.id === currentId
                  ? { ...item, progress: p.percent, progressText: p.message }
                  : item
              )
            );
          },
          {
            model: model,
            feather: featherRadius,
          }
        );

        const procUrl = createTrackedUrl(featheredBlob);

        setQueue((prev) =>
          prev.map((item) =>
            item.id === currentId
              ? {
                  ...item,
                  status: 'done',
                  progress: 100,
                  progressText: 'Complete',
                  rawProcessedBlob: rawBlob,
                  processedBlob: featheredBlob,
                  processedUrl: procUrl,
                  featherRadius: featherRadius,
                  error: undefined,
                }
              : item
          )
        );
      } catch (err: unknown) {
        console.error(`Batch processing failed for ${nextItem.name}:`, err);
        const errorMsg =
          err instanceof Error ? err.message : 'Processing failed (WASM/WebGL error).';
        setQueue((prev) =>
          prev.map((item) =>
            item.id === currentId
              ? {
                  ...item,
                  status: 'error',
                  progress: 0,
                  progressText: 'Failed',
                  error: errorMsg,
                }
              : item
          )
        );
      } finally {
        setActiveItemId(null);
      }
    })();
  }, [queue, isProcessingQueue, activeItemId, createTrackedUrl]);

  // Retry a single failed item
  const handleRetryItem = (id: string) => {
    setQueue((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: 'queued',
              progress: 0,
              progressText: undefined,
              error: undefined,
            }
          : item
      )
    );
    setIsProcessingQueue(true);
  };

  // Retry All Failed items
  const handleRetryAllFailed = () => {
    setQueue((prev) =>
      prev.map((item) =>
        item.status === 'error'
          ? {
              ...item,
              status: 'queued',
              progress: 0,
              progressText: undefined,
              error: undefined,
            }
          : item
      )
    );
    setIsProcessingQueue(true);
  };

  // Remove a single item from the queue
  const handleRemoveItem = (id: string) => {
    setQueue((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) {
        revokeTrackedUrl(target.thumbnailUrl);
        revokeTrackedUrl(target.processedUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  // Clear completed items
  const handleClearCompleted = () => {
    setQueue((prev) => {
      const remaining: QueueItem[] = [];
      for (const item of prev) {
        if (item.status === 'done') {
          revokeTrackedUrl(item.thumbnailUrl);
          revokeTrackedUrl(item.processedUrl);
        } else {
          remaining.push(item);
        }
      }
      return remaining;
    });
  };

  // Clear all items in queue
  const handleClearAll = () => {
    setIsProcessingQueue(false);
    setActiveItemId(null);
    for (const item of queue) {
      revokeTrackedUrl(item.thumbnailUrl);
      revokeTrackedUrl(item.processedUrl);
    }
    setQueue([]);
    setSaveAllResult(null);
  };

  // Download a single item
  const handleDownloadSingle = (item: QueueItem) => {
    if (!item.processedBlob) return;
    const filename = sanitizeOutputFilename(item.name);
    downloadBlob(item.processedBlob, filename);
  };

  // Batch Export: Download All as ZIP
  const handleDownloadZip = async () => {
    const completedItems = queue.filter(
      (item) => item.status === 'done' && item.processedBlob
    );
    if (completedItems.length === 0) return;

    setIsExportingZip(true);
    setZipProgress(0);

    try {
      const zipItems = completedItems.map((item) => ({
        filename: sanitizeOutputFilename(item.name),
        blob: item.processedBlob!,
      }));

      await exportZip(zipItems, `nobg_batch_${Date.now()}.zip`, (pct) => {
        setZipProgress(pct);
      });
    } catch (err: unknown) {
      console.error('ZIP export failed:', err);
      alert('Failed to package ZIP archive.');
    } finally {
      setIsExportingZip(false);
    }
  };

  // Batch Export: Save All to Local Directory
  const handleSaveAllToFolder = async () => {
    const completedItems = queue.filter(
      (item) => item.status === 'done' && item.processedBlob
    );
    if (completedItems.length === 0 || !folderPath.trim()) return;

    setIsSavingAllLocal(true);
    setSaveAllResult(null);
    setSaveAllProgress({ current: 0, total: completedItems.length });

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < completedItems.length; i++) {
      const item = completedItems[i];
      setSaveAllProgress({ current: i + 1, total: completedItems.length });

      try {
        const filename = sanitizeOutputFilename(item.name);
        const formData = new FormData();
        formData.append('directoryPath', folderPath.trim());
        formData.append('filename', filename);
        formData.append('file', item.processedBlob!, filename);

        const res = await fetch('/api/save-local', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (res.ok && data.success) {
          successCount++;
        } else {
          failedCount++;
        }
      } catch (err) {
        failedCount++;
      }
    }

    setIsSavingAllLocal(false);
    setSaveAllProgress(null);

    if (failedCount === 0) {
      setSaveAllResult({
        success: true,
        message: `Successfully saved ${successCount} image(s) to ${folderPath.trim()}`,
      });
    } else {
      setSaveAllResult({
        success: false,
        message: `Saved ${successCount} image(s); ${failedCount} failed. Check permissions.`,
      });
    }
  };

  // Mask touch-up apply handler
  const handleTouchUpApply = (updatedBlob: Blob) => {
    if (!touchUpItem) return;
    const itemId = touchUpItem.id;
    revokeTrackedUrl(touchUpItem.processedUrl);

    const newUrl = createTrackedUrl(updatedBlob);
    setQueue((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, processedBlob: updatedBlob, processedUrl: newUrl }
          : item
      )
    );
    setTouchUpItem(null);
  };

  // Queue Statistics
  const totalCount = queue.length;
  const doneCount = queue.filter((i) => i.status === 'done').length;
  const queuedCount = queue.filter((i) => i.status === 'queued').length;
  const errorCount = queue.filter((i) => i.status === 'error').length;
  const isWorking = activeItemId !== null || isProcessingQueue;

  return (
    <div className="space-y-6">
      {/* Batch Processing Settings Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
        {/* Model Selection */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-indigo-500" />
            Neural Model:
          </span>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setModel('isnet')}
              disabled={isWorking}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                model === 'isnet'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="ISNet Ultra FP32: Highest edge precision"
            >
              <span>ISNet Ultra (FP32 Best Quality)</span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                PRO
              </span>
            </button>

            <button
              type="button"
              onClick={() => setModel('isnet_fp16')}
              disabled={isWorking}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                model === 'isnet_fp16'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="ISNet Fast FP16: Balanced quality and memory footprint"
            >
              <span>ISNet Fast (FP16)</span>
            </button>
          </div>
        </div>

        {/* Edge Feathering Slider */}
        <div className="flex items-center gap-3">
          <span className="text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5">
            <Wand2 className="w-4 h-4 text-indigo-500" />
            Feather Edge:
          </span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="10"
              step="0.5"
              value={featherRadius}
              onChange={(e) => setFeatherRadius(parseFloat(e.target.value))}
              disabled={isWorking}
              className="w-24 sm:w-32 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <span className="px-2 py-0.5 rounded-md font-mono text-xs font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60">
              {featherRadius.toFixed(1)}px
            </span>
          </div>
        </div>
      </div>

      {/* Dropzone for Multi-Files */}
      <Dropzone
        onFilesSelected={handleFilesSelected}
        multiple={true}
        title="Drop multiple images or click to select a batch"
        subtitle="Queue dozens of photos at once. Strictly sequential processing prevents tab crashes."
      />

      {/* Queue Overview and Actions */}
      {totalCount > 0 && (
        <div className="space-y-4">
          {/* Status Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
            {/* Stats Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-900 dark:text-white">
                Queue ({totalCount}):
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                <CheckCheck className="w-3.5 h-3.5" />
                {doneCount} Done
              </span>
              {queuedCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60">
                  <Clock className="w-3.5 h-3.5" />
                  {queuedCount} Queued
                </span>
              )}
              {errorCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errorCount} Errors
                </span>
              )}
            </div>

            {/* Global Queue Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {errorCount > 0 && (
                <button
                  type="button"
                  onClick={handleRetryAllFailed}
                  disabled={isWorking}
                  className="px-3 py-1.5 font-medium rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 transition-colors flex items-center gap-1.5"
                  title="Retry only the images that encountered errors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry All Failed ({errorCount})</span>
                </button>
              )}

              {doneCount > 0 && (
                <button
                  type="button"
                  onClick={handleClearCompleted}
                  className="px-3 py-1.5 font-medium rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors"
                >
                  Clear Finished
                </button>
              )}

              <button
                type="button"
                onClick={handleClearAll}
                className="px-3 py-1.5 font-medium rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            </div>
          </div>

          {/* Overall Batch Progress */}
          {totalCount > 0 && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
              <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                <span className="font-semibold">
                  Batch Completion: {doneCount} of {totalCount} images
                </span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  {Math.round((doneCount / totalCount) * 100)}%
                </span>
              </div>
              <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-300"
                  style={{ width: `${(doneCount / totalCount) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Queue Items List */}
          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {queue.map((item) => {
              const isItemActive = item.id === activeItemId;
              const isItemDone = item.status === 'done';
              const isItemError = item.status === 'error';

              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl border transition-all ${
                    isItemActive
                      ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-sm ring-1 ring-indigo-500/20'
                      : isItemDone
                      ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                      : isItemError
                      ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20'
                      : 'border-slate-200 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/40 opacity-80'
                  }`}
                >
                  {/* Left: Thumbnail & Filename */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700 relative">
                      <img
                        src={isItemDone && item.processedUrl ? item.processedUrl : item.thumbnailUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                      {isItemDone && (
                        <div className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-emerald-500 border border-white dark:border-slate-900" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {item.name}
                        </span>
                        <span className="text-[11px] text-slate-400 shrink-0">
                          {formatBytes(item.size)}
                        </span>
                      </div>

                      {/* Status / Progress message */}
                      <div className="flex items-center gap-2 text-[11px]">
                        {isItemActive && (
                          <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-medium">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>{item.progressText || 'Processing...'}</span>
                            <span className="font-mono">({item.progress}%)</span>
                          </div>
                        )}

                        {isItemDone && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Done · PNG
                          </span>
                        )}

                        {isItemError && (
                          <span className="text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1 truncate">
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            {item.error || 'Failed'}
                          </span>
                        )}

                        {item.status === 'queued' && (
                          <span className="text-slate-400 dark:text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Queued
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Item Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Touch Up Editor Button */}
                    {isItemDone && item.processedBlob && (
                      <button
                        type="button"
                        onClick={() => setTouchUpItem(item)}
                        className="p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 transition-colors"
                        title="Touch Up with Brush & Eraser"
                      >
                        <Paintbrush className="w-4 h-4" />
                      </button>
                    )}

                    {/* Download Single PNG */}
                    {isItemDone && item.processedBlob && (
                      <button
                        type="button"
                        onClick={() => handleDownloadSingle(item)}
                        className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors"
                        title="Download PNG"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}

                    {/* Retry Item */}
                    {isItemError && (
                      <button
                        type="button"
                        onClick={() => handleRetryItem(item.id)}
                        className="px-2.5 py-1 text-xs font-medium rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-colors"
                      >
                        Retry
                      </button>
                    )}

                    {/* Remove Item */}
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      disabled={isItemActive}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Remove from queue"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Batch Export Card (Visible when at least 1 image is done) */}
          {doneCount > 0 && (
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Archive className="w-4 h-4 text-indigo-500" />
                    Batch Export Options
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Export all {doneCount} completed images as a ZIP archive or save directly to a PC folder.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Download All (ZIP) */}
                  <button
                    type="button"
                    onClick={handleDownloadZip}
                    disabled={isExportingZip || doneCount === 0}
                    className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
                  >
                    {isExportingZip ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Packaging ZIP ({zipProgress}%)...</span>
                      </>
                    ) : (
                      <>
                        <Archive className="w-4 h-4" />
                        <span>Download All ({doneCount} ZIP)</span>
                      </>
                    )}
                  </button>

                  {/* Save All to Folder */}
                  <button
                    type="button"
                    onClick={handleSaveAllToFolder}
                    disabled={isSavingAllLocal || !folderPath.trim() || doneCount === 0}
                    className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingAllLocal ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>
                          Saving {saveAllProgress?.current}/{saveAllProgress?.total}...
                        </span>
                      </>
                    ) : (
                      <>
                        <FolderDown className="w-4 h-4" />
                        <span>Save All to Folder</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Destination Folder Path Input */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                <FolderPathInput
                  folderPath={folderPath}
                  onFolderPathChange={setFolderPath}
                  isSaving={isSavingAllLocal}
                />

                {saveAllResult && (
                  <div className="mt-2 text-xs">
                    {saveAllResult.success ? (
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>{saveAllResult.message}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-medium">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{saveAllResult.message}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mask Touch-Up Modal for Batch Item */}
      {touchUpItem && touchUpItem.processedBlob && (
        <MaskEditor
          isOpen={!!touchUpItem}
          originalBlob={touchUpItem.file}
          processedBlob={touchUpItem.processedBlob}
          filename={touchUpItem.name}
          onClose={() => setTouchUpItem(null)}
          onApply={handleTouchUpApply}
        />
      )}
    </div>
  );
}

