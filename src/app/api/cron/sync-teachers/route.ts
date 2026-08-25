import { NextResponse } from "next/server";
import { isValidCronRequest } from "@/lib/auth/cron-auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { syncTeacherSourceRecords } from "@/lib/sync/teachers";

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

  try {
    const result = await syncTeacherSourceRecords(supabase);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
