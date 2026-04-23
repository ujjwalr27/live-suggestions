import { TranscriptChunk as TChunk } from '../../utils/types';

interface Props {
    chunk: TChunk;
}

export function TranscriptChunk({ chunk }: Props) {
    return (
        <div className="transcript-chunk">
            <span className="chunk-time">{chunk.timestamp}</span>
            <span className="chunk-text">{chunk.text}</span>
        </div>
    );
}
