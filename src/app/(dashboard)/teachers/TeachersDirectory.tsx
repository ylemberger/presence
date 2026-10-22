"use client";

import { useMemo, useState } from "react";
import { useRememberedText } from "@/lib/ui/remembered-text";
import Link from "next/link";
import { StatusPill } from "@/components/ui/PageHeader";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { SearchMultiSelect } from "@/components/ui/SearchMultiSelect";
import * as XLSX from "xlsx";
import { compareByFamilyName, displayFamilyThenGiven } from "@/lib/students/sort";

export type TeacherDirectoryRow = {
  id: string;
  full_name: string;
  identity_number: string;
  phone: string | null;
  email: string | null;
  is_local: boolean;
  salarySubjects: string;
  salaryTracks: string;
  salaryGradeYears: string;
  salarySemesters: string;
  salaryMeetings: string;
};

const EXPORT_COLUMNS = [
  { id: "name", label: "שם" },
  { id: "identity", label: 'ת"ז' },
  { id: "phone", label: "טלפון" },
  { id: "email", label: "אימייל" },
  { id: "subjects", label: "מקצועות" },
  { id: "tracks", label: "מסלולים" },
  { id: "years", label: "שנים" },
  { id: "semesters", label: "סמסטרים" },
  { id: "meetings", label: "מפגשים" },
  { id: "status", label: "סטטוס" },
] as const;

type ExportColId = (typeof EXPORT_COLUMNS)[number]["id"];

const HEADERS = ["מורה", "קשר", "שיבוצי שכר", "סטטוס", ""] as const;
const VIEW_HEADERS = ["מורה", "קשר", "שיבוצי שכר", "סטטוס"] as const;

function labelsOf(value: string): string[] {
  if (!value || value === "—") return [];
  return value
    .split(" · ")
    .map((part) => part.trim())
    .filter(Boolean);
}

function hasAny(selected: string[], value: string): boolean {
  if (selected.length === 0) return true;
  const parts = labelsOf(value);
  return parts.some((part) => selected.includes(part));
}

function uniqueLabels(rows: TeacherDirectoryRow[], pick: (row: TeacherDirectoryRow) => string): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    for (const label of labelsOf(pick(row))) set.add(label);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "he"));
}

function exportCell(row: TeacherDirectoryRow, id: ExportColId): string {
  switch (id) {
    case "name":
      return displayFamilyThenGiven(row);
    case "identity":
      return row.identity_number === "—" ? "" : row.identity_number;
    case "phone":
      return row.phone ?? "";
    case "email":
      return row.email ?? "";
    case "subjects":
      return row.salarySubjects === "—" ? "" : row.salarySubjects;
    case "tracks":
      return row.salaryTracks === "—" ? "" : row.salaryTracks;
    case "years":
      return row.salaryGradeYears === "—" ? "" : row.salaryGradeYears;
    case "semesters":
      return row.salarySemesters === "—" ? "" : row.salarySemesters;
    case "meetings":
      return row.salaryMeetings === "—" ? "" : row.salaryMeetings;
    case "status":
      return row.is_local ? "מקומית" : "מסונכרנת";
  }
}

