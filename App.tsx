import React, { useState, useEffect } from 'react';
import { db } from './lib/api'; // Mudança aqui
import { User } from './types';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import { Moon, Sun } from 'lucide-react';

const ThemeToggle = () => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('vg_theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDark(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('vg_theme', 'light');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('vg_theme', 'dark');
      setIsDark(true);
    }
  };

  return (
    <button 
      onClick={toggleTheme}
      className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-[60] p-3 rounded-full shadow-xl transition-all duration-300 
      bg-slate-800 text-yellow-400 hover:bg-slate-700 border border-slate-700
      dark:bg-yellow-400 dark:text-slate-900 dark:hover:bg-yellow-300 dark:border-yellow-500"
      aria-label="Alternar Tema"
    >
      {isDark ? <Sun size={20} fill="currentColor" /> : <Moon size={20} fill="currentColor" />}
    </button>
  );
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = db.getCurrentUser();
    if (user) {
      setCurrentUser(user);
    }
    setLoading(false);
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    db.logout();
    setCurrentUser(null);
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Carregando App...</div>;
  }

  return (
    <>
      <ThemeToggle />
      {!currentUser ? (
        <Auth onSuccess={handleLoginSuccess} />
      ) : (
        <Dashboard user={currentUser} onLogout={handleLogout} />
      )}
    </>
  );
}