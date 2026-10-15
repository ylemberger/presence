"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { HebrewDateInput } from "@/components/ui/HebrewDateInput";
import { updateStudentAction } from "../../actions";
import { Icon } from "@/components/ui/Icon";
import { useAccess } from "@/components/auth/AccessProvider";

interface StudentBasics {
  first_name: string;
  last_name: string;
  identity_number: string;
  mi: string | null;
  cohort_number: number;
  birth_date: string | null;
  birth_date_hebrew: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  father_phone: string | null;
  mother_phone: string | null;
  student_phone: string | null;
  high_school: string | null;
  chetz_program: boolean;
  is_active: boolean;
}

export function StudentEditDetails({
  studentId,
  student,
}: {
  studentId: string;
  student: StudentBasics;
}) {
  const { canWrite } = useAccess();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await updateStudentAction(studentId, new FormData(e.currentTarget));
      if (result?.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שמירה נכשלה");
    } finally {
      setLoading(false);
    }
  }

  if (!canWrite) return null;

  if (!open) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Icon name="edit" className="text-[18px]" />
        עריכת פרטים
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4 print:hidden">
      <p className="font-caption text-caption text-on-surface-variant">
        שינוי כיתה/מסלול/התמחות נשאר בהעברה. כאן רק פרטי כרטסת.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Input label="מי" name="mi" defaultValue={student.mi ?? ""} />
        <Input label="שם פרטי" name="first_name" required defaultValue={student.first_name} />
        <Input label="משפחה" name="last_name" required defaultValue={student.last_name} />
        <Input
          label="מ.ז."
          name="identity_number"
          required
          inputMode="numeric"
          defaultValue={student.identity_number}
        />
        <Input label="ת.ל. עברי" name="birth_date_hebrew" defaultValue={student.birth_date_hebrew ?? ""} />
        <HebrewDateInput label="ת.ל. לועזי" name="birth_date" defaultValue={student.birth_date ?? ""} allowEmpty />
        <div className="sm:col-span-2">
          <Input label="כתובת" name="address" defaultValue={student.address ?? ""} />
        </div>
        <Input label="עיר" name="city" defaultValue={student.city ?? ""} />
        <Input label="טל" name="phone" inputMode="tel" defaultValue={student.phone ?? ""} />
        <Input label="פל אב" name="father_phone" inputMode="tel" defaultValue={student.father_phone ?? ""} />
        <Input label="פל אם" name="mother_phone" inputMode="tel" defaultValue={student.mother_phone ?? ""} />
        <Input
          label="פל תלמידה"
          name="student_phone"
          inputMode="tel"
          defaultValue={student.student_phone ?? ""}
        />
        <Input label="תיכון" name="high_school" defaultValue={student.high_school ?? ""} />
        <Input
          label="מחזור"
          name="cohort_number"
          type="number"
          min={1}
          defaultValue={student.cohort_number}
        />
        <label className="flex items-center gap-2 self-end pb-2 font-label-md text-label-md text-on-surface">
          <input
            type="checkbox"
            name="chetz_program"
            defaultChecked={student.chetz_program}
            className="rounded border-outline-variant"
          />
          תוכנית חץ
        </label>
        <label className="flex items-center gap-2 self-end pb-2 font-label-md text-label-md text-on-surface">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={student.is_active}
            className="rounded border-outline-variant"
          />
          פעילה
        </label>
      </div>
      {error && (
        <p className="rounded-lg bg-error-container/60 px-3 py-2 font-body-sm text-body-sm text-on-error-container">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? "שומר..." : "שמירת פרטים"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
          ביטול
        </Button>
      </div>
    </form>
  );
}
