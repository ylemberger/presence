# מערכת נוכחות סמינר

מערכת ניהול נוכחות היסטורית לסמינר — Next.js + Supabase.

## התקנה

1. **Supabase:** צרי פרויקט חדש ב-[supabase.com](https://supabase.com)
2. **מסד נתונים:** ב-Supabase SQL Editor:
   - פרויקט **חדש** — הריצי [`supabase/setup_database.sql`](supabase/setup_database.sql) (פעם אחת, יוצר את כל הטבלאות)
   - **לרוקן נתונים** (שומר טבלאות) — [`supabase/reset_all_data.sql`](supabase/reset_all_data.sql)
   - פירוט: [`supabase/README.md`](supabase/README.md)
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

## מבנה הפרויקט

```
src/
├── app/
│   ├── (auth)/login/          # התחברות Google
│   ├── (dashboard)/           # כל המסכים אחרי login
│   │   ├── actions.ts         # Server Actions — כל הכתיבה ל-DB
│   │   ├── settings/          # שנים, כיתות, טווחי פעילות
│   │   ├── students/          # תלמידות + שיבוצים
│   │   ├── teachers/          # מורות
│   │   ├── lessons/           # יומן שיעורים עברי
│   │   ├── attendance/        # רישום נוכחות
│   │   ├── reports/           # דוחות
│   │   └── makeup/            # מבחני השלמה
│   └── api/cron/              # יצירת מופעי שיעור אוטומטית
├── components/
│   ├── layout/                # Sidebar, YearSelector
│   └── ui/                    # רכיבי UI משותפים
├── lib/
│   ├── supabase/              # client / server / middleware
│   ├── dates/hebrew.ts        # תאריכים עבריים (@hebcal/core)
│   ├── attendance/            # חישובי נוכחות
│   ├── lessons/               # מופעי שיעור, שיוך אוטומטי
│   └── years/                 # שכבות א/ב/ג, קידום שנה
└── types/database.ts          # טיפוסי TypeScript לטבלאות
```

## מסכים

- `/login` — התחברות Google
- `/` — לוח בקרה
- `/settings` — שנים, שכבות, כיתות, מסלולים, טווחי פעילות (תאריכים עבריים), כללי נוכחות
- `/students` — תלמידות, שיבוצים, שיוך לשיעורים, אחוזי נוכחות והדפסה
- `/teachers` — מורות וסנכרון מקור חיצוני
- `/lessons` — יומן חודשי עברי: לחיצה על יום → שיעורים / יצירה / ביטול
- `/attendance` — יומן נוכחות שבועי עם תאריכים עבריים
- `/reports` — דוחות והדפסה (כולל כל הכיתות)

## תאריכים
הממשק מציג ובוחר תאריכים עבריים בלבד (`@hebcal/core`). במסד נשמר `date` ISO.

## כללי פיתוח

ראי [`AGENTS.md`](AGENTS.md) לפני שינויים במערכת.
