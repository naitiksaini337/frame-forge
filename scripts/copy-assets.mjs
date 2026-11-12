import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const TARGET_DIR = path.resolve(process.cwd(), 'public/bg-removal-data');
const RESOURCES_FILE = path.join(TARGET_DIR, 'resources.json');

let needsSync = true;

if (fs.existsSync(RESOURCES_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(RESOURCES_FILE, 'utf8'));
    if (data['/models/isnet_fp16']) {
      needsSync = false;
      console.log('✓ Model assets for /models/isnet_fp16 already present in public/bg-removal-data/');
    }
  } catch {}
}

if (needsSync) {
  console.log('⚡ Synchronizing 1.7.0 background removal assets...');
  try {
    execSync('node scripts/download-models.mjs', { stdio: 'inherit' });
  } catch (err) {
    console.warn('⚠️ Could not download local models; app will automatically use CDN fallback.');
  }
}
