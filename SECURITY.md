# Security Notes

## Secrets Handling

- Do not commit Clash Royale API tokens.
- Local development uses `dotnet user-secrets`.
- Production uses environment variables.

## Required Secret Keys

- `ClashRoyaleApi__ApiToken`
- `ClashRoyaleApi__BaseUrl` (normally `https://api.clashroyale.com/v1/`)

## CORS

`backend/appsettings.json` controls allowed frontend origins:

- `Security:AllowedOrigins`

Only include your own frontend domains.

## If a Token Is Exposed

1. Revoke token in developer.clashroyale.com immediately.
2. Generate a new token bound to correct server IP(s).
3. Update secret store / environment variables.
4. Redeploy backend.

