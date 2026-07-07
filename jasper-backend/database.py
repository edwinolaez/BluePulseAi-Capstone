"""Supabase database client for Project Jasper backend."""
import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

# Try multiple locations for .env.local
for _path in [
    Path(__file__).parent / ".env.local",
    Path(__file__).parent.parent / ".env.local",
    Path(".env.local")
]:
    if _path.exists():
        load_dotenv(dotenv_path=_path)
        break

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


def get_supabase() -> Client:
    """Create and return a Supabase client using environment credentials."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("Supabase credentials not found in .env.local")
    return create_client(SUPABASE_URL, SUPABASE_KEY)
