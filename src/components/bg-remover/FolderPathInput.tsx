'use client';

import React, { useState, useEffect } from 'react';
import { Folder, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface FolderPathInputProps {
  folderPath: string;
  onFolderPathChange: (path: string) => void;
  isSaving?: boolean;
}

export function FolderPathInput({
  folderPath,
  onFolderPathChange,
  isSaving = false,
}: FolderPathInputProps) {
  const [verifying, setVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Load remembered path from localStorage on mount
  useEffect(() => {
    if (!folderPath && typeof window !== 'undefined') {
      const saved = localStorage.getItem('bg_remover_saved_folder');
      if (saved) {
        onFolderPathChange(saved);
      }
    }
  }, [folderPath, onFolderPathChange]);

  const handlePathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onFolderPathChange(val);
    setVerifyStatus('idle');
    setErrorMessage('');
    if (typeof window !== 'undefined') {
      localStorage.setItem('bg_remover_saved_folder', val);
    }
  };

  const handleVerify = async () => {
    if (!folderPath.trim()) {
      setVerifyStatus('invalid');
      setErrorMessage('Please enter an absolute directory path.');
      return;
    }

    setVerifying(true);
    setVerifyStatus('idle');
    setErrorMessage('');

    try {
      const res = await fetch('/api/save-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          directoryPath: folderPath.trim(),
          verifyOnly: true,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setVerifyStatus('valid');
      } else {
        setVerifyStatus('invalid');
        setErrorMessage(data.error || 'Verification failed.');
      }
    } catch (err: unknown) {
      setVerifyStatus('invalid');
      setErrorMessage(err instanceof Error ? err.message : 'Network error verifying path.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
        <label className="flex items-center gap-1.5">
          <Folder className="w-4 h-4 text-indigo-500" />
          <span>Local Destination Folder</span>
        </label>
        <span className="text-[11px] text-slate-400">Node.js Direct Save</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={folderPath}
            onChange={handlePathChange}
            placeholder="e.g. C:\Users\YourName\Pictures\NoBG or /home/user/Pictures"
            disabled={isSaving}
            className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors disabled:opacity-50"
          />
        </div>

        <button
          type="button"
          onClick={handleVerify}
          disabled={verifying || isSaving || !folderPath.trim()}
          className="px-3 py-2 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          {verifying ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
              <span>Checking...</span>
            </>
          ) : (
            <span>Test Folder</span>
          )}
        </button>
      </div>

      {/* Status message */}
      {verifyStatus === 'valid' && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>Folder is accessible & writable</span>
        </div>
      )}

      {verifyStatus === 'invalid' && (
        <div className="flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span className="break-all">{errorMessage}</span>
        </div>
      )}
    </div>
  );
}

