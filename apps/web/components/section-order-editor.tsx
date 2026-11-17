"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { setPrefs } from "@/lib/prefs-client";
import { applyReorder, arrangeSections, depthInfo, SECTION_IDS, type DepthId, type SectionId } from "@/lib/reading-prefs";
import { CheckIcon, CloseIcon, GripIcon, LockIcon, ResetIcon } from "./icons";

interface EditorSection {
  id: SectionId;
  title: string;
}

/**
 * Drag (or use the keyboard) to reorder sections. Sections in the reader's depth and those beyond it
 * are separate groups, so a section outside the depth can never be placed above one inside it.
 * Nothing changes until Save.
 */
export function SectionOrderEditor({
  sections,
  depth,
  order,
  idPrefix,
  onDone,
}: {
  sections: EditorSection[];
  depth: DepthId;
  order: SectionId[];
  /** Keeps dnd-kit's generated ids stable and unique per editor instance. */
  idPrefix: string;
  /** Called after Save or Cancel. */
  onDone?: () => void;
}) {
  const ids = sections.map((s) => s.id);
  const initial = arrangeSections(ids, order, depth);
  const [base, setBase] = useState<SectionId[]>(order);
  const [inGroup, setInGroup] = useState(initial.inDepth);
  const [outGroup, setOutGroup] = useState(initial.beyond);
  const titles = new Map(sections.map((s) => [s.id, s.title]));
  const changed =
    base.join() !== order.join() || inGroup.join() !== initial.inDepth.join() || outGroup.join() !== initial.beyond.join();

  const save = () => {
    setPrefs((p) => ({ ...p, order: applyReorder(applyReorder(base, inGroup), outGroup) }), { keepPlace: true });
    onDone?.();
  };
  const cancel = () => {
    setBase(order);
    setInGroup(initial.inDepth);
    setOutGroup(initial.beyond);
    onDone?.();
  };
  const reset = () => {
    const d = arrangeSections(ids, SECTION_IDS, depth);
    setBase([...SECTION_IDS]);
    setInGroup(d.inDepth);
    setOutGroup(d.beyond);
  };

  return (
    <div className="editor">
      <p className="text-xs leading-relaxed text-ink-3">
        Drag <GripIcon className="inline h-3.5 w-3.5 align-[-2px]" /> to reorder, or focus a handle and use the arrow keys. Your order is
        saved on this device and used in every Part.
      </p>
      <SortableGroup id={`${idPrefix}-in`} ids={inGroup} onChange={setInGroup} titles={titles} />
      {outGroup.length > 0 && (
        <>
          <p className="editor-locked">
            <LockIcon className="h-3.5 w-3.5 shrink-0" />
            <span>Beyond {depthInfo(depth).label}: these stay below the sections above.</span>
          </p>
          <SortableGroup id={`${idPrefix}-out`} ids={outGroup} onChange={setOutGroup} titles={titles} locked />
        </>
      )}
      <div className="editor-actions">
        <button type="button" onClick={reset} className="editor-btn">
          <ResetIcon className="h-4 w-4" /> Default
        </button>
        <span className="flex-1" />
        <button type="button" onClick={cancel} className="editor-btn" aria-label="Cancel and keep the current order">
          <CloseIcon className="h-4 w-4" />
          <span className="sr-only sm:not-sr-only">Cancel</span>
        </button>
        <button type="button" onClick={save} className="editor-btn editor-save" disabled={!changed} aria-label="Save this order">
          <CheckIcon className="h-4 w-4" /> Save
        </button>
      </div>
    </div>
  );
}

function SortableGroup({
  id,
  ids,
  onChange,
  titles,
  locked = false,
}: {
  id: string;
  ids: SectionId[];
  onChange: (ids: SectionId[]) => void;
  titles: Map<SectionId, string>;
  locked?: boolean;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const name = (x: UniqueIdentifier | undefined) => titles.get(x as SectionId) ?? String(x);
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${name(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${name(active.id)} is now at the position of ${name(over.id)}.` : `${name(active.id)} is outside the list.`),
    onDragEnd: ({ active, over }) => (over ? `${name(active.id)} was placed at the position of ${name(over.id)}.` : `${name(active.id)} was put back.`),
    onDragCancel: ({ active }) => `Moving ${name(active.id)} was cancelled.`,
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onChange(arrayMove(ids, ids.indexOf(active.id as SectionId), ids.indexOf(over.id as SectionId)));
  };

  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: "To move a section, press space or enter, move it with the arrow keys, then press space or enter to drop it. Escape cancels.",
        },
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="editor-list" data-locked={locked ? "" : undefined}>
          {ids.map((sid) => (
            <SortableRow key={sid} id={sid} title={name(sid)} locked={locked} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, title, locked }: { id: SectionId; title: string; locked: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className="editor-row"
      data-dragging={isDragging ? "" : undefined}
    >
      <button ref={setActivatorNodeRef} type="button" className="editor-handle" {...attributes} {...listeners} aria-label={`Move ${title}`}>
        <GripIcon className="h-4 w-4" />
      </button>
      <span className="min-w-0 flex-1 truncate">{title}</span>
      {locked && <LockIcon className="h-3.5 w-3.5 shrink-0 text-ink-3" />}
    </li>
  );
}
