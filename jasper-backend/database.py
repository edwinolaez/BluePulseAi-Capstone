import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(".env.local")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

def get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise Exception("Supabase credentials not found in .env.local")
    return create_client(SUPABASE_URL, SUPABASE_KEY)