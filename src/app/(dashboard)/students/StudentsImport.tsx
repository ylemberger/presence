"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Icon } from "@/components/ui/Icon";
import {
  downloadStudentImportTemplateAction,
  importStudentsFromExcelAction,
  previewStudentsExcelAction,
} from "../actions";

interface ImportSummary {
  created: number;
  updated: number;
  unchanged: number;
  errors: { rowNumber: number; message: string }[];
  expectedCount: number;
  success: boolean;
}

interface PreviewRow {
  rowNumber: number;
  fullName: string;
  identityNumber: string;
  className: string;
  trackName: string;
  specializationName: string;
}

function downloadBase64File(filename: string, base64: string) {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function formatImportSuccess(summary: ImportSummary): string {
  const saved = summary.created + summary.updated + summary.unchanged;
  if (summary.success && saved === summary.expectedCount && summary.expectedCount > 0) {
    return `הייבוא הצליח במלואו: נשמרו כל ${saved} התלמידות מהקובץ (נוצרו ${summary.created}, עודכנו ${summary.updated}).`;
  }
  if (summary.success) {
    return `הייבוא הצליח: נשמרו ${saved} תלמידות (נוצרו ${summary.created}, עודכנו ${summary.updated}${
      summary.unchanged ? `, ללא שינוי ${summary.unchanged}` : ""
    }).`;
  }
  return `הייבוא לא הושלם. נשמרו ${saved} תלמידות.`;
}

export function StudentsImport({ disabledReason }: { disabledReason?: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState<"template" | "preview" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [lastNotice, setLastNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    ok: boolean;
    count: number;
    rows: PreviewRow[];
    errors: { rowNumber: number; message: string }[];
  } | null>(null);

  function resetModalFields() {
    setFileName(null);
    setError(null);
    setSummary(null);
    setPreview(null);
    setLoading(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function openModal() {
    if (disabledReason) return;
    resetModalFields();
    setOpen(true);
  }

  function closeModal() {
    if (loading !== null) return;
    setOpen(false);
  }

  async function handleTemplate() {
    setLoading("template");
    setError(null);
    try {
      const result = await downloadStudentImportTemplateAction();
      if (!result) {
        setError("הורדת הדוגמה נכשלה");
        return;
      }
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      if ("base64" in result && result.base64) {
        downloadBase64File(result.filename, result.base64);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "הורדת הדוגמה נכשלה");
    } finally {
      setLoading(null);
    }
  }

  function formDataFromFile(): FormData | null {
    const file = inputRef.current?.files?.[0];
    if (!file) return null;
    const fd = new FormData();
    fd.set("file", file);
    return fd;
  }

  async function handlePreview(fileList: FileList | null) {
    const file = fileList?.[0];
    setSummary(null);
    setPreview(null);
    setError(null);
    if (!file) {
      setFileName(null);
      return;
    }
    setFileName(file.name);
    setLoading("preview");
    try {
      const fd = new FormData();
      fd.set("file", file);
      const result = await previewStudentsExcelAction(fd);
      if (!result) {
        setError("בדיקת הקובץ נכשלה. נסי שוב.");
        return;
      }
      if ("error" in result && result.error && !("rows" in result)) {
        setError(result.error);
        return;
      }
      if ("rows" in result) {
        setPreview({
          ok: Boolean(result.ok),
          count: result.count ?? 0,
          rows: result.rows ?? [],
          errors: result.errors ?? [],
        });
        if (!result.ok && result.errors?.length) {
          setError("הקובץ לא תקין. עד שלא יתוקנו כל השגיאות לא תישמר אף תלמידה.");
        }
      } else {
        setError("בדיקת הקובץ נכשלה. נסי שוב.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "בדיקת הקובץ נכשלה");
    } finally {
      setLoading(null);
    }
  }

  async function handleConfirm() {
    const fd = formDataFromFile();
    if (!fd) {
      setError("יש לבחור קובץ אקסל או CSV.");
      return;
    }
    const expectedCount = preview?.count ?? 0;
    setLoading("import");
    setError(null);
    setSummary(null);
    try {
      const result = await importStudentsFromExcelAction(fd);
      if (!result) {
        setError("הייבוא נכשל. נסי שוב.");
        return;
      }
      if ("error" in result && result.error && !("created" in result)) {
        setError(result.error);
        setPreview(null);
        return;
      }
      if ("created" in result) {
        const nextSummary: ImportSummary = {
          created: result.created ?? 0,
          updated: result.updated ?? 0,
          unchanged: result.unchanged ?? 0,
          errors: result.errors ?? [],
          expectedCount,
          success: Boolean("success" in result && result.success),
        };
        setSummary(nextSummary);
        if (nextSummary.success) {
          setPreview(null);
          setLastNotice(formatImportSuccess(nextSummary));
          router.refresh();
        }
        if ("error" in result && result.error) {
          setError(result.error);
        }
      } else {
        setError("הייבוא נכשל. נסי שוב.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "הייבוא נכשל");
    } finally {
      setLoading(null);
    }
  }

  const canConfirm = Boolean(preview?.ok && !summary && loading === null);
  const importDone = Boolean(summary?.success);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={openModal}
          disabled={Boolean(disabledReason)}
          title={disabledReason}
        >
          <Icon name="upload" className="text-[18px]" />
          ייבוא מאקסל
        </Button>
        {lastNotice && !open && (
          <p className="max-w-xl rounded-lg border border-attendance-present/30 bg-attendance-present/10 px-3 py-1.5 text-caption text-attendance-present">
            {lastNotice}
          </p>
        )}
      </div>

      <Modal
        open={open}
        onClose={closeModal}
        dismissible={loading === null}
        title="ייבוא תלמידות מאקסל"
        description="מעלים קובץ, בודקים, ואז מאשרים. אם יש שגיאה אחת — לא נשמרת אף תלמידה."
        className="max-w-2xl"
      >
        <div className="flex flex-col gap-5">
          {!importDone && (
            <ol className="list-decimal space-y-1 pe-5 text-body-md text-on-surface-variant">
              <li>הורידי את קובץ הדוגמה — כולל שמות השכבות, הכיתות, המסלולים וההתמחויות של השנה הפעילה.</li>
              <li>
                חובה: שם פרטי ומשפחה (או שם מלא), ת.ז./מ.ז., כיתה, מסלול, התמחות. עמודת תעודת זהות עדיף כטקסט.
              </li>
              <li>
                רשות: תאריך לידה / ת.ל. לועזי, ת.ל. עברי, טל / טל' אם / טל' אב / טל' תלמידה (או פל אם/אב), פסיכולוגיה, תוכנית חץ, כתובת ועוד.
              </li>
              <li>אחרי בחירת הקובץ יוצג סיכום. ייבוא רק באישור. סגירה לפני אישור לא שומרת כלום.</li>
            </ol>
          )}

          {!importDone && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={handleTemplate}
                disabled={loading !== null}
              >
                <Icon name="download" className="text-[18px]" />
                {loading === "template" ? "מכין דוגמה..." : "הורדת דוגמה"}
              </Button>
            </div>
          )}

          {!importDone && (
            <label className="flex flex-col gap-1.5">
              <span className="font-label-md text-label-md text-on-surface">קובץ אקסל</span>
              <input
                ref={inputRef}
                type="file"
                name="file"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                disabled={loading !== null}
                onChange={(e) => void handlePreview(e.target.files)}
                className="block w-full rounded-lg border border-dashed border-outline-variant bg-surface-container-low px-3 py-3 text-body-md file:me-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:font-label-md file:text-on-secondary"
              />
              {fileName && <span className="text-caption text-on-surface-variant">{fileName}</span>}
              {loading === "preview" && (
                <span className="text-caption text-on-surface-variant">בודק את הקובץ...</span>
              )}
              {loading === "import" && (
                <span className="text-caption text-on-surface-variant">
                  מייבא תלמידות… אל תסגרי את החלון עד שיופיע סיכום.
                </span>
              )}
            </label>
          )}

          {error && (
            <p className="rounded-lg border border-error/30 bg-error-container/40 px-3 py-2 text-body-md text-on-error-container">
              {error}
            </p>
          )}

          {preview && preview.errors.length > 0 && (
            <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-error/20 bg-error-container/20 px-3 py-2 text-caption text-error">
              {preview.errors.map((item) => (
                <li key={`${item.rowNumber}-${item.message}`}>
                  {item.rowNumber > 1 ? `שורה ${item.rowNumber}: ` : ""}
                  {item.message}
                </li>
              ))}
            </ul>
          )}

          {preview?.ok && (
            <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-3 text-body-md">
              <p className="font-label-md text-primary">מוכנות לייבוא: {preview.count} תלמידות</p>
              <div className="mt-2 max-h-48 overflow-auto">
                <table className="w-full text-caption">
                  <thead>
                    <tr className="text-on-surface-variant">
                      <th className="py-1 text-right font-medium">שם</th>
                      <th className="py-1 text-right font-medium">מ.ז.</th>
                      <th className="py-1 text-right font-medium">כיתה</th>
                      <th className="py-1 text-right font-medium">מסלול</th>
                      <th className="py-1 text-right font-medium">התמחות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 40).map((row) => (
                      <tr key={`${row.rowNumber}-${row.identityNumber}`}>
                        <td className="py-1">{row.fullName}</td>
                        <td className="py-1">{row.identityNumber}</td>
                        <td className="py-1">{row.className}</td>
                        <td className="py-1">{row.trackName}</td>
                        <td className="py-1">{row.specializationName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.count > 40 && (
                  <p className="mt-2 text-caption text-on-surface-variant">
                    מוצגות 40 הראשונות מתוך {preview.count}.
                  </p>
                )}
              </div>
            </div>
          )}

          {summary && (
            <div
              className={
                summary.success
                  ? "rounded-lg border border-attendance-present/30 bg-attendance-present/10 px-3 py-3 text-body-md"
                  : "rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-3 text-body-md"
              }
            >
              <p className="font-label-md text-primary">
                {summary.success ? "הייבוא הסתיים" : "סיכום ייבוא"}
              </p>
              <p className="mt-2 text-on-surface">{formatImportSuccess(summary)}</p>
              <ul className="mt-2 grid gap-1 text-on-surface-variant sm:grid-cols-3">
                <li>נוצרו: {summary.created}</li>
                <li>עודכנו: {summary.updated}</li>
                <li>ללא שינוי: {summary.unchanged}</li>
              </ul>
              {summary.errors.length > 0 && (
                <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-caption text-error">
                  {summary.errors.map((item) => (
                    <li key={`${item.rowNumber}-${item.message}`}>
                      {item.rowNumber > 1 ? `שורה ${item.rowNumber}: ` : ""}
                      {item.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant={importDone ? "primary" : "ghost"}
              onClick={closeModal}
              disabled={loading !== null}
            >
              {importDone ? "סגירה" : "ביטול"}
            </Button>
            {!importDone && (
              <Button type="button" onClick={() => void handleConfirm()} disabled={!canConfirm}>
                {loading === "import" ? "מייבא..." : "אישור ייבוא"}
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
