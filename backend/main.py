from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

import chromadb
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger("hymn_app")
if not logger.handlers:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

try:
    from google import genai as google_genai
except ImportError:  # pragma: no cover
    google_genai = None

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover
    OpenAI = None

from scripts.build_vector_db import (
    COLLECTION_NAME,
    PROJECT_ROOT,
    VECTOR_DB_PATH,
    build_document_text,
    embed_texts,
    resolve_api_key,
)

SYSTEM_PROMPT = """你是一位溫暖、共情且關懷的詩歌助理。
請以牧者般的語氣與同理心回應使用者，並以適當的安慰、鼓勵與陪伴感來與人對話。

重要限制：
1. 你必須嚴格依據下方檢索出的詩歌內容回應，不得杜撰詩歌內容或題目。
2. 若檢索結果與使用者需求不完全匹配，請誠實說明，並優先提供最接近的詩歌與安慰內容。
3. 回應時請自然地引用詩歌名稱與簡短內容，並鼓勵對方在需要時反覆閱讀詩歌。
4. 你的語氣要柔和、安定、帶有盼望與信心的關懷。
"""

app = FastAPI(title="Hymn RAG Assistant API", version="1.0.0")

from fastapi.staticfiles import StaticFiles

# 掛載靜態資料夾以供應 PDF 等原始檔案給前端 WebView 檢視
app.mount("/data", StaticFiles(directory=str(PROJECT_ROOT / "data")), name="data")



class ChatMessage(BaseModel):
    role: str = Field(..., min_length=1)
    content: str = Field(..., min_length=1)


class ChatCompletionRequest(BaseModel):
    query: str = Field(..., min_length=1, description="User question or request")
    history: list[ChatMessage] = Field(default_factory=list)


class RecommendationItem(BaseModel):
    id: str
    title: str
    category: str
    distance: float | None = None
    snippet: str = ""


class ChatCompletionResponse(BaseModel):
    answer: str
    query: str
    recommendations: list[RecommendationItem]


def _get_collection() -> chromadb.Collection:
    client = chromadb.PersistentClient(path=str(VECTOR_DB_PATH))
    return client.get_collection(name=COLLECTION_NAME)


def retrieve_hymns(query: str, top_k: int = 3) -> list[dict[str, Any]]:
    if not query or not query.strip():
        raise ValueError("Query text cannot be empty.")

    collection = _get_collection()
    query_embedding = embed_texts([query.strip()])[0]
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
        hits.append(
            {
                "id": str(hymn_id),
                "title": str(meta.get("title", "")),
                "category": str(meta.get("category", "")),
                "distance": distances[idx] if idx < len(distances) else None,
                "snippet": docs[idx][:500] if idx < len(docs) else "",
            }
        )

    return hits


def _fallback_answer(query: str, retrieved: list[dict[str, Any]]) -> str:
    if not retrieved:
        return (
            "我目前沒有找到與這個需求最貼近的詩歌。若你願意，請告訴我你的情緒或需要的主題，"
            "例如安慰、平安、信心、感恩、或在試煉中的盼望，我可以再幫你找更合適的詩歌。"
        )

    parts = []
    for item in retrieved:
        title = item.get("title") or "詩歌"
        snippet = item.get("snippet") or ""
        short_snippet = snippet.replace("\n", " ")[:180]
        parts.append(f"- {title}: {short_snippet}")

    return (
        f"根據你目前的需求『{query}』，我推薦你先看看這幾首詩歌：\n"
        + "\n".join(parts)
        + "\n\n這些詩歌的主題都與安慰、平安與依靠相近，請先靜心讀一遍，讓神的話安住你心。"
    )


def build_context_prompt(query: str, retrieved: list[dict[str, Any]]) -> str:
    if not retrieved:
        return f"使用者提問：{query}\n\n檢索結果：無相關詩歌。"

    context_lines: list[str] = []
    for item in retrieved:
        title = item.get("title") or "詩歌"
        category = item.get("category") or ""
        snippet = item.get("snippet") or ""
        snippet = " ".join(snippet.split())
        context_lines.append(
            f"- 詩歌編號: {item.get('id')}, 標題: {title}, 分類: {category}\n內容摘要: {snippet[:600]}"
        )

    return (
        f"使用者提問：{query}\n\n檢索到的相關詩歌資料：\n"
        + "\n\n".join(context_lines)
    )


def generate_answer(query: str, retrieved: list[dict[str, Any]]) -> str:
    if not retrieved:
        return _fallback_answer(query, retrieved)

    api_key = resolve_api_key("GEMINI_API_KEY", "GOOGLE_API_KEY")
    context_prompt = build_context_prompt(query, retrieved)
    full_prompt = f"{SYSTEM_PROMPT}\n\n{context_prompt}\n\n請根據以上內容，回覆使用者的心情與需求，並給出一段充滿安慰與信心的回應。"

    if api_key and google_genai is not None:
        try:
            client = google_genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model="gemini-3.6-flash",
                contents=full_prompt,
            )
            text = getattr(response, "text", None)
            if isinstance(text, str) and text.strip():
                return text.strip()
            if hasattr(response, "candidates") and response.candidates:
                candidate = response.candidates[0]
                if hasattr(candidate, "content"):
                    parts = getattr(candidate.content, "parts", [])
                    if parts:
                        joined = "".join(getattr(part, "text", "") for part in parts if getattr(part, "text", None))
                        if joined.strip():
                            return joined.strip()
        except Exception as e:
            logger.warning(f"Google GenAI 生成內容時發生錯誤: {e}", exc_info=True)

    api_key_openai = resolve_api_key("OPENAI_API_KEY")
    if api_key_openai and OpenAI is not None:
        try:
            client = OpenAI(api_key=api_key_openai)
            response = client.responses.create(
                model="gpt-4o-mini",
                input=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": full_prompt},
                ],
            )
            output_text = ""
            if hasattr(response, "output_text") and response.output_text:
                output_text = response.output_text
            elif hasattr(response, "output"):
                for item in response.output:
                    if hasattr(item, "content"):
                        for part in item.content:
                            if hasattr(part, "text"):
                                output_text += str(part.text)
            if output_text.strip():
                return output_text.strip()
        except Exception as e:
            logger.warning(f"OpenAI 生成內容時發生錯誤: {e}", exc_info=True)

    return _fallback_answer(query, retrieved)


@app.post("/api/v1/chat/completions", response_model=ChatCompletionResponse)
def chat_completions(payload: ChatCompletionRequest) -> ChatCompletionResponse:
    query = payload.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    try:
        retrieved = retrieve_hymns(query, top_k=3)
        answer = generate_answer(query, retrieved)
    except Exception as exc:
        logger.exception("Chat completion failed for query: %s", query)
        raise HTTPException(status_code=500, detail=f"Chat completion failed: {exc}") from exc

    recommendations = [
        RecommendationItem(
            id=item.get("id", ""),
            title=item.get("title", ""),
            category=item.get("category", ""),
            distance=item.get("distance"),
            snippet=item.get("snippet", ""),
        )
        for item in retrieved
    ]

    return ChatCompletionResponse(
        answer=answer,
        query=query,
        recommendations=recommendations,
    )


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
