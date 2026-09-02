import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { Tabs } from "@/components/ui/Tabs";
import { getActiveAcademicYear, getAllAcademicYears } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import {
  createAcademicYearAction,
  createGradeAction,
  createClassAction,
  createTrackAction,
  createSpecializationAction,
  createSubjectAction,
  createActivityRangeAction,
  createAttendanceRuleAction,
  deleteAcademicYearAction,
  deleteGradeAction,
  deleteClassAction,
  deleteTrackAction,
  deleteSpecializationAction,
  deleteSubjectAction,
  deleteActivityRangeAction,
  deleteAttendanceRuleAction,
  updateAcademicYearAction,
  updateGradeAction,
  updateClassAction,
  updateTrackAction,
  updateSpecializationAction,
  updateSubjectAction,
  updateActivityRangeAction,
  updateAttendanceRuleAction,
} from "../actions";
import { SettingsForms } from "./SettingsForms";
import { HolidayCalendar } from "./HolidayCalendar";
import { RepairPromotionsButton } from "./RepairPromotionsButton";
import {
  EditableActivityRangeRow,
  EditableAttendanceRuleRow,
  EditableClassRow,
  EditableGradeRow,
  EditableNameRow,
  EditableYearRow,
} from "./EditableRows";
import { ensureFixedGrades } from "@/lib/years/promote";
import { filterFixedGrades, isFixedGradeName } from "@/lib/years/grades";
import { isMissingHolidayTable } from "@/lib/lessons/holidays";

