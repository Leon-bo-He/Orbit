import { useState, useCallback } from 'react';

const REMINDERS_KEY = 'contentflow-scheduled-reminders';
const REMINDER_ADVANCE_MS = 15 * 60 * 1000; // 15 minutes

interface ScheduledPublication {
  id: string;
  scheduledAt: string | null;
  platform: string;
  contentTitle?: string;
}

function getStoredTimers(): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(REMINDERS_KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

function storeTimers(timers: Record<string, number>) {
  sessionStorage.setItem(REMINDERS_KEY, JSON.stringify(timers));
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }, []);

  const scheduleReminder = useCallback((pub: ScheduledPublication) => {
    if (permission !== 'granted') return;
    if (!pub.scheduledAt) return;

    const fireAt = new Date(pub.scheduledAt).getTime() - REMINDER_ADVANCE_MS;
    const delay = fireAt - Date.now();
    if (delay <= 0) return;

    const timers = getStoredTimers();
    // Clear any existing timer for this publication
    if (timers[pub.id] !== undefined) {
      clearTimeout(timers[pub.id]);
    }

    const timerId = window.setTimeout(() => {
      new Notification('ContentFlow — Time to publish', {
        body: `Time to publish: ${pub.contentTitle ?? 'Content'} on ${pub.platform}`,
        icon: '/icon-192.png',
        tag: `reminder-${pub.id}`,
      });
      const updated = getStoredTimers();
      delete updated[pub.id];
      storeTimers(updated);
    }, delay);

    timers[pub.id] = timerId;
    storeTimers(timers);
  }, [permission]);

  return { permission, requestPermission, scheduleReminder };
}
