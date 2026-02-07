import React, { useEffect, useRef } from 'react';

/**
 * BackgroundKeepAlive
 * This component keeps the mobile browser process alive when the screen is off
 * by playing a silent audio loop and registering a Media Session.
 */
const BackgroundKeepAlive = ({ isActive, language }) => {
    const audioRef = useRef(null);
    const wakeLockRef = useRef(null);

    // Silent audio data URI (1s of silence)
    const silentTrack = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

    useEffect(() => {
        if (!isActive) {
            if (audioRef.current) {
                audioRef.current.pause();
            }
            releaseWakeLock();
            return;
        }

        // 1. Play Silent Audio
        if (audioRef.current) {
            audioRef.current.play().catch(e => {
                console.warn("[KeepAlive] Audio play blocked. Needs user interaction.", e);
            });
        }

        // 2. Setup Media Session
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: language === 'nl' ? 'CityExplorer Navigatie' : 'CityExplorer Navigation',
                artist: 'CityExplorer',
                album: 'Active Route',
                artwork: [
                    { src: '/logo.jpg', sizes: '512x512', type: 'image/jpeg' }
                ]
            });

            // Handle session interruptions
            navigator.mediaSession.setActionHandler('play', () => audioRef.current?.play());
            navigator.mediaSession.setActionHandler('pause', () => audioRef.current?.pause());
        }

        // 3. Request Wake Lock (If screen is ON, keep it on; but audio helps when it turns off)
        requestWakeLock();

        return () => {
            releaseWakeLock();
        };
    }, [isActive, language]);

    const requestWakeLock = async () => {
        if ('wakeLock' in navigator) {
            try {
                wakeLockRef.current = await navigator.wakeLock.request('screen');
                console.log("[KeepAlive] Wake Lock active");
            } catch (err) {
                console.warn("[KeepAlive] Wake Lock failed:", err);
            }
        }
    };

    const releaseWakeLock = () => {
        if (wakeLockRef.current) {
            wakeLockRef.current.release();
            wakeLockRef.current = null;
            console.log("[KeepAlive] Wake Lock released");
        }
    };

    return (
        <audio
            ref={audioRef}
            src={silentTrack}
            loop
            preload="auto"
            style={{ display: 'none' }}
        />
    );
};

export default BackgroundKeepAlive;
