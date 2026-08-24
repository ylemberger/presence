import { getLoginHintEmail } from "@/lib/auth/allowed-emails";
import { LoginButton } from "./LoginButton";

const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: "אין הרשאה למשתמש זה",
  auth: "ההתחברות נכשלה. נסי שוב.",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const loginHintEmail = getLoginHintEmail();

  const error = searchParams.error
    ? (ERROR_MESSAGES[searchParams.error] ?? ERROR_MESSAGES.auth)
    : null;

  return (
    <div
      className="flex min-h-screen items-center justify-center px-gutter"
      style={{
        background: "linear-gradient(135deg, #163a40 0%, #775a20 100%)",
      }}
    >
      <main className="w-full max-w-md">
        <div
          className="relative flex flex-col items-center overflow-hidden rounded-xl p-8 text-center"
          style={{
            background: "rgba(255,255,255,0.95)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.2)",
            boxShadow: "0 24px 48px rgba(22,58,64,0.2)",
          }}
        >
          <div className="absolute left-0 top-0 h-2 w-full bg-secondary" aria-hidden />

          <div className="mb-stack_lg h-32 w-32 overflow-hidden rounded-full border-4 border-surface-container-lowest/50 shadow-lg">
            <img
              src="/logo.png"
              alt=""
              className="h-full w-full object-cover"
            />
          </div>

          <h1 className="mb-stack_sm font-display-lg text-display-lg text-primary">
            נוכחות סמינר
          </h1>

          <p className="mb-stack_lg font-body-md text-body-md text-on-surface-variant">
            יש להתחבר עם חשבון Google מורשה כדי לגשת למערכת
          </p>

          {loginHintEmail && (
            <p
              className="mb-stack_md w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-body-md text-on-surface"
              dir="ltr"
            >
              {loginHintEmail}
            </p>
          )}

          {error && (
            <div
              className="mb-stack_md flex w-full items-center justify-center gap-2 rounded border border-error/20 bg-error-container p-3 text-on-error-container"
              role="alert"
            >
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                error
              </span>
              <span className="font-body-md text-body-md">{error}</span>
            </div>
          )}

          <LoginButton loginHintEmail={loginHintEmail} />
        </div>

        <p className="mt-stack_lg text-center font-caption text-caption text-white/80">
          © {new Date().getFullYear()} סמינר. כל הזכויות שמורות.
        </p>
      </main>
    </div>
  );
}
