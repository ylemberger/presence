import { timingSafeEqual } from "crypto";

/** Shared secret for the exams system to pull catalog/teachers/lessons (read-only). */
export function isValidExamSyncRequest(authHeader: string | null): boolean {
  const secret = process.env.EXAM_SYNC_SECRET;
  if (!secret || secret.length < 24) return false;
  if (!authHeader?.startsWith("Bearer ")) return false;

  const token = authHeader.slice("Bearer ".length);
  const expected = Buffer.from(secret, "utf8");
  const received = Buffer.from(token, "utf8");
  if (expected.length !== received.length) return false;

  return timingSafeEqual(expected, received);
}
