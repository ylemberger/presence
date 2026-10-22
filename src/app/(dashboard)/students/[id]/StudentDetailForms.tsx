"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ActionSubmitButton } from "@/components/ui/ActionSubmitButton";
import { Combobox } from "@/components/ui/Combobox";
import { HebrewDateInput } from "@/components/ui/HebrewDateInput";
import { transferStudentAction } from "../../actions";
import { todayIso } from "@/lib/dates/hebrew";
import type {
  AcademicYear,
  Grade,
  Class,
  Track,
  Specialization,
} from "@/types/database";

interface YearData {
  year: AcademicYear;
  grades: Grade[];
  classes: Class[];
  tracks: Track[];
  specializations: Specialization[];
}

export type CurrentPlacement = {
  grade_id: string;
  class_id: string;
  track_id: string;
  specialization_id: string | null;
  secondary_specialization_id: string | null;
  is_psychology: boolean;
};

interface Props {
  studentId: string;
  yearData: YearData;
  current?: CurrentPlacement | null;
}

import { useAccess } from "@/components/auth/AccessProvider";

export function StudentDetailForms({ studentId, yearData, current }: Props) {
  const { canWrite } = useAccess();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [gradeId, setGradeId] = useState(current?.grade_id ?? "");
  const [classId, setClassId] = useState(current?.class_id ?? "");
  const [trackId, setTrackId] = useState(current?.track_id ?? "");
  const [specId, setSpecId] = useState(current?.specialization_id ?? "");
  const [secondarySpecId, setSecondarySpecId] = useState(
    current?.secondary_specialization_id ?? ""
  );
  const [psychology, setPsychology] = useState(Boolean(current?.is_psychology));

  useEffect(() => {
    setGradeId(current?.grade_id ?? "");
    setClassId(current?.class_id ?? "");
    setTrackId(current?.track_id ?? "");
    setSpecId(current?.specialization_id ?? "");
    setSecondarySpecId(current?.secondary_specialization_id ?? "");
    setPsychology(Boolean(current?.is_psychology));
  }, [
    current?.grade_id,
    current?.class_id,
    current?.track_id,
    current?.specialization_id,
    current?.secondary_specialization_id,
    current?.is_psychology,
  ]);

  const gradeNameById = useMemo(
    () => new Map(yearData.grades.map((g) => [g.id, g.name])),
    [yearData.grades]
  );

  const classOptions = useMemo(() => {
    const list = gradeId
      ? yearData.classes.filter((c) => c.grade_id === gradeId)
      : yearData.classes;
    return [...list]
      .sort((a, b) => a.name.localeCompare(b.name, "he"))
      .map((c) => ({
        value: c.id,
        label: gradeId
          ? c.name
          : `${gradeNameById.get(c.grade_id) ?? "?"} · ${c.name}`,
      }));
  }, [yearData.classes, gradeId, gradeNameById]);

  async function handleTransfer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    setSaved(false);
    if (!gradeId || !classId || !trackId || !specId) {
      setError("יש לבחור שכבה, כיתה, מסלול והתמחות");
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData(form);
      fd.set("student_id", studentId);
      fd.set("academic_year_id", yearData.year.id);
      fd.set("grade_id", gradeId);
      fd.set("track_id", trackId);
      fd.set("class_id", classId);
      fd.set("specialization_id", specId);
      fd.set("secondary_specialization_id", secondarySpecId);
      if (psychology) fd.set("is_psychology", "on");
      else fd.delete("is_psychology");
      const result = await transferStudentAction(fd);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(/[\u0590-\u05FF]/.test(message) ? message : "ההעברה נכשלה");
    } finally {
      setLoading(false);
    }
  }

  if (!canWrite) return null;

  return (
    <div>
      <p className="mb-3 font-caption text-caption text-on-surface-variant">
        שינוי כיתה/מסלול/התמחות/פסיכולוגיה נעשה רק בהעברה. חובה לבחור מאיזה תאריך השיבוץ
        החדש בתוקף — השיבוץ הנוכחי נסגר יום לפני ונשמר בהיסטוריה.
      </p>
      <form onSubmit={handleTransfer} className="flex flex-col gap-3">
        <HebrewDateInput
          label="מאיזה תאריך ישתנה השיבוץ"
          name="transfer_date"
          defaultValue={todayIso()}
          required
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Combobox
            label="שכבה"
            name="grade_id"
            required
            value={gradeId}
            onChange={(v) => {
              setSaved(false);
              setGradeId(v);
              setClassId("");
            }}
            options={yearData.grades.map((g) => ({ value: g.id, label: g.name }))}
            emptyLabel="בחרי"
          />
          <Combobox
            label="כיתה"
            name="class_id"
            required
            value={classId}
            onChange={(v) => {
              setSaved(false);
              setClassId(v);
              const selected = yearData.classes.find((c) => c.id === v);
              if (selected && selected.grade_id !== gradeId) {
                setGradeId(selected.grade_id);
              }
            }}
            options={classOptions}
            emptyLabel={classOptions.length ? "בחרי" : "אין כיתות בהגדרות"}
          />
          <Combobox
            label="מסלול"
            name="track_id"
            required
            value={trackId}
            onChange={(v) => {
              setSaved(false);
              setTrackId(v);
            }}
            options={yearData.tracks.map((t) => ({ value: t.id, label: t.name }))}
            emptyLabel="בחרי"
          />
          <Combobox
            label="התמחות"
            name="specialization_id"
            required
            value={specId}
            onChange={(v) => {
              setSaved(false);
              setSpecId(v);
            }}
            options={yearData.specializations.map((s) => ({ value: s.id, label: s.name }))}
            emptyLabel={yearData.specializations.length ? "בחרי" : "אין התמחויות בהגדרות"}
          />
          <Combobox
            label="התמחות נוספת"
            name="secondary_specialization_id"
            value={secondarySpecId}
            onChange={(v) => {
              setSaved(false);
              setSecondarySpecId(v);
            }}
            options={yearData.specializations.map((s) => ({ value: s.id, label: s.name }))}
            emptyLabel="ללא"
          />
        </div>
        <label className="flex items-center gap-2 font-label-md text-label-md text-on-surface">
          <input
            type="checkbox"
            name="is_psychology"
            checked={psychology}
            onChange={(e) => {
              setSaved(false);
              setPsychology(e.target.checked);
            }}
            className="rounded border-outline-variant"
          />
          פסיכולוגיה
        </label>
        <ActionSubmitButton
          className="mt-2 w-full"
          loading={loading}
          saved={saved}
          idleLabel="בצע העברה"
          loadingLabel="מבצעת…"
          savedLabel="נשמר"
          idleIcon="move_up"
        />
      </form>
      {error && (
        <p className="mt-3 rounded-lg bg-error-container/60 px-3 py-2 font-body-sm text-body-sm text-on-error-container">
          {error}
        </p>
      )}
    </div>
  );
}
