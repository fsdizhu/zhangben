import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { ViewType } from './types';
import LoginPage from './components/LoginPage';
import Sidebar from './components/Sidebar';
import EntryForm from './components/EntryForm';
import EntryList from './components/EntryList';
import ParserPanel from './components/ParserPanel';
import ExportPanel from './components/ExportPanel';
import StatsPanel from './components/StatsPanel';
import ConfigPanel from './components/ConfigPanel';
import UserPanel from './components/UserPanel';

export default function App() {
  const { isAuthenticated, loading } = useAuth();
  const [currentView, setCurrentView] = useState<ViewType>('entry-form');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const renderContent = () => {
    switch (currentView) {
      case 'entry-form':
        return <EntryForm />;
      case 'entry-list':
        return <EntryList />;
      case 'parser':
        return <ParserPanel />;
      case 'export':
        return <ExportPanel />;
      case 'stats':
        return <StatsPanel />;
      case 'config':
        return <ConfigPanel />;
      case 'users':
        return <UserPanel />;
      default:
        return <EntryForm />;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      <main className="flex-1 overflow-auto">
        {renderContent()}
      </main>
    </div>
  );
}
