export const FIRST_ALLOWED_EMAIL = "t025959714@gmail.com";

const ALLOWED_LOGIN_EMAILS = new Set([FIRST_ALLOWED_EMAIL]);

export function isAllowedLoginEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ALLOWED_LOGIN_EMAILS.has(email.trim().toLowerCase());
}
