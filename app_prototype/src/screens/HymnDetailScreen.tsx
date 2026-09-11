import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { Hymn } from '../database/db';

export const HymnDetailScreen = ({ route }: any) => {
  const { hymn } = route.params as { hymn: Hymn };
  const [viewMode, setViewMode] = useState<'text' | 'pdf'>('text');

  // 將 source_path (例如: '大本詩歌/100.pdf') 轉換成後端伺服器的靜態檔案 URL
  // encodeURI 用於處理中文路徑
  const getPdfUrl = () => {
    if (!hymn.source_path) return '';
    return encodeURI(`http://localhost:8000/data/${hymn.source_path}`);
  };

  const isPdfAvailable = hymn.source_path && hymn.source_path.toLowerCase().endsWith('.pdf');

  return (
    <View style={styles.container}>
      {isPdfAvailable && (
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tabButton, viewMode === 'text' && styles.tabButtonActive]}
            onPress={() => setViewMode('text')}
          >
            <Text style={[styles.tabText, viewMode === 'text' && styles.tabTextActive]}>純文字歌詞</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabButton, viewMode === 'pdf' && styles.tabButtonActive]}
            onPress={() => setViewMode('pdf')}
          >
            <Text style={[styles.tabText, viewMode === 'pdf' && styles.tabTextActive]}>PDF 原檔</Text>
          </TouchableOpacity>
        </View>
      )}

      {viewMode === 'text' ? (
        <ScrollView style={styles.content}>
          <Text style={styles.title}>{hymn.id} - {hymn.title}</Text>
          <Text style={styles.category}>分類: {hymn.category}</Text>
          <View style={styles.divider} />
          <Text style={styles.lyrics}>{hymn.lyrics}</Text>
        </ScrollView>
      ) : (
        <WebView 
          source={{ uri: getPdfUrl() }} 
          style={styles.webview}
          startInLoadingState={true}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  tabContainer: { 
    flexDirection: 'row', 
    padding: 12, 
    backgroundColor: '#f2f2f7',
    justifyContent: 'center' 
  },
  tabButton: { 
    flex: 1, 
    paddingVertical: 8, 
    alignItems: 'center', 
    backgroundColor: '#e5e5ea', 
    marginHorizontal: 4,
    borderRadius: 8 
  },
  tabButtonActive: { backgroundColor: '#007AFF' },
  tabText: { color: '#333', fontWeight: '500' },
  tabTextActive: { color: '#fff', fontWeight: 'bold' },
  content: { flex: 1, padding: 20 },
  webview: { flex: 1 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1c1c1e' },
  category: { fontSize: 16, color: '#8e8e93', marginTop: 8 },
  divider: { height: 1, backgroundColor: '#ebebeb', marginVertical: 16 },
  lyrics: { fontSize: 18, lineHeight: 28, color: '#333', paddingBottom: 40 }
});
