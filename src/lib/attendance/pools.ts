import type { createClient } from "@/lib/supabase/server";
import { audienceFingerprint } from "@/lib/lessons/group-label";
import type { LessonAudienceIds } from "@/lib/lessons/autoAssign";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type AttendancePoolRow = { id: string; name: string };
export type AttendancePoolMemberRow = { pool_id: string; lesson_id: string };

export type CalcUnit = {
  key: string;
  poolId: string | null;
  poolName: string | null;
};

export type PoolCatalog = {
  pools: AttendancePoolRow[];
  members: AttendancePoolMemberRow[];
  byLesson: Map<string, CalcUnit>;
};

const EMPTY_CATALOG: PoolCatalog = {
  pools: [],
  members: [],
  byLesson: new Map(),
};

export function calcUnitForLesson(
  lessonId: string,
  byLesson: Map<string, CalcUnit>
): CalcUnit {
  return (
    byLesson.get(lessonId) ?? {
      key: `lesson:${lessonId}`,
      poolId: null,
      poolName: null,
    }
  );
}

export function lessonIdsInCalcUnit(
  lessonId: string,
  catalog: PoolCatalog
): string[] {
  const unit = calcUnitForLesson(lessonId, catalog.byLesson);
  if (!unit.poolId) return [lessonId];
  return catalog.members.filter((m) => m.pool_id === unit.poolId).map((m) => m.lesson_id);
}

export function fingerprintForLesson(
  audience: LessonAudienceIds,
  forPsychology: boolean
): string {
  return audienceFingerprint({
    gradeIds: audience.grade_ids,
    classIds: audience.class_ids,
    trackIds: audience.track_ids,
    specializationIds: audience.specialization_ids,
    forPsychology,
  });
}

export function buildPoolCatalog(
  pools: AttendancePoolRow[] | null | undefined,
  members: AttendancePoolMemberRow[] | null | undefined
): PoolCatalog {
  const poolList = pools ?? [];
  const memberList = members ?? [];
  const nameById = new Map(poolList.map((p) => [p.id, p.name]));
  const byLesson = new Map<string, CalcUnit>();
  for (const m of memberList) {
    const name = nameById.get(m.pool_id) ?? "קיבוץ נוכחות";
    byLesson.set(m.lesson_id, {
      key: `pool:${m.pool_id}`,
      poolId: m.pool_id,
      poolName: name,
    });
  }
  return { pools: poolList, members: memberList, byLesson };
}

/** טבלאות חדשות — אם עדיין לא הורץ 015, מחזיר ריק בלי להפיל את המסך. */
export async function fetchAttendancePools(
  supabase: Supabase,
  academicYearId: string
): Promise<PoolCatalog> {
  const [{ data: pools, error: poolError }, { data: members, error: memberError }] =
    await Promise.all([
      supabase
        .from("attendance_pools")
        .select("id, name")
        .eq("academic_year_id", academicYearId)
        .order("name"),
      supabase.from("attendance_pool_members").select("pool_id, lesson_id"),
    ]);

  if (poolError || memberError) return EMPTY_CATALOG;
  return buildPoolCatalog(pools, members);
}
