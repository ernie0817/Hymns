#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""Build a Chroma vector database for hymn lyrics using OpenAI or Gemini embeddings.

Usage:
    export GEMINI_API_KEY=your_key_here
    python scripts/build_vector_db.py --rebuild
    python scripts/build_vector_db.py --query "安慰與平安"
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Iterable, List

from openai import OpenAI
import chromadb

try:
    from google import genai as google_genai
except ImportError:  # pragma: no cover
    google_genai = None

try:
    import google.generativeai as legacy_genai
except ImportError:  # pragma: no cover
    legacy_genai = None

PROJECT_ROOT = Path(__file__).resolve().parents[1]


def load_dotenv_file() -> dict[str, str]:
    """Load key/value pairs from a local .env file when present."""
    values: dict[str, str] = {}
    dotenv_paths = [
        PROJECT_ROOT / ".env",
        PROJECT_ROOT.parent / ".env",
        Path.cwd() / ".env",
    ]
    seen: set[Path] = set()

    for dotenv_path in dotenv_paths:
        if dotenv_path in seen:
            continue
        seen.add(dotenv_path)
        if not dotenv_path.exists():
            continue
        for raw_line in dotenv_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = [part.strip() for part in line.split("=", 1)]
            if key:
                values[key] = value.strip().strip('"').strip("'")

    for key, value in values.items():
        os.environ.setdefault(key, value)

    return values


def resolve_api_key(*names: str) -> str | None:
    """Return the first available API key from environment or a .env file."""
    load_dotenv_file()
    for name in names:
        value = os.getenv(name)
        if value and value.strip():
            return value.strip()
    return None


DATA_DIR = PROJECT_ROOT / "data"
PROCESSED_PATH = DATA_DIR / "processed" / "hymns.json"
VECTOR_DB_PATH = DATA_DIR / "vector_db"
COLLECTION_NAME = "hymns"
EMBEDDING_MODEL = "text-embedding-3-small"


def load_hymns(json_path: Path) -> List[dict[str, Any]]:
    if not json_path.exists():
        raise FileNotFoundError(f"Hymn JSON file not found: {json_path}")

    with json_path.open("r", encoding="utf-8") as fp:
        payload = json.load(fp)

    items = payload.get("items", [])
    if not isinstance(items, list):
        raise ValueError(f"Invalid schema in {json_path}: expected 'items' to be a list.")

    return items


def build_document_text(hymn: dict[str, Any]) -> str:
    title = (hymn.get("title") or "").strip()
    category = (hymn.get("category") or "").strip()
    lyrics = (hymn.get("lyrics") or "").strip()

    return f"標題：{title}\n分類：{category}\n歌詞：\n{lyrics}".strip()


def get_openai_client() -> OpenAI:
    api_key = resolve_api_key("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "OPENAI_API_KEY is not set. Export it before running this script or add it to .env:\n"
            "  OPENAI_API_KEY=your_key_here"
        )
    return OpenAI(api_key=api_key)


def get_provider() -> str:
    if resolve_api_key("OPENAI_API_KEY"):
        return "openai"
    if resolve_api_key("GEMINI_API_KEY", "GOOGLE_API_KEY"):
        return "gemini"
    raise RuntimeError(
        "No API key found. Set OPENAI_API_KEY or GEMINI_API_KEY/GOOGLE_API_KEY in your environment or .env."
    )


def get_embedding_client() -> Any:
    provider = get_provider()
    if provider == "openai":
        return get_openai_client()

    if google_genai is not None:
        api_key = resolve_api_key("GEMINI_API_KEY", "GOOGLE_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY or GOOGLE_API_KEY must be set for Gemini embeddings.")
        return google_genai.Client(api_key=api_key)

    if legacy_genai is None:
        raise RuntimeError("google-genai is not installed. Install it with: pip install google-genai")

    api_key = resolve_api_key("GEMINI_API_KEY", "GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY or GOOGLE_API_KEY must be set for Gemini embeddings.")
    legacy_genai.configure(api_key=api_key)
    return legacy_genai


