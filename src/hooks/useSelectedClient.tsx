import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getLastClientId, saveLastClient, clearLastClient, isClientValid } from '@/lib/clientStorage';

interface SelectedClientContextType {
  selectedClientId: string | null;
  setSelectedClientId: (id: string | null) => void;
}

const SelectedClientContext = createContext<SelectedClientContextType | undefined>(undefined);

export function SelectedClientProvider({ children }: { children: ReactNode }) {
  const [selectedClientId, setSelectedClientIdState] = useState<string | null>(() => {
    return getLastClientId();
  });

  const setSelectedClientId = useCallback((id: string | null) => {
    setSelectedClientIdState(id);
    if (id) {
      // Save only ID; name will be resolved by the component displaying it
      saveLastClient({ id, name: '' });
    } else {
      clearLastClient();
    }
  }, []);

  return (
    <SelectedClientContext.Provider value={{ selectedClientId, setSelectedClientId }}>
      {children}
    </SelectedClientContext.Provider>
  );
}

export function useSelectedClient() {
  const context = useContext(SelectedClientContext);
  if (!context) {
    throw new Error('useSelectedClient must be used within a SelectedClientProvider');
  }
  return context;
}
