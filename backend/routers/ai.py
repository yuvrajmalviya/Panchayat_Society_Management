from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from datetime import datetime
import os
from backend.config import settings
from backend.database.connection import get_complaints_collection, get_notifications_collection, get_users_collection, get_audit_logs_collection
from backend.auth.dependencies import get_approved_user
from backend.schemas.ai import BylawQueryRequest, BylawQueryResponse, ChatDigestRequest, ChatDigestResponse
from backend.schemas.complaint import ComplaintResponse, ComplaintStatus, ComplaintPriority, ComplaintCategory
from backend.utils.helpers import save_uploaded_file, generate_complaint_number
from backend.services.ai_service import transcribe_audio, parse_voice_to_ticket, query_bylaws, generate_chat_digest

router = APIRouter(prefix="/api/ai", tags=["AI Integration Services"])

@router.post("/voice-to-ticket", response_model=ComplaintResponse)
async def voice_to_ticket(
    voice: UploadFile = File(...),
    current_user: dict = Depends(get_approved_user)
):
    """
    Accepts an audio recording, transcribes it via Whisper,
    structures details via LLM (Title, Description, Category, Priority),
    and automatically logs the complaint.
    """
    # 1. Save temporary audio file
    temp_dir = os.path.join(settings.UPLOAD_DIR, "voice")
    rel_path = save_uploaded_file(voice, temp_dir, filename_prefix="voice_")
    full_path = os.path.join(os.getcwd(), rel_path)
    
    try:
        # 2. Transcribe voice audio
        transcript = await transcribe_audio(full_path)
        if not transcript or len(transcript.strip()) < 5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not detect or transcribe any speech in the audio recording."
            )
            
        # 3. Structure complaint fields
        ticket_data = await parse_voice_to_ticket(transcript)
        
        # Validate structured outputs
        category = ticket_data.get("category", "Other")
        if category not in [c.value for c in ComplaintCategory]:
            category = "Other"
            
        priority = ticket_data.get("priority", "Medium")
        if priority not in [p.value for p in ComplaintPriority]:
            priority = "Medium"
            
        title = ticket_data.get("title", "Voice Complaint")
        description = ticket_data.get("description", transcript)
        
        # 4. Generate complaint number and write to DB
        comp_number = await generate_complaint_number()
        complaints_col = get_complaints_collection()
        
        timeline_event = {
            "status": ComplaintStatus.PENDING,
            "updated_by": current_user["id"],
            "updated_by_name": current_user["name"],
            "updated_at": datetime.utcnow(),
            "comment": "Complaint automatically generated from voice recording."
        }
        
        new_complaint = {
            "complaint_number": comp_number,
            "title": title,
            "description": description,
            "category": category,
            "priority": priority,
            "status": ComplaintStatus.PENDING,
            "location": "Logged via Voice",
            "image_urls": [],
            "voice_url": rel_path, # Link the recorded audio file!
            "created_by": current_user["id"],
            "created_by_name": current_user["name"],
            "assigned_to": None,
            "assigned_to_name": None,
            "timeline": [timeline_event],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = await complaints_col.insert_one(new_complaint)
        new_complaint["id"] = str(result.inserted_id)
        
        # 5. Notify Administrators
        users_col = get_users_collection()
        admins = await users_col.find({"role": "admin"}).to_list(length=100)
        notifications_col = get_notifications_collection()
        
        admin_notifications = []
        for admin_user in admins:
            admin_notifications.append({
                "user_id": str(admin_user["_id"]),
                "title": f"New Voice Complaint {comp_number}",
                "message": f"Resident {current_user['name']} has logged a voice ticket: '{title}' ({category}).",
                "read": False,
                "type": "complaint",
                "created_at": datetime.utcnow()
            })
        if admin_notifications:
            await notifications_col.insert_many(admin_notifications)
            
        # Audit log
        audit_col = get_audit_logs_collection()
        await audit_col.insert_one({
            "action": "Voice Complaint Created",
            "performed_by": current_user["id"],
            "target_id": new_complaint["id"],
            "timestamp": datetime.utcnow(),
            "details": f"Automatically parsed and created voice complaint {comp_number}."
        })
        
        return new_complaint
        
    except Exception as e:
        # Clean up temp file if something failed
        if os.path.exists(full_path):
            try:
                os.remove(full_path)
            except Exception:
                pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing voice-to-ticket: {str(e)}"
        )

@router.post("/ask-bylaw", response_model=BylawQueryResponse)
async def ask_bylaw(request: BylawQueryRequest, current_user: dict = Depends(get_approved_user)):
    """
    RAG Query: Answers questions regarding society rules using the uploaded bylaws PDF chunks and FAISS.
    """
    try:
        answer, citations = query_bylaws(request.question, language=request.language)
        return {
            "answer": answer,
            "citations": citations
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error querying bylaws database: {str(e)}"
        )

@router.post("/chat-summary", response_model=ChatDigestResponse)
async def chat_summary(request: ChatDigestRequest, current_user: dict = Depends(get_approved_user)):
    """
    Summarizes conversational logs (WhatsApp/Telegram groups) and extracts decisions, tasks, announcements, and deadlines.
    """
    try:
        digest = await generate_chat_digest(request.chat_text)
        return digest
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error parsing chat digest: {str(e)}"
        )
