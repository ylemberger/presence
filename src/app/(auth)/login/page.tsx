import { Card } from "@/components/ui/Card";
import { FIRST_ALLOWED_EMAIL } from "@/lib/auth/allowed-emails";
import { LoginButton } from "./LoginButton";

const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: "החשבון הזה אינו מורשה להתחבר למערכת.",
  auth: "ההתחברות נכשלה. נסי שוב.",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; error_description?: string };
}) {
  const error = searchParams.error_description
    ? decodeURIComponent(searchParams.error_description.replace(/\+/g, " "))
    : searchParams.error
      ? ERROR_MESSAGES[searchParams.error] ?? ERROR_MESSAGES.auth
      : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand)] text-xl font-black text-[var(--accent)]">
            נ
          </div>
          <h1 className="text-2xl font-semibold text-slate-800">נוכחות סמינר</h1>
          <p className="mt-1 text-sm text-slate-500">כניסה למערכת הניהול</p>
        </div>
        <Card title="התחברות">
          <p className="mb-4 text-sm text-slate-600">יש להתחבר עם חשבון Google מורשה.</p>
          <p className="mb-6 rounded-xl bg-stone-50 px-3 py-2 text-sm text-slate-700" dir="ltr">
            {FIRST_ALLOWED_EMAIL}
          </p>
          {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}
          <LoginButton />
        </Card>
      </div>
    </div>
  );
}
