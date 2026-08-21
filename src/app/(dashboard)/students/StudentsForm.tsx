"use client";

import { useMemo, useState } from "react";
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
  const [classId, setClassId] = useState("");

  const gradeNameById = useMemo(
    () => new Map(grades.map((g) => [g.id, g.name])),
    [grades]
  );

  const classOptions = useMemo(() => {
    const list = gradeId ? classes.filter((c) => c.grade_id === gradeId) : classes;
    return [...list]
      .sort((a, b) => a.name.localeCompare(b.name, "he"))
      .map((c) => ({
        value: c.id,
        label: gradeId
          ? c.name
          : `${gradeNameById.get(c.grade_id) ?? "?"} · ${c.name}`,
      }));
  }, [classes, gradeId, gradeNameById]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData(form);
      fd.set("academic_year_id", yearId);
      if (gradeId) fd.set("grade_id", gradeId);
      if (classId) fd.set("class_id", classId);
      const result = await createStudentAction(fd);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      form.reset();
      setGradeId("");
      setClassId("");
      router.refresh();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שמירה נכשלה");
    } finally {
      setLoading(false);
    }
  }

  const missingStructure =
    grades.length === 0 || classes.length === 0 || tracks.length === 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">פרטי תלמידה</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="שם מלא" name="full_name" required autoFocus />
          <Input label='תעודת זהות' name="identity_number" required inputMode="numeric" />
          <Input
            label="מחזור"
            name="cohort_number"
            type="number"
            min={1}
            required
            placeholder="למשל 3"
          />
        </div>
      </section>

      <section className="space-y-3 border-t border-stone-100 pt-5">
        <h3 className="text-sm font-semibold text-slate-800">שיבוץ ראשוני (חובה)</h3>
        <p className="text-xs text-slate-500">
          הרשימות מגיעות מהגדרות השנה (שכבות / כיתות / מסלולים). שינוי באמצע השנה — בהעברה.
        </p>

        {missingStructure && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            חסרות הגדרות בשנה הפעילה. בהגדרות יש להוסיף לפחות שכבה, כיתה ומסלול לפני שיבוץ תלמידה.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="שכבה"
            name="grade_id"
            required
            value={gradeId}
            onChange={(e) => {
              setGradeId(e.target.value);
              setClassId("");
            }}
            options={[
              { value: "", label: grades.length ? "בחרי שכבה" : "אין שכבות בהגדרות" },
              ...grades.map((g) => ({ value: g.id, label: g.name })),
            ]}
          />
          <Select
            label="כיתה"
            name="class_id"
            required
            value={classId}
            onChange={(e) => {
              const next = e.target.value;
              setClassId(next);
              const selected = classes.find((c) => c.id === next);
              if (selected && selected.grade_id !== gradeId) {
                setGradeId(selected.grade_id);
              }
            }}
            disabled={classOptions.length === 0}
            options={[
              {
                value: "",
                label: classOptions.length
                  ? gradeId
                    ? "בחרי כיתה"
                    : "בחרי כיתה (מכל השכבות)"
                  : gradeId
                    ? "אין כיתות לשכבה זו בהגדרות"
                    : "אין כיתות בהגדרות",
              },
              ...classOptions,
            ]}
          />
          <Select
            label="מסלול"
            name="track_id"
            required
            options={[
              { value: "", label: tracks.length ? "בחרי מסלול" : "אין מסלולים בהגדרות" },
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
          <Select
            label="התמחות נוספת"
            name="secondary_specialization_id"
            options={[
              { value: "", label: "ללא" },
              ...specializations.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
            <input type="checkbox" name="is_psychology" className="rounded border-stone-300" />
            פסיכולוגיה
          </label>
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
        <Button type="submit" disabled={loading || missingStructure}>
          {loading ? "שומר..." : "שמירת תלמידה"}
        </Button>
      </div>
    </form>
  );
}
