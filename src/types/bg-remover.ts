export type ProcessingStatus = 'queued' | 'processing' | 'done' | 'error';

export type BgModelType = 'isnet' | 'isnet_fp16';

export interface QueueItem {
  id: string;
  file: File;
  name: string;
  size: number;
  thumbnailUrl: string;
  status: ProcessingStatus;
  progress: number;
  progressText?: string;
  rawProcessedBlob?: Blob;
  processedBlob?: Blob;
  processedUrl?: string;
  featherRadius?: number;
  error?: string;
  originalDimensions?: { width: number; height: number };
}

export interface MaskEditorState {
  tool: 'brush' | 'eraser';
  brushSize: number;
  brushHardness: number;
  zoom: number;
  pan: { x: number; y: number };
}

export interface SaveLocalResponse {
  success: boolean;
  savedPath?: string;
  error?: string;
  verified?: boolean;
  directoryPath?: string;
}
