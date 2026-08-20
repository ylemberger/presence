"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createStudentAction } from "../actions";

export function StudentsForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await createStudentAction(new FormData(e.currentTarget));
    if (result.error) setError(result.error);
    else {
      e.currentTarget.reset();
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <Input label="שם מלא" name="full_name" required />
      <Input label='ת"ז' name="identity_number" required />
      <Button type="submit" disabled={loading}>
        {loading ? "שומר..." : "הוספה"}
      </Button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
