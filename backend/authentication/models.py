from django.db import models
from django.utils import timezone
from django.core.exceptions import ValidationError

class Login(models.Model):
    ROLE_CHOICES = (
        ('port_administrator', 'Port Administrator'),
        ('shipping_company', 'Shipping Company / Shipping Agent'),
        ('port_operations_officer', 'Port Operations Officer'),
        ('customs_officer', 'Customs Officer'),
        ('terminal_logistics_operator', 'Terminal & Logistics Operator'),
        ('gate_truck_officer', 'Gate & Truck Operations Officer'),
    )

    STATUS_CHOICES = (
        ('PENDING', 'Pending Approval'),
        ('ACTION_REQUIRED', 'Action Required'),
        ('ACTIVE', 'Active'),
        ('REJECTED', 'Rejected'),
        ('SUSPENDED', 'Suspended'),
    )

    login_id = models.BigAutoField(primary_key=True)
    login_email = models.EmailField(max_length=255, unique=True)
    login_password = models.CharField(max_length=255)
    login_role = models.CharField(max_length=50, choices=ROLE_CHOICES)
    login_status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='PENDING')
    login_is_active = models.BooleanField(default=True)
    login_created_at = models.DateTimeField(auto_now_add=True)
    login_updated_at = models.DateTimeField(auto_now=True)

    @property
    def must_change_password(self):
        profile = getattr(self, 'profile', None)
        return getattr(profile, 'user_must_change_password', False) if profile else False

    class Meta:
        db_table = 'tbl_login'
        verbose_name = 'Login Record'
        verbose_name_plural = 'Login Records'

    def __str__(self):
        return f"{self.login_email} ({self.login_role})"


class ShippingCompany(models.Model):
    COMPANY_STATUS_CHOICES = (
        ('PENDING', 'Pending Approval'),
        ('ACTION_REQUIRED', 'Action Required'),
        ('ACTIVE', 'Active'),
        ('SUSPENDED', 'Suspended'),
        ('REJECTED', 'Rejected'),
    )

    shipping_company_id = models.BigAutoField(primary_key=True)
    shipping_company_name = models.CharField(max_length=200, unique=True)
    shipping_company_license_number = models.CharField(max_length=100, unique=True)
    shipping_company_email = models.EmailField(max_length=255, unique=True)
    shipping_company_phone = models.CharField(max_length=50)
    shipping_company_address = models.TextField()
    shipping_company_jurisdiction = models.CharField(max_length=100)
    shipping_company_status = models.CharField(max_length=30, choices=COMPANY_STATUS_CHOICES, default='PENDING')
    shipping_company_created_at = models.DateTimeField(auto_now_add=True)

    # Property alias for backward compatibility
    @property
    def company_id(self):
        return self.shipping_company_id

    @property
    def company_name(self):
        return self.shipping_company_name

    class Meta:
        db_table = 'tbl_shipping_company'
        verbose_name = 'Shipping Company'
        verbose_name_plural = 'Shipping Companies'

    def __str__(self):
        return self.shipping_company_name


class Department(models.Model):
    department_department_id = models.BigAutoField(primary_key=True)
    department_department_name = models.CharField(max_length=100, unique=True)
    department_created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'tbl_department'
        verbose_name = 'Department'
        verbose_name_plural = 'Departments'

    def __str__(self):
        return self.department_department_name


class Role(models.Model):
    role_role_id = models.BigAutoField(primary_key=True)
    role_role_name = models.CharField(max_length=100, unique=True)
    role_role_code = models.CharField(max_length=50, unique=True)
    role_created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'tbl_role'
        verbose_name = 'Role'
        verbose_name_plural = 'Roles'

    def __str__(self):
        return self.role_role_name


class User(models.Model):
    USER_STATUS_CHOICES = (
        ('PENDING', 'Pending Approval'),
        ('ACTIVE', 'Active'),
        ('REJECTED', 'Rejected'),
        ('SUSPENDED', 'Suspended'),
    )

    user_id = models.BigAutoField(primary_key=True)
    login_id = models.OneToOneField(
        Login,
        on_delete=models.CASCADE,
        db_column='login_id',
        related_name='profile'
    )
    shipping_company_id = models.ForeignKey(
        ShippingCompany,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='shipping_company_id',
        related_name='users'
    )
    department_id = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='department_id',
        related_name='users'
    )
    role_id = models.ForeignKey(
        Role,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='role_id',
        related_name='users'
    )
    user_full_name = models.CharField(max_length=150)
    user_phone = models.CharField(max_length=50, null=True, blank=True)
    user_employee_id = models.CharField(max_length=50, unique=True, null=True, blank=True)
    user_department = models.CharField(max_length=100, null=True, blank=True)
    user_designation = models.CharField(max_length=100, null=True, blank=True)
    user_status = models.CharField(max_length=30, choices=USER_STATUS_CHOICES, default='PENDING')
    user_must_change_password = models.BooleanField(default=False, db_column='user_must_change_password')
    user_created_at = models.DateTimeField(auto_now_add=True)
    user_updated_at = models.DateTimeField(auto_now=True)

    # Property aliases for backward compatibility
    @property
    def user_login_id(self):
        return self.login_id

    @property
    def user_company_id(self):
        return self.shipping_company_id

    @property
    def must_change_password(self):
        return self.user_must_change_password

    @must_change_password.setter
    def must_change_password(self, value):
        self.user_must_change_password = value

    class Meta:
        db_table = 'tbl_user'
        verbose_name = 'User Profile'
        verbose_name_plural = 'User Profiles'

    def __str__(self):
        return f"{self.user_full_name} ({self.login_id.login_email})"


class RegistrationRequest(models.Model):
    STATUS_CHOICES = (
        ('PENDING', 'Pending Review'),
        ('ACTION_REQUIRED', 'Action Required'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('SUSPENDED', 'Suspended'),
    )

    registration_request_id = models.BigAutoField(primary_key=True)
    shipping_company_id = models.ForeignKey(
        ShippingCompany,
        on_delete=models.CASCADE,
        db_column='shipping_company_id',
        related_name='registration_requests'
    )
    registration_request_entity_type = models.CharField(max_length=100, default='Shipping Company / Shipping Agent')
    registration_request_applicant_name = models.CharField(max_length=150)
    registration_request_license_file = models.FileField(upload_to='registration_docs/licenses/', null=True, blank=True)
    registration_request_id_file = models.FileField(upload_to='registration_docs/ids/', null=True, blank=True)
    registration_request_previous_license_file = models.FileField(upload_to='registration_docs/licenses/previous/', null=True, blank=True)
    registration_request_previous_id_file = models.FileField(upload_to='registration_docs/ids/previous/', null=True, blank=True)
    registration_request_terms_accepted = models.BooleanField(default=True)
    registration_request_status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='PENDING')
    registration_request_action_required_docs = models.CharField(max_length=255, null=True, blank=True, help_text="Comma-separated or identifier of required documents")
    registration_request_admin_remarks = models.TextField(null=True, blank=True, help_text="Administrator instructions when Action Required")
    registration_request_rejection_reason = models.TextField(null=True, blank=True, help_text="Administrator final rejection reason")
    registration_request_submitted_at = models.DateTimeField(auto_now_add=True)
    registration_request_resubmitted_at = models.DateTimeField(null=True, blank=True)
    registration_request_reviewed_at = models.DateTimeField(null=True, blank=True)
    user_id = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='user_id',
        related_name='reviewed_registration_requests'
    )

    # Property aliases for backward compatibility
    @property
    def request_id(self):
        return self.registration_request_id

    @property
    def request_company_name(self):
        return self.shipping_company_id.shipping_company_name if self.shipping_company_id else ""

    @property
    def request_status(self):
        return self.registration_request_status

    @property
    def request_submitted_at(self):
        return self.registration_request_submitted_at

    class Meta:
        db_table = 'tbl_registration_request'
        verbose_name = 'Registration Request'
        verbose_name_plural = 'Registration Requests'

    def __str__(self):
        return f"{self.shipping_company_id.shipping_company_name if self.shipping_company_id else 'Request'} ({self.registration_request_status})"


class PasswordResetToken(models.Model):
    password_reset_token_id = models.BigAutoField(primary_key=True)
    login_id = models.ForeignKey(
        Login,
        on_delete=models.CASCADE,
        related_name='reset_tokens',
        db_column='login_id'
    )
    token_hash = models.CharField(max_length=64, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)

    # Property alias for backward compatibility
    @property
    def login(self):
        return self.login_id

    class Meta:
        db_table = 'tbl_password_reset_token'
        verbose_name = 'Password Reset Token'
        verbose_name_plural = 'Password Reset Tokens'

    def is_valid(self):
        return self.used_at is None and timezone.now() <= self.expires_at

    def __str__(self):
        return f"Reset Token for {self.login_id.login_email} (ID: {self.password_reset_token_id})"


class Vessel(models.Model):
    VESSEL_TYPE_CHOICES = (
        ('CONTAINER_SHIP', 'Container Ship'),
        ('BULK_CARRIER', 'Bulk Carrier'),
        ('TANKER', 'Tanker'),
        ('GENERAL_CARGO', 'General Cargo'),
        ('RO_RO', 'Ro-Ro Vessel'),
        ('OTHER', 'Other'),
    )

    VESSEL_STATUS_CHOICES = (
        ('ACTIVE', 'Active'),
        ('INACTIVE', 'Inactive'),
    )

    vessel_id = models.BigAutoField(primary_key=True)
    vessel_shipping_company_id = models.ForeignKey(
        ShippingCompany,
        on_delete=models.CASCADE,
        db_column='vessel_shipping_company_id',
        related_name='vessels'
    )
    vessel_name = models.CharField(max_length=200)
    vessel_imo_number = models.CharField(max_length=50, unique=True)
    vessel_type = models.CharField(max_length=50, choices=VESSEL_TYPE_CHOICES, default='CONTAINER_SHIP')
    vessel_flag = models.CharField(max_length=100)
    vessel_call_sign = models.CharField(max_length=50, null=True, blank=True)
    vessel_length = models.DecimalField(max_digits=8, decimal_places=2, help_text="Length in meters")
    vessel_draft = models.DecimalField(max_digits=6, decimal_places=2, help_text="Draft in meters")
    vessel_capacity = models.IntegerField(help_text="Capacity in TEU / DWT")
    vessel_status = models.CharField(max_length=30, choices=VESSEL_STATUS_CHOICES, default='ACTIVE')
    vessel_created_at = models.DateTimeField(auto_now_add=True)
    vessel_updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_vessel'
        verbose_name = 'Vessel'
        verbose_name_plural = 'Vessels'

    def __str__(self):
        return f"{self.vessel_name} (IMO: {self.vessel_imo_number})"


