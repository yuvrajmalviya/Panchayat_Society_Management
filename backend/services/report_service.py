import os
from datetime import datetime
from typing import List, Dict
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

def generate_analytics_pdf(
    file_path: str,
    stats: Dict[str, int],
    category_counts: Dict[str, int],
    recent_complaints: List[Dict]
) -> str:
    """
    Generates a beautifully structured PDF analytics report using ReportLab
    and writes it to the specified file_path.
    """
    doc = SimpleDocTemplate(
        file_path,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )
    
    styles = getSampleStyleSheet()
    
    # Custom Styles
    title_style = ParagraphStyle(
        name="TitleStyle",
        parent=styles["Heading1"],
        fontSize=24,
        textColor=colors.HexColor("#1565C0"), # Primary color
        spaceAfter=15,
        alignment=1 # Centered
    )
    
    section_style = ParagraphStyle(
        name="SectionStyle",
        parent=styles["Heading2"],
        fontSize=14,
        textColor=colors.HexColor("#43A047"), # Secondary color
        spaceBefore=12,
        spaceAfter=6
    )
    
    body_style = ParagraphStyle(
        name="BodyStyle",
        parent=styles["Normal"],
        fontSize=10,
        spaceAfter=4
    )
    
    meta_style = ParagraphStyle(
        name="MetaStyle",
        parent=styles["Italic"],
        fontSize=9,
        textColor=colors.HexColor("#757575"),
        spaceAfter=20,
        alignment=1
    )
    
    story = []
    
    # Header
    story.append(Paragraph("Panchayat AI - Society Management Report", title_style))
    story.append(Paragraph(f"Generated on {datetime.now().strftime('%Y-%b-%d %H:%M:%S')} | Admin Executive Portal", meta_style))
    story.append(Spacer(1, 10))
    
    # 1. Summary Statistics Cards
    story.append(Paragraph("Executive Summary Stats", section_style))
    
    stats_data = [
        ["Total Residents", "Active Complaints", "Resolved Complaints", "Resolution Rate"],
        [
            str(stats.get("total_residents", 0)),
            str(stats.get("active_complaints", 0)),
            str(stats.get("resolved_complaints", 0)),
            f"{stats.get('resolution_rate', 0.0):.1f}%"
        ]
    ]
    
    stats_table = Table(stats_data, colWidths=[130, 130, 130, 130])
    stats_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#1565C0")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BACKGROUND', (0,1), (-1,-1), colors.HexColor("#F5F7FA")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E0E0E0")),
        ('FONTSIZE', (0,0), (-1,-1), 10),
    ]))
    
    story.append(stats_table)
    story.append(Spacer(1, 20))
    
    # 2. Category Distribution
    story.append(Paragraph("Complaints by Category", section_style))
    
    category_data = [["Category", "Count"]]
    for cat, val in category_counts.items():
        category_data.append([cat, str(val)])
        
    if len(category_data) == 1:
        category_data.append(["No complaints logged", "0"])
        
    cat_table = Table(category_data, colWidths=[270, 250])
    cat_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#43A047")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('ALIGN', (1,0), (1,-1), 'CENTER'),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F5F7FA")]),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E0E0E0")),
        ('FONTSIZE', (0,0), (-1,-1), 9),
    ]))
    story.append(cat_table)
    story.append(Spacer(1, 20))
    
    # 3. Recent Complaints List
    story.append(Paragraph("Recent Complaints Log", section_style))
    
    complaint_data = [["ID", "Title", "Category", "Priority", "Status", "Date"]]
    for comp in recent_complaints[:10]: # Limit to 10 for sizing
        created_date = comp.get("created_at")
        if isinstance(created_date, datetime):
            date_str = created_date.strftime("%d-%b-%Y")
        else:
            date_str = str(created_date)[:10]
            
        complaint_data.append([
            comp.get("complaint_number", "N/A"),
            comp.get("title", "")[:28] + ("..." if len(comp.get("title", "")) > 28 else ""),
            comp.get("category", ""),
            comp.get("priority", ""),
            comp.get("status", ""),
            date_str
        ])
        
    if len(complaint_data) == 1:
        complaint_data.append(["-", "No recent complaints found", "-", "-", "-", "-"])
        
    comp_table = Table(complaint_data, colWidths=[90, 160, 70, 60, 70, 70])
    comp_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#37474F")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F9F9F9")]),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E0E0E0")),
        ('FONTSIZE', (0,0), (-1,-1), 8),
    ]))
    
    story.append(comp_table)
    
    # Build Document
    doc.build(story)
    return file_path
