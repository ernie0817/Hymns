export const API_BASE_URL = 'http://localhost:8000/api/v1';

export interface ChatMessage {
  role: string;
  content: string;
}

export interface RecommendationItem {
  id: string;
  title: string;
  category: string;
  distance?: number;
  snippet: string;
}

export interface ChatResponse {
  answer: string;
  query: string;
  recommendations: RecommendationItem[];
}

export const sendChatMessage = async (query: string, history: ChatMessage[] = []): Promise<ChatResponse> => {
  const response = await fetch(`${API_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, history }),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch chat completion');
  }

  return response.json();
};
