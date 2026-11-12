# Frame Forge · High-Speed Video Frame Extractor & AI Background Remover

Frame Forge is a high-performance, browser-native media processing toolkit built with **Next.js 16 (App Router)**, **TypeScript**, **Tailwind CSS v4**, and **WebAssembly / WebGPU**.

It includes two built-in client-side apps that run 100% locally in your browser with zero cloud uploads or external API subscriptions:
1. **🎬 Frame Forge**: High-precision video frame extractor and sequence archiver.
2. **✂️ AI Background Remover**: Neural network background removal with interactive brush touch-up, batch queue, and direct local filesystem saving.

---

## ✨ Features

### 🎬 Video Frame Extractor
- **🚀 100% Client-Side Processing**: Zero server uploads. Your videos stay private on your machine.
- **🎯 5 Core FPS Presets**: Exactly 10 FPS (Draft), 24 FPS (Cinema), 30 FPS (Standard), 45 FPS (High), and 60 FPS (Ultra).
- **📊 Real-time Hardware Diagnostics**: Live monitoring of RAM allocation (JS Heap & in-memory Blob store), CPU loop latency & concurrency, HTML5 storage quota, and WebGL GPU acceleration.
- **💾 Dynamic File Sizing Estimation**: Instantly calculates expected frame count, per-frame byte weight, and total archive download size across WebP, PNG, and JPEG.
- **🏷️ Sequence Naming & Live Preview**: Custom prefix with token pattern selection (`{name}_{index:5}`, `{videoname}_frame_{index:4}`, `{name}_{timecode}`).
- **🎬 3-Stage Seek Watchdog & True Duration Probe**: Probes 1e101 seek timestamps to circumvent Chromium/WebM 3s truncation bugs, with micro-nudges (+1.5ms) for exact frame capture.
- **🎞️ Interactive Flipbook Lightbox**: Stepper controls, frame scrubber, clipboard copying, and variable speed playback (12 to 60 fps).
- **📦 Multi-Part ZIP Archiving**: Auto-split ZIP archives (250, 500, 1000 frames) with optional `manifest.json` metadata.
- **✨ Built-in 60FPS Synthesizer**: Generates a 10s 60FPS calibration test clip in 1 second with a single click.

### ✂️ AI Background Remover (NEW)
- **🧠 100% Client-Side WebGPU / WASM**: Neural matting running entirely in the browser with zero cloud dependencies or API keys.
- **📸 Single Image Mode**: Drag-and-drop ingestion with validation, real-time download and inference progress, and side-by-side / stacked comparison with toggleable dark/light transparency checkerboard.
- **🖌️ Interactive Mask Touch-Up Editor (`MaskEditor`)**:
  - **Brush (Restore)**: Paints back original foreground pixels accidentally clipped.
  - **Eraser (Cut)**: Removes stray halos and background artifacts to transparency.
  - **Precision Controls**: Brush size (4px–160px with `[` and `]` hotkeys), edge hardness (0% feathered to 100% crisp), zoom (100%–400%), and 20-level Undo/Redo (`Ctrl+Z` / `Ctrl+Y`).
  - **Dynamic Cursor Overlay**: Real-time dual-ring cursor matching brush radius.
- **⚡ Sequential Batch Queue (`concurrency = 1`)**:
  - Drag and drop dozens of images simultaneously; append new files on the fly.
  - Strict sequential execution prevents browser tab crashes, memory exhaustion, and WebGL context loss.
  - Fault-tolerant error handling with automatic skip and "Retry All Failed" re-queue.
  - Export all completed images as a ZIP archive (`JSZip`) or save directly to a local folder.
- **📁 Node.js Direct Local Filesystem Save Route (`/api/save-local`)**:
  - Saves images directly to any specified PC folder via Node.js `fs`.
  - Path traversal protection, recursive folder creation, and interactive "Test Folder" write validation.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **AI / WASM**: [@imgly/background-removal](https://www.npmjs.com/package/@imgly/background-removal) & [ONNX Runtime Web](https://onnxruntime.ai/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Archiving**: [JSZip](https://stuk.github.io/jszip/)

---

## 🚀 Getting Started

### 1. Clone & Install
```bash
git clone https://github.com/naitiksaini337/frame-forge.git
cd frame-forge
npm install
```
*(The postinstall script automatically prepares the local neural model assets into `public/bg-removal-data/`)*

### 2. Run the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (or `npm run dev -- -p 3001` for port 3001) in your browser.

### 3. Build for Production
```bash
npm run build
npm run start
```
