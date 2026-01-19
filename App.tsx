import React, { useState, useEffect, useCallback } from 'react';
import Dropzone from './components/Dropzone';
import Controls from './components/Controls';
import { UploadedImage, LayoutConfig } from './types';
import { renderCollageToBlob, renderCollage } from './utils/layoutEngine';
import { Download, AlertCircle, X, Maximize2 } from 'lucide-react';

const App: React.FC = () => {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [config, setConfig] = useState<LayoutConfig>({
    canvasSize: 10000,
    gap: 15,
    backgroundColor: '#000000',
    targetRowHeightRatio: 0.15, // Default row height is 15% of canvas (dynamic based on count usually better, but fixed is easier to understand)
  });
  
  const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clean up object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      images.forEach(img => URL.revokeObjectURL(img.url));
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, []);

  const handleImagesAdded = (newImages: UploadedImage[]) => {
    setImages(prev => [...prev, ...newImages]);
    // Auto-adjust density based on image count for better first result
    if (images.length + newImages.length > 50) {
        setConfig(prev => ({ ...prev, targetRowHeightRatio: 0.05 }));
    }
  };

  const handleClear = () => {
    setImages([]);
    setGeneratedBlob(null);
    setPreviewUrl(null);
    setError(null);
  };

  const generateCollage = async () => {
    if (images.length === 0) return;
    
    setIsGenerating(true);
    setError(null);

    try {
      // 1. Generate the full resolution Blob for download
      // We use a timeout to let the UI render the loading state before blocking the thread
      setTimeout(async () => {
        try {
          const blob = await renderCollageToBlob(images, config);
          setGeneratedBlob(blob);

          // 2. Generate a smaller preview for display
          // We can't display a 10k x 10k image easily in an <img> tag without massive memory use.
          // So we generate a 1000px preview.
          const previewConfig = { ...config, canvasSize: 1000, gap: Math.max(2, config.gap / 10) };
          const previewDataUrl = await renderCollage(images, previewConfig);
          setPreviewUrl(previewDataUrl);
        } catch (err: any) {
          setError(err.message || "生成拼贴画失败");
        } finally {
          setIsGenerating(false);
        }
      }, 100);
    } catch (err) {
      setError("无法启动生成流程。");
      setIsGenerating(false);
    }
  };

  const downloadCollage = () => {
    if (!generatedBlob) return;
    const url = URL.createObjectURL(generatedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `multitexture-${config.canvasSize}x${config.canvasSize}-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 font-sans">
      <header className="max-w-7xl mx-auto mb-10 flex flex-col items-center text-center gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent tracking-tight">
            多重纹理
          </h1>
          <p className="text-gray-400 mt-3 text-lg">
            客户端渲染，轻松创建亿级像素巨幅拼图。
          </p>
        </div>
        <div className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-full px-6 py-2 text-sm text-gray-400">
            已加载 {images.length} 张图片
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Controls & Upload */}
        <div className="lg:col-span-4 space-y-6">
          <Dropzone onImagesAdded={handleImagesAdded} isProcessing={isGenerating} />
          
          <div className="bg-gray-800/30 rounded-lg p-4 max-h-60 overflow-y-auto custom-scrollbar border border-gray-800">
            <h3 className="text-sm font-semibold text-gray-400 mb-2 sticky top-0 bg-gray-900/90 backdrop-blur py-1 z-10">
              图片列表
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {images.map((img) => (
                <div key={img.id} className="aspect-square relative group overflow-hidden rounded bg-gray-900">
                  <img src={img.url} alt="thumbnail" className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                  <button 
                    onClick={() => setImages(images.filter(i => i.id !== img.id))}
                    className="absolute top-0 right-0 p-1 bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {images.length === 0 && (
                <p className="col-span-4 text-center text-gray-600 text-sm py-4">暂无图片</p>
              )}
            </div>
          </div>

          <Controls 
            config={config} 
            onChange={setConfig} 
            onGenerate={generateCollage} 
            onClear={handleClear}
            isGenerating={isGenerating}
            imageCount={images.length}
          />
        </div>

        {/* Right Column: Preview & Output */}
        <div className="lg:col-span-8 space-y-6">
          <div className={`
            relative w-full aspect-square bg-gray-900 rounded-2xl border-2 border-gray-800 overflow-hidden flex items-center justify-center
            ${!previewUrl ? 'border-dashed' : 'border-solid border-indigo-500/30 shadow-2xl shadow-black'}
          `}>
            {previewUrl ? (
              <img 
                src={previewUrl} 
                alt="Collage Preview" 
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-center text-gray-600">
                <Maximize2 className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p>预览将显示在这里</p>
                <p className="text-xs mt-2">生成完成后可下载最高分辨率原图</p>
              </div>
            )}
            
            {/* Loading Overlay */}
            {isGenerating && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <h3 className="text-xl font-bold text-white">正在生成...</h3>
                <p className="text-indigo-300 text-sm mt-2">正在处理 {config.canvasSize}x{config.canvasSize} 像素</p>
              </div>
            )}
          </div>

          {/* Action Bar */}
          {previewUrl && (
            <div className="mt-4">
              {/* Download Card */}
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">下载高清原图</h3>
                  <p className="text-sm text-gray-400">
                    完整 {config.canvasSize}x{config.canvasSize}px JPEG。
                    {generatedBlob && ` 大小: ${(generatedBlob.size / 1024 / 1024).toFixed(2)} MB`}
                  </p>
                </div>
                <button
                  onClick={downloadCollage}
                  className="py-3 px-8 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap shadow-lg shadow-indigo-500/20"
                >
                  <Download className="w-5 h-5" />
                  下载拼贴画
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-900/20 border border-red-800 text-red-200 p-4 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;