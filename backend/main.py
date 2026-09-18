from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

import chromadb
import time
import json
import re
import aiohttp
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

logger = logging.getLogger("hymn_app")
if not logger.handlers:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

# 為了相容新舊版 Gemini SDK
try:
    import google.generativeai as genai_legacy
except ImportError:
    genai_legacy = None

try:
    from google import genai as google_genai
except ImportError:
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

SYSTEM_PROMPT = """你是一位溫暖、共情且關懷的詩歌助理，同時也是一本活的詩歌字典。
請以牧者般的語氣與同理心回應使用者，並以適當的安慰、鼓勵與陪伴感來與人對話。

重要限制：
1. 嚴格依據下方檢索出的詩歌內容回應。
2. **混合回應機制**：
   - 如果使用者是在「詢問特定的歌詞、詩歌名稱或出處」（例如問「遇見你們是哪一首」），請直接明確且開門見山地告訴他正確的詩歌名稱、編號與分類，並簡短分享這首詩歌的意境。
   - 如果使用者是在「抒發心情或尋求安慰」，你的回應應該著重於「這首詩歌為什麼適合現在的你」，你可以引用一兩句最關鍵的歌詞來安慰對方。
3. **絕對不要在對話中把完整的歌詞或簡譜全部貼出來**，保持畫面簡潔，點到為止。
4. 若檢索結果與使用者需求不完全匹配，請誠實說明，並優先提供最接近的詩歌。
5. 語氣要柔和、安定、帶有盼望與信心的關懷，像一位有智慧的朋友。
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
    stream: bool = Field(False, description="Whether to stream the response as SSE")


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


_HYMNS_CACHE = None

def get_all_hymns():
    global _HYMNS_CACHE
    if _HYMNS_CACHE is None:
        try:
            hymns_path = PROJECT_ROOT / "data" / "processed" / "hymns.json"
            if hymns_path.exists():
                with open(hymns_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    _HYMNS_CACHE = data.get("items", [])
            else:
                _HYMNS_CACHE = []
        except Exception as e:
            logger.error(f"載入 hymns.json 失敗: {e}")
            _HYMNS_CACHE = []
    return _HYMNS_CACHE

def extract_exact_matches(query: str) -> list[dict[str, Any]]:
    """在 query 中找出可能的歌詞片段，並進行本地 JSON 的精確字串比對"""
    hymns = get_all_hymns()
    if not hymns:
        return []

    # 1. 優先擷取引號內的文字 (例如: 請問「遇見你們」是哪首)
    quotes = re.findall(r'[「『"“](.*?)[」』"”]', query)
    
    # 2. 或是將整句話以標點符號切分，取大於 4 個字的片段當作可能歌詞
    segments = re.split(r'[，。！？、,!?\s]+', query)
    
    candidates = set(quotes + [s for s in segments if len(s) >= 4])
    
    # 3. 如果沒有標點符號且沒有引號，移除常見詢問詞彙後，若長度夠也視為關鍵字
    clean_query = re.sub(r'^(那|請問|這句|歌詞|是哪首|哪一首|哪首|的詩歌|是什麼|是哪一首的歌詞呢|呢|的歌詞|是什麼)', '', query).strip()
    clean_query = re.sub(r'(的歌詞是什麼|是哪一首的歌詞呢|是哪一首|是哪首|的歌詞|是什麼|呢|嗎|？|\?)$', '', clean_query).strip()
    if len(clean_query) >= 3:
        candidates.add(clean_query)

    matches = []
    for hymn in hymns:
        title = hymn.get("title", "")
        lyrics = hymn.get("lyrics", "")
        # 如果標題或歌詞包含 candidate，就抓出來
        for cand in candidates:
            if not cand: continue
            if cand in title or cand in lyrics:
                matches.append({
                    "id": hymn.get("id"),
                    "title": title,
                    "category": hymn.get("category", ""),
                    "distance": 0.0,  # 標示為完美配對
                    "snippet": lyrics[:220]
                })
                break # 這首有對中就換下一首

    return matches


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
    
    # [新增] 執行 Hybrid Search：先抓取精確比對的詩歌
    exact_matches = extract_exact_matches(query)
    seen_ids = set()
    for match in exact_matches:
        hits.append(match)
        seen_ids.add(str(match["id"]))

    ids = result.get("ids", [[]])[0]
    docs = result.get("documents", [[]])[0]
    metas = result.get("metadatas", [[]])[0]
    distances = result.get("distances", [[]])[0]

    for idx, hymn_id in enumerate(ids):
        # 避免精確比對已經抓過同樣的詩歌
        if str(hymn_id) in seen_ids:
            continue
            
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

    # 確保最終只回傳我們需要的數量，優先保留 exact_matches
    return hits[:top_k]


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

    if api_key:
        if genai_legacy is not None:
            try:
                genai_legacy.configure(api_key=api_key)
                model = genai_legacy.GenerativeModel("gemini-3.6-flash")
                response = model.generate_content(full_prompt)
                if response.text and response.text.strip():
                    return response.text.strip()
            except Exception as e:
                logger.warning(f"Legacy Google GenAI 生成內容時發生錯誤: {e}", exc_info=True)
        
        elif google_genai is not None:
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


async def generate_answer_stream_async(query: str, retrieved: list[dict[str, Any]]):
    context_prompt = build_context_prompt(query, retrieved)
    full_prompt = f"{SYSTEM_PROMPT}\n\n{context_prompt}\n\n請根據以上內容，回覆使用者的心情與需求，並給出一段充滿安慰與信心的回應。"

    # 1. 優先檢查是否開啟 Ollama 本地模型
    use_ollama = os.getenv("USE_OLLAMA", "false").lower() == "true"
    if use_ollama:
        ollama_url = os.getenv("OLLAMA_API_URL", "http://localhost:11434/api/generate")
        ollama_model = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")
        payload = {
            "model": ollama_model,
            "prompt": full_prompt,
            "stream": True
        }
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(ollama_url, json=payload) as resp:
                    if resp.status == 200:
                        async for line in resp.content:
                            if line:
                                try:
                                    data = json.loads(line.decode('utf-8'))
                                    if "response" in data:
                                        yield data["response"]
                                except json.JSONDecodeError:
                                    pass
                        return
                    else:
                        logger.warning(f"Ollama 回傳錯誤狀態碼: {resp.status}")
        except Exception as e:
            logger.warning(f"連接 Ollama 失敗: {e}", exc_info=True)
            # 發生錯誤則退回雲端模型

    # 2. 如果沒用 Ollama 或 Ollama 失敗，則使用 Gemini
    api_key = resolve_api_key("GEMINI_API_KEY", "GOOGLE_API_KEY")
    if api_key:
        if genai_legacy is not None:
            try:
                genai_legacy.configure(api_key=api_key)
                model = genai_legacy.GenerativeModel("gemini-3.6-flash")
                # 這裡使用原生的 generate_content_async
                response = await model.generate_content_async(full_prompt, stream=True)
                async for chunk in response:
                    if chunk.text:
                        yield chunk.text
                return
            except Exception as e:
                logger.warning(f"Legacy Google GenAI 生成內容時發生錯誤: {e}", exc_info=True)
        
        elif google_genai is not None:
            try:
                client = google_genai.Client(api_key=api_key)
                # 使用 aio 非同步介面
                response = await client.aio.models.generate_content_stream(
                    model="gemini-3.6-flash",
                    contents=full_prompt,
                )
                async for chunk in response:
                    if chunk.text:
                        yield chunk.text
                return
            except Exception as e:
                logger.warning(f"Google GenAI 生成內容時發生錯誤: {e}", exc_info=True)

    api_key_openai = resolve_api_key("OPENAI_API_KEY")
    if api_key_openai and OpenAI is not None:
        try:
            # 此處若真要全非同步需改用 AsyncOpenAI，為了相容原本的寫法與環境限制，我們採用 run_in_threadpool
            client = OpenAI(api_key=api_key_openai)
            
            def openai_stream():
                return client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": full_prompt},
                    ],
                    stream=True,
                )
            
            response = await run_in_threadpool(openai_stream)
            # OpenAI stream iter is sync, so we yield inside threadpool chunk by chunk
            from starlette.concurrency import iterate_in_threadpool
            async for chunk in iterate_in_threadpool(response):
                content = chunk.choices[0].delta.content
                if content:
                    yield content
            return
        except Exception as e:
            logger.warning(f"OpenAI 生成內容時發生錯誤: {e}", exc_info=True)

    yield _fallback_answer(query, retrieved)


@app.post("/api/v1/chat/completions")
async def chat_completions(payload: ChatCompletionRequest):
    request_start = time.time()
    query = payload.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    try:
        # ChromaDB 與 Embedding 為同步阻塞操作，放進 threadpool 避免阻塞主執行緒
        retrieved = await run_in_threadpool(retrieve_hymns, query, 3)
    except Exception as exc:
        logger.exception("Retrieve failed for query: %s", query)
        raise HTTPException(status_code=500, detail=f"Retrieve failed: {exc}") from exc
        
    retrieval_time = time.time() - request_start
    logger.info(f"[Timing] 檢索耗時 (Embedding + DB): {retrieval_time:.3f}s")

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

    if payload.stream:
        async def async_event_generator():
            meta_data = {"type": "meta", "recommendations": [r.model_dump() if hasattr(r, 'model_dump') else r.dict() for r in recommendations]}
            yield f"data: {json.dumps(meta_data, ensure_ascii=False)}\n\n"
            
            try:
                first_chunk = True
                llm_start = time.time()
                async for chunk in generate_answer_stream_async(query, retrieved):
                    if first_chunk:
                        ttft = time.time() - llm_start
                        total_ttft = time.time() - request_start
                        logger.info(f"[Timing] LLM 首字元延遲: {ttft:.3f}s")
                        logger.info(f"[Timing] 總體首字元延遲 (TTFT): {total_ttft:.3f}s")
                        first_chunk = False
                    
                    chunk_data = {"type": "chunk", "text": chunk}
                    yield f"data: {json.dumps(chunk_data, ensure_ascii=False)}\n\n"
                
                logger.info(f"[Timing] LLM 總生成耗時: {time.time() - llm_start:.3f}s")
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
            except Exception as exc:
                logger.exception("Chat completion streaming failed")
                yield f"data: {json.dumps({'type': 'error', 'detail': str(exc)}, ensure_ascii=False)}\n\n"

        return StreamingResponse(async_event_generator(), media_type="text/event-stream")

    try:
        answer = await run_in_threadpool(generate_answer, query, retrieved)
    except Exception as exc:
        logger.exception("Chat completion failed for query: %s", query)
        raise HTTPException(status_code=500, detail=f"Chat completion failed: {exc}") from exc

    return ChatCompletionResponse(
        answer=answer,
        query=query,
        recommendations=recommendations,
    )


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
