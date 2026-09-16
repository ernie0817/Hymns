import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { Hymn } from '../database/db';
import { BACKEND_URL } from '../services/api';

export const HymnDetailScreen = ({ route }: any) => {
  const { hymn } = route.params as { hymn: Hymn };
  const [viewMode, setViewMode] = useState<'text' | 'pdf'>('text');
  const [fontSize, setFontSize] = useState(20);

  const getPdfUrl = () => {
    if (!hymn.source_path) return '';
    return encodeURI(`${BACKEND_URL}/${hymn.source_path}`);
  };

  const isPdfAvailable = hymn.source_path && hymn.source_path.toLowerCase().endsWith('.pdf');

  // 清理歌詞：去除樂譜數字、調性資訊、標題重複等無用內容，只保留純歌詞
  const cleanLyrics = (rawText: string) => {
    return rawText
      .split('\n')
      .map(line => line.trim())
      // 1. 過濾掉空行
      .filter(line => line.length > 0)
      // 2. 過濾掉調性、節拍資訊 (例如 "A大調4/4", "Eb 大調 3/4")
      .filter(line => !/^[A-Ga-g](#|b|♭)?\s*(大調|小調)/i.test(line))
      // 3. 過濾掉詩歌本編號資訊 (例如 "大本詩176", "詩歌1", "兒童詩歌 114")
      .filter(line => !/^(大本詩|詩歌|補充本|新歌頌詠|新詩|兒童詩歌)\s*\d+/i.test(line))
      // 4. 過濾掉純簡譜與分隔線
      .filter(line => {
        // 檢查是否有中文字
        const hasChinese = /[\u4e00-\u9fa5]/.test(line);
        // 檢查是否有真正的英文字 (長度>1，且不是 FINE, D.C. 等譜面記號)
        // 先把常見譜面記號拔除
        const lineWithoutMarks = line.replace(/(FINE|D\.C\.|D\.S\.|I|V)/gi, '');
        const hasEnglish = /[a-zA-Z]{2,}/.test(lineWithoutMarks);
        
        // 如果一行既沒有中文字，也沒有有意義的英文字，就判定為樂譜或符號行
        if (!hasChinese && !hasEnglish) {
          return false;
        }

        return true;
      })
      // 5. 處理歌詞間被硬加入的空白 (例如 "一、但 願 榮 耀" 變成 "一、但願榮耀")
      // 注意：這只取代中文字之間的空白，避免影響英文字
      .map(line => line.replace(/([\u4e00-\u9fa5])\s+(?=[\u4e00-\u9fa5])/g, '$1'))
      // 6. 清理段落標記前方的特殊符號，例如 "○副", "◎" 轉成乾淨的 "(副)"
      .map(line => {
        let cleaned = line.replace(/^[○◎●]\s*副?\s*/, '(副) ');
        // 移除開頭殘留的樂譜小節線如 "∥:  ", ":∥", "︱" 等
        cleaned = cleaned.replace(/^[∥|︱:：\s]+/, '');
        // 移除結尾的樂譜小節線
        cleaned = cleaned.replace(/[∥|︱:：\s]+$/, '');
        return cleaned;
      })
      .join('\n\n'); // 每個段落用雙換行隔開，增加閱讀舒適度
  };

  return (
    <View style={styles.container}>
      {isPdfAvailable && (
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, viewMode === 'text' && styles.tabButtonActive]}
            onPress={() => setViewMode('text')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, viewMode === 'text' && styles.tabTextActive]}>純文字歌詞</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, viewMode === 'pdf' && styles.tabButtonActive]}
            onPress={() => setViewMode('pdf')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, viewMode === 'pdf' && styles.tabTextActive]}>PDF 原檔</Text>
          </TouchableOpacity>
        </View>
      )}

      {viewMode === 'text' ? (
        <View style={styles.contentWrapper}>
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>{hymn.id} - {hymn.title}</Text>
              <Text style={styles.category}>{hymn.category}</Text>
            </View>
            <View style={styles.fontControls}>
              <TouchableOpacity onPress={() => setFontSize(f => Math.max(14, f - 2))} style={styles.fontBtn}>
                <Ionicons name="text-outline" size={16} color="#666" />
                <Text style={styles.fontBtnText}>A-</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setFontSize(f => Math.min(40, f + 2))} style={styles.fontBtn}>
                <Ionicons name="text-outline" size={22} color="#666" />
                <Text style={styles.fontBtnText}>A+</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.divider} />
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.lyrics, { fontSize, lineHeight: fontSize * 1.6 }]}>
              {cleanLyrics(hymn.lyrics)}
            </Text>
          </ScrollView>
        </View>
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
  container: { flex: 1, backgroundColor: '#f9f8f6' },
  tabContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#f2f2f7',
    marginHorizontal: 4,
    borderRadius: 8,
  },
  tabButtonActive: { backgroundColor: '#4a6572' },
  tabText: { color: '#666', fontWeight: '600', fontSize: 16 },
  tabTextActive: { color: '#fff', fontWeight: 'bold' },
  contentWrapper: { flex: 1, padding: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  titleContainer: { flex: 1, paddingRight: 16 },
  fontControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, padding: 4, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  fontBtn: { paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center' },
  fontBtnText: { marginLeft: 2, color: '#666', fontWeight: '600' },
  webview: { flex: 1 },
  title: { fontSize: 24, fontWeight: '800', color: '#1c1c1e', marginBottom: 6 },
  category: { fontSize: 14, color: '#b87c32', fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#e5e5ea', marginVertical: 20 },
  lyrics: {
    color: '#2c2c2e',
    paddingBottom: 60,
    letterSpacing: 0.5,
  }
});
