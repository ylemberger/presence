"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createTeacherAction } from "../actions";

interface TeachersFormsProps {
  yearId?: string;
}

export function TeachersForms({ yearId }: TeachersFormsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    setLoading(true);
    try {
      const fd = new FormData(form);
      if (yearId) fd.set("academic_year_id", yearId);
      const result = await createTeacherAction(fd);
      if (result && "error" in result && result.error) setError(result.error);
      else {
        form.reset();
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
      <Input label="שם מלא" name="full_name" required />
      <Input label='ת"ז' name="identity_number" required />
      <Input label="טלפון" name="phone" required />
      <Input label="אימייל" name="email" type="email" required />
      <Button type="submit" disabled={loading}>
        {loading ? "שומר..." : "הוספה"}
      </Button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
