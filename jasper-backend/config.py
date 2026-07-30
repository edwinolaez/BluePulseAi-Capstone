"""
Project Jasper — Centralised Application Configuration
Owner: Edwin | PM & QA/Security Engineer

This file is the single place where all application secrets and settings are
read from the environment. Nothing sensitive is hardcoded here — values come
from environment variables set in Railway (production) or a local .env.local
file (development). Any file in the project that needs a secret imports it
from here rather than calling os.getenv() directly, so there is only one place
to change if a variable name ever shifts.

How to use locally:
  1. Copy .env.example to .env.local
  2. Fill in real values for JASPER_API_KEY, SUPABASE_URL, etc.
  3. Run: uvicorn main:app --reload
     (database.py will load .env.local automatically via python-dotenv)
"""

import os

# ---------------------------------------------------------------------------
# API Authentication
# ---------------------------------------------------------------------------

# The shared API key that every protected endpoint checks via the X-API-Key
# request header. Set JASPER_API_KEY in Railway / Vercel — never hardcode a
# real value here. The fallback "jasper-dev-api-key-2026" is for local dev only.
API_KEY: str = os.getenv("JASPER_API_KEY", "jasper-dev-api-key-2026")

# ---------------------------------------------------------------------------
# Supabase Database (managed by Rahil)
# ---------------------------------------------------------------------------

# The HTTPS URL for our Supabase project — looks like
# https://<project-id>.supabase.co — set by Rahil in the Railway dashboard.
SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")

# The anon (public) key for Supabase — safe to use in client-side code but
# restricted by Row Level Security policies set up by Rahil.
SUPABASE_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")

# ---------------------------------------------------------------------------
# JWT Token Signing
# ---------------------------------------------------------------------------

# The secret used to sign and verify HMAC tokens in auth.py.
# In production this must be a long random string — the fallback below is
# only acceptable for local development.
JWT_SECRET: str = os.getenv("JWT_SECRET", "dev-jwt-secret-change-in-prod")
