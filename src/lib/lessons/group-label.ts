/** Short group label for attendance: "כיתה יג 1" / "התמחות אדריכלות · שנה א". */

export function formatLessonGroupLabel(opts: {
  billingType?: string | null;
  forPsychology?: boolean;
  gradeNames: string[];
  classNames: string[];
  trackNames: string[];
  specializationNames: string[];
}): string {
  const grades = uniqueNames(opts.gradeNames);
  const classes = uniqueNames(opts.classNames);
  const tracks = uniqueNames(opts.trackNames);
  const specs = uniqueNames(opts.specializationNames);
  const yearPart = grades.map((g) => (g.startsWith("שנה") ? g : `שנה ${g}`)).join(" / ");

  if (opts.forPsychology) {
    return ["פסיכולוגיה", yearPart].filter(Boolean).join(" · ");
  }

  if (opts.billingType === "specialization" || (specs.length > 0 && classes.length === 0 && tracks.length === 0)) {
    const specLabel = specs.length
      ? specs.map((n) => `התמחות ${n}`).join(" / ")
      : "התמחות";
    return [specLabel, yearPart].filter(Boolean).join(" · ");
  }

  const parts: string[] = [];
  if (classes.length === 1) parts.push(`כיתה ${classes[0]}`);
  else if (classes.length > 1) parts.push(`כיתות ${classes.join(" / ")}`);
  if (tracks.length) parts.push(tracks.map((n) => `מסלול ${n}`).join(" / "));
  if (specs.length) parts.push(specs.map((n) => `התמחות ${n}`).join(" / "));
  if (parts.length === 0 && yearPart) {
    return grades.map((g) => `שכבה ${g}`).join(" / ");
  }
  return parts.join(" · ");
}

export function audienceKey(opts: {
  teacherId: string;
  subject: string;
  gradeIds: string[];
  classIds: string[];
  trackIds: string[];
  specializationIds: string[];
  forPsychology: boolean;
}): string {
  const sortJoin = (ids: string[]) => [...new Set(ids)].sort().join(",");
  return [
    opts.teacherId,
    opts.subject.trim(),
    opts.forPsychology ? "psy" : "",
    sortJoin(opts.gradeIds),
    sortJoin(opts.classIds),
    sortJoin(opts.trackIds),
    sortJoin(opts.specializationIds),
  ].join("|");
}

function uniqueNames(names: string[]): string[] {
  return [...new Set(names.map((n) => n.trim()).filter(Boolean))];
}
