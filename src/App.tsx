import { useState, useCallback } from 'react';
import { SessionProvider, useSession } from './context/SessionContext';
import { ThreeColumnLayout } from './components/layout/ThreeColumnLayout';
import { TranscriptPanel } from './components/transcript/TranscriptPanel';
import { SuggestionsPanel } from './components/suggestions/SuggestionsPanel';
import { ChatPanel } from './components/chat/ChatPanel';
import { SettingsModal } from './components/settings/SettingsModal';
import { ExportButton } from './components/export/ExportButton';
import { useAudioCapture } from './hooks/useAudioCapture';
import { useAutoRefresh } from './hooks/useAutoRefresh';
import { generateSuggestions } from './api/suggestions';
import { streamChatAnswer, streamDetailedAnswer } from './api/chat';
import { SuggestionBatch, ChatMessage } from './utils/types';

function uid() { return Math.random().toString(36).slice(2, 10); }
function nowTime() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }

function AppInner() {
    const { state, dispatch } = useSession();
    const [settingsOpen, setSettingsOpen] = useState(!state.apiKey);
    const [isSending, setIsSending] = useState(false);

    // ── Suggestion refresh ────────────────────────────────────────────────────
    const refreshSuggestions = useCallback(async (freshTranscriptText?: string | null) => {
        if (!state.apiKey || state.isRefreshing) return;
        const liveTail = freshTranscriptText ? '' : state.liveText;
        const allText = [
            ...state.transcript.map((c) => c.text),
            freshTranscriptText ?? '',
            liveTail,
        ].join(' ').trim();
        if (!allText) return;

        const words = allText.split(/\s+/);
        const context = words.slice(-state.settings.suggestionContextWords).join(' ');
        const recentSuggestions = state.suggestionBatches
            .slice(0, 3)
            .flatMap((batch) => batch.suggestions);

        dispatch({ type: 'SET_REFRESHING', payload: true });
        dispatch({ type: 'SET_SUGGESTION_ERROR', payload: null });
        try {
            const suggestions = await generateSuggestions(context, state.settings, state.apiKey, recentSuggestions);
            const batch: SuggestionBatch = {
                id: uid(),
                timestamp: nowTime(),
                suggestions,
            };
            dispatch({ type: 'ADD_BATCH', payload: batch });
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            dispatch({ type: 'SET_SUGGESTION_ERROR', payload: msg });
        } finally {
            dispatch({ type: 'SET_REFRESHING', payload: false });
        }
    }, [state.apiKey, state.isRefreshing, state.transcript, state.liveText, state.settings, state.suggestionBatches, dispatch]);

    // ── Audio capture ─────────────────────────────────────────────────────────
    const { startRecording, stopRecording, flushCurrentChunk } = useAudioCapture();

    const refreshCycle = useCallback(async () => {
        if (state.isRefreshing) return;
        const freshTranscriptText = state.isRecording
            ? await flushCurrentChunk()
            : null;
        await refreshSuggestions(freshTranscriptText);
    }, [state.isRecording, state.isRefreshing, flushCurrentChunk, refreshSuggestions]);

    // ── Auto refresh ──────────────────────────────────────────────────────────
    const { countdown, triggerRefresh } = useAutoRefresh(state.isRecording, refreshCycle);

    // ── Chat send ─────────────────────────────────────────────────────────────
    const sendChat = useCallback(async (content: string) => {
        if (!state.apiKey || isSending) return;
        setIsSending(true);

        const userMsg: ChatMessage = { id: uid(), role: 'user', content, timestamp: nowTime() };
        dispatch({ type: 'ADD_CHAT_MSG', payload: userMsg });

        const assistantId = uid();
        dispatch({
            type: 'ADD_CHAT_MSG',
            payload: { id: assistantId, role: 'assistant', content: '', timestamp: nowTime() },
        });

        try {
            const gen = streamChatAnswer(content, state.transcript, state.chatMessages, state.settings, state.apiKey);
            for await (const token of gen) {
                dispatch({ type: 'APPEND_CHAT_TOKEN', payload: { id: assistantId, token } });
            }
        } catch (err) {
            dispatch({ type: 'APPEND_CHAT_TOKEN', payload: { id: assistantId, token: `\n\n[Error: ${String(err)}]` } });
        } finally {
            setIsSending(false);
        }
    }, [state.apiKey, state.transcript, state.chatMessages, state.settings, isSending, dispatch]);

    const sendDetailedAnswer = useCallback(async (detail: string) => {
        if (!state.apiKey || isSending) return;
        setIsSending(true);

        const userMsg: ChatMessage = { id: uid(), role: 'user', content: detail, timestamp: nowTime() };
        dispatch({ type: 'ADD_CHAT_MSG', payload: userMsg });

        const assistantId = uid();
        dispatch({
            type: 'ADD_CHAT_MSG',
            payload: { id: assistantId, role: 'assistant', content: '', timestamp: nowTime() },
        });

        try {
            const gen = streamDetailedAnswer(detail, state.transcript, state.chatMessages, state.settings, state.apiKey);
            for await (const token of gen) {
                dispatch({ type: 'APPEND_CHAT_TOKEN', payload: { id: assistantId, token } });
            }
        } catch (err) {
            dispatch({ type: 'APPEND_CHAT_TOKEN', payload: { id: assistantId, token: `\n\n[Error: ${String(err)}]` } });
        } finally {
            setIsSending(false);
        }
    }, [state.apiKey, state.transcript, state.chatMessages, state.settings, isSending, dispatch]);

    // ── Suggestion card click → send detail as chat message ──────────────────
    const handleCardClick = useCallback((detail: string) => {
        void sendDetailedAnswer(detail);
    }, [sendDetailedAnswer]);

    return (
        <div className="app">
            <header className="app-header">
                <div className="app-brand">
                    <span className="app-logo">⚡</span>
                    <span className="app-name">TwinMind</span>
                    <span className="app-subtitle">Live Suggestions</span>
                </div>
                <div className="app-actions">
                    <ExportButton />
                    <button
                        className="icon-btn"
                        onClick={() => setSettingsOpen(true)}
                        title="Settings"
                        aria-label="Open settings"
                    >
                        ⚙
                    </button>
                </div>
            </header>

            <main className="app-main">
                <ThreeColumnLayout
                    left={
                        <TranscriptPanel
                            isRecording={state.isRecording}
                            onStart={startRecording}
                            onStop={stopRecording}
                        />
                    }
                    middle={
                        <SuggestionsPanel
                            onCardClick={handleCardClick}
                            onRefresh={triggerRefresh}
                            countdown={countdown}
                            isRefreshing={state.isRefreshing}
                        />
                    }
                    right={
                        <ChatPanel
                            onSend={sendChat}
                            isSending={isSending}
                        />
                    }
                />
            </main>

            <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </div>
    );
}

export default function App() {
    return (
        <SessionProvider>
            <AppInner />
        </SessionProvider>
    );
}
