"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { HebrewDateInput } from "@/components/ui/HebrewDateInput";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { RANGE_TYPE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/dates/hebrew";
import type { Grade } from "@/types/database";

type UpdateAction = (
  id: string,
  formData: FormData
) => Promise<{ error?: string; success?: boolean }>;

interface EditableNameRowProps {
  id: string;
  name: string;
  extraLabel?: string;
  updateAction: UpdateAction;
  deleteAction: (id: string) => Promise<{ error?: string }>;
  fields?: React.ReactNode;
  onBuildFormData?: (fd: FormData) => void;
}

export function EditableNameRow({
  id,
  name,
  extraLabel,
  updateAction,
  deleteAction,
  fields,
  onBuildFormData,
}: EditableNameRowProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    onBuildFormData?.(fd);
    const result = await updateAction(id, fd);
    if (result.error) setError(result.error);
    else {
      setEditing(false);
      router.refresh();
    }
  }

  if (!editing) {
    return (
      <tr className="hover:bg-stone-50/80">
        <td className="px-4 py-3 text-right font-medium">{name}</td>
        {extraLabel !== undefined && (
          <td className="px-4 py-3 text-right">{extraLabel}</td>
        )}
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-2">
            <Button size="sm" variant="secondary" type="button" onClick={() => setEditing(true)}>
              עריכה
            </Button>
            <DeleteButton onDelete={() => deleteAction(id)} />
          </div>
          {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
        </td>
      </tr>
    );
  }

  return (
    <tr className="bg-stone-50/80">
      <td colSpan={extraLabel !== undefined ? 3 : 2} className="px-4 py-3">
        <form onSubmit={handleSave} className="flex flex-wrap items-end gap-3">
          <Input label="שם" name="name" defaultValue={name} required />
          {fields}
          <Button type="submit" size="sm">
            שמירה
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
            ביטול
          </Button>
          {error && <p className="w-full text-sm text-rose-600">{error}</p>}
        </form>
      </td>
    </tr>
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
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const result = await updateAction(id, new FormData(e.currentTarget));
    if (result.error) setError(result.error);
    else {
      setEditing(false);
      router.refresh();
    }
  }

  if (!editing) {
    return (
      <tr className="hover:bg-stone-50/80">
        <td className="px-4 py-3 text-right">{name}</td>
        <td className="px-4 py-3 text-right">
          {RANGE_TYPE_LABELS[rangeType as keyof typeof RANGE_TYPE_LABELS]}
        </td>
        <td className="px-4 py-3 text-right">{formatDate(startDate)}</td>
        <td className="px-4 py-3 text-right">{formatDate(endDate)}</td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-2">
            <Button size="sm" variant="secondary" type="button" onClick={() => setEditing(true)}>
              עריכה
            </Button>
            <DeleteButton onDelete={() => deleteAction(id)} />
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="bg-stone-50/80">
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
          <HebrewDateInput label="מתאריך" name="start_date" defaultValue={startDate} required />
          <HebrewDateInput label="עד תאריך" name="end_date" defaultValue={endDate} required />
          <Button type="submit" size="sm">
            שמירה
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
            ביטול
          </Button>
          {error && <p className="w-full text-sm text-rose-600">{error}</p>}
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
          options={grades.map((g) => ({ value: g.id, label: g.name }))}
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
      extraLabel={isActive ? "פעילה" : ""}
      updateAction={updateAction}
      deleteAction={deleteAction}
      fields={
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_active" defaultChecked={isActive} />
          שנה פעילה
        </label>
      }
    />
  );
}
