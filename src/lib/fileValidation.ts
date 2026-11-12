export const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
];

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * Validates a single image file for MIME type and size limit.
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `"${file.name}" has an unsupported format (${file.type || 'unknown'}). Supported formats: PNG, JPEG, WebP.`,
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `"${file.name}" is ${sizeMb} MB, which exceeds the 20 MB limit.`,
    };
  }

  return { valid: true };
}

/**
 * Validates multiple files, returning partitioned valid and error items.
 */
export function validateBatchFiles(files: File[]): {
  validFiles: File[];
  errors: string[];
} {
  const validFiles: File[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const result = validateImageFile(file);
    if (result.valid) {
      validFiles.push(file);
    } else if (result.error) {
      errors.push(result.error);
    }
  }

  return { validFiles, errors };
}

/**
 * Sanitizes a filename, strips traversal and special characters,
 * and appends _nobg.png.
 */
export function sanitizeOutputFilename(originalName: string, suffix = '_nobg.png'): string {
  // Strip path traversal attempts and directory separators
  let base = originalName.replace(/^.*[\\/]/, '');
  
  // Remove original extension if present
  const lastDot = base.lastIndexOf('.');
  if (lastDot > 0) {
    base = base.substring(0, lastDot);
  }

  // Remove unsafe filesystem characters
  base = base.replace(/[^a-zA-Z0-9_\-\s.]/g, '').trim();
  if (!base) {
    base = 'image';
  }

  return `${base}${suffix}`;
}

/**
 * Formats bytes to human-readable string (KB, MB).
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

