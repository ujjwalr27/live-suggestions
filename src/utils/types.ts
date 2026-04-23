export interface TranscriptChunk {
    id: string;
    text: string;
    timestamp: string;
}

export type SuggestionType =
    | 'question_to_ask'
    | 'talking_point'
    | 'direct_answer'
    | 'fact_check'
    | 'clarification';

export interface Suggestion {
    type: SuggestionType;
    preview: string;
    detail: string;
}

export interface SuggestionBatch {
    id: string;
    timestamp: string;
    suggestions: Suggestion[];
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}

export interface Settings {
    model: string;
    suggestionsSystemPrompt: string;
    detailedAnswerSystemPrompt: string;
    chatSystemPrompt: string;
    suggestionContextWords: number;
    detailedContextWords: number;
    chatContextWords: number;
}
