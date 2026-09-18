import time
import sys
import os

# 確保路徑正確以引用腳本
sys.path.append('/Users/ernie/WorkSpace/side-project/Hymns')
from scripts.build_vector_db import embed_texts

print("=== 測試向量生成 (Embedding) 效能 ===")

# 第一次執行會花一點點時間將本地模型載入記憶體
start_load = time.time()
print("1. 準備載入本地模型 (或 API 初始化)...")
vecs_warmup = embed_texts(["熱身文字"])
print(f"   -> 完成！耗時: {time.time() - start_load:.3f} 秒")
print(f"   -> 產生向量維度: {len(vecs_warmup[0])}")

# 測試真實的查詢轉換速度 (模擬使用者在 APP 輸入問題)
print("\n2. 模擬使用者查詢轉換...")
start_query = time.time()
vecs_query = embed_texts(["最近覺得心裡很焦慮，有什麼詩歌可以帶來平安？"])
query_time = time.time() - start_query
print(f"   -> 完成！單次查詢轉向量耗時: {query_time:.4f} 秒")

if query_time < 0.1:
    print("\n✅ 評估結果：耗時小於 0.1 秒，確認是【本地化模型】在運作，沒有經過外部網路請求！")
else:
    print("\n⚠️ 評估結果：耗時偏長，可能仍在呼叫外部 API (如 Gemini/OpenAI)。")
