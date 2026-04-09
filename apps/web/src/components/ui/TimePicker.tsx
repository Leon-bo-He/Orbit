import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface TimePickerProps {
  value: string; // HH:MM or ''
  onChange: (time: string) => void;
  placeholder?: string;
  className?: string;
}

function pad(n: number) { return String(n).padStart(2, '0'); }

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function parseTime(value: string): { h: number; m: number } | null {
  if (!value) return null;
  const parts = value.split(':');
  const h = parseInt(parts[0] ?? '');
  const rawM = parseInt(parts[1] ?? '');
  if (isNaN(h) || isNaN(rawM)) return null;
  // round to nearest 5-min step
  const m = Math.min(55, Math.round(rawM / 5) * 5);
  return { h, m };
}

export function TimePicker({ value, onChange, placeholder = '--:--', className = '' }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});

  const parsed = parseTime(value);
  const [selHour, setSelHour] = useState(parsed?.h ?? 9);
  const [selMinute, setSelMinute] = useState(parsed?.m ?? 0);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);

  const positionPopup = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popupH = 220;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow >= popupH ? rect.bottom + 4 : rect.top - popupH - 4;
    setPopupStyle({
      position: 'fixed',
      top: Math.max(8, top),
      left: rect.left,
      width: Math.max(rect.width, 130),
      zIndex: 9999,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      hourListRef.current?.querySelector(`[data-h="${selHour}"]`)?.scrollIntoView({ block: 'center' });
      minuteListRef.current?.querySelector(`[data-m="${selMinute}"]`)?.scrollIntoView({ block: 'center' });
    }, 10);
    return () => clearTimeout(t);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        popupRef.current && !popupRef.current.contains(target)
      ) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    const p = parseTime(value);
    if (p) { setSelHour(p.h); setSelMinute(p.m); }
  }, [value]);

  function commit(h: number, m: number) {
    onChange(`${pad(h)}:${pad(m)}`);
  }

  function selectHour(h: number) {
    setSelHour(h);
    commit(h, selMinute);
    hourListRef.current?.querySelector(`[data-h="${h}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  function selectMinute(m: number) {
    setSelMinute(m);
    commit(selHour, m);
    minuteListRef.current?.querySelector(`[data-m="${m}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  function handleClear() {
    onChange('');
    setOpen(false);
  }

  return (
    <div className={className}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => { if (!open) positionPopup(); setOpen((o) => !o); }}
        className="w-full text-left text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200 flex items-center justify-between gap-2 hover:border-gray-300 transition-colors bg-white"
      >
        <span className={value ? 'text-gray-800 font-mono' : 'text-gray-400'}>
          {value || placeholder}
        </span>
        <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {open && createPortal(
        <div ref={popupRef} style={popupStyle} className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-3">
          <div className="flex gap-1">
            {/* Hours */}
            <div
              ref={hourListRef}
              className="flex-1 h-32 overflow-y-auto overscroll-contain space-y-0.5"
              style={{ scrollbarWidth: 'none' }}
            >
              {HOURS.map((h) => (
                <button
                  key={h}
                  type="button"
                  data-h={h}
                  onClick={() => selectHour(h)}
                  className={`w-full text-center text-sm py-1 rounded-lg font-mono transition-colors ${
                    selHour === h
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {pad(h)}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-center text-gray-300 font-bold text-sm w-3">:</div>

            {/* Minutes */}
            <div
              ref={minuteListRef}
              className="flex-1 h-32 overflow-y-auto overscroll-contain space-y-0.5"
              style={{ scrollbarWidth: 'none' }}
            >
              {MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  data-m={m}
                  onClick={() => selectMinute(m)}
                  className={`w-full text-center text-sm py-1 rounded-lg font-mono transition-colors ${
                    selMinute === m
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {pad(m)}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between items-center">
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-indigo-500 hover:text-indigo-700 font-semibold transition-colors"
            >
              Done
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