export function TeachersDirectory({
  teachers,
  viewOnly = false,
}: {
  teachers: TeacherDirectoryRow[];
  viewOnly?: boolean;
}) {
  const [query, setQuery] = useRememberedText("presence-search:teachers");
  const [filtersOpen, setFiltersOpen] = useState(viewOnly);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [tracks, setTracks] = useState<string[]>([]);
  const [years, setYears] = useState<string[]>([]);
  const [semesters, setSemesters] = useState<string[]>([]);
  const [kind, setKind] = useState<"all" | "synced" | "local">("all");
  const [exportCols, setExportCols] = useState<Record<ExportColId, boolean>>(() =>
    Object.fromEntries(EXPORT_COLUMNS.map((col) => [col.id, true])) as Record<ExportColId, boolean>
  );

  const subjectOptions = useMemo(() => uniqueLabels(teachers, (row) => row.salarySubjects), [teachers]);
  const trackOptions = useMemo(() => uniqueLabels(teachers, (row) => row.salaryTracks), [teachers]);
  const yearOptions = useMemo(() => uniqueLabels(teachers, (row) => row.salaryGradeYears), [teachers]);
  const semesterOptions = useMemo(
    () => uniqueLabels(teachers, (row) => row.salarySemesters),
    [teachers]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const tokens = q.split(/\s+/).filter(Boolean);
    return teachers.filter((t) => {
      if (kind === "local" && !t.is_local) return false;
      if (kind === "synced" && t.is_local) return false;
      if (!hasAny(subjects, t.salarySubjects)) return false;
      if (!hasAny(tracks, t.salaryTracks)) return false;
      if (!hasAny(years, t.salaryGradeYears)) return false;
      if (!hasAny(semesters, t.salarySemesters)) return false;
      if (tokens.length === 0) return true;
      const hay = [
        t.full_name,
        t.identity_number,
        t.phone ?? "",
        t.email ?? "",
        t.salarySubjects,
        t.salaryTracks,
        t.salaryGradeYears,
        t.salarySemesters,
        t.salaryMeetings,
      ]
        .join(" ")
        .toLowerCase();
      return tokens.every((tok) => hay.includes(tok));
    }).sort(compareByFamilyName);
  }, [teachers, query, kind, subjects, tracks, years, semesters]);

  const hasActiveFilter = Boolean(
    query.trim() ||
      subjects.length ||
      tracks.length ||
      years.length ||
      semesters.length ||
      kind !== "all"
  );

  function exportExcel() {
    const cols = EXPORT_COLUMNS.filter((col) => exportCols[col.id]);
    const header = cols.map((col) => col.label);
    const body = filtered.map((row) => cols.map((col) => exportCell(row, col.id)));
    const sheet = XLSX.utils.aoa_to_sheet([header, ...body]);
    sheet["!cols"] = cols.map((col) => ({
      wch: Math.min(28, Math.max(10, col.label.length + 4)),
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "מורות");
    XLSX.writeFile(workbook, "מורות.xlsx");
  }

  return (
    <div className="flex h-full min-w-0 flex-col overflow-x-hidden rounded-xl bg-surface-container-lowest p-stack_md shadow-tactile-md">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-outline-variant/30 bg-secondary-container/30 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="mb-1 font-label-md text-label-md text-on-surface">
            ייצוא לאקסל — סמני אילו עמודות ייכנסו לקובץ (לפי הסינון)
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {EXPORT_COLUMNS.map((col) => (
              <label
                key={col.id}
                className="inline-flex cursor-pointer items-center gap-1.5 font-caption text-caption text-on-surface"
              >
                <input
                  type="checkbox"
                  checked={exportCols[col.id]}
                  onChange={() =>
                    setExportCols((prev) => ({ ...prev, [col.id]: !prev[col.id] }))
                  }
                  className="rounded border-outline-variant"
                />
                {col.label}
              </label>
            ))}
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={filtered.length === 0}
          title={filtered.length === 0 ? "אין מורות לייצוא לפי הסינון" : undefined}
          onClick={exportExcel}
        >
          <Icon name="download" className="text-[18px]" />
          ייצוא לאקסל
        </Button>
      </div>

      <div className="mb-4 rounded-xl border border-outline-variant/40 bg-surface-container-low/60">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            <Icon name="search" className="text-secondary" />
            <span className="font-title-lg text-title-lg text-primary">חיפוש וסינון</span>
            {hasActiveFilter ? (
              <span className="rounded-full bg-primary px-2 py-0.5 font-caption text-[11px] font-bold text-white">
                {filtered.length} לפי הסינון
              </span>
            ) : (
              <span className="font-caption text-caption text-on-surface-variant">
                {filtersOpen ? "פתוח" : "לחצי לפתיחה"}
              </span>
            )}
          </span>
          <Icon
            name="expand_more"
            className={filtersOpen ? "rotate-180 text-primary" : "text-on-surface-variant"}
          />
        </button>
        {filtersOpen ? (
          <div className="flex flex-col gap-4 border-t border-outline-variant/30 px-4 py-4">
            <div className="relative">
              <Icon
                name="search"
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-outline-variant"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="שם, טלפון, מקצוע, מסלול או שנה"
                aria-busy={Boolean(query.trim()) || undefined}
                className="w-full rounded-full border border-outline bg-surface-container-lowest py-2 pl-4 pr-10 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none focus:ring-0"
              />
            </div>
            {query.trim() ? (
              <p className="font-caption text-caption text-primary" aria-live="polite">
                מחפשת «{query.trim()}» · {filtered.length} מורות
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SearchMultiSelect
                label="מקצועות"
                values={subjects}
                onChange={setSubjects}
                options={subjectOptions.map((label) => ({ value: label, label }))}
              />
              <SearchMultiSelect
                label="מסלולים"
                values={tracks}
                onChange={setTracks}
                options={trackOptions.map((label) => ({ value: label, label }))}
              />
              <SearchMultiSelect
                label="שנים"
                values={years}
                onChange={setYears}
                options={yearOptions.map((label) => ({ value: label, label }))}
              />
              <SearchMultiSelect
                label="סמסטרים"
                values={semesters}
                onChange={setSemesters}
                options={semesterOptions.map((label) => ({ value: label, label }))}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "הכול"],
                  ["synced", "מסונכרנות"],
                  ["local", "מקומיות"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setKind(value)}
                  className={
                    kind === value
                      ? "rounded-full bg-primary px-3 py-1 font-caption text-caption font-semibold text-white"
                      : "rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-1 font-caption text-caption text-on-surface"
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-title-lg text-title-lg text-primary">
          <Icon name="list_alt" className="text-primary-container" />
          רשימת מורות
          <span className="font-body-md text-body-md font-normal text-on-surface-variant">
            {filtered.length}
          </span>
        </h3>
      </div>

      <div className="min-w-0 flex-1 overflow-x-hidden">
        <table className="w-full table-fixed border-collapse text-right">
          <colgroup>
            <col className={viewOnly ? "w-[24%]" : "w-[22%]"} />
            <col className={viewOnly ? "w-[24%]" : "w-[22%]"} />
            <col className={viewOnly ? "w-[40%]" : "w-[38%]"} />
            <col className="w-[12%]" />
            {viewOnly ? null : <col className="w-[6%]" />}
          </colgroup>
          <thead>
            <tr className="border-b border-outline-variant bg-background text-on-surface-variant">
              {(viewOnly ? VIEW_HEADERS : HEADERS).map((h) => (
                <th
                  key={h || "actions"}
                  className="px-3 py-3 font-label-md text-label-md font-medium"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr
                key={t.id}
                className="group border-b border-surface-variant transition-colors hover:bg-surface-variant/50"
              >
                <td className="px-3 py-3">
                  <Link
                    href={`/teachers/${t.id}`}
                    className="break-words font-body-md text-body-md text-primary hover:underline"
                  >
                    {displayFamilyThenGiven(t)}
                  </Link>
                  <div className="mt-0.5 break-all font-caption text-caption text-on-surface-variant" dir="ltr">
                    {t.identity_number}
                  </div>
                </td>
                <td className="px-3 py-3 font-caption text-caption text-on-surface-variant">
                  <div className="break-all" dir="ltr">
                    {t.phone ?? "—"}
                  </div>
                  <div className="mt-0.5 break-all" dir="ltr" title={t.email ?? undefined}>
                    {t.email ?? "—"}
                  </div>
                </td>
                <td className="px-3 py-3 font-caption text-caption text-on-surface-variant">
                  <div className="break-words">
                    <span className="text-on-surface">{t.salarySubjects}</span>
                    {t.salaryTracks !== "—" ? ` · ${t.salaryTracks}` : ""}
                  </div>
                  <div className="mt-0.5 break-words">
                    {[
                      t.salaryGradeYears !== "—" ? t.salaryGradeYears : null,
                      t.salarySemesters !== "—" ? t.salarySemesters : null,
                      t.salaryMeetings !== "—" ? `${t.salaryMeetings} מפגשים` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <StatusPill tone={t.is_local ? "warn" : "ok"}>
                    {t.is_local ? "מקומית" : "מסונכרנת"}
                  </StatusPill>
                </td>
                {viewOnly ? null : (
                <td className="px-3 py-3 text-center">
                  <Link
                    href={`/teachers/${t.id}`}
                    className="inline-flex items-center rounded p-1 text-primary-container transition-colors hover:bg-surface-variant hover:text-primary"
                    aria-label={`עריכת ${displayFamilyThenGiven(t)}`}
                  >
                    <Icon name="edit" className="text-[20px]" />
                  </Link>
                </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="py-8 text-center font-body-md text-body-md text-on-surface-variant">
            לא נמצאו מורות לפי הסינון.
          </p>
        )}
      </div>
    </div>
  );
}
