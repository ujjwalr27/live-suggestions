export interface ChatMsg {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export async function transcribeAudio(blob: Blob, apiKey: string): Promise<string> {
    const file = new File([blob], 'audio.webm', { type: blob.type || 'audio/webm' });
    const form = new FormData();
    form.append('file', file);
    form.append('model', 'whisper-large-v3');
    form.append('response_format', 'text');

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Whisper ${res.status}: ${err}`);
    }

    return (await res.text()).trim();
}

export async function chatComplete(
    messages: ChatMsg[],
    apiKey: string,
    model: string,
    stream = false,
    jsonMode = false,
): Promise<Response> {
    const body: Record<string, unknown> = { model, messages, stream };
    if (jsonMode) body.response_format = { type: 'json_object' };

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Groq chat ${res.status}: ${err}`);
    }

    return res;
}
