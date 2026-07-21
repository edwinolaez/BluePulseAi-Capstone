"""
Centralised config — reads all secrets from environment variables.
In production (Railway) these are set in the Railway dashboard.
Locally, copy .env.example to .env.local and source it before running uvicorn.
"""

import os

# The shared API key checked on every protected endpoint.
# Set JASPER_API_KEY in Railway / Vercel env config — never hardcode here.
API_KEY: str = os.getenv("JASPER_API_KEY", "jasper-dev-api-key-2026")

# Supabase connection — set by Rahil in Railway dashboard
SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")

# JWT secret for auth token signing — must be set in production
JWT_SECRET: str = os.getenv("JWT_SECRET", "dev-jwt-secret-change-in-prod")
