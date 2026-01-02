import React, { createContext, useContext, useState } from 'react';

interface ApiKeyDialogContextType {
  showDialog: boolean;
  openDialog: () => void;
  closeDialog: () => void;
}

const ApiKeyDialogContext = createContext<ApiKeyDialogContextType | undefined>(undefined);

export function ApiKeyDialogProvider({ children }: { children: React.ReactNode }) {
  const [showDialog, setShowDialog] = useState(false);
  const openDialog = () => setShowDialog(true);
  const closeDialog = () => setShowDialog(false);

  return (
    <ApiKeyDialogContext.Provider value={{ showDialog, openDialog, closeDialog }}>
      {children}
    </ApiKeyDialogContext.Provider>
  );
}

export function useApiKeyDialog() {
  const ctx = useContext(ApiKeyDialogContext);
  if (!ctx) throw new Error('useApiKeyDialog must be used within ApiKeyDialogProvider');
  return ctx;
}
