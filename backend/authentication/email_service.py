import logging
import os
import json
import urllib.request
import urllib.error
import urllib.parse
from email.mime.image import MIMEImage
from django.core.mail import EmailMultiAlternatives, send_mail as django_send_mail
from django.conf import settings
from authentication.models import User
from authentication.qr_service import generate_qr_png_bytes, generate_qr_png_base64

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


def _render_responsive_email_layout(
    subject: str,
    header_kicker: str,
    header_title: str,
    header_subtitle: str,
    header_gradient: str,
    header_kicker_color: str,
    header_subtitle_color: str,
    body_content: str,
    footer_text: str = "PORTIDE &bull; Maritime Port Operations Intelligence Platform &bull; Automated Dispatch System",
) -> str:
    """
    Renders a unified, mobile-first responsive HTML email template:
    - Zero horizontal scrolling across mobile (320px, 375px, 390px, 430px), tablet, and desktop.
    - Uses fluid width: 100% with max-width: 600px.
    - Stacked responsive table rows on narrow viewports for long labels, roles, departments, emails, and container numbers.
    - Preserves PORTIDE branding, gradients, typography, and status indicators.
    - Avoids JavaScript, onclick, and Clipboard APIs inside emails.
    """
    clean_subj = str(subject or "PORTIDE Notification")
    clean_kicker = str(header_kicker or "PORTIDE")
    clean_title = str(header_title or "")
    clean_subtitle = str(header_subtitle or "")
    clean_footer = str(footer_text or "")

    css_styles = """
    /* Reset & fluid email layout */
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      height: 100% !important;
      width: 100% !important;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      border-collapse: collapse !important;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
      -ms-interpolation-mode: bicubic;
    }
    /* Responsive overrides for narrow screens (320px, 375px, 390px, 430px, tablet) */
    @media only screen and (max-width: 600px) {
      .email-wrapper {
        padding: 12px 6px !important;
      }
      .email-container {
        width: 100% !important;
        max-width: 100% !important;
        border-radius: 12px !important;
      }
      .header-content {
        padding: 22px 16px !important;
      }
      .header-title {
        font-size: 20px !important;
        letter-spacing: -0.25px !important;
      }
      .body-content {
        padding: 18px 14px !important;
      }
      .data-table-stacked tr {
        display: block !important;
        border-bottom: 1px solid #e2e8f0 !important;
      }
      .data-table-stacked tr:last-child {
        border-bottom: none !important;
      }
      .data-table-stacked td.data-label {
        display: block !important;
        width: 100% !important;
        text-align: left !important;
        padding: 8px 12px 2px 12px !important;
        box-sizing: border-box !important;
      }
      .data-table-stacked td.data-value {
        display: block !important;
        width: 100% !important;
        text-align: left !important;
        padding: 2px 12px 10px 12px !important;
        border-top: none !important;
        box-sizing: border-box !important;
      }
      .footer-content {
        padding: 14px 14px !important;
        font-size: 11px !important;
      }
      .code-box-inner {
        padding: 10px 14px !important;
        max-width: 100% !important;
      }
      .code-box-text {
        font-size: 16px !important;
        letter-spacing: 1px !important;
      }
      .btn-action {
        display: block !important;
        width: 100% !important;
        box-sizing: border-box !important;
        text-align: center !important;
        padding: 12px 16px !important;
      }
      .alert-box {
        padding: 12px 12px !important;
      }
      .qr-wrapper {
        padding: 10px !important;
      }
      .qr-img {
        width: 180px !important;
        height: 180px !important;
      }
    }
    """

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>{clean_subj}</title>
  <style>{css_styles}</style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-wrapper" style="background-color: #f1f5f9; padding: 24px 12px; margin: 0; width: 100%;">
    <tr>
      <td align="center" style="padding: 0;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-container" style="max-width: 600px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td class="header-content" style="background: {header_gradient}; padding: 26px 24px; text-align: center; color: #ffffff;">
              <div style="font-size: 12px; font-weight: 800; letter-spacing: 2px; color: {header_kicker_color}; text-transform: uppercase;">{clean_kicker}</div>
              <h1 class="header-title" style="margin: 6px 0 0 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff;">{clean_title}</h1>
              <div style="margin-top: 8px; font-size: 13px; color: {header_subtitle_color}; word-break: break-word;">{clean_subtitle}</div>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td class="body-content" style="padding: 24px; color: #1e293b; font-size: 14px; line-height: 1.5;">
              {body_content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td class="footer-content" style="padding: 16px 24px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; line-height: 1.5;">
              {clean_footer}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _render_copyable_code_box(code_text: str, label: str = "Credential / Code", helper_note: str = "Select code to copy") -> str:
    """
    Renders an email-client resilient monospace code block with user-select styling.
    Selectable text in highlighted box with simple manual-copy instructions.
    No JavaScript, onclick, or clipboard API used.
    """
    clean_code = str(code_text or '').strip()
    return f"""
    <div style="margin: 16px 0; text-align: center; max-width: 100%; box-sizing: border-box;">
      <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px;">
        {label}
      </div>
      <div class="code-box-inner" style="display: inline-block; max-width: 100%; box-sizing: border-box; background: #0f172a; border: 1.5px dashed #38bdf8; border-radius: 10px; padding: 12px 18px; text-align: center; user-select: all; -webkit-user-select: all; -moz-user-select: all; -ms-user-select: all; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08); word-break: break-all; overflow-wrap: anywhere;">
        <span class="code-box-text" style="font-family: 'Courier New', Courier, monospace, Consolas; font-size: 18px; font-weight: 800; color: #38bdf8; letter-spacing: 1.5px; user-select: all; -webkit-user-select: all; display: inline-block; max-width: 100%; word-break: break-all; overflow-wrap: anywhere;">{clean_code}</span>
      </div>
      <div style="margin-top: 6px; font-size: 11px; color: #64748b;">
        <span style="background: #e2e8f0; color: #334155; padding: 2px 8px; border-radius: 4px; font-weight: 600; display: inline-block; max-width: 100%; word-break: break-word;">📋 {helper_note}</span>
      </div>
    </div>
    """


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
        frontend_url = getattr(settings, 'FRONTEND_URL', None) or 'https://portide.vercel.app'

        subject = f"PORTIDE Registration Request Received ({req_code})"
        plain_body = f"""Hello {applicant_name},

Your Shipping Company registration request has been successfully submitted to PORTIDE.

Registration Request ID: {req_code}
Company: {company_name}
Status: Pending Review

Your application will be reviewed by Port Administration.
You will receive an email notification when the status changes.

Track / Access Portal: {frontend_url}

Regards,
PORTIDE Administration
Maritime Port Operations Intelligence Platform
"""

        copy_box = _render_copyable_code_box(req_code, "Registration Reference Code", "Select reference code to copy")

        body_html = f"""
          <p style="margin: 0 0 16px 0; font-size: 15px;">Hello <strong>{applicant_name}</strong>,</p>
          <p style="margin: 0 0 20px 0; font-size: 14px; color: #64748b; line-height: 1.5;">
            Your Shipping Company registration request has been successfully submitted and queued for administrative review.
          </p>

          {copy_box}

          <table role="presentation" class="data-table-stacked" style="width: 100%; border-collapse: collapse; margin-bottom: 20px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; table-layout: auto;">
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word;">Company</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; word-break: break-word; overflow-wrap: anywhere;">{company_name}</td>
            </tr>
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word; border-top: 1px solid #e2e8f0;">Applicant</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; word-break: break-word; overflow-wrap: anywhere; border-top: 1px solid #e2e8f0;">{applicant_name}</td>
            </tr>
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word; border-top: 1px solid #e2e8f0;">Registered Email</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0284c7; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; word-break: break-all; overflow-wrap: anywhere; border-top: 1px solid #e2e8f0;">{email}</td>
            </tr>
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word; border-top: 1px solid #e2e8f0;">Review Status</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 800; color: #d97706; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; border-top: 1px solid #e2e8f0;">PENDING REVIEW</td>
            </tr>
          </table>

          <div class="alert-box" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 20px 0; font-size: 13px; color: #475569; line-height: 1.6; box-sizing: border-box;">
            <div style="font-weight: 700; color: #0f172a; margin-bottom: 6px;">Next Steps:</div>
            <ol style="margin: 0; padding-left: 20px;">
              <li>Port Administration will verify your company documentation and credentials.</li>
              <li>You will receive an automated notification as soon as your account is approved.</li>
              <li>Save the reference code above to check application progress.</li>
            </ol>
          </div>

          <div style="text-align: center; margin: 24px 0 10px 0;">
            <a href="{frontend_url}" class="btn-action" style="display: inline-block; background: #064e43; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; padding: 12px 28px; border-radius: 8px; max-width: 100%; box-sizing: border-box;">
              Visit PORTIDE Platform &rarr;
            </a>
          </div>
        """

        html_body = _render_responsive_email_layout(
            subject=subject,
            header_kicker="PORTIDE Intelligence Platform",
            header_title="REGISTRATION RECEIVED",
            header_subtitle="Shipping Partner Onboarding",
            header_gradient="linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
            header_kicker_color="#f59e0b",
            header_subtitle_color="#94a3b8",
            body_content=body_html,
        )

        _send_mail_async(
            subject=subject,
            message=plain_body,
            from_email=get_from_email(),
            recipient_list=[email],
            html_message=html_body,
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
        frontend_url = getattr(settings, 'FRONTEND_URL', None) or 'https://portide.vercel.app'

        subject = f"PORTIDE ACTION REQUIRED: Additional Documentation Needed – {req_code}"
        plain_body = f"""Hello {applicant_name},

Additional documentation or information is required for your PORTIDE registration request.

Company: {company_name}
Registration Request ID: {req_code}
Status: ACTION REQUIRED

Required document(s) / corrections:
{required_docs_display}

Administrator Message:
"{admin_message}"

Instructions:
Please visit {frontend_url} and upload the requested document(s).
Important: You do NOT need to complete the entire registration form again. Your existing company details remain saved.

Regards,
PORTIDE Administration
Maritime Port Operations Intelligence Platform
"""

        copy_box = _render_copyable_code_box(req_code, "Registration Reference Code", "Select reference code to copy")

        body_html = f"""
          <p style="margin: 0 0 16px 0; font-size: 15px;">Hello <strong>{applicant_name}</strong>,</p>
          <p style="margin: 0 0 16px 0; font-size: 14px; color: #64748b; line-height: 1.5;">
            Port Administration has reviewed your Shipping Company registration for <strong>{company_name}</strong> and requires additional information or document updates before approval can be granted.
          </p>

          {copy_box}

          <div class="alert-box" style="background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 12px; padding: 16px; margin: 18px 0; box-sizing: border-box;">
            <div style="font-size: 11px; font-weight: 800; color: #92400e; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">
              Administrator Message:
            </div>
            <div style="font-size: 13px; color: #78350f; font-weight: 600; line-height: 1.5; word-break: break-word;">
              "{admin_message}"
            </div>
          </div>

          <div class="alert-box" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 18px 0; box-sizing: border-box;">
            <div style="font-size: 11px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">
              Requested Document(s) / Correction(s):
            </div>
            <div style="font-size: 13px; color: #334155; line-height: 1.5; word-break: break-word;">
              {required_docs_display}
            </div>
          </div>

          <div class="alert-box" style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 12px 16px; margin: 18px 0; font-size: 12px; color: #1e40af; line-height: 1.5; box-sizing: border-box;">
            💡 <strong>Quick Note:</strong> You do NOT need to complete the entire registration form again. Your company details remain safely preserved. Simply upload the requested document(s).
          </div>

          <div style="text-align: center; margin: 24px 0 10px 0;">
            <a href="{frontend_url}" class="btn-action" style="display: inline-block; background: #9a3412; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; padding: 12px 28px; border-radius: 8px; max-width: 100%; box-sizing: border-box;">
              Open Portal &amp; Upload Document &rarr;
            </a>
          </div>
        """

        html_body = _render_responsive_email_layout(
            subject=subject,
            header_kicker="PORTIDE Administration",
            header_title="ACTION REQUIRED",
            header_subtitle="Additional Documentation Needed",
            header_gradient="linear-gradient(135deg, #7c2d12 0%, #9a3412 100%)",
            header_kicker_color="#fed7aa",
            header_subtitle_color="#ffedd5",
            body_content=body_html,
        )

        _send_mail_async(
            subject=subject,
            message=plain_body,
            from_email=get_from_email(),
            recipient_list=[email],
            html_message=html_body,
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
        frontend_url = getattr(settings, 'FRONTEND_URL', None) or 'https://portide.vercel.app'

        admin_emails = list(User.objects.filter(
            login_id__login_role='port_administrator',
            login_id__login_is_active=True
        ).values_list('login_id__login_email', flat=True))

        if not admin_emails:
            admin_emails = [get_from_email()]

        subject = f"PORTIDE Notice: Registration Resubmitted ({req_code})"
        plain_body = f"""Hello Port Administrator,

A shipping company has resubmitted their registration application with updated documentation.

Company: {company_name}
Registration Request ID: {req_code}
Status: Pending Review

The company has uploaded the requested correction/document. Please review the updated application in the Port Administration portal.

Portal: {frontend_url}

Regards,
PORTIDE Notification System
"""

        copy_box = _render_copyable_code_box(req_code, "Registration Reference Code", "Select reference code to copy")

        body_html = f"""
          <p style="margin: 0 0 16px 0; font-size: 15px;">Hello Port Administrator,</p>
          <p style="margin: 0 0 16px 0; font-size: 14px; color: #64748b; line-height: 1.5;">
            <strong>{company_name}</strong> has resubmitted their registration application with the requested replacement documentation.
          </p>

          {copy_box}

          <div style="text-align: center; margin: 24px 0 10px 0;">
            <a href="{frontend_url}" class="btn-action" style="display: inline-block; background: #0284c7; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; padding: 12px 28px; border-radius: 8px; max-width: 100%; box-sizing: border-box;">
              Review Application in Admin Portal &rarr;
            </a>
          </div>
        """

        html_body = _render_responsive_email_layout(
            subject=subject,
            header_kicker="PORTIDE Administration",
            header_title="APPLICATION RESUBMITTED",
            header_subtitle="Updated Documentation Ready for Review",
            header_gradient="linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
            header_kicker_color="#38bdf8",
            header_subtitle_color="#94a3b8",
            body_content=body_html,
            footer_text="PORTIDE &bull; Maritime Port Operations Intelligence Platform"
        )

        _send_mail_async(
            subject=subject,
            message=plain_body,
            from_email=get_from_email(),
            recipient_list=admin_emails,
            html_message=html_body,
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

        subject = f"PORTIDE Registration Approved – Welcome Aboard ({company_name})"
        plain_body = f"""Hello {applicant_name},

Congratulations! Your Shipping Company registration for {company_name} has been approved.

Registration Request ID: {req_code}
Status: APPROVED

Your account is now fully active. You can log in to PORTIDE using your registered account credentials.

Login URL: {login_url}

Welcome to PORTIDE Maritime Port Operations Intelligence Platform.

Regards,
PORTIDE Administration
"""

        copy_box = _render_copyable_code_box(req_code, "Registration Reference Code", "Select reference code to copy")

        body_html = f"""
          <p style="margin: 0 0 16px 0; font-size: 15px;">Congratulations <strong>{applicant_name}</strong>,</p>
          <p style="margin: 0 0 20px 0; font-size: 14px; color: #64748b; line-height: 1.5;">
            Your Shipping Company registration for <strong>{company_name}</strong> has been officially approved by Port Administration. Your account is now fully active.
          </p>

          {copy_box}

          <table role="presentation" class="data-table-stacked" style="width: 100%; border-collapse: collapse; margin-bottom: 24px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; table-layout: auto;">
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word;">Company</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; word-break: break-word; overflow-wrap: anywhere;">{company_name}</td>
            </tr>
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word; border-top: 1px solid #e2e8f0;">Portal Email</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0284c7; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; word-break: break-all; overflow-wrap: anywhere; border-top: 1px solid #e2e8f0;">{email}</td>
            </tr>
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word; border-top: 1px solid #e2e8f0;">Account Status</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 800; color: #059669; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; border-top: 1px solid #e2e8f0;">ACTIVE &bull; APPROVED</td>
            </tr>
          </table>

          <div class="alert-box" style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin-bottom: 24px; font-size: 13px; color: #166534; line-height: 1.5; box-sizing: border-box;">
            <div style="font-weight: 700; margin-bottom: 4px;">🚀 Unlocked Operational Capabilities:</div>
            <ul style="margin: 0; padding-left: 20px;">
              <li>Vessel Arrival Notification submission &amp; tracking</li>
              <li>Digital Cargo Manifests &amp; Customs document uploads</li>
              <li>Berth schedule monitoring and real-time container tracking</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 24px 0 10px 0;">
            <a href="{login_url}" class="btn-action" style="display: inline-block; background: #059669; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 13px 32px; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(5, 150, 105, 0.3); max-width: 100%; box-sizing: border-box;">
              Sign In to PORTIDE &rarr;
            </a>
          </div>
        """

        html_body = _render_responsive_email_layout(
            subject=subject,
            header_kicker="PORTIDE Official Approval",
            header_title="WELCOME TO PORTIDE",
            header_subtitle="Registration Approved &amp; Account Activated",
            header_gradient="linear-gradient(135deg, #064e3b 0%, #047857 100%)",
            header_kicker_color="#a7f3d0",
            header_subtitle_color="#d1fae5",
            body_content=body_html,
        )

        _send_mail_async(
            subject=subject,
            message=plain_body,
            from_email=get_from_email(),
            recipient_list=[email],
            html_message=html_body,
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

        subject = f"PORTIDE Registration Request – Rejected ({req_code})"
        plain_body = f"""Hello {applicant_name},

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

        copy_box = _render_copyable_code_box(req_code, "Registration Reference Code", "Select reference code to copy")

        body_html = f"""
          <p style="margin: 0 0 16px 0; font-size: 15px;">Hello <strong>{applicant_name}</strong>,</p>
          <p style="margin: 0 0 16px 0; font-size: 14px; color: #64748b; line-height: 1.5;">
            Thank you for your interest in the PORTIDE Maritime Intelligence Platform. After reviewing the application for <strong>{company_name}</strong>, Port Administration has decided not to approve this registration at this time.
          </p>

          {copy_box}

          <div class="alert-box" style="background: #fff1f2; border: 1.5px solid #fecdd3; border-radius: 12px; padding: 16px; margin: 20px 0; box-sizing: border-box;">
            <div style="font-size: 11px; font-weight: 800; color: #9f1239; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">
              Reason for Decision:
            </div>
            <div style="font-size: 13px; color: #881337; font-weight: 600; line-height: 1.5; word-break: break-word;">
              "{rejection_reason}"
            </div>
          </div>

          <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
            If you have questions regarding this decision or wish to submit a new application with verified credentials, please contact the Port Administration Office.
          </p>
        """

        html_body = _render_responsive_email_layout(
            subject=subject,
            header_kicker="PORTIDE Administration",
            header_title="APPLICATION REJECTED",
            header_subtitle="Registration Request Decision",
            header_gradient="linear-gradient(135deg, #881337 0%, #9f1239 100%)",
            header_kicker_color="#fecdd3",
            header_subtitle_color="#ffe4e6",
            body_content=body_html,
            footer_text="PORTIDE &bull; Maritime Port Operations Intelligence Platform"
        )

        _send_mail_async(
            subject=subject,
            message=plain_body,
            from_email=get_from_email(),
            recipient_list=[email],
            html_message=html_body,
        )
        logger.info(f"Queued async registration rejection email to {email} for request {req_code}")
        return True
    except Exception as e:
        logger.error(f"Failed to queue registration rejection email: {str(e)}", exc_info=True)
        return False


def send_staff_account_created_email(user_obj, temp_password: str) -> bool:
    """
    Sends credential notification email to newly created internal staff member with responsive Gmail/mobile layout.
    Password is selectable text in highlighted box with simple manual-copy instructions.
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
        department = user_obj.user_department or (user_obj.department_id.department_department_name if getattr(user_obj, 'department_id', None) else 'Port Operations')
        
        frontend_url = getattr(settings, 'FRONTEND_URL', None) or 'https://portide.vercel.app'
        login_url = f"{frontend_url.rstrip('/')}/login"

        subject = "PORTIDE – Internal Staff Account Created & Login Credentials"
        plain_body = f"""Hello {full_name},

Your internal staff account has been created in the PORTIDE Intelligent Maritime Port Operations Platform.

Account Details:
- Employee ID: {employee_id}
- Role: {role_display}
- Department: {department}
- Email: {recipient_email}

Temporary Password:
{temp_password}

Login URL:
{login_url}

IMPORTANT:
- This is a temporary password generated by PORTIDE.
- You must change your password immediately after your first successful login.
- Please do not share your credentials with anyone.

Regards,
PORTIDE Administration
Maritime Port Operations Intelligence Platform
"""

        copy_box = _render_copyable_code_box(temp_password, "Temporary Access Password", "Select password to copy")

        body_html = f"""
          <p style="margin: 0 0 16px 0; font-size: 15px;">Hello <strong>{full_name}</strong>,</p>
          <p style="margin: 0 0 20px 0; font-size: 14px; color: #64748b; line-height: 1.5;">
            An internal operational staff account has been provisioned for you. Use the temporary credentials below to sign in to the PORTIDE platform.
          </p>

          {copy_box}

          <table role="presentation" class="data-table-stacked" style="width: 100%; border-collapse: collapse; margin-bottom: 24px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; table-layout: auto;">
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word;">Employee ID</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; font-family: monospace; word-break: break-all; overflow-wrap: anywhere;">{employee_id}</td>
            </tr>
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word; border-top: 1px solid #e2e8f0;">Assigned Role</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0284c7; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; word-break: break-word; overflow-wrap: anywhere; border-top: 1px solid #e2e8f0;">{role_display}</td>
            </tr>
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word; border-top: 1px solid #e2e8f0;">Department</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; word-break: break-word; overflow-wrap: anywhere; border-top: 1px solid #e2e8f0;">{department}</td>
            </tr>
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word; border-top: 1px solid #e2e8f0;">Portal Email</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; word-break: break-all; overflow-wrap: anywhere; border-top: 1px solid #e2e8f0;">{recipient_email}</td>
            </tr>
          </table>

          <div class="alert-box" style="background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 12px; padding: 16px; margin-bottom: 24px; font-size: 13px; color: #92400e; line-height: 1.5; box-sizing: border-box;">
            <div style="font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">
              🔒 Mandatory First-Login Security Policy:
            </div>
            <div>
              This temporary password was generated automatically by PORTIDE. Upon signing in for the first time, you will be prompted to choose a permanent, private password.
            </div>
          </div>

          <div style="text-align: center; margin: 24px 0 10px 0;">
            <a href="{login_url}" class="btn-action" style="display: inline-block; background: #0284c7; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 13px 32px; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(2, 132, 199, 0.3); max-width: 100%; box-sizing: border-box;">
              Sign In to Portal &rarr;
            </a>
          </div>
        """

        html_body = _render_responsive_email_layout(
            subject=subject,
            header_kicker="PORTIDE Security &amp; Access",
            header_title="STAFF ACCOUNT CREATED",
            header_subtitle="Welcome to Maritime Operations Intelligence",
            header_gradient="linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
            header_kicker_color="#38bdf8",
            header_subtitle_color="#94a3b8",
            body_content=body_html,
        )

        send_mail(
            subject=subject,
            message=plain_body,
            from_email=get_from_email(),
            recipient_list=[recipient_email],
            html_message=html_body,
            fail_silently=False
        )
        logger.info(f"Sent staff account creation email to {recipient_email} for employee {employee_id}")
        return True
    except Exception as e:
        logger.error(f"Failed to send staff account creation email to {getattr(user_obj.login_id, 'login_email', 'unknown')}: {str(e)}", exc_info=True)
        return False


def send_password_reset_email(login_obj, plain_token: str, reset_link: str) -> bool:
    """
    Sends responsive HTML password reset email with selectable security token and direct reset CTA.
    """
    try:
        email = login_obj.login_email
        full_name = getattr(login_obj, 'profile', None)
        recipient_name = getattr(full_name, 'user_full_name', None) or email.split('@')[0].capitalize()

        subject = "PORTIDE Security – Password Reset Request"
        plain_body = f"""Hello {recipient_name},

A password reset was requested for your PORTIDE account ({email}).

To set a new password, click the link below:
{reset_link}

Alternatively, you can copy your Password Reset Security Token:
{plain_token}

This link and token are valid for 30 minutes.

If you did NOT request a password reset, you can safely ignore this email. Your account remains secure.

Regards,
PORTIDE Security & Administration
Maritime Port Operations Intelligence Platform
"""

        copy_box = _render_copyable_code_box(plain_token, "Password Reset Security Token", "Select token to copy")

        body_html = f"""
          <p style="margin: 0 0 16px 0; font-size: 15px;">Hello <strong>{recipient_name}</strong>,</p>
          <p style="margin: 0 0 20px 0; font-size: 14px; color: #64748b; line-height: 1.5;">
            A request was submitted to reset the password for your PORTIDE account (<strong>{email}</strong>). Click the button below to choose a new password:
          </p>

          <div style="text-align: center; margin: 24px 0 20px 0;">
            <a href="{reset_link}" class="btn-action" style="display: inline-block; background: #0284c7; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 13px 34px; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(2, 132, 199, 0.3); max-width: 100%; box-sizing: border-box;">
              Reset Password &rarr;
            </a>
          </div>

          {copy_box}

          <div class="alert-box" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; margin: 20px 0; font-size: 11px; color: #64748b; word-break: break-all; box-sizing: border-box;">
            <span style="font-weight: 700; color: #334155;">Direct Reset Link:</span><br/>
            <span style="font-family: monospace; color: #0284c7; user-select: all; -webkit-user-select: all; font-size: 12px; word-break: break-all;">{reset_link}</span>
          </div>

          <div class="alert-box" style="background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 12px; padding: 16px; margin: 20px 0; font-size: 13px; color: #92400e; line-height: 1.5; box-sizing: border-box;">
            <div style="font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">
              ⏱️ Security Notice:
            </div>
            <div>
              This link and token are valid for <strong>30 minutes</strong> and can only be used once. If you did not request this change, please disregard this email — your account remains completely secure.
            </div>
          </div>
        """

        html_body = _render_responsive_email_layout(
            subject=subject,
            header_kicker="PORTIDE Security &amp; Access",
            header_title="PASSWORD RESET REQUEST",
            header_subtitle="Secure Account Recovery",
            header_gradient="linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
            header_kicker_color="#f59e0b",
            header_subtitle_color="#94a3b8",
            body_content=body_html,
        )

        _send_mail_async(
            subject=subject,
            message=plain_body,
            from_email=get_from_email(),
            recipient_list=[email],
            html_message=html_body,
        )
        logger.info(f"Queued async password reset email to {email}")
        return True
    except Exception as e:
        logger.error(f"Failed to queue password reset email: {str(e)}", exc_info=True)
        return False


def send_password_changed_notification(login_obj) -> bool:
    """
    Sends confirmation notification email when an account password is changed or reset.
    """
    try:
        from django.utils import timezone
        email = login_obj.login_email
        time_str = timezone.now().strftime('%d %b %Y %H:%M UTC')
        role_display = login_obj.login_role.replace('_', ' ').title() if login_obj.login_role else 'Platform User'
        frontend_url = getattr(settings, 'FRONTEND_URL', None) or 'https://portide.vercel.app'
        login_url = f"{frontend_url.rstrip('/')}/login"

        subject = "PORTIDE Security Alert: Password Updated Successfully"
        plain_body = f"""Hello,

The password for your PORTIDE account ({email}) was successfully updated on {time_str}.

Account Details:
- Email: {email}
- Role: {role_display}
- Updated: {time_str}
- Security: PBKDF2 Encrypted

If you performed this change, you can safely disregard this notice.

If you did NOT authorize this change, please contact Port Administration and the PORTIDE Security Team immediately to protect your account.

Login: {login_url}

Regards,
PORTIDE Security & Administration
Maritime Port Operations Intelligence Platform
"""

        body_html = f"""
          <p style="margin: 0 0 16px 0; font-size: 15px;">Hello,</p>
          <p style="margin: 0 0 20px 0; font-size: 14px; color: #64748b; line-height: 1.5;">
            The password for your PORTIDE account (<strong>{email}</strong>) was successfully updated.
          </p>

          <table role="presentation" class="data-table-stacked" style="width: 100%; border-collapse: collapse; margin-bottom: 24px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; table-layout: auto;">
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word;">Account Email</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; word-break: break-all; overflow-wrap: anywhere;">{email}</td>
            </tr>
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word; border-top: 1px solid #e2e8f0;">Account Role</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0284c7; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; word-break: break-word; overflow-wrap: anywhere; border-top: 1px solid #e2e8f0;">{role_display}</td>
            </tr>
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word; border-top: 1px solid #e2e8f0;">Updated At</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; font-family: monospace; border-top: 1px solid #e2e8f0;">{time_str}</td>
            </tr>
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word; border-top: 1px solid #e2e8f0;">Security Status</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 800; color: #059669; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; border-top: 1px solid #e2e8f0;">ACTIVE &bull; SECURED</td>
            </tr>
          </table>

          <div class="alert-box" style="background: #fff1f2; border: 1.5px solid #fecdd3; border-radius: 12px; padding: 16px; margin-bottom: 24px; font-size: 13px; color: #9f1239; line-height: 1.5; box-sizing: border-box;">
            <div style="font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">
              ⚠️ Did not make this change?
            </div>
            <div>
              If you did NOT initiate this password change, your account may be compromised. Please contact Port Administration and the PORTIDE Security Team immediately to lock the account and restore access.
            </div>
          </div>

          <div style="text-align: center; margin: 24px 0 10px 0;">
            <a href="{login_url}" class="btn-action" style="display: inline-block; background: #059669; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 13px 32px; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(5, 150, 105, 0.3); max-width: 100%; box-sizing: border-box;">
              Sign In to PORTIDE &rarr;
            </a>
          </div>
        """

        html_body = _render_responsive_email_layout(
            subject=subject,
            header_kicker="PORTIDE Security Alert",
            header_title="PASSWORD UPDATED",
            header_subtitle="Security Credentials Successfully Changed",
            header_gradient="linear-gradient(135deg, #064e3b 0%, #047857 100%)",
            header_kicker_color="#86efac",
            header_subtitle_color="#d1fae5",
            body_content=body_html,
        )

        _send_mail_async(
            subject=subject,
            message=plain_body,
            from_email=get_from_email(),
            recipient_list=[email],
            html_message=html_body,
        )
        logger.info(f"Queued async password changed notification to {email}")
        return True
    except Exception as e:
        logger.error(f"Failed to queue password changed notification: {str(e)}", exc_info=True)
        return False


def send_customs_cleared_notification(container, officer_name: str = None) -> bool:
    """
    Sends notification email when a container is cleared by Customs.
    Notifies the linked shipping company with selectable container number.
    """
    try:
        shipping_company = container.shipping_company
        recipient_email = shipping_company.shipping_company_email if shipping_company else None
        if not recipient_email:
            return False

        subject = f"PORTIDE Customs Notification: Container {container.container_number} Cleared"
        container_type_display = container.get_container_type_display() if hasattr(container, 'get_container_type_display') else 'Standard Container'
        cargo_desc = container.cargo.cargo_description if getattr(container, 'cargo', None) else 'Containerized Cargo'
        vessel_name = container.vessel.vessel_name if getattr(container, 'vessel', None) else 'N/A'
        officer = officer_name or 'Customs Authority'

        plain_body = f"""Dear {shipping_company.shipping_company_name},

Container {container.container_number} has been cleared by Customs and is ready for the next operational stage.

Container Details:
- Container Number: {container.container_number}
- Container Type: {container_type_display}
- Gross Weight: {container.container_gross_weight} Tonnes
- Cargo Description: {cargo_desc}
- Vessel: {vessel_name}
- Customs Officer: {officer}
- Status: Cleared

Regards,
PORTIDE Customs & Border Clearance Division
Maritime Port Operations Intelligence Platform
"""

        copy_box = _render_copyable_code_box(container.container_number, "Container Number", "Select container number to copy")

        body_html = f"""
          <p style="margin: 0 0 16px 0; font-size: 15px;">Dear <strong>{shipping_company.shipping_company_name}</strong>,</p>
          <p style="margin: 0 0 16px 0; font-size: 14px; color: #64748b; line-height: 1.5;">
            Customs inspection has been successfully completed for container <strong>#{container.container_number}</strong>. The container has been granted customs clearance.
          </p>

          {copy_box}

          <table role="presentation" class="data-table-stacked" style="width: 100%; border-collapse: collapse; margin-bottom: 24px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; table-layout: auto;">
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word;">Container Type</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; word-break: break-word; overflow-wrap: anywhere;">{container_type_display}</td>
            </tr>
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word; border-top: 1px solid #e2e8f0;">Gross Weight</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; word-break: break-word; overflow-wrap: anywhere; border-top: 1px solid #e2e8f0;">{container.container_gross_weight} T</td>
            </tr>
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word; border-top: 1px solid #e2e8f0;">Cargo</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; word-break: break-word; overflow-wrap: anywhere; border-top: 1px solid #e2e8f0;">{cargo_desc}</td>
            </tr>
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word; border-top: 1px solid #e2e8f0;">Carrying Vessel</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; word-break: break-word; overflow-wrap: anywhere; border-top: 1px solid #e2e8f0;">{vessel_name}</td>
            </tr>
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word; border-top: 1px solid #e2e8f0;">Customs Officer</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0284c7; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; word-break: break-word; overflow-wrap: anywhere; border-top: 1px solid #e2e8f0;">{officer}</td>
            </tr>
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word; border-top: 1px solid #e2e8f0;">Customs Status</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 800; color: #059669; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; border-top: 1px solid #e2e8f0;">CLEARED</td>
            </tr>
          </table>
        """

        html_body = _render_responsive_email_layout(
            subject=subject,
            header_kicker="PORTIDE Customs &amp; Border Clearance",
            header_title="CONTAINER CLEARED",
            header_subtitle="Cargo Verification Approved",
            header_gradient="linear-gradient(135deg, #064e3b 0%, #047857 100%)",
            header_kicker_color="#a7f3d0",
            header_subtitle_color="#d1fae5",
            body_content=body_html,
            footer_text="PORTIDE &bull; Maritime Port Operations Intelligence Platform"
        )

        _send_mail_async(
            subject=subject,
            message=plain_body,
            from_email=get_from_email(),
            recipient_list=[recipient_email],
            html_message=html_body,
        )
        logger.info(f"Queued async customs cleared notification email for container {container.container_number} to {recipient_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to queue customs cleared notification: {str(e)}", exc_info=True)
        return False


def send_customs_hold_notification(container, hold_reason: str = None, officer_name: str = None) -> bool:
    """
    Sends notification email when a container is placed on Customs Hold.
    Notifies the linked shipping company with selectable container number.
    """
    try:
        shipping_company = container.shipping_company
        recipient_email = shipping_company.shipping_company_email if shipping_company else None
        if not recipient_email:
            return False

        subject = f"PORTIDE Customs Alert: Container {container.container_number} Placed on Hold"
        container_type_display = container.get_container_type_display() if hasattr(container, 'get_container_type_display') else 'Standard Container'
        cargo_desc = container.cargo.cargo_description if getattr(container, 'cargo', None) else 'Containerized Cargo'
        vessel_name = container.vessel.vessel_name if getattr(container, 'vessel', None) else 'N/A'
        officer = officer_name or 'Customs Authority'
        reason = hold_reason or 'Documentation / Inspection Discrepancy'

        plain_body = f"""Dear {shipping_company.shipping_company_name},

Container {container.container_number} has been placed on Customs Hold.

Container Details:
- Container Number: {container.container_number}
- Container Type: {container_type_display}
- Gross Weight: {container.container_gross_weight} Tonnes
- Cargo Description: {cargo_desc}
- Vessel: {vessel_name}
- Hold Reason: {reason}
- Customs Officer: {officer}
- Status: Customs Hold

Please contact the Port Customs Authority or submit required documentation to resolve this hold.

Regards,
PORTIDE Customs & Border Clearance Division
Maritime Port Operations Intelligence Platform
"""

        copy_box = _render_copyable_code_box(container.container_number, "Container Number", "Select container number to copy")

        body_html = f"""
          <p style="margin: 0 0 16px 0; font-size: 15px;">Dear <strong>{shipping_company.shipping_company_name}</strong>,</p>
          <p style="margin: 0 0 16px 0; font-size: 14px; color: #64748b; line-height: 1.5;">
            Container <strong>#{container.container_number}</strong> has been placed on <strong>Customs Hold</strong> by Port Customs Control. Terminal release and gate movement are paused pending resolution.
          </p>

          {copy_box}

          <div class="alert-box" style="background: #fff1f2; border: 1.5px solid #fecdd3; border-radius: 12px; padding: 16px; margin: 18px 0; box-sizing: border-box;">
            <div style="font-size: 11px; font-weight: 800; color: #9f1239; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">
              Hold Reason / Discrepancy:
            </div>
            <div style="font-size: 13px; color: #881337; font-weight: 600; line-height: 1.5; word-break: break-word;">
              "{reason}"
            </div>
          </div>

          <table role="presentation" class="data-table-stacked" style="width: 100%; border-collapse: collapse; margin-bottom: 24px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; table-layout: auto;">
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word;">Cargo</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; word-break: break-word; overflow-wrap: anywhere;">{cargo_desc}</td>
            </tr>
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word; border-top: 1px solid #e2e8f0;">Vessel</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; word-break: break-word; overflow-wrap: anywhere; border-top: 1px solid #e2e8f0;">{vessel_name}</td>
            </tr>
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word; border-top: 1px solid #e2e8f0;">Customs Officer</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0284c7; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; word-break: break-word; overflow-wrap: anywhere; border-top: 1px solid #e2e8f0;">{officer}</td>
            </tr>
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word; border-top: 1px solid #e2e8f0;">Current Status</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 800; color: #dc2626; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; border-top: 1px solid #e2e8f0;">CUSTOMS HOLD</td>
            </tr>
          </table>

          <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 0;">
            Please log in to your PORTIDE Shipping Portal to inspect required documents or submit clarifications to Customs Control.
          </p>
        """

        html_body = _render_responsive_email_layout(
            subject=subject,
            header_kicker="PORTIDE Customs &amp; Border Clearance",
            header_title="CUSTOMS HOLD ALERT",
            header_subtitle="Inspection or Documentation Discrepancy",
            header_gradient="linear-gradient(135deg, #991b1b 0%, #7f1d1d 100%)",
            header_kicker_color="#fecaca",
            header_subtitle_color="#fee2e2",
            body_content=body_html,
            footer_text="PORTIDE &bull; Maritime Port Operations Intelligence Platform"
        )

        _send_mail_async(
            subject=subject,
            message=plain_body,
            from_email=get_from_email(),
            recipient_list=[recipient_email],
            html_message=html_body,
        )
        logger.info(f"Queued async customs hold notification email for container {container.container_number} to {recipient_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to queue customs hold notification: {str(e)}", exc_info=True)
        return False


def send_container_released_notification(container, truck_number: str = '', officer_name: str = None) -> bool:
    """
    Sends notification email when a container is released through the gate.
    Notifies the linked shipping company with selectable container number.
    """
    try:
        shipping_company = container.shipping_company
        recipient_email = shipping_company.shipping_company_email if shipping_company else None
        if not recipient_email:
            return False

        subject = f"PORTIDE Gate Release: Container {container.container_number} Released"
        container_type_display = container.get_container_type_display() if hasattr(container, 'get_container_type_display') else 'Standard Container'
        cargo_desc = container.cargo.cargo_description if getattr(container, 'cargo', None) else 'Containerized Cargo'
        vessel_name = container.vessel.vessel_name if getattr(container, 'vessel', None) else 'N/A'
        officer = officer_name or 'Gate & Truck Operations'
        assigned_truck = truck_number or 'Assigned Carrier Truck'

        plain_body = f"""Dear {shipping_company.shipping_company_name},

Container {container.container_number} has completed gate verification and has been officially released from the port terminal.

Container Details:
- Container Number: {container.container_number}
- Container Type: {container_type_display}
- Gross Weight: {container.container_gross_weight} Tonnes
- Cargo Description: {cargo_desc}
- Vessel: {vessel_name}
- Truck Number: {assigned_truck}
- Gate Officer: {officer}
- Status: Released

Regards,
PORTIDE Gate & Truck Operations
Maritime Port Operations Intelligence Platform
"""

        copy_box = _render_copyable_code_box(container.container_number, "Container Number", "Select container number to copy")

        body_html = f"""
          <p style="margin: 0 0 16px 0; font-size: 15px;">Dear <strong>{shipping_company.shipping_company_name}</strong>,</p>
          <p style="margin: 0 0 16px 0; font-size: 14px; color: #64748b; line-height: 1.5;">
            Container <strong>#{container.container_number}</strong> has successfully completed physical and digital gate verification and has exited the port terminal.
          </p>

          {copy_box}

          <table role="presentation" class="data-table-stacked" style="width: 100%; border-collapse: collapse; margin-bottom: 24px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; table-layout: auto;">
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word;">Transport Truck</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; font-family: monospace; word-break: break-all; overflow-wrap: anywhere;">{assigned_truck}</td>
            </tr>
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word; border-top: 1px solid #e2e8f0;">Container Type</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; word-break: break-word; overflow-wrap: anywhere; border-top: 1px solid #e2e8f0;">{container_type_display}</td>
            </tr>
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word; border-top: 1px solid #e2e8f0;">Gross Weight</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; word-break: break-word; overflow-wrap: anywhere; border-top: 1px solid #e2e8f0;">{container.container_gross_weight} T</td>
            </tr>
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word; border-top: 1px solid #e2e8f0;">Gate Officer</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0284c7; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; word-break: break-word; overflow-wrap: anywhere; border-top: 1px solid #e2e8f0;">{officer}</td>
            </tr>
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word; border-top: 1px solid #e2e8f0;">Gate Status</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 800; color: #0284c7; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; border-top: 1px solid #e2e8f0;">RELEASED &bull; OUTBOUND</td>
            </tr>
          </table>
        """

        html_body = _render_responsive_email_layout(
            subject=subject,
            header_kicker="PORTIDE Gate &amp; Terminal Operations",
            header_title="CONTAINER RELEASED",
            header_subtitle="Gate Outbound Verification Complete",
            header_gradient="linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)",
            header_kicker_color="#38bdf8",
            header_subtitle_color="#94a3b8",
            body_content=body_html,
            footer_text="PORTIDE &bull; Maritime Port Operations Intelligence Platform"
        )

        _send_mail_async(
            subject=subject,
            message=plain_body,
            from_email=get_from_email(),
            recipient_list=[recipient_email],
            html_message=html_body,
        )
        logger.info(f"Queued async container released notification email for container {container.container_number} to {recipient_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to queue container released notification: {str(e)}", exc_info=True)
        return False


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

        # Generate actual embedded QR code image bytes
        qr_payload = gate_pass.gate_pass_qr_code or f"PORTIDE-GP:{pass_number}:{gate_pass.gate_pass_verification_code}"
        qr_png_bytes = generate_qr_png_bytes(qr_payload, scale=8, border=4)

        # Build public high-res HTTPS QR image URL (loads reliably in Gmail, Outlook, Apple Mail)
        encoded_payload = urllib.parse.quote(qr_payload)
        qr_image_url = f"https://api.qrserver.com/v1/create-qr-code/?size=300x300&data={encoded_payload}"

        frontend_url = getattr(settings, 'FRONTEND_URL', None) or 'https://portide.vercel.app'
        pass_view_url = f"{frontend_url.rstrip('/')}/?view=gate-pass&pass={pass_number}"

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

Verification Reference:
{gate_pass.gate_pass_verification_code}

QR Code Link (High Resolution):
{qr_image_url}

Present this QR code or verification reference at the designated port gate.
The Gate & Truck Operations Officer will scan the QR code and verify the gate pass before authorizing vehicle exit.
This pass is valid only for the assigned driver, truck, authorized container(s), designated gate and validity period. Do not share or reuse this pass.

Regards,
PORTIDE Gate & Truck Operations
Maritime Port Operations Intelligence Platform
"""

        # Build responsive container cards for authorized containers
        html_container_rows = "".join([
            f"""<div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; margin-bottom: 10px; box-sizing: border-box;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: auto;">
                  <tr>
                    <td style="font-family: monospace; font-size: 14px; font-weight: 800; color: #0f172a; word-break: break-all; vertical-align: top;">
                      {c.container_number}
                    </td>
                    <td style="text-align: right; vertical-align: top; padding-left: 8px;">
                      <span style="display: inline-block; background-color: #ecfdf5; color: #059669; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px; border: 1px solid #a7f3d0; text-transform: uppercase;">CLEARED &bull; AUTHORIZED</span>
                    </td>
                  </tr>
                  <tr>
                    <td colspan="2" style="padding-top: 6px; font-size: 12px; color: #475569; word-break: break-word;">
                      <span style="font-weight: 600; color: #64748b;">Type:</span> {c.get_container_type_display()} &bull; <span style="font-weight: 600; color: #64748b;">Weight:</span> {c.container_gross_weight} T
                    </td>
                  </tr>
                </table>
            </div>"""
            for c in containers
        ])
        if not html_container_rows:
            html_container_rows = """<div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; font-size: 13px; color: #64748b; text-align: center;">No containers associated.</div>"""

        copy_box = _render_copyable_code_box(
            gate_pass.gate_pass_verification_code,
            "Verification Reference Code",
            "Select verification code to copy"
        )

        body_html = f"""
          <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155;">Dear <strong>{driver.driver_name}</strong>,</p>
          <p style="margin: 0 0 20px 0; font-size: 14px; color: #64748b; line-height: 1.5;">
            Your Digital Gate Pass has been authorized and generated for the port outbound gate movement.
          </p>

          <table role="presentation" class="data-table-stacked" style="width: 100%; border-collapse: collapse; margin-bottom: 24px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; table-layout: auto;">
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word;">Truck Number</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; font-family: monospace; word-break: break-all; overflow-wrap: anywhere;">{truck_number}</td>
            </tr>
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word; border-top: 1px solid #e2e8f0;">Driver</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; word-break: break-word; overflow-wrap: anywhere; border-top: 1px solid #e2e8f0;">{driver.driver_name}</td>
            </tr>
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word; border-top: 1px solid #e2e8f0;">Driver License / ID</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; font-family: monospace; word-break: break-all; overflow-wrap: anywhere; border-top: 1px solid #e2e8f0;">{driver_license}</td>
            </tr>
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word; border-top: 1px solid #e2e8f0;">Assigned Gate</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; word-break: break-word; overflow-wrap: anywhere; border-top: 1px solid #e2e8f0;">{gate_name}</td>
            </tr>
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word; border-top: 1px solid #e2e8f0;">Valid Until</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #b45309; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; font-family: monospace; border-top: 1px solid #e2e8f0;">{valid_until_str}</td>
            </tr>
          </table>

          <div style="font-size: 12px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">Authorized Containers</div>
          {html_container_rows}

          <!-- High-Visibility Scannable QR Code Section -->
          <div class="alert-box" style="text-align: center; padding: 22px 16px; background-color: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 14px; margin-top: 20px; margin-bottom: 20px; box-sizing: border-box; max-width: 100%;">
            <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em;">
              📱 Scan at Port Gate Terminal
            </div>
            <div style="font-size: 13px; color: #475569; margin-bottom: 16px; line-height: 1.5; max-width: 460px; margin-left: auto; margin-right: auto; word-break: break-word;">
              Present this QR Code at the designated port gate. The Gate &amp; Truck Operations Officer will scan the QR code to verify vehicle and cargo release.
            </div>

            <!-- Prominent High-Contrast Scannable QR Image -->
            <div class="qr-wrapper" style="display: inline-block; padding: 12px; background-color: #ffffff; border: 2px solid #0284c7; border-radius: 16px; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.12); margin-bottom: 10px; max-width: 100%; box-sizing: border-box;">
              <a href="{qr_image_url}" target="_blank" style="display: block; text-decoration: none;">
                <img src="cid:gate_pass_qr_code" class="qr-img" alt="PORTIDE Digital Gate Pass QR Code - {pass_number}" width="200" height="200" style="display: block; width: 200px; height: 200px; max-width: 100%; height: auto; margin: 0 auto; border: 0; background-color: #ffffff;" />
              </a>
            </div>
            <div style="font-size: 11px; color: #64748b; margin-bottom: 16px;">
              <a href="{qr_image_url}" target="_blank" style="color: #0284c7; text-decoration: underline; font-weight: 600;">(View high-resolution QR code)</a>
            </div>

            {copy_box}

            <div style="font-size: 11px; color: #64748b; line-height: 1.4; border-top: 1px dashed #cbd5e1; padding-top: 12px; margin-top: 14px; max-width: 480px; margin-left: auto; margin-right: auto; word-break: break-word;">
              This pass is valid only for the assigned driver, truck, authorized container(s), designated gate and validity period. Do not share or reuse this pass.
            </div>
          </div>
        """

        html_body = _render_responsive_email_layout(
            subject=subject,
            header_kicker="PORTIDE Intelligence Platform",
            header_title="DIGITAL GATE PASS",
            header_subtitle=f"Pass #{pass_number}",
            header_gradient="linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
            header_kicker_color="#f59e0b",
            header_subtitle_color="#38bdf8",
            body_content=body_html,
        )

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
            body_html = f"""
              <p style="font-size: 14px; margin-top: 0;">Dear <strong>{company_name}</strong>,</p>
              
              <p style="font-size: 13px; color: #475569; line-height: 1.6;">
                A customs supporting document submitted for container <strong>#{container.container_number}</strong> has been 
                <span style="color: #be123c; font-weight: bold; background: #ffe4e6; padding: 2px 8px; border-radius: 4px;">REJECTED</span> 
                by Port Customs Control. Corrective action is required before cargo inspection can proceed.
              </p>

              <table role="presentation" class="data-table-stacked" style="width: 100%; border-collapse: collapse; margin-bottom: 20px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; table-layout: auto;">
                <tr>
                  <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word;">Container</td>
                  <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; font-family: monospace; word-break: break-all; overflow-wrap: anywhere;">{container.container_number}</td>
                </tr>
                <tr>
                  <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word; border-top: 1px solid #e2e8f0;">Document</td>
                  <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; word-break: break-word; overflow-wrap: anywhere; border-top: 1px solid #e2e8f0;">{doc_name} <span style="font-size: 11px; background: #e2e8f0; padding: 1px 6px; border-radius: 4px; font-weight: 600;">v{document.document_version}</span></td>
                </tr>
                <tr>
                  <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word; border-top: 1px solid #e2e8f0;">Document Type</td>
                  <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; word-break: break-word; overflow-wrap: anywhere; border-top: 1px solid #e2e8f0;">{doc_type_display}</td>
                </tr>
                <tr>
                  <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word; border-top: 1px solid #e2e8f0;">Customs Officer</td>
                  <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0284c7; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; word-break: break-word; overflow-wrap: anywhere; border-top: 1px solid #e2e8f0;">{officer}</td>
                </tr>
              </table>

              <div class="alert-box" style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 12px; padding: 16px; margin: 16px 0; box-sizing: border-box;">
                <div style="font-size: 11px; font-weight: 800; color: #9f1239; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">
                  Rejection Remarks &amp; Reason:
                </div>
                <div style="font-size: 13px; color: #881337; font-weight: 600; line-height: 1.5; word-break: break-word;">
                  "{remarks or 'Document does not satisfy customs regulatory criteria or exhibits discrepancy.'}"
                </div>
              </div>

              <div class="alert-box" style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin: 16px 0; box-sizing: border-box;">
                <div style="font-size: 11px; font-weight: 800; color: #166534; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">
                  Required Carrier Action:
                </div>
                <p style="font-size: 12px; color: #14532d; margin: 0; line-height: 1.5; word-break: break-word;">
                  Log in to your PORTIDE portal, review the officer's remarks above, and click <strong>"Resubmit Correction"</strong> to upload the corrected replacement document.
                </p>
              </div>

              <div style="text-align: center; margin: 24px 0 12px 0;">
                <a href="https://portide.vercel.app" class="btn-action" style="display: inline-block; background: #064e43; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; padding: 12px 28px; border-radius: 10px; max-width: 100%; box-sizing: border-box;">
                  Open Portal &amp; Resubmit Document &rarr;
                </a>
              </div>
            """
            html_message = _render_responsive_email_layout(
                subject=subject,
                header_kicker="PORTIDE Customs Alert",
                header_title="DOCUMENT REJECTED",
                header_subtitle="Action Required: Supporting Document Discrepancy",
                header_gradient="linear-gradient(135deg, #881337 0%, #9f1239 100%)",
                header_kicker_color="#fecdd3",
                header_subtitle_color="#ffe4e6",
                body_content=body_html,
                footer_text="PORTIDE Customs & Border Clearance Division &bull; Maritime Port Operations Intelligence Platform"
            )
        else:  # VERIFIED
            subject = f"PORTIDE Notice: Customs Document Verified - Container {container.container_number}"
            plain_message = f"""Dear {company_name},

The customs supporting document "{doc_name}" ({doc_type_display}) for Container {container.container_number} has been VERIFIED and approved by Customs Officer {officer}.

Review Remarks: {remarks or 'Verified and compliant with customs regulations.'}

Regards,
PORTIDE Customs & Border Clearance Division
"""
            body_html = f"""
              <p style="margin: 0 0 16px 0; font-size: 15px;">Dear <strong>{company_name}</strong>,</p>
              <p style="margin: 0 0 20px 0; font-size: 14px; color: #64748b; line-height: 1.5;">
                The following supporting document for container <strong>#{container.container_number}</strong> has been <strong style="color: #059669;">VERIFIED</strong> and approved by Customs Officer <strong>{officer}</strong>:
              </p>

              <table role="presentation" class="data-table-stacked" style="width: 100%; border-collapse: collapse; margin-bottom: 20px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; table-layout: auto;">
                <tr>
                  <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word;">Container</td>
                  <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; font-family: monospace; word-break: break-all; overflow-wrap: anywhere;">{container.container_number}</td>
                </tr>
                <tr>
                  <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word; border-top: 1px solid #e2e8f0;">Document</td>
                  <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; word-break: break-word; overflow-wrap: anywhere; border-top: 1px solid #e2e8f0;">{doc_name} <span style="font-size: 11px; background: #e2e8f0; padding: 1px 6px; border-radius: 4px; font-weight: 600;">v{document.document_version}</span></td>
                </tr>
                <tr>
                  <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word; border-top: 1px solid #e2e8f0;">Category</td>
                  <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; word-break: break-word; overflow-wrap: anywhere; border-top: 1px solid #e2e8f0;">{doc_type_display}</td>
                </tr>
                <tr>
                  <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word; border-top: 1px solid #e2e8f0;">Customs Remarks</td>
                  <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #059669; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; word-break: break-word; overflow-wrap: anywhere; border-top: 1px solid #e2e8f0;">{remarks or 'Verified and compliant.'}</td>
                </tr>
              </table>

              <div class="alert-box" style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 14px 16px; margin: 18px 0; font-size: 13px; color: #166534; line-height: 1.5; box-sizing: border-box;">
                ✅ Thank you for your cooperation in maintaining swift port customs compliance.
              </div>

              <div style="text-align: center; margin: 24px 0 10px 0;">
                <a href="https://portide.vercel.app" class="btn-action" style="display: inline-block; background: #059669; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; padding: 12px 28px; border-radius: 10px; max-width: 100%; box-sizing: border-box;">
                  Open Portal &amp; Track Status &rarr;
                </a>
              </div>
            """
            html_message = _render_responsive_email_layout(
                subject=subject,
                header_kicker="PORTIDE Customs Notification",
                header_title="DOCUMENT VERIFIED",
                header_subtitle="Document Verification Approved",
                header_gradient="linear-gradient(135deg, #059669 0%, #047857 100%)",
                header_kicker_color="#a7f3d0",
                header_subtitle_color="#d1fae5",
                body_content=body_html,
                footer_text="PORTIDE Customs & Border Clearance Division &bull; Maritime Port Operations Intelligence Platform"
            )

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

        body_html = f"""
          <p style="margin: 0 0 16px 0; font-size: 15px;">Dear <strong>{company_name}</strong>,</p>
          <p style="margin: 0 0 20px 0; font-size: 14px; color: #64748b; line-height: 1.5;">
            Your corrected customs supporting document has been successfully received and submitted for Customs Officer review.
          </p>

          <table role="presentation" class="data-table-stacked" style="width: 100%; border-collapse: collapse; margin-bottom: 20px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; table-layout: auto;">
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word;">Container</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; font-family: monospace; word-break: break-all; overflow-wrap: anywhere;">{container.container_number}</td>
            </tr>
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word; border-top: 1px solid #e2e8f0;">Replacement File</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; word-break: break-word; overflow-wrap: anywhere; border-top: 1px solid #e2e8f0;">{doc_name} <span style="font-size: 11px; background: #e2e8f0; padding: 1px 6px; border-radius: 4px; font-weight: 600;">v{new_document.document_version}</span></td>
            </tr>
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word; border-top: 1px solid #e2e8f0;">Superseded File</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 600; color: #64748b; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; word-break: break-word; overflow-wrap: anywhere; border-top: 1px solid #e2e8f0;">{old_document.document_name} <span style="font-size: 11px; background: #e2e8f0; padding: 1px 6px; border-radius: 4px; font-weight: 600;">v{old_document.document_version}</span></td>
            </tr>
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word; border-top: 1px solid #e2e8f0;">Document Type</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; word-break: break-word; overflow-wrap: anywhere; border-top: 1px solid #e2e8f0;">{doc_type_display}</td>
            </tr>
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word; border-top: 1px solid #e2e8f0;">Amendment Reason</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 600; color: #0f172a; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; word-break: break-word; overflow-wrap: anywhere; border-top: 1px solid #e2e8f0;">{reason or 'Resubmission per customs request'}</td>
            </tr>
            <tr>
              <td class="data-label" style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; vertical-align: top; width: 38%; box-sizing: border-box; word-break: break-word; border-top: 1px solid #e2e8f0;">Review Status</td>
              <td class="data-value" style="padding: 10px 14px; font-size: 13px; font-weight: 800; color: #d97706; text-align: right; vertical-align: top; width: 62%; box-sizing: border-box; border-top: 1px solid #e2e8f0;">PENDING REVIEW</td>
            </tr>
          </table>

          <div class="alert-box" style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 14px 16px; margin: 18px 0; font-size: 13px; color: #1e40af; line-height: 1.5; box-sizing: border-box;">
            🔍 <strong>Status Notice:</strong> Port Customs Control has been alerted to review the new file. You will receive an automated notification once reviewed.
          </div>

          <div style="text-align: center; margin: 24px 0 10px 0;">
            <a href="https://portide.vercel.app" class="btn-action" style="display: inline-block; background: #0284c7; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; padding: 12px 28px; border-radius: 10px; max-width: 100%; box-sizing: border-box;">
              Open Portal &amp; Track Status &rarr;
            </a>
          </div>
        """

        html_message = _render_responsive_email_layout(
            subject=subject,
            header_kicker="PORTIDE Customs Division",
            header_title="DOCUMENT RESUBMITTED",
            header_subtitle=f"Corrected Document Received for Container {container.container_number}",
            header_gradient="linear-gradient(135deg, #0f172a 0%, #0369a1 100%)",
            header_kicker_color="#38bdf8",
            header_subtitle_color="#bae6fd",
            body_content=body_html,
            footer_text="PORTIDE Customs & Border Clearance Division &bull; Maritime Port Operations Intelligence Platform"
        )

        _send_mail_async(
            subject=subject,
            message=plain_message,
            from_email=get_from_email(),
            recipient_list=recipient_list,
            html_message=html_message
        )
        logger.info(f"Queued customs document resubmitted confirmation for doc #{new_document.document_id} to {recipient_list}")
        return True
    except Exception as e:
        logger.error(f"Failed to queue customs document resubmission email: {str(e)}", exc_info=True)
        return False
