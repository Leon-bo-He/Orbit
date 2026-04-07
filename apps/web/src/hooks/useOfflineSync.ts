import { useEffect, useRef } from 'react';
import { useOfflineQueue } from '../store/offline-queue.store.js';
import { apiFetch } from '../api/client.js';
import { toast } from '../store/toast.store.js';
import { useOnlineStatus } from './useOnlineStatus.js';

export function useOfflineSync() {
  const { isOnline } = useOnlineStatus();
  const { queue, dequeue } = useOfflineQueue();
  const wasOfflineRef = useRef(!isOnline);

  useEffect(() => {
    const wasOffline = wasOfflineRef.current;
    wasOfflineRef.current = !isOnline;

    if (!isOnline || !wasOffline) return;
    if (queue.length === 0) return;

    const pending = [...queue];
    toast.info(`Back online — syncing ${pending.length} pending change${pending.length !== 1 ? 's' : ''}`);

    void (async () => {
      let successCount = 0;
      for (const mutation of pending) {
        try {
          const opts: RequestInit = { method: mutation.method };
          if (mutation.body != null) opts.body = JSON.stringify(mutation.body);
          await apiFetch(mutation.url, opts);
          dequeue(mutation.id);
          successCount++;
        } catch {
          // leave in queue for next retry
        }
      }
      if (successCount > 0) {
        toast.success('All changes synced');
      }
    })();
  }, [isOnline, queue, dequeue]);
}
