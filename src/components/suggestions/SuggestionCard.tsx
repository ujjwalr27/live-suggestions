import { Suggestion, SuggestionType } from '../../utils/types';

const TYPE_LABELS: Record<SuggestionType, string> = {
    question_to_ask: 'Question to Ask',
    talking_point: 'Talking Point',
    direct_answer: 'Direct Answer',
    fact_check: 'Fact Check',
    clarification: 'Clarification',
};

interface Props {
    suggestion: Suggestion;
    onClick: (detail: string) => void;
}

export function SuggestionCard({ suggestion, onClick }: Props) {
    return (
        <button
            className={`suggestion-card suggestion-card--${suggestion.type.replace(/_/g, '-')}`}
            onClick={() => onClick(suggestion.detail)}
            title="Click for a detailed answer in chat"
        >
            <span className="suggestion-type">{TYPE_LABELS[suggestion.type]}</span>
            <p className="suggestion-preview">{suggestion.preview}</p>
            <span className="suggestion-cta">→ Expand in chat</span>
        </button>
    );
}
