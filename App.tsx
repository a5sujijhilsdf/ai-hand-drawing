
import React, { useState, useCallback } from 'react';
import HandTracker from './components/HandTracker';
import Toolbar from './components/Toolbar';

const App: React.FC = () => {
    const [isTracking, setIsTracking] = useState<boolean>(false);
    const [isLoading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [penColor, setPenColor] = useState<string>('#00FFFF'); // Cyan
    const [penWidth, setPenWidth] = useState<number>(10);
    const [clearCanvas, setClearCanvas] = useState<boolean>(false);

    const handleToggleTracking = useCallback(() => {
        setIsTracking(prev => !prev);
    }, []);

    const handleClearCanvas = useCallback(() => {
        setClearCanvas(true);
    }, []);

    return (
        <div className="w-screen h-screen bg-gray-900 flex flex-col items-center justify-center p-4 font-sans overflow-hidden">
            <div className="absolute top-0 left-0 w-full p-4 text-center z-10">
                <h1 className="text-3xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
                    AI Hand Drawing Board
                </h1>
                <p className="text-gray-400 mt-2">Pinch your index finger and thumb to draw.</p>
            </div>

            <div className="relative w-full h-full max-w-7xl max-h-[calc(100vh-12rem)] flex gap-4">
                 {error ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-center p-4 bg-gray-800 rounded-2xl">
                        <p className="text-2xl text-red-500 font-semibold">An Error Occurred</p>
                        <p className="text-gray-400 mt-2">{error}</p>
                    </div>
                ) : (
                    <HandTracker
                        isTracking={isTracking}
                        setIsTracking={setIsTracking}
                        penColor={penColor}
                        penWidth={penWidth}
                        clearCanvas={clearCanvas}
                        setClearCanvas={setClearCanvas}
                        setLoading={setLoading}
                        setError={setError}
                        isLoading={isLoading}
                    />
                )}
            </div>
            
            <Toolbar 
                isTracking={isTracking}
                onToggleTracking={handleToggleTracking}
                onClearCanvas={handleClearCanvas}
                penColor={penColor}
                setPenColor={setPenColor}
                penWidth={penWidth}
                setPenWidth={setPenWidth}
                isLoading={isLoading}
            />
        </div>
    );
};

export default App;
