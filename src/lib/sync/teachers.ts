import { createClient } from "@/lib/supabase/server";
import { createSalaryReadClient } from "@/lib/sync/salary-client";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface SyncResult {
  teachersCreated: number;
  sourceRowsAdded: number;
  skippedExisting: number;
  skippedInvalid: number;
}

type SalaryRow = {
  id: string | number;
  teacher_name: string | null;
  tz: string | null;
  phone: string | null;
  email: string | null;
  subject: string | null;
  track: string | null;
  year: string | null;
  semester: string | null;
  meetings: number | string | null;
  is_approved: boolean | null;
};

function externalIdFor(salaryId: string | number): string {
  return `salary:${salaryId}`;
}

function digits(raw: string | null | undefined): string {
  return String(raw ?? "").replace(/\D/g, "");
}

function teacherIdentity(row: SalaryRow): string {
  const tz = digits(row.tz);
  if (tz.length >= 5) return tz.padStart(9, "0").slice(-9);
  return `salary:${row.id}`;
}

function usablePhone(raw: string | null | undefined): string | null {
  const d = digits(raw);
  if (d.length >= 9) return d;
  const trimmed = String(raw ?? "").trim();
  return trimmed.length >= 9 ? trimmed : null;
}

function usableEmail(raw: string | null | undefined): string | null {
  const email = String(raw ?? "").trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return email;
  return null;
}

function usableMeetings(raw: number | string | null | undefined): number | null {
  const n = typeof raw === "number" ? raw : Number(String(raw ?? "").trim());
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

/** Pull approved salary rows. Never updates/deletes the salary system. Never deletes local teachers. */
export async function syncTeacherSourceRecords(
  supabaseClient?: SupabaseClient
): Promise<SyncResult> {
  const result: SyncResult = {
    teachersCreated: 0,
    sourceRowsAdded: 0,
    skippedExisting: 0,
    skippedInvalid: 0,
  };

  const salary = createSalaryReadClient();
  if ("error" in salary) throw new Error(salary.error);

  const rows: SalaryRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data: remote, error: remoteError } = await salary.client
      .from("salary_records")
      .select("id, teacher_name, tz, phone, email, subject, track, year, semester, meetings, is_approved")
      .eq("is_approved", true)
      .range(from, from + pageSize - 1);

    if (remoteError) {
      throw new Error("לא ניתן לקרוא מורות ממערכת השכר.");
    }

    const chunk = (remote ?? []) as SalaryRow[];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
  }

  const supabase = supabaseClient ?? (await createClient());

  const { data: existingSource, error: existingError } = await supabase
    .from("teacher_source_records")
    .select("external_id");
  if (existingError) throw new Error("קריאת רשומות מקור נכשלה.");

  const already = new Set((existingSource ?? []).map((r) => r.external_id));

  for (const row of rows) {
    const externalId = externalIdFor(row.id);
    if (already.has(externalId)) {
      result.skippedExisting++;
      continue;
    }

    const fullName = String(row.teacher_name ?? "").trim();
    if (!fullName) {
      result.skippedInvalid++;
      continue;
    }

    const identity = teacherIdentity(row);
    const phone = usablePhone(row.phone);
    const email = usableEmail(row.email);
    const salarySubject = String(row.subject ?? "").trim();
    const salaryTrack = String(row.track ?? "").trim();
    const salaryGradeYear = String(row.year ?? "").trim();
    const salarySemester = String(row.semester ?? "").trim();
    const salaryMeetings = usableMeetings(row.meetings);

    let { data: teacher } = await supabase
      .from("teachers")
      .select("id")
      .eq("identity_number", identity)
      .maybeSingle();

    if (!teacher) {
      const { data: created, error: createError } = await supabase
        .from("teachers")
        .insert({
          full_name: fullName,
          identity_number: identity,
          phone,
          email,
          is_local: false,
        })
        .select("id")
        .single();
      if (createError || !created) {
        result.skippedInvalid++;
        continue;
      }
      teacher = created;
      result.teachersCreated++;
    }

    const { error: insertSourceError } = await supabase.from("teacher_source_records").insert({
      external_id: externalId,
      teacher_identity_number: identity,
      full_name: fullName,
      subject: salarySubject || "—",
      source_year: "salary",
      teacher_id: teacher.id,
      salary_subject: salarySubject || null,
      salary_track: salaryTrack || null,
      salary_grade_year: salaryGradeYear || null,
      salary_semester: salarySemester || null,
      salary_meetings: salaryMeetings,
    });
    if (insertSourceError) {
      result.skippedInvalid++;
      continue;
    }
    result.sourceRowsAdded++;
    already.add(externalId);
  }

  return result;
}
