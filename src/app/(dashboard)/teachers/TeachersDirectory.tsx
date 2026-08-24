"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { Table, TableRow, TableCell } from "@/components/ui/Table";
import type { Teacher } from "@/types/database";

export function TeachersDirectory({ teachers }: { teachers: Teacher[] }) {
  const [query, setQuery] = useState("");

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

  return (
    <div className="space-y-4">
      <Input
        placeholder='חיפוש לפי שם, ת"ז, טלפון או אימייל'
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <Table headers={["שם", 'ת"ז', "טלפון", "אימייל", ""]}>
        {filtered.map((t) => (
          <TableRow key={t.id}>
            <TableCell>{t.full_name}</TableCell>
            <TableCell>{t.identity_number}</TableCell>
            <TableCell>{t.phone}</TableCell>
            <TableCell>{t.email}</TableCell>
            <TableCell>
              <Link
                href={`/teachers/${t.id}`}
                className="text-sm font-medium text-[var(--brand)] hover:underline"
              >
                כרטיס
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </Table>
      {filtered.length === 0 && (
        <p className="text-center text-sm text-slate-500">לא נמצאו מורות לפי הסינון.</p>
      )}
    </div>
  );
}
