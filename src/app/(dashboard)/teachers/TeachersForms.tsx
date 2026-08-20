"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import {
  createTeacherAction,
  createSourceRecordAction,
  createTeachingAssignmentAction,
} from "../actions";
import type { Teacher } from "@/types/database";

interface TeachersFormsProps {
  type: "teacher" | "source" | "assignment";
  teachers?: Teacher[];
  classes?: { id: string; name: string }[];
  yearId?: string;
}

export function TeachersForms({ type, teachers, classes, yearId }: TeachersFormsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (yearId) fd.set("academic_year_id", yearId);

    let result;
    if (type === "teacher") result = await createTeacherAction(fd);
    else if (type === "source") result = await createSourceRecordAction(fd);
    else result = await createTeachingAssignmentAction(fd);

    if (result.error) setError(result.error);
    else {
      e.currentTarget.reset();
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      {type === "teacher" && (
        <>
          <Input label="שם מלא" name="full_name" required />
          <Input label='ת"ז' name="identity_number" required />
          <Input label="טלפון" name="phone" />
          <Input label="אימייל" name="email" type="email" />
        </>
      )}

      {type === "source" && (
        <>
          <Input label="מזהה חיצוני" name="external_id" required />
          <Input label="שם" name="full_name" required />
          <Input label='ת"ז מורה' name="teacher_identity_number" required />
          <Input label="מקצוע" name="subject" required />
          <Input label="שנת מקור" name="source_year" required placeholder='תשפ"ו' />
        </>
      )}

      {type === "assignment" && (
        <>
          <Select
            label="מורה"
            name="teacher_id"
            required
            options={[
              { value: "", label: "בחרי" },
              ...(teachers?.map((t) => ({ value: t.id, label: t.full_name })) ?? []),
            ]}
          />
          <Input label="מקצוע" name="subject" required />
          <Select
            label="כיתה"
            name="class_id"
            required
            options={[
              { value: "", label: "בחרי" },
              ...(classes?.map((c) => ({ value: c.id, label: c.name })) ?? []),
            ]}
          />
        </>
      )}

      <Button type="submit">הוספה</Button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
