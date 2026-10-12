"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { StatusPill } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { StudentsForm } from "./StudentsForm";
import { StudentsImport } from "./StudentsImport";
import type { Grade, Class, Track, Specialization } from "@/types/database";
import { Icon } from "@/components/ui/Icon";
import { PrintButton } from "@/components/ui/PrintButton";
import { SeminarPrintHeader } from "@/components/print/SeminarPrintHeader";
import * as XLSX from "xlsx";

const PRINT_COLUMNS = [
  { id: "name", label: "שם", defaultOn: true },
  { id: "identity", label: 'ת"ז', defaultOn: true },
  { id: "grade", label: "שכבה", defaultOn: true },
  { id: "class", label: "כיתה", defaultOn: true },
  { id: "track", label: "מסלול", defaultOn: true },
  { id: "spec", label: "התמחות", defaultOn: true },
  { id: "psychology", label: "פסיכולוגיה", defaultOn: false },
  { id: "city", label: "עיר", defaultOn: false },
  { id: "phone", label: "טלפון", defaultOn: false },
  { id: "studentPhone", label: "פל׳ תלמידה", defaultOn: false },
  { id: "motherPhone", label: "פל׳ אם", defaultOn: false },
  { id: "fatherPhone", label: "פל׳ אב", defaultOn: false },
  { id: "highSchool", label: "תיכון", defaultOn: false },
  { id: "status", label: "סטטוס", defaultOn: false },
] as const;

type PrintColId = (typeof PRINT_COLUMNS)[number]["id"];

type SortKey =
  | "name"
  | "identity"
  | "grade"
  | "class"
  | "track"
  | "spec"
  | "city"
  | "status";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name", label: "שם" },
  { value: "identity", label: 'ת"ז' },
  { value: "grade", label: "שכבה" },
  { value: "class", label: "כיתה" },
  { value: "track", label: "מסלול" },
  { value: "spec", label: "התמחות" },
  { value: "city", label: "עיר" },
  { value: "status", label: "סטטוס" },
];

function sortValue(s: StudentRow, key: SortKey): string {
  switch (key) {
    case "name":
      return `${s.last_name} ${s.first_name}`.trim() || s.full_name;
    case "identity":
      return s.identity_number;
    case "grade":
      return s.gradeName;
    case "class":
      return s.className;
    case "track":
      return s.trackName;
    case "spec":
      return [s.specializationName, s.secondarySpecializationName]
        .filter((v) => v && v !== "—")
        .join(" ");
    case "city":
      return s.city ?? "";
    case "status":
      return s.is_active ? "0" : "1";
  }
}

function printCell(s: StudentRow, id: PrintColId): string {
  switch (id) {
    case "name":
      return `${s.first_name || s.full_name.split(" ")[0]} ${s.last_name}`.trim();
    case "identity":
      return s.identity_number;
    case "grade":
      return s.gradeName;
    case "class":
      return s.className;
    case "track":
      return s.trackName;
    case "spec":
      return [s.specializationName, s.secondarySpecializationName]
        .filter((v) => v && v !== "—")
        .join(" + ") || "—";
    case "psychology":
      return s.isPsychology ? "פסיכולוגיה" : "";
    case "city":
      return s.city ?? "";
    case "phone":
      return s.phone ?? "";
    case "studentPhone":
      return s.student_phone ?? "";
    case "motherPhone":
      return s.mother_phone ?? "";
    case "fatherPhone":
      return s.father_phone ?? "";
    case "highSchool":
      return s.high_school ?? "";
    case "status":
      return s.is_active ? "פעילה" : "לא פעילה";
  }
}

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
  gradeId: string;
  classId: string;
  trackId: string;
  specId: string | null;
  secondarySpecId: string | null;
  className: string;
  gradeName: string;
  trackName: string;
  specializationName: string;
  secondarySpecializationName: string;
  isPsychology: boolean;
}

