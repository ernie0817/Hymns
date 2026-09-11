# Hymn RAG Backend

This module provides the FastAPI backend for the hymn assistant.

## Features

- `POST /api/v1/chat/completions`
- ChromaDB-based retrieval for top-3 relevant hymns
- Warm, compassionate response style
- Pydantic request/response models
- Fallback response when LLM generation is unavailable

## Setup

From the project root:

```bash
cd /Users/ernie/WorkSpace/side-project/Hymns
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

Make sure your Gemini or OpenAI API key is available to the runtime, for example in `Hymns/.env`:

```env
GEMINI_API_KEY=your_key_here
```

## Run locally

```bash
cd /Users/ernie/WorkSpace/side-project/Hymns
source .venv/bin/activate
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

## Example request

```bash
curl -X POST http://localhost:8000/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "query": "最近覺得心裡很焦慮，有什麼詩歌可以帶來平安？",
    "history": []
  }'
```

## Test

```bash
cd /Users/ernie/WorkSpace/side-project/Hymns
source .venv/bin/activate
python -m pytest backend/test_main.py -q
```
