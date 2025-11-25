from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
import uvicorn
import sqlite3
import sqlite_vec
import uuid
from datetime import datetime, timezone
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
import os
import json
import struct

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = "memories.db"

def serialize_float32(embedding: list[float]) -> bytes:
    """Serialize a list of floats to bytes for sqlite-vec."""
    return struct.pack(f'<{len(embedding)}f', *embedding)

# Models
class MemoryCreate(BaseModel):
    content: str

class ChatRequest(BaseModel):
    query: str

class ApiKeyRequest(BaseModel):
    provider: str | None = None
    api_key: str
    api_base: str | None = None
    model: str | None = None

def get_provider_config(provider: str | None) -> dict[str, str | None]:
    """Get API configuration based on provider name."""
    if provider == "gemini":
        return {
            "api_base": "https://generativelanguage.googleapis.com/v1beta",
            "model": "gemini-pro",
            "embedding_model": "text-embedding-005"
        }
    elif provider == "openai" or provider is None:
        return {
            "api_base": None,  # OpenAI default
            "model": "gpt-4o-mini",
            "embedding_model": "text-embedding-3-small"
        }
    else:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}. Supported: openai, gemini")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    # Try enabling extensions. On some Pythons this fails if not built with support.
    try:
        conn.enable_load_extension(True)
        sqlite_vec.load(conn)
        conn.enable_load_extension(False)
    except AttributeError:
        print("WARNING: sqlite3 does not support load_extension. Vector search will fail.")
    except Exception as e:
        print(f"WARNING: Failed to load sqlite-vec: {e}")
    
    cursor = conn.cursor()
    
    # Main table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS memories (
            id TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            source_type TEXT DEFAULT 'manual'
        )
    """)
    
    # Vector table
    cursor.execute("""
        CREATE VIRTUAL TABLE IF NOT EXISTS vec_memories USING vec0(
            embedding float[1536]
        )
    """)
    
    # Settings table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    """)
    
    conn.commit()
    conn.close()

init_db()

def get_openai_client():
    # 1. Try DB
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("SELECT value FROM settings WHERE key = 'openai_api_key'")
    row = cursor.fetchone()
    api_key = row[0] if row else None
    
    cursor.execute("SELECT value FROM settings WHERE key = 'openai_api_base'")
    row = cursor.fetchone()
    api_base = row[0] if row else None
    
    cursor.execute("SELECT value FROM settings WHERE key = 'openai_model'")
    row = cursor.fetchone()
    model = row[0] if row else None
    
    conn.close()
    
    # 2. Fallback to env
    if not api_key:
        api_key = os.getenv("OPENAI_API_KEY")
    if not api_base:
        api_base = os.getenv("OPENAI_API_BASE")
    if not model:
        model = os.getenv("OPENAI_MODEL")
        
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured. Use /apikey <key> to set it.")
    
    # Debugging: Print partial key to verify correctness
    print(f"Using API Key: {api_key[:8]}...{api_key[-4:]} (Len: {len(api_key)})")
    if api_base:
        print(f"Using API Base: {api_base}")
    if model:
        print(f"Using Model: {model}")
    
    # Build client config
    client_config = {"api_key": api_key}
    if api_base:
        client_config["base_url"] = api_base
    
    client = OpenAI(**client_config)
    
    # Store model in client for later use (we'll need to pass it to chat/embeddings calls)
    client._default_model = model  # Store as private attribute
    
    return client

