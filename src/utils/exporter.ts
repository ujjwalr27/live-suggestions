import { TranscriptChunk, SuggestionBatch, ChatMessage } from './types';

export function exportSession(
    transcript: TranscriptChunk[],
    suggestionBatches: SuggestionBatch[],
    chatMessages: ChatMessage[],
): void {
    const data = {
        exportedAt: new Date().toISOString(),
        transcript,
        suggestionBatches,
        chat: chatMessages,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `twinmind-session-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
}
