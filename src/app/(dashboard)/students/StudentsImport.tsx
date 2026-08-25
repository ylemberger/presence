"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Icon } from "@/components/ui/Icon";
import {
  downloadStudentImportTemplateAction,
  importStudentsFromExcelAction,
} from "../actions";

interface ImportSummary {
  created: number;
  updated: number;
  unchanged: number;
  errors: { rowNumber: number; message: string }[];
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

export function StudentsImport({ disabledReason }: { disabledReason?: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState<"template" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  function resetState() {
    setFileName(null);
    setError(null);
    setSummary(null);
    setLoading(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function openModal() {
    if (disabledReason) return;
    resetState();
    setOpen(true);
  }

  async function handleTemplate() {
    setLoading("template");
    setError(null);
    try {
      const result = await downloadStudentImportTemplateAction();
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

  async function handleImport(form: HTMLFormElement) {
    setLoading("import");
    setError(null);
    setSummary(null);
    try {
      const result = await importStudentsFromExcelAction(new FormData(form));
      if ("error" in result && result.error && !("created" in result)) {
        setError(result.error);
        return;
      }
      if ("created" in result) {
        setSummary({
          created: result.created ?? 0,
          updated: result.updated ?? 0,
          unchanged: result.unchanged ?? 0,
          errors: result.errors ?? [],
        });
        if ("success" in result && result.success) {
          router.refresh();
        }
        if ("error" in result && result.error) {
          setError(result.error);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "הייבוא נכשל");
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
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

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="ייבוא תלמידות מאקסל"
        description="הורידי דוגמה, מלאי אותה, והעלי את הקובץ. ת.ז. קיימת תעדכן תלמידה במקום ליצור כפילות."
        className="max-w-xl"
      >
        <div className="flex flex-col gap-5">
          <ol className="list-decimal space-y-1 pe-5 text-body-md text-on-surface-variant">
            <li>הורידי את קובץ הדוגמה — כולל שמות השכבות, הכיתות, המסלולים וההתמחויות של השנה הפעילה.</li>
            <li>
              מלאי את כל העמודות. רק «התמחות נוספת» רשות. עמודת תעודת זהות עדיף כטקסט.
            </li>
            <li>
              אם הת.ז. כבר במערכת — יעודכנו השם, המחזור והשיבוץ. שיבוץ שונה נסגר ונפתח מחדש, בלי למחוק היסטוריה.
            </li>
          </ol>

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

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleImport(e.currentTarget);
            }}
            className="flex flex-col gap-3"
          >
            <label className="flex flex-col gap-1.5">
              <span className="font-label-md text-label-md text-on-surface">קובץ אקסל</span>
              <input
                ref={inputRef}
                type="file"
                name="file"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                required
                disabled={loading !== null}
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
                className="block w-full rounded-lg border border-dashed border-outline-variant bg-surface-container-low px-3 py-3 text-body-md file:me-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:font-label-md file:text-on-secondary"
              />
              {fileName && (
                <span className="text-caption text-on-surface-variant">{fileName}</span>
              )}
            </label>

            {error && (
              <p className="rounded-lg border border-error/30 bg-error-container/40 px-3 py-2 text-body-md text-on-error-container">
                {error}
              </p>
            )}

            {summary && (
              <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-3 text-body-md">
                <p className="font-label-md text-primary">סיכום ייבוא</p>
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
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={loading !== null}
              >
                סגירה
              </Button>
              <Button type="submit" disabled={loading !== null}>
                {loading === "import" ? "מייבא..." : "ייבוא הקובץ"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
}