class VesselArrivalRequest(models.Model):
    STATUS_CHOICES = (
        ('PENDING', 'Pending Review'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    )

    vessel_arrival_request_id = models.BigAutoField(primary_key=True)
    vessel_arrival_request_vessel_id = models.ForeignKey(
        Vessel,
        on_delete=models.CASCADE,
        db_column='vessel_arrival_request_vessel_id',
        related_name='arrival_requests'
    )
    vessel_arrival_request_requested_arrival_at = models.DateTimeField()
    vessel_arrival_request_requested_departure_at = models.DateTimeField()
    vessel_arrival_request_cargo_type = models.CharField(max_length=100)
    vessel_arrival_request_cargo_quantity = models.DecimalField(max_digits=12, decimal_places=2)
    vessel_arrival_request_status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='PENDING')
    vessel_arrival_request_submitted_at = models.DateTimeField(auto_now_add=True)
    vessel_arrival_request_reviewed_at = models.DateTimeField(null=True, blank=True)
    vessel_arrival_request_reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='vessel_arrival_request_reviewed_by',
        related_name='reviewed_arrival_requests'
    )
    vessel_arrival_request_preferred_berth_id = models.ForeignKey(
        'Berth',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='vessel_arrival_request_preferred_berth_id',
        related_name='preferred_arrival_requests'
    )
    vessel_arrival_request_remarks = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'tbl_vessel_arrival_request'
        verbose_name = 'Vessel Arrival Request'
        verbose_name_plural = 'Vessel Arrival Requests'

    def __str__(self):
        return f"Arrival Request #{self.vessel_arrival_request_id} - {self.vessel_arrival_request_vessel_id.vessel_name} ({self.vessel_arrival_request_status})"


class Berth(models.Model):
    BERTH_TYPE_CHOICES = (
        ('CONTAINER_TERMINAL', 'Container Terminal'),
        ('BULK_CARGO', 'Bulk Cargo Terminal'),
        ('OIL_TANKER', 'Oil & Liquid Tanker'),
        ('GENERAL_CARGO', 'General Cargo Berth'),
        ('RO_RO', 'Ro-Ro Berth'),
        ('MULTI_PURPOSE', 'Multi-Purpose Berth'),
    )

    STATUS_CHOICES = (
        ('AVAILABLE', 'Available'),
        ('RESERVED', 'Reserved'),
        ('OCCUPIED', 'Occupied'),
        ('MAINTENANCE', 'Maintenance'),
        ('INACTIVE', 'Inactive'),
    )

    berth_id = models.BigAutoField(primary_key=True)
    berth_name = models.CharField(max_length=100, unique=True)
    berth_code = models.CharField(max_length=50, unique=True, null=True, blank=True)
    berth_type = models.CharField(max_length=50, choices=BERTH_TYPE_CHOICES, default='CONTAINER_TERMINAL')
    berth_max_length = models.DecimalField(max_digits=8, decimal_places=2, default=300.00, help_text="Max vessel length in meters")
    berth_max_draft = models.DecimalField(max_digits=6, decimal_places=2, default=14.50, help_text="Max draft in meters")
    berth_status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='AVAILABLE')
    berth_is_active = models.BooleanField(default=True)
    berth_created_at = models.DateTimeField(auto_now_add=True)
    berth_updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_berth'
        verbose_name = 'Berth'
        verbose_name_plural = 'Berths'

    def __str__(self):
        return f"{self.berth_name} ({self.berth_status})"


class VesselSchedule(models.Model):
    SCHEDULE_STATUS_CHOICES = (
        ('SCHEDULED', 'Scheduled'),
        ('ARRIVED', 'Arrived'),
        ('AT_BERTH', 'At Berth'),
        ('DEPARTED', 'Departed'),
    )

    vessel_schedule_id = models.BigAutoField(primary_key=True)
    vessel_schedule_arrival_request_id = models.OneToOneField(
        VesselArrivalRequest,
        on_delete=models.CASCADE,
        db_column='vessel_schedule_arrival_request_id',
        related_name='schedule'
    )
    vessel_schedule_berth_id = models.ForeignKey(
        Berth,
        on_delete=models.CASCADE,
        db_column='vessel_schedule_berth_id',
        related_name='schedules'
    )
    vessel_schedule_scheduled_arrival_at = models.DateTimeField()
    vessel_schedule_scheduled_departure_at = models.DateTimeField()
    vessel_schedule_actual_arrival_at = models.DateTimeField(null=True, blank=True)
    vessel_schedule_actual_at_berth_at = models.DateTimeField(null=True, blank=True)
    vessel_schedule_actual_departure_at = models.DateTimeField(null=True, blank=True)
    vessel_schedule_status = models.CharField(max_length=30, choices=SCHEDULE_STATUS_CHOICES, default='SCHEDULED')
    vessel_schedule_operational_remarks = models.TextField(null=True, blank=True)
    vessel_schedule_created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='vessel_schedule_created_by',
        related_name='created_schedules'
    )
    vessel_schedule_created_at = models.DateTimeField(auto_now_add=True)
    vessel_schedule_updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_vessel_schedule'
        verbose_name = 'Vessel Schedule'
        verbose_name_plural = 'Vessel Schedules'

    def __str__(self):
        return f"Schedule #{self.vessel_schedule_id} - Request #{self.vessel_schedule_arrival_request_id.vessel_arrival_request_id} ({self.vessel_schedule_status})"


class SystemSetting(models.Model):
    system_setting_id = models.BigAutoField(primary_key=True)
    system_setting_key = models.CharField(max_length=100, unique=True, db_index=True)
    system_setting_value = models.CharField(max_length=255)
    system_setting_description = models.TextField(null=True, blank=True)
    system_setting_updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_system_setting'
        verbose_name = 'System Setting'
        verbose_name_plural = 'System Settings'

    def __str__(self):
        return f"{self.system_setting_key}: {self.system_setting_value}"


def get_min_arrival_advance_days() -> int:
    try:
        setting = SystemSetting.objects.filter(system_setting_key='MIN_ARRIVAL_ADVANCE_DAYS').first()
        if setting and setting.system_setting_value:
            val = int(setting.system_setting_value.strip())
            if val >= 0:
                return val
    except Exception:
        pass
    return 0


class AuditLog(models.Model):
    CATEGORY_CHOICES = (
        ('AUTHENTICATION', 'Authentication'),
        ('USER_MANAGEMENT', 'User Management'),
        ('SHIPPING_COMPANY', 'Shipping Company'),
        ('VESSEL', 'Vessel'),
        ('ARRIVAL_REQUEST', 'Arrival Request'),
        ('BERTH', 'Berth'),
        ('CARGO', 'Cargo'),
        ('CONTAINER', 'Container'),
        ('CUSTOMS', 'Customs'),
        ('GATE_OPERATIONS', 'Gate Operations'),
        ('DELIVERY_TRACKING', 'Delivery Tracking'),
        ('YARD_MANAGEMENT', 'Yard Management'),
        ('YARD_ALLOCATION', 'Yard Allocation'),
        ('YARD_OPERATIONS', 'Yard Operations'),
        ('CRANE_MANAGEMENT', 'Crane Management'),
        ('UNLOADING_OPERATIONS', 'Unloading Operations'),
        ('DIRECT_TRANSFER', 'Direct Ship-to-Truck Transfer'),
        ('SYSTEM', 'System Core'),
    )

    STATUS_CHOICES = (
        ('SUCCESS', 'Success'),
        ('FAILED', 'Failed'),
    )

    audit_log_id = models.BigAutoField(primary_key=True)
    audit_log_timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    audit_log_user_id = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='audit_log_user_id',
        related_name='audit_logs',
        db_index=True
    )
    audit_log_actor_name = models.CharField(max_length=150, null=True, blank=True)
    audit_log_role = models.CharField(max_length=100, db_index=True)
    audit_log_action = models.CharField(max_length=100, db_index=True)
    audit_log_category = models.CharField(max_length=100, choices=CATEGORY_CHOICES, default='SYSTEM', db_index=True)
    audit_log_target_type = models.CharField(max_length=100, db_index=True)
    audit_log_target_id = models.CharField(max_length=100, null=True, blank=True)
    audit_log_description = models.TextField()
    audit_log_status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='SUCCESS', db_index=True)
    audit_log_ip_address = models.CharField(max_length=50, null=True, blank=True)

    class Meta:
        db_table = 'tbl_audit_log'
        verbose_name = 'Audit Log'
        verbose_name_plural = 'Audit Logs'
        ordering = ['-audit_log_timestamp', '-audit_log_id']

    def __str__(self):
        return f"[{self.audit_log_timestamp}] {self.audit_log_action} - {self.audit_log_category} ({self.audit_log_status})"


class Port(models.Model):
    port_id = models.BigAutoField(primary_key=True)
    port_code = models.CharField(max_length=10, unique=True, db_index=True, help_text="UN/LOCODE e.g. SGSIN, INBOM")
    port_name = models.CharField(max_length=150, unique=True)
    port_country = models.CharField(max_length=100)
    port_country_code = models.CharField(max_length=10, null=True, blank=True)
    port_is_active = models.BooleanField(default=True)
    port_created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'tbl_port'
        verbose_name = 'Port'
        verbose_name_plural = 'Ports'
        ordering = ['port_name']

    def __str__(self):
        return f"{self.port_name} ({self.port_code})"


