import React, { useState, useEffect } from 'react';
import { db } from '../lib/mockFirebase';
import { User, SystemLog, ListPlayer, GameSession } from '../types';
import { CheckCircle, XCircle, FileText, Download, User as UserIcon, Users as UsersIcon, Eye, ShieldAlert, X, ChevronDown, ChevronUp, Calendar } from 'lucide-react';

// --- TimePicker Component (Shared Logic) ---
const TimePicker = ({ value, onChange, className = "" }: { value: string, onChange: (v: string) => void, className?: string }) => {
    const hours = Array.from({length: 24}, (_, i) => i.toString().padStart(2, '0'));
    const minutes = ['00', '10', '20', '30', '40', '50'];
    
    // Ensure value is HH:MM
    const [h, m] = (value && value.includes(':')) ? value.split(':') : ['', ''];

    const update = (newH: string, newM: string) => {
        onChange(`${newH}:${newM}`);
    };

    const baseSelectClass = "appearance-none w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded p-2 text-sm text-slate-700 dark:text-white outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-200 dark:focus:ring-yellow-500/30 transition-colors";

    return (
        <div className={`flex items-center gap-1 ${className}`}>
            <div className="relative flex-1">
                <select 
                    value={h} 
                    onChange={e => update(e.target.value, m || '00')}
                    className={baseSelectClass}
                    required
                >
                    {!h && <option value="" disabled>Hr</option>}
                    {hours.map(hh => <option key={hh} value={hh}>{hh}</option>)}
                </select>
            </div>
            <span className="text-slate-400 font-bold">:</span>
            <div className="relative flex-1">
                <select 
                    value={m} 
                    onChange={e => update(h || '00', e.target.value)}
                    className={baseSelectClass}
                    required
                >
                    {!m && <option value="" disabled>Min</option>}
                    {minutes.map(mm => <option key={mm} value={mm}>{mm}</option>)}
                </select>
            </div>
        </div>
    );
};

