# ClashRoyaleAnalyticsWebApp

A full-stack Clash Royale analytics platform (C# backend + JavaScript frontend) with drag-and-drop deck building, Evo/Hero/Champion slot logic, matchup simulation, tower troop optimization, and deck scoring insights.

Live frontend: https://clashroyaleanalyticswebapp.vercel.app

## Security
- API token is never committed.
- Put token only in backend environment variable: `ClashRoyaleApi__ApiToken`.
- Frontend calls `/api` on Vercel, which is proxied to backend.

## Deploy Backend (Render)
1. In Render, create Blueprint from this repo (`render.yaml`).
2. Set secret env var `ClashRoyaleApi__ApiToken`.
3. Deploy and copy backend URL (example: `https://clashroyale-analytics-backend.onrender.com`).
4. In `vercel.json`, replace `https://REPLACE_WITH_BACKEND_DOMAIN` with your backend URL.
5. Redeploy Vercel.

## Clash Royale Key (important)
Clash Royale keys are IP-restricted. In the Supercell dev portal, set the key to your backend host egress IP/range. Users never need to touch the key.

## Local Dev
- Backend: `cd backend && dotnet run`
- Frontend: serve root folder (`node local-server.js` or Live Server)
