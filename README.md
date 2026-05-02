# Clash Royale Deck Analytics

Public Clash Royale deck builder + analytics web app.

## Project Structure

- `index.html`, `style.css`, `script.js` -> frontend (static app)
- `config.js` -> frontend runtime API base URL
- `backend/` -> ASP.NET Core API (`net8.0`)
- `vercel.json` -> frontend hosting config for Vercel

## Security (Important)

- API token is **never stored in repo**.
- Backend token comes from User Secrets (local) or environment variables (deployed).
- `backend/appsettings.json` contains only placeholder token.

## Local Development

### Backend

```powershell
cd backend
dotnet user-secrets set "ClashRoyaleApi:ApiToken" "YOUR_TOKEN_HERE"
dotnet run
```

### Frontend

`config.js` local default:

```js
window.__CR_API_BASE__ = "http://127.0.0.1:7295";
```

Run:

```powershell
node local-server.js
```

Open: `http://127.0.0.1:5500`

## Public Deployment (Recommended)

### 1) Deploy Backend

Deploy `backend/` to Render/Railway/Azure/Fly.

Set environment variables:

- `ClashRoyaleApi__BaseUrl=https://api.clashroyale.com/v1/`
- `ClashRoyaleApi__ApiToken=<YOUR_TOKEN>`

Update `backend/appsettings.json` `Security:AllowedOrigins` with your frontend domain(s), for example:

- `https://your-app.vercel.app`
- `https://your-custom-domain.com`

### 2) Deploy Frontend on Vercel

Before deploying, set frontend API target:

1. Copy `config.production.template.js` to `config.js`
2. Set backend URL:

```js
window.__CR_API_BASE__ = "https://your-backend-domain.example.com";
```

Then deploy the repo root to Vercel.

## GitHub Safety Checklist

- No JWT/API token committed
- `.gitignore` includes frontend env files and backend build outputs
- No `bin/`, `obj/`, `.vs/`, `.user` files tracked

## Never Commit

- API tokens / JWTs
- `.env` with secrets
- user secrets
- build outputs (`backend/bin`, `backend/obj`)
