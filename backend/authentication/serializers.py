from rest_framework import serializers
from django.contrib.auth.hashers import make_password
from django.db import transaction
from django.utils import timezone
from authentication.models import Login, User, ShippingCompany, RegistrationRequest, Vessel, VesselArrivalRequest, Department, Role, Berth, VesselSchedule
from authentication.validators import validate_strong_password, validate_international_phone_number


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True, write_only=True)

    def validate_email(self, value):
        return value.strip().lower()


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
    request_company_name = serializers.CharField(required=True, max_length=200)
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

    def validate_request_phone(self, value):
        jurisdiction = self.initial_data.get('request_jurisdiction') or 'IN'
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
            'registration_request_terms_accepted',
            'registration_request_status',
            'registration_request_rejection_reason',
            'registration_request_submitted_at',
            'registration_request_reviewed_at',
            'user_id',
            'reviewer_name'
        ]

    def get_reviewer_name(self, obj):
        if obj.user_id:
            return obj.user_id.user_full_name
        return None


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
    user_employee_id = serializers.CharField(required=True, max_length=50)
    user_department = serializers.CharField(required=False, allow_blank=True, max_length=100)
    user_role = serializers.CharField(required=True, max_length=100)
    password = serializers.CharField(write_only=True, required=True, validators=[validate_strong_password])
    confirm_password = serializers.CharField(write_only=True, required=True)

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
        emp_id = value.strip()
        if User.objects.filter(user_employee_id__iexact=emp_id).exists():
            raise serializers.ValidationError("A staff user with this Employee ID already exists.")
        return emp_id

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
        if attrs.get('password') != attrs.get('confirm_password'):
            raise serializers.ValidationError({"confirm_password": "Initial password and confirmation password do not match."})
        
        # Enforce automated role -> department mapping
        role = attrs.get('user_role')
        attrs['user_department'] = self.ROLE_DEPARTMENT_MAP.get(role, 'Port Operations')
        return attrs

    def create(self, validated_data):
        raw_password = validated_data.pop('password')
        validated_data.pop('confirm_password', None)

        email = validated_data.pop('user_email')
        role = validated_data.pop('user_role')
        full_name = validated_data.pop('user_full_name').strip()
        phone = validated_data.pop('user_phone', '').strip()
        employee_id = validated_data.pop('user_employee_id').strip()
        department = validated_data.get('user_department') or self.ROLE_DEPARTMENT_MAP.get(role, 'Port Operations')

        with transaction.atomic():
            # 1. Get or create normalized Department record
            dept_obj, _ = Department.objects.get_or_create(
                department_department_name=department
            )

            # 2. Get or create normalized Role record
            role_display = self.ROLE_DISPLAY_NAMES.get(role, role.replace('_', ' ').title())
            role_obj, _ = Role.objects.get_or_create(
                role_role_code=role,
                defaults={'role_role_name': role_display}
            )

            # 3. Create Login account with ACTIVE status and hashed initial password
            login_obj = Login.objects.create(
                login_email=email,
                login_password=make_password(raw_password),
                login_role=role,
                login_status='ACTIVE',
                login_is_active=True
            )

            # 4. Create User profile record with ACTIVE status and 3NF foreign keys
            user_obj = User.objects.create(
                login_id=login_obj,
                department_id=dept_obj,
                role_id=role_obj,
                user_full_name=full_name,
                user_phone=phone,
                user_employee_id=employee_id,
                user_department=department,
                user_designation=role_display,
                user_status='ACTIVE'
            )

        return user_obj


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
        if Vessel.objects.filter(vessel_imo_number__iexact=cleaned_imo).exists():
            raise serializers.ValidationError("A vessel with this IMO number already exists.")
        return cleaned_imo

    def validate_vessel_length(self, value):
        if value <= 0:
            raise serializers.ValidationError("Vessel length must be greater than 0.")
        return value

    def validate_vessel_draft(self, value):
        if value <= 0:
            raise serializers.ValidationError("Vessel draft must be greater than 0.")
        return value

    def validate_vessel_capacity(self, value):
        if value <= 0:
            raise serializers.ValidationError("Vessel capacity must be greater than 0.")
        return value


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
            'berth_capacity_teu',
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
            'berth_capacity_teu',
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

    def validate_berth_capacity_teu(self, value):
        if value <= 0:
            raise serializers.ValidationError("Berth capacity must be greater than 0.")
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
    reviewed_by_name = serializers.CharField(source='vessel_arrival_request_reviewed_by.user_full_name', read_only=True, default=None)
    schedule = VesselScheduleSerializer(read_only=True)
    scheduling_status = serializers.SerializerMethodField()

    class Meta:
        model = VesselArrivalRequest
        fields = [
            'vessel_arrival_request_id',
            'vessel_arrival_request_vessel_id',
            'vessel',
            'vessel_arrival_request_requested_arrival_at',
            'vessel_arrival_request_requested_departure_at',
            'vessel_arrival_request_cargo_type',
            'vessel_arrival_request_cargo_quantity',
            'vessel_arrival_request_status',
            'vessel_arrival_request_submitted_at',
            'vessel_arrival_request_reviewed_at',
            'vessel_arrival_request_reviewed_by',
            'reviewed_by_name',
            'vessel_arrival_request_remarks',
            'schedule',
            'scheduling_status'
        ]

    def get_scheduling_status(self, obj):
        if hasattr(obj, 'schedule') and obj.schedule:
            return obj.schedule.vessel_schedule_status
        if obj.vessel_arrival_request_status == 'APPROVED':
            return 'Awaiting Scheduling'
        return 'N/A'



class VesselArrivalRequestCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = VesselArrivalRequest
        fields = [
            'vessel_arrival_request_vessel_id',
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

        if not vessel_obj:
            raise serializers.ValidationError({"vessel_arrival_request_vessel_id": "Please select a vessel."})

        if arrival and arrival < timezone.now():
            raise serializers.ValidationError({"vessel_arrival_request_requested_arrival_at": "Requested arrival time cannot be in the past."})

        if arrival and departure and departure <= arrival:
            raise serializers.ValidationError({"vessel_arrival_request_requested_departure_at": "Requested departure time must be later than requested arrival time."})

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

        return attrs






