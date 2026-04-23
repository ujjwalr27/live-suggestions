import { useEffect, useRef, useState, useCallback } from 'react';

const INTERVAL_MS = 30_000;

export function useAutoRefresh(
    isRecording: boolean,
    onRefresh: () => Promise<void>,
) {
    const [countdown, setCountdown] = useState(INTERVAL_MS / 1000);
    const onRefreshRef = useRef(onRefresh);
    onRefreshRef.current = onRefresh;
    const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const resetIntervals = useCallback(() => {
        if (refreshIntervalRef.current !== null) {
            clearInterval(refreshIntervalRef.current);
        }
        setCountdown(INTERVAL_MS / 1000);
        refreshIntervalRef.current = setInterval(() => {
            void onRefreshRef.current();
            setCountdown(INTERVAL_MS / 1000);
        }, INTERVAL_MS);
    }, []);

    useEffect(() => {
        if (!isRecording) {
            if (refreshIntervalRef.current !== null) {
                clearInterval(refreshIntervalRef.current);
                refreshIntervalRef.current = null;
            }
            setCountdown(INTERVAL_MS / 1000);
            return;
        }

        resetIntervals();

        const tickId = setInterval(() => {
            setCountdown((prev: number) => Math.max(0, prev - 1));
        }, 1000);

        return () => {
            if (refreshIntervalRef.current !== null) {
                clearInterval(refreshIntervalRef.current);
                refreshIntervalRef.current = null;
            }
            clearInterval(tickId);
        };
    }, [isRecording, resetIntervals]);

    const triggerRefresh = useCallback(async () => {
        await onRefreshRef.current();
        resetIntervals();
        setCountdown(INTERVAL_MS / 1000);
    }, [resetIntervals]);

    return { countdown, triggerRefresh };
}
