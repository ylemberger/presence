"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { Input, Select } from "@/components/ui/Input";
import { Table, TableRow, TableCell } from "@/components/ui/Table";
import { StatusPill } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { StudentsForm } from "./StudentsForm";
import { StudentsImport } from "./StudentsImport";
import type { Grade, Class, Track, Specialization } from "@/types/database";
import { Icon } from "@/components/ui/Icon";

interface StudentRow {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  mi: string | null;
  identity_number: string;
  cohort_number: number;
  city: string | null;
  phone: string | null;
  father_phone: string | null;
  mother_phone: string | null;
  student_phone: string | null;
  high_school: string | null;
  chetz_program: boolean;
  birth_date: string | null;
  birth_date_hebrew: string | null;
  address: string | null;
  personal_note: string | null;
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
        s.first_name.includes(q) ||
        s.last_name.includes(q) ||
        s.identity_number.includes(q) ||
        (s.city ?? "").includes(q) ||
        (s.phone ?? "").includes(q) ||
        (s.high_school ?? "").includes(q) ||
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
      yearOptions.grades.length &&
      yearOptions.classes.length &&
      yearOptions.tracks.length &&
      yearOptions.specializations.length
  );

  return (
    <div className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-tactile-md">
      <div className="grid gap-3 border-b border-outline-variant/30 bg-surface-container-low/60 px-5 py-4 md:grid-cols-2 xl:grid-cols-7">
        <div className="xl:col-span-2">
          <Input
            label="חיפוש"
            placeholder="שם, תעודת זהות, כיתה, מסלול או התמחות"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Combobox
          label="שכבה"
          value={gradeId}
          onChange={(v) => {
            setGradeId(v);
            setClassId("");
          }}
          options={(yearOptions?.grades ?? []).map((g) => ({
            value: g.id,
            label: g.name,
          }))}
        />
        <Combobox
          label="כיתה"
          value={classId}
          onChange={setClassId}
          options={classFilterOptions}
          emptyLabel={classFilterOptions.length ? "הכל" : "אין כיתות בהגדרות"}
        />
        <Combobox
          label="מסלול"
          value={trackId}
          onChange={setTrackId}
          options={(yearOptions?.tracks ?? []).map((t) => ({
            value: t.id,
            label: t.name,
          }))}
        />
        <Combobox
          label="התמחות"
          value={specId}
          onChange={setSpecId}
          options={(yearOptions?.specializations ?? []).map((s) => ({
            value: s.id,
            label: s.name,
          }))}
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
              <p className="text-body-md text-secondary">
                אין עדיין שכבות/כיתות/מסלולים/התמחויות בהגדרות —{" "}
                <Link href="/settings" className="font-medium underline">
                  מעבר להגדרות
                </Link>
              </p>
            )}
            <div className="ms-auto flex flex-wrap items-center gap-2">
              <StudentsImport
                disabledReason={
                  !yearOptions
                    ? "יש להגדיר שנה אקדמית פעילה לפני ייבוא."
                    : !hasSettingsLists
                      ? "יש להוסיף שכבה, כיתה, מסלול והתמחות בהגדרות לפני ייבוא."
                      : undefined
                }
              />
              <Button type="button" onClick={openCreate}>
                <Icon name="person_add" className="text-[18px]" />
                תלמידה חדשה
              </Button>
            </div>
          </div>
        </div>
      </div>

      {yearError && (
        <p className="border-b border-outline-variant/30 bg-error-container/40 px-5 py-3 text-body-md text-on-error-container">
          {yearError}
        </p>
      )}

      <div className="overflow-x-auto">
      <Table
        headers={[
          "מי",
          "שם פרטי",
          "משפחה",
          "מ.ז.",
          "כיתה",
          "שכבה",
          "עיר",
          "טל",
          "פל אב",
          "פל אם",
          "פל תלמידה",
          "תיכון",
          "חץ",
          "מסלול",
          "התמחות",
          "פסיכ׳",
          "סטטוס",
          "",
        ]}
      >
        {filtered.map((s) => (
          <TableRow key={s.id}>
            <TableCell className="text-on-surface-variant">{s.mi ?? "—"}</TableCell>
            <TableCell>
              <Link
                href={`/students/${s.id}`}
                className="flex min-w-[8rem] flex-col gap-0.5 rounded-md outline-none transition-colors hover:bg-secondary-container/30 focus-visible:ring-2 focus-visible:ring-secondary"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-caption font-bold text-white"
                    aria-hidden
                  >
                    {(s.first_name || s.full_name).slice(0, 1)}
                  </span>
                  <span className="font-label-md text-label-md text-primary whitespace-nowrap underline-offset-2 group-hover:underline">
                    {s.first_name || s.full_name.split(" ")[0]}
                  </span>
                </div>
                {s.personal_note && (
                  <p
                    className="max-w-[12rem] truncate pe-1 font-caption text-caption text-secondary"
                    title={s.personal_note}
                  >
                    <Icon name="sticky_note_2" className="me-0.5 inline text-[12px] align-text-bottom" />
                    {s.personal_note}
                  </p>
                )}
              </Link>
            </TableCell>
            <TableCell className="whitespace-nowrap font-label-md text-label-md text-primary">
              <Link
                href={`/students/${s.id}`}
                className="hover:underline underline-offset-2"
              >
                {s.last_name || "—"}
              </Link>
            </TableCell>
            <TableCell className="font-mono text-on-surface-variant whitespace-nowrap" dir="ltr">
              {s.identity_number}
            </TableCell>
            <TableCell className="whitespace-nowrap">{s.className}</TableCell>
            <TableCell>{s.gradeName}</TableCell>
            <TableCell className="whitespace-nowrap">{s.city ?? "—"}</TableCell>
            <TableCell className="whitespace-nowrap font-mono text-caption" dir="ltr">
              {s.phone ?? "—"}
            </TableCell>
            <TableCell className="whitespace-nowrap font-mono text-caption" dir="ltr">
              {s.father_phone ?? "—"}
            </TableCell>
            <TableCell className="whitespace-nowrap font-mono text-caption" dir="ltr">
              {s.mother_phone ?? "—"}
            </TableCell>
            <TableCell className="whitespace-nowrap font-mono text-caption" dir="ltr">
              {s.student_phone ?? "—"}
            </TableCell>
            <TableCell className="whitespace-nowrap">{s.high_school ?? "—"}</TableCell>
            <TableCell>{s.chetz_program ? "כן" : "לא"}</TableCell>
            <TableCell className="whitespace-nowrap">{s.trackName}</TableCell>
            <TableCell className="whitespace-nowrap">
              {s.specializationName}
              {s.secondarySpecializationName !== "—"
                ? ` + ${s.secondarySpecializationName}`
                : ""}
            </TableCell>
            <TableCell>{s.isPsychology ? "כן" : "לא"}</TableCell>
            <TableCell>
              <StatusPill tone={s.is_active ? "ok" : "muted"}>
                {s.is_active ? "פעילה" : "לא פעילה"}
              </StatusPill>
            </TableCell>
            <TableCell>
              <Link
                href={`/students/${s.id}`}
                className="inline-flex items-center gap-1 whitespace-nowrap text-label-md text-secondary transition-colors hover:text-primary hover:underline"
              >
                <Icon name="badge" className="text-[16px]" />
                כרטיס
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </Table>
      </div>
      {filtered.length === 0 && (
        <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
          <Icon name="group" className="text-5xl text-outline-variant" />
          <p className="font-title-lg text-title-lg text-primary">
            לא נמצאו תלמידות
          </p>
          <p className="text-body-md text-on-surface-variant">
            נסי לשנות סינון או להוסיף תלמידה חדשה.
          </p>
        </div>
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
