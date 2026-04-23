import { Suggestion, SuggestionType, Settings } from '../utils/types';
import { chatComplete } from './groq';

const VALID_TYPES: SuggestionType[] = [
    'question_to_ask',
    'talking_point',
    'direct_answer',
    'fact_check',
    'clarification',
];

const MAX_ATTEMPTS = 2;

type RawSuggestion = {
    type?: unknown;
    preview?: unknown;
    detail?: unknown;
};

function normalizeText(text: string): string {
    return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseModelJson(raw: string): unknown {
    try {
        return JSON.parse(raw);
    } catch {
        const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (!match) throw new Error('Model response was not valid JSON');
        return JSON.parse(match[1]);
    }
}

function extractSuggestionList(parsed: unknown): RawSuggestion[] {
    if (Array.isArray(parsed)) return parsed as RawSuggestion[];
    if (parsed && typeof parsed === 'object') {
        const suggestions = (parsed as { suggestions?: unknown }).suggestions;
        if (Array.isArray(suggestions)) return suggestions as RawSuggestion[];
    }
    throw new Error('Expected a JSON array of suggestions');
}

function sanitizeSuggestion(raw: RawSuggestion): Suggestion | null {
    const type = VALID_TYPES.includes(raw.type as SuggestionType)
        ? (raw.type as SuggestionType)
        : 'talking_point';
    const preview = String(raw.preview ?? '').trim();
    const detail = String(raw.detail ?? '').trim();
    if (!preview || !detail) return null;
    return { type, preview, detail };
}

function renderRecentSuggestions(recentSuggestions: Suggestion[]): string {
    if (recentSuggestions.length === 0) return '(none)';
    return recentSuggestions
        .slice(0, 9)
        .map((s) => `- [${s.type}] ${s.preview}`)
        .join('\n');
}

function buildSuggestionPrompt(
    recentTranscript: string,
    suggestionContextWords: number,
    recentSuggestions: Suggestion[],
    attempt: number,
    lastIssue: string,
): string {
    const correction = attempt === 1
        ? ''
        : `Previous output was invalid: ${lastIssue}\nReturn valid output now.\n\n`;

    return `${correction}Recent transcript (~last ${suggestionContextWords} words):
---
${recentTranscript}
---

Recent suggestions to avoid repeating:
${renderRecentSuggestions(recentSuggestions)}

Return ONLY a JSON array with exactly 3 items and no markdown fences:
[{"type":"question_to_ask|talking_point|direct_answer|fact_check|clarification","preview":"...","detail":"..."}]

Rules:
- Produce exactly 3 suggestions.
- Keep all 3 suggestions distinct.
- Do not repeat or lightly paraphrase recent suggestions listed above.
- preview must be useful on its own.
- detail must be richer than preview.`;
}

function collectFreshSuggestions(
    rawList: RawSuggestion[],
    recentSuggestions: Suggestion[],
): Suggestion[] {
    const recentPreviewKeys = new Set(
        recentSuggestions.map((s) => `${s.type}|${normalizeText(s.preview)}`),
    );
    const seen = new Set<string>();
    const picked: Suggestion[] = [];

    for (const raw of rawList) {
        const suggestion = sanitizeSuggestion(raw);
        if (!suggestion) continue;
        const key = `${suggestion.type}|${normalizeText(suggestion.preview)}`;
        if (seen.has(key) || recentPreviewKeys.has(key)) continue;
        seen.add(key);
        picked.push(suggestion);
        if (picked.length === 3) break;
    }

    return picked;
}

export async function generateSuggestions(
    recentTranscript: string,
    settings: Settings,
    apiKey: string,
    recentSuggestions: Suggestion[] = [],
): Promise<Suggestion[]> {
    let lastIssue = 'No model response.';

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const res = await chatComplete(
            [
                { role: 'system', content: settings.suggestionsSystemPrompt },
                {
                    role: 'user',
                    content: buildSuggestionPrompt(
                        recentTranscript,
                        settings.suggestionContextWords,
                        recentSuggestions,
                        attempt,
                        lastIssue,
                    ),
                },
            ],
            apiKey,
            settings.model,
            false,
            false,
        );

        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const raw = data.choices?.[0]?.message?.content?.trim() ?? '';
        if (!raw) {
            lastIssue = 'Empty response from model.';
            continue;
        }

        try {
            const parsed = parseModelJson(raw);
            const list = extractSuggestionList(parsed);
            const suggestions = collectFreshSuggestions(list, recentSuggestions);
            if (suggestions.length === 3) return suggestions;
            lastIssue = `Expected exactly 3 fresh suggestions but got ${suggestions.length}.`;
        } catch (err) {
            lastIssue = err instanceof Error ? err.message : String(err);
        }
    }

    throw new Error(`Could not generate exactly 3 fresh suggestions. ${lastIssue}`);
}