export default function AdminPanel({ currentUser }: { currentUser: User }) {
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [allSessions, setAllSessions] = useState<GameSession[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'create' | 'logs' | 'guests' | 'matches'>('create');
  
  // Inspect Modal State
  const [inspectUser, setInspectUser] = useState<User | null>(null);

  // Match History Expand State
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  // Changed guestDelayMinutes to specific date/time for guest window
  const [newList, setNewList] = useState({ 
    name: '', 
    date: '', 
    time: '', 
    maxSpots: 18, 
    guestDate: '',
    guestTime: ''
  });
  const [msg, setMsg] = useState("");

  const isDev = currentUser.role === 3;
  const isAdminOrDev = currentUser.role === 2 || currentUser.role === 3;

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = async () => {
    // We use the synchronous getters from db, but they rely on cache which needs to be refreshed.
    // However, Dashboard refreshes the cache every 3s.
    // For AdminPanel, let's force a refresh.
    const { users: u, sessions: s } = await db.refreshData();
    setUsers(u);
    setAllSessions(s);
    
    // Logs are separate
    const l = await db.getLogs();
    setLogs(l);

    // Refresh inspected user if open
    if (inspectUser) {
        const updated = u.find(u => u.uid === inspectUser.uid);
        if (updated) setInspectUser(updated);
    }
  }

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newList.maxSpots < 6) {
      alert("O número mínimo de vagas para criar uma lista é 6.");
      return;
    }

    if (newList.maxSpots > 30) {
      alert("O limite máximo de jogadores por lista é 30.");
      return;
    }
    
    if (!newList.time || !newList.guestTime) {
        alert("Preencha todos os horários.");
        return;
    }
    
    // Create timestamp from specific date and time inputs
    const guestWindowOpenTime = new Date(`${newList.guestDate}T${newList.guestTime}`).getTime();
    
    // Check if guest time is valid
    if (isNaN(guestWindowOpenTime)) {
        alert("Por favor, preencha a data e hora de abertura para convidados corretamente.");
        return;
    }

    await db.createSession({
      name: newList.name,
      date: newList.date,
      time: newList.time,
      maxSpots: newList.maxSpots,
      guestWindowOpenTime,
      createdBy: currentUser.uid
    });
    setMsg("Lista Criada com Sucesso!");
    setNewList({ name: '', date: '', time: '', maxSpots: 18, guestDate: '', guestTime: '' });
    refreshData();
    setTimeout(() => setMsg(""), 3000);
  };

  const toggleRole = async (uid: string, currentRole: number) => {
    // Only Dev can touch Admin(2) or Dev(3) roles usually, but for prototype:
    // User(1) <-> Pending(0) is standard admin.
    // If dev, can toggle to admin.
    if (!isDev && currentRole >= 2) return; 

    const newRole = currentRole === 0 ? 1 : (currentRole === 1 ? 0 : 0);
    await db.updateUserRole(uid, newRole as any);
    refreshData();
  };

  const forceChangeRole = async (uid: string, newRole: number) => {
      await db.updateUserRole(uid, newRole as any);
      refreshData();
  };

  const downloadLogs = () => {
    const textContent = logs.map(l => 
      `[${new Date(l.timestamp).toLocaleString()}] ${l.action} - ${l.details} (Por: ${l.authorName || 'Sistema'})`
    ).join('\n');
    
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `volley_logs_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleToggleAttendance = async (sessionId: string, userId: string, currentStatus: boolean) => {
    await db.togglePlayerAttendance(sessionId, userId, !currentStatus);
    refreshData();
  };

  // Helper to extract unique guests from all sessions
  const getGuestHistory = () => {
    const guestMap = new Map<string, {name: string, inviterId: string, sessions: number}>();
    
    allSessions.forEach(session => {
        const allPlayers = [...session.players, ...session.waitlist];
        allPlayers.forEach(p => {
            if (p.isGuest && p.linkedTo) {
                // Key: name + inviterId (assuming guest identity is tied to inviter)
                const key = `${p.name}-${p.linkedTo}`;
                if (!guestMap.has(key)) {
                    guestMap.set(key, { name: p.name, inviterId: p.linkedTo, sessions: 0 });
                }
                const entry = guestMap.get(key)!;
                entry.sessions++;
            }
        });
    });
    return Array.from(guestMap.values());
  };

  const getInviterName = (id: string) => {
      const u = users.find(user => user.uid === id);
      return u ? (u.nickname || u.fullName) : 'Desconhecido';
  };

  // Convert ddmmaaaa to yyyy-mm-dd for input date value
  const formatDobForInput = (dob: string) => {
    if (!dob || dob.length !== 8) return '';
    const d = dob.slice(0, 2);
    const m = dob.slice(2, 4);
    const y = dob.slice(4, 8);
    return `${y}-${m}-${d}`;
  };

  const formatPhone = (phone: string) => {
      if (!phone) return "";
      const cleaned = phone.replace(/\D/g, '');
      if (cleaned.length === 11) {
          return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
      }
      if (cleaned.length === 10) {
          return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
      }
      return phone;
  };

  return (
    <div className="space-y-6 mt-8 border-t border-slate-200 dark:border-slate-700 pt-8 relative transition-colors">
      <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
        Painel do {isDev ? 'DEV' : 'ADEMIRO'}
      </h2>

      {/* Admin Sub-Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
        <button 
          onClick={() => setActiveSubTab('create')}
          className={`px-3 py-1 text-xs font-bold rounded-full ${activeSubTab === 'create' ? 'bg-slate-900 dark:bg-yellow-400 text-yellow-400 dark:text-slate-900' : 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700'}`}
        >
          Criar Lista
        </button>
        
        <button 
           onClick={() => setActiveSubTab('users')}
           className={`px-3 py-1 text-xs font-bold rounded-full ${activeSubTab === 'users' ? 'bg-slate-900 dark:bg-yellow-400 text-yellow-400 dark:text-slate-900' : 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700'}`}
        >
          Jogadores
        </button>

        {/* Matches Tab */}
        {isAdminOrDev && (
            <button 
            onClick={() => setActiveSubTab('matches')}
            className={`px-3 py-1 text-xs font-bold rounded-full ${activeSubTab === 'matches' ? 'bg-slate-900 dark:bg-yellow-400 text-yellow-400 dark:text-slate-900' : 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700'}`}
            >
            Partidas
            </button>
        )}

        <button 
           onClick={() => setActiveSubTab('guests')}
           className={`px-3 py-1 text-xs font-bold rounded-full ${activeSubTab === 'guests' ? 'bg-slate-900 dark:bg-yellow-400 text-yellow-400 dark:text-slate-900' : 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700'}`}
        >
          Convidados
        </button>
        
        {isDev && (
            <button 
            onClick={() => { setActiveSubTab('logs'); refreshData(); }}
            className={`px-3 py-1 text-xs font-bold rounded-full ${activeSubTab === 'logs' ? 'bg-slate-900 dark:bg-yellow-400 text-yellow-400 dark:text-slate-900' : 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700'}`}
            >
            Logs / Auditoria
            </button>
        )}
      </div>
      
      {/* Create List */}
      {activeSubTab === 'create' && (
        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 animate-fade-in transition-colors">
          <h3 className="font-bold text-slate-900 dark:text-white mb-4">Nova Lista</h3>
          <form onSubmit={handleCreateList} className="space-y-3">
            <input required placeholder="Local (ex: Ginásio Municipal)" 
              className="w-full p-2 rounded text-sm border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400" 
              value={newList.name} onChange={e => setNewList({...newList, name: e.target.value})} />
            
            <div className="bg-white dark:bg-slate-700 p-2 rounded border border-slate-200 dark:border-slate-600">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Horário do Jogo</p>
                <div className="grid grid-cols-2 gap-2">
                    <input required type="date" className="p-2 rounded text-sm bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 text-slate-900 dark:text-white w-full" 
                        value={newList.date} onChange={e => setNewList({...newList, date: e.target.value})} />
                    
                    <TimePicker value={newList.time} onChange={v => setNewList({...newList, time: v})} />
                </div>
            </div>

            <div className="bg-white dark:bg-slate-700 p-2 rounded border border-slate-200 dark:border-slate-600">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Liberação para Convidados</p>
                <div className="grid grid-cols-2 gap-2">
                    <input required type="date" className="p-2 rounded text-sm bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 text-slate-900 dark:text-white w-full" 
                        value={newList.guestDate} onChange={e => setNewList({...newList, guestDate: e.target.value})} />
                    
                    <TimePicker value={newList.guestTime} onChange={v => setNewList({...newList, guestTime: v})} />
                </div>
            </div>

            <div>
                <label className="text-xs text-slate-700 dark:text-slate-400 font-bold">Vagas (Máx. 30 - Min. 6)</label>
                <input type="number" min="6" max="30" 
                    className="w-full p-2 rounded text-sm border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white" 
                    value={newList.maxSpots} onChange={e => setNewList({...newList, maxSpots: parseInt(e.target.value)})} />
            </div>

            <button className="w-full bg-slate-900 dark:bg-yellow-400 text-yellow-400 dark:text-slate-900 py-2 rounded font-bold hover:bg-slate-800 dark:hover:bg-yellow-300">Criar Sessão</button>
            {msg && <p className="text-green-600 text-xs text-center">{msg}</p>}
          </form>
        </div>
      )}

      {/* MATCH HISTORY TAB */}
      {activeSubTab === 'matches' && isAdminOrDev && (
        <div className="space-y-4 animate-fade-in">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Calendar size={18}/> Histórico e Presença
            </h3>
            {allSessions.length === 0 && <p className="text-slate-400 text-sm">Nenhuma sessão registrada.</p>}
            
            {allSessions.map(session => (
                <div key={session.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden transition-colors">
                    <div 
                        onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                        className="p-3 bg-slate-50 dark:bg-slate-700/50 flex justify-between items-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                        <div>
                            <div className="font-bold text-slate-800 dark:text-white text-sm">{session.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                {new Date(session.date).toLocaleDateString()} @ {session.time} • {session.players.length} Jogadores
                            </div>
                        </div>
                        {expandedSession === session.id ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}
                    </div>

                    {expandedSession === session.id && (
                        <div className="p-3 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800">
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Lista Principal</p>
                                {session.players.length === 0 && <p className="text-xs text-slate-300 italic">Vazia</p>}
                                {session.players.map(p => (
                                    <div key={p.userId} className="flex justify-between items-center py-1 border-b border-slate-50 dark:border-slate-700 last:border-0">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${p.attended ? 'bg-green-500' : 'bg-red-200 dark:bg-red-900'}`}></div>
                                            <span className={`text-sm ${p.attended ? 'text-slate-800 dark:text-slate-200 font-medium' : 'text-slate-500 dark:text-slate-500'}`}>
                                                {p.name} {p.isGuest && <span className="text-[10px] text-indigo-500 dark:text-indigo-400">(Convidado)</span>}
                                                {p.arrivalEstimate && <span className="text-[10px] text-slate-400 ml-1">@{p.arrivalEstimate}</span>}
                                            </span>
                                        </div>
                                        <label className="flex items-center gap-2 cursor-pointer select-none">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold">{p.attended ? 'Presente' : 'Ausente'}</span>
                                            <input 
                                                type="checkbox" 
                                                checked={!!p.attended} 
                                                onChange={() => handleToggleAttendance(session.id, p.userId, !!p.attended)}
                                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                            />
                                        </label>
                                    </div>
                                ))}
                            </div>
                            
                            {session.waitlist.length > 0 && (
                                <div className="mt-4 space-y-1">
                                     <p className="text-[10px] font-bold text-orange-400 uppercase mb-2">Lista de Espera</p>
                                     {session.waitlist.map(p => (
                                        <div key={p.userId} className="flex justify-between items-center py-1">
                                            <span className="text-sm text-orange-800/60 dark:text-orange-300/60">{p.name}</span>
                                            <span className="text-[10px] text-slate-300">Em espera</span>
                                        </div>
                                     ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
      )}

      {/* ALL Users List (Jogadores) */}
      {activeSubTab === 'users' && (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 animate-fade-in transition-colors">
          <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><UserIcon size={16}/> Nomes ({users.length})</h3>
          <div className="space-y-2 h-64 overflow-y-auto custom-scrollbar">
            {users.map(u => (
              <div key={u.uid} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-700/50 rounded border border-slate-100 dark:border-slate-600">
                <div className="flex-1 overflow-hidden mr-2">
                  <div className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">
                      {u.nickname || u.fullName}
                      {u.role === 0 && <span className="ml-2 text-[10px] bg-yellow-100 text-yellow-700 px-1 rounded">PENDENTE</span>}
                      {u.role === 2 && <span className="ml-2 text-[10px] bg-slate-800 text-yellow-400 px-1 rounded">ADEMIRO</span>}
                      {u.role === 3 && <span className="ml-2 text-[10px] bg-indigo-900 text-white px-1 rounded">DEV</span>}
                  </div>
                  {/* Changed Email to Phone as requested, now with Formatting */}
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{formatPhone(u.phone)}</div>
                </div>

                {/* Games Counter Column */}
                <div className="mx-2 text-center w-16">
                     <div className="text-xs font-bold text-slate-800 dark:text-slate-300">{u.stats.gamesAttended}</div>
                     <div className="text-[9px] text-slate-400 uppercase">Jogos</div>
                </div>

                <div className="flex gap-2">
                    {u.role === 0 && (
                        <button onClick={() => toggleRole(u.uid, u.role)} className="bg-green-100 text-green-700 px-3 py-1 rounded text-xs font-bold hover:bg-green-200">
                        Aprovar
                        </button>
                    )}
                    {/* Dev Only: Inspect Button */}
                    {isDev && (
                        <button onClick={() => setInspectUser(u)} className="p-2 bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-500 rounded transition-colors" title="Inspecionar">
                            <Eye size={16} />
                        </button>
                    )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Guest History Tab */}
      {activeSubTab === 'guests' && (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 animate-fade-in transition-colors">
           <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><UsersIcon size={16}/> Histórico de Convidados</h3>
           <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Lista de todos os convidados que já foram inseridos em listas, permitindo marcar presença manual.</p>
           
           <div className="space-y-2 h-64 overflow-y-auto custom-scrollbar">
             {getGuestHistory().length === 0 && <p className="text-slate-400 text-xs">Nenhum convidado registrado no histórico.</p>}
             {getGuestHistory().map((guest, idx) => (
               <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-700/50 rounded border border-slate-100 dark:border-slate-600">
                 <div>
                   <div className="font-bold text-sm text-slate-800 dark:text-slate-200">{guest.name}</div>
                   <div className="text-xs text-slate-500 dark:text-slate-400">Resp: {getInviterName(guest.inviterId)} • {guest.sessions} jogos</div>
                 </div>
                 <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded text-blue-600" />
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-bold">Presente?</span>
                 </label>
               </div>
             ))}
           </div>
        </div>
      )}

      {/* Logs View (Dev Only) */}
      {activeSubTab === 'logs' && isDev && (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 animate-fade-in transition-colors">
          <div className="flex justify-between items-center mb-4">
             <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
               <FileText size={18} />
               Log de Atividades (Acesso Dev)
             </h3>
             <button onClick={downloadLogs} className="text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300 px-3 py-1 rounded flex items-center gap-1">
               <Download size={12} />
               Baixar .txt
             </button>
          </div>
          <div className="h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {logs.length === 0 && <p className="text-slate-400 text-sm text-center">Nenhum registro encontrado.</p>}
            {logs.map(log => (
              <div key={log.id} className="p-2 border-b border-slate-100 dark:border-slate-700 text-xs hover:bg-slate-50 dark:hover:bg-slate-700/50">
                <div className="flex justify-between text-slate-400 dark:text-slate-500 mb-1">
                  <span>{new Date(log.timestamp).toLocaleString()}</span>
                  <span className="font-bold text-slate-600 dark:text-slate-300">{log.action}</span>
                </div>
                <div className="text-slate-800 dark:text-slate-200">
                  {log.details}
                </div>
                {log.authorName && <div className="text-slate-400 mt-1 italic">Por: {log.authorName}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DEV INSPECTOR MODAL */}
      {inspectUser && isDev && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 bg-slate-800 dark:bg-slate-900 text-white flex justify-between items-center">
                    <h3 className="font-bold flex items-center gap-2"><ShieldAlert size={18}/> Inspetor DEV</h3>
                    <button onClick={() => setInspectUser(null)} className="text-slate-400 hover:text-white"><X size={20}/></button>
                </div>
                
                <div className="p-4 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                    
                    <div className="flex items-center gap-4 border-b border-slate-100 dark:border-slate-700 pb-4">
                        <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold text-xl">
                            {inspectUser.fullName.charAt(0)}
                        </div>
                        <div>
                            <h2 className="font-bold text-lg dark:text-white">{inspectUser.fullName}</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{inspectUser.uid}</p>
                            <p className="text-sm text-slate-600 dark:text-slate-300">{inspectUser.email}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 dark:bg-slate-700 p-2 rounded border border-slate-200 dark:border-slate-600">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Telefone</label>
                            <div className="text-sm font-medium dark:text-slate-200">{formatPhone(inspectUser.phone)}</div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-700 p-2 rounded border border-slate-200 dark:border-slate-600">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Data Nasc.</label>
                            {/* Converted text to date input as requested */}
                            <input 
                              type="date" 
                              disabled 
                              value={formatDobForInput(inspectUser.dob)}
                              className="w-full bg-transparent text-sm font-medium dark:text-slate-200 outline-none" 
                            />
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-700 p-2 rounded border border-slate-200 dark:border-slate-600">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Jogos</label>
                            <div className="text-sm font-medium dark:text-slate-200">{inspectUser.stats.gamesAttended}</div>
                        </div>
                         <div className="bg-slate-50 dark:bg-slate-700 p-2 rounded border border-slate-200 dark:border-slate-600">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Criado em</label>
                            <div className="text-xs font-medium dark:text-slate-200">{new Date(inspectUser.createdAt).toLocaleDateString()}</div>
                        </div>
                    </div>

                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded border border-yellow-100 dark:border-yellow-900/30">
                        <h4 className="text-xs font-bold text-yellow-800 dark:text-yellow-400 uppercase mb-2">Permissões (Forçar)</h4>
                        <div className="flex gap-2">
                             <button onClick={() => forceChangeRole(inspectUser.uid, 1)} className={`flex-1 py-1 text-xs font-bold rounded ${inspectUser.role === 1 ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-700 border dark:border-slate-600 dark:text-slate-300'}`}>User</button>
                             <button onClick={() => forceChangeRole(inspectUser.uid, 2)} className={`flex-1 py-1 text-xs font-bold rounded ${inspectUser.role === 2 ? 'bg-purple-600 text-white' : 'bg-white dark:bg-slate-700 border dark:border-slate-600 dark:text-slate-300'}`}>Admin</button>
                             <button onClick={() => forceChangeRole(inspectUser.uid, 3)} className={`flex-1 py-1 text-xs font-bold rounded ${inspectUser.role === 3 ? 'bg-indigo-900 text-white' : 'bg-white dark:bg-slate-700 border dark:border-slate-600 dark:text-slate-300'}`}>Dev</button>
                             <button onClick={() => forceChangeRole(inspectUser.uid, 0)} className={`flex-1 py-1 text-xs font-bold rounded ${inspectUser.role === 0 ? 'bg-yellow-500 text-white' : 'bg-white dark:bg-slate-700 border dark:border-slate-600 dark:text-slate-300'}`}>Pend</button>
                        </div>
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-700 pt-2">
                        <h4 className="text-xs font-bold text-slate-400 mb-2">Raw Data (JSON)</h4>
                        <pre className="bg-slate-900 text-green-400 p-2 rounded text-[10px] overflow-x-auto">
                            {JSON.stringify(inspectUser, null, 2)}
                        </pre>
                    </div>

                </div>
            </div>
        </div>
      )}
    </div>
  );
}