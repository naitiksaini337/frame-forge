import JSZip from 'jszip';

export interface ZipExportItem {
  filename: string;
  blob: Blob;
}

/**
 * Packages multiple image blobs into a ZIP archive and triggers a browser download.
 * Cleans up the generated object URL with a delayed timer to avoid memory leaks.
 */
export async function exportZip(
  items: ZipExportItem[],
  zipFilename = 'nobg_images.zip',
  onProgress?: (percent: number) => void
): Promise<void> {
  if (items.length === 0) return;

  const zip = new JSZip();

  for (const item of items) {
    zip.file(item.filename, item.blob);
  }

  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    },
    (metadata) => {
      if (onProgress) {
        onProgress(Math.round(metadata.percent));
      }
    }
  );

  const downloadUrl = URL.createObjectURL(zipBlob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = zipFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Revoke object URL after delay
  setTimeout(() => {
    URL.revokeObjectURL(downloadUrl);
  }, 15000);
}

/**
 * Downloads a single Blob with a given filename, safely revoking the object URL.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 10000);
}

/**
 * Helper to safely revoke an array of object URLs.
 */
export function revokeObjectUrls(urls: Array<string | undefined | null>): void {
  for (const url of urls) {
    if (url && url.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Ignore revocation errors
      }
    }
  }
}

