import logging
import os
import json
import urllib.request
import urllib.error
from email.mime.image import MIMEImage
from django.core.mail import EmailMultiAlternatives, send_mail as django_send_mail
from django.conf import settings
from authentication.models import User
from authentication.qr_service import generate_qr_png_bytes

logger = logging.getLogger(__name__)


def _send_via_resend(subject, message, from_email, recipient_list, html_message=None):
    resend_key = os.getenv('RESEND_API_KEY')
    if not resend_key:
        return False
    
    sender = os.getenv('RESEND_FROM_EMAIL') or 'PORTIDE <onboarding@resend.dev>'
    payload = {
        "from": sender,
        "to": recipient_list,
        "subject": subject,
        "text": message,
    }
    if html_message:
        payload["html"] = html_message

    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {resend_key}",
            "Content-Type": "application/json",
            "User-Agent": "PORTIDE/1.0"
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            logger.info(f"Resend HTTP delivery successful: {data.get('id')} to {recipient_list}")
            return True
    except Exception as e:
        logger.error(f"Resend HTTP delivery failed: {e}", exc_info=True)
        return False


def _send_via_brevo(subject, message, from_email, recipient_list, html_message=None):
    brevo_key = os.getenv('BREVO_API_KEY')
    if not brevo_key:
        return False
    
    sender_email = os.getenv('DEFAULT_FROM_EMAIL') or from_email or 'portide.system@gmail.com'
    payload = {
        "sender": {"name": "PORTIDE Administration", "email": sender_email},
        "to": [{"email": r} for r in recipient_list],
        "subject": subject,
        "textContent": message,
    }
    if html_message:
        payload["htmlContent"] = html_message

    req = urllib.request.Request(
        "https://api.brevo.com/v3/smtp/email",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "api-key": brevo_key,
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            logger.info(f"Brevo HTTP delivery successful to {recipient_list}")
            return True
    except Exception as e:
        logger.error(f"Brevo HTTP delivery failed: {e}", exc_info=True)
        return False


def _send_via_google_script(subject, message, from_email, recipient_list, html_message=None):
    script_url = os.getenv('GOOGLE_SCRIPT_EMAIL_URL')
    if not script_url:
        return False

    payload = {
        "to": recipient_list,
        "subject": subject,
        "message": message,
        "html": html_message or message
    }

    req = urllib.request.Request(
        script_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "User-Agent": "PORTIDE/1.0"
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            logger.info(f"Google Apps Script email delivery successful to {recipient_list}")
            return True
    except Exception as e:
        logger.error(f"Google Apps Script email delivery failed: {e}", exc_info=True)
        return False


def send_mail(
    subject,
    message,
    from_email,
    recipient_list,
    fail_silently=False,
    auth_user=None,
    auth_password=None,
    connection=None,
    html_message=None,
    inline_images=None,
):
    """
    Enhanced send_mail:
    1. First checks for Google Apps Script HTTPS Relay (uses actual Gmail over Port 443).
    2. Checks for HTTPS REST API (Resend or Brevo) over Port 443.
    3. Falls back to Django standard SMTP for local development or unblocked networks.
    """
    # 1. Try Google Apps Script HTTPS Relay if configured
    if os.getenv('GOOGLE_SCRIPT_EMAIL_URL'):
        success = _send_via_google_script(subject, message, from_email, recipient_list, html_message)
        if success:
            return 1

    # 2. Try Resend HTTPS API if configured
    if os.getenv('RESEND_API_KEY'):
        success = _send_via_resend(subject, message, from_email, recipient_list, html_message)
        if success:
            return 1

    # 3. Try Brevo HTTPS API if configured
    if os.getenv('BREVO_API_KEY'):
        success = _send_via_brevo(subject, message, from_email, recipient_list, html_message)
        if success:
            return 1

    # 4. Standard SMTP / EmailMultiAlternatives
    if inline_images:
        try:
            msg = EmailMultiAlternatives(
                subject=subject,
                body=message,
                from_email=from_email,
                to=recipient_list,
                connection=connection,
            )
            if html_message:
                msg.attach_alternative(html_message, "text/html")
            for cid, img_bytes, filename in inline_images:
                mime_img = MIMEImage(img_bytes, 'png')
                mime_img.add_header('Content-ID', f'<{cid}>')
                mime_img.add_header('Content-Disposition', 'inline', filename=filename)
                msg.attach(mime_img)
            return msg.send(fail_silently=fail_silently)
        except Exception as e:
            if not fail_silently:
                raise
            logger.error(f"Error sending email with inline images: {e}", exc_info=True)
            return 0
    else:
        return django_send_mail(
            subject=subject,
            message=message,
            from_email=from_email,
            recipient_list=recipient_list,
            fail_silently=fail_silently,
            auth_user=auth_user,
            auth_password=auth_password,
            connection=connection,
            html_message=html_message,
        )


def get_from_email():
    return getattr(settings, 'DEFAULT_FROM_EMAIL', None) or getattr(settings, 'EMAIL_HOST_USER', None) or 'noreply@portide.local'


def format_reg_id(req_id: int) -> str:
    return f"REG-2026-{int(req_id):03d}"


import threading

def _send_mail_async(subject, message, from_email, recipient_list, html_message=None, inline_images=None):
    """
    Asynchronously delivers email in a background daemon thread so it never blocks the request-response thread.
    Automatically closes DB connection in worker thread to prevent connection pool exhaustion.
    """
    def _worker():
        from django.db import connection
        try:
            send_mail(
                subject=subject,
                message=message,
                from_email=from_email,
                recipient_list=recipient_list,
                html_message=html_message,
                inline_images=inline_images,
                fail_silently=True
            )
        except Exception as err:
            logger.error(f"Async email sending error to {recipient_list}: {err}", exc_info=True)
        finally:
            try:
                connection.close()
            except Exception:
                pass

    t = threading.Thread(target=_worker, daemon=True)
    t.start()


def send_registration_submitted_email(registration_request):
    """
    Sends confirmation email to shipping company upon initial registration submission.
    Executed asynchronously so HTTP response is returned immediately.
    """
    try:
        company = registration_request.shipping_company_id
        if not company or not company.shipping_company_email:
            return False

        applicant_name = registration_request.registration_request_applicant_name or company.shipping_company_name
        req_code = format_reg_id(registration_request.registration_request_id)
        email = company.shipping_company_email
        company_name = company.shipping_company_name

        subject = "PORTIDE Registration Request Received"
        body = f"""Hello {applicant_name},

Your Shipping Company registration request has been successfully submitted to PORTIDE.

Registration Request ID: {req_code}
Company: {company_name}
Status: Pending Review

Your application will be reviewed by Port Administration.
You will receive an email notification when the status changes.

Regards,
PORTIDE Administration
Maritime Port Operations Intelligence Platform
"""
        _send_mail_async(
            subject=subject,
            message=body,
            from_email=get_from_email(),
            recipient_list=[email],
        )
        logger.info(f"Queued async registration submission email to {email} for request {req_code}")
        return True
    except Exception as e:
        logger.error(f"Failed to queue registration submission email: {str(e)}", exc_info=True)
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
        email = company.shipping_company_email
        company_name = company.shipping_company_name

        subject = "PORTIDE Registration – Additional Documentation Required"
        body = f"""Hello {applicant_name},

Additional documentation or information is required for your PORTIDE registration request.

Company: {company_name}
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
        _send_mail_async(
            subject=subject,
            message=body,
            from_email=get_from_email(),
            recipient_list=[email],
        )
        logger.info(f"Queued async action required email to {email} for request {req_code}")
        return True
    except Exception as e:
        logger.error(f"Failed to queue action required email: {str(e)}", exc_info=True)
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
        _send_mail_async(
            subject=subject,
            message=body,
            from_email=get_from_email(),
            recipient_list=admin_emails,
        )
        logger.info(f"Queued async registration resubmission email to admins {admin_emails} for request {req_code}")
        return True
    except Exception as e:
        logger.error(f"Failed to queue registration resubmission email: {str(e)}", exc_info=True)
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
        email = company.shipping_company_email
        company_name = company.shipping_company_name
        frontend_url = getattr(settings, 'FRONTEND_URL', None) or 'https://portide.vercel.app'
        login_url = f"{frontend_url.rstrip('/')}/login"

        subject = "PORTIDE Registration Approved"
        body = f"""Hello {applicant_name},

Congratulations! Your Shipping Company registration for {company_name} has been approved.

Registration Request ID: {req_code}
Status: APPROVED

Your account is now fully active. You can log in to PORTIDE using your registered account credentials.

Login URL: {login_url}

Welcome to PORTIDE Maritime Port Operations Intelligence Platform.

Regards,
PORTIDE Administration
"""
        _send_mail_async(
            subject=subject,
            message=body,
            from_email=get_from_email(),
            recipient_list=[email],
        )
        logger.info(f"Queued async registration approval email to {email} for request {req_code}")
        return True
    except Exception as e:
        logger.error(f"Failed to queue registration approval email: {str(e)}", exc_info=True)
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
        email = company.shipping_company_email
        company_name = company.shipping_company_name

        subject = "PORTIDE Registration Request – Rejected"
        body = f"""Hello {applicant_name},

Thank you for your interest in PORTIDE.

Company: {company_name}
Registration Request ID: {req_code}
Status: REJECTED

Reason for Rejection:
"{rejection_reason}"

This is a final registration decision. If you have questions regarding this decision, please contact Port Administration.

Regards,
PORTIDE Administration
"""
        _send_mail_async(
            subject=subject,
            message=body,
            from_email=get_from_email(),
            recipient_list=[email],
        )
        logger.info(f"Queued async registration rejection email to {email} for request {req_code}")
        return True
    except Exception as e:
        logger.error(f"Failed to queue registration rejection email: {str(e)}", exc_info=True)
        return False


def send_staff_account_created_email(user_obj, temp_password: str) -> bool:
    """
    Sends credential notification email to newly created internal staff member.
    The temporary password is NEVER logged or saved elsewhere.
    """
    ROLE_DISPLAY_MAP = {
        'port_operations_officer': 'Port Operations Officer',
        'customs_officer': 'Customs Officer',
        'terminal_logistics_operator': 'Terminal & Logistics Operator',
        'gate_truck_officer': 'Gate & Truck Operations Officer',
        'port_administrator': 'Port Administrator',
    }

    try:
        recipient_email = user_obj.login_id.login_email if user_obj.login_id else None
        if not recipient_email:
            return False

        full_name = user_obj.user_full_name
        employee_id = user_obj.user_employee_id or 'N/A'
        role_code = user_obj.login_id.login_role if user_obj.login_id else ''
        role_display = ROLE_DISPLAY_MAP.get(role_code, role_code.replace('_', ' ').title())
        department = user_obj.user_department or (user_obj.department_id.department_department_name if user_obj.department_id else 'Port Operations')
        
        frontend_url = getattr(settings, 'FRONTEND_URL', None) or 'http://localhost:5173'
        login_url = f"{frontend_url.rstrip('/')}/login"

        subject = "PORTIDE – Internal Staff Account Created"
        body = f"""Hello {full_name},

Your internal staff account has been created in the
PORTIDE Intelligent Maritime Port Operations Platform.

Account Details:

Employee ID: {employee_id}
Role: {role_display}
Department: {department}
Email: {recipient_email}

Temporary Password:
{temp_password}

Login:
{login_url}

IMPORTANT:

This is a temporary password generated by PORTIDE.

You must change your password after your first successful login.

Please do not share your credentials with anyone.

Regards,
PORTIDE Administration
"""
        send_mail(
            subject=subject,
            message=body,
            from_email=get_from_email(),
            recipient_list=[recipient_email],
            fail_silently=False
        )
        logger.info(f"Sent staff account creation email to {recipient_email} for employee {employee_id}")
        return True
    except Exception as e:
        logger.error(f"Failed to send staff account creation email to {getattr(user_obj.login_id, 'login_email', 'unknown')}: {str(e)}", exc_info=True)
        return False


def send_customs_cleared_notification(container, officer_name: str = None) -> bool:
    """
    Sends notification email when a container is cleared by Customs.
    Notifies the linked shipping company.
    """
    try:
        shipping_company = container.shipping_company
        recipient_email = shipping_company.shipping_company_email if shipping_company else None
        if not recipient_email:
            return False

        subject = f"PORTIDE Customs Notification: Container {container.container_number} Cleared"
        body = f"""Dear {shipping_company.shipping_company_name},

Container {container.container_number} has been cleared by Customs and is ready for the next operational stage.

Container Details:
- Container Number: {container.container_number}
- Container Type: {container.get_container_type_display()}
- Gross Weight: {container.container_gross_weight} Tonnes
- Cargo Description: {container.cargo.cargo_description}
- Vessel: {container.vessel.vessel_name if container.vessel else 'N/A'}
- Customs Officer: {officer_name or 'Customs Authority'}
- Status: Cleared

Regards,
PORTIDE Customs & Border Clearance Division
Maritime Port Operations Intelligence Platform
"""
        _send_mail_async(
            subject=subject,
            message=body,
            from_email=get_from_email(),
            recipient_list=[recipient_email],
        )
        logger.info(f"Queued async customs cleared notification email for container {container.container_number} to {recipient_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to queue customs cleared notification: {str(e)}", exc_info=True)
        return False


def send_customs_hold_notification(container, hold_reason: str = None, officer_name: str = None) -> bool:
    """
    Sends notification email when a container is placed on Customs Hold.
    Notifies the linked shipping company.
    """
    try:
        shipping_company = container.shipping_company
        recipient_email = shipping_company.shipping_company_email if shipping_company else None
        if not recipient_email:
            return False

        subject = f"PORTIDE Customs Alert: Container {container.container_number} Placed on Hold"
        body = f"""Dear {shipping_company.shipping_company_name},

Container {container.container_number} has been placed on Customs Hold.

Container Details:
- Container Number: {container.container_number}
- Container Type: {container.get_container_type_display()}
- Gross Weight: {container.container_gross_weight} Tonnes
- Cargo Description: {container.cargo.cargo_description}
- Vessel: {container.vessel.vessel_name if container.vessel else 'N/A'}
- Hold Reason: {hold_reason or 'Documentation / Inspection Discrepancy'}
- Customs Officer: {officer_name or 'Customs Authority'}
- Status: Customs Hold

Please contact the Port Customs Authority or submit required documentation to resolve this hold.

Regards,
PORTIDE Customs & Border Clearance Division
Maritime Port Operations Intelligence Platform
"""
        _send_mail_async(
            subject=subject,
            message=body,
            from_email=get_from_email(),
            recipient_list=[recipient_email],
        )
        logger.info(f"Queued async customs hold notification email for container {container.container_number} to {recipient_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to queue customs hold notification: {str(e)}", exc_info=True)
        return False


def send_container_released_notification(container, truck_number: str = '', officer_name: str = None) -> bool:
    """
    Sends notification email when a container is released through the gate.
    Notifies the linked shipping company.
    """
    try:
        shipping_company = container.shipping_company
        recipient_email = shipping_company.shipping_company_email if shipping_company else None
        if not recipient_email:
            return False

        subject = f"PORTIDE Gate Release Notification: Container {container.container_number} Released"
        body = f"""Dear {shipping_company.shipping_company_name},

Container {container.container_number} has completed gate verification and has been officially released from the port terminal.

Container Details:
- Container Number: {container.container_number}
- Container Type: {container.get_container_type_display()}
- Gross Weight: {container.container_gross_weight} Tonnes
- Cargo Description: {container.cargo.cargo_description}
- Vessel: {container.vessel.vessel_name if container.vessel else 'N/A'}
- Truck Number: {truck_number or 'Assigned Carrier'}
- Gate Officer: {officer_name or 'Gate & Truck Operations'}
- Status: Released

Regards,
PORTIDE Gate & Truck Operations
Maritime Port Operations Intelligence Platform
"""
        _send_mail_async(
            subject=subject,
            message=body,
            from_email=get_from_email(),
            recipient_list=[recipient_email],
        )
        logger.info(f"Queued async container released notification email for container {container.container_number} to {recipient_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to queue container released notification: {str(e)}", exc_info=True)
        return False


from authentication.qr_service import generate_qr_png_base64


def send_gate_pass_driver_email(gate_pass) -> tuple[bool, str | None]:
    """
    Sends the Digital Gate Pass and actual QR verification image to the driver's registered email address.
    Returns (success: bool, error_message: Optional[str]).
    Strictly uses the driver's registered email without requiring manual officer entry.
    """
    try:
        driver = getattr(gate_pass, 'gate_pass_driver_id', None)
        if not driver or not getattr(driver, 'driver_email', None):
            return False, "Driver does not have a registered email address."

        recipient_email = driver.driver_email.strip()
        pass_number = gate_pass.gate_pass_pass_number
        truck = getattr(gate_pass, 'gate_pass_truck_id', None)
        truck_number = truck.truck_number if truck else 'Unassigned'
        gate = getattr(gate_pass, 'gate_pass_gate_id', None)
        gate_name = gate.gate_name if gate else 'Designated Port Gate'
        driver_license = driver.driver_license_number if driver and getattr(driver, 'driver_license_number', None) else 'On File'
        valid_until_str = (
            gate_pass.gate_pass_valid_until.strftime('%d %b %Y %H:%M UTC')
            if getattr(gate_pass, 'gate_pass_valid_until', None) else 'N/A'
        )

        # Generate actual embedded QR code image
        qr_payload = gate_pass.gate_pass_qr_code or f"PORTIDE-GP:{pass_number}:{gate_pass.gate_pass_verification_code}"
        qr_png_bytes = generate_qr_png_bytes(qr_payload, scale=8, border=4)

        # Gather associated containers
        containers = [
            assoc.gate_pass_container_container_id
            for assoc in gate_pass.containers.select_related('gate_pass_container_container_id').all()
        ]
        container_lines = "\n".join([
            f"- {c.container_number} ({c.get_container_type_display()} - {c.container_gross_weight} Tonnes)"
            for c in containers
        ])
        if not container_lines:
            container_lines = "No containers associated."

        subject = f"PORTIDE – Digital Gate Pass {pass_number}"
        text_body = f"""Dear {driver.driver_name},

Your Digital Gate Pass has been generated for the assigned port gate movement.

Gate Pass ID:
{pass_number}

Gate Movement:
{gate_pass.gate_pass_movement_number}

Truck Number:
{truck_number}

Driver:
{driver.driver_name}

Driver License / Identification:
{driver_license}

Assigned Gate:
{gate_name}

Valid Until:
{valid_until_str}

Authorized Containers:
{container_lines}

Present this QR code at the designated port gate.
The Gate & Truck Operations Officer will scan the QR code and verify the gate pass before authorizing vehicle exit.
This pass is valid only for the assigned driver, truck, authorized container(s), designated gate and validity period. Do not share or reuse this pass.

Verification Reference:
{gate_pass.gate_pass_verification_code}

Regards,
PORTIDE Gate & Truck Operations
Maritime Port Operations Intelligence Platform
"""

        html_container_rows = "".join([
            f"""<tr>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-weight: bold; color: #0f172a;">{c.container_number}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">{c.get_container_type_display()}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">{c.container_gross_weight} T</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #059669; font-weight: 600;">CLEARED &bull; AUTHORIZED</td>
            </tr>"""
            for c in containers
        ])

        html_body = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>PORTIDE Digital Gate Pass {pass_number}</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 28px 24px; text-align: center; color: #ffffff;">
      <div style="font-size: 13px; font-weight: 800; letter-spacing: 2px; color: #f59e0b; text-transform: uppercase;">PORTIDE Intelligence Platform</div>
      <h1 style="margin: 6px 0 0 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">DIGITAL GATE PASS</h1>
      <div style="margin-top: 8px; font-size: 16px; font-family: monospace; font-weight: 700; color: #38bdf8;">{pass_number}</div>
    </div>

    <div style="padding: 24px;">
      <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155;">Dear <strong>{driver.driver_name}</strong>,</p>
      <p style="margin: 0 0 20px 0; font-size: 14px; color: #64748b; line-height: 1.5;">
        Your Digital Gate Pass has been authorized and generated for the port outbound gate movement.
      </p>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
        <tr>
          <td style="padding: 10px 16px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase;">Truck Number</td>
          <td style="padding: 10px 16px; font-size: 14px; font-weight: 700; color: #0f172a; text-align: right; font-family: monospace;">{truck_number}</td>
        </tr>
        <tr>
          <td style="padding: 10px 16px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; border-top: 1px solid #e2e8f0;">Driver</td>
          <td style="padding: 10px 16px; font-size: 14px; font-weight: 700; color: #0f172a; text-align: right; border-top: 1px solid #e2e8f0;">{driver.driver_name}</td>
        </tr>
        <tr>
          <td style="padding: 10px 16px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; border-top: 1px solid #e2e8f0;">Driver License / ID</td>
          <td style="padding: 10px 16px; font-size: 14px; font-weight: 700; color: #0f172a; text-align: right; font-family: monospace; border-top: 1px solid #e2e8f0;">{driver_license}</td>
        </tr>
        <tr>
          <td style="padding: 10px 16px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; border-top: 1px solid #e2e8f0;">Assigned Gate</td>
          <td style="padding: 10px 16px; font-size: 14px; font-weight: 700; color: #0f172a; text-align: right; border-top: 1px solid #e2e8f0;">{gate_name}</td>
        </tr>
        <tr>
          <td style="padding: 10px 16px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; border-top: 1px solid #e2e8f0;">Valid Until</td>
          <td style="padding: 10px 16px; font-size: 14px; font-weight: 700; color: #b45309; text-align: right; font-family: monospace; border-top: 1px solid #e2e8f0;">{valid_until_str}</td>
        </tr>
      </table>

      <div style="font-size: 12px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Authorized Containers</div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px;">
        <thead>
          <tr style="background-color: #f1f5f9; text-align: left;">
            <th style="padding: 8px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 11px; text-transform: uppercase;">Container #</th>
            <th style="padding: 8px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 11px; text-transform: uppercase;">Type</th>
            <th style="padding: 8px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 11px; text-transform: uppercase;">Weight</th>
            <th style="padding: 8px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 11px; text-transform: uppercase;">Status</th>
          </tr>
        </thead>
        <tbody>
          {html_container_rows}
        </tbody>
      </table>

      <!-- Actual QR Code Image Section -->
      <div style="text-align: center; padding: 24px 20px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 24px;">
        <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 6px;">
          Present this QR Code at the designated port gate
        </div>
        <div style="font-size: 12px; color: #475569; margin-bottom: 16px; line-height: 1.5; max-width: 480px; margin-left: auto; margin-right: auto;">
          The Gate &amp; Truck Operations Officer will scan the QR code and verify the gate pass before authorizing vehicle exit.
        </div>
        <div style="display: inline-block; padding: 12px; background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); margin-bottom: 14px;">
          <img src="cid:gate_pass_qr_code" alt="PORTIDE Digital Gate Pass QR Code" width="180" height="180" style="display: block; width: 180px; height: 180px; margin: 0 auto; border: 0;" />
        </div>
        <div style="font-size: 13px; font-weight: 700; font-family: monospace; color: #0284c7; letter-spacing: 0.5px; margin-bottom: 8px;">
          Verification Reference: {gate_pass.gate_pass_verification_code}
        </div>
        <div style="font-size: 11px; color: #64748b; line-height: 1.4; border-top: 1px dashed #cbd5e1; padding-top: 10px; max-width: 480px; margin-left: auto; margin-right: auto;">
          This pass is valid only for the assigned driver, truck, authorized container(s), designated gate and validity period. Do not share or reuse this pass.
        </div>
      </div>
    </div>

    <div style="padding: 16px 24px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center;">
      PORTIDE &bull; Maritime Port Operations Intelligence Platform &bull; Automated Dispatch System
    </div>
  </div>
</body>
</html>"""

        send_mail(
            subject=subject,
            message=text_body,
            from_email=get_from_email(),
            recipient_list=[recipient_email],
            html_message=html_body,
            fail_silently=False,
            inline_images=[('gate_pass_qr_code', qr_png_bytes, f'gate_pass_{pass_number}_qr.png')]
        )
        logger.info(f"Successfully sent digital gate pass email to driver {driver.driver_name} ({recipient_email}) for pass {pass_number}")
        return True, None


    except Exception as e:
        err_msg = str(e)
        logger.error(f"Failed to send digital gate pass email: {err_msg}", exc_info=True)
        return False, err_msg


def send_customs_document_review_notification(document, review_status: str, remarks: str = None, officer_name: str = None) -> bool:
    """
    Sends notification email when a Customs Officer reviews a supporting document.
    - If REJECTED: alerts the shipping company and document uploader with specific remarks and resubmission link.
    - If VERIFIED: sends an approval confirmation email.
    """
    try:
        container = getattr(document, 'document_container_id', None)
        if not container:
            return False

        shipping_company = container.shipping_company
        recipients = set()

        if shipping_company and getattr(shipping_company, 'shipping_company_email', None):
            recipients.add(shipping_company.shipping_company_email)

        uploader = getattr(document, 'document_uploaded_by', None)
        if uploader:
            if getattr(uploader, 'user_email', None):
                recipients.add(uploader.user_email)
            if getattr(uploader, 'login_id', None) and getattr(uploader.login_id, 'login_email', None):
                recipients.add(uploader.login_id.login_email)

        recipient_list = [r for r in recipients if r and '@' in r]
        if not recipient_list:
            logger.warning(f"No recipient email found for customs document #{document.document_id} review notification.")
            return False

        company_name = shipping_company.shipping_company_name if shipping_company else "Valued Shipping Partner"
        officer = officer_name or "Customs Authority Officer"
        doc_name = getattr(document, 'document_name', None) or getattr(document, 'original_filename', None) or f"Document #{document.document_id}"
        doc_type_display = document.get_document_type_display() if hasattr(document, 'get_document_type_display') else str(document.document_type)
        vessel_name = container.vessel.vessel_name if container.vessel else 'Scheduled Port Call'

        if review_status == 'REJECTED':
            subject = f"PORTIDE ACTION REQUIRED: Customs Document Rejected - Container {container.container_number}"
            plain_message = f"""Dear {company_name},

A customs supporting document submitted for Container {container.container_number} has been REJECTED by Customs Control. Corrective action is required before cargo inspection and clearance can proceed.

Container & Document Details:
- Container Number: {container.container_number}
- Cargo Description: {container.cargo.cargo_description if container.cargo else 'Containerized Cargo'}
- Vessel: {vessel_name}
- Document Name: {doc_name} (Version {document.document_version})
- Document Type: {doc_type_display}
- Review Decision: REJECTED / CORRECTION REQUIRED
- Customs Officer: {officer}
- Rejection Remarks / Reason:
  "{remarks or 'Document does not satisfy customs regulatory criteria or exhibits discrepancy.'}"

Required Corrective Action:
Please log in to your PORTIDE Shipping Portal, locate Container #{container.container_number}, open the customs document section, and upload a corrected replacement document. Submitting a replacement will create a new version (v{document.document_version + 1}) and resubmit it for customs review.

Access Portal: https://portide.vercel.app

Regards,
PORTIDE Customs & Border Clearance Division
Maritime Port Operations Intelligence Platform
"""
            html_message = f"""<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <div style="background: linear-gradient(135deg, #be123c, #9f1239); padding: 24px; color: #ffffff;">
      <h2 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.025em;">PORTIDE CUSTOMS ALERT</h2>
      <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Action Required: Supporting Document Rejected</p>
    </div>
    
    <div style="padding: 24px; color: #1e293b;">
      <p style="font-size: 14px; margin-top: 0;">Dear <strong>{company_name}</strong>,</p>
      
      <p style="font-size: 13px; color: #475569; line-height: 1.6;">
        A customs supporting document submitted for container <strong>#{container.container_number}</strong> has been 
        <span style="color: #be123c; font-weight: bold; background: #ffe4e6; padding: 2px 8px; border-radius: 4px;">REJECTED</span> 
        by Port Customs Control. Corrective action is required before cargo inspection can proceed.
      </p>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 16px 0; font-size: 13px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600; width: 140px;">Container:</td>
            <td style="padding: 6px 0; font-weight: 700; font-family: monospace; color: #0f172a;">{container.container_number}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Document:</td>
            <td style="padding: 6px 0; font-weight: 700; color: #0f172a;">{doc_name} <span style="font-size: 11px; background: #e2e8f0; padding: 1px 6px; border-radius: 4px;">v{document.document_version}</span></td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Document Type:</td>
            <td style="padding: 6px 0; color: #0f172a;">{doc_type_display}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Customs Officer:</td>
            <td style="padding: 6px 0; color: #0f172a;">{officer}</td>
          </tr>
        </table>
      </div>

      <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 12px; padding: 16px; margin: 16px 0;">
        <div style="font-size: 11px; font-weight: 800; color: #9f1239; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">
          Rejection Remarks & Reason:
        </div>
        <div style="font-size: 13px; color: #881337; font-weight: 600; line-height: 1.5;">
          "{remarks or 'Document does not satisfy customs regulatory criteria or exhibits discrepancy.'}"
        </div>
      </div>

      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin: 16px 0;">
        <div style="font-size: 11px; font-weight: 800; color: #166534; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">
          Required Carrier Action:
        </div>
        <p style="font-size: 12px; color: #14532d; margin: 0; line-height: 1.5;">
          Log in to your PORTIDE portal, review the officer's remarks above, and click <strong>"Resubmit Correction"</strong> to upload the corrected replacement document.
        </p>
      </div>

      <div style="text-align: center; margin: 24px 0 12px 0;">
        <a href="https://portide.vercel.app" style="display: inline-block; background: #064e43; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; padding: 12px 28px; border-radius: 10px;">
          Open Portal & Resubmit Document &rarr;
        </a>
      </div>
    </div>

    <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; font-size: 11px; color: #94a3b8; text-align: center;">
      PORTIDE Customs & Border Clearance Division • Maritime Port Operations Intelligence Platform
    </div>
  </div>
</body>
</html>
"""
        else:  # VERIFIED
            subject = f"PORTIDE Notice: Customs Document Verified - Container {container.container_number}"
            plain_message = f"""Dear {company_name},

The customs supporting document "{doc_name}" ({doc_type_display}) for Container {container.container_number} has been VERIFIED and approved by Customs Officer {officer}.

Review Remarks: {remarks or 'Verified and compliant with customs regulations.'}

Regards,
PORTIDE Customs & Border Clearance Division
"""
            html_message = f"""<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <div style="background: linear-gradient(135deg, #059669, #047857); padding: 24px; color: #ffffff;">
      <h2 style="margin: 0; font-size: 20px; font-weight: 800;">PORTIDE CUSTOMS NOTIFICATION</h2>
      <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Document Verification Approved</p>
    </div>
    <div style="padding: 24px; color: #1e293b; font-size: 13px; line-height: 1.6;">
      <p>Dear <strong>{company_name}</strong>,</p>
      <p>The following supporting document for container <strong>#{container.container_number}</strong> has been <strong style="color: #059669;">VERIFIED</strong> by Customs Officer <strong>{officer}</strong>:</p>
      <ul>
        <li><strong>Document:</strong> {doc_name} (v{document.document_version})</li>
        <li><strong>Category:</strong> {doc_type_display}</li>
        <li><strong>Customs Remarks:</strong> {remarks or 'Verified and compliant.'}</li>
      </ul>
      <p>Thank you for your cooperation in maintaining swift port compliance.</p>
    </div>
    <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; font-size: 11px; color: #94a3b8; text-align: center;">
      PORTIDE Customs & Border Clearance Division • Maritime Port Operations Intelligence Platform
    </div>
  </div>
</body>
</html>
"""

        _send_mail_async(
            subject=subject,
            message=plain_message,
            from_email=get_from_email(),
            recipient_list=recipient_list,
            html_message=html_message
        )
        logger.info(f"Queued customs document review notification ({review_status}) for doc #{document.document_id} to {recipient_list}")
        return True
    except Exception as e:
        logger.error(f"Failed to queue customs document review notification: {str(e)}", exc_info=True)
        return False


def send_customs_document_resubmitted_notification(new_document, old_document, reason: str = None, carrier_name: str = None) -> bool:
    """
    Sends confirmation notification when a shipping carrier uploads a replacement / corrected document.
    """
    try:
        container = getattr(new_document, 'document_container_id', None)
        if not container:
            return False

        shipping_company = container.shipping_company
        recipients = set()

        if shipping_company and getattr(shipping_company, 'shipping_company_email', None):
            recipients.add(shipping_company.shipping_company_email)

        uploader = getattr(new_document, 'document_uploaded_by', None)
        if uploader:
            if getattr(uploader, 'user_email', None):
                recipients.add(uploader.user_email)
            if getattr(uploader, 'login_id', None) and getattr(uploader.login_id, 'login_email', None):
                recipients.add(uploader.login_id.login_email)

        recipient_list = [r for r in recipients if r and '@' in r]
        if not recipient_list:
            return False

        company_name = shipping_company.shipping_company_name if shipping_company else "Valued Shipping Partner"
        doc_name = getattr(new_document, 'document_name', None) or f"Document #{new_document.document_id}"
        doc_type_display = new_document.get_document_type_display() if hasattr(new_document, 'get_document_type_display') else str(new_document.document_type)

        subject = f"PORTIDE Confirmation: Corrected Document Submitted - Container {container.container_number}"
        plain_message = f"""Dear {company_name},

Your corrected customs supporting document has been successfully received and submitted for Customs Officer review.

Details:
- Container: {container.container_number}
- Replacement File: {doc_name} (Version {new_document.document_version})
- Superseded File: {old_document.document_name} (Version {old_document.document_version})
- Document Type: {doc_type_display}
- Reason / Amendment: {reason or 'Resubmission per customs request'}
- Review Status: PENDING REVIEW

Port Customs Control has been alerted to review the new file.

Regards,
PORTIDE Customs & Border Clearance Division
"""
        _send_mail_async(
            subject=subject,
            message=plain_message,
            from_email=get_from_email(),
            recipient_list=recipient_list,
        )
        logger.info(f"Queued customs document resubmitted confirmation for doc #{new_document.document_id} to {recipient_list}")
        return True
    except Exception as e:
        logger.error(f"Failed to queue customs document resubmission email: {str(e)}", exc_info=True)
        return False



