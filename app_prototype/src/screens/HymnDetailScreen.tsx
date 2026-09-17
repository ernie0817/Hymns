import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useKeepAwake } from 'expo-keep-awake';
import { Hymn } from '../database/db';
import { BACKEND_URL } from '../services/api';
import { cleanLyrics } from '../utils/lyricsHelper';

export const HymnDetailScreen = ({ route }: any) => {
  const { hymn } = route.params as { hymn: Hymn };
  const [viewMode, setViewMode] = useState<'text' | 'pdf'>('text');
  const [fontSize, setFontSize] = useState(18);

  const [pdfStatus, setPdfStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [debugInfo, setDebugInfo] = useState('');

  const getPdfUrl = () => {
    if (!hymn.source_path) return '';
    const baseUrl = `${BACKEND_URL}/${hymn.source_path}`;
    let encoded = encodeURI(baseUrl)
      .replace(/#/g, '%23')
      .replace(/\[/g, '%5B')
      .replace(/\]/g, '%5D')
      .replace(/\+/g, '%2B');
    return encoded;
  };

  const isPdfAvailable = hymn.source_path && hymn.source_path.toLowerCase().endsWith('.pdf');
  const targetUrl = getPdfUrl();

  // 加入網路診斷測試：主動發送一個短暫的 fetch 來確認伺服器與該 PDF 檔案是否可達
  useEffect(() => {
    if (viewMode === 'pdf' && targetUrl) {
      setPdfStatus('loading');
      setDebugInfo(`嘗試連線至: ${targetUrl}`);
      
      fetch(targetUrl, { method: 'HEAD' })
        .then(response => {
          if (response.ok) {
            setPdfStatus('success');
            setDebugInfo(`連線成功 (HTTP ${response.status})`);
          } else {
            setPdfStatus('error');
            setDebugInfo(`連線失敗 (HTTP ${response.status})\nURL: ${targetUrl}`);
          }
        })
        .catch(err => {
          setPdfStatus('error');
          setDebugInfo(`無法連線伺服器 (可能為 IP 錯誤或防火牆阻擋)\n詳細錯誤: ${err.message}\nURL: ${targetUrl}`);
        });
    }
  }, [viewMode, targetUrl]);

  // 清理歌詞：去除樂譜數字、調性資訊、標題重複等無用內容，只保留純歌詞
  // (註：由於目前正在建立測試流程，具體的清整邏輯可以未來再慢慢分離到 lyricsHelper，目前維持這裡以保證畫面正常運作)
  const cleanLyrics = (rawText: string) => {
    const parsedLines = rawText
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

        // 過濾掉全都是簡譜符號、但可能夾雜奇怪半形的行
        const chars = line.replace(/\s+/g, '');
        const pureMusicRegex = /^[0-9\-•︱∥╭╮()（）#♭b:：]+$/;
        if (pureMusicRegex.test(chars)) {
           return false;
        }

        return true;
      })
      // 5. & 6. 清理段落標記與移除不必要的空白
      .map(line => {
        // 移除奇怪的繪圖與樂譜特殊符號
        let cleaned = line.replace(/[╭╮╰╯─_•︱∥│║#♭]/g, '');

        // 處理段落標記
        cleaned = cleaned.replace(/^[○◎●]\s*副?\s*/, '(副) ');
        cleaned = cleaned.replace(/^[○◎●]\s*(?=[^\s])/, '(副) ');
        cleaned = cleaned.replace(/^[∥|︱:：\s○◎●]+/, '');
        cleaned = cleaned.replace(/[∥|︱:：\s]+$/, '');
        cleaned = cleaned.replace(/\s*(FINE|D\.C\.|D\.S\.)\s*$/i, '');
        
        // 移除句子中間的多餘空白，但保留英文/數字之間的空白
        // 先將英數字之間的空白換成特殊字元
        cleaned = cleaned.replace(/([a-zA-Z0-9])\s+([a-zA-Z0-9])/g, '$1@@SPACE@@$2');
        // 保護 "(副)" 後面的空白
        cleaned = cleaned.replace(/\(副\)\s+/g, '(副)@@SPACE@@');
        // 移除其餘所有空白 (也就是中文字之間，或符號旁邊的空白)
        cleaned = cleaned.replace(/\s+/g, '');
        // 還原受保護的空白
        cleaned = cleaned.replace(/@@SPACE@@/g, ' ');

        return cleaned;
      });

    // 重新組織段落：遇到新段落（一、二、(副) 等）加上空行分隔，避免本來全部擠在一起
    const resultLines: string[] = [];
    for (let i = 0; i < parsedLines.length; i++) {
      const line = parsedLines[i];
      const isNewStanza = /^(一|二|三|四|五|六|七|八|九|十|十一|十二|十三|十四|十五|十六|十七|十八|十九|二十)、/.test(line) || line.startsWith('(副)');
      
      // 如果是新段落，且前面不是空行，就補一個空行
      if (isNewStanza && i > 0 && resultLines[resultLines.length - 1] !== '') {
        resultLines.push('');
      }
      resultLines.push(line);
    }

    return resultLines.join('\n');
  };

  const copyToClipboard = async () => {
    const cleaned = cleanLyrics(hymn.lyrics);
    // 歌詞本身第一行如果是標題，而且我們又加了 hymn.title，就會重複兩次。
    // 因此在複製時，將清理過的歌詞第一行（如果等於標題）拔除，或是直接單純複製清理過的歌詞即可。
    // 其實原檔 lyrics 裡面通常第一行就是標題，所以 cleanLyrics 處理後第一行應該就是標題了，
    // 我們直接複製 cleaned 就好了，不需要額外手動加上 `${hymn.title}\n\n`
    await Clipboard.setStringAsync(cleaned);
    Alert.alert('複製成功', '歌詞已複製到剪貼簿！');
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
            <View style={styles.actionRow}>
              <View style={styles.fontControls}>
                <TouchableOpacity onPress={copyToClipboard} style={styles.iconBtn}>
                  <Ionicons name="copy-outline" size={18} color="#4a6572" />
                  <Text style={styles.copyBtnText}>複製歌詞</Text>
                </TouchableOpacity>
                <View style={styles.verticalDivider} />
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
          </View>
          <View style={styles.divider} />
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.lyrics, { fontSize, lineHeight: fontSize * 1.6 }]}>
              {cleanLyrics(hymn.lyrics)}
            </Text>
          </ScrollView>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {pdfStatus === 'loading' && (
            <View style={styles.diagnosticContainer}>
              <Text style={styles.diagnosticText}>連線測試中...</Text>
              <Text style={styles.debugText}>{debugInfo}</Text>
            </View>
          )}
          {pdfStatus === 'error' && (
            <View style={styles.diagnosticContainer}>
              <Ionicons name="warning" size={48} color="#e74c3c" />
              <Text style={styles.diagnosticTitle}>無法載入 PDF</Text>
              <Text style={styles.diagnosticText}>
                手機無法連接到 Mac 的伺服器，請確保：{'\n'}
                1. Mac 上的 Python 後端正在運行{'\n'}
                2. 手機和 Mac 連接相同的 WiFi{'\n'}
                3. Mac 的防火牆沒有阻擋 Python
              </Text>
              <Text style={styles.debugText}>{debugInfo}</Text>
            </View>
          )}
          {pdfStatus === 'success' && (
            <WebView
              source={{ uri: targetUrl }}
              style={styles.webview}
              startInLoadingState={true}
              onError={(syntheticEvent) => {
                setPdfStatus('error');
                setDebugInfo(`WebView 渲染錯誤: ${syntheticEvent.nativeEvent.description}`);
              }}
            />
          )}
        </View>
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
  contentWrapper: { flex: 1, padding: 16 },
  header: { flexDirection: 'column', alignItems: 'stretch' },
  titleContainer: { marginBottom: 12 },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', width: '100%' },
  fontControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, padding: 4, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  fontBtn: { paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center' },
  iconBtn: { paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f4f8', borderRadius: 6 },
  copyBtnText: { marginLeft: 4, color: '#4a6572', fontWeight: '600', fontSize: 13 },
  verticalDivider: { width: 1, height: 20, backgroundColor: '#e5e5ea', marginHorizontal: 4 },
  fontBtnText: { marginLeft: 2, color: '#666', fontWeight: '600' },
  webview: { flex: 1 },
  title: { fontSize: 24, fontWeight: '800', color: '#1c1c1e', marginBottom: 4, lineHeight: 32 },
  category: { fontSize: 14, color: '#b87c32', fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#e5e5ea', marginTop: 16, marginBottom: 20 },
  lyrics: {
    color: '#333333',
    paddingBottom: 60,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  diagnosticContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  diagnosticTitle: { fontSize: 20, fontWeight: 'bold', color: '#e74c3c', marginTop: 16, marginBottom: 8 },
  diagnosticText: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 16 },
  debugText: { fontSize: 12, color: '#999', backgroundColor: '#f0f0f0', padding: 12, borderRadius: 8, width: '100%', textAlign: 'left' }
});
