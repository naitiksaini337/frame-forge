'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  FolderDown,
  Paintbrush,
  RotateCcw,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  SlidersHorizontal,
  Moon,
  Sun,
  Layers,
} from 'lucide-react';
import { Dropzone } from './Dropzone';
import { FolderPathInput } from './FolderPathInput';
import { MaskEditor } from './MaskEditor';
import { removeBackgroundClient, BgEngineProgress } from '../../lib/bgEngine';
import { sanitizeOutputFilename, formatBytes } from '../../lib/fileValidation';
import { downloadBlob, revokeObjectUrls } from '../../lib/zipUtils';

export function SingleRemover() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);

  // Inference state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<BgEngineProgress>({
    percent: 0,
    message: 'Initializing...',
  });
  const [error, setError] = useState<string | null>(null);

  // View state
  const [checkerTheme, setCheckerTheme] = useState<'dark' | 'light'>('dark');
  const [viewMode, setViewMode] = useState<'side-by-side' | 'stacked'>('side-by-side');

  // Mask Touch-Up Editor modal state
  const [isMaskEditorOpen, setIsMaskEditorOpen] = useState(false);

  // Local folder save state
  const [folderPath, setFolderPath] = useState('');
  const [isSavingLocal, setIsSavingLocal] = useState(false);
  const [localSaveResult, setLocalSaveResult] = useState<{
    success: boolean;
    savedPath?: string;
    error?: string;
  } | null>(null);

  // Active object URLs tracking for cleanup
  const activeUrlsRef = useRef<string[]>([]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      revokeObjectUrls(activeUrlsRef.current);
    };
  }, []);

  const createTrackedUrl = (blob: Blob): string => {
    const url = URL.createObjectURL(blob);
    activeUrlsRef.current.push(url);
    return url;
  };

  const handleFileSelected = (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];

    // Cleanup previous URLs
    revokeObjectUrls(activeUrlsRef.current);
    activeUrlsRef.current = [];

    setSelectedFile(file);
    const origUrl = createTrackedUrl(file);
    setOriginalUrl(origUrl);
    setProcessedBlob(null);
    setProcessedUrl(null);
    setError(null);
    setLocalSaveResult(null);

    // Trigger processing immediately
    processImage(file);
  };

  const processImage = async (file: File) => {
    setIsProcessing(true);
    setProgress({ percent: 5, message: 'Loading model engine...' });
    setError(null);

    try {
      const resultBlob = await removeBackgroundClient(file, (p) => {
        setProgress(p);
      });

      const procUrl = createTrackedUrl(resultBlob);
      setProcessedBlob(resultBlob);
      setProcessedUrl(procUrl);
      setIsProcessing(false);
    } catch (err: unknown) {
      console.error('Single background removal failed:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Background removal failed. Please check browser WebGL / WebGPU support.'
      );
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!processedBlob || !selectedFile) return;
    const filename = sanitizeOutputFilename(selectedFile.name);
    downloadBlob(processedBlob, filename);
  };

  const handleSaveToLocalFolder = async () => {
    if (!processedBlob || !selectedFile || !folderPath.trim()) return;

    setIsSavingLocal(true);
    setLocalSaveResult(null);

    try {
      const filename = sanitizeOutputFilename(selectedFile.name);
      const formData = new FormData();
      formData.append('directoryPath', folderPath.trim());
      formData.append('filename', filename);
      formData.append('file', processedBlob, filename);

      const res = await fetch('/api/save-local', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setLocalSaveResult({ success: true, savedPath: data.savedPath });
      } else {
        setLocalSaveResult({
          success: false,
          error: data.error || 'Failed to save to local folder',
        });
      }
    } catch (err: unknown) {
      setLocalSaveResult({
        success: false,
        error: err instanceof Error ? err.message : 'Network error saving file',
      });
    } finally {
      setIsSavingLocal(false);
    }
  };

  const handleMaskApplied = (updatedBlob: Blob) => {
    // Revoke old processed URL
    if (processedUrl) {
      URL.revokeObjectURL(processedUrl);
    }
    const newUrl = createTrackedUrl(updatedBlob);
    setProcessedBlob(updatedBlob);
    setProcessedUrl(newUrl);
    setLocalSaveResult(null);
  };

  const handleReset = () => {
    revokeObjectUrls(activeUrlsRef.current);
    activeUrlsRef.current = [];
    setSelectedFile(null);
    setOriginalUrl(null);
    setProcessedBlob(null);
    setProcessedUrl(null);
    setError(null);
    setLocalSaveResult(null);
  };

  return (
    <div className="space-y-6">
      {/* If no file is selected yet, show Dropzone */}
      {!selectedFile && (
        <Dropzone
          onFilesSelected={handleFileSelected}
          multiple={false}
          title="Select or drop a photo for background removal"
          subtitle="Supports high-res PNG, JPEG, and WebP up to 20 MB. Zero cloud uploads."
        />
      )}

      {/* Processing or Processed View */}
      {selectedFile && (
        <div className="space-y-6">
          {/* Header Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {selectedFile.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatBytes(selectedFile.size)} ·{' '}
                  {isProcessing ? 'Processing...' : processedBlob ? 'Complete (No Background)' : 'Waiting'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Choose Another</span>
              </button>
            </div>
          </div>

          {/* Progress Bar (while processing) */}
          {isProcessing && (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {progress.message}
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {progress.percent}%
                </span>
              </div>

              <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 transition-all duration-300 rounded-full"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
                Processing locally in your browser using WebGPU / WebAssembly.
              </p>
            </div>
          )}

          {/* Error Banner */}
          {error && !isProcessing && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 space-y-3 text-xs">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-semibold">Processing Failed: </span>
                  <span>{error}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => processImage(selectedFile)}
                className="px-3 py-1.5 font-medium rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-colors"
              >
                Retry Processing
              </button>
            </div>
          )}

          {/* Completed Comparison Cards */}
          {processedUrl && !isProcessing && (
            <div className="space-y-4">
              {/* Controls bar: Side-by-side vs Stacked & Checkerboard Theme */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Layout:</span>
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setViewMode('side-by-side')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                        viewMode === 'side-by-side'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Side by Side
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('stacked')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                        viewMode === 'stacked'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Stacked
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Grid:</span>
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setCheckerTheme('dark')}
                      className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1 transition-colors ${
                        checkerTheme === 'dark'
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Moon className="w-3 h-3" />
                      <span>Dark</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCheckerTheme('light')}
                      className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1 transition-colors ${
                        checkerTheme === 'light'
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Sun className="w-3 h-3" />
                      <span>Light</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Display Comparison View */}
              <div
                className={`grid gap-4 ${
                  viewMode === 'side-by-side' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
                }`}
              >
                {/* Original Image Card */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm flex flex-col">
                  <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span>Original Source</span>
                    <span className="text-slate-400 font-normal">
                      {formatBytes(selectedFile.size)}
                    </span>
                  </div>
                  <div className="flex-1 p-4 flex items-center justify-center bg-slate-100/50 dark:bg-slate-950/40 min-h-[300px]">
                    {originalUrl && (
                      <img
                        src={originalUrl}
                        alt="Original"
                        className="max-h-[420px] max-w-full object-contain rounded-lg shadow"
                      />
                    )}
                  </div>
                </div>

                {/* Processed (Transparent) Image Card */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm flex flex-col">
                  <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-bold">
                      <Sparkles className="w-3.5 h-3.5" />
                      Background Removed (PNG)
                    </span>
                    <span className="text-slate-400 font-normal">
                      {processedBlob ? formatBytes(processedBlob.size) : ''}
                    </span>
                  </div>
                  <div
                    className={`flex-1 p-4 flex items-center justify-center min-h-[300px] ${
                      checkerTheme === 'dark'
                        ? 'bg-[linear-gradient(45deg,#1e2330_25%,transparent_25%),linear-gradient(-45deg,#1e2330_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1e2330_75%),linear-gradient(-45deg,transparent_75%,#1e2330_75%)] bg-[size:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0px] bg-[#121620]'
                        : 'bg-[linear-gradient(45deg,#e2e8f0_25%,transparent_25%),linear-gradient(-45deg,#e2e8f0_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e2e8f0_75%),linear-gradient(-45deg,transparent_75%,#e2e8f0_75%)] bg-[size:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0px] bg-white'
                    }`}
                  >
                    <img
                      src={processedUrl}
                      alt="Processed with transparent background"
                      className="max-h-[420px] max-w-full object-contain rounded-lg drop-shadow-md"
                    />
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Touch-Up Mask Button */}
                    <button
                      type="button"
                      onClick={() => setIsMaskEditorOpen(true)}
                      className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 flex items-center gap-2 shadow-sm transition-all"
                      title="Open interactive touch-up canvas editor to restore or erase pixels"
                    >
                      <Paintbrush className="w-4 h-4 text-indigo-500" />
                      <span>Touch Up Mask (Brush & Eraser)</span>
                    </button>

                    {/* Download PNG */}
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 flex items-center gap-2 shadow-sm transition-all"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download PNG</span>
                    </button>
                  </div>

                  {/* Save to Local Folder Action */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveToLocalFolder}
                      disabled={isSavingLocal || !folderPath.trim()}
                      className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSavingLocal ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <FolderDown className="w-4 h-4" />
                      )}
                      <span>Save to Folder</span>
                    </button>
                  </div>
                </div>

                {/* Local Folder Directory Input */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                  <FolderPathInput
                    folderPath={folderPath}
                    onFolderPathChange={setFolderPath}
                    isSaving={isSavingLocal}
                  />

                  {localSaveResult && (
                    <div className="mt-2 text-xs">
                      {localSaveResult.success ? (
                        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>Saved successfully to: {localSaveResult.savedPath}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-medium">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{localSaveResult.error}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mask Touch-Up Editor Modal */}
      {selectedFile && processedBlob && (
        <MaskEditor
          isOpen={isMaskEditorOpen}
          originalBlob={selectedFile}
          processedBlob={processedBlob}
          filename={selectedFile.name}
          onClose={() => setIsMaskEditorOpen(false)}
          onApply={handleMaskApplied}
        />
      )}
    </div>
  );
}

