import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { Mic, MicOff, ShieldAlert, Wifi, WifiOff, MapPin, Activity, Zap } from 'lucide-react';
import { floodProtocol, earthquakeProtocol } from './protocols';

const getPersistentId = () => {
    let id = localStorage.getItem('awaaz_rakshak_session_id');
    if (!id) {
        id = 'sess_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('awaaz_rakshak_session_id', id);
    }
    return id;
};

const persistentId = getPersistentId();
const socket = io('http://localhost:5000', {
    auth: { persistentId }
});

function App() {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [response, setResponse] = useState('How can I help you today?');
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [state, setState] = useState({
        disasterType: null,
        urgencyLevel: 'low',
        emotionalState: 'calm',
        currentStep: 0,
        internetStatus: navigator.onLine ? 'online' : 'offline',
        location: { lat: null, lng: null },
        environmentFlags: {
            waterLevel: null,
            shaking: false,
            gasSmell: false,
            injuryDetected: false
        }
    });

    const recognitionRef = useRef(null);
    const synthesisRef = useRef(window.speechSynthesis);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const inactivityTimerRef = useRef(null);
    const isListeningRef = useRef(false);
    const [volume, setVolume] = useState(0);
    const [mockAlert, setMockAlert] = useState(null);

    useEffect(() => {
        isListeningRef.current = isListening;
        if (isListening) {
            initAudioAnalysis();
        } else {
            if (audioContextRef.current) audioContextRef.current.close();
        }
    }, [isListening, initAudioAnalysis]);

    const lastVolumeSpikeRef = useRef(0);

    const initAudioAnalysis = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            analyserRef.current = audioContextRef.current.createAnalyser();
            const source = audioContextRef.current.createMediaStreamSource(stream);
            source.connect(analyserRef.current);
            analyserRef.current.fftSize = 256;

            const bufferLength = analyserRef.current.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const checkVolume = () => {
                if (!isListeningRef.current) return;
                analyserRef.current.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b) / bufferLength;

                setVolume(average);

                const now = Date.now();
                if (average > 120 && now - lastVolumeSpikeRef.current > 5000) { // Volume Spike detected with 5s cooldown
                    lastVolumeSpikeRef.current = now;
                    handleVolumeSpike(average);
                }
                requestAnimationFrame(checkVolume);
            };
            checkVolume();
        } catch (err) {
            console.error("Audio analysis failed", err);
        }
    }, [handleVolumeSpike]);

    // Requirement: Interruptible Voice System (Critical Feature)
    const interruptTTS = () => {
        if (synthesisRef.current && synthesisRef.current.speaking) {
            synthesisRef.current.cancel();
            console.log("TTS interrupted by user speech start");
        }
    };

    const handleSurvivalLogic = useCallback((input) => {
        const text = input.toLowerCase();
        let newState = { ...state };

        // Panic Detection Simulation
        const panicWords = ["help", "fast", "trapped", "water", "shaking", "dying"];
        if (panicWords.some(w => text.includes(w))) {
            newState.emotionalState = 'panic';
            newState.urgencyLevel = 'high';
        }

        // Edge Reasoning (Offline Feature Parity)
        if (text.includes('gas') || text.includes('smell')) newState.environmentFlags.gasSmell = true;
        if (text.includes('hurt') || text.includes('injured')) newState.environmentFlags.injuryDetected = true;

        const protocol = newState.disasterType === 'flood' ? floodProtocol :
            newState.disasterType === 'earthquake' ? earthquakeProtocol : null;

        let resText = "";

        // Priority Hazard Check
        if (newState.environmentFlags.gasSmell) {
            resText = "ALERT: Possible Gas Leak detected locally. Avoid all sparks or light switches. Move to open air now.";
        } else if (newState.environmentFlags.injuryDetected && !newState.firstAidGiven) {
            newState.firstAidGiven = true;
            resText = "Medical Emergency detected. Apply pressure to any wounds. I have registered your medical status locally.";
        } else if (protocol) {
            if (newState.currentStep < protocol.length) {
                resText = protocol[newState.currentStep];
                newState.currentStep += 1;
            } else {
                resText = "You have completed all immediate safety steps. Stay where you are and keep your battery saved. I am still monitoring.";
            }
        } else {
            resText = "Connection lost. Survival mode active. Describe your situation (e.g., 'Flood' or 'Earthquake') so I can guide you.";
        }

        setState(newState);
        setResponse(resText);
        speak(resText);
    }, [state, speak]);

    const stateRef = useRef(state);

    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    // Combined Ref-based handlers to satisfy SpeechRecognition without re-effecting
    const handleVoiceTranscript = useCallback((transcriptText) => {
        if (isOnline && socket.connected) {
            socket.emit('voice_transcript', {
                transcript: transcriptText,
                location: stateRef.current.location
            });
        } else {
            console.log("Offline mode: Processing locally");
            handleSurvivalLogic(transcriptText);
        }
    }, [isOnline, handleSurvivalLogic]);

    const handleVolumeSpike = useCallback((average) => {
        console.log("Volume Spike Detected!", average);
        if (isOnline && socket.connected) {
            socket.emit('volume_spike', { level: average });
        } else {
            // Local fallback for volume spike
            const newState = {
                ...stateRef.current,
                emotionalState: 'panic',
                urgencyLevel: 'high'
            };
            setState(newState);
            const resText = "I heard a loud noise. Stay calm, I am here. Are you safe?";
            setResponse(resText);
            speakWithState(resText, newState);
        }
    }, [isOnline, speakWithState]);

    useEffect(() => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const newLoc = { lat: position.coords.latitude, lng: position.coords.longitude };
                    setState(prev => ({ ...prev, location: newLoc }));

                    // Fetch nearby shelters if online
                    if (navigator.onLine) {
                        fetch(`http://localhost:5000/api/shelters/near?lat=${newLoc.lat}&lng=${newLoc.lng}`)
                            .then(res => res.json())
                            .then(data => {
                                console.log("Nearby shelters:", data);
                            })
                            .catch(err => console.error("Failed to fetch shelters", err));
                    }
                },
                (err) => console.error("Geolocation failed:", err),
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
            );
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;

            recognitionRef.current.onresult = (event) => {
                const current = event.resultIndex;
                const transcriptText = event.results[current][0].transcript;
                setTranscript(transcriptText);
                resetInactivityTimer();

                // Sensitivity: Only interrupt if transcript length > 5 characters (prevents small noise interruption)
                if (transcriptText.trim().length > 5) {
                    interruptTTS();
                }

                if (event.results[current].isFinal) {
                    handleVoiceTranscript(transcriptText);
                }
            };

            recognitionRef.current.onend = () => {
                if (isListeningRef.current) {
                    try { recognitionRef.current.start(); } catch (e) { console.warn("Recognition restart failed", e); }
                }
            };

            recognitionRef.current.onerror = (event) => {
                if (event.error !== 'no-speech') {
                    console.error("Speech Recognition Error:", event.error);
                }
            };
        }

        const handleOnline = () => {
            setIsOnline(true);
            setState(s => ({ ...s, internetStatus: 'online' }));
            socket.emit('internet_status', { status: 'online' });
        };
        const handleOffline = () => {
            setIsOnline(false);
            setState(s => ({ ...s, internetStatus: 'offline' }));
            socket.emit('internet_status', { status: 'offline' });
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        socket.on('voice_response', (data) => {
            setResponse(data.text);
            setState(data.state);
            speakWithState(data.text, data.state);

            if (data.state.disasterType === 'earthquake') {
                setMockAlert("SEISMIC ALERT: Strong aftershock detected 10km away.");
            } else if (data.state.disasterType === 'flood') {
                setMockAlert("WEATHER ALERT: Flash flood warning extended for 2 hours.");
            }
        });

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            socket.off('voice_response');
            if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
            if (recognitionRef.current) recognitionRef.current.stop();
        };
    }, [handleVoiceTranscript, resetInactivityTimer, speakWithState]); // Fixed dependencies

    const resetInactivityTimer = useCallback(() => {
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        // Only trigger SOS if listening AND in an active disaster scenario
        if (isListening && state.disasterType) {
            inactivityTimerRef.current = setTimeout(() => {
                // Requirement: Rescue Mode Trigger
                triggerSOS("No voice detected for 30 seconds. Disaster sequence is active. Auto-SOS triggered. Transmitting coordinates.");
            }, 30000);
        }
    }, [isListening, state.disasterType, triggerSOS]);

    useEffect(() => {
        resetInactivityTimer();
    }, [isListening, resetInactivityTimer]);

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current.stop();
        } else {
            recognitionRef.current.start();
        }
        setIsListening(!isListening);
    };

    const speakWithState = useCallback((text, currentState) => {
        synthesisRef.current.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onstart = () => console.log("AI started speaking...");
        utterance.rate = currentState.emotionalState === 'panic' ? 0.8 : 1.0;
        utterance.pitch = currentState.urgencyLevel === 'high' ? 1.1 : 1.0;
        synthesisRef.current.speak(utterance);
    }, []);

    const speak = useCallback((text) => {
        speakWithState(text, stateRef.current);
    }, [speakWithState]);

    const resetState = () => {
        if (isOnline && socket.connected) {
            socket.emit('agent_reset');
        } else {
            const initialState = {
                disasterType: null,
                urgencyLevel: 'low',
                emotionalState: 'calm',
                currentStep: 0,
                internetStatus: navigator.onLine ? 'online' : 'offline',
                location: state.location,
                environmentFlags: {
                    waterLevel: null,
                    shaking: false,
                    gasSmell: false,
                    injuryDetected: false
                }
            };
            setState(initialState);
            setResponse("State reset. How can I help you?");
            speak("State reset. How can I help you?");
        }
        setTranscript("");
        setMockAlert(null);
    };

    const triggerSOS = useCallback((msg) => {
        const text = msg || "SOS Triggered. Contacting emergency services.";
        setResponse(text);
        speak(text);
        setState(s => ({ ...s, urgencyLevel: 'high' }));
        // Simulate Flashlight SOS (visual flash)
    }, [speak]);

    return (
        <div className={`app-container ${state.urgencyLevel === 'high' ? 'sos-mode' : ''}`}>
            <div className="glass-card">
                <div className={`status-badge ${!isOnline ? 'offline' : ''}`}>
                    {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                    {isOnline ? 'ONLINE - CLOUD CONNECTED' : 'OFFLINE - SURVIVAL MODE'}
                </div>

                <div className="flex flex-col items-center gap-2">
                    <ShieldAlert size={48} color={state.urgencyLevel === 'high' ? '#ff4d4d' : '#00cec9'} />
                    <h1 className="text-2xl font-bold tracking-tight">AAWAAZ RAKSHAK</h1>
                    <p className="text-xs opacity-50 tracking-widest uppercase">Stateful Disaster Agent</p>
                </div>

                <div className="voice-visualizer">
                    {isListening && (
                        <div
                            className="pulse-ring"
                            style={{
                                transform: `scale(${1 + volume / 100})`,
                                opacity: Math.max(0.2, volume / 100)
                            }}
                        ></div>
                    )}
                    <button
                        className={`mic-button ${isListening ? 'active' : ''}`}
                        onClick={toggleListening}
                    >
                        {isListening ? <Mic size={40} /> : <MicOff size={40} />}
                    </button>
                    {isListening && <div className="absolute -bottom-4 animate-pulse text-[10px] text-cyan-400">MIC STREAMING</div>}
                </div>

                <div className="flex flex-col gap-4 w-full">
                    {mockAlert && (
                        <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 p-3 rounded-xl text-xs flex items-center gap-2 animate-bounce">
                            <Activity size={14} /> {mockAlert}
                        </div>
                    )}
                    <div className="instruction-text">
                        &quot;{response}&quot;
                    </div>
                    <div className="transcript-text">
                        {transcript || "Waiting for signal..."}
                    </div>
                </div>

                {/* Env Flags UI */}
                <div className="grid grid-cols-2 gap-2 w-full mt-2">
                    <div className="bg-white/5 p-2 rounded-lg text-[9px] flex items-center gap-2 uppercase tracking-tighter">
                        <Zap size={10} color={state.environmentFlags.shaking ? '#ff4d4d' : '#888'} />
                        Shaking: {state.environmentFlags.shaking ? 'YES' : 'NO'}
                    </div>
                    <div className="bg-white/5 p-2 rounded-lg text-[9px] flex items-center gap-2 uppercase tracking-tighter">
                        <Activity size={10} color={state.urgencyLevel === 'high' ? '#ff4d4d' : '#888'} />
                        Urgency: {state.urgencyLevel}
                    </div>
                </div>

                <div className="flex gap-4 w-full justify-center mt-2">
                    <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full text-xs">
                        <Activity size={12} />
                        STATE: {state.emotionalState.toUpperCase()}
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full text-xs">
                        <MapPin size={12} />
                        DISASTER: {state.disasterType?.toUpperCase() || 'NONE'}
                    </div>
                </div>

                {/* Survival Progress */}
                {state.disasterType && (
                    <div className="w-full mt-4">
                        <div className="flex justify-between text-[10px] mb-1 opacity-70">
                            <span>SURVIVAL PROGRESS</span>
                            <span>{state.currentStep} STEPS COMPLETED</span>
                        </div>
                        <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-cyan-400 transition-all duration-500"
                                style={{ width: `${Math.min(100, (state.currentStep / 6) * 100)}%` }}
                            ></div>
                        </div>
                    </div>
                )}

                <div className="flex gap-2 w-full mt-6">
                    <button className="emergency-btn flex-1" onClick={() => triggerSOS()}>
                        MANUAL SOS
                    </button>
                    <button className="bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 px-4 rounded-xl text-[10px] uppercase font-bold tracking-widest transition-all" onClick={resetState}>
                        Reset
                    </button>
                </div>
            </div>
        </div>
    );
}

export default App;