def embed_texts(texts: Iterable[str], batch_size: int = 16) -> list[list[float]]:
    provider = get_provider()
    if provider == "openai":
        client = get_openai_client()
        return _embed_texts_openai(client, texts, batch_size=batch_size)
    return _embed_texts_gemini(texts, batch_size=batch_size)


def _embed_texts_openai(client: OpenAI, texts: Iterable[str], batch_size: int = 32) -> list[list[float]]:
    vectors: list[list[float]] = []
    batch: list[str] = []

    for text in texts:
        batch.append(text)
        if len(batch) >= batch_size:
            response = client.embeddings.create(model=EMBEDDING_MODEL, input=batch)
            vectors.extend([item.embedding for item in response.data])
            batch = []

    if batch:
        response = client.embeddings.create(model=EMBEDDING_MODEL, input=batch)
        vectors.extend([item.embedding for item in response.data])

    return vectors


def _embed_texts_gemini(texts: Iterable[str], batch_size: int = 16) -> list[list[float]]:
    if google_genai is not None:
        api_key = resolve_api_key("GEMINI_API_KEY", "GOOGLE_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY or GOOGLE_API_KEY must be set for Gemini embeddings.")
        client = google_genai.Client(api_key=api_key)

        vectors: list[list[float]] = []
        batch: list[str] = []

        for text in texts:
            batch.append(text)
            if len(batch) >= batch_size:
                response = client.models.embed_content(
                    model="gemini-embedding-001",
                    contents=batch,
                    config={"task_type": "RETRIEVAL_DOCUMENT"},
                )
                embeddings = getattr(response, "embeddings", None)
                if embeddings is None:
                    raise RuntimeError(f"Unexpected Gemini embed response: {response!r}")
                vectors.extend([item.values for item in embeddings])
                batch = []

        if batch:
            response = client.models.embed_content(
                model="gemini-embedding-001",
                contents=batch,
                config={"task_type": "RETRIEVAL_DOCUMENT"},
            )
            embeddings = getattr(response, "embeddings", None)
            if embeddings is None:
                raise RuntimeError(f"Unexpected Gemini embed response: {response!r}")
            vectors.extend([item.values for item in embeddings])

        return vectors

    if legacy_genai is None:
        raise RuntimeError("google-genai is not installed. Install it with: pip install google-genai")

    api_key = resolve_api_key("GEMINI_API_KEY", "GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY or GOOGLE_API_KEY must be set for Gemini embeddings.")
    legacy_genai.configure(api_key=api_key)
    vectors: list[list[float]] = []
    batch: list[str] = []

    for text in texts:
        batch.append(text)
        if len(batch) >= batch_size:
            response = legacy_genai.embed_content(
                model="models/text-embedding-004",
                content=batch,
                task_type="retrieval_document",
            )
            payload = response.get("embedding") if isinstance(response, dict) else None
            if payload is None:
                raise RuntimeError(f"Unexpected Gemini embed response: {response!r}")
            if isinstance(payload[0], list):
                vectors.extend(payload)
            else:
                vectors.extend([payload])
            batch = []

    if batch:
        response = legacy_genai.embed_content(
            model="models/text-embedding-004",
            content=batch,
            task_type="retrieval_document",
        )
        payload = response.get("embedding") if isinstance(response, dict) else None
        if payload is None:
            raise RuntimeError(f"Unexpected Gemini embed response: {response!r}")
        if isinstance(payload[0], list):
            vectors.extend(payload)
        else:
            vectors.extend([payload])

    return vectors


