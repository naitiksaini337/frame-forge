import fs from 'fs';
import path from 'path';

const src = path.resolve(process.cwd(), 'node_modules/@imgly/background-removal-data/dist');
const dest = path.resolve(process.cwd(), 'public/bg-removal-data');

if (fs.existsSync(src)) {
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
  console.log('✓ Successfully synchronized background removal assets to public/bg-removal-data');
} else {
  console.log('ℹ Notice: @imgly/background-removal-data not yet installed.');
}
