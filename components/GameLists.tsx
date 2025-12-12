import React, { useState, useEffect } from 'react';
import { GameSession, User, ListPlayer } from '../types';
import { db } from '../lib/api'; // Mudança aqui
import { Clock, Users, UserPlus, UserMinus, Calendar, MapPin, X, Loader2, Trash2, Edit3, Check, AlertCircle, Lock, Unlock } from 'lucide-react';

// --- Helper Functions ---
const formatTime = (isoDate: string, time: string) => {
  const d = new Date(isoDate);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${day}/${month}`;
};

const getDayOfWeek = (isoDate: string) => {
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const d = new Date(isoDate);
    return days[d.getDay()];
};

const TimePicker = ({ value, onChange, className = "", compact = false }: { value: string, onChange: (v: string) => void, className?: string, compact?: boolean }) => {
    const hours = Array.from({length: 24}, (_, i) => i.toString().padStart(2, '0'));
    const minutes = ['00', '10', '20', '30', '40', '50'];
    const [h, m] = (value && value.includes(':')) ? value.split(':') : ['', ''];

    const update = (newH: string, newM: string) => {
        onChange(`${newH}:${newM}`);
    };

    const baseSelectClass = `appearance-none bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-slate-700 dark:text-white outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-200 dark:focus:ring-yellow-500/30 transition-colors ${compact ? 'text-xs p-0.5' : 'text-sm p-2'}`;

    return (
        <div className={`flex items-center gap-1 ${className}`}>
            <select 
                value={h} 
                onChange={e => update(e.target.value, m || '00')}
                className={baseSelectClass}
            >
                {!h && <option value="" disabled>--</option>}
                {hours.map(hh => <option key={hh} value={hh}>{hh}</option>)}
            </select>
            <span className={`text-slate-400 font-bold ${compact ? 'text-xs' : ''}`}>:</span>
            <select 
                value={m} 
                onChange={e => update(h || '00', e.target.value)}
                className={baseSelectClass}
            >
                {!m && <option value="" disabled>--</option>}
                {minutes.map(mm => <option key={mm} value={mm}>{mm}</option>)}
            </select>
        </div>
    );
};

interface ModalProps {
    session: GameSession;
    currentUser: User;
    onClose: () => void;
    onRefresh: () => void;
    allUsers: User[];
}

const GameSessionModal: React.FC<ModalProps> = ({ session, currentUser, onClose, onRefresh, allUsers }) => {
    const [activeTab, setActiveTab] = useState<'main' | 'guests'>('main');
    const [showGuestForm, setShowGuestForm] = useState(false);
    const [guestData, setGuestData] = useState({ name: '', surname: '', email: '', phone: '', arrivalTime: session.time });
    const [joinTime, setJoinTime] = useState(session.time);
    const [loading, setLoading] = useState(false);
    const [joinSuccess, setJoinSuccess] = useState(false);
    const [editingTimeId, setEditingTimeId] = useState<string | null>(null);
    const [tempTime, setTempTime] = useState("");
    const [timeToGuests, setTimeToGuests] = useState<string | null>(null);

    const isPlayerIn = session.players.some(p => p.userId === currentUser.uid);
    const isWaitlisted = session.waitlist.some(p => p.userId === currentUser.uid);
    const hasGuest = session.players.some(p => p.linkedTo === currentUser.uid) || session.waitlist.some(p => p.linkedTo === currentUser.uid);
    const isAdmin = currentUser.role === 2 || currentUser.role === 3;
    const isFull = session.players.length >= session.maxSpots;
    const guestWindowOpen = Date.now() >= session.guestWindowOpenTime;

    useEffect(() => {
        const updateTimer = () => {
            const now = Date.now();
            const diff = session.guestWindowOpenTime - now;
            
            if (diff <= 0) {
                setTimeToGuests(null);
                return;
            }

            const h = Math.floor(diff / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);
            
            setTimeToGuests(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [session.guestWindowOpenTime]);

    const handleJoin = async () => {
        if (!joinTime) return alert("Informe seu horário.");
        setLoading(true);
        try {
            await db.joinSession(session.id, currentUser, joinTime);
            onRefresh();
            setLoading(false);
            setJoinSuccess(true);
            setTimeout(() => {
                setJoinSuccess(false);
            }, 2000); 
        } catch (e: any) { 
            alert(e.message); 
            setLoading(false);
        } 
    };

    const handleLeave = async () => {
        setLoading(true);
        try {
            await db.leaveSession(session.id, currentUser.uid);
            onRefresh();
        } catch (e: any) { console.error(e.message); } 
        finally { setLoading(false); }
    };

    const handleAddGuest = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await db.joinSession(session.id, currentUser, guestData.arrivalTime, true, guestData);
            setShowGuestForm(false);
            setGuestData({ ...guestData, name: '', surname: '', phone: '' });
            onRefresh();
        } catch (e: any) { console.error(e.message); } 
        finally { setLoading(false); }
    };

    const saveTime = async (p: ListPlayer) => {
        if (!tempTime) return;
        try {
            await db.updatePlayerArrival(session.id, p.userId, tempTime);
            setEditingTimeId(null);
            onRefresh();
        } catch (e: any) { console.error(e.message); }
    };

    const getInviterName = (id: string) => {
        const u = allUsers.find(user => user.uid === id);
        return u ? (u.nickname || u.fullName) : '???';
    };

    const renderListRow = (p: ListPlayer, index: number, isWaitlist = false) => {
        const isMe = p.userId === currentUser.uid || p.linkedTo === currentUser.uid;
        const isEditing = editingTimeId === p.userId;
        const displayName = p.isGuest ? p.name : (allUsers.find(u => u.uid === p.userId)?.nickname || p.name);

        return (
            <div key={p.userId} className={`flex items-center p-3 border-b border-slate-100 dark:border-slate-700 last:border-0 ${isMe ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mr-3 shadow-sm 
                    ${isWaitlist ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}>
                    {index + 1}
                </div>
                
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <span className={`font-bold text-sm ${isMe ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                            {displayName}
                        </span>
                        {p.isGuest && (
                             <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded-full">
                                Conv. {getInviterName(p.linkedTo!)}
                             </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Chegada:</span>
                        {isEditing ? (
                            <div className="flex items-center gap-1">
                                <TimePicker value={tempTime} onChange={setTempTime} compact />
                                <button onClick={() => saveTime(p)} className="p-1 bg-green-100 text-green-700 rounded"><Check size={10}/></button>
                                <button onClick={() => setEditingTimeId(null)} className="p-1 bg-slate-100 text-slate-700 rounded"><X size={10}/></button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1 group cursor-pointer" onClick={() => { if(isMe) { setEditingTimeId(p.userId); setTempTime(p.arrivalEstimate); }}}>
                                <span className={`text-xs font-mono font-bold ${isMe ? 'text-yellow-600 dark:text-yellow-400 underline decoration-dotted' : 'text-slate-600 dark:text-slate-400'}`}>
                                    {p.arrivalEstimate}
                                </span>
                                {isMe && <Edit3 size={10} className="text-yellow-500 opacity-0 group-hover:opacity-100" />}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-800 w-full max-w-lg max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                
                <div className="bg-yellow-400 text-slate-900 p-4 relative shrink-0">
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-yellow-500/50 hover:bg-yellow-500 rounded-full text-slate-900 transition-colors">
                        <X size={20} />
                    </button>
                    <div className="pr-12">
                        <h2 className="text-xl font-black leading-tight mb-1 tracking-tight">{session.name}</h2>
                        <div className="flex flex-wrap gap-4 text-slate-800 text-sm font-medium">
                            <div className="flex items-center gap-1.5">
                                <Calendar size={14} className="text-slate-900"/>
                                <span className="capitalize">{getDayOfWeek(session.date)}, {formatTime(session.date, session.time)}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Clock size={14} className="text-slate-900"/>
                                <span>Início: {session.time}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 px-4 py-2 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2">
                        <Users size={16} className="text-slate-400"/>
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
                            {session.players.length} <span className="text-slate-400 font-normal">/ {session.maxSpots} confirmados</span>
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                        {timeToGuests ? (
                            <>
                                <span className="hidden sm:inline text-[10px] uppercase font-bold text-slate-400">Convidados em:</span>
                                <div className="flex items-center gap-1.5 bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded text-xs font-mono font-bold text-slate-600 dark:text-slate-300" title="Tempo para liberar convidados">
                                    <Lock size={12} className="text-slate-500" />
                                    {timeToGuests}
                                </div>
                            </>
                        ) : (
                             <div className="flex items-center gap-1 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded text-[10px] font-bold text-green-700 dark:text-green-400 uppercase">
                                <Unlock size={12} />
                                Conv. Liberados
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-800 p-4 transition-colors">
                    
                    <div className="mb-6 transition-all duration-300">
                        {joinSuccess ? (
                            <div className="bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-400 p-6 rounded-xl flex flex-col items-center justify-center animate-fade-in text-center shadow-inner">
                                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white mb-2 shadow-sm animate-bounce">
                                    <Check size={24} strokeWidth={4} />
                                </div>
                                <h3 className="font-bold text-lg">Presença Confirmada!</h3>
                                <p className="text-xs mt-1 opacity-80">Você está na lista.</p>
                            </div>
                        ) : (
                            !isPlayerIn && !isWaitlisted ? (
                                <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-xl border border-yellow-100 dark:border-yellow-900/20">
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Vai jogar? Confirme agora!</h3>
                                    <div className="flex gap-2 items-end">
                                        <div className="flex-1">
                                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">Chegada Prevista</label>
                                            <TimePicker value={joinTime} onChange={setJoinTime} />
                                        </div>
                                        <button onClick={handleJoin} disabled={loading} className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-bold py-2 h-[38px] rounded-lg text-sm flex items-center justify-center gap-2 shadow-sm">
                                            {loading ? <Loader2 className="animate-spin" size={16}/> : (isFull ? 'Entrar na Fila' : 'CONFIRMAR')}
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 flex items-center gap-1">
                                        <AlertCircle size={10}/> Atraso  30min = Fila de espera automática.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={handleLeave} disabled={loading} className="bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                                        {loading ? <Loader2 className="animate-spin" size={16}/> : <><UserMinus size={16}/> Sair da Lista</>}
                                    </button>
                                    {!hasGuest && (
                                        <button onClick={() => setShowGuestForm(!showGuestForm)} disabled={!guestWindowOpen || loading} 
                                            className={`py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border transition-colors
                                            ${showGuestForm ? 'bg-slate-800 text-white border-slate-800' : 
                                            (!guestWindowOpen ? 'bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-500 border-slate-100 dark:border-slate-600 cursor-not-allowed' : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600')}`}>
                                            <UserPlus size={16}/> {showGuestForm ? 'Cancelar' : 'Convidado'}
                                        </button>
                                    )}
                                </div>
                            )
                        )}

                        {showGuestForm && !joinSuccess && (
                             <div className="mt-3 bg-slate-50 dark:bg-slate-700 p-3 rounded-xl border border-slate-200 dark:border-slate-600 animate-fade-in">
                                <p className="text-xs font-bold text-slate-800 dark:text-white mb-2">Dados do Convidado</p>
                                <div className="space-y-2">
                                    <input placeholder="Nome do Convidado" value={guestData.name} onChange={e => setGuestData({...guestData, name: e.target.value})} 
                                        className="w-full p-2 rounded text-xs border border-slate-200 dark:border-slate-500 bg-white dark:bg-slate-600 text-slate-800 dark:text-white"/>
                                    
                                    <div className="flex gap-2">
                                         <input placeholder="Telefone / WhatsApp" value={guestData.phone} onChange={e => setGuestData({...guestData, phone: e.target.value})} 
                                            className="flex-[2] p-2 rounded text-xs border border-slate-200 dark:border-slate-500 bg-white dark:bg-slate-600 text-slate-800 dark:text-white"/>
                                        <div className="flex-1">
                                            <TimePicker value={guestData.arrivalTime} onChange={(v) => setGuestData({...guestData, arrivalTime: v})} compact />
                                        </div>
                                    </div>
                                    <button onClick={handleAddGuest} disabled={loading} className="w-full bg-slate-900 text-white py-2 rounded font-bold text-xs shadow-sm hover:bg-slate-800 dark:bg-slate-900 dark:hover:bg-black">
                                        Adicionar Convidado
                                    </button>
                                </div>
                             </div>
                        )}
                    </div>

                    <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            Lista Principal ({session.players.length})
                        </h3>
                        <div className="bg-white dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                            {session.players.length === 0 ? (
                                <div className="p-4 text-center text-slate-400 text-sm">Lista vazia. Seja o primeiro!</div>
                            ) : (
                                session.players.map((p, i) => renderListRow(p, i))
                            )}
                        </div>
                    </div>

                    {session.waitlist.length > 0 && (
                        <div className="mt-6">
                            <h3 className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                Fila de Espera ({session.waitlist.length})
                            </h3>
                             <div className="bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-100 dark:border-orange-900/20 overflow-hidden">
                                {session.waitlist.map((p, i) => renderListRow(p, i, true))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

interface SessionSummaryCardProps {
    session: GameSession;
    onClick: () => void;
    onDelete?: (id: string, e: React.MouseEvent) => void;
    canDelete: boolean;
}

const SessionSummaryCard: React.FC<SessionSummaryCardProps> = ({ session, onClick, onDelete, canDelete }) => {
    const isFull = session.players.length >= session.maxSpots;
    const spotsLeft = session.maxSpots - session.players.length;
    
    return (
        <div onClick={onClick} className="group bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md hover:border-yellow-300 dark:hover:border-yellow-500 transition-all cursor-pointer relative overflow-hidden">
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${isFull ? 'bg-orange-500' : 'bg-green-500'}`}></div>
            
            {canDelete && onDelete && (
                <button 
                    onClick={(e) => onDelete(session.id, e)}
                    className="absolute top-2 right-2 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-full transition-colors z-10"
                    title="Excluir Lista"
                >
                    <Trash2 size={16} />
                </button>
            )}
            
            <div className="pl-3">
                <div className="flex justify-between items-start mb-2 pr-6">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {getDayOfWeek(session.date)}
                    </span>
                    {isFull ? (
                        <span className="text-[10px] font-bold bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded-full">Lotação Máx.</span>
                    ) : (
                        <span className="text-[10px] font-bold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">{spotsLeft} vagas</span>
                    )}
                </div>
                
                <h3 className="font-bold text-slate-800 dark:text-white text-lg leading-tight mb-1 group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors">
                    {session.name}
                </h3>
                
                <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400 text-xs font-medium mt-3">
                    <div className="flex items-center gap-1.5">
                        <Calendar size={14} className="text-slate-400"/>
                        {formatTime(session.date, session.time)}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Clock size={14} className="text-slate-400"/>
                        {session.time}
                    </div>
                </div>

                <div className="mt-4 h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                        className={`h-full rounded-full transition-all duration-500 ${isFull ? 'bg-orange-400' : 'bg-green-500'}`} 
                        style={{ width: `${(session.players.length / session.maxSpots) * 100}%` }}
                    ></div>
                </div>
            </div>
        </div>
    );
};

interface GameListsProps {
  sessions: GameSession[];
  currentUser: User;
  onRefresh: () => void;
  allUsers: User[];
}

export default function GameLists({ sessions, currentUser, onRefresh, allUsers }: GameListsProps) {
  const [selectedSession, setSelectedSession] = useState<GameSession | null>(null);
  const isAdmin = currentUser.role === 2 || currentUser.role === 3;

  useEffect(() => {
    if (selectedSession) {
      const updated = sessions.find(s => s.id === selectedSession.id);
      if (updated) {
        setSelectedSession(updated);
      } else {
        setSelectedSession(null);
      }
    }
  }, [sessions, selectedSession?.id]);

  const handleDeleteList = async (idParaApagar: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
        await db.deleteSession(idParaApagar);
        onRefresh();
        if (selectedSession && selectedSession.id === idParaApagar) {
             setSelectedSession(null);
        }
    } catch(err: any) {
        console.error("Erro ao apagar: ", err.message);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Próximos Jogos</h2>
      
      {sessions.length === 0 && (
        <div className="text-center py-10 bg-white dark:bg-slate-800 rounded-xl text-slate-400 border border-slate-100 dark:border-slate-700 border-dashed transition-colors">
          <Calendar size={32} className="mx-auto mb-2 opacity-20"/>
          <p>Nenhum jogo agendado.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {sessions.map(session => (
            <SessionSummaryCard 
                key={session.id} 
                session={session} 
                onClick={() => setSelectedSession(session)} 
                onDelete={handleDeleteList}
                canDelete={isAdmin}
            />
        ))}
      </div>

      {selectedSession && (
        <GameSessionModal 
            session={selectedSession} 
            currentUser={currentUser} 
            onClose={() => setSelectedSession(null)}
            onRefresh={() => {
                onRefresh();
            }}
            allUsers={allUsers}
        />
      )}
    </div>
  );
}