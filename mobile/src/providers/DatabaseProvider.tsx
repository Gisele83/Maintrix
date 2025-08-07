import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SQLite from 'expo-sqlite';

interface DatabaseContextType {
  db: SQLite.WebSQLDatabase | null;
  initializeDatabase: () => Promise<void>;
  isReady: boolean;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<SQLite.WebSQLDatabase | null>(null);
  const [isReady, setIsReady] = useState(false);

  const initializeDatabase = async () => {
    try {
      const database = SQLite.openDatabase('smart_gmao_diagfix.db');
      
      // Create tables for offline functionality
      database.transaction((tx) => {
        // Equipment table
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS equipment (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            equipment_id TEXT UNIQUE,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            location TEXT,
            status TEXT DEFAULT 'operational',
            last_maintenance DATE,
            next_maintenance DATE,
            qr_code TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            synced INTEGER DEFAULT 0
          );
        `);

        // Maintenance cases table (offline diagnostic data)
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS maintenance_cases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            equipment_type TEXT NOT NULL,
            symptoms TEXT NOT NULL,
            diagnosis TEXT NOT NULL,
            solution TEXT NOT NULL,
            urgency TEXT NOT NULL,
            confidence REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // Repair procedures table
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS repair_procedures (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            case_id INTEGER,
            step_number INTEGER,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            safety_warning TEXT,
            tools_required TEXT,
            estimated_time INTEGER,
            is_completed INTEGER DEFAULT 0,
            FOREIGN KEY (case_id) REFERENCES maintenance_cases (id)
          );
        `);

        // Work orders table
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS work_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            equipment_id TEXT,
            priority TEXT DEFAULT 'medium',
            status TEXT DEFAULT 'pending',
            assigned_technician TEXT,
            created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            scheduled_date DATETIME,
            completed_date DATETIME,
            notes TEXT,
            synced INTEGER DEFAULT 0
          );
        `);

        // Offline diagnostic sessions
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS diagnostic_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            equipment_type TEXT NOT NULL,
            symptoms TEXT NOT NULL,
            results TEXT,
            confidence REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            synced INTEGER DEFAULT 0
          );
        `);

        // User preferences
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS user_preferences (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
          );
        `);
      });

      setDb(database);
      setIsReady(true);
    } catch (error) {
      console.error('Error initializing database:', error);
    }
  };

  useEffect(() => {
    initializeDatabase();
  }, []);

  const value = {
    db,
    initializeDatabase,
    isReady,
  };

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (context === undefined) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
}