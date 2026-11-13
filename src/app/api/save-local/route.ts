import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    let directoryPath = '';
    let filename = '';
    let verifyOnly = false;
    let fileBuffer: Buffer | null = null;

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      directoryPath = (formData.get('directoryPath') as string) || '';
      filename = (formData.get('filename') as string) || '';
      verifyOnly = formData.get('verifyOnly') === 'true';

      const fileEntry = formData.get('file');
      if (fileEntry instanceof Blob) {
        const arrayBuffer = await fileEntry.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
      }
    } else {
      // JSON payload
      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return NextResponse.json(
          { success: false, error: 'Malformed JSON payload.' },
          { status: 400 }
        );
      }
      directoryPath = typeof body.directoryPath === 'string' ? body.directoryPath : '';
      filename = typeof body.filename === 'string' ? body.filename : '';
      verifyOnly = Boolean(body.verifyOnly);

      if (typeof body.fileBase64 === 'string') {
        // Strip data:image/...;base64, prefix if present
        const base64Clean = body.fileBase64.replace(/^data:image\/\w+;base64,/, '');
        fileBuffer = Buffer.from(base64Clean, 'base64');
      }
    }

    // 1. Validate directoryPath
    if (!directoryPath || typeof directoryPath !== 'string') {
      return NextResponse.json(
        { success: false, error: 'A valid absolute directory path is required.' },
        { status: 400 }
      );
    }

    const trimmedDir = directoryPath.trim();
    if (!path.isAbsolute(trimmedDir)) {
      return NextResponse.json(
        {
          success: false,
          error: `Path "${trimmedDir}" is not an absolute path. Please provide a full path (e.g. C:\\Users\\... or /home/...).`,
        },
        { status: 400 }
      );
    }

    // 2. Folder verification mode
    if (verifyOnly) {
      try {
        await fs.promises.mkdir(trimmedDir, { recursive: true });
        // Test write and delete permissions
        const probeFile = path.join(trimmedDir, `.perm_probe_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
        await fs.promises.writeFile(probeFile, 'test');
        await fs.promises.unlink(probeFile);

        return NextResponse.json({
          success: true,
          verified: true,
          directoryPath: trimmedDir,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Permission denied or directory unreachable.';
        return NextResponse.json(
          { success: false, error: `Directory verification failed: ${message}` },
          { status: 400 }
        );
      }
    }

    // 3. File saving mode
    if (!fileBuffer || fileBuffer.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No binary image file data provided.' },
        { status: 400 }
      );
    }

    if (!filename || typeof filename !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Filename is required.' },
        { status: 400 }
      );
    }

    // Sanitize filename against traversal
    let safeFilename = path.basename(filename).replace(/[\/\\]/g, '');
    safeFilename = safeFilename.replace(/[^a-zA-Z0-9_\-\s.]/g, '').trim();

    if (!safeFilename) {
      safeFilename = `nobg_${Date.now()}.png`;
    }

    // Ensure directory exists
    await fs.promises.mkdir(trimmedDir, { recursive: true });

    const targetFilePath = path.join(trimmedDir, safeFilename);

    // Write file to disk
    await fs.promises.writeFile(targetFilePath, fileBuffer);

    return NextResponse.json({
      success: true,
      savedPath: targetFilePath,
      filename: safeFilename,
      bytes: fileBuffer.length,
    });
  } catch (error: unknown) {
    console.error('Error in /api/save-local route:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
