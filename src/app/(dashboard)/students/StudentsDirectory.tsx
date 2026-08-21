"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Table, TableRow, TableCell } from "@/components/ui/Table";
import { StatusPill } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { StudentsForm } from "./StudentsForm";
import type { Grade, Class, Track, Specialization, TeachingType } from "@/types/database";

interface StudentRow {
  id: string;
  full_name: string;
  identity_number: string;
  cohort_number: number;
  is_active: boolean;
  className: string;
  gradeName: string;
  trackName: string;
  specializationName: string;
  secondarySpecializationName: string;
  teachingTypeName: string;
  isPsychology: boolean;
}

interface YearOptions {
  yearId: string;
  grades: Grade[];
  classes: Class[];
  tracks: Track[];
  specializations: Specialization[];
  teachingTypes: TeachingType[];
}

export function StudentsDirectory({
  students,
  yearOptions,
}: {
  students: StudentRow[];
  yearOptions: YearOptions | null;
}) {
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("");
  const [className, setClassName] = useState("");
  const [track, setTrack] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [yearError, setYearError] = useState<string | null>(null);

  const grades = useMemo(
    () => [...new Set(students.map((s) => s.gradeName).filter((g) => g && g !== "—"))].sort(),
    [students]
  );
  const classNames = useMemo(
    () =>
      [...new Set(students.map((s) => s.className).filter((c) => c && c !== "לא משובצת"))].sort(),
    [students]
  );
  const tracks = useMemo(
    () => [...new Set(students.map((s) => s.trackName).filter((t) => t && t !== "—"))].sort(),
    [students]
  );

  const filtered = useMemo(() => {
    const q = query.trim();
    return students.filter((s) => {
      if (status === "active" && !s.is_active) return false;
      if (status === "inactive" && s.is_active) return false;
      if (grade && s.gradeName !== grade) return false;
      if (className && s.className !== className) return false;
      if (track && s.trackName !== track) return false;
      if (!q) return true;
      return (
        s.full_name.includes(q) ||
        s.identity_number.includes(q) ||
        s.className.includes(q) ||
        s.gradeName.includes(q) ||
        s.trackName.includes(q) ||
        s.specializationName.includes(q)
      );
    });
  }, [query, students, grade, className, track, status]);

  function openCreate() {
    if (!yearOptions) {
      setYearError("יש להגדיר שנה אקדמית פעילה לפני הוספת תלמידה.");
      return;
    }
    setYearError(null);
    setModalOpen(true);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-[0_8px_30px_rgb(28,43,48,0.04)]">
      <div className="grid gap-3 border-b border-stone-100 px-5 py-4 md:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <Input
            placeholder="חיפוש לפי שם, תעודת זהות, כיתה, מסלול או התמחות"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select
          label="שכבה"
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          options={[
            { value: "", label: "הכל" },
            ...grades.map((g) => ({ value: g, label: g })),
          ]}
        />
        <Select
          label="כיתה"
          value={className}
          onChange={(e) => setClassName(e.target.value)}
          options={[
            { value: "", label: "הכל" },
            ...classNames.map((c) => ({ value: c, label: c })),
          ]}
        />
        <Select
          label="מסלול"
          value={track}
          onChange={(e) => setTrack(e.target.value)}
          options={[
            { value: "", label: "הכל" },
            ...tracks.map((t) => ({ value: t, label: t })),
          ]}
        />
        <Select
          label="סטטוס"
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          options={[
            { value: "all", label: "הכל" },
            { value: "active", label: "פעילות" },
            { value: "inactive", label: "לא פעילות" },
          ]}
        />
        <div className="flex items-end">
          <Button type="button" onClick={openCreate}>
            תלמידה חדשה
          </Button>
        </div>
      </div>

      {yearError && (
        <p className="border-b border-stone-100 px-5 py-3 text-sm text-rose-600">{yearError}</p>
      )}

      <Table
        headers={[
          "תלמידה",
          'ת"ז',
          "מחזור",
          "שכבה",
          "כיתה",
          "מסלול",
          "התמחות",
          "סטטוס",
          "",
        ]}
      >
        {filtered.map((s) => (
          <TableRow key={s.id}>
            <TableCell>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand)]/10 text-sm font-semibold text-[var(--brand)]">
                  {s.full_name.slice(0, 1)}
                </span>
                <div>
                  <span className="font-medium text-slate-800">{s.full_name}</span>
                  {s.isPsychology && (
                    <span className="mr-2 text-xs text-slate-400">· פסיכולוגיה</span>
                  )}
                </div>
              </div>
            </TableCell>
            <TableCell className="font-mono text-slate-500" dir="ltr">
              {s.identity_number}
            </TableCell>
            <TableCell>{s.cohort_number}</TableCell>
            <TableCell>{s.gradeName}</TableCell>
            <TableCell>{s.className}</TableCell>
            <TableCell>{s.trackName}</TableCell>
            <TableCell>
              {s.specializationName}
              {s.secondarySpecializationName !== "—"
                ? ` + ${s.secondarySpecializationName}`
                : ""}
            </TableCell>
            <TableCell>
              <StatusPill tone={s.is_active ? "ok" : "muted"}>
                {s.is_active ? "פעילה" : "לא פעילה"}
              </StatusPill>
            </TableCell>
            <TableCell>
              <Link
                href={`/students/${s.id}`}
                className="text-sm font-medium text-[var(--brand)] hover:underline"
              >
                כרטיס תלמידה
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </Table>
      {filtered.length === 0 && (
        <p className="px-5 py-8 text-center text-sm text-slate-500">לא נמצאו תלמידות לפי הסינון.</p>
      )}

      {yearOptions && (
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="תלמידה חדשה"
          description="מלאי את כל הפרטים בבת אחת — שם, תעודת זהות, שכבה, כיתה, מסלול ותאריך תחילה."
        >
          <StudentsForm
            yearId={yearOptions.yearId}
            grades={yearOptions.grades}
            classes={yearOptions.classes}
            tracks={yearOptions.tracks}
            specializations={yearOptions.specializations}
            teachingTypes={yearOptions.teachingTypes}
            onCancel={() => setModalOpen(false)}
            onSuccess={() => setModalOpen(false)}
          />
        </Modal>
      )}
    </div>
  );
}
