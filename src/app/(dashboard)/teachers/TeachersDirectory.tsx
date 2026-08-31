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

const HEADERS = ["מורה", "קשר", "שיבוצי שכר", "סטטוס", ""] as const;

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
    <div className="flex h-full min-w-0 flex-col overflow-x-hidden rounded-xl bg-surface-container-lowest p-stack_md shadow-tactile-md">
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

      <div className="min-w-0 flex-1 overflow-x-hidden">
        <table className="w-full table-fixed border-collapse text-right">
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[22%]" />
            <col className="w-[38%]" />
            <col className="w-[12%]" />
            <col className="w-[6%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-outline-variant bg-background text-on-surface-variant">
              {HEADERS.map((h) => (
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
            {visible.map((t) => (
              <tr
                key={t.id}
                className="group border-b border-surface-variant transition-colors hover:bg-surface-variant/50"
              >
                <td className="px-3 py-3">
                  <div className="break-words font-body-md text-body-md text-on-surface">
                    {t.full_name}
                  </div>
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
