import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateLessonOccurrences } from "@/lib/lessons/occurrences";
import { getActiveAcademicYear } from "@/lib/utils";
import { isValidCronRequest } from "@/lib/auth/cron-auth";

export async function GET(request: Request) {
  if (!isValidCronRequest(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeYear = await getActiveAcademicYear();
  if (!activeYear) {
    return NextResponse.json({ error: "No active year" }, { status: 400 });
  }

  const result = await generateLessonOccurrences(undefined, activeYear.id);
  return NextResponse.json(result);
}
