import React, { useCallback, useState } from 'react';
import { UploadCloud, Image as ImageIcon, Loader2 } from 'lucide-react';
import { loadImageDimensions } from '../utils/layoutEngine';
import { UploadedImage } from '../types';

interface DropzoneProps {
  onImagesAdded: (images: UploadedImage[]) => void;
  isProcessing: boolean;
}

const Dropzone: React.FC<DropzoneProps> = ({ onImagesAdded, isProcessing }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [loadingCount, setLoadingCount] = useState(0);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFiles = async (files: FileList | File[]) => {
    setLoadingCount(files.length);
    const promises: Promise<UploadedImage>[] = [];
    
    Array.from(files).forEach((file) => {
      if (file.type.startsWith('image/')) {
        promises.push(loadImageDimensions(file));
      }
    });

    try {
      const loadedImages = await Promise.all(promises);
      onImagesAdded(loadedImages);
    } catch (err) {
      console.error("Error loading images", err);
    } finally {
      setLoadingCount(0);
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFiles(e.dataTransfer.files);
    }
  }, [onImagesAdded]);

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFiles(e.target.files);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative border-2 border-dashed rounded-2xl p-10 transition-all duration-300 ease-in-out
        flex flex-col items-center justify-center text-center cursor-pointer group
        ${isDragging 
          ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]' 
          : 'border-gray-700 bg-gray-800/50 hover:border-gray-500 hover:bg-gray-800'}
        ${isProcessing || loadingCount > 0 ? 'pointer-events-none opacity-50' : ''}
      `}
    >
      <input
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileInput}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={isProcessing || loadingCount > 0}
      />
      
      {loadingCount > 0 ? (
        <div className="flex flex-col items-center animate-pulse">
          <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mb-4" />
          <p className="text-gray-300 font-medium">正在处理 {loadingCount} 张图片...</p>
        </div>
      ) : (
        <>
          <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center mb-4 group-hover:bg-gray-600 transition-colors">
            <UploadCloud className="w-8 h-8 text-indigo-400" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            拖拽图片到这里
          </h3>
          <p className="text-gray-400 text-sm max-w-md">
            或点击浏览文件。支持 JPG, PNG。
            <br/>
            <span className="text-xs text-gray-500 mt-2 block">
              建议使用 50 张以上图片以获得最佳 10K 拼贴效果。
            </span>
          </p>
        </>
      )}
    </div>
  );
};

export default Dropzone;