/** Shared thead row for the inline editable tables — matches Stitch table headers. */
function SettingsTableHead({ columns }: { columns: string[] }) {
  return (
    <thead className="border-b border-outline-variant/30 bg-surface-container-low">
      <tr>
        {columns.map((col) => (
          <th
            key={col}
            className="px-4 py-3 text-right font-label-md text-label-md text-on-surface-variant"
          >
            {col}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export default async function SettingsPage() {
  const activeYear = await getActiveAcademicYear();
  const years = await getAllAcademicYears();
  const supabase = await createClient();
  const yearId = activeYear?.id;

  if (yearId) {
    await ensureFixedGrades(yearId);
  }

  const [grades, classes, tracks, specializations, subjects, ranges, holidays, rules] = yearId
    ? await Promise.all([
        supabase.from("grades").select("*").eq("academic_year_id", yearId).order("name"),
        supabase
          .from("classes")
          .select("*, grades(name)")
          .eq("academic_year_id", yearId)
          .order("name"),
        supabase.from("tracks").select("*").eq("academic_year_id", yearId).order("name"),
        supabase
          .from("specializations")
          .select("*")
          .eq("academic_year_id", yearId)
          .order("name"),
        supabase.from("subjects").select("*").eq("academic_year_id", yearId).order("name"),
        supabase
          .from("activity_ranges")
          .select("*")
          .eq("academic_year_id", yearId)
          .order("start_date"),
        supabase
          .from("holiday_periods")
          .select("*")
          .eq("academic_year_id", yearId)
          .order("start_date"),
        supabase.from("attendance_rules").select("*").order("name"),
      ])
    : [
        { data: [] },
        { data: [] },
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
    <div className="grid grid-cols-1 gap-gutter lg:grid-cols-12">
      <div className="lg:col-span-4">
        <Section icon="add_circle" title="הוספת שנה חדשה" accent="featured">
          <SettingsForms
            type="academic_year"
            yearId={yearId}
            createAction={createAcademicYearAction}
          />
        </Section>
      </div>
      <div className="lg:col-span-8">
        <Section icon="calendar_today" title="רשימת שנים אקדמיות" bodyBleed>
          <div className="overflow-x-auto">
            <table className="w-full text-body-md">
              <SettingsTableHead columns={["שם", "סטטוס", "פעולות"]} />
              <tbody className="divide-y divide-outline-variant/25">
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
        </Section>
        <Section icon="history" title="שחזור שיבוצים אחרי קידום" className="mt-gutter">
          <RepairPromotionsButton />
        </Section>
      </div>
    </div>
  );

  const structurePanel = yearId ? (
    <div className="grid grid-cols-1 gap-gutter lg:grid-cols-2">
      <Section icon="stairs" title="שכבות">
        <p className="mb-3 font-caption text-caption text-on-surface-variant">
          מותרות רק שלוש שכבות: <strong>א</strong>, <strong>ב</strong>,{" "}
          <strong>ג</strong>. כיתה חייבת להיות משויכת לאחת מהן.
        </p>
        <SettingsForms
          type="grade"
          yearId={yearId}
          grades={allGrades}
          createAction={createGradeAction}
        />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-body-md">
            <SettingsTableHead columns={["שם", "פעולות"]} />
            <tbody className="divide-y divide-outline-variant/25">
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
      </Section>
      <Section icon="meeting_room" title="כיתות">
        <p className="mb-3 font-caption text-caption text-on-surface-variant">
          שם הכיתה חופשי (למשל 1), אבל השכבה חייבת להיות א / ב / ג בלבד.
        </p>
        <SettingsForms
          type="class"
          yearId={yearId}
          grades={fixedGrades}
          createAction={createClassAction}
        />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-body-md">
            <SettingsTableHead columns={["שם", "שכבה", "פעולות"]} />
            <tbody className="divide-y divide-outline-variant/25">
              {(classes.data ?? []).map((c) => (
                <EditableClassRow
                  key={c.id}
                  id={c.id}
                  name={c.name}
                  gradeId={c.grade_id}
                  gradeName={
                    (c.grades as unknown as { name: string } | null)?.name ?? ""
                  }
                  grades={fixedGrades}
                  updateAction={updateClassAction}
                  deleteAction={deleteClassAction}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section icon="route" title="מסלולים">
        <SettingsForms type="track" yearId={yearId} createAction={createTrackAction} />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-body-md">
            <SettingsTableHead columns={["שם", "פעולות"]} />
            <tbody className="divide-y divide-outline-variant/25">
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
      </Section>
      <Section icon="workspace_premium" title="התמחויות">
        <SettingsForms
          type="specialization"
          yearId={yearId}
          createAction={createSpecializationAction}
        />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-body-md">
            <SettingsTableHead columns={["שם", "פעולות"]} />
            <tbody className="divide-y divide-outline-variant/25">
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
      </Section>
      <Section icon="menu_book" title="מקצועות">
        <p className="mb-3 font-caption text-caption text-on-surface-variant">
          מקצוע הוא הרמה שמעל השיעור: למשל «יסודות הבית» ותחתיו שיעורי בישול, כביסה
          וגיהוץ. אחוז הנוכחות מחושב לכל השיעורים שתחת אותו מקצוע יחד.
        </p>
        <SettingsForms type="subject" yearId={yearId} createAction={createSubjectAction} />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-body-md">
            <SettingsTableHead columns={["שם", "פעולות"]} />
            <tbody className="divide-y divide-outline-variant/25">
              {(subjects.data ?? []).map((s) => (
                <EditableNameRow
                  key={s.id}
                  id={s.id}
                  name={s.name}
                  updateAction={updateSubjectAction}
                  deleteAction={deleteSubjectAction}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  ) : (
    <Section>
      <p className="text-body-md text-on-surface-variant">
        צרי שנה אקדמית פעילה כדי להגדיר שכבות, כיתות ומסלולים.
      </p>
    </Section>
  );

  const rangesPanel = yearId ? (
    <Section icon="date_range" title="טווחי פעילות" bodyBleed>
      <div className="p-6">
        <p className="mb-4 font-caption text-caption text-on-surface-variant">
          טווח הפעילות של השיעור — שנתי, סמסטר או קורס קצר. אפשר לבחור יום אחד בלבד
          (לחיצה פעמיים על אותו תאריך, או «יום אחד בלבד»). מופעים נוצרים מתוך השיעור
          והטווח; ימי חופשה בלוח החופשות לא נכללים.
        </p>
        <SettingsForms
          type="activity_range"
          yearId={yearId}
          createAction={createActivityRangeAction}
        />
      </div>
      <div className="overflow-x-auto border-t border-outline-variant/30">
        <table className="w-full text-body-md">
          <SettingsTableHead
            columns={["שם", "סוג", "מתאריך", "עד תאריך", "פעולות"]}
          />
          <tbody className="divide-y divide-outline-variant/25">
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
    </Section>
  ) : (
    <Section>
      <p className="text-body-md text-on-surface-variant">צרי שנה אקדמית פעילה תחילה.</p>
    </Section>
  );

  const holidaysMissing = isMissingHolidayTable(holidays.error ?? null);

  const holidaysPanel = yearId ? (
    <Section icon="event_busy" title="לוח חופשות" bodyBleed>
      {holidaysMissing ? (
        <div className="space-y-3 p-6">
          <p className="font-body-md text-body-md text-on-surface">
            טבלת החופשות עדיין לא קיימת במסד. הריצי ב-Supabase SQL Editor את{" "}
            <code className="font-mono text-caption">supabase/patches/run_005_to_007.sql</code>
            {" "}ואז{" "}
            <code className="font-mono text-caption">009_holiday_kinds_and_student_notes.sql</code>
            , ואז רענני את הדף.
          </p>
          <p className="font-caption text-caption text-on-surface-variant">
            אחרי ההרצה: הגדרות ← לשונית «לוח חופשות».
          </p>
        </div>
      ) : (
        <HolidayCalendar yearId={yearId} periods={holidays.data ?? []} />
      )}
    </Section>
  ) : (
    <Section>
      <p className="text-body-md text-on-surface-variant">צרי שנה אקדמית פעילה תחילה.</p>
    </Section>
  );

  const rulesPanel = (
    <Section icon="rule" title="כללי נוכחות" bodyBleed>
      <div className="p-6">
        <p className="mb-4 font-caption text-caption text-on-surface-variant">
          לכל שיעור משויך כלל עם סף היעדרות מקסימלי (למשל 1% לעזרה ראשונה, 10% לבטיחות,
          20% רגיל). איחור נספר כנוכחות; חריגה מהסף מסומנת בכרטיס תלמידה ובדוחות.
        </p>
        <SettingsForms type="attendance_rule" createAction={createAttendanceRuleAction} />
      </div>
      <div className="overflow-x-auto border-t border-outline-variant/30">
        <table className="w-full text-body-md">
          <SettingsTableHead columns={["שם", "סף היעדרות", "פעולות"]} />
          <tbody className="divide-y divide-outline-variant/25">
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
    </Section>
  );

  return (
    <div className="flex flex-col gap-stack_lg">
      <PageHeader
        title="הגדרות מוסד"
        description="ניהול תצורת המערכת, שנות לימוד, שכבות, מקצועות, מסלולים, טווחי פעילות, לוח חופשות וכללי נוכחות."
        size="headline"
      />
      <Tabs
        variant="underline"
        tabs={[
          { id: "year", label: "שנים אקדמיות", content: yearPanel },
          { id: "structure", label: "שכבות וכיתות", content: structurePanel },
          { id: "ranges", label: "טווחי פעילות", content: rangesPanel },
          { id: "holidays", label: "לוח חופשות", content: holidaysPanel },
          { id: "rules", label: "כללי נוכחות", content: rulesPanel },
        ]}
      />
    </div>
  );
}
