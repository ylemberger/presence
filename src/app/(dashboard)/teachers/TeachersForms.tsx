"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { createTeacherAction, createTeachingAssignmentAction } from "../actions";
import { BILLING_TYPE_LABELS } from "@/lib/constants";
import type { Teacher } from "@/types/database";

interface TeachersFormsProps {
  type: "teacher" | "assignment";
  teachers?: Teacher[];
  classes?: { id: string; name: string }[];
  tracks?: { id: string; name: string }[];
  specializations?: { id: string; name: string }[];
  yearId?: string;
}

export function TeachersForms({
  type,
  teachers,
  classes,
  tracks,
  specializations,
  yearId,
}: TeachersFormsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [billingType, setBillingType] = useState<"mandatory" | "specialization">("mandatory");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    setLoading(true);
    try {
      const fd = new FormData(form);
      if (yearId) fd.set("academic_year_id", yearId);

      if (type === "assignment") {
        fd.set("billing_type", billingType);
        if (billingType === "specialization") {
          fd.set("class_id", "");
          fd.set("track_id", "");
        } else {
          fd.set("specialization_id", "");
        }
      }

      const result =
        type === "teacher"
          ? await createTeacherAction(fd)
          : await createTeachingAssignmentAction(fd);

      if (result && "error" in result && result.error) setError(result.error);
      else {
        form.reset();
        setBillingType("mandatory");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "שמירה נכשלה");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      {type === "teacher" && (
        <>
          <Input label="שם מלא" name="full_name" required />
          <Input label='ת"ז' name="identity_number" required />
          <Input label="טלפון" name="phone" required />
          <Input label="אימייל" name="email" type="email" required />
        </>
      )}

      {type === "assignment" && (
        <>
          <Select
            label="מורה"
            name="teacher_id"
            required
            options={[
              { value: "", label: "בחרי מורה" },
              ...(teachers?.map((t) => ({ value: t.id, label: t.full_name })) ?? []),
            ]}
          />
          <Input label="מקצוע" name="subject" required />
          <Select
            label="סוג שיבוץ"
            name="billing_type_ui"
            required
            value={billingType}
            onChange={(e) => setBillingType(e.target.value as "mandatory" | "specialization")}
            options={Object.entries(BILLING_TYPE_LABELS).map(([v, l]) => ({
              value: v,
              label: l,
            }))}
          />
          {billingType === "specialization" ? (
            <Select
              label="התמחות"
              name="specialization_id"
              required
              options={[
                { value: "", label: "בחרי התמחות" },
                ...(specializations?.map((s) => ({ value: s.id, label: s.name })) ?? []),
              ]}
            />
          ) : (
            <>
              <Select
                label="כיתה"
                name="class_id"
                options={[
                  { value: "", label: "ללא" },
                  ...(classes?.map((c) => ({ value: c.id, label: c.name })) ?? []),
                ]}
              />
              <Select
                label="מסלול"
                name="track_id"
                options={[
                  { value: "", label: "ללא" },
                  ...(tracks?.map((t) => ({ value: t.id, label: t.name })) ?? []),
                ]}
              />
              <p className="w-full text-xs text-slate-500">
                בשיבוץ חובה יש לבחור כיתה או מסלול (או את שתיהן) — לפי זה ישויכו התלמידות לשיעורים.
              </p>
            </>
          )}
        </>
      )}

      <Button type="submit" disabled={loading}>
        {loading ? "שומר..." : "הוספה"}
      </Button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
