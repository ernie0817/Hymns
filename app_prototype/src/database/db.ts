import * as SQLite from 'expo-sqlite';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import { Platform } from 'react-native';

let db: SQLite.SQLiteDatabase | null = null;

export const initDB = async () => {
  if (db) return db;

  const dbName = 'hymns.db';
  let dbPath = '';

  if (Platform.OS === 'web') {
    db = await SQLite.openDatabaseAsync(dbName);
    return db;
  }

  // 為了徹底避開 Expo FileSystem 的 deprecated Error，這裡全部改用 FileSystemLegacy
  dbPath = `${FileSystemLegacy.documentDirectory}SQLite/${dbName}`;
  const dbDir = `${FileSystemLegacy.documentDirectory}SQLite`;
  
  try {
    const dirInfo = await FileSystemLegacy.getInfoAsync(dbDir);
    if (!dirInfo.exists) {
      await FileSystemLegacy.makeDirectoryAsync(dbDir, { intermediates: true });
    }

    const fileInfo = await FileSystemLegacy.getInfoAsync(dbPath);
    if (fileInfo.exists) {
      await FileSystemLegacy.deleteAsync(dbPath);
    }
  } catch (error) {
    console.warn("目錄檢查失敗，略過...", error);
  }
  
  console.log("複製資料庫從 Asset 到 local...");
  try {
    const asset = await Asset.loadAsync(require('../../assets/hymns.db'));
    if (asset[0].localUri) {
      await FileSystemLegacy.copyAsync({
        from: asset[0].localUri,
        to: dbPath,
      });
    } else {
      await FileSystemLegacy.downloadAsync(asset[0].uri, dbPath);
    }
  } catch (error) {
    console.error("複製資料庫失敗:", error);
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
  if (Platform.OS === 'web') return [];

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
