import os
import json
import logging
import numpy as np
from typing import List, Dict, Tuple, Optional
from backend.config import settings

logger = logging.getLogger("panchayat_ai.ai")

# Try to import Gemini / Google Generative AI
try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    logger.warning("google-generativeai package not installed. Gemini support unavailable.")

# Try to import OpenAI SDK
try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    logger.warning("openai package not installed. OpenAI support unavailable.")

# Try to import FAISS and SentenceTransformers
try:
    import faiss
    from sentence_transformers import SentenceTransformer
    LOCAL_AI_AVAILABLE = True
except ImportError:
    LOCAL_AI_AVAILABLE = False
    logger.warning("faiss-cpu or sentence-transformers not installed. Using pure-Python vector/keyword fallback.")

# Global state for vectors
# We store document chunks and their embeddings in memory and persist them to a JSON file
BYLAWS_INDEX_PATH = os.path.join(settings.UPLOAD_DIR, "bylaws_index.json")
indexed_chunks: List[Dict] = []
chunk_embeddings: List[List[float]] = []
local_model = None

def _read_message_content(choice) -> str:
    message = getattr(choice, "message", None)
    if message is None:
        if isinstance(choice, dict):
            message = choice.get("message", {})
        else:
            return str(choice)
    if isinstance(message, dict):
        return message.get("content", "")
    return getattr(message, "content", "")

def get_local_model():
    global local_model
    if LOCAL_AI_AVAILABLE and local_model is None:
        logger.info("Loading local SentenceTransformer model (all-MiniLM-L6-v2)...")
        try:
            local_model = SentenceTransformer("all-MiniLM-L6-v2")
        except Exception as e:
            logger.error(f"Failed to load local SentenceTransformer: {e}")
    return local_model

