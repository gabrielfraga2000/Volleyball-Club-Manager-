import React, { useState, useEffect } from 'react';
import { db } from '../lib/api';
import { User, SystemLog, ListPlayer, GameSession } from '../types';
import { CheckCircle, XCircle, FileText, Download, User as UserIcon, Users as UsersIcon, Eye, ShieldAlert, X, ChevronDown, ChevronUp, Calendar, UserPlus, RefreshCw, Save, Search, Filter } from 'lucide-react';

// Função auxiliar para data local para evitar problemas de UTC
const parseDate = (dateStr: string) => {
    // dateStr deve ser YYYY-MM-DD
    if (!dateStr) return new Date();
    const [y, m, d] = dateStr.split('-').map(Number);
    // Cria data meio-dia para evitar problemas de timezone
    return new Date(y, m - 1, d, 12, 0, 0);
};

export default function AdminPanel({ currentUser }: { currentUser: User }) {
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [allSessions, setAllSessions] = useState<GameSession[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'logs' | 'guests' | 'matches' | 'pending'>('users');
  
  const [inspectUser, setInspectUser] = useState<User | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  
  // Filtros
  const [userSearch, setUserSearch] = useState("");
  const [matchDateFilter, setMatchDateFilter] = useState("");
  
  // Estado para edição de nick no inspector
  const [tempNick, setTempNick] = useState("");

  const isDev = currentUser.role === 3;
  const isAdminOrDev = currentUser.role === 2 || currentUser.role === 3;

  useEffect(() => {
    refreshData();
  }, []);

  // Atualiza o nick temporário sempre que abrir um usuário diferente
  useEffect(() => {
      if (inspectUser) {
          setTempNick(inspectUser.nickname || inspectUser.fullName);
      }
  }, [inspectUser]);

  const refreshData = () => {
    setUsers(db.getUsers());
    setLogs(db.getLogs());
    setAllSessions(db.getSessions());
    
    // Se estiver inspecionando alguém, atualiza os dados dele em tempo real
    if (inspectUser) {
        const updated = db.getUsers().find(u => u.uid === inspectUser.uid);
        if (updated) setInspectUser(updated);
    }
  }

  const toggleRole = async (uid: string, currentRole: number) => {
    if (!isDev && currentRole >= 2) return; 

    const newRole = currentRole === 0 ? 1 : (currentRole === 1 ? 0 : 0);
    await db.updateUserRole(uid, newRole as any);
    refreshData();
  };
  
  const handleRejectUser = async (uid: string) => {
      if (!confirm("Tem certeza que deseja reprovar este usuário? Isso irá excluir o cadastro dele.")) return;
      await db.rejectUser(uid);
      refreshData();
  };

  const forceChangeRole = async (uid: string, newRole: number) => {
      await db.updateUserRole(uid, newRole as any);
      refreshData();
  };

  const handleUpdateNick = async () => {
      if (!inspectUser) return;
      try {
          // A função updateProfile da API já contém a lógica de validação de unicidade
          // Se o nick já existir, ela lançará um erro que capturamos abaixo
          await db.updateProfile(inspectUser.uid, { nickname: tempNick });
          alert("Nickname atualizado com sucesso!");
          refreshData();
      } catch (e: any) {
          alert("Erro ao atualizar: " + e.message);
      }
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

  const getGuestHistory = () => {
    const guestMap = new Map<string, {name: string, inviterId: string, sessions: number}>();
    
    allSessions.forEach(session => {
        const allPlayers = [...session.players, ...session.waitlist];
        allPlayers.forEach(p => {
            if (p.isGuest && p.linkedTo) {
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

  const pendingUsers = users.filter(u => u.role === 0);
  
  // Filtro de Usuários
  const activeUsers = users
      .filter(u => u.role !== 0)
      .filter(u => {
          if (!userSearch) return true;
          const search = userSearch.toLowerCase();
          return (
              u.fullName.toLowerCase().includes(search) || 
              (u.nickname && u.nickname.toLowerCase().includes(search))
          );
      });

  // Filtro de Sessões (Histórico/Futuro misturados na aba de Admin, mas ordenados por data)
  const filteredSessions = allSessions
      .filter(s => {
          if (!matchDateFilter) return true;
          return s.date === matchDateFilter;
      })
      .sort((a,b) => {
          // Ordena do mais recente para o mais antigo (Decrescente)
          const dateA = new Date(`${a.date}T${a.time}`).getTime();
          const dateB = new Date(`${b.date}T${b.time}`).getTime();
          return dateB - dateA; 
      });

  return (
    <div className="space-y-6 pt-4 relative transition-colors h-full flex flex-col">
      <div className="flex justify-between items-center shrink-0">
        <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            Painel Administrativo
        </h2>
        <button 
            onClick={refreshData} 
            className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-slate-600 dark:text-slate-300"
            title="Atualizar Dados"
        >
            <RefreshCw size={16} />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-700 pb-2 shrink-0">
        <button 
           onClick={() => setActiveSubTab('users')}
           className={`px-3 py-1 text-xs font-bold rounded-full ${activeSubTab === 'users' ? 'bg-slate-900 dark:bg-yellow-400 text-yellow-400 dark:text-slate-900' : 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700'}`}
        >
          Jogadores
        </button>

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
        
        <button 
           onClick={() => setActiveSubTab('pending')}
           className={`px-3 py-1 text-xs font-bold rounded-full flex items-center gap-1 ${activeSubTab === 'pending' ? 'bg-slate-900 dark:bg-yellow-400 text-yellow-400 dark:text-slate-900' : 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700'}`}
        >
          Aprovações {pendingUsers.length > 0 && <span className="bg-red-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[9px]">{pendingUsers.length}</span>}
        </button>

        {isDev && (
            <button 
            onClick={() => { setActiveSubTab('logs'); refreshData(); }}
            className={`px-3 py-1 text-xs font-bold rounded-full ${activeSubTab === 'logs' ? 'bg-slate-900 dark:bg-yellow-400 text-yellow-400 dark:text-slate-900' : 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700'}`}
            >
            Logs
            </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-20">
      {activeSubTab === 'matches' && isAdminOrDev && (
        <div className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-end mb-2">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Calendar size={18}/> Histórico e Presença
                </h3>
                <div className="flex flex-col gap-1 items-end">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Filtrar Data</label>
                    <div className="relative">
                        <input 
                            type="date" 
                            value={matchDateFilter}
                            onChange={(e) => setMatchDateFilter(e.target.value)}
                            className="text-xs p-1.5 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white outline-none focus:ring-1 focus:ring-yellow-400"
                        />
                        {matchDateFilter && (
                             <button onClick={() => setMatchDateFilter("")} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5">
                                 <X size={8} />
                             </button>
                        )}
                    </div>
                </div>
            </div>

            {filteredSessions.length === 0 && (
                <p className="text-slate-400 text-sm text-center py-8">
                    {matchDateFilter ? "Nenhuma partida encontrada nesta data." : "Nenhuma sessão registrada."}
                </p>
            )}
            
            {filteredSessions.map(session => (
                <div key={session.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden transition-colors">
                    <div 
                        onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                        className="p-3 bg-slate-50 dark:bg-slate-700/50 flex justify-between items-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                        <div>
                            <div className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                                {session.name} 
                                <span className="text-[10px] text-slate-400 font-normal border border-slate-300 dark:border-slate-600 rounded px-1">{session.type}</span>
                                {session.status === 'closed' && <span className="text-[10px] bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-300 px-1.5 rounded-full font-bold">FINALIZADA</span>}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {parseDate(session.date).toLocaleDateString()} @ {session.time} • {session.players.length} Jogadores
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
                                     <p className="text-[10px] font-bold text-orange-400 uppercase mb-2">Lista de Espera / Torcida</p>
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

      {activeSubTab === 'users' && (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 animate-fade-in transition-colors">
          <div className="flex justify-between items-end mb-4">
             <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><UserIcon size={16}/> Nomes ({activeUsers.length})</h3>
             <div className="relative">
                 <input 
                    type="text" 
                    placeholder="Buscar nome ou nick..." 
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-8 pr-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 dark:text-white outline-none focus:ring-1 focus:ring-yellow-400 w-40 sm:w-56"
                 />
                 <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
             </div>
          </div>

          <div className="space-y-2 h-64 overflow-y-auto custom-scrollbar">
            {activeUsers.length === 0 && <p className="text-slate-400 text-center text-sm py-4">Nenhum usuário encontrado.</p>}
            {activeUsers.map(u => (
              <div key={u.uid} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-700/50 rounded border border-slate-100 dark:border-slate-600">
                <div className="flex-1 overflow-hidden mr-2">
                  <div className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">
                      {u.nickname || u.fullName}
                      {u.role === 2 && <span className="ml-2 text-[10px] bg-slate-800 text-yellow-400 px-1 rounded">ADEMIRO</span>}
                      {u.role === 3 && <span className="ml-2 text-[10px] bg-indigo-900 text-white px-1 rounded">DEV</span>}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{formatPhone(u.phone)}</div>
                </div>

                <div className="mx-2 text-center w-16">
                     <div className="text-xs font-bold text-slate-800 dark:text-slate-300">{u.stats.gamesAttended}</div>
                     <div className="text-[9px] text-slate-400 uppercase">Jogos</div>
                </div>

                <div className="flex gap-2">
                    {/* Botão Aprovar REMOVIDO desta aba */}
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

      {activeSubTab === 'pending' && (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 animate-fade-in transition-colors">
          <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <UserPlus size={16}/> Pendentes de Aprovação ({pendingUsers.length})
          </h3>
          <div className="space-y-2 h-64 overflow-y-auto custom-scrollbar">
            {pendingUsers.length === 0 && <p className="text-slate-400 text-sm text-center py-10">Tudo limpo! Ninguém esperando aprovação.</p>}
            {pendingUsers.map(u => (
              <div key={u.uid} className="flex justify-between items-center p-3 bg-yellow-50 dark:bg-yellow-900/10 rounded border border-yellow-100 dark:border-yellow-900/20">
                <div className="flex-1 overflow-hidden mr-2">
                  <div className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">
                      {u.fullName}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{formatPhone(u.phone)}</div>
                  <div className="text-[10px] text-slate-400">Criado em: {new Date(u.createdAt).toLocaleDateString()}</div>
                </div>

                <div className="flex gap-2">
                    <button onClick={() => handleRejectUser(u.uid)} className="bg-red-50 text-red-600 border border-red-200 px-3 py-2 rounded-lg text-xs font-bold hover:bg-red-100 transition-all active:scale-95">
                        REPROVAR
                    </button>
                    <button onClick={() => toggleRole(u.uid, u.role)} className="bg-green-500 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-green-600 shadow-sm transition-all active:scale-95">
                        APROVAR
                    </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
      </div>

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

                    <div className="bg-slate-50 dark:bg-slate-700 p-3 rounded-lg border border-slate-200 dark:border-slate-600">
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Gerenciar Identificação (Nick)</label>
                        <div className="flex gap-2">
                             <input 
                                type="text" 
                                maxLength={16}
                                value={tempNick}
                                onChange={e => setTempNick(e.target.value)}
                                placeholder="Nickname"
                                className="flex-1 border border-slate-200 dark:border-slate-500 bg-white dark:bg-slate-600 dark:text-white rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-yellow-400"
                             />
                             <button onClick={handleUpdateNick} className="bg-slate-900 dark:bg-yellow-400 text-white dark:text-slate-900 px-3 py-1 rounded text-xs font-bold flex items-center gap-1 hover:opacity-90">
                                 <Save size={14}/> Salvar
                             </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 dark:bg-slate-700 p-2 rounded border border-slate-200 dark:border-slate-600">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Telefone</label>
                            <div className="text-sm font-medium dark:text-slate-200">{formatPhone(inspectUser.phone)}</div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-700 p-2 rounded border border-slate-200 dark:border-slate-600">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Data Nasc.</label>
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