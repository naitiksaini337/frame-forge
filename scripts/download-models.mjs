import fs from 'fs';
import path from 'path';

const CDN_BASE = 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/';
const TARGET_DIR = path.resolve(process.cwd(), 'public/bg-removal-data');

async function downloadFile(url, destPath) {
  if (fs.existsSync(destPath)) {
    return; // Already downloaded
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download ${url}: ${res.statusText}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
}

async function main() {
  console.log('🔄 Synchronizing 1.7.0 model assets and resources.json...');
  fs.mkdirSync(TARGET_DIR, { recursive: true });

  // 1. Fetch 1.7.0 resources.json
  const resResponse = await fetch(`${CDN_BASE}resources.json`);
  if (!resResponse.ok) {
    throw new Error('Failed to fetch resources.json from CDN');
  }
  const resources = await resResponse.json();
  fs.writeFileSync(
    path.join(TARGET_DIR, 'resources.json'),
    JSON.stringify(resources, null, 2)
  );
  console.log('✓ Updated resources.json with 1.7.0 models');

  // 2. Identify required chunks for isnet_fp16, isnet (FP32 best quality), and wasm runtimes
  const targets = [
    '/onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm',
    '/onnxruntime-web/ort-wasm-simd-threaded.wasm',
    '/onnxruntime-web/ort-wasm-simd-threaded.jsep.mjs',
    '/onnxruntime-web/ort-wasm-simd-threaded.mjs',
    '/models/isnet_fp16',
    '/models/isnet',
  ];

  const chunkNames = new Set();
  for (const key of targets) {
    if (resources[key] && resources[key].chunks) {
      for (const chunk of resources[key].chunks) {
        chunkNames.add(chunk.name);
      }
    }
  }

  console.log(`📥 Downloading ${chunkNames.size} chunks for offline models...`);

  let count = 0;
  const chunkList = Array.from(chunkNames);
  // Download in parallel batches of 6
  for (let i = 0; i < chunkList.length; i += 6) {
    const batch = chunkList.slice(i, i + 6);
    await Promise.all(
      batch.map(async (name) => {
        const dest = path.join(TARGET_DIR, name);
        await downloadFile(`${CDN_BASE}${name}`, dest);
        count++;
        process.stdout.write(`\rProgress: ${count} / ${chunkList.length} chunks downloaded.`);
      })
    );
  }

  console.log('\n✓ All model assets downloaded successfully to public/bg-removal-data/');
}

main().catch((err) => {
  console.error('\n⚠️ Model asset download error:', err.message);
  process.exit(1);
});
