import {
    createContext,
    useContext,
    useReducer,
    useEffect,
    type ReactNode,
    type Dispatch,
} from 'react';
import { TranscriptChunk, SuggestionBatch, ChatMessage, Settings } from '../utils/types';

// ── Default Prompts ──────────────────────────────────────────────────────────

const SUGGESTIONS_PROMPT = `You are an AI meeting copilot. Given a recent conversation transcript, surface exactly 3 suggestions that would help the listener RIGHT NOW.

SUGGESTION TYPES — pick the 3 most contextually relevant:
- question_to_ask: A sharp follow-up the listener should ask.
- talking_point: A relevant fact or angle the listener could raise.
- direct_answer: A direct answer to a question/uncertainty in the transcript.
- fact_check: A claim that should be verified, with correct/nuanced info.
- clarification: Something ambiguous that needs clearing up.

RULES:
1. Pick the 3 TYPES that best fit right now — vary them context-by-context.
2. "preview" (1–2 sentences) must deliver standalone value even if not clicked.
3. "detail" (3–5 sentences) expands on preview for the chat panel.
4. Be specific: reference names, numbers, topics from the transcript.
5. Avoid repeating what was already addressed in the last 60 seconds.
6. If transcript is too short, say so honestly rather than hallucinating.

Return ONLY a JSON array, no markdown fences:
[{"type":"...","preview":"...","detail":"..."},...]`;

const DETAILED_PROMPT = `You are a knowledgeable assistant supporting someone during a live meeting. You have the full transcript and a specific topic to address. Give a thorough, accurate answer (150–300 words). Reference specifics from the transcript. Be direct and useful — do not pad.`;

const CHAT_PROMPT = `You are a smart, concise meeting assistant with access to the full meeting transcript. Answer questions helpfully and accurately. Reference what was actually said when relevant. If a topic was not discussed, say so clearly.`;

export const DEFAULT_SETTINGS: Settings = {
    model: 'openai/gpt-oss-120b',
    suggestionsSystemPrompt: SUGGESTIONS_PROMPT,
    detailedAnswerSystemPrompt: DETAILED_PROMPT,
    chatSystemPrompt: CHAT_PROMPT,
    suggestionContextWords: 600,
    detailedContextWords: 0,
    chatContextWords: 2000,
};

// ── State ────────────────────────────────────────────────────────────────────

export interface SessionState {
    transcript: TranscriptChunk[];
    liveText: string;
    suggestionBatches: SuggestionBatch[];
    chatMessages: ChatMessage[];
    apiKey: string;
    settings: Settings;
    isRecording: boolean;
    isRefreshing: boolean;
    suggestionError: string | null;
}

export type Action =
    | { type: 'ADD_CHUNK'; payload: TranscriptChunk }
    | { type: 'SET_LIVE_TEXT'; payload: string }
    | { type: 'ADD_BATCH'; payload: SuggestionBatch }
    | { type: 'ADD_CHAT_MSG'; payload: ChatMessage }
    | { type: 'APPEND_CHAT_TOKEN'; payload: { id: string; token: string } }
    | { type: 'SET_RECORDING'; payload: boolean }
    | { type: 'SET_REFRESHING'; payload: boolean }
    | { type: 'SET_SUGGESTION_ERROR'; payload: string | null }
    | { type: 'SET_SETTINGS'; payload: Partial<Settings> }
    | { type: 'SET_API_KEY'; payload: string };

function loadPersisted(): { apiKey: string; settings: Settings } {
    try {
        const raw = localStorage.getItem('twinmind_config');
        if (raw) {
            const p = JSON.parse(raw) as { apiKey?: string; settings?: Partial<Settings> };
            return {
                apiKey: p.apiKey ?? '',
                settings: {
                    ...DEFAULT_SETTINGS,
                    ...(p.settings ?? {}),
                    model: DEFAULT_SETTINGS.model,
                },
            };
        }
    } catch { /* ignore */ }
    return { apiKey: '', settings: DEFAULT_SETTINGS };
}

const persisted = loadPersisted();

const INITIAL: SessionState = {
    transcript: [],
    liveText: '',
    suggestionBatches: [],
    chatMessages: [],
    apiKey: persisted.apiKey,
    settings: persisted.settings,
    isRecording: false,
    isRefreshing: false,
    suggestionError: null,
};

function reducer(state: SessionState, action: Action): SessionState {
    switch (action.type) {
        case 'ADD_CHUNK':
            return { ...state, transcript: [...state.transcript, action.payload] };
        case 'SET_LIVE_TEXT':
            return { ...state, liveText: action.payload };
        case 'ADD_BATCH':
            return { ...state, suggestionBatches: [action.payload, ...state.suggestionBatches] };
        case 'ADD_CHAT_MSG':
            return { ...state, chatMessages: [...state.chatMessages, action.payload] };
        case 'APPEND_CHAT_TOKEN': {
            const msgs = state.chatMessages.map((m) =>
                m.id === action.payload.id ? { ...m, content: m.content + action.payload.token } : m,
            );
            return { ...state, chatMessages: msgs };
        }
        case 'SET_RECORDING':
            return { ...state, isRecording: action.payload, liveText: action.payload ? state.liveText : '' };
        case 'SET_REFRESHING':
            return { ...state, isRefreshing: action.payload };
        case 'SET_SUGGESTION_ERROR':
            return { ...state, suggestionError: action.payload };
        case 'SET_SETTINGS':
            return {
                ...state,
                settings: {
                    ...state.settings,
                    ...action.payload,
                    model: DEFAULT_SETTINGS.model,
                },
            };
        case 'SET_API_KEY':
            return { ...state, apiKey: action.payload };
    }
}

// ── Context ──────────────────────────────────────────────────────────────────

interface SessionContextValue {
    state: SessionState;
    dispatch: Dispatch<Action>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(reducer, INITIAL);

    useEffect(() => {
        localStorage.setItem(
            'twinmind_config',
            JSON.stringify({ apiKey: state.apiKey, settings: state.settings }),
        );
    }, [state.apiKey, state.settings]);

    return (
        <SessionContext.Provider value={{ state, dispatch }}>
            {children}
        </SessionContext.Provider>
    );
}

export function useSession(): SessionContextValue {
    const ctx = useContext(SessionContext);
    if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
    return ctx;
}
