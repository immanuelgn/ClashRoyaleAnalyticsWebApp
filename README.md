# Clash Royale Analytics Web App

Interactive deck analytics platform for Clash Royale with Evo/Hero/Champion-aware deck building, matchup scoring, and ML-assisted card swap suggestions.

Live: https://clashroyaleanalyticswebapp.vercel.app

## Highlights

- Drag-and-drop deck builder with current slot rules:
  - Evo slot
  - Wild slot (Evo/Hero/Champion)
  - Hero/Champion slot
- Card rendering pipeline for normal, Evo, Hero, and Champion variants.
- Deck analysis output:
  - archetype + confidence
  - role balance and sub-scores
  - weakness profiling
  - matchup simulation vs meta deck presets
- Tower troop optimizer integrated into analysis flow.
- ML integration (Python/FastAPI) for predicted win rate and upgrade candidates.

## Tech Stack

- Frontend: HTML, CSS, JavaScript (deployed on Vercel)
- API routes: Node.js serverless functions
- Core analytics engine: ASP.NET Core (C#)
- ML service: FastAPI + scikit-learn (Python)
- Data layer for ML experiments: PostgreSQL

## Security

- Clash Royale API token is **not** stored in this repo.
- Secrets are injected via environment variables / secret stores.
- CORS allowlist is enforced for backend endpoints.
