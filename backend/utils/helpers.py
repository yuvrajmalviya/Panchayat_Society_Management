import os
import uuid
from datetime import datetime
from PIL import Image
from backend.database.connection import get_complaints_collection

async def generate_complaint_number() -> str:
    """
    Generates a unique complaint number, e.g. COMP-2026-0001
    """
    current_year = datetime.utcnow().year
    prefix = f"COMP-{current_year}-"
    
    # Query database for number of complaints starting with prefix
    complaints_col = get_complaints_collection()
    count = await complaints_col.count_documents({"complaint_number": {"$regex": f"^{prefix}"}})
    
    # Generate sequential number
    seq = count + 1
    # Check uniqueness, increment if exists
    while True:
        num = f"{prefix}{seq:04d}"
        existing = await complaints_col.find_one({"complaint_number": num})
        if not existing:
            return num
        seq += 1

def compress_image(file_path: str, max_size_kb: int = 500) -> str:
    """
    Compresses an image to stay below a target size in KB while preserving format where possible.
    """
    if not os.path.exists(file_path):
        return file_path
        
    file_size = os.path.getsize(file_path) / 1024
    if file_size <= max_size_kb:
        return file_path
        
    try:
        img = Image.open(file_path)
        # Convert RGBA to RGB if saving as JPEG
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
            
        quality = 85
        while file_size > max_size_kb and quality > 20:
            img.save(file_path, "JPEG", quality=quality, optimize=True)
            file_size = os.path.getsize(file_path) / 1024
            quality -= 10
    except Exception as e:
        print(f"Error compressing image: {e}")
        
    return file_path

def save_uploaded_file(file, directory: str, filename_prefix: str = "") -> str:
    """
    Saves an uploaded file to the specified directory with an optional unique prefix.
    Returns the relative path to the saved file.
    """
    os.makedirs(directory, exist_ok=True)
    ext = os.path.splitext(file.filename)[1]
    unique_filename = f"{filename_prefix}{uuid.uuid4()}{ext}"
    full_path = os.path.join(directory, unique_filename)
    
    with open(full_path, "wb") as f:
        f.write(file.file.read())
        
    # Return normalized relative path for browser access
    return os.path.relpath(full_path).replace("\\", "/")
