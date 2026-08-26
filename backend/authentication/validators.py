import re
from rest_framework import serializers

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


import phonenumbers
from phonenumbers.phonenumberutil import NumberParseException, is_valid_number, is_possible_number

def validate_international_phone_number(value, default_region='IN', required=False):
    """
    Validates an international phone number using Google's libphonenumber (phonenumbers library).
    Returns E.164 normalized phone string (e.g. '+919876543210', '+447911123456', '+971501234567').
    If invalid or malformed, raises serializers.ValidationError("Please enter a valid phone number for the selected country.").
    """
    phone_str = str(value or '').strip()

    if not phone_str:
        if required:
            raise serializers.ValidationError("Phone number is required.")
        return ""

    try:
        if phone_str.startswith('+'):
            parsed_num = phonenumbers.parse(phone_str, None)
        else:
            region = str(default_region or 'IN').upper()
            parsed_num = phonenumbers.parse(phone_str, region)

        if not is_possible_number(parsed_num) or not is_valid_number(parsed_num):
            raise serializers.ValidationError("Please enter a valid phone number for the selected country.")

        return phonenumbers.format_number(parsed_num, phonenumbers.PhoneNumberFormat.E164)
    except NumberParseException:
        raise serializers.ValidationError("Please enter a valid phone number for the selected country.")

