from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from datetime import datetime, timedelta
from typing import Dict, Any
import os
from backend.database.connection import get_users_collection, get_complaints_collection, get_documents_collection
from backend.auth.dependencies import get_current_admin
from backend.services.report_service import generate_analytics_pdf
from backend.config import settings

router = APIRouter(prefix="/api/analytics", tags=["Dashboard Analytics"])

@router.get("/dashboard-stats")
async def get_dashboard_stats(admin: dict = Depends(get_current_admin)):
    users_col = get_users_collection()
    complaints_col = get_complaints_collection()
    documents_col = get_documents_collection()
    
    # 1. User counts
    total_residents = await users_col.count_documents({"role": "resident"})
    approved_residents = await users_col.count_documents({"role": "resident", "status": "approved"})
    pending_residents = await users_col.count_documents({"role": "resident", "status": "pending"})
    suspended_residents = await users_col.count_documents({"role": "resident", "status": "suspended"})
    
    # 2. Complaint counts
    total_complaints = await complaints_col.count_documents({})
    pending_complaints = await complaints_col.count_documents({"status": "Pending"})
    inprogress_complaints = await complaints_col.count_documents({"status": "In Progress"})
    assigned_complaints = await complaints_col.count_documents({"status": "Assigned"})
    resolved_complaints = await complaints_col.count_documents({"status": "Resolved"})
    closed_complaints = await complaints_col.count_documents({"status": "Closed"})
    
    active_complaints = pending_complaints + inprogress_complaints + assigned_complaints
    solved_complaints = resolved_complaints + closed_complaints
    
    # 3. Documents
    total_documents = await documents_col.count_documents({})
    bylaws_documents = await documents_col.count_documents({"type": "Bylaws"})
    
    # 4. Resolution Rate
    res_rate = (solved_complaints / total_complaints * 100) if total_complaints > 0 else 0.0
    
    # 5. Complaints by Category
    category_counts = {}
    categories = ["Water", "Electricity", "Security", "Road", "Garbage", "Sanitation", "Garden", "Street Light", "Other"]
    for cat in categories:
        count = await complaints_col.count_documents({"category": cat})
        category_counts[cat] = count
        
    # 6. Monthly Complaint Trends (Past 6 Months)
    # We do a simple loop and fetch count per month
    monthly_trends = []
    now = datetime.utcnow()
    for i in range(5, -1, -1):
        # Calculate month date ranges
        first_of_month = (now - timedelta(days=30*i)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        # Next month first day
        if first_of_month.month == 12:
            next_month = first_of_month.replace(year=first_of_month.year+1, month=1, day=1)
        else:
            next_month = first_of_month.replace(month=first_of_month.month+1, day=1)
            
        count = await complaints_col.count_documents({
            "created_at": {"$gte": first_of_month, "$lt": next_month}
        })
        monthly_trends.append({
            "month": first_of_month.strftime("%b %Y"),
            "count": count
        })
        
    # 7. Monthly Registrations Trends (Past 6 Months)
    monthly_registrations = []
    for i in range(5, -1, -1):
        first_of_month = (now - timedelta(days=30*i)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if first_of_month.month == 12:
            next_month = first_of_month.replace(year=first_of_month.year+1, month=1, day=1)
        else:
            next_month = first_of_month.replace(month=first_of_month.month+1, day=1)
            
        count = await users_col.count_documents({
            "role": "resident",
            "created_at": {"$gte": first_of_month, "$lt": next_month}
        })
        monthly_registrations.append({
            "month": first_of_month.strftime("%b %Y"),
            "count": count
        })
        
    # 8. Average Resolution Time (in hours)
    # Find all resolved complaints and check first timeline resolution event
    resolved_cursor = complaints_col.find({"status": {"$in": ["Resolved", "Closed"]}})
    total_hours = 0.0
    count_resolved = 0
    async for comp in resolved_cursor:
        created = comp.get("created_at")
        resolved_time = None
        for event in comp.get("timeline", []):
            if event.get("status") in ["Resolved", "Closed"]:
                resolved_time = event.get("updated_at")
                break
        if created and resolved_time:
            # Type handling (BSON datetimes are read as native datetimes)
            diff = resolved_time - created
            total_hours += diff.total_seconds() / 3600.0
            count_resolved += 1
            
    avg_resolution_hours = (total_hours / count_resolved) if count_resolved > 0 else 0.0
    
    return {
        "residents": {
            "total": total_residents,
            "approved": approved_residents,
            "pending": pending_residents,
            "suspended": suspended_residents
        },
        "complaints": {
            "total": total_complaints,
            "pending": pending_complaints,
            "in_progress": inprogress_complaints,
            "assigned": assigned_complaints,
            "resolved": resolved_complaints,
            "closed": closed_complaints,
            "active": active_complaints,
            "solved": solved_complaints,
            "resolution_rate": res_rate,
            "avg_resolution_hours": avg_resolution_hours
        },
        "documents": {
            "total": total_documents,
            "bylaws": bylaws_documents
        },
        "category_counts": category_counts,
        "monthly_trends": monthly_trends,
        "monthly_registrations": monthly_registrations
    }

@router.get("/download-report")
async def download_report(admin: dict = Depends(get_current_admin)):
    stats = await get_dashboard_stats(admin)
    
    # Get top 20 recent complaints
    complaints_col = get_complaints_collection()
    cursor = complaints_col.find({}).sort("created_at", -1).limit(20)
    recent_complaints = []
    async for doc in cursor:
        recent_complaints.append(doc)
        
    report_filename = f"panchayat_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    report_path = os.path.join(settings.UPLOAD_DIR, report_filename)
    
    # Call service
    generate_analytics_pdf(
        file_path=report_path,
        stats={
            "total_residents": stats["residents"]["total"],
            "active_complaints": stats["complaints"]["active"],
            "resolved_complaints": stats["complaints"]["solved"],
            "resolution_rate": stats["complaints"]["resolution_rate"]
        },
        category_counts=stats["category_counts"],
        recent_complaints=recent_complaints
    )
    
    if not os.path.exists(report_path):
        raise HTTPException(status_code=500, detail="Failed to generate PDF report file.")
        
    return FileResponse(
        path=report_path,
        filename=f"Panchayat_Society_Report_{datetime.now().strftime('%d_%b_%Y')}.pdf",
        media_type="application/pdf"
    )
