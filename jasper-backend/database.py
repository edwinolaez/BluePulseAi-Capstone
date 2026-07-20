"""
Project Jasper — Supabase Database Client
Owner: Feven | Data Pipeline & API Engineer

This file handles the connection to our Supabase PostgreSQL database.
Supabase is a cloud database service that Rahil set up for the project.

Why we need this file:
- Our ingest endpoints need to WRITE data to the database (storing sensor readings)
- Our layers endpoint needs to READ data from the database (returning map data)
- Instead of writing the connection code in every file, we put it here once
  and import get_supabase() wherever we need it

How the credentials work:
- We NEVER hardcode passwords or keys directly in the code
- Instead we store them in .env.local (which is never committed to GitHub)
- python-dotenv reads that file and makes the values available via os.getenv()
- On Railway (production), the values come from environment variables set in the dashboard
"""

# os lets us read environment variables like SUPABASE_URL
import os

# Path helps us find the .env.local file regardless of where uvicorn is run from
from pathlib import Path

# load_dotenv reads our .env.local file and loads all KEY=VALUE pairs
# into the environment so os.getenv() can find them
from dotenv import load_dotenv

# create_client creates a Supabase connection we can use to query the database
# Client is the type hint for that connection object
from supabase import Client, create_client

# Try to find and load .env.local from multiple possible locations
# This is needed because uvicorn might be run from different directories
# Path(__file__).parent = the folder containing this file (jasper-backend/)
# Path(__file__).parent.parent = one level up (BluePulseAi-Capstone/)
for _path in [
    Path(__file__).parent / ".env.local",        # jasper-backend/.env.local
    Path(__file__).parent.parent / ".env.local",  # project root/.env.local
    Path(".env.local")                             # current working directory
]:
    # .exists() checks if the file actually exists before trying to load it
    if _path.exists():
        load_dotenv(dotenv_path=_path)
        break  # Stop as soon as we find and load one

# Read the Supabase credentials from environment variables
# These were set either by loading .env.local above, or by Railway's environment
# os.getenv() returns None if the variable doesn't exist
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


def get_supabase() -> Client:
    """Create and return a Supabase client using environment credentials.

    This function is called every time an endpoint needs to talk to the database.
    It checks that credentials exist before trying to connect — if they're missing,
    it raises a clear error instead of a confusing connection failure.

    Returns:
        Client: A connected Supabase client ready to query the database

    Raises:
        ValueError: If SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY are not set
    """
    # Guard clause — check credentials exist before trying to connect
    # This gives a clear error message instead of a cryptic connection failure
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("Supabase credentials not found in .env.local")

    # create_client() establishes the connection to Supabase
    # After this, we can call .table("name").select().execute() etc.
    return create_client(SUPABASE_URL, SUPABASE_KEY)
