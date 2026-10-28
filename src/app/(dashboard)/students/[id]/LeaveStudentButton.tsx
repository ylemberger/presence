"use client";

import { DeleteButton } from "@/components/ui/DeleteButton";
import { leaveStudentAction } from "../../actions";

export function LeaveStudentButton({
  studentId,
  studentName,
  isActive,
}: {
  studentId: string;
  studentName: string;
  isActive: boolean;
}) {
  if (!isActive) return null;
  return (
    <DeleteButton
      label="תלמידה עזבה"
      redirectTo="/students"
      confirmMessage={`התלמידה ${studentName} תסומן כלא פעילה, יוסרו רק השיוכים שלה לשיעורים, ושיבוץ הכיתה הפתוח ייסגר. לא יימחקו שיעורים, נוכחות, מבחני השלמה או תלמידות אחרות. להמשיך?`}
      onDelete={() => leaveStudentAction(studentId)}
    />
  );
}
