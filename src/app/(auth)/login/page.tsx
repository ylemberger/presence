import { LoginButton } from "./LoginButton";
import { Icon } from "@/components/ui/Icon";

const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: "אין הרשאה למשתמש זה",
  auth: "ההתחברות נכשלה. נסי שוב.",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const error = searchParams.error
    ? (ERROR_MESSAGES[searchParams.error] ?? ERROR_MESSAGES.auth)
    : null;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-gutter">
      {/* Decorative gradient background — matches Stitch login mockup */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-70"
        style={{
          background:
            "linear-gradient(135deg, rgba(196,233,240,0.4) 0%, #f6faf9 45%, rgba(255,222,167,0.35) 100%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-40 top-0 -z-10 h-[40rem] w-[40rem] rounded-full opacity-50 blur-3xl"
        style={{ background: "rgba(168, 205, 212, 0.35)", animation: "blob 9s infinite" }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-40 top-1/3 -z-10 h-[40rem] w-[40rem] rounded-full opacity-50 blur-3xl"
        style={{ background: "rgba(232, 193, 124, 0.35)", animation: "blob 11s infinite 2s" }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-40 left-1/4 -z-10 h-[40rem] w-[40rem] rounded-full opacity-50 blur-3xl"
        style={{ background: "rgba(188, 234, 244, 0.3)", animation: "blob 13s infinite 4s" }}
        aria-hidden
      />

      <main className="relative z-10 flex w-full max-w-md flex-col items-center">
        {/* Branding Header */}
        <div className="mb-stack_lg flex flex-col items-center">
          <div className="mb-stack_md flex h-24 w-24 items-center justify-center rounded-full bg-primary shadow-tactile-lg transition-transform duration-300 hover:scale-105">
            <span className="font-display-lg text-display-lg leading-none text-secondary">
              נ
            </span>
          </div>
          <h1 className="font-display-lg text-display-lg text-primary">נוכחות סמינר</h1>
          <p className="mt-stack_sm font-body-lg text-body-lg text-on-surface-variant">
            ניהול אקדמי מתקדם
          </p>
        </div>

        {/* Login Card */}
        <div className="w-full rounded-xl border-t-4 border-secondary bg-surface p-stack_lg text-center shadow-tactile-lg">
          <div className="mx-auto mb-stack_md flex h-16 w-16 items-center justify-center rounded-full bg-primary-fixed/20">
            <Icon name="lock" className="text-4xl text-primary" />
          </div>

          <h2 className="mb-stack_sm font-headline-md text-headline-md text-on-surface">
            כניסה למערכת
          </h2>
          <p className="mb-stack_lg font-body-md text-body-md text-on-surface-variant">
            יש להתחבר עם חשבון מורשה כדי לגשת למערכת ניהול הנוכחות.
          </p>

          {error && (
            <div
              className="mb-stack_md flex w-full items-center justify-center gap-2 rounded-lg border border-error/20 bg-error-container p-3 text-on-error-container"
              role="alert"
            >
              <Icon name="error" />
              <span className="font-body-md text-body-md">{error}</span>
            </div>
          )}

          <LoginButton />

          <div className="mt-stack_lg flex w-full items-center justify-center gap-2 border-t border-outline-variant/30 pt-stack_md font-caption text-caption text-on-surface-variant">
            <Icon name="verified_user" className="text-base" />
            <span>גישה מאובטחת לצוות האקדמי בלבד</span>
          </div>
        </div>

        <p className="mt-stack_lg text-center font-caption text-caption text-on-surface-variant/80">
          © {new Date().getFullYear()} סמינר. כל הזכויות שמורות.
        </p>
      </main>
    </div>
  );
}
