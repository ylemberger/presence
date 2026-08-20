# מערכת נוכחות סמינר

מערכת ניהול נוכחות היסטורית לסמינר — Next.js + Supabase.

## התקנה

1. **Supabase:** צרי פרויקט חדש ב-[supabase.com](https://supabase.com)
2. **מיגרציה:** הריצי את [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) ב-SQL Editor
3. **Auth:** צרי משתמש (Email/Password) ב-Authentication → Users
4. **משתני סביבה:** העתיקי `.env.local.example` ל-`.env.local` ומלאי את הערכים מ-Project Settings → API

```bash
npm install
npm run dev
```

## מבנה

- `/login` — התחברות
- `/` — לוח בקרה
- `/settings` — שנים, שכבות, כיתות, מגמות, טווחי פעילות, כללי נוכחות
- `/students` — תלמידות ושיבוצים היסטוריים
- `/teachers` — מורות וסנכרון מקור חיצוני
- `/lessons` — תבניות שיעור ומופעים
- `/attendance` — יומן נוכחות שבועי
- `/reports` — דוחות והדפסה

## כללי פיתוח

ראי [`AGENTS.md`](AGENTS.md) לפני שינויים במערכת.
