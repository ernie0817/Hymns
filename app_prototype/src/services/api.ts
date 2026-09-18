import { Platform } from 'react-native';
import Constants from 'expo-constants';
import EventSource from 'react-native-sse';

const getBaseUrl = () => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }
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

export const sendChatMessageStream = (
  query: string,
  history: ChatMessage[],
  onMeta: (recommendations: RecommendationItem[]) => void,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (error: any) => void
) => {
  const es = new EventSource(`${API_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, history, stream: true }),
  });

  es.addEventListener('message', (event: any) => {
    if (event.data) {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'meta') {
          onMeta(data.recommendations || []);
        } else if (data.type === 'chunk') {
          if (data.text) {
            onChunk(data.text);
          }
        } else if (data.type === 'done') {
          es.close();
          onDone();
        } else if (data.type === 'error') {
          onError(new Error(data.detail));
          es.close();
        }
      } catch (e) {
        console.error('SSE parse error:', e);
      }
    }
  });

  es.addEventListener('error', (event: any) => {
    console.error('SSE error:', event);
    onError(new Error('連線發生錯誤'));
    es.close();
  });
};

