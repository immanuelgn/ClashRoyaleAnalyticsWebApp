# ML Service (Python)

This service provides real ML predictions for:
- `predictedWinRate`
- model confidence
- top 3 one-card upgrade suggestions
- meta similarity signals based on seeded RoyaleAPI-style meta decks

## 1) Install

```bash
cd ml-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Required env var:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME
```

## 2) Train model

```bash
python train.py
```

This creates:
- `model.joblib`
- `model_meta.json`

## 3) Run service

```bash
uvicorn app:app --host 0.0.0.0 --port 8001
```

Health check:

```bash
GET http://localhost:8001/health
```

Predict endpoint:

```bash
POST http://localhost:8001/predict
{
  "cardIds": [26000021,26000014,26000012,26000010,26000031,28000014,28000000,27000000],
  "towerTroop": "tower_princess"
}
```

Feedback endpoint (stores real match outcomes for retraining):

```bash
POST http://localhost:8001/feedback
{
  "cardIds": [26000021,26000014,26000012,26000010,26000031,28000014,28000000,27000000],
  "towerTroop": "tower_princess",
  "won": true,
  "crownsFor": 2,
  "crownsAgainst": 1,
  "opponentArchetype": "pekka_bridge_spam",
  "gameMode": "normal_battle",
  "trophies": 7600,
  "patchVersion": "live",
  "notes": "vs golem beatdown"
}
```

## 4) Connect backend

Set env var on your Node/Vercel API:

- `ML_SERVICE_URL=http://localhost:8001` (local)
- or your deployed Python service URL

When set, `/api/deck/synergy` will merge Python ML results into response.

## Data Flow

1. Frontend requests deck analysis from Node API.
2. Node API calls `/predict` on this service.
3. Python service logs prediction to Postgres.
4. Optional `/feedback` writes real battle outcome rows.
5. `train.py` blends synthetic + meta-anchor + real feedback data for improved model quality.

## Why `I Won / I Lost` matters

- `won/lost` is your ground-truth label. It tells the model if the prediction matched reality.
- Without this label, the model only learns from heuristics.
- Better labels = better retraining quality.

Recommended feedback quality:

- Always submit `won/lost`.
- Add crowns when possible (`crownsFor`, `crownsAgainst`).
- Add optional context (`opponentArchetype`, `trophies`, `gameMode`) for better matchup realism.

## Meta Prior Data

Seed file:

- `../data/meta_decks_seed.json`

This file stores known strong meta decks with usage/win-rate/rating priors.
The model uses similarity to these decks as additional features.

To improve this prior:

1. Refresh seed rows from RoyaleAPI deck stats snapshots.
2. Keep recent windows (1d / 3d / 7d) and update ratings.
3. Re-run `python train.py` after updates.
