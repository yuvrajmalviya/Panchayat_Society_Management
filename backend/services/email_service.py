import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import make_msgid, formatdate
from backend.config import settings

logger = logging.getLogger("panchayat_ai.email")

def send_email_notification(to_email: str, subject: str, body_text: str, body_html: str = None) -> bool:
    """
    Sends an email notification using SMTP settings from config.
    Logs the email to console/logs if SMTP username is not configured.
    """
    logger.info(f"Preparing to send notification to: {to_email} | Subject: {subject}")
    
    # Check if SMTP details are configured
    if not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD:
        logger.info("[SMTP SIMULATOR] Email sent successfully (Logged to console since SMTP_USERNAME is empty):")
        logger.info(f"--- EMAIL START ---")
        logger.info(f"To: {to_email}")
        logger.info(f"From: {settings.SMTP_FROM}")
        logger.info(f"Subject: {subject}")
        logger.info(f"Body:\n{body_text}")
        logger.info(f"--- EMAIL END ---")
        return True
        
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_FROM
        msg["To"] = to_email
        msg["Date"] = formatdate(localtime=True)
        msg["Message-ID"] = make_msgid()
        
        msg.attach(MIMEText(body_text, "plain"))
        if body_html:
            msg.attach(MIMEText(body_html, "html"))
            
        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
        server.starttls()
        server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_FROM, to_email, msg.as_string())
        server.quit()
        
        logger.info(f"Email successfully delivered to {to_email} via {settings.SMTP_HOST}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email via SMTP: {e}")
        return False
