import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { searchHymns, Hymn } from '../database/db';

export const HymnListView = ({ navigation }: any) => {
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [hymns, setHymns] = useState<Hymn[]>([]);
  const [loading, setLoading] = useState(false);

  const categories = ['', '大本詩歌', '詩歌補充本', '新歌頌詠', '兒童詩歌', '新詩', '其他'];

  useEffect(() => { loadHymns(); }, [keyword, category]);

  const loadHymns = async () => {
    setLoading(true);
    try { 
      const results = await searchHymns(keyword, category); 
      setHymns([...results]); // 加上中括號，強制 React 發現陣列改變並重新渲染畫面
    } 
    catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };


  const renderItem = ({ item }: { item: Hymn }) => {
    const hasPdf = item.source_path && item.source_path.toLowerCase().endsWith('.pdf');
    return (
      <TouchableOpacity style={styles.item} onPress={() => navigation.navigate('HymnDetail', { hymn: item })} activeOpacity={0.7}>
        <View style={styles.itemContent}>
          <Text style={styles.title}>{item.id} - {item.title}</Text>
          <View style={styles.badgeContainer}>
            <Text style={styles.categoryBadge}>{item.category}</Text>
            {hasPdf && <View style={styles.pdfBadge}><Ionicons name="document-text" size={12} color="#fff" /><Text style={styles.pdfText}>PDF</Text></View>}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#c7c7cc" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#8e8e93" style={styles.searchIcon} />
          <TextInput style={styles.input} placeholder="搜尋詩歌..." placeholderTextColor="#8e8e93" value={keyword} onChangeText={setKeyword} clearButtonMode="while-editing" />
        </View>
      </View>
      <View style={styles.categoryContainer}>
        <FlatList horizontal data={categories} keyExtractor={(_, i) => i.toString()} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList} renderItem={({ item }) => (
          <TouchableOpacity style={[styles.categoryBtn, category === item && styles.categoryBtnActive]} onPress={() => setCategory(item)} activeOpacity={0.8}>
            <Text style={[styles.categoryText, category === item && styles.categoryTextActive]}>{item || '全部'}</Text>
          </TouchableOpacity>
        )} />
      </View>
      {loading ? <View style={styles.centerContainer}><ActivityIndicator size="large" color="#d3a25d" /></View> : hymns.length === 0 ? <View style={styles.centerContainer}><Text style={styles.emptyText}>無結果</Text></View> : <FlatList data={hymns} keyExtractor={(item, i) => `${item.category}_${item.id}_${i}`} renderItem={renderItem} contentContainerStyle={styles.list} />}
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AIChat')} activeOpacity={0.8}><Ionicons name="chatbubbles" size={24} color="#fff" /></TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f8f6' },
  searchContainer: { padding: 16, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  searchInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f2f2f7', borderRadius: 12, paddingHorizontal: 12 },
  searchIcon: { marginRight: 8 },
  input: { flex: 1, height: 44, fontSize: 16, color: '#333' },
  categoryContainer: { backgroundColor: '#ffffff', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e5e5ea', elevation: 1 },
  categoryList: { paddingHorizontal: 12 },
  categoryBtn: { paddingHorizontal: 18, paddingVertical: 8, marginHorizontal: 4, borderRadius: 20, backgroundColor: '#f2f2f7', borderWidth: 1, borderColor: 'transparent' },
  categoryBtnActive: { backgroundColor: '#fcf3e3', borderColor: '#d3a25d' },
  categoryText: { color: '#666', fontSize: 14, fontWeight: '600' },
  categoryTextActive: { color: '#b87c32', fontSize: 14, fontWeight: 'bold' },
  list: { padding: 16, paddingBottom: 100 },
  item: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', padding: 18, marginBottom: 12, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  itemContent: { flex: 1 },
  title: { fontSize: 17, fontWeight: '700', color: '#2c2c2e', marginBottom: 8 },
  badgeContainer: { flexDirection: 'row', alignItems: 'center' },
  categoryBadge: { fontSize: 12, color: '#8e8e93', backgroundColor: '#f2f2f7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, overflow: 'hidden', marginRight: 8 },
  pdfBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#d3a25d', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6 },
  pdfText: { fontSize: 10, color: '#fff', fontWeight: 'bold', marginLeft: 2 },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', margin: 80 },
  emptyText: { marginTop: 16, fontSize: 16, color: '#8e8e93', fontWeight: '500' },
  fab: { position: 'absolute', bottom: 32, right: 24, backgroundColor: '#4a6572', flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 30, shadowColor: '#4a6572', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 }
});
