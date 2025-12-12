import React, { useState, useEffect } from 'react';
import { db } from '../lib/mockFirebase';
import { User } from '../types';
import { Trophy, AlertCircle, ShieldCheck, Code, User as UserIcon, Sun } from 'lucide-react';

interface AuthProps {
  onSuccess: (user: User) => void;
}

export default function Auth({ onSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [imgError, setImgError] = useState(false);

  // Login State
  const [email, setEmail] = useState("");
  const [dobPassword, setDobPassword] = useState("");

  // Register State
  const [regData, setRegData] = useState({
    fullName: '',
    email: '',
    phone: '',
    dob: '',
    gender: 'M' as 'M'|'F'|'O'
  });
  
  // Date Parts State for Registration
  const [dobParts, setDobParts] = useState({ d: '', m: '', y: '' });

  // Update regData.dob whenever dobParts changes
  useEffect(() => {
    setRegData(prev => ({
        ...prev,
        dob: `${dobParts.d}${dobParts.m}${dobParts.y}`
    }));
  }, [dobParts]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await db.login(email, dobPassword);
      onSuccess(user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    // Validate DOB format strict
    if (!/^\d{8}$/.test(regData.dob)) {
      setError("Data de nascimento deve estar completa.");
      setLoading(false);
      return;
    }
    
    // Validate Phone format strict (11 digits)
    if (regData.phone.length !== 11) {
        setError("O telefone deve conter exatamente 11 números (DDD + Número).");
        setLoading(false);
        return;
    }

    try {
      const user = await db.register(regData);
      onSuccess(user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle phone input to accept only numbers and max 11 chars
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value.replace(/\D/g, '').slice(0, 11);
      setRegData({ ...regData, phone: val });
  };

  // Helper for date part inputs
  const handleDatePartChange = (part: 'd' | 'm' | 'y', val: string) => {
      const numbersOnly = val.replace(/\D/g, '');
      setDobParts(prev => ({ ...prev, [part]: numbersOnly }));
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white min-h-screen transition-colors duration-300">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700 transition-colors duration-300">
        
        {/* Header - BRANDING MANHÃZINHA (Yellow/Black) */}
        <div className="bg-yellow-400 p-8 flex flex-col items-center text-slate-900">
          <div className="bg-white p-4 rounded-full shadow-lg mb-4 border-4 border-slate-900 overflow-hidden">
            {!imgError ? (
                <img 
                    src="/mascote.png"
                    alt="Manhãzinha Mascote" 
                    className="w-24 h-24 object-contain" 
                    onError={() => setImgError(true)}
                />
            ) : (
                <Sun size={64} className="text-yellow-500 fill-yellow-400" /> 
            )}
          </div>
          <h1 className="text-3xl font-black tracking-tight uppercase">Manhãzinha</h1>
          <p className="text-slate-800 font-bold text-sm tracking-wide">Vôlei, Sol e Resenha</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-700">
          <button 
            onClick={() => setIsLogin(true)}
            className={`flex-1 py-4 text-sm font-medium transition-colors ${isLogin ? 'text-yellow-600 dark:text-yellow-400 border-b-2 border-yellow-400 bg-yellow-50 dark:bg-slate-700/50' : 'text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700/30'}`}
          >
            Entrar
          </button>
          <button 
            onClick={() => setIsLogin(false)}
            className={`flex-1 py-4 text-sm font-medium transition-colors ${!isLogin ? 'text-yellow-600 dark:text-yellow-400 border-b-2 border-yellow-400 bg-yellow-50 dark:bg-slate-700/50' : 'text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700/30'}`}
          >
            Cadastrar
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {isLogin ? (
            <>
                <form onSubmit={handleLogin} className="space-y-4">
                <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Email</label>
                    <input required type="email" value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-yellow-400 outline-none transition-colors" placeholder="voce@exemplo.com" />
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Senha (Nasc: ddmmaaaa)</label>
                    <input required type="password" maxLength={8} value={dobPassword} onChange={e => setDobPassword(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-yellow-400 outline-none transition-colors" placeholder="01012000" />
                </div>
                <button disabled={loading} className="w-full bg-slate-900 dark:bg-yellow-400 text-yellow-400 dark:text-slate-900 font-black py-3 rounded-lg mt-2 transition-all active:scale-[0.98] shadow-md hover:shadow-lg disabled:opacity-70">
                    {loading ? 'Autenticando...' : 'ACESSAR'}
                </button>
                </form>
            </>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3">
              
              {/* Row 1: Nome Completo */}
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Nome Completo</label>
                <input required type="text" placeholder="Seu nome completo" value={regData.fullName} onChange={e => setRegData({...regData, fullName: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-yellow-400 outline-none transition-colors" />
              </div>
              
              {/* Row 2: Telefone */}
              <div>
                <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Celular / WhatsApp (Apenas Números)</label>
                    <span className="text-[10px] text-slate-400">{regData.phone.length}/11</span>
                </div>
                <input 
                    required 
                    type="tel" 
                    placeholder="22999999999" 
                    value={regData.phone} 
                    onChange={handlePhoneChange}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-yellow-400 outline-none transition-colors" 
                />
              </div>

              {/* Row 3: Email */}
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Email</label>
                <input required type="email" placeholder="seu@email.com" value={regData.email} onChange={e => setRegData({...regData, email: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-yellow-400 outline-none transition-colors" />
              </div>
              
              {/* Row 4: Nascimento (Split) e Gênero - Layout Ajustado 2/3 para Data e 1/3 para Gênero */}
              <div className="grid grid-cols-3 gap-3">
                 <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Nascimento</label>
                    <div className="flex gap-2">
                        <input 
                            required 
                            type="text" 
                            maxLength={2} 
                            placeholder="DD" 
                            value={dobParts.d} 
                            onChange={e => handleDatePartChange('d', e.target.value)}
                            className="flex-1 min-w-0 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-center text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-yellow-400 outline-none transition-colors" 
                        />
                        <input 
                            required 
                            type="text" 
                            maxLength={2} 
                            placeholder="MM" 
                            value={dobParts.m} 
                            onChange={e => handleDatePartChange('m', e.target.value)}
                            className="flex-1 min-w-0 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-center text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-yellow-400 outline-none transition-colors" 
                        />
                        <input 
                            required 
                            type="text" 
                            maxLength={4} 
                            placeholder="AAAA" 
                            value={dobParts.y} 
                            onChange={e => handleDatePartChange('y', e.target.value)}
                            className="flex-[1.5] min-w-0 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-center text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-yellow-400 outline-none transition-colors" 
                        />
                    </div>
                 </div>
                 
                 <div className="col-span-1">
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Gênero</label>
                    <select value={regData.gender} onChange={e => setRegData({...regData, gender: e.target.value as any})}
                       className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-yellow-400 outline-none transition-colors">
                        <option value="M">Masculino</option>
                        <option value="F">Feminino</option>
                        <option value="O">Outro</option>
                     </select>
                 </div>
              </div>
              
              <p className="text-xs text-slate-500 mt-2">* Sua data de nascimento será sua senha.</p>
              
              <button disabled={loading} className="w-full bg-slate-900 dark:bg-yellow-400 text-yellow-400 dark:text-slate-900 font-bold py-3 rounded-lg mt-4 transition-all active:scale-[0.98] disabled:opacity-70">
                {loading ? 'Criando...' : 'Criar Conta'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}