class Cargo(models.Model):
    CARGO_TYPE_CHOICES = (
        ('CONTAINERIZED', 'Containerized'),
        ('GENERAL_CARGO', 'General Cargo'),
        ('BULK_CARGO', 'Bulk Cargo'),
    )

    CARGO_STATUS_CHOICES = (
        ('REGISTERED', 'Registered'),
        ('IN_PORT', 'In Port'),
        ('COMPLETED', 'Completed'),
    )

    CARGO_UNIT_CHOICES = (
        ('TEU', 'TEU'),
        ('FEU', 'FEU'),
        ('TONNES', 'Metric Tonnes'),
        ('KG', 'Kilograms'),
        ('UNITS', 'Units'),
        ('PACKAGES', 'Packages'),
    )

    CARGO_DIRECTION_CHOICES = (
        ('IMPORT', 'Import (Inbound)'),
        ('EXPORT', 'Export (Outbound)'),
    )

    cargo_id = models.BigAutoField(primary_key=True)
    cargo_arrival_request_id = models.ForeignKey(
        VesselArrivalRequest,
        on_delete=models.CASCADE,
        db_column='cargo_arrival_request_id',
        related_name='cargoes'
    )
    cargo_description = models.CharField(max_length=255)
    cargo_direction = models.CharField(
        max_length=20,
        choices=CARGO_DIRECTION_CHOICES,
        default='IMPORT',
        db_index=True,
        help_text="Trade direction: IMPORT for inbound ocean cargo, EXPORT for outbound carrier vessel loading"
    )
    cargo_type = models.CharField(max_length=50, choices=CARGO_TYPE_CHOICES, default='CONTAINERIZED')
    cargo_quantity = models.DecimalField(max_digits=12, decimal_places=2)
    cargo_unit = models.CharField(max_length=30, choices=CARGO_UNIT_CHOICES, default='TEU')
    cargo_weight = models.DecimalField(max_digits=12, decimal_places=2, help_text="Gross weight in metric tonnes")
    cargo_origin_port_id = models.ForeignKey(
        Port,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        db_column='cargo_origin_port_id',
        related_name='origin_cargoes'
    )
    cargo_destination_port_id = models.ForeignKey(
        Port,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        db_column='cargo_destination_port_id',
        related_name='destination_cargoes'
    )
    cargo_status = models.CharField(max_length=30, choices=CARGO_STATUS_CHOICES, default='REGISTERED')
    cargo_created_at = models.DateTimeField(auto_now_add=True)
    cargo_updated_at = models.DateTimeField(auto_now=True)

    # Property aliases for normalized relationship access
    @property
    def arrival_request(self):
        return self.cargo_arrival_request_id

    @property
    def vessel(self):
        return self.cargo_arrival_request_id.vessel_arrival_request_vessel_id if self.cargo_arrival_request_id else None

    @property
    def shipping_company(self):
        vessel = self.vessel
        return vessel.vessel_shipping_company_id if vessel else None

    @property
    def cargo_origin(self):
        return f"{self.cargo_origin_port_id.port_name} ({self.cargo_origin_port_id.port_code})" if self.cargo_origin_port_id else ""

    @property
    def cargo_destination(self):
        return f"{self.cargo_destination_port_id.port_name} ({self.cargo_destination_port_id.port_code})" if self.cargo_destination_port_id else ""

    class Meta:
        db_table = 'tbl_cargo'
        verbose_name = 'Cargo'
        verbose_name_plural = 'Cargoes'
        ordering = ['-cargo_created_at', '-cargo_id']

    def __str__(self):
        return f"Cargo #{self.cargo_id} - {self.cargo_description} ({self.cargo_type}) for Request #{self.cargo_arrival_request_id_id}"


class Container(models.Model):
    CONTAINER_TYPE_CHOICES = (
        ('20FT', '20 FT'),
        ('40FT', '40 FT'),
        ('40FT_HC', '40 FT High Cube'),
    )

    CONTAINER_STATUS_CHOICES = (
        ('REGISTERED', 'Registered'),
        ('ARRIVED', 'Arrived'),
        ('AT_TERMINAL', 'At Terminal'),
        ('AWAITING_CUSTOMS', 'Awaiting Customs'),
        ('UNDER_INSPECTION', 'Under Inspection'),
        ('CUSTOMS_HOLD', 'Customs Hold'),
        ('CLEARED', 'Cleared'),
        ('RELEASED', 'Released'),
        ('LOADED', 'Loaded on Vessel'),
    )

    container_id = models.BigAutoField(primary_key=True)
    container_cargo_id = models.ForeignKey(
        Cargo,
        on_delete=models.CASCADE,
        db_column='container_cargo_id',
        related_name='containers'
    )
    container_number = models.CharField(max_length=20, unique=True, db_index=True)
    container_type = models.CharField(max_length=50, choices=CONTAINER_TYPE_CHOICES, default='20FT')
    container_gross_weight = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        help_text="Gross weight in metric tonnes"
    )
    container_status = models.CharField(
        max_length=30, 
        choices=CONTAINER_STATUS_CHOICES, 
        default='REGISTERED', 
        db_index=True
    )
    CUSTOMS_STATUS_CHOICES = (
        ('NOT_SUBMITTED', 'Not Submitted'),
        ('PENDING_REVIEW', 'Pending Review'),
        ('ADDITIONAL_INFORMATION_REQUIRED', 'Additional Information Required'),
        ('UNDER_INSPECTION', 'Under Inspection'),
        ('CUSTOMS_HOLD', 'Customs Hold'),
        ('CLEARED', 'Cleared'),
    )
    container_customs_status = models.CharField(
        max_length=50,
        choices=CUSTOMS_STATUS_CHOICES,
        default='NOT_SUBMITTED',
        db_index=True,
        help_text="Customs clearance status maintained independently from physical container location"
    )
    DELIVERY_STATUS_CHOICES = (
        ('NOT_APPLICABLE', 'Not Applicable'),
        ('RELEASED', 'Released'),
        ('GATE_PASS_GENERATED', 'Gate Pass Generated'),
        ('PICKED_UP', 'Picked Up'),
        ('DEPARTED_PORT', 'Departed Port'),
        ('IN_TRANSIT', 'In Transit'),
        ('OUT_FOR_DELIVERY', 'Out for Delivery'),
        ('DELIVERED', 'Delivered'),
        ('DELIVERY_EXCEPTION', 'Delivery Exception'),
    )
    container_delivery_status = models.CharField(
        max_length=50,
        choices=DELIVERY_STATUS_CHOICES,
        default='NOT_APPLICABLE',
        db_index=True
    )
    container_delivery_destination = models.CharField(max_length=255, blank=True, default='')
    container_delivery_location = models.CharField(max_length=200, blank=True, default='')
    container_delivery_recipient = models.CharField(max_length=150, blank=True, default='')
    container_expected_delivery_date = models.DateTimeField(null=True, blank=True)
    container_delivered_at = models.DateTimeField(null=True, blank=True)
    container_delivered_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='container_delivered_by',
        related_name='delivered_containers'
    )
    container_delivery_remarks = models.TextField(null=True, blank=True)
    container_created_at = models.DateTimeField(auto_now_add=True)
    container_updated_at = models.DateTimeField(auto_now=True)

    @property
    def cargo(self):
        return self.container_cargo_id

    @property
    def arrival_request(self):
        return self.cargo.cargo_arrival_request_id if self.cargo else None

    @property
    def vessel(self):
        return self.cargo.vessel if self.cargo else None

    @property
    def shipping_company(self):
        return self.cargo.shipping_company if self.cargo else None

    @property
    def trade_direction(self) -> str:
        return self.cargo.cargo_direction if self.cargo else 'IMPORT'

    @property
    def teu_equivalent(self) -> float:
        if self.container_type in ['40FT', '40FT_HC']:
            return 2.0
        return 1.0

    @property
    def latest_customs_inspection(self):
        return self.customs_inspections.order_by('-customs_inspection_started_at', '-customs_inspection_id').first()

    @property
    def latest_customs_declaration(self):
        return self.customs_declarations.order_by('-declaration_submitted_at', '-declaration_id').first()

    @property
    def is_customs_cleared(self) -> bool:
        if self.container_customs_status == 'CLEARED':
            return True
        if self.container_status == 'CLEARED':
            return True
        inspection = self.latest_customs_inspection
        return bool(inspection and inspection.customs_inspection_result == 'CLEARED')

    @property
    def active_direct_transfer(self):
        return self.direct_transfers.filter(
            transfer_status__in=['INITIATED', 'IN_PROGRESS', 'TRANSFERRED_TO_TRUCK', 'AWAITING_GATE_EXIT']
        ).select_related(
            'transfer_truck_id', 'transfer_driver_id', 'transfer_crane_id', 'transfer_gate_pass_id'
        ).first()

    @property
    def latest_gate_release(self):
        return self.gate_releases.order_by('-gate_release_time', '-gate_release_id').first()

    @property
    def latest_gate_pass(self):
        assoc = self.gate_pass_associations.order_by('-gate_pass_container_created_at', '-gate_pass_container_id').first()
        return assoc.gate_pass_container_gate_pass_id if assoc else None

    @property
    def latest_tracking_event(self):
        return self.tracking_events.order_by('-tracking_event_timestamp', '-tracking_event_id').first()

    @property
    def active_yard_allocation(self):
        return self.yard_allocations.filter(yard_allocation_status='ACTIVE').select_related(
            'yard_allocation_slot_id__yard_slot_block_id__yard_block_yard_id',
            'yard_allocation_allocated_by_id'
        ).first()

    @property
    def current_yard_location(self):
        alloc = self.active_yard_allocation
        if alloc and alloc.yard_allocation_slot_id:
            slot = alloc.yard_allocation_slot_id
            block = slot.yard_slot_block_id
            yard = block.yard_block_yard_id
            return {
                'allocation_id': alloc.yard_allocation_id,
                'container_number': self.container_number,
                'yard_id': yard.yard_id,
                'yard_name': yard.yard_name,
                'yard_code': yard.yard_code,
                'block_id': block.yard_block_id,
                'block_name': block.yard_block_name,
                'block_code': block.yard_block_code,
                'slot_id': slot.yard_slot_id,
                'slot_code': slot.yard_slot_code,
                'slot_row': slot.yard_slot_row,
                'slot_bay': slot.yard_slot_bay,
                'slot_tier': slot.yard_slot_tier,
                'storage_status': 'STORED',
                'storage_status_display': 'Currently Stored',
                'location_display': f"{yard.yard_code} / {block.yard_block_code} / {slot.yard_slot_code}",
                'allocated_at': alloc.yard_allocation_allocated_at.isoformat() if alloc.yard_allocation_allocated_at else None,
                'allocated_by_name': alloc.allocated_by.user_full_name if alloc.allocated_by else 'Terminal Operator'
            }
        return None

    @property
    def latest_yard_movement(self):
        return self.yard_movements.order_by('-yard_movement_timestamp', '-yard_movement_id').first()

    @property
    def storage_status(self) -> str:
        if self.active_yard_allocation:
            return 'STORED'
        if self.yard_allocations.filter(yard_allocation_status='RELEASED').exists():
            return 'RELEASED'
        return 'NOT_ALLOCATED'

    @property
    def storage_status_display(self) -> str:
        status_map = {
            'STORED': 'Currently Stored',
            'RELEASED': 'Released from Yard',
            'NOT_ALLOCATED': 'Not Allocated'
        }
        return status_map.get(self.storage_status, 'Not Allocated')

    class Meta:
        db_table = 'tbl_container'
        verbose_name = 'Container'
        verbose_name_plural = 'Containers'
        ordering = ['-container_created_at', '-container_id']

    def __str__(self):
        return f"Container {self.container_number} ({self.container_type}) - {self.container_status} [Cargo #{self.container_cargo_id_id}]"


