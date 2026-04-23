export interface ChatMsg {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

// Parse Groq error responses into friendly messages — never expose raw JSON or org IDs.
async function sanitizeGroqError(res: Response, prefix: string): Promise<never> {
    let friendly: string;
    try {
        const raw = await res.text();
        console.error(`[${prefix}] ${res.status}:`, raw); // dev-only, stays in console
        const parsed = JSON.parse(raw) as { error?: { message?: string; code?: string } };
        const code = parsed?.error?.code ?? '';
        const msg = parsed?.error?.message ?? '';
        if (res.status === 401) {
            friendly = 'Invalid API key. Please check your Groq key in Settings.';
        } else if (res.status === 429 || code === 'rate_limit_exceeded') {
            // Extract retry time if present, but strip org/account info
            const retryMatch = msg.match(/try again in ([\d.]+s)/);
            friendly = retryMatch
                ? `Rate limit reached. Please try again in ${retryMatch[1]}.`
                : 'Rate limit reached. Please wait a moment and try again.';
        } else if (res.status === 413) {
            friendly = 'Request too large. Try reducing the context window in Settings.';
        } else if (res.status >= 500) {
            friendly = `Groq service error (${res.status}). Please try again.`;
        } else {
            friendly = `API error (${res.status}). Please try again.`;
        }
    } catch {
        friendly = `API error (${res.status}). Please try again.`;
    }
    throw new Error(friendly);
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
        await sanitizeGroqError(res, 'Whisper');
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
        await sanitizeGroqError(res, 'Groq chat');
    }

    return res;
}
