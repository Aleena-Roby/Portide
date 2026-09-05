import re
from rest_framework import serializers
import phonenumbers
from phonenumbers.phonenumberutil import NumberParseException, is_valid_number, is_possible_number, region_code_for_number

def validate_strong_password(value):
    """
    Validates that a password satisfies strong enterprise password requirements:
    1. Minimum 8 characters
    2. At least one uppercase letter (A-Z)
    3. At least one lowercase letter (a-z)
    4. At least one numeric digit (0-9)
    5. At least one special character
    """
    password = str(value)
    if len(password) < 8:
        raise serializers.ValidationError("Password must be at least 8 characters long.")
    if not re.search(r'[A-Z]', password):
        raise serializers.ValidationError("Password must contain at least one uppercase letter (A-Z).")
    if not re.search(r'[a-z]', password):
        raise serializers.ValidationError("Password must contain at least one lowercase letter (a-z).")
    if not re.search(r'[0-9]', password):
        raise serializers.ValidationError("Password must contain at least one numeric digit (0-9).")
    if not re.search(r'[^A-Za-z0-9]', password):
        raise serializers.ValidationError("Password must contain at least one special character (e.g. !@#$%^&*).")
    return password


# Single source of truth for the 12 supported countries in PORTIDE backend
SUPPORTED_COUNTRIES = {
    'SG': {'name': 'Singapore', 'calling_code': '65'},
    'IN': {'name': 'India', 'calling_code': '91'},
    'AE': {'name': 'United Arab Emirates', 'calling_code': '971'},
    'GB': {'name': 'United Kingdom', 'calling_code': '44'},
    'DE': {'name': 'Germany', 'calling_code': '49'},
    'JP': {'name': 'Japan', 'calling_code': '81'},
    'US': {'name': 'United States', 'calling_code': '1'},
    'NL': {'name': 'Netherlands', 'calling_code': '31'},
    'GR': {'name': 'Greece', 'calling_code': '30'},
    'CN': {'name': 'China', 'calling_code': '86'},
    'PA': {'name': 'Panama', 'calling_code': '507'},
    'MH': {'name': 'Marshall Islands', 'calling_code': '692'},
}

COUNTRY_NAME_TO_ISO = {
    'singapore': 'SG',
    'sg': 'SG',
    'india': 'IN',
    'in': 'IN',
    'united arab emirates': 'AE',
    'uae': 'AE',
    'ae': 'AE',
    'united kingdom': 'GB',
    'uk': 'GB',
    'gb': 'GB',
    'germany': 'DE',
    'de': 'DE',
    'japan': 'JP',
    'jp': 'JP',
    'united states': 'US',
    'usa': 'US',
    'us': 'US',
    'netherlands': 'NL',
    'nl': 'NL',
    'greece': 'GR',
    'gr': 'GR',
    'china': 'CN',
    'cn': 'CN',
    'panama': 'PA',
    'pa': 'PA',
    'marshall islands': 'MH',
    'mh': 'MH',
}

SUPPORTED_ISO_CODES = set(SUPPORTED_COUNTRIES.keys())

def resolve_country_iso(country_input):
    """
    Resolves country name or code to uppercase ISO2 string if supported.
    Returns None if unsupported.
    """
    if not country_input:
        return None
    cleaned = str(country_input).strip().lower()
    return COUNTRY_NAME_TO_ISO.get(cleaned)


def validate_international_phone_number(value, default_region='SG', required=False):
    """
    Validates an international phone number using Google's libphonenumber (phonenumbers library).
    Restricted strictly to the 12 supported countries in PORTIDE:
    Singapore (+65), India (+91), UAE (+971), UK (+44), Germany (+49),
    Japan (+81), US (+1), Netherlands (+31), Greece (+30), China (+86),
    Panama (+507), Marshall Islands (+692).

    Returns E.164 normalized phone string (e.g. '+6581234567', '+919876543210').
    If invalid, malformed, or from an unsupported country, raises serializers.ValidationError.
    """
    phone_str = str(value or '').strip()

    if not phone_str:
        if required:
            raise serializers.ValidationError("Phone number is required.")
        return ""

    # Reject invalid characters (allow only digits, +, spaces, hyphens, parentheses)
    if re.search(r'[^0-9+\s\-()]', phone_str):
        raise serializers.ValidationError("Please enter a valid phone number for the selected country.")

    # Resolve default region
    region_iso = resolve_country_iso(default_region) or 'SG'

    try:
        if phone_str.startswith('+'):
            parsed_num = phonenumbers.parse(phone_str, None)
        else:
            parsed_num = phonenumbers.parse(phone_str, region_iso)

        if not is_possible_number(parsed_num) or not is_valid_number(parsed_num):
            raise serializers.ValidationError("Please enter a valid phone number for the selected country.")

        # Determine country region for the parsed phone number
        detected_region = region_code_for_number(parsed_num)
        if not detected_region or detected_region not in SUPPORTED_ISO_CODES:
            raise serializers.ValidationError("Please enter a valid phone number for the selected country.")

        return phonenumbers.format_number(parsed_num, phonenumbers.PhoneNumberFormat.E164)
    except NumberParseException:
        raise serializers.ValidationError("Please enter a valid phone number for the selected country.")
