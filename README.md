# ClashRoyaleAnalyticsWebApp

Production-oriented Clash Royale deck intelligence platform focused on Evo/Hero/Champion deck construction, matchup quality, and upgrade recommendations.

Live app: https://clashroyaleanalyticswebapp.vercel.app

## What I Built

- Real-time deck builder with game-accurate slot constraints:
  - Evo slot
  - Wild slot (Evo/Hero/Champion)
  - Hero/Champion slot
- Card-aware analysis engine:
  - archetype detection
  - win-condition clarity
  - subscore breakdown (offense/defense/spells/cycle/consistency)
  - matchup simulation against meta-style decks
- Tower troop optimizer with blended structural + ML ranking logic.
- ML recommendation pipeline (Python):
  - win-rate forecast
  - constrained one-card upgrade suggestions
  - feedback ingestion endpoint for future retraining

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- API layer: Node.js serverless functions (Vercel)
- Analytics engine source: ASP.NET Core (C#)
- ML service: FastAPI + scikit-learn (Python)
- ML data store: PostgreSQL

## Security Notes

- No Clash Royale API token is committed.
- Secrets are loaded from environment variables only.
- CORS allowlist is enforced in backend config.
