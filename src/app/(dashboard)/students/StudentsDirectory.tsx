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
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-caption font-bold text-white"
                  aria-hidden
                >
                  {s.full_name.slice(0, 1)}
                </span>
                <div>
                  <span className="font-label-md text-label-md text-primary">
                    {s.full_name}
                  </span>
                  {s.isPsychology && (
                    <span className="mr-2 text-caption text-on-surface-variant">
                      · פסיכולוגיה
                    </span>
                  )}
                </div>
              </div>
            </TableCell>
            <TableCell className="font-mono text-on-surface-variant" dir="ltr">
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
                className="inline-flex items-center gap-1 text-label-md text-secondary transition-colors hover:text-primary hover:underline"
              >
                <Icon name="badge" className="text-[16px]" />
                כרטיס תלמידה
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </Table>
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
