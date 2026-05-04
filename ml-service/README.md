# ML Service (Python)

This service provides real ML predictions for:
- `predictedWinRate`
- model confidence
- top 3 one-card upgrade suggestions

## 1) Install

```bash
cd ml-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
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

## 4) Connect backend

Set env var on your Node/Vercel API:

- `ML_SERVICE_URL=http://localhost:8001` (local)
- or your deployed Python service URL

When set, `/api/deck/synergy` will merge Python ML results into response.
