# מערכת נוכחות סמינר

מערכת ניהול נוכחות היסטורית לסמינר — Next.js + Supabase.

## התקנה

1. **Supabase:** צרי פרויקט חדש ב-[supabase.com](https://supabase.com)
2. **מיגרציה:** הריצי ב-SQL Editor לפי הסדר:
   - [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
   - [`supabase/migrations/0002_performance.sql`](supabase/migrations/0002_performance.sql)
   - (אופציונלי) [`supabase/seed_demo.sql`](supabase/seed_demo.sql) — נתוני דמה לבדיקות
3. **Auth עם Google:**
   1. ב-[Google Cloud Console](https://console.cloud.google.com/) צרי OAuth 2.0 Client (Web)
   2. Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
   3. ב-Supabase: Authentication → Providers → Google — הפעילי והדביקי Client ID + Secret
   4. ב-Supabase: Authentication → URL Configuration הוסיפי `http://localhost:3000/auth/callback` (וגם את כתובת הייצור)
4. **משתני סביבה:** העתיקי `.env.local.example` ל-`.env.local` ומלאי את הערכים מ-Project Settings → API
5. המייל הראשון המורשה להתחברות: `t025959714@gmail.com` (ראי `src/lib/auth/allowed-emails.ts`)

```bash
npm install
npm run dev
```

## מבנה

- `/login` — התחברות Google
- `/` — לוח בקרה
- `/settings` — שנים, שכבות, כיתות, מגמות, טווחי פעילות (תאריכים עבריים), כללי נוכחות
- `/students` — תלמידות, שיבוצים, שיוך לשיעורים, אחוזי נוכחות והדפסה
- `/teachers` — מורות וסנכרון מקור חיצוני
- `/lessons` — יומן חודשי עברי: לחיצה על יום → שיעורים / יצירה / ביטול
- `/attendance` — יומן נוכחות שבועי עם תאריכים עבריים
- `/reports` — דוחות והדפסה (כולל כל הכיתות)

## תאריכים
הממשק מציג ובוחר תאריכים עבריים בלבד (`@hebcal/core`). במסד נשמר `date` ISO.

## כללי פיתוח

ראי [`AGENTS.md`](AGENTS.md) לפני שינויים במערכת.
