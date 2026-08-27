"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/ui/PageHeader";
import { Icon } from "@/components/ui/Icon";

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

const PREVIEW_LIMIT = 50;

const HEADERS = [
  "שם המורה",
  'ת"ז',
  "טלפון",
  "אימייל",
  "מקצוע",
  "מסלול",
  "שנה",
  "סמסטר",
  "מפגשים",
  "סטטוס",
  "פעולות",
] as const;

export function TeachersDirectory({ teachers }: { teachers: TeacherDirectoryRow[] }) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return teachers;
    return teachers.filter(
      (t) =>
        t.full_name.includes(q) ||
        t.identity_number.includes(q) ||
        (t.phone ?? "").includes(q) ||
        (t.email ?? "").includes(q) ||
        t.salarySubjects.includes(q) ||
        t.salaryTracks.includes(q) ||
        t.salaryGradeYears.includes(q) ||
        t.salarySemesters.includes(q)
    );
  }, [teachers, query]);

  const visible = showAll ? filtered : filtered.slice(0, PREVIEW_LIMIT);

  return (
    <div className="flex h-full flex-col rounded-xl bg-surface-container-lowest p-stack_md shadow-tactile-md">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-title-lg text-title-lg text-primary">
          <Icon name="list_alt" className="text-primary-container" />
          רשימת מורות
        </h3>
        <div className="relative w-full max-w-64">
          <Icon name="search" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-outline-variant" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש מורה..."
            className="w-full rounded-full border border-outline bg-surface-container-lowest py-2 pl-4 pr-10 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none focus:ring-0"
          />
        </div>
      </div>

      <div className="flex-1 overflow-x-auto">
        <table className="w-full min-w-[64rem] border-collapse text-right">
          <thead>
            <tr className="border-b border-outline-variant bg-background text-on-surface-variant">
              {HEADERS.map((h) => (
                <th
                  key={h}
                  className="whitespace-nowrap px-3 py-3 font-label-md text-label-md font-medium"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((t) => (
              <tr
                key={t.id}
                className="group border-b border-surface-variant transition-colors hover:bg-surface-variant/50"
              >
                <td className="whitespace-nowrap px-3 py-3 font-body-md text-body-md text-on-surface">
                  {t.full_name}
                </td>
                <td
                  className="whitespace-nowrap px-3 py-3 font-body-md text-body-md text-on-surface-variant"
                  dir="ltr"
                >
                  {t.identity_number}
                </td>
                <td
                  className="whitespace-nowrap px-3 py-3 font-body-md text-body-md text-on-surface-variant"
                  dir="ltr"
                >
                  {t.phone ?? "—"}
                </td>
                <td
                  className="max-w-[10rem] truncate px-3 py-3 font-body-md text-body-md text-on-surface-variant"
                  dir="ltr"
                  title={t.email ?? undefined}
                >
                  {t.email ?? "—"}
                </td>
                <td className="px-3 py-3 font-body-md text-body-md text-on-surface-variant">
                  {t.salarySubjects}
                </td>
                <td className="px-3 py-3 font-body-md text-body-md text-on-surface-variant">
                  {t.salaryTracks}
                </td>
                <td className="whitespace-nowrap px-3 py-3 font-body-md text-body-md text-on-surface-variant">
                  {t.salaryGradeYears}
                </td>
                <td className="whitespace-nowrap px-3 py-3 font-body-md text-body-md text-on-surface-variant">
                  {t.salarySemesters}
                </td>
                <td className="whitespace-nowrap px-3 py-3 font-body-md text-body-md text-on-surface-variant">
                  {t.salaryMeetings}
                </td>
                <td className="px-3 py-3">
                  <StatusPill tone={t.is_local ? "warn" : "ok"}>
                    {t.is_local ? "מקומית" : "מסונכרנת"}
                  </StatusPill>
                </td>
                <td className="px-3 py-3 text-center">
                  <Link
                    href={`/teachers/${t.id}`}
                    className="inline-flex items-center rounded p-1 text-primary-container transition-colors hover:bg-surface-variant hover:text-primary"
                    aria-label={`עריכת ${t.full_name}`}
                  >
                    <Icon name="edit" className="text-[20px]" />
                  </Link>
                </td>
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

      {filtered.length > PREVIEW_LIMIT && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-4 w-full text-center font-label-md text-label-md text-secondary hover:underline"
        >
          {showAll ? "הצג פחות" : "הצג הכל"}
        </button>
      )}
    </div>
  );
}
