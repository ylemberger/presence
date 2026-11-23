import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // api/cron + api/sync use Bearer secrets, not Google login cookies.
    "/((?!_next/static|_next/image|favicon.ico|api/cron|api/sync|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
