from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from fastapi.responses import FileResponse
from bson import ObjectId
from typing import List, Optional
from datetime import datetime
import os
from backend.config import settings
from backend.database.connection import get_documents_collection, get_audit_logs_collection
from backend.auth.dependencies import get_approved_user, get_current_admin
from backend.schemas.document import DocumentResponse, DocumentType
from backend.utils.helpers import save_uploaded_file
from backend.services.pdf_service import parse_pdf_to_chunks
from backend.services.ai_service import index_document_chunks

router = APIRouter(prefix="/api/documents", tags=["Document Repository"])

@router.post("", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    type: DocumentType = Form(...),
    description: Optional[str] = Form(None),
    admin: dict = Depends(get_current_admin)
):
    # Validate file type
    if not file.filename.endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF documents are allowed."
        )
        
    documents_col = get_documents_collection()
    
    # Save file locally
    rel_path = save_uploaded_file(file, os.path.join(settings.UPLOAD_DIR, "documents"), filename_prefix="doc_")
    full_path = os.path.join(os.getcwd(), rel_path)
    
    new_doc = {
        "filename": file.filename,
        "filepath": rel_path,
        "type": type,
        "description": description,
        "uploaded_by": admin["id"],
        "uploaded_by_name": admin["name"],
        "uploaded_at": datetime.utcnow(),
        "is_active": True if type == DocumentType.BYLAWS else False
    }
    
    # For bylaws, mark all other previous bylaws as inactive
    if type == DocumentType.BYLAWS:
        await documents_col.update_many(
            {"type": DocumentType.BYLAWS},
            {"$set": {"is_active": False}}
        )
        
    result = await documents_col.insert_one(new_doc)
    new_doc["id"] = str(result.inserted_id)
    
    # RAG Indexing: Rebuild bylaws index to use only the newly uploaded active bylaws
    if type == DocumentType.BYLAWS:
        try:
            from backend.services.ai_service import rebuild_bylaws_index
            await rebuild_bylaws_index()
        except Exception as e:
            print(f"Error rebuilding bylaws index on upload: {e}")
            
    # Audit log
    audit_col = get_audit_logs_collection()
    await audit_col.insert_one({
        "action": "Document Uploaded",
        "performed_by": admin["id"],
        "target_id": new_doc["id"],
        "timestamp": datetime.utcnow(),
        "details": f"Uploaded {type} file '{file.filename}'."
    })
    
    return new_doc

@router.get("", response_model=List[DocumentResponse])
async def list_documents(
    type_filter: Optional[DocumentType] = Query(None, alias="type"),
    search: Optional[str] = Query(None),
    current_user: dict = Depends(get_approved_user)
):
    documents_col = get_documents_collection()
    query = {}
    
    if type_filter:
        query["type"] = type_filter
    if search:
        query["$or"] = [
            {"filename": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
        
    cursor = documents_col.find(query).sort("uploaded_at", -1)
    
    docs = []
    async for doc in cursor:
        doc["id"] = str(doc["_id"])
        docs.append(doc)
        
    return docs

@router.get("/{document_id}/download")
async def download_document(document_id: str, current_user: dict = Depends(get_approved_user)):
    documents_col = get_documents_collection()
    
    if not ObjectId.is_valid(document_id):
        raise HTTPException(status_code=400, detail="Invalid document ID.")
        
    doc = await documents_col.find_one({"_id": ObjectId(document_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
        
    file_path = os.path.join(os.getcwd(), doc["filepath"])
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Physical file not found on server.")
        
    return FileResponse(
        path=file_path,
        filename=doc["filename"],
        media_type="application/pdf"
    )

@router.delete("/{document_id}")
async def delete_document(document_id: str, admin: dict = Depends(get_current_admin)):
    documents_col = get_documents_collection()
    
    if not ObjectId.is_valid(document_id):
        raise HTTPException(status_code=400, detail="Invalid document ID.")
        
    doc = await documents_col.find_one({"_id": ObjectId(document_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
        
    # Delete physical file
    file_path = os.path.join(os.getcwd(), doc["filepath"])
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            print(f"Error removing file: {e}")
            
    # Delete database record
    await documents_col.delete_one({"_id": ObjectId(document_id)})
    
    # RAG Indexing: Rebuild bylaws index if a Bylaws document was deleted
    if doc.get("type") == DocumentType.BYLAWS:
        try:
            from backend.services.ai_service import rebuild_bylaws_index
            await rebuild_bylaws_index()
        except Exception as e:
            print(f"Error rebuilding bylaws index on delete: {e}")
            
    # Audit log
    audit_col = get_audit_logs_collection()
    await audit_col.insert_one({
        "action": "Document Deleted",
        "performed_by": admin["id"],
        "target_id": document_id,
        "timestamp": datetime.utcnow(),
        "details": f"Deleted document '{doc['filename']}'."
    })
    
    return {"message": "Document deleted successfully."}
