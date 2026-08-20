import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateLessonOccurrences } from "@/lib/lessons/occurrences";
import { getActiveAcademicYear } from "@/lib/utils";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeYear = await getActiveAcademicYear();
  if (!activeYear) {
    return NextResponse.json({ error: "No active year" }, { status: 400 });
  }

  const result = await generateLessonOccurrences(undefined, activeYear.id);
  return NextResponse.json(result);
}
