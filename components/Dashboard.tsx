import React, { useState, useEffect, useCallback } from 'react';
import { User, GameSession } from '../types';
import { db } from '../lib/mockFirebase';
import GameLists from './GameLists';
import AdminPanel from './AdminPanel';
import Notifications from './Notifications';
import { User as UserIcon, Calendar, Bell, LogOut, Shield, RefreshCw, Save, Sun } from 'lucide-react';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

export default function Dashboard({ user: initialUser, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'lists' | 'notifications'>('lists');
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  
  // Find the most up-to-date version of the current user from the polled list
  const liveUser = allUsers.find(u => u.uid === initialUser.uid) || initialUser;
  
  // Profile Edit State
  const [nickname, setNickname] = useState(liveUser.nickname || liveUser.fullName);
  const [savingProfile, setSavingProfile] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Role 2 is Admin. Role 3 is Dev.
  const isAdminOrDev = liveUser.role === 2 || liveUser.role === 3;
  const isDev = liveUser.role === 3;

  const loadData = useCallback(() => {
    setSessions(db.getSessions());
    setAllUsers(db.getUsers());
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleUpdateProfile = async () => {
    setSavingProfile(true);
    try {
        await db.updateProfile(liveUser.uid, { nickname });
        // Force refresh is handled by next interval or simple alert for now
    } catch (e: any) {
        alert("Erro ao salvar perfil");
    } finally {
        setSavingProfile(false);
    }
  };

  // Count unread notifications using live data
  const unreadCount = liveUser.notifications?.filter(n => !n.read).length || 0;

  if (liveUser.role === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-900 text-center transition-colors">
        <div className="w-full max-w-sm bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700">
          <Shield size={40} className="text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Conta Pendente</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">Aguardando aprovação do Ademiro.</p>
          <button onClick={onLogout} className="w-full py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600">
            Voltar ao Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      
      {/* Top Navigation - Yellow/Black Theme */}
      <div className="bg-white dark:bg-slate-800 border-b border-yellow-200 dark:border-yellow-500/30 px-4 py-3 flex justify-between items-center sticky top-0 z-30 transition-colors">
        <h1 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2 tracking-tight uppercase">
          {!imgError ? (
            <img 
              src="./mascote.png" 
              alt="Logo" 
              className="w-8 h-8 object-contain"
              onError={() => setImgError(true)}
            />
          ) : (
             <Sun size={24} className="text-yellow-500 fill-yellow-400" />
          )}
          Manhãzinha
        </h1>
        <div className="flex items-center gap-3">
          {isAdminOrDev && (
             <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase flex items-center gap-1 ${isDev ? 'bg-indigo-900 text-white dark:bg-indigo-500' : 'bg-slate-900 text-yellow-400 dark:bg-yellow-400 dark:text-slate-900'}`}>
               {isDev ? 'DEV' : 'ADEMIRO'}
             </span>
          )}
          <button onClick={onLogout} className="p-2 text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400">
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto pb-20">
        
        {/* TAB: PROFILE */}
        {activeTab === 'profile' && (
          <div className="p-4 space-y-4">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center transition-colors">
              <div className="w-24 h-24 bg-yellow-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-yellow-600 dark:text-yellow-400 text-3xl font-bold mb-3 border-4 border-white dark:border-slate-600 shadow-md">
                {liveUser.fullName.charAt(0)}
              </div>
              
              <div className="w-full mb-4">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">Nome de Exibição (Lista)</label>
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={nickname} 
                        maxLength={16}
                        onChange={e => setNickname(e.target.value)}
                        className="flex-1 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-slate-800 text-sm focus:ring-2 focus:ring-yellow-400 outline-none transition-colors"
                    />
                    <button 
                        onClick={handleUpdateProfile}
                        disabled={savingProfile}
                        className="bg-yellow-400 text-slate-900 p-2 rounded-lg hover:bg-yellow-500 disabled:opacity-50"
                    >
                        <Save size={18} />
                    </button>
                </div>
                <div className="flex justify-between mt-1">
                  <p className="text-[10px] text-slate-400">Como aparecerá na lista.</p>
                  <p className="text-[10px] text-slate-400">{nickname.length}/16</p>
                </div>
              </div>

              <h2 className="text-sm font-bold text-slate-400 dark:text-slate-500">{liveUser.fullName}</h2>
              <p className="text-slate-400 dark:text-slate-500 text-xs">{liveUser.email}</p>
              
              <div className="grid grid-cols-2 gap-4 w-full mt-6">
                <div className="bg-slate-50 dark:bg-slate-700 p-3 rounded-xl text-center border border-slate-100 dark:border-slate-600 transition-colors">
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">{liveUser.stats.gamesAttended}</div>
                  <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400">Jogos</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700 p-3 rounded-xl text-center border border-slate-100 dark:border-slate-600 transition-colors">
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">{liveUser.stats.gamesMissed}</div>
                  <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400">Ausências</div>
                </div>
              </div>
            </div>

            {isAdminOrDev && <AdminPanel currentUser={liveUser} />}
          </div>
        )}

        {/* TAB: LISTS */}
        {activeTab === 'lists' && (
          <div className="p-4 space-y-4">
            {/* Pass allUsers to allow guest mapping to nicknames */}
            <GameLists sessions={sessions} currentUser={liveUser} onRefresh={loadData} allUsers={allUsers} />
          </div>
        )}

        {/* TAB: NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <div className="p-4 h-full">
             <Notifications user={liveUser} />
          </div>
        )}

      </div>

      {/* Bottom Tab Bar */}
      <div className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-around p-2 pb-safe fixed bottom-0 left-0 right-0 z-40 transition-colors">
        <button 
          onClick={() => setActiveTab('lists')}
          className={`flex flex-col items-center p-2 rounded-xl flex-1 transition-colors ${activeTab === 'lists' ? 'text-yellow-600 dark:text-yellow-400' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`}
        >
          <Calendar size={24} />
          <span className="text-[10px] font-bold mt-1">Jogos</span>
        </button>
        <button 
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center p-2 rounded-xl flex-1 transition-colors ${activeTab === 'profile' ? 'text-yellow-600 dark:text-yellow-400' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`}
        >
          <UserIcon size={24} />
          <span className="text-[10px] font-bold mt-1">Perfil</span>
        </button>
        <button 
          onClick={() => setActiveTab('notifications')}
          className={`flex flex-col items-center p-2 rounded-xl flex-1 relative transition-colors ${activeTab === 'notifications' ? 'text-yellow-600 dark:text-yellow-400' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`}
        >
          <div className="relative">
            <Bell size={24} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-800">
                {unreadCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold mt-1">Avisos</span>
        </button>
      </div>
    </div>
  );
}