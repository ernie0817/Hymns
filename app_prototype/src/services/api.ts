import { Platform } from 'react-native';

const getBaseUrl = () => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }
  // 在真機測試或 iOS Expo Go 遇到 localhost (-1004) 解析問題時，直接指定 Mac 的區域網路 IP
  return 'http://10.240.103.92:8000';
};

export const BACKEND_URL = getBaseUrl();
export const API_BASE_URL = `${BACKEND_URL}/api/v1`;

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
