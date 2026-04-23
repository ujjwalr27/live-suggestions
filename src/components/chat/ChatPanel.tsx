import { useEffect, useRef } from 'react';
import { useSession } from '../../context/SessionContext';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

interface Props {
    onSend: (text: string) => void;
    isSending: boolean;
}

export function ChatPanel({ onSend, isSending }: Props) {
    const { state } = useSession();
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [state.chatMessages]);

    return (
        <div className="panel panel--chat">
            <div className="panel-header">
                <span className="panel-title">CHAT &amp; DETAILED ANSWERS</span>
                <span className="badge badge--session">SESSION ONLY</span>
            </div>

            <div className="panel-body">
                {state.chatMessages.length === 0 && (
                    <p className="empty-state">Click a suggestion card or type a question below.</p>
                )}
                {state.chatMessages.map((msg) => (
                    <ChatMessage key={msg.id} message={msg} />
                ))}
                <div ref={bottomRef} />
            </div>

            <div className="panel-footer">
                {!state.apiKey && (
                    <p className="no-key-warning">⚠ Set your Groq API key in Settings first.</p>
                )}
                <ChatInput onSend={onSend} disabled={isSending || !state.apiKey} />
            </div>
        </div>
    );
}
