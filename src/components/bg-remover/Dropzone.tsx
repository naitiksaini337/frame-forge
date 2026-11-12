'use client';

import React, { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, AlertCircle, X, ShieldCheck } from 'lucide-react';
import { validateBatchFiles, formatBytes, MAX_FILE_SIZE_BYTES } from '../../lib/fileValidation';

interface DropzoneProps {
  onFilesSelected: (files: File[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  title?: string;
  subtitle?: string;
}

export function Dropzone({
  onFilesSelected,
  multiple = false,
  disabled = false,
  title = 'Drop image here or click to browse',
  subtitle = 'Supports PNG, JPEG, WebP up to 20 MB. 100% Client-Side WebGPU / WASM.',
}: DropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || disabled) return;

    const filesArray = Array.from(fileList);
    const targetFiles = multiple ? filesArray : [filesArray[0]];

    const { validFiles, errors: validationErrors } = validateBatchFiles(targetFiles);

    if (validationErrors.length > 0) {
      setErrors((prev) => [...prev, ...validationErrors]);
    }

    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const clearErrors = () => {
    setErrors([]);
  };

  const removeError = (index: number) => {
    setErrors((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {/* Dropzone Container */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`relative group cursor-pointer border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center transition-all ${
          isDragOver
            ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 scale-[0.99]'
            : 'border-slate-300 dark:border-slate-700/80 hover:border-indigo-400 dark:hover:border-indigo-500/80 bg-slate-50/60 dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-900/60'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple={multiple}
          disabled={disabled}
          onChange={(e) => {
            handleFiles(e.target.files);
            // Reset input so same file can be selected again
            e.target.value = '';
          }}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center gap-3">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${
              isDragOver
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50'
            }`}
          >
            {isDragOver ? (
              <Upload className="w-7 h-7 animate-bounce" />
            ) : (
              <ImageIcon className="w-7 h-7" />
            )}
          </div>

          <div className="space-y-1">
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
              {title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {subtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
              <ShieldCheck className="w-3 h-3" />
              100% Private (No Cloud Uploads)
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              Max {formatBytes(MAX_FILE_SIZE_BYTES)}
            </span>
          </div>
        </div>
      </div>

      {/* Dismissible Error Alerts */}
      {errors.length > 0 && (
        <div className="space-y-1.5">
          {errors.map((err, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span className="truncate">{err}</span>
              </div>
              <button
                type="button"
                onClick={() => removeError(idx)}
                className="p-1 rounded-md hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-500 transition-colors"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {errors.length > 2 && (
            <button
              type="button"
              onClick={clearErrors}
              className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline px-1"
            >
              Clear all alerts
            </button>
          )}
        </div>
      )}
    </div>
  );
}

