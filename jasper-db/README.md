# jasper-db

**Owner:** Rahil | Supabase + PostGIS + Convex

## Supabase Setup

```bash
npm install -g supabase
supabase login
cd jasper-db/
supabase init
supabase link --project-ref YOUR_PROJECT_REF
```

### Enable PostGIS (run in Supabase SQL Editor)

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
SELECT PostGIS_Version();
```

## Convex Setup

Convex lives at the **repo root** (`/convex/`), not inside this folder.

```bash
# From repo root:
npx convex dev
```

Leave the terminal running — it watches schema changes and auto-generates types.

## RBAC roles

`admin` | `analyst` | `ingest` | `viewer`

See `/docs/api-contracts.md` Contract 6 for full permissions matrix.

## Python test env

```bash
python3 -m venv db-env
source db-env/bin/activate
pip install pytest supabase python-dotenv
pip freeze > requirements.txt
```
