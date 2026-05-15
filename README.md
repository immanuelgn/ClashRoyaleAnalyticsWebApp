# RoyalePro

RoyalePro is a Clash Royale deck analysis app I built to answer one practical question:

**"If I run this deck in ladder right now, what should I expect and what should I change first?"**

Live app: https://royalepro.vercel.app

## What it does

- Build a deck with current Evo / Hero / Champion slot rules.
- Run analysis for archetype fit, role balance, matchup risk, and tower troop synergy.
- Simulate performance against common meta-style presets.
- Generate ML-assisted swap suggestions with predicted win-rate impact.
- Capture real match feedback (`I Won` / `I Lost`) to improve future model training.

## Why this project is interesting

This is not just a UI project. It is a full decision system with multiple services:

- A frontend optimized for quick iteration while deck testing.
- A deterministic analysis layer for explainable scoring.
- A separate ML service for prediction and recommendation.
- A Postgres feedback pipeline for continuous improvement.

The hard part is balancing **explainability** and **predictive quality** without making the output feel like a black box.

## Architecture

- Frontend: HTML, CSS, JavaScript
- API layer: Node.js serverless routes
- Rules/analytics backend: ASP.NET Core (C#)
- ML service: FastAPI + scikit-learn (Python)
- Data store: PostgreSQL (Supabase)

## ML loop (how learning happens)

1. User analyzes a deck.
2. ML service returns predicted win rate + suggestions.
3. User submits match outcome (`I Won` / `I Lost`) with optional context (crowns, opponent archetype, trophies).
4. Feedback is stored in Postgres.
5. Training job uses synthetic + meta-prior + real feedback data to improve the model.

## Engineering focus areas

- Input validation and schema constraints for cleaner training data.
- Meta-aware feature engineering (deck similarity to known strong lists).
- Defensive fallbacks when ML service is unavailable.
- Practical observability via learning status metrics and recent event history.

## Security and operational notes

- No API secrets are committed to the repository.
- Runtime secrets are injected via environment variables.
- Database access is isolated behind backend services.
- Service endpoints are designed to fail safely when dependencies are offline.
