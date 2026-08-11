import os
import httpx
import logging

from backend.config import settings

logger = logging.getLogger("panchayat_ai.sms")

def send_sms_notification(to_phone: str, body_text: str):
    account_sid = settings.TWILIO_ACCOUNT_SID
    auth_token = settings.TWILIO_AUTH_TOKEN
    from_phone = settings.TWILIO_PHONE_NUMBER
    
    if not account_sid or not auth_token or not from_phone:
        logger.warning("[SMS SIMULATOR] Twilio credentials not configured in .env. SMS NOT sent via Twilio.")
        return False
        
    url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
    data = {
        "To": to_phone,
        "From": from_phone,
        "Body": body_text
    }
    
    try:
        # Twilio utilizes HTTP Basic Authentication
        with httpx.Client() as client:
            response = client.post(
                url,
                data=data,
                auth=(account_sid, auth_token)
            )
            if response.status_code == 201:
                logger.info(f"[SMS] SMS successfully sent to {to_phone} via Twilio.")
                return True
            else:
                logger.error(f"[SMS] Twilio failed to send SMS to {to_phone}. Code: {response.status_code}, Res: {response.text}")
                return False
    except Exception as e:
        logger.error(f"[SMS] Error occurred while sending SMS: {str(e)}")
        return False
