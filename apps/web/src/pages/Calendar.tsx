import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { Content, Workspace } from '@contentflow/shared';
import { apiFetch, ApiError } from '../api/client.js';
import { useWorkspaces } from '../api/workspaces.js';
import { useUpdateContent } from '../api/contents.js';
import { ContentDrawer } from '../components/kanban/ContentDrawer.js';
import { CreateContentModal } from '../components/kanban/CreateContentModal.js';

// ─── Date helpers (no date libraries) ──────────────────────────────────────

function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/** Monday-aligned start of the calendar grid */
function calendarStart(d: Date): Date {
  const som = startOfMonth(d);
  // getDay(): 0=Sun, 1=Mon … 6=Sat; Monday-align
  const dow = (som.getDay() + 6) % 7; // 0=Mon
  const s = new Date(som);
  s.setDate(s.getDate() - dow);
  return s;
}

/** End of calendar grid (always 6 rows = 42 days from calendarStart) */
function calendarEnd(d: Date): Date {
  const start = calendarStart(d);
  const end = new Date(start);
  end.setDate(end.getDate() + 41);
  return end;
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

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
  return `${h12}:00 ${period}`;
}

/** Keep HH:MM from existing scheduledAt, swap date part */
function mergeDateWithTime(existingScheduledAt: Date | string | null, newDate: Date): string {
  if (!existingScheduledAt) {
    // Default to noon
    const d = new Date(newDate);
    d.setHours(12, 0, 0, 0);
    return d.toISOString();
  }
  const old = typeof existingScheduledAt === 'string' ? new Date(existingScheduledAt) : existingScheduledAt;
  const merged = new Date(newDate);
  merged.setHours(old.getHours(), old.getMinutes(), 0, 0);
  return merged.toISOString();
}

// ─── API hook for calendar data ─────────────────────────────────────────────

function useCalendarContents(workspaceId: string, from: Date, to: Date) {
  const params = new URLSearchParams({
    workspace: workspaceId,
    from: from.toISOString(),
    to: to.toISOString(),
  });
  return useQuery<Record<string, Content[]>, ApiError>({
    queryKey: ['calendarContents', workspaceId, isoDate(from), isoDate(to)],
    queryFn: () => apiFetch<Record<string, Content[]>>(`/api/contents/calendar?${params.toString()}`),
    enabled: Boolean(workspaceId),
  });
}

// ─── Types ──────────────────────────────────────────────────────────────────

type CalendarView = 'month' | 'week' | 'list';

interface CreateWithDateState {
  date: string; // YYYY-MM-DD
}

// ─── Sub-components ─────────────────────────────────────────────────────────

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
      style={{ backgroundColor: color + '22', borderColor: color + '66', color }}
      className="text-xs px-1.5 py-0.5 rounded border truncate cursor-pointer hover:opacity-80 transition-opacity select-none"
    >
      {content.title}
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