class CustomsInspection(models.Model):
    STATUS_CHOICES = (
        ('PENDING', 'Pending Inspection'),
        ('IN_PROGRESS', 'Under Inspection'),
        ('COMPLETED', 'Completed'),
        ('ON_HOLD', 'On Hold'),
    )

    RESULT_CHOICES = (
        ('CLEARED', 'Cleared'),
        ('HOLD', 'Customs Hold'),
    )

    DOC_STATUS_CHOICES = (
        ('PENDING', 'Pending Verification'),
        ('VERIFIED', 'Verified'),
        ('ISSUE_FOUND', 'Issue Found'),
    )

    HOLD_REASON_CHOICES = (
        ('DOCUMENTATION_ISSUE', 'Documentation issue'),
        ('CARGO_MISMATCH', 'Cargo mismatch'),
        ('WEIGHT_DISCREPANCY', 'Weight discrepancy'),
        ('INSPECTION_ISSUE', 'Inspection issue'),
        ('OTHER', 'Other'),
    )

    customs_inspection_id = models.BigAutoField(primary_key=True)
    customs_inspection_container_id = models.ForeignKey(
        Container,
        on_delete=models.CASCADE,
        db_column='customs_inspection_container_id',
        related_name='customs_inspections'
    )
    customs_inspection_officer_id = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='customs_inspection_officer_id',
        related_name='customs_inspections'
    )
    customs_inspection_status = models.CharField(
        max_length=50,
        choices=STATUS_CHOICES,
        default='IN_PROGRESS',
        db_index=True
    )
    customs_inspection_result = models.CharField(
        max_length=50,
        choices=RESULT_CHOICES,
        null=True,
        blank=True,
        db_index=True
    )
    customs_inspection_document_status = models.CharField(
        max_length=50,
        choices=DOC_STATUS_CHOICES,
        default='PENDING'
    )
    customs_inspection_remarks = models.TextField(null=True, blank=True)
    customs_inspection_hold_reason = models.CharField(
        max_length=100,
        choices=HOLD_REASON_CHOICES,
        null=True,
        blank=True
    )
    customs_inspection_started_at = models.DateTimeField(default=timezone.now)
    customs_inspection_completed_at = models.DateTimeField(null=True, blank=True)
    customs_inspection_clearance_date = models.DateTimeField(null=True, blank=True)
    customs_inspection_created_at = models.DateTimeField(auto_now_add=True)
    customs_inspection_updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_customs_inspection'
        verbose_name = 'Customs Inspection'
        verbose_name_plural = 'Customs Inspections'
        ordering = ['-customs_inspection_started_at', '-customs_inspection_id']

    def __str__(self):
        return f"Customs Inspection #{self.customs_inspection_id} for Container {self.customs_inspection_container_id.container_number} ({self.customs_inspection_status})"


class Truck(models.Model):
    TRUCK_STATUS_CHOICES = (
        ('ACTIVE', 'Active'),
        ('MAINTENANCE', 'Under Maintenance'),
        ('INACTIVE', 'Inactive'),
    )

    truck_id = models.BigAutoField(primary_key=True)
    truck_number = models.CharField(max_length=50, unique=True, db_index=True)
    truck_company_name = models.CharField(max_length=150, null=True, blank=True)
    truck_status = models.CharField(max_length=30, choices=TRUCK_STATUS_CHOICES, default='ACTIVE')
    truck_created_at = models.DateTimeField(auto_now_add=True)
    truck_updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_truck'
        verbose_name = 'Truck'
        verbose_name_plural = 'Trucks'
        ordering = ['truck_number']

    def __str__(self):
        return f"{self.truck_number} ({self.truck_company_name or 'Independent'})"


class Driver(models.Model):
    DRIVER_STATUS_CHOICES = (
        ('ACTIVE', 'Active'),
        ('SUSPENDED', 'Suspended'),
        ('INACTIVE', 'Inactive'),
    )

    driver_id = models.BigAutoField(primary_key=True)
    driver_name = models.CharField(max_length=150)
    driver_license_number = models.CharField(max_length=100, unique=True, db_index=True)
    driver_phone = models.CharField(max_length=50)
    driver_email = models.EmailField(max_length=255)
    driver_status = models.CharField(max_length=30, choices=DRIVER_STATUS_CHOICES, default='ACTIVE')
    driver_created_at = models.DateTimeField(auto_now_add=True)
    driver_updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_driver'
        verbose_name = 'Driver'
        verbose_name_plural = 'Drivers'
        ordering = ['driver_name']

    def __str__(self):
        return f"{self.driver_name} ({self.driver_license_number})"


class Gate(models.Model):
    GATE_TYPE_CHOICES = (
        ('INBOUND', 'Inbound Gate'),
        ('OUTBOUND', 'Outbound Gate'),
        ('BIDIRECTIONAL', 'Bi-Directional Gate'),
    )

    gate_id = models.BigAutoField(primary_key=True)
    gate_name = models.CharField(max_length=150, unique=True)
    gate_code = models.CharField(max_length=50, unique=True, db_index=True)
    gate_type = models.CharField(max_length=50, choices=GATE_TYPE_CHOICES, default='OUTBOUND')
    gate_is_active = models.BooleanField(default=True)
    gate_created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'tbl_gate'
        verbose_name = 'Port Gate'
        verbose_name_plural = 'Port Gates'
        ordering = ['gate_name']

    def __str__(self):
        return f"{self.gate_name} ({self.gate_code})"


class GatePass(models.Model):
    GATE_PASS_STATUS_CHOICES = (
        ('ACTIVE', 'Active'),
        ('USED', 'Used'),
        ('EXPIRED', 'Expired'),
        ('CANCELLED', 'Cancelled'),
    )

    GATE_PASS_TYPE_CHOICES = (
        ('STANDARD_YARD', 'Standard Yard Pickup'),
        ('DIRECT_TRANSFER', 'Direct Ship-to-Truck Transfer'),
    )

    EMAIL_STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('SENT', 'Sent'),
        ('FAILED', 'Failed'),
    )

    gate_pass_id = models.BigAutoField(primary_key=True)
    gate_pass_pass_number = models.CharField(max_length=50, unique=True, db_index=True)
    gate_pass_movement_number = models.CharField(max_length=50, unique=True, db_index=True)
    gate_pass_truck_id = models.ForeignKey(
        Truck,
        on_delete=models.PROTECT,
        db_column='gate_pass_truck_id',
        related_name='gate_passes'
    )
    gate_pass_driver_id = models.ForeignKey(
        Driver,
        on_delete=models.PROTECT,
        db_column='gate_pass_driver_id',
        related_name='gate_passes'
    )
    gate_pass_gate_id = models.ForeignKey(
        Gate,
        on_delete=models.PROTECT,
        db_column='gate_pass_gate_id',
        related_name='gate_passes'
    )
    gate_pass_issued_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='gate_pass_issued_by',
        related_name='issued_gate_passes'
    )
    gate_pass_status = models.CharField(
        max_length=30,
        choices=GATE_PASS_STATUS_CHOICES,
        default='ACTIVE',
        db_index=True
    )
    gate_pass_type = models.CharField(
        max_length=30,
        choices=GATE_PASS_TYPE_CHOICES,
        default='STANDARD_YARD',
        db_index=True,
        help_text="Pickup type distinguishing standard yard collection from direct quayside ship-to-truck discharge"
    )
    gate_pass_verification_code = models.CharField(max_length=100, unique=True, db_index=True)
    gate_pass_qr_code = models.TextField(help_text="Safe QR verification payload reference")
    gate_pass_issued_at = models.DateTimeField(default=timezone.now)
    gate_pass_valid_until = models.DateTimeField(db_index=True)
    gate_pass_verified_at = models.DateTimeField(null=True, blank=True)
    gate_pass_used_at = models.DateTimeField(null=True, blank=True)
    gate_pass_cancelled_at = models.DateTimeField(null=True, blank=True)
    gate_pass_remarks = models.TextField(null=True, blank=True)
    gate_pass_email_status = models.CharField(max_length=30, choices=EMAIL_STATUS_CHOICES, default='PENDING')
    gate_pass_email_sent_at = models.DateTimeField(null=True, blank=True)
    gate_pass_email_error = models.TextField(null=True, blank=True)
    gate_pass_created_at = models.DateTimeField(auto_now_add=True)
    gate_pass_updated_at = models.DateTimeField(auto_now=True)

    @property
    def is_valid(self):
        return self.gate_pass_status == 'ACTIVE' and timezone.now() <= self.gate_pass_valid_until

    class Meta:
        db_table = 'tbl_gate_pass'
        verbose_name = 'Digital Gate Pass'
        verbose_name_plural = 'Digital Gate Passes'
        ordering = ['-gate_pass_created_at', '-gate_pass_id']

    def __str__(self):
        return f"Gate Pass {self.gate_pass_pass_number} ({self.gate_pass_status}) - Truck: {self.gate_pass_truck_id.truck_number}"


class GatePassContainer(models.Model):
    gate_pass_container_id = models.BigAutoField(primary_key=True)
    gate_pass_container_gate_pass_id = models.ForeignKey(
        GatePass,
        on_delete=models.CASCADE,
        db_column='gate_pass_container_gate_pass_id',
        related_name='containers'
    )
    gate_pass_container_container_id = models.ForeignKey(
        Container,
        on_delete=models.PROTECT,
        db_column='gate_pass_container_container_id',
        related_name='gate_pass_associations'
    )
    gate_pass_container_created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'tbl_gate_pass_container'
        verbose_name = 'Gate Pass Container'
        verbose_name_plural = 'Gate Pass Containers'
        unique_together = ('gate_pass_container_gate_pass_id', 'gate_pass_container_container_id')
        ordering = ['gate_pass_container_id']

    def __str__(self):
        return f"Gate Pass {self.gate_pass_container_gate_pass_id.gate_pass_pass_number} -> Container {self.gate_pass_container_container_id.container_number}"


