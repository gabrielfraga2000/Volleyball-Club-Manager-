import React, { useState } from 'react';
import { db } from '../lib/api';
import { User, SessionType, GenderRestriction } from '../types';
import { PlusCircle, Lock, Calendar, Clock, Users, ShieldAlert, CheckCircle, Info } from 'lucide-react';

interface CreateSessionProps {
    currentUser: User;
    onSuccess: () => void;
}

const TimePicker = ({ value, onChange, className = "" }: { value: string, onChange: (v: string) => void, className?: string }) => {
    const hours = Array.from({length: 24}, (_, i) => i.toString().padStart(2, '0'));
    const minutes = ['00', '10', '20', '30', '40', '50'];
    const [h, m] = (value && value.includes(':')) ? value.split(':') : ['', ''];

    const update = (newH: string, newM: string) => {
        onChange(`${newH}:${newM}`);
    };

    const baseSelectClass = "appearance-none w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg p-3 text-sm text-slate-700 dark:text-white outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-200 dark:focus:ring-yellow-500/30 transition-colors";

    return (
        <div className={`flex items-center gap-2 ${className}`}>
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

export default function CreateSession({ currentUser, onSuccess }: CreateSessionProps) {
    const isAdminOrDev = currentUser.role === 2 || currentUser.role === 3;

    const [formData, setFormData] = useState({ 
        name: '', 
        date: '', 
        time: '', 
        maxSpots: 18, 
        guestDate: '',
        guestTime: '',
        type: 'pelada' as SessionType,
        genderRestriction: 'all' as GenderRestriction,
        allowGuests: true
    });
    const [msg, setMsg] = useState("");
    const [loading, setLoading] = useState(false);

    if (!isAdminOrDev) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-900 transition-colors">
                <div className="w-20 h-20 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                    <Lock size={40} className="text-slate-400 dark:text-slate-500" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Acesso Restrito</h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                    A criação de listas é limitada somente para Ademiros. Aproveite para treinar e um dia você chega lá!
                </p>
            </div>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // Validation
        if (formData.maxSpots < 6 || formData.maxSpots > 60) {
            alert("Vagas devem ser entre 6 e 60.");
            setLoading(false);
            return;
        }

        if (!formData.time || !formData.guestTime) {
             alert("Preencha todos os horários.");
             setLoading(false);
             return;
        }

        // Campeonato restriction enforcement
        let finalAllowGuests = formData.allowGuests;
        if (formData.type === 'campeonato') {
            finalAllowGuests = false; // Force no guests for championships
        }

        try {
            const guestWindowOpenTime = new Date(`${formData.guestDate}T${formData.guestTime}`).getTime();
            if (isNaN(guestWindowOpenTime)) throw new Error("Data de convidados inválida.");

            await db.createSession({
                name: formData.name,
                date: formData.date,
                time: formData.time,
                maxSpots: formData.maxSpots,
                guestWindowOpenTime,
                createdBy: currentUser.uid,
                type: formData.type,
                genderRestriction: formData.genderRestriction,
                allowGuests: finalAllowGuests
            });

            setMsg("Lista Criada com Sucesso!");
            setFormData({ 
                name: '', date: '', time: '', maxSpots: 18, 
                guestDate: '', guestTime: '', 
                type: 'pelada', genderRestriction: 'all', allowGuests: true 
            });
            setTimeout(() => {
                setMsg("");
                onSuccess();
            }, 2000);

        } catch (e: any) {
            alert("Erro: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 max-w-2xl mx-auto pb-20">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                <PlusCircle size={24} className="text-yellow-500" />
                Nova Partida
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* Basic Info */}
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm transition-colors">
                    <h3 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
                        <Info size={14}/> Informações Básicas
                    </h3>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Nome do Local / Evento</label>
                            <input 
                                required 
                                placeholder="Ex: Ginásio Municipal" 
                                className="w-full p-3 rounded-lg text-sm border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-yellow-400 outline-none" 
                                value={formData.name} 
                                onChange={e => setFormData({...formData, name: e.target.value})} 
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Data</label>
                                <input 
                                    required 
                                    type="date" 
                                    className="w-full p-3 rounded-lg text-sm border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-yellow-400 outline-none" 
                                    value={formData.date} 
                                    onChange={e => setFormData({...formData, date: e.target.value})} 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Horário</label>
                                <TimePicker value={formData.time} onChange={v => setFormData({...formData, time: v})} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Settings */}
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm transition-colors">
                     <h3 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
                        <ShieldAlert size={14}/> Regras da Lista
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Tipo de Jogo</label>
                            <select 
                                value={formData.type}
                                onChange={e => setFormData({...formData, type: e.target.value as any})}
                                className="w-full p-3 rounded-lg text-sm border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-yellow-400 outline-none"
                            >
                                <option value="pelada">Pelada (Padrão)</option>
                                <option value="treino">Treino</option>
                                <option value="campeonato">Campeonato</option>
                                <option value="resenha">Resenha</option>
                            </select>
                            <p className="text-[10px] text-slate-400 mt-1">
                                {formData.type === 'campeonato' && "Lista de espera vira 'Torcida'. Sem convidados."}
                                {formData.type === 'resenha' && "Sem lista de espera. Sem atrasos."}
                                {formData.type === 'pelada' && "Regras padrão de atraso e espera."}
                            </p>
                        </div>

                         <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Restrição de Gênero</label>
                            <select 
                                value={formData.genderRestriction}
                                onChange={e => setFormData({...formData, genderRestriction: e.target.value as any})}
                                className="w-full p-3 rounded-lg text-sm border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-yellow-400 outline-none"
                            >
                                <option value="all">Todos (Misto)</option>
                                <option value="M">Masculino (+ Outro)</option>
                                <option value="F">Feminino (+ Outro)</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 items-center">
                        <div>
                             <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Limite de Vagas</label>
                             <input 
                                type="number" 
                                min="6" 
                                max="60"
                                className="w-full p-3 rounded-lg text-sm border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-yellow-400 outline-none"
                                value={formData.maxSpots} 
                                onChange={e => setFormData({...formData, maxSpots: Number(e.target.value)})}
                             />
                        </div>
                        
                        <div className="flex items-center pt-5">
                             <label className={`flex items-center gap-2 cursor-pointer ${formData.type === 'campeonato' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                <input 
                                    type="checkbox" 
                                    checked={!formData.allowGuests}
                                    onChange={e => setFormData({...formData, allowGuests: !e.target.checked})}
                                    disabled={formData.type === 'campeonato'}
                                    className="w-5 h-5 rounded text-yellow-500 focus:ring-yellow-500 border-slate-300"
                                />
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Proibir Convidados</span>
                             </label>
                        </div>
                    </div>
                </div>

                {/* Guest Window */}
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm transition-colors">
                    <h3 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
                        <Clock size={14}/> Abertura para Convidados
                    </h3>
                    <p className="text-xs text-slate-400 mb-3">Defina quando a lista de convidados será liberada.</p>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                             <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Data Abertura</label>
                             <input 
                                required 
                                type="date" 
                                className="w-full p-3 rounded-lg text-sm border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-yellow-400 outline-none" 
                                value={formData.guestDate} 
                                onChange={e => setFormData({...formData, guestDate: e.target.value})} 
                            />
                        </div>
                         <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Hora Abertura</label>
                            <TimePicker value={formData.guestTime} onChange={v => setFormData({...formData, guestTime: v})} />
                        </div>
                    </div>
                </div>

                <button 
                    disabled={loading}
                    className="w-full bg-slate-900 hover:bg-black dark:bg-yellow-400 dark:hover:bg-yellow-300 text-white dark:text-slate-900 py-4 rounded-xl font-black text-lg shadow-lg hover:shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                    {loading ? 'Criando...' : <><CheckCircle size={20}/> CRIAR PARTIDA</>}
                </button>
                
                {msg && (
                    <div className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 p-3 rounded-lg text-center text-sm font-bold">
                        {msg}
                    </div>
                )}
            </form>
        </div>
    );
}