def get_embedding_model(client: OpenAI) -> str:
    """Get embedding model from settings or default."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM settings WHERE key = 'openai_embedding_model'")
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return row[0]
    
    # Fallback to default
    return "text-embedding-3-small"

def get_chat_model(client: OpenAI) -> str:
    """Get chat model, preferring configured model or default."""
    if hasattr(client, '_default_model') and client._default_model:
        return client._default_model
    return "gpt-4o-mini"

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "mushin-sidecar"}

@app.post("/settings/apikey")
def set_api_key(req: ApiKeyRequest):
    try:
        # Get provider config if provider is specified
        provider_config = None
        if req.provider:
            provider_config = get_provider_config(req.provider)
        
        # Use provider config values if not explicitly provided
        api_key = req.api_key
        api_base = req.api_base if req.api_base is not None else (provider_config["api_base"] if provider_config else None)
        model = req.model if req.model is not None else (provider_config["model"] if provider_config else None)
        embedding_model = provider_config["embedding_model"] if provider_config else None
        
        # Validate key format (allow sk- for OpenAI, or any key for other providers)
        if not req.provider or req.provider == "openai":
            if not api_key.startswith("sk-"):
                raise HTTPException(status_code=400, detail="Invalid OpenAI API Key format (must start with sk-)")
        # For Gemini, keys can have different formats, so we'll be more lenient
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Always save API key
        cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('openai_api_key', ?)", (api_key,))
        
        # If provider is specified, always update all values (even if None to clear old configs)
        if req.provider:
            if api_base is not None:
                cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('openai_api_base', ?)", (api_base,))
            else:
                # Clear api_base for OpenAI (which uses default)
                cursor.execute("DELETE FROM settings WHERE key = 'openai_api_base'")
            
            if model is not None:
                cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('openai_model', ?)", (model,))
            
            if embedding_model is not None:
                cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('openai_embedding_model', ?)", (embedding_model,))
        else:
            # Backward compatibility: only update if explicitly provided
            if api_base:
                cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('openai_api_base', ?)", (api_base,))
            if model:
                cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('openai_model', ?)", (model,))
        
        conn.commit()
        conn.close()
        return {"status": "configured"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/memories")
def list_memories():
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM memories ORDER BY created_at DESC")
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/memories/{memory_id}")
def delete_memory(memory_id: str):
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.enable_load_extension(True)
        sqlite_vec.load(conn)
        conn.enable_load_extension(False)
        cursor = conn.cursor()
        
        # Get rowid first to delete from vec_memories (requires join or finding rowid by id)
        # Wait, our memories table has a TEXT PK 'id', but vec_memories uses an implicit ROWID.
        # We assumed they matched on insertion (last_row_id). 
        # To delete safely, we need to find the rowid of the memory with that UUID.
        cursor.execute("SELECT rowid FROM memories WHERE id = ?", (memory_id,))
        row = cursor.fetchone()
        
        if not row:
            conn.close()
            raise HTTPException(status_code=404, detail="Memory not found")
            
        row_id = row[0]
        
        # Delete from vec table
        cursor.execute("DELETE FROM vec_memories WHERE rowid = ?", (row_id,))
        
        # Delete from main table
        cursor.execute("DELETE FROM memories WHERE id = ?", (memory_id,))
        
        conn.commit()
        conn.close()
        return {"status": "deleted"}
    except Exception as e:
        print(f"Delete Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/memories")
def create_memory(memory: MemoryCreate, client: OpenAI = Depends(get_openai_client)):
    try:
        response = client.embeddings.create(
            input=memory.content,
            model=get_embedding_model(client)
        )
        embedding = response.data[0].embedding
        
        conn = sqlite3.connect(DB_PATH)
        conn.enable_load_extension(True)
        sqlite_vec.load(conn)
        conn.enable_load_extension(False)
        cursor = conn.cursor()
        
        memory_id = str(uuid.uuid4())
        created_at = datetime.now(timezone.utc).isoformat()
        
        cursor.execute(
            "INSERT INTO memories (id, content, created_at) VALUES (?, ?, ?)",
            (memory_id, memory.content, created_at)
        )
        
        last_row_id = cursor.lastrowid
        
        cursor.execute(
            "INSERT INTO vec_memories(rowid, embedding) VALUES (?, ?)",
            (last_row_id, serialize_float32(embedding))
        )
        
        conn.commit()
        conn.close()
        
        return {"id": memory_id, "status": "saved"}
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
def chat_endpoint(req: ChatRequest, client: OpenAI = Depends(get_openai_client)):
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.enable_load_extension(True)
        sqlite_vec.load(conn)
        conn.enable_load_extension(False)
        cursor = conn.cursor()
        
        emb_response = client.embeddings.create(
            input=req.query,
            model=get_embedding_model(client)
        )
        query_vector = emb_response.data[0].embedding
        
        cursor.execute("""
            SELECT 
                m.content, 
                m.created_at,
                distance
            FROM vec_memories v
            LEFT JOIN memories m ON m.rowid = v.rowid
            WHERE embedding MATCH ?
            AND k = 5
            ORDER BY distance
        """, (serialize_float32(query_vector),))
        
        results = cursor.fetchall()
        
        context_text = ""
        if results:
            context_text = "\n\n".join([
                f"[Date: {row[1]}] {row[0]}" for row in results
            ])
        else:
            context_text = "No relevant memories found."
            
        system_prompt = f"""You are a helpful memory assistant. 
        Answer the user question based STRICTLY on the following context.
        If the answer is not in the context, say "I don't recall that."
        
        Context:
        {context_text}
        """
        
        chat_completion = client.chat.completions.create(
            model=get_chat_model(client),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": req.query}
            ]
        )
        
        answer = chat_completion.choices[0].message.content
        return {"answer": answer, "context_used": len(results)}
        
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
