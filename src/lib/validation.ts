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

export function parseLessonBilling(formData: FormData):
  | {
      billing_type: "mandatory" | "specialization";
      class_id: string | null;
      track_id: string | null;
      specialization_id: string | null;
      for_psychology: boolean;
    }
  | { error: string } {
  const billingType = String(formData.get("billing_type") ?? "");
  const forPsychology =
    formData.get("for_psychology") === "on" ||
    formData.get("for_psychology") === "1" ||
    formData.get("for_psychology") === "true";
  const classId = String(formData.get("class_id") ?? "").trim() || null;
  const trackId = String(formData.get("track_id") ?? "").trim() || null;
  const specializationId = String(formData.get("specialization_id") ?? "").trim() || null;

  if (billingType === "specialization") {
    if (!specializationId) return { error: "יש לבחור התמחות" };
    return {
      billing_type: "specialization",
      class_id: null,
      track_id: null,
      specialization_id: specializationId,
      for_psychology: false,
    };
  }

  if (billingType === "mandatory") {
    if (forPsychology) {
      return {
        billing_type: "mandatory",
        class_id: null,
        track_id: null,
        specialization_id: null,
        for_psychology: true,
      };
    }
    if (!classId && !trackId) {
      return { error: "בשיבוץ חובה יש לבחור כיתה או מסלול (או את שתיהן), או לסמן מיועד לפסיכולוגיה" };
    }
    return {
      billing_type: "mandatory",
      class_id: classId,
      track_id: trackId,
      specialization_id: null,
      for_psychology: false,
    };
  }

  return { error: "יש לבחור סוג שיעור: חובה או התמחות" };
}

/** Audience rule: class∩track when both set; grade always filters when present. */
export function describeAudienceScope(opts: {
  billing_type: "mandatory" | "specialization";
  gradeName?: string | null;
  className?: string | null;
  trackName?: string | null;
  specializationName?: string | null;
  forPsychology?: boolean;
}): string {
  if (opts.forPsychology) {
    return [opts.gradeName, "פסיכולוגיה"].filter(Boolean).join(" · ");
  }
  if (opts.billing_type === "specialization") {
    const parts = [opts.gradeName, opts.specializationName].filter(Boolean);
    return parts.length ? parts.join(" · ") : "התמחות";
  }
  const parts: string[] = [];
  if (opts.gradeName) parts.push(opts.gradeName);
  if (opts.className && opts.trackName) {
    parts.push(`${opts.className} ∩ ${opts.trackName}`);
  } else if (opts.className) {
    parts.push(opts.className);
  } else if (opts.trackName) {
    parts.push(opts.trackName);
  }
  return parts.length ? parts.join(" · ") : "חובה";
}
