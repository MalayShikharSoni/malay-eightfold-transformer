import {
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

export const DEFAULT_PHONE_COUNTRY: CountryCode = "IN";

export interface NormalizePhoneOptions {
  /** Used when the input has no country calling code. Defaults to IN (sample data). */
  defaultCountry?: CountryCode;
}

export function normalizePhone(
  rawValue: unknown,
  options?: NormalizePhoneOptions,
): string | null {
  if (typeof rawValue !== "string") {
    return null;
  }

  const trimmed = rawValue.trim();
  if (trimmed === "") {
    return null;
  }

  const defaultCountry = options?.defaultCountry ?? DEFAULT_PHONE_COUNTRY;

  try {
    const phone = parsePhoneNumberFromString(trimmed, defaultCountry);
    if (phone?.isValid()) {
      return phone.format("E.164");
    }
    return null;
  } catch {
    return null;
  }
}
