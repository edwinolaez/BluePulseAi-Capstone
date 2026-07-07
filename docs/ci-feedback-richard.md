# CI Feedback — Richard (jasper-ml)

**From:** Edwin (QA)
**Last updated:** July 7, 2026 — post Sprint 2 merge CI run on `main`
**Branch reviewed:** `feature/richard-ml` → merged into `main`

---

## July 7 CI Run — Stage 4 Results

Two failure patterns from the live CI run:

**1. 502 Bad Gateway — ML integration tests**
All direct calls to `ML_API_URL` are returning `502 Application failed to respond`:
- `POST /predict/change-detection` → 502
- `POST /simulate/erosion` → 502
- `POST /simulate/contaminant` → 502

502 means Railway is up but the app inside the container is crashing. Check your Railway deployment logs — look for a startup error (missing env var, import error, model file not found, port mismatch).

**2. 404 — Contract tests**
The contract tests hitting the same endpoints through the base URL are getting 404. This may be a route path issue or the service isn't fully started.

**Immediate action:**
1. Go to railway.app → your ML service → **Deployments** tab
2. Click the latest deployment → view logs
3. Find the crash/error and fix it
4. Once the `/health` endpoint returns 200, ping Edwin — he'll re-run CI

---

---

## Summary

Your code is done — all three ML endpoints are correct and the response shapes
match the test contract exactly. The only reason CI still can't reach your service
is that your ML API runs on a **separate Railway deployment** from Feven's backend,
and that URL hasn't been added to CI yet.

This is a 10-minute fix that only needs one thing from you: your Railway service URL.

---

## What's Already Done ✓

- `POST /predict/change-detection` — correct path, correct response shape ✓
- `POST /simulate/erosion` — correct path, correct response shape ✓
- `POST /simulate/contaminant` — correct path, correct response shape ✓
- All Pydantic request/response models match the test contract ✓
- Production hardening, CORS, logging, and Docker config in place ✓

---

## The One Remaining Step — Share Your Railway URL

CI uses an environment variable called `ML_API_URL` to reach your service.
Right now that variable is not set, so all ML tests are being skipped in CI.

Follow these steps to find your Railway URL and send it to Edwin.

---

### Step 1 — Log in to Railway

Go to **railway.app** and log in with your account.

---

### Step 2 — Open Your ML Project

On the Railway dashboard, look for your Project Jasper ML service.
It will likely be named something like `jasper-ml` or `bluepulseai-ml`.

Click on it to open the project.

---

### Step 3 — Find the Deployment URL

Inside the project, click on your service (the box showing your deployment).
Then look for one of these:

- A **"Settings"** tab → scroll down to **"Domains"** — your public URL is listed there.
- Or a **"Deploy"** tab → the URL is shown at the top of the latest deployment.

The URL will look something like:

```
https://jasper-ml-production.up.railway.app
```

or

```
https://bluepulseai-ml-production.up.railway.app
```

---

### Step 4 — Verify It's Live

Before sending the URL, do a quick sanity check. Open a new browser tab and go to:

```
https://<your-url>/health
```

You should see a response like:

```json
{"status": "ok", "models": {...}}
```

If you get an error or the page doesn't load, your Railway deployment may not be
running. In that case, go to the **"Deployments"** tab in Railway and check that
the latest deploy shows a green "Success" status. If it's red, redeploy from the
Railway dashboard.

---

### Step 5 — Send the URL to Edwin

Send Edwin the full URL (including `https://`). He will add it to GitHub Secrets
as `ML_API_URL` and wire it into the CI pipeline. Once that's done, the next CI
run will be able to reach your endpoints and run all the ML tests.

---

## What Edwin Will Do With It

Edwin will add `ML_API_URL` to GitHub Secrets and add one line to `ci.yml`:

```yaml
ML_API_URL: ${{ secrets.ML_API_URL }}
```

That's all that's needed on the CI side. Your code doesn't need any changes.

---

## If You Haven't Deployed to Railway Yet

If your ML service isn't deployed to Railway yet, here's the quick path:

1. Go to **railway.app** → New Project → Deploy from GitHub repo.
2. Select the `BluePulseAi-Capstone` repo.
3. Set the **Root Directory** to `jasper-ml`.
4. Railway will detect your `Dockerfile` automatically and build it.
5. Your service runs on **port 8001** — set that in Railway under
   Settings → Networking → **Public Networking** → expose port `8001`.
6. Railway will generate a public URL. That's the one to send Edwin.

Your `Dockerfile` is already production-ready — no changes needed.
