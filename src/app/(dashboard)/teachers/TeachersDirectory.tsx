"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/ui/PageHeader";
import type { Teacher } from "@/types/database";
import { Icon } from "@/components/ui/Icon";

const PREVIEW_LIMIT = 6;

export function TeachersDirectory({ teachers }: { teachers: Teacher[] }) {
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
        (t.email ?? "").includes(q)
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
        <table className="w-full border-collapse text-right">
          <thead>
            <tr className="border-b border-outline-variant bg-background text-on-surface-variant">
              {["שם המורה", 'ת"ז', "טלפון", "סטטוס", "פעולות"].map((h) => (
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
            {visible.map((t) => (
              <tr
                key={t.id}
                className="group border-b border-surface-variant transition-colors hover:bg-surface-variant/50"
              >
                <td className="px-4 py-3 font-body-md text-body-md text-on-surface">
                  {t.full_name}
                </td>
                <td
                  className="px-4 py-3 font-body-md text-body-md text-on-surface-variant"
                  dir="ltr"
                >
                  {t.identity_number}
                </td>
                <td
                  className="px-4 py-3 font-body-md text-body-md text-on-surface-variant"
                  dir="ltr"
                >
                  {t.phone ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <StatusPill tone={t.is_local ? "warn" : "ok"}>
                    {t.is_local ? "מקומית" : "מסונכרנת"}
                  </StatusPill>
                </td>
                <td className="px-4 py-3 text-center">
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
