import logging
from django.core.mail import send_mail
from django.conf import settings
from authentication.models import User

logger = logging.getLogger(__name__)


def get_from_email():
    return getattr(settings, 'DEFAULT_FROM_EMAIL', None) or getattr(settings, 'EMAIL_HOST_USER', None) or 'noreply@portide.local'


def format_reg_id(req_id: int) -> str:
    return f"REG-2026-{int(req_id):03d}"


def send_registration_submitted_email(registration_request):
    """
    Sends confirmation email to shipping company upon initial registration submission.
    """
    try:
        company = registration_request.shipping_company_id
        if not company or not company.shipping_company_email:
            return False

        applicant_name = registration_request.registration_request_applicant_name or company.shipping_company_name
        req_code = format_reg_id(registration_request.registration_request_id)

        subject = "PORTIDE Registration Request Received"
        body = f"""Hello {applicant_name},

Your Shipping Company registration request has been successfully submitted to PORTIDE.

Registration Request ID: {req_code}
Company: {company.shipping_company_name}
Status: Pending Review

Your application will be reviewed by Port Administration.
You will receive an email notification when the status changes.

Regards,
PORTIDE Administration
Maritime Port Operations Intelligence Platform
"""
        send_mail(
            subject=subject,
            message=body,
            from_email=get_from_email(),
            recipient_list=[company.shipping_company_email],
            fail_silently=True
        )
        logger.info(f"Sent registration submission email to {company.shipping_company_email} for request {req_code}")
        return True
    except Exception as e:
        logger.error(f"Failed to send registration submission email: {str(e)}", exc_info=True)
        return False


def send_registration_action_required_email(registration_request, required_docs_display: str, admin_message: str):
    """
    Sends notification email when administrator marks application as ACTION REQUIRED.
    """
    try:
        company = registration_request.shipping_company_id
        if not company or not company.shipping_company_email:
            return False

        applicant_name = registration_request.registration_request_applicant_name or company.shipping_company_name
        req_code = format_reg_id(registration_request.registration_request_id)

        subject = "PORTIDE Registration – Additional Documentation Required"
        body = f"""Hello {applicant_name},

Additional documentation or information is required for your PORTIDE registration request.

Company: {company.shipping_company_name}
Registration Request ID: {req_code}
Status: ACTION REQUIRED

Required document(s) / corrections:
{required_docs_display}

Administrator Message:
"{admin_message}"

Instructions:
Please visit PORTIDE and upload the requested document(s).
Important: You do NOT need to complete the entire registration form again. Your existing company details remain saved.

Regards,
PORTIDE Administration
Maritime Port Operations Intelligence Platform
"""
        send_mail(
            subject=subject,
            message=body,
            from_email=get_from_email(),
            recipient_list=[company.shipping_company_email],
            fail_silently=True
        )
        logger.info(f"Sent action required email to {company.shipping_company_email} for request {req_code}")
        return True
    except Exception as e:
        logger.error(f"Failed to send action required email: {str(e)}", exc_info=True)
        return False


def send_registration_resubmitted_email(registration_request):
    """
    Sends notification email to Port Administration when company resubmits corrections.
    """
    try:
        company = registration_request.shipping_company_id
        company_name = company.shipping_company_name if company else "Shipping Company"
        req_code = format_reg_id(registration_request.registration_request_id)

        # Look up admin email(s)
        admin_emails = list(User.objects.filter(
            login_id__login_role='port_administrator',
            login_id__login_is_active=True
        ).values_list('login_id__login_email', flat=True))

        if not admin_emails:
            admin_emails = [get_from_email()]

        subject = "PORTIDE Registration Resubmitted"
        body = f"""Hello Port Administrator,

A shipping company has resubmitted their registration application with updated documentation.

Company: {company_name}
Registration Request ID: {req_code}
Status: Pending Review

The company has uploaded the requested correction/document. Please review the updated application in the Port Administration portal.

Regards,
PORTIDE Notification System
"""
        send_mail(
            subject=subject,
            message=body,
            from_email=get_from_email(),
            recipient_list=admin_emails,
            fail_silently=True
        )
        logger.info(f"Sent registration resubmission email to admins {admin_emails} for request {req_code}")
        return True
    except Exception as e:
        logger.error(f"Failed to send registration resubmission email: {str(e)}", exc_info=True)
        return False


def send_registration_approved_email(registration_request):
    """
    Sends approval email to company upon administrator approval.
    """
    try:
        company = registration_request.shipping_company_id
        if not company or not company.shipping_company_email:
            return False

        applicant_name = registration_request.registration_request_applicant_name or company.shipping_company_name
        req_code = format_reg_id(registration_request.registration_request_id)

        subject = "PORTIDE Registration Approved"
        body = f"""Hello {applicant_name},

Congratulations! Your Shipping Company registration for {company.shipping_company_name} has been approved.

Registration Request ID: {req_code}
Status: APPROVED

Your account is now fully active. You can log in to PORTIDE using your registered account credentials.

Login URL: http://localhost:5173/login

Welcome to PORTIDE Maritime Port Operations Intelligence Platform.

Regards,
PORTIDE Administration
"""
        send_mail(
            subject=subject,
            message=body,
            from_email=get_from_email(),
            recipient_list=[company.shipping_company_email],
            fail_silently=True
        )
        logger.info(f"Sent registration approval email to {company.shipping_company_email} for request {req_code}")
        return True
    except Exception as e:
        logger.error(f"Failed to send registration approval email: {str(e)}", exc_info=True)
        return False


def send_registration_rejected_email(registration_request, rejection_reason: str):
    """
    Sends final rejection email to company upon administrator rejection.
    """
    try:
        company = registration_request.shipping_company_id
        if not company or not company.shipping_company_email:
            return False

        applicant_name = registration_request.registration_request_applicant_name or company.shipping_company_name
        req_code = format_reg_id(registration_request.registration_request_id)

        subject = "PORTIDE Registration Request – Rejected"
        body = f"""Hello {applicant_name},

Thank you for your interest in PORTIDE.

Company: {company.shipping_company_name}
Registration Request ID: {req_code}
Status: REJECTED

Reason for Rejection:
"{rejection_reason}"

This is a final registration decision. If you have questions regarding this decision, please contact Port Administration.

Regards,
PORTIDE Administration
"""
        send_mail(
            subject=subject,
            message=body,
            from_email=get_from_email(),
            recipient_list=[company.shipping_company_email],
            fail_silently=True
        )
        logger.info(f"Sent registration rejection email to {company.shipping_company_email} for request {req_code}")
        return True
    except Exception as e:
        logger.error(f"Failed to send registration rejection email: {str(e)}", exc_info=True)
        return False
