import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const CAL_MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const CAL_DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

export function CalendarPicker({
  value, onChange, min, max, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [viewYear, setViewYear] = useState(() => value ? +value.slice(0, 4) : new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => value ? +value.slice(5, 7) - 1 : new Date().getMonth());

  useEffect(() => {
    if (!open) return;
    const onMouse = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node) || dropRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onMouse);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  useEffect(() => {
    if (value) { setViewYear(+value.slice(0, 4)); setViewMonth(+value.slice(5, 7) - 1); }
  }, [value]);

  function handleToggle() {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const dropH = 292;
    const top = window.innerHeight - rect.bottom >= dropH ? rect.bottom + 6 : rect.top - dropH - 6;
    setDropPos({ top, left: rect.left });
    setOpen((o) => !o);
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayStr = new Date().toISOString().slice(0, 10);

  function ds(day: number) {
    return `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const display = value
    ? new Date(value + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <div className="flex-1">
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        className="w-full relative flex items-center bg-white text-sm pl-3 pr-9 py-2 rounded-lg border border-gray-200 shadow-sm hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-colors text-left"
      >
        <span className={display ? 'text-gray-700 font-medium' : 'text-gray-400'}>
          {display || placeholder || ''}
        </span>
        <div className="pointer-events-none absolute right-2.5 inset-y-0 flex items-center">
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      </button>

      {open && createPortal(
        <div
          ref={dropRef}
          style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, zIndex: 9999 }}
          className="bg-white rounded-xl shadow-xl border border-gray-100 p-3 w-60"
        >
          {/* Month nav */}
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={prevMonth} className="p-1 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-sm font-semibold text-gray-800">{CAL_MONTHS[viewMonth]} {viewYear}</span>
            <button type="button" onClick={nextMonth} className="p-1 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {CAL_DAYS.map((d) => (
              <div key={d} className="text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-1">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {Array.from({ length: firstDow }, (_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const dateStr = ds(day);
              const selected = dateStr === value;
              const isToday = dateStr === todayStr;
              const disabled = Boolean((min && dateStr < min) || (max && dateStr > max));
              return (
                <button
                  key={day}
                  type="button"
                  disabled={disabled}
                  onClick={() => { onChange(dateStr); setOpen(false); }}
                  className={[
                    'mx-auto flex items-center justify-center w-7 h-7 rounded-full text-xs transition-colors',
                    selected ? 'bg-indigo-600 text-white font-semibold'
                      : disabled ? 'text-gray-300 cursor-not-allowed'
                      : isToday ? 'text-indigo-600 font-semibold hover:bg-indigo-50 cursor-pointer'
                      : 'text-gray-700 hover:bg-indigo-50 cursor-pointer',
                  ].join(' ')}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
