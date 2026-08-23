"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { HebrewDateInput } from "@/components/ui/HebrewDateInput";
import { RANGE_TYPE_LABELS } from "@/lib/constants";
import { FIXED_GRADE_NAMES } from "@/lib/years/grades";
import type { Grade } from "@/types/database";

interface SettingsFormsProps {
  type: string;
  yearId?: string;
  grades?: Grade[];
  createAction: (formData: FormData) => Promise<{ error?: string; success?: boolean }>;
}

export function SettingsForms({ type, yearId, grades, createAction }: SettingsFormsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [doneFlash, setDoneFlash] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setLoading(true);
    setError(null);
    setDoneFlash(false);
    try {
      const formData = new FormData(form);
      if (yearId) formData.set("academic_year_id", yearId);
      const result = await createAction(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        form.reset();
        setDoneFlash(true);
        setTimeout(() => setDoneFlash(false), 1500);
        startTransition(() => router.refresh());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "שמירה נכשלה");
    } finally {
      setLoading(false);
    }
  }

  const existingGradeNames = new Set((grades ?? []).map((g) => g.name));
  const missingGrades = FIXED_GRADE_NAMES.filter((n) => !existingGradeNames.has(n));

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      {type === "academic_year" && (
        <>
          <Input label="שם שנה" name="name" required placeholder='תשפ"ו' />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_active" />
            שנה פעילה
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="promote_students" defaultChecked />
            קדם תלמידות מהשנה הקודמת (מעתיק גם כיתות/מסלולים; א→ב, ב→ג, ג יוצאות)
          </label>
        </>
      )}

      {type === "grade" && (
        missingGrades.length === 0 ? (
          <p className="text-sm text-slate-500">כל השכבות א / ב / ג כבר קיימות.</p>
        ) : (
          <Select
            label="שכבה"
            name="name"
            required
            options={[
              { value: "", label: "בחרי א / ב / ג" },
              ...missingGrades.map((n) => ({ value: n, label: n })),
            ]}
          />
        )
      )}

      {(type === "track" || type === "specialization") && (
        <Input
          label={type === "track" ? "שם מסלול" : "שם התמחות"}
          name="name"
          required
        />
      )}

      {type === "class" && (
        <>
          <Input label="שם כיתה" name="name" required placeholder="למשל 1 או א1" />
          <Select
            label="שכבה"
            name="grade_id"
            required
            options={[
              { value: "", label: "בחרי א / ב / ג" },
              ...(grades?.map((g) => ({ value: g.id, label: g.name })) ?? []),
            ]}
          />
        </>
      )}

      {type === "activity_range" && (
        <>
          <Input label="שם" name="name" required />
          <Select
            label="סוג"
            name="range_type"
            required
            options={Object.entries(RANGE_TYPE_LABELS).map(([v, l]) => ({
              value: v,
              label: l,
            }))}
          />
          <HebrewDateInput label="מתאריך" name="start_date" required />
          <HebrewDateInput label="עד תאריך" name="end_date" required />
        </>
      )}

      {type === "attendance_rule" && (
        <>
          <Input label="שם" name="name" required />
          <Input
            label="אחוז היעדרות מקסימלי"
            name="max_allowed_absence_percent"
            type="number"
            step="0.01"
            required
          />
        </>
      )}

      {(type !== "grade" || missingGrades.length > 0) && (
        <Button type="submit" disabled={loading || isPending}>
          {loading ? "מוסיף..." : doneFlash ? "נוסף ✓" : "הוספה"}
        </Button>
      )}
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
