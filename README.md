# Frame Forge · High-Speed Video Frame Extractor & Archiver

Frame Forge is a high-performance, browser-native video frame extractor and sequence archiver built with **Next.js 16 (App Router)**, **TypeScript**, and **Tailwind CSS v4**.

It extracts high-precision image frames from any local video file (MP4, WebM, MOV, MKV, AVI) entirely on the client side with zero server uploads, 3-stage seek watchdogs, dynamic file sizing estimation, sequence naming, and multi-part ZIP downloads.

---

## ✨ Features

- **🚀 100% Client-Side Processing**: Zero server uploads. Your videos stay private on your machine.
- **🎯 5 Core FPS Presets**: Exactly 10 FPS (Draft), 24 FPS (Cinema), 30 FPS (Standard), 45 FPS (High), and 60 FPS (Ultra).
- **📊 Real-time Hardware Diagnostics**: Live monitoring of RAM allocation (JS Heap & in-memory Blob store), CPU loop latency & concurrency, HTML5 storage quota, and unmasked WebGL GPU acceleration.
- **💾 Dynamic File Sizing Estimation**: Instantly calculates expected frame count, per-frame byte weight, and total archive download size across WebP, PNG, and JPEG.
- **🏷️ Sequence Naming & Live Preview**: Custom prefix with token pattern selection (`{name}_{index:5}`, `{videoname}_frame_{index:4}`, `{name}_{timecode}`) and real-time live preview badge.
- **🎬 3-Stage Seek Watchdog & True Duration Probe**: Probes 1e101 seek timestamps to circumvent Chromium/WebM 3s truncation bugs, with micro-nudges (+1.5ms) for exact frame capture.
- **🎞️ Interactive Flipbook Lightbox**: Stepper controls, frame scrubber, clipboard copying, and variable speed playback (12 to 60 fps).
- **📦 Multi-Part ZIP Archiving**: Auto-split ZIP archives (250, 500, 1000 frames) with optional `manifest.json` metadata.
- **🌗 Dark / Light Mode**: Minimalist aesthetic with Obsidian Dark and Architectural Light themes.
- **✨ Built-in 60FPS Synthesizer**: Generates a 10s 60FPS calibration test clip in 1 second with a single click.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
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

### 2. Run the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Build for Production
```bash
npm run build
npm run start
```
