from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_chat_completions_returns_answer_and_recommendations(monkeypatch):
    fake_hits = [
        {
            "id": "490",
            "title": "試煉中的安慰－主的同在",
            "category": "大本詩歌",
            "distance": 0.42,
            "snippet": "主啊，祢與我同在，安慰我心。",
        },
        {
            "id": "493",
            "title": "試煉中的安慰－主的看顧",
            "category": "大本詩歌",
            "distance": 0.43,
            "snippet": "祢看顧我，祢與我同在。",
        },
    ]

    monkeypatch.setattr("backend.main.retrieve_hymns", lambda query, top_k=3: fake_hits)
    monkeypatch.setattr("backend.main.generate_answer", lambda query, retrieved: "你可以先讀這些詩歌。")

    response = client.post(
        "/api/v1/chat/completions",
        json={"query": "我現在很焦慮，想要安慰。", "history": []},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["query"] == "我現在很焦慮，想要安慰。"
    assert payload["answer"] == "你可以先讀這些詩歌。"
    assert payload["recommendations"][0]["id"] == "490"
    assert payload["recommendations"][0]["title"] == "試煉中的安慰－主的同在"


def test_chat_completions_rejects_empty_query():
    response = client.post(
        "/api/v1/chat/completions",
        json={"query": "   ", "history": []},
    )

    assert response.status_code == 400
    assert "Query cannot be empty" in response.json()["detail"]
