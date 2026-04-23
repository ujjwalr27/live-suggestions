interface Props {
    isRecording: boolean;
    onClick: () => void;
}

export function MicButton({ isRecording, onClick }: Props) {
    return (
        <div className="mic-btn-wrap">
            {/* Animated pulse rings shown when recording */}
            {isRecording && (
                <>
                    <span className="mic-ring mic-ring--1" />
                    <span className="mic-ring mic-ring--2" />
                </>
            )}
            <button
                className={`mic-btn ${isRecording ? 'mic-btn--active' : ''}`}
                onClick={onClick}
                title={isRecording ? 'Stop recording' : 'Start recording'}
                aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            >
                {isRecording ? (
                    /* Stop icon — square */
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="4" y="4" width="16" height="16" rx="3" />
                    </svg>
                ) : (
                    /* Microphone icon */
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="9" y="2" width="6" height="12" rx="3" />
                        <path d="M5 11a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                        <line x1="12" y1="18" x2="12" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <line x1="8" y1="22" x2="16" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                )}
                <span className="mic-label">
                    {isRecording ? 'Stop' : 'Start'}
                </span>
            </button>
        </div>
    );
}
