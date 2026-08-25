"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateTeacherAction } from "../actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface TeacherEditFormProps {
  teacherId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
}

export function TeacherEditForm({ teacherId, fullName, phone, email }: TeacherEditFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setLoading(true);
    try {
      const fd = new FormData(e.currentTarget);
      fd.set("teacher_id", teacherId);
      const result = await updateTeacherAction(fd);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שמירה נכשלה");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Input label="שם מלא" name="full_name" defaultValue={fullName} required />
      <Input
        label="טלפון"
        name="phone"
        defaultValue={phone ?? ""}
        dir="ltr"
      />
      <Input
        label='דוא"ל'
        name="email"
        type="email"
        defaultValue={email ?? ""}
        dir="ltr"
      />
      <Button type="submit" disabled={loading}>
        {loading ? "שומר..." : "שמור פרטים"}
      </Button>
      {saved && (
        <p className="font-body-md text-body-md text-primary">הפרטים נשמרו.</p>
      )}
      {error && (
        <p className="text-body-md text-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
