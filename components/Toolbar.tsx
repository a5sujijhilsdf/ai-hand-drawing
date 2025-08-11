
import React from 'react';
import { PlayIcon, PauseIcon, ClearIcon } from './icons';

interface ToolbarProps {
    isTracking: boolean;
    onToggleTracking: () => void;
    onClearCanvas: () => void;
    penColor: string;
    setPenColor: (color: string) => void;
    penWidth: number;
    setPenWidth: (width: number) => void;
    isLoading: boolean;
}

const Toolbar: React.FC<ToolbarProps> = ({
    isTracking,
    onToggleTracking,
    onClearCanvas,
    penColor,
    setPenColor,
    penWidth,
    setPenWidth,
    isLoading
}) => {
    return (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-full max-w-md mx-auto p-2">
            <div className="bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-2xl p-4 flex items-center justify-center space-x-4">
                <button
                    onClick={onToggleTracking}
                    disabled={isLoading}
                    className="w-16 h-16 rounded-full flex items-center justify-center text-white transition-all duration-300 ease-in-out bg-blue-600 hover:bg-blue-500 disabled:bg-gray-500 disabled:cursor-not-allowed transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-blue-400"
                    aria-label={isTracking ? 'Pause Tracking' : 'Start Tracking'}
                >
                    {isLoading ? (
                         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                    ) : isTracking ? (
                        <PauseIcon className="w-8 h-8" />
                    ) : (
                        <PlayIcon className="w-8 h-8" />
                    )}
                </button>

                <button
                    onClick={onClearCanvas}
                    className="w-16 h-16 rounded-full flex items-center justify-center text-white transition-all duration-300 ease-in-out bg-red-600 hover:bg-red-500 transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-red-400"
                    aria-label="Clear Canvas"
                >
                    <ClearIcon className="w-8 h-8" />
                </button>

                <div className="flex flex-col items-center space-y-2">
                    <label htmlFor="penColor" className="text-xs text-gray-300">Color</label>
                    <input
                        type="color"
                        id="penColor"
                        value={penColor}
                        onChange={(e) => setPenColor(e.target.value)}
                        className="w-12 h-12 p-1 bg-gray-700 border-2 border-gray-600 rounded-full cursor-pointer"
                        aria-label="Pen Color"
                    />
                </div>
                 <div className="flex flex-col items-center space-y-2 text-center">
                    <label htmlFor="penWidth" className="text-xs text-gray-300 w-full">Width ({penWidth}px)</label>
                    <input
                        type="range"
                        id="penWidth"
                        min="1"
                        max="30"
                        value={penWidth}
                        onChange={(e) => setPenWidth(Number(e.target.value))}
                        className="w-24 cursor-pointer"
                        aria-label="Pen Width"
                    />
                </div>
            </div>
        </div>
    );
};

export default Toolbar;
