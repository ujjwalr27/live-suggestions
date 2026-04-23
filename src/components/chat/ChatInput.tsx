import { useState, type KeyboardEvent } from 'react';

interface Props {
    onSend: (text: string) => void;
    disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: Props) {
    const [text, setText] = useState('');

    const submit = () => {
        const trimmed = text.trim();
        if (!trimmed || disabled) return;
        onSend(trimmed);
        setText('');
    };

    const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
        }
    };

    return (
        <div className="chat-input-row">
            <textarea
                className="chat-textarea"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask a question… (Enter to send, Shift+Enter for newline)"
                disabled={disabled}
                rows={2}
            />
            <button
                className="send-btn"
                onClick={submit}
                disabled={disabled || !text.trim()}
                title="Send message"
            >
                Send
            </button>
        </div>
    );
}