def build_vector_db(rebuild: bool = False) -> chromadb.Collection:
    VECTOR_DB_PATH.mkdir(parents=True, exist_ok=True)

    client = chromadb.PersistentClient(path=str(VECTOR_DB_PATH))
    try:
        existing = client.get_collection(name=COLLECTION_NAME)
    except Exception:
        existing = None

    if rebuild and existing is not None:
        client.delete_collection(name=COLLECTION_NAME)
        existing = None

    collection = client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"description": "Hymn embedding store"},
    )

    hymns = load_hymns(PROCESSED_PATH)
    if not hymns:
        raise ValueError(f"No hymn records found in {PROCESSED_PATH}")

    documents = [build_document_text(h) for h in hymns]
    ids = [str(h.get("id", "")) for h in hymns]
    metadatas = [{
        "id": str(h.get("id", "")),
        "title": str(h.get("title", "")),
        "category": str(h.get("category", "")),
    } for h in hymns]

    # Skip duplicates if collection already contains some items during rebuilds.
    if existing is not None and existing.count() > 0 and not rebuild:
        return existing

    embeddings = embed_texts(documents)

    if len(embeddings) != len(documents):
        raise RuntimeError(
            f"Embedding count mismatch: {len(embeddings)} != {len(documents)}"
        )

    collection.add(
        ids=ids,
        documents=documents,
        embeddings=embeddings,
        metadatas=metadatas,
    )
    return collection


def query_collection(collection: chromadb.Collection, query: str, top_k: int = 3) -> list[dict[str, Any]]:
    if not query or not query.strip():
        raise ValueError("Query text must not be empty.")

    query_embedding = embed_texts([query])[0]
    result = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        include=["documents", "metadatas", "distances"],
    )

    hits: list[dict[str, Any]] = []
    ids = result.get("ids", [[]])[0]
    docs = result.get("documents", [[]])[0]
    metas = result.get("metadatas", [[]])[0]
    distances = result.get("distances", [[]])[0]

    for idx, hymn_id in enumerate(ids):
        meta = metas[idx] if idx < len(metas) else {}
        hits.append({
            "id": hymn_id,
            "title": meta.get("title", ""),
            "category": meta.get("category", ""),
            "distance": distances[idx] if idx < len(distances) else None,
            "snippet": docs[idx][:220] if idx < len(docs) else "",
        })

    return hits


def validate_semantic_query(collection: chromadb.Collection, query: str = "安慰與平安", top_k: int = 3) -> list[dict[str, Any]]:
    hits = query_collection(collection, query, top_k=top_k)
    if len(hits) != top_k:
        raise AssertionError(f"Expected {top_k} results, got {len(hits)} for query: {query!r}")

    keywords = ["安慰", "平安", "安息", "依靠", "平穩", "心安"]
    matched = 0
    for hit in hits:
        text = f"{hit['title']} {hit['snippet']}".lower()
        if any(keyword in text for keyword in keywords):
            matched += 1

    if matched < 1:
        raise AssertionError(
            f"Semantic query {query!r} did not return relevant hymn results. "
            f"Top hits: {hits}"
        )

    return hits


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build a Chroma vector database for hymns.")
    parser.add_argument("--rebuild", action="store_true", help="Delete and rebuild the vector collection.")
    parser.add_argument("--query", type=str, default="安慰與平安", help="Sample semantic query to validate retrieval.")
    parser.add_argument("--top-k", type=int, default=3, help="Number of results to return during validation.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        collection = build_vector_db(rebuild=args.rebuild)
        print(f"Vector DB built successfully at: {VECTOR_DB_PATH}")
        print(f"Collection: {COLLECTION_NAME}, total items: {collection.count()}")

        hits = validate_semantic_query(collection, query=args.query, top_k=args.top_k)
        print("\nTop-Similarity Results:")
        for idx, hit in enumerate(hits, start=1):
            print(f"{idx}. [{hit['id']}] {hit['title']} | {hit['category']} | distance={hit['distance']}")
            print(f"   {hit['snippet'][:180]}")

        return 0
    except Exception as exc:  # pragma: no cover - CLI safety
        print(f"Error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
