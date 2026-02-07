import React, { useRef, useEffect, useState } from 'react';
import { X, Camera } from 'lucide-react'; // Assuming lucide-react is installed

const ArView = ({ onScan, onClose, language = 'en' }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [stream, setStream] = useState(null);
    const [isScanning, setIsScanning] = useState(false);
    const [permissionError, setPermissionError] = useState(null);

    useEffect(() => {
        startCamera();
        return () => {
            stopCamera();
        };
    }, []);

    const startCamera = async () => {
        try {
            const constraints = {
                video: {
                    facingMode: 'environment' // Use back camera if available
                }
            };
            const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (err) {
            console.error("Camera Access Error:", err);
            setPermissionError(err.message);
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    const handleScan = () => {
        if (!videoRef.current || !canvasRef.current) return;

        setIsScanning(true);
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw current frame
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Get Base64
        const base64Image = canvas.toDataURL('image/jpeg', 0.8);
        console.log(`[ArView] Captured frame. Length: ${base64Image.length}`);

        // Send to parent
        onScan(base64Image);

        // Optional: Stop scanning state is managed by parent or we reset it
        // setIsScanning(false); // Let parent handle loading state UI if needed
    };

    return (
        <div className="fixed inset-0 z-[1200] bg-black text-white flex flex-col">
            {/* Camera Feed */}
            <div className="relative flex-1 overflow-hidden">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover"
                />

                {/* Permissions Error */}
                {permissionError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/80 px-4 text-center">
                        <div>
                            <p className="text-red-400 mb-2 font-bold">Camera Error</p>
                            <p className="text-sm text-slate-300">{permissionError}</p>
                            <button
                                onClick={onClose}
                                className="mt-4 bg-slate-700 px-4 py-2 rounded-lg"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )}

                {/* Overlay UI */}
                <div className="absolute inset-x-0 top-0 p-4 flex justify-between items-start bg-gradient-to-b from-black/60 to-transparent pt-12">
                    <div className="bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-xs font-medium border border-white/10 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        AR Mode
                    </div>
                    <button
                        onClick={onClose}
                        className="bg-black/40 backdrop-blur-md p-2 rounded-full border border-white/10 hover:bg-white/10 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Scanning Reticle */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-64 h-64 border-2 border-white/30 rounded-2xl relative">
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-white"></div>
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-white"></div>
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-white"></div>
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-white"></div>
                        {isScanning && (
                            <div className="absolute inset-0 bg-blue-500/10 animate-pulse rounded-2xl"></div>
                        )}
                    </div>
                </div>

                {/* Bottom Controls */}
                <div className="absolute inset-x-0 bottom-0 p-8 flex flex-col items-center gap-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent pb-12">
                    <p className="text-sm text-white/70 text-center max-w-xs drop-shadow-md">
                        {language === 'nl'
                            ? 'Richt op een gebouw of standbeeld'
                            : 'Point at a building or landmark'}
                    </p>

                    <button
                        onClick={handleScan}
                        disabled={isScanning || permissionError}
                        className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center bg-white/10 backdrop-blur-sm active:scale-95 transition-all hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                        <div className="w-12 h-12 bg-white rounded-full group-active:scale-90 transition-transform"></div>
                    </button>
                </div>
            </div>

            {/* Hidden Canvas for Capture */}
            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
};

export default ArView;
