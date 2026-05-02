# Clash Royale Deck Analytics (Frontend + Backend)

Public project for Clash Royale deck building, deck analytics, and matchup simulation.

## Repo structure

- `index.html`, `style.css`, `script.js` -> frontend (static)
- `config.js` -> frontend runtime API URL (safe to edit)
- `backend/` -> ASP.NET Core API (`net8.0`)

## Security setup (important)

- API token is **not stored in Git**.
- Backend reads token from **User Secrets** or environment variables.
- `appsettings.json` in backend keeps a placeholder token only.

## Local run

### 1) Backend

```powershell
cd backend
dotnet user-secrets set "ClashRoyaleApi:ApiToken" "YOUR_TOKEN_HERE"
dotnet run
```

### 2) Frontend

Edit `config.js` if needed:

```js
window.__CR_API_BASE__ = "http://127.0.0.1:7295";
```

Then run static frontend (for example):

```powershell
node local-server.js
```

Open: `http://127.0.0.1:5500`

## Deploy notes

- Frontend can be deployed to Vercel (static).
- Backend should be deployed separately (Render/Railway/Azure/Fly/etc).
- After backend deploy, update `config.js` with your backend URL.
- In backend `appsettings.json`, set `Security:AllowedOrigins` to your frontend domains.

## Never commit

- API tokens
- `.env` files with secrets
- user-secrets files
- `backend/bin`, `backend/obj`, `.vs`

