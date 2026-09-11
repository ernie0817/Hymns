import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { sendChatMessage, ChatMessage, RecommendationItem } from '../services/api';
import { searchHymns } from '../database/db';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  recommendations?: RecommendationItem[];
}

export const AIChatScreen = ({ navigation }: any) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history: ChatMessage[] = messages.map(m => ({ role: m.role, content: m.text }));
      const response = await sendChatMessage(userMsg.text, history);

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: response.answer,
        recommendations: response.recommendations
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', text: '抱歉，伺服器發生錯誤。' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleRecommendationPress = async (rec: RecommendationItem) => {
    try {
      const results = await searchHymns(rec.id);
      if (results && results.length > 0) {
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
      {item.recommendations && item.recommendations.length > 0 && (
        <View style={styles.recommendationContainer}>
          <Text style={styles.recTitle}>推薦詩歌：</Text>
          {item.recommendations.map((rec) => (
            <TouchableOpacity key={rec.id} style={styles.recCard} onPress={() => handleRecommendationPress(rec)}>
              <Text style={styles.recCardTitle}>{rec.id} - {rec.title}</Text>
              <Text style={styles.recCardCategory}>{rec.category}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.list}
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
  );
};

const styles = StyleSheet.create({
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
