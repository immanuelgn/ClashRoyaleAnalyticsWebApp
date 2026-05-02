# ClashRoyaleAnalyticsWebApp

Clash Royale deck analytics web app with a custom drag-and-drop deck builder (Evo/Hero/Champion slot rules), tower troop selection, matchup simulation, and a secured C# backend API.

## Project Status
- Frontend: active UI/UX iteration
- Backend: C# API with deck scoring logic and Clash Royale API integration
- Deployment target: frontend on Vercel + backend on a .NET host (Render/Railway/Azure)

## Local Run
- Start backend from `backend/` (dotnet run)
- Start frontend static server (`node local-server.js` or VS Code Live Server)

## Security Notes
- API token is not committed.
- Use environment variables / user-secrets for `ClashRoyaleApi__ApiToken`.
