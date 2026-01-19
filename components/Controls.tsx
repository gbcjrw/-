import React from 'react';
import { LayoutConfig } from '../types';
import { Settings, RefreshCw, Trash2, Sliders } from 'lucide-react';

interface ControlsProps {
  config: LayoutConfig;
  onChange: (config: LayoutConfig) => void;
  onGenerate: () => void;
  onClear: () => void;
  isGenerating: boolean;
  imageCount: number;
}

const Controls: React.FC<ControlsProps> = ({ 
  config, 
  onChange, 
  onGenerate, 
  onClear,
  isGenerating,
  imageCount
}) => {
  const handleChange = (key: keyof LayoutConfig, value: string | number) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <div className="bg-gray-800/80 backdrop-blur-sm border border-gray-700 rounded-xl p-6 space-y-6">
      <div className="flex items-center gap-2 mb-4 border-b border-gray-700 pb-4">
        <Settings className="w-5 h-5 text-indigo-400" />
        <h2 className="text-lg font-semibold text-white">配置参数</h2>
      </div>

      <div className="space-y-4">
        {/* Canvas Size */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">
            画布分辨率
          </label>
          <select
            value={config.canvasSize}
            onChange={(e) => handleChange('canvasSize', Number(e.target.value))}
            className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
          >
            <option value={1000}>1,000 x 1,000 (快速预览)</option>
            <option value={4000}>4,000 x 4,000 (4K 超清)</option>
            <option value={8000}>8,000 x 8,000 (8K 极清)</option>
            <option value={10000}>10,000 x 10,000 (10K 极限)</option>
          </select>
          {config.canvasSize >= 8000 && (
            <p className="text-amber-500 text-xs mt-1">
              警告：内存占用极高，在移动设备上可能会崩溃。
            </p>
          )}
        </div>

        {/* Gap */}
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">图片间距</label>
            <span className="text-xs text-gray-500">{config.gap}px</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={config.gap}
            onChange={(e) => handleChange('gap', Number(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>

        {/* Density / Row Height */}
        <div>
           <div className="flex justify-between mb-1">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">排版密度</label>
            <span className="text-xs text-gray-500">
                {config.targetRowHeightRatio < 0.1 ? '高' : config.targetRowHeightRatio > 0.3 ? '低' : '中'}
            </span>
          </div>
          <input
            type="range"
            min="50"
            max="400"
            // We map slider 50-400 to ratio 0.05-0.4 (inverted logic for UI "Density")
            // Actually let's just do row height ratio directly
            // Small ratio = small rows = high density
            value={config.targetRowHeightRatio * 1000}
            onChange={(e) => handleChange('targetRowHeightRatio', Number(e.target.value) / 1000)}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>

        {/* Background Color */}
        <div>
           <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">
            背景颜色
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={config.backgroundColor}
              onChange={(e) => handleChange('backgroundColor', e.target.value)}
              className="w-10 h-10 rounded cursor-pointer border-0 p-0 bg-transparent"
            />
            <span className="text-sm font-mono text-gray-400">{config.backgroundColor}</span>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-700 space-y-3">
        <button
          onClick={onGenerate}
          disabled={isGenerating || imageCount === 0}
          className={`
            w-full py-3 px-4 rounded-lg font-bold text-white flex items-center justify-center gap-2 transition-all shadow-lg
            ${isGenerating || imageCount === 0
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20 active:scale-95'}
          `}
        >
          {isGenerating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
          {isGenerating ? '正在渲染亿级像素...' : '生成拼贴画'}
        </button>
        
        <button
          onClick={onClear}
          className="w-full py-2 px-4 rounded-lg font-medium text-gray-400 hover:text-red-400 hover:bg-red-900/20 flex items-center justify-center gap-2 transition-all"
        >
          <Trash2 className="w-4 h-4" />
          清空所有图片
        </button>
      </div>
    </div>
  );
};

export default Controls;