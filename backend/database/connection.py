import os
import json
import logging
import uuid
import re
from datetime import datetime
from bson import ObjectId
from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError
from backend.config import settings

logger = logging.getLogger("panchayat_ai.db")

# Flag to specify if we are using JSON file database fallback
USE_FALLBACK_DB = False
fallback_db_dir = os.path.join(settings.UPLOAD_DIR, "db_files")
os.makedirs(fallback_db_dir, exist_ok=True)

class Database:
    client = None
    db = None

db_helper = Database()

def get_database():
    global USE_FALLBACK_DB
    if db_helper.db is None and not USE_FALLBACK_DB:
        logger.info(f"Connecting to MongoDB at {settings.MONGODB_URL}")
        try:
            # Connect with a short timeout to check if server is active
            temp_client = MongoClient(settings.MONGODB_URL, serverSelectionTimeoutMS=2000)
            temp_client.server_info() # Will trigger ServerSelectionTimeoutError if down
            
            # If server is active, load the async motor client
            from motor.motor_asyncio import AsyncIOMotorClient
            db_helper.client = AsyncIOMotorClient(settings.MONGODB_URL)
            db_helper.db = db_helper.client[settings.DATABASE_NAME]
            logger.info("Successfully connected to live MongoDB server.")
        except Exception as e:
            logger.warning(f"MongoDB connection failed: {e}")
            logger.warning(f"[FALLBACK DB] Falling back to local JSON File Database at {fallback_db_dir}")
            USE_FALLBACK_DB = True
            db_helper.db = FileBasedDatabase()
    elif USE_FALLBACK_DB:
        return db_helper.db
    return db_helper.db

# Recursive serialization helper
def serialize_data(val):
    if isinstance(val, dict):
        return {k: serialize_data(v) for k, v in val.items()}
    elif isinstance(val, list):
        return [serialize_data(v) for v in val]
    elif isinstance(val, datetime):
        return {"$date": val.isoformat() + "Z"}
    elif isinstance(val, ObjectId):
        return {"$oid": str(val)}
    else:
        return val

# Recursive deserialization helper
def deserialize_data(val):
    if isinstance(val, dict):
        if "$oid" in val:
            return ObjectId(val["$oid"])
        if "$date" in val:
            try:
                date_str = val["$date"].replace("Z", "+00:00")
                return datetime.fromisoformat(date_str).replace(tzinfo=None)
            except Exception:
                pass
        return {k: deserialize_data(v) for k, v in val.items()}
    elif isinstance(val, list):
        return [deserialize_data(v) for v in val]
    else:
        return val

class FileBasedDatabase:
    def __getitem__(self, collection_name: str):
        return JSONCollection(collection_name)

class InsertResult:
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id

class UpdateResult:
    def __init__(self, matched_count, modified_count):
        self.matched_count = matched_count
        self.modified_count = modified_count

class DeleteResult:
    def __init__(self, deleted_count):
        self.deleted_count = deleted_count

