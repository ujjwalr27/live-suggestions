import { useState } from 'react';
import { useSession } from '../../context/SessionContext';
import { DEFAULT_SETTINGS } from '../../context/SessionContext';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: Props) {
    const { state, dispatch } = useSession();
    const [apiKey, setApiKey] = useState(state.apiKey);
    const [suggestionsPrompt, setSuggestionsPrompt] = useState(state.settings.suggestionsSystemPrompt);
    const [detailedPrompt, setDetailedPrompt] = useState(state.settings.detailedAnswerSystemPrompt);
    const [chatPrompt, setChatPrompt] = useState(state.settings.chatSystemPrompt);
    const [suggestionWords, setSuggestionWords] = useState(state.settings.suggestionContextWords);
    const [detailedWords, setDetailedWords] = useState(state.settings.detailedContextWords);
    const [chatWords, setChatWords] = useState(state.settings.chatContextWords);

    if (!isOpen) return null;

    const save = () => {
        dispatch({ type: 'SET_API_KEY', payload: apiKey.trim() });
        dispatch({
            type: 'SET_SETTINGS',
            payload: {
                suggestionsSystemPrompt: suggestionsPrompt,
                detailedAnswerSystemPrompt: detailedPrompt,
                chatSystemPrompt: chatPrompt,
                suggestionContextWords: Number(suggestionWords),
                detailedContextWords: Number(detailedWords),
                chatContextWords: Number(chatWords),
            },
        });
        onClose();
    };

    const reset = () => {
        setSuggestionsPrompt(DEFAULT_SETTINGS.suggestionsSystemPrompt);
        setDetailedPrompt(DEFAULT_SETTINGS.detailedAnswerSystemPrompt);
        setChatPrompt(DEFAULT_SETTINGS.chatSystemPrompt);
        setSuggestionWords(DEFAULT_SETTINGS.suggestionContextWords);
        setDetailedWords(DEFAULT_SETTINGS.detailedContextWords);
        setChatWords(DEFAULT_SETTINGS.chatContextWords);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Settings</h2>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="modal-body">
                    <label className="field-label">Groq API Key *</label>
                    <input
                        className="field-input"
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="gsk_..."
                    />

                    <label className="field-label">Model</label>
                    <input
                        className="field-input"
                        value={DEFAULT_SETTINGS.model}
                        readOnly
                        disabled
                    />

                    <label className="field-label">Live Suggestions System Prompt</label>
                    <textarea className="field-textarea" value={suggestionsPrompt} onChange={(e) => setSuggestionsPrompt(e.target.value)} rows={8} />

                    <label className="field-label">Detailed Answer System Prompt</label>
                    <textarea className="field-textarea" value={detailedPrompt} onChange={(e) => setDetailedPrompt(e.target.value)} rows={4} />

                    <label className="field-label">Chat System Prompt</label>
                    <textarea className="field-textarea" value={chatPrompt} onChange={(e) => setChatPrompt(e.target.value)} rows={3} />

                    <div className="field-row">
                        <div className="field-half">
                            <label className="field-label">Suggestion Context (words)</label>
                            <input className="field-input" type="number" min={100} max={3000} value={suggestionWords} onChange={(e) => setSuggestionWords(Number(e.target.value))} />
                        </div>
                        <div className="field-half">
                            <label className="field-label">Detailed Answer Context (words, 0 = full)</label>
                            <input className="field-input" type="number" min={0} max={12000} value={detailedWords} onChange={(e) => setDetailedWords(Number(e.target.value))} />
                        </div>
                    </div>

                    <div className="field-row">
                        <div className="field-half">
                            <label className="field-label">Chat Context (words)</label>
                            <input className="field-input" type="number" min={100} max={8000} value={chatWords} onChange={(e) => setChatWords(Number(e.target.value))} />
                        </div>
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn--ghost" onClick={reset}>Reset to defaults</button>
                    <button className="btn btn--primary" onClick={save}>Save</button>
                </div>
            </div>
        </div>
    );
}
