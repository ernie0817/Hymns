import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { Platform } from 'react-native';

let db: SQLite.SQLiteDatabase | null = null;

export const initDB = async () => {
  if (db) return db;

  const dbName = 'hymns.db';
  let dbPath = '';

  if (Platform.OS === 'web') {
    console.warn("Web 平台不支援直接載入本地 SQLite 檔案。請使用 iOS/Android 模擬器測試搜尋功能。");
    // Web 版建立一個記憶體/空資料庫避免 Crash
    db = await SQLite.openDatabaseAsync(dbName);
    return db;
  }

  dbPath = `${FileSystem.documentDirectory}SQLite/${dbName}`;
  
  // 建立 SQLite 存放目錄
  const dbDir = `${FileSystem.documentDirectory}SQLite`;
  const dirInfo = await FileSystem.getInfoAsync(dbDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dbDir, { intermediates: true });
  }

  // 強制複製最新的 db 過去
  const fileInfo = await FileSystem.getInfoAsync(dbPath);
  if (fileInfo.exists) {
    await FileSystem.deleteAsync(dbPath);
  }
  
  console.log("複製資料庫從 Asset 到 local...");
  const asset = await Asset.loadAsync(require('../../assets/hymns.db'));
  if (asset[0].localUri) {
    await FileSystem.copyAsync({
      from: asset[0].localUri,
      to: dbPath,
    });
  } else {
    await FileSystem.downloadAsync(asset[0].uri, dbPath);
  }

  db = await SQLite.openDatabaseAsync(dbName);
  return db;
};

export interface Hymn {
  id: string;
  title: string;
  category: string;
  lyrics: string;
  source_path?: string;
}

export const searchHymns = async (keyword: string, category: string = ''): Promise<Hymn[]> => {
  if (Platform.OS === 'web') {
    return []; // Web 版無法讀取本地 db，直接回傳空陣列避免報錯
  }

  try {
    const database = await initDB();
    let query = 'SELECT id, title, category, lyrics, source_path FROM hymns WHERE 1=1';
    let params: string[] = [];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    if (keyword) {
      query += ' AND (id LIKE ? OR title LIKE ? OR lyrics LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      params.push(likeKeyword, likeKeyword, likeKeyword);
    }

    query += ' LIMIT 50';
    
    const result = await database.getAllAsync<Hymn>(query, params);
    return result;
  } catch (error) {
    console.error("SQLite 查詢發生錯誤:", error);
    return [];
  }
};
