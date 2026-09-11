import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { searchHymns, Hymn } from '../database/db';

export const HymnListView = ({ navigation }: any) => {
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [hymns, setHymns] = useState<Hymn[]>([]);
  const [loading, setLoading] = useState(false);

  const categories = ['', '大本詩歌', '詩歌補充本', '新歌頌詠', '兒童詩歌'];

  useEffect(() => {
    loadHymns();
  }, [keyword, category]);

  const loadHymns = async () => {
    setLoading(true);
    try {
      const results = await searchHymns(keyword, category);
      setHymns(results);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: Hymn }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => navigation.navigate('HymnDetail', { hymn: item })}
    >
      <View style={styles.itemContent}>
        <Text style={styles.title}>{item.id} - {item.title}</Text>
        <Text style={styles.category}>{item.category}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#ccc" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
          <TextInput
            style={styles.input}
            placeholder="搜尋詩歌編號、標題或歌詞..."
            value={keyword}
            onChangeText={setKeyword}
            clearButtonMode="while-editing"
          />
        </View>
      </View>
      <View style={styles.categoryContainer}>
        <FlatList
          horizontal
          data={categories}
          keyExtractor={(item, index) => index.toString()}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.categoryBtn, category === item && styles.categoryBtnActive]}
              onPress={() => setCategory(item)}
            >
              <Text style={category === item ? styles.categoryTextActive : styles.categoryText}>
                {item || '全部'}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>
      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
      ) : hymns.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={48} color="#ccc" />
          <Text style={styles.emptyText}>找不到相關詩歌</Text>
        </View>
      ) : (
        <FlatList
          data={hymns}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AIChat')}
      >
        <Ionicons name="chatbubbles" size={24} color="#fff" />
        <Text style={styles.fabText}>AI 助理</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7' },
  searchContainer: { padding: 16, backgroundColor: '#fff' },
  searchInputContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#f2f2f7',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 8 },
  input: { flex: 1, height: 44, fontSize: 16 },
  categoryContainer: { backgroundColor: '#fff', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#ebebeb' },
  categoryList: { paddingHorizontal: 12 },
  categoryBtn: { paddingHorizontal: 16, paddingVertical: 8, marginHorizontal: 4, borderRadius: 20, backgroundColor: '#f2f2f7' },
  categoryBtnActive: { backgroundColor: '#007AFF' },
  categoryText: { color: '#333', fontSize: 14, fontWeight: '500' },
  categoryTextActive: { color: '#fff', fontSize: 14, fontWeight: '500' },
  list: { padding: 16 },
  item: { 
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff', 
    padding: 16, 
    marginBottom: 12, 
    borderRadius: 12, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2 
  },
  itemContent: { flex: 1 },
  title: { fontSize: 16, fontWeight: '600', color: '#1c1c1e' },
  category: { fontSize: 13, color: '#8e8e93', marginTop: 4 },
  loader: { marginTop: 32 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  emptyText: { marginTop: 12, fontSize: 16, color: '#8e8e93' },
  fab: { 
    position: 'absolute', 
    bottom: 24, 
    right: 24, 
    backgroundColor: '#007AFF', 
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16, 
    borderRadius: 28, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5 
  },
  fabText: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginLeft: 8 }
});