class GateRelease(models.Model):
    gate_release_id = models.BigAutoField(primary_key=True)
    gate_release_container_id = models.ForeignKey(
        Container,
        on_delete=models.CASCADE,
        db_column='gate_release_container_id',
        related_name='gate_releases'
    )
    gate_release_gate_pass_id = models.ForeignKey(
        GatePass,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='gate_release_gate_pass_id',
        related_name='gate_releases'
    )
    gate_release_officer_id = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='gate_release_officer_id',
        related_name='gate_releases'
    )
    gate_release_previous_status = models.CharField(
        max_length=50,
        default='CLEARED'
    )
    gate_release_new_status = models.CharField(
        max_length=50,
        default='RELEASED'
    )
    gate_release_truck_number = models.CharField(
        max_length=50,
        help_text="Truck Number / Registration Number"
    )
    gate_release_driver_name = models.CharField(
        max_length=150,
        help_text="Driver Name"
    )
    gate_release_driver_license = models.CharField(
        max_length=100,
        help_text="Driver Identification / License Reference"
    )
    gate_release_exit_point = models.CharField(
        max_length=100,
        help_text="Gate / Exit Point"
    )
    gate_release_remarks = models.TextField(null=True, blank=True)
    gate_release_time = models.DateTimeField(default=timezone.now, db_index=True)
    gate_release_created_at = models.DateTimeField(auto_now_add=True)
    gate_release_updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_gate_release'
        verbose_name = 'Gate Release'
        verbose_name_plural = 'Gate Releases'
        ordering = ['-gate_release_time', '-gate_release_id']

    def __str__(self):
        return f"Gate Release #{self.gate_release_id} for Container {self.gate_release_container_id.container_number} (Truck: {self.gate_release_truck_number})"


class ContainerTrackingEvent(models.Model):
    TRACKING_STATUS_CHOICES = (
        ('RELEASED', 'Released'),
        ('GATE_PASS_GENERATED', 'Gate Pass Generated'),
        ('PICKED_UP', 'Picked Up'),
        ('DEPARTED_PORT', 'Departed Port'),
        ('IN_TRANSIT', 'In Transit'),
        ('OUT_FOR_DELIVERY', 'Out for Delivery'),
        ('DELIVERED', 'Delivered'),
        ('DELIVERY_EXCEPTION', 'Delivery Exception'),
        ('LOADED_ON_VESSEL', 'Loaded on Vessel'),
    )

    tracking_event_id = models.BigAutoField(primary_key=True)
    tracking_event_container_id = models.ForeignKey(
        Container,
        on_delete=models.CASCADE,
        db_column='tracking_event_container_id',
        related_name='tracking_events'
    )
    tracking_event_gate_pass_id = models.ForeignKey(
        GatePass,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='tracking_event_gate_pass_id',
        related_name='tracking_events'
    )
    tracking_event_status = models.CharField(
        max_length=50,
        choices=TRACKING_STATUS_CHOICES,
        db_index=True
    )
    tracking_event_timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    tracking_event_location = models.CharField(max_length=200, default='Port Terminal')
    tracking_event_description = models.TextField(null=True, blank=True)
    tracking_event_exception_reason = models.CharField(max_length=100, null=True, blank=True)
    tracking_event_updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='tracking_event_updated_by',
        related_name='recorded_tracking_events'
    )
    tracking_event_created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'tbl_container_tracking_event'
        verbose_name = 'Container Tracking Event'
        verbose_name_plural = 'Container Tracking Events'
        ordering = ['-tracking_event_timestamp', '-tracking_event_id']

    def __str__(self):
        return f"Tracking Event #{self.tracking_event_id} - {self.tracking_event_container_id.container_number} ({self.tracking_event_status})"


# ==============================================================================
# PHASE T1 — YARD MASTER MANAGEMENT MODELS
# ==============================================================================

class Yard(models.Model):
    """
    Port Storage Yard Master Model.
    Represents physical yards inside the container terminal.
    Follows normalized 3NF architecture with tbl_yard and prefix yard_.
    """
    YARD_TYPE_CHOICES = (
        ('CONTAINER_YARD', 'Container Yard'),
        ('EMPTY_CONTAINER_YARD', 'Empty Container Yard'),
        ('REEFER_YARD', 'Reefer Yard'),
        ('GENERAL_STORAGE', 'General Storage'),
    )

    YARD_STATUS_CHOICES = (
        ('ACTIVE', 'Active'),
        ('INACTIVE', 'Inactive'),
    )

    yard_id = models.BigAutoField(primary_key=True)
    yard_name = models.CharField(max_length=100)
    yard_code = models.CharField(max_length=50, unique=True, db_index=True)
    yard_type = models.CharField(max_length=50, choices=YARD_TYPE_CHOICES, default='CONTAINER_YARD')
    yard_status = models.CharField(max_length=20, choices=YARD_STATUS_CHOICES, default='ACTIVE', db_index=True)
    yard_capacity = models.PositiveIntegerField(default=100)
    yard_occupied = models.PositiveIntegerField(default=0)
    yard_created_at = models.DateTimeField(auto_now_add=True)
    yard_updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_yard'
        verbose_name = 'Yard'
        verbose_name_plural = 'Yards'
        ordering = ['yard_code', 'yard_id']

    @property
    def available_capacity(self) -> int:
        return max(0, self.yard_capacity - self.yard_occupied)

    @property
    def occupancy_percentage(self) -> float:
        if self.yard_capacity > 0:
            return round((self.yard_occupied / self.yard_capacity) * 100.0, 2)
        return 0.0

    @property
    def is_operational(self) -> bool:
        return self.yard_status == 'ACTIVE'

    def clean(self):
        super().clean()
        if self.yard_capacity is None or self.yard_capacity <= 0:
            raise ValidationError({'yard_capacity': 'Yard capacity must be a positive integer greater than zero.'})
        if self.yard_occupied is not None and self.yard_occupied < 0:
            raise ValidationError({'yard_occupied': 'Occupied capacity cannot be negative.'})
        if self.yard_occupied is not None and self.yard_occupied > self.yard_capacity:
            raise ValidationError({'yard_occupied': 'Occupied capacity cannot exceed total yard capacity.'})

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.yard_name} ({self.yard_code}) - {self.yard_status}"


class YardBlock(models.Model):
    """
    Yard Block Master Model.
    Each yard contains multiple functional container storage blocks.
    Follows normalized 3NF architecture with tbl_yard_block and prefix yard_block_.
    """
    BLOCK_TYPE_CHOICES = (
        ('STANDARD', 'Standard Container Block'),
        ('REEFER', 'Reefer Block'),
        ('EMPTY', 'Empty Container Block'),
        ('HAZMAT', 'Hazardous Materials Block'),
        ('GENERAL', 'General Cargo Block'),
    )

    BLOCK_STATUS_CHOICES = (
        ('ACTIVE', 'Active'),
        ('INACTIVE', 'Inactive'),
    )

    yard_block_id = models.BigAutoField(primary_key=True)
    yard_block_yard_id = models.ForeignKey(
        Yard,
        on_delete=models.CASCADE,
        db_column='yard_block_yard_id',
        related_name='blocks'
    )
    yard_block_name = models.CharField(max_length=100)
    yard_block_code = models.CharField(max_length=50)
    yard_block_type = models.CharField(max_length=50, choices=BLOCK_TYPE_CHOICES, default='STANDARD')
    yard_block_status = models.CharField(max_length=20, choices=BLOCK_STATUS_CHOICES, default='ACTIVE', db_index=True)
    yard_block_capacity = models.PositiveIntegerField(default=50)
    yard_block_occupied = models.PositiveIntegerField(default=0)
    yard_block_created_at = models.DateTimeField(auto_now_add=True)
    yard_block_updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_yard_block'
        verbose_name = 'Yard Block'
        verbose_name_plural = 'Yard Blocks'
        unique_together = [('yard_block_yard_id', 'yard_block_code')]
        ordering = ['yard_block_code', 'yard_block_id']

    @property
    def yard(self):
        return self.yard_block_yard_id

    @property
    def available_capacity(self) -> int:
        return max(0, self.yard_block_capacity - self.yard_block_occupied)

    @property
    def occupancy_percentage(self) -> float:
        if self.yard_block_capacity > 0:
            return round((self.yard_block_occupied / self.yard_block_capacity) * 100.0, 2)
        return 0.0

    @property
    def is_operational(self) -> bool:
        return self.yard_block_status == 'ACTIVE' and self.yard_block_yard_id.yard_status == 'ACTIVE'

    def clean(self):
        super().clean()
        if self.yard_block_capacity is None or self.yard_block_capacity <= 0:
            raise ValidationError({'yard_block_capacity': 'Block capacity must be a positive integer greater than zero.'})
        if self.yard_block_occupied is not None and self.yard_block_occupied < 0:
            raise ValidationError({'yard_block_occupied': 'Occupied capacity cannot be negative.'})
        if self.yard_block_occupied is not None and self.yard_block_occupied > self.yard_block_capacity:
            raise ValidationError({'yard_block_occupied': 'Occupied capacity cannot exceed total block capacity.'})

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Block {self.yard_block_code} ({self.yard_block_name}) - Yard {self.yard_block_yard_id.yard_code}"


