"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Table, TableRow, TableCell } from "@/components/ui/Table";
import { StatusPill } from "@/components/ui/PageHeader";
import { StudentsForm } from "./StudentsForm";

interface StudentRow {
  id: string;
  full_name: string;
  identity_number: string;
  is_active: boolean;
  className: string;
  gradeName: string;
}

export function StudentsDirectory({ students }: { students: StudentRow[] }) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return students;
    return students.filter(
      (s) => s.full_name.includes(q) || s.identity_number.includes(q) || s.className.includes(q)
    );
  }, [query, students]);

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-[0_8px_30px_rgb(28,43,48,0.04)]">
      <div className="flex flex-wrap items-center gap-3 border-b border-stone-100 px-5 py-4">
        <div className="min-w-[16rem] flex-1">
          <Input
            placeholder="חיפוש לפי שם, תעודת זהות או כיתה"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button type="button" onClick={() => setAdding((v) => !v)}>
          {adding ? "סגירה" : "תלמידה חדשה"}
        </Button>
      </div>

      {adding && (
        <div className="border-b border-stone-100 bg-stone-50/70 px-5 py-4">
          <StudentsForm />
        </div>
      )}

      <Table headers={["תלמידה", 'ת"ז', "שכבה", "כיתה", "סטטוס", ""]}>
        {filtered.map((s) => (
          <TableRow key={s.id}>
            <TableCell>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand)]/10 text-sm font-semibold text-[var(--brand)]">
                  {s.full_name.slice(0, 1)}
                </span>
                <span className="font-medium text-slate-800">{s.full_name}</span>
              </div>
            </TableCell>
            <TableCell className="font-mono text-slate-500" dir="ltr">
              {s.identity_number}
            </TableCell>
            <TableCell>{s.gradeName}</TableCell>
            <TableCell>{s.className}</TableCell>
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
        <p className="px-5 py-8 text-center text-sm text-slate-500">לא נמצאו תלמידות תואמות.</p>
      )}
    </div>
  );
}
