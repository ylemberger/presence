import { Sidebar } from "@/components/layout/Sidebar";
import { YearSelector } from "@/components/layout/YearSelector";
import { getActiveAcademicYear, getAllAcademicYears } from "@/lib/utils";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [activeYear, years] = await Promise.all([
    getActiveAcademicYear(),
    getAllAcademicYears(),
  ]);

  return (
    <div className="flex min-h-screen">
      <main className="flex-1 overflow-auto">
        <header className="print:hidden flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <YearSelector years={years} activeYearId={activeYear?.id} />
        </header>
        <div className="p-6">{children}</div>
      </main>
      <Sidebar activeYearName={activeYear?.name} />
    </div>
  );
}
