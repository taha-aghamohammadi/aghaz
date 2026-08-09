const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function toEnDigits(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, (ch) => {
    const fa = FA_DIGITS.indexOf(ch);
    if (fa > -1) return String(fa);
    return String(AR_DIGITS.indexOf(ch));
  });
}

/** Validates an Iranian national ID (کد ملی) with its checksum. */
export function normalizeNationalId(raw: string): string | null {
  const digits = toEnDigits(raw).replace(/\D/g, "");
  if (!/^\d{10}$/.test(digits)) return null;
  if (/^(\d)\1{9}$/.test(digits)) return null;
  const check = Number(digits[9]);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(digits[i]) * (10 - i);
  const rem = sum % 11;
  const valid = rem < 2 ? check === rem : check === 11 - rem;
  return valid ? digits : null;
}
