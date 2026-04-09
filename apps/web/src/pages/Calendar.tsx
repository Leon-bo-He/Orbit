import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { Content, Workspace } from '@contentflow/shared';
import { apiFetch, ApiError } from '../api/client.js';
import { useWorkspaces } from '../api/workspaces.js';
import { useUpdateContent } from '../api/contents.js';
import { useUiStore } from '../store/ui.store.js';
import { ContentDrawer } from '../components/kanban/ContentDrawer.js';
import { CreateContentModal } from '../components/kanban/CreateContentModal.js';

// ─── Date helpers ────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date): Date   { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }

function calendarStart(d: Date): Date {
  const som = startOfMonth(d);
  const dow = (som.getDay() + 6) % 7;
  const s = new Date(som);
  s.setDate(s.getDate() - dow);
  return s;
}

function calendarEnd(d: Date): Date {
  const start = calendarStart(d);
  const end = new Date(start);
  end.setDate(end.getDate() + 41);
  end.setHours(23, 59, 59, 999);
  return end;
}

function addMonths(d: Date, n: number): Date { return new Date(d.getFullYear(), d.getMonth() + n, 1); }

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfWeek(d: Date): Date {
  const dow = (d.getDay() + 6) % 7;
  const s = new Date(d);
  s.setDate(s.getDate() - dow);
  s.setHours(0, 0, 0, 0);
  return s;
}

function monthLabel(d: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(d);
}

function weekdayLabel(d: Date, locale: string, short = false): string {
  return new Intl.DateTimeFormat(locale, { weekday: short ? 'short' : 'long' }).format(d);
}

function dayLabel(d: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(d);
}

