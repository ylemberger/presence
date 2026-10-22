"use client";

import Link from "next/link";
import { usePendingRouter } from "@/lib/ui/nav-pending";
import { HebrewMonthCalendar } from "@/components/ui/HebrewMonthCalendar";
import { Icon } from "@/components/ui/Icon";
import { Section } from "@/components/ui/Section";
import { DAY_OF_WEEK_LABELS } from "@/lib/constants";
import { formatGregorianDate, formatHebrewDate, parseIsoDate, todayIso } from "@/lib/dates/hebrew";
import { formatLessonHours } from "@/lib/lessons/hours";

export type CalendarMeeting = {
  id: string;
  date: string;
  status: "scheduled" | "completed" | "cancelled";
  subject: string;
  teacherName: string;
  audienceLabel: string;
  lessonNumber: number;
  periodCount: number;
};

const STATUS_LABEL: Record<CalendarMeeting["status"], string> = {
  scheduled: "טרם סומן",
  completed: "סומן",
  cancelled: "בוטל",
};

interface LessonsByDateProps {
  selectedDate: string;
  /** Filters and edit, without the date itself. */
  baseQuery: string;
  meetings: CalendarMeeting[];
  countsByDate: Record<string, number>;
  completeDates: string[];
  partialDates: string[];
  holidayDates: string[];
  cancelledDates: string[];
  studyRanges: Array<{ start_date: string; end_date: string }>;
}

export function LessonsByDate({
  selectedDate,
  baseQuery,
  meetings,
  countsByDate,
  completeDates,
  partialDates,
  holidayDates,
  cancelledDates,
  studyRanges,
}: LessonsByDateProps) {
  const { push } = usePendingRouter();
  const today = todayIso();
  const weekday = DAY_OF_WEEK_LABELS[parseIsoDate(selectedDate).getDay()] ?? "";
  const holiday = holidayDates.includes(selectedDate);
  const cancelledDay = cancelledDates.includes(selectedDate);

  function openDate(iso: string) {
    if (!iso || iso === selectedDate) return;
    const params = new URLSearchParams(baseQuery);
    params.set("date", iso);
    push(`/lessons?${params.toString()}`, { scroll: false });
  }

  return (
    <Section
      icon="calendar_month"
      title="שיעורים לפי לוח השנה"
      subtitle="בחרי יום כדי לראות את המפגשים שחלים בו. הסינון למעלה חל גם על היומן."
    >
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
        <HebrewMonthCalendar
          compact
          initialMonthIso={selectedDate}
          selectedDate={selectedDate}
          countsByDate={countsByDate}
          completeDates={completeDates}
          partialDates={partialDates}
          holidayDates={holidayDates}
          cancelledDates={cancelledDates}
          studyRanges={studyRanges}
          onSelectDate={openDate}
          onMonthRangeChange={(start, end) => {
            if (selectedDate >= start && selectedDate <= end) return;
            openDate(start);
          }}
        />

        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-title-md text-title-md text-on-surface">
                יום {weekday}, {formatHebrewDate(selectedDate)}
              </h3>
              <p className="font-caption text-caption text-on-surface-variant">
                {formatGregorianDate(selectedDate)}
                {holiday ? " · יום ללא לימודים" : ""}
                {cancelledDay ? " · יום לימודים שבוטל" : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-surface-container-high px-3 py-1 font-label-md text-label-md text-on-surface-variant">
                {meetings.length === 1 ? "מפגש אחד" : `${meetings.length} מפגשים`}
              </span>
              {selectedDate !== today ? (
                <button
                  type="button"
                  onClick={() => openDate(today)}
                  className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-1.5 font-semibold text-caption text-primary hover:bg-surface-container-low"
                >
                  היום
                </button>
              ) : null}
            </div>
          </div>

          {meetings.length === 0 ? (
            <p className="font-body-md text-body-md text-on-surface-variant">
              אין מפגשים בתאריך הזה לפי הסינון. מופעים נוצרים כששומרים שיעור בטווח הפעילות.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {meetings.map((meeting) => (
                <li
                  key={meeting.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-on-surface">
                      {formatLessonHours(meeting.lessonNumber, meeting.periodCount)}
                      {" · "}
                      {meeting.subject}
                    </div>
                    <p className="mt-0.5 font-caption text-caption text-on-surface-variant">
                      {[meeting.teacherName, meeting.audienceLabel, STATUS_LABEL[meeting.status]]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {meeting.status === "cancelled" ? null : (
                    <Link
                      href={`/attendance?date=${meeting.date}&occurrenceId=${meeting.id}`}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-1.5 font-semibold text-caption text-primary hover:bg-surface-container-low"
                    >
                      <Icon name="fact_check" className="text-[16px]" />
                      לנוכחות
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Section>
  );
}
