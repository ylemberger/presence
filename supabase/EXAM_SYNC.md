# סנכרון למערכת מבחנים — מדריך

Presence היא **מקור אמת לקריאה בלבד**. מערכת המבחנים מושכת שנים, קטלוג, מורות, שיעורים ותלמידות דרך API מאובטח. **אין** לחשוף את מפתחות ה-Supabase של הנוכחות למערכת המבחנים.

## מה לעשות בנוכחות (presence)

### 1. צרי סוד משותף

במחשב / ב-PowerShell:

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

שמרי את המחרוזת — זה `EXAM_SYNC_SECRET` (לפחות 24 תווים).

### 2. הוסיפי ב-Vercel של **נוכחות**

| משתנה | ערך |
|--------|-----|
| `EXAM_SYNC_SECRET` | הסוד שיצרת |
| `SUPABASE_SERVICE_ROLE_KEY` | כבר אמור להיות לפעולות cron (Settings → API → `service_role`) |

**אל תשימי** את `EXAM_SYNC_SECRET` ב-`NEXT_PUBLIC_*`.

### 3. פריסה

אחרי העלאת הקוד ל-GitHub, ודאי ש-Vercel פרס מחדש.

### 4. בדיקה מהירה

```powershell
curl -H "Authorization: Bearer YOUR_EXAM_SYNC_SECRET" https://YOUR-PRESENCE-DOMAIN/api/sync/exam
```

אמור לחזור JSON עם `academicYears`, `teachers`, `lessons`, וכו׳.

## מה לקחת מ-Supabase של הנוכחות

| מאיפה | למי | הערה |
|--------|-----|------|
| Project URL + `anon` (`NEXT_PUBLIC_*`) | **רק** לאפליקציית הנוכחות | לא למבחנים |
| `service_role` | **רק** לשרת הנוכחות (Vercel env) | לא למבחנים, לא לקליינט |
| כלום מה-API של Supabase למבחנים | — | המבחנים קוראים ל-`/api/sync/exam` בלבד |

## מה לשים ב-Vercel של **מערכת המבחנים**

| משתנה | ערך |
|--------|-----|
| `PRESENCE_SYNC_URL` | `https://YOUR-PRESENCE-DOMAIN/api/sync/exam` |
| `PRESENCE_SYNC_SECRET` | **אותו** סוד כמו `EXAM_SYNC_SECRET` בנוכחות |

## מה מגיע ב-JSON

- `academicYears` — שנים (`id`, `name`, `is_active`)
- `grades` / `classes` / `tracks` / `specializations` / `subjects` — קטלוג לפי שנה
- `teachers` — מורות (בלי רשומות שכר)
- `lessons` — כל השיעורים + `teacher_id` / שם / ת״ז מורה, מקצוע, שכבה/כיתה/מסלול/התמחות
- `students` + `studentAssignments` — תלמידות ושיבוצים (בלי טלפוני הורים / הערות אישיות)

לכל שיעור במבחנים: upsert לפי `lessons[].id` של הנוכחות, ושייכי למורה לפי `teacher_id`.

## אסור

- לתת למבחנים את `service_role` או את ה-`anon` של הנוכחות
- לקרוא לנוכחות מהדפדפן של המבחנים (רק Server Action / Route בשרת המבחנים)
- לכתוב חזרה למסד הנוכחות ממערכת המבחנים
