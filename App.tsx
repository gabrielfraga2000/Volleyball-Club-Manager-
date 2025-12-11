import React, { useState, useEffect } from 'react';
import { db } from './lib/mockFirebase';
import { User } from './types';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
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
      {!currentUser ? (
        <Auth onSuccess={handleLoginSuccess} />
      ) : (
        <Dashboard user={currentUser} onLogout={handleLogout} />
      )}
    </>
  );
}