import { CountryCode, isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js';

export interface SupportedCountry {
  name: string;
  iso2: CountryCode;
  callingCode: string;
  displayCallingCode: string;
  placeholder: string;
}

/**
 * Single source of truth for the 12 supported countries in PORTIDE.
 * No other countries are permitted.
 */
export const SUPPORTED_COUNTRIES: readonly SupportedCountry[] = [
  { name: 'Singapore', iso2: 'SG', callingCode: '65', displayCallingCode: '+65', placeholder: '8123 4567' },
  { name: 'India', iso2: 'IN', callingCode: '91', displayCallingCode: '+91', placeholder: '98765 43210' },
  { name: 'United Arab Emirates', iso2: 'AE', callingCode: '971', displayCallingCode: '+971', placeholder: '50 123 4567' },
  { name: 'United Kingdom', iso2: 'GB', callingCode: '44', displayCallingCode: '+44', placeholder: '7912 345678' },
  { name: 'Germany', iso2: 'DE', callingCode: '49', displayCallingCode: '+49', placeholder: '1512 3456789' },
  { name: 'Japan', iso2: 'JP', callingCode: '81', displayCallingCode: '+81', placeholder: '90 1234 5678' },
  { name: 'United States', iso2: 'US', callingCode: '1', displayCallingCode: '+1', placeholder: '202 555 0123' },
  { name: 'Netherlands', iso2: 'NL', callingCode: '31', displayCallingCode: '+31', placeholder: '6 12345678' },
  { name: 'Greece', iso2: 'GR', callingCode: '30', displayCallingCode: '+30', placeholder: '691 234 5678' },
  { name: 'China', iso2: 'CN', callingCode: '86', displayCallingCode: '+86', placeholder: '138 0013 8000' },
  { name: 'Panama', iso2: 'PA', callingCode: '507', displayCallingCode: '+507', placeholder: '6123 4567' },
  { name: 'Marshall Islands', iso2: 'MH', callingCode: '692', displayCallingCode: '+692', placeholder: '235 1234' },
] as const;

export const SUPPORTED_COUNTRY_NAMES = SUPPORTED_COUNTRIES.map((c) => c.name);
export const SUPPORTED_ISO_CODES = SUPPORTED_COUNTRIES.map((c) => c.iso2);

/**
 * Retrieve supported country metadata by country name (case-insensitive)
 */
export const getCountryByName = (name?: string | null): SupportedCountry | undefined => {
  if (!name) return undefined;
  const lower = name.trim().toLowerCase();
  return SUPPORTED_COUNTRIES.find((c) => c.name.toLowerCase() === lower);
};

/**
 * Retrieve supported country metadata by ISO2 code (case-insensitive)
 */
export const getCountryByIso = (iso?: string | null): SupportedCountry | undefined => {
  if (!iso) return undefined;
  const upper = iso.trim().toUpperCase();
  return SUPPORTED_COUNTRIES.find((c) => c.iso2 === upper);
};

/**
 * Retrieve supported country metadata by calling code (with or without '+')
 */
export const getCountryByCallingCode = (code?: string | null): SupportedCountry | undefined => {
  if (!code) return undefined;
  const cleaned = code.replace(/^\+/, '').trim();
  return SUPPORTED_COUNTRIES.find((c) => c.callingCode === cleaned);
};

/**
 * Check whether an ISO2 code is among the 12 supported countries
 */
export const isIsoSupported = (iso?: string | null): boolean => {
  if (!iso) return false;
  return SUPPORTED_ISO_CODES.includes(iso.trim().toUpperCase() as CountryCode);
};

/**
 * Check whether a country name is among the 12 supported countries
 */
export const isCountryNameSupported = (name?: string | null): boolean => {
  if (!name) return false;
  const lower = name.trim().toLowerCase();
  return SUPPORTED_COUNTRIES.some((c) => c.name.toLowerCase() === lower);
};

export interface PhoneValidationResult {
  isValid: boolean;
  e164: string;
  country?: SupportedCountry;
  errorMessage?: string;
}

/**
 * Country-aware phone validation strictly restricted to the 12 supported countries
 */
export const validateSupportedPhone = (
  phone: string,
  selectedCountryCode: CountryCode = 'SG'
): PhoneValidationResult => {
  const cleaned = (phone || '').trim();
  if (!cleaned) {
    return {
      isValid: false,
      e164: '',
      errorMessage: 'Phone number is required.'
    };
  }

  const supported = getCountryByIso(selectedCountryCode);
  if (!supported) {
    return {
      isValid: false,
      e164: cleaned,
      errorMessage: 'Please enter a valid phone number for the selected country.'
    };
  }

  // Reject clearly invalid non-phone characters (letters, symbols other than digits, plus, hyphens, spaces, parentheses)
  if (/[^0-9+\s\-()]/i.test(cleaned)) {
    return {
      isValid: false,
      e164: cleaned,
      errorMessage: 'Please enter a valid phone number for the selected country.'
    };
  }

  try {
    let fullNumber: string;
    if (cleaned.startsWith('+')) {
      fullNumber = cleaned;
    } else {
      const nationalOnly = cleaned.replace(/^[0\s-]+/, '');
      fullNumber = `+${supported.callingCode}${nationalOnly}`;
    }

    const parsed = parsePhoneNumber(fullNumber, supported.iso2);

    if (parsed && isValidPhoneNumber(parsed.number, supported.iso2)) {
      // Ensure the parsed country matches one of the 12 supported countries
      if (parsed.country && isIsoSupported(parsed.country)) {
        const countryMeta = getCountryByIso(parsed.country);
        return {
          isValid: true,
          e164: parsed.format('E.164'),
          country: countryMeta || supported,
        };
      }
    }

    return {
      isValid: false,
      e164: fullNumber,
      errorMessage: 'Please enter a valid phone number for the selected country.'
    };
  } catch {
    return {
      isValid: false,
      e164: cleaned,
      errorMessage: 'Please enter a valid phone number for the selected country.'
    };
  }
};
