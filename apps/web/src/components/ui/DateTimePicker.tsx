import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

interface DateTimePickerProps {
  value: string; // ISO string or ''
  onChange: (iso: string | null) => void;
  placeholder?: string;
  className?: string;
  /** When provided, replaces the default trigger button styling and hides the calendar icon */
  triggerClassName?: string;
  /** Renders a smaller calendar popup */
  compact?: boolean;
  /** Hides the time row — picks midnight of the selected date */
  dateOnly?: boolean;
}

const DAYS_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function pad(n: number) { return String(n).padStart(2, '0'); }

function formatDisplay(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString(navigator.language, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function isoToLocal(iso: string) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d;
}

function formatDateOnly(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString(navigator.language, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function DateTimePicker({ value, onChange, placeholder, className = '', triggerClassName, compact, dateOnly }: DateTimePickerProps) {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});

  const current = isoToLocal(value);
  const today = new Date();

  const [viewYear, setViewYear] = useState(current?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(current?.getMonth() ?? today.getMonth());
  const [selDate, setSelDate] = useState<Date | null>(current);
  const [hour, setHour] = useState(current ? pad(current.getHours()) : pad(today.getHours()));
  const [minute, setMinute] = useState(current ? pad(current.getMinutes()) : '00');

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const positionPopup = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popupHeight = compact ? 300 : 380;
    const minWidth = compact ? 240 : 288;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow >= popupHeight ? rect.bottom + 6 : rect.top - popupHeight - 6;
    setPopupStyle({
      position: 'fixed',
      top: Math.max(8, top),
      left: rect.left,
      width: Math.max(rect.width, minWidth),
      zIndex: 9999,
    });
  }, [compact]);

  function toggleOpen() {
    if (!open) positionPopup();
    setOpen(o => !o);
  }

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
    if (!open) return;
    const update = () => positionPopup();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, positionPopup]);

  useEffect(() => {
    const d = isoToLocal(value);
    setSelDate(d);
    if (d) {
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
      setHour(pad(d.getHours()));
      setMinute(pad(d.getMinutes()));
    }
  }, [value]);

  function commit(date: Date | null, h: string, m: string) {
    if (!date) { onChange(null); return; }
    const d = new Date(date);
    d.setHours(dateOnly ? 0 : (parseInt(h) || 0), dateOnly ? 0 : (parseInt(m) || 0), 0, 0);
    onChange(d.toISOString());
  }

  function selectDay(day: number) {
    const d = new Date(viewYear, viewMonth, day);
    setSelDate(d);
    commit(d, hour, minute);
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  function goToday() {
    const d = new Date();
    setViewYear(d.getFullYear()); setViewMonth(d.getMonth());
    setSelDate(d);
    setHour(pad(d.getHours())); setMinute(pad(d.getMinutes()));
    commit(d, pad(d.getHours()), pad(d.getMinutes()));
  }

  function clear() {
    setSelDate(null);
    onChange(null);
    setOpen(false);
  }

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthName = new Date(viewYear, viewMonth, 1).toLocaleString(navigator.language, { month: 'long', year: 'numeric' });

  const isToday = (day: number) =>
    day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
  const isSelected = (day: number) =>
    selDate !== null &&
    day === selDate.getDate() &&
    viewMonth === selDate.getMonth() &&
    viewYear === selDate.getFullYear();

  const popup = open ? createPortal(
    <div
      ref={popupRef}
      style={popupStyle}
      className={`bg-white rounded-2xl shadow-2xl border border-gray-100 ${compact ? 'p-3' : 'p-4'}`}
    >
      {/* Month nav */}
      <div className={`flex items-center justify-between ${compact ? 'mb-2' : 'mb-3'}`}>
        <button
          type="button"
          onClick={prevMonth}
          className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <span className={`${compact ? 'text-xs' : 'text-sm'} font-semibold text-gray-800 capitalize`}>
          {monthName}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS_SHORT.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-0.5">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className={`grid grid-cols-7 ${compact ? '' : 'gap-y-0.5'}`}>
        {cells.map((day, i) => (
          <div key={i} className="flex items-center justify-center">
            {day ? (
              <button
                type="button"
                onClick={() => selectDay(day)}
                className={`${compact ? 'w-7 h-7 text-xs' : 'w-8 h-8 text-sm'} rounded-full font-medium transition-all ${
                  isSelected(day)
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : isToday(day)
                      ? 'text-indigo-600 ring-2 ring-indigo-200 hover:bg-indigo-50'
                      : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {day}
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {/* Time */}
      {!dateOnly && (
        <div className={`${compact ? 'mt-2.5 pt-2.5' : 'mt-3 pt-3'} border-t border-gray-100 flex items-center justify-center gap-2`}>
          <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <input
            type="number" min={0} max={23} value={hour}
            onChange={(e) => {
              const v = pad(Math.min(23, Math.max(0, parseInt(e.target.value) || 0)));
              setHour(v); commit(selDate, v, minute);
            }}
            className={`${compact ? 'w-10 text-xs py-1' : 'w-12 text-sm py-1.5'} text-center font-mono border border-gray-200 rounded-xl px-1 outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300`}
          />
          <span className="text-gray-300 font-bold text-sm">:</span>
          <input
            type="number" min={0} max={59} value={minute}
            onChange={(e) => {
              const v = pad(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)));
              setMinute(v); commit(selDate, hour, v);
            }}
            className={`${compact ? 'w-10 text-xs py-1' : 'w-12 text-sm py-1.5'} text-center font-mono border border-gray-200 rounded-xl px-1 outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300`}
          />
        </div>
      )}

      {/* Footer */}
      <div className={`${compact ? 'mt-2.5' : 'mt-3'} flex justify-between items-center`}>
        <button
          type="button"
          onClick={clear}
          className="text-xs text-gray-400 hover:text-red-500 transition-colors font-medium"
        >
          {t('action.cancel')}
        </button>
        <button
          type="button"
          onClick={goToday}
          className="text-xs text-indigo-500 hover:text-indigo-700 font-semibold transition-colors"
        >
          {t('calendar.today')}
        </button>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <div className={className}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        className={triggerClassName ?? 'w-full text-left text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200 flex items-center justify-between gap-2 hover:border-gray-300 transition-colors bg-white'}
      >
        <span className={triggerClassName ? undefined : (value ? 'text-gray-800' : 'text-gray-400')}>
          {value ? (dateOnly ? formatDateOnly(value) : formatDisplay(value)) : (placeholder ?? t('calendar.no_content'))}
        </span>
        {!triggerClassName && (
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )}
      </button>
      {popup}
    </div>
  );
}
