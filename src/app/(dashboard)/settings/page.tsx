import { Card } from "@/components/ui/Card";
import { Table, TableRow, TableCell } from "@/components/ui/Table";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { getActiveAcademicYear, getAllAcademicYears } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { RANGE_TYPE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
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
} from "../actions";
import { SettingsForms } from "./SettingsForms";

export default async function SettingsPage() {
  const activeYear = await getActiveAcademicYear();
  const years = await getAllAcademicYears();
  const supabase = await createClient();

  const yearId = activeYear?.id;

  const [grades, classes, tracks, specializations, ranges, rules] = yearId
    ? await Promise.all([
        supabase.from("grades").select("*").eq("academic_year_id", yearId).order("name"),
        supabase.from("classes").select("*, grades(name)").eq("academic_year_id", yearId).order("name"),
        supabase.from("tracks").select("*").eq("academic_year_id", yearId).order("name"),
        supabase.from("specializations").select("*").eq("academic_year_id", yearId).order("name"),
        supabase.from("activity_ranges").select("*").eq("academic_year_id", yearId).order("start_date"),
        supabase.from("attendance_rules").select("*").order("name"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">הגדרות</h1>

      <Card title="שנים אקדמיות">
        <SettingsForms
          type="academic_year"
          yearId={yearId}
          createAction={createAcademicYearAction}
        />
        <Table headers={["שם", "פעילה", "פעולות"]} className="mt-4">
          {years.map((y) => (
            <TableRow key={y.id}>
              <TableCell>{y.name}</TableCell>
              <TableCell>{y.is_active ? "כן" : "לא"}</TableCell>
              <TableCell>
                <DeleteButton onDelete={() => deleteAcademicYearAction(y.id)} />
              </TableCell>
            </TableRow>
          ))}
        </Table>
      </Card>

      {yearId && (
        <>
          <Card title="שכבות">
            <SettingsForms type="grade" yearId={yearId} createAction={createGradeAction} />
            <Table headers={["שם", "פעולות"]} className="mt-4">
              {(grades.data ?? []).map((g) => (
                <TableRow key={g.id}>
                  <TableCell>{g.name}</TableCell>
                  <TableCell>
                    <DeleteButton onDelete={() => deleteGradeAction(g.id)} />
                  </TableCell>
                </TableRow>
              ))}
            </Table>
          </Card>

          <Card title="כיתות">
            <SettingsForms
              type="class"
              yearId={yearId}
              grades={grades.data ?? []}
              createAction={createClassAction}
            />
            <Table headers={["שם", "שכבה", "פעולות"]} className="mt-4">
              {(classes.data ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{(c.grades as unknown as { name: string } | null)?.name}</TableCell>
                  <TableCell>
                    <DeleteButton onDelete={() => deleteClassAction(c.id)} />
                  </TableCell>
                </TableRow>
              ))}
            </Table>
          </Card>

          <Card title="מגמות">
            <SettingsForms type="track" yearId={yearId} createAction={createTrackAction} />
            <Table headers={["שם", "פעולות"]} className="mt-4">
              {(tracks.data ?? []).map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.name}</TableCell>
                  <TableCell>
                    <DeleteButton onDelete={() => deleteTrackAction(t.id)} />
                  </TableCell>
                </TableRow>
              ))}
            </Table>
          </Card>

          <Card title="התמחויות">
            <SettingsForms
              type="specialization"
              yearId={yearId}
              createAction={createSpecializationAction}
            />
            <Table headers={["שם", "פעולות"]} className="mt-4">
              {(specializations.data ?? []).map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>
                    <DeleteButton onDelete={() => deleteSpecializationAction(s.id)} />
                  </TableCell>
                </TableRow>
              ))}
            </Table>
          </Card>

          <Card title="טווחי פעילות">
            <SettingsForms
              type="activity_range"
              yearId={yearId}
              createAction={createActivityRangeAction}
            />
            <Table headers={["שם", "סוג", "מתאריך", "עד תאריך", "פעולות"]} className="mt-4">
              {(ranges.data ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{RANGE_TYPE_LABELS[r.range_type as keyof typeof RANGE_TYPE_LABELS]}</TableCell>
                  <TableCell>{formatDate(r.start_date)}</TableCell>
                  <TableCell>{formatDate(r.end_date)}</TableCell>
                  <TableCell>
                    <DeleteButton onDelete={() => deleteActivityRangeAction(r.id)} />
                  </TableCell>
                </TableRow>
              ))}
            </Table>
          </Card>
        </>
      )}

      <Card title="כללי נוכחות">
        <SettingsForms type="attendance_rule" createAction={createAttendanceRuleAction} />
        <Table headers={["שם", "אחוז היעדרות מקסימלי", "פעולות"]} className="mt-4">
          {(rules.data ?? []).map((r) => (
            <TableRow key={r.id}>
              <TableCell>{r.name}</TableCell>
              <TableCell>{r.max_allowed_absence_percent}%</TableCell>
              <TableCell>
                <DeleteButton onDelete={() => deleteAttendanceRuleAction(r.id)} />
              </TableCell>
            </TableRow>
          ))}
        </Table>
      </Card>
    </div>
  );
}
