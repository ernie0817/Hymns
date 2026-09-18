import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendChatMessageStream, ChatMessage, RecommendationItem } from '../services/api';
import { searchHymns } from '../database/db';

import { useHeaderHeight } from '@react-navigation/elements';

const CHAT_HISTORY_KEY = '@hymn_chat_history';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  recommendations?: RecommendationItem[];
  isStreaming?: boolean;
}

export const AIChatScreen = ({ navigation }: any) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const headerHeight = useHeaderHeight();

  // 初次載入時，從 AsyncStorage 讀取歷史紀錄
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const savedData = await AsyncStorage.getItem(CHAT_HISTORY_KEY);
        if (savedData) {
          setMessages(JSON.parse(savedData));
        }
      } catch (e) {
        console.error("Failed to load chat history", e);
      }
    };
    loadHistory();
  }, []);

  // 當 messages 改變時（且不在串流中），自動儲存到 AsyncStorage
  useEffect(() => {
    const saveHistory = async () => {
      try {
        // 過濾掉還在 streaming 狀態的殘缺訊息，確保只存完整的對話
        const completedMessages = messages.filter(m => !m.isStreaming);
        await AsyncStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(completedMessages));
      } catch (e) {
        console.error("Failed to save chat history", e);
      }
    };
    
    // 我們可以加一個簡單防抖，或者直接存
    if (messages.length > 0) {
      saveHistory();
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const history: ChatMessage[] = messages.map(m => ({ role: m.role, content: m.text }));
    
    // 預先建立一個 AI 訊息佔位符
    const aiMessageId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: aiMessageId, role: 'assistant', text: '', isStreaming: true }]);

    sendChatMessageStream(
      userMsg.text,
      history,
      (recommendations) => {
        // 收到 meta: 更新推薦詩歌 (此時存在 state 中，但先不顯示)
        setMessages(prev => prev.map(msg => 
          msg.id === aiMessageId ? { ...msg, recommendations } : msg
        ));
      },
      (textChunk) => {
        // 收到 chunk: 拼接文字
        setMessages(prev => prev.map(msg => 
          msg.id === aiMessageId ? { ...msg, text: msg.text + textChunk } : msg
        ));
      },
      () => {
        // 串流結束，關閉 isStreaming 狀態以顯示推薦詩歌
        setMessages(prev => prev.map(msg => 
          msg.id === aiMessageId ? { ...msg, isStreaming: false } : msg
        ));
        setLoading(false);
      },
      (error) => {
        console.error(error);
        setMessages(prev => prev.map(msg => 
          msg.id === aiMessageId ? { ...msg, text: msg.text + '\n(抱歉，伺服器發生錯誤。)', isStreaming: false } : msg
        ));
        setLoading(false);
      }
    );
  };

  const handleRecommendationPress = async (rec: RecommendationItem) => {
    try {
      // 搜尋時帶入分類，並在結果中精確比對 ID，避免因為 LIKE 搜尋抓到 1001 之類的編號
      const results = await searchHymns(rec.id, rec.category);
      const exactMatch = results.find(h => h.id === rec.id);
      
      if (exactMatch) {
        navigation.navigate('HymnDetail', { hymn: exactMatch });
      } else if (results.length > 0) {
        navigation.navigate('HymnDetail', { hymn: results[0] });
      } else {
        alert('本地資料庫找不到該首詩歌');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}>
      <Text style={item.role === 'user' ? styles.userText : styles.aiText}>{item.text}</Text>
      {!item.isStreaming && item.recommendations && item.recommendations.length > 0 && (
        <View style={styles.recommendationContainer}>
          <Text style={styles.recTitle}>推薦詩歌：</Text>
          {item.recommendations.map((rec, index) => (
            <TouchableOpacity key={`${rec.category}_${rec.id}_${index}`} style={styles.recCard} onPress={() => handleRecommendationPress(rec)}>
              <Text style={styles.recCardTitle}>{rec.id} - {rec.title}</Text>
              <Text style={styles.recCardCategory}>{rec.category}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#f9f9f9' }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>歷史紀錄</Text>
        <TouchableOpacity onPress={async () => {
          setMessages([]);
          await AsyncStorage.removeItem(CHAT_HISTORY_KEY);
        }}>
          <Text style={styles.clearBtn}>清除對話</Text>
        </TouchableOpacity>
      </View>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight + 50 : 0}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="輸入您的心情或需求..."
            value={input}
            onChangeText={setInput}
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={sendMessage} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendText}>發送</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#eee' },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  clearBtn: { color: '#FF3B30', fontSize: 16 },
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  list: { padding: 16 },
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 16, marginBottom: 12 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#007AFF' },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: '#e5e5ea' },
  userText: { color: '#fff', fontSize: 16 },
  aiText: { color: '#000', fontSize: 16, lineHeight: 22 },
  inputContainer: { flexDirection: 'row', padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#eee' },
  input: { flex: 1, backgroundColor: '#f0f0f0', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, fontSize: 16 },
  sendBtn: { marginLeft: 12, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, borderRadius: 20 },
  sendText: { color: '#fff', fontWeight: 'bold' },
  recommendationContainer: { marginTop: 12, borderTopWidth: 1, borderColor: '#ccc', paddingTop: 8 },
  recTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 8, color: '#333' },
  recCard: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 8 },
  recCardTitle: { fontWeight: 'bold', color: '#007AFF' },
  recCardCategory: { fontSize: 12, color: '#666', marginTop: 4 }
});
