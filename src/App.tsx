import React from 'react';
import { AppProvider, useAppStore } from './lib/store';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';

const AppContent: React.FC = () => {
  const { user } = useAppStore();

  if (!user) {
    return <Login />;
  }

  return <Dashboard />;
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
