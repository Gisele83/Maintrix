import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as SQLite from 'expo-sqlite';

interface DatabaseContextType {
  db: SQLite.WebSQLDatabase | null;
  isReady: boolean;
  initializeDatabase: () => Promise<void>;
  executeQuery: (sql: string, params?: any[]) => Promise<any>;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

export const useDatabase = () => {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
};

interface DatabaseProviderProps {
  children: ReactNode;
}

export const DatabaseProvider: React.FC<DatabaseProviderProps> = ({ children }) => {
  const [db, setDb] = useState<SQLite.WebSQLDatabase | null>(null);
  const [isReady, setIsReady] = useState(false);

  const initializeDatabase = async () => {
    try {
      const database = SQLite.openDatabase('maintrix_db.db');
      
      // Create tables
      await new Promise<void>((resolve, reject) => {
        database.transaction((tx) => {
          // Diagnostics table
          tx.executeSql(`
            CREATE TABLE IF NOT EXISTS diagnostics (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              equipment_type TEXT NOT NULL,
              equipment_id TEXT,
              symptoms TEXT NOT NULL,
              zone TEXT,
              sector TEXT,
              urgency_level TEXT,
              ml_mode TEXT DEFAULT 'standard',
              suggestions TEXT,
              confidence_score REAL,
              risk_level TEXT,
              estimated_cost REAL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              synced INTEGER DEFAULT 0
            );
          `);

          // Repair procedures table
          tx.executeSql(`
            CREATE TABLE IF NOT EXISTS repair_procedures (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              diagnostic_id INTEGER,
              procedure_steps TEXT NOT NULL,
              tools_required TEXT,
              safety_warnings TEXT,
              estimated_duration INTEGER,
              completed INTEGER DEFAULT 0,
              progress TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (diagnostic_id) REFERENCES diagnostics (id)
            );
          `);

          // Feedback table
          tx.executeSql(`
            CREATE TABLE IF NOT EXISTS feedback (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              diagnostic_id INTEGER,
              rating INTEGER,
              accuracy_rating INTEGER,
              time_saved INTEGER,
              comments TEXT,
              suggestions TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              synced INTEGER DEFAULT 0,
              FOREIGN KEY (diagnostic_id) REFERENCES diagnostics (id)
            );
          `);

          // Offline data cache table
          tx.executeSql(`
            CREATE TABLE IF NOT EXISTS offline_cache (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              key TEXT UNIQUE NOT NULL,
              data TEXT NOT NULL,
              expires_at DATETIME,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
          `);

          // User settings table
          tx.executeSql(`
            CREATE TABLE IF NOT EXISTS user_settings (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              key TEXT UNIQUE NOT NULL,
              value TEXT NOT NULL,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
          `);
        }, reject, resolve);
      });

      setDb(database);
      setIsReady(true);
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', error);
    }
  };

  const executeQuery = async (sql: string, params: any[] = []): Promise<any> => {
    if (!db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      db.transaction((tx) => {
        tx.executeSql(
          sql,
          params,
          (_, result) => resolve(result),
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  };

  useEffect(() => {
    initializeDatabase();
  }, []);

  return (
    <DatabaseContext.Provider value={{ db, isReady, initializeDatabase, executeQuery }}>
      {children}
    </DatabaseContext.Provider>
  );
};