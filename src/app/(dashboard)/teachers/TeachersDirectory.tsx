"use client";

import { useMemo, useState } from "react";
import { Input, Select } from "@/components/ui/Input";
import { Table, TableRow, TableCell } from "@/components/ui/Table";
import type { Teacher } from "@/types/database";

export function TeachersDirectory({ teachers }: { teachers: Teacher[] }) {
  const [query, setQuery] = useState("");
  const [localOnly, setLocalOnly] = useState<"all" | "local" | "synced">("all");

  const filtered = useMemo(() => {
    const q = query.trim();
    return teachers.filter((t) => {
      if (localOnly === "local" && !t.is_local) return false;
      if (localOnly === "synced" && t.is_local) return false;
      if (!q) return true;
      return (
        t.full_name.includes(q) ||
        t.identity_number.includes(q) ||
        (t.phone ?? "").includes(q) ||
        (t.email ?? "").includes(q)
      );
    });
  }, [teachers, query, localOnly]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Input
          placeholder='חיפוש לפי שם, ת"ז, טלפון או אימייל'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select
          label="מקור"
          value={localOnly}
          onChange={(e) => setLocalOnly(e.target.value as typeof localOnly)}
          options={[
            { value: "all", label: "הכל" },
            { value: "local", label: "מקומיות" },
            { value: "synced", label: "מסונכרנות" },
          ]}
        />
      </div>
      <Table headers={["שם", 'ת"ז', "טלפון", "אימייל", "מקומית"]}>
        {filtered.map((t) => (
          <TableRow key={t.id}>
            <TableCell>{t.full_name}</TableCell>
            <TableCell>{t.identity_number}</TableCell>
            <TableCell>{t.phone}</TableCell>
            <TableCell>{t.email}</TableCell>
            <TableCell>{t.is_local ? "כן" : "לא"}</TableCell>
          </TableRow>
        ))}
      </Table>
      {filtered.length === 0 && (
        <p className="text-center text-sm text-slate-500">לא נמצאו מורות לפי הסינון.</p>
      )}
    </div>
  );
}