class JSONCollection:
    def __init__(self, name: str):
        self.name = name
        self.filepath = os.path.join(fallback_db_dir, f"{name}.json")
        if not os.path.exists(self.filepath):
            with open(self.filepath, "w", encoding="utf-8") as f:
                json.dump([], f)

    def _read_data(self) -> list:
        try:
            if not os.path.exists(self.filepath):
                return []
            with open(self.filepath, "r", encoding="utf-8") as f:
                try:
                    raw_list = json.load(f)
                except json.JSONDecodeError:
                    # If file is empty or corrupted, reset it
                    logger.warning(f"Database file {self.filepath} was corrupted. Resetting it.")
                    raw_list = []
                
            return deserialize_data(raw_list)
        except Exception as e:
            logger.error(f"Error reading JSON db {self.name}: {e}")
            return []

    def _write_data(self, data: list):
        try:
            serializable_data = serialize_data(data)
            # Write to a temporary file first, then rename, to prevent file truncation corruption
            temp_filepath = self.filepath + ".tmp"
            with open(temp_filepath, "w", encoding="utf-8") as f:
                json.dump(serializable_data, f, indent=2, ensure_ascii=False)
            if os.path.exists(self.filepath):
                os.remove(self.filepath)
            os.rename(temp_filepath, self.filepath)
        except Exception as e:
            logger.error(f"Error writing JSON db {self.name}: {e}")

    def _match_query(self, doc: dict, query: dict) -> bool:
        if not query:
            return True
            
        for key, value in query.items():
            if key == "$or":
                # List of subqueries, match if ANY is true
                if not isinstance(value, list):
                    return False
                if not any(self._match_query(doc, subq) for subq in value):
                    return False
                continue
                
            # Fetch doc value
            doc_val = doc.get(key)
            
            # Handle dictionary operators like $regex, $gte, $lt, $in
            if isinstance(value, dict):
                for op, op_val in value.items():
                    if op == "$regex":
                        if doc_val is None:
                            return False
                        options = value.get("$options", "")
                        flags = re.IGNORECASE if "i" in options else 0
                        if not re.search(op_val, str(doc_val), flags):
                            return False
                    elif op == "$options":
                        continue
                    elif op == "$gte":
                        if doc_val is None:
                            return False
                        d_val, o_val = doc_val, op_val
                        if isinstance(d_val, str) and isinstance(o_val, datetime):
                            try:
                                d_val = datetime.fromisoformat(d_val.replace("Z", "+00:00")).replace(tzinfo=None)
                            except Exception:
                                pass
                        elif isinstance(o_val, str) and isinstance(d_val, datetime):
                            try:
                                o_val = datetime.fromisoformat(o_val.replace("Z", "+00:00")).replace(tzinfo=None)
                            except Exception:
                                pass
                        try:
                            if d_val < o_val:
                                return False
                        except Exception:
                            return False
                    elif op == "$lt":
                        if doc_val is None:
                            return False
                        d_val, o_val = doc_val, op_val
                        if isinstance(d_val, str) and isinstance(o_val, datetime):
                            try:
                                d_val = datetime.fromisoformat(d_val.replace("Z", "+00:00")).replace(tzinfo=None)
                            except Exception:
                                pass
                        elif isinstance(o_val, str) and isinstance(d_val, datetime):
                            try:
                                o_val = datetime.fromisoformat(o_val.replace("Z", "+00:00")).replace(tzinfo=None)
                            except Exception:
                                pass
                        try:
                            if d_val >= o_val:
                                return False
                        except Exception:
                            return False
                    elif op == "$in":
                        if doc_val not in op_val:
                            return False
            else:
                # Direct comparison
                if doc_val != value:
                    return False
        return True

    # ---------------------------------------------------------
    # MOCK MONGODB DATABASE CRUD API
    # ---------------------------------------------------------
    async def find_one(self, query: dict) -> Optional[dict]:
        data = self._read_data()
        for doc in data:
            if self._match_query(doc, query):
                return doc
        return None

    def find(self, query: dict = None):
        if query is None:
            query = {}
        data = self._read_data()
        matched = [doc for doc in data if self._match_query(doc, query)]
        return MockCursor(matched)

    async def count_documents(self, query: dict) -> int:
        data = self._read_data()
        matched = [doc for doc in data if self._match_query(doc, query)]
        return len(matched)

    async def insert_one(self, doc: dict) -> InsertResult:
        data = self._read_data()
        # Ensure _id field
        if "_id" not in doc:
            doc["_id"] = ObjectId()
        data.append(doc)
        self._write_data(data)
        return InsertResult(doc["_id"])

    async def insert_many(self, docs: list) -> list:
        data = self._read_data()
        inserted_ids = []
        for doc in docs:
            if "_id" not in doc:
                doc["_id"] = ObjectId()
            inserted_ids.append(doc["_id"])
            data.append(doc)
        self._write_data(data)
        return inserted_ids

    async def update_one(self, query: dict, update: dict) -> UpdateResult:
        data = self._read_data()
        matched_idx = -1
        for idx, doc in enumerate(data):
            if self._match_query(doc, query):
                matched_idx = idx
                break
                
        if matched_idx == -1:
            return UpdateResult(0, 0)
            
        doc = data[matched_idx]
        
        # Apply set updates
        if "$set" in update:
            for k, v in update["$set"].items():
                doc[k] = v
                
        # Apply push updates (append to list)
        if "$push" in update:
            for k, v in update["$push"].items():
                if k not in doc or not isinstance(doc[k], list):
                    doc[k] = []
                doc[k].append(v)
                
        self._write_data(data)
        return UpdateResult(1, 1)

    async def update_many(self, query: dict, update: dict) -> UpdateResult:
        data = self._read_data()
        matched_count = 0
        for doc in data:
            if self._match_query(doc, query):
                matched_count += 1
                if "$set" in update:
                    for k, v in update["$set"].items():
                        doc[k] = v
                if "$push" in update:
                    for k, v in update["$push"].items():
                        if k not in doc or not isinstance(doc[k], list):
                            doc[k] = []
                        doc[k].append(v)
                        
        if matched_count > 0:
            self._write_data(data)
        return UpdateResult(matched_count, matched_count)

    async def delete_one(self, query: dict) -> DeleteResult:
        data = self._read_data()
        target_idx = -1
        for idx, doc in enumerate(data):
            if self._match_query(doc, query):
                target_idx = idx
                break
                
        if target_idx == -1:
            return DeleteResult(0)
            
        data.pop(target_idx)
        self._write_data(data)
        return DeleteResult(1)