class YardSlot(models.Model):
    """
    Yard Slot Master Model.
    Each block contains individual coordinate-based storage slots (Row, Bay, Tier).
    Follows normalized 3NF architecture with tbl_yard_slot and prefix yard_slot_.
    Phase T1 only: container relationships and allocation logic are omitted.
    """
    SLOT_STATUS_CHOICES = (
        ('AVAILABLE', 'Available'),
        ('OCCUPIED', 'Occupied'),
        ('RESERVED', 'Reserved'),
        ('BLOCKED', 'Blocked'),
        ('INACTIVE', 'Inactive'),
    )

    yard_slot_id = models.BigAutoField(primary_key=True)
    yard_slot_block_id = models.ForeignKey(
        YardBlock,
        on_delete=models.CASCADE,
        db_column='yard_slot_block_id',
        related_name='slots'
    )
    yard_slot_code = models.CharField(max_length=50)
    yard_slot_row = models.PositiveIntegerField()
    yard_slot_bay = models.PositiveIntegerField()
    yard_slot_tier = models.PositiveIntegerField()
    yard_slot_status = models.CharField(max_length=20, choices=SLOT_STATUS_CHOICES, default='AVAILABLE', db_index=True)
    yard_slot_created_at = models.DateTimeField(auto_now_add=True)
    yard_slot_updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_yard_slot'
        verbose_name = 'Yard Slot'
        verbose_name_plural = 'Yard Slots'
        unique_together = [('yard_slot_block_id', 'yard_slot_code')]
        ordering = ['yard_slot_row', 'yard_slot_bay', 'yard_slot_tier', 'yard_slot_id']

    @property
    def block(self):
        return self.yard_slot_block_id

    @property
    def is_allocatable(self) -> bool:
        if self.yard_slot_status in ['INACTIVE', 'BLOCKED']:
            return False
        if not self.yard_slot_block_id.is_operational:
            return False
        return self.yard_slot_status == 'AVAILABLE'

    def clean(self):
        super().clean()
        if self.yard_slot_row is None or self.yard_slot_row <= 0:
            raise ValidationError({'yard_slot_row': 'Row number must be a valid positive integer greater than zero.'})
        if self.yard_slot_bay is None or self.yard_slot_bay <= 0:
            raise ValidationError({'yard_slot_bay': 'Bay number must be a valid positive integer greater than zero.'})
        if self.yard_slot_tier is None or self.yard_slot_tier <= 0:
            raise ValidationError({'yard_slot_tier': 'Tier number must be a valid positive integer greater than zero.'})

        # Slot occupancy integrity: if an active container allocation exists, slot must remain OCCUPIED
        if self.pk:
            has_active_alloc = self.allocations.filter(yard_allocation_status='ACTIVE').exists()
            if has_active_alloc and self.yard_slot_status != 'OCCUPIED':
                raise ValidationError({
                    'yard_slot_status': f"Cannot set slot {self.yard_slot_code} to {self.yard_slot_status} while an active container allocation exists. The container must be relocated or released first."
                })

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    @property
    def active_allocation(self):
        return self.allocations.filter(yard_allocation_status='ACTIVE').first()

    def __str__(self):
        return f"Slot {self.yard_slot_code} ({self.yard_slot_status}) - Block {self.yard_slot_block_id.yard_block_code}"


# ==============================================================================
# PHASE T2 — CONTAINER YARD ALLOCATION & STORAGE MODELS
# ==============================================================================

class YardAllocation(models.Model):
    """
    Container Yard Allocation & Storage Model.
    Represents the operational allocation and physical placement of a container
    into an individual yard slot (Row, Bay, Tier) within the terminal.
    Follows normalized 3NF architecture with tbl_yard_allocation and prefix yard_allocation_.
    """
    STATUS_CHOICES = (
        ('ACTIVE', 'Active'),
        ('RELEASED', 'Released'),
    )

    yard_allocation_id = models.BigAutoField(primary_key=True)
    yard_allocation_container_id = models.ForeignKey(
        Container,
        on_delete=models.CASCADE,
        db_column='yard_allocation_container_id',
        related_name='yard_allocations'
    )
    yard_allocation_slot_id = models.ForeignKey(
        YardSlot,
        on_delete=models.PROTECT,
        db_column='yard_allocation_slot_id',
        related_name='allocations'
    )
    yard_allocation_status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='ACTIVE',
        db_index=True
    )
    yard_allocation_allocated_at = models.DateTimeField(default=timezone.now)
    yard_allocation_allocated_by_id = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='yard_allocation_allocated_by_id',
        related_name='allocated_yard_containers'
    )
    yard_allocation_released_at = models.DateTimeField(null=True, blank=True)
    yard_allocation_released_by_id = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='yard_allocation_released_by_id',
        related_name='released_yard_containers'
    )
    yard_allocation_crane_allocation_id = models.ForeignKey(
        'CraneAllocation',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='yard_allocation_crane_allocation_id',
        related_name='yard_allocations'
    )
    yard_allocation_remarks = models.TextField(blank=True, default='')
    yard_allocation_created_at = models.DateTimeField(auto_now_add=True)
    yard_allocation_updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_yard_allocation'
        verbose_name = 'Yard Allocation'
        verbose_name_plural = 'Yard Allocations'
        ordering = ['-yard_allocation_allocated_at', '-yard_allocation_id']
        constraints = [
            models.UniqueConstraint(
                fields=['yard_allocation_container_id'],
                condition=models.Q(yard_allocation_status='ACTIVE'),
                name='unique_active_container_yard_allocation'
            ),
            models.UniqueConstraint(
                fields=['yard_allocation_slot_id'],
                condition=models.Q(yard_allocation_status='ACTIVE'),
                name='unique_active_slot_yard_allocation'
            ),
        ]

    @property
    def container(self):
        return self.yard_allocation_container_id

    @property
    def slot(self):
        return self.yard_allocation_slot_id

    @property
    def block(self):
        return self.slot.yard_slot_block_id if self.slot else None

    @property
    def yard(self):
        return self.block.yard_block_yard_id if self.block else None

    @property
    def allocated_by(self):
        return self.yard_allocation_allocated_by_id

    @property
    def released_by(self):
        return self.yard_allocation_released_by_id

    @property
    def crane_allocation(self):
        return self.yard_allocation_crane_allocation_id

    @property
    def location_display(self) -> str:
        if self.yard and self.block and self.slot:
            return f"{self.yard.yard_code} / {self.block.yard_block_code} / {self.slot.yard_slot_code}"
        return "Unassigned"

    def clean(self):
        super().clean()
        if self.yard_allocation_status == 'ACTIVE':
            # Check slot is valid and operational
            if self.yard_allocation_slot_id:
                slot = self.yard_allocation_slot_id
                if slot.yard_slot_status not in ['AVAILABLE', 'OCCUPIED']:
                    raise ValidationError({'yard_allocation_slot_id': f"Slot {slot.yard_slot_code} is {slot.yard_slot_status} and not allocatable."})
                if not slot.block.is_operational:
                    raise ValidationError({'yard_allocation_slot_id': f"Slot {slot.yard_slot_code} belongs to an inactive block or yard."})

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Allocation #{self.yard_allocation_id} - {self.container.container_number} -> {self.slot.yard_slot_code} ({self.yard_allocation_status})"


# ==============================================================================
# PHASE T3 — YARD OPERATIONS MANAGEMENT MODELS
# ==============================================================================

class YardMovementHistory(models.Model):
    """
    Yard Movement History Model (Phase T3/T4 Integration).
    Preserves an append-only audit trail of every container vessel discharge and relocation between yard slots.
    Follows normalized 3NF architecture with tbl_yard_movement_history and prefix yard_movement_.
    """
    MOVEMENT_TYPE_CHOICES = (
        ('DISCHARGE', 'Vessel Discharge'),
        ('RELOCATION', 'Yard Relocation'),
        ('LOADING', 'Vessel Loading'),
        ('YARD_ALLOCATION', 'Yard Placement'),
    )

    yard_movement_id = models.BigAutoField(primary_key=True)
    yard_movement_container_id = models.ForeignKey(
        Container,
        on_delete=models.CASCADE,
        db_column='yard_movement_container_id',
        related_name='yard_movements'
    )
    yard_movement_from_slot_id = models.ForeignKey(
        YardSlot,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        db_column='yard_movement_from_slot_id',
        related_name='movements_from'
    )
    yard_movement_to_slot_id = models.ForeignKey(
        YardSlot,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        db_column='yard_movement_to_slot_id',
        related_name='movements_to'
    )
    yard_movement_movement_type = models.CharField(
        max_length=30,
        choices=MOVEMENT_TYPE_CHOICES,
        default='RELOCATION',
        db_index=True
    )
    yard_movement_crane_id = models.ForeignKey(
        'Crane',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='yard_movement_crane_id',
        related_name='yard_movements'
    )
    yard_movement_moved_by_id = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='yard_movement_moved_by_id',
        related_name='recorded_yard_movements'
    )
    yard_movement_timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    yard_movement_remarks = models.TextField(blank=True, default='')
    yard_movement_created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'tbl_yard_movement_history'
        verbose_name = 'Yard Movement History'
        verbose_name_plural = 'Yard Movement Histories'
        ordering = ['-yard_movement_timestamp', '-yard_movement_id']

    @property
    def container(self):
        return self.yard_movement_container_id

    @property
    def from_slot(self):
        return self.yard_movement_from_slot_id

    @property
    def to_slot(self):
        return self.yard_movement_to_slot_id

    @property
    def moved_by(self):
        return self.yard_movement_moved_by_id

    @property
    def movement_type(self):
        return self.yard_movement_movement_type

    @property
    def crane(self):
        return self.yard_movement_crane_id

    @property
    def from_location_display(self) -> str:
        if self.from_slot and self.from_slot.yard_slot_block_id:
            b = self.from_slot.yard_slot_block_id
            y = b.yard_block_yard_id
            return f"{y.yard_code} / {b.yard_block_code} / {self.from_slot.yard_slot_code}"
        if self.yard_movement_movement_type == 'DISCHARGE':
            return "Vessel (Discharge)"
        if self.yard_movement_movement_type == 'YARD_ALLOCATION':
            return "Gate-In / Yard Receiving"
        return "Initial Placement"

    @property
    def to_location_display(self) -> str:
        if self.to_slot and self.to_slot.yard_slot_block_id:
            b = self.to_slot.yard_slot_block_id
            y = b.yard_block_yard_id
            return f"{y.yard_code} / {b.yard_block_code} / {self.to_slot.yard_slot_code}"
        if self.yard_movement_movement_type == 'LOADING':
            return "Vessel (Loaded)"
        return "Unknown"

    def __str__(self):
        return f"Move #{self.yard_movement_id}: {self.container.container_number} -> {self.to_location_display} at {self.yard_movement_timestamp}"


