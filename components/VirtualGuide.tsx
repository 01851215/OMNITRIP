
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { 
    Camera, Radio, Mic, MicOff, X, Video, VideoOff, 
    Navigation, MapPin, Volume2, Headphones, Activity, Loader2 
} from 'lucide-react';

interface VirtualGuideProps {
    language: string;
    onClose: () => void;
}

// Audio Helpers
function base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

const VirtualGuide: React.FC<VirtualGuideProps> = ({ language, onClose }) => {
    const [mode, setMode] = useState<'camera' | 'backpack'>('camera');
    const [isConnected, setIsConnected] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [locationName, setLocationName] = useState("Locating...");
    
    // Media Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null); // For future advanced processing if needed
    const outputNodeRef = useRef<GainNode | null>(null);
    const audioQueueRef = useRef<{buffer: AudioBuffer, duration: number}[]>([]);
    const nextStartTimeRef = useRef<number>(0);
    const sessionRef = useRef<any>(null); // To store the session object
    const frameIntervalRef = useRef<number | null>(null);
    const geoWatchRef = useRef<number | null>(null);

    // --- 1. SESSION SETUP ---
    
    const startGuide = async () => {
        setError(null);
        try {
            // A. Init Audio Context
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
            outputNodeRef.current = audioContextRef.current.createGain();
            outputNodeRef.current.connect(audioContextRef.current.destination);

            // B. Connect to Gemini Live
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const systemInstruction = `
            You are Omnitrip, a passionate, knowledgeable, and friendly local tour guide bestie.
            Language: ${language}.
            
            MODES:
            1. **Visual Mode**: If you receive image inputs, describe the architecture, history, food, or street vibes you see. Be specific and enthusiastic.
            2. **Backpack Mode**: If you ONLY receive text updates about location (Lat/Lng), assume the user is walking with the phone in their pocket. Describe the neighborhood atmosphere, nearby hidden gems, and interesting facts about the area they are in.
            
            STYLE:
            - Short, punchy, conversational spoken responses.
            - Don't lecture. Chat like a friend walking alongside.
            - If you hear the user speak, answer their question directly.
            `;

            // Start Session
            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-12-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    systemInstruction: systemInstruction,
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
                    }
                },
                callbacks: {
                    onopen: async () => {
                        setIsConnected(true);
                        console.log("Omnitrip Guide Connected");
                        
                        // Start Input Streams once connected
                        await setupAudioInput(sessionPromise);
                        if (mode === 'camera') startCamera(sessionPromise);
                        startGeolocation(sessionPromise);
                    },
                    onmessage: async (msg: LiveServerMessage) => {
                        // Handle Audio Output
                        const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (audioData) {
                            playAudioChunk(audioData);
                        }
                    },
                    onclose: () => {
                        setIsConnected(false);
                        console.log("Session Closed");
                    },
                    onerror: (e) => {
                        console.error("Session Error", e);
                        setError("Connection lost. Trying to reconnect...");
                    }
                }
            });
            
            sessionRef.current = sessionPromise;

        } catch (e: any) {
            console.error(e);
            setError("Failed to start guide. Check permissions.");
        }
    };

    // --- 2. INPUT STREAMS ---

    const setupAudioInput = async (sessionPromise: Promise<any>) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const ctx = audioContextRef.current!;
            const source = ctx.createMediaStreamSource(stream);
            
            // Using ScriptProcessor for simplicity in prototype (AudioWorklet is better for prod)
            const processor = ctx.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (e) => {
                if (isMuted) return; // Software mute
                
                const inputData = e.inputBuffer.getChannelData(0);
                
                // Downsample to 16kHz for Gemini if needed, or send raw if model supports context rate.
                // Model supports 16kHz PCM. Context is 24kHz. Simple resampling:
                // For prototype, let's construct the blob directly assuming 16kHz or trusting API robustness
                // Ideally, use a proper resampler. Here we mock "sending audio" logic structure.
                
                // Helper to convert Float32 to Int16 PCM
                const pcm16 = new Int16Array(inputData.length);
                for (let i=0; i<inputData.length; i++) {
                    pcm16[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
                }
                
                // Convert to Base64
                const base64Audio = arrayBufferToBase64(pcm16.buffer);

                sessionPromise.then(session => {
                    session.sendRealtimeInput({
                        media: {
                            mimeType: "audio/pcm;rate=" + ctx.sampleRate, // Send context rate
                            data: base64Audio
                        }
                    });
                });
            };

            source.connect(processor);
            processor.connect(ctx.destination); // Required for script processor to run
        } catch (e: any) {
            console.error("Mic Error", e);
            const msg = e.message || e.toString();
            if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError' || msg.includes('dismissed') || msg.includes('denied')) {
                setError("Microphone access denied. Enable it in browser settings.");
            } else {
                setError("Microphone error: " + msg);
            }
        }
    };

    const startCamera = async (sessionPromise: Promise<any>) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment', width: 640 } 
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                streamRef.current = stream;
            }

            // Frame Loop
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            frameIntervalRef.current = window.setInterval(() => {
                if (mode !== 'camera' || !videoRef.current || !ctx) return;
                
                // Draw frame
                canvas.width = videoRef.current.videoWidth * 0.5; // Scale down for bandwidth
                canvas.height = videoRef.current.videoHeight * 0.5;
                ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                
                const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
                
                sessionPromise.then(session => {
                    session.sendRealtimeInput({
                        media: { mimeType: 'image/jpeg', data: base64 }
                    });
                });

            }, 1000); // 1 FPS is enough for tour guide context

        } catch (e: any) {
            console.error("Camera Error", e);
            const msg = e.message || e.toString();
            if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError' || msg.includes('dismissed') || msg.includes('denied')) {
                // Fallback to backpack but notify user
                console.warn("Camera permission denied. Switching to Backpack mode.");
                setMode('backpack');
            } else {
                setMode('backpack'); // Fallback
            }
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (frameIntervalRef.current) {
            clearInterval(frameIntervalRef.current);
            frameIntervalRef.current = null;
        }
    };

    const startGeolocation = (sessionPromise: Promise<any>) => {
        if (!navigator.geolocation) return;
        
        geoWatchRef.current = navigator.geolocation.watchPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                setLocationName(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
                
                // Send location context update as Text
                // "System: User is at [lat, lng]"
                // Only send periodically or if moved significantly? 
                // For Live API, we can inject text input to guide the model's context
                sessionPromise.then(session => {
                    session.sendRealtimeInput({
                        content: {
                            role: 'user',
                            parts: [{ text: `[SYSTEM UPDATE: User Location: ${latitude}, ${longitude}]` }]
                        }
                    });
                });
            },
            (err) => console.warn("Geo Error", err),
            { enableHighAccuracy: true, maximumAge: 10000 }
        );
    };

    // --- 3. OUTPUT HANDLING ---

    const playAudioChunk = async (base64Data: string) => {
        if (!audioContextRef.current) return;
        const ctx = audioContextRef.current;
        
        try {
            // Manual Decode PCM16LE
            const bytes = base64ToUint8Array(base64Data);
            const int16 = new Int16Array(bytes.buffer);
            const float32 = new Float32Array(int16.length);
            for(let i=0; i<int16.length; i++) {
                float32[i] = int16[i] / 32768.0;
            }
            
            const buffer = ctx.createBuffer(1, float32.length, 24000); // Model output is 24kHz
            buffer.copyToChannel(float32, 0);

            // Schedule
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(outputNodeRef.current!);
            
            const currentTime = ctx.currentTime;
            // If next start time is in past, reset to now
            if (nextStartTimeRef.current < currentTime) {
                nextStartTimeRef.current = currentTime;
            }
            
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += buffer.duration;

        } catch (e) {
            console.error("Audio Decode Error", e);
        }
    };

    // --- LIFECYCLE ---

    useEffect(() => {
        startGuide();
        return () => {
            // Cleanup
            if (sessionRef.current) {
                // No explicit close method on promise, but we can assume closing app stops requests
                // Ideally send session.close() if API supports it
            }
            if (audioContextRef.current) audioContextRef.current.close();
            stopCamera();
            if (geoWatchRef.current) navigator.geolocation.clearWatch(geoWatchRef.current);
        };
    }, []);

    // Mode Switching
    useEffect(() => {
        if (!sessionRef.current) return;
        
        if (mode === 'camera') {
            startCamera(sessionRef.current);
        } else {
            stopCamera();
            // Notify model of mode switch
            sessionRef.current.then((session: any) => {
                session.sendRealtimeInput({
                    content: { role: 'user', parts: [{ text: "[SYSTEM: User switched to Backpack Mode. Video is off. Use GPS context only.]" }] }
                });
            });
        }
    }, [mode]);

    return (
        <div className="fixed inset-0 z-[1000] bg-black flex flex-col animate-in fade-in duration-300">
            
            {/* Visual Area */}
            <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-gray-900">
                {mode === 'camera' ? (
                    <>
                        <video 
                            ref={videoRef} 
                            autoPlay 
                            playsInline 
                            muted 
                            className="w-full h-full object-cover opacity-80"
                        />
                        {/* AR Overlay Elements */}
                        <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute top-4 left-4 w-16 h-16 border-l-4 border-t-4 border-white/50 rounded-tl-3xl"></div>
                            <div className="absolute top-4 right-4 w-16 h-16 border-r-4 border-t-4 border-white/50 rounded-tr-3xl"></div>
                            <div className="absolute bottom-4 left-4 w-16 h-16 border-l-4 border-b-4 border-white/50 rounded-bl-3xl"></div>
                            <div className="absolute bottom-4 right-4 w-16 h-16 border-r-4 border-b-4 border-white/50 rounded-br-3xl"></div>
                            
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                                <div className="w-64 h-64 border-2 border-white/20 rounded-full animate-ping opacity-20"></div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center p-8 text-center animate-pulse">
                        <div className="w-32 h-32 bg-gray-800 rounded-full flex items-center justify-center mb-6 border-4 border-omni-blue shadow-[0_0_30px_rgba(186,230,253,0.3)]">
                            <Headphones size={64} className="text-omni-blue" />
                        </div>
                        <h2 className="text-2xl font-black text-white mb-2 tracking-widest">BACKPACK MODE</h2>
                        <p className="text-gray-400 font-bold max-w-xs">Audio-only guide active. Keep app open to track location.</p>
                        <div className="mt-8 flex items-center gap-3 text-omni-green font-mono text-xs">
                            <Activity size={16} className="animate-bounce" />
                            GPS TRACKING ACTIVE
                        </div>
                    </div>
                )}

                {/* Connection State Overlay */}
                {!isConnected && !error && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
                        <Loader2 size={48} className="text-omni-yellow animate-spin mb-4" />
                        <p className="text-white font-black uppercase">Connecting to Omnitrip...</p>
                    </div>
                )}
                {error && (
                    <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-8 text-center">
                        <Activity size={48} className="text-red-500 mb-4" />
                        <p className="text-red-400 font-bold">{error}</p>
                        <button onClick={() => onClose()} className="mt-6 bg-white text-black px-6 py-2 rounded-xl font-black">CLOSE</button>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="bg-black/80 backdrop-blur-md p-6 pb-10 border-t border-white/10">
                
                {/* Location Badge */}
                <div className="flex justify-center mb-6">
                    <div className="bg-gray-800/80 px-4 py-1.5 rounded-full flex items-center gap-2 border border-white/10">
                        <MapPin size={12} className="text-omni-yellow" />
                        <span className="text-xs font-bold text-gray-300 font-mono tracking-wide">{locationName}</span>
                    </div>
                </div>

                <div className="flex items-center justify-between max-w-md mx-auto">
                    {/* Mode Toggle */}
                    <button 
                        onClick={() => setMode(mode === 'camera' ? 'backpack' : 'camera')}
                        className="flex flex-col items-center gap-1 text-white group"
                    >
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${mode === 'camera' ? 'bg-gray-800 text-gray-400' : 'bg-omni-blue text-omni-dark shadow-[0_0_15px_#bae6fd]'}`}>
                            {mode === 'camera' ? <VideoOff size={24} /> : <Headphones size={24} />}
                        </div>
                        <span className="text-[10px] font-black uppercase text-gray-500 group-hover:text-white">
                            {mode === 'camera' ? 'Audio Only' : 'Video On'}
                        </span>
                    </button>

                    {/* Mute Toggle */}
                    <button 
                        onClick={() => setIsMuted(!isMuted)}
                        className={`w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all ${
                            isMuted ? 'border-red-500 bg-red-500/20 text-red-500' : 'border-omni-green bg-omni-green/20 text-omni-green shadow-[0_0_20px_rgba(187,247,208,0.4)]'
                        }`}
                    >
                        {isMuted ? <MicOff size={32} /> : <Mic size={32} />}
                    </button>

                    {/* End Session */}
                    <button 
                        onClick={onClose}
                        className="flex flex-col items-center gap-1 text-white group"
                    >
                        <div className="w-14 h-14 rounded-full bg-red-500/80 flex items-center justify-center hover:bg-red-500 transition-colors shadow-lg">
                            <X size={24} />
                        </div>
                        <span className="text-[10px] font-black uppercase text-gray-500 group-hover:text-white">End Tour</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VirtualGuide;
