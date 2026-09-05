from django.db import models
from django.utils import timezone

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

    class Meta:
        db_table = 'tbl_login'
        verbose_name = 'Login Record'
        verbose_name_plural = 'Login Records'

    def __str__(self):
        return f"{self.login_email} ({self.login_role})"


class ShippingCompany(models.Model):
    COMPANY_STATUS_CHOICES = (
        ('PENDING', 'Pending Approval'),
        ('ACTIVE', 'Active'),
        ('SUSPENDED', 'Suspended'),
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
    user_created_at = models.DateTimeField(auto_now_add=True)
    user_updated_at = models.DateTimeField(auto_now=True)

    # Property aliases for backward compatibility
    @property
    def user_login_id(self):
        return self.login_id

    @property
    def user_company_id(self):
        return self.shipping_company_id

    class Meta:
        db_table = 'tbl_user'
        verbose_name = 'User Profile'
        verbose_name_plural = 'User Profiles'

    def __str__(self):
        return f"{self.user_full_name} ({self.login_id.login_email})"


class RegistrationRequest(models.Model):
    STATUS_CHOICES = (
        ('PENDING', 'Pending Approval'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
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
    registration_request_terms_accepted = models.BooleanField(default=True)
    registration_request_status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='PENDING')
    registration_request_rejection_reason = models.TextField(null=True, blank=True)
    registration_request_submitted_at = models.DateTimeField(auto_now_add=True)
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
    berth_capacity_teu = models.IntegerField(default=10000, help_text="Capacity rating in TEU")
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
        ('CUSTOMS', 'Customs'),
        ('GATE_OPERATIONS', 'Gate Operations'),
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








