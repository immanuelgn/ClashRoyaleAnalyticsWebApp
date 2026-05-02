# Backend (ClashRoyaleMetaAnalytics)

## Token configuration (safe)

This API expects:

- `ClashRoyaleApi:BaseUrl`
- `ClashRoyaleApi:ApiToken`

Do **not** place real token in `appsettings.json`.

Use User Secrets locally:

```powershell
dotnet user-secrets set "ClashRoyaleApi:ApiToken" "YOUR_TOKEN_HERE"
```

## Run

```powershell
dotnet run
```

Default local URL is typically shown in terminal/VS output.

## CORS

Update `Security:AllowedOrigins` in `appsettings.json` to include:

- local frontend origin (`http://127.0.0.1:5500`)
- deployed frontend origin (for example your Vercel domain)

