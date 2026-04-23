import { ChatMessage, Settings, TranscriptChunk } from '../utils/types';
import { chatComplete, ChatMsg } from './groq';

function transcriptText(chunks: TranscriptChunk[]): string {
    return chunks.map((c) => `[${c.timestamp}] ${c.text}`).join('\n');
}

function buildContext(chunks: TranscriptChunk[], maxWords: number): string {
    const full = transcriptText(chunks);
    if (maxWords <= 0) return full;
    const words = full.split(/\s+/);
    return words.length > maxWords ? words.slice(-maxWords).join(' ') : full;
}

async function* streamTokens(messages: ChatMsg[], settings: Settings, apiKey: string): AsyncGenerator<string> {
    const res = await chatComplete(messages, apiKey, settings.model, true);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;
            const payload = trimmed.slice(6);
            if (payload === '[DONE]') return;
            try {
                const obj = JSON.parse(payload) as { choices: { delta: { content?: string } }[] };
                const token = obj.choices[0]?.delta?.content;
                if (token) yield token;
            } catch {
                // skip malformed SSE lines
            }
        }
    }
}

export async function* streamChatAnswer(
    userMessage: string,
    transcript: TranscriptChunk[],
    history: ChatMessage[],
    settings: Settings,
    apiKey: string,
): AsyncGenerator<string> {
    const ctx = buildContext(transcript, settings.chatContextWords);
    const system = `${settings.chatSystemPrompt}\n\nMeeting transcript so far:\n${ctx || '(none yet)'}`;

    const messages: ChatMsg[] = [
        { role: 'system', content: system },
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage },
    ];

    yield* streamTokens(messages, settings, apiKey);
}

export async function* streamDetailedAnswer(
    suggestionDetail: string,
    transcript: TranscriptChunk[],
    history: ChatMessage[],
    settings: Settings,
    apiKey: string,
): AsyncGenerator<string> {
    const ctx = buildContext(transcript, settings.detailedContextWords);
    const system = `${settings.detailedAnswerSystemPrompt}\n\nMeeting transcript so far:\n${ctx || '(none yet)'}`;

    const messages: ChatMsg[] = [
        { role: 'system', content: system },
        ...history.map((m) => ({ role: m.role, content: m.content })),
        {
            role: 'user',
            content: `Suggestion selected:\n${suggestionDetail}\n\nProvide a detailed answer tailored to this meeting context.`,
        },
    ];

    yield* streamTokens(messages, settings, apiKey);
}
