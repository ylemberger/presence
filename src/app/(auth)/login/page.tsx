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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(800px 420px at 85% 10%, rgb(184 149 85 / 0.22), transparent 55%), radial-gradient(700px 380px at 10% 90%, rgb(33 80 88 / 0.18), transparent 50%)",
        }}
      />
      <div className="relative w-full max-w-md animate-[scaleIn_220ms_ease-out]">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--brand)] text-2xl font-black text-[var(--accent)] shadow-[var(--shadow-md)]">
            נ
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--brand)]">נוכחות סמינר</h1>
          <p className="mt-2 text-sm text-slate-500">כניסה למערכת הניהול</p>
        </div>
        <Card title="התחברות">
          <p className="mb-4 text-sm leading-relaxed text-slate-600">
            יש להתחבר עם חשבון Google מורשה.
          </p>
          <p
            className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3.5 py-2.5 text-sm text-slate-700"
            dir="ltr"
          >
            {FIRST_ALLOWED_EMAIL}
          </p>
          {error && (
            <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-100">
              {error}
            </p>
          )}
          <LoginButton />
        </Card>
      </div>
    </div>
  );
}
