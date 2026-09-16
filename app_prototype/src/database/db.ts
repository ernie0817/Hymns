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

export const searchHymns = async (keyword: string, categoryFilter: string = ''): Promise<Hymn[]> => {
  if (Platform.OS === 'web') return [];

  try {
    const database = await initDB();
    let query = 'SELECT id, title, category, lyrics, source_path FROM hymns WHERE 1=1';
    let params: string[] = [];

    if (categoryFilter) {
      if (categoryFilter === '新詩') {
        query += " AND category LIKE '新詩%'";
      } else if (categoryFilter === '其他') {
        query += " AND category NOT IN ('大本詩歌', '詩歌補充本', '新歌頌詠', '兒童詩歌') AND category NOT LIKE '新詩%'";
      } else {
        query += ' AND category = ?';
        params.push(categoryFilter);
      }
    }

    if (keyword) {
      query += ' AND (id LIKE ? OR title LIKE ? OR lyrics LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      params.push(likeKeyword, likeKeyword, likeKeyword);
    }

    // 在 SQL 中只限制數量，不進行複雜的字串轉換排序
    query += ' LIMIT 3000';
    
    const result = await database.getAllAsync<Hymn>(query, params);

    // ======== 完美的自訂排序邏輯 ========
    return result.sort((a, b) => {
      // 1. 先按分類排序 (確保紅皮、藍皮等會分開)
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }

      // 2. 處理「附」錄詩歌
      // 這裡最關鍵：您的資料庫中，附錄的 id 可能是 '1' (被誤拔掉'附')，所以我們需要檢查 title 是不是包含 '附'，或是 id 包含 '附'
      const checkIsAppendix = (h: Hymn) => {
        if (h.id.includes('附') || h.title.includes('附')) return true;
        // 針對大本詩歌，正歌一定會補 0 補到至少 3 碼（例如 001, 010, 100）
        // 如果 id 是純數字（或帶字母），且前面的數字部分長度小於 3，那就是附錄 (例如 '1', '2')
        if (h.category === '大本詩歌') {
          const match = h.id.match(/^\d+/);
          if (match && match[0].length < 3) {
            return true;
          }
        }
        return false;
      };

      const aIsAppendix = checkIsAppendix(a);
      const bIsAppendix = checkIsAppendix(b);
      
      // 如果一個是附錄，一個不是，附錄永遠排在後面
      if (aIsAppendix && !bIsAppendix) return 1;  // a 是附錄，往後排
      if (!aIsAppendix && bIsAppendix) return -1; // b 是附錄，往後排

      // 3. 提取出真正的數字部分 (例如: '001' -> 1, '附1' -> 1, '10a' -> 10)
      const numA = parseInt(a.id.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.id.replace(/\D/g, ''), 10) || 0;

      // 如果數字大小不同，直接按數字排 (1 會排在 2 前面)
      if (numA !== numB) {
        return numA - numB;
      }

      // 4. 如果數字一樣，確保正歌在前面
      // 例如：大本詩歌001(長度3) vs 大本詩歌附1(長度1)
      // 但因為我們已經用 aIsAppendix 把附錄往後排了，所以走到這裡的都是「同為正歌」或「同為附錄」
      // 這時候我們用字串原本的長度排，例如 '1a' 和 '1' 會把 '1' 排前面
      if (a.id.length !== b.id.length) {
        return a.id.length - b.id.length;
      }

      // 5. 如果連長度都一樣，就照字面字母排
      return a.id.localeCompare(b.id);
    });

  } catch (error) {
    console.error("SQLite 查詢發生錯誤:", error);
    return [];
  }
};
