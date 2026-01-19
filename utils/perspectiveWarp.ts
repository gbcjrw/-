
export interface Point {
  x: number;
  y: number;
}

// 求解线性方程组 (Gaussian elimination)
function solve(A: number[][], b: number[]): number[] {
  const n = A.length;
  for (let i = 0; i < n; i++) {
    // Search for maximum in this column
    let maxEl = Math.abs(A[i][i]);
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > maxEl) {
        maxEl = Math.abs(A[k][i]);
        maxRow = k;
      }
    }

    // Swap maximum row with current row
    for (let k = i; k < n; k++) {
      const tmp = A[maxRow][k];
      A[maxRow][k] = A[i][k];
      A[i][k] = tmp;
    }
    const tmp = b[maxRow];
    b[maxRow] = b[i];
    b[i] = tmp;

    // Make all rows below this one 0 in current column
    for (let k = i + 1; k < n; k++) {
      const c = -A[k][i] / A[i][i];
      for (let j = i; j < n; j++) {
        if (i === j) {
          A[k][j] = 0;
        } else {
          A[k][j] += c * A[i][j];
        }
      }
      b[k] += c * b[i];
    }
  }

  // Solve equation Ax=b for an upper triangular matrix A
  const x = new Array(n).fill(0);
  for (let i = n - 1; i > -1; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) {
      sum += A[i][j] * x[j];
    }
    x[i] = (b[i] - sum) / A[i][i];
  }
  return x;
}

// 计算单应性矩阵 (Dest -> Src)
// 我们需要将目标矩形 (0,0, w,0, w,h, 0,h) 映射回源图像的四个点
function getHomographyMatrix(src: Point[], dst: Point[]) {
  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const s = src[i];
    const d = dst[i];
    A.push([d.x, d.y, 1, 0, 0, 0, -s.x * d.x, -s.x * d.y]);
    A.push([0, 0, 0, d.x, d.y, 1, -s.y * d.x, -s.y * d.y]);
    b.push(s.x);
    b.push(s.y);
  }

  const h = solve(A, b);
  h.push(1); // h33 is always 1
  return h;
}

export async function warpPerspective(
  imageSrc: string,
  corners: Point[]
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // 1. Calculate dimensions of the output
      // Use the max width/height of the selected quad sides to approximate aspect ratio
      const topW = Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y);
      const botW = Math.hypot(corners[2].x - corners[3].x, corners[2].y - corners[3].y);
      const leftH = Math.hypot(corners[3].x - corners[0].x, corners[3].y - corners[0].y);
      const rightH = Math.hypot(corners[2].x - corners[1].x, corners[2].y - corners[1].y);

      const width = Math.floor(Math.max(topW, botW));
      const height = Math.floor(Math.max(leftH, rightH));

      // 2. Create destination canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject("Canvas context error");

      // 3. Create source canvas to read pixels
      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = img.width;
      srcCanvas.height = img.height;
      const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
      if (!srcCtx) return reject("Source canvas context error");
      srcCtx.drawImage(img, 0, 0);
      const srcData = srcCtx.getImageData(0, 0, img.width, img.height);
      const dstData = ctx.createImageData(width, height);

      // 4. Calculate Homography Matrix: Dest (Rect) -> Source (Quad)
      // Destination points: TL(0,0), TR(w,0), BR(w,h), BL(0,h)
      // Source points: User selected corners
      const dstPoints = [
        { x: 0, y: 0 },
        { x: width, y: 0 },
        { x: width, y: height },
        { x: 0, y: height },
      ];

      const H = getHomographyMatrix(corners, dstPoints);

      // 5. Pixel Iteration (Inverse Mapping)
      const data = dstData.data;
      const sData = srcData.data;
      const w = width;
      const h = height;
      const sw = img.width;
      const sh = img.height;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          // Apply matrix H to (x,y)
          // u = (h00*x + h01*y + h02) / (h20*x + h21*y + h22)
          // v = (h10*x + h11*y + h12) / (h20*x + h21*y + h22)
          const div = H[6] * x + H[7] * y + 1;
          const u = (H[0] * x + H[1] * y + H[2]) / div;
          const v = (H[3] * x + H[4] * y + H[5]) / div;

          // Check bounds
          if (u >= 0 && u < sw - 1 && v >= 0 && v < sh - 1) {
            // Bilinear Interpolation
            const u0 = Math.floor(u);
            const v0 = Math.floor(v);
            const u1 = u0 + 1;
            const v1 = v0 + 1;
            
            const a = u - u0;
            const b = v - v0;
            const ia = 1 - a;
            const ib = 1 - b;

            const idx00 = (v0 * sw + u0) * 4;
            const idx10 = (v0 * sw + u1) * 4;
            const idx01 = (v1 * sw + u0) * 4;
            const idx11 = (v1 * sw + u1) * 4;

            const idx = (y * w + x) * 4;

            // R
            data[idx] = 
              ia * ib * sData[idx00] + 
              a * ib * sData[idx10] + 
              ia * b * sData[idx01] + 
              a * b * sData[idx11];
            // G
            data[idx + 1] = 
              ia * ib * sData[idx00 + 1] + 
              a * ib * sData[idx10 + 1] + 
              ia * b * sData[idx01 + 1] + 
              a * b * sData[idx11 + 1];
            // B
            data[idx + 2] = 
              ia * ib * sData[idx00 + 2] + 
              a * ib * sData[idx10 + 2] + 
              ia * b * sData[idx01 + 2] + 
              a * b * sData[idx11 + 2];
            // A
            data[idx + 3] = 255;
          }
        }
      }

      ctx.putImageData(dstData, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.95));
    };
    img.onerror = () => reject("Failed to load image");
    img.src = imageSrc;
  });
}
