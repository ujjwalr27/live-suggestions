import { useEffect, useRef } from 'react';
import { useSession } from '../../context/SessionContext';
import { MicButton } from './MicButton';
import { TranscriptChunk } from './TranscriptChunk';

interface Props {
    isRecording: boolean;
    onStart: () => void;
    onStop: () => void;
}

export function TranscriptPanel({ isRecording, onStart, onStop }: Props) {
    const { state } = useSession();
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [state.transcript, state.liveText]);

    const status = isRecording ? 'RECORDING' : 'IDLE';

    return (
        <div className="panel">
            <div className="panel-header">
                <span className="panel-title">MIC &amp; TRANSCRIPT</span>
                <span className={`badge badge--${isRecording ? 'rec' : 'idle'}`}>{status}</span>
            </div>

            <div className="panel-mic">
                <MicButton isRecording={isRecording} onClick={isRecording ? onStop : onStart} />
            </div>

            <div className="panel-body">
                {state.transcript.length === 0 && !state.liveText && (
                    <p className="empty-state">Click the mic to start recording. Transcript appears here.</p>
                )}
                {state.transcript.map((chunk) => (
                    <TranscriptChunk key={chunk.id} chunk={chunk} />
                ))}
                {state.liveText && (
                    <div className="transcript-chunk transcript-chunk--live">
                        <span className="chunk-time">live</span>
                        <span className="chunk-text">{state.liveText}</span>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>
        </div>
    );
}
