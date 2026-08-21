"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Table, TableRow, TableCell } from "@/components/ui/Table";
import { StatusPill } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { StudentsForm } from "./StudentsForm";
import type { Grade, Class, Track, Specialization } from "@/types/database";

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
  isPsychology: boolean;
}

interface YearOptions {
  yearId: string;
  grades: Grade[];
  classes: Class[];
  tracks: Track[];
  specializations: Specialization[];
}

export function StudentsDirectory({
  students,
  yearOptions,
}: {
  students: StudentRow[];
  yearOptions: YearOptions | null;
}) {
  const [query, setQuery] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [classId, setClassId] = useState("");
  const [trackId, setTrackId] = useState("");
  const [specId, setSpecId] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [yearError, setYearError] = useState<string | null>(null);

  const gradeNameById = useMemo(
    () => new Map((yearOptions?.grades ?? []).map((g) => [g.id, g.name])),
    [yearOptions]
  );
  const classById = useMemo(
    () => new Map((yearOptions?.classes ?? []).map((c) => [c.id, c])),
    [yearOptions]
  );
  const trackNameById = useMemo(
    () => new Map((yearOptions?.tracks ?? []).map((t) => [t.id, t.name])),
    [yearOptions]
  );
  const specNameById = useMemo(
    () => new Map((yearOptions?.specializations ?? []).map((s) => [s.id, s.name])),
    [yearOptions]
  );

  const filterGradeName = gradeId ? gradeNameById.get(gradeId) ?? "" : "";
  const filterClassName = classId ? classById.get(classId)?.name ?? "" : "";
  const filterTrackName = trackId ? trackNameById.get(trackId) ?? "" : "";
  const filterSpecName = specId ? specNameById.get(specId) ?? "" : "";

  const classFilterOptions = useMemo(() => {
    const list = (yearOptions?.classes ?? []).filter(
      (c) => !gradeId || c.grade_id === gradeId
    );
    return [...list]
      .sort((a, b) => a.name.localeCompare(b.name, "he"))
      .map((c) => ({
        value: c.id,
        label: gradeId
          ? c.name
          : `${gradeNameById.get(c.grade_id) ?? "?"} · ${c.name}`,
      }));
  }, [yearOptions, gradeId, gradeNameById]);

  const filtered = useMemo(() => {
    const q = query.trim();
    return students.filter((s) => {
      if (status === "active" && !s.is_active) return false;
      if (status === "inactive" && s.is_active) return false;
      if (filterGradeName && s.gradeName !== filterGradeName) return false;
      if (filterClassName && s.className !== filterClassName) return false;
      if (filterTrackName && s.trackName !== filterTrackName) return false;
      if (
        filterSpecName &&
        s.specializationName !== filterSpecName &&
        s.secondarySpecializationName !== filterSpecName
      ) {
        return false;
      }
      if (!q) return true;
      return (
        s.full_name.includes(q) ||
        s.identity_number.includes(q) ||
        s.className.includes(q) ||
        s.gradeName.includes(q) ||
        s.trackName.includes(q) ||
        s.specializationName.includes(q) ||
        s.secondarySpecializationName.includes(q)
      );
    });
  }, [
    query,
    students,
    status,
    filterGradeName,
    filterClassName,
    filterTrackName,
    filterSpecName,
  ]);

  function openCreate() {
    if (!yearOptions) {
      setYearError("יש להגדיר שנה אקדמית פעילה לפני הוספת תלמידה.");
      return;
    }
    setYearError(null);
    setModalOpen(true);
  }

  const hasSettingsLists = Boolean(
    yearOptions &&
      (yearOptions.grades.length ||
        yearOptions.classes.length ||
        yearOptions.tracks.length)
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-[var(--shadow-md)]">
      <div className="grid gap-3 border-b border-[var(--border)] bg-[var(--surface-muted)]/50 px-5 py-4 md:grid-cols-2 xl:grid-cols-7">
        <div className="xl:col-span-2">
          <Input
            label="חיפוש"
            placeholder="שם, תעודת זהות, כיתה, מסלול או התמחות"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select
          label="שכבה"
          value={gradeId}
          onChange={(e) => {
            setGradeId(e.target.value);
            setClassId("");
          }}
          options={[
            { value: "", label: "הכל" },
            ...(yearOptions?.grades ?? []).map((g) => ({
              value: g.id,
              label: g.name,
            })),
          ]}
        />
        <Select
          label="כיתה"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          options={[
            {
              value: "",
              label: classFilterOptions.length ? "הכל" : "אין כיתות בהגדרות",
            },
            ...classFilterOptions,
          ]}
        />
        <Select
          label="מסלול"
          value={trackId}
          onChange={(e) => setTrackId(e.target.value)}
          options={[
            { value: "", label: "הכל" },
            ...(yearOptions?.tracks ?? []).map((t) => ({
              value: t.id,
              label: t.name,
            })),
          ]}
        />
        <Select
          label="התמחות"
          value={specId}
          onChange={(e) => setSpecId(e.target.value)}
          options={[
            { value: "", label: "הכל" },
            ...(yearOptions?.specializations ?? []).map((s) => ({
              value: s.id,
              label: s.name,
            })),
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
        <div className="flex items-end xl:col-span-7">
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            {!hasSettingsLists && yearOptions && (
              <p className="text-sm text-amber-800">
                אין עדיין שכבות/כיתות בהגדרות —{" "}
                <Link href="/settings" className="font-medium underline">
                  מעבר להגדרות
                </Link>
              </p>
            )}
            <Button type="button" onClick={openCreate} className="ms-auto">
              תלמידה חדשה
            </Button>
          </div>
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
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-sm font-semibold text-[var(--brand)]">
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
            onCancel={() => setModalOpen(false)}
            onSuccess={() => setModalOpen(false)}
          />
        </Modal>
      )}
    </div>
  );
}
