import { timingSafeEqual } from "crypto";

export function isValidCronRequest(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  if (!authHeader?.startsWith("Bearer ")) return false;

  const token = authHeader.slice("Bearer ".length);
  const expected = Buffer.from(secret, "utf8");
  const received = Buffer.from(token, "utf8");
  if (expected.length !== received.length) return false;

  return timingSafeEqual(expected, received);
}
