import React, { useState, useEffect } from 'react';
import { 
  getCountries, 
  getCountryCallingCode, 
  parsePhoneNumber, 
  isValidPhoneNumber, 
  CountryCode 
} from 'libphonenumber-js';
import { Phone, AlertCircle } from 'lucide-react';

export interface InternationalPhoneInputProps {
  value: string;
  onChange: (e164Value: string, isValid: boolean, rawPhone: string, countryCode: CountryCode) => void;
  defaultCountry?: CountryCode;
  required?: boolean;
  disabled?: boolean;
  label?: string;
  error?: string;
  placeholder?: string;
  className?: string;
}

export interface CountryOption {
  iso2: CountryCode;
  name: string;
  callingCode: string;
}

// Generate complete list of international country calling codes
const POPULAR_COUNTRIES: CountryCode[] = ['IN', 'SG', 'AE', 'GB', 'US', 'DE', 'NL', 'CN', 'JP', 'AU'];

const ALL_COUNTRY_OPTIONS: CountryOption[] = (() => {
  const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
  const countries = getCountries();
  const options: CountryOption[] = [];

  for (const iso2 of countries) {
    try {
      const callingCode = getCountryCallingCode(iso2);
      const name = displayNames.of(iso2) || iso2;
      options.push({ iso2, name, callingCode });
    } catch {
      // Ignore unsupported regions
    }
  }

  // Sort alphabetically by country name
  options.sort((a, b) => a.name.localeCompare(b.name));
  return options;
})();

export const InternationalPhoneInput: React.FC<InternationalPhoneInputProps> = ({
  value,
  onChange,
  defaultCountry = 'IN',
  required = false,
  disabled = false,
  label = 'Phone Number',
  error,
  placeholder = '9876543210',
  className = ''
}) => {
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(defaultCountry);
  const [nationalNumber, setNationalNumber] = useState<string>('');
  const [touched, setTouched] = useState<boolean>(false);
  const [internalError, setInternalError] = useState<string>('');

  // Extract initial country and national number from value prop on mount or external reset
  useEffect(() => {
    if (!value) {
      setNationalNumber('');
      setInternalError('');
      return;
    }

    try {
      if (value.startsWith('+')) {
        const parsed = parsePhoneNumber(value);
        if (parsed) {
          if (parsed.country) {
            setSelectedCountry(parsed.country);
          }
          setNationalNumber(parsed.nationalNumber);
          return;
        }
      }
    } catch {
      // Fall back to raw string
    }

    setNationalNumber(value.replace(/^\+\d+\s*/, ''));
  }, [value]);

  // Perform country-aware validation and notify parent component
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

    try {
      const callingCode = getCountryCallingCode(country);
      const fullNumber = `+${callingCode}${cleaned.replace(/^[0\s-]+/, '')}`;
      const isValid = isValidPhoneNumber(fullNumber, country);

      if (isValid) {
        const parsed = parsePhoneNumber(fullNumber, country);
        const e164 = parsed ? parsed.format('E.164') : fullNumber;
        setInternalError('');
        onChange(e164, true, cleaned, country);
      } else {
        const errMsg = 'Please enter a valid phone number for the selected country.';
        setInternalError(errMsg);
        onChange(fullNumber, false, cleaned, country);
      }
    } catch {
      const errMsg = 'Please enter a valid phone number for the selected country.';
      setInternalError(errMsg);
      onChange(numberStr, false, cleaned, country);
    }
  };

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCountry = e.target.value as CountryCode;
    setSelectedCountry(newCountry);
    setTouched(true);
    validateAndNotify(nationalNumber, newCountry);
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newNumber = e.target.value;
    setNationalNumber(newNumber);
    setTouched(true);
    validateAndNotify(newNumber, selectedCountry);
  };

  const displayError = error || (touched ? internalError : '');

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2">
        {/* COUNTRY CALLING CODE SELECTOR */}
        <div className="relative shrink-0 w-full xs:w-36 sm:w-44">
          <select
            value={selectedCountry}
            onChange={handleCountryChange}
            disabled={disabled}
            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs font-semibold focus:outline-none focus:border-[#D49A24] focus:ring-1 focus:ring-[#D49A24]/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >

            <optgroup label="Popular Countries">
              {POPULAR_COUNTRIES.map(iso2 => {
                const opt = ALL_COUNTRY_OPTIONS.find(o => o.iso2 === iso2);
                if (!opt) return null;
                return (
                  <option key={`pop-${opt.iso2}`} value={opt.iso2}>
                    {opt.name} (+{opt.callingCode})
                  </option>
                );
              })}
            </optgroup>
            <optgroup label="All Countries">
              {ALL_COUNTRY_OPTIONS.map(opt => (
                <option key={`all-${opt.iso2}`} value={opt.iso2}>
                  {opt.name} (+{opt.callingCode})
                </option>
              ))}
            </optgroup>
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
            placeholder={placeholder}
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
