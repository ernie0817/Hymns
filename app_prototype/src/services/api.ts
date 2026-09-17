import { Platform } from 'react-native';
import Constants from 'expo-constants';

const getBaseUrl = () => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }
  // 如果是實體裝置 (Expo Go)，我們可以動態抓取 Expo 打包伺服器的 IP (這通常也是 Mac 的 IP)
  const debuggerHost = Constants.expoConfig?.hostUri;
  if (debuggerHost) {
    const ip = debuggerHost.split(':')[0];
    return `http://${ip}:8000`;
  }
  return 'http://localhost:8000';
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
