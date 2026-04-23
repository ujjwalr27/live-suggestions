import { useRef, useCallback, useEffect } from 'react';
import { useSession } from '../context/SessionContext';
import { transcribeAudio } from '../api/groq';
import { TranscriptChunk } from '../utils/types';

// Web Speech API types (not in TS DOM lib by default)
interface SpeechRecognitionResult {
    isFinal: boolean;
    readonly length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
}
interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}
interface SpeechRecognitionInstance extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    onresult: ((e: SpeechRecognitionEvent) => void) | null;
    onerror: ((e: Event) => void) | null;
    onend: (() => void) | null;
}
declare global {
    interface Window {
        SpeechRecognition?: new () => SpeechRecognitionInstance;
        webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    }
}

// ── Whisper hallucination filter ─────────────────────────────────────────────
// Whisper commonly outputs these on silence / very short audio, especially
// through virtual audio cables. We silently discard them.
const HALLUCINATED_PHRASES = new Set([
    'thank you',
    'thank you.',
    'thanks for watching',
    'thanks for watching.',
    'thank you for watching',
    'thank you for watching.',
    'thank you very much',
    'thank you very much.',
    'please subscribe',
    'like and subscribe',
    'thanks',
    'thanks.',
    'you',
    '.',
    '',
]);

function isHallucination(text: string): boolean {
    const normalized = text.trim().toLowerCase();
    if (HALLUCINATED_PHRASES.has(normalized)) return true;
    // Also catch music/sound descriptors Whisper emits: "(upbeat music)" etc.
    if (/^\(.*\)$/.test(normalized)) return true;
    // Very short Whisper output (< 3 words) is almost always noise
    if (normalized.split(/\s+/).length < 3) return true;
    return false;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 10); }
function nowTime() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }

function recorderMimeType(): string {
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
    if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
    return '';
}

const CHUNK_INTERVAL_MS = 30_000;

