# jasper-frontend

**Owner:** Reyta | Next.js 14 + TypeScript + React-Leaflet + Convex Client

## Setup

```bash
npm install
npm run dev
```

Dev server: `http://localhost:3000`

## First-time setup (if starting from scratch)

```bash
npx create-next-app@14 . --typescript --tailwind --app --no-src-dir
npm install react-leaflet leaflet @types/leaflet convex
npm install -D jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom @types/jest
```

## Convex import path

```typescript
import { api } from "../../convex/_generated/api";
```

The `convex/` folder is at the **repo root** (not inside jasper-db).

## Deployment: Vercel

Auto-deploys to staging on merge to `develop`.
Production deploy is manual — Edwin triggers via GitHub Actions.