class Crane(models.Model):
    """
    Port Crane Master Model (Phase T4.1).
    Represents heavy-duty lifting and container handling equipment in the terminal:
    Ship-to-Shore (STS) Quay Cranes, Rubber-Tyred Gantry (RTG) Cranes,
    Rail-Mounted Gantry (RMG) Cranes, and Mobile Harbour Cranes (MHC).
    Follows normalized 3NF architecture with tbl_crane and prefix crane_.
    """
    CRANE_TYPE_CHOICES = (
        ('STS', 'Ship-to-Shore (STS) Quay Crane'),
        ('RTG', 'Rubber-Tyred Gantry (RTG) Crane'),
        ('RMG', 'Rail-Mounted Gantry (RMG) Crane'),
        ('MHC', 'Mobile Harbour Crane (MHC)'),
    )

    CRANE_STATUS_CHOICES = (
        ('AVAILABLE', 'Available'),
        ('IN_USE', 'In Use'),
        ('MAINTENANCE', 'Maintenance'),
        ('INACTIVE', 'Inactive'),
    )

    crane_id = models.BigAutoField(primary_key=True)
    crane_code = models.CharField(max_length=50, unique=True, db_index=True)
    crane_name = models.CharField(max_length=150)
    crane_type = models.CharField(max_length=50, choices=CRANE_TYPE_CHOICES, default='STS', db_index=True)
    crane_max_lifting_capacity_mt = models.DecimalField(max_digits=8, decimal_places=2)
    crane_capacity_unit = models.CharField(max_length=20, default='MT')
    crane_status = models.CharField(max_length=30, choices=CRANE_STATUS_CHOICES, default='AVAILABLE', db_index=True)
    crane_assigned_berth_id = models.ForeignKey(
        'Berth',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='crane_assigned_berth_id',
        related_name='assigned_cranes'
    )
    crane_last_maintenance_date = models.DateField(null=True, blank=True)
    crane_next_maintenance_due = models.DateField(null=True, blank=True)
    crane_maintenance_remarks = models.TextField(null=True, blank=True)
    crane_is_active = models.BooleanField(default=True, db_index=True)
    crane_created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='crane_created_by',
        related_name='created_cranes'
    )
    crane_created_at = models.DateTimeField(auto_now_add=True)
    crane_updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_crane'
        verbose_name = 'Crane'
        verbose_name_plural = 'Cranes'
        ordering = ['crane_code']

    @property
    def assigned_berth(self):
        return self.crane_assigned_berth_id

    @property
    def is_operational(self) -> bool:
        return self.crane_is_active and self.crane_status not in ['MAINTENANCE', 'INACTIVE']

    @property
    def active_allocations(self):
        return self.allocations.filter(crane_allocation_status='ACTIVE')

    @property
    def scheduled_allocations(self):
        return self.allocations.filter(crane_allocation_status='SCHEDULED')

    def clean(self):
        super().clean()
        if self.crane_max_lifting_capacity_mt is not None and self.crane_max_lifting_capacity_mt <= 0:
            raise ValidationError({'crane_max_lifting_capacity_mt': "Rated lifting capacity must be a positive value greater than zero."})

    def __str__(self):
        return f"{self.crane_code} - {self.crane_name} ({self.get_crane_status_display()})"


class CraneAllocation(models.Model):
    """
    Crane Allocation & Assignment Model (Phase T4.2).
    Represents the operational assignment of a crane to a vessel schedule / berth operation
    (loading or unloading) across a planned time window.
    Follows normalized 3NF architecture with tbl_crane_allocation and prefix crane_allocation_.
    """
    OPERATION_TYPE_CHOICES = (
        ('UNLOADING', 'Unloading (Discharge)'),
        ('LOADING', 'Loading'),
        ('BOTH', 'Discharge & Loading'),
    )

    ALLOCATION_STATUS_CHOICES = (
        ('SCHEDULED', 'Scheduled'),
        ('ACTIVE', 'Active / In Progress'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    )

    crane_allocation_id = models.BigAutoField(primary_key=True)
    crane_allocation_crane_id = models.ForeignKey(
        Crane,
        on_delete=models.PROTECT,
        db_column='crane_allocation_crane_id',
        related_name='allocations'
    )
    crane_allocation_vessel_schedule_id = models.ForeignKey(
        VesselSchedule,
        on_delete=models.PROTECT,
        db_column='crane_allocation_vessel_schedule_id',
        related_name='crane_allocations'
    )
    crane_allocation_berth_id = models.ForeignKey(
        'Berth',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        db_column='crane_allocation_berth_id',
        related_name='crane_allocations'
    )
    crane_allocation_operation_type = models.CharField(
        max_length=30,
        choices=OPERATION_TYPE_CHOICES,
        default='UNLOADING',
        db_index=True
    )
    crane_allocation_status = models.CharField(
        max_length=30,
        choices=ALLOCATION_STATUS_CHOICES,
        default='SCHEDULED',
        db_index=True
    )
    crane_allocation_planned_start_at = models.DateTimeField(db_index=True)
    crane_allocation_planned_end_at = models.DateTimeField(db_index=True)
    crane_allocation_actual_start_at = models.DateTimeField(null=True, blank=True)
    crane_allocation_actual_end_at = models.DateTimeField(null=True, blank=True)
    crane_allocation_assigned_by_id = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='crane_allocation_assigned_by_id',
        related_name='assigned_crane_allocations'
    )
    crane_allocation_remarks = models.TextField(blank=True, default='')
    crane_allocation_created_at = models.DateTimeField(auto_now_add=True)
    crane_allocation_updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_crane_allocation'
        verbose_name = 'Crane Allocation'
        verbose_name_plural = 'Crane Allocations'
        ordering = ['-crane_allocation_planned_start_at', '-crane_allocation_id']

    @property
    def crane(self):
        return self.crane_allocation_crane_id

    @property
    def vessel_schedule(self):
        return self.crane_allocation_vessel_schedule_id

    @property
    def berth(self):
        return self.crane_allocation_berth_id

    @property
    def assigned_by(self):
        return self.crane_allocation_assigned_by_id

    def clean(self):
        super().clean()
        if self.crane_allocation_planned_start_at and self.crane_allocation_planned_end_at:
            if self.crane_allocation_planned_end_at <= self.crane_allocation_planned_start_at:
                raise ValidationError({
                    'crane_allocation_planned_end_at': "Planned end time must be strictly after planned start time."
                })

    def __str__(self):
        return f"Allocation #{self.crane_allocation_id}: {self.crane.crane_code} -> Schedule #{self.vessel_schedule.vessel_schedule_id} ({self.crane_allocation_status})"


# ==============================================================================
# PHASE T5 — PRE-ARRIVAL CUSTOMS, DELIVERY ORDERS & DIRECT SHIP-TO-TRUCK TRANSFER
# ==============================================================================

class PreArrivalCustomsDeclaration(models.Model):
    """
    Advance Pre-Arrival Customs Declaration and Document Model (Part A).
    Allows shipping lines / agents to submit manifest declaration references and
    regulatory documentation prior to vessel arrival at berth.
    Reviewed independently by authorized Customs Officers.
    """
    DECLARATION_STATUS_CHOICES = (
        ('PENDING_REVIEW', 'Pending Review'),
        ('ADDITIONAL_INFORMATION_REQUIRED', 'Additional Information Required'),
        ('UNDER_INSPECTION', 'Under Inspection'),
        ('CUSTOMS_HOLD', 'Customs Hold'),
        ('CLEARED', 'Cleared'),
    )

    declaration_id = models.BigAutoField(primary_key=True)
    declaration_reference = models.CharField(max_length=100, unique=True, db_index=True)
    declaration_container_id = models.ForeignKey(
        'Container',
        on_delete=models.CASCADE,
        db_column='declaration_container_id',
        related_name='customs_declarations'
    )
    declaration_vessel_schedule_id = models.ForeignKey(
        'VesselSchedule',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='declaration_vessel_schedule_id',
        related_name='customs_declarations'
    )
    declaration_cargo_id = models.ForeignKey(
        'Cargo',
        on_delete=models.CASCADE,
        db_column='declaration_cargo_id',
        related_name='customs_declarations'
    )
    declaration_shipping_company_id = models.ForeignKey(
        'ShippingCompany',
        on_delete=models.CASCADE,
        db_column='declaration_shipping_company_id',
        related_name='customs_declarations'
    )
    declaration_status = models.CharField(
        max_length=50,
        choices=DECLARATION_STATUS_CHOICES,
        default='PENDING_REVIEW',
        db_index=True
    )
    declaration_type = models.CharField(max_length=50, default='IMPORT_PRE_ARRIVAL')
    declaration_document = models.FileField(upload_to='customs_docs/declarations/', null=True, blank=True)
    declaration_document_name = models.CharField(max_length=255, blank=True, default='')
    declaration_notes = models.TextField(blank=True, default='')
    declaration_submitted_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='declaration_submitted_by',
        related_name='submitted_customs_declarations'
    )
    declaration_submitted_at = models.DateTimeField(default=timezone.now)
    declaration_reviewed_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='declaration_reviewed_by',
        related_name='reviewed_customs_declarations'
    )
    declaration_reviewed_at = models.DateTimeField(null=True, blank=True)
    declaration_review_remarks = models.TextField(blank=True, default='')
    declaration_hold_reason = models.CharField(
        max_length=100,
        choices=CustomsInspection.HOLD_REASON_CHOICES,
        null=True,
        blank=True
    )
    declaration_review_history = models.JSONField(default=list, blank=True)
    declaration_created_at = models.DateTimeField(auto_now_add=True)
    declaration_updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_pre_arrival_customs_declaration'
        verbose_name = 'Pre-Arrival Customs Declaration'
        verbose_name_plural = 'Pre-Arrival Customs Declarations'
        ordering = ['-declaration_submitted_at', '-declaration_id']

    @property
    def container(self):
        return self.declaration_container_id

    @property
    def vessel_schedule(self):
        return self.declaration_vessel_schedule_id

    @property
    def shipping_company(self):
        return self.declaration_shipping_company_id

    def __str__(self):
        return f"Declaration {self.declaration_reference} ({self.declaration_status}) - Container: {self.declaration_container_id.container_number}"


