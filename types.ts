export interface UploadedImage {
  id: string;
  file: File;
  url: string;
  width: number;
  height: number;
  aspectRatio: number;
}

export interface LayoutConfig {
  canvasSize: number;
  gap: number;
  backgroundColor: string;
  targetRowHeightRatio: number; // 0.1 to 0.5 (relative to canvas size)
}

export interface CollageResult {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
}

export interface AIAnalysisResult {
  title: string;
  description: string;
}