export function useAudioCapture() {
    const { state, dispatch } = useSession();
    const apiKeyRef = useRef(state.apiKey);
    const isRecordingRef = useRef(state.isRecording);
    const streamRef = useRef<MediaStream | null>(null);
    const speechRef = useRef<SpeechRecognitionInstance | null>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const recorderDoneRef = useRef<Promise<string | null> | null>(null);
    const recorderQueueRef = useRef<Promise<void>>(Promise.resolve());

    // keep refs fresh
    useEffect(() => { apiKeyRef.current = state.apiKey; }, [state.apiKey]);
    useEffect(() => { isRecordingRef.current = state.isRecording; }, [state.isRecording]);

    // ── Whisper transcription ─────────────────────────────────────────────────
    const sendChunksToWhisper = useCallback(async (chunks: Blob[], mime: string): Promise<string | null> => {
        if (!apiKeyRef.current || chunks.length === 0) return null;
        const blob = new Blob(chunks, { type: mime });
        if (blob.size < 1000) return null; // skip tiny blobs (silence)
        try {
            const text = await transcribeAudio(blob, apiKeyRef.current);
            const trimmed = text.trim();
            if (!trimmed || isHallucination(trimmed)) return null;
            const chunk: TranscriptChunk = { id: uid(), text: trimmed, timestamp: nowTime() };
            dispatch({ type: 'ADD_CHUNK', payload: chunk });
            dispatch({ type: 'SET_LIVE_TEXT', payload: '' });
            return trimmed;
        } catch (err) {
            console.error('[Whisper] error:', err);
            return null;
        }
    }, [dispatch]);

    // ── Recorder lifecycle ────────────────────────────────────────────────────
    const queueRecorderOperation = useCallback(<T,>(operation: () => Promise<T>): Promise<T> => {
        const run = recorderQueueRef.current.then(operation, operation);
        recorderQueueRef.current = run.then(() => undefined, () => undefined);
        return run;
    }, []);

    const startRecorder = useCallback((stream: MediaStream) => {
        const mime = recorderMimeType();
        const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        const chunks: Blob[] = [];
        let resolveDone: ((value: string | null) => void) | null = null;
        const done = new Promise<string | null>((resolve) => { resolveDone = resolve; });

        recorder.ondataavailable = (event) => {
            if (event.data.size > 0) chunks.push(event.data);
        };
        recorder.onstop = () => {
            void (async () => {
                const finalMime = mime || 'audio/webm';
                const text = await sendChunksToWhisper(chunks, finalMime);
                resolveDone?.(text);
            })();
        };

        recorder.start();
        recorderRef.current = recorder;
        recorderDoneRef.current = done;
    }, [sendChunksToWhisper]);

    const stopRecorder = useCallback(async (
        recorder: MediaRecorder | null,
        done: Promise<string | null> | null,
        restart: boolean,
    ): Promise<string | null> => {
        if (!recorder || recorder.state !== 'recording') return null;
        recorder.stop();
        const text = done ? await done : null;
        if (recorderRef.current === recorder) {
            recorderRef.current = null;
            recorderDoneRef.current = null;
            if (restart && isRecordingRef.current && streamRef.current) {
                startRecorder(streamRef.current);
            }
        }
        return text;
    }, [startRecorder]);

    const stopActiveRecorder = useCallback(async (restart: boolean): Promise<string | null> => {
        return stopRecorder(recorderRef.current, recorderDoneRef.current, restart);
    }, [stopRecorder]);

    const flushCurrentChunk = useCallback(async (): Promise<string | null> => {
        return queueRecorderOperation(async () => stopActiveRecorder(true));
    }, [queueRecorderOperation, stopActiveRecorder]);

    // ── Independent 30s Whisper flush timer ──────────────────────────────────
    // Decoupled from suggestion refresh so transcript commits even when
    // suggestions are not being generated.
    const flushRef = useRef(flushCurrentChunk);
    flushRef.current = flushCurrentChunk;

    useEffect(() => {
        if (!state.isRecording) return;
        const id = setInterval(() => { void flushRef.current(); }, CHUNK_INTERVAL_MS);
        return () => clearInterval(id);
    }, [state.isRecording]);

    // ── Recording start/stop ──────────────────────────────────────────────────
    const startRecording = useCallback(async () => {
        if (isRecordingRef.current) return;
        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
            alert('Microphone access denied. Please allow mic access and try again.');
            return;
        }
        streamRef.current = stream;
        isRecordingRef.current = true;
        dispatch({ type: 'SET_RECORDING', payload: true });

        startRecorder(stream);

        // Web Speech API — commits FINAL results directly to transcript (fast, no latency)
        // and shows INTERIM results as live preview text.
        const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
        if (SR) {
            const sr = new SR();
            sr.continuous = true;
            sr.interimResults = true;
            sr.lang = 'en-US';
            speechRef.current = sr;

            sr.onresult = (e: SpeechRecognitionEvent) => {
                let interim = '';
                for (let i = e.resultIndex; i < e.results.length; i++) {
                    const result = e.results[i];
                    if (result.isFinal) {
                        // Commit final recognized speech immediately as a transcript chunk
                        const text = result[0].transcript.trim();
                        if (text) {
                            const chunk: TranscriptChunk = { id: uid(), text, timestamp: nowTime() };
                            dispatch({ type: 'ADD_CHUNK', payload: chunk });
                            dispatch({ type: 'SET_LIVE_TEXT', payload: '' });
                        }
                    } else {
                        interim += result[0].transcript;
                    }
                }
                if (interim) {
                    dispatch({ type: 'SET_LIVE_TEXT', payload: interim });
                }
            };
            sr.onerror = () => { /* fallback: Whisper only */ };
            sr.onend = () => {
                if (isRecordingRef.current) {
                    try { sr.start(); } catch { /* ignore */ }
                }
            };
            try { sr.start(); } catch { /* ignore */ }
        }
    }, [dispatch, startRecorder]);

    const stopRecording = useCallback(() => {
        if (!isRecordingRef.current) return;
        isRecordingRef.current = false;
        const streamToStop = streamRef.current;
        streamRef.current = null;
        const recorderToStop = recorderRef.current;
        const recorderDoneToStop = recorderDoneRef.current;

        if (speechRef.current) {
            speechRef.current.onend = null;
            try { speechRef.current.stop(); } catch { /* ignore */ }
            speechRef.current = null;
        }

        void queueRecorderOperation(async () => {
            await stopRecorder(recorderToStop, recorderDoneToStop, false);
            streamToStop?.getTracks().forEach((track) => track.stop());
        });

        dispatch({ type: 'SET_RECORDING', payload: false });
        dispatch({ type: 'SET_LIVE_TEXT', payload: '' });
    }, [dispatch, queueRecorderOperation, stopRecorder]);

    return { startRecording, stopRecording, flushCurrentChunk };
}
