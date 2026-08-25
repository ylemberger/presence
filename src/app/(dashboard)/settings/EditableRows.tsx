"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { HebrewDateRangePicker } from "@/components/ui/HebrewDateRangePicker";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { StatusPill } from "@/components/ui/PageHeader";
import { RANGE_TYPE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/dates/hebrew";
import { FIXED_GRADE_NAMES, isFixedGradeName } from "@/lib/years/grades";
import type { Grade } from "@/types/database";

type UpdateAction = (
  id: string,
  formData: FormData
) => Promise<{ error?: string; success?: boolean }>;

interface EditableNameRowProps {
  id: string;
  name: string;
  extraLabel?: string;
  extraCell?: React.ReactNode;
  updateAction: UpdateAction;
  deleteAction: (id: string) => Promise<{ error?: string }>;
  fields?: React.ReactNode;
  onBuildFormData?: (fd: FormData) => void;
  nameField?: "input" | "grade-select";
}

export function EditableNameRow({
  id,
  name,
  extraLabel,
  extraCell,
  updateAction,
  deleteAction,
  fields,
  onBuildFormData,
  nameField = "input",
}: EditableNameRowProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    setSaving(true);
    try {
      const fd = new FormData(form);
      onBuildFormData?.(fd);
      const result = await updateAction(id, fd);
      if (result?.error) {
        setError(result.error);
        return;
      }
      await router.refresh();
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שמירה נכשלה");
    } finally {
      setSaving(false);
    }
  }

  const hasExtraColumn = extraLabel !== undefined || extraCell !== undefined;

  if (!editing) {
    return (
      <tr className="transition-colors hover:bg-surface-container-low/60">
        <td className="px-4 py-3 text-right font-semibold text-primary">{name}</td>
        {hasExtraColumn && (
          <td className="px-4 py-3 text-right text-on-surface-variant">
            {extraCell ?? extraLabel}
          </td>
        )}
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="secondary"
              type="button"
              onClick={() => setEditing(true)}
            >
              עריכה
            </Button>
            <DeleteButton onDelete={() => deleteAction(id)} />
          </div>
          {error && (
            <p className="mt-1 text-caption text-error">{error}</p>
          )}
        </td>
      </tr>
    );
  }

  return (
    <tr className="bg-surface-container-low/60">
      <td colSpan={hasExtraColumn ? 3 : 2} className="px-4 py-3">
        <form onSubmit={handleSave} className="flex flex-wrap items-end gap-3">
          {nameField === "grade-select" ? (
            <Select
              label="שכבה"
              name="name"
              defaultValue={isFixedGradeName(name) ? name : ""}
              required
              options={[
                { value: "", label: "בחרי א / ב / ג" },
                ...FIXED_GRADE_NAMES.map((n) => ({ value: n, label: n })),
              ]}
            />
          ) : (
            <Input label="שם" name="name" defaultValue={name} required />
          )}
          {fields}
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "שומר..." : "שמירה"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setEditing(false)}
            disabled={saving}
          >
            ביטול
          </Button>
          {error && (
            <p className="w-full rounded-lg bg-error-container/60 px-3 py-2 text-body-sm text-on-error-container">
              {error}
            </p>
          )}
        </form>
      </td>
    </tr>
  );
}

export function EditableGradeRow({
  id,
  name,
  updateAction,
  deleteAction,
}: {
  id: string;
  name: string;
  updateAction: UpdateAction;
  deleteAction: (id: string) => Promise<{ error?: string }>;
}) {
  const valid = isFixedGradeName(name);

  if (!valid) {
    return (
      <tr className="bg-attendance-late/10">
        <td className="px-4 py-3 text-right">
          <span className="font-semibold text-attendance-late">{name}</span>
          <StatusPill tone="warn">לא תקין (רק א / ב / ג)</StatusPill>
        </td>
        <td className="px-4 py-3 text-right">
          <DeleteButton onDelete={() => deleteAction(id)} label="מחק שכבה זו" />
        </td>
      </tr>
    );
  }

  return (
    <EditableNameRow
      id={id}
      name={name}
      updateAction={updateAction}
      deleteAction={deleteAction}
      nameField="grade-select"
    />
  );
}

