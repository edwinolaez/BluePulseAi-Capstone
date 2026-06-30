import os
from supabase import create_client, Client
from dotenv import load_dotenv
from pathlib import Path

# Try multiple locations for .env.local
for path in [
    Path(__file__).parent / ".env.local",
    Path(__file__).parent.parent / ".env.local",
    Path(".env.local")
]:
    if path.exists():
        load_dotenv(dotenv_path=path)
        break

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

def get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise Exception("Supabase credentials not found in .env.local")
    return create_client(SUPABASE_URL, SUPABASE_KEY)