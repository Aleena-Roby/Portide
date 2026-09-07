from django.urls import path
from authentication.views import (
    LoginAPIView, 
    LogoutAPIView,
    CurrentUserAPIView,
    ShippingCompanyRegistrationAPIView,
    AdminRegistrationRequestsAPIView,
    AdminApproveRegistrationRequestAPIView,
    AdminRejectRegistrationRequestAPIView,
    ForgotPasswordAPIView,
    ResetPasswordAPIView,
    AdminCreateStaffAPIView,
    AdminListUsersAPIView,
    AdminUserDetailAPIView,
    ChangePasswordAPIView,
    VesselListCreateAPIView,
    VesselDetailAPIView,
    ArrivalRequestListCreateAPIView,
    ArrivalRequestDetailAPIView,
    ArrivalRequestApproveAPIView,
    ArrivalRequestRejectAPIView,
    BerthListCreateAPIView,
    BerthMaintenanceStatusAPIView,
    BerthAvailabilityCheckAPIView,
    AdminBerthListCreateAPIView,
    AdminBerthDetailAPIView,
    VesselScheduleListCreateAPIView,
    VesselScheduleUpdateStatusAPIView,
    PortSettingsAPIView,
    AuditLogListAPIView
)

urlpatterns = [
    path('login/', LoginAPIView.as_view(), name='login'),
    path('logout/', LogoutAPIView.as_view(), name='logout'),
    path('me/', CurrentUserAPIView.as_view(), name='current_user'),
    path('me', CurrentUserAPIView.as_view(), name='current_user_noslash'),
    path('registration/', ShippingCompanyRegistrationAPIView.as_view(), name='registration'),
    path('change-password/', ChangePasswordAPIView.as_view(), name='change_password'),

    # Vessel Management Endpoints
    path('vessels/', VesselListCreateAPIView.as_view(), name='vessel_list_create'),
    path('vessels', VesselListCreateAPIView.as_view(), name='vessel_list_create_noslash'),
    path('vessels/<int:pk>/', VesselDetailAPIView.as_view(), name='vessel_detail'),
    path('vessels/<int:pk>', VesselDetailAPIView.as_view(), name='vessel_detail_noslash'),

    # Arrival Request Endpoints
    path('arrival-requests/', ArrivalRequestListCreateAPIView.as_view(), name='arrival_request_list_create'),
    path('arrival-requests', ArrivalRequestListCreateAPIView.as_view(), name='arrival_request_list_create_noslash'),
    path('arrival-requests/<int:pk>/', ArrivalRequestDetailAPIView.as_view(), name='arrival_request_detail'),
    path('arrival-requests/<int:pk>', ArrivalRequestDetailAPIView.as_view(), name='arrival_request_detail_noslash'),
    path('arrival-requests/<int:pk>/approve/', ArrivalRequestApproveAPIView.as_view(), name='arrival_request_approve'),
    path('arrival-requests/<int:pk>/approve', ArrivalRequestApproveAPIView.as_view(), name='arrival_request_approve_noslash'),
    path('arrival-requests/<int:pk>/reject/', ArrivalRequestRejectAPIView.as_view(), name='arrival_request_reject'),
    path('arrival-requests/<int:pk>/reject', ArrivalRequestRejectAPIView.as_view(), name='arrival_request_reject_noslash'),
    
    # Berth & Scheduling Endpoints
    path('berths/check-availability/', BerthAvailabilityCheckAPIView.as_view(), name='berth_check_availability'),
    path('berths/check-availability', BerthAvailabilityCheckAPIView.as_view(), name='berth_check_availability_noslash'),
    path('berths/', BerthListCreateAPIView.as_view(), name='berth_list_create'),
    path('berths', BerthListCreateAPIView.as_view(), name='berth_list_create_noslash'),
    path('berths/<int:pk>/status/', BerthMaintenanceStatusAPIView.as_view(), name='berth_maintenance_status'),
    path('berths/<int:pk>/status', BerthMaintenanceStatusAPIView.as_view(), name='berth_maintenance_status_noslash'),
    path('schedules/', VesselScheduleListCreateAPIView.as_view(), name='schedule_list_create'),
    path('schedules', VesselScheduleListCreateAPIView.as_view(), name='schedule_list_create_noslash'),
    path('schedules/<int:pk>/status/', VesselScheduleUpdateStatusAPIView.as_view(), name='schedule_update_status'),
    path('schedules/<int:pk>/status', VesselScheduleUpdateStatusAPIView.as_view(), name='schedule_update_status_noslash'),
    
    # Admin Berth Master Infrastructure Management Endpoints
    path('admin/berths/', AdminBerthListCreateAPIView.as_view(), name='admin_berths_list_create'),
    path('admin/berths', AdminBerthListCreateAPIView.as_view(), name='admin_berths_list_create_noslash'),
    path('admin/berths/<int:pk>/', AdminBerthDetailAPIView.as_view(), name='admin_berths_detail'),
    path('admin/berths/<int:pk>', AdminBerthDetailAPIView.as_view(), name='admin_berths_detail_noslash'),
    
    # Admin Registration Requests & Company Approvals
    path('admin/registration-requests/', AdminRegistrationRequestsAPIView.as_view(), name='admin_registration_requests_list'),
    path('admin/registration-requests/<int:pk>/', AdminRegistrationRequestsAPIView.as_view(), name='admin_registration_requests_detail'),
    path('admin/registration-requests/<int:pk>/approve/', AdminApproveRegistrationRequestAPIView.as_view(), name='admin_registration_requests_approve'),
    path('admin/registration-requests/<int:pk>/reject/', AdminRejectRegistrationRequestAPIView.as_view(), name='admin_registration_requests_reject'),
    
    # Admin Staff Account Management & User Listing
    path('admin/users/staff/', AdminCreateStaffAPIView.as_view(), name='admin_create_staff'),
    path('admin/users/staff', AdminCreateStaffAPIView.as_view(), name='admin_create_staff_noslash'),
    path('admin/users/', AdminListUsersAPIView.as_view(), name='admin_list_users'),
    path('admin/users', AdminListUsersAPIView.as_view(), name='admin_list_users_noslash'),
    path('admin/users/<int:pk>/', AdminUserDetailAPIView.as_view(), name='admin_user_detail'),
    path('admin/users/<int:pk>', AdminUserDetailAPIView.as_view(), name='admin_user_detail_noslash'),

    # URL aliases matching logical endpoint structure
    path('admin/company-approvals/', AdminRegistrationRequestsAPIView.as_view(), name='admin_company_approvals_list'),
    path('admin/company-approvals/<int:pk>/approve/', AdminApproveRegistrationRequestAPIView.as_view(), name='admin_company_approvals_approve'),
    path('admin/company-approvals/<int:pk>/reject/', AdminRejectRegistrationRequestAPIView.as_view(), name='admin_company_approvals_reject'),

    path('forgot-password', ForgotPasswordAPIView.as_view(), name='forgot_password'),
    path('forgot-password/', ForgotPasswordAPIView.as_view(), name='forgot_password_slash'),
    path('reset-password', ResetPasswordAPIView.as_view(), name='reset_password'),
    path('reset-password/', ResetPasswordAPIView.as_view(), name='reset_password_slash'),

    # Port Configuration & System Settings
    path('settings/port-config/', PortSettingsAPIView.as_view(), name='port_settings_config'),
    path('settings/port-config', PortSettingsAPIView.as_view(), name='port_settings_config_noslash'),

    # Security & Audit Logs Endpoints
    path('audit-logs/', AuditLogListAPIView.as_view(), name='audit_logs_list'),
    path('audit-logs', AuditLogListAPIView.as_view(), name='audit_logs_list_noslash'),
    path('admin/audit-logs/', AuditLogListAPIView.as_view(), name='admin_audit_logs_list'),
    path('admin/audit-logs', AuditLogListAPIView.as_view(), name='admin_audit_logs_list_noslash'),
]


