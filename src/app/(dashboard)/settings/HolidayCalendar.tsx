"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { HebrewDateRangePicker } from "@/components/ui/HebrewDateRangePicker";
import { HebrewMonthCalendar } from "@/components/ui/HebrewMonthCalendar";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { Icon } from "@/components/ui/Icon";
import { formatDate, formatDatePair } from "@/lib/dates/hebrew";
import { holidayDatesByKind } from "@/lib/lessons/holidays";
import { HOLIDAY_KIND_LABELS } from "@/lib/constants";
import { cn } from "@/lib/cn";
import type { HolidayKind, HolidayPeriod } from "@/types/database";
import {
  createHolidayPeriodAction,
  deleteHolidayPeriodAction,
  toggleHolidayDayAction,
  updateHolidayPeriodAction,
} from "../actions";

export function HolidayCalendar({
  yearId,
  periods,
}: {
  yearId: string;
  periods: HolidayPeriod[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [formEpoch, setFormEpoch] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [paintKind, setPaintKind] = useState<HolidayKind>("vacation");
  const [paintName, setPaintName] = useState("");

  const { vacation, cancelled } = useMemo(() => holidayDatesByKind(periods), [periods]);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    setLoading(true);
    try {
      const fd = new FormData(form);
      fd.set("academic_year_id", yearId);
      const start = String(fd.get("start_date") ?? "");
      const end = String(fd.get("end_date") ?? "");
      if (start && !end) fd.set("end_date", start);
      fd.set("kind", paintKind);
      if (!String(fd.get("name") ?? "").trim()) {
        fd.set("name", HOLIDAY_KIND_LABELS[paintKind]);
      }
      const result = await createHolidayPeriodAction(fd);
      if (result?.error) {
        setError(result.error);
        return;
      }
      form.reset();
      setFormEpoch((n) => n + 1);
      await router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שמירה נכשלה");
    } finally {
      setLoading(false);
    }
  }

  async function handleDayClick(iso: string) {
    setError(null);
    setLoading(true);
    try {
      const result = await toggleHolidayDayAction(
        yearId,
        iso,
        paintKind,
        paintName.trim() || HOLIDAY_KIND_LABELS[paintKind]
      );
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      await router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שמירה נכשלה");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-gutter xl:grid-cols-12">
      <div className="p-6 xl:col-span-7">
        <p className="mb-4 font-body-sm text-body-sm text-on-surface-variant">
          חודש עברי שלם בכל פעם. בחרי סוג, ואז לחצי על ימים בלוח כדי לצבוע. אפשר גם להוסיף
          טווח למטה. מגדירים בתחילת השנה — ואפשר לתקן גם באמצע.
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPaintKind("vacation")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-2 font-label-md text-label-md",
              paintKind === "vacation"
                ? "border-secondary bg-holiday-vacation text-on-secondary-container"
                : "border-outline-variant bg-surface-container-lowest text-on-surface"
            )}
          >
            <span className="h-3 w-3 rounded-sm bg-holiday-vacation ring-1 ring-secondary/40" />
            חופשה
          </button>
          <button
            type="button"
            onClick={() => setPaintKind("cancelled_studies")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-2 font-label-md text-label-md",
              paintKind === "cancelled_studies"
                ? "border-primary bg-holiday-cancelled text-primary"
                : "border-outline-variant bg-surface-container-lowest text-on-surface"
            )}
          >
            <span className="h-3 w-3 rounded-sm bg-holiday-cancelled ring-1 ring-primary/30" />
            ביטול לימודים
          </button>
        </div>
        <div className="mb-4">
          <Input
            label="שם (אופציונלי, למשל פסח)"
            name="paint_name"
            value={paintName}
            onChange={(e) => setPaintName(e.target.value)}
          />
        </div>
        <HebrewMonthCalendar
          holidayDates={vacation}
          cancelledDates={cancelled}
          onSelectDate={handleDayClick}
        />
        {loading && (
          <p className="mt-3 font-caption text-caption text-on-surface-variant">שומר…</p>
        )}
        {error && (
          <p className="mt-3 rounded-lg bg-error-container/60 px-3 py-2 font-body-sm text-body-sm text-on-error-container">
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-gutter xl:col-span-5">
        <form key={formEpoch} onSubmit={handleCreate} className="flex flex-col gap-3 p-6">
          <p className="font-label-md text-label-md text-primary">הוספת טווח</p>
          <Input label="שם" name="name" placeholder={HOLIDAY_KIND_LABELS[paintKind]} />
          <input type="hidden" name="kind" value={paintKind} />
          <HebrewDateRangePicker
            startName="start_date"
            endName="end_date"
            required
            singleClickSelectsDay
            className="basis-full"
          />
          <Button type="submit" disabled={loading} className="self-start">
            <Icon name="add" className="text-[18px]" />
            {loading ? "שומר..." : `הוספת ${HOLIDAY_KIND_LABELS[paintKind]}`}
          </Button>
        </form>

        <div className="overflow-x-auto border-t border-outline-variant/30">
          <table className="w-full text-body-md">
            <thead className="border-b border-outline-variant/30 bg-surface-container-low">
              <tr>
                {["שם", "סוג", "מתאריך", "עד תאריך", "פעולות"].map((col) => (
                  <th
                    key={col}
                    className="px-4 py-3 text-right font-label-md text-label-md text-on-surface-variant"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/25">
              {periods.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-on-surface-variant">
                    עדיין אין סימונים לשנה זו.
                  </td>
                </tr>
              ) : (
                periods.map((period) =>
                  editingId === period.id ? (
                    <HolidayEditRow
                      key={period.id}
                      period={period}
                      yearId={yearId}
                      onDone={() => {
                        setEditingId(null);
                        router.refresh();
                      }}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <tr
                      key={period.id}
                      className="transition-colors hover:bg-surface-container-low/60"
                    >
                      <td className="px-4 py-3 text-right font-semibold text-primary">
                        {period.name}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 font-caption text-caption",
                            (period.kind || "vacation") === "cancelled_studies"
                              ? "bg-holiday-cancelled/80 text-primary"
                              : "bg-holiday-vacation/80 text-on-secondary-container"
                          )}
                        >
                          {HOLIDAY_KIND_LABELS[period.kind || "vacation"]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-on-surface-variant">
                        {formatDate(period.start_date)}
                        <span className="mr-1 text-caption text-outline">
                          ({formatDatePair(period.start_date).gregorian})
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-on-surface-variant">
                        {formatDate(period.end_date)}
                        <span className="mr-1 text-caption text-outline">
                          ({formatDatePair(period.end_date).gregorian})
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            type="button"
                            onClick={() => setEditingId(period.id)}
                          >
                            עריכה
                          </Button>
                          <DeleteButton onDelete={() => deleteHolidayPeriodAction(period.id)} />
                        </div>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function HolidayEditRow({
  period,
  yearId,
  onDone,
  onCancel,
}: {
  period: HolidayPeriod;
  yearId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const fd = new FormData(e.currentTarget);
      fd.set("academic_year_id", yearId);
      const start = String(fd.get("start_date") ?? "");
      const end = String(fd.get("end_date") ?? "");
      if (start && !end) fd.set("end_date", start);
      const result = await updateHolidayPeriodAction(period.id, fd);
      if (result?.error) {
        setError(result.error);
        return;
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שמירה נכשלה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="bg-surface-container-low/60">
      <td colSpan={5} className="px-4 py-3">
        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <Input label="שם" name="name" defaultValue={period.name} required />
          <div className="flex flex-wrap gap-3">
            <label className="inline-flex items-center gap-2 font-body-md text-body-md">
              <input
                type="radio"
                name="kind"
                value="vacation"
                defaultChecked={(period.kind || "vacation") === "vacation"}
              />
              חופשה
            </label>
            <label className="inline-flex items-center gap-2 font-body-md text-body-md">
              <input
                type="radio"
                name="kind"
                value="cancelled_studies"
                defaultChecked={period.kind === "cancelled_studies"}
              />
              ביטול לימודים
            </label>
          </div>
          <HebrewDateRangePicker
            startName="start_date"
            endName="end_date"
            defaultStart={period.start_date}
            defaultEnd={period.end_date}
            required
            singleClickSelectsDay
            className="basis-full"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "שומר..." : "שמירה"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
              ביטול
            </Button>
          </div>
          {error && (
            <p className="rounded-lg bg-error-container/60 px-3 py-2 font-body-sm text-body-sm text-on-error-container">
              {error}
            </p>
          )}
        </form>
      </td>
    </tr>
  );
}
