import os
try:
    from google import genai
    client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY", "dummy"))
    print("SDK loaded")
except Exception as e:
    print(e)
