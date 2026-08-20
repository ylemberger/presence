"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { HebrewDateInput } from "@/components/ui/HebrewDateInput";
import { createStudentAction } from "../actions";
import type { Grade, Class, Track, Specialization } from "@/types/database";

interface StudentsFormProps {
  yearId: string;
  grades: Grade[];
  classes: Class[];
  tracks: Track[];
  specializations: Specialization[];
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function StudentsForm({
  yearId,
  grades,
  classes,
  tracks,
  specializations,
  onSuccess,
  onCancel,
}: StudentsFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [gradeId, setGradeId] = useState("");

  const filteredClasses = classes.filter((c) => !gradeId || c.grade_id === gradeId);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData(form);
      fd.set("academic_year_id", yearId);
      const result = await createStudentAction(fd);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      form.reset();
      setGradeId("");
      router.refresh();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שמירה נכשלה");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">פרטי תלמידה</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="שם מלא" name="full_name" required autoFocus />
          <Input label='תעודת זהות' name="identity_number" required inputMode="numeric" />
        </div>
      </section>

      <section className="space-y-3 border-t border-stone-100 pt-5">
        <h3 className="text-sm font-semibold text-slate-800">שיבוץ ראשוני (חובה)</h3>
        <p className="text-xs text-slate-500">
          חייבים למלא שכבה, כיתה, מסלול ותאריך תחילה. בלי זה לא ניתן ליצור תלמידה.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="שכבה"
            name="grade_id"
            required
            value={gradeId}
            onChange={(e) => setGradeId(e.target.value)}
            options={[
              { value: "", label: "בחרי שכבה" },
              ...grades.map((g) => ({ value: g.id, label: g.name })),
            ]}
          />
          <Select
            label="כיתה"
            name="class_id"
            required
            options={[
              { value: "", label: "בחרי כיתה" },
              ...filteredClasses.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          <Select
            label="מסלול"
            name="track_id"
            required
            options={[
              { value: "", label: "בחרי מסלול" },
              ...tracks.map((t) => ({ value: t.id, label: t.name })),
            ]}
          />
          <Select
            label="התמחות"
            name="specialization_id"
            options={[
              { value: "", label: "ללא התמחות" },
              ...specializations.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
          <div className="sm:col-span-2">
            <HebrewDateInput label="בתוקף מתאריך" name="start_date" required />
          </div>
        </div>
      </section>

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-stone-100 pt-4">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
            ביטול
          </Button>
        )}
        <Button type="submit" disabled={loading}>
          {loading ? "שומר..." : "שמירת תלמידה"}
        </Button>
      </div>
    </form>
  );
}
