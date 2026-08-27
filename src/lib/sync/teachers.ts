import { createClient } from "@/lib/supabase/server";
import { createSalaryReadClient } from "@/lib/sync/salary-client";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface SyncResult {
  teachersCreated: number;
  sourceRowsAdded: number;
  sourceRowsUpdated: number;
  skippedExisting: number;
  skippedInvalid: number;
}

type SalaryRow = {
  id?: string | number | null;
  teacher_name?: string | null;
  tz?: string | null;
  phone?: string | null;
  email?: string | null;
  subject?: string | null;
  track?: string | null;
  year?: string | null;
  semester?: string | null;
  meetings?: number | string | null;
  is_approved?: boolean | null;
};

function text(raw: unknown): string {
  return String(raw ?? "").trim();
}

function externalIdFor(row: SalaryRow): string {
  if (row.id != null && String(row.id).trim() !== "") {
    return `salary:${String(row.id).trim()}`;
  }
  return [
    "salary",
    text(row.tz),
    text(row.teacher_name),
    text(row.subject),
    text(row.track),
    text(row.year),
    text(row.semester),
  ].join(":");
}

function digits(raw: string | null | undefined): string {
  return String(raw ?? "").replace(/\D/g, "");
}

function teacherIdentity(row: SalaryRow): string {
  const tz = digits(row.tz);
  if (tz.length >= 5) return tz.padStart(9, "0").slice(-9);
  if (row.id != null && String(row.id).trim() !== "") return `salary:${row.id}`;
  return `salary:${text(row.teacher_name) || "unknown"}`;
}

function usablePhone(raw: string | null | undefined): string | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  const d = digits(raw);
  if (d.length >= 9) return d;
  return trimmed;
}

function usableEmail(raw: string | null | undefined): string | null {
  const email = String(raw ?? "").trim();
  return email || null;
}

function usableMeetings(raw: number | string | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function shouldImport(row: SalaryRow): boolean {
  if (row.is_approved === false) return false;
  return true;
}

function sourcePayload(row: SalaryRow, identity: string, fullName: string) {
  return {
    teacher_identity_number: identity,
    full_name: fullName,
    subject: text(row.subject) || "—",
    source_year: "salary",
    salary_subject: text(row.subject) || null,
    salary_track: text(row.track) || null,
    salary_grade_year: text(row.year) || null,
    salary_semester: text(row.semester) || null,
    salary_meetings: usableMeetings(row.meetings),
  };
}

/** Presence DB only — never the salary project. */
function isMissingPresenceSourceColumn(error: {
  message?: string;
  code?: string;
} | null): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const msg = error.message ?? "";
  return (
    code === "PGRST204" ||
    code === "42703" ||
    msg.includes("schema cache") ||
    /column .* does not exist/i.test(msg)
  );
}

function throwPresenceSourceError(
  error: { message?: string; code?: string } | null,
  fallback: string
): never {
  if (isMissingPresenceSourceColumn(error)) {
    throw new Error(
      "חסרות עמודות שיבוץ-שכר במסד הנוכחות. הריצי את supabase/patches/008_salary_teacher_source.sql בעורך SQL של פרויקט הנוכחות (לא של השכר), ואז Settings → API → Reload schema."
    );
  }
  throw new Error(fallback);
}

/** Pull salary rows. Never updates/deletes the salary system. Never deletes local teachers. */
export async function syncTeacherSourceRecords(
  supabaseClient?: SupabaseClient
): Promise<SyncResult> {
  const result: SyncResult = {
    teachersCreated: 0,
    sourceRowsAdded: 0,
    sourceRowsUpdated: 0,
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
      .select("id, teacher_name, tz, phone, email, subject, track, year, semester")
      .range(from, from + pageSize - 1);

    if (remoteError) {
      throw new Error("לא ניתן לקרוא מורות ממערכת השכר.");
    }

    const chunk = (remote ?? []) as SalaryRow[];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
  }

  const supabase = supabaseClient ?? (await createClient());

  // Only columns that existed before salary-field mapping. `teacher_id` was
  // added in patch 008; selecting it crashes if the presence schema cache is stale.
  const existingSource: { id: string; external_id: string }[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error: existingError } = await supabase
      .from("teacher_source_records")
      .select("id, external_id")
      .range(from, from + pageSize - 1);
    if (existingError) {
      throwPresenceSourceError(existingError, "קריאת רשומות מקור נכשלה.");
    }
    existingSource.push(...(data ?? []));
    if ((data ?? []).length < pageSize) break;
  }

  const existingByExternal = new Map(
    existingSource.map((r) => [r.external_id, r])
  );

  for (const row of rows) {
    if (!shouldImport(row)) {
      result.skippedInvalid++;
      continue;
    }

    const fullName = text(row.teacher_name);
    if (!fullName) {
      result.skippedInvalid++;
      continue;
    }

    const externalId = externalIdFor(row);
    const identity = teacherIdentity(row);
    const phone = usablePhone(row.phone);
    const email = usableEmail(row.email);
    const payload = sourcePayload(row, identity, fullName);

    let { data: teacher } = await supabase
      .from("teachers")
      .select("id, phone, email")
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
        .select("id, phone, email")
        .single();
      if (createError || !created) {
        result.skippedInvalid++;
        continue;
      }
      teacher = created;
      result.teachersCreated++;
    } else {
      const patch: { phone?: string | null; email?: string | null } = {};
      if (!teacher.phone && phone) patch.phone = phone;
      if (!teacher.email && email) patch.email = email;
      if (Object.keys(patch).length > 0) {
        await supabase.from("teachers").update(patch).eq("id", teacher.id);
      }
    }

    const existing = existingByExternal.get(externalId);
    if (existing) {
      const { error: updateError } = await supabase
        .from("teacher_source_records")
        .update({
          ...payload,
          teacher_id: teacher.id,
        })
        .eq("id", existing.id);
      if (updateError) {
        if (isMissingPresenceSourceColumn(updateError)) {
          throwPresenceSourceError(updateError, "עדכון רשומת מקור נכשל.");
        }
        result.skippedInvalid++;
        continue;
      }
      result.sourceRowsUpdated++;
      continue;
    }

    const { data: inserted, error: insertSourceError } = await supabase
      .from("teacher_source_records")
      .insert({
        external_id: externalId,
        teacher_id: teacher.id,
        ...payload,
      })
      .select("id")
      .single();
    if (insertSourceError || !inserted) {
      if (isMissingPresenceSourceColumn(insertSourceError)) {
        throwPresenceSourceError(insertSourceError, "הוספת רשומת מקור נכשלה.");
      }
      result.skippedInvalid++;
      continue;
    }
    result.sourceRowsAdded++;
    existingByExternal.set(externalId, {
      id: inserted.id,
      external_id: externalId,
    });
  }

  return result;
}
