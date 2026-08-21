"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { createTeacherAction, createTeachingAssignmentAction } from "../actions";
import { BILLING_TYPE_LABELS } from "@/lib/constants";
import type { Teacher } from "@/types/database";

interface TeachersFormsProps {
  type: "teacher" | "assignment";
  teachers?: Teacher[];
  grades?: { id: string; name: string }[];
  classes?: { id: string; name: string; grade_id: string }[];
  tracks?: { id: string; name: string }[];
  specializations?: { id: string; name: string }[];
  teachingTypes?: { id: string; name: string }[];
  yearId?: string;
}

export function TeachersForms({
  type,
  teachers,
  grades,
  classes,
  tracks,
  specializations,
  teachingTypes,
  yearId,
}: TeachersFormsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [billingType, setBillingType] = useState<"mandatory" | "specialization">("mandatory");
  const [forPsychology, setForPsychology] = useState(false);
  const [gradeId, setGradeId] = useState("");
  const [classId, setClassId] = useState("");
  const [trackId, setTrackId] = useState("");

  const filteredClasses = useMemo(
    () => (classes ?? []).filter((c) => !gradeId || c.grade_id === gradeId),
    [classes, gradeId]
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    setLoading(true);
    try {
      const fd = new FormData(form);
      if (yearId) fd.set("academic_year_id", yearId);

      if (type === "assignment") {
        fd.set("billing_type", billingType);
        if (billingType === "specialization") {
          fd.set("class_id", "");
          fd.set("track_id", "");
          fd.set("for_psychology", "");
        } else if (forPsychology) {
          fd.set("for_psychology", "1");
          fd.set("class_id", "");
          fd.set("track_id", "");
          fd.set("specialization_id", "");
        } else {
          fd.set("for_psychology", "");
          fd.set("specialization_id", "");
          fd.set("class_id", classId);
          fd.set("track_id", trackId);
        }
      }

      const result =
        type === "teacher"
          ? await createTeacherAction(fd)
          : await createTeachingAssignmentAction(fd);

      if (result && "error" in result && result.error) setError(result.error);
      else {
        form.reset();
        setBillingType("mandatory");
        setForPsychology(false);
        setGradeId("");
        setClassId("");
        setTrackId("");
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
      {type === "teacher" && (
        <>
          <Input label="שם מלא" name="full_name" required />
          <Input label='ת"ז' name="identity_number" required />
          <Input label="טלפון" name="phone" required />
          <Input label="אימייל" name="email" type="email" required />
          <Select
            label="סוג הוראה"
            name="teaching_type_id"
            options={[
              { value: "", label: "ללא" },
              ...(teachingTypes?.map((t) => ({ value: t.id, label: t.name })) ?? []),
            ]}
          />
        </>
      )}

      {type === "assignment" && (
        <>
          <Select
            label="מורה"
            name="teacher_id"
            required
            options={[
              { value: "", label: "בחרי מורה" },
              ...(teachers?.map((t) => ({ value: t.id, label: t.full_name })) ?? []),
            ]}
          />
          <Input label="מקצוע" name="subject" required />
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
              { value: "", label: "בחרי שכבה" },
              ...(grades?.map((g) => ({ value: g.id, label: g.name })) ?? []),
            ]}
          />
          <Select
            label="סוג שיבוץ"
            name="billing_type_ui"
            required
            value={billingType}
            onChange={(e) => setBillingType(e.target.value as "mandatory" | "specialization")}
            options={Object.entries(BILLING_TYPE_LABELS).map(([v, l]) => ({
              value: v,
              label: l,
            }))}
          />
          {billingType === "specialization" ? (
            <Select
              label="התמחות"
              name="specialization_id"
              required
              options={[
                { value: "", label: "בחרי התמחות" },
                ...(specializations?.map((s) => ({ value: s.id, label: s.name })) ?? []),
              ]}
            />
          ) : (
            <>
              <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={forPsychology}
                  onChange={(e) => {
                    setForPsychology(e.target.checked);
                    if (e.target.checked) {
                      setClassId("");
                      setTrackId("");
                    }
                  }}
                  className="rounded border-stone-300"
                />
                מיועד לפסיכולוגיה
              </label>
              {!forPsychology && (
                <>
                  <Select
                    label="כיתה"
                    name="class_id"
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    options={[
                      { value: "", label: "ללא (כל הכיתות בשכבה)" },
                      ...filteredClasses.map((c) => ({ value: c.id, label: c.name })),
                    ]}
                  />
                  <Select
                    label="מסלול"
                    name="track_id"
                    value={trackId}
                    onChange={(e) => setTrackId(e.target.value)}
                    options={[
                      { value: "", label: "ללא (כל המסלולים)" },
                      ...(tracks?.map((t) => ({ value: t.id, label: t.name })) ?? []),
                    ]}
                  />
                </>
              )}
              <p className="w-full rounded-xl bg-stone-50 px-3 py-2 text-xs text-slate-600">
                {forPsychology
                  ? "ישויכו רק תלמידות המסומנות כפסיכולוגיה בשכבה זו."
                  : classId && trackId
                    ? "נבחרו כיתה ומסלול יחד — ישויכו רק תלמידות שנמצאות גם בכיתה וגם במסלול (חיתוך)."
                    : classId
                      ? "נבחרה כיתה בלבד — כל תלמידות הכיתה בשכבה זו."
                      : trackId
                        ? "נבחר מסלול בלבד — כל תלמידות המסלול בשכבה זו."
                        : "בשיבוץ חובה: כיתה או מסלול (או שתיהן), או מיועד לפסיכולוגיה."}
              </p>
            </>
          )}
        </>
      )}

      <Button type="submit" disabled={loading}>
        {loading ? "שומר..." : "הוספה"}
      </Button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