function StudentNameCell({
  student: s,
  viewOnly = false,
}: {
  student: StudentRow;
  viewOnly?: boolean;
}) {
  return (
    <>
      <span
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-caption font-bold text-white"
        aria-hidden
      >
        {(s.first_name || s.full_name).slice(0, 1)}
      </span>
      <span className="min-w-0">
        <span className="block break-words font-label-md text-label-md text-primary">
          {s.first_name || s.full_name.split(" ")[0]} {s.last_name}
          {s.mi ? (
            <span className="ms-1 font-caption text-caption text-on-surface-variant">
              {s.mi}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 flex flex-wrap gap-1">
          {s.chetz_program && (
            <span className="rounded-full bg-surface-container-high px-1.5 py-0 font-caption text-caption text-on-surface-variant">
              חץ
            </span>
          )}
          {s.isPsychology && (
            <span className="rounded-full bg-surface-container-high px-1.5 py-0 font-caption text-caption text-on-surface-variant">
              פסיכ׳
            </span>
          )}
        </span>
        {!viewOnly && s.personal_note && (
          <p
            className="mt-0.5 break-words font-caption text-caption text-secondary"
            title={s.personal_note}
          >
            <Icon
              name="sticky_note_2"
              className="me-0.5 inline text-[12px] align-text-bottom"
            />
            {s.personal_note}
          </p>
        )}
      </span>
    </>
  );
}

interface YearOptions {
  yearId: string;
  grades: Grade[];
  classes: Class[];
  tracks: Track[];
  specializations: Specialization[];
  lessons?: { id: string; subjectKey: string; label: string }[];
  assignedLessonIdsByStudent?: Record<string, string[]>;
}

export function StudentsDirectory({
  students,
  yearOptions,
  viewOnly = false,
  canWrite = true,
  yearName = "",
}: {
  students: StudentRow[];
  yearOptions: YearOptions | null;
  viewOnly?: boolean;
  canWrite?: boolean;
  yearName?: string;
}) {
  const [query, setQuery] = useState("");
  const [gradeIds, setGradeIds] = useState<string[]>([]);
  const [classIds, setClassIds] = useState<string[]>([]);
  const [trackIds, setTrackIds] = useState<string[]>([]);
  const [specIds, setSpecIds] = useState<string[]>([]);
  const [subjectKeys, setSubjectKeys] = useState<string[]>([]);
  const [lessonIds, setLessonIds] = useState<string[]>([]);
  const [psychology, setPsychology] = useState<"all" | "yes" | "no">("all");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [modalOpen, setModalOpen] = useState(false);
  const [yearError, setYearError] = useState<string | null>(null);
  const [printCols, setPrintCols] = useState<Record<PrintColId, boolean>>(() =>
    Object.fromEntries(PRINT_COLUMNS.map((c) => [c.id, c.defaultOn])) as Record<
      PrintColId,
      boolean
    >
  );

  const gradeNameById = useMemo(
    () => new Map((yearOptions?.grades ?? []).map((g) => [g.id, g.name])),
    [yearOptions]
  );

  const classFilterOptions = useMemo(() => {
    const list = (yearOptions?.classes ?? []).filter(
      (c) => gradeIds.length === 0 || gradeIds.includes(c.grade_id)
    );
    return [...list]
      .sort((a, b) => a.name.localeCompare(b.name, "he"))
      .map((c) => ({
        value: c.id,
        label:
          gradeIds.length === 1
            ? c.name
            : `${gradeNameById.get(c.grade_id) ?? "?"} · ${c.name}`,
      }));
  }, [yearOptions, gradeIds, gradeNameById]);

  const subjectFilterOptions = useMemo(() => {
    const names = new Set(
      (yearOptions?.lessons ?? [])
        .map((l) => l.subjectKey)
        .filter((name) => name.length > 0)
    );
    return [...names]
      .sort((a, b) => a.localeCompare(b, "he"))
      .map((name) => ({ value: name, label: name }));
  }, [yearOptions]);

  const lessonFilterOptions = useMemo(() => {
    const list = (yearOptions?.lessons ?? []).filter(
      (l) => subjectKeys.length === 0 || subjectKeys.includes(l.subjectKey)
    );
    return [...list]
      .sort((a, b) => a.label.localeCompare(b.label, "he"))
      .map((l) => ({ value: l.id, label: l.label }));
  }, [yearOptions, subjectKeys]);

  const lessonSubjectById = useMemo(
    () => new Map((yearOptions?.lessons ?? []).map((l) => [l.id, l.subjectKey])),
    [yearOptions]
  );

  const filtered = useMemo(() => {
    const q = query.trim();
    return students.filter((s) => {
      if (status === "active" && !s.is_active) return false;
      if (status === "inactive" && s.is_active) return false;
      if (gradeIds.length > 0 && !gradeIds.includes(s.gradeId)) return false;
      if (classIds.length > 0 && !classIds.includes(s.classId)) return false;
      if (trackIds.length > 0 && !trackIds.includes(s.trackId)) return false;
      if (
        specIds.length > 0 &&
        !(
          (s.specId && specIds.includes(s.specId)) ||
          (s.secondarySpecId && specIds.includes(s.secondarySpecId))
        )
      ) {
        return false;
      }
      if (psychology === "yes" && !s.isPsychology) return false;
      if (psychology === "no" && s.isPsychology) return false;
      const assignedLessonIds = yearOptions?.assignedLessonIdsByStudent?.[s.id] ?? [];
      if (lessonIds.length > 0 && !lessonIds.some((id) => assignedLessonIds.includes(id))) {
        return false;
      }
      if (subjectKeys.length > 0) {
        const takesSubject = assignedLessonIds.some((id) => {
          const key = lessonSubjectById.get(id);
          return Boolean(key && subjectKeys.includes(key));
        });
        if (!takesSubject) return false;
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
    gradeIds,
    classIds,
    trackIds,
    specIds,
    psychology,
    lessonIds,
    subjectKeys,
    yearOptions,
    lessonSubjectById,
  ]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const cmp = sortValue(a, sortKey).localeCompare(sortValue(b, sortKey), "he", {
        numeric: true,
        sensitivity: "base",
      });
      if (cmp !== 0) return cmp * dir;
      return a.full_name.localeCompare(b.full_name, "he") * dir;
    });
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

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

  const visiblePrintCols = PRINT_COLUMNS.filter((c) => printCols[c.id]);
  const printColumns =
    visiblePrintCols.length > 0 ? visiblePrintCols : PRINT_COLUMNS.filter((c) => c.id === "name");

  const printSubtitle = useMemo(() => {
    const bits: string[] = [];
    if (yearName) bits.push(yearName);
    if (gradeIds.length) {
      bits.push(
        gradeIds
          .map((id) => yearOptions?.grades.find((g) => g.id === id)?.name)
          .filter(Boolean)
          .join(", ")
      );
    }
    if (classIds.length) {
      bits.push(
        classIds
          .map((id) => yearOptions?.classes.find((c) => c.id === id)?.name)
          .filter(Boolean)
          .join(", ")
      );
    }
    if (trackIds.length) {
      bits.push(
        trackIds
          .map((id) => yearOptions?.tracks.find((t) => t.id === id)?.name)
          .filter(Boolean)
          .join(", ")
      );
    }
    if (specIds.length) {
      bits.push(
        specIds
          .map((id) => yearOptions?.specializations.find((s) => s.id === id)?.name)
          .filter(Boolean)
          .join(", ")
      );
    }
    if (subjectKeys.length) bits.push(subjectKeys.join(", "));
    if (lessonIds.length) {
      bits.push(
        lessonIds
          .map((id) => yearOptions?.lessons?.find((l) => l.id === id)?.label)
          .filter(Boolean)
          .join(", ")
      );
    }
    if (psychology === "yes") bits.push("פסיכולוגיה");
    if (psychology === "no") bits.push("לא פסיכולוגיה");
    if (status === "active") bits.push("פעילות");
    if (status === "inactive") bits.push("לא פעילות");
    if (query.trim()) bits.push(`חיפוש: ${query.trim()}`);
    bits.push(`${filtered.length} תלמידות`);
    return bits.filter(Boolean).join(" · ");
  }, [
    yearName,
    yearOptions,
    gradeIds,
    classIds,
    trackIds,
    specIds,
    subjectKeys,
    lessonIds,
    psychology,
    status,
    query,
    filtered.length,
  ]);

  const hasActiveFilter = Boolean(
    query.trim() ||
      gradeIds.length ||
      classIds.length ||
      trackIds.length ||
      specIds.length ||
      subjectKeys.length ||
      lessonIds.length ||
      psychology !== "all" ||
      status !== "all"
  );

  return (
    <div className="min-w-0 overflow-x-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-tactile-md print:overflow-visible print:border-0 print:bg-transparent print:shadow-none">
      <SeminarPrintHeader title="רשימת תלמידות" subtitle={printSubtitle} />
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-outline-variant/30 bg-secondary-container/30 px-5 py-3 print:hidden">
        <div className="min-w-0 flex-1">
          <p className="mb-1 font-label-md text-label-md text-on-surface">
            הדפסה — סמני אילו עמודות יופיעו ברשימה המודפסת (לפי הסינון למטה)
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {PRINT_COLUMNS.map((col) => (
              <label
                key={col.id}
                className="inline-flex cursor-pointer items-center gap-1.5 font-caption text-caption text-on-surface"
              >
                <input
                  type="checkbox"
                  checked={printCols[col.id]}
                  onChange={() =>
                    setPrintCols((prev) => ({ ...prev, [col.id]: !prev[col.id] }))
                  }
                  className="rounded border-outline-variant"
                />
                {col.label}
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <PrintButton
          label="הדפסת רשימה"
          documentTitle={`תלמידות${yearName ? `-${yearName}` : ""}`}
          disabled={filtered.length === 0}
          disabledReason="אין תלמידות להדפסה לפי הסינון"
        />
        <Button
          type="button"
          variant="secondary"
          disabled={filtered.length === 0}
          title={filtered.length === 0 ? "אין תלמידות לייצוא לפי הסינון" : undefined}
          onClick={() => {
            const cols = PRINT_COLUMNS.filter((col) => printCols[col.id]);
            const header = cols.map((col) => col.label);
            const body = sorted.map((s) => cols.map((col) => printCell(s, col.id)));
            const sheet = XLSX.utils.aoa_to_sheet([header, ...body]);
            sheet["!cols"] = cols.map((col) => ({
              wch: Math.min(28, Math.max(10, col.label.length + 4)),
            }));
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, sheet, "תלמידות");
            const safeYear = (yearName ?? "רשימה").replace(/[\\/:*?"<>|]/g, "-");
            XLSX.writeFile(workbook, `תלמידות-${safeYear}.xlsx`);
          }}
        >
          <Icon name="download" className="text-[18px]" />
          ייצוא לאקסל
        </Button>
        </div>
      </div>
      <div className="grid gap-3 border-b border-outline-variant/30 bg-surface-container-low/60 px-5 py-4 print:hidden md:grid-cols-2 xl:grid-cols-4">
        <div className="xl:col-span-2">
          <Input
            label="חיפוש"
            placeholder="שם, תעודת זהות, כיתה, מסלול או התמחות"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <MultiSelect
          label="שכבות"
          name="gradeId"
          hint="אפשר לבחור כמה"
          values={gradeIds}
          onChange={(next) => {
            setGradeIds(next);
            setClassIds((prev) =>
              prev.filter((id) => {
                const cls = yearOptions?.classes.find((c) => c.id === id);
                return cls && (next.length === 0 || next.includes(cls.grade_id));
              })
            );
          }}
          options={(yearOptions?.grades ?? []).map((g) => ({
            value: g.id,
            label: g.name,
          }))}
        />
        <MultiSelect
          label="כיתות"
          name="classId"
          hint="אפשר לבחור כמה"
          values={classIds}
          onChange={setClassIds}
          options={classFilterOptions}
        />
        <MultiSelect
          label="מסלולים"
          name="trackId"
          hint="אפשר לבחור כמה"
          values={trackIds}
          onChange={setTrackIds}
          options={(yearOptions?.tracks ?? []).map((t) => ({
            value: t.id,
            label: t.name,
          }))}
        />
        <MultiSelect
          label="התמחויות"
          name="specId"
          hint="אפשר לבחור כמה"
          values={specIds}
          onChange={setSpecIds}
          options={(yearOptions?.specializations ?? []).map((s) => ({
            value: s.id,
            label: s.name,
          }))}
        />
        <MultiSelect
          label="מקצועות"
          name="subjectKey"
          hint="אפשר לבחור כמה"
          values={subjectKeys}
          onChange={(next) => {
            setSubjectKeys(next);
            setLessonIds((prev) =>
              prev.filter((id) => {
                const lesson = yearOptions?.lessons?.find((l) => l.id === id);
                return lesson && (next.length === 0 || next.includes(lesson.subjectKey));
              })
            );
          }}
          options={subjectFilterOptions}
        />
        <MultiSelect
          label="שיעורים"
          name="lessonId"
          hint="אפשר לבחור כמה"
          values={lessonIds}
          onChange={setLessonIds}
          options={lessonFilterOptions}
        />
        <Select
          label="פסיכולוגיה"
          value={psychology}
          onChange={(e) => setPsychology(e.target.value as typeof psychology)}
          options={[
            { value: "all", label: "הכל" },
            { value: "yes", label: "פסיכולוגיה" },
            { value: "no", label: "לא פסיכולוגיה" },
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
        <Select
          label="מיון לפי"
          value={sortKey}
          onChange={(e) => {
            setSortKey(e.target.value as SortKey);
            setSortDir("asc");
          }}
          options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />
        <div className="flex items-end">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          >
            <Icon name={sortDir === "asc" ? "arrow_upward" : "arrow_downward"} className="text-[18px]" />
            {sortDir === "asc" ? "סדר עולה" : "סדר יורד"}
          </Button>
        </div>
        <div className="flex items-end xl:col-span-4">
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <p className="text-body-md text-on-surface-variant">
              {hasActiveFilter ? (
                <>
                  מוצגות{" "}
                  <span className="font-semibold text-primary">{filtered.length}</span> מתוך{" "}
                  <span className="font-semibold text-primary">{students.length}</span> תלמידות
                </>
              ) : (
                <>
                  סה״כ{" "}
                  <span className="font-semibold text-primary">{students.length}</span> תלמידות
                </>
              )}
            </p>
            {!viewOnly && !hasSettingsLists && yearOptions && (
              <p className="text-body-md text-secondary">
                אין עדיין שכבות/כיתות/מסלולים/התמחויות בהגדרות —{" "}
                <Link href="/settings" className="font-medium underline">
                  מעבר להגדרות
                </Link>
              </p>
            )}
            <div className="ms-auto flex flex-wrap items-center gap-2">
            {!canWrite ? null : (
            <>
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
            </>
            )}
            </div>
          </div>
        </div>
      </div>

      {yearError && (
        <p className="border-b border-outline-variant/30 bg-error-container/40 px-5 py-3 text-body-md text-on-error-container print:hidden">
          {yearError}
        </p>
      )}

      <div className="min-w-0 overflow-x-hidden print:hidden">
        <table className="w-full table-fixed border-collapse text-right">
          <colgroup>
            <col className="w-[26%]" />
            <col className="w-[14%]" />
            <col className="w-[28%]" />
            <col className="w-[16%]" />
            <col className="w-[10%]" />
            {viewOnly ? null : <col className="w-[6%]" />}
          </colgroup>
          <thead>
            <tr className="border-b border-outline-variant/40 bg-surface-container-low text-on-surface-variant">
              {(
                [
                  { key: "name" as SortKey, label: "תלמידה" },
                  { key: "identity" as SortKey, label: 'ת"ז' },
                  { key: "grade" as SortKey, label: "שיבוץ" },
                  { key: "city" as SortKey, label: "קשר" },
                  { key: "status" as SortKey, label: "סטטוס" },
                ] as const
              ).map((h) => (
                <th key={h.key} className="px-3 py-2 text-right text-caption font-semibold tracking-wide">
                  <button
                    type="button"
                    onClick={() => toggleSort(h.key)}
                    className="inline-flex items-center gap-1 hover:text-primary"
                  >
                    {h.label}
                    {sortKey === h.key ? (
                      <Icon
                        name={sortDir === "asc" ? "arrow_upward" : "arrow_downward"}
                        className="text-[14px] text-primary"
                      />
                    ) : null}
                  </button>
                </th>
              ))}
              {viewOnly ? null : <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/25">
            {sorted.map((s) => {
              const contactPhone =
                s.student_phone || s.phone || s.mother_phone || s.father_phone || null;
              return (
                <tr
                  key={s.id}
                  className="transition-colors hover:bg-[var(--accent-soft)]"
                >
                  <td className="px-3 py-2">
                    {viewOnly ? (
                      <div className="flex min-w-0 items-start gap-2">
                        <StudentNameCell student={s} viewOnly />
                      </div>
                    ) : (
                      <Link
                        href={`/students/${s.id}`}
                        className="flex min-w-0 items-start gap-2 rounded-md outline-none transition-colors hover:bg-secondary-container/30 focus-visible:ring-2 focus-visible:ring-secondary"
                      >
                        <StudentNameCell student={s} />
                      </Link>
                    )}
                  </td>
                  <td className="break-all px-3 py-2 font-mono text-caption text-on-surface-variant" dir="ltr">
                    {s.identity_number}
                  </td>
                  <td className="px-3 py-2 font-caption text-caption text-on-surface">
                    <div className="break-words">
                      {s.gradeName}
                      {s.className && s.className !== "—" ? ` · ${s.className}` : ""}
                    </div>
                    <div className="mt-0.5 break-words text-on-surface-variant">
                      {s.trackName}
                      {s.specializationName !== "—"
                        ? ` · ${s.specializationName}`
                        : ""}
                      {s.secondarySpecializationName !== "—"
                        ? ` + ${s.secondarySpecializationName}`
                        : ""}
                    </div>
                  </td>
                  <td className="px-3 py-2 font-caption text-caption text-on-surface-variant">
                    <div className="break-words">{s.city ?? "—"}</div>
                    <div className="mt-0.5 break-all" dir="ltr">
                      {contactPhone ?? "—"}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <StatusPill tone={s.is_active ? "ok" : "muted"}>
                      {s.is_active ? "פעילה" : "לא פעילה"}
                    </StatusPill>
                  </td>
                  {viewOnly ? null : (
                  <td className="px-3 py-2">
                    <Link
                      href={`/students/${s.id}`}
                      className="inline-flex items-center gap-1 font-label-md text-label-md text-secondary transition-colors hover:text-primary hover:underline"
                    >
                      <Icon name="badge" className="text-[16px]" />
                      כרטיס
                    </Link>
                  </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="hidden print:block">
        <table className="w-full border-collapse text-right text-[11px] leading-tight">
          <thead>
            <tr className="border-b border-primary">
              {printColumns.map((col) => (
                <th
                  key={col.id}
                  className="px-1.5 py-1 text-right font-semibold text-primary"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.id} className="border-b border-outline-variant/40">
                {printColumns.map((col) => (
                  <td key={col.id} className="px-1.5 py-0.5 text-on-surface">
                    {printCell(s, col.id) || "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center gap-2 px-5 py-12 text-center print:hidden">
          <Icon name="group" className="text-5xl text-outline-variant" />
          <p className="font-title-lg text-title-lg text-primary">
            לא נמצאו תלמידות
          </p>
          <p className="text-body-md text-on-surface-variant">
            {viewOnly ? "נסי לשנות את הסינון." : "נסי לשנות סינון או להוסיף תלמידה חדשה."}
          </p>
        </div>
      )}

      {canWrite && yearOptions && (
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
