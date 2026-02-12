import React, { useRef, useEffect, useState, useMemo } from 'react';
import { X, Camera, MapPin, Navigation } from 'lucide-react';
import { calcBearing, calcDistance } from '../utils/geometry';

const ArView = ({ onScan, onClose, language = 'en', pois = [], userLocation, isSimulating }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [stream, setStream] = useState(null);
    const [isScanning, setIsScanning] = useState(false);
    const [permissionError, setPermissionError] = useState(null);

    // AR State
    const [heading, setHeading] = useState(0);
    const [fov] = useState(60); // Field of view in degrees

    // Virtual Rotation for Simulation
    const [virtualHeadingOffset, setVirtualHeadingOffset] = useState(0);
    const isDraggingRef = useRef(false);
    const lastXRef = useRef(0);

    useEffect(() => {
        startCamera();

        // Compass Listener
        const handleOrientation = (event) => {
            let compass = 0;
            // iOS
            if (event.webkitCompassHeading) {
                compass = event.webkitCompassHeading;
            }
            // Android / Standard
            else if (event.alpha) {
                compass = 360 - event.alpha;
            }
            setHeading(compass);
        };

        if (window.DeviceOrientationEvent) {
            window.addEventListener('deviceorientation', handleOrientation);
        }

        return () => {
            stopCamera();
            window.removeEventListener('deviceorientation', handleOrientation);
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

    const handlePointerDown = (e) => {
        if (!isSimulating) return;
        isDraggingRef.current = true;
        lastXRef.current = e.clientX;
    };

    const handlePointerMove = (e) => {
        if (!isDraggingRef.current || !isSimulating) return;
        const deltaX = e.clientX - lastXRef.current;
        lastXRef.current = e.clientX;

        // Sensitivity: roughly 0.5 degrees per pixel
        const rotationDelta = -deltaX * 0.5;
        setVirtualHeadingOffset(prev => (prev + rotationDelta) % 360);
    };

    const handlePointerUp = () => {
        isDraggingRef.current = false;
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
    };

    // Calculate Visible POIs
    const visiblePois = useMemo(() => {
        if (!userLocation || !pois || pois.length === 0) return [];

        const effectiveHeading = (heading + virtualHeadingOffset + 360) % 360;

        return pois.map((poi, index) => {
            const dist = calcDistance(userLocation, poi);
            if (dist > 1.0) return null; // Only show POIs within 1km

            const bearing = calcBearing(userLocation, poi);

            // Calculate relative angle (-180 to 180)
            let relativeAngle = bearing - effectiveHeading;
            while (relativeAngle < -180) relativeAngle += 360;
            while (relativeAngle > 180) relativeAngle -= 360;

            // Check if within FOV (plus some buffer for edge items)
            if (Math.abs(relativeAngle) > (fov / 2 + 10)) return null;

            // Calculate screen position (0 to 100%)
            // -FOV/2 -> 0%
            // +FOV/2 -> 100%
            const xPercent = ((relativeAngle + (fov / 2)) / fov) * 100;

            return {
                ...poi,
                dist,
                xPercent,
                index: index + 1
            };
        }).filter(p => p !== null);
    }, [pois, userLocation, heading, virtualHeadingOffset, fov]);

    return (
        <div
            className="fixed inset-0 z-[1200] bg-black text-white flex flex-col touch-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            {/* Camera Feed */}
            <div className="relative flex-1 overflow-hidden pointer-events-none">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover"
                />

                {/* AR Overlays */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    {visiblePois.map(poi => (
                        <div
                            key={poi.id}
                            className="absolute top-1/3 flex flex-col items-center transition-all duration-200"
                            style={{
                                left: `${poi.xPercent}%`,
                                transform: 'translate(-50%, -50%)',
                                zIndex: Math.round((1 - poi.dist) * 100) // Closer items on top
                            }}
                        >
                            <div className="bg-white/90 backdrop-blur-md text-slate-900 px-3 py-2 rounded-xl shadow-lg border border-white/50 flex flex-col items-center gap-1 min-w-[120px]">
                                <div className="flex items-center gap-1.5 font-bold text-xs">
                                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">{poi.index}</span>
                                    <span className="truncate max-w-[100px]">{poi.name}</span>
                                </div>
                                <div className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 rounded">
                                    {Math.round(poi.dist * 1000)}m
                                </div>
                                {/* Triangle pointer */}
                                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white/90 rotate-45 border-b border-r border-white/50"></div>
                            </div>
                        </div>
                    ))}

                    {/* Compass Debug (Optional, helpful for validation) */}
                    {/* <div className="absolute top-20 left-4 bg-black/50 text-xs p-1 font-mono">
                        Heading: {Math.round(heading)}° | Visible: {visiblePois.length}
                    </div> */}
                </div>

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
                    <div className="flex flex-col gap-2">
                        <div className="bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-xs font-medium border border-white/10 flex items-center gap-2 w-fit">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            AR Mode
                        </div>
                        {isSimulating && (
                            <div className="bg-blue-600/60 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold border border-blue-400/30 flex items-center gap-1.5 uppercase tracking-wider animate-in slide-in-from-left duration-300">
                                <Navigation size={12} className="rotate-45" />
                                <span>{language === 'nl' ? 'Virtueel Roterend' : 'Virtual Rotation'}</span>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="bg-black/40 backdrop-blur-md p-2 rounded-full border border-white/10 hover:bg-white/10 transition-colors pointer-events-auto"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Scanning Reticle */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-64 h-64 border-2 border-white/30 rounded-2xl relative opacity-50">
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
                    {/* Helper Text */}
                    <div className="flex flex-col items-center gap-1">
                        <p className="text-sm text-white/90 text-center font-medium drop-shadow-md">
                            {visiblePois.length > 0
                                ? (language === 'nl' ? `${visiblePois.length} plekken zichtbaar` : `${visiblePois.length} places visible`)
                                : (language === 'nl' ? (isSimulating ? 'Sleep om rond te kijken' : 'Draai rond om POIs te vinden') : (isSimulating ? 'Swipe to look around' : 'Turn around to find POIs'))
                            }
                        </p>
                        <p className="text-xs text-white/50 text-center max-w-xs">
                            {language === 'nl'
                                ? 'Of neem een foto om te identificeren'
                                : 'Or take a photo to identify'}
                        </p>
                    </div>

                    <button
                        onClick={handleScan}
                        disabled={isScanning || permissionError}
                        className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center bg-white/10 backdrop-blur-sm active:scale-95 transition-all hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed group pointer-events-auto"
                    >
                        <div className="w-12 h-12 bg-white rounded-full group-active:scale-90 transition-transform"></div>
                        <Camera className="absolute text-slate-900 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                </div>
            </div>

            {/* Hidden Canvas for Capture */}
            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
};

export default ArView;