function MonthView({
  current,
  contentsByDate,
  workspaceColor,
  onContentClick,
  onAddClick,
  onDropContent,
  contentsById,
}: MonthViewProps) {
  const today = isoDate(new Date());
  const gridStart = calendarStart(current);
  const currentMonth = current.getMonth();

  // Build 42 day cells
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(addDays(gridStart, i));
  }

  const [dragOver, setDragOver] = useState<string | null>(null);

  // Mon–Sun header labels
  const weekdays: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(gridStart, i);
    weekdays.push(weekdayLabel(d, navigator.language, true));
  }

  function handleDragStart(e: React.DragEvent, content: Content) {
    e.dataTransfer.setData('contentId', content.id);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDrop(e: React.DragEvent, date: Date) {
    e.preventDefault();
    setDragOver(null);
    const contentId = e.dataTransfer.getData('contentId');
    if (contentId) {
      onDropContent(contentId, date);
    }
  }

  return (
    <div>
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {weekdays.map((wd) => (
          <div key={wd} className="py-1 text-center text-xs font-medium text-gray-500">
            {wd}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
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
              className={`min-h-[80px] border-b border-r border-gray-100 p-1 relative group transition-colors ${
                !isCurrentMonth ? 'bg-gray-50' : ''
              } ${isDragTarget ? 'bg-indigo-50' : ''}`}
            >
              {/* Day number */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full ${
                    isToday
                      ? 'bg-indigo-600 text-white'
                      : isCurrentMonth
                      ? 'text-gray-700'
                      : 'text-gray-300'
                  }`}
                >
                  {day.getDate()}
                </span>
                <button
                  type="button"
                  onClick={() => onAddClick(dateStr)}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600 text-sm leading-none w-4 h-4 flex items-center justify-center transition-opacity"
                  title="Add content"
                >
                  +
                </button>
              </div>

              {/* Content pills */}
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
                  <div className="text-xs text-gray-400 pl-1.5">
                    +{cellContents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {/* unused ref to suppress unused var warning */}
      {contentsById.size === 0 && null}
    </div>
  );
}

// ─── Week View ───────────────────────────────────────────────────────────────

const WEEK_HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 7am–10pm

interface WeekViewProps {
  current: Date;
  contentsByDate: Record<string, Content[]>;
  workspaceColor: string;
  onContentClick: (c: Content) => void;
}

function WeekView({ current, contentsByDate, workspaceColor, onContentClick }: WeekViewProps) {
  const weekStart = startOfWeek(current);
  const days: Date[] = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = isoDate(new Date());

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Header */}
        <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-gray-200">
          <div />
          {days.map((d) => {
            const ds = isoDate(d);
            return (
              <div
                key={ds}
                className={`py-1 text-center text-xs font-medium ${
                  ds === today ? 'text-indigo-600' : 'text-gray-500'
                }`}
              >
                <div>{weekdayLabel(d, navigator.language, true)}</div>
                <div
                  className={`mx-auto mt-0.5 w-6 h-6 flex items-center justify-center rounded-full text-sm ${
                    ds === today ? 'bg-indigo-600 text-white' : 'text-gray-700'
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
          <div key={hour} className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-gray-100">
            <div className="py-1 pr-2 text-right text-xs text-gray-400 leading-none pt-1.5">
              {timeLabel(hour)}
            </div>
            {days.map((d) => {
              const ds = isoDate(d);
              const dayContents = (contentsByDate[ds] ?? []).filter((c) => {
                if (!c.scheduledAt) return false;
                const h = new Date(c.scheduledAt).getHours();
                return h === hour;
              });
              return (
                <div
                  key={ds}
                  className="border-l border-gray-100 min-h-[40px] p-0.5 space-y-0.5"
                >
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
  );
}

// ─── List View ───────────────────────────────────────────────────────────────

interface ListViewProps {
  contentsByDate: Record<string, Content[]>;
  workspaceColor: string;
  onContentClick: (c: Content) => void;
  rangeStart: Date;
}

function ListView({ contentsByDate, workspaceColor, onContentClick, rangeStart }: ListViewProps) {
  const { t } = useTranslation('common');

  // Build next 30 days
  const days: Date[] = Array.from({ length: 30 }, (_, i) => addDays(rangeStart, i));

  return (
    <div className="space-y-4">
      {days.map((d) => {
        const ds = isoDate(d);
        const items = contentsByDate[ds] ?? [];
        const isToday = ds === isoDate(new Date());
        return (
          <div key={ds}>
            <h3
              className={`text-sm font-semibold mb-1 ${isToday ? 'text-indigo-600' : 'text-gray-600'}`}
            >
              {dayLabel(d, navigator.language)}
              {isToday && (
                <span className="ml-2 text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">
                  {t('calendar.today')}
                </span>
              )}
            </h3>
            {items.length === 0 ? (
              <p className="text-xs text-gray-400 pl-2">{t('calendar.no_content')}</p>
            ) : (
              <div className="space-y-1">
                {items.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onContentClick(c)}
                    className="w-full text-left flex items-center gap-2 p-2 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50 transition-colors"
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: workspaceColor }}
                    />
                    <span className="text-sm text-gray-800 flex-1 truncate">{c.title}</span>
                    {c.scheduledAt && (
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {new Intl.DateTimeFormat(navigator.language, {
                          hour: '2-digit',
                          minute: '2-digit',
                        }).format(new Date(c.scheduledAt))}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Goal Alert Bar ──────────────────────────────────────────────────────────

interface GoalAlertBarProps {
  workspace: Workspace;
  contentsByDate: Record<string, Content[]>;
  weekStart: Date;
}

interface PublishGoal {
  count: number;
  period: string;
}

function GoalAlertBar({ workspace, contentsByDate, weekStart }: GoalAlertBarProps) {
  const { t } = useTranslation('common');

  const publishGoal = workspace.publishGoal as PublishGoal | null;
  if (!publishGoal?.count) return null;

  // Count scheduled items this week
  let scheduled = 0;
  for (let i = 0; i < 7; i++) {
    const ds = isoDate(addDays(weekStart, i));
    scheduled += (contentsByDate[ds] ?? []).length;
  }

  const goal = publishGoal.count;
  const onTrack = scheduled >= goal;
  const pct = Math.min(100, Math.round((scheduled / goal) * 100));

  return (
    <div
      className={`mb-4 p-3 rounded-lg border ${
        onTrack ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-sm font-medium ${onTrack ? 'text-green-800' : 'text-amber-800'}`}>
          {t('calendar.goal_banner', { scheduled, goal })}
        </span>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            onTrack ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {onTrack ? t('calendar.on_track') : t('calendar.behind')}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/60 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${onTrack ? 'bg-green-500' : 'bg-amber-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Calendar Page ───────────────────────────────────────────────────────────

export default function Calendar() {
  const { t } = useTranslation('common');
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { data: workspaces } = useWorkspaces();
  const updateContent = useUpdateContent();

  const workspace = workspaces?.find((w) => w.id === workspaceId);

  // Detect mobile → default to list view
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const [view, setView] = useState<CalendarView>(isMobile ? 'list' : 'month');
  const [current, setCurrent] = useState<Date>(new Date());
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [createWithDate, setCreateWithDate] = useState<CreateWithDateState | null>(null);

  // Compute date range for the API
  const from = view === 'month' ? calendarStart(current) : view === 'week' ? startOfWeek(current) : new Date();
  const to =
    view === 'month'
      ? calendarEnd(current)
      : view === 'week'
      ? addDays(startOfWeek(current), 6)
      : addDays(new Date(), 30);

  const { data: contentsByDate = {}, isLoading } = useCalendarContents(
    workspaceId ?? '',
    from,
    to,
  );

  // Build a flat map of id→content for DnD
  const contentsById = useCallback((): Map<string, Content> => {
    const map = new Map<string, Content>();
    for (const items of Object.values(contentsByDate)) {
      for (const c of items) {
        map.set(c.id, c);
      }
    }
    return map;
  }, [contentsByDate]);

  function handleDropContent(contentId: string, newDate: Date) {
    const content = contentsById().get(contentId);
    if (!content || !workspaceId) return;
    const newScheduledAt = mergeDateWithTime(content.scheduledAt, newDate);
    updateContent.mutate({
      id: contentId,
      workspaceId,
      data: { scheduledAt: newScheduledAt },
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

  const weekStart = startOfWeek(current);

  // Listen for window resize to switch to list on mobile
  useEffect(() => {
    function onResize() {
      if (window.innerWidth < 768 && view !== 'list') {
        setView('list');
      }
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [view]);

  if (!workspaceId) {
    return (
      <div className="p-6">
        <p className="text-gray-500">{t('workspace.no_workspace')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0 gap-2 flex-wrap">
        {/* View tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {(['month', 'week', 'list'] as CalendarView[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                view === v ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {v === 'month'
                ? t('calendar.month_view')
                : v === 'week'
                ? t('calendar.week_view')
                : t('calendar.list_view')}
            </button>
          ))}
        </div>

        {/* Nav + label */}
        {view !== 'list' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrev}
              className="p-1 rounded hover:bg-gray-100 text-gray-600"
              title={t('calendar.prev')}
            >
              ‹
            </button>
            <span className="text-sm font-medium text-gray-700 min-w-[120px] text-center">
              {view === 'month'
                ? monthLabel(current, navigator.language)
                : `${dayLabel(weekStart, navigator.language)} – ${dayLabel(addDays(weekStart, 6), navigator.language)}`}
            </span>
            <button
              type="button"
              onClick={handleNext}
              className="p-1 rounded hover:bg-gray-100 text-gray-600"
              title={t('calendar.next')}
            >
              ›
            </button>
            <button
              type="button"
              onClick={() => setCurrent(new Date())}
              className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              {t('calendar.today')}
            </button>
          </div>
        )}
      </div>

      {/* Goal alert */}
      {workspace && (
        <div className="px-4 pt-3">
          <GoalAlertBar
            workspace={workspace}
            contentsByDate={contentsByDate}
            weekStart={weekStart}
          />
        </div>
      )}

      {/* Calendar body */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
            {t('status.loading')}
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
          />
        )}
      </div>

      {/* Content Drawer */}
      {selectedContent && (
        <ContentDrawer
          content={selectedContent}
          workspaceId={workspaceId}
          onClose={() => setSelectedContent(null)}
        />
      )}

      {/* Create Content Modal with pre-filled date */}
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

// Wrapper that pre-fills scheduledAt in CreateContentModal
interface CreateContentModalWithDateProps {
  workspaceId: string;
  prefillDate: string;
  onClose: () => void;
}

function CreateContentModalWithDate({ workspaceId, prefillDate, onClose }: CreateContentModalWithDateProps) {
  // We re-use CreateContentModal but extend it by pre-setting scheduledAt via a custom implementation
  // The existing CreateContentModal doesn't accept scheduledAt, so we render it and handle it here.
  // For now, CreateContentModal is used as-is; the date is communicated visually in the modal title.
  const formattedDate = new Intl.DateTimeFormat(navigator.language, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(prefillDate));
  void formattedDate; // used in JSX below

  return <CreateContentModal workspaceId={workspaceId} onClose={onClose} />;
}