class CustomsDocument(models.Model):
    """
    Normal Post-Arrival & Pre-Arrival Customs Supporting Document Model.
    Tracks official trade and regulatory documents (Bill of Lading, Commercial Invoice,
    Packing List, Certificate of Origin, Import Declaration, etc.) submitted for a container.
    Maintains document verification lifecycle reviewed by authorized Customs Officers.
    """
    DOCUMENT_TYPE_CHOICES = (
        ('BILL_OF_LADING', 'Bill of Lading (B/L)'),
        ('COMMERCIAL_INVOICE', 'Commercial Invoice'),
        ('PACKING_LIST', 'Packing List'),
        ('CERTIFICATE_OF_ORIGIN', 'Certificate of Origin'),
        ('CUSTOMS_IMPORT_DECLARATION', 'Customs Import Declaration / Bill of Entry'),
        ('IMPORT_DECLARATION', 'Customs Import Declaration / Bill of Entry'),
        ('DELIVERY_ORDER', 'Delivery Order (DO)'),
        ('PHYTOSANITARY_CERTIFICATE', 'Phytosanitary Certificate'),
        ('HAZMAT_DECLARATION', 'Dangerous Goods / Hazmat Declaration'),
        ('OTHER', 'Other Supporting Document'),
    )

    WORKFLOW_TYPE_CHOICES = (
        ('NORMAL', 'Normal / Post-Arrival Customs'),
        ('PRE_ARRIVAL', 'Pre-Arrival Customs Declaration'),
    )

    REVIEW_STATUS_CHOICES = (
        ('PENDING', 'Pending Verification'),
        ('VERIFIED', 'Verified'),
        ('REJECTED', 'Rejected / Issue Found'),
        ('SUPERSEDED', 'Superseded by Replacement'),
        ('WITHDRAWN', 'Withdrawn / Deleted'),
    )

    document_id = models.BigAutoField(primary_key=True)
    document_container_id = models.ForeignKey(
        'Container',
        on_delete=models.CASCADE,
        db_column='document_container_id',
        related_name='customs_documents'
    )
    document_inspection_id = models.ForeignKey(
        'CustomsInspection',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='document_inspection_id',
        related_name='documents'
    )
    document_declaration_id = models.ForeignKey(
        'PreArrivalCustomsDeclaration',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='document_declaration_id',
        related_name='documents'
    )
    document_type = models.CharField(
        max_length=50,
        choices=DOCUMENT_TYPE_CHOICES,
        default='BILL_OF_LADING',
        db_index=True
    )
    workflow_type = models.CharField(
        max_length=30,
        choices=WORKFLOW_TYPE_CHOICES,
        default='NORMAL',
        db_index=True
    )
    document_file = models.FileField(upload_to='customs_docs/%Y/%m/')
    document_name = models.CharField(max_length=255)
    file_size = models.BigIntegerField(default=0)
    file_type = models.CharField(max_length=100, blank=True, default='')
    document_notes = models.TextField(blank=True, default='')
    document_version = models.PositiveIntegerField(default=1)
    document_is_active = models.BooleanField(default=True, db_index=True)
    document_replaced_by = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='previous_versions'
    )
    document_amendment_reason = models.TextField(blank=True, default='')
    document_uploaded_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='document_uploaded_by',
        related_name='uploaded_customs_documents'
    )
    document_uploaded_at = models.DateTimeField(default=timezone.now)
    document_review_status = models.CharField(
        max_length=30,
        choices=REVIEW_STATUS_CHOICES,
        default='PENDING',
        db_index=True
    )
    document_review_remarks = models.TextField(blank=True, default='')
    document_reviewed_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='document_reviewed_by',
        related_name='reviewed_customs_documents'
    )
    document_reviewed_at = models.DateTimeField(null=True, blank=True)
    document_created_at = models.DateTimeField(auto_now_add=True)
    document_updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_customs_document'
        verbose_name = 'Customs Supporting Document'
        verbose_name_plural = 'Customs Supporting Documents'
        ordering = ['-document_uploaded_at', '-document_id']

    @property
    def container(self):
        return self.document_container_id

    @property
    def formatted_file_size(self):
        if not self.file_size:
            return '0 KB'
        if self.file_size < 1024:
            return f"{self.file_size} B"
        elif self.file_size < 1024 * 1024:
            return f"{self.file_size / 1024:.1f} KB"
        else:
            return f"{self.file_size / (1024 * 1024):.1f} MB"

    def __str__(self):
        return f"{self.get_document_type_display()} - {self.document_name} ({self.document_container_id.container_number})"


class DeliveryOrder(models.Model):
    """
    Delivery Order (DO) / Delivery Authorization Model.
    Formal commercial and operational authorization issued by shipping lines or authorized agents,
    authorizing terminal release of an import container to a designated consignee/trucker.
    """
    DO_STATUS_CHOICES = (
        ('ISSUED', 'Issued / Approved'),
        ('EXPIRED', 'Expired'),
        ('CANCELLED', 'Cancelled / Revoked'),
    )

    delivery_order_id = models.BigAutoField(primary_key=True)
    delivery_order_number = models.CharField(max_length=100, unique=True, db_index=True)
    delivery_order_container_id = models.ForeignKey(
        'Container',
        on_delete=models.CASCADE,
        db_column='delivery_order_container_id',
        related_name='delivery_orders'
    )
    delivery_order_shipping_company_id = models.ForeignKey(
        'ShippingCompany',
        on_delete=models.CASCADE,
        db_column='delivery_order_shipping_company_id',
        related_name='delivery_orders'
    )
    delivery_order_consignee_name = models.CharField(max_length=200)
    delivery_order_status = models.CharField(
        max_length=30,
        choices=DO_STATUS_CHOICES,
        default='ISSUED',
        db_index=True
    )
    delivery_order_issue_date = models.DateTimeField(default=timezone.now)
    delivery_order_valid_until = models.DateTimeField()
    delivery_order_authorized_transporter = models.CharField(max_length=200, blank=True, default='')
    delivery_order_remarks = models.TextField(blank=True, default='')
    delivery_order_issued_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='delivery_order_issued_by',
        related_name='issued_delivery_orders'
    )
    delivery_order_created_at = models.DateTimeField(auto_now_add=True)
    delivery_order_updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_delivery_order'
        verbose_name = 'Delivery Order'
        verbose_name_plural = 'Delivery Orders'
        ordering = ['-delivery_order_issue_date', '-delivery_order_id']

    @property
    def is_valid(self) -> bool:
        return self.delivery_order_status == 'ISSUED' and timezone.now() <= self.delivery_order_valid_until

    @property
    def container(self):
        return self.delivery_order_container_id

    def __str__(self):
        return f"DO #{self.delivery_order_number} ({self.delivery_order_status}) - Container: {self.delivery_order_container_id.container_number}"


class DirectShipToTruckTransfer(models.Model):
    """
    Direct Ship-to-Truck Transfer Operation Model (Part C).
    Coordinates immediate discharge from vessel quayside directly to a waiting authorized truck at berth,
    completely bypassing yard allocation and without occupying any yard slot.
    Tracks lifecycle until final gate exit verification.
    """
    TRANSFER_STATUS_CHOICES = (
        ('INITIATED', 'Initiated'),
        ('IN_PROGRESS', 'In Progress'),
        ('TRANSFERRED_TO_TRUCK', 'Transferred to Truck'),
        ('AWAITING_GATE_EXIT', 'Awaiting Gate Exit'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    )

    transfer_id = models.BigAutoField(primary_key=True)
    transfer_reference = models.CharField(max_length=100, unique=True, db_index=True)
    transfer_container_id = models.ForeignKey(
        'Container',
        on_delete=models.PROTECT,
        db_column='transfer_container_id',
        related_name='direct_transfers'
    )
    transfer_vessel_schedule_id = models.ForeignKey(
        'VesselSchedule',
        on_delete=models.PROTECT,
        db_column='transfer_vessel_schedule_id',
        related_name='direct_transfers'
    )
    transfer_berth_id = models.ForeignKey(
        'Berth',
        on_delete=models.PROTECT,
        db_column='transfer_berth_id',
        related_name='direct_transfers'
    )
    transfer_crane_allocation_id = models.ForeignKey(
        'CraneAllocation',
        on_delete=models.PROTECT,
        db_column='transfer_crane_allocation_id',
        related_name='direct_transfers'
    )
    transfer_crane_id = models.ForeignKey(
        'Crane',
        on_delete=models.PROTECT,
        db_column='transfer_crane_id',
        related_name='direct_transfers'
    )
    transfer_truck_id = models.ForeignKey(
        'Truck',
        on_delete=models.PROTECT,
        db_column='transfer_truck_id',
        related_name='direct_transfers'
    )
    transfer_driver_id = models.ForeignKey(
        'Driver',
        on_delete=models.PROTECT,
        db_column='transfer_driver_id',
        related_name='direct_transfers'
    )
    transfer_delivery_order_id = models.ForeignKey(
        'DeliveryOrder',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='transfer_delivery_order_id',
        related_name='direct_transfers'
    )
    transfer_gate_pass_id = models.OneToOneField(
        'GatePass',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='transfer_gate_pass_id',
        related_name='direct_transfer_operation'
    )
    transfer_status = models.CharField(
        max_length=50,
        choices=TRANSFER_STATUS_CHOICES,
        default='INITIATED',
        db_index=True
    )
    transfer_remarks = models.TextField(blank=True, default='')
    transfer_initiated_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='transfer_initiated_by',
        related_name='initiated_transfers'
    )
    transfer_executed_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='transfer_executed_by',
        related_name='executed_transfers'
    )
    transfer_gate_verified_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='transfer_gate_verified_by',
        related_name='verified_transfers'
    )
    transfer_initiated_at = models.DateTimeField(default=timezone.now)
    transfer_transferred_at = models.DateTimeField(null=True, blank=True)
    transfer_completed_at = models.DateTimeField(null=True, blank=True)
    transfer_created_at = models.DateTimeField(auto_now_add=True)
    transfer_updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_direct_ship_to_truck_transfer'
        verbose_name = 'Direct Ship-to-Truck Transfer'
        verbose_name_plural = 'Direct Ship-to-Truck Transfers'
        ordering = ['-transfer_created_at', '-transfer_id']

    @property
    def container(self):
        return self.transfer_container_id

    @property
    def vessel_schedule(self):
        return self.transfer_vessel_schedule_id

    @property
    def berth(self):
        return self.transfer_berth_id

    @property
    def crane_allocation(self):
        return self.transfer_crane_allocation_id

    @property
    def crane(self):
        return self.transfer_crane_id

    @property
    def truck(self):
        return self.transfer_truck_id

    @property
    def driver(self):
        return self.transfer_driver_id

    @property
    def gate_pass(self):
        return self.transfer_gate_pass_id

    def __str__(self):
        return f"Direct Transfer {self.transfer_reference} ({self.transfer_status}) - Container: {self.transfer_container_id.container_number} -> Truck: {self.transfer_truck_id.truck_number}"













