"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { Section } from "@/components/ui/Section";
import { Icon } from "@/components/ui/Icon";
import {
  deleteAttendancePoolAction,
  saveAttendancePoolAction,
} from "../actions";

export type PoolLessonOption = {
  id: string;
  label: string;
  fingerprint: string;
  poolId: string | null;
  poolName: string | null;
};

export type PoolView = {
  id: string;
  name: string;
  lessonIds: string[];
};

export function AttendancePoolsPanel({
  yearId,
  pools,
  lessons,
}: {
  yearId: string;
  pools: PoolView[];
  lessons: PoolLessonOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lessonById = useMemo(() => new Map(lessons.map((l) => [l.id, l])), [lessons]);

  const fingerprint = useMemo(() => {
    const first = selected.map((id) => lessonById.get(id)?.fingerprint).find(Boolean);
    return first ?? null;
  }, [selected, lessonById]);

  const options = useMemo(() => {
    return lessons
      .filter((l) => {
        if (selected.includes(l.id)) return true;
        if (l.poolId && l.poolId !== editingId) return false;
        if (fingerprint && l.fingerprint !== fingerprint) return false;
        return true;
      })
      .map((l) => ({ value: l.id, label: l.label }));
  }, [lessons, fingerprint, editingId, selected]);

  function openCreate() {
    setEditingId(null);
    setName("");
    setSelected([]);
    setError(null);
    setOpen(true);
  }

  function openEdit(pool: PoolView) {
    setEditingId(pool.id);
    setName(pool.name);
    setSelected(pool.lessonIds);
    setError(null);
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const result = await saveAttendancePoolAction({
      yearId,
      poolId: editingId,
      name,
      lessonIds: selected,
    });
    setSaving(false);
    if (result && "error" in result && result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  async function remove(poolId: string) {
    if (!confirm("לפרק את קיבוץ הנוכחות? סימוני הנוכחות בשיעורים נשארים.")) return;
    const result = await deleteAttendancePoolAction(poolId);
    if (result && "error" in result && result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <Section
      icon="done_all"
      title="קיבוץ נוכחות משותפת"
      subtitle="כל שיעור נשאר עם סימון משלו. כאן אפשר לצרף ידנית כמה שיעורים של אותה קבוצה לחישוב אחוז אחד."
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button type="button" onClick={openCreate}>
          <Icon name="add" className="text-[18px]" />
          קיבוץ שיעורים לאותה נוכחות
        </Button>
      </div>

      {pools.length === 0 ? (
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          אין קיבוצים. בלי קיבוץ — כל שיעור מחושב לבד, גם אם יש לו אותו שם מקצוע.
        </p>
      ) : (
        <ul className="space-y-2">
          {pools.map((pool) => (
            <li
              key={pool.id}
              className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2"
            >
              <div className="min-w-0">
                <p className="font-label-md text-label-md text-primary">{pool.name}</p>
                <p className="mt-0.5 font-caption text-caption text-on-surface-variant">
                  {pool.lessonIds
                    .map((id) => lessonById.get(id)?.label ?? "שיעור")
                    .join(" · ")}
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => openEdit(pool)}>
                  עריכה
                </Button>
                <Button type="button" size="sm" variant="danger" onClick={() => remove(pool.id)}>
                  פירוק
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={open}
        title={editingId ? "עריכת קיבוץ נוכחות" : "קיבוץ שיעורים לאותה נוכחות"}
        description="רק שיעורים של אותה קבוצה (אותן שכבות / כיתות / מסלולים / התמחויות). לא לפי שם מקצוע ולא לפי מורה."
        onClose={() => setOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              ביטול
            </Button>
            <Button type="button" disabled={saving} onClick={save}>
              {saving ? "שומר…" : "שמירה"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Input
            label="שם הקיבוץ"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="למשל: יסודות הבית — כיתה יג 1"
          />
          <MultiSelect
            label="שיעורים"
            name="lesson_ids"
            values={selected}
            onChange={setSelected}
            options={options}
            hint="בחרי שיעור ראשון — יוצגו רק שיעורים של אותה קבוצה שעדיין לא בקיבוץ אחר."
          />
          {error && (
            <p className="rounded-md bg-error-container/50 px-3 py-2 font-body-sm text-body-sm text-on-error-container">
              {error}
            </p>
          )}
        </div>
      </Modal>
    </Section>
  );
}
