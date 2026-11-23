import { NextResponse } from "next/server";
import { isValidExamSyncRequest } from "@/lib/auth/exam-sync-auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { buildExamSyncBundle } from "@/lib/sync/exam-export";

/**
 * Read-only export for the exams system.
 * Auth: Authorization: Bearer <EXAM_SYNC_SECRET>
 * Never call from the browser; only the exams server.
 */
export async function GET(request: Request) {
  if (!isValidExamSyncRequest(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  try {
    const bundle = await buildExamSyncBundle(supabase);
    return NextResponse.json(bundle, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
