import React, { useState, useEffect } from 'react';
import { GameSession, User, ListPlayer } from '../types';
import { db } from '../lib/mockFirebase';
import { Clock, Users, UserPlus, UserMinus, Calendar, MapPin, X, Loader2, Trash2, Edit3, Check, AlertCircle } from 'lucide-react';

// --- Helper Functions ---
const formatTime = (isoDate: string, time: string) => {
  const d = new Date(isoDate);
  // Add timezone offset correction if needed, but for prototype we stick to string logic or simple dates
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${day}/${month}`;
};

const getDayOfWeek = (isoDate: string) => {
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const d = new Date(isoDate);
    // Fix timezone issue by appending time or handling as UTC/Local string
    // Simple hack for prototype: use the date part directly
    return days[d.getDay()]; // Note: In real app, ensure timezone consistency
};

interface ModalProps {
    session: GameSession;
    currentUser: User;
    onClose: () => void;
    onRefresh: () => void;
    allUsers: User[];
}

// --- MODAL COMPONENT (A "Nova Janela") ---
const GameSessionModal: React.FC<ModalProps> = ({ session, currentUser, onClose, onRefresh, allUsers }) => {
    const [activeTab, setActiveTab] = useState<'main' | 'guests'>('main');
    const [showGuestForm, setShowGuestForm] = useState(false);
    const [guestData, setGuestData] = useState({ name: '', surname: '', email: '', phone: '', arrivalTime: session.time });
    const [joinTime, setJoinTime] = useState(session.time);
    const [loading, setLoading] = useState(false);
    
    // Success Feedback State
    const [joinSuccess, setJoinSuccess] = useState(false);
    
    // Edit Time State
    const [editingTimeId, setEditingTimeId] = useState<string | null>(null);
    const [tempTime, setTempTime] = useState("");

    const isPlayerIn = session.players.some(p => p.userId === currentUser.uid);
    const isWaitlisted = session.waitlist.some(p => p.userId === currentUser.uid);
    const hasGuest = session.players.some(p => p.linkedTo === currentUser.uid) || session.waitlist.some(p => p.linkedTo === currentUser.uid);
    const isAdmin = currentUser.role === 2 || currentUser.role === 3;
    const isFull = session.players.length >= session.maxSpots;
    const guestWindowOpen = Date.now() >= session.guestWindowOpenTime;

    // Handlers
    const handleJoin = async () => {
        if (!joinTime) return alert("Informe seu horário.");
        setLoading(true);
        try {
            await db.joinSession(session.id, currentUser, joinTime);
            // Show success state BEFORE refreshing data to give visual feedback
            setLoading(false);
            setJoinSuccess(true);
            
            setTimeout(() => {
                onRefresh();
                setJoinSuccess(false);
            }, 2000); // 2 seconds delay to show "Success"
        } catch (e: any) { 
            alert(e.message); 
            setLoading(false);
        } 
    };

    const handleLeave = async () => {
        if (window.confirm("Sair da lista? Seus convidados também serão removidos.")) {
            setLoading(true);
            try {
                await db.leaveSession(session.id, currentUser.uid);
                onRefresh();
            } catch (e: any) { alert(e.message); } 
            finally { setLoading(false); }
        }
    };

    const handleDelete = async () => {
        if (window.confirm("CANCELAR JOGO? Isso notificará todos.")) {
            setLoading(true);
            try {
                await db.deleteSession(session.id);
                onClose(); // Close modal immediately
                onRefresh();
            } catch (e: any) { alert(e.message); }
            finally { setLoading(false); }
        }
    };

    const handleAddGuest = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await db.joinSession(session.id, currentUser, guestData.arrivalTime, true, guestData);
            setShowGuestForm(false);
            setGuestData({ ...guestData, name: '', surname: '' });
            onRefresh();
        } catch (e: any) { alert(e.message); } 
        finally { setLoading(false); }
    };

    const saveTime = async (p: ListPlayer) => {
        if (!tempTime) return;
        try {
            await db.updatePlayerArrival(session.id, p.userId, tempTime);
            setEditingTimeId(null);
            onRefresh();
        } catch (e: any) { alert(e.message); }
    };

    // Renders
    const getInviterName = (id: string) => {
        const u = allUsers.find(user => user.uid === id);
        return u ? (u.nickname || u.fullName) : '???';
    };

    const renderListRow = (p: ListPlayer, index: number, isWaitlist = false) => {
        const isMe = p.userId === currentUser.uid || p.linkedTo === currentUser.uid;
        const isEditing = editingTimeId === p.userId;
        const displayName = p.isGuest ? p.name : (allUsers.find(u => u.uid === p.userId)?.nickname || p.name);

        return (
            <div key={p.userId} className={`flex items-center p-3 border-b border-slate-100 last:border-0 ${isMe ? 'bg-blue-50/50' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mr-3 shadow-sm 
                    ${isWaitlist ? 'bg-orange-100 text-orange-600' : 'bg-white border border-slate-200 text-slate-600'}`}>
                    {index + 1}
                </div>
                
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <span className={`font-bold text-sm ${isMe ? 'text-blue-700' : 'text-slate-700'}`}>
                            {displayName}
                        </span>
                        {p.isGuest && (
                             <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">
                                Conv. {getInviterName(p.linkedTo!)}
                             </span>
                        )}
                    </div>
                    {/* Time Display/Edit */}
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Chegada:</span>
                        {isEditing ? (
                            <div className="flex items-center gap-1">
                                <input type="time" className="text-xs p-1 border rounded w-16"
                                    value={tempTime} onChange={(e) => setTempTime(e.target.value)} />
                                <button onClick={() => saveTime(p)} className="p-1 bg-green-100 text-green-700 rounded"><Check size={10}/></button>
                                <button onClick={() => setEditingTimeId(null)} className="p-1 bg-slate-100 text-slate-700 rounded"><X size={10}/></button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1 group cursor-pointer" onClick={() => { if(isMe) { setEditingTimeId(p.userId); setTempTime(p.arrivalEstimate); }}}>
                                <span className={`text-xs font-mono font-bold ${isMe ? 'text-blue-600 underline decoration-dotted' : 'text-slate-600'}`}>
                                    {p.arrivalEstimate}
                                </span>
                                {isMe && <Edit3 size={10} className="text-blue-400 opacity-0 group-hover:opacity-100" />}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-lg max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                
                {/* Header */}
                <div className="bg-slate-800 text-white p-4 relative shrink-0">
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-slate-700 hover:bg-slate-600 rounded-full text-white transition-colors">
                        <X size={20} />
                    </button>
                    <div className="pr-12">
                        <h2 className="text-xl font-bold leading-tight mb-1">{session.name}</h2>
                        <div className="flex flex-wrap gap-4 text-slate-300 text-sm">
                            <div className="flex items-center gap-1.5">
                                <Calendar size={14} className="text-blue-400"/>
                                <span className="capitalize">{getDayOfWeek(session.date)}, {formatTime(session.date, session.time)}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Clock size={14} className="text-blue-400"/>
                                <span>Início: {session.time}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Status Bar */}
                <div className="bg-slate-50 border-b border-slate-100 px-4 py-2 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2">
                        <Users size={16} className="text-slate-400"/>
                        <span className="text-sm font-bold text-slate-600">
                            {session.players.length} <span className="text-slate-400 font-normal">/ {session.maxSpots} confirmados</span>
                        </span>
                    </div>
                    {isAdmin && (
                        <button onClick={handleDelete} className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded flex items-center gap-1">
                            <Trash2 size={12}/> Cancelar Jogo
                        </button>
                    )}
                </div>

                {/* Scrollable List Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-white p-4">
                    
                    {/* User Action Area (Pinned top of scroll or inline) */}
                    <div className="mb-6 transition-all duration-300">
                        {joinSuccess ? (
                            <div className="bg-green-100 border border-green-200 text-green-800 p-6 rounded-xl flex flex-col items-center justify-center animate-fade-in text-center shadow-inner">
                                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white mb-2 shadow-sm animate-bounce">
                                    <Check size={24} strokeWidth={4} />
                                </div>
                                <h3 className="font-bold text-lg">Presença Confirmada!</h3>
                                <p className="text-xs mt-1 opacity-80">Você está na lista.</p>
                            </div>
                        ) : (
                            !isPlayerIn && !isWaitlisted ? (
                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                    <h3 className="text-sm font-bold text-blue-900 mb-2">Vai jogar? Confirme agora!</h3>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <label className="text-[10px] font-bold text-blue-700 uppercase">Chegada Prevista</label>
                                            <input type="time" value={joinTime} onChange={e => setJoinTime(e.target.value)} 
                                                className="w-full mt-1 p-2 rounded border border-blue-200 text-sm font-bold text-slate-700"/>
                                        </div>
                                        <button onClick={handleJoin} disabled={loading} className="flex-1 mt-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg text-sm flex items-center justify-center gap-2">
                                            {loading ? <Loader2 className="animate-spin" size={16}/> : (isFull ? 'Entrar na Fila' : 'Confirmar')}
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-blue-500 mt-2 flex items-center gap-1">
                                        <AlertCircle size={10}/> Atraso  30min = Fila de espera automática.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={handleLeave} disabled={loading} className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                                        {loading ? <Loader2 className="animate-spin" size={16}/> : <><UserMinus size={16}/> Sair da Lista</>}
                                    </button>
                                    {!hasGuest && (
                                        <button onClick={() => setShowGuestForm(!showGuestForm)} disabled={!guestWindowOpen || loading} 
                                            className={`py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border transition-colors
                                            ${showGuestForm ? 'bg-indigo-600 text-white border-indigo-600' : 
                                            (!guestWindowOpen ? 'bg-slate-50 text-slate-400 border-slate-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100')}`}>
                                            <UserPlus size={16}/> {showGuestForm ? 'Cancelar' : 'Convidado'}
                                        </button>
                                    )}
                                </div>
                            )
                        )}

                        {/* Guest Form */}
                        {showGuestForm && !joinSuccess && (
                             <div className="mt-3 bg-indigo-50 p-3 rounded-xl border border-indigo-100 animate-fade-in">
                                <p className="text-xs font-bold text-indigo-800 mb-2">Dados do Convidado</p>
                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <input placeholder="Nome" value={guestData.name} onChange={e => setGuestData({...guestData, name: e.target.value})} 
                                            className="flex-1 p-2 rounded text-xs border border-indigo-200"/>
                                        <input placeholder="Sobrenome" value={guestData.surname} onChange={e => setGuestData({...guestData, surname: e.target.value})} 
                                            className="flex-1 p-2 rounded text-xs border border-indigo-200"/>
                                    </div>
                                    <div className="flex gap-2">
                                         <input placeholder="Email (Opcional)" value={guestData.email} onChange={e => setGuestData({...guestData, email: e.target.value})} 
                                            className="flex-[2] p-2 rounded text-xs border border-indigo-200"/>
                                          <input type="time" value={guestData.arrivalTime} onChange={e => setGuestData({...guestData, arrivalTime: e.target.value})} 
                                            className="flex-1 p-2 rounded text-xs border border-indigo-200 font-bold text-center"/>
                                    </div>
                                    <button onClick={handleAddGuest} disabled={loading} className="w-full bg-indigo-600 text-white py-2 rounded font-bold text-xs shadow-sm hover:bg-indigo-700">
                                        Adicionar Convidado
                                    </button>
                                </div>
                             </div>
                        )}
                    </div>

                    {/* Main List */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            Lista Principal ({session.players.length})
                        </h3>
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            {session.players.length === 0 ? (
                                <div className="p-4 text-center text-slate-400 text-sm">Lista vazia. Seja o primeiro!</div>
                            ) : (
                                session.players.map((p, i) => renderListRow(p, i))
                            )}
                        </div>
                    </div>

                    {/* Waitlist */}
                    {session.waitlist.length > 0 && (
                        <div className="mt-6">
                            <h3 className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                Fila de Espera ({session.waitlist.length})
                            </h3>
                             <div className="bg-orange-50 rounded-xl border border-orange-100 overflow-hidden">
                                {session.waitlist.map((p, i) => renderListRow(p, i, true))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// --- SUMMARY CARD (O Gatilho) ---
interface SessionSummaryCardProps {
    session: GameSession;
    onClick: () => void;
}

const SessionSummaryCard: React.FC<SessionSummaryCardProps> = ({ session, onClick }) => {
    const isFull = session.players.length >= session.maxSpots;
    const spotsLeft = session.maxSpots - session.players.length;
    
    return (
        <div onClick={onClick} className="group bg-white rounded-xl p-4 shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer relative overflow-hidden">
            {/* Status Stripe */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${isFull ? 'bg-orange-500' : 'bg-green-500'}`}></div>
            
            <div className="pl-3">
                <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {getDayOfWeek(session.date)}
                    </span>
                    {isFull ? (
                        <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Lotação Máx.</span>
                    ) : (
                        <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{spotsLeft} vagas</span>
                    )}
                </div>
                
                <h3 className="font-bold text-slate-800 text-lg leading-tight mb-1 group-hover:text-blue-600 transition-colors">
                    {session.name}
                </h3>
                
                <div className="flex items-center gap-4 text-slate-500 text-xs font-medium mt-3">
                    <div className="flex items-center gap-1.5">
                        <Calendar size={14} className="text-slate-400"/>
                        {formatTime(session.date, session.time)}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Clock size={14} className="text-slate-400"/>
                        {session.time}
                    </div>
                </div>

                {/* Progress Bar Visual */}
                <div className="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
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

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Próximos Jogos</h2>
      
      {sessions.length === 0 && (
        <div className="text-center py-10 bg-white rounded-xl text-slate-400 border border-slate-100 border-dashed">
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
            />
        ))}
      </div>

      {/* RENDER MODAL IF SELECTED */}
      {selectedSession && (
        <GameSessionModal 
            session={selectedSession} 
            currentUser={currentUser} 
            onClose={() => setSelectedSession(null)}
            onRefresh={() => {
                onRefresh();
                // We assume onRefresh updates the parent 'sessions' prop. 
                // We need to keep the local 'selectedSession' in sync or close it if deleted.
                // For a prototype, simply re-finding the session in the new props would be ideal, 
                // but closing/re-opening is also fine.
                // Let's try to update the local ref if it exists in the new list (handled by effect in a real app, 
                // here we rely on the fact that 'session' prop in modal will be stale unless we do something clever).
                // Hack: We pass the *Object* but the modal might display stale data until re-render. 
                // Better approach: User click refresh -> Parent fetches -> Parent re-renders GameLists -> GameLists re-renders Modal.
                // We need to ensure 'selectedSession' is updated from the new 'sessions' list.
            }}
            allUsers={allUsers}
        />
      )}
    </div>
  );
}