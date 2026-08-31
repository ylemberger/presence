/** Read salary-imported fields from dedicated columns or the original `payload` jsonb. */

export type SalaryDisplayFields = {
  subject: string | null;
  track: string | null;
  year: string | null;
  semester: string | null;
  meetings: number | null;
};

function asText(raw: unknown): string | null {
  const v = String(raw ?? "").trim();
  return v || null;
}

function asMeetings(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function fromPayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  return payload as Record<string, unknown>;
}

export function salaryDisplayFields(row: {
  subject?: string | null;
  salary_subject?: string | null;
  salary_track?: string | null;
  salary_grade_year?: string | null;
  salary_semester?: string | null;
  salary_meetings?: number | null;
  payload?: unknown;
}): SalaryDisplayFields {
  const p = fromPayload(row.payload);
  return {
    subject:
      asText(row.salary_subject) ||
      asText(p.salary_subject) ||
      asText(row.subject),
    track: asText(row.salary_track) || asText(p.salary_track),
    year: asText(row.salary_grade_year) || asText(p.salary_grade_year),
    semester: asText(row.salary_semester) || asText(p.salary_semester),
    meetings: asMeetings(row.salary_meetings) ?? asMeetings(p.salary_meetings),
  };
}

export function uniqueSalaryAssignments(
  fields: SalaryDisplayFields[]
): SalaryDisplayFields[] {
  const seen = new Set<string>();
  const out: SalaryDisplayFields[] = [];
  for (const f of fields) {
    const key = [f.subject, f.track, f.year, f.semester, f.meetings ?? ""].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

export function formatSalaryAssignment(f: SalaryDisplayFields): string {
  const parts = [
    f.subject,
    f.track,
    f.year,
    f.semester,
    f.meetings != null ? `${f.meetings} מפגשים` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "אין פרטי שכר";
}

export function salarySearchKeywords(fields: SalaryDisplayFields[]): string {
  return fields
    .flatMap((f) => [f.subject, f.track, f.year, f.semester])
    .filter((v): v is string => Boolean(v))
    .join(" ");
}
