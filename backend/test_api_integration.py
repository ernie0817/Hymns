import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def run_tests():
    print("Testing /api/v1/chat/completions...")
    response = client.post(
        "/api/v1/chat/completions",
        json={"query": "平安"}
    )
    if response.status_code == 200:
        print("Success!")
        data = response.json()
        print(f"Answer: {data.get('answer')[:100]}...")
    else:
        print(f"Failed! Status code: {response.status_code}")
        print(response.text)
        exit(1)

if __name__ == "__main__":
    run_tests()
