import React, { useState, useEffect } from 'react';
import { GameSession, User, ListPlayer } from '../types';
import { db } from '../lib/mockFirebase';
import { Clock, Users, UserPlus, UserMinus, ChevronDown, ChevronUp, Loader2, Trash2, AlertTriangle, Edit3, Check } from 'lucide-react';

interface GameCardProps {
  session: GameSession;
  currentUser: User;
  onRefresh: () => void;
  allUsers: User[];
}

const GameCard: React.FC<GameCardProps> = ({ session, currentUser, onRefresh, allUsers }) => {
  const [expanded, setExpanded] = useState(true);
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestData, setGuestData] = useState({ name: '', surname: '', email: '', phone: '', arrivalTime: session.time });
  const [joinTime, setJoinTime] = useState(session.time);
  const [loading, setLoading] = useState(false);
  
  // Edit Time State
  const [editingTimeId, setEditingTimeId] = useState<string | null>(null);
  const [tempTime, setTempTime] = useState("");

  const isPlayerIn = session.players.some(p => p.userId === currentUser.uid);
  const isWaitlisted = session.waitlist.some(p => p.userId === currentUser.uid);
  const hasGuest = session.players.some(p => p.linkedTo === currentUser.uid) || session.waitlist.some(p => p.linkedTo === currentUser.uid);
  const isAdmin = currentUser.role === 2 || currentUser.role === 3;

  const isFull = session.players.length >= session.maxSpots;
  const guestWindowOpen = Date.now() >= session.guestWindowOpenTime;

  const handleJoin = async () => {
    if (!joinTime) {
        alert("Por favor, informe seu horário de chegada.");
        return;
    }
    setLoading(true);
    try {
      await db.joinSession(session.id, currentUser, joinTime);
      onRefresh();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async () => {
    console.log("FE: Clicou em sair. Sessão:", session.id, "User:", currentUser.uid);
    if (window.confirm("Tem certeza que deseja sair? Se tiver convidados, eles também serão removidos.")) {
      setLoading(true);
      try {
        await db.leaveSession(session.id, currentUser.uid);
        console.log("FE: Saiu com sucesso (promise resolved)");
        onRefresh(); 
      } catch (e: any) {
        console.error("FE: Erro ao sair:", e);
        alert("Erro ao sair da sessão: " + e.message);
      } finally {
        setLoading(false);
      }
    } else {
        console.log("FE: Cancelou no prompt");
    }
  };

  const handleDelete = async () => {
    if (window.confirm("AVISO: Isso irá CANCELAR o jogo e notificar todos os jogadores. Continuar?")) {
      setLoading(true);
      try {
        await db.deleteSession(session.id);
        onRefresh();
      } catch (e: any) {
        console.error(e);
        alert(e.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleAddGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await db.joinSession(session.id, currentUser, guestData.arrivalTime, true, guestData);
      setShowGuestForm(false);
      setGuestData({ name: '', surname: '', email: '', phone: '', arrivalTime: session.time });
      onRefresh();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const startEditingTime = (p: ListPlayer) => {
      setEditingTimeId(p.userId);
      setTempTime(p.arrivalEstimate);
  };

  const saveTime = async (p: ListPlayer) => {
      if (!tempTime) return;
      try {
          await db.updatePlayerArrival(session.id, p.userId, tempTime);
          setEditingTimeId(null);
          onRefresh();
      } catch (e: any) {
          alert(e.message);
      }
  };

  const formatTime = (isoDate: string, time: string) => {
    const d = new Date(isoDate);
    return `${d.toLocaleDateString('pt-BR')} @ ${time}`;
  };

  // Helper to find inviter NICKNAME
  const getInviterDisplayName = (linkedToId: string) => {
    const inviter = allUsers.find(u => u.uid === linkedToId);
    if (inviter) return inviter.nickname || inviter.fullName;
    return 'Desconhecido';
  };

  const renderPlayerName = (p: ListPlayer) => {
    let content;
    if (p.isGuest) {
        content = (
            <div className="font-medium text-slate-800 flex flex-wrap items-center gap-1">
                {p.name}
                {p.linkedTo && (
                    <span className="text-[10px] text-indigo-600 font-normal ml-1">
                       (Convidado por {getInviterDisplayName(p.linkedTo)})
                    </span>
                )}
            </div>
        );
    } else {
        const user = allUsers.find(u => u.uid === p.userId);
        const displayName = user ? (user.nickname || user.fullName) : p.name;
        const realName = (user && user.nickname && user.nickname !== user.fullName) ? user.fullName : null;
        content = (
            <div className="font-medium text-slate-800 flex flex-wrap items-center gap-1">
                {displayName}
                {realName && (
                    <span className="text-[10px] text-slate-400 font-normal">
                        ({realName})
                    </span>
                )}
            </div>
        );
    }

    // Checking if user is editing this specific row
    const isEditing = editingTimeId === p.userId;
    // Current user can edit their own time or their guest's time
    const canEdit = p.userId === currentUser.uid || p.linkedTo === currentUser.uid;

    return (
        <div className="flex justify-between items-center w-full pr-2">
            <div className="flex-1">{content}</div>
            
            <div className="flex items-center gap-2">
                {isEditing ? (
                    <div className="flex items-center gap-1">
                        <input 
                            type="time" 
                            className="text-xs p-1 border rounded w-16 bg-white"
                            value={tempTime}
                            onChange={(e) => setTempTime(e.target.value)}
                        />
                        <button onClick={() => saveTime(p)} className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200">
                            <Check size={12} />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-1 group">
                         <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 border border-slate-200">
                            {p.arrivalEstimate}
                         </span>
                         {canEdit && (
                             <button onClick={() => startEditingTime(p)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-500 transition-opacity">
                                <Edit3 size={10} />
                             </button>
                         )}
                    </div>
                )}
            </div>
        </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-start">
        <div onClick={() => setExpanded(!expanded)} className="cursor-pointer flex-1">
          <h3 className="font-bold text-lg text-slate-800">{session.name}</h3>
          <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
            <Clock size={14} />
            <span>{formatTime(session.date, session.time)}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${isFull ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                {session.players.length} / {session.maxSpots}
            </span>
            <div className="flex gap-2">
              {isAdmin && (
                <button onClick={handleDelete} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Cancelar Partida">
                  <Trash2 size={16} />
                </button>
              )}
              <button onClick={() => setExpanded(!expanded)}>
                {expanded ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}
              </button>
            </div>
        </div>
      </div>

      {expanded && (
        <div>
          {/* Action Bar */}
          <div className="p-4 border-b border-slate-100">
            
            {!isPlayerIn && !isWaitlisted && (
              <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 bg-blue-50 p-2 rounded-lg border border-blue-100">
                      <label className="text-xs font-bold text-blue-800 whitespace-nowrap">Chegada Prevista:</label>
                      <input 
                        type="time" 
                        value={joinTime} 
                        onChange={(e) => setJoinTime(e.target.value)}
                        className="bg-white border border-blue-200 rounded px-2 py-1 text-sm text-blue-900 outline-none focus:ring-1 focus:ring-blue-400"
                      />
                      <span className="text-[9px] text-blue-400 leading-tight">
                        Se chegar +30min depois ({session.time}), você irá para a espera automaticamente.
                      </span>
                  </div>
                  
                  <button 
                    onClick={handleJoin} 
                    disabled={loading}
                    className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${isFull ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'} disabled:opacity-50`}
                  >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : (isFull ? 'Entrar na Fila' : 'Confirmar Presença')}
                  </button>
              </div>
            )}
            
            {(isPlayerIn || isWaitlisted) && (
              <div className="flex gap-2">
                <button 
                    onClick={handleLeave} 
                    disabled={loading}
                    className="flex-1 py-3 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <><UserMinus size={18} /> Sair da Lista</>}
                </button>

                {/* Guest Button - Only if user is confirmed and window is open */}
                {isPlayerIn && !hasGuest && (
                <button 
                    onClick={() => setShowGuestForm(!showGuestForm)}
                    disabled={!guestWindowOpen || loading}
                    className={`flex-1 py-3 rounded-lg font-bold flex items-center justify-center gap-2 ${!guestWindowOpen ? 'bg-slate-100 text-slate-400' : 'bg-indigo-100 text-indigo-700'} disabled:opacity-50`}
                >
                    <UserPlus size={18} />
                    {guestWindowOpen ? 'Add Convidado' : 'Convidado Bloq.'}
                </button>
                )}
              </div>
            )}

          </div>

          {/* Guest Form */}
          {showGuestForm && (
            <form onSubmit={handleAddGuest} className="p-4 bg-indigo-50 border-b border-indigo-100 space-y-3">
              <h4 className="text-sm font-bold text-indigo-900">Detalhes do Convidado</h4>
              <div className="grid grid-cols-2 gap-2">
                <input required placeholder="Nome" className="p-2 rounded border border-indigo-200 text-sm" 
                  value={guestData.name} onChange={e => setGuestData({...guestData, name: e.target.value})} />
                <input required placeholder="Sobrenome" className="p-2 rounded border border-indigo-200 text-sm" 
                   value={guestData.surname} onChange={e => setGuestData({...guestData, surname: e.target.value})} />
              </div>
              <input required type="email" placeholder="Email do Convidado" className="w-full p-2 rounded border border-indigo-200 text-sm" 
                   value={guestData.email} onChange={e => setGuestData({...guestData, email: e.target.value})} />
              
              <div className="bg-white p-2 rounded border border-indigo-100">
                  <label className="block text-xs font-bold text-indigo-800 mb-1">Horário de Chegada do Convidado</label>
                  <input required type="time" className="w-full p-2 rounded border border-indigo-200 text-sm" 
                   value={guestData.arrivalTime} onChange={e => setGuestData({...guestData, arrivalTime: e.target.value})} />
              </div>

              <button disabled={loading} className="w-full bg-indigo-600 text-white py-2 rounded text-sm font-bold flex items-center justify-center gap-2">
                {loading ? <Loader2 className="animate-spin" size={14} /> : 'Confirmar Convidado'}
              </button>
            </form>
          )}

          {/* Player List */}
          <div className="divide-y divide-slate-100">
            {session.players.map((p, i) => (
              <div key={p.userId} className="flex items-center p-3 text-sm animate-fade-in hover:bg-slate-50">
                <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold mr-3 text-slate-500">
                  {i + 1}
                </span>
                <div className="flex-1">
                  {renderPlayerName(p)}
                </div>
              </div>
            ))}
          </div>

          {/* Waitlist */}
          {session.waitlist.length > 0 && (
            <div className="bg-orange-50 border-t border-orange-100">
              <div className="p-2 text-xs font-bold text-orange-800 uppercase tracking-wider text-center">Fila de Espera</div>
              <div className="divide-y divide-orange-100/50">
                {session.waitlist.map((p, i) => (
                  <div key={p.userId} className="flex items-center p-3 text-sm text-orange-900/70 hover:bg-orange-100/50">
                    <span className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-xs font-bold mr-3 text-orange-600">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                        {renderPlayerName(p)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface GameListsProps {
  sessions: GameSession[];
  currentUser: User;
  onRefresh: () => void;
  allUsers: User[];
}

export default function GameLists({ sessions, currentUser, onRefresh, allUsers }: GameListsProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Sessões Ativas</h2>
      {sessions.length === 0 && (
        <div className="text-center py-10 bg-white rounded-xl text-slate-400">
          Nenhum jogo agendado.
        </div>
      )}
      {sessions.map(session => (
        <GameCard key={session.id} session={session} currentUser={currentUser} onRefresh={onRefresh} allUsers={allUsers} />
      ))}
    </div>
  );
}