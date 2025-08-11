
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { HandLandmarker, FilesetResolver, HandLandmarkerResult } from '@mediapipe/tasks-vision';

const runningMode: "IMAGE" | "VIDEO" = "VIDEO";
const PINCH_THRESHOLD = 0.07; // Normalized distance between thumb and index finger to trigger drawing
const SMOOTHING_FACTOR = 0.3; // Higher value = more responsive but more jittery. Lower value = smoother but more lag.

interface HandTrackerProps {
    isTracking: boolean;
    setIsTracking: (isTracking: boolean) => void;
    penColor: string;
    penWidth: number;
    clearCanvas: boolean;
    setClearCanvas: (clear: boolean) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    isLoading: boolean;
}

const HandTracker: React.FC<HandTrackerProps> = ({
    isTracking,
    setIsTracking,
    penColor,
    penWidth,
    clearCanvas,
    setClearCanvas,
    setLoading,
    setError,
    isLoading,
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
    const landmarkCanvasRef = useRef<HTMLCanvasElement>(null);
    const cursorCanvasRef = useRef<HTMLCanvasElement>(null);
    const lastPositionRef = useRef<{ x: number; y: number } | null>(null);
    const smoothedPositionRef = useRef<{ x: number; y: number } | null>(null);
    const animationFrameId = useRef<number | null>(null);
    const handLandmarkerRef = useRef<HandLandmarker | null>(null);
    const [hasStartedDrawing, setHasStartedDrawing] = useState(false);

    // Initialize HandLandmarker
    useEffect(() => {
        const createHandLandmarker = async () => {
            setLoading(true);
            try {
                const filesetResolver = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
                );
                const landmarker = await HandLandmarker.createFromOptions(filesetResolver, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                        delegate: "GPU"
                    },
                    runningMode: runningMode,
                    numHands: 1
                });
                handLandmarkerRef.current = landmarker;
                setError(null);
            } catch (e) {
                console.error(e);
                const errorMessage = e instanceof Error ? e.message : "An unknown error occurred during initialization.";
                setError(`Failed to initialize hand tracker: ${errorMessage}`);
            } finally {
                setLoading(false);
            }
        };
        createHandLandmarker();
        return () => {
            handLandmarkerRef.current?.close();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    
    // Main prediction loop
    const predictWebcam = useCallback(() => {
        const handLandmarker = handLandmarkerRef.current;
        const video = videoRef.current;
        const canvases = {
            drawing: drawingCanvasRef.current,
            landmark: landmarkCanvasRef.current,
            cursor: cursorCanvasRef.current,
        };
        const contexts = {
            drawing: canvases.drawing?.getContext('2d'),
            landmark: canvases.landmark?.getContext('2d'),
            cursor: canvases.cursor?.getContext('2d'),
        };

        if (!video || !handLandmarker || !canvases.drawing || !canvases.landmark || !canvases.cursor || !contexts.drawing || !contexts.landmark || !contexts.cursor) {
            if (isTracking) animationFrameId.current = requestAnimationFrame(predictWebcam);
            return;
        }

        // Optimization: Ensure canvases are correctly sized once before loop if needed
        [canvases.drawing, canvases.landmark, canvases.cursor].forEach(canvas => {
            if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
                canvas.width = canvas.clientWidth;
                canvas.height = canvas.clientHeight;
            }
        });

        contexts.landmark.clearRect(0, 0, canvases.landmark.width, canvases.landmark.height);
        contexts.cursor.clearRect(0, 0, canvases.cursor.width, canvases.cursor.height);

        if (video.readyState >= 2) {
            const startTimeMs = performance.now();
            const results: HandLandmarkerResult = handLandmarker.detectForVideo(video, startTimeMs);

            if (results.landmarks && results.landmarks.length > 0) {
                const landmarks = results.landmarks[0];
                
                // Draw landmarks on the preview canvas (Correctly Mirrored)
                contexts.landmark.strokeStyle = 'rgba(0, 255, 100, 0.7)';
                contexts.landmark.lineWidth = 2;
                HandLandmarker.HAND_CONNECTIONS.forEach(connection => {
                    const start = landmarks[connection.start];
                    const end = landmarks[connection.end];
                    if (start && end) {
                        contexts.landmark.beginPath();
                        // Flip X coordinates to match the mirrored video
                        contexts.landmark.moveTo((1 - start.x) * canvases.landmark.width, start.y * canvases.landmark.height);
                        contexts.landmark.lineTo((1 - end.x) * canvases.landmark.width, end.y * canvases.landmark.height);
                        contexts.landmark.stroke();
                    }
                });
                landmarks.forEach((point) => {
                     if (point) {
                        contexts.landmark.beginPath();
                        contexts.landmark.fillStyle = '#FF0000';
                         // Flip X coordinates
                        contexts.landmark.arc((1 - point.x) * canvases.landmark.width, point.y * canvases.landmark.height, 4, 0, 2 * Math.PI);
                        contexts.landmark.fill();
                    }
                });
                
                const indexFingerTip = landmarks[8];
                const thumbTip = landmarks[4];
                
                if (indexFingerTip && thumbTip) {
                    const dx = indexFingerTip.x - thumbTip.x;
                    const dy = indexFingerTip.y - thumbTip.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const isPinched = distance < PINCH_THRESHOLD;
                    
                    const rawPos = {
                        x: (1 - indexFingerTip.x) * canvases.drawing.width,
                        y: indexFingerTip.y * canvases.drawing.height,
                    };

                    // EMA Smoothing for jitter reduction
                    if (!smoothedPositionRef.current) {
                        smoothedPositionRef.current = rawPos;
                    } else {
                        smoothedPositionRef.current.x = smoothedPositionRef.current.x * (1 - SMOOTHING_FACTOR) + rawPos.x * SMOOTHING_FACTOR;
                        smoothedPositionRef.current.y = smoothedPositionRef.current.y * (1 - SMOOTHING_FACTOR) + rawPos.y * SMOOTHING_FACTOR;
                    }
                    
                    const smoothedPos = smoothedPositionRef.current;

                    if (isPinched) {
                        if (!hasStartedDrawing) setHasStartedDrawing(true);
                        contexts.drawing.beginPath();
                        // Start from last known smoothed position for continuous lines
                        const from = lastPositionRef.current ?? smoothedPos;
                        contexts.drawing.moveTo(from.x, from.y);
                        contexts.drawing.lineTo(smoothedPos.x, smoothedPos.y);
                        contexts.drawing.strokeStyle = penColor;
                        contexts.drawing.lineWidth = penWidth;
                        contexts.drawing.lineCap = 'round';
                        contexts.drawing.lineJoin = 'round';
                        contexts.drawing.stroke();
                        lastPositionRef.current = { ...smoothedPos };
                    } else {
                        lastPositionRef.current = null;
                        // Draw cursor at the smoothed position
                        contexts.cursor.beginPath();
                        contexts.cursor.fillStyle = penColor;
                        contexts.cursor.arc(smoothedPos.x, smoothedPos.y, penWidth / 2, 0, 2 * Math.PI);
                        contexts.cursor.fill();
                    }
                }
            } else {
                 lastPositionRef.current = null;
                 smoothedPositionRef.current = null; // Reset smoother when hand is lost
            }
        }

        if (isTracking) {
            animationFrameId.current = requestAnimationFrame(predictWebcam);
        }
    }, [isTracking, penColor, penWidth, hasStartedDrawing]);
    
    // Manage video stream and prediction loop
    useEffect(() => {
        const video = videoRef.current;
        if (isTracking) {
            if (!handLandmarkerRef.current) {
                setError("Hand tracker is not ready. Please wait a moment.");
                setIsTracking(false);
                return;
            }
            navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
                .then(stream => {
                    if (video) {
                        video.srcObject = stream;
                        const onLoadedData = () => {
                            video.play();
                            lastPositionRef.current = null;
                            smoothedPositionRef.current = null;
                            if (animationFrameId.current) {
                                cancelAnimationFrame(animationFrameId.current);
                            }
                            animationFrameId.current = requestAnimationFrame(predictWebcam);
                        };
                        video.addEventListener("loadeddata", onLoadedData);
                        
                        // Cleanup listener on effect cleanup
                        return () => video.removeEventListener("loadeddata", onLoadedData);
                    }
                })
                .catch(err => {
                    console.error("getUserMedia error:", err);
                    setError("Camera access denied. Please enable camera permissions in your browser settings.");
                    setIsTracking(false);
                });
        } else {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
                animationFrameId.current = null;
            }
            if (video && video.srcObject) {
                const stream = video.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
                video.srcObject = null;
            }
            lastPositionRef.current = null;
            smoothedPositionRef.current = null;
        }
        
        return () => {
             if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
            if(video && video.srcObject) {
                (video.srcObject as MediaStream).getTracks().forEach(track => track.stop());
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isTracking]);

    // Clear canvas logic
    useEffect(() => {
        if (clearCanvas && drawingCanvasRef.current) {
            const canvas = drawingCanvasRef.current;
            const context = canvas.getContext('2d');
            if (context) {
                context.clearRect(0, 0, canvas.width, canvas.height);
            }
            setHasStartedDrawing(false); // Show instructions again after clearing
            setClearCanvas(false);
        }
    }, [clearCanvas, setClearCanvas]);

    return (
        <div className="w-full h-full flex items-stretch gap-4">
            {/* Main Drawing Area */}
            <div className="flex-grow relative rounded-2xl shadow-lg border border-gray-700">
                <canvas ref={drawingCanvasRef} className="w-full h-full bg-white rounded-2xl" />
                <canvas ref={cursorCanvasRef} className="absolute top-0 left-0 w-full h-full rounded-2xl pointer-events-none" />
                {!isTracking && !isLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-white/80 backdrop-blur-sm rounded-2xl">
                        <h2 className="text-3xl font-bold text-gray-800">Ready to Draw?</h2>
                        <p className="text-gray-600 mt-2 max-w-md">
                            Click the play button below to start your camera and begin drawing with your hand.
                        </p>
                    </div>
                )}
                {isTracking && !hasStartedDrawing && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center p-4 bg-gray-900/50 text-white rounded-lg pointer-events-none">
                        <p>Pinch your index finger and thumb to draw.</p>
                    </div>
                )}
            </div>

            {/* Side Preview Area */}
            <div className="w-[25%] max-w-sm flex-shrink-0 flex flex-col gap-4">
                <div className="w-full aspect-video relative rounded-2xl overflow-hidden border border-gray-700 shadow-lg">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover transform -scale-x-100" />
                    <canvas ref={landmarkCanvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />
                     {isTracking && (
                         <div className="absolute top-2 right-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                            </span>
                            LIVE
                        </div>
                     )}
                </div>
                <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700 text-gray-300 text-sm">
                    <h3 className="font-bold text-lg text-white mb-2">Instructions</h3>
                    <ul className="list-disc list-inside space-y-1">
                        <li>Press <span className="font-mono text-cyan-400">Play</span> to start the camera.</li>
                        <li>Move your hand into view.</li>
                        <li>Pinch thumb & index finger to draw.</li>
                        <li>Release to move the cursor freely.</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default HandTracker;
