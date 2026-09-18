# 詩歌 App (Hymn App with RAG Agent) 軟體設計文件 (SDD)

## 1. 專案概述 (Overview)
本專案旨在開發一款跨平台詩歌 App，提供使用者基礎詩歌瀏覽、全文檢索，並整合基於 RAG (Retrieval-Augmented Generation) 技術的 AI 詩歌助理，根據使用者情境或情緒推薦合適的詩歌。

## 2. 系統架構 (System Architecture)
- **Client (Mobile):** Flutter / React Native (支援離線 SQLite 全文檢索 FTS5)
- **Backend API:** Python FastAPI (負責 RAG 流程、Prompt 組裝、LLM 串接)
- **Vector Database:** Qdrant / Chroma / Pinecone (存放詩歌向量與 Metadata)
- **Database (Relational):** SQLite (App 端離線儲存) / PostgreSQL (後端伺服器)
- **LLM Engine:** OpenAI API (gpt-4o-mini) / Gemini API (gemini-3.6-flash) / local model (Ollama)
## 3. 資料處理管道 (Data Pipeline)
原始資料來源：`.docx` / `.pdf` 詩歌檔案。

### 3.1 解析與清洗 (Parsing & Cleaning)
1. 使用 Python (`pypdf` / `python-docx`) 將文件轉為純文字。
2. 提取欄位結構：
   - `id`: 詩歌編號 (e.g., "101")
   - `title`: 詩歌標題
   - `category`: 分類/主題 (e.g., "大本詩歌", "詩歌補充本")
   - `lyrics`: 完整歌詞 (保留段落與換行)

### 3.2 向量化與切片 (Chunking & Embedding)
- **Chunking Strategy:** 每首詩歌作為單一完整 Chunk（若過長則以「節/段落」切分，並攜帶詩歌 ID 標籤）。
- **Embedding Model:** `text-embedding-3-small` 或 `text-embedding-004`。
- **Metadata Structure:** `{ "id": str, "title": str, "category": str }`

## 4. 核心功能模組 (Core Modules)

### Module A: 詩歌查詢與瀏覽 (App Client)
- **功能：**
  1. 詩歌列表顯示與分類篩選。
  2. 精確號碼或關鍵字搜尋（SQLite FTS5）。
  3. 詩歌內文展示 (可調整字級大小、離線閱讀)。

### Module B: RAG AI 詩歌助理 (Backend)
- **API Endpoint:** `POST /api/v1/chat`
- **Request:** `{ "user_id": string, "message": string }`
- **RAG Workflow:**
  1. 接收 User Message。
  2. 計算向量並至 Vector DB 查詢 Top-K (K=3) 最相關詩歌。
  3. 擷取 Context (歌名、編號、歌詞)。
  4. 帶入 System Prompt 組裝對話，送至 LLM。
  5. 回傳 AI 回應與推薦詩歌列表 Metadata。
  
## 5. API 介面規格 (API Specifications)

### 1. 聊天檢索 API
- **Endpoint:** `POST /api/v1/chat/completions`
- **Payload:**
```json
{
  "query": "最近覺得心裡很焦慮，有什麼詩歌可以帶來平安？",
  "history": []
}