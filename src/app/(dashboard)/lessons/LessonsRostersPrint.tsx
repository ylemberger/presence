"use client";

import { useState } from "react";
import { PrintButton } from "@/components/ui/PrintButton";
import { SeminarPrintHeader } from "@/components/print/SeminarPrintHeader";
import { displayFamilyThenGiven } from "@/lib/students/sort";
import type { LessonRosterPrintData } from "@/lib/lessons/roster-print";
import { cn } from "@/lib/cn";
import { LessonsCalendar, type LessonTemplateCard } from "./LessonsCalendar";

function RosterTable({
  roster,
  printActive,
  pageBreakBefore,
}: {
  roster: LessonRosterPrintData;
  printActive: boolean;
  pageBreakBefore?: boolean;
}) {
  const subtitle = [
    roster.teacherName ? `מורה: ${roster.teacherName}` : "",
    roster.groupLabel ? `שיבוץ: ${roster.groupLabel}` : "",
    `סה״כ ${roster.students.length} תלמידות`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section
      className={cn(
        printActive ? "hidden print:block" : "hidden",
        pageBreakBefore && "print:break-before-page"
      )}
    >
      <SeminarPrintHeader title={roster.subject} subtitle={subtitle} />
      {roster.students.length === 0 ? (
        <p className="font-body-md text-body-md text-on-surface-variant">
          אין תלמידות משויכות לשיעור זה.
        </p>
      ) : (
        <table className="w-full border-collapse text-right">
          <thead>
            <tr className="border-b-2 border-primary">
              <th className="w-10 px-2 py-2 font-label-md text-label-md">#</th>
              <th className="px-2 py-2 font-label-md text-label-md">שם</th>
              <th className="px-2 py-2 font-label-md text-label-md">שיוך לשיעור</th>
            </tr>
          </thead>
          <tbody>
            {roster.students.map((s, i) => (
              <tr key={s.id} className="border-b border-outline-variant">
                <td className="px-2 py-2.5 font-body-md text-body-md text-on-surface-variant">
                  {i + 1}
                </td>
                <td className="px-2 py-2.5 font-body-md text-body-md">
                  {displayFamilyThenGiven(s) || s.full_name}
                </td>
                <td className="px-2 py-2.5 font-body-sm text-body-sm text-on-surface-variant">
                  {s.assignmentNote ? s.assignmentNote : "משויכת לכל המופעים"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {roster.students.some((s) => s.assignmentNote) ? (
        <p className="mt-3 text-[11px] text-on-surface-variant">
          «מ־» / «עד» — תלמידה שלא משויכת לכל מופעי השיעור; מופיעה רק במופעים שבטווח השיוך.
        </p>
      ) : null}
    </section>
  );
}

function runPrint(documentTitle: string) {
  const previousTitle = document.title;
  document.title = documentTitle;
  window.setTimeout(() => {
    window.print();
    window.setTimeout(() => {
      document.title = previousTitle;
    }, 500);
  }, 50);
}

export function LessonsTemplatesWithPrint({
  lessons,
  monthQuery,
  students,
  editingId,
  rosters,
}: {
  lessons: LessonTemplateCard[];
  monthQuery: string;
  students: { id: string; full_name: string }[];
  editingId?: string;
  rosters: LessonRosterPrintData[];
}) {
  const [printTarget, setPrintTarget] = useState<"all" | string>("all");
  const rosterById = new Map(rosters.map((r) => [r.id, r]));

  function printOne(lessonId: string) {
    setPrintTarget(lessonId);
    const roster = rosterById.get(lessonId);
    runPrint(`רשימה-${roster?.subject ?? "שיעור"}`);
  }

  return (
    <div className="flex flex-col gap-stack_lg">
      {rosters.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 print:hidden">
          <PrintButton
            label={`הדפסת כל הרשימות (${rosters.length})`}
            documentTitle="רשימות-שיעורים"
            onBeforePrint={() => setPrintTarget("all")}
          />
          <p className="max-w-xl font-body-sm text-body-sm text-on-surface-variant">
            קובץ הדפסה אחד ארוך: כל שיעור לפי הסינון, עם רשימת התלמידות (כולל מ־/עד). מתאים
            למזכירה. אפשר גם «הדפסת רשימה» ליד כל שיעור ברשימה.
          </p>
        </div>
      ) : null}

      <LessonsCalendar
        lessons={lessons}
        monthQuery={monthQuery}
        students={students}
        editingId={editingId}
        onPrintRoster={rosters.length > 0 ? printOne : undefined}
        canPrintRoster={(lessonId) => (rosterById.get(lessonId)?.students.length ?? 0) > 0}
      />

      {rosters.map((roster, index) => (
        <RosterTable
          key={roster.id}
          roster={roster}
          printActive={printTarget === "all" || printTarget === roster.id}
          pageBreakBefore={printTarget === "all" && index > 0}
        />
      ))}
    </div>
  );
}
