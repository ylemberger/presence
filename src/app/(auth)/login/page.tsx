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
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Card title="התחברות למערכת" className="w-full max-w-md">
        <p className="mb-4 text-sm text-gray-600">
          יש להתחבר עם חשבון Google מורשה.
        </p>
        <p className="mb-6 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700" dir="ltr">
          {FIRST_ALLOWED_EMAIL}
        </p>
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        <LoginButton />
      </Card>
    </div>
  );
}
