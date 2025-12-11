import React, { useEffect, useState } from 'react';
import { User, AppNotification } from '../types';
import { db } from '../lib/mockFirebase';
import { Bell, Trash2, CheckCircle } from 'lucide-react';

export default function Notifications({ user }: { user: User }) {
  const [list, setList] = useState<AppNotification[]>(user.notifications || []);

  useEffect(() => {
    // Mark as read when opening this tab
    db.markNotificationsRead(user.uid);
  }, [user.uid]);

  const handleClear = async () => {
    await db.clearNotifications(user.uid);
    setList([]);
    window.location.reload(); // Quick way to sync global state in this prototype
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden h-full flex flex-col">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <h2 className="font-bold text-slate-800 flex items-center gap-2">
          <Bell size={18} className="text-blue-600" />
          Notificações
        </h2>
        {list.length > 0 && (
          <button onClick={handleClear} className="text-xs text-red-500 font-bold flex items-center gap-1 hover:text-red-600">
            <Trash2 size={14} /> Limpar Tudo
          </button>
        )}
      </div>

      <div className="overflow-y-auto p-4 space-y-3 flex-1">
        {list.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Bell size={24} className="text-slate-300" />
            </div>
            <p className="text-sm">Nenhuma notificação nova.</p>
          </div>
        ) : (
          list.map((notif) => (
            <div key={notif.id} className="p-4 bg-white border border-slate-100 rounded-xl shadow-sm animate-fade-in relative">
              {!notif.read && <span className="absolute top-4 right-4 w-2 h-2 bg-blue-600 rounded-full"></span>}
              <p className="text-slate-800 text-sm leading-relaxed">{notif.message}</p>
              <p className="text-[10px] text-slate-400 mt-2 font-medium">
                {new Date(notif.date).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}