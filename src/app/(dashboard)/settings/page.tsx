import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { getActiveAcademicYear, getAllAcademicYears } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import {
  createAcademicYearAction,
  createGradeAction,
  createClassAction,
  createTrackAction,
  createSpecializationAction,
  createActivityRangeAction,
  createAttendanceRuleAction,
  deleteAcademicYearAction,
  deleteGradeAction,
  deleteClassAction,
  deleteTrackAction,
  deleteSpecializationAction,
  deleteActivityRangeAction,
  deleteAttendanceRuleAction,
  updateAcademicYearAction,
  updateGradeAction,
  updateClassAction,
  updateTrackAction,
  updateSpecializationAction,
  updateActivityRangeAction,
  updateAttendanceRuleAction,
} from "../actions";
import { SettingsForms } from "./SettingsForms";
import {
  EditableActivityRangeRow,
  EditableAttendanceRuleRow,
  EditableClassRow,
  EditableGradeRow,
  EditableNameRow,
  EditableYearRow,
} from "./EditableRows";
import { ensureFixedGrades, filterFixedGrades, isFixedGradeName } from "@/lib/years/promote";

export default async function SettingsPage() {
  const activeYear = await getActiveAcademicYear();
  const years = await getAllAcademicYears();
  const supabase = await createClient();
  const yearId = activeYear?.id;

  if (yearId) {
    await ensureFixedGrades(yearId);
  }

  const [grades, classes, tracks, specializations, ranges, rules] = yearId
    ? await Promise.all([
        supabase.from("grades").select("*").eq("academic_year_id", yearId).order("name"),
        supabase.from("classes").select("*, grades(name)").eq("academic_year_id", yearId).order("name"),
        supabase.from("tracks").select("*").eq("academic_year_id", yearId).order("name"),
        supabase.from("specializations").select("*").eq("academic_year_id", yearId).order("name"),
        supabase.from("activity_ranges").select("*").eq("academic_year_id", yearId).order("start_date"),
        supabase.from("attendance_rules").select("*").order("name"),
      ])
    : [
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
      ];

  const allGrades = grades.data ?? [];
  const fixedGrades = filterFixedGrades(allGrades);
  const invalidGrades = allGrades.filter((g) => !isFixedGradeName(g.name));

  const yearPanel = (
    <Card title="שנים אקדמיות">
      <SettingsForms type="academic_year" yearId={yearId} createAction={createAcademicYearAction} />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50/90">
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">שם</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">סטטוס</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {years.map((y) => (
              <EditableYearRow
                key={y.id}
                id={y.id}
                name={y.name}
                isActive={y.is_active}
                updateAction={updateAcademicYearAction}
                deleteAction={deleteAcademicYearAction}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );

  const structurePanel = yearId ? (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="שכבות">
        <p className="mb-2 text-xs text-slate-500">
          מותרות רק שלוש שכבות: <strong>א</strong>, <strong>ב</strong>, <strong>ג</strong>.
          לא &quot;שנה א&quot; ולא שמות חופשיים. כיתה חייבת להיות משויכת לאחת מהן.
        </p>
        <SettingsForms
          type="grade"
          yearId={yearId}
          grades={allGrades}
          createAction={createGradeAction}
        />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/90">
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">שם</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {fixedGrades.map((g) => (
                <EditableGradeRow
                  key={g.id}
                  id={g.id}
                  name={g.name}
                  updateAction={updateGradeAction}
                  deleteAction={deleteGradeAction}
                />
              ))}
              {invalidGrades.map((g) => (
                <EditableGradeRow
                  key={g.id}
                  id={g.id}
                  name={g.name}
                  updateAction={updateGradeAction}
                  deleteAction={deleteGradeAction}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="כיתות">
        <p className="mb-2 text-xs text-slate-500">
          שם הכיתה חופשי (למשל 1), אבל השכבה חייבת להיות א / ב / ג בלבד.
        </p>
        <SettingsForms
          type="class"
          yearId={yearId}
          grades={fixedGrades}
          createAction={createClassAction}
        />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/90">
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">שם</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">שכבה</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(classes.data ?? []).map((c) => (
                <EditableClassRow
                  key={c.id}
                  id={c.id}
                  name={c.name}
                  gradeId={c.grade_id}
                  gradeName={(c.grades as unknown as { name: string } | null)?.name ?? ""}
                  grades={fixedGrades}
                  updateAction={updateClassAction}
                  deleteAction={deleteClassAction}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="מסלולים">
        <SettingsForms type="track" yearId={yearId} createAction={createTrackAction} />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/90">
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">שם</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(tracks.data ?? []).map((t) => (
                <EditableNameRow
                  key={t.id}
                  id={t.id}
                  name={t.name}
                  updateAction={updateTrackAction}
                  deleteAction={deleteTrackAction}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="התמחויות">
        <SettingsForms type="specialization" yearId={yearId} createAction={createSpecializationAction} />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/90">
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">שם</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(specializations.data ?? []).map((s) => (
                <EditableNameRow
                  key={s.id}
                  id={s.id}
                  name={s.name}
                  updateAction={updateSpecializationAction}
                  deleteAction={deleteSpecializationAction}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  ) : (
    <Card>
      <p className="text-slate-600">צרי שנה אקדמית פעילה כדי להגדיר שכבות, כיתות ומסלולים.</p>
    </Card>
  );

  const rangesPanel = yearId ? (
    <Card title="טווחי פעילות">
      <SettingsForms type="activity_range" yearId={yearId} createAction={createActivityRangeAction} />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50/90">
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">שם</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">סוג</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">מתאריך</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">עד תאריך</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(ranges.data ?? []).map((r) => (
              <EditableActivityRangeRow
                key={r.id}
                id={r.id}
                name={r.name}
                rangeType={r.range_type}
                startDate={r.start_date}
                endDate={r.end_date}
                updateAction={updateActivityRangeAction}
                deleteAction={deleteActivityRangeAction}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  ) : (
    <Card>
      <p className="text-slate-600">צרי שנה אקדמית פעילה תחילה.</p>
    </Card>
  );

  const rulesPanel = (
    <Card title="כללי נוכחות">
      <p className="mb-3 text-xs text-slate-500">
        לכל שיעור משויך כלל עם סף היעדרות מקסימלי (למשל 1% לעזרה ראשונה, 10% לבטיחות, 20% רגיל).
        איחור נספר כנוכחות; חריגה מהסף מסומנת בכרטיס תלמידה ובדוחות.
      </p>
      <SettingsForms type="attendance_rule" createAction={createAttendanceRuleAction} />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50/90">
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">שם</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">סף היעדרות</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(rules.data ?? []).map((r) => (
              <EditableAttendanceRuleRow
                key={r.id}
                id={r.id}
                name={r.name}
                maxPercent={r.max_allowed_absence_percent}
                updateAction={updateAttendanceRuleAction}
                deleteAction={deleteAttendanceRuleAction}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );

  return (
    <div>
      <PageHeader
        title="הגדרות מוסד"
        description="שנה, שכבות, כיתות, מסלולים, טווחי פעילות וכללי היעדרות. ניתן להוסיף ולערוך."
      />
      <Tabs
        tabs={[
          { id: "year", label: "שנים", content: yearPanel },
          { id: "structure", label: "שכבות וכיתות", content: structurePanel },
          { id: "ranges", label: "טווחי פעילות", content: rangesPanel },
          { id: "rules", label: "כללי נוכחות", content: rulesPanel },
        ]}
      />
    </div>
  );
}
