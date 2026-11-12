'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Paintbrush,
  Eraser,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Check,
  X,
  Loader2,
  Sliders,
  Sun,
  Moon,
  Wand2,
} from 'lucide-react';
import {
  loadImageElement,
  extractAlphaMaskCanvas,
  compositeImageWithMask,
} from '../../lib/bgEngine';

interface MaskEditorProps {
  isOpen: boolean;
  originalBlob: Blob;
  processedBlob: Blob;
  filename: string;
  onClose: () => void;
  onApply: (updatedBlob: Blob) => void;
}

export function MaskEditor({
  isOpen,
  originalBlob,
  processedBlob,
  filename,
  onClose,
  onApply,
}: MaskEditorProps) {
  // Tool state
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [brushSize, setBrushSize] = useState<number>(32);
  const [brushHardness, setBrushHardness] = useState<number>(85); // 0% to 100%
  const [zoom, setZoom] = useState<number>(1.0); // 1.0 to 4.0
  const [checkerTheme, setCheckerTheme] = useState<'dark' | 'light'>('dark');

  // Loading & Apply state
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Undo / Redo state
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Cursor overlay state
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [isHoveringCanvas, setIsHoveringCanvas] = useState(false);

  // References
  const containerRef = useRef<HTMLDivElement | null>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const originalImgRef = useRef<HTMLImageElement | null>(null);
  const isDrawingRef = useRef<boolean>(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // History stack for Undo / Redo (max 20 states)
  const undoStackRef = useRef<ImageData[]>([]);
  const redoStackRef = useRef<ImageData[]>([]);

  // Push state to undo stack
  const pushHistoryState = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const snap = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    undoStackRef.current.push(snap);
    if (undoStackRef.current.length > 20) {
      undoStackRef.current.shift();
    }
    // Clear redo stack on new action
    redoStackRef.current = [];

    setCanUndo(undoStackRef.current.length > 1);
    setCanRedo(false);
  }, []);

  // Redraw display canvas from original image and mask
  const renderDisplay = useCallback(() => {
    const displayCanvas = displayCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const origImg = originalImgRef.current;
    if (!displayCanvas || !maskCanvas || !origImg) return;

    const ctx = displayCanvas.getContext('2d', { willReadFrequently: true });
    const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || !maskCtx) return;

    const w = displayCanvas.width;
    const h = displayCanvas.height;

    // 1. Draw original RGB
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(origImg, 0, 0, w, h);

    // 2. Combine with mask
    const imgData = ctx.getImageData(0, 0, w, h);
    const maskData = maskCtx.getImageData(0, 0, w, h);

    const pixels = imgData.data;
    const maskPix = maskData.data;

    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i + 3] = maskPix[i]; // Use R channel of mask as alpha
    }

    ctx.putImageData(imgData, 0, 0);
  }, []);

  // Initialize images and canvases
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setIsLoading(true);
    setError(null);
    undoStackRef.current = [];
    redoStackRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
    setZoom(1.0);

    const initCanvases = async () => {
      try {
        const [origImg, procImg] = await Promise.all([
          loadImageElement(originalBlob),
          loadImageElement(processedBlob),
        ]);

        if (!mounted) return;

        const w = origImg.naturalWidth || origImg.width;
        const h = origImg.naturalHeight || origImg.height;

        originalImgRef.current = origImg;

        // Create initial mask canvas from processed transparent image
        const maskCanvas = extractAlphaMaskCanvas(procImg);
        maskCanvasRef.current = maskCanvas;

        // Setup display canvas
        const displayCanvas = displayCanvasRef.current;
        if (displayCanvas) {
          displayCanvas.width = w;
          displayCanvas.height = h;
        }

        // Save initial state in undo stack
        const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
        if (maskCtx) {
          undoStackRef.current = [maskCtx.getImageData(0, 0, w, h)];
        }

        renderDisplay();
        setIsLoading(false);
      } catch (err: unknown) {
        if (!mounted) return;
        console.error('Failed to initialize MaskEditor canvases:', err);
        setError('Failed to load image for mask editing.');
        setIsLoading(false);
      }
    };

    initCanvases();

    return () => {
      mounted = false;
    };
  }, [isOpen, originalBlob, processedBlob, renderDisplay]);

  // Undo action
  const handleUndo = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas || undoStackRef.current.length <= 1) return;

    const ctx = maskCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Pop current state and push to redo
    const current = undoStackRef.current.pop();
    if (current) {
      redoStackRef.current.push(current);
    }

    // Apply previous state
    const prev = undoStackRef.current[undoStackRef.current.length - 1];
    if (prev) {
      ctx.putImageData(prev, 0, 0);
      renderDisplay();
    }

    setCanUndo(undoStackRef.current.length > 1);
    setCanRedo(redoStackRef.current.length > 0);
  }, [renderDisplay]);

  // Redo action
  const handleRedo = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas || redoStackRef.current.length === 0) return;

    const ctx = maskCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const next = redoStackRef.current.pop();
    if (next) {
      undoStackRef.current.push(next);
      ctx.putImageData(next, 0, 0);
      renderDisplay();
    }

    setCanUndo(undoStackRef.current.length > 1);
    setCanRedo(redoStackRef.current.length > 0);
  }, [renderDisplay]);

  // Feather entire mask edges smoothly
  const handleFeatherWholeMask = (amount: number = 2.5) => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const temp = document.createElement('canvas');
    temp.width = maskCanvas.width;
    temp.height = maskCanvas.height;
    const tCtx = temp.getContext('2d');
    if (!tCtx) return;

    tCtx.filter = `blur(${amount}px)`;
    tCtx.drawImage(maskCanvas, 0, 0);

    ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    ctx.drawImage(temp, 0, 0);

    pushHistoryState();
    renderDisplay();
  };

  // Hotkey listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Hotkeys '[' and ']' for brush size
      if (e.key === '[') {
        e.preventDefault();
        setBrushSize((s) => Math.max(4, s - 6));
      } else if (e.key === ']') {
        e.preventDefault();
        setBrushSize((s) => Math.min(160, s + 6));
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key.toLowerCase() === 'b') {
        setTool('brush');
      } else if (e.key.toLowerCase() === 'e') {
        setTool('eraser');
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleUndo, handleRedo, onClose]);

  // Canvas drawing logic
  const drawStamp = (x: number, y: number) => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const radius = brushSize / 2;
    const hardness = brushHardness / 100;

    ctx.save();
    const isBrush = tool === 'brush';

    // Create radial gradient for feathered edges
    const grad = ctx.createRadialGradient(x, y, radius * hardness, x, y, radius);
    if (isBrush) {
      // Brush: Paint white (255 alpha)
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grad;
    } else {
      // Eraser: Paint black (0 alpha)
      grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
    }

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // Interpolate stamps along stroke path to prevent gaps during fast motion
  const drawLine = (fromX: number, fromY: number, toX: number, toY: number) => {
    const dist = Math.hypot(toX - fromX, toY - fromY);
    const step = Math.max(1, (brushSize / 2) * 0.25);
    const steps = Math.ceil(dist / step);

    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const x = fromX + (toX - fromX) * t;
      const y = fromY + (toY - fromY) * t;
      drawStamp(x, y);
    }
  };

  // Convert client mouse coords to unscaled canvas coordinates
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return; // Only primary mouse button
    isDrawingRef.current = true;
    const coords = getCanvasCoords(e);
    lastPointRef.current = coords;
    drawStamp(coords.x, coords.y);
    renderDisplay();
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    setCursorPos({ x: e.clientX, y: e.clientY });

    if (!isDrawingRef.current || !lastPointRef.current) return;

    drawLine(lastPointRef.current.x, lastPointRef.current.y, coords.x, coords.y);
    lastPointRef.current = coords;
    renderDisplay();
  };

  const handlePointerUp = () => {
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      lastPointRef.current = null;
      pushHistoryState();
      renderDisplay();
    }
  };

  // Apply and export edited image
  const handleApplyCommit = async () => {
    const maskCanvas = maskCanvasRef.current;
    const origImg = originalImgRef.current;
    if (!maskCanvas || !origImg) return;

    setIsApplying(true);
    try {
      const newBlob = await compositeImageWithMask(origImg, maskCanvas);
      onApply(newBlob);
      onClose();
    } catch (err: unknown) {
      console.error('Failed to commit mask edit:', err);
      setError('Failed to apply mask modifications.');
    } finally {
      setIsApplying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-md select-none text-slate-100 animate-in fade-in duration-200"
      onMouseUp={handlePointerUp}
    >
      {/* Top Header Bar */}
      <div className="h-16 px-4 sm:px-6 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <Paintbrush className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              Mask Touch-Up Editor
              <span className="text-xs font-normal text-slate-400 truncate max-w-[200px] sm:max-w-[320px]">
                ({filename})
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Restore foreground pixels with Brush or erase halos with Eraser.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isApplying}
            className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-300 hover:bg-slate-800 border border-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApplyCommit}
            disabled={isApplying || isLoading}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            {isApplying ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Applying...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Apply Changes</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Toolbar Controls */}
        <div className="w-full lg:w-72 p-4 border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-900/60 overflow-y-auto shrink-0 space-y-5 text-xs">
          {/* Tool Selector */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Tool Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTool('brush')}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-medium border transition-all ${
                  tool === 'brush'
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800'
                }`}
                title="Brush: Paints back original foreground pixels [Hotkey: B]"
              >
                <Paintbrush className="w-4 h-4" />
                <span>Brush (Restore)</span>
              </button>

              <button
                type="button"
                onClick={() => setTool('eraser')}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-medium border transition-all ${
                  tool === 'eraser'
                    ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/30'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800'
                }`}
                title="Eraser: Cuts off stray background [Hotkey: E]"
              >
                <Eraser className="w-4 h-4" />
                <span>Eraser (Cut)</span>
              </button>
            </div>
          </div>

          {/* Brush Size Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-slate-300">
              <span className="font-medium">Brush Size</span>
              <span className="font-mono text-indigo-400">{brushSize}px</span>
            </div>
            <input
              type="range"
              min="4"
              max="160"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>Fine (4px)</span>
              <span>Hotkeys: [ / ]</span>
              <span>Broad (160px)</span>
            </div>
          </div>

          {/* Brush Hardness Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-slate-300">
              <span className="font-medium">Edge Hardness</span>
              <span className="font-mono text-indigo-400">{brushHardness}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={brushHardness}
              onChange={(e) => setBrushHardness(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>Soft (Feathered)</span>
              <span>Crisp Edge</span>
            </div>

            {/* Quick Whole-Mask Feather Action */}
            <button
              type="button"
              onClick={() => handleFeatherWholeMask(2.5)}
              className="w-full mt-2 py-1.5 px-2.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-800/60 font-medium flex items-center justify-center gap-1.5 transition-colors"
              title="Soften and feather all silhouette edges across the entire image"
            >
              <Wand2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Feather Entire Mask (+2.5px)</span>
            </button>
          </div>

          {/* Undo / Redo & Zoom Controls */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              History & View
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleUndo}
                disabled={!canUndo}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Undo</span>
              </button>

              <button
                type="button"
                onClick={handleRedo}
                disabled={!canRedo}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Redo (Ctrl+Y)"
              >
                <Redo2 className="w-3.5 h-3.5" />
                <span>Redo</span>
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center justify-between bg-slate-800/80 p-1.5 rounded-lg border border-slate-700">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(1.0, parseFloat((z - 0.25).toFixed(2))))}
                disabled={zoom <= 1.0}
                className="p-1.5 rounded hover:bg-slate-700 text-slate-300 disabled:opacity-30"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              <span className="font-mono text-xs text-indigo-400 font-semibold">
                {Math.round(zoom * 100)}%
              </span>

              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(4.0, parseFloat((z + 0.25).toFixed(2))))}
                disabled={zoom >= 4.0}
                className="p-1.5 rounded hover:bg-slate-700 text-slate-300 disabled:opacity-30"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setZoom(1.0)}
                className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
                title="Reset to 100%"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Checkerboard Backdrop Selection */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Transparency Pattern
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCheckerTheme('dark')}
                className={`flex-1 py-1.5 px-2 rounded-lg border text-center transition-colors flex items-center justify-center gap-1.5 ${
                  checkerTheme === 'dark'
                    ? 'bg-slate-800 border-indigo-500 text-indigo-400 font-semibold'
                    : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Dark Grid</span>
              </button>
              <button
                type="button"
                onClick={() => setCheckerTheme('light')}
                className={`flex-1 py-1.5 px-2 rounded-lg border text-center transition-colors flex items-center justify-center gap-1.5 ${
                  checkerTheme === 'light'
                    ? 'bg-slate-800 border-indigo-500 text-indigo-400 font-semibold'
                    : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Light Grid</span>
              </button>
            </div>
          </div>
        </div>

        {/* Viewport Canvas Area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto flex items-center justify-center p-4 sm:p-8 relative bg-slate-950"
          onMouseEnter={() => setIsHoveringCanvas(true)}
          onMouseLeave={() => {
            setIsHoveringCanvas(false);
            setCursorPos(null);
          }}
        >
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-xs">Loading image into touch-up canvas...</p>
            </div>
          ) : error ? (
            <div className="text-rose-400 text-sm max-w-md text-center p-4 bg-rose-950/40 border border-rose-800 rounded-xl">
              {error}
            </div>
          ) : (
            <div
              className={`relative shadow-2xl rounded-lg overflow-hidden border border-slate-700/60 transition-transform ${
                checkerTheme === 'dark'
                  ? 'bg-[linear-gradient(45deg,#1e2330_25%,transparent_25%),linear-gradient(-45deg,#1e2330_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1e2330_75%),linear-gradient(-45deg,transparent_75%,#1e2330_75%)] bg-[size:24px_24px] bg-[position:0_0,0_12px,12px_-12px,-12px_0px] bg-[#121620]'
                  : 'bg-[linear-gradient(45deg,#e2e8f0_25%,transparent_25%),linear-gradient(-45deg,#e2e8f0_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e2e8f0_75%),linear-gradient(-45deg,transparent_75%,#e2e8f0_75%)] bg-[size:24px_24px] bg-[position:0_0,0_12px,12px_-12px,-12px_0px] bg-white'
              }`}
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'center center',
              }}
            >
              <canvas
                ref={displayCanvasRef}
                onMouseDown={handlePointerDown}
                onMouseMove={handlePointerMove}
                className="block cursor-none max-w-full max-h-[75vh] object-contain"
              />
            </div>
          )}

          {/* Circular Brush Cursor Overlay */}
          {isHoveringCanvas && cursorPos && !isLoading && (
            <div
              className="pointer-events-none fixed rounded-full -translate-x-1/2 -translate-y-1/2 z-50 border-2 transition-[width,height] duration-75"
              style={{
                left: `${cursorPos.x}px`,
                top: `${cursorPos.y}px`,
                width: `${brushSize * zoom}px`,
                height: `${brushSize * zoom}px`,
                borderColor: tool === 'brush' ? '#6366f1' : '#f43f5e',
                boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.6), inset 0 0 0 1px rgba(255, 255, 255, 0.6)',
              }}
            >
              <div
                className="w-1 h-1 rounded-full bg-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{
                  backgroundColor: tool === 'brush' ? '#818cf8' : '#fb7185',
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

