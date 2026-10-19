import { createClient } from "@/lib/supabase/server";
import { createSalaryReadClient } from "@/lib/sync/salary-client";
import {
  displayIdentityNumber,
  displayTeacherEmail,
  displayTeacherPhone,
  storedEmail,
  storedPhone,
} from "@/lib/teachers/contact";
import { teacherNameKey } from "@/lib/teachers/name-group";
import { fetchAllPages } from "@/lib/supabase/paged";
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
  full_name?: string | null;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
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
    rowFullName(row),
    text(row.subject),
    text(row.track),
    text(row.year),
    text(row.semester),
  ].join(":");
}

function digits(raw: string | null | undefined): string {
  return String(raw ?? "").replace(/\D/g, "");
}

function rowFullName(row: SalaryRow): string {
  const direct = text(row.teacher_name) || text(row.full_name) || text(row.name);
  if (direct) return direct;
  return [text(row.first_name), text(row.last_name)].filter(Boolean).join(" ");
}

type SyncedTeacher = {
  id: string;
  phone: string | null;
  email: string | null;
  full_name: string;
  is_local: boolean;
  identity_number: string;
};

/** One teacher per name. A real identity number wins when the same name already exists. */
function preferNamedTeacher(current: SyncedTeacher, candidate: SyncedTeacher): SyncedTeacher {
  const currentId = displayIdentityNumber(current.identity_number);
  const candidateId = displayIdentityNumber(candidate.identity_number);
  if (candidateId && !currentId) return candidate;
  return current;
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

function isMissingColumnError(error: { message?: string; code?: string } | null): boolean {
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

/** Original presence columns only. Extra salary fields go in `payload` jsonb. */
function sourceRecordWrite(row: SalaryRow, identity: string, fullName: string) {
  return {
    teacher_identity_number: identity,
    full_name: fullName,
    subject: text(row.subject) || "—",
    source_year: "salary",
    payload: {
      salary_subject: text(row.subject) || null,
      salary_track: text(row.track) || null,
      salary_grade_year: text(row.year) || null,
      salary_semester: text(row.semester) || null,
      salary_meetings: usableMeetings(row.meetings),
    },
  };
}

/**
 * Pull every salary row that has a teacher name, including rows whose contract
 * is not approved yet. The same name is one teacher, even when salary has
 * several rows. Never updates or deletes the salary system.
 * Never deletes local teachers and never clears is_local.
 */
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
  const salarySelects = [
    "id, teacher_name, full_name, name, first_name, last_name, tz, phone, email, subject, track, year, semester, meetings, is_approved",
    "id, teacher_name, tz, phone, email, subject, track, year, semester, meetings, is_approved",
    "id, teacher_name, tz, phone, email, subject, track, year, semester, is_approved",
  ];
  let selectIndex = 0;
  for (let from = 0; ; from += pageSize) {
    const { data: remote, error: remoteError } = await salary.client
      .from("salary_records")
      .select(salarySelects[selectIndex])
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (remoteError) {
      if (from === 0 && selectIndex < salarySelects.length - 1 && isMissingColumnError(remoteError)) {
        selectIndex++;
        rows.length = 0;
        from = -pageSize;
        continue;
      }
      throw new Error("לא ניתן לקרוא מורות ממערכת השכר.");
    }

    const chunk = (remote ?? []) as SalaryRow[];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
  }

  const supabase = supabaseClient ?? (await createClient());

  const existingSource: { id: string; external_id: string }[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error: existingError } = await supabase
      .from("teacher_source_records")
      .select("id, external_id")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (existingError) {
      throw new Error("קריאת רשומות מקור נכשלה.");
    }
    existingSource.push(...(data ?? []));
    if ((data ?? []).length < pageSize) break;
  }

  const existingByExternal = new Map(
    existingSource.map((r) => [r.external_id, r])
  );

  const knownTeachers = await fetchAllPages<SyncedTeacher>((from, to) =>
    supabase
      .from("teachers")
      .select("id, phone, email, full_name, is_local, identity_number")
      .order("full_name", { ascending: true })
      .range(from, to)
  );
  const teachersByName = new Map<string, SyncedTeacher>();
  for (const known of knownTeachers) {
    const key = teacherNameKey(known.full_name);
    if (!key) continue;
    const previous = teachersByName.get(key);
    teachersByName.set(key, previous ? preferNamedTeacher(previous, known) : known);
  }

  for (const row of rows) {
    const fullName = rowFullName(row);
    const nameKey = teacherNameKey(fullName);
    if (!fullName || !nameKey) {
      result.skippedInvalid++;
      continue;
    }

    const externalId = externalIdFor(row);
    let teacher = teachersByName.get(nameKey);
    const identity = teacher?.identity_number ?? `name:${nameKey}`;
    const phone = usablePhone(row.phone);
    const email = usableEmail(row.email);
    const payload = sourceRecordWrite(row, identity, fullName);
    const phoneToStore = storedPhone(phone);
    const emailToStore = storedEmail(email, identity);

    if (!teacher) {
      const { data: created, error: createError } = await supabase
        .from("teachers")
        .insert({
          full_name: fullName,
          identity_number: identity,
          phone: phoneToStore,
          email: emailToStore,
          is_local: false,
        })
        .select("id, phone, email, full_name, is_local, identity_number")
        .single();
      if (createError || !created) {
        result.skippedInvalid++;
        continue;
      }
      teacher = created;
      teachersByName.set(nameKey, teacher);
      result.teachersCreated++;
    } else {
      const patch: { phone?: string; email?: string } = {};
      if (!displayTeacherPhone(teacher.phone) && displayTeacherPhone(phoneToStore)) {
        patch.phone = phoneToStore;
      }
      if (!displayTeacherEmail(teacher.email) && displayTeacherEmail(emailToStore)) {
        patch.email = emailToStore;
      }
      if (Object.keys(patch).length > 0) {
        await supabase.from("teachers").update(patch).eq("id", teacher.id);
      }
    }

    const sourceWrite = { ...payload, teacher_id: teacher.id };
    const existing = existingByExternal.get(externalId);
    if (existing) {
      let { error: updateError } = await supabase
        .from("teacher_source_records")
        .update(sourceWrite)
        .eq("id", existing.id);
      if (updateError && isMissingColumnError(updateError)) {
        const { payload: _ignored, teacher_id: _teacherId, ...coreOnly } = sourceWrite;
        ({ error: updateError } = await supabase
          .from("teacher_source_records")
          .update(coreOnly)
          .eq("id", existing.id));
      }
      if (updateError) {
        result.skippedInvalid++;
        continue;
      }
      result.sourceRowsUpdated++;
      continue;
    }

    let { data: inserted, error: insertSourceError } = await supabase
      .from("teacher_source_records")
      .insert({
        external_id: externalId,
        ...sourceWrite,
      })
      .select("id")
      .single();
    if (insertSourceError && isMissingColumnError(insertSourceError)) {
      const { payload: _ignored, teacher_id: _teacherId, ...coreOnly } = sourceWrite;
      ({ data: inserted, error: insertSourceError } = await supabase
        .from("teacher_source_records")
        .insert({
          external_id: externalId,
          ...coreOnly,
        })
        .select("id")
        .single());
    }
    if (insertSourceError || !inserted) {
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
