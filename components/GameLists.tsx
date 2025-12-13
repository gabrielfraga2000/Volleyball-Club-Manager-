import React, { useState, useEffect } from 'react';
import { GameSession, User, ListPlayer, SessionType, GenderRestriction } from '../types';
import { db } from '../lib/api'; // Mudança aqui
import { Clock, Users, UserPlus, UserMinus, Calendar, MapPin, X, Loader2, Trash2, Edit3, Check, AlertCircle, Lock, Unlock, Save, History, PlayCircle, StopCircle, Trophy, Coffee, Dumbbell, Activity, UserX, Megaphone, Info } from 'lucide-react';

// --- Helper Functions ---
const parseDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
};

const formatTime = (isoDate: string, time: string) => {
  const d = parseDate(isoDate);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${day}/${month}`;
};

const getDayOfWeek = (isoDate: string) => {
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const d = parseDate(isoDate);
    return days[d.getDay()];
};

const hasSessionStarted = (session: GameSession) => {
    const sessionStart = new Date(`${session.date}T${session.time}`);
    return Date.now() >= sessionStart.getTime();
}

const getSessionTypeIcon = (type: string) => {
    switch(type) {
        case 'campeonato': return <Trophy size={14} className="text-yellow-600" />;
        case 'treino': return <Dumbbell size={14} className="text-blue-500" />;
        case 'resenha': return <Coffee size={14} className="text-orange-500" />;
        default: return <Activity size={14} className="text-green-500" />; // Pelada
    }
};

const getSessionTypeLabel = (type: string) => {
    switch(type) {
        case 'campeonato': return 'Campeonato';
        case 'treino': return 'Treino';
        case 'resenha': return 'Resenha';
        default: return 'Pelada';
    }
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
    const [showGuestForm, setShowGuestForm] = useState(false);
    const [guestData, setGuestData] = useState({ name: '', surname: '', email: '', phone: '', arrivalTime: session.time });
    const [joinTime, setJoinTime] = useState(session.time);
    const [loading, setLoading] = useState(false);
    const [joinSuccess, setJoinSuccess] = useState(false);
    const [editingTimeId, setEditingTimeId] = useState<string | null>(null);
    const [tempTime, setTempTime] = useState("");
    const [timeToGuests, setTimeToGuests] = useState<string | null>(null);

    // Edit Session State
    const [isEditingSession, setIsEditingSession] = useState(false);
    // Inicializa com valores padrão se os campos novos não existirem
    const [editData, setEditData] = useState({
        name: session.name,
        date: session.date,
        time: session.time,
        maxSpots: session.maxSpots,
        guestDate: '',
        guestTime: '',
        type: session.type || 'pelada', 
        genderRestriction: session.genderRestriction || 'all',
        allowGuests: session.allowGuests ?? true
    });

    useEffect(() => {
        if(isEditingSession) {
             const safeGuestTime = session.guestWindowOpenTime || Date.now();
             const guestDateObj = new Date(safeGuestTime);
             const y = guestDateObj.getFullYear();
             const m = String(guestDateObj.getMonth() + 1).padStart(2, '0');
             const d = String(guestDateObj.getDate()).padStart(2, '0');
             const hh = String(guestDateObj.getHours()).padStart(2, '0');
             const mm = String(guestDateObj.getMinutes()).padStart(2, '0');
             
             setEditData({
                 name: session.name,
                 date: session.date,
                 time: session.time,
                 maxSpots: session.maxSpots,
                 guestDate: `${y}-${m}-${d}`,
                 guestTime: `${hh}:${mm}`,
                 type: session.type || 'pelada',
                 genderRestriction: session.genderRestriction || 'all',
                 allowGuests: session.allowGuests ?? true
             });
        }
    }, [isEditingSession, session]);

    const isPlayerIn = session.players.some(p => p.userId === currentUser.uid);
    const isWaitlisted = session.waitlist.some(p => p.userId === currentUser.uid);
    const hasGuest = session.players.some(p => p.linkedTo === currentUser.uid) || session.waitlist.some(p => p.linkedTo === currentUser.uid);
    const isAdmin = currentUser.role === 2 || currentUser.role === 3;
    const isFull = session.players.length >= session.maxSpots;
    const guestWindowOpen = Date.now() >= session.guestWindowOpenTime;
    const isStarted = hasSessionStarted(session);
    const isClosed = session.status === 'closed';

    // Logic checks
    const genderAllowed = session.genderRestriction === 'all' || currentUser.gender === session.genderRestriction || currentUser.gender === 'O';
    const isChampionship = session.type === 'campeonato';
    const isResenha = session.type === 'resenha';
    // Se for resenha, a lista de espera não deve aparecer visualmente ou funcionalmente
    const hideWaitlist = isResenha;

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

    const handleJoin = async (asSpectator = false) => {
        if (!joinTime) return alert("Informe seu horário.");
        setLoading(true);
        try {
            await db.joinSession(session.id, currentUser, joinTime, false, undefined, asSpectator);
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
    
    const handleSaveSessionEdit = async () => {
        setLoading(true);
        try {
            const guestWindowOpenTime = new Date(`${editData.guestDate}T${editData.guestTime}`).getTime();
            if (isNaN(guestWindowOpenTime)) throw new Error("Data de convidado inválida");

            // Se mudou para campeonato, força sem convidados
            let finalAllowGuests = editData.allowGuests;
            if (editData.type === 'campeonato') finalAllowGuests = false;

            await db.updateSession(session.id, {
                name: editData.name,
                date: editData.date,
                time: editData.time,
                maxSpots: editData.maxSpots,
                guestWindowOpenTime,
                type: editData.type,
                genderRestriction: editData.genderRestriction,
                allowGuests: finalAllowGuests
            });
            setIsEditingSession(false);
            onRefresh();
        } catch (e: any) {
            alert("Erro ao atualizar: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCloseSession = async () => {
        if (!confirm("Tem certeza que deseja finalizar esta partida? Ela sairá dos próximos jogos e irá para o histórico.")) return;
        setLoading(true);
        try {
            await db.closeSession(session.id);
            onClose(); 
            onRefresh();
        } catch(e: any) {
            alert(e.message);
        } finally {
            setLoading(false);
        }
    };

    const getInviterName = (id: string) => {
        const u = allUsers.find(user => user.uid === id);
        return u ? (u.nickname || u.fullName) : '???';
    };

    const renderListRow = (p: ListPlayer, index: number, isWaitlist = false) => {
        const isMe = p.userId === currentUser.uid || p.linkedTo === currentUser.uid;
        const isEditing = editingTimeId === p.userId;
        const displayName = p.isGuest ? p.name : (allUsers.find(u => u.uid === p.userId)?.nickname || p.name);
        
        const isAbsent = isClosed && !p.attended;
        const rowOpacity = isAbsent ? 'opacity-50 grayscale' : 'opacity-100';

        return (
            <div key={p.userId} className={`flex items-center p-3 border-b border-slate-100 dark:border-slate-700 last:border-0 ${isMe && !isClosed ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''} ${rowOpacity} transition-all`}>
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
                        {isClosed && (
                            <span className={`text-[9px] px-1.5 rounded uppercase font-bold ${p.attended ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {p.attended ? 'Presente' : 'Ausente'}
                            </span>
                        )}
                    </div>
                    {!isClosed && (
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
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-800 w-full max-w-lg max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                
                <div className={`p-4 relative shrink-0 ${isClosed ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300' : 'bg-yellow-400 text-slate-900'}`}>
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-black/10 hover:bg-black/20 rounded-full transition-colors z-10">
                        <X size={20} />
                    </button>
                    
                    {isAdmin && !isEditingSession && !isClosed && (
                         <button onClick={() => setIsEditingSession(true)} className="absolute top-4 right-14 p-2 bg-black/10 hover:bg-black/20 rounded-full transition-colors z-10">
                            <Edit3 size={20} />
                        </button>
                    )}

                    {!isEditingSession ? (
                        <div className="pr-12">
                            <h2 className="text-xl font-black leading-tight mb-1 tracking-tight flex items-center gap-2">
                                {session.name}
                                {isClosed && <span className="text-xs bg-slate-600 text-white px-2 py-1 rounded">Finalizada</span>}
                            </h2>
                            <div className="flex flex-wrap gap-4 text-sm font-medium opacity-90">
                                <div className="flex items-center gap-1.5">
                                    <Calendar size={14} />
                                    <span className="capitalize">{getDayOfWeek(session.date)}, {formatTime(session.date, session.time)}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Clock size={14} />
                                    <span>Início: {session.time}</span>
                                </div>
                            </div>
                            <div className="flex gap-2 mt-2">
                                 <span className="text-[10px] font-bold uppercase bg-black/10 px-2 py-0.5 rounded flex items-center gap-1">
                                    {getSessionTypeIcon(session.type)} {getSessionTypeLabel(session.type)}
                                 </span>
                                 {session.genderRestriction !== 'all' && (
                                     <span className="text-[10px] font-bold uppercase bg-black/10 px-2 py-0.5 rounded flex items-center gap-1">
                                         {session.genderRestriction === 'M' ? 'Masculino' : 'Feminino'}
                                     </span>
                                 )}
                            </div>
                        </div>
                    ) : (
                        <div className="pr-12 space-y-2">
                             <input value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} 
                                className="w-full p-1 rounded text-sm bg-yellow-100 border-none text-slate-900 font-bold placeholder-yellow-700/50 focus:ring-2 focus:ring-white" placeholder="Nome do Local" />
                             
                             <div className="grid grid-cols-2 gap-2">
                                <input type="date" value={editData.date} onChange={e => setEditData({...editData, date: e.target.value})} 
                                    className="p-1 rounded text-xs bg-yellow-100 border-none text-slate-900" />
                                <input type="time" value={editData.time} onChange={e => setEditData({...editData, time: e.target.value})} 
                                    className="p-1 rounded text-xs bg-yellow-100 border-none text-slate-900" />
                             </div>

                             {/* Expanded Edit Fields */}
                             <div className="grid grid-cols-2 gap-2">
                                 <select 
                                    value={editData.type}
                                    onChange={e => setEditData({...editData, type: e.target.value as SessionType})}
                                    className="p-1 rounded text-xs bg-yellow-100 border-none text-slate-900 w-full"
                                 >
                                    <option value="pelada">Pelada</option>
                                    <option value="treino">Treino</option>
                                    <option value="campeonato">Campeonato</option>
                                    <option value="resenha">Resenha</option>
                                 </select>

                                 <select 
                                    value={editData.genderRestriction}
                                    onChange={e => setEditData({...editData, genderRestriction: e.target.value as GenderRestriction})}
                                    className="p-1 rounded text-xs bg-yellow-100 border-none text-slate-900 w-full"
                                 >
                                    <option value="all">Misto</option>
                                    <option value="M">Masculino</option>
                                    <option value="F">Feminino</option>
                                 </select>
                             </div>

                             <div className="flex items-center gap-2">
                                <input 
                                    type="number" 
                                    min="6" max="60"
                                    value={editData.maxSpots} 
                                    onChange={e => setEditData({...editData, maxSpots: Number(e.target.value)})}
                                    className="p-1 rounded text-xs bg-yellow-100 border-none text-slate-900 w-16 text-center"
                                />
                                <label className="flex items-center gap-1 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={!editData.allowGuests}
                                        onChange={e => setEditData({...editData, allowGuests: !e.target.checked})}
                                        disabled={editData.type === 'campeonato'}
                                        className="w-4 h-4 rounded text-yellow-600"
                                    />
                                    <span className="text-[10px] font-bold text-slate-800 uppercase">Proibir Conv.</span>
                                </label>
                             </div>

                             <div className="bg-yellow-500/20 p-2 rounded">
                                 <p className="text-[9px] font-bold uppercase text-yellow-900 mb-1">Janela de Convidados</p>
                                 <div className="grid grid-cols-2 gap-2">
                                    <input type="date" value={editData.guestDate} onChange={e => setEditData({...editData, guestDate: e.target.value})} 
                                        className="p-1 rounded text-xs bg-yellow-100 border-none text-slate-900" />
                                    <input type="time" value={editData.guestTime} onChange={e => setEditData({...editData, guestTime: e.target.value})} 
                                        className="p-1 rounded text-xs bg-yellow-100 border-none text-slate-900" />
                                 </div>
                             </div>

                             <div className="flex gap-2 mt-2">
                                 <button onClick={handleSaveSessionEdit} disabled={loading} className="bg-slate-900 text-white px-3 py-1 rounded text-xs font-bold flex items-center gap-1">
                                     <Save size={12}/> Salvar
                                 </button>
                                 <button onClick={() => setIsEditingSession(false)} className="bg-yellow-500 text-slate-900 px-3 py-1 rounded text-xs font-bold">
                                     Cancelar
                                 </button>
                             </div>
                        </div>
                    )}
                </div>

                <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 px-4 py-2 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2">
                        <Users size={16} className="text-slate-400"/>
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
                            {session.players.length} <span className="text-slate-400 font-normal">/ {session.maxSpots} confirmados</span>
                        </span>
                    </div>

                    {!isClosed && session.allowGuests && (
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
                    )}
                    {!isClosed && !session.allowGuests && (
                        <div className="flex items-center gap-1 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded text-[10px] font-bold text-red-700 dark:text-red-400 uppercase">
                            <UserX size={12} />
                            Sem Convidados
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-800 p-4 transition-colors">
                    
                    {!isClosed && (
                        <div className="mb-6 transition-all duration-300">
                            {isAdmin && isStarted && (
                                <div className="mb-4">
                                     <button onClick={handleCloseSession} disabled={loading} className="w-full bg-slate-900 hover:bg-black text-white p-3 rounded-xl flex items-center justify-center gap-2 font-bold text-sm shadow-lg dark:bg-slate-700 dark:hover:bg-slate-600">
                                         {loading ? <Loader2 className="animate-spin"/> : <><StopCircle size={18}/> Finalizar Partida</>}
                                     </button>
                                     <p className="text-[10px] text-center text-slate-400 mt-1">Ao finalizar, a lista vai para o histórico e não aceita mais entradas.</p>
                                </div>
                            )}

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
                                    <>
                                        {!genderAllowed ? (
                                            <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/20 text-center">
                                                <AlertCircle size={32} className="mx-auto text-red-400 mb-2"/>
                                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Restrição de Gênero</h3>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                    Esta lista é exclusiva para o público {session.genderRestriction === 'M' ? 'Masculino' : 'Feminino'}.
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-xl border border-yellow-100 dark:border-yellow-900/20">
                                                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Vai jogar? Confirme agora!</h3>
                                                <div className="flex gap-2 items-end">
                                                    <div className="flex-1">
                                                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">Chegada Prevista</label>
                                                        <TimePicker value={joinTime} onChange={setJoinTime} />
                                                    </div>
                                                    
                                                    {isChampionship ? (
                                                        <>
                                                            <button onClick={() => handleJoin(false)} disabled={loading || isFull} className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-bold py-2 h-[38px] rounded-lg text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                                                                {loading ? <Loader2 className="animate-spin" size={16}/> : (isFull ? 'Lotado' : 'JOGAR')}
                                                            </button>
                                                            <button onClick={() => handleJoin(true)} disabled={loading} className="flex-1 bg-orange-400 hover:bg-orange-500 text-white font-bold py-2 h-[38px] rounded-lg text-sm flex items-center justify-center gap-2 shadow-sm">
                                                                {loading ? <Loader2 className="animate-spin" size={16}/> : <><Megaphone size={14}/> TORCER</>}
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button onClick={() => handleJoin(false)} disabled={loading} className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-bold py-2 h-[38px] rounded-lg text-sm flex items-center justify-center gap-2 shadow-sm">
                                                            {loading ? <Loader2 className="animate-spin" size={16}/> : (isFull ? 'Entrar na Lista de Espera' : 'CONFIRMAR')}
                                                        </button>
                                                    )}
                                                </div>
                                                
                                                {!isChampionship && !isResenha && (
                                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 flex items-center gap-1">
                                                        <AlertCircle size={10}/> Atraso  30min = Lista de espera automática.
                                                    </p>
                                                )}
                                                {isChampionship && (
                                                     <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 flex items-center gap-1">
                                                        <Info size={10}/> "Jogar" entra na lista principal. "Torcer" entra na Torcida.
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3">
                                        <button onClick={handleLeave} disabled={loading} className="bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                                            {loading ? <Loader2 className="animate-spin" size={16}/> : <><UserMinus size={16}/> Sair da Lista</>}
                                        </button>
                                        {!hasGuest && session.allowGuests && !isChampionship && (
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
                    )}

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

                    {!hideWaitlist && session.waitlist.length > 0 && (
                        <div className="mt-6">
                            <h3 className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                {isChampionship ? "Torcida" : "Lista de Espera"} ({session.waitlist.length})
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
    const isStarted = hasSessionStarted(session);
    
    return (
        <div onClick={onClick} className={`group bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border 
            ${isStarted ? 'border-green-500/50 dark:border-green-500/50 shadow-green-100 dark:shadow-green-900/20' : 'border-slate-200 dark:border-slate-700'} 
            hover:shadow-md hover:border-yellow-300 dark:hover:border-yellow-500 transition-all cursor-pointer relative overflow-hidden`}>
            
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
                    <div className="flex gap-1">
                        {isStarted && (
                            <span className="text-[10px] font-bold bg-green-500 text-white px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-white rounded-full"></span> AO VIVO
                            </span>
                        )}
                        {isFull ? (
                            <span className="text-[10px] font-bold bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded-full">Lotação Máx.</span>
                        ) : (
                            <span className="text-[10px] font-bold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">{spotsLeft} vagas</span>
                        )}
                    </div>
                </div>
                
                <h3 className="font-bold text-slate-800 dark:text-white text-lg leading-tight mb-1 group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors">
                    {session.name}
                </h3>

                {/* Tags Info */}
                <div className="flex gap-2 mt-2">
                    <span className="text-[9px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded flex items-center gap-1 uppercase font-bold">
                        {getSessionTypeIcon(session.type)} {getSessionTypeLabel(session.type)}
                    </span>
                    {session.genderRestriction !== 'all' && (
                         <span className="text-[9px] bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-1.5 py-0.5 rounded flex items-center gap-1 uppercase font-bold">
                             {session.genderRestriction === 'M' ? 'Masc' : 'Fem'}
                         </span>
                    )}
                </div>
                
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
  const [view, setView] = useState<'upcoming' | 'history'>('upcoming');
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
  
  // Filtra sessões baseado no status
  const upcomingSessions = sessions.filter(s => s.status === 'open');
  const historySessions = sessions.filter(s => s.status === 'closed');
  // Ordena histórico do mais recente para o mais antigo
  historySessions.sort((a,b) => new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime());

  return (
    <div className="space-y-4">
      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-700 pb-2">
          <button 
            onClick={() => setView('upcoming')}
            className={`text-sm font-bold pb-2 transition-colors flex items-center gap-2 ${view === 'upcoming' ? 'text-slate-900 dark:text-yellow-400 border-b-2 border-yellow-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
          >
              <PlayCircle size={16}/> Próximos Jogos
          </button>
          <button 
            onClick={() => setView('history')}
            className={`text-sm font-bold pb-2 transition-colors flex items-center gap-2 ${view === 'history' ? 'text-slate-900 dark:text-yellow-400 border-b-2 border-yellow-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
          >
              <History size={16}/> Histórico
          </button>
      </div>
      
      {view === 'upcoming' && (
          <>
            {upcomingSessions.length === 0 && (
                <div className="text-center py-10 bg-white dark:bg-slate-800 rounded-xl text-slate-400 border border-slate-100 dark:border-slate-700 border-dashed transition-colors">
                <Calendar size={32} className="mx-auto mb-2 opacity-20"/>
                <p>Nenhum jogo agendado.</p>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4">
                {upcomingSessions.map(session => (
                    <SessionSummaryCard 
                        key={session.id} 
                        session={session} 
                        onClick={() => setSelectedSession(session)} 
                        onDelete={handleDeleteList}
                        canDelete={isAdmin}
                    />
                ))}
            </div>
          </>
      )}

      {view === 'history' && (
          <>
            {historySessions.length === 0 && (
                <div className="text-center py-10 bg-white dark:bg-slate-800 rounded-xl text-slate-400 border border-slate-100 dark:border-slate-700 border-dashed transition-colors">
                <History size={32} className="mx-auto mb-2 opacity-20"/>
                <p>Nenhum jogo finalizado ainda.</p>
                </div>
            )}

            <div className="space-y-4">
                {historySessions.map(session => (
                    <div key={session.id} onClick={() => setSelectedSession(session)} className="bg-slate-100 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 cursor-pointer opacity-80 hover:opacity-100 transition-opacity">
                         <div className="flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-slate-700 dark:text-slate-300 text-sm">{session.name}</h3>
                                <div className="text-xs text-slate-500 dark:text-slate-400 flex gap-2 mt-1">
                                    <span>{parseDate(session.date).toLocaleDateString()}</span>
                                    <span>•</span>
                                    <span>{session.players.length} Jogadores</span>
                                </div>
                            </div>
                            <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-500 px-2 py-1 rounded">Encerrado</span>
                         </div>
                    </div>
                ))}
            </div>
          </>
      )}

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