function timeLabel(h: number): string {
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${period}`;
}

function mergeDateWithTime(existingScheduledAt: Date | string | null, newDate: Date): string {
  if (!existingScheduledAt) {
    const d = new Date(newDate);
    d.setHours(12, 0, 0, 0);
    return d.toISOString();
  }
  const old = typeof existingScheduledAt === 'string' ? new Date(existingScheduledAt) : existingScheduledAt;
  const merged = new Date(newDate);
  merged.setHours(old.getHours(), old.getMinutes(), 0, 0);
  return merged.toISOString();
}

// ─── API hooks ───────────────────────────────────────────────────────────────

function useCalendarContents(workspaceId: string, from: Date, to: Date) {
  const params = new URLSearchParams({
    workspace: workspaceId,
    from: from.toISOString(),
    to: to.toISOString(),
  });
  return useQuery<Record<string, Content[]>, ApiError>({
    queryKey: ['calendarContents', workspaceId, isoDate(from), isoDate(to)],
    queryFn: async () => {
      const serverData = await apiFetch<Record<string, Content[]>>(`/api/contents/calendar?${params.toString()}`);
      const byLocalDate: Record<string, Content[]> = {};
      for (const items of Object.values(serverData)) {
        for (const c of items) {
          if (!c.scheduledAt) continue;
          const localKey = isoDate(new Date(String(c.scheduledAt)));
          (byLocalDate[localKey] ??= []).push(c);
        }
      }
      return byLocalDate;
    },
    enabled: Boolean(workspaceId),
    placeholderData: keepPreviousData,
  });
}

function usePeriodCount(workspaceId: string, from: Date, to: Date, key: string) {
  const params = new URLSearchParams({
    workspace: workspaceId,
    from: from.toISOString(),
    to: to.toISOString(),
  });
  return useQuery<number, ApiError>({
    queryKey: ['contentCount', key, workspaceId],
    queryFn: async () => {
      const data = await apiFetch<Record<string, Content[]>>(`/api/contents/calendar?${params}`);
      return Object.values(data).reduce((sum, items) => sum + items.length, 0);
    },
    enabled: Boolean(workspaceId),
  });
}

// ─── Types ───────────────────────────────────────────────────────────────────

type CalendarView = 'month' | 'week' | 'list';

interface CreateWithDateState { date: string; }

// ─── ContentPill ─────────────────────────────────────────────────────────────

interface ContentPillProps {
  content: Content;
  color: string;
  onClick: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}

function ContentPill({ content, color, onClick, draggable, onDragStart }: ContentPillProps) {
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={content.title}
      style={{ borderLeftColor: color }}
      className="flex items-center gap-1 text-xs pl-1.5 pr-2 py-0.5 rounded-md bg-white border border-gray-100 border-l-[3px] cursor-pointer hover:bg-gray-50 hover:shadow-sm transition-all select-none"
    >
      <span className="truncate text-gray-700 font-medium leading-snug">{content.title}</span>
    </div>
  );
}

// ─── Month View ──────────────────────────────────────────────────────────────

interface MonthViewProps {
  current: Date;
  contentsByDate: Record<string, Content[]>;
  workspaceColor: string;
  workspaceId: string;
  onContentClick: (c: Content) => void;
  onAddClick: (date: string) => void;
  onDropContent: (contentId: string, newDate: Date) => void;
  contentsById: Map<string, Content>;
}

function MonthView({ current, contentsByDate, workspaceColor, onContentClick, onAddClick, onDropContent, contentsById }: MonthViewProps) {
  const { t } = useTranslation('contents');
  const locale = useUiStore((s) => s.locale);
  const today = isoDate(new Date());
  const gridStart = calendarStart(current);
  const currentMonth = current.getMonth();

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) days.push(addDays(gridStart, i));

  const [dragOver, setDragOver] = useState<string | null>(null);

  const weekdays: string[] = [];
  for (let i = 0; i < 7; i++) weekdays.push(weekdayLabel(addDays(gridStart, i), locale, true));

  function handleDragStart(e: React.DragEvent, content: Content) {
    e.dataTransfer.setData('contentId', content.id);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDrop(e: React.DragEvent, date: Date) {
    e.preventDefault();
    setDragOver(null);
    const contentId = e.dataTransfer.getData('contentId');
    if (contentId) onDropContent(contentId, date);
  }

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      {/* Weekday header */}
      <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
        {weekdays.map((wd) => (
          <div key={wd} className="py-2 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
            {wd}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 bg-white">
        {days.map((day) => {
          const dateStr = isoDate(day);
          const isCurrentMonth = day.getMonth() === currentMonth;
          const isToday = dateStr === today;
          const cellContents = contentsByDate[dateStr] ?? [];
          const isDragTarget = dragOver === dateStr;

          return (
            <div
              key={dateStr}
              onDragOver={(e) => { e.preventDefault(); setDragOver(dateStr); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => handleDrop(e, day)}
              className={`min-h-[96px] border-b border-r border-gray-100 p-1.5 relative group transition-colors last:border-r-0 ${
                !isCurrentMonth ? 'bg-gray-50/70' : ''
              } ${isDragTarget ? 'bg-indigo-50' : ''}`}
            >
              <div className="flex items-start justify-between mb-1">
                <span
                  className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full transition-colors ${
                    isToday
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : isCurrentMonth
                      ? 'text-gray-700 hover:bg-gray-100 cursor-default'
                      : 'text-gray-300'
                  }`}
                >
                  {day.getDate()}
                </span>
                <button
                  type="button"
                  onClick={() => onAddClick(dateStr)}
                  className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:bg-indigo-100 hover:text-indigo-600 font-bold text-sm transition-all"
                >
                  +
                </button>
              </div>

              <div className="space-y-0.5">
                {cellContents.slice(0, 3).map((c) => (
                  <ContentPill
                    key={c.id}
                    content={c}
                    color={workspaceColor}
                    onClick={() => onContentClick(c)}
                    draggable
                    onDragStart={(e) => handleDragStart(e, c)}
                  />
                ))}
                {cellContents.length > 3 && (
                  <div className="text-[10px] font-semibold text-indigo-500 pl-2 pt-0.5">
                    +{cellContents.length - 3} {t('card.more', { count: cellContents.length - 3 })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {contentsById.size === 0 && null}
    </div>
  );
}

// ─── Week View ───────────────────────────────────────────────────────────────

const WEEK_HOURS = Array.from({ length: 16 }, (_, i) => i + 7);

interface WeekViewProps {
  current: Date;
  contentsByDate: Record<string, Content[]>;
  workspaceColor: string;
  onContentClick: (c: Content) => void;
}

function WeekView({ current, contentsByDate, workspaceColor, onContentClick }: WeekViewProps) {
  const locale = useUiStore((s) => s.locale);
  const weekStart = startOfWeek(current);
  const days: Date[] = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = isoDate(new Date());

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Header */}
          <div className="grid grid-cols-[56px_repeat(7,1fr)] bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
            <div className="py-3" />
            {days.map((d) => {
              const ds = isoDate(d);
              const isToday = ds === today;
              return (
                <div key={ds} className="py-2 text-center border-l border-gray-200 first:border-l-0">
                  <div className={`text-[11px] font-semibold uppercase tracking-wide ${isToday ? 'text-indigo-500' : 'text-gray-400'}`}>
                    {weekdayLabel(d, locale, true)}
                  </div>
                  <div
                    className={`mx-auto mt-1 w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold ${
                      isToday ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-700'
                    }`}
                  >
                    {d.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time rows */}
          {WEEK_HOURS.map((hour) => (
            <div key={hour} className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-gray-100 last:border-b-0 bg-white">
              <div className="py-2 pr-3 text-right text-[11px] font-medium text-gray-400 tabular-nums pt-2">
                {timeLabel(hour)}
              </div>
              {days.map((d) => {
                const ds = isoDate(d);
                const dayContents = (contentsByDate[ds] ?? []).filter((c) => {
                  if (!c.scheduledAt) return false;
                  return new Date(c.scheduledAt).getHours() === hour;
                });
                return (
                  <div key={ds} className="border-l border-gray-100 min-h-[44px] p-0.5 space-y-0.5">
                    {dayContents.map((c) => (
                      <ContentPill
                        key={c.id}
                        content={c}
                        color={workspaceColor}
                        onClick={() => onContentClick(c)}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── List View ───────────────────────────────────────────────────────────────

interface ListViewProps {
  contentsByDate: Record<string, Content[]>;
  workspaceColor: string;
  onContentClick: (c: Content) => void;
  rangeStart: Date;
  daysShown: number;
  onLoadMore: () => void;
}

function ListView({ contentsByDate, workspaceColor, onContentClick, rangeStart, daysShown, onLoadMore }: ListViewProps) {
  const { t } = useTranslation('common');
  const locale = useUiStore((s) => s.locale);
  const todayStr = isoDate(new Date());
  const sentinelRef = useRef<HTMLDivElement>(null);

  const days: Date[] = Array.from({ length: daysShown }, (_, i) => addDays(rangeStart, i));

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) onLoadMore(); },
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onLoadMore]);

  return (
    <div className="py-2 space-y-0.5">
      {days.map((d) => {
        const ds = isoDate(d);
        const items = contentsByDate[ds] ?? [];
        const isToday = ds === todayStr;

        return (
          <div key={ds} className="flex gap-4 py-1.5">
            {/* Date column */}
            <div className="w-14 flex-shrink-0 text-right pt-0.5">
              <div className={`text-[11px] font-semibold uppercase tracking-wide ${isToday ? 'text-indigo-500' : 'text-gray-400'}`}>
                {weekdayLabel(d, locale, true)}
              </div>
              <div className={`text-xl font-bold leading-tight ${isToday ? 'text-indigo-600' : 'text-gray-700'}`}>
                {d.getDate()}
              </div>
              {isToday && (
                <div className="mt-0.5 text-[10px] font-semibold text-indigo-500 uppercase tracking-wide">
                  {t('calendar.today')}
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="w-px self-stretch flex-shrink-0" style={{ backgroundColor: isToday ? '#a5b4fc' : '#e5e7eb' }} />

            {/* Items */}
            <div className="flex-1 py-0.5">
              {items.length === 0 ? (
                <div className="min-h-[32px] flex items-center">
                  <span className="text-xs text-gray-300">—</span>
                </div>
              ) : (
                <div className="space-y-1">
                  {items.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onContentClick(c)}
                      style={{ borderLeftColor: workspaceColor }}
                      className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl bg-white border border-gray-100 border-l-[3px] hover:shadow-sm hover:border-gray-200 transition-all"
                    >
                      <span className="text-sm text-gray-800 font-medium flex-1 truncate">{c.title}</span>
                      {c.scheduledAt && (
                        <span className="text-xs text-gray-400 flex-shrink-0 font-medium tabular-nums">
                          {new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(c.scheduledAt))}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
      <div ref={sentinelRef} className="h-8" />
    </div>
  );
}

// ─── Goal Progress Bar ───────────────────────────────────────────────────────

interface GoalAlertBarProps {
  workspace: Workspace;
  weeklyActual: number;
  monthlyActual: number;
  yearlyActual: number;
}

interface PublishGoal { count: number; period: string; }

function GoalAlertBar({ workspace, weeklyActual, monthlyActual, yearlyActual }: GoalAlertBarProps) {
  const { t } = useTranslation('common');
  const publishGoal = workspace.publishGoal as PublishGoal | null;
  if (!publishGoal?.count) return null;

  const weeklyGoal = publishGoal.count;
  const monthlyGoal = Math.round(weeklyGoal * (52 / 12));
  const yearlyGoal = weeklyGoal * 52;

  const rows = [
    { label: t('calendar.goal_week'), actual: weeklyActual, goal: weeklyGoal },
    { label: t('calendar.goal_month'), actual: monthlyActual, goal: monthlyGoal },
    { label: t('calendar.goal_year'), actual: yearlyActual, goal: yearlyGoal },
  ];

  return (
    <div className="mb-3 px-4 py-3 rounded-xl bg-white border border-gray-200 shadow-sm">
      <div className="space-y-2.5">
        {rows.map(({ label, actual, goal }) => {
          const pct = Math.min(100, Math.round((actual / goal) * 100));
          const done = actual >= goal;
          return (
            <div key={label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-600">{label}</span>
                <span className={`text-xs font-bold tabular-nums ${done ? 'text-emerald-600' : 'text-gray-500'}`}>
                  {t('calendar.goal_of', { actual, goal })}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    done ? 'bg-emerald-500' : pct >= 70 ? 'bg-indigo-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400'
                  }`}
                  style={{ width: `${pct > 0 ? Math.max(pct, 2) : 0}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Calendar Page ───────────────────────────────────────────────────────────

export default function Calendar() {
  const { t } = useTranslation('common');
  const locale = useUiStore((s) => s.locale);
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { data: workspaces } = useWorkspaces();
  const updateContent = useUpdateContent();

  const workspace = workspaces?.find((w) => w.id === workspaceId);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const [view, setView] = useState<CalendarView>(isMobile ? 'list' : 'month');
  const [current, setCurrent] = useState<Date>(new Date());
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [createWithDate, setCreateWithDate] = useState<CreateWithDateState | null>(null);
  const [listDays, setListDays] = useState(14);

  const from = view === 'month' ? calendarStart(current) : view === 'week' ? startOfWeek(current) : new Date();
  const to = (() => {
    if (view === 'month') return calendarEnd(current);
    if (view === 'week') {
      const end = addDays(startOfWeek(current), 6);
      end.setHours(23, 59, 59, 999);
      return end;
    }
    return addDays(new Date(), listDays);
  })();

  const weekStart = startOfWeek(current);

  const { data: contentsByDate = {}, isLoading } = useCalendarContents(workspaceId ?? '', from, to);

  const weeklyActual = Array.from({ length: 7 }, (_, i) => isoDate(addDays(weekStart, i)))
    .reduce((sum, ds) => sum + (contentsByDate[ds]?.length ?? 0), 0);

  const monthFrom = new Date(current.getFullYear(), current.getMonth(), 1);
  const monthTo = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59, 999);
  const yearFrom = new Date(current.getFullYear(), 0, 1);
  const yearTo = new Date(current.getFullYear(), 11, 31, 23, 59, 59, 999);

  const { data: monthlyActual = 0 } = usePeriodCount(workspaceId ?? '', monthFrom, monthTo, `month-${current.getFullYear()}-${current.getMonth()}`);
  const { data: yearlyActual = 0 } = usePeriodCount(workspaceId ?? '', yearFrom, yearTo, `year-${current.getFullYear()}`);

  const contentsById = useCallback((): Map<string, Content> => {
    const map = new Map<string, Content>();
    for (const items of Object.values(contentsByDate)) {
      for (const c of items) map.set(c.id, c);
    }
    return map;
  }, [contentsByDate]);

  function handleDropContent(contentId: string, newDate: Date) {
    const content = contentsById().get(contentId);
    if (!content || !workspaceId) return;
    updateContent.mutate({
      id: contentId,
      workspaceId,
      data: { scheduledAt: mergeDateWithTime(content.scheduledAt, newDate) },
    });
  }

  function handlePrev() {
    if (view === 'month') setCurrent((c) => addMonths(c, -1));
    else if (view === 'week') setCurrent((c) => addDays(c, -7));
  }

  function handleNext() {
    if (view === 'month') setCurrent((c) => addMonths(c, 1));
    else if (view === 'week') setCurrent((c) => addDays(c, 7));
  }

  useEffect(() => {
    function onResize() {
      if (window.innerWidth < 768 && view !== 'list') setView('list');
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [view]);

  if (!workspaceId) {
    return <div className="p-6"><p className="text-gray-500">{t('workspace.no_workspace')}</p></div>;
  }

  const viewLabels: Record<CalendarView, string> = {
    month: t('calendar.month_view'),
    week: t('calendar.week_view'),
    list: t('calendar.list_view'),
  };

  const viewBadges: Partial<Record<CalendarView, number>> = {
    month: monthlyActual,
    week: weeklyActual,
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0 gap-3 flex-wrap">
        {/* View switcher */}
        <div className="flex items-center gap-0.5 bg-gray-100 rounded-xl p-1">
          {(['month', 'week', 'list'] as CalendarView[]).map((v) => {
            const badge = viewBadges[v];
            return (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  view === v
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {viewLabels[v]}
                {badge != null && badge > 0 && (
                  <span className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold tabular-nums ${
                    view === v ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Nav controls */}
        {view !== 'list' && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrev}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
              title={t('calendar.prev')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>
            <span className="text-sm font-semibold text-gray-800 min-w-[148px] text-center capitalize select-none">
              {view === 'month'
                ? monthLabel(current, locale)
                : `${dayLabel(weekStart, locale)} – ${dayLabel(addDays(weekStart, 6), locale)}`}
            </span>
            <button
              type="button"
              onClick={handleNext}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
              title={t('calendar.next')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setCurrent(new Date())}
              className="ml-1 text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold transition-colors"
            >
              {t('calendar.today')}
            </button>
          </div>
        )}
      </div>

      {/* Goal alert */}
      {workspace && (
        <div className="px-5 pt-3">
          <GoalAlertBar workspace={workspace} weeklyActual={weeklyActual} monthlyActual={monthlyActual} yearlyActual={yearlyActual} />
        </div>
      )}

      {/* Calendar body */}
      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 000 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z"/>
              </svg>
              {t('status.loading')}
            </div>
          </div>
        ) : view === 'month' ? (
          <MonthView
            current={current}
            contentsByDate={contentsByDate}
            workspaceColor={workspace?.color ?? '#6366f1'}
            workspaceId={workspaceId}
            onContentClick={setSelectedContent}
            onAddClick={(date) => setCreateWithDate({ date })}
            onDropContent={handleDropContent}
            contentsById={contentsById()}
          />
        ) : view === 'week' ? (
          <WeekView
            current={current}
            contentsByDate={contentsByDate}
            workspaceColor={workspace?.color ?? '#6366f1'}
            onContentClick={setSelectedContent}
          />
        ) : (
          <ListView
            contentsByDate={contentsByDate}
            workspaceColor={workspace?.color ?? '#6366f1'}
            onContentClick={setSelectedContent}
            rangeStart={new Date()}
            daysShown={listDays}
            onLoadMore={() => setListDays((d) => d + 14)}
          />
        )}
      </div>

      {selectedContent && (
        <ContentDrawer
          content={selectedContent}
          workspaceId={workspaceId}
          onClose={() => setSelectedContent(null)}
        />
      )}

      {createWithDate && (
        <CreateContentModalWithDate
          workspaceId={workspaceId}
          prefillDate={createWithDate.date}
          onClose={() => setCreateWithDate(null)}
        />
      )}
    </div>
  );
}

// ─── CreateContentModal with pre-filled date ─────────────────────────────────

interface CreateContentModalWithDateProps {
  workspaceId: string;
  prefillDate: string;
  onClose: () => void;
}

function CreateContentModalWithDate({ workspaceId, prefillDate, onClose }: CreateContentModalWithDateProps) {
  const locale = useUiStore((s) => s.locale);
  const formattedDate = new Intl.DateTimeFormat(locale, {
    weekday: 'short', month: 'short', day: 'numeric',
  }).format(new Date(prefillDate));
  void formattedDate;
  return <CreateContentModal workspaceId={workspaceId} onClose={onClose} />;
}