# Load index if it exists on startup
def load_bylaws_index():
    global indexed_chunks, chunk_embeddings
    if os.path.exists(BYLAWS_INDEX_PATH):
        try:
            with open(BYLAWS_INDEX_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                indexed_chunks = data.get("chunks", [])
                chunk_embeddings = data.get("embeddings", [])
                logger.info(f"Loaded {len(indexed_chunks)} document chunks from index storage.")
                
            if indexed_chunks:
                # Validate dimension alignment with current configuration
                test_emb = get_embeddings([indexed_chunks[0]["text"]])[0]
                db_emb_len = len(chunk_embeddings[0]) if chunk_embeddings else 0
                current_emb_len = len(test_emb)
                
                if db_emb_len != current_emb_len:
                    logger.warning(f"Embedding dimension mismatch (DB: {db_emb_len}, Current: {current_emb_len}). Regenerating embeddings...")
                    texts = [c["text"] for c in indexed_chunks]
                    chunk_embeddings = get_embeddings(texts)
                    with open(BYLAWS_INDEX_PATH, "w", encoding="utf-8") as f:
                        json.dump({
                            "chunks": indexed_chunks,
                            "embeddings": chunk_embeddings
                        }, f, indent=2, ensure_ascii=False)
                    logger.info("Successfully re-aligned index embeddings.")
        except Exception as e:
            logger.error(f"Error loading bylaws index: {e}")

# -------------------------------------------------------------
# 1. EMBEDDING GENERATION
# -------------------------------------------------------------
import hashlib

def generate_keyword_vector(text: str) -> List[float]:
    """
    Generates a deterministic 128-dimensional pseudo-embedding based on word hashes using MD5.
    This enables cosine similarity comparison without external libraries.
    """
    words = text.lower().split()
    vector = [0.0] * 128
    if not words:
        return vector
        
    for w in words:
        # MD5 hashing is deterministic across all processes and runs
        h = int(hashlib.md5(w.encode('utf-8')).hexdigest(), 16)
        idx = h % 128
        vector[idx] += 1.0
        
    # L2 Normalization
    norm = np.linalg.norm(vector)
    if norm > 0:
        vector = (np.array(vector) / norm).tolist()
    return vector

def _get_api_key(provider: Optional[str] = None) -> str:
    if provider == "gemini":
        return settings.GOOGLE_API_KEY
    if provider == "openai":
        return settings.AI_API_KEY
    return settings.GOOGLE_API_KEY or settings.AI_API_KEY


def _get_ai_provider() -> str:
    if settings.GOOGLE_API_KEY and GEMINI_AVAILABLE:
        return "gemini"
    if settings.AI_API_KEY and OPENAI_AVAILABLE:
        return "openai"
    return "fallback"


def _get_provider_defaults(provider: Optional[str] = None) -> Dict[str, str]:
    if provider == "openai":
        return {
            "llm_model": settings.LLM_MODEL if settings.LLM_MODEL and settings.LLM_MODEL.lower().startswith("gpt") else "gpt-4o-mini",
            "embedding_model": settings.EMBEDDING_MODEL if settings.EMBEDDING_MODEL and settings.EMBEDDING_MODEL.lower().startswith("text-embedding") else "text-embedding-3-small",
            "transcription_model": settings.TRANSCRIPTION_MODEL,
        }
    if provider == "gemini":
        return {
            "llm_model": settings.LLM_MODEL if settings.LLM_MODEL and settings.LLM_MODEL.lower().startswith("gemini") else "gemini-1.5-mini",
            "embedding_model": settings.EMBEDDING_MODEL if settings.EMBEDDING_MODEL and settings.EMBEDDING_MODEL.lower().startswith("textembedding") else "textembedding-gecko-001",
            "transcription_model": settings.TRANSCRIPTION_MODEL,
        }
    return {
        "llm_model": settings.LLM_MODEL,
        "embedding_model": settings.EMBEDDING_MODEL,
        "transcription_model": settings.TRANSCRIPTION_MODEL,
    }


def get_embeddings(texts: List[str]) -> List[List[float]]:
    """
    Generates embedding vectors for a list of texts using Gemini or OpenAI.
    Falls back to a local model or a TF-IDF-like word overlap vector if neither is available.
    """
    provider = _get_ai_provider()
    api_key = _get_api_key(provider)
    provider_defaults = _get_provider_defaults(provider)

    if provider == "gemini" and api_key and GEMINI_AVAILABLE:
        try:
            genai.configure(api_key=api_key)
            response = genai.embeddings.create(
                model=provider_defaults["embedding_model"],
                input=texts
            )
            return [item.embedding for item in response.data]
        except Exception as e:
            logger.error(f"Gemini embedding generation failed: {e}. Trying local/mock.")

    if provider == "openai" and api_key and OPENAI_AVAILABLE:
        try:
            client = openai.OpenAI(api_key=api_key)
            response = client.embeddings.create(
                model=provider_defaults["embedding_model"],
                input=texts
            )
            return [item.embedding for item in response.data]
        except Exception as e:
            logger.error(f"OpenAI embedding generation failed: {e}. Trying local/mock.")

    # 2. Try Local SentenceTransformer
    if LOCAL_AI_AVAILABLE:
        model = get_local_model()
        if model:
            try:
                embeddings = model.encode(texts)
                return [arr.tolist() for arr in embeddings]
            except Exception as e:
                logger.error(f"Local SentenceTransformer embedding failed: {e}")

    # 3. Pure Python Fallback: Word Overlap Vector Representation
    # We construct a simple term frequency vector of the top words
    return [generate_keyword_vector(text) for text in texts]

# Call index loader now that get_embeddings is defined
load_bylaws_index()


# -------------------------------------------------------------
# 2. DOCUMENT INDEXING (RAG INGESTION)
# -------------------------------------------------------------
async def index_document_chunks(chunks: List[Dict]):
    """
    Generates embeddings for document chunks and appends them to our vector database.
    Saves the database to bylaws_index.json.
    """
    global indexed_chunks, chunk_embeddings
    
    texts = [chunk["text"] for chunk in chunks]
    if not texts:
        return
        
    embeddings = get_embeddings(texts)
    
    indexed_chunks.extend(chunks)
    chunk_embeddings.extend(embeddings)
    
    # Save index
    try:
        with open(BYLAWS_INDEX_PATH, "w", encoding="utf-8") as f:
            json.dump({
                "chunks": indexed_chunks,
                "embeddings": chunk_embeddings
            }, f, indent=2, ensure_ascii=False)
        logger.info(f"Successfully indexed and stored {len(chunks)} chunks.")
    except Exception as e:
        logger.error(f"Error saving bylaws index: {e}")

async def rebuild_bylaws_index():
    """
    Clears the current RAG index and builds it fresh using ONLY the latest active
    bylaws document from the database repository.
    """
    global indexed_chunks, chunk_embeddings
    
    # Reset in-memory index
    indexed_chunks = []
    chunk_embeddings = []
    
    # Import locally to avoid circular dependencies
    from backend.database.connection import get_documents_collection
    from backend.services.pdf_service import parse_pdf_to_chunks
    
    documents_col = get_documents_collection()
    
    # Find all bylaws documents sorted by upload date descending
    bylaws_docs = []
    cursor = documents_col.find({"type": "Bylaws"}).sort("uploaded_at", -1)
    async for doc in cursor:
        bylaws_docs.append(doc)
        
    if not bylaws_docs:
        # No bylaws documents left in the database. Save empty index.
        try:
            if os.path.exists(BYLAWS_INDEX_PATH):
                os.remove(BYLAWS_INDEX_PATH)
            logger.info("Bylaws index cleared because no bylaws documents exist.")
        except Exception as e:
            logger.error(f"Error clearing index file: {e}")
        return
        
    # Mark the most recent one as active, and all others as inactive
    latest_doc = bylaws_docs[0]
    
    # Update status in the database
    await documents_col.update_many(
        {"type": "Bylaws", "_id": {"$ne": latest_doc["_id"]}},
        {"$set": {"is_active": False}}
    )
    await documents_col.update_one(
        {"_id": latest_doc["_id"]},
        {"$set": {"is_active": True}}
    )
    
    # Get the file path of the active bylaws document
    filepath = latest_doc["filepath"]
    full_path = os.path.join(os.getcwd(), filepath)
    
    if not os.path.exists(full_path):
        logger.error(f"Active bylaws file not found at path: {full_path}")
        # Save empty index
        try:
            if os.path.exists(BYLAWS_INDEX_PATH):
                os.remove(BYLAWS_INDEX_PATH)
        except Exception as e:
            logger.error(f"Error removing index: {e}")
        return
        
    # Re-index chunks
    try:
        chunks = parse_pdf_to_chunks(full_path, latest_doc["filename"])
        if chunks:
            # We generate embeddings and save
            texts = [chunk["text"] for chunk in chunks]
            embeddings = get_embeddings(texts)
            
            indexed_chunks = chunks
            chunk_embeddings = embeddings
            
            with open(BYLAWS_INDEX_PATH, "w", encoding="utf-8") as f:
                json.dump({
                    "chunks": indexed_chunks,
                    "embeddings": chunk_embeddings
                }, f, indent=2, ensure_ascii=False)
            logger.info(f"Successfully rebuilt bylaws index using latest document '{latest_doc['filename']}'. Loaded {len(chunks)} chunks.")
        else:
            logger.warning(f"No text chunks parsed from active bylaws document: {latest_doc['filename']}")
    except Exception as e:
        logger.error(f"Failed to rebuild bylaws index: {e}")


import urllib.request
import urllib.parse

def translate_text_offline(text: str, target_lang: str) -> str:
    """
    Translates a given text snippet to the target language using a free public translation service.
    Falls back to original text on failure or network absence.
    """
    if not text or not target_lang or target_lang.lower() == "english":
        return text
        
    lang_codes = {
        "hindi": "hi",
        "hinglish": "hi",
        "marathi": "mr",
        "spanish": "es",
        "gujarati": "gu",
        "tamil": "ta",
        "telugu": "te",
        "kannada": "kn",
        "bengali": "bn",
        "french": "fr"
    }
    
    code = lang_codes.get(target_lang.lower(), "hi")
    try:
        # Translate text in chunks of 500 chars to avoid URL length limitations
        truncated_text = text[:500]
        encoded_text = urllib.parse.quote(truncated_text)
        url = f"https://api.mymemory.translated.net/get?q={encoded_text}&langpair=en|{code}"
        
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req, timeout=3) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            translated = res_data.get("matches", [{}])[0].get("translation") or res_data.get("responseData", {}).get("translatedText")
            if translated:
                return translated
    except Exception as e:
        logger.warning(f"Translation API request failed: {e}")
    return text

