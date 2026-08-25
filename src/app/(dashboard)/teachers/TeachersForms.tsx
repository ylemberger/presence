"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTeacherAction } from "../actions";
import { Icon } from "@/components/ui/Icon";

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FloatField
        label="שם מלא"
        name="full_name"
        placeholder="הכניסי שם מלא"
        required
      />
      <FloatField
        label='תעודת זהות'
        name="identity_number"
        placeholder="000000000"
        dir="ltr"
        required
      />
      <FloatField
        label="טלפון"
        name="phone"
        placeholder="050-0000000"
        dir="ltr"
        required
      />
      <FloatField
        label='דוא"ל'
        name="email"
        type="email"
        placeholder="כתובת דואר"
        dir="ltr"
        required
      />
      <button
        type="submit"
        disabled={loading}
        className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-label-md text-label-md text-on-primary transition-colors hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Icon name="add" className="text-[20px]" />
        {loading ? "שומר..." : "שמור מורה"}
      </button>
      {error && (
        <p
          className="rounded-lg border border-error/20 bg-error-container/60 px-3 py-2 text-body-md text-on-error-container"
          role="alert"
        >
          {error}
        </p>
      )}
    </form>
  );
}

function FloatField({
  label,
  name,
  placeholder,
  type = "text",
  dir,
  required,
}: {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  dir?: "ltr" | "rtl";
  required?: boolean;
}) {
  return (
    <div className="rounded-lg border border-outline bg-surface-container-lowest p-1 transition-all focus-within:border-primary focus-within:shadow-[0_0_0_2px_theme(colors.secondary-container)]">
      <label
        htmlFor={name}
        className="block px-2 pt-1 font-caption text-caption text-on-surface-variant"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        dir={dir}
        required={required}
        className="w-full border-none bg-transparent px-2 pb-1 font-body-md text-body-md text-on-surface placeholder:text-outline-variant focus:outline-none focus:ring-0"
      />
    </div>
  );
}
