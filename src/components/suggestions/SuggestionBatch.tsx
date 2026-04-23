import { SuggestionBatch as Batch } from '../../utils/types';
import { SuggestionCard } from './SuggestionCard';

interface Props {
    batch: Batch;
    onCardClick: (detail: string) => void;
    isLatest: boolean;
}

export function SuggestionBatch({ batch, onCardClick, isLatest }: Props) {
    return (
        <div className={`suggestion-batch ${isLatest ? 'suggestion-batch--latest' : ''}`}>
            <div className="batch-header">
                <span className="batch-time">{batch.timestamp}</span>
                {isLatest && <span className="badge badge--new">NEW</span>}
            </div>
            {batch.suggestions.map((s, i) => (
                <SuggestionCard key={i} suggestion={s} onClick={onCardClick} />
            ))}
        </div>
    );
}
