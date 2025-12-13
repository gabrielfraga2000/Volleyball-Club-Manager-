import React, { useEffect, useState } from 'react';
import { User, AppNotification } from '../types';
import { db } from '../lib/api';
import { Bell, Trash2, X } from 'lucide-react';

interface NotificationsProps {
    user: User;
    isOpen: boolean;
    onClose: () => void;
}

export default function Notifications({ user, isOpen, onClose }: NotificationsProps) {
  const [list, setList] = useState<AppNotification[]>(user.notifications || []);

  useEffect(() => {
    setList(user.notifications || []);
    
    // Marca como lido automaticamente ao abrir o modal
    if (isOpen && user.notifications?.some(n => !n.read)) {
        db.markNotificationsRead(user.uid);
    }
  }, [user.notifications, user.uid, isOpen]);

  const handleClear = async () => {
    setList([]);
    await db.clearNotifications(user.uid);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-end sm:items-start sm:justify-end p-4 pointer-events-none">
        {/* Backdrop invisível para fechar ao clicar fora, mas permitindo interações em telas grandes se necessário */}
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm pointer-events-auto" onClick={onClose}></div>

        <div 
            className="bg-white dark:bg-slate-800 w-full max-w-sm max-h-[70vh] rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col pointer-events-auto animate-fade-in relative z-10 mb-20 sm:mb-0 sm:mt-16"
            onClick={e => e.stopPropagation()}
        >
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-700/30">
                <h2 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Bell size={18} className="text-blue-600 dark:text-blue-400" />
                Notificações
                </h2>
                <div className="flex items-center gap-2">
                    {list.length > 0 && (
                    <button onClick={handleClear} className="text-xs text-red-500 font-bold flex items-center gap-1 hover:text-red-600 dark:text-red-400 mr-2">
                        <Trash2 size={14} /> Limpar
                    </button>
                    )}
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                        <X size={20} />
                    </button>
                </div>
            </div>

            <div className="overflow-y-auto p-4 space-y-3 flex-1 custom-scrollbar">
                {list.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Bell size={24} className="text-slate-300 dark:text-slate-500" />
                    </div>
                    <p className="text-sm">Nenhuma notificação nova.</p>
                </div>
                ) : (
                list.map((notif) => (
                    <div key={notif.id} className="p-4 bg-white dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600 rounded-xl shadow-sm relative transition-colors">
                    {!notif.read && <span className="absolute top-4 right-4 w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full"></span>}
                    <p className="text-slate-800 dark:text-slate-200 text-sm leading-relaxed">{notif.message}</p>
                    <p className="text-[10px] text-slate-400 mt-2 font-medium">
                        {new Date(notif.date).toLocaleString()}
                    </p>
                    </div>
                ))
                )}
            </div>
        </div>
    </div>
  );
}