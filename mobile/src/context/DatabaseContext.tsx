import React, { createContext, useContext, useEffect, useState } from 'react';
import { OfflineStorage } from '../services/OfflineStorage';

interface DatabaseContextType {
  storage: OfflineStorage;
  isInitialized: boolean;
  error: string | null;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

export function useDatabase(): DatabaseContextType {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
}

interface DatabaseProviderProps {
  children: React.ReactNode;
}

export function DatabaseProvider({ children }: DatabaseProviderProps) {
  const [storage] = useState(() => new OfflineStorage());
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeDatabase = async () => {
      try {
        // The storage initializes itself in the constructor
        // We just need to wait a bit for it to complete
        await new Promise(resolve => setTimeout(resolve, 100));
        setIsInitialized(true);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Database initialization failed');
        console.error('Database initialization error:', err);
      }
    };

    initializeDatabase();
  }, [storage]);

  const value: DatabaseContextType = {
    storage,
    isInitialized,
    error,
  };

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
}