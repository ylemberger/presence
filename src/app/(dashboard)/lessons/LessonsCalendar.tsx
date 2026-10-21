"use client";

import { useRouter } from "next/navigation";
import { BILLING_TYPE_LABELS, DAY_OF_WEEK_LABELS } from "@/lib/constants";
import { formatHebrewDate } from "@/lib/dates/hebrew";
import { formatLessonHours } from "@/lib/lessons/hours";
import { useAccess } from "@/components/auth/AccessProvider";
import { deleteLessonAction } from "../actions";
import type { Lesson } from "@/types/database";
import { Icon } from "@/components/ui/Icon";
import { AssignStudentToLesson } from "./AssignStudentToLesson";
import { AddOccurrenceDate } from "../attendance/AddOccurrenceDate";
import { DeleteButton } from "@/components/ui/DeleteButton";
import Link from "next/link";

export type LessonTemplateCard = Lesson & {
  teacherName: string;
  gradeName: string;
  audienceLabel: string;
  scheduleLabel?: string;
  rangeName: string;
  studentCount: number;
  subjectParentName?: string;
  attendanceLocked?: boolean;
  markedMeetings?: { id: string; date: string }[];
};

interface LessonsCalendarProps {
  lessons: LessonTemplateCard[];
  monthQuery: string;
  students?: { id: string; full_name: string }[];
  editingId?: string;
}

export function LessonsCalendar({
  lessons,
  monthQuery,
  students = [],
  editingId,
}: LessonsCalendarProps) {
  const { canWrite } = useAccess();
  const router = useRouter();

  return (
    <section className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-stack_md shadow-tactile-md">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-title-lg text-title-lg text-primary">
          <Icon name="view_agenda" className="text-secondary" />
          שיעורים
        </h3>
        <span className="rounded-full bg-surface-container-high px-3 py-1 font-label-md text-label-md text-on-surface-variant">
          {lessons.length} לפי הסינון
        </span>
      </div>
      {lessons.length === 0 ? (
        <p className="font-body-md text-body-md text-on-surface-variant">
          אין שיעורים לפי הסינון. לחצי על יצירת שיעור כדי להוסיף.
        </p>
      ) : (
        <ul className="flex flex-col gap-2 font-body-md text-body-md">
          {lessons.map((l) => {
            const schedule =
              l.scheduleLabel ||
              [
                DAY_OF_WEEK_LABELS[l.day_of_week]
                  ? `יום ${DAY_OF_WEEK_LABELS[l.day_of_week]}`
                  : "",
                formatLessonHours(l.lesson_number, l.period_count ?? 1),
              ]
                .filter(Boolean)
                .join(" · ");
            const billing =
              BILLING_TYPE_LABELS[l.billing_type as keyof typeof BILLING_TYPE_LABELS] ??
              l.billing_type;
            return (
              <li
                key={l.id}
                className={
                  editingId === l.id
                    ? "rounded-lg border border-secondary bg-secondary-container/30 px-3 py-3"
                    : "rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-3 transition-colors hover:border-secondary/40"
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {l.subjectParentName ? (
                      <div className="font-caption text-caption text-on-surface-variant">
                        מקצוע: {l.subjectParentName}
                      </div>
                    ) : null}
                    <div className="font-semibold text-on-surface">{l.subject}</div>
                    <p className="mt-0.5 font-caption text-caption text-on-surface-variant">
                      {[schedule, billing, l.for_psychology ? "פסיכולוגיה" : ""]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="mt-0.5 font-caption text-caption text-on-surface-variant">
                      {[l.teacherName, l.audienceLabel, l.rangeName].filter(Boolean).join(" · ")}
                    </p>
                    <p className="mt-0.5 font-caption text-caption text-on-surface-variant">
                      {l.studentCount === 0
                        ? "אין תלמידות משויכות"
                        : `${l.studentCount} תלמידות משויכות`}
                    </p>
                  </div>
                  {canWrite ? (
                    <div className="flex shrink-0 flex-col items-stretch gap-1">
                      {l.attendanceLocked ? (
                        <p className="max-w-[11rem] text-center font-caption text-caption text-on-surface-variant">
                          עריכה נעולה עד שכל המפגשים בלי נוכחות
                        </p>
                      ) : (
                        <Link
                          href={`/lessons?${new URLSearchParams({
                            ...(monthQuery
                              ? Object.fromEntries(new URLSearchParams(monthQuery))
                              : {}),
                            edit: l.id,
                          }).toString()}`}
                          className="inline-flex items-center justify-center gap-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-1.5 font-semibold text-caption text-primary hover:bg-surface-container-low"
                        >
                          <Icon name="edit" className="text-[16px]" />
                          עריכה
                        </Link>
                      )}
                      <DeleteButton
                        label="מחק שיעור"
                        confirmMessage="יימחקו השיעור, שיבוצי התלמידות לשיעור, המופעים והנוכחות שלהם. התלמידות עצמן לא יימחקו. להמשיך?"
                        onDelete={async () => {
                          const result = await deleteLessonAction(l.id);
                          if (!result?.error && editingId === l.id) {
                            const params = new URLSearchParams(monthQuery);
                            params.delete("edit");
                            const q = params.toString();
                            router.push(q ? `/lessons?${q}` : "/lessons", { scroll: false });
                          }
                          return result;
                        }}
                      />
                    </div>
                  ) : null}
                </div>
                {canWrite && l.attendanceLocked ? (
                  <div className="mt-2 rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2">
                    <p className="font-caption text-caption text-on-surface">
                      כדי לשנות קהל יעד או פרטים אחרים, אפסי קודם את הנוכחות בכל מפגש
                      שסומן. בכפתור «אפסי נוכחות» בתוך המפגש. העריכה עצמה לא מוחקת
                      סימונים. כשלא נשאר אף מפגש מסומן, כפתור העריכה נפתח.
                    </p>
                    {(l.markedMeetings ?? []).length > 0 ? (
                      <ul className="mt-2 flex max-h-36 flex-col gap-1 overflow-auto">
                        {(l.markedMeetings ?? []).map((meeting) => (
                          <li key={meeting.id}>
                            <Link
                              href={`/attendance?date=${encodeURIComponent(meeting.date)}&occurrenceId=${encodeURIComponent(meeting.id)}`}
                              className="font-caption text-caption font-semibold text-secondary hover:underline"
                            >
                              {formatHebrewDate(meeting.date)} — אפסי נוכחות
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
                {students.length > 0 && (
                  <div className="mt-2">
                    <AssignStudentToLesson lessonId={l.id} students={students} />
                  </div>
                )}
                <div className="mt-2">
                  <AddOccurrenceDate lessonId={l.id} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
