import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ContentPlan, OutlineItem } from '@contentflow/shared';

interface OutlineSectionProps {
  plan: Partial<ContentPlan>;
  onChange: (patch: Partial<ContentPlan>) => void;
}

export function OutlineSection({ plan, onChange }: OutlineSectionProps) {
  const { t } = useTranslation('contents');
  const outline = plan.outline ?? [];

  const dragIndexRef = useRef<number | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set());

  function updateOutline(next: OutlineItem[]) {
    onChange({ outline: next.map((item, i) => ({ ...item, order: i + 1 })) });
  }

  function addSection() {
    updateOutline([...outline, { order: outline.length + 1, section: '', timeMark: '', note: '' }]);
  }

  function removeSection(index: number) {
    updateOutline(outline.filter((_, i) => i !== index));
    setExpandedNotes((prev) => {
      const next = new Set<number>();
      prev.forEach((n) => { if (n !== index) next.add(n > index ? n - 1 : n); });
      return next;
    });
  }

  function patchItem(index: number, patch: Partial<OutlineItem>) {
    updateOutline(outline.map((item, i) => i === index ? { ...item, ...patch } : item));
  }

  function toggleNote(index: number) {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  }

  // Drag-and-drop handlers (HTML5 DnD)
  function handleDragStart(index: number) {
    dragIndexRef.current = index;
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    const from = dragIndexRef.current;
    if (from === null || from === index) return;
    const next = [...outline];
    const [item] = next.splice(from, 1);
    next.splice(index, 0, item!);
    dragIndexRef.current = index;
    updateOutline(next);
  }

  function handleDragEnd() {
    dragIndexRef.current = null;
  }

  return (
    <div className="space-y-2">
      {outline.map((item, index) => (
        <div
          key={index}
          draggable
          onDragStart={() => handleDragStart(index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragEnd={handleDragEnd}
          className="border border-gray-200 rounded bg-white"
        >
          <div className="flex items-center gap-2 p-2">
            {/* Drag handle + order */}
            <span className="cursor-grab text-gray-300 text-sm select-none" title={t('brief.outline.drag_to_reorder')}>
              ⠿
            </span>
            <span className="text-xs font-mono text-gray-400 flex-shrink-0 w-5 text-center">
              {item.order}
            </span>

            {/* Section text */}
            <input
              type="text"
              value={item.section}
              onChange={(e) => patchItem(index, { section: e.target.value })}
              placeholder={t('brief.outline.section_placeholder')}
              className="flex-1 text-sm border-0 bg-transparent outline-none focus:ring-0 p-0"
            />

            {/* Time mark */}
            <input
              type="text"
              value={item.timeMark ?? ''}
              onChange={(e) => patchItem(index, { timeMark: e.target.value })}
              placeholder="0-3s"
              className="w-16 text-xs border border-gray-200 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-indigo-200 text-center"
            />

            {/* Note toggle */}
            <button
              onClick={() => toggleNote(index)}
              className={`text-xs px-1.5 py-0.5 rounded border ${
                expandedNotes.has(index)
                  ? 'border-indigo-300 text-indigo-600 bg-indigo-50'
                  : 'border-gray-200 text-gray-400 hover:border-gray-300'
              }`}
              title={t('brief.outline.toggle_note')}
            >
              ✎
            </button>

            {/* Delete */}
            <button
              onClick={() => removeSection(index)}
              className="text-gray-300 hover:text-red-400 text-sm"
              title={t('brief.outline.remove_section')}
            >
              ✕
            </button>
          </div>

          {/* Expandable note */}
          {expandedNotes.has(index) && (
            <div className="px-3 pb-2">
              <textarea
                value={item.note ?? ''}
                onChange={(e) => patchItem(index, { note: e.target.value })}
                rows={2}
                placeholder={t('brief.outline.note_placeholder')}
                className="w-full text-xs border border-gray-100 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-200 resize-none bg-gray-50"
              />
            </div>
          )}
        </div>
      ))}

      <button
        onClick={addSection}
        className="text-xs text-indigo-600 border border-dashed border-indigo-300 rounded px-3 py-1.5 hover:bg-indigo-50 w-full"
      >
        + {t('brief.outline.add_section')}
      </button>
    </div>
  );
}
