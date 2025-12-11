import React, { useState, useEffect } from 'react';
import { db } from '../lib/mockFirebase';
import { User, SystemLog, ListPlayer, GameSession } from '../types';
import { CheckCircle, XCircle, FileText, Download, User as UserIcon, Users as UsersIcon, Eye, ShieldAlert, X, ChevronDown, ChevronUp, Calendar } from 'lucide-react';

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
    setUsers(db.getUsers());
    setLogs(db.getLogs());
    setAllSessions(db.getSessions());
  }, []);

  const refreshData = () => {
    setUsers(db.getUsers());
    setLogs(db.getLogs());
    setAllSessions(db.getSessions());
    
    // Refresh inspected user if open
    if (inspectUser) {
        const updated = db.getUsers().find(u => u.uid === inspectUser.uid);
        if (updated) setInspectUser(updated);
    }
  }

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newList.maxSpots < 6) {
      alert("O número mínimo de vagas para criar uma lista é 6.");
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

  return (
    <div className="space-y-6 mt-8 border-t border-slate-200 pt-8 relative">
      <h2 className="text-lg font-bold text-purple-800 flex items-center gap-2">
        Painel de Controle {isDev ? '(DEV)' : '(Admin)'}
      </h2>

      {/* Admin Sub-Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-purple-100 pb-2">
        <button 
          onClick={() => setActiveSubTab('create')}
          className={`px-3 py-1 text-xs font-bold rounded-full ${activeSubTab === 'create' ? 'bg-purple-600 text-white' : 'text-purple-600 bg-purple-50'}`}
        >
          Criar Lista
        </button>
        
        <button 
           onClick={() => setActiveSubTab('users')}
           className={`px-3 py-1 text-xs font-bold rounded-full ${activeSubTab === 'users' ? 'bg-purple-600 text-white' : 'text-purple-600 bg-purple-50'}`}
        >
          Jogadores
        </button>

        {/* Matches Tab */}
        {isAdminOrDev && (
            <button 
            onClick={() => setActiveSubTab('matches')}
            className={`px-3 py-1 text-xs font-bold rounded-full ${activeSubTab === 'matches' ? 'bg-purple-600 text-white' : 'text-purple-600 bg-purple-50'}`}
            >
            Partidas
            </button>
        )}

        <button 
           onClick={() => setActiveSubTab('guests')}
           className={`px-3 py-1 text-xs font-bold rounded-full ${activeSubTab === 'guests' ? 'bg-purple-600 text-white' : 'text-purple-600 bg-purple-50'}`}
        >
          Convidados
        </button>
        
        {isDev && (
            <button 
            onClick={() => { setActiveSubTab('logs'); refreshData(); }}
            className={`px-3 py-1 text-xs font-bold rounded-full ${activeSubTab === 'logs' ? 'bg-purple-600 text-white' : 'text-purple-600 bg-purple-50'}`}
            >
            Logs / Auditoria
            </button>
        )}
      </div>
      
      {/* Create List */}
      {activeSubTab === 'create' && (
        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 animate-fade-in">
          <h3 className="font-bold text-purple-900 mb-4">Nova Lista</h3>
          <form onSubmit={handleCreateList} className="space-y-3">
            <input required placeholder="Local (ex: Ginásio Municipal)" className="w-full p-2 rounded text-sm" 
              value={newList.name} onChange={e => setNewList({...newList, name: e.target.value})} />
            
            <div className="bg-white p-2 rounded border border-purple-100">
                <p className="text-xs font-bold text-purple-700 mb-1">Horário do Jogo</p>
                <div className="grid grid-cols-2 gap-2">
                    <input required type="date" className="p-2 rounded text-sm bg-slate-50 border border-slate-200 text-slate-700" 
                        value={newList.date} onChange={e => setNewList({...newList, date: e.target.value})} />
                    <input required type="time" className="p-2 rounded text-sm bg-slate-50 border border-slate-200 text-slate-700" 
                        value={newList.time} onChange={e => setNewList({...newList, time: e.target.value})} />
                </div>
            </div>

            <div className="bg-white p-2 rounded border border-purple-100">
                <p className="text-xs font-bold text-purple-700 mb-1">Liberação para Convidados</p>
                <div className="grid grid-cols-2 gap-2">
                    <input required type="date" className="p-2 rounded text-sm bg-slate-50 border border-slate-200 text-slate-700" 
                        value={newList.guestDate} onChange={e => setNewList({...newList, guestDate: e.target.value})} />
                    <input required type="time" className="p-2 rounded text-sm bg-slate-50 border border-slate-200 text-slate-700" 
                        value={newList.guestTime} onChange={e => setNewList({...newList, guestTime: e.target.value})} />
                </div>
            </div>

            <div>
                <label className="text-xs text-purple-700 font-bold">Vagas Máx. (Mínimo 6)</label>
                <input type="number" min="6" className="w-full p-2 rounded text-sm border border-slate-200" 
                    value={newList.maxSpots} onChange={e => setNewList({...newList, maxSpots: parseInt(e.target.value)})} />
            </div>

            <button className="w-full bg-purple-600 text-white py-2 rounded font-bold hover:bg-purple-500">Criar Sessão</button>
            {msg && <p className="text-green-600 text-xs text-center">{msg}</p>}
          </form>
        </div>
      )}

      {/* MATCH HISTORY TAB */}
      {activeSubTab === 'matches' && isAdminOrDev && (
        <div className="space-y-4 animate-fade-in">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Calendar size={18}/> Histórico e Presença
            </h3>
            {allSessions.length === 0 && <p className="text-slate-400 text-sm">Nenhuma sessão registrada.</p>}
            
            {allSessions.map(session => (
                <div key={session.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div 
                        onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                        className="p-3 bg-slate-50 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                        <div>
                            <div className="font-bold text-slate-800 text-sm">{session.name}</div>
                            <div className="text-xs text-slate-500">
                                {new Date(session.date).toLocaleDateString()} @ {session.time} • {session.players.length} Jogadores
                            </div>
                        </div>
                        {expandedSession === session.id ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}
                    </div>

                    {expandedSession === session.id && (
                        <div className="p-3 border-t border-slate-100 bg-white">
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Lista Principal</p>
                                {session.players.length === 0 && <p className="text-xs text-slate-300 italic">Vazia</p>}
                                {session.players.map(p => (
                                    <div key={p.userId} className="flex justify-between items-center py-1 border-b border-slate-50 last:border-0">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${p.attended ? 'bg-green-500' : 'bg-red-200'}`}></div>
                                            <span className={`text-sm ${p.attended ? 'text-slate-800 font-medium' : 'text-slate-500'}`}>
                                                {p.name} {p.isGuest && <span className="text-[10px] text-indigo-500">(Convidado)</span>}
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
                                            <span className="text-sm text-orange-800/60">{p.name}</span>
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
        <div className="bg-white p-4 rounded-xl border border-slate-200 animate-fade-in">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><UserIcon size={16}/> Nomes ({users.length})</h3>
          <div className="space-y-2 h-64 overflow-y-auto custom-scrollbar">
            {users.map(u => (
              <div key={u.uid} className="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-100">
                <div className="flex-1 overflow-hidden mr-2">
                  <div className="font-bold text-sm text-slate-800 truncate">
                      {u.nickname || u.fullName}
                      {u.role === 0 && <span className="ml-2 text-[10px] bg-yellow-100 text-yellow-700 px-1 rounded">PENDENTE</span>}
                      {u.role === 2 && <span className="ml-2 text-[10px] bg-purple-100 text-purple-700 px-1 rounded">ADMIN</span>}
                      {u.role === 3 && <span className="ml-2 text-[10px] bg-indigo-900 text-white px-1 rounded">DEV</span>}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{u.email}</div>
                </div>

                {/* Games Counter Column */}
                <div className="mx-2 text-center w-16">
                     <div className="text-xs font-bold text-slate-800">{u.stats.gamesAttended}</div>
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
                        <button onClick={() => setInspectUser(u)} className="p-2 bg-slate-100 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Inspecionar">
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
        <div className="bg-white p-4 rounded-xl border border-slate-200 animate-fade-in">
           <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><UsersIcon size={16}/> Histórico de Convidados</h3>
           <p className="text-xs text-slate-500 mb-3">Lista de todos os convidados que já foram inseridos em listas, permitindo marcar presença manual.</p>
           
           <div className="space-y-2 h-64 overflow-y-auto custom-scrollbar">
             {getGuestHistory().length === 0 && <p className="text-slate-400 text-xs">Nenhum convidado registrado no histórico.</p>}
             {getGuestHistory().map((guest, idx) => (
               <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-100">
                 <div>
                   <div className="font-bold text-sm text-slate-800">{guest.name}</div>
                   <div className="text-xs text-slate-500">Resp: {getInviterName(guest.inviterId)} • {guest.sessions} jogos</div>
                 </div>
                 <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded text-blue-600" />
                    <span className="text-xs text-slate-600 font-bold">Presente?</span>
                 </label>
               </div>
             ))}
           </div>
        </div>
      )}

      {/* Logs View (Dev Only) */}
      {activeSubTab === 'logs' && isDev && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 animate-fade-in">
          <div className="flex justify-between items-center mb-4">
             <h3 className="font-bold text-slate-800 flex items-center gap-2">
               <FileText size={18} />
               Log de Atividades (Acesso Dev)
             </h3>
             <button onClick={downloadLogs} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1 rounded flex items-center gap-1">
               <Download size={12} />
               Baixar .txt
             </button>
          </div>
          <div className="h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {logs.length === 0 && <p className="text-slate-400 text-sm text-center">Nenhum registro encontrado.</p>}
            {logs.map(log => (
              <div key={log.id} className="p-2 border-b border-slate-100 text-xs hover:bg-slate-50">
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>{new Date(log.timestamp).toLocaleString()}</span>
                  <span className="font-bold text-slate-600">{log.action}</span>
                </div>
                <div className="text-slate-800">
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
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 bg-slate-800 text-white flex justify-between items-center">
                    <h3 className="font-bold flex items-center gap-2"><ShieldAlert size={18}/> Inspetor DEV</h3>
                    <button onClick={() => setInspectUser(null)} className="text-slate-400 hover:text-white"><X size={20}/></button>
                </div>
                
                <div className="p-4 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                    
                    <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xl">
                            {inspectUser.fullName.charAt(0)}
                        </div>
                        <div>
                            <h2 className="font-bold text-lg">{inspectUser.fullName}</h2>
                            <p className="text-xs text-slate-500 font-mono">{inspectUser.uid}</p>
                            <p className="text-sm text-slate-600">{inspectUser.email}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 p-2 rounded border border-slate-200">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Telefone</label>
                            <div className="text-sm font-medium">{inspectUser.phone}</div>
                        </div>
                        <div className="bg-slate-50 p-2 rounded border border-slate-200">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Data Nasc.</label>
                            <div className="text-sm font-medium">{inspectUser.dob}</div>
                        </div>
                        <div className="bg-slate-50 p-2 rounded border border-slate-200">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Jogos</label>
                            <div className="text-sm font-medium">{inspectUser.stats.gamesAttended}</div>
                        </div>
                         <div className="bg-slate-50 p-2 rounded border border-slate-200">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Criado em</label>
                            <div className="text-xs font-medium">{new Date(inspectUser.createdAt).toLocaleDateString()}</div>
                        </div>
                    </div>

                    <div className="bg-yellow-50 p-3 rounded border border-yellow-100">
                        <h4 className="text-xs font-bold text-yellow-800 uppercase mb-2">Permissões (Forçar)</h4>
                        <div className="flex gap-2">
                             <button onClick={() => forceChangeRole(inspectUser.uid, 1)} className={`flex-1 py-1 text-xs font-bold rounded ${inspectUser.role === 1 ? 'bg-blue-600 text-white' : 'bg-white border'}`}>User</button>
                             <button onClick={() => forceChangeRole(inspectUser.uid, 2)} className={`flex-1 py-1 text-xs font-bold rounded ${inspectUser.role === 2 ? 'bg-purple-600 text-white' : 'bg-white border'}`}>Admin</button>
                             <button onClick={() => forceChangeRole(inspectUser.uid, 3)} className={`flex-1 py-1 text-xs font-bold rounded ${inspectUser.role === 3 ? 'bg-indigo-900 text-white' : 'bg-white border'}`}>Dev</button>
                             <button onClick={() => forceChangeRole(inspectUser.uid, 0)} className={`flex-1 py-1 text-xs font-bold rounded ${inspectUser.role === 0 ? 'bg-yellow-500 text-white' : 'bg-white border'}`}>Pend</button>
                        </div>
                    </div>

                    <div className="border-t border-slate-100 pt-2">
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