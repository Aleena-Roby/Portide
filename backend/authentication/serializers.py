import re
import datetime
from rest_framework import serializers
from django.contrib.auth.hashers import make_password
from django.db import transaction
from django.utils import timezone
from authentication.models import (
    Login, 
    User, 
    ShippingCompany, 
    RegistrationRequest, 
    Vessel, 
    VesselArrivalRequest, 
    Department, 
    Role, 
    Berth, 
    VesselSchedule,
    SystemSetting,
    AuditLog,
    Cargo,
    Port,
    Container,
    CustomsInspection,
    CustomsDocument,
    GateRelease,
    Truck,
    Driver,
    Gate,
    GatePass,
    GatePassContainer,
    ContainerTrackingEvent,
    Yard,
    YardBlock,
    YardSlot,
    YardAllocation,
    YardMovementHistory,
    Crane,
    CraneAllocation,
    PreArrivalCustomsDeclaration,
    DeliveryOrder,
    DirectShipToTruckTransfer,
    get_min_arrival_advance_days
)
from authentication.qr_service import generate_qr_svg, generate_qr_png_base64
from authentication.validators import (
    validate_strong_password, 
    generate_temporary_password,
    generate_unique_employee_id,
    validate_international_phone_number,
    resolve_country_iso
)


class LoginSerializer(serializers.Serializer):
    email = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)

    def validate_email(self, value):
        val = value.strip().lower()
        if val == 'admin':
            return 'admin@portide.com'
        return val


class ShippingCompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = ShippingCompany
        fields = [
            'shipping_company_id',
            'shipping_company_name',
            'shipping_company_license_number',
            'shipping_company_email',
            'shipping_company_phone',
            'shipping_company_address',
            'shipping_company_jurisdiction',
            'shipping_company_status',
            'shipping_company_created_at'
        ]


class RegistrationRequestSerializer(serializers.Serializer):
    request_company_name = serializers.CharField(required=True, max_length=150)
    request_registration_no = serializers.CharField(required=True, max_length=100)
    request_entity_type = serializers.CharField(required=False, default='Shipping Company / Shipping Agent')
    request_applicant_name = serializers.CharField(required=True, max_length=150)
    request_email = serializers.EmailField(required=True)
    request_phone = serializers.CharField(required=True, max_length=50)
    request_jurisdiction = serializers.CharField(required=True, max_length=100)
    request_address = serializers.CharField(required=True)
    password = serializers.CharField(write_only=True, required=True, validators=[validate_strong_password])
    confirm_password = serializers.CharField(write_only=True, required=True)
    request_license_file = serializers.FileField(required=False, allow_null=True)
    request_id_file = serializers.FileField(required=False, allow_null=True)
    request_terms_accepted = serializers.BooleanField(required=False, default=True)

    def validate_request_jurisdiction(self, value):
        resolved = resolve_country_iso(value)
        if not resolved:
            raise serializers.ValidationError("Jurisdiction must be one of the 12 supported countries.")
        return value

    def validate_request_phone(self, value):
        jurisdiction = self.initial_data.get('request_jurisdiction') or 'SG'
        return validate_international_phone_number(value, default_region=jurisdiction, required=True)

    def validate(self, attrs):

        if attrs.get('password') != attrs.get('confirm_password'):
            raise serializers.ValidationError({"password": "Passwords do not match."})
        
        email = attrs.get('request_email', '').strip().lower()
        company_name = attrs.get('request_company_name', '').strip()
        license_number = attrs.get('request_registration_no', '').strip()

        if Login.objects.filter(login_email__iexact=email).exists():
            raise serializers.ValidationError({"request_email": "An account with this email address already exists."})
            
        if ShippingCompany.objects.filter(shipping_company_name__iexact=company_name).exists():
            raise serializers.ValidationError({"request_company_name": "A shipping company with this name already exists."})

        if ShippingCompany.objects.filter(shipping_company_license_number__iexact=license_number).exists():
            raise serializers.ValidationError({"request_registration_no": "A shipping company with this license/registration number already exists."})

        if RegistrationRequest.objects.filter(shipping_company_id__shipping_company_email__iexact=email, registration_request_status='PENDING').exists():
            raise serializers.ValidationError({"request_email": "A registration request for this email is already pending approval."})
            
        return attrs

    def create(self, validated_data):
        raw_password = validated_data.pop('password')
        validated_data.pop('confirm_password', None)
        
        company_name = validated_data.pop('request_company_name').strip()
        license_number = validated_data.pop('request_registration_no').strip()
        email = validated_data.pop('request_email').strip().lower()
        phone = validated_data.pop('request_phone').strip()
        address = validated_data.pop('request_address').strip()
        jurisdiction = validated_data.pop('request_jurisdiction').strip()
        applicant_name = validated_data.pop('request_applicant_name').strip()
        entity_type = validated_data.pop('request_entity_type', 'Shipping Company / Shipping Agent')
        license_file = validated_data.pop('request_license_file', None)
        id_file = validated_data.pop('request_id_file', None)
        terms_accepted = validated_data.pop('request_terms_accepted', True)

        with transaction.atomic():
            # 1. Store normalized company entity
            company = ShippingCompany.objects.create(
                shipping_company_name=company_name,
                shipping_company_license_number=license_number,
                shipping_company_email=email,
                shipping_company_phone=phone,
                shipping_company_address=address,
                shipping_company_jurisdiction=jurisdiction,
                shipping_company_status='PENDING'
            )

            # 2. Create Login authentication account
            login_obj = Login.objects.create(
                login_email=email,
                login_password=make_password(raw_password),
                login_role='shipping_company',
                login_status='PENDING',
                login_is_active=False
            )

            # 3. Create User profile record
            User.objects.create(
                login_id=login_obj,
                shipping_company_id=company,
                user_full_name=applicant_name,
                user_phone=phone,
                user_designation='Authorized Representative',
                user_status='PENDING'
            )

            # 4. Create Registration Request record
            request_obj = RegistrationRequest.objects.create(
                shipping_company_id=company,
                registration_request_entity_type=entity_type,
                registration_request_applicant_name=applicant_name,
                registration_request_license_file=license_file,
                registration_request_id_file=id_file,
                registration_request_terms_accepted=terms_accepted,
                registration_request_status='PENDING'
            )

        return request_obj


class RegistrationRequestDetailSerializer(serializers.ModelSerializer):
    shipping_company = ShippingCompanySerializer(source='shipping_company_id', read_only=True)
    reviewer_name = serializers.SerializerMethodField()

    class Meta:
        model = RegistrationRequest
        fields = [
            'registration_request_id',
            'shipping_company',
            'registration_request_entity_type',
            'registration_request_applicant_name',
            'registration_request_license_file',
            'registration_request_id_file',
            'registration_request_previous_license_file',
            'registration_request_previous_id_file',
            'registration_request_terms_accepted',
            'registration_request_status',
            'registration_request_action_required_docs',
            'registration_request_admin_remarks',
            'registration_request_rejection_reason',
            'registration_request_submitted_at',
            'registration_request_resubmitted_at',
            'registration_request_reviewed_at',
            'user_id',
            'reviewer_name'
        ]

    def get_reviewer_name(self, obj):
        if obj.user_id:
            return obj.user_id.user_full_name
        return None


class RegistrationResubmissionSerializer(serializers.Serializer):
    registration_request_id = serializers.IntegerField(required=True)
    request_license_file = serializers.FileField(required=False, allow_null=True)
    request_id_file = serializers.FileField(required=False, allow_null=True)
    business_license_file = serializers.FileField(required=False, allow_null=True)
    identity_proof_file = serializers.FileField(required=False, allow_null=True)
    applicant_notes = serializers.CharField(required=False, allow_blank=True, max_length=500)

    def validate(self, attrs):
        if 'business_license_file' in attrs and not attrs.get('request_license_file'):
            attrs['request_license_file'] = attrs.get('business_license_file')
        if 'identity_proof_file' in attrs and not attrs.get('request_id_file'):
            attrs['request_id_file'] = attrs.get('identity_proof_file')
        license_file = attrs.get('request_license_file')
        id_file = attrs.get('request_id_file')
        if not license_file and not id_file:
            raise serializers.ValidationError("At least one corrected document (Company Licence or Representative ID) must be provided for resubmission.")
        return attrs


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)

    def validate_email(self, value):
        return value.strip().lower()


class ResetPasswordSerializer(serializers.Serializer):
    token = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, write_only=True, validators=[validate_strong_password])
    confirm_password = serializers.CharField(required=True)

    def validate(self, attrs):
        if attrs.get('new_password') != attrs.get('confirm_password'):
            raise serializers.ValidationError({"confirm_password": "New password and confirmation password do not match."})
        return attrs


class CreateStaffSerializer(serializers.Serializer):
    user_full_name = serializers.CharField(required=True, max_length=150)
    user_email = serializers.EmailField(required=True)
    user_phone = serializers.CharField(required=False, allow_blank=True, default='')
    user_employee_id = serializers.CharField(required=False, allow_blank=True, max_length=50, default='')
    user_department = serializers.CharField(required=False, allow_blank=True, max_length=100)
    user_role = serializers.CharField(required=True, max_length=100)

    ALLOWED_STAFF_ROLES = {
        'PORT_OPERATIONS_OFFICER': 'port_operations_officer',
        'port_operations_officer': 'port_operations_officer',
        'CUSTOMS_OFFICER': 'customs_officer',
        'customs_officer': 'customs_officer',
        'TERMINAL_LOGISTICS_OPERATOR': 'terminal_logistics_operator',
        'terminal_logistics_operator': 'terminal_logistics_operator',
        'GATE_TRUCK_OPERATIONS_OFFICER': 'gate_truck_officer',
        'gate_truck_officer': 'gate_truck_officer',
        'GATE_OPERATIONS_OFFICER': 'gate_truck_officer',
        'gate_officer': 'gate_truck_officer',
    }

    ROLE_DEPARTMENT_MAP = {
        'port_operations_officer': 'Port Operations',
        'customs_officer': 'Customs',
        'terminal_logistics_operator': 'Terminal & Logistics',
        'gate_truck_officer': 'Gate Operations',
    }

    ROLE_DISPLAY_NAMES = {
        'port_operations_officer': 'Port Operations Officer',
        'customs_officer': 'Customs Officer',
        'terminal_logistics_operator': 'Terminal & Logistics Operator',
        'gate_truck_officer': 'Gate & Truck Operations Officer',
    }

    def validate_user_email(self, value):
        email = value.strip().lower()
        if Login.objects.filter(login_email__iexact=email).exists():
            raise serializers.ValidationError("An account with this email address already exists.")
        return email

    def validate_user_employee_id(self, value):
        return (value or '').strip()

    def validate_user_phone(self, value):
        if not value or not str(value).strip():
            return ""
        return validate_international_phone_number(value, default_region='IN', required=False)

    def validate_user_role(self, value):
        role_str = str(value).strip()
        if role_str.upper() == 'SHIPPING_COMPANY' or role_str.lower() == 'shipping_company':
            raise serializers.ValidationError("Shipping Company accounts cannot be created directly. They must use the public registration process.")
        
        normalized_role = self.ALLOWED_STAFF_ROLES.get(role_str) or self.ALLOWED_STAFF_ROLES.get(role_str.upper())
        if not normalized_role:
            raise serializers.ValidationError("Invalid staff role selected. Must be one of the four internal staff roles.")
        return normalized_role

    def validate(self, attrs):
        # Enforce automated role -> department mapping
        role = attrs.get('user_role')
        attrs['user_department'] = self.ROLE_DEPARTMENT_MAP.get(role, 'Port Operations')

        # Auto-generate unique Employee ID if not provided or if duplicate/conflicting
        emp_id = (attrs.get('user_employee_id') or '').strip()
        if not emp_id or User.objects.filter(user_employee_id__iexact=emp_id).exists():
            attrs['user_employee_id'] = generate_unique_employee_id(role)
        else:
            attrs['user_employee_id'] = emp_id

        return attrs

    def create(self, validated_data):
        email = validated_data.pop('user_email')
        role = validated_data.pop('user_role')
        full_name = validated_data.pop('user_full_name').strip()
        phone = validated_data.pop('user_phone', '').strip()
        department = validated_data.get('user_department') or self.ROLE_DEPARTMENT_MAP.get(role, 'Port Operations')
        employee_id = (validated_data.pop('user_employee_id', '') or '').strip() or generate_unique_employee_id(role)

        # 1. Cryptographically secure temporary password generation
        temp_password = generate_temporary_password(14)
        # 2. Re-validate against existing strong password rules
        validate_strong_password(temp_password)

        with transaction.atomic():
            # 3. Get or create normalized Department record
            dept_obj, _ = Department.objects.get_or_create(
                department_department_name=department
            )

            # 4. Get or create normalized Role record
            role_display = self.ROLE_DISPLAY_NAMES.get(role, role.replace('_', ' ').title())
            role_obj, _ = Role.objects.get_or_create(
                role_role_code=role,
                defaults={'role_role_name': role_display}
            )

            # 5. Create Login account with ACTIVE status and hashed initial password
            login_obj = Login.objects.create(
                login_email=email,
                login_password=make_password(temp_password),
                login_role=role,
                login_status='ACTIVE',
                login_is_active=True
            )

            # 6. Create User profile record with ACTIVE status, 3NF foreign keys, and user_must_change_password=True
            user_obj = User.objects.create(
                login_id=login_obj,
                department_id=dept_obj,
                role_id=role_obj,
                user_full_name=full_name,
                user_phone=phone,
                user_employee_id=employee_id,
                user_department=department,
                user_designation=role_display,
                user_status='ACTIVE',
                user_must_change_password=True
            )

        # In-memory only for view to dispatch email:
        user_obj._temp_password = temp_password
        return user_obj


class FirstLoginChangePasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(required=True, write_only=True, validators=[validate_strong_password])
    confirm_new_password = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        if attrs.get('new_password') != attrs.get('confirm_new_password'):
            raise serializers.ValidationError({"confirm_new_password": "New password and confirmation password do not match."})
        return attrs


class UserDetailSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source='login_id.login_email', read_only=True)
    role = serializers.CharField(source='login_id.login_role', read_only=True)

    class Meta:
        model = User
        fields = [
            'user_id',
            'user_full_name',
            'email',
            'user_phone',
            'user_employee_id',
            'user_department',
            'user_designation',
            'role',
            'user_status',
            'user_created_at',
            'user_updated_at'
        ]


class UpdateStaffUserSerializer(serializers.Serializer):
    user_full_name = serializers.CharField(required=False, max_length=150)
    user_phone = serializers.CharField(required=False, allow_blank=True, max_length=50)

    PROTECTED_FIELDS = [
        'employee_id', 'user_employee_id',
        'email', 'user_email', 'login_email',
        'role', 'user_role', 'login_role',
        'department', 'user_department',
        'password', 'login_password',
        'user_status', 'status', 'account_status', 'login_status', 'login_is_active',
        'permissions', 'is_staff', 'is_superuser'
    ]

    def validate_user_full_name(self, value):
        name_str = str(value).strip()
        if not name_str:
            raise serializers.ValidationError("Full Name cannot be empty.")
        return name_str

    def validate_user_phone(self, value):
        if not value or not str(value).strip():
            return ""
        return validate_international_phone_number(value, default_region='IN', required=False)


    def validate(self, attrs):
        initial_data = getattr(self, 'initial_data', {})
        attempted_protected = []
        for field in self.PROTECTED_FIELDS:
            if field in initial_data:
                val = initial_data[field]
                if self.instance:
                    curr_val = None
                    if field in ['employee_id', 'user_employee_id']:
                        curr_val = self.instance.user_employee_id
                    elif field in ['email', 'user_email', 'login_email']:
                        curr_val = self.instance.login_id.login_email if self.instance.login_id else None
                    elif field in ['role', 'user_role', 'login_role']:
                        curr_val = self.instance.login_id.login_role if self.instance.login_id else None
                    elif field in ['department', 'user_department']:
                        curr_val = self.instance.user_department
                    elif field in ['user_status', 'status', 'account_status', 'login_status']:
                        curr_val = self.instance.user_status
                    
                    if curr_val is None or str(val).strip().lower() != str(curr_val).strip().lower():
                        attempted_protected.append(field)
                else:
                    attempted_protected.append(field)

        if attempted_protected:
            raise serializers.ValidationError(
                f"Modification of protected field(s) ({', '.join(attempted_protected)}) is not allowed. Only Full Name and Phone Number can be edited."
            )

        if 'user_full_name' not in attrs and 'user_phone' not in attrs:
            raise serializers.ValidationError("At least one editable field (user_full_name or user_phone) must be provided.")

        return attrs

    def update(self, instance, validated_data):
        if 'user_full_name' in validated_data:
            instance.user_full_name = validated_data['user_full_name']
        if 'user_phone' in validated_data:
            instance.user_phone = validated_data['user_phone']
        
        instance.save()
        return instance



class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True, validators=[validate_strong_password])
    confirm_new_password = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        if attrs.get('new_password') != attrs.get('confirm_new_password'):
            raise serializers.ValidationError({"confirm_new_password": "New password and confirmation password do not match."})
        return attrs


class VesselSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source='vessel_shipping_company_id.shipping_company_name', read_only=True)
    company_email = serializers.EmailField(source='vessel_shipping_company_id.shipping_company_email', read_only=True)

    class Meta:
        model = Vessel
        fields = [
            'vessel_id',
            'vessel_shipping_company_id',
            'company_name',
            'company_email',
            'vessel_name',
            'vessel_imo_number',
            'vessel_type',
            'vessel_flag',
            'vessel_call_sign',
            'vessel_length',
            'vessel_draft',
            'vessel_capacity',
            'vessel_status',
            'vessel_created_at',
            'vessel_updated_at'
        ]


class VesselCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vessel
        fields = [
            'vessel_name',
            'vessel_imo_number',
            'vessel_type',
            'vessel_flag',
            'vessel_call_sign',
            'vessel_length',
            'vessel_draft',
            'vessel_capacity'
        ]

    def validate_vessel_imo_number(self, value):
        cleaned_imo = str(value).strip()
        if not cleaned_imo.isdigit() or len(cleaned_imo) != 7:
            raise serializers.ValidationError("IMO Number must be exactly 7 numeric digits (e.g. 9876543).")
        qs = Vessel.objects.filter(vessel_imo_number__iexact=cleaned_imo)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A vessel with this IMO number already exists.")
        return cleaned_imo

    def validate_vessel_name(self, value):
        cleaned = str(value or '').strip()
        if not cleaned:
            raise serializers.ValidationError("Vessel Name is required and cannot be empty.")
        return cleaned

    def validate_vessel_call_sign(self, value):
        if not value:
            return ""
        cleaned = str(value).strip().upper()
        if cleaned and not re.match(r'^[A-Za-z0-9\- ]+$', cleaned):
            raise serializers.ValidationError("Call Sign must contain only alphanumeric characters, spaces, or hyphens.")
        return cleaned

    def validate_vessel_length(self, value):
        if value is None or float(value) <= 0:
            raise serializers.ValidationError("Vessel length must be greater than 0.")
        return value

    def validate_vessel_draft(self, value):
        if value is None or float(value) <= 0:
            raise serializers.ValidationError("Vessel draft must be greater than 0.")
        return value

    def validate_vessel_capacity(self, value):
        if value is None or int(value) <= 0:
            raise serializers.ValidationError("Vessel capacity must be greater than 0.")
        return value


class VesselUpdateSerializer(serializers.ModelSerializer):
    vessel_name = serializers.CharField(required=True, max_length=200)
    vessel_type = serializers.CharField(required=True, max_length=50)
    vessel_flag = serializers.CharField(required=True, max_length=100)
    vessel_call_sign = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=50, default='')
    vessel_length = serializers.DecimalField(required=True, max_digits=8, decimal_places=2)
    vessel_draft = serializers.DecimalField(required=True, max_digits=6, decimal_places=2)
    vessel_capacity = serializers.IntegerField(required=True)

    PROTECTED_FIELDS = [
        'vessel_imo_number', 'imo_number', 'imo',
        'vessel_id', 'id',
        'vessel_shipping_company_id', 'shipping_company_id', 'shipping_company',
        'vessel_status', 'status',
        'vessel_created_at', 'created_at'
    ]

    class Meta:
        model = Vessel
        fields = [
            'vessel_name',
            'vessel_type',
            'vessel_flag',
            'vessel_call_sign',
            'vessel_length',
            'vessel_draft',
            'vessel_capacity'
        ]

    def validate_vessel_name(self, value):
        cleaned = str(value or '').strip()
        if not cleaned:
            raise serializers.ValidationError("Vessel Name is required and cannot be empty.")
        return cleaned

    def validate_vessel_type(self, value):
        cleaned = str(value or '').strip()
        if not cleaned:
            raise serializers.ValidationError("Vessel Type is required.")
        return cleaned

    def validate_vessel_flag(self, value):
        cleaned = str(value or '').strip()
        if not cleaned:
            raise serializers.ValidationError("Flag State is required.")
        return cleaned

    def validate_vessel_call_sign(self, value):
        if not value:
            return ""
        cleaned = str(value).strip().upper()
        if cleaned and not re.match(r'^[A-Za-z0-9\- ]+$', cleaned):
            raise serializers.ValidationError("Call Sign must contain only alphanumeric characters, spaces, or hyphens.")
        return cleaned

    def validate_vessel_length(self, value):
        try:
            val = float(value)
            if val <= 0:
                raise serializers.ValidationError("Length Overall must be greater than 0.")
        except (ValueError, TypeError):
            raise serializers.ValidationError("Length Overall must be a valid number.")
        return value

    def validate_vessel_draft(self, value):
        try:
            val = float(value)
            if val <= 0:
                raise serializers.ValidationError("Maximum Draft must be greater than 0.")
        except (ValueError, TypeError):
            raise serializers.ValidationError("Maximum Draft must be a valid number.")
        return value

    def validate_vessel_capacity(self, value):
        try:
            val = int(value)
            if val <= 0:
                raise serializers.ValidationError("Capacity (TEU) must be greater than 0.")
        except (ValueError, TypeError):
            raise serializers.ValidationError("Capacity (TEU) must be a valid integer.")
        return value

    def validate(self, attrs):
        initial_data = getattr(self, 'initial_data', {})
        for field in self.PROTECTED_FIELDS:
            if field in initial_data and self.instance:
                curr_val = getattr(self.instance, field, None)
                val = initial_data[field]
                if curr_val is not None and str(val).strip() != str(curr_val).strip():
                    raise serializers.ValidationError({
                        field: f"Modification of {field} is not permitted. This field is read-only."
                    })
        return attrs


class BerthSerializer(serializers.ModelSerializer):
    berth_type_display = serializers.CharField(source='get_berth_type_display', read_only=True)
    current_vessel = serializers.SerializerMethodField()
    current_schedule = serializers.SerializerMethodField()

    class Meta:
        model = Berth
        fields = [
            'berth_id',
            'berth_name',
            'berth_code',
            'berth_type',
            'berth_type_display',
            'berth_max_length',
            'berth_max_draft',
            'berth_status',
            'berth_is_active',
            'current_vessel',
            'current_schedule',
            'berth_created_at',
            'berth_updated_at'
        ]

    def get_current_schedule(self, obj):
        active_sch = obj.schedules.filter(vessel_schedule_status__in=['AT_BERTH', 'ARRIVED']).order_by('-vessel_schedule_created_at').first()
        if not active_sch:
            active_sch = obj.schedules.filter(vessel_schedule_status='SCHEDULED').order_by('vessel_schedule_scheduled_arrival_at').first()
        if active_sch:
            return {
                'vessel_schedule_id': active_sch.vessel_schedule_id,
                'vessel_schedule_status': active_sch.vessel_schedule_status,
                'scheduled_arrival_at': active_sch.vessel_schedule_scheduled_arrival_at,
                'scheduled_departure_at': active_sch.vessel_schedule_scheduled_departure_at,
                'actual_arrival_at': active_sch.vessel_schedule_actual_arrival_at,
                'actual_at_berth_at': active_sch.vessel_schedule_actual_at_berth_at,
                'actual_departure_at': active_sch.vessel_schedule_actual_departure_at,
                'operational_remarks': active_sch.vessel_schedule_operational_remarks,
            }
        return None

    def get_current_vessel(self, obj):
        active_sch = obj.schedules.filter(vessel_schedule_status__in=['AT_BERTH', 'ARRIVED']).order_by('-vessel_schedule_created_at').first()
        if not active_sch:
            active_sch = obj.schedules.filter(vessel_schedule_status='SCHEDULED').order_by('vessel_schedule_scheduled_arrival_at').first()
        if active_sch and active_sch.vessel_schedule_arrival_request_id:
            vessel = active_sch.vessel_schedule_arrival_request_id.vessel_arrival_request_vessel_id
            if vessel:
                return {
                    'vessel_id': vessel.vessel_id,
                    'vessel_name': vessel.vessel_name,
                    'vessel_imo_number': vessel.vessel_imo_number,
                    'vessel_type': vessel.vessel_type,
                    'vessel_length': str(vessel.vessel_length),
                    'vessel_draft': str(vessel.vessel_draft),
                    'company_name': vessel.vessel_shipping_company_id.shipping_company_name if vessel.vessel_shipping_company_id else '',
                    'cargo_type': active_sch.vessel_schedule_arrival_request_id.vessel_arrival_request_cargo_type,
                    'cargo_quantity': str(active_sch.vessel_schedule_arrival_request_id.vessel_arrival_request_cargo_quantity),
                }
        return None


class AdminBerthCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Berth
        fields = [
            'berth_name',
            'berth_code',
            'berth_type',
            'berth_max_length',
            'berth_max_draft',
            'berth_status',
            'berth_is_active'
        ]

    def validate_berth_name(self, value):
        cleaned = str(value).strip()
        if not cleaned:
            raise serializers.ValidationError("Berth name is required.")
        instance = getattr(self, 'instance', None)
        qs = Berth.objects.filter(berth_name__iexact=cleaned)
        if instance:
            qs = qs.exclude(pk=instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A berth with this name already exists.")
        return cleaned

    def validate_berth_code(self, value):
        cleaned = str(value).strip().upper() if value else ""
        if not cleaned:
            raise serializers.ValidationError("Berth code is required.")
        instance = getattr(self, 'instance', None)
        qs = Berth.objects.filter(berth_code__iexact=cleaned)
        if instance:
            qs = qs.exclude(pk=instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A berth with this code already exists.")
        return cleaned

    def validate_berth_max_length(self, value):
        if value <= 0:
            raise serializers.ValidationError("Maximum vessel length must be greater than 0.")
        return value

    def validate_berth_max_draft(self, value):
        if value <= 0:
            raise serializers.ValidationError("Maximum draft must be greater than 0.")
        return value


class VesselScheduleSerializer(serializers.ModelSerializer):
    berth_name = serializers.CharField(source='vessel_schedule_berth_id.berth_name', read_only=True)
    berth = BerthSerializer(source='vessel_schedule_berth_id', read_only=True)
    created_by_name = serializers.CharField(source='vessel_schedule_created_by.user_full_name', read_only=True, default=None)
    vessel_name = serializers.SerializerMethodField()
    vessel_imo_number = serializers.SerializerMethodField()
    company_name = serializers.SerializerMethodField()

    class Meta:
        model = VesselSchedule
        fields = [
            'vessel_schedule_id',
            'vessel_schedule_arrival_request_id',
            'vessel_schedule_berth_id',
            'berth_name',
            'berth',
            'vessel_name',
            'vessel_imo_number',
            'company_name',
            'vessel_schedule_scheduled_arrival_at',
            'vessel_schedule_scheduled_departure_at',
            'vessel_schedule_actual_arrival_at',
            'vessel_schedule_actual_at_berth_at',
            'vessel_schedule_actual_departure_at',
            'vessel_schedule_status',
            'vessel_schedule_operational_remarks',
            'vessel_schedule_created_by',
            'created_by_name',
            'vessel_schedule_created_at',
            'vessel_schedule_updated_at'
        ]

    def get_vessel_name(self, obj):
        if obj.vessel_schedule_arrival_request_id and obj.vessel_schedule_arrival_request_id.vessel_arrival_request_vessel_id:
            return obj.vessel_schedule_arrival_request_id.vessel_arrival_request_vessel_id.vessel_name
        return None

    def get_vessel_imo_number(self, obj):
        if obj.vessel_schedule_arrival_request_id and obj.vessel_schedule_arrival_request_id.vessel_arrival_request_vessel_id:
            return obj.vessel_schedule_arrival_request_id.vessel_arrival_request_vessel_id.vessel_imo_number
        return None

    def get_company_name(self, obj):
        if (obj.vessel_schedule_arrival_request_id and 
            obj.vessel_schedule_arrival_request_id.vessel_arrival_request_vessel_id and
            obj.vessel_schedule_arrival_request_id.vessel_arrival_request_vessel_id.vessel_shipping_company_id):
            return obj.vessel_schedule_arrival_request_id.vessel_arrival_request_vessel_id.vessel_shipping_company_id.shipping_company_name
        return None


class VesselArrivalRequestSerializer(serializers.ModelSerializer):
    vessel = VesselSerializer(source='vessel_arrival_request_vessel_id', read_only=True)
    preferred_berth = BerthSerializer(source='vessel_arrival_request_preferred_berth_id', read_only=True)
    reviewed_by_name = serializers.CharField(source='vessel_arrival_request_reviewed_by.user_full_name', read_only=True, default=None)
    schedule = VesselScheduleSerializer(read_only=True)
    scheduling_status = serializers.SerializerMethodField()
    duration_hours = serializers.SerializerMethodField()
    is_cargo_eligible = serializers.SerializerMethodField()
    is_expired = serializers.SerializerMethodField()

    class Meta:
        model = VesselArrivalRequest
        fields = [
            'vessel_arrival_request_id',
            'vessel_arrival_request_vessel_id',
            'vessel',
            'vessel_arrival_request_preferred_berth_id',
            'preferred_berth',
            'vessel_arrival_request_requested_arrival_at',
            'vessel_arrival_request_requested_departure_at',
            'duration_hours',
            'vessel_arrival_request_cargo_type',
            'vessel_arrival_request_cargo_quantity',
            'vessel_arrival_request_status',
            'vessel_arrival_request_submitted_at',
            'vessel_arrival_request_reviewed_at',
            'vessel_arrival_request_reviewed_by',
            'reviewed_by_name',
            'vessel_arrival_request_remarks',
            'schedule',
            'scheduling_status',
            'is_cargo_eligible',
            'is_expired'
        ]

    def get_is_expired(self, obj):
        if obj.vessel_arrival_request_requested_departure_at:
            return timezone.now() >= obj.vessel_arrival_request_requested_departure_at
        return False

    def get_is_cargo_eligible(self, obj):
        if obj.vessel_arrival_request_status != 'APPROVED':
            return False
        if obj.vessel_arrival_request_requested_departure_at:
            return timezone.now() < obj.vessel_arrival_request_requested_departure_at
        return True

    def get_duration_hours(self, obj):
        if obj.vessel_arrival_request_requested_arrival_at and obj.vessel_arrival_request_requested_departure_at:
            diff = obj.vessel_arrival_request_requested_departure_at - obj.vessel_arrival_request_requested_arrival_at
            return round(diff.total_seconds() / 3600.0, 2)
        return None

    def get_scheduling_status(self, obj):
        if hasattr(obj, 'schedule') and obj.schedule:
            return obj.schedule.vessel_schedule_status
        if obj.vessel_arrival_request_status == 'APPROVED':
            return 'Awaiting Scheduling'
        return 'N/A'



class VesselArrivalRequestCreateSerializer(serializers.ModelSerializer):
    vessel_arrival_request_preferred_berth_id = serializers.PrimaryKeyRelatedField(
        queryset=Berth.objects.all(),
        required=False,
        allow_null=True
    )

    class Meta:
        model = VesselArrivalRequest
        fields = [
            'vessel_arrival_request_vessel_id',
            'vessel_arrival_request_preferred_berth_id',
            'vessel_arrival_request_requested_arrival_at',
            'vessel_arrival_request_requested_departure_at',
            'vessel_arrival_request_cargo_type',
            'vessel_arrival_request_cargo_quantity'
        ]

    def validate(self, attrs):
        vessel_obj = attrs.get('vessel_arrival_request_vessel_id')
        arrival = attrs.get('vessel_arrival_request_requested_arrival_at')
        departure = attrs.get('vessel_arrival_request_requested_departure_at')
        quantity = attrs.get('vessel_arrival_request_cargo_quantity')
        preferred_berth = attrs.get('vessel_arrival_request_preferred_berth_id')

        if not vessel_obj:
            raise serializers.ValidationError({"vessel_arrival_request_vessel_id": "Please select a vessel."})

        # Prevent past arrival dates
        now = timezone.now()
        if arrival and arrival < now - datetime.timedelta(minutes=5):
            raise serializers.ValidationError({
                "vessel_arrival_request_requested_arrival_at": "Requested arrival time cannot be in the past."
            })

        # Configurable advance booking rule (applied if administrator configured advance days > 0)
        min_advance_days = get_min_arrival_advance_days()
        if min_advance_days > 0 and arrival:
            now_local = timezone.localtime(now)
            today_date = now_local.date()
            min_allowed_date = today_date + datetime.timedelta(days=min_advance_days)
            arrival_local = timezone.localtime(arrival)
            if arrival_local.date() < min_allowed_date:
                advance_msg = (
                    f"Arrival requests must be submitted at least {min_advance_days} days in advance."
                    if min_advance_days != 1
                    else "Arrival requests must be submitted at least 1 day in advance."
                )
                raise serializers.ValidationError({
                    "vessel_arrival_request_requested_arrival_at": advance_msg
                })

        if arrival and departure:
            if departure <= arrival:
                raise serializers.ValidationError({
                    "vessel_arrival_request_requested_departure_at": "Requested departure time must be later than requested arrival time."
                })
            duration_seconds = (departure - arrival).total_seconds()
            if duration_seconds < 3600:
                raise serializers.ValidationError({
                    "vessel_arrival_request_requested_departure_at": "Departure must be at least 1 hour after arrival."
                })

        if quantity is not None and quantity <= 0:
            raise serializers.ValidationError({"vessel_arrival_request_cargo_quantity": "Cargo quantity must be greater than zero."})

        # Overlapping active arrival requests check for the same vessel
        if vessel_obj and arrival and departure:
            overlapping_exists = VesselArrivalRequest.objects.filter(
                vessel_arrival_request_vessel_id=vessel_obj,
                vessel_arrival_request_status__in=['PENDING', 'APPROVED'],
                vessel_arrival_request_requested_arrival_at__lt=departure,
                vessel_arrival_request_requested_departure_at__gt=arrival
            ).exists()

            if overlapping_exists:
                raise serializers.ValidationError({"vessel_arrival_request_vessel_id": "This vessel already has an active arrival request during the selected period."})

        # Preferred Berth Suitability & Conflict Validations
        if preferred_berth:
            if not preferred_berth.berth_is_active or preferred_berth.berth_status == 'INACTIVE':
                raise serializers.ValidationError({
                    "vessel_arrival_request_preferred_berth_id": f"Selected berth '{preferred_berth.berth_name}' is currently inactive and cannot be selected."
                })
            if preferred_berth.berth_status == 'MAINTENANCE':
                raise serializers.ValidationError({
                    "vessel_arrival_request_preferred_berth_id": f"Selected berth '{preferred_berth.berth_name}' is currently under maintenance."
                })
            if vessel_obj:
                if vessel_obj.vessel_length > preferred_berth.berth_max_length:
                    raise serializers.ValidationError({
                        "vessel_arrival_request_preferred_berth_id": f"Vessel length ({vessel_obj.vessel_length}m) exceeds {preferred_berth.berth_name} maximum length limit ({preferred_berth.berth_max_length}m)."
                    })
                if vessel_obj.vessel_draft > preferred_berth.berth_max_draft:
                    raise serializers.ValidationError({
                        "vessel_arrival_request_preferred_berth_id": f"Vessel draft ({vessel_obj.vessel_draft}m) exceeds {preferred_berth.berth_name} maximum draft limit ({preferred_berth.berth_max_draft}m)."
                    })
            if arrival and departure:
                conflicting_schedule = VesselSchedule.objects.filter(
                    vessel_schedule_berth_id=preferred_berth,
                    vessel_schedule_status__in=['SCHEDULED', 'ARRIVED', 'AT_BERTH'],
                    vessel_schedule_scheduled_arrival_at__lt=departure,
                    vessel_schedule_scheduled_departure_at__gt=arrival
                ).exists()
                if conflicting_schedule:
                    raise serializers.ValidationError({
                        "vessel_arrival_request_preferred_berth_id": f"Selected berth '{preferred_berth.berth_name}' is already allocated for an approved schedule during this timeframe."
                    })

        return attrs


class SystemSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSetting
        fields = [
            'system_setting_id',
            'system_setting_key',
            'system_setting_value',
            'system_setting_description',
            'system_setting_updated_at'
        ]


class AuditLogSerializer(serializers.ModelSerializer):
    actor = serializers.SerializerMethodField()
    role = serializers.CharField(source='audit_log_role')
    action = serializers.CharField(source='audit_log_action')
    category = serializers.CharField(source='audit_log_category')
    target_type = serializers.CharField(source='audit_log_target_type')
    target_id = serializers.CharField(source='audit_log_target_id', allow_null=True)
    target_resource = serializers.SerializerMethodField()
    description = serializers.CharField(source='audit_log_description')
    status = serializers.CharField(source='audit_log_status')
    timestamp = serializers.SerializerMethodField()
    iso_timestamp = serializers.SerializerMethodField()
    ip_address = serializers.CharField(source='audit_log_ip_address', allow_null=True)

    class Meta:
        model = AuditLog
        fields = [
            'audit_log_id',
            'timestamp',
            'iso_timestamp',
            'actor',
            'role',
            'action',
            'category',
            'target_type',
            'target_id',
            'target_resource',
            'description',
            'status',
            'ip_address',
        ]

    def get_actor(self, obj):
        if obj.audit_log_actor_name:
            return obj.audit_log_actor_name
        if obj.audit_log_user_id:
            return obj.audit_log_user_id.user_full_name or (obj.audit_log_user_id.login_id.login_email if obj.audit_log_user_id.login_id else "System")
        return "System"

    def get_target_resource(self, obj):
        if obj.audit_log_target_type and obj.audit_log_target_id:
            # Human readable target formatting
            type_label = obj.audit_log_target_type
            if type_label == 'ArrivalRequest' or type_label == 'VesselArrivalRequest':
                type_label = 'Arrival Request'
            elif type_label == 'ShippingCompany':
                type_label = 'Shipping Company'
            elif type_label == 'VesselSchedule':
                type_label = 'Vessel Schedule'
            return f"{type_label} #{obj.audit_log_target_id}"
        return obj.audit_log_target_type or "System"

    def get_timestamp(self, obj):
        if obj.audit_log_timestamp:
            return obj.audit_log_timestamp.strftime('%d-%m-%Y %H:%M')
        return ""

    def get_iso_timestamp(self, obj):
        if obj.audit_log_timestamp:
            return obj.audit_log_timestamp.isoformat()
        return None


class PortSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = Port
        fields = [
            'port_id',
            'port_code',
            'port_name',
            'port_country',
            'port_country_code',
            'port_is_active',
            'display_name',
        ]

    def get_display_name(self, obj):
        return f"{obj.port_name} ({obj.port_code})"


class CargoSerializer(serializers.ModelSerializer):
    arrival_request_summary = serializers.SerializerMethodField()
    cargo_type_display = serializers.CharField(source='get_cargo_type_display', read_only=True)
    cargo_unit_display = serializers.CharField(source='get_cargo_unit_display', read_only=True)
    cargo_status_display = serializers.CharField(source='get_cargo_status_display', read_only=True)
    origin_port = PortSerializer(source='cargo_origin_port_id', read_only=True)
    destination_port = PortSerializer(source='cargo_destination_port_id', read_only=True)
    cargo_origin = serializers.CharField(read_only=True)
    cargo_destination = serializers.CharField(read_only=True)

    class Meta:
        model = Cargo
        fields = [
            'cargo_id',
            'cargo_arrival_request_id',
            'cargo_description',
            'cargo_type',
            'cargo_type_display',
            'cargo_quantity',
            'cargo_unit',
            'cargo_unit_display',
            'cargo_weight',
            'cargo_origin_port_id',
            'cargo_destination_port_id',
            'origin_port',
            'destination_port',
            'cargo_origin',
            'cargo_destination',
            'cargo_status',
            'cargo_status_display',
            'cargo_created_at',
            'cargo_updated_at',
            'arrival_request_summary'
        ]

    def get_arrival_request_summary(self, obj):
        req = obj.cargo_arrival_request_id
        if not req:
            return None
        vessel = req.vessel_arrival_request_vessel_id
        shipping_company = vessel.vessel_shipping_company_id if vessel else None
        return {
            'arrival_request_id': req.vessel_arrival_request_id,
            'vessel_id': vessel.vessel_id if vessel else None,
            'vessel_name': vessel.vessel_name if vessel else 'Unknown Vessel',
            'vessel_imo_number': vessel.vessel_imo_number if vessel else '',
            'vessel_type': vessel.vessel_type if vessel else '',
            'company_name': shipping_company.shipping_company_name if shipping_company else '',
            'company_id': shipping_company.shipping_company_id if shipping_company else None,
            'requested_arrival_at': req.vessel_arrival_request_requested_arrival_at.isoformat() if req.vessel_arrival_request_requested_arrival_at else None,
            'requested_departure_at': req.vessel_arrival_request_requested_departure_at.isoformat() if req.vessel_arrival_request_requested_departure_at else None,
            'status': req.vessel_arrival_request_status,
        }


class CargoCreateUpdateSerializer(serializers.ModelSerializer):
    cargo_arrival_request_id = serializers.PrimaryKeyRelatedField(
        queryset=VesselArrivalRequest.objects.all(),
        required=True
    )
    cargo_origin_port_id = serializers.PrimaryKeyRelatedField(
        queryset=Port.objects.filter(port_is_active=True),
        required=True
    )
    cargo_destination_port_id = serializers.PrimaryKeyRelatedField(
        queryset=Port.objects.filter(port_is_active=True),
        required=True
    )

    class Meta:
        model = Cargo
        fields = [
            'cargo_arrival_request_id',
            'cargo_description',
            'cargo_type',
            'cargo_quantity',
            'cargo_unit',
            'cargo_weight',
            'cargo_origin_port_id',
            'cargo_destination_port_id',
            'cargo_status'
        ]

    def validate_cargo_description(self, value):
        if not value or not str(value).strip():
            raise serializers.ValidationError("Cargo description is required and cannot be empty.")
        return str(value).strip()

    def validate_cargo_type(self, value):
        val = str(value).strip().upper().replace(' ', '_')
        valid_types = [c[0] for c in Cargo.CARGO_TYPE_CHOICES]
        if val not in valid_types:
            mapping = {
                'CONTAINERIZED': 'CONTAINERIZED',
                'CONTAINER': 'CONTAINERIZED',
                'CONTAINER_CARGO': 'CONTAINERIZED',
                'GENERAL_CARGO': 'GENERAL_CARGO',
                'GENERAL': 'GENERAL_CARGO',
                'BULK_CARGO': 'BULK_CARGO',
                'BULK': 'BULK_CARGO'
            }
            if val in mapping:
                val = mapping[val]
            else:
                raise serializers.ValidationError(
                    f"Invalid cargo type '{value}'. Allowed types: Containerized, General Cargo, Bulk Cargo."
                )
        return val

    def validate_cargo_unit(self, value):
        val = str(value).strip().upper()
        valid_units = [c[0] for c in Cargo.CARGO_UNIT_CHOICES]
        if val not in valid_units:
            unit_map = {
                'TEU': 'TEU',
                'FEU': 'FEU',
                'TONNES': 'TONNES',
                'TON': 'TONNES',
                'MT': 'TONNES',
                'METRIC TONNES': 'TONNES',
                'KG': 'KG',
                'KGS': 'KG',
                'KILOGRAM': 'KG',
                'KILOGRAMS': 'KG',
                'UNITS': 'UNITS',
                'UNIT': 'UNITS',
                'PIECES': 'UNITS',
                'PACKAGES': 'PACKAGES',
                'PACKAGE': 'PACKAGES',
                'CARTONS': 'PACKAGES',
            }
            if val in unit_map:
                val = unit_map[val]
            else:
                raise serializers.ValidationError(
                    f"Invalid cargo unit '{value}'. Allowed units: TEU, FEU, TONNES, KG, UNITS, PACKAGES."
                )
        return val

    def validate_cargo_quantity(self, value):
        if value is None or value <= 0:
            raise serializers.ValidationError("Cargo quantity must be a positive number greater than 0.")
        return value

    def validate_cargo_weight(self, value):
        if value is None or value <= 0:
            raise serializers.ValidationError("Cargo gross weight must be a positive number greater than 0.")
        return value

    def validate(self, data):
        # 1. Validate that origin and destination ports are not identical
        origin_port = data.get('cargo_origin_port_id')
        dest_port = data.get('cargo_destination_port_id')

        if not origin_port and self.instance:
            origin_port = self.instance.cargo_origin_port_id
        if not dest_port and self.instance:
            dest_port = self.instance.cargo_destination_port_id

        if origin_port and dest_port and origin_port.port_id == dest_port.port_id:
            raise serializers.ValidationError({
                "cargo_destination_port_id": "Port of destination cannot be the same as port of origin."
            })

        # 2. Validate cargo unit is valid for cargo type
        cargo_type = data.get('cargo_type')
        if not cargo_type and self.instance:
            cargo_type = self.instance.cargo_type

        cargo_unit = data.get('cargo_unit')
        if not cargo_unit and self.instance:
            cargo_unit = self.instance.cargo_unit

        TYPE_UNIT_MAP = {
            'CONTAINERIZED': ['TEU', 'FEU'],
            'BULK_CARGO': ['TONNES', 'KG'],
            'GENERAL_CARGO': ['UNITS', 'PACKAGES', 'TONNES']
        }

        if cargo_type and cargo_unit:
            allowed_units = TYPE_UNIT_MAP.get(cargo_type, [])
            if allowed_units and cargo_unit not in allowed_units:
                allowed_str = ", ".join(allowed_units)
                raise serializers.ValidationError({
                    "cargo_unit": f"Unit '{cargo_unit}' is not allowed for cargo type '{cargo_type}'. Allowed units: {allowed_str}."
                })

        return data


class CustomsDocumentSerializer(serializers.ModelSerializer):
    """
    Serializer for Customs Supporting Documents (Bill of Lading, Commercial Invoice, etc.)
    used in both Normal Post-Arrival Customs procedures and Pre-Arrival Filing.
    """
    document_type_display = serializers.CharField(source='get_document_type_display', read_only=True)
    workflow_type_display = serializers.CharField(source='get_workflow_type_display', read_only=True)
    review_status = serializers.CharField(source='document_review_status', read_only=True)
    review_status_display = serializers.CharField(source='get_document_review_status_display', read_only=True)
    review_remarks = serializers.CharField(source='document_review_remarks', read_only=True)
    container_number = serializers.CharField(source='document_container_id.container_number', read_only=True)
    uploaded_by_name = serializers.CharField(source='document_uploaded_by.user_full_name', read_only=True)
    reviewed_by_name = serializers.CharField(source='document_reviewed_by.user_full_name', read_only=True)
    formatted_file_size = serializers.CharField(read_only=True)
    original_filename = serializers.CharField(source='document_name', read_only=True)
    file_size_formatted = serializers.CharField(source='formatted_file_size', read_only=True)
    version = serializers.IntegerField(source='document_version', read_only=True)
    is_active = serializers.BooleanField(source='document_is_active', read_only=True)
    amendment_reason = serializers.CharField(source='document_amendment_reason', read_only=True)
    replaced_by_id = serializers.IntegerField(source='document_replaced_by_id', read_only=True, allow_null=True)
    file_url = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()
    can_replace = serializers.SerializerMethodField()
    is_editable = serializers.SerializerMethodField()

    class Meta:
        model = CustomsDocument
        fields = [
            'document_id',
            'document_container_id',
            'container_number',
            'document_inspection_id',
            'document_declaration_id',
            'document_type',
            'document_type_display',
            'workflow_type',
            'workflow_type_display',
            'document_name',
            'original_filename',
            'file_size',
            'formatted_file_size',
            'file_size_formatted',
            'file_type',
            'document_notes',
            'document_version',
            'version',
            'document_is_active',
            'is_active',
            'document_replaced_by',
            'replaced_by_id',
            'document_amendment_reason',
            'amendment_reason',
            'document_uploaded_at',
            'document_uploaded_by',
            'uploaded_by_name',
            'document_review_status',
            'review_status',
            'review_status_display',
            'document_review_remarks',
            'review_remarks',
            'document_reviewed_by',
            'reviewed_by_name',
            'document_reviewed_at',
            'file_url',
            'download_url',
            'can_delete',
            'can_replace',
            'is_editable',
            'document_created_at',
            'document_updated_at',
        ]

    def get_file_url(self, obj):
        return f"/api/customs/documents/{obj.document_id}/download/"

    def get_download_url(self, obj):
        return f"/api/customs/documents/{obj.document_id}/download/"

    def get_can_delete(self, obj):
        return obj.document_review_status == 'PENDING' and obj.document_is_active

    def get_can_replace(self, obj):
        return obj.document_is_active

    def get_is_editable(self, obj):
        return obj.document_review_status in ['PENDING', 'REJECTED'] and obj.document_is_active


class ContainerSerializer(serializers.ModelSerializer):
    container_type_display = serializers.CharField(source='get_container_type_display', read_only=True)
    container_status_display = serializers.CharField(source='get_container_status_display', read_only=True)
    teu_equivalent = serializers.FloatField(read_only=True)
    cargo_context = serializers.SerializerMethodField()
    customs_inspection = serializers.SerializerMethodField()
    customs_documents = serializers.SerializerMethodField()
    gate_release = serializers.SerializerMethodField()
    gate_pass = serializers.SerializerMethodField()
    yard_location = serializers.SerializerMethodField()
    container_customs_status_display = serializers.CharField(source='get_container_customs_status_display', read_only=True)
    is_customs_cleared = serializers.BooleanField(read_only=True)
    customs_declaration = serializers.SerializerMethodField()
    direct_transfer = serializers.SerializerMethodField()

    class Meta:
        model = Container
        fields = [
            'container_id',
            'container_cargo_id',
            'container_number',
            'container_type',
            'container_type_display',
            'container_gross_weight',
            'container_status',
            'container_status_display',
            'container_customs_status',
            'container_customs_status_display',
            'is_customs_cleared',
            'container_created_at',
            'container_updated_at',
            'teu_equivalent',
            'cargo_context',
            'customs_inspection',
            'customs_declaration',
            'customs_documents',
            'direct_transfer',
            'gate_release',
            'gate_pass',
            'yard_location'
        ]

    def get_cargo_context(self, obj):
        cargo = obj.container_cargo_id
        if not cargo:
            return None
        arrival_req = cargo.cargo_arrival_request_id
        vessel = arrival_req.vessel_arrival_request_vessel_id if arrival_req else None
        shipping_company = vessel.vessel_shipping_company_id if vessel else None
        schedule = getattr(arrival_req, 'schedule', None) if arrival_req else None

        return {
            'cargo_id': cargo.cargo_id,
            'cargo_description': cargo.cargo_description,
            'cargo_type': cargo.cargo_type,
            'cargo_type_display': cargo.get_cargo_type_display(),
            'cargo_quantity': str(cargo.cargo_quantity),
            'cargo_unit': cargo.cargo_unit,
            'cargo_weight': str(cargo.cargo_weight),
            'cargo_origin': cargo.cargo_origin,
            'cargo_destination': cargo.cargo_destination,
            'arrival_request_id': arrival_req.vessel_arrival_request_id if arrival_req else None,
            'vessel_id': vessel.vessel_id if vessel else None,
            'vessel_name': vessel.vessel_name if vessel else 'Unknown Vessel',
            'vessel_imo_number': vessel.vessel_imo_number if vessel else '',
            'vessel_type': vessel.vessel_type if vessel else '',
            'company_id': shipping_company.shipping_company_id if shipping_company else None,
            'company_name': shipping_company.shipping_company_name if shipping_company else '',
            'requested_arrival_at': arrival_req.vessel_arrival_request_requested_arrival_at.isoformat() if arrival_req and arrival_req.vessel_arrival_request_requested_arrival_at else None,
            'requested_departure_at': arrival_req.vessel_arrival_request_requested_departure_at.isoformat() if arrival_req and arrival_req.vessel_arrival_request_requested_departure_at else None,
            'scheduled_arrival_at': schedule.vessel_schedule_scheduled_arrival_at.isoformat() if schedule and schedule.vessel_schedule_scheduled_arrival_at else None,
            'actual_arrival_at': schedule.vessel_schedule_actual_arrival_at.isoformat() if schedule and schedule.vessel_schedule_actual_arrival_at else None,
            'vessel_schedule_status': schedule.vessel_schedule_status if schedule else None
        }

    def get_customs_inspection(self, obj):
        inspection = obj.latest_customs_inspection
        if not inspection:
            return None
        officer = inspection.customs_inspection_officer_id
        return {
            'inspection_id': inspection.customs_inspection_id,
            'inspection_status': inspection.customs_inspection_status,
            'inspection_status_display': inspection.get_customs_inspection_status_display(),
            'inspection_result': inspection.customs_inspection_result,
            'inspection_result_display': inspection.get_customs_inspection_result_display() if inspection.customs_inspection_result else None,
            'document_verification_status': inspection.customs_inspection_document_status,
            'document_verification_status_display': inspection.get_customs_inspection_document_status_display(),
            'inspection_remarks': inspection.customs_inspection_remarks or '',
            'hold_reason': inspection.customs_inspection_hold_reason,
            'hold_reason_display': inspection.get_customs_inspection_hold_reason_display() if inspection.customs_inspection_hold_reason else None,
            'officer_id': officer.user_id if officer else None,
            'officer_name': officer.user_full_name if officer else None,
            'officer_email': officer.login_id.login_email if officer and officer.login_id else None,
            'inspection_date': inspection.customs_inspection_started_at.isoformat() if inspection.customs_inspection_started_at else None,
            'clearance_date': inspection.customs_inspection_clearance_date.isoformat() if inspection.customs_inspection_clearance_date else None,
            'completed_at': inspection.customs_inspection_completed_at.isoformat() if inspection.customs_inspection_completed_at else None
        }

    def get_gate_release(self, obj):
        release = obj.latest_gate_release
        if not release:
            return None
        officer = release.gate_release_officer_id
        return {
            'release_id': release.gate_release_id,
            'previous_status': release.gate_release_previous_status,
            'new_status': release.gate_release_new_status,
            'truck_number': release.gate_release_truck_number,
            'driver_name': release.gate_release_driver_name,
            'driver_license': release.gate_release_driver_license,
            'exit_point': release.gate_release_exit_point,
            'remarks': release.gate_release_remarks or '',
            'officer_id': officer.user_id if officer else None,
            'officer_name': officer.user_full_name if officer else None,
            'officer_email': officer.login_id.login_email if officer and officer.login_id else None,
            'release_time': release.gate_release_time.isoformat() if release.gate_release_time else None
        }

    def get_gate_pass(self, obj):
        assoc = obj.gate_pass_associations.select_related(
            'gate_pass_container_gate_pass_id__gate_pass_truck_id',
            'gate_pass_container_gate_pass_id__gate_pass_driver_id',
            'gate_pass_container_gate_pass_id__gate_pass_gate_id'
        ).order_by('-gate_pass_container_created_at', '-gate_pass_container_id').first()
        if assoc and assoc.gate_pass_container_gate_pass_id:
            gp = assoc.gate_pass_container_gate_pass_id
            return {
                'gate_pass_id': gp.gate_pass_id,
                'pass_number': gp.gate_pass_pass_number,
                'movement_number': gp.gate_pass_movement_number,
                'status': gp.gate_pass_status,
                'status_display': gp.get_gate_pass_status_display(),
                'truck_number': gp.gate_pass_truck_id.truck_number if gp.gate_pass_truck_id else None,
                'driver_name': gp.gate_pass_driver_id.driver_name if gp.gate_pass_driver_id else None,
                'driver_phone': gp.gate_pass_driver_id.driver_phone if gp.gate_pass_driver_id else None,
                'driver_email': gp.gate_pass_driver_id.driver_email if gp.gate_pass_driver_id else None,
                'gate_name': gp.gate_pass_gate_id.gate_name if gp.gate_pass_gate_id else None,
                'issued_at': gp.gate_pass_issued_at.isoformat() if gp.gate_pass_issued_at else None,
                'valid_until': gp.gate_pass_valid_until.isoformat() if gp.gate_pass_valid_until else None,
                'is_valid': gp.is_valid,
            }
        return None

    def get_yard_location(self, obj):
        return obj.current_yard_location

    def get_customs_declaration(self, obj):
        decl = obj.latest_customs_declaration
        if not decl:
            return None
        doc_url = None
        if decl.declaration_document:
            try:
                doc_url = decl.declaration_document.url
            except Exception:
                doc_url = str(decl.declaration_document)
        return {
            'declaration_id': decl.declaration_id,
            'declaration_reference': decl.declaration_reference,
            'declaration_status': decl.declaration_status,
            'declaration_status_display': decl.get_declaration_status_display(),
            'document_url': doc_url,
            'document_name': decl.declaration_document_name,
            'submitted_at': decl.declaration_submitted_at.isoformat() if decl.declaration_submitted_at else None,
            'reviewed_at': decl.declaration_reviewed_at.isoformat() if decl.declaration_reviewed_at else None,
            'review_remarks': decl.declaration_review_remarks,
            'hold_reason': decl.declaration_hold_reason,
            'submitted_by_name': decl.declaration_submitted_by.user_full_name if decl.declaration_submitted_by else None,
            'reviewed_by_name': decl.declaration_reviewed_by.user_full_name if decl.declaration_reviewed_by else None,
        }

    def get_direct_transfer(self, obj):
        transfer = obj.active_direct_transfer or obj.direct_transfers.order_by('-transfer_created_at').first()
        if not transfer:
            return None
        return {
            'transfer_id': transfer.transfer_id,
            'transfer_reference': transfer.transfer_reference,
            'transfer_status': transfer.transfer_status,
            'transfer_status_display': transfer.get_transfer_status_display(),
            'truck_number': transfer.transfer_truck_id.truck_number if transfer.transfer_truck_id else None,
            'driver_name': transfer.transfer_driver_id.driver_name if transfer.transfer_driver_id else None,
            'crane_code': transfer.transfer_crane_id.crane_code if transfer.transfer_crane_id else None,
            'gate_pass_number': transfer.transfer_gate_pass_id.gate_pass_pass_number if transfer.transfer_gate_pass_id else None,
            'initiated_at': transfer.transfer_initiated_at.isoformat() if transfer.transfer_initiated_at else None,
            'transferred_at': transfer.transfer_transferred_at.isoformat() if transfer.transfer_transferred_at else None,
            'completed_at': transfer.transfer_completed_at.isoformat() if transfer.transfer_completed_at else None,
        }

    def get_customs_documents(self, obj):
        docs = list(obj.customs_documents.select_related('document_uploaded_by', 'document_reviewed_by').all())
        data = CustomsDocumentSerializer(docs, many=True).data

        # Also synthesize pre-arrival document if present and not yet in CustomsDocument table
        if hasattr(obj, 'customs_declarations'):
            for decl in obj.customs_declarations.all():
                if decl.declaration_document and not any(d.get('document_declaration_id') == decl.declaration_id for d in data):
                    data.append({
                        'document_id': -decl.declaration_id,
                        'document_container_id': obj.container_id,
                        'container_number': obj.container_number,
                        'document_inspection_id': None,
                        'document_declaration_id': decl.declaration_id,
                        'document_type': decl.declaration_type or 'IMPORT_DECLARATION',
                        'document_type_display': 'Customs Import Declaration' if decl.declaration_type == 'IMPORT_DECLARATION' else (decl.declaration_type or 'Pre-Arrival Declaration'),
                        'workflow_type': 'PRE_ARRIVAL',
                        'workflow_type_display': 'Pre-Arrival Customs Declaration',
                        'document_name': decl.declaration_document_name or 'Pre-Arrival Filing Document',
                        'file_size': 0,
                        'formatted_file_size': '—',
                        'file_type': 'application/pdf',
                        'document_notes': decl.declaration_notes,
                        'document_uploaded_at': decl.declaration_submitted_at.isoformat() if decl.declaration_submitted_at else None,
                        'document_uploaded_by': decl.declaration_submitted_by_id,
                        'uploaded_by_name': decl.declaration_submitted_by.user_full_name if decl.declaration_submitted_by else None,
                        'document_review_status': 'VERIFIED' if decl.declaration_status == 'CLEARED' else ('REJECTED' if decl.declaration_status == 'CUSTOMS_HOLD' else 'PENDING'),
                        'review_status_display': 'Verified' if decl.declaration_status == 'CLEARED' else ('Rejected' if decl.declaration_status == 'CUSTOMS_HOLD' else 'Pending Verification'),
                        'document_review_remarks': decl.declaration_review_remarks,
                        'document_reviewed_by': decl.declaration_reviewed_by_id,
                        'reviewed_by_name': decl.declaration_reviewed_by.user_full_name if decl.declaration_reviewed_by else None,
                        'document_reviewed_at': decl.declaration_reviewed_at.isoformat() if decl.declaration_reviewed_at else None,
                        'file_url': decl.declaration_document.url if hasattr(decl.declaration_document, 'url') else str(decl.declaration_document),
                        'document_created_at': decl.declaration_created_at.isoformat() if decl.declaration_created_at else None,
                        'document_updated_at': decl.declaration_updated_at.isoformat() if decl.declaration_updated_at else None,
                    })

        return data



CONTAINER_NUMBER_REGEX = re.compile(r'^[A-Z]{4}\d{7}$')

VALID_CONTAINER_TRANSITIONS = {
    'REGISTERED': ['ARRIVED'],
    'ARRIVED': ['AT_TERMINAL'],
    'AT_TERMINAL': ['AWAITING_CUSTOMS', 'UNDER_INSPECTION'],
    'AWAITING_CUSTOMS': ['UNDER_INSPECTION'],
    'UNDER_INSPECTION': ['CLEARED', 'CUSTOMS_HOLD'],
    'CUSTOMS_HOLD': ['UNDER_INSPECTION'],
    'CLEARED': ['RELEASED'],
    'RELEASED': []
}


class ContainerCreateUpdateSerializer(serializers.ModelSerializer):
    container_cargo_id = serializers.PrimaryKeyRelatedField(
        queryset=Cargo.objects.all(),
        required=True
    )
    container_type = serializers.CharField(required=True)

    class Meta:
        model = Container
        fields = [
            'container_cargo_id',
            'container_number',
            'container_type',
            'container_gross_weight'
        ]

    def validate_container_cargo_id(self, value):
        if value.cargo_type != 'CONTAINERIZED':
            raise serializers.ValidationError(
                "Containers can only be registered for containerized cargo."
            )
        return value

    def validate_container_number(self, value):
        if not value or not str(value).strip():
            raise serializers.ValidationError("Container number is required.")
        
        normalized = str(value).strip().upper()
        if not CONTAINER_NUMBER_REGEX.match(normalized):
            raise serializers.ValidationError(
                "Invalid container number format. Must consist of 4 uppercase letters followed by 7 digits (e.g. MSCU1234567)."
            )
        
        # Check uniqueness across database, excluding current instance if editing
        qs = Container.objects.filter(container_number=normalized)
        if self.instance:
            qs = qs.exclude(container_id=self.instance.container_id)
        if qs.exists():
            raise serializers.ValidationError(
                f"Container number '{normalized}' already exists in the system."
            )
        
        return normalized

    def validate_container_type(self, value):
        val = str(value).strip().upper().replace(' ', '')
        type_mapping = {
            '20FT': '20FT',
            '20': '20FT',
            '20_FT': '20FT',
            '40FT': '40FT',
            '40': '40FT',
            '40_FT': '40FT',
            '40FTHC': '40FT_HC',
            '40FT_HC': '40FT_HC',
            '40_FT_HC': '40FT_HC',
            '40_FT_HIGHCUBE': '40FT_HC',
            '40FTHIGHCUBE': '40FT_HC',
            'HIGHCUBE': '40FT_HC'
        }
        if val in type_mapping:
            return type_mapping[val]
        
        valid_types = [c[0] for c in Container.CONTAINER_TYPE_CHOICES]
        if str(value).strip() in valid_types:
            return str(value).strip()
            
        raise serializers.ValidationError(
            f"Invalid container type '{value}'. Allowed options: '20 FT', '40 FT', '40 FT High Cube'."
        )

    def validate_container_gross_weight(self, value):
        try:
            val = float(value)
        except (ValueError, TypeError):
            raise serializers.ValidationError("Gross weight must be a valid numeric value.")
        
        if val <= 0:
            raise serializers.ValidationError("Gross weight must be greater than zero.")
        return value


class ContainerStatusTransitionSerializer(serializers.Serializer):
    status = serializers.CharField(required=True)
    remarks = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_status(self, value):
        val = str(value).strip().upper().replace(' ', '_')
        valid_statuses = [c[0] for c in Container.CONTAINER_STATUS_CHOICES]
        
        alias_map = {
            'AT_TERMINAL': 'AT_TERMINAL',
            'ATTERMINAL': 'AT_TERMINAL',
            'TERMINAL': 'AT_TERMINAL',
            'AWAITING_CUSTOMS': 'AWAITING_CUSTOMS',
            'AWAITINGCUSTOMS': 'AWAITING_CUSTOMS',
            'PENDING_CUSTOMS': 'AWAITING_CUSTOMS',
            'CUSTOMS_PENDING': 'AWAITING_CUSTOMS',
            'UNDER_INSPECTION': 'UNDER_INSPECTION',
            'UNDERINSPECTION': 'UNDER_INSPECTION',
            'INSPECTION': 'UNDER_INSPECTION',
            'CUSTOMS_HOLD': 'CUSTOMS_HOLD',
            'CUSTOMSHOLD': 'CUSTOMS_HOLD',
            'ON_HOLD': 'CUSTOMS_HOLD',
            'HOLD': 'CUSTOMS_HOLD',
            'CLEARED': 'CLEARED',
            'RELEASED': 'RELEASED',
        }
        if val in alias_map:
            val = alias_map[val]

        if val not in valid_statuses:
            raise serializers.ValidationError(
                f"Invalid container status '{value}'. Allowed statuses: {', '.join(valid_statuses)}."
            )
        return val


class CustomsInspectionSerializer(serializers.ModelSerializer):
    officer_name = serializers.SerializerMethodField()
    officer_email = serializers.SerializerMethodField()
    customs_inspection_status_display = serializers.CharField(source='get_customs_inspection_status_display', read_only=True)
    customs_inspection_result_display = serializers.CharField(source='get_customs_inspection_result_display', read_only=True)
    customs_inspection_document_status_display = serializers.CharField(source='get_customs_inspection_document_status_display', read_only=True)
    customs_inspection_hold_reason_display = serializers.CharField(source='get_customs_inspection_hold_reason_display', read_only=True)

    class Meta:
        model = CustomsInspection
        fields = [
            'customs_inspection_id',
            'customs_inspection_container_id',
            'customs_inspection_officer_id',
            'officer_name',
            'officer_email',
            'customs_inspection_status',
            'customs_inspection_status_display',
            'customs_inspection_result',
            'customs_inspection_result_display',
            'customs_inspection_document_status',
            'customs_inspection_document_status_display',
            'customs_inspection_remarks',
            'customs_inspection_hold_reason',
            'customs_inspection_hold_reason_display',
            'customs_inspection_started_at',
            'customs_inspection_completed_at',
            'customs_inspection_clearance_date',
            'customs_inspection_created_at',
            'customs_inspection_updated_at'
        ]

    def get_officer_name(self, obj):
        if obj.customs_inspection_officer_id:
            return obj.customs_inspection_officer_id.user_full_name
        return None

    def get_officer_email(self, obj):
        if obj.customs_inspection_officer_id and obj.customs_inspection_officer_id.login_id:
            return obj.customs_inspection_officer_id.login_id.login_email
        return None


class CustomsInspectionSubmitSerializer(serializers.Serializer):
    inspection_result = serializers.ChoiceField(
        choices=[
            'CLEARED', 'HOLD', 'CUSTOMS_HOLD',
            'ADDITIONAL_INFORMATION_REQUIRED', 'UNDER_INSPECTION'
        ],
        required=True
    )
    document_verification_status = serializers.ChoiceField(
        choices=['VERIFIED', 'PENDING', 'ISSUE_FOUND'],
        default='VERIFIED',
        required=False
    )
    remarks = serializers.CharField(required=False, allow_blank=True, default='')
    hold_reason = serializers.CharField(required=False, allow_blank=True, default='')

    def validate(self, data):
        res = data.get('inspection_result')
        doc_status = data.get('document_verification_status')
        remarks = data.get('remarks', '').strip()
        hold_reason = data.get('hold_reason', '').strip()

        if res == 'CLEARED':
            if doc_status != 'VERIFIED':
                raise serializers.ValidationError({
                    'document_verification_status': "Document verification status must be 'VERIFIED' to grant customs clearance."
                })
        elif res in ['HOLD', 'CUSTOMS_HOLD']:
            if not hold_reason:
                raise serializers.ValidationError({
                    'hold_reason': "Hold reason is required when placing a container on Customs Hold."
                })
            valid_reasons = [c[0] for c in CustomsInspection.HOLD_REASON_CHOICES]
            normalized_reason = hold_reason.upper().replace(' ', '_')
            if normalized_reason not in valid_reasons:
                raise serializers.ValidationError({
                    'hold_reason': f"Invalid hold reason. Allowed options: {', '.join(valid_reasons)}"
                })
            data['hold_reason'] = normalized_reason
            if not remarks:
                raise serializers.ValidationError({
                    'remarks': "Inspection remarks / notes are required when placing a container on Customs Hold."
                })
        elif res == 'ADDITIONAL_INFORMATION_REQUIRED':
            if not remarks:
                raise serializers.ValidationError({
                    'remarks': "Detailed remarks are required specifying what additional information or documentation is needed."
                })
        return data


class GateReleaseSerializer(serializers.ModelSerializer):
    officer_name = serializers.SerializerMethodField()
    officer_email = serializers.SerializerMethodField()

    class Meta:
        model = GateRelease
        fields = [
            'gate_release_id',
            'gate_release_container_id',
            'gate_release_officer_id',
            'officer_name',
            'officer_email',
            'gate_release_previous_status',
            'gate_release_new_status',
            'gate_release_truck_number',
            'gate_release_driver_name',
            'gate_release_driver_license',
            'gate_release_exit_point',
            'gate_release_remarks',
            'gate_release_time',
            'gate_release_created_at',
            'gate_release_updated_at'
        ]

    def get_officer_name(self, obj):
        if obj.gate_release_officer_id:
            return obj.gate_release_officer_id.user_full_name
        return None

    def get_officer_email(self, obj):
        if obj.gate_release_officer_id and obj.gate_release_officer_id.login_id:
            return obj.gate_release_officer_id.login_id.login_email
        return None


class GateReleaseSubmitSerializer(serializers.Serializer):
    truck_number = serializers.CharField(required=True, max_length=50)
    driver_name = serializers.CharField(required=True, max_length=150)
    driver_license = serializers.CharField(required=True, max_length=100)
    exit_point = serializers.CharField(required=True, max_length=100)
    remarks = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_truck_number(self, value):
        val = str(value).strip().upper()
        if not val:
            raise serializers.ValidationError("Truck / Registration number is required.")
        return val

    def validate_driver_name(self, value):
        val = str(value).strip()
        if not val:
            raise serializers.ValidationError("Driver name is required.")
        return val

    def validate_driver_license(self, value):
        val = str(value).strip().upper()
        if not val:
            raise serializers.ValidationError("Driver identification / license reference is required.")
        return val

    def validate_exit_point(self, value):
        val = str(value).strip()
        if not val:
            raise serializers.ValidationError("Gate / Exit point is required.")
        return val


class TruckSerializer(serializers.ModelSerializer):
    class Meta:
        model = Truck
        fields = [
            'truck_id',
            'truck_number',
            'truck_company_name',
            'truck_status',
            'truck_created_at',
            'truck_updated_at'
        ]


class DriverSerializer(serializers.ModelSerializer):
    driver_license = serializers.CharField(source='driver_license_number', read_only=True)

    class Meta:
        model = Driver
        fields = [
            'driver_id',
            'driver_name',
            'driver_license',
            'driver_license_number',
            'driver_phone',
            'driver_email',
            'driver_status',
            'driver_created_at',
            'driver_updated_at'
        ]
        extra_kwargs = {
            'driver_license_number': {'required': False}
        }

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else dict(data)
        if 'driver_license' in data and not data.get('driver_license_number'):
            data['driver_license_number'] = data.get('driver_license')
        return super().to_internal_value(data)

    def validate(self, data):
        if not data.get('driver_license_number') or not str(data.get('driver_license_number')).strip():
            raise serializers.ValidationError({"driver_license_number": "Driving licence or government ID reference is required."})
        return data


class GateSerializer(serializers.ModelSerializer):
    gate_type_display = serializers.CharField(source='get_gate_type_display', read_only=True)

    class Meta:
        model = Gate
        fields = [
            'gate_id',
            'gate_name',
            'gate_code',
            'gate_type',
            'gate_type_display',
            'gate_is_active',
            'gate_created_at'
        ]


class GatePassContainerSerializer(serializers.ModelSerializer):
    container_id = serializers.IntegerField(source='gate_pass_container_container_id.container_id', read_only=True)
    container_number = serializers.CharField(source='gate_pass_container_container_id.container_number', read_only=True)
    container_type = serializers.CharField(source='gate_pass_container_container_id.container_type', read_only=True)
    container_type_display = serializers.CharField(source='gate_pass_container_container_id.get_container_type_display', read_only=True)
    container_gross_weight = serializers.DecimalField(source='gate_pass_container_container_id.container_gross_weight', max_digits=10, decimal_places=2, read_only=True)
    container_status = serializers.CharField(source='gate_pass_container_container_id.container_status', read_only=True)
    container_status_display = serializers.CharField(source='gate_pass_container_container_id.get_container_status_display', read_only=True)
    cargo_description = serializers.CharField(source='gate_pass_container_container_id.cargo.cargo_description', read_only=True)
    vessel_name = serializers.CharField(source='gate_pass_container_container_id.vessel.vessel_name', read_only=True)
    shipping_company_name = serializers.CharField(source='gate_pass_container_container_id.shipping_company.shipping_company_name', read_only=True)

    class Meta:
        model = GatePassContainer
        fields = [
            'gate_pass_container_id',
            'container_id',
            'container_number',
            'container_type',
            'container_type_display',
            'container_gross_weight',
            'container_status',
            'container_status_display',
            'cargo_description',
            'vessel_name',
            'shipping_company_name',
            'gate_pass_container_created_at'
        ]


class GatePassSerializer(serializers.ModelSerializer):
    truck = TruckSerializer(source='gate_pass_truck_id', read_only=True)
    driver = DriverSerializer(source='gate_pass_driver_id', read_only=True)
    gate = GateSerializer(source='gate_pass_gate_id', read_only=True)
    issued_by_name = serializers.SerializerMethodField()
    gate_pass_status_display = serializers.CharField(source='get_gate_pass_status_display', read_only=True)
    gate_pass_email_status_display = serializers.CharField(source='get_gate_pass_email_status_display', read_only=True)
    containers = GatePassContainerSerializer(many=True, read_only=True)
    is_valid = serializers.BooleanField(read_only=True)
    qr_svg = serializers.SerializerMethodField()
    qr_png_base64 = serializers.SerializerMethodField()

    class Meta:
        model = GatePass
        fields = [
            'gate_pass_id',
            'gate_pass_pass_number',
            'gate_pass_movement_number',
            'truck',
            'driver',
            'gate',
            'issued_by_name',
            'gate_pass_status',
            'gate_pass_status_display',
            'gate_pass_verification_code',
            'gate_pass_qr_code',
            'qr_svg',
            'qr_png_base64',
            'gate_pass_issued_at',
            'gate_pass_valid_until',
            'gate_pass_verified_at',
            'gate_pass_used_at',
            'gate_pass_cancelled_at',
            'gate_pass_remarks',
            'gate_pass_email_status',
            'gate_pass_email_status_display',
            'gate_pass_email_sent_at',
            'gate_pass_email_error',
            'containers',
            'is_valid',
            'gate_pass_created_at',
            'gate_pass_updated_at'
        ]

    def get_issued_by_name(self, obj):
        if obj.gate_pass_issued_by:
            return obj.gate_pass_issued_by.user_full_name
        return 'Port Dispatch Officer'

    def get_qr_svg(self, obj):
        try:
            return generate_qr_svg(obj.gate_pass_qr_code)
        except Exception:
            return ''

    def get_qr_png_base64(self, obj):
        try:
            return generate_qr_png_base64(obj.gate_pass_qr_code)
        except Exception:
            return ''


class GatePassGenerateSerializer(serializers.Serializer):
    truck_id = serializers.IntegerField(required=True)
    driver_id = serializers.IntegerField(required=True)
    gate_id = serializers.IntegerField(required=True)
    container_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=True,
        allow_empty=False
    )
    valid_hours = serializers.IntegerField(required=False, default=24, min_value=1, max_value=72)
    remarks = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_container_ids(self, value):
        if not value:
            raise serializers.ValidationError("At least one eligible container must be selected.")
        return list(dict.fromkeys(value))


class GatePassVerifySerializer(serializers.Serializer):
    verification_code = serializers.CharField(required=False, allow_blank=True)
    pass_number = serializers.CharField(required=False, allow_blank=True)
    qr_data = serializers.CharField(required=False, allow_blank=True)
    verification_input = serializers.CharField(required=False, allow_blank=True)
    gate_id = serializers.IntegerField(required=False, allow_null=True)

    def validate(self, data):
        if not data.get('verification_code') and not data.get('pass_number') and not data.get('qr_data') and not data.get('verification_input'):
            raise serializers.ValidationError("Provide at least verification_code, pass_number, qr_data, or verification_input to verify.")
        return data


class GatePassReleaseSerializer(serializers.Serializer):
    remarks = serializers.CharField(required=False, allow_blank=True, default='')
    truck_number = serializers.CharField(required=False, allow_blank=True)
    driver_name = serializers.CharField(required=False, allow_blank=True)
    driver_license = serializers.CharField(required=False, allow_blank=True)
    gate_name = serializers.CharField(required=False, allow_blank=True)


# =============================================================================
# CONTAINER DELIVERY TRACKING WORKFLOW SERIALIZERS
# =============================================================================

def format_datetime_ist(dt):
    """
    Format timezone-aware datetime to India Standard Time (Asia/Kolkata).
    Format standard: "07 Oct 2026, 12:17 AM"
    Safely handles naive datetimes and null inputs without throwing exceptions.
    """
    if not dt:
        return None
    try:
        if timezone.is_aware(dt):
            local_dt = timezone.localtime(dt)
        else:
            local_dt = dt
        return f"{local_dt.strftime('%d %b %Y')}, {local_dt.strftime('%I:%M %p')}"
    except Exception:
        try:
            return f"{dt.strftime('%d %b %Y')}, {dt.strftime('%I:%M %p')}"
        except Exception:
            return None


class ContainerTrackingEventSerializer(serializers.ModelSerializer):
    container_id = serializers.IntegerField(source='tracking_event_container_id.container_id', read_only=True)
    container_number = serializers.CharField(source='tracking_event_container_id.container_number', read_only=True)
    status = serializers.CharField(source='tracking_event_status', read_only=True)
    status_display = serializers.CharField(source='get_tracking_event_status_display', read_only=True)
    timestamp = serializers.DateTimeField(source='tracking_event_timestamp', read_only=True)
    timestamp_formatted = serializers.SerializerMethodField()
    location = serializers.CharField(source='tracking_event_location', read_only=True)
    description = serializers.CharField(source='tracking_event_description', read_only=True)
    exception_reason = serializers.CharField(source='tracking_event_exception_reason', read_only=True)
    updated_by_name = serializers.SerializerMethodField()
    updated_by_role = serializers.SerializerMethodField()
    gate_pass_id = serializers.IntegerField(source='tracking_event_gate_pass_id.gate_pass_id', read_only=True, allow_null=True)
    gate_pass_number = serializers.CharField(source='tracking_event_gate_pass_id.gate_pass_pass_number', read_only=True, allow_null=True)
    created_at = serializers.DateTimeField(source='tracking_event_created_at', read_only=True)

    tracking_event_status_display = serializers.CharField(source='get_tracking_event_status_display', read_only=True)

    class Meta:
        model = ContainerTrackingEvent
        fields = [
            'tracking_event_id',
            'container_id',
            'container_number',
            'status',
            'status_display',
            'timestamp',
            'timestamp_formatted',
            'location',
            'description',
            'exception_reason',
            'updated_by_name',
            'updated_by_role',
            'gate_pass_id',
            'gate_pass_number',
            'created_at',
            'tracking_event_status',
            'tracking_event_status_display',
            'tracking_event_timestamp',
            'tracking_event_location',
            'tracking_event_description',
            'tracking_event_exception_reason',
            'tracking_event_created_at',
        ]

    def get_timestamp_formatted(self, obj):
        dt = obj.tracking_event_timestamp
        if dt:
            formatted = format_datetime_ist(dt)
            return formatted if formatted else "Date/time unavailable"
        return "Date/time unavailable"

    def get_updated_by_name(self, obj):
        if obj.tracking_event_updated_by:
            name = obj.tracking_event_updated_by.user_full_name
            if name:
                return name.strip().title()
            login = obj.tracking_event_updated_by.login_id
            if login and login.login_email:
                return login.login_email.split('@')[0].capitalize()
        return "Operations Desk"

    def get_updated_by_role(self, obj):
        if obj.tracking_event_updated_by and obj.tracking_event_updated_by.login_id:
            role = obj.tracking_event_updated_by.login_id.login_role
            role_display_map = {
                'port_administrator': 'Port Administrator',
                'terminal_logistics_operator': 'Terminal & Logistics Operator',
                'terminal_operator': 'Terminal & Logistics Operator',
                'gate_truck_officer': 'Gate Operations Officer',
                'gate_officer': 'Gate Operations Officer',
                'customs_officer': 'Customs Officer',
                'shipping_company': 'Shipping Agent',
                'port_operations_officer': 'Port Operations Officer',
            }
            return role_display_map.get(role, role.replace('_', ' ').title())
        return "Operations Officer"


class ContainerDeliveryListSerializer(serializers.ModelSerializer):
    cargo_id = serializers.IntegerField(source='container_cargo_id.cargo_id', read_only=True)
    cargo_description = serializers.CharField(source='container_cargo_id.cargo_description', read_only=True)
    cargo_type = serializers.CharField(source='container_cargo_id.get_cargo_type_display', read_only=True)
    vessel_name = serializers.SerializerMethodField()
    arrival_request_id = serializers.SerializerMethodField()
    gate_pass_id = serializers.SerializerMethodField()
    gate_pass_number = serializers.SerializerMethodField()
    truck_number = serializers.SerializerMethodField()
    driver_name = serializers.SerializerMethodField()
    current_status = serializers.SerializerMethodField()
    current_status_display = serializers.SerializerMethodField()
    container_delivery_status = serializers.SerializerMethodField()
    container_delivery_status_display = serializers.SerializerMethodField()
    last_known_location = serializers.SerializerMethodField()
    destination = serializers.SerializerMethodField()
    expected_delivery_date = serializers.DateTimeField(source='container_expected_delivery_date', read_only=True)
    expected_delivery_date_formatted = serializers.SerializerMethodField()
    expected_delivery_datetime = serializers.SerializerMethodField()
    expected_delivery_destination = serializers.SerializerMethodField()
    actual_delivery_datetime = serializers.SerializerMethodField()
    final_delivery_destination = serializers.SerializerMethodField()
    container_expected_delivery_date = serializers.SerializerMethodField()
    container_delivery_destination = serializers.SerializerMethodField()
    last_updated = serializers.SerializerMethodField()
    last_updated_iso = serializers.SerializerMethodField()
    last_updated_by = serializers.SerializerMethodField()

    class Meta:
        model = Container
        fields = [
            'container_id',
            'container_number',
            'container_type',
            'container_gross_weight',
            'cargo_id',
            'cargo_description',
            'cargo_type',
            'vessel_name',
            'arrival_request_id',
            'gate_pass_id',
            'gate_pass_number',
            'truck_number',
            'driver_name',
            'current_status',
            'current_status_display',
            'container_delivery_status',
            'container_delivery_status_display',
            'last_known_location',
            'destination',
            'expected_delivery_date',
            'expected_delivery_date_formatted',
            'expected_delivery_datetime',
            'expected_delivery_destination',
            'actual_delivery_datetime',
            'final_delivery_destination',
            'container_expected_delivery_date',
            'container_delivery_destination',
            'last_updated',
            'last_updated_iso',
            'last_updated_by',
        ]

    def get_vessel_name(self, obj):
        vessel = obj.vessel
        return vessel.vessel_name if vessel else "—"

    def get_arrival_request_id(self, obj):
        ar = obj.arrival_request
        return f"AR-{str(ar.vessel_arrival_request_id).zfill(4)}" if ar else "—"

    def get_gate_pass_id(self, obj):
        gp = obj.latest_gate_pass
        return gp.gate_pass_id if gp else None

    def get_gate_pass_number(self, obj):
        gp = obj.latest_gate_pass
        return gp.gate_pass_pass_number if gp else "—"

    def get_truck_number(self, obj):
        gp = obj.latest_gate_pass
        if gp and gp.gate_pass_truck_id:
            return gp.gate_pass_truck_id.truck_number
        gr = obj.latest_gate_release
        if gr:
            return gr.gate_release_truck_number
        return "—"

    def get_driver_name(self, obj):
        gp = obj.latest_gate_pass
        if gp and gp.gate_pass_driver_id:
            return gp.gate_pass_driver_id.driver_name
        gr = obj.latest_gate_release
        if gr:
            return gr.gate_release_driver_name
        return "—"

    def get_current_status(self, obj):
        if obj.container_delivery_status and obj.container_delivery_status != 'NOT_APPLICABLE':
            return obj.container_delivery_status
        latest_event = obj.latest_tracking_event
        if latest_event:
            return latest_event.tracking_event_status
        return 'RELEASED' if obj.container_status == 'RELEASED' else 'NOT_APPLICABLE'

    def get_current_status_display(self, obj):
        status_key = self.get_current_status(obj)
        status_display_map = {
            'RELEASED': 'Released',
            'GATE_PASS_GENERATED': 'Gate Pass Generated',
            'PICKED_UP': 'Picked Up',
            'DEPARTED_PORT': 'Departed Port',
            'IN_TRANSIT': 'In Transit',
            'OUT_FOR_DELIVERY': 'Out for Delivery',
            'DELIVERED': 'Delivered',
            'DELIVERY_EXCEPTION': 'Delivery Exception',
            'NOT_APPLICABLE': 'Not Applicable',
        }
        return status_display_map.get(status_key, status_key.replace('_', ' ').title())

    def get_container_delivery_status(self, obj):
        return self.get_current_status(obj)

    def get_container_delivery_status_display(self, obj):
        return self.get_current_status_display(obj)

    def get_last_known_location(self, obj):
        latest_event = obj.latest_tracking_event
        if latest_event and latest_event.tracking_event_location:
            return latest_event.tracking_event_location
        if obj.container_delivery_location:
            return obj.container_delivery_location
        gp = obj.latest_gate_pass
        if gp and gp.gate_pass_gate_id:
            return gp.gate_pass_gate_id.gate_name
        return "Port Terminal"

    def get_destination(self, obj):
        if obj.container_delivery_destination:
            return obj.container_delivery_destination
        cargo = obj.container_cargo_id
        if cargo and cargo.cargo_destination_port_id:
            return f"{cargo.cargo_destination_port_id.port_name} Logistics Hub"
        return "Regional Logistics & Distribution Facility"

    def get_expected_delivery_date_formatted(self, obj):
        dt = obj.container_expected_delivery_date
        return format_datetime_ist(dt)

    def get_expected_delivery_datetime(self, obj):
        dt = obj.container_expected_delivery_date
        return dt.isoformat() if dt else None

    def get_container_expected_delivery_date(self, obj):
        return self.get_expected_delivery_datetime(obj)

    def get_expected_delivery_destination(self, obj):
        if obj.container_delivery_destination:
            return obj.container_delivery_destination
        return self.get_destination(obj)

    def get_container_delivery_destination(self, obj):
        return self.get_expected_delivery_destination(obj)

    def get_actual_delivery_datetime(self, obj):
        status = self.get_current_status(obj)
        if status == 'DELIVERED':
            if obj.container_delivered_at:
                return obj.container_delivered_at.isoformat()
            latest_del_ev = obj.tracking_events.filter(tracking_event_status='DELIVERED').order_by('-tracking_event_timestamp', '-tracking_event_id').first()
            if latest_del_ev and latest_del_ev.tracking_event_timestamp:
                return latest_del_ev.tracking_event_timestamp.isoformat()
        return None

    def get_final_delivery_destination(self, obj):
        status = self.get_current_status(obj)
        if status == 'DELIVERED':
            if obj.container_delivery_destination:
                return obj.container_delivery_destination
            if obj.container_delivery_location:
                return obj.container_delivery_location
            return self.get_destination(obj)
        return None

    def get_last_updated(self, obj):
        latest_event = obj.latest_tracking_event
        dt = latest_event.tracking_event_timestamp if latest_event else (obj.container_updated_at or obj.container_created_at)
        formatted = format_datetime_ist(dt)
        return formatted if formatted else "—"

    def get_last_updated_iso(self, obj):
        latest_event = obj.latest_tracking_event
        dt = latest_event.tracking_event_timestamp if latest_event else (obj.container_updated_at or obj.container_created_at)
        return dt.isoformat() if dt else None

    def get_last_updated_by(self, obj):
        latest_event = obj.latest_tracking_event
        if latest_event and latest_event.tracking_event_updated_by:
            return latest_event.tracking_event_updated_by.user_full_name
        return "Operations Desk"


class ContainerDeliveryDetailSerializer(ContainerDeliveryListSerializer):
    delivered_at = serializers.DateTimeField(source='container_delivered_at', read_only=True)
    delivered_at_formatted = serializers.SerializerMethodField()
    delivered_by_name = serializers.SerializerMethodField()
    delivered_by_role = serializers.SerializerMethodField()
    delivery_location = serializers.CharField(source='container_delivery_location', read_only=True)
    delivery_recipient = serializers.CharField(source='container_delivery_recipient', read_only=True)
    delivery_reference = serializers.SerializerMethodField()
    delivery_remarks = serializers.CharField(source='container_delivery_remarks', read_only=True)
    container_delivered_at = serializers.SerializerMethodField()
    container_delivered_by_name = serializers.SerializerMethodField()
    container_delivery_recipient = serializers.CharField(read_only=True)
    container_delivery_remarks = serializers.CharField(read_only=True)
    container_delivery_location = serializers.CharField(read_only=True)
    timeline = serializers.SerializerMethodField()
    history_events = serializers.SerializerMethodField()
    tracking_history = serializers.SerializerMethodField()
    allowed_actions = serializers.SerializerMethodField()
    has_active_exception = serializers.SerializerMethodField()
    exception_details = serializers.SerializerMethodField()

    class Meta(ContainerDeliveryListSerializer.Meta):
        fields = ContainerDeliveryListSerializer.Meta.fields + [
            'delivered_at',
            'delivered_at_formatted',
            'delivered_by_name',
            'delivered_by_role',
            'delivery_location',
            'delivery_recipient',
            'delivery_reference',
            'delivery_remarks',
            'container_delivered_at',
            'container_delivered_by_name',
            'container_delivery_recipient',
            'container_delivery_remarks',
            'container_delivery_location',
            'timeline',
            'history_events',
            'tracking_history',
            'allowed_actions',
            'has_active_exception',
            'exception_details',
        ]

    def get_container_delivered_at(self, obj):
        return self.get_actual_delivery_datetime(obj)

    def get_container_delivered_by_name(self, obj):
        return self.get_delivered_by_name(obj)

    def get_delivered_at_formatted(self, obj):
        dt = obj.container_delivered_at
        if not dt and self.get_current_status(obj) == 'DELIVERED':
            latest_del_ev = obj.tracking_events.filter(tracking_event_status='DELIVERED').order_by('-tracking_event_timestamp', '-tracking_event_id').first()
            if latest_del_ev:
                dt = latest_del_ev.tracking_event_timestamp
        return format_datetime_ist(dt)

    def get_delivered_by_name(self, obj):
        if obj.container_delivered_by:
            return obj.container_delivered_by.user_full_name
        latest_del_ev = obj.tracking_events.filter(tracking_event_status='DELIVERED').order_by('-tracking_event_timestamp', '-tracking_event_id').first()
        if latest_del_ev and latest_del_ev.tracking_event_updated_by:
            return latest_del_ev.tracking_event_updated_by.user_full_name
        return None

    def get_delivered_by_role(self, obj):
        role_display_map = {
            'port_administrator': 'Port Administrator',
            'terminal_logistics_operator': 'Terminal & Logistics Operator',
            'terminal_operator': 'Terminal & Logistics Operator',
            'gate_truck_officer': 'Gate Operations Officer',
            'gate_officer': 'Gate Operations Officer',
            'customs_officer': 'Customs Officer',
            'shipping_company': 'Shipping Agent',
            'port_operations_officer': 'Port Operations Officer',
        }
        if obj.container_delivered_by and obj.container_delivered_by.login_id:
            role = obj.container_delivered_by.login_id.login_role
            return role_display_map.get(role, role.replace('_', ' ').title())
        latest_del_ev = obj.tracking_events.filter(tracking_event_status='DELIVERED').order_by('-tracking_event_timestamp', '-tracking_event_id').first()
        if latest_del_ev and latest_del_ev.tracking_event_updated_by and latest_del_ev.tracking_event_updated_by.login_id:
            role = latest_del_ev.tracking_event_updated_by.login_id.login_role
            return role_display_map.get(role, role.replace('_', ' ').title())
        return "Terminal & Logistics Operator"

    def get_delivery_reference(self, obj):
        if obj.container_delivery_recipient:
            return obj.container_delivery_recipient
        latest_del_ev = obj.tracking_events.filter(tracking_event_status='DELIVERED').order_by('-tracking_event_timestamp', '-tracking_event_id').first()
        if latest_del_ev and latest_del_ev.tracking_event_gate_pass_id:
            return f"GP-REF-{latest_del_ev.tracking_event_gate_pass_id.gate_pass_pass_number}"
        return f"DEL-{obj.container_number[-6:]}" if obj.container_number else None

    def get_has_active_exception(self, obj):
        return self.get_current_status(obj) == 'DELIVERY_EXCEPTION'

    def get_exception_details(self, obj):
        latest_exc = obj.tracking_events.filter(tracking_event_status='DELIVERY_EXCEPTION').order_by('-tracking_event_timestamp', '-tracking_event_id').first()
        if latest_exc:
            return ContainerTrackingEventSerializer(latest_exc).data
        return None

    def get_timeline(self, obj):
        current_status = self.get_current_status(obj)
        milestones = [
            ('RELEASED', 'Container Released'),
            ('GATE_PASS_GENERATED', 'Gate Pass Generated'),
            ('PICKED_UP', 'Picked Up'),
            ('DEPARTED_PORT', 'Departed Port'),
            ('IN_TRANSIT', 'In Transit'),
            ('OUT_FOR_DELIVERY', 'Out for Delivery'),
            ('DELIVERED', 'Delivered'),
        ]
        status_order = [m[0] for m in milestones]
        all_events = list(obj.tracking_events.order_by('tracking_event_timestamp', 'tracking_event_id'))

        event_by_status = {}
        for ev in all_events:
            event_by_status[ev.tracking_event_status] = ev

        current_idx = status_order.index(current_status) if current_status in status_order else 0
        if current_status == 'DELIVERY_EXCEPTION':
            current_idx = 0
            for idx, m_code in enumerate(status_order):
                if m_code in event_by_status:
                    current_idx = idx

        timeline_nodes = []
        for idx, (m_code, label) in enumerate(milestones):
            ev = event_by_status.get(m_code)
            if current_status == 'DELIVERED':
                node_status = 'completed'
            elif current_status == 'DELIVERY_EXCEPTION':
                if idx < current_idx:
                    node_status = 'completed'
                elif idx == current_idx:
                    node_status = 'current'
                else:
                    node_status = 'pending'
            else:
                if idx < current_idx:
                    node_status = 'completed'
                elif idx == current_idx:
                    node_status = 'current'
                else:
                    node_status = 'pending'

            dt = ev.tracking_event_timestamp if ev else None
            formatted_time = None
            if dt:
                formatted_time = format_datetime_ist(dt)
            elif node_status == 'pending':
                formatted_time = 'Pending'
            else:
                formatted_time = '—'

            timeline_nodes.append({
                'key': m_code,
                'step': m_code,
                'label': label,
                'status': node_status,
                'is_completed': node_status == 'completed',
                'is_current': node_status == 'current',
                'is_pending': node_status == 'pending',
                'timestamp': formatted_time,
                'timestamp_iso': dt.isoformat() if dt else None,
                'location': ev.tracking_event_location if ev else None,
                'description': ev.tracking_event_description if ev else None,
                'updated_by': ev.tracking_event_updated_by.user_full_name if (ev and ev.tracking_event_updated_by) else None,
            })

        return timeline_nodes

    def get_history_events(self, obj):
        events = obj.tracking_events.select_related(
            'tracking_event_updated_by',
            'tracking_event_updated_by__login_id',
            'tracking_event_gate_pass_id'
        ).order_by('tracking_event_timestamp', 'tracking_event_id')
        return ContainerTrackingEventSerializer(events, many=True).data

    def get_tracking_history(self, obj):
        return self.get_history_events(obj)

    def get_allowed_actions(self, obj):
        request = self.context.get('request')
        current_status = self.get_current_status(obj)
        if not request:
            return []
        user_role = (request.headers.get('X-User-Role') or getattr(getattr(request, 'user', None), 'login_role', '')).strip().lower()
        actions = []
        is_admin = user_role in ['port_administrator', 'admin']
        is_gate_officer = user_role in ['gate_truck_officer', 'gate_officer']
        is_terminal_operator = user_role in ['terminal_logistics_operator', 'terminal_operator']

        if current_status == 'DELIVERED':
            return []

        if is_gate_officer or is_admin:
            if current_status == 'PICKED_UP':
                actions.append({
                    'action': 'CONFIRM_DEPARTURE',
                    'label': 'Confirm Port Departure',
                    'target_status': 'DEPARTED_PORT',
                    'description': 'Confirm that the transport vehicle has departed port premises.'
                })

        if is_terminal_operator or is_admin:
            if current_status in ['RELEASED', 'GATE_PASS_GENERATED']:
                actions.append({
                    'action': 'UPDATE_PICKED_UP',
                    'label': 'Mark as Picked Up',
                    'target_status': 'PICKED_UP',
                    'description': 'Container verified and picked up by assigned truck and driver.'
                })
            elif current_status in ['PICKED_UP', 'DEPARTED_PORT']:
                actions.append({
                    'action': 'UPDATE_IN_TRANSIT',
                    'label': 'Update to In Transit',
                    'target_status': 'IN_TRANSIT',
                    'description': 'Record highway / transit route movement.'
                })
            elif current_status == 'IN_TRANSIT':
                actions.append({
                    'action': 'UPDATE_OUT_FOR_DELIVERY',
                    'label': 'Update to Out for Delivery',
                    'target_status': 'OUT_FOR_DELIVERY',
                    'description': 'Container dispatched from local hub for final consignee delivery.'
                })
            elif current_status == 'OUT_FOR_DELIVERY':
                actions.append({
                    'action': 'CONFIRM_DELIVERY',
                    'label': 'Confirm Delivery',
                    'target_status': 'DELIVERED',
                    'description': 'Record proof of delivery and consignee receipt.'
                })
            elif current_status == 'DELIVERY_EXCEPTION':
                actions.extend([
                    {
                        'action': 'UPDATE_PICKED_UP',
                        'label': 'Resume Picked Up',
                        'target_status': 'PICKED_UP',
                        'description': 'Resume delivery from picked up stage after resolving exception.'
                    },
                    {
                        'action': 'UPDATE_IN_TRANSIT',
                        'label': 'Resume In Transit',
                        'target_status': 'IN_TRANSIT',
                        'description': 'Resume transport route after resolving exception.'
                    },
                    {
                        'action': 'UPDATE_OUT_FOR_DELIVERY',
                        'label': 'Resume Out for Delivery',
                        'target_status': 'OUT_FOR_DELIVERY',
                        'description': 'Dispatch container after resolving issue.'
                    },
                    {
                        'action': 'CONFIRM_DELIVERY',
                        'label': 'Confirm Final Delivery',
                        'target_status': 'DELIVERED',
                        'description': 'Confirm final delivery after resolution.'
                    }
                ])

            if current_status in ['RELEASED', 'GATE_PASS_GENERATED', 'PICKED_UP', 'DEPARTED_PORT', 'IN_TRANSIT', 'OUT_FOR_DELIVERY']:
                actions.append({
                    'action': 'REPORT_EXCEPTION',
                    'label': 'Report Delivery Exception',
                    'target_status': 'DELIVERY_EXCEPTION',
                    'description': 'Record delay, vehicle breakdown, damaged container, rejected delivery, or destination issue.'
                })

        return actions


class DeliveryConfirmDepartureSerializer(serializers.Serializer):
    location = serializers.CharField(required=False, allow_blank=True, default='Port Exit Checkpoint')
    remarks = serializers.CharField(required=False, allow_blank=True, default='')


class DeliveryUpdateStatusSerializer(serializers.Serializer):
    target_status = serializers.ChoiceField(choices=['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'])
    location = serializers.CharField(required=False, allow_blank=True)
    destination = serializers.CharField(required=False, allow_blank=True)
    expected_delivery_date = serializers.DateTimeField(required=False, allow_null=True)
    expected_delivery_datetime = serializers.DateTimeField(required=False, allow_null=True)
    remarks = serializers.CharField(required=False, allow_blank=True, default='')

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else dict(data)
        for field in ['expected_delivery_date', 'expected_delivery_datetime']:
            if field in data and (data[field] == '' or data[field] == 'null' or data[field] is None):
                data[field] = None
        return super().to_internal_value(data)

    def validate(self, attrs):
        if attrs.get('expected_delivery_datetime') and not attrs.get('expected_delivery_date'):
            attrs['expected_delivery_date'] = attrs['expected_delivery_datetime']
        return attrs


class DeliveryConfirmDeliverySerializer(serializers.Serializer):
    delivery_location = serializers.CharField(required=False, allow_blank=True, max_length=200)
    delivered_location = serializers.CharField(required=False, allow_blank=True, max_length=200)
    recipient_name = serializers.CharField(required=False, allow_blank=True, max_length=150, default='')
    delivered_to = serializers.CharField(required=False, allow_blank=True, max_length=150, default='')
    remarks = serializers.CharField(required=False, allow_blank=True, default='')

    def validate(self, attrs):
        loc = (attrs.get('delivery_location') or attrs.get('delivered_location') or '').strip()
        if not loc:
            raise serializers.ValidationError({'delivery_location': 'Delivery location is required.'})
        attrs['delivery_location'] = loc
        attrs['recipient_name'] = (attrs.get('recipient_name') or attrs.get('delivered_to') or '').strip()
        return attrs


class DeliveryReportExceptionSerializer(serializers.Serializer):
    EXCEPTION_CHOICES = (
        ('DELIVERY_DELAYED', 'Delivery Delayed'),
        ('VEHICLE_BREAKDOWN', 'Vehicle Breakdown'),
        ('DAMAGED_CONTAINER', 'Damaged Container'),
        ('DELIVERY_REJECTED', 'Delivery Rejected'),
        ('DESTINATION_ISSUE', 'Destination Issue'),
        ('RECEIVER_UNAVAILABLE', 'Receiver Unavailable'),
        ('DOCUMENTATION_ISSUE', 'Documentation Issue'),
        ('OTHER', 'Other'),
    )
    exception_reason = serializers.CharField(required=True, max_length=100)
    location = serializers.CharField(required=False, allow_blank=True, max_length=200, default='Transit Route')
    remarks = serializers.CharField(required=False, allow_blank=True, default='')


# ==============================================================================
# PHASE T1 — YARD MASTER MANAGEMENT SERIALIZERS
# ==============================================================================

class YardSlotSerializer(serializers.ModelSerializer):
    block_code = serializers.CharField(source='yard_slot_block_id.yard_block_code', read_only=True)
    block_name = serializers.CharField(source='yard_slot_block_id.yard_block_name', read_only=True)
    yard_id = serializers.IntegerField(source='yard_slot_block_id.yard_block_yard_id.yard_id', read_only=True)
    yard_code = serializers.CharField(source='yard_slot_block_id.yard_block_yard_id.yard_code', read_only=True)
    yard_name = serializers.CharField(source='yard_slot_block_id.yard_block_yard_id.yard_name', read_only=True)
    yard_slot_status_display = serializers.CharField(source='get_yard_slot_status_display', read_only=True)
    is_allocatable = serializers.BooleanField(read_only=True)

    class Meta:
        model = YardSlot
        fields = [
            'yard_slot_id',
            'yard_slot_block_id',
            'block_code',
            'block_name',
            'yard_id',
            'yard_code',
            'yard_name',
            'yard_slot_code',
            'yard_slot_row',
            'yard_slot_bay',
            'yard_slot_tier',
            'yard_slot_status',
            'yard_slot_status_display',
            'is_allocatable',
            'yard_slot_created_at',
            'yard_slot_updated_at',
        ]


class YardSlotCreateUpdateSerializer(serializers.ModelSerializer):
    yard_slot_code = serializers.CharField(required=False, allow_blank=True, max_length=50)

    class Meta:
        model = YardSlot
        fields = [
            'yard_slot_id',
            'yard_slot_block_id',
            'yard_slot_code',
            'yard_slot_row',
            'yard_slot_bay',
            'yard_slot_tier',
            'yard_slot_status',
        ]
        validators = []

    def validate_yard_slot_row(self, value):
        if value is None or value <= 0:
            raise serializers.ValidationError("Slot row must be a valid positive integer greater than zero.")
        return value

    def validate_yard_slot_bay(self, value):
        if value is None or value <= 0:
            raise serializers.ValidationError("Slot bay must be a valid positive integer greater than zero.")
        return value

    def validate_yard_slot_tier(self, value):
        if value is None or value <= 0:
            raise serializers.ValidationError("Slot tier must be a valid positive integer greater than zero.")
        return value

    def validate(self, attrs):
        block = attrs.get('yard_slot_block_id') or (self.instance.yard_slot_block_id if self.instance else None)
        row = attrs.get('yard_slot_row', getattr(self.instance, 'yard_slot_row', None))
        bay = attrs.get('yard_slot_bay', getattr(self.instance, 'yard_slot_bay', None))
        tier = attrs.get('yard_slot_tier', getattr(self.instance, 'yard_slot_tier', None))

        code = (attrs.get('yard_slot_code') or '').strip().upper()
        if not code and block and row and bay and tier:
            code = f"{block.yard_block_code}-R{row:02d}-B{bay:02d}-T{tier:02d}"
        attrs['yard_slot_code'] = code

        if not code:
            raise serializers.ValidationError({'yard_slot_code': 'Slot code is required.'})

        # Check uniqueness within the block
        qs = YardSlot.objects.filter(yard_slot_block_id=block, yard_slot_code=code)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError({'yard_slot_code': f"A slot with code '{code}' already exists in this block."})

        # Validate slot occupancy integrity
        target_status = attrs.get('yard_slot_status')
        if target_status:
            if self.instance and self.instance.pk:
                has_active = YardAllocation.objects.filter(
                    yard_allocation_slot_id=self.instance,
                    yard_allocation_status='ACTIVE'
                ).exists()
                if has_active and target_status != 'OCCUPIED':
                    raise serializers.ValidationError({
                        'yard_slot_status': f"Cannot change status of Slot '{self.instance.yard_slot_code}' to {target_status} while an active container allocation exists. The container must be relocated or released first."
                    })
                if not has_active and target_status == 'OCCUPIED':
                    raise serializers.ValidationError({
                        'yard_slot_status': f"Cannot manually set Slot '{self.instance.yard_slot_code}' to OCCUPIED. Slots become OCCUPIED only via authorized container allocation or discharge operations."
                    })
            else:
                if target_status == 'OCCUPIED':
                    raise serializers.ValidationError({
                        'yard_slot_status': "Cannot create a new slot with initial status OCCUPIED without an active container allocation."
                    })

        return attrs


class YardBlockSerializer(serializers.ModelSerializer):
    yard_id = serializers.IntegerField(source='yard_block_yard_id.yard_id', read_only=True)
    yard_code = serializers.CharField(source='yard_block_yard_id.yard_code', read_only=True)
    yard_name = serializers.CharField(source='yard_block_yard_id.yard_name', read_only=True)
    yard_status = serializers.CharField(source='yard_block_yard_id.yard_status', read_only=True)
    yard_block_type_display = serializers.CharField(source='get_yard_block_type_display', read_only=True)
    yard_block_status_display = serializers.CharField(source='get_yard_block_status_display', read_only=True)
    available_capacity = serializers.IntegerField(read_only=True)
    occupancy_percentage = serializers.FloatField(read_only=True)
    is_operational = serializers.BooleanField(read_only=True)
    slots_count = serializers.SerializerMethodField()

    class Meta:
        model = YardBlock
        fields = [
            'yard_block_id',
            'yard_block_yard_id',
            'yard_id',
            'yard_code',
            'yard_name',
            'yard_status',
            'yard_block_name',
            'yard_block_code',
            'yard_block_type',
            'yard_block_type_display',
            'yard_block_status',
            'yard_block_status_display',
            'yard_block_capacity',
            'yard_block_occupied',
            'available_capacity',
            'occupancy_percentage',
            'is_operational',
            'slots_count',
            'yard_block_created_at',
            'yard_block_updated_at',
        ]

    def get_slots_count(self, obj) -> int:
        return obj.slots.count()


class YardBlockDetailSerializer(YardBlockSerializer):
    slots = YardSlotSerializer(many=True, read_only=True)

    class Meta(YardBlockSerializer.Meta):
        fields = YardBlockSerializer.Meta.fields + ['slots']


class YardBlockCreateUpdateSerializer(serializers.ModelSerializer):
    yard_block_code = serializers.CharField(required=True, max_length=50)
    yard_block_name = serializers.CharField(required=True, max_length=100)
    yard_block_capacity = serializers.IntegerField(required=True)
    yard_block_occupied = serializers.IntegerField(required=False, default=0)

    class Meta:
        model = YardBlock
        fields = [
            'yard_block_id',
            'yard_block_yard_id',
            'yard_block_name',
            'yard_block_code',
            'yard_block_type',
            'yard_block_status',
            'yard_block_capacity',
            'yard_block_occupied',
        ]
        validators = []

    def validate_yard_block_capacity(self, value):
        if value is None or value <= 0:
            raise serializers.ValidationError("Block capacity must be a positive integer greater than zero.")
        return value

    def validate_yard_block_occupied(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Occupied capacity cannot be negative.")
        return value

    def validate(self, attrs):
        yard = attrs.get('yard_block_yard_id') or (self.instance.yard_block_yard_id if self.instance else None)
        code = (attrs.get('yard_block_code') or getattr(self.instance, 'yard_block_code', '')).strip().upper()
        attrs['yard_block_code'] = code

        capacity = attrs.get('yard_block_capacity', getattr(self.instance, 'yard_block_capacity', 0))
        occupied = attrs.get('yard_block_occupied', getattr(self.instance, 'yard_block_occupied', 0))

        if capacity <= 0:
            raise serializers.ValidationError({'yard_block_capacity': 'Block capacity must be greater than zero.'})
        if occupied < 0:
            raise serializers.ValidationError({'yard_block_occupied': 'Occupied capacity cannot be negative.'})
        if occupied > capacity:
            raise serializers.ValidationError({'yard_block_occupied': f'Occupied capacity ({occupied}) cannot exceed total capacity ({capacity}).'})

        # Uniqueness of block code in yard
        qs = YardBlock.objects.filter(yard_block_yard_id=yard, yard_block_code__iexact=code)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError({'yard_block_code': f"A block with code '{code}' already exists in this yard."})

        return attrs


class YardSerializer(serializers.ModelSerializer):
    yard_type_display = serializers.CharField(source='get_yard_type_display', read_only=True)
    yard_status_display = serializers.CharField(source='get_yard_status_display', read_only=True)
    available_capacity = serializers.IntegerField(read_only=True)
    occupancy_percentage = serializers.FloatField(read_only=True)
    is_operational = serializers.BooleanField(read_only=True)
    blocks_count = serializers.SerializerMethodField()
    total_slots_count = serializers.SerializerMethodField()
    blocks = YardBlockSerializer(many=True, read_only=True)

    class Meta:
        model = Yard
        fields = [
            'yard_id',
            'yard_name',
            'yard_code',
            'yard_type',
            'yard_type_display',
            'yard_status',
            'yard_status_display',
            'yard_capacity',
            'yard_occupied',
            'available_capacity',
            'occupancy_percentage',
            'is_operational',
            'blocks_count',
            'total_slots_count',
            'blocks',
            'yard_created_at',
            'yard_updated_at',
        ]

    def get_blocks_count(self, obj) -> int:
        return obj.blocks.count()

    def get_total_slots_count(self, obj) -> int:
        return YardSlot.objects.filter(yard_slot_block_id__yard_block_yard_id=obj).count()


class YardDetailSerializer(YardSerializer):
    class Meta(YardSerializer.Meta):
        fields = YardSerializer.Meta.fields


class YardCreateUpdateSerializer(serializers.ModelSerializer):
    yard_name = serializers.CharField(required=True, max_length=100)
    yard_code = serializers.CharField(required=True, max_length=50)
    yard_type = serializers.CharField(required=True, max_length=50)
    yard_capacity = serializers.IntegerField(required=True)
    yard_occupied = serializers.IntegerField(required=False, default=0)

    class Meta:
        model = Yard
        fields = [
            'yard_id',
            'yard_name',
            'yard_code',
            'yard_type',
            'yard_status',
            'yard_capacity',
            'yard_occupied',
        ]

    def validate_yard_name(self, value):
        val = value.strip()
        if not val:
            raise serializers.ValidationError("Yard name is required.")
        return val

    def validate_yard_code(self, value):
        val = value.strip().upper()
        if not val:
            raise serializers.ValidationError("Yard code is required.")
        return val

    def validate_yard_type(self, value):
        valid_types = [t[0] for t in Yard.YARD_TYPE_CHOICES]
        if value not in valid_types:
            raise serializers.ValidationError(f"Invalid yard type. Choices are: {', '.join(valid_types)}")
        return value

    def validate_yard_capacity(self, value):
        if value is None or value <= 0:
            raise serializers.ValidationError("Yard capacity must be a positive integer greater than zero.")
        return value

    def validate_yard_occupied(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Occupied capacity cannot be negative.")
        return value

    def validate(self, attrs):
        code = (attrs.get('yard_code') or getattr(self.instance, 'yard_code', '')).strip().upper()
        attrs['yard_code'] = code

        capacity = attrs.get('yard_capacity', getattr(self.instance, 'yard_capacity', 0))
        occupied = attrs.get('yard_occupied', getattr(self.instance, 'yard_occupied', 0))

        if capacity <= 0:
            raise serializers.ValidationError({'yard_capacity': 'Yard capacity must be greater than zero.'})
        if occupied < 0:
            raise serializers.ValidationError({'yard_occupied': 'Occupied capacity cannot be negative.'})
        if occupied > capacity:
            raise serializers.ValidationError({'yard_occupied': f'Occupied capacity ({occupied}) cannot exceed total capacity ({capacity}).'})

        # Uniqueness of yard code
        qs = Yard.objects.filter(yard_code__iexact=code)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError({'yard_code': f"A yard with code '{code}' already exists."})

        return attrs


# ==============================================================================
# PHASE T2 — CONTAINER YARD ALLOCATION & STORAGE SERIALIZERS
# ==============================================================================

class PendingContainerSerializer(serializers.ModelSerializer):
    """
    Serializer for containers awaiting physical yard slot allocation.
    """
    container_type_display = serializers.CharField(source='get_container_type_display', read_only=True)
    container_status_display = serializers.CharField(source='get_container_status_display', read_only=True)
    teu_equivalent = serializers.FloatField(read_only=True)
    vessel_name = serializers.SerializerMethodField()
    vessel_imo_number = serializers.SerializerMethodField()
    arrival_request_id = serializers.SerializerMethodField()
    cargo_description = serializers.SerializerMethodField()
    customs_status_display = serializers.SerializerMethodField()
    has_active_allocation = serializers.SerializerMethodField()
    allocation_status = serializers.SerializerMethodField()

    class Meta:
        model = Container
        fields = [
            'container_id',
            'container_number',
            'container_type',
            'container_type_display',
            'container_gross_weight',
            'teu_equivalent',
            'container_status',
            'container_status_display',
            'vessel_name',
            'vessel_imo_number',
            'arrival_request_id',
            'cargo_description',
            'customs_status_display',
            'has_active_allocation',
            'allocation_status',
            'container_created_at',
        ]

    def get_vessel_name(self, obj):
        v = obj.vessel
        return v.vessel_name if v else 'Unknown Vessel'

    def get_vessel_imo_number(self, obj):
        v = obj.vessel
        return v.vessel_imo_number if v else ''

    def get_arrival_request_id(self, obj):
        req = obj.arrival_request
        return req.vessel_arrival_request_id if req else None

    def get_cargo_description(self, obj):
        return obj.container_cargo_id.cargo_description if obj.container_cargo_id else ''

    def get_customs_status_display(self, obj):
        insp = obj.latest_customs_inspection
        return insp.get_customs_inspection_status_display() if insp else 'Not Inspected'

    def get_has_active_allocation(self, obj):
        return obj.active_yard_allocation is not None

    def get_allocation_status(self, obj):
        return 'ALLOCATED' if obj.active_yard_allocation else 'UNALLOCATED'


class AvailableSlotSerializer(serializers.ModelSerializer):
    """
    Serializer for operational, available storage slots within active blocks/yards.
    """
    slot_id = serializers.IntegerField(source='yard_slot_id', read_only=True)
    slot_code = serializers.CharField(source='yard_slot_code', read_only=True)
    slot_row = serializers.IntegerField(source='yard_slot_row', read_only=True)
    slot_bay = serializers.IntegerField(source='yard_slot_bay', read_only=True)
    slot_tier = serializers.IntegerField(source='yard_slot_tier', read_only=True)
    slot_status = serializers.CharField(source='yard_slot_status', read_only=True)
    slot_status_display = serializers.CharField(source='get_yard_slot_status_display', read_only=True)
    yard_slot_id = serializers.IntegerField(read_only=True)
    yard_slot_code = serializers.CharField(read_only=True)
    yard_slot_row = serializers.IntegerField(read_only=True)
    yard_slot_bay = serializers.IntegerField(read_only=True)
    yard_slot_tier = serializers.IntegerField(read_only=True)
    yard_slot_status = serializers.CharField(read_only=True)
    block_id = serializers.IntegerField(source='yard_slot_block_id.yard_block_id', read_only=True)
    block_code = serializers.CharField(source='yard_slot_block_id.yard_block_code', read_only=True)
    block_name = serializers.CharField(source='yard_slot_block_id.yard_block_name', read_only=True)
    block_type = serializers.CharField(source='yard_slot_block_id.yard_block_type', read_only=True)
    yard_id = serializers.IntegerField(source='yard_slot_block_id.yard_block_yard_id.yard_id', read_only=True)
    yard_code = serializers.CharField(source='yard_slot_block_id.yard_block_yard_id.yard_code', read_only=True)
    yard_name = serializers.CharField(source='yard_slot_block_id.yard_block_yard_id.yard_name', read_only=True)
    location_display = serializers.SerializerMethodField()

    class Meta:
        model = YardSlot
        fields = [
            'slot_id',
            'slot_code',
            'slot_row',
            'slot_bay',
            'slot_tier',
            'slot_status',
            'slot_status_display',
            'yard_slot_id',
            'yard_slot_code',
            'yard_slot_row',
            'yard_slot_bay',
            'yard_slot_tier',
            'yard_slot_status',
            'block_id',
            'block_code',
            'block_name',
            'block_type',
            'yard_id',
            'yard_code',
            'yard_name',
            'location_display',
        ]

    def get_location_display(self, obj):
        block = obj.yard_slot_block_id
        yard = block.yard_block_yard_id
        return f"{yard.yard_code} / {block.yard_block_code} / {obj.yard_slot_code}"


class YardAllocationSerializer(serializers.ModelSerializer):
    """
    Serializer for detailed Yard Allocation records (Active & Historical).
    """
    container_id = serializers.IntegerField(source='yard_allocation_container_id.container_id', read_only=True)
    container_number = serializers.CharField(source='yard_allocation_container_id.container_number', read_only=True)
    container_type = serializers.CharField(source='yard_allocation_container_id.container_type', read_only=True)
    container_type_display = serializers.CharField(source='yard_allocation_container_id.get_container_type_display', read_only=True)
    container_gross_weight = serializers.DecimalField(source='yard_allocation_container_id.container_gross_weight', max_digits=10, decimal_places=2, read_only=True)
    container_status = serializers.CharField(source='yard_allocation_container_id.container_status', read_only=True)
    container_status_display = serializers.CharField(source='yard_allocation_container_id.get_container_status_display', read_only=True)
    vessel_name = serializers.SerializerMethodField()
    slot_id = serializers.IntegerField(source='yard_allocation_slot_id.yard_slot_id', read_only=True)
    slot_code = serializers.CharField(source='yard_allocation_slot_id.yard_slot_code', read_only=True)
    slot_row = serializers.IntegerField(source='yard_allocation_slot_id.yard_slot_row', read_only=True)
    slot_bay = serializers.IntegerField(source='yard_allocation_slot_id.yard_slot_bay', read_only=True)
    slot_tier = serializers.IntegerField(source='yard_allocation_slot_id.yard_slot_tier', read_only=True)
    yard_slot_code = serializers.CharField(source='yard_allocation_slot_id.yard_slot_code', read_only=True)
    block_id = serializers.IntegerField(source='yard_allocation_slot_id.yard_slot_block_id.yard_block_id', read_only=True)
    block_code = serializers.CharField(source='yard_allocation_slot_id.yard_slot_block_id.yard_block_code', read_only=True)
    block_name = serializers.CharField(source='yard_allocation_slot_id.yard_slot_block_id.yard_block_name', read_only=True)
    yard_id = serializers.IntegerField(source='yard_allocation_slot_id.yard_slot_block_id.yard_block_yard_id.yard_id', read_only=True)
    yard_code = serializers.CharField(source='yard_allocation_slot_id.yard_slot_block_id.yard_block_yard_id.yard_code', read_only=True)
    yard_name = serializers.CharField(source='yard_allocation_slot_id.yard_slot_block_id.yard_block_yard_id.yard_name', read_only=True)
    location_display = serializers.CharField(read_only=True)
    current_location = serializers.CharField(source='location_display', read_only=True)
    allocated_by_name = serializers.SerializerMethodField()
    released_by_name = serializers.SerializerMethodField()
    remarks = serializers.CharField(source='yard_allocation_remarks', read_only=True)

    class Meta:
        model = YardAllocation
        fields = [
            'yard_allocation_id',
            'container_id',
            'container_number',
            'container_type',
            'container_type_display',
            'container_gross_weight',
            'container_status',
            'container_status_display',
            'vessel_name',
            'yard_id',
            'yard_code',
            'yard_name',
            'block_id',
            'block_code',
            'block_name',
            'slot_id',
            'slot_code',
            'slot_row',
            'slot_bay',
            'slot_tier',
            'yard_slot_code',
            'location_display',
            'current_location',
            'yard_allocation_status',
            'yard_allocation_allocated_at',
            'allocated_by_name',
            'yard_allocation_released_at',
            'released_by_name',
            'yard_allocation_remarks',
            'remarks',
            'yard_allocation_created_at',
            'yard_allocation_updated_at',
        ]

    def get_vessel_name(self, obj):
        c = obj.yard_allocation_container_id
        return c.vessel.vessel_name if (c and c.vessel) else 'Unknown Vessel'

    def get_allocated_by_name(self, obj):
        u = obj.yard_allocation_allocated_by_id
        return u.user_full_name if u else 'Terminal Operator'

    def get_released_by_name(self, obj):
        u = obj.yard_allocation_released_by_id
        return u.user_full_name if u else None


class YardAllocationCreateSerializer(serializers.Serializer):
    """
    Serializer for creating a new atomic Container Yard Allocation.
    """
    container_id = serializers.IntegerField(required=True)
    slot_id = serializers.IntegerField(required=True)
    remarks = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_container_id(self, value):
        try:
            container = Container.objects.get(pk=value)
        except Container.DoesNotExist:
            raise serializers.ValidationError(f"Container #{value} does not exist.")

        if container.container_status == 'RELEASED':
            raise serializers.ValidationError(f"Container {container.container_number} is already RELEASED and cannot be allocated to the yard.")

        if container.container_delivery_status in ['PICKED_UP', 'DEPARTED_PORT', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED']:
            raise serializers.ValidationError(f"Container {container.container_number} has already departed the port ({container.container_delivery_status}).")

        if container.active_yard_allocation:
            active_loc = container.active_yard_allocation.location_display
            raise serializers.ValidationError(f"Container {container.container_number} already has an active yard allocation at {active_loc}.")

        return value

    def validate_slot_id(self, value):
        try:
            slot = YardSlot.objects.select_related('yard_slot_block_id__yard_block_yard_id').get(pk=value)
        except YardSlot.DoesNotExist:
            raise serializers.ValidationError(f"Yard slot #{value} does not exist.")

        yard = slot.yard_slot_block_id.yard_block_yard_id
        block = slot.yard_slot_block_id

        if yard.yard_status != 'ACTIVE':
            raise serializers.ValidationError(f"Yard '{yard.yard_name}' ({yard.yard_code}) is INACTIVE. Cannot allocate to an inactive yard.")

        if block.yard_block_status != 'ACTIVE':
            raise serializers.ValidationError(f"Block '{block.yard_block_name}' ({block.yard_block_code}) is INACTIVE. Cannot allocate to an inactive block.")

        if slot.yard_slot_status != 'AVAILABLE':
            raise serializers.ValidationError(f"Slot '{slot.yard_slot_code}' is currently '{slot.get_yard_slot_status_display()}' and is not available for allocation.")

        if block.yard_block_occupied >= block.yard_block_capacity:
            raise serializers.ValidationError(f"Block '{block.yard_block_code}' capacity limit ({block.yard_block_capacity}) reached.")

        if yard.yard_occupied >= yard.yard_capacity:
            raise serializers.ValidationError(f"Yard '{yard.yard_code}' capacity limit ({yard.yard_capacity}) reached.")

        return value


class YardAllocationReleaseSerializer(serializers.Serializer):
    """
    Serializer for releasing an active Container Yard Allocation.
    """
    remarks = serializers.CharField(required=False, allow_blank=True, default='')


# ==============================================================================
# PHASE T3 — YARD OPERATIONS MANAGEMENT SERIALIZERS
# ==============================================================================

class YardMovementHistorySerializer(serializers.ModelSerializer):
    """
    Serializer for Yard Movement History records (Phase T3).
    Provides complete traceability of previous and new yard, block, slot,
    operator, and movement timestamps.
    """
    container_id = serializers.IntegerField(source='yard_movement_container_id.container_id', read_only=True)
    container_number = serializers.CharField(source='yard_movement_container_id.container_number', read_only=True)
    container_type = serializers.CharField(source='yard_movement_container_id.container_type', read_only=True)
    container_type_display = serializers.CharField(source='yard_movement_container_id.get_container_type_display', read_only=True)
    
    from_slot_id = serializers.SerializerMethodField()
    from_slot_code = serializers.SerializerMethodField()
    from_slot_row = serializers.SerializerMethodField()
    from_slot_bay = serializers.SerializerMethodField()
    from_slot_tier = serializers.SerializerMethodField()
    from_block_id = serializers.SerializerMethodField()
    from_block_code = serializers.SerializerMethodField()
    from_block_name = serializers.SerializerMethodField()
    from_yard_id = serializers.SerializerMethodField()
    from_yard_code = serializers.SerializerMethodField()
    from_yard_name = serializers.SerializerMethodField()
    from_location_display = serializers.CharField(read_only=True)

    to_slot_id = serializers.SerializerMethodField()
    to_slot_code = serializers.SerializerMethodField()
    to_slot_row = serializers.SerializerMethodField()
    to_slot_bay = serializers.SerializerMethodField()
    to_slot_tier = serializers.SerializerMethodField()
    to_block_id = serializers.SerializerMethodField()
    to_block_code = serializers.SerializerMethodField()
    to_block_name = serializers.SerializerMethodField()
    to_yard_id = serializers.SerializerMethodField()
    to_yard_code = serializers.SerializerMethodField()
    to_yard_name = serializers.SerializerMethodField()
    to_location_display = serializers.CharField(read_only=True)

    movement_type = serializers.CharField(source='yard_movement_movement_type', read_only=True)
    movement_type_display = serializers.CharField(source='get_yard_movement_movement_type_display', read_only=True)
    crane_id = serializers.SerializerMethodField()
    crane_code = serializers.SerializerMethodField()
    crane_name = serializers.SerializerMethodField()
    crane_type = serializers.SerializerMethodField()
    crane_type_display = serializers.SerializerMethodField()

    moved_by_id = serializers.SerializerMethodField()
    moved_by_name = serializers.SerializerMethodField()
    movement_timestamp = serializers.DateTimeField(source='yard_movement_timestamp', read_only=True)
    remarks = serializers.CharField(source='yard_movement_remarks', read_only=True)

    class Meta:
        model = YardMovementHistory
        fields = [
            'yard_movement_id',
            'container_id',
            'container_number',
            'container_type',
            'container_type_display',
            'movement_type',
            'movement_type_display',
            'crane_id',
            'crane_code',
            'crane_name',
            'crane_type',
            'crane_type_display',
            'from_slot_id',
            'from_slot_code',
            'from_slot_row',
            'from_slot_bay',
            'from_slot_tier',
            'from_block_id',
            'from_block_code',
            'from_block_name',
            'from_yard_id',
            'from_yard_code',
            'from_yard_name',
            'from_location_display',
            'to_slot_id',
            'to_slot_code',
            'to_slot_row',
            'to_slot_bay',
            'to_slot_tier',
            'to_block_id',
            'to_block_code',
            'to_block_name',
            'to_yard_id',
            'to_yard_code',
            'to_yard_name',
            'to_location_display',
            'moved_by_id',
            'moved_by_name',
            'movement_timestamp',
            'remarks',
            'yard_movement_created_at'
        ]

    def get_from_slot_id(self, obj):
        return obj.from_slot.yard_slot_id if obj.from_slot else None

    def get_from_slot_code(self, obj):
        return obj.from_slot.yard_slot_code if obj.from_slot else None

    def get_from_slot_row(self, obj):
        return obj.from_slot.yard_slot_row if obj.from_slot else None

    def get_from_slot_bay(self, obj):
        return obj.from_slot.yard_slot_bay if obj.from_slot else None

    def get_from_slot_tier(self, obj):
        return obj.from_slot.yard_slot_tier if obj.from_slot else None

    def get_from_block_id(self, obj):
        return obj.from_slot.yard_slot_block_id.yard_block_id if (obj.from_slot and obj.from_slot.yard_slot_block_id) else None

    def get_from_block_code(self, obj):
        return obj.from_slot.yard_slot_block_id.yard_block_code if (obj.from_slot and obj.from_slot.yard_slot_block_id) else None

    def get_from_block_name(self, obj):
        return obj.from_slot.yard_slot_block_id.yard_block_name if (obj.from_slot and obj.from_slot.yard_slot_block_id) else None

    def get_from_yard_id(self, obj):
        if obj.from_slot and obj.from_slot.yard_slot_block_id and obj.from_slot.yard_slot_block_id.yard_block_yard_id:
            return obj.from_slot.yard_slot_block_id.yard_block_yard_id.yard_id
        return None

    def get_from_yard_code(self, obj):
        if obj.from_slot and obj.from_slot.yard_slot_block_id and obj.from_slot.yard_slot_block_id.yard_block_yard_id:
            return obj.from_slot.yard_slot_block_id.yard_block_yard_id.yard_code
        return None

    def get_from_yard_name(self, obj):
        if obj.from_slot and obj.from_slot.yard_slot_block_id and obj.from_slot.yard_slot_block_id.yard_block_yard_id:
            return obj.from_slot.yard_slot_block_id.yard_block_yard_id.yard_name
        return None

    def get_to_slot_id(self, obj):
        return obj.to_slot.yard_slot_id if obj.to_slot else None

    def get_to_slot_code(self, obj):
        return obj.to_slot.yard_slot_code if obj.to_slot else None

    def get_to_slot_row(self, obj):
        return obj.to_slot.yard_slot_row if obj.to_slot else None

    def get_to_slot_bay(self, obj):
        return obj.to_slot.yard_slot_bay if obj.to_slot else None

    def get_to_slot_tier(self, obj):
        return obj.to_slot.yard_slot_tier if obj.to_slot else None

    def get_to_block_id(self, obj):
        return obj.to_slot.yard_slot_block_id.yard_block_id if (obj.to_slot and obj.to_slot.yard_slot_block_id) else None

    def get_to_block_code(self, obj):
        return obj.to_slot.yard_slot_block_id.yard_block_code if (obj.to_slot and obj.to_slot.yard_slot_block_id) else None

    def get_to_block_name(self, obj):
        return obj.to_slot.yard_slot_block_id.yard_block_name if (obj.to_slot and obj.to_slot.yard_slot_block_id) else None

    def get_to_yard_id(self, obj):
        if obj.to_slot and obj.to_slot.yard_slot_block_id and obj.to_slot.yard_slot_block_id.yard_block_yard_id:
            return obj.to_slot.yard_slot_block_id.yard_block_yard_id.yard_id
        return None

    def get_to_yard_code(self, obj):
        if obj.to_slot and obj.to_slot.yard_slot_block_id and obj.to_slot.yard_slot_block_id.yard_block_yard_id:
            return obj.to_slot.yard_slot_block_id.yard_block_yard_id.yard_code
        return None

    def get_to_yard_name(self, obj):
        if obj.to_slot and obj.to_slot.yard_slot_block_id and obj.to_slot.yard_slot_block_id.yard_block_yard_id:
            return obj.to_slot.yard_slot_block_id.yard_block_yard_id.yard_name
        return None

    def get_crane_id(self, obj):
        return obj.crane.crane_id if obj.crane else None

    def get_crane_code(self, obj):
        return obj.crane.crane_code if obj.crane else None

    def get_crane_name(self, obj):
        return obj.crane.crane_name if obj.crane else None

    def get_crane_type(self, obj):
        return obj.crane.crane_type if obj.crane else None

    def get_crane_type_display(self, obj):
        return obj.crane.get_crane_type_display() if obj.crane else None

    def get_moved_by_id(self, obj):
        return obj.yard_movement_moved_by_id.user_id if obj.yard_movement_moved_by_id else None

    def get_moved_by_name(self, obj):
        if obj.yard_movement_moved_by_id:
            return obj.yard_movement_moved_by_id.user_full_name
        return "Terminal Operator"


class ContainerRelocationSerializer(serializers.Serializer):
    """
    Serializer to validate incoming container relocation request (Phase T3/T4 Integration).
    Requires container_id and destination_slot_id, with optional crane_id for handling equipment.
    """
    container_id = serializers.IntegerField(required=True)
    destination_slot_id = serializers.IntegerField(required=True)
    crane_id = serializers.IntegerField(required=False, allow_null=True, default=None)
    remarks = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_container_id(self, value):
        try:
            container = Container.objects.get(pk=value)
        except Container.DoesNotExist:
            raise serializers.ValidationError(f"Container #{value} not found.")
        return value

    def validate_destination_slot_id(self, value):
        try:
            slot = YardSlot.objects.select_related('yard_slot_block_id__yard_block_yard_id').get(pk=value)
        except YardSlot.DoesNotExist:
            raise serializers.ValidationError(f"Destination slot #{value} not found.")
        return value

    def validate_crane_id(self, value):
        if value in [None, '', 0]:
            return None
        try:
            crane = Crane.objects.get(pk=value)
        except Crane.DoesNotExist:
            raise serializers.ValidationError(f"Handling equipment #{value} not found.")

        if not crane.crane_is_active:
            raise serializers.ValidationError(f"Equipment '{crane.crane_code}' is deactivated/archived.")

        if crane.crane_status in ['MAINTENANCE', 'INACTIVE']:
            raise serializers.ValidationError(
                f"Equipment '{crane.crane_code}' is currently in {crane.get_crane_status_display()} status and cannot be used for relocation."
            )

        # Only suitable yard handling equipment (RTG, RMG, MHC) allowed for yard relocation.
        # STS (Ship-to-Shore Quay Crane) is quayside only and cannot be used for yard relocation.
        if crane.crane_type == 'STS':
            raise serializers.ValidationError(
                f"STS Crane '{crane.crane_code}' is a Ship-to-Shore Quay Crane and cannot be used for yard relocation operations. "
                f"Please select suitable yard equipment (RTG, RMG, or MHC)."
            )

        if crane.crane_type not in ['RTG', 'RMG', 'MHC']:
            raise serializers.ValidationError(
                f"Equipment '{crane.crane_code}' of type '{crane.get_crane_type_display()}' is not suitable for yard relocation operations."
            )

        if crane.allocations.filter(crane_allocation_status='ACTIVE').exists():
            raise serializers.ValidationError(
                f"Equipment '{crane.crane_code}' is currently actively allocated to a vessel operation and unavailable for yard relocation."
            )

        if crane.crane_status == 'IN_USE':
            raise serializers.ValidationError(
                f"Equipment '{crane.crane_code}' is currently IN_USE and unavailable for relocation."
            )

        return value


class YardOperationContainerItemSerializer(serializers.ModelSerializer):
    """
    Serializer for container inventory & location status in Yard Operations (Phase T3).
    """
    storage_status = serializers.CharField(read_only=True)
    storage_status_display = serializers.CharField(read_only=True)
    current_location = serializers.SerializerMethodField()
    vessel_name = serializers.SerializerMethodField()
    cargo_description = serializers.SerializerMethodField()
    movement_count = serializers.SerializerMethodField()
    last_relocated_at = serializers.SerializerMethodField()

    class Meta:
        model = Container
        fields = [
            'container_id',
            'container_number',
            'container_type',
            'container_gross_weight',
            'container_status',
            'container_delivery_status',
            'storage_status',
            'storage_status_display',
            'current_location',
            'vessel_name',
            'cargo_description',
            'movement_count',
            'last_relocated_at',
            'container_created_at',
            'container_updated_at'
        ]

    def get_current_location(self, obj):
        return obj.current_yard_location

    def get_vessel_name(self, obj):
        vessel = obj.vessel
        return vessel.vessel_name if vessel else 'Unknown Vessel'

    def get_cargo_description(self, obj):
        return obj.cargo.cargo_description if obj.cargo else ''

    def get_movement_count(self, obj):
        return obj.yard_movements.count()

    def get_last_relocated_at(self, obj):
        last_move = obj.latest_yard_movement
        return last_move.yard_movement_timestamp.isoformat() if last_move else None


# ==============================================================================
# PHASE T4 — CRANE MANAGEMENT & ALLOCATION SERIALIZERS
# ==============================================================================

class CraneSerializer(serializers.ModelSerializer):
    """
    Serializer for Crane Master Management (Phase T4.1).
    Handles CRUD operations, unique code enforcement, capacity validation,
    and operational status rules.
    """
    crane_type_display = serializers.CharField(source='get_crane_type_display', read_only=True)
    crane_status_display = serializers.CharField(source='get_crane_status_display', read_only=True)
    assigned_berth_name = serializers.SerializerMethodField()
    assigned_berth_code = serializers.SerializerMethodField()
    is_operational = serializers.BooleanField(read_only=True)
    active_allocations_count = serializers.SerializerMethodField()
    current_active_allocation = serializers.SerializerMethodField()

    class Meta:
        model = Crane
        fields = [
            'crane_id',
            'crane_code',
            'crane_name',
            'crane_type',
            'crane_type_display',
            'crane_max_lifting_capacity_mt',
            'crane_capacity_unit',
            'crane_status',
            'crane_status_display',
            'crane_assigned_berth_id',
            'assigned_berth_name',
            'assigned_berth_code',
            'crane_last_maintenance_date',
            'crane_next_maintenance_due',
            'crane_maintenance_remarks',
            'crane_is_active',
            'is_operational',
            'active_allocations_count',
            'current_active_allocation',
            'crane_created_at',
            'crane_updated_at'
        ]
        read_only_fields = ['crane_id', 'crane_created_at', 'crane_updated_at']

    def get_assigned_berth_name(self, obj):
        return obj.crane_assigned_berth_id.berth_name if obj.crane_assigned_berth_id else None

    def get_assigned_berth_code(self, obj):
        return obj.crane_assigned_berth_id.berth_code if obj.crane_assigned_berth_id else None

    def get_active_allocations_count(self, obj):
        return obj.allocations.filter(crane_allocation_status='ACTIVE').count()

    def get_current_active_allocation(self, obj):
        alloc = obj.allocations.filter(crane_allocation_status='ACTIVE').first()
        if not alloc:
            return None
        vessel = None
        if alloc.crane_allocation_vessel_schedule_id and alloc.crane_allocation_vessel_schedule_id.vessel_schedule_arrival_request_id:
            vessel = alloc.crane_allocation_vessel_schedule_id.vessel_schedule_arrival_request_id.vessel_arrival_request_vessel_id
        return {
            'crane_allocation_id': alloc.crane_allocation_id,
            'vessel_schedule_id': alloc.crane_allocation_vessel_schedule_id_id,
            'vessel_name': vessel.vessel_name if vessel else 'Unknown',
            'operation_type': alloc.crane_allocation_operation_type,
            'planned_start_at': alloc.crane_allocation_planned_start_at,
            'planned_end_at': alloc.crane_allocation_planned_end_at,
            'actual_start_at': alloc.crane_allocation_actual_start_at,
        }

    def validate_crane_code(self, value):
        code = str(value).strip().upper()
        if not code:
            raise serializers.ValidationError("Crane code cannot be empty.")
        # Check uniqueness ignoring current instance
        query = Crane.objects.filter(crane_code__iexact=code)
        if self.instance:
            query = query.exclude(pk=self.instance.pk)
        if query.exists():
            raise serializers.ValidationError(f"Crane code '{code}' already exists.")
        return code

    def validate_crane_name(self, value):
        name = str(value).strip()
        if not name:
            raise serializers.ValidationError("Crane name cannot be empty.")
        return name

    def validate_crane_max_lifting_capacity_mt(self, value):
        try:
            val = float(value)
            if val <= 0:
                raise serializers.ValidationError("Maximum lifting capacity must be greater than zero.")
        except (ValueError, TypeError):
            raise serializers.ValidationError("Maximum lifting capacity must be a valid number.")
        return value

    def validate(self, attrs):
        new_status = attrs.get('crane_status')
        if self.instance and new_status:
            has_active = self.instance.allocations.filter(crane_allocation_status='ACTIVE').exists()
            if has_active:
                if new_status == 'AVAILABLE':
                    raise serializers.ValidationError({
                        'crane_status': "Cannot set crane status to AVAILABLE while it has an active allocation in progress."
                    })
                if new_status in ['MAINTENANCE', 'INACTIVE']:
                    raise serializers.ValidationError({
                        'crane_status': f"Cannot set crane to {new_status} while an allocation is actively in progress. Complete or cancel the active allocation first."
                    })

        last_maint = attrs.get('crane_last_maintenance_date')
        next_maint = attrs.get('crane_next_maintenance_due')
        if last_maint and next_maint and next_maint < last_maint:
            raise serializers.ValidationError({
                'crane_next_maintenance_due': "Next maintenance due date cannot be prior to the last maintenance date."
            })

        return attrs


class CraneAllocationSerializer(serializers.ModelSerializer):
    """
    Serializer for Crane Allocation & Assignment (Phase T4.2).
    Validates eligible vessel schedule, operational crane status,
    non-overlapping time windows, and state transitions.
    """
    crane_code = serializers.CharField(source='crane_allocation_crane_id.crane_code', read_only=True)
    crane_name = serializers.CharField(source='crane_allocation_crane_id.crane_name', read_only=True)
    crane_type = serializers.CharField(source='crane_allocation_crane_id.crane_type', read_only=True)
    crane_type_display = serializers.CharField(source='crane_allocation_crane_id.get_crane_type_display', read_only=True)
    operation_type_display = serializers.CharField(source='get_crane_allocation_operation_type_display', read_only=True)
    allocation_status_display = serializers.CharField(source='get_crane_allocation_status_display', read_only=True)
    vessel_name = serializers.SerializerMethodField()
    vessel_imo = serializers.SerializerMethodField()
    berth_name = serializers.SerializerMethodField()
    berth_code = serializers.SerializerMethodField()
    assigned_by_name = serializers.SerializerMethodField()

    class Meta:
        model = CraneAllocation
        fields = [
            'crane_allocation_id',
            'crane_allocation_crane_id',
            'crane_code',
            'crane_name',
            'crane_type',
            'crane_type_display',
            'crane_allocation_vessel_schedule_id',
            'vessel_name',
            'vessel_imo',
            'crane_allocation_berth_id',
            'berth_name',
            'berth_code',
            'crane_allocation_operation_type',
            'operation_type_display',
            'crane_allocation_status',
            'allocation_status_display',
            'crane_allocation_planned_start_at',
            'crane_allocation_planned_end_at',
            'crane_allocation_actual_start_at',
            'crane_allocation_actual_end_at',
            'crane_allocation_assigned_by_id',
            'assigned_by_name',
            'crane_allocation_remarks',
            'crane_allocation_created_at',
            'crane_allocation_updated_at'
        ]
        read_only_fields = [
            'crane_allocation_id',
            'crane_allocation_actual_start_at',
            'crane_allocation_actual_end_at',
            'crane_allocation_created_at',
            'crane_allocation_updated_at'
        ]

    def get_vessel_name(self, obj):
        try:
            sch = obj.crane_allocation_vessel_schedule_id
            if sch and sch.vessel_schedule_arrival_request_id:
                v = sch.vessel_schedule_arrival_request_id.vessel_arrival_request_vessel_id
                return v.vessel_name if v else 'Unknown Vessel'
        except Exception:
            pass
        return 'Unknown Vessel'

    def get_vessel_imo(self, obj):
        try:
            sch = obj.crane_allocation_vessel_schedule_id
            if sch and sch.vessel_schedule_arrival_request_id:
                v = sch.vessel_schedule_arrival_request_id.vessel_arrival_request_vessel_id
                return v.vessel_imo_number if v else ''
        except Exception:
            pass
        return ''

    def get_berth_name(self, obj):
        if obj.crane_allocation_berth_id:
            return obj.crane_allocation_berth_id.berth_name
        if obj.crane_allocation_vessel_schedule_id and obj.crane_allocation_vessel_schedule_id.vessel_schedule_berth_id:
            return obj.crane_allocation_vessel_schedule_id.vessel_schedule_berth_id.berth_name
        return 'Not Assigned'

    def get_berth_code(self, obj):
        if obj.crane_allocation_berth_id:
            return obj.crane_allocation_berth_id.berth_code
        if obj.crane_allocation_vessel_schedule_id and obj.crane_allocation_vessel_schedule_id.vessel_schedule_berth_id:
            return obj.crane_allocation_vessel_schedule_id.vessel_schedule_berth_id.berth_code
        return None

    def get_assigned_by_name(self, obj):
        if obj.crane_allocation_assigned_by_id:
            user = obj.crane_allocation_assigned_by_id
            return getattr(user, 'user_full_name', '') or (user.login_id.login_email if user.login_id else 'Operator')
        return 'System Operator'

    def validate(self, attrs):
        crane = attrs.get('crane_allocation_crane_id') or (self.instance.crane_allocation_crane_id if self.instance else None)
        schedule = attrs.get('crane_allocation_vessel_schedule_id') or (self.instance.crane_allocation_vessel_schedule_id if self.instance else None)
        planned_start = attrs.get('crane_allocation_planned_start_at') or (self.instance.crane_allocation_planned_start_at if self.instance else None)
        planned_end = attrs.get('crane_allocation_planned_end_at') or (self.instance.crane_allocation_planned_end_at if self.instance else None)

        if not crane:
            raise serializers.ValidationError({'crane_allocation_crane_id': "Crane is required."})

        # Validate Crane operational status
        if not crane.crane_is_active:
            raise serializers.ValidationError({'crane_allocation_crane_id': f"Crane '{crane.crane_code}' is deactivated/archived."})

        if crane.crane_status in ['MAINTENANCE', 'INACTIVE']:
            raise serializers.ValidationError({
                'crane_allocation_crane_id': f"Crane '{crane.crane_code}' is currently in {crane.get_crane_status_display()} status and cannot be allocated."
            })

        # Validate Crane type suitability for vessel/berth operations:
        # Only suitable quayside crane types, initially STS and MHC, are allowed.
        # RTG and RMG are yard gantry cranes and must be rejected.
        if crane.crane_type in ['RTG', 'RMG']:
            raise serializers.ValidationError({
                'crane_allocation_crane_id': (
                    f"Incompatible crane type '{crane.get_crane_type_display()}'. "
                    f"Yard gantry cranes (RTG and RMG) cannot be allocated to vessel schedules. "
                    f"Only quayside cranes (STS and MHC) are permitted for vessel operations."
                )
            })

        if crane.crane_type not in ['STS', 'MHC']:
            raise serializers.ValidationError({
                'crane_allocation_crane_id': (
                    f"Incompatible crane type '{crane.get_crane_type_display()}'. "
                    f"Only quayside cranes (STS and MHC) can be allocated to vessel schedules."
                )
            })

        if not schedule:
            raise serializers.ValidationError({'crane_allocation_vessel_schedule_id': "Vessel schedule is required."})

        # Validate Vessel Schedule eligibility
        if schedule.vessel_schedule_status == 'DEPARTED':
            raise serializers.ValidationError({
                'crane_allocation_vessel_schedule_id': "Vessel schedule has already departed and is not eligible for crane allocation."
            })

        # Berth association check
        if not schedule.vessel_schedule_berth_id:
            raise serializers.ValidationError({
                'crane_allocation_vessel_schedule_id': "Selected vessel schedule does not have an assigned berth."
            })

        # Berth compatibility check:
        # For STS cranes with a fixed assigned berth, validate that the assigned berth matches the vessel schedule's actual berth.
        # Mobile Harbour Cranes (MHC) are mobile and do not have this fixed-berth restriction unless required.
        if crane.crane_type == 'STS' and crane.crane_assigned_berth_id:
            schedule_berth = schedule.vessel_schedule_berth_id
            if schedule_berth and crane.crane_assigned_berth_id_id != schedule_berth.berth_id:
                raise serializers.ValidationError({
                    'crane_allocation_crane_id': (
                        f"Berth mismatch: STS Crane '{crane.crane_code}' is fixed to berth "
                        f"'{crane.crane_assigned_berth_id.berth_name}' ({crane.crane_assigned_berth_id.berth_code or 'N/A'}), "
                        f"which does not match vessel schedule berth "
                        f"'{schedule_berth.berth_name}' ({schedule_berth.berth_code or 'N/A'})."
                    )
                })

        # Auto-assign berth from vessel schedule if not explicitly provided
        if not attrs.get('crane_allocation_berth_id'):
            attrs['crane_allocation_berth_id'] = schedule.vessel_schedule_berth_id
        elif attrs.get('crane_allocation_berth_id') != schedule.vessel_schedule_berth_id:
            raise serializers.ValidationError({
                'crane_allocation_berth_id': "Specified berth does not match the vessel schedule's berth."
            })

        # Validate time interval
        if not planned_start or not planned_end:
            raise serializers.ValidationError("Planned start time and planned end time are both required.")

        if planned_end <= planned_start:
            raise serializers.ValidationError({
                'crane_allocation_planned_end_at': "Planned end time must be strictly after planned start time."
            })

        # Overlap conflict validation for this crane
        # Overlapping allocations are those with status SCHEDULED or ACTIVE
        # where start < existing_end and end > existing_start
        conflict_query = CraneAllocation.objects.filter(
            crane_allocation_crane_id=crane,
            crane_allocation_status__in=['SCHEDULED', 'ACTIVE'],
            crane_allocation_planned_start_at__lt=planned_end,
            crane_allocation_planned_end_at__gt=planned_start
        )
        if self.instance:
            conflict_query = conflict_query.exclude(pk=self.instance.pk)

        conflicting = conflict_query.first()
        if conflicting:
            conf_start = conflicting.crane_allocation_planned_start_at.strftime('%Y-%m-%d %H:%M')
            conf_end = conflicting.crane_allocation_planned_end_at.strftime('%Y-%m-%d %H:%M')
            raise serializers.ValidationError({
                'non_field_errors': [
                    f"Conflict: Crane '{crane.crane_code}' already has a {conflicting.get_crane_allocation_status_display().lower()} "
                    f"allocation (#{conflicting.crane_allocation_id}) scheduled from {conf_start} to {conf_end}."
                ]
            })

        return attrs


class EligibleVesselScheduleSerializer(serializers.ModelSerializer):
    """
    Serializer to list vessel schedules eligible for crane allocation (Phase T4).
    """
    vessel_name = serializers.CharField(source='vessel_schedule_arrival_request_id.vessel_arrival_request_vessel_id.vessel_name', read_only=True)
    vessel_imo = serializers.CharField(source='vessel_schedule_arrival_request_id.vessel_arrival_request_vessel_id.vessel_imo_number', read_only=True)
    vessel_type = serializers.CharField(source='vessel_schedule_arrival_request_id.vessel_arrival_request_vessel_id.vessel_type', read_only=True)
    berth_name = serializers.CharField(source='vessel_schedule_berth_id.berth_name', read_only=True)
    berth_code = serializers.CharField(source='vessel_schedule_berth_id.berth_code', read_only=True)
    status_display = serializers.CharField(source='get_vessel_schedule_status_display', read_only=True)

    class Meta:
        model = VesselSchedule
        fields = [
            'vessel_schedule_id',
            'vessel_name',
            'vessel_imo',
            'vessel_type',
            'vessel_schedule_berth_id',
            'berth_name',
            'berth_code',
            'vessel_schedule_status',
            'status_display',
            'vessel_schedule_scheduled_arrival_at',
            'vessel_schedule_scheduled_departure_at',
            'vessel_schedule_actual_arrival_at',
            'vessel_schedule_actual_at_berth_at',
        ]


# ==============================================================================
# PHASE T4 / UNLOADING OPERATIONS INTEGRATION SERIALIZERS
# ==============================================================================

class UnloadContainerExecuteSerializer(serializers.Serializer):
    """
    Serializer to validate incoming container vessel discharge request.
    Validates vessel schedule, crane allocation, container, destination slot, and optional remarks.
    """
    vessel_schedule_id = serializers.IntegerField(required=True)
    crane_allocation_id = serializers.IntegerField(required=True)
    container_id = serializers.IntegerField(required=True)
    slot_id = serializers.IntegerField(required=True)
    remarks = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_vessel_schedule_id(self, value):
        if value <= 0:
            raise serializers.ValidationError("Valid vessel schedule ID is required.")
        return value

    def validate_crane_allocation_id(self, value):
        if value <= 0:
            raise serializers.ValidationError("Valid crane allocation ID is required.")
        return value

    def validate_container_id(self, value):
        if value <= 0:
            raise serializers.ValidationError("Valid container ID is required.")
        return value

    def validate_slot_id(self, value):
        if value <= 0:
            raise serializers.ValidationError("Valid destination slot ID is required.")
        return value


class EligibleUnloadingVesselSerializer(serializers.ModelSerializer):
    """
    Serializer for vessel schedules eligible for container unloading at berth.
    """
    vessel_id = serializers.IntegerField(source='vessel_schedule_arrival_request_id.vessel_arrival_request_vessel_id.vessel_id', read_only=True)
    vessel_name = serializers.CharField(source='vessel_schedule_arrival_request_id.vessel_arrival_request_vessel_id.vessel_name', read_only=True)
    vessel_imo_number = serializers.CharField(source='vessel_schedule_arrival_request_id.vessel_arrival_request_vessel_id.vessel_imo_number', read_only=True)
    vessel_call_sign = serializers.CharField(source='vessel_schedule_arrival_request_id.vessel_arrival_request_vessel_id.vessel_call_sign', read_only=True)
    shipping_company_name = serializers.CharField(source='vessel_schedule_arrival_request_id.vessel_arrival_request_vessel_id.vessel_shipping_company_id.shipping_company_name', read_only=True)
    berth_id = serializers.IntegerField(source='vessel_schedule_berth_id.berth_id', read_only=True)
    berth_name = serializers.CharField(source='vessel_schedule_berth_id.berth_name', read_only=True)
    berth_code = serializers.CharField(source='vessel_schedule_berth_id.berth_code', read_only=True)
    schedule_status = serializers.CharField(source='vessel_schedule_status', read_only=True)
    schedule_status_display = serializers.CharField(source='get_vessel_schedule_status_display', read_only=True)
    actual_at_berth_at = serializers.DateTimeField(source='vessel_schedule_actual_at_berth_at', read_only=True)
    active_cranes_count = serializers.SerializerMethodField()
    manifested_containers_count = serializers.SerializerMethodField()

    class Meta:
        model = VesselSchedule
        fields = [
            'vessel_schedule_id',
            'vessel_id',
            'vessel_name',
            'vessel_imo_number',
            'vessel_call_sign',
            'shipping_company_name',
            'berth_id',
            'berth_name',
            'berth_code',
            'schedule_status',
            'schedule_status_display',
            'actual_at_berth_at',
            'active_cranes_count',
            'manifested_containers_count',
        ]

    def get_active_cranes_count(self, obj):
        return obj.crane_allocations.filter(
            crane_allocation_status='ACTIVE',
            crane_allocation_operation_type__in=['UNLOADING', 'BOTH'],
            crane_allocation_crane_id__crane_is_active=True
        ).exclude(
            crane_allocation_crane_id__crane_status__in=['MAINTENANCE', 'INACTIVE']
        ).count()

    def get_manifested_containers_count(self, obj):
        arrival_req = obj.vessel_schedule_arrival_request_id
        if not arrival_req:
            return 0
        allocated_ids = YardAllocation.objects.filter(
            yard_allocation_status='ACTIVE'
        ).values_list('yard_allocation_container_id', flat=True)
        return Container.objects.filter(
            container_cargo_id__cargo_arrival_request_id=arrival_req,
            container_cargo_id__cargo_type='CONTAINERIZED',
            container_status__in=['ARRIVED', 'REGISTERED']
        ).exclude(
            container_id__in=allocated_ids
        ).count()


class ActiveUnloadingCraneSerializer(serializers.ModelSerializer):
    """
    Serializer for active crane allocations operating for unloading.
    """
    crane_id = serializers.IntegerField(source='crane_allocation_crane_id.crane_id', read_only=True)
    crane_code = serializers.CharField(source='crane_allocation_crane_id.crane_code', read_only=True)
    crane_name = serializers.CharField(source='crane_allocation_crane_id.crane_name', read_only=True)
    crane_type = serializers.CharField(source='crane_allocation_crane_id.crane_type', read_only=True)
    crane_type_display = serializers.CharField(source='crane_allocation_crane_id.get_crane_type_display', read_only=True)
    crane_status = serializers.CharField(source='crane_allocation_crane_id.crane_status', read_only=True)
    crane_max_lifting_capacity_mt = serializers.DecimalField(source='crane_allocation_crane_id.crane_max_lifting_capacity_mt', max_digits=8, decimal_places=2, read_only=True)
    berth_id = serializers.IntegerField(source='crane_allocation_berth_id.berth_id', read_only=True, allow_null=True)
    berth_name = serializers.CharField(source='crane_allocation_berth_id.berth_name', read_only=True, allow_null=True)
    operation_type = serializers.CharField(source='crane_allocation_operation_type', read_only=True)
    operation_type_display = serializers.CharField(source='get_crane_allocation_operation_type_display', read_only=True)
    allocation_status = serializers.CharField(source='crane_allocation_status', read_only=True)
    allocation_status_display = serializers.CharField(source='get_crane_allocation_status_display', read_only=True)

    class Meta:
        model = CraneAllocation
        fields = [
            'crane_allocation_id',
            'crane_id',
            'crane_code',
            'crane_name',
            'crane_type',
            'crane_type_display',
            'crane_status',
            'crane_max_lifting_capacity_mt',
            'berth_id',
            'berth_name',
            'operation_type',
            'operation_type_display',
            'allocation_status',
            'allocation_status_display',
            'crane_allocation_planned_start_at',
            'crane_allocation_planned_end_at',
            'crane_allocation_actual_start_at',
        ]


class ManifestUnloadingContainerSerializer(serializers.ModelSerializer):
    """
    Serializer for manifested containers awaiting physical vessel discharge.
    """
    container_type_display = serializers.CharField(source='get_container_type_display', read_only=True)
    container_status_display = serializers.CharField(source='get_container_status_display', read_only=True)
    teu_equivalent = serializers.FloatField(read_only=True)
    cargo_id = serializers.IntegerField(source='container_cargo_id.cargo_id', read_only=True)
    cargo_description = serializers.CharField(source='container_cargo_id.cargo_description', read_only=True)
    customs_status_display = serializers.SerializerMethodField()
    trade_direction = serializers.CharField(default='IMPORT', read_only=True)

    class Meta:
        model = Container
        fields = [
            'container_id',
            'container_number',
            'container_type',
            'container_type_display',
            'container_gross_weight',
            'teu_equivalent',
            'container_status',
            'container_status_display',
            'cargo_id',
            'cargo_description',
            'customs_status_display',
            'trade_direction',
            'container_created_at',
        ]

    def get_customs_status_display(self, obj):
        insp = obj.latest_customs_inspection
        return insp.get_customs_inspection_status_display() if insp else 'Pending Inspection'


# ==============================================================================
# PHASE T5 — PRE-ARRIVAL CUSTOMS SERIALIZERS
# ==============================================================================

class PreArrivalCustomsDeclarationSerializer(serializers.ModelSerializer):
    """
    Serializer for Pre-Arrival Customs Declaration records.
    """
    declaration_status_display = serializers.CharField(source='get_declaration_status_display', read_only=True)
    container_number = serializers.CharField(source='declaration_container_id.container_number', read_only=True)
    container_type = serializers.CharField(source='declaration_container_id.container_type', read_only=True)
    container_gross_weight = serializers.DecimalField(source='declaration_container_id.container_gross_weight', max_digits=10, decimal_places=2, read_only=True)
    cargo_description = serializers.CharField(source='declaration_cargo_id.cargo_description', read_only=True)
    shipping_company_name = serializers.CharField(source='declaration_shipping_company_id.shipping_company_name', read_only=True)
    vessel_name = serializers.SerializerMethodField()
    vessel_schedule_status = serializers.CharField(source='declaration_vessel_schedule_id.vessel_schedule_status', read_only=True)
    submitted_by_name = serializers.CharField(source='declaration_submitted_by.user_full_name', read_only=True)
    reviewed_by_name = serializers.CharField(source='declaration_reviewed_by.user_full_name', read_only=True)
    document_url = serializers.SerializerMethodField()
    documents = serializers.SerializerMethodField()
    declaration_document_type = serializers.SerializerMethodField()

    class Meta:
        model = PreArrivalCustomsDeclaration
        fields = [
            'declaration_id',
            'declaration_reference',
            'declaration_container_id',
            'container_number',
            'container_type',
            'container_gross_weight',
            'declaration_vessel_schedule_id',
            'vessel_name',
            'vessel_schedule_status',
            'declaration_cargo_id',
            'cargo_description',
            'declaration_shipping_company_id',
            'shipping_company_name',
            'declaration_status',
            'declaration_status_display',
            'declaration_type',
            'declaration_document_type',
            'declaration_document_name',
            'document_url',
            'documents',
            'declaration_notes',
            'declaration_submitted_by',
            'submitted_by_name',
            'declaration_submitted_at',
            'declaration_reviewed_by',
            'reviewed_by_name',
            'declaration_reviewed_at',
            'declaration_review_remarks',
            'declaration_hold_reason',
            'declaration_review_history',
            'declaration_created_at',
            'declaration_updated_at',
        ]

    def get_declaration_document_type(self, obj):
        first_doc = obj.documents.filter(document_is_active=True).first()
        if first_doc:
            return first_doc.get_document_type_display()
        legacy = getattr(obj, 'declaration_type', None)
        return legacy or 'Bill of Lading (B/L)'

    def get_documents(self, obj):
        docs = obj.documents.select_related('document_uploaded_by', 'document_reviewed_by').all().order_by('-document_uploaded_at')
        return CustomsDocumentSerializer(docs, many=True).data

    def get_vessel_name(self, obj):
        if obj.declaration_vessel_schedule_id:
            sched = obj.declaration_vessel_schedule_id
            arr_req = sched.vessel_schedule_arrival_request_id
            if arr_req and arr_req.vessel_arrival_request_vessel_id:
                return arr_req.vessel_arrival_request_vessel_id.vessel_name
        cargo = obj.declaration_cargo_id
        if cargo and cargo.vessel:
            return cargo.vessel.vessel_name
        return 'N/A'

    def get_document_url(self, obj):
        if obj.declaration_document:
            try:
                return obj.declaration_document.url
            except Exception:
                return str(obj.declaration_document)
        first_doc = obj.documents.first()
        if first_doc:
            return f"/api/customs/documents/{first_doc.document_id}/download/"
        return None


class PreArrivalCustomsSubmitSerializer(serializers.Serializer):
    """
    Serializer for advance customs document & declaration submission by shipping agents.
    Accepts container_id or container_number, with support for multiple files and per-file types.
    """
    container_id = serializers.IntegerField(required=False)
    container_number = serializers.CharField(max_length=50, required=False, allow_blank=True)
    declaration_reference = serializers.CharField(max_length=100, required=False, allow_blank=True)
    declaration_type = serializers.CharField(max_length=50, default='IMPORT_PRE_ARRIVAL')
    declaration_document_type = serializers.CharField(max_length=50, required=False, allow_blank=True, default=None)
    document_types = serializers.ListField(child=serializers.CharField(allow_blank=True), required=False)
    document_manifest = serializers.CharField(required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True, default='')
    remarks = serializers.CharField(required=False, allow_blank=True, default='')
    document = serializers.FileField(required=False, allow_null=True)

    def validate(self, data):
        c_id = data.get('container_id')
        c_num = data.get('container_number')
        if not c_id and not c_num:
            raise serializers.ValidationError({"container_id": "Either container_id or container_number is required."})
        if not c_id and c_num:
            from authentication.models import Container
            try:
                c = Container.objects.get(container_number__iexact=str(c_num).strip())
                data['container_id'] = c.container_id
            except Container.DoesNotExist:
                raise serializers.ValidationError({"container_number": f"Container '{c_num}' not found."})
        if not data.get('notes') and data.get('remarks'):
            data['notes'] = data['remarks']
        return data


class PreArrivalCustomsReviewSerializer(serializers.Serializer):
    """
    Serializer for Customs Officer review decision on advance declarations.
    """
    decision = serializers.ChoiceField(
        choices=[
            ('CLEARED', 'Cleared'),
            ('ADDITIONAL_INFORMATION_REQUIRED', 'Additional Information Required'),
            ('UNDER_INSPECTION', 'Under Inspection'),
            ('CUSTOMS_HOLD', 'Customs Hold'),
        ],
        required=True
    )
    remarks = serializers.CharField(required=False, allow_blank=True, default='')
    hold_reason = serializers.ChoiceField(
        choices=CustomsInspection.HOLD_REASON_CHOICES,
        required=False,
        allow_blank=True,
        allow_null=True
    )

    def validate(self, attrs):
        decision = attrs.get('decision')
        hold_reason = attrs.get('hold_reason')
        remarks = attrs.get('remarks', '').strip()

        if decision == 'CUSTOMS_HOLD' and not hold_reason:
            raise serializers.ValidationError({'hold_reason': "A hold reason is mandatory when placing a declaration on Customs Hold."})

        if decision in ['CUSTOMS_HOLD', 'ADDITIONAL_INFORMATION_REQUIRED'] and not remarks:
            raise serializers.ValidationError({'remarks': "Detailed remarks are required explaining the hold or requested information."})

        return attrs


class CustomsDocumentUploadSerializer(serializers.Serializer):
    """
    Serializer for normal post-arrival (and pre-arrival) supporting customs document upload.
    Supports single or multiple file upload for a container.
    """
    container_id = serializers.IntegerField(required=False)
    container_number = serializers.CharField(max_length=50, required=False, allow_blank=True)
    document_type = serializers.ChoiceField(
        choices=CustomsDocument.DOCUMENT_TYPE_CHOICES,
        default='BILL_OF_LADING'
    )
    workflow_type = serializers.ChoiceField(
        choices=CustomsDocument.WORKFLOW_TYPE_CHOICES,
        default='NORMAL'
    )
    notes = serializers.CharField(required=False, allow_blank=True, default='')

    def validate(self, data):
        c_id = data.get('container_id')
        c_num = data.get('container_number')
        if not c_id and not c_num:
            raise serializers.ValidationError({"container_id": "Either container_id or container_number is required."})
        if not c_id and c_num:
            from authentication.models import Container
            try:
                c = Container.objects.get(container_number__iexact=str(c_num).strip())
                data['container_id'] = c.container_id
            except Container.DoesNotExist:
                raise serializers.ValidationError({"container_number": f"Container '{c_num}' not found."})
        return data


class CustomsDocumentReviewSerializer(serializers.Serializer):
    """
    Serializer for Customs Officer review on a supporting document.
    """
    review_status = serializers.ChoiceField(
        choices=[
            ('VERIFIED', 'Verified'),
            ('REJECTED', 'Rejected / Issue Found'),
        ],
        required=True
    )
    remarks = serializers.CharField(required=False, allow_blank=True, default='')


# ==============================================================================
# PHASE T5 — DELIVERY ORDER SERIALIZERS
# ==============================================================================

class DeliveryOrderSerializer(serializers.ModelSerializer):
    """
    Serializer for Delivery Order (DO) / Delivery Authorization records.
    """
    delivery_order_status_display = serializers.CharField(source='get_delivery_order_status_display', read_only=True)
    container_number = serializers.CharField(source='delivery_order_container_id.container_number', read_only=True)
    container_type = serializers.CharField(source='delivery_order_container_id.container_type', read_only=True)
    shipping_company_name = serializers.CharField(source='delivery_order_shipping_company_id.shipping_company_name', read_only=True)
    issued_by_name = serializers.CharField(source='delivery_order_issued_by.user_full_name', read_only=True)
    is_valid = serializers.BooleanField(read_only=True)

    class Meta:
        model = DeliveryOrder
        fields = [
            'delivery_order_id',
            'delivery_order_number',
            'delivery_order_container_id',
            'container_number',
            'container_type',
            'delivery_order_shipping_company_id',
            'shipping_company_name',
            'delivery_order_consignee_name',
            'delivery_order_status',
            'delivery_order_status_display',
            'delivery_order_issue_date',
            'delivery_order_valid_until',
            'delivery_order_authorized_transporter',
            'delivery_order_remarks',
            'delivery_order_issued_by',
            'issued_by_name',
            'is_valid',
            'delivery_order_created_at',
            'delivery_order_updated_at',
        ]


class DeliveryOrderCreateSerializer(serializers.Serializer):
    """
    Serializer to issue / create a Delivery Order for a container.
    """
    container_id = serializers.IntegerField(required=True)
    delivery_order_number = serializers.CharField(max_length=100, required=False, allow_blank=True)
    consignee_name = serializers.CharField(max_length=200, required=True)
    valid_hours = serializers.IntegerField(default=72, min_value=1, max_value=720)
    authorized_transporter = serializers.CharField(max_length=200, required=False, allow_blank=True, default='')
    remarks = serializers.CharField(required=False, allow_blank=True, default='')


# ==============================================================================
# PHASE T5 — DIRECT SHIP-TO-TRUCK TRANSFER SERIALIZERS
# ==============================================================================

class DirectShipToTruckTransferSerializer(serializers.ModelSerializer):
    """
    Serializer for Direct Ship-to-Truck Transfer operation records.
    """
    transfer_status_display = serializers.CharField(source='get_transfer_status_display', read_only=True)
    container_number = serializers.CharField(source='transfer_container_id.container_number', read_only=True)
    container_type = serializers.CharField(source='transfer_container_id.container_type', read_only=True)
    container_gross_weight = serializers.DecimalField(source='transfer_container_id.container_gross_weight', max_digits=10, decimal_places=2, read_only=True)
    vessel_schedule_id = serializers.IntegerField(source='transfer_vessel_schedule_id.vessel_schedule_id', read_only=True)
    vessel_name = serializers.SerializerMethodField()
    berth_name = serializers.CharField(source='transfer_berth_id.berth_name', read_only=True)
    crane_code = serializers.CharField(source='transfer_crane_id.crane_code', read_only=True)
    crane_name = serializers.CharField(source='transfer_crane_id.crane_name', read_only=True)
    crane_type = serializers.CharField(source='transfer_crane_id.crane_type', read_only=True)
    truck_number = serializers.CharField(source='transfer_truck_id.truck_number', read_only=True)
    truck_company_name = serializers.CharField(source='transfer_truck_id.truck_company_name', read_only=True)
    driver_name = serializers.CharField(source='transfer_driver_id.driver_name', read_only=True)
    driver_license_number = serializers.CharField(source='transfer_driver_id.driver_license_number', read_only=True)
    driver_phone = serializers.CharField(source='transfer_driver_id.driver_phone', read_only=True)
    delivery_order_number = serializers.CharField(source='transfer_delivery_order_id.delivery_order_number', read_only=True)
    consignee_name = serializers.CharField(source='transfer_delivery_order_id.delivery_order_consignee_name', read_only=True)
    gate_pass_number = serializers.CharField(source='transfer_gate_pass_id.gate_pass_pass_number', read_only=True)
    gate_pass_verification_code = serializers.CharField(source='transfer_gate_pass_id.gate_pass_verification_code', read_only=True)
    gate_pass_qr_code = serializers.CharField(source='transfer_gate_pass_id.gate_pass_qr_code', read_only=True)
    gate_name = serializers.CharField(source='transfer_gate_pass_id.gate_pass_gate_id.gate_name', read_only=True)
    initiated_by_name = serializers.CharField(source='transfer_initiated_by.user_full_name', read_only=True)
    executed_by_name = serializers.CharField(source='transfer_executed_by.user_full_name', read_only=True)
    gate_verified_by_name = serializers.CharField(source='transfer_gate_verified_by.user_full_name', read_only=True)

    class Meta:
        model = DirectShipToTruckTransfer
        fields = [
            'transfer_id',
            'transfer_reference',
            'transfer_container_id',
            'container_number',
            'container_type',
            'container_gross_weight',
            'vessel_schedule_id',
            'vessel_name',
            'transfer_berth_id',
            'berth_name',
            'transfer_crane_allocation_id',
            'transfer_crane_id',
            'crane_code',
            'crane_name',
            'crane_type',
            'transfer_truck_id',
            'truck_number',
            'truck_company_name',
            'transfer_driver_id',
            'driver_name',
            'driver_license_number',
            'driver_phone',
            'transfer_delivery_order_id',
            'delivery_order_number',
            'consignee_name',
            'transfer_gate_pass_id',
            'gate_pass_number',
            'gate_pass_verification_code',
            'gate_pass_qr_code',
            'gate_name',
            'transfer_status',
            'transfer_status_display',
            'transfer_remarks',
            'transfer_initiated_by',
            'initiated_by_name',
            'transfer_executed_by',
            'executed_by_name',
            'transfer_gate_verified_by',
            'gate_verified_by_name',
            'transfer_initiated_at',
            'transfer_transferred_at',
            'transfer_completed_at',
            'transfer_created_at',
            'transfer_updated_at',
        ]

    def get_vessel_name(self, obj):
        sched = obj.transfer_vessel_schedule_id
        if sched and sched.vessel_schedule_arrival_request_id:
            vessel = sched.vessel_schedule_arrival_request_id.vessel_arrival_request_vessel_id
            return vessel.vessel_name if vessel else 'N/A'
        return 'N/A'


class DirectShipToTruckExecuteSerializer(serializers.Serializer):
    """
    Payload serializer to execute physical direct ship-to-truck discharge.
    Accepts either IDs or natural references (container_number, truck_number).
    """
    vessel_schedule_id = serializers.IntegerField(required=True)
    container_id = serializers.IntegerField(required=False)
    container_number = serializers.CharField(max_length=50, required=False, allow_blank=True)
    crane_allocation_id = serializers.IntegerField(required=True)
    truck_id = serializers.IntegerField(required=False)
    truck_number = serializers.CharField(max_length=50, required=False, allow_blank=True)
    driver_id = serializers.IntegerField(required=True)
    gate_id = serializers.IntegerField(required=True)
    delivery_order_id = serializers.IntegerField(required=False, allow_null=True)
    consignee_name = serializers.CharField(max_length=200, required=False, allow_blank=True, default='')
    valid_hours = serializers.IntegerField(default=24, min_value=1, max_value=168)
    remarks = serializers.CharField(required=False, allow_blank=True, default='')

    def validate(self, data):
        c_id = data.get('container_id')
        c_num = data.get('container_number')
        if not c_id and not c_num:
            raise serializers.ValidationError({"container_id": "Either container_id or container_number is required."})
        if not c_id and c_num:
            from authentication.models import Container
            try:
                c = Container.objects.get(container_number__iexact=str(c_num).strip())
                data['container_id'] = c.container_id
            except Container.DoesNotExist:
                raise serializers.ValidationError({"container_number": f"Container '{c_num}' not found."})

        t_id = data.get('truck_id')
        t_num = data.get('truck_number')
        if not t_id and not t_num:
            raise serializers.ValidationError({"truck_id": "Either truck_id or truck_number is required."})
        if not t_id and t_num:
            from authentication.models import Truck
            try:
                t = Truck.objects.get(truck_number__iexact=str(t_num).strip())
                data['truck_id'] = t.truck_id
            except Truck.DoesNotExist:
                raise serializers.ValidationError({"truck_number": f"Truck '{t_num}' not found."})

        return data


class EligibleDirectTransferContainerSerializer(serializers.ModelSerializer):
    """
    Serializer providing rich pre-qualification and eligibility breakdown
    for manifested containers on a berthed vessel considering direct ship-to-truck delivery.
    """
    container_type_display = serializers.CharField(source='get_container_type_display', read_only=True)
    container_status_display = serializers.CharField(source='get_container_status_display', read_only=True)
    container_customs_status_display = serializers.CharField(source='get_container_customs_status_display', read_only=True)
    cargo_id = serializers.IntegerField(source='container_cargo_id.cargo_id', read_only=True)
    cargo_description = serializers.CharField(source='container_cargo_id.cargo_description', read_only=True)
    shipping_company_name = serializers.CharField(source='container_cargo_id.shipping_company.shipping_company_name', read_only=True)
    is_customs_cleared = serializers.BooleanField(read_only=True)
    has_active_yard_allocation = serializers.SerializerMethodField()
    has_active_transfer = serializers.SerializerMethodField()
    delivery_order = serializers.SerializerMethodField()
    latest_declaration = serializers.SerializerMethodField()
    is_eligible = serializers.SerializerMethodField()
    ineligibility_reasons = serializers.SerializerMethodField()

    class Meta:
        model = Container
        fields = [
            'container_id',
            'container_number',
            'container_type',
            'container_type_display',
            'container_gross_weight',
            'container_status',
            'container_status_display',
            'container_customs_status',
            'container_customs_status_display',
            'cargo_id',
            'cargo_description',
            'shipping_company_name',
            'is_customs_cleared',
            'has_active_yard_allocation',
            'has_active_transfer',
            'delivery_order',
            'latest_declaration',
            'is_eligible',
            'ineligibility_reasons',
        ]

    def get_has_active_yard_allocation(self, obj):
        return obj.yard_allocations.filter(yard_allocation_status='ACTIVE').exists()

    def get_has_active_transfer(self, obj):
        return obj.direct_transfers.filter(
            transfer_status__in=['INITIATED', 'IN_PROGRESS', 'TRANSFERRED_TO_TRUCK', 'AWAITING_GATE_EXIT']
        ).exists()

    def get_delivery_order(self, obj):
        do = obj.delivery_orders.filter(delivery_order_status='ISSUED').order_by('-delivery_order_issue_date').first()
        if not do:
            return None
        return {
            'delivery_order_id': do.delivery_order_id,
            'delivery_order_number': do.delivery_order_number,
            'consignee_name': do.delivery_order_consignee_name,
            'is_valid': do.is_valid,
            'valid_until': do.delivery_order_valid_until.isoformat() if do.delivery_order_valid_until else None,
        }

    def get_latest_declaration(self, obj):
        decl = obj.latest_customs_declaration
        if not decl:
            return None
        return {
            'declaration_id': decl.declaration_id,
            'declaration_reference': decl.declaration_reference,
            'declaration_status': decl.declaration_status,
            'declaration_status_display': decl.get_declaration_status_display(),
        }

    def get_ineligibility_reasons(self, obj):
        reasons = []

        # 1. Customs check
        if not obj.is_customs_cleared:
            if obj.container_customs_status == 'CUSTOMS_HOLD' or obj.container_status == 'CUSTOMS_HOLD':
                reasons.append("Container is placed on Customs Hold.")
            elif obj.container_customs_status == 'UNDER_INSPECTION' or obj.container_status == 'UNDER_INSPECTION':
                reasons.append("Container is undergoing mandatory Customs Inspection.")
            elif obj.container_customs_status == 'ADDITIONAL_INFORMATION_REQUIRED':
                reasons.append("Customs Officer requested additional information before clearance.")
            elif obj.container_customs_status == 'PENDING_REVIEW':
                reasons.append("Pre-arrival customs declaration is pending review.")
            else:
                reasons.append("Customs clearance has not been granted.")

        # 2. Yard allocation check
        if self.get_has_active_yard_allocation(obj):
            reasons.append("Container has already been discharged into a terminal yard slot.")

        # 3. Existing direct transfer check
        if self.get_has_active_transfer(obj):
            reasons.append("Container already has an active or in-progress direct transfer.")

        # 4. Incompatible physical status
        if obj.container_status in ['RELEASED']:
            reasons.append("Container has already been released from the terminal.")
        elif obj.container_status in ['AT_TERMINAL']:
            reasons.append("Container is already at terminal and not on board vessel.")

        return reasons

    def get_is_eligible(self, obj):
        return len(self.get_ineligibility_reasons(obj)) == 0


# ==============================================================================
# PHASE T4-B / LOADING OPERATIONS (VESSEL STOWAGE) SERIALIZERS
# ==============================================================================

class LoadContainerExecuteSerializer(serializers.Serializer):
    """
    Serializer to validate incoming container vessel loading (stowage) request.
    Validates vessel schedule, crane allocation, container, origin yard slot, and optional remarks.
    """
    vessel_schedule_id = serializers.IntegerField(required=True)
    crane_allocation_id = serializers.IntegerField(required=True)
    container_id = serializers.IntegerField(required=True)
    slot_id = serializers.IntegerField(required=True)
    remarks = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_vessel_schedule_id(self, value):
        if value <= 0:
            raise serializers.ValidationError("Valid vessel schedule ID is required.")
        return value

    def validate_crane_allocation_id(self, value):
        if value <= 0:
            raise serializers.ValidationError("Valid crane allocation ID is required.")
        return value

    def validate_container_id(self, value):
        if value <= 0:
            raise serializers.ValidationError("Valid container ID is required.")
        return value

    def validate_slot_id(self, value):
        if value <= 0:
            raise serializers.ValidationError("Valid origin yard slot ID is required.")
        return value


class EligibleLoadingVesselSerializer(serializers.ModelSerializer):
    """
    Serializer for berthed vessel schedules eligible for export / container loading.
    """
    vessel_id = serializers.IntegerField(source='vessel_schedule_arrival_request_id.vessel_arrival_request_vessel_id.vessel_id', read_only=True)
    vessel_name = serializers.CharField(source='vessel_schedule_arrival_request_id.vessel_arrival_request_vessel_id.vessel_name', read_only=True)
    vessel_imo_number = serializers.CharField(source='vessel_schedule_arrival_request_id.vessel_arrival_request_vessel_id.vessel_imo_number', read_only=True)
    vessel_call_sign = serializers.CharField(source='vessel_schedule_arrival_request_id.vessel_arrival_request_vessel_id.vessel_call_sign', read_only=True)
    shipping_company_name = serializers.CharField(source='vessel_schedule_arrival_request_id.vessel_arrival_request_vessel_id.vessel_shipping_company_id.shipping_company_name', read_only=True)
    berth_id = serializers.IntegerField(source='vessel_schedule_berth_id.berth_id', read_only=True)
    berth_name = serializers.CharField(source='vessel_schedule_berth_id.berth_name', read_only=True)
    berth_code = serializers.CharField(source='vessel_schedule_berth_id.berth_code', read_only=True)
    schedule_status = serializers.CharField(source='vessel_schedule_status', read_only=True)
    schedule_status_display = serializers.CharField(source='get_vessel_schedule_status_display', read_only=True)
    actual_at_berth_at = serializers.DateTimeField(source='vessel_schedule_actual_at_berth_at', read_only=True)
    active_cranes_count = serializers.SerializerMethodField()
    yard_containers_count = serializers.SerializerMethodField()

    class Meta:
        model = VesselSchedule
        fields = [
            'vessel_schedule_id',
            'vessel_id',
            'vessel_name',
            'vessel_imo_number',
            'vessel_call_sign',
            'shipping_company_name',
            'berth_id',
            'berth_name',
            'berth_code',
            'schedule_status',
            'schedule_status_display',
            'actual_at_berth_at',
            'active_cranes_count',
            'yard_containers_count',
        ]

    def get_active_cranes_count(self, obj):
        return obj.crane_allocations.filter(
            crane_allocation_status='ACTIVE',
            crane_allocation_operation_type__in=['LOADING', 'BOTH'],
            crane_allocation_crane_id__crane_is_active=True
        ).exclude(
            crane_allocation_crane_id__crane_status__in=['MAINTENANCE', 'INACTIVE']
        ).count()

    def get_yard_containers_count(self, obj):
        # Count eligible export containers with active yard allocation assigned to THIS vessel schedule
        arrival_req = obj.vessel_schedule_arrival_request_id
        if not arrival_req:
            return 0
        discharged_ids = YardMovementHistory.objects.filter(
            yard_movement_movement_type='DISCHARGE'
        ).values_list('yard_movement_container_id_id', flat=True)
        return YardAllocation.objects.filter(
            yard_allocation_status='ACTIVE',
            yard_allocation_container_id__container_cargo_id__cargo_arrival_request_id=arrival_req,
            yard_allocation_container_id__container_status__in=['AT_TERMINAL', 'CLEARED']
        ).exclude(
            yard_allocation_container_id_id__in=discharged_ids
        ).exclude(
            yard_allocation_container_id__container_delivery_status__in=[
                'RELEASED', 'GATE_PASS_GENERATED', 'PICKED_UP',
                'DEPARTED_PORT', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'
            ]
        ).count()


class ActiveLoadingCraneSerializer(serializers.ModelSerializer):
    """
    Serializer for active crane allocations operating for vessel loading.
    """
    crane_id = serializers.IntegerField(source='crane_allocation_crane_id.crane_id', read_only=True)
    crane_code = serializers.CharField(source='crane_allocation_crane_id.crane_code', read_only=True)
    crane_name = serializers.CharField(source='crane_allocation_crane_id.crane_name', read_only=True)
    crane_type = serializers.CharField(source='crane_allocation_crane_id.crane_type', read_only=True)
    crane_type_display = serializers.CharField(source='crane_allocation_crane_id.get_crane_type_display', read_only=True)
    crane_status = serializers.CharField(source='crane_allocation_crane_id.crane_status', read_only=True)
    crane_max_lifting_capacity_mt = serializers.DecimalField(source='crane_allocation_crane_id.crane_max_lifting_capacity_mt', max_digits=8, decimal_places=2, read_only=True)
    berth_id = serializers.IntegerField(source='crane_allocation_berth_id.berth_id', read_only=True, allow_null=True)
    berth_name = serializers.CharField(source='crane_allocation_berth_id.berth_name', read_only=True, allow_null=True)
    operation_type = serializers.CharField(source='crane_allocation_operation_type', read_only=True)
    operation_type_display = serializers.CharField(source='get_crane_allocation_operation_type_display', read_only=True)
    allocation_status = serializers.CharField(source='crane_allocation_status', read_only=True)
    allocation_status_display = serializers.CharField(source='get_crane_allocation_status_display', read_only=True)

    class Meta:
        model = CraneAllocation
        fields = [
            'crane_allocation_id',
            'crane_id',
            'crane_code',
            'crane_name',
            'crane_type',
            'crane_type_display',
            'crane_status',
            'crane_max_lifting_capacity_mt',
            'berth_id',
            'berth_name',
            'operation_type',
            'operation_type_display',
            'allocation_status',
            'allocation_status_display',
            'crane_allocation_planned_start_at',
            'crane_allocation_planned_end_at',
            'crane_allocation_actual_start_at',
        ]


class YardLoadingContainerSerializer(serializers.ModelSerializer):
    """
    Serializer for yard-allocated export containers available for loading onto a berthed vessel.
    """
    container_type_display = serializers.CharField(source='get_container_type_display', read_only=True)
    container_status_display = serializers.CharField(source='get_container_status_display', read_only=True)
    teu_equivalent = serializers.FloatField(read_only=True)
    cargo_id = serializers.IntegerField(source='container_cargo_id.cargo_id', read_only=True)
    cargo_description = serializers.CharField(source='container_cargo_id.cargo_description', read_only=True)
    slot_id = serializers.SerializerMethodField()
    slot_code = serializers.SerializerMethodField()
    block_code = serializers.SerializerMethodField()
    yard_code = serializers.SerializerMethodField()
    location_display = serializers.SerializerMethodField()
    customs_status_display = serializers.SerializerMethodField()
    trade_direction = serializers.CharField(default='EXPORT', read_only=True)
    vessel_schedule_id = serializers.SerializerMethodField()
    vessel_name = serializers.SerializerMethodField()

    class Meta:
        model = Container
        fields = [
            'container_id',
            'container_number',
            'container_type',
            'container_type_display',
            'container_gross_weight',
            'teu_equivalent',
            'container_status',
            'container_status_display',
            'cargo_id',
            'cargo_description',
            'slot_id',
            'slot_code',
            'block_code',
            'yard_code',
            'location_display',
            'customs_status_display',
            'trade_direction',
            'vessel_schedule_id',
            'vessel_name',
            'container_created_at',
        ]

    def _get_active_allocation(self, obj):
        if not hasattr(obj, '_cached_active_alloc'):
            obj._cached_active_alloc = YardAllocation.objects.select_related(
                'yard_allocation_slot_id__yard_slot_block_id__yard_block_yard_id'
            ).filter(
                yard_allocation_container_id=obj,
                yard_allocation_status='ACTIVE'
            ).first()
        return obj._cached_active_alloc

    def get_slot_id(self, obj):
        alloc = self._get_active_allocation(obj)
        return alloc.yard_allocation_slot_id.yard_slot_id if (alloc and alloc.yard_allocation_slot_id) else None

    def get_slot_code(self, obj):
        alloc = self._get_active_allocation(obj)
        return alloc.yard_allocation_slot_id.yard_slot_code if (alloc and alloc.yard_allocation_slot_id) else None

    def get_block_code(self, obj):
        alloc = self._get_active_allocation(obj)
        return alloc.yard_allocation_slot_id.yard_slot_block_id.yard_block_code if (alloc and alloc.yard_allocation_slot_id) else None

    def get_yard_code(self, obj):
        alloc = self._get_active_allocation(obj)
        if alloc and alloc.yard_allocation_slot_id and alloc.yard_allocation_slot_id.yard_slot_block_id:
            return alloc.yard_allocation_slot_id.yard_slot_block_id.yard_block_yard_id.yard_code
        return None

    def get_location_display(self, obj):
        alloc = self._get_active_allocation(obj)
        if alloc and alloc.yard_allocation_slot_id and alloc.yard_allocation_slot_id.yard_slot_block_id:
            s = alloc.yard_allocation_slot_id
            b = s.yard_slot_block_id
            y = b.yard_block_yard_id
            return f"{y.yard_code} / {b.yard_block_code} / {s.yard_slot_code}"
        return "Unassigned"

    def get_customs_status_display(self, obj):
        insp = obj.latest_customs_inspection
        return insp.get_customs_inspection_status_display() if insp else obj.get_container_customs_status_display()

    def get_vessel_schedule_id(self, obj):
        req = obj.arrival_request
        if req and hasattr(req, 'schedule') and req.schedule:
            return req.schedule.vessel_schedule_id
        return None

    def get_vessel_name(self, obj):
        v = obj.vessel
        return v.vessel_name if v else None





