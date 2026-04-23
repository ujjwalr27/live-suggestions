import { useSession } from '../../context/SessionContext';
import { exportSession } from '../../utils/exporter';

export function ExportButton() {
    const { state } = useSession();

    const handleExport = () => {
        exportSession(state.transcript, state.suggestionBatches, state.chatMessages);
    };

    const hasData = state.transcript.length > 0 || state.suggestionBatches.length > 0 || state.chatMessages.length > 0;

    return (
        <button
            className="export-btn"
            onClick={handleExport}
            disabled={!hasData}
            title="Export session as JSON"
        >
            ↓ Export
        </button>
    );
}
