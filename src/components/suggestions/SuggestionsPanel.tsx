import { useEffect, useRef } from 'react';
import { useSession } from '../../context/SessionContext';
import { SuggestionBatch } from './SuggestionBatch';

interface Props {
    onCardClick: (detail: string) => void;
    onRefresh: () => void;
    countdown: number;
    isRefreshing: boolean;
}

export function SuggestionsPanel({ onCardClick, onRefresh, countdown, isRefreshing }: Props) {
    const { state } = useSession();
    const topRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        topRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [state.suggestionBatches.length]);

    return (
        <div className="panel">
            <div className="panel-header">
                <span className="panel-title">LIVE SUGGESTIONS</span>
                {state.suggestionBatches.length > 0 && (
                    <span className="badge badge--count">{state.suggestionBatches.length} batch{state.suggestionBatches.length !== 1 ? 'es' : ''}</span>
                )}
            </div>

            <div className="panel-toolbar">
                <button
                    className="refresh-btn"
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    title="Manually refresh suggestions"
                >
                    <span className={isRefreshing ? 'spin' : ''}>↺</span>
                    {isRefreshing ? ' Refreshing…' : ' Reload suggestions'}
                </button>
                {state.isRecording && (
                    <span className="countdown">auto in {countdown}s</span>
                )}
            </div>

            <div className="panel-body">
                {state.suggestionBatches.length === 0 && !state.suggestionError && (
                    <p className="empty-state">
                        {state.isRecording
                            ? 'Suggestions appear after the first 30s of speech…'
                            : 'Start recording to surface AI suggestions.'}
                    </p>
                )}
                {state.suggestionError && (
                    <div className="suggestion-error">
                        ⚠ Suggestion refresh failed: {state.suggestionError}
                    </div>
                )}
                <div ref={topRef} />
                {state.suggestionBatches.map((batch, i) => (
                    <SuggestionBatch
                        key={batch.id}
                        batch={batch}
                        onCardClick={onCardClick}
                        isLatest={i === 0}
                    />
                ))}
            </div>
        </div>
    );
}
