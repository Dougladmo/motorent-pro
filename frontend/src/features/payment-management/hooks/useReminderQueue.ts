import { useState, useRef, useCallback } from 'react';

interface ReminderQueueState {
  queue: string[];
  processing: string | null;
  completed: string[];
  failed: string[];
  isRunning: boolean;
}

const INTERVAL_MS = 5000; // 5 seconds between sends

export function useReminderQueue(sendReminder: (id: string) => Promise<unknown>) {
  const [state, setState] = useState<ReminderQueueState>({
    queue: [],
    processing: null,
    completed: [],
    failed: [],
    isRunning: false,
  });

  const cancelledRef = useRef(false);
  const runningRef = useRef(false);

  const processQueue = useCallback(async (ids: string[]) => {
    cancelledRef.current = false;
    runningRef.current = true;

    for (let i = 0; i < ids.length; i++) {
      if (cancelledRef.current) break;

      const id = ids[i];
      setState(prev => ({
        ...prev,
        processing: id,
        queue: ids.slice(i + 1),
      }));

      try {
        await sendReminder(id);
        setState(prev => ({
          ...prev,
          completed: [...prev.completed, id],
        }));
      } catch {
        setState(prev => ({
          ...prev,
          failed: [...prev.failed, id],
        }));
      }

      // Wait interval before next, unless cancelled or last item
      if (i < ids.length - 1 && !cancelledRef.current) {
        await new Promise<void>(resolve => {
          const timer = setTimeout(resolve, INTERVAL_MS);
          const checkCancel = setInterval(() => {
            if (cancelledRef.current) {
              clearTimeout(timer);
              clearInterval(checkCancel);
              resolve();
            }
          }, 100);
          setTimeout(() => {
            clearInterval(checkCancel);
          }, INTERVAL_MS);
        });
      }
    }

    runningRef.current = false;
    setState(prev => ({
      ...prev,
      processing: null,
      isRunning: false,
    }));
  }, [sendReminder]);

  const enqueue = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setState({
      queue: ids.slice(1),
      processing: null,
      completed: [],
      failed: [],
      isRunning: true,
    });
    processQueue(ids);
  }, [processQueue]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    setState(prev => ({
      ...prev,
      queue: [],
      processing: null,
      isRunning: false,
    }));
  }, []);

  const clear = useCallback(() => {
    cancelledRef.current = true;
    setState({
      queue: [],
      processing: null,
      completed: [],
      failed: [],
      isRunning: false,
    });
  }, []);

  const totalEnqueued = state.queue.length + (state.processing ? 1 : 0) + state.completed.length + state.failed.length;

  return {
    ...state,
    totalEnqueued,
    enqueue,
    cancel,
    clear,
  };
}
