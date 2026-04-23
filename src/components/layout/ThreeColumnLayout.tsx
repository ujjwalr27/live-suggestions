import type { ReactNode } from 'react';

interface Props {
    left: ReactNode;
    middle: ReactNode;
    right: ReactNode;
}

export function ThreeColumnLayout({ left, middle, right }: Props) {
    return (
        <div className="three-col">
            <div className="col">{left}</div>
            <div className="col">{middle}</div>
            <div className="col">{right}</div>
        </div>
    );
}
