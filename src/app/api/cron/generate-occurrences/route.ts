import { NextResponse } from "next/server";
import { generateLessonOccurrences } from "@/lib/lessons/occurrences";
import { isValidCronRequest } from "@/lib/auth/cron-auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  if (!isValidCronRequest(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const { data: activeYear } = await supabase
    .from("academic_years")
    .select("id, name, is_active, created_at")
    .eq("is_active", true)
    .maybeSingle();

  if (!activeYear) {
    return NextResponse.json({ error: "No active year" }, { status: 400 });
  }

  const result = await generateLessonOccurrences(undefined, activeYear.id, supabase);
  return NextResponse.json(result);
}

export async function POST() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
