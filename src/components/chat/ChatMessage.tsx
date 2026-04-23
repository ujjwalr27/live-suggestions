import { ChatMessage as Msg } from '../../utils/types';

// ── Lightweight markdown renderer ─────────────────────────────────────────────

function escHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inlineMd(line: string): string {
    return escHtml(line)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');
}

function parseCells(row: string): string[] {
    return row.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
}

function isTableRow(line: string): boolean {
    return line.trim().startsWith('|') && line.trim().endsWith('|');
}

function isSeparatorRow(line: string): boolean {
    return isTableRow(line) && /^[\|\s\-:]+$/.test(line);
}

function renderMarkdown(text: string): string {
    const lines = text.split('\n');
    const out: string[] = [];
    let inUl = false;
    let inOl = false;
    let tableBuffer: string[][] = [];
    let inTable = false;

    const closeList = () => {
        if (inUl) { out.push('</ul>'); inUl = false; }
        if (inOl) { out.push('</ol>'); inOl = false; }
    };

    const flushTable = () => {
        if (tableBuffer.length === 0) return;
        out.push('<div class="md-table-wrap"><table class="md-table">');
        tableBuffer.forEach((row, i) => {
            if (i === 0) {
                out.push('<thead><tr>');
                row.forEach(cell => out.push(`<th>${inlineMd(cell)}</th>`));
                out.push('</tr></thead><tbody>');
            } else {
                out.push('<tr>');
                row.forEach(cell => out.push(`<td>${inlineMd(cell)}</td>`));
                out.push('</tr>');
            }
        });
        out.push('</tbody></table></div>');
        tableBuffer = [];
        inTable = false;
    };

    for (const raw of lines) {
        const line = raw.trimEnd();

        if (isTableRow(line)) {
            closeList();
            if (!isSeparatorRow(line)) {
                inTable = true;
                tableBuffer.push(parseCells(line));
            }
            continue;
        }

        if (inTable) flushTable();

        if (/^###\s/.test(line)) {
            closeList();
            out.push(`<h5 class="md-h">${inlineMd(line.slice(4))}</h5>`);
        } else if (/^##\s/.test(line)) {
            closeList();
            out.push(`<h4 class="md-h">${inlineMd(line.slice(3))}</h4>`);
        } else if (/^#\s/.test(line)) {
            closeList();
            out.push(`<h3 class="md-h">${inlineMd(line.slice(2))}</h3>`);
        } else if (/^[-*]\s/.test(line)) {
            if (!inUl) { closeList(); out.push('<ul class="md-ul">'); inUl = true; }
            out.push(`<li>${inlineMd(line.slice(2))}</li>`);
        } else if (/^\d+\.\s/.test(line)) {
            if (!inOl) { closeList(); out.push('<ol class="md-ol">'); inOl = true; }
            out.push(`<li>${inlineMd(line.replace(/^\d+\.\s/, ''))}</li>`);
        } else if (/^---+$/.test(line)) {
            closeList();
            out.push('<hr class="md-hr" />');
        } else if (line === '') {
            closeList();
            out.push('<div class="md-gap"></div>');
        } else {
            closeList();
            out.push(`<p class="md-p">${inlineMd(line)}</p>`);
        }
    }
    if (inTable) flushTable();
    closeList();
    return out.join('');
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props { message: Msg; }

export function ChatMessage({ message }: Props) {
    const isUser = message.role === 'user';
    return (
        <div className={`chat-msg chat-msg--${message.role}`}>
            <div className="chat-msg-meta">
                <span className="chat-msg-role">{isUser ? 'YOU' : 'ASSISTANT'}</span>
                <span className="chat-msg-time">{message.timestamp}</span>
            </div>
            <div className="chat-msg-bubble">
                {message.content
                    ? (isUser
                        ? <p className="md-p">{message.content}</p>
                        : <div dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }} />)
                    : <span className="chat-cursor">▌</span>}
            </div>
        </div>
    );
}
