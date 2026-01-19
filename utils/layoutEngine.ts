import { UploadedImage, LayoutConfig } from "../types";

interface PositionedImage {
  image: UploadedImage;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Loads an image file to get dimensions
export const loadImageDimensions = (file: File): Promise<UploadedImage> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        id: Math.random().toString(36).substr(2, 9),
        file,
        url,
        width: img.width,
        height: img.height,
        aspectRatio: img.width / img.height,
      });
    };
    img.onerror = reject;
    img.src = url;
  });
};

// Justified Layout Algorithm
export const calculateLayout = (
  images: UploadedImage[],
  config: LayoutConfig
): PositionedImage[] => {
  const { canvasSize, gap, targetRowHeightRatio } = config;
  const layout: PositionedImage[] = [];
  
  if (images.length === 0) return layout;

  const targetRowHeight = canvasSize * targetRowHeightRatio;
  let currentRow: UploadedImage[] = [];
  let currentY = gap;
  
  // Helper to process a finished row
  const processRow = (rowImages: UploadedImage[], isLastRow: boolean) => {
    if (rowImages.length === 0) return;

    // Calculate aspect ratios total for this row
    const totalAspectRatio = rowImages.reduce((sum, img) => sum + img.aspectRatio, 0);
    
    // Calculate required width for content only (excluding gaps)
    const totalGapWidth = (rowImages.length + 1) * gap;
    const availableWidth = canvasSize - totalGapWidth;

    // Calculate actual height needed to fit these images exactly in width
    let rowHeight = availableWidth / totalAspectRatio;

    // If it's the last row, don't let it blow up in size if it's too empty. 
    // Cap it at targetRowHeight * 1.5
    if (isLastRow && rowHeight > targetRowHeight * 1.5) {
      rowHeight = targetRowHeight;
    }

    let currentX = gap;
    
    rowImages.forEach((img) => {
      const w = rowHeight * img.aspectRatio;
      layout.push({
        image: img,
        x: currentX,
        y: currentY,
        width: w,
        height: rowHeight,
      });
      currentX += w + gap;
    });

    currentY += rowHeight + gap;
  };

  for (const img of images) {
    currentRow.push(img);
    
    // Check if adding this image makes the row wide enough
    const currentTotalAspectRatio = currentRow.reduce((sum, i) => sum + i.aspectRatio, 0);
    const currentContentWidth = currentRow.length * targetRowHeight * currentTotalAspectRatio; // Approximate
    
    // Heuristic: If we are roughly close to filling the width
    // Actually, simpler math: The width with target height would be:
    const widthAtTargetHeight = (targetRowHeight * currentTotalAspectRatio) + ((currentRow.length + 1) * gap);

    if (widthAtTargetHeight >= canvasSize) {
      processRow(currentRow, false);
      currentRow = [];
    }
  }

  // Process remaining
  if (currentRow.length > 0) {
    processRow(currentRow, true);
  }

  return layout;
};

export const renderCollage = async (
  images: UploadedImage[],
  config: LayoutConfig
): Promise<string> => {
  const layout = calculateLayout(images, config);
  const canvas = document.createElement('canvas');
  canvas.width = config.canvasSize;
  canvas.height = config.canvasSize;
  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error("Could not get canvas context");

  // Background
  ctx.fillStyle = config.backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw images
  // We use a Promise.all to ensure drawing order if needed, but synchronous loop is fine if images are loaded
  // However, we only have file URLs. We need HTMLImageElements.
  
  const drawPromises = layout.map((item) => {
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        // High quality scaling
        ctx.drawImage(img, item.x, item.y, item.width, item.height);
        resolve();
      };
      img.src = item.image.url;
    });
  });

  await Promise.all(drawPromises);

  // Return base64. 
  // WARNING: 10000x10000 JPEG at 0.8 quality is huge (approx 10-20MB). 
  // Browser might struggle with toDataURL for very large canvas.
  // Using toBlob is safer for memory, but for preview we return DataURL.
  // For the actual download, we should likely use blob.
  
  return canvas.toDataURL('image/jpeg', 0.85);
};

export const renderCollageToBlob = async (
  images: UploadedImage[],
  config: LayoutConfig
): Promise<Blob> => {
  const layout = calculateLayout(images, config);
  
  // Use OffscreenCanvas if available for better performance in workers (not implemented here but good practice)
  // Fallback to document element
  const canvas = document.createElement('canvas');
  canvas.width = config.canvasSize;
  canvas.height = config.canvasSize;
  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error("Could not get canvas context");

  ctx.fillStyle = config.backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const drawPromises = layout.map((item) => {
    return new Promise<void>((resolve) => {
      const img = new Image();
      // Ensure we don't block main thread too much (though difficult in single thread)
      img.onload = () => {
        ctx.drawImage(img, item.x, item.y, item.width, item.height);
        resolve();
      };
      img.src = item.image.url;
    });
  });

  await Promise.all(drawPromises);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas toBlob failed"));
    }, 'image/jpeg', 0.90);
  });
};