def summarize_chunk_offline(text: str, query: str) -> str:
    """
    Summarizes a raw text chunk in offline mode by selecting the most relevant 2-3 sentences
    matching the query keywords and formatting them as short bullet points.
    """
    import re
    # Split text into sentences using simple regex
    sentences = re.split(r'(?<=[.!?])\s+', text)
    if len(sentences) <= 2:
        return "\n".join([f"• {s.strip()}" for s in sentences if s.strip()])
        
    query_words = set(query.lower().split())
    ranked_sentences = []
    
    for s in sentences:
        s_clean = s.strip()
        if not s_clean:
            continue
        # Count matching words
        s_words = set(s_clean.lower().split())
        score = len(query_words.intersection(s_words))
        ranked_sentences.append((score, s_clean))
        
    # Sort by score descending
    ranked_sentences.sort(key=lambda x: x[0], reverse=True)
    top_sentences = ranked_sentences[:3]
    
    # Filter out sentences that have 0 match if we have at least one matching sentence
    any_match = any(score > 0 for score, _ in top_sentences)
    if any_match:
        top_sentences = [item for item in top_sentences if item[0] > 0]
        
    # Re-order back to their original appearance order
    selected = [s for _, s in top_sentences]
    ordered_selected = [s for s in sentences if s.strip() in selected]
    
    # Format as short bullet points (max 25 words per sentence for simplicity)
    bullet_points = []
    for s in ordered_selected[:3]:
        words = s.split()
        if len(words) > 25:
            s_short = " ".join(words[:25]) + "..."
        else:
            s_short = s
        bullet_points.append(f"• {s_short}")
        
    return "\n".join(bullet_points)

