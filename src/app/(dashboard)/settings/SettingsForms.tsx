"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { HebrewDateInput } from "@/components/ui/HebrewDateInput";
import { RANGE_TYPE_LABELS } from "@/lib/constants";
import type { Grade } from "@/types/database";

interface SettingsFormsProps {
  type: string;
  yearId?: string;
  grades?: Grade[];
  createAction: (formData: FormData) => Promise<{ error?: string; success?: boolean }>;
}

export function SettingsForms({ type, yearId, grades, createAction }: SettingsFormsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData(form);
      if (yearId) formData.set("academic_year_id", yearId);
      const result = await createAction(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        form.reset();
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "שמירה נכשלה");
    } finally {
      setLoading(false);
    }
  }

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

      {(type === "grade" || type === "track" || type === "specialization" || type === "teaching_type") && (
        <Input
          label={
            type === "grade"
              ? "שם שכבה (א/ב/ג)"
              : type === "track"
                ? "שם מסלול"
                : type === "teaching_type"
                  ? "סוג הוראה"
                  : "שם התמחות"
          }
          name="name"
          required
          placeholder={type === "grade" ? "א" : undefined}
        />
      )}

      {type === "class" && (
        <>
          <Input label="שם כיתה" name="name" required />
          <Select
            label="שכבה"
            name="grade_id"
            required
            options={[
              { value: "", label: "בחרי שכבה" },
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

      <Button type="submit" disabled={loading}>
        {loading ? "שומר..." : "הוספה"}
      </Button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
