"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

export type TeacherLessonRow = {
  id: string;
  teacherName: string;
  subject: string;
  typeLabel: string;
  grade: string;
  audience: string;
};

export function TeachersLessons({ rows }: { rows: TeacherLessonRow[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.teacherName.includes(q) ||
        r.subject.includes(q) ||
        r.grade.includes(q) ||
        r.audience.includes(q)
    );
  }, [rows, query]);

  return (
    <div className="rounded-xl bg-surface-container-lowest p-stack_md shadow-tactile-md">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-title-lg text-title-lg text-primary">
          <Icon name="menu_book" className="text-primary" />
          שיעורים לפי מורה
        </h3>
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 font-label-md text-label-md text-primary hover:bg-surface-container-low"
          >
            <Icon name="tune" className="text-[18px]" />
            סינון
          </button>
          {open && (
            <div className="absolute left-0 top-full z-10 mt-2 w-64 rounded-lg border border-outline-variant bg-surface-container-lowest p-3 shadow-tactile-md">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="מורה / מקצוע / שכבה..."
                className="w-full rounded-lg border border-outline px-3 py-2 font-body-md text-body-md text-on-surface focus:border-primary focus:outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-outline-variant/50 px-4 py-8 text-center">
          <p className="font-body-md text-body-md text-on-surface-variant">
            עדיין אין שיעורים בשנה זו.
          </p>
          <Link
            href="/lessons"
            className="mt-2 inline-block font-label-md text-label-md text-secondary hover:underline"
          >
            מעבר ליצירת שיעור
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-right">
            <thead>
              <tr className="border-b border-outline-variant bg-background text-on-surface-variant">
                {["מורה", "מקצוע", "סוג", "כיתה/שכבה", "קהל יעד"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 font-label-md text-label-md font-medium"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-surface-variant transition-colors hover:bg-surface-variant/50"
                >
                  <td className="px-4 py-3 font-label-md text-label-md text-primary">
                    {r.teacherName}
                  </td>
                  <td className="px-4 py-3 font-body-md text-body-md text-on-surface">
                    {r.subject}
                  </td>
                  <td className="px-4 py-3 font-body-md text-body-md text-on-surface-variant">
                    {r.typeLabel}
                  </td>
                  <td className="px-4 py-3 font-body-md text-body-md text-on-surface-variant">
                    {r.grade}
                  </td>
                  <td className="px-4 py-3 font-body-md text-body-md text-on-surface-variant">
                    {r.audience}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
