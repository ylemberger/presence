"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInAction } from "@/app/(dashboard)/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const result = await signInAction(formData);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Card title="התחברות למערכת" className="w-full max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="אימייל"
            name="email"
            type="email"
            required
            autoComplete="email"
          />
          <Input
            label="סיסמה"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "מתחברת..." : "התחברות"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
