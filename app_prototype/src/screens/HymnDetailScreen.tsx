import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { Hymn } from '../database/db';
import { BACKEND_URL } from '../services/api';

export const HymnDetailScreen = ({ route }: any) => {
  const { hymn } = route.params as { hymn: Hymn };
  const [viewMode, setViewMode] = useState<'text' | 'pdf'>('text');

  // 將 source_path 轉換成後端伺服器的靜態檔案 URL
  const getPdfUrl = () => {
    if (!hymn.source_path) return '';
    return encodeURI(`${BACKEND_URL}/${hymn.source_path}`);
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
          {/* 去除過多的連續換行，提升閱讀體驗 */}
          <Text style={styles.lyrics}>{hymn.lyrics.replace(/\n{3,}/g, '\n\n')}</Text>
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
    justifyContent: 'center',
    paddingTop: 16
  },
  tabButton: { 
    flex: 1, 
    paddingVertical: 10, 
    alignItems: 'center', 
    backgroundColor: '#e5e5ea', 
    marginHorizontal: 4,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2 
  },
  tabButtonActive: { backgroundColor: '#007AFF' },
  tabText: { color: '#333', fontWeight: '600', fontSize: 16 },
  tabTextActive: { color: '#fff', fontWeight: 'bold' },
  content: { flex: 1, padding: 24, backgroundColor: '#fafafa' },
  webview: { flex: 1 },
  title: { fontSize: 26, fontWeight: '800', color: '#1c1c1e', marginBottom: 6 },
  category: { fontSize: 15, color: '#8e8e93', fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#d1d1d6', marginVertical: 20 },
  lyrics: { 
    fontSize: 20, 
    lineHeight: 34, 
    color: '#2c2c2e', 
    paddingBottom: 60,
    letterSpacing: 0.5,
    textAlign: 'auto'
  }
});