# -------------------------------------------------------------
# 3. VECTOR SEARCH & RAG QUERY
# -------------------------------------------------------------
def query_bylaws(question: str, language: str = "English", top_k: int = 3) -> Tuple[str, List[Dict]]:
    """
    Queries bylaws index, retrieves relevant chunks, and returns an AI response with citations.
    Supports rendering in user's preferred language and translating into simple terms.
    """
    global indexed_chunks, chunk_embeddings
    
    if not indexed_chunks:
        no_docs_msg = "No bylaws or society rules have been uploaded yet. Please ask the administrator to upload the bylaws PDF first."
        if language.lower() != "english":
            no_docs_msg = translate_text_offline(no_docs_msg, language)
        return no_docs_msg, []
        
    # Generate query embedding
    query_emb = get_embeddings([question])[0]
    
    # Calculate Cosine Similarities
    similarities = []
    q_arr = np.array(query_emb)
    
    for idx, emb in enumerate(chunk_embeddings):
        e_arr = np.array(emb)
        dot_product = np.dot(q_arr, e_arr)
        norm_q = np.linalg.norm(q_arr)
        norm_e = np.linalg.norm(e_arr)
        
        sim = dot_product / (norm_q * norm_e) if (norm_q > 0 and norm_e > 0) else 0.0
        similarities.append((sim, idx))
        
    # Sort and take top_k
    similarities.sort(key=lambda x: x[0], reverse=True)
    top_matches = similarities[:top_k]
    
    retrieved_chunks = []
    citations = []
    
    for sim, idx in top_matches:
        # Only take relevant chunks
        if sim > 0.05:
            chunk = indexed_chunks[idx]
            retrieved_chunks.append(chunk)
            
            # Format citation
            cit = {
                "document_name": chunk["document_name"],
                "page": chunk["page"]
            }
            if cit not in citations:
                citations.append(cit)
                
    if not retrieved_chunks:
        no_matches_msg = "No relevant information found in the society bylaws regarding your question."
        if language.lower() != "english":
            no_matches_msg = translate_text_offline(no_matches_msg, language)
        return no_matches_msg, []
        
    # Build prompt context
    context_str = "\n\n".join([f"[Source: {c['document_name']}, Page {c['page']}]\n{c['text']}" for c in retrieved_chunks])
    
    provider = _get_ai_provider()
    api_key = _get_api_key(provider)
    provider_defaults = _get_provider_defaults(provider)
    completion_model = provider_defaults["llm_model"]

    if provider == "openai" and api_key and OPENAI_AVAILABLE:
        try:
            client = openai.OpenAI(api_key=api_key)
            if language.lower() == "hinglish":
                prompt = (
                    f"You are the Panchayat AI Assistant. Answer the user's question based strictly on the retrieved society rules context below.\n"
                    f"You MUST structure your entire response in 'Hinglish' (Hindi language written in Roman/Latin script) following this exact layout:\n\n"
                    f"**Answer:**\n"
                    f"[A clear, simple, and easy-to-understand explanation of the answer in Hinglish for a layperson. Do NOT copy the dry legal text word-for-word.]\n\n"
                    f"**Relevant Bylaw:**\n"
                    f"* Bylaw/Section: [Specify the relevant section name, number, or document page name]\n"
                    f"* Applicable rule: [The key portion of the rule or provision from the text, kept brief]\n\n"
                    f"**Summary:**\n"
                    f"* [Short bullet point in Hinglish summarizing the key rule or penalty]\n"
                    f"* [Another short bullet point in Hinglish summarizing actions, fees, or timelines]\n\n"
                    f"Context:\n{context_str}\n\n"
                    f"Question: {question}\n\n"
                    f"If the answer cannot be found in the context, output exactly: 'Bylaws me iska answer nahi mila.' (in Hinglish)."
                )
            else:
                prompt = (
                    f"You are the Panchayat AI Assistant. Answer the user's question based strictly on the retrieved society rules context below.\n"
                    f"You MUST structure your entire response in the '{language}' language following this exact layout:\n\n"
                    f"**Answer:**\n"
                    f"[A clear, simple, and easy-to-understand explanation of the answer in everyday English for a layperson. Do NOT copy the dry legal text word-for-word. Keep it friendly and concise.]\n\n"
                    f"**Relevant Bylaw:**\n"
                    f"* Bylaw/Section: [Specify the relevant section name, number, or document page name]\n"
                    f"* Applicable rule: [The key portion of the rule or provision from the text, kept brief]\n\n"
                    f"**Summary:**\n"
                    f"* [Short bullet point summarizing the key rule or penalty]\n"
                    f"* [Another short bullet point summarizing actions, fees, or timelines]\n\n"
                    f"Context:\n{context_str}\n\n"
                    f"Question: {question}\n\n"
                    f"If the answer cannot be found in the context, output exactly: 'I cannot find the answer to this in the uploaded bylaws.' (translated to {language})."
                )
            response = client.chat.completions.create(
                model=completion_model,
                messages=[
                    {"role": "system", "content": f"You are a helpful administrative assistant for a local housing society/panchayat. You respond clearly in {language} with simplified terms, relevant bylaw details, and a final summary section."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2
            )
            answer = _read_message_content(response.choices[0]).strip()
            return answer, citations
        except Exception as e:
            logger.error(f"OpenAI completion failed: {e}. Using fallback.")
    elif provider == "gemini" and api_key and GEMINI_AVAILABLE:
        try:
            genai.configure(api_key=api_key)
            if language.lower() == "hinglish":
                prompt = (
                    f"You are the Panchayat AI Assistant. Answer the user's question based strictly on the retrieved society rules context below.\n"
                    f"You MUST structure your entire response in 'Hinglish' (Hindi language written in Roman/Latin script) following this exact layout:\n\n"
                    f"**Answer:**\n"
                    f"[A clear, simple, and easy-to-understand explanation of the answer in Hinglish for a layperson. Do NOT copy the dry legal text word-for-word.]\n\n"
                    f"**Relevant Bylaw:**\n"
                    f"* Bylaw/Section: [Specify the relevant section name, number, or document page name]\n"
                    f"* Applicable rule: [The key portion of the rule or provision from the text, kept brief]\n\n"
                    f"**Summary:**\n"
                    f"* [Short bullet point in Hinglish summarizing the key rule or penalty]\n"
                    f"* [Another short bullet point in Hinglish summarizing actions, fees, or timelines]\n\n"
                    f"Context:\n{context_str}\n\n"
                    f"Question: {question}\n\n"
                    f"If the answer cannot be found in the context, output exactly: 'Bylaws me iska answer nahi mila.' (in Hinglish)."
                )
            else:
                prompt = (
                    f"You are the Panchayat AI Assistant. Answer the user's question based strictly on the retrieved society rules context below.\n"
                    f"You MUST structure your entire response in the '{language}' language following this exact layout:\n\n"
                    f"**Answer:**\n"
                    f"[A clear, simple, and easy-to-understand explanation of the answer in everyday English for a layperson. Do NOT copy the dry legal text word-for-word. Keep it friendly and concise.]\n\n"
                    f"**Relevant Bylaw:**\n"
                    f"* Bylaw/Section: [Specify the relevant section name, number, or document page name]\n"
                    f"* Applicable rule: [The key portion of the rule or provision from the text, kept brief]\n\n"
                    f"**Summary:**\n"
                    f"* [Short bullet point summarizing the key rule or penalty]\n"
                    f"* [Another short bullet point summarizing actions, fees, or timelines]\n\n"
                    f"Context:\n{context_str}\n\n"
                    f"Question: {question}\n\n"
                    f"If the answer cannot be found in the context, output exactly: 'I cannot find the answer to this in the uploaded bylaws.' (translated to {language})."
                )
            response = genai.generate(
                model=completion_model,
                prompt=prompt,
                temperature=0.2
            )
            answer = getattr(response, "text", None) or str(response)
            return answer.strip(), citations
        except Exception as e:
            logger.error(f"Gemini completion failed: {e}. Using fallback.")
            
    # 2. Rule-based / Fallback response builder with translation support
    first_chunk = retrieved_chunks[0]
    
    # 1. Simplified Answer
    answer_lbl = "**Answer:**"
    answer_text = f"Based on the society bylaws, the rules regarding your query are described on Page {first_chunk['page']} of the document {first_chunk['document_name']}."
    
    # 2. Relevant Bylaw
    bylaw_lbl = "**Relevant Bylaw:**"
    bylaw_sec = f"* Bylaw/Section: Page {first_chunk['page']} ({first_chunk['document_name']})"
    bylaw_rule = f"* Applicable rule: {summarize_chunk_offline(first_chunk['text'], question)}"
    
    # 3. Summary
    summary_lbl = "**Summary:**"
    summary_point_1 = f"* The rule details can be found on Page {first_chunk['page']}."
    summary_point_2 = f"* Refer to the document {first_chunk['document_name']} for full official text."
    
    # Translate template outputs to target language if not English
    if language.lower() != "english":
        answer_lbl = translate_text_offline(answer_lbl, language)
        answer_text = translate_text_offline(answer_text, language)
        bylaw_lbl = translate_text_offline(bylaw_lbl, language)
        bylaw_sec = translate_text_offline(bylaw_sec, language)
        bylaw_rule = translate_text_offline(bylaw_rule, language)
        summary_lbl = translate_text_offline(summary_lbl, language)
        summary_point_1 = translate_text_offline(summary_point_1, language)
        summary_point_2 = translate_text_offline(summary_point_2, language)
        
    fallback_answer = (
        f"{answer_lbl}\n"
        f"{answer_text}\n\n"
        f"{bylaw_lbl}\n"
        f"{bylaw_sec}\n"
        f"{bylaw_rule}\n\n"
        f"{summary_lbl}\n"
        f"{summary_point_1}\n"
        f"{summary_point_2}\n"
    )
    
    if len(retrieved_chunks) > 1:
        add_header = "\n---\n\n**Additional relevant matches found in bylaws:**\n\n"
        if language.lower() != "english":
            add_header = translate_text_offline(add_header.strip(), language) + "\n\n"
        fallback_answer += add_header
        
        for idx, c in enumerate(retrieved_chunks[1:], start=2):
            match_lbl = f"Match {idx} (Page {c['page']} - {c['document_name']}):"
            c_text = summarize_chunk_offline(c['text'], question)
            if language.lower() != "english":
                match_lbl = translate_text_offline(match_lbl, language)
                c_text = translate_text_offline(c_text, language)
            fallback_answer += f"**{match_lbl}**\n{c_text}\n\n"
        
    return fallback_answer, citations


# -------------------------------------------------------------
# 4. WHISPER SPEECH-TO-TEXT
# -------------------------------------------------------------
async def transcribe_audio(file_path: str) -> str:
    """
    Transcribes audio files into text. Gemini transcription is not supported currently,
    so this function currently falls back to a demo transcription.
    """
    api_key = _get_api_key()
    if api_key and GEMINI_AVAILABLE:
        logger.warning("Gemini transcription is not supported yet; falling back to demo transcription.")

    # Fallback/Demo transcription
    # We look at the filename to simulate some typical complaints if the user records audio
    filename = os.path.basename(file_path).lower()
    if "water" in filename:
        return "There is a severe water leakage problem from the main overhead tank. The water has started flooding the entrance garden. Please send a plumber immediately."
    elif "electricity" in filename or "light" in filename:
        return "The streetlights in lane four are not working since last night. It is completely dark and unsafe for elderly residents to walk in the evening."
    elif "garbage" in filename or "clean" in filename:
        return "The garbage collection van has not visited our street for the last three days. The bins are overflowing and creating a terrible smell in the neighborhood."
    
    return "This is a recorded voice complaint regarding maintenance issues. The streetlights are broken and garbage is overflowing in our block. Please address this urgently."


# -------------------------------------------------------------
# 5. VOICE-TO-TICKET PARSING
# -------------------------------------------------------------
async def parse_voice_to_ticket(transcript: str) -> Dict[str, str]:
    """
    Uses LLM to structure a complaint transcript into title, description, category, and priority.
    Falls back to regular expressions/keyword analysis if OpenAI is not available.
    """
    api_key = _get_api_key()
    provider_defaults = _get_provider_defaults()

    if api_key and GEMINI_AVAILABLE:
        try:
            genai.configure(api_key=api_key)
            prompt = (
                f"Analyze the following complaint transcript and structure it into a JSON object with fields: "
                f"'title', 'description', 'category', and 'priority'.\n\n"
                f"Categories MUST be one of: 'Water', 'Electricity', 'Security', 'Road', 'Garbage', 'Sanitation', 'Garden', 'Street Light', 'Other'.\n"
                f"Priorities MUST be one of: 'Low', 'Medium', 'High', 'Critical'.\n\n"
                f"Transcript: \"{transcript}\"\n\n"
                f"Return ONLY valid JSON. No markdown backticks, no text wrapping."
            )
            response = genai.generate(
                model=provider_defaults["llm_model"],
                prompt=prompt,
                temperature=0.0
            )
            raw_content = getattr(response, "text", None) or str(response)
            if raw_content.startswith("```"):
                raw_content = raw_content.strip("```").strip("json").strip()
            return json.loads(raw_content)
        except Exception as e:
            logger.error(f"Gemini Voice-to-Ticket parsing failed: {e}. Trying keyword rule-based parser.")
            
    # 2. Rule-based keyword parser
    transcript_lower = transcript.lower()
    
    # Category detection
    category = "Other"
    categories_keywords = {
        "Water": ["water", "leak", "pipe", "plumb", "tap", "drain", "tank", "flood", "sewer"],
        "Electricity": ["electricity", "power", "fuse", "spark", "cable", "shock", "meter", "blackout", "current"],
        "Security": ["security", "guard", "gate", "theft", "robbery", "stranger", "lock", "cctv", "camera", "intruder"],
        "Road": ["road", "pothole", "asphalt", "street", "pavement", "breaker", "block"],
        "Garbage": ["garbage", "trash", "waste", "bin", "dump", "litter", "smell", "dustbin"],
        "Sanitation": ["sanitation", "toilet", "sweeping", "clean", "gutter", "drainage", "flies"],
        "Garden": ["garden", "park", "tree", "grass", "lawn", "plant", "flower", "bench", "play", "branches"],
        "Street Light": ["street light", "streetlight", "lamp", "post", "dark", "street-light"]
    }
    
    for cat, keywords in categories_keywords.items():
        if any(kw in transcript_lower for kw in keywords):
            category = cat
            break
            
    # Priority detection
    priority = "Medium"
    if any(w in transcript_lower for w in ["urgent", "immediate", "emergency", "danger", "critical", "flooding", "wire open"]):
        priority = "Critical"
    elif any(w in transcript_lower for w in ["high", "severe", "broken", "unsafe"]):
        priority = "High"
    elif any(w in transcript_lower for w in ["low", "minor", "suggest", "information", "slow"]):
        priority = "Low"
        
    # Title & description creation
    words = transcript.split()
    title = " ".join(words[:5]) + "..." if len(words) > 5 else transcript
    
    return {
        "title": title.strip(". "),
        "description": transcript,
        "category": category,
        "priority": priority
    }


# -------------------------------------------------------------
# 6. CHAT DIGEST SERVICE
# -------------------------------------------------------------
async def generate_chat_digest(chat_text: str) -> Dict[str, any]:
    """
    Summarizes long chat transcripts and extracts decisions, announcements, tasks, and deadlines.
    Falls back to a keyword/line parser if AI is not configured.
    """
    provider = _get_ai_provider()
    api_key = _get_api_key(provider)
    provider_defaults = _get_provider_defaults(provider)
    
    # Filter empty lines
    non_empty_lines = [line.strip() for line in chat_text.split("\n") if line.strip()]

    if provider == "openai" and api_key and OPENAI_AVAILABLE:
        try:
            client = openai.OpenAI(api_key=api_key)
            prompt = (
                f"Summarize the following group chat conversation. "
                f"Extract the overall summary, major decisions made, tasks assigned, notices announced, and any deadlines mentioned.\n\n"
                f"Format the output strictly as a JSON object with these fields:\n"
                f" - 'summary': A brief paragraph summarizing the chat. If the conversation contains no meaningful information to summarize, this field MUST be exactly 'No meaningful conversation content is available to generate a digest.' and all other fields MUST be empty lists.\n"
                f" - 'decisions': A list of strings listing key decisions. Do not make up or hallucinate any decisions. Leave empty list if none are mentioned.\n"
                f" - 'tasks': A list of strings listing tasks. Leave empty list if none are mentioned.\n"
                f" - 'announcements': A list of strings listing announcements. Leave empty list if none are mentioned.\n"
                f" - 'deadlines': A list of strings listing deadlines. Leave empty list if none are mentioned.\n\n"
                f"Chat Transcript:\n\"\"\"\n{chat_text}\n\"\"\"\n\n"
                f"Return ONLY valid JSON."
            )
            response = client.chat.completions.create(
                model=provider_defaults["llm_model"],
                messages=[
                    {"role": "system", "content": "You are an expert secretary assistant that parses chats and outputs JSON without placeholder content."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1
            )
            raw_content = _read_message_content(response.choices[0]).strip()
            if raw_content.startswith("```"):
                raw_content = raw_content.strip("```").strip("json").strip()
            return json.loads(raw_content)
        except Exception as e:
            logger.error(f"OpenAI Chat Digest failed: {e}. Using fallback parser.")
    elif provider == "gemini" and api_key and GEMINI_AVAILABLE:
        try:
            genai.configure(api_key=api_key)
            prompt = (
                f"Summarize the following group chat conversation. "
                f"Extract the overall summary, major decisions made, tasks assigned, notices announced, and any deadlines mentioned.\n\n"
                f"Format the output strictly as a JSON object with these fields:\n"
                f" - 'summary': A brief paragraph summarizing the chat. If the conversation contains no meaningful information to summarize, this field MUST be exactly 'No meaningful conversation content is available to generate a digest.' and all other fields MUST be empty lists.\n"
                f" - 'decisions': A list of strings listing key decisions. Do not make up or hallucinate any decisions. Leave empty list if none are mentioned.\n"
                f" - 'tasks': A list of strings listing tasks. Leave empty list if none are mentioned.\n"
                f" - 'announcements': A list of strings listing announcements. Leave empty list if none are mentioned.\n"
                f" - 'deadlines': A list of strings listing deadlines. Leave empty list if none are mentioned.\n\n"
                f"Chat Transcript:\n\"\"\"\n{chat_text}\n\"\"\"\n\n"
                f"Return ONLY valid JSON."
            )
            response = genai.generate(
                model=provider_defaults["llm_model"],
                prompt=prompt,
                temperature=0.1
            )
            raw_content = getattr(response, "text", None) or str(response)
            if raw_content.startswith("```"):
                raw_content = raw_content.strip("```").strip("json").strip()
            return json.loads(raw_content)
        except Exception as e:
            logger.error(f"Gemini Chat Digest failed: {e}. Using fallback parser.")
            
    # Mock/Rule fallback parser (Zero placeholders, dynamic only!)
    decisions = []
    tasks = []
    announcements = []
    deadlines = []
    
    for line in non_empty_lines:
        line_lower = line.lower()
        if any(w in line_lower for w in ["decide", "agreed", "approved", "finalized", "we will"]):
            decisions.append(line)
        elif any(w in line_lower for w in ["assign", "task", "todo", "todo:", "responsible", "please do", "will handle"]):
            tasks.append(line)
        elif any(w in line_lower for w in ["announce", "notice", "inform", "circular", "everyone"]):
            announcements.append(line)
        elif any(w in line_lower for w in ["deadline", "by date", "before", "due", "latest by", "august", "september"]):
            deadlines.append(line)
            
    if not decisions and not tasks and not announcements and not deadlines and len(non_empty_lines) < 3:
        return {
            "summary": "No meaningful conversation content is available to generate a digest.",
            "decisions": [],
            "tasks": [],
            "announcements": [],
            "deadlines": []
        }
        
    # Build dynamic summary of the actual text
    topics = []
    if decisions:
        topics.append("decisions agreed upon")
    if tasks:
        topics.append("tasks assigned")
    if announcements:
        topics.append("announcements made")
    if deadlines:
        topics.append("deadlines set")
        
    topics_str = ", ".join(topics) if topics else "general society discussions"
    summary = f"Parsed chat contains {len(non_empty_lines)} messages covering {topics_str}."
    if non_empty_lines:
        sample = non_empty_lines[0]
        summary += f" The discussion started with: \"{sample[:60]}...\"" if len(sample) > 60 else f" The discussion started with: \"{sample}\""
        
    return {
        "summary": summary,
        "decisions": decisions[:5],
        "tasks": tasks[:5],
        "announcements": announcements[:5],
        "deadlines": deadlines[:5]
    }