export function EditableActivityRangeRow({
  id,
  name,
  rangeType,
  startDate,
  endDate,
  updateAction,
  deleteAction,
}: {
  id: string;
  name: string;
  rangeType: string;
  startDate: string;
  endDate: string;
  updateAction: UpdateAction;
  deleteAction: (id: string) => Promise<{ error?: string }>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    setSaving(true);
    try {
      const result = await updateAction(id, new FormData(form));
      if (result?.error) {
        setError(result.error);
        return;
      }
      await router.refresh();
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שמירה נכשלה");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <tr className="transition-colors hover:bg-surface-container-low/60">
        <td className="px-4 py-3 text-right font-semibold text-primary">{name}</td>
        <td className="px-4 py-3 text-right text-on-surface-variant">
          {RANGE_TYPE_LABELS[rangeType as keyof typeof RANGE_TYPE_LABELS]}
        </td>
        <td className="px-4 py-3 text-right text-on-surface-variant">
          {formatDate(startDate)}
        </td>
        <td className="px-4 py-3 text-right text-on-surface-variant">
          {formatDate(endDate)}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="secondary"
              type="button"
              onClick={() => setEditing(true)}
            >
              עריכה
            </Button>
            <DeleteButton onDelete={() => deleteAction(id)} />
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="bg-surface-container-low/60">
      <td colSpan={5} className="px-4 py-3">
        <form onSubmit={handleSave} className="flex flex-wrap items-end gap-3">
          <Input label="שם" name="name" defaultValue={name} required />
          <Select
            label="סוג"
            name="range_type"
            defaultValue={rangeType}
            required
            options={Object.entries(RANGE_TYPE_LABELS).map(([v, l]) => ({
              value: v,
              label: l,
            }))}
          />
          <HebrewDateRangePicker
            startName="start_date"
            endName="end_date"
            defaultStart={startDate}
            defaultEnd={endDate}
            required
            className="basis-full"
          />
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "שומר..." : "שמירה"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setEditing(false)}
            disabled={saving}
          >
            ביטול
          </Button>
          {error && (
            <p className="w-full rounded-lg bg-error-container/60 px-3 py-2 text-body-sm text-on-error-container">
              {error}
            </p>
          )}
        </form>
      </td>
    </tr>
  );
}

export function EditableAttendanceRuleRow({
  id,
  name,
  maxPercent,
  updateAction,
  deleteAction,
}: {
  id: string;
  name: string;
  maxPercent: number;
  updateAction: UpdateAction;
  deleteAction: (id: string) => Promise<{ error?: string }>;
}) {
  return (
    <EditableNameRow
      id={id}
      name={name}
      extraLabel={`${maxPercent}%`}
      updateAction={updateAction}
      deleteAction={deleteAction}
      fields={
        <Input
          label="אחוז מקסימלי"
          name="max_allowed_absence_percent"
          type="number"
          step="0.01"
          defaultValue={String(maxPercent)}
          required
        />
      }
    />
  );
}

export function EditableClassRow({
  id,
  name,
  gradeId,
  gradeName,
  grades,
  updateAction,
  deleteAction,
}: {
  id: string;
  name: string;
  gradeId: string;
  gradeName: string;
  grades: Grade[];
  updateAction: UpdateAction;
  deleteAction: (id: string) => Promise<{ error?: string }>;
}) {
  return (
    <EditableNameRow
      id={id}
      name={name}
      extraLabel={gradeName}
      updateAction={updateAction}
      deleteAction={deleteAction}
      fields={
        <Select
          label="שכבה"
          name="grade_id"
          defaultValue={gradeId}
          required
          options={[
            { value: "", label: "בחרי א / ב / ג" },
            ...grades.map((g) => ({ value: g.id, label: g.name })),
          ]}
        />
      }
    />
  );
}

export function EditableYearRow({
  id,
  name,
  isActive,
  updateAction,
  deleteAction,
}: {
  id: string;
  name: string;
  isActive: boolean;
  updateAction: UpdateAction;
  deleteAction: (id: string) => Promise<{ error?: string }>;
}) {
  return (
    <EditableNameRow
      id={id}
      name={name}
      extraCell={
        isActive ? (
          <StatusPill tone="ok">פעילה</StatusPill>
        ) : (
          <StatusPill tone="muted">ארכיון</StatusPill>
        )
      }
      updateAction={updateAction}
      deleteAction={deleteAction}
      fields={
        <label className="flex items-center gap-2 font-label-md text-label-md text-on-surface">
          <input type="checkbox" name="is_active" defaultChecked={isActive} />
          שנה פעילה
        </label>
      }
    />
  );
}
