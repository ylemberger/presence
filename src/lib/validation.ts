export function requireText(value: FormDataEntryValue | null, label: string): string | { error: string } {
  const text = String(value ?? "").trim();
  if (!text) return { error: `יש למלא את השדה: ${label}` };
  return text;
}

export function requireId(value: FormDataEntryValue | null, label: string): string | { error: string } {
  const text = String(value ?? "").trim();
  if (!text) return { error: `יש לבחור ${label}` };
  return text;
}

export function requireIsoDate(value: FormDataEntryValue | null, label: string): string | { error: string } {
  const text = String(value ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return { error: `יש לבחור ${label}` };
  return text;
}

export function isError(result: string | { error: string }): result is { error: string } {
  return typeof result === "object" && "error" in result;
}

export function validateIsraeliId(raw: string): string | { error: string } {
  const id = raw.replace(/\D/g, "");
  if (id.length < 5 || id.length > 9) {
    return { error: 'מספר תעודת זהות אינו תקין' };
  }
  return id.padStart(9, "0");
}

export function validateEmail(raw: string): string | { error: string } {
  const email = raw.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "כתובת אימייל אינה תקינה" };
  }
  return email;
}

export function validatePhone(raw: string): string | { error: string } {
  const phone = raw.trim();
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 9) {
    return { error: "יש להזין מספר טלפון תקין" };
  }
  return phone;
}

function collectIds(formData: FormData, name: string): string[] {
  const values = formData
    .getAll(name)
    .flatMap((v) => String(v ?? "").split(","))
    .map((v) => v.trim())
    .filter(Boolean);
  return [...new Set(values)];
}

export function parseLessonBilling(formData: FormData):
  | {
      billing_type: "mandatory" | "specialization";
      class_id: string | null;
      track_id: string | null;
      specialization_id: string | null;
      class_ids: string[];
      track_ids: string[];
      specialization_ids: string[];
      for_psychology: boolean;
      whole_grade: boolean;
    }
  | { error: string } {
  const billingType = String(formData.get("billing_type") ?? "");
  const forPsychology =
    formData.get("for_psychology") === "on" ||
    formData.get("for_psychology") === "1" ||
    formData.get("for_psychology") === "true";
  const wholeGrade =
    formData.get("whole_grade") === "on" ||
    formData.get("whole_grade") === "1" ||
    formData.get("whole_grade") === "true";

  const classIds = collectIds(formData, "class_ids");
  const trackIds = collectIds(formData, "track_ids");
  const specializationIds = collectIds(formData, "specialization_ids");
  const singleClass = String(formData.get("class_id") ?? "").trim();
  const singleTrack = String(formData.get("track_id") ?? "").trim();
  const singleSpec = String(formData.get("specialization_id") ?? "").trim();
  if (singleClass && !classIds.includes(singleClass)) classIds.push(singleClass);
  if (singleTrack && !trackIds.includes(singleTrack)) trackIds.push(singleTrack);
  if (singleSpec && !specializationIds.includes(singleSpec)) specializationIds.push(singleSpec);

  if (billingType === "specialization") {
    if (specializationIds.length === 0) return { error: "יש לבחור לפחות התמחות אחת" };
    return {
      billing_type: "specialization",
      class_id: null,
      track_id: null,
      specialization_id: specializationIds[0],
      class_ids: [],
      track_ids: [],
      specialization_ids: specializationIds,
      for_psychology: false,
      whole_grade: false,
    };
  }

  if (billingType === "mandatory") {
    if (forPsychology) {
      return {
        billing_type: "mandatory",
        class_id: null,
        track_id: null,
        specialization_id: null,
        class_ids: [],
        track_ids: [],
        specialization_ids: [],
        for_psychology: true,
        whole_grade: false,
      };
    }
    if (wholeGrade) {
      return {
        billing_type: "mandatory",
        class_id: null,
        track_id: null,
        specialization_id: null,
        class_ids: [],
        track_ids: [],
        specialization_ids: [],
        for_psychology: false,
        whole_grade: true,
      };
    }
    if (classIds.length === 0 && trackIds.length === 0 && specializationIds.length === 0) {
      return {
        billing_type: "mandatory",
        class_id: null,
        track_id: null,
        specialization_id: null,
        class_ids: [],
        track_ids: [],
        specialization_ids: [],
        for_psychology: false,
        whole_grade: true,
      };
    }
    return {
      billing_type: "mandatory",
      class_id: classIds[0] ?? null,
      track_id: trackIds[0] ?? null,
      specialization_id: null,
      class_ids: classIds,
      track_ids: trackIds,
      specialization_ids: specializationIds,
      for_psychology: false,
      whole_grade: false,
    };
  }

  return { error: "יש לבחור סוג שיעור: חובה או התמחות" };
}

/** Audience: OR across selected classes / tracks / specializations; whole grade if none. */
export function describeAudienceScope(opts: {
  billing_type: "mandatory" | "specialization";
  gradeName?: string | null;
  classNames?: string[];
  trackNames?: string[];
  specializationNames?: string[];
  className?: string | null;
  trackName?: string | null;
  specializationName?: string | null;
  forPsychology?: boolean;
  wholeGrade?: boolean;
}): string {
  if (opts.forPsychology) {
    return [opts.gradeName, "פסיכולוגיה"].filter(Boolean).join(" · ");
  }
  const classNames = opts.classNames?.length
    ? opts.classNames
    : opts.className
      ? [opts.className]
      : [];
  const trackNames = opts.trackNames?.length
    ? opts.trackNames
    : opts.trackName
      ? [opts.trackName]
      : [];
  const specNames = opts.specializationNames?.length
    ? opts.specializationNames
    : opts.specializationName
      ? [opts.specializationName]
      : [];

  if (opts.billing_type === "specialization") {
    const specs = specNames.length ? specNames.join(" / ") : "התמחות";
    return [opts.gradeName, specs].filter(Boolean).join(" · ");
  }
  if (opts.wholeGrade || (classNames.length === 0 && trackNames.length === 0 && specNames.length === 0)) {
    return [opts.gradeName, "כל השכבה"].filter(Boolean).join(" · ");
  }
  const parts: string[] = [];
  if (opts.gradeName) parts.push(opts.gradeName);
  const groups = [...classNames, ...trackNames, ...specNames];
  if (groups.length) parts.push(groups.join(" / "));
  return parts.length ? parts.join(" · ") : "חובה";
}