class MockCursor:
    def __init__(self, data: list):
        self.data = data
        self.offset = 0
        self.limit_val = None

    def skip(self, offset: int):
        self.offset = offset
        return self

    def limit(self, limit: int):
        self.limit_val = limit
        return self

    def sort(self, key_or_list, direction=None):
        # Handle formats like [("pinned", -1), ("created_at", -1)] or a single string
        sort_rules = []
        if isinstance(key_or_list, list):
            sort_rules = key_or_list
        elif isinstance(key_or_list, str):
            dir_val = direction if direction is not None else 1
            sort_rules = [(key_or_list, dir_val)]
            
        # Run sorting
        for key, dir_val in reversed(sort_rules):
            reverse = dir_val < 0
            
            def to_datetime(val):
                if isinstance(val, datetime):
                    return val
                if isinstance(val, str):
                    try:
                        date_str = val.replace("Z", "+00:00")
                        return datetime.fromisoformat(date_str).replace(tzinfo=None)
                    except Exception:
                        return None
                return None

            # Detect the field type from the data
            is_date_field = False
            is_bool_field = False
            is_num_field = False
            for item in self.data:
                v = item.get(key)
                if v is not None:
                    if to_datetime(v) is not None:
                        is_date_field = True
                        break
                    elif isinstance(v, bool):
                        is_bool_field = True
                        break
                    elif isinstance(v, (int, float)):
                        is_num_field = True
                        break

            if is_date_field:
                fallback = datetime.min
            elif is_bool_field:
                fallback = False
            elif is_num_field:
                fallback = 0
            else:
                fallback = ""

            def get_sort_val(x):
                val = x.get(key)
                if val is None:
                    return fallback
                if is_date_field:
                    dt = to_datetime(val)
                    return dt if dt is not None else datetime.min
                return val

            self.data.sort(key=get_sort_val, reverse=reverse)
        return self

    async def to_list(self, length: int = None) -> list:
        start = self.offset
        end = start + length if length is not None else len(self.data)
        if self.limit_val is not None:
            end = min(end, start + self.limit_val)
        return self.data[start:end]

    # Support async iterator context
    def __aiter__(self):
        start = self.offset
        end = start + self.limit_val if self.limit_val is not None else len(self.data)
        self.iter_data = self.data[start:end]
        self.iter_idx = 0
        return self

    async def __anext__(self):
        if self.iter_idx >= len(self.iter_data):
            raise StopAsyncIteration
        val = self.iter_data[self.iter_idx]
        self.iter_idx += 1
        return val


# -------------------------------------------------------------
# GET COLLECTION HANDLERS
# -------------------------------------------------------------
def get_users_collection():
    return get_database()["users"]

def get_complaints_collection():
    return get_database()["complaints"]

def get_notices_collection():
    return get_database()["notices"]

def get_announcements_collection():
    return get_database()["announcements"]

def get_documents_collection():
    return get_database()["documents"]

def get_notifications_collection():
    return get_database()["notifications"]

def get_audit_logs_collection():
    return get_database()["audit_logs"]

async def close_db_connection():
    if not USE_FALLBACK_DB and db_helper.client is not None:
        db_helper.client.close()
        db_helper.db = None
        db_helper.client = None
        logger.info("Closed live MongoDB connection.")
