import React, { useState, useEffect } from 'react';
import { 
  parsePhoneNumber, 
  CountryCode 
} from 'libphonenumber-js';
import { Phone, AlertCircle } from 'lucide-react';
import { 
  SUPPORTED_COUNTRIES, 
  getCountryByIso, 
  validateSupportedPhone,
  isIsoSupported 
} from '../../utils/countryConfig';

export interface InternationalPhoneInputProps {
  value: string;
  onChange: (e164Value: string, isValid: boolean, rawPhone: string, countryCode: CountryCode) => void;
  defaultCountry?: CountryCode;
  selectedCountryCode?: CountryCode;
  required?: boolean;
  disabled?: boolean;
  label?: string;
  error?: string;
  placeholder?: string;
  className?: string;
}

export const InternationalPhoneInput: React.FC<InternationalPhoneInputProps> = ({
  value,
  onChange,
  defaultCountry = 'SG',
  selectedCountryCode,
  required = false,
  disabled = false,
  label = 'Phone Number',
  error,
  placeholder,
  className = ''
}) => {
  // Guarantee the initial country is among the 12 supported countries (fallback to SG)
  const initialCountry = isIsoSupported(selectedCountryCode || defaultCountry)
    ? ((selectedCountryCode || defaultCountry) as CountryCode)
    : 'SG';

  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(initialCountry);
  const [nationalNumber, setNationalNumber] = useState<string>('');
  const [touched, setTouched] = useState<boolean>(false);
  const [internalError, setInternalError] = useState<string>('');

  // Sync external selectedCountryCode prop when changed
  useEffect(() => {
    if (selectedCountryCode && isIsoSupported(selectedCountryCode)) {
      setSelectedCountry(selectedCountryCode);
    }
  }, [selectedCountryCode]);

  // Extract country and national number from value prop
  useEffect(() => {
    if (!value) {
      setNationalNumber('');
      setInternalError('');
      return;
    }

    try {
      if (value.startsWith('+')) {
        const parsed = parsePhoneNumber(value);
        if (parsed && parsed.country && isIsoSupported(parsed.country)) {
          setSelectedCountry(parsed.country);
          setNationalNumber(parsed.nationalNumber);
          return;
        }
      }
    } catch {
      // Fall back to national number extraction
    }

    // Strip leading '+' and digits up to first space or raw value
    setNationalNumber(value.replace(/^\+\d+\s*/, ''));
  }, [value]);

  // Country-aware validation using the single country configuration
  const validateAndNotify = (numberStr: string, country: CountryCode) => {
    const cleaned = numberStr.trim();

    if (!cleaned) {
      if (required) {
        setInternalError('Phone number is required.');
        onChange('', false, '', country);
      } else {
        setInternalError('');
        onChange('', true, '', country);
      }
      return;
    }

    const result = validateSupportedPhone(cleaned, country);

    if (result.isValid) {
      setInternalError('');
      onChange(result.e164, true, cleaned, country);
    } else {
      const errMsg = result.errorMessage || 'Please enter a valid phone number for the selected country.';
      setInternalError(errMsg);
      onChange(result.e164 || cleaned, false, cleaned, country);
    }
  };

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCountry = e.target.value as CountryCode;
    if (isIsoSupported(newCountry)) {
      setSelectedCountry(newCountry);
      setTouched(true);
      validateAndNotify(nationalNumber, newCountry);
    }
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newNumber = e.target.value;
    setNationalNumber(newNumber);
    setTouched(true);
    validateAndNotify(newNumber, selectedCountry);
  };

  const currentCountryConfig = getCountryByIso(selectedCountry);
  const activePlaceholder = placeholder || currentCountryConfig?.placeholder || '8123 4567';
  const displayError = error || (touched ? internalError : '');

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2">
        {/* 12 SUPPORTED COUNTRIES CALLING CODE SELECTOR */}
        <div className="relative shrink-0 w-full xs:w-44 sm:w-52">
          <select
            value={selectedCountry}
            onChange={handleCountryChange}
            disabled={disabled}
            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs font-semibold focus:outline-none focus:border-[#D49A24] focus:ring-1 focus:ring-[#D49A24]/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {SUPPORTED_COUNTRIES.map((country) => (
              <option key={country.iso2} value={country.iso2}>
                {country.name} ({country.displayCallingCode})
              </option>
            ))}
          </select>
        </div>

        {/* NATIONAL PHONE NUMBER INPUT */}
        <div className="relative flex-1">
          <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="tel"
            value={nationalNumber}
            onChange={handleNumberChange}
            onBlur={() => setTouched(true)}
            placeholder={activePlaceholder}
            disabled={disabled}
            required={required}
            className={`w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-1 transition-all placeholder:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed ${
              displayError 
                ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' 
                : 'border-slate-300 dark:border-slate-700 focus:border-[#D49A24] focus:ring-[#D49A24]/20'
            }`}
          />
        </div>
      </div>

      {/* ERROR MESSAGE DISPLAY */}
      {displayError && (
        <div className="text-[10px] font-bold text-rose-500 flex items-center gap-1 mt-1">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>{displayError}</span>
        </div>
      )}
    </div>
  );
};
