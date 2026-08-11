import os
from typing import List, Dict
from pypdf import PdfReader

def parse_pdf_to_chunks(file_path: str, filename: str, chunk_size: int = 500, overlap: int = 50) -> List[Dict]:
    """
    Parses a PDF file page by page, splits the text into chunks,
    and returns a list of dictionaries with text, page number, and source filename.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"PDF file not found at {file_path}")
        
    reader = PdfReader(file_path)
    chunks = []
    
    for page_idx, page in enumerate(reader.pages):
        page_num = page_idx + 1
        text = page.extract_text()
        if not text:
            continue
            
        # Clean text
        text = " ".join(text.split())
        
        # Split text into overlapping chunks
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunk_text = text[start:end]
            
            # Make sure we don't end in the middle of a word if possible
            if end < len(text):
                last_space = chunk_text.rfind(" ")
                if last_space > chunk_size // 2:
                    end = start + last_space
                    chunk_text = text[start:end]
                    
            chunks.append({
                "text": chunk_text.strip(),
                "page": page_num,
                "document_name": filename
            })
            
            start = end - overlap
            if overlap <= 0 or start >= len(text):
                start = end
                
    return chunks
