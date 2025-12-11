import React, { useState } from 'react';
import { db } from '../lib/mockFirebase';
import { User } from '../types';
import { Volleyball, AlertCircle, ShieldCheck, Code, User as UserIcon, Sun } from 'lucide-react';

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

  const handleQuickLogin = async (roleEmail: string, rolePass: string) => {
    setError("");
    setLoading(true);
    try {
        const user = await db.login(roleEmail, rolePass);
        onSuccess(user);
    } catch (err: any) {
        setError("Login Demo falhou: " + err.message);
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
      setError("Data de nascimento deve ter exatamente 8 dígitos (ddmmaaaa)");
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

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white min-h-screen transition-colors duration-300">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700 transition-colors duration-300">
        
        {/* Header - BRANDING MANHÃZINHA (Yellow/Black) */}
        <div className="bg-yellow-400 p-8 flex flex-col items-center text-slate-900">
          <div className="bg-white p-4 rounded-full shadow-lg mb-4 border-4 border-slate-900 overflow-hidden">
            {!imgError ? (
                <img 
                    src="./mascote.png" 
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

                {/* Quick Logins */}
                <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold text-center mb-3 tracking-wider">Modo de Teste Rápido</p>
                    <div className="grid grid-cols-3 gap-2">
                        <button 
                            type="button"
                            onClick={() => handleQuickLogin('dev@volley.com', '01012000')}
                            className="flex flex-col items-center justify-center p-2 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg transition-colors group"
                        >
                            <Code size={16} className="mb-1 group-hover:scale-110 transition-transform"/>
                            <span className="text-[10px] font-bold">DEV</span>
                        </button>

                        <button 
                            type="button"
                            onClick={() => handleQuickLogin('admin@volley.com', '01012000')}
                            className="flex flex-col items-center justify-center p-2 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-lg transition-colors group"
                        >
                            <ShieldCheck size={16} className="mb-1 group-hover:scale-110 transition-transform"/>
                            <span className="text-[10px] font-bold">ADEMIRO</span>
                        </button>

                         <button 
                            type="button"
                            onClick={() => handleQuickLogin('ana@volley.com', '11111111')}
                            className="flex flex-col items-center justify-center p-2 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 rounded-lg transition-colors group"
                        >
                            <UserIcon size={16} className="mb-1 group-hover:scale-110 transition-transform"/>
                            <span className="text-[10px] font-bold">USER</span>
                        </button>
                    </div>
                </div>
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
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Celular / WhatsApp</label>
                <input required type="tel" maxLength={15} placeholder="(99) 99999-9999" value={regData.phone} onChange={e => setRegData({...regData, phone: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-yellow-400 outline-none transition-colors" />
              </div>

              {/* Row 3: Email */}
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Email</label>
                <input required type="email" placeholder="seu@email.com" value={regData.email} onChange={e => setRegData({...regData, email: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-yellow-400 outline-none transition-colors" />
              </div>
              
              {/* Row 4: Nascimento e Gênero */}
              <div className="grid grid-cols-2 gap-3">
                 <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Nascimento</label>
                    <input required type="text" maxLength={8} placeholder="ddmmaaaa" value={regData.dob} onChange={e => setRegData({...regData, dob: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-yellow-400 outline-none transition-colors" />
                 </div>
                 
                 <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Gênero</label>
                    <select value={regData.gender} onChange={e => setRegData({...regData, gender: e.target.value as any})}
                       className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-yellow-400 outline-none transition-colors">
                        <option value="M">Masculino</option>
                        <option value="F">Feminino</option>
                        <option value="O">Outro</option>
                     </select>
                 </div>
              </div>
              
              <p className="text-xs text-slate-500 mt-2">* Sua data de nascimento (ddmmaaaa) será sua senha.</p>
              
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