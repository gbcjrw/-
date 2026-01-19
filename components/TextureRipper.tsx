import React, { useState, useRef, useEffect } from 'react';
import { Upload, Scissors, RefreshCcw, Download, Image as ImageIcon, Clipboard, X } from 'lucide-react';
import { warpPerspective, Point } from '../utils/perspectiveWarp';

const TextureRipper: React.FC = () => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ w: number; h: number } | null>(null);
  const [points, setPoints] = useState<Point[]>([]); // [TL, TR, BR, BL]
  const [resultSrc, setResultSrc] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<number | null>(null); // Index of point being dragged
  const [isProcessing, setIsProcessing] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 初始化图片和点
  const handleImageLoad = (src: string) => {
    const img = new Image();
    img.onload = () => {
      setImageSrc(src);
      setImageDimensions({ w: img.width, h: img.height });
      // 默认选中图片中央 80% 的区域，避免点直接在边缘不好拖动
      const paddingX = img.width * 0.1;
      const paddingY = img.height * 0.1;
      setPoints([
        { x: paddingX, y: paddingY }, // TL
        { x: img.width - paddingX, y: paddingY }, // TR
        { x: img.width - paddingX, y: img.height - paddingY }, // BR
        { x: paddingX, y: img.height - paddingY }, // BL
      ]);
      setResultSrc(null);
    };
    img.src = src;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const url = URL.createObjectURL(e.target.files[0]);
      handleImageLoad(url);
      // Reset input so same file can be selected again if needed
      e.target.value = '';
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handlePaste = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation(); // Prevent triggering the parent click
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        if (item.types.some(type => type.startsWith('image/'))) {
          const blob = await item.getType(item.types.find(type => type.startsWith('image/'))!);
          const url = URL.createObjectURL(blob);
          handleImageLoad(url);
          return;
        }
      }
      alert('剪贴板中没有图片');
    } catch (err) {
      console.error(err);
      // Fallback for older browsers
      alert('请直接在页面按 Ctrl+V 粘贴');
    }
  };

  // 全局粘贴监听
  useEffect(() => {
    const pasteListener = (e: ClipboardEvent) => {
      // 只有当没有加载图片时，才响应全局粘贴，或者即使加载了也响应？
      // 为了方便，随时响应，替换当前图片
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        const file = e.clipboardData.files[0];
        if (file.type.startsWith('image/')) {
           const url = URL.createObjectURL(file);
           handleImageLoad(url);
        }
      }
    };
    window.addEventListener('paste', pasteListener);
    return () => window.removeEventListener('paste', pasteListener);
  }, []);

  // 绘制 Canvas UI (图片 + 控制点)
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !imageSrc || !imageDimensions || points.length !== 4) return;

    // 自适应大小：让 Canvas 适应容器宽度，保持图片长宽比
    const containerWidth = container.clientWidth;
    const scale = containerWidth / imageDimensions.w;
    const displayHeight = imageDimensions.h * scale;

    canvas.width = containerWidth;
    canvas.height = displayHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. 绘制底图
    const img = new Image();
    img.src = imageSrc;
    
    if (img.complete) {
        drawUI(ctx, img, scale);
    } else {
        img.onload = () => drawUI(ctx, img, scale);
    }

    function drawUI(ctx: CanvasRenderingContext2D, img: HTMLImageElement, scale: number) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // 2. 绘制连接线 (Quad)
      ctx.beginPath();
      ctx.moveTo(points[0].x * scale, points[0].y * scale);
      points.forEach((p, i) => {
        if (i > 0) ctx.lineTo(p.x * scale, p.y * scale);
      });
      ctx.closePath();
      ctx.strokeStyle = '#6366f1'; // Indigo-500
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // 半透明填充
      ctx.fillStyle = 'rgba(99, 102, 241, 0.2)';
      ctx.fill();

      // 3. 绘制控制点
      points.forEach((p, i) => {
        const x = p.x * scale;
        const y = p.y * scale;
        
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#4f46e5'; // Indigo-600
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }

  }, [imageSrc, imageDimensions, points]);

  // 处理拖拽交互
  const getMousePos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !imageDimensions) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    const scaleX = imageDimensions.w / rect.width;
    const scaleY = imageDimensions.h / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!imageDimensions) return;
    const pos = getMousePos(e);
    // 检测点击了哪个点 (阈值 20px 原始尺寸 approx)
    const threshold = Math.max(imageDimensions.w * 0.05, 20); 

    const index = points.findIndex(p => Math.hypot(p.x - pos.x, p.y - pos.y) < threshold);
    if (index !== -1) {
      setIsDragging(index);
      e.preventDefault(); // 防止触摸滚动
    }
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (isDragging === null || !imageDimensions) return;
    const pos = getMousePos(e);
    
    // 限制在图片范围内
    const newX = Math.max(0, Math.min(pos.x, imageDimensions.w));
    const newY = Math.max(0, Math.min(pos.y, imageDimensions.h));

    const newPoints = [...points];
    newPoints[isDragging] = { x: newX, y: newY };
    setPoints(newPoints);
  };

  const handleMouseUp = () => {
    setIsDragging(null);
  };

  const handleRip = async () => {
    if (!imageSrc || points.length !== 4) return;
    setIsProcessing(true);
    // Give UI a moment to update
    setTimeout(async () => {
        try {
            const result = await warpPerspective(imageSrc, points);
            setResultSrc(result);
        } catch (e) {
            console.error(e);
            alert("处理失败");
        } finally {
            setIsProcessing(false);
        }
    }, 50);
  };

  const clearImage = () => {
    setImageSrc(null);
    setImageDimensions(null);
    setResultSrc(null);
  };

  const downloadResult = () => {
    if (!resultSrc) return;
    const a = document.createElement('a');
    a.href = resultSrc;
    a.download = `texture-rip-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 lg:p-10 shadow-xl" ref={containerRef}>
      {/* 标题区域 - 居中且移除按钮 */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold flex items-center justify-center gap-2 text-white">
          <Scissors className="w-8 h-8 text-indigo-400" />
          纹理提取器
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 左侧：编辑器 */}
        <div className="space-y-4">
            <input 
                type="file" 
                ref={fileInputRef}
                className="hidden" 
                accept="image/*" 
                onChange={handleFileUpload} 
            />
            
            <div 
                className={`
                    bg-gray-950 rounded-xl border-2 border-dashed relative overflow-hidden min-h-[400px] flex items-center justify-center select-none transition-colors
                    ${!imageSrc ? 'border-gray-700 hover:border-indigo-500 hover:bg-gray-900 cursor-pointer' : 'border-gray-800'}
                `}
                onClick={!imageSrc ? triggerFileUpload : undefined}
            >
                {!imageSrc ? (
                    <div className="text-center text-gray-500 space-y-4">
                        <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-2">
                            <Upload className="w-8 h-8 text-indigo-400" />
                        </div>
                        <div>
                            <p className="text-lg text-gray-300 font-medium">点击上传图片</p>
                            <p className="text-sm mt-1">支持 JPG, PNG</p>
                        </div>
                        <div className="flex items-center justify-center gap-2 pt-2">
                            <span className="text-xs uppercase tracking-wide opacity-50">或者</span>
                        </div>
                         <button 
                            onClick={handlePaste}
                            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2 border border-gray-700"
                        >
                            <Clipboard className="w-4 h-4" />
                            粘贴剪贴板 (Ctrl+V)
                        </button>
                    </div>
                ) : (
                    <>
                        <canvas 
                            ref={canvasRef}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            onTouchStart={handleMouseDown}
                            onTouchMove={handleMouseMove}
                            onTouchEnd={handleMouseUp}
                            className="cursor-crosshair w-full max-w-full"
                        />
                        {/* 清除按钮 */}
                        <button 
                            onClick={(e) => { e.stopPropagation(); clearImage(); }}
                            className="absolute top-3 right-3 p-2 bg-gray-900/80 hover:bg-red-600 text-white rounded-full backdrop-blur-sm transition-colors shadow-lg z-10"
                            title="更换图片"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </>
                )}
            </div>
            
            <button
                onClick={handleRip}
                disabled={!imageSrc || isProcessing}
                className={`
                    w-full py-3 rounded-lg font-bold text-lg flex items-center justify-center gap-2 transition-all
                    ${!imageSrc 
                        ? 'bg-gray-800 text-gray-600 cursor-not-allowed' 
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'}
                `}
            >
                {isProcessing ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Scissors className="w-5 h-5" />}
                {isProcessing ? '处理中...' : '提取纹理'}
            </button>
        </div>

        {/* 右侧：结果 */}
        <div className="space-y-4 flex flex-col h-full">
            <div className="bg-gray-950 rounded-xl border border-gray-800 p-1 flex-grow min-h-[400px] flex items-center justify-center relative overflow-hidden group">
                {resultSrc ? (
                     <div className="relative w-full h-full flex items-center justify-center">
                         {/* Checkboard background for transparency */}
                         <div className="absolute inset-0 opacity-20" style={{
                             backgroundImage: 'linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%)',
                             backgroundSize: '20px 20px',
                             backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
                         }} />
                        <img src={resultSrc} alt="Result" className="max-w-full max-h-[500px] object-contain relative z-10 shadow-2xl" />
                     </div>
                ) : (
                    <div className="text-center text-gray-600">
                         <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>提取结果将显示在这里</p>
                    </div>
                )}
            </div>

            <button
                onClick={downloadResult}
                disabled={!resultSrc}
                className={`
                    w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all
                    ${!resultSrc
                        ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-500/20'}
                `}
            >
                <Download className="w-5 h-5" />
                下载结果
            </button>
        </div>
      </div>
    </div>
  );
};

export default TextureRipper;