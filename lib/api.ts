import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit,
  getDoc,
  QuerySnapshot,
  DocumentData
} from "firebase/firestore";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut 
} from "firebase/auth";
import { db as firestore, auth } from "./firebase"; // Importado como 'firestore' para não conflitar com o export 'db' abaixo
import { User, GameSession, ListPlayer, SystemLog } from '../types';

// --- Local Cache for Synchronous Reads ---
// Isso permite que o resto do app continue usando db.getUsers() sem precisar mudar tudo para async/await imediatamente.
let localUsersCache: User[] = [];
let localSessionsCache: GameSession[] = [];
let localLogsCache: SystemLog[] = [];

// --- Listeners de Tempo Real ---
// Inicia assim que o arquivo é importado para manter o cache atualizado
// Usamos try-catch nos listeners para evitar crash se as permissões ainda não estiverem propagadas
try {
  onSnapshot(collection(firestore, "users"), (snapshot: QuerySnapshot<DocumentData>) => {
    localUsersCache = snapshot.docs.map(doc => doc.data() as User);
  });

  onSnapshot(query(collection(firestore, "sessions"), orderBy("date", "asc")), (snapshot: QuerySnapshot<DocumentData>) => {
    localSessionsCache = snapshot.docs.map(doc => doc.data() as GameSession);
  });

  onSnapshot(query(collection(firestore, "logs"), orderBy("timestamp", "desc"), limit(200)), (snapshot: QuerySnapshot<DocumentData>) => {
    localLogsCache = snapshot.docs.map(doc => doc.data() as SystemLog);
  });
} catch (error) {
  console.warn("Erro ao iniciar listeners do Firestore (pode ser permissão):", error);
}

// --- Helper Functions ---
const getMinutes = (timeStr: string | undefined) => {
    if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
};

// Helper de validação de conflito de horário (1h 50min = 110 minutos)
const validateSessionTimeConflict = (date: string, time: string, excludeSessionId?: string) => {
    const newTimeMinutes = getMinutes(time);
    const MIN_GAP_MINUTES = 110; // 1h 50min

    const conflict = localSessionsCache.find(s => {
        // Ignora a própria sessão se estiver editando
        if (excludeSessionId && s.id === excludeSessionId) return false;
        
        // Ignora sessões em dias diferentes
        if (s.date !== date) return false;

        // Ignora sessões já finalizadas (closed), pois não estão "rolando"
        if (s.status === 'closed') return false;

        const existingTimeMinutes = getMinutes(s.time);
        const diff = Math.abs(newTimeMinutes - existingTimeMinutes);

        return diff < MIN_GAP_MINUTES;
    });

    if (conflict) {
        throw new Error(`Conflito de horário! Já existe o jogo '${conflict.name}' às ${conflict.time}. É necessário um intervalo mínimo de 1h 50min entre partidas.`);
    }
};

export const db = {
  // --- Logger Methods ---
  getLogs(): SystemLog[] {
    return localLogsCache;
  },

  async addLog(action: string, details: string, authorName?: string) {
    // Blindagem: Logs não devem quebrar a aplicação principal
    try {
        const newLog: SystemLog = {
          id: 'log-' + Date.now() + Math.random(),
          timestamp: Date.now(),
          action,
          details,
          authorName
        };
        // Grava no Firestore
        await setDoc(doc(firestore, "logs", newLog.id), newLog);
    } catch (e) {
        console.warn(`[Log Falhou - Não Crítico] ${action}:`, e);
    }
  },

  // --- Auth Methods ---
  async login(email: string, passwordDOB: string): Promise<User> {
    // Check local cache first to distinguish "Email not found" vs "Wrong password"
    // Note: This relies on the cache being populated. If cache is empty, it falls back to Firebase generic error.
    const userExists = localUsersCache.some(u => u.email === email.trim());
    
    if (localUsersCache.length > 0 && !userExists) {
        throw new Error("Este email não possui cadastro.");
    }

    try {
        // 1. Login no Firebase Auth
        const userCredential = await signInWithEmailAndPassword(auth, email.trim(), passwordDOB);
        const firebaseUser = userCredential.user;

        // 2. Buscar dados adicionais no Firestore (role, stats, etc)
        const userDocRef = doc(firestore, "users", firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
            throw new Error("Usuário autenticado, mas dados de perfil não encontrados.");
        }

        const userData = userDoc.data() as User;
        
        // Salva no localStorage apenas para persistência de sessão rápida no frontend
        localStorage.setItem('vg_auth_user_v2', JSON.stringify(userData));
        return userData;
    } catch (error: any) {
        // Se falhar no Firebase e o usuário existia no cache (ou cache vazio), provavelmente é senha
        if (userExists || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
             throw new Error("Senha incorreta. Verifique sua data de nascimento.");
        }
        throw error;
    }
  },

  async register(data: Omit<User, 'uid' | 'role' | 'stats' | 'donations' | 'notifications' | 'createdAt'>): Promise<User> {
    // Sanitização para evitar problemas com espaços extras em nomes compostos
    const safeData = {
        ...data,
        fullName: data.fullName.trim(),
        email: data.email.trim()
    };

    // 1. Criar Auth User
    // A senha será a data de nascimento (dob) conforme sua lógica
    const userCredential = await createUserWithEmailAndPassword(auth, safeData.email, safeData.dob);
    const firebaseUser = userCredential.user;

    // 2. Criar Documento no Firestore
    const newUser: User = {
      ...safeData,
      uid: firebaseUser.uid, // Usa o UID real do Firebase Auth
      role: 0, // MUDANÇA: Começa como 0 (Pendente) para exigir aprovação
      stats: { gamesAttended: 0, gamesMissed: 0 },
      donations: [],
      notifications: [
        {
            id: 'welcome-' + Date.now(),
            message: "Bem-vindo ao Manhãzinha! Sua conta foi criada e está aguardando aprovação.",
            date: Date.now(),
            read: false
        }
      ],
      createdAt: Date.now()
    };

    await setDoc(doc(firestore, "users", firebaseUser.uid), newUser);
    
    // O log agora é seguro e não lança erro para cima se falhar
    await this.addLog("REGISTER", `Novo usuário registrado: ${newUser.fullName} (${newUser.email})`);
    
    localStorage.setItem('vg_auth_user_v2', JSON.stringify(newUser));
    return newUser;
  },

  logout() {
    signOut(auth);
    localStorage.removeItem('vg_auth_user_v2');
  },

  getCurrentUser(): User | null {
    const stored = localStorage.getItem('vg_auth_user_v2');
    if (!stored) return null;
    return JSON.parse(stored);
  },

  // --- User Methods ---
  getUsers(): User[] {
    return localUsersCache;
  },

  async updateProfile(uid: string, data: Partial<User>) {
    // Lógica Específica para Troca de Nick
    if (data.nickname) {
        const currentUser = localUsersCache.find(u => u.uid === uid);
        if (!currentUser) throw new Error("Usuário não encontrado");

        const newNick = data.nickname.trim();
        const oldNick = currentUser.nickname;

        if (newNick.length > 16) {
             throw new Error("O nick deve ter no máximo 16 caracteres.");
        }

        if (newNick !== oldNick) {
            // 1. Verificar Unicidade
            const nickExists = localUsersCache.some(u => 
                u.uid !== uid && 
                u.nickname?.toLowerCase() === newNick.toLowerCase()
            );

            if (nickExists) {
                throw new Error("Este nick já está em uso por outro jogador.");
            }

            // 2. Verificar Rate Limit (2x free, depois 1x por semana)
            const count = currentUser.nicknameChangeCount || 0;
            const lastUpdate = currentUser.nicknameLastUpdated || 0;
            const now = Date.now();
            const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

            if (count >= 2) {
                if (now - lastUpdate < oneWeekMs) {
                    const daysLeft = Math.ceil((oneWeekMs - (now - lastUpdate)) / (24 * 60 * 60 * 1000));
                    throw new Error(`Você já alterou seu nick muitas vezes. Próxima alteração permitida em ${daysLeft} dias.`);
                }
            }

            // Atualiza contadores
            data.nickname = newNick;
            data.nicknameChangeCount = count + 1;
            data.nicknameLastUpdated = now;
        }
    }

    const userRef = doc(firestore, "users", uid);
    await updateDoc(userRef, data);

    // Atualiza storage local se for o próprio usuário
    const currentUser = this.getCurrentUser();
    if (currentUser && currentUser.uid === uid) {
        const updated = { ...currentUser, ...data };
        localStorage.setItem('vg_auth_user_v2', JSON.stringify(updated));
    }
  },

  async updateUserRole(uid: string, newRole: 0 | 1 | 2 | 3) {
      const user = localUsersCache.find(u => u.uid === uid);
      if (!user) return;
      
      const oldRole = user.role;
      const userRef = doc(firestore, "users", uid);
      await updateDoc(userRef, { role: newRole });

      await this.addLog("ROLE_CHANGE", `Usuário ${user.fullName} alterado de ${oldRole} para ${newRole}`, "Sistema");

      // Notification Logic
      let notifMsg = "";
      if (newRole === 1 && oldRole === 0) {
          notifMsg = "🎉 Sua conta foi aprovada! Agora você pode entrar nos jogos.";
      } else if (newRole === 2) {
          notifMsg = "🛡️ Você foi promovido a Ademiro!";
      } else if (newRole === 0) {
          notifMsg = "⚠️ Sua conta voltou para status pendente.";
      }
      
      if (notifMsg) {
          await this.addNotification(uid, notifMsg);
      }
  },

  async rejectUser(uid: string) {
      const user = localUsersCache.find(u => u.uid === uid);
      const name = user ? user.fullName : "Desconhecido";
      
      // Remove documento do Firestore
      // Nota: O usuário ainda existirá no Auth do Firebase, mas sem documento no 'users',
      // o login irá falhar conforme a lógica em db.login()
      await deleteDoc(doc(firestore, "users", uid));
      
      await this.addLog("REJECT_USER", `Usuário reprovado/excluído: ${name} (${uid})`);
  },

  // --- Session Methods ---
  getSessions(): GameSession[] {
    return localSessionsCache;
  },
  
  // Função para verificar sessões expiradas (> 4 horas)
  async checkAndCloseExpiredSessions() {
      const now = Date.now();
      const expirationMs = 4 * 60 * 60 * 1000; // 4 hours
      
      const sessionsToClose = localSessionsCache.filter(s => {
          if (s.status === 'closed') return false;
          const sessionStart = new Date(`${s.date}T${s.time}`).getTime();
          // Se já passou 4 horas do início
          return (now - sessionStart) > expirationMs;
      });

      if (sessionsToClose.length === 0) return;

      // Busca Admins e Devs para notificar
      const admins = localUsersCache.filter(u => u.role === 2 || u.role === 3);

      for (const session of sessionsToClose) {
          await this.closeSession(session.id);
          
          const msg = `⚠️ O jogo '${session.name}' foi encerrado automaticamente (4h+). Por favor, atualize a lista de presença.`;
          
          for (const admin of admins) {
              await this.addNotification(admin.uid, msg);
          }
          
          await this.addLog("AUTO_CLOSE", `Sessão ${session.name} encerrada automaticamente por tempo excedido (4h). Admins notificados.`, "Sistema");
      }
  },

  async createSession(sessionData: Omit<GameSession, 'id' | 'players' | 'waitlist' | 'status'>) {
    // Validação de Conflito de Horário (1h 50min)
    validateSessionTimeConflict(sessionData.date, sessionData.time);

    // Cria ID manualmente ou deixa o Firestore criar.
    // Para manter consistência com sua tipagem que exige 'id', vamos criar um ref.
    const newSessionRef = doc(collection(firestore, "sessions"));
    
    const newSession: GameSession = {
      ...sessionData,
      id: newSessionRef.id,
      players: [],
      waitlist: [],
      status: 'open'
    };
    
    await setDoc(newSessionRef, newSession);
    await this.addLog("CREATE_SESSION", `Sessão criada: ${newSession.name} (${newSession.type}) para ${newSession.date}`);
  },
  
  async updateSession(sessionId: string, data: Partial<GameSession>) {
      const session = localSessionsCache.find(s => s.id === sessionId);
      if (!session) throw new Error("Sessão não encontrada.");

      // Se estiver atualizando Data ou Hora, valida conflito
      if (data.date || data.time) {
          const targetDate = data.date || session.date;
          const targetTime = data.time || session.time;
          validateSessionTimeConflict(targetDate, targetTime, sessionId);
      }

      const sessionRef = doc(firestore, "sessions", sessionId);
      await updateDoc(sessionRef, data);
      await this.addLog("UPDATE_SESSION", `Sessão ${sessionId} atualizada.`);
  },
  
  async closeSession(sessionId: string) {
      const sessionRef = doc(firestore, "sessions", sessionId);
      await updateDoc(sessionRef, { status: 'closed' });
      await this.addLog("CLOSE_SESSION", `Sessão ${sessionId} finalizada.`);
  },

  // Adicionado parâmetro asSpectator para logica de campeonato
  async joinSession(sessionId: string, user: User, arrivalTime: string, isGuest = false, guestData?: any, asSpectator = false) {
    const sessionRef = doc(firestore, "sessions", sessionId);
    const sessionDoc = await getDoc(sessionRef);
    
    if (!sessionDoc.exists()) throw new Error("Sessão não encontrada.");
    const session = sessionDoc.data() as GameSession;

    // --- New Constraints ---
    
    // 1. Gender Restriction
    if (!isGuest) { // Convidados assumimos que o anfitrião verificou, ou bloqueia tudo se quiser rigor
        // Se for campeonato E o usuário estiver entrando como espectador (torcida), PULA a verificação
        const skipGenderCheck = session.type === 'campeonato' && asSpectator;

        if (!skipGenderCheck && session.genderRestriction !== 'all') {
            // 'M' permite 'M' e 'O'. 'F' permite 'F' e 'O'.
            const allowed = user.gender === session.genderRestriction || user.gender === 'O';
            if (!allowed) {
                const mapGender = { 'M': 'Masculino', 'F': 'Feminino' };
                throw new Error(`Esta lista é restrita ao público ${mapGender[session.genderRestriction]}.`);
            }
        }
    }

    // 2. Guest Restriction
    if (isGuest) {
        if (!session.allowGuests) throw new Error("Esta lista não permite convidados.");
        if (session.type === 'campeonato') throw new Error("Campeonatos não permitem convidados.");
    }
    
    // 3. Time Constraints Logic (Updated to be purely math-based)
    if (!arrivalTime || !arrivalTime.includes(':')) {
        throw new Error("Horário de chegada inválido.");
    }

    // REMOVIDO: A restrição de só entrar 20 min antes foi retirada para permitir inscrições antecipadas.

    // Validação de Chegada Tardia (> 4 horas)
    const startMinutesVal = getMinutes(session.time);
    const arrivalMinutesVal = getMinutes(arrivalTime);
    
    let diffMinutes = arrivalMinutesVal - startMinutesVal;

    // Ajuste para virada de dia (Ex: Jogo 23h, Chegada 01h)
    // Se a diferença for negativa e maior que 12h (720min), assume dia seguinte
    if (diffMinutes < -720) {
        diffMinutes += 1440; // +24h
    }

    // 4 horas = 240 minutos
    if (diffMinutes > 240) {
        throw new Error("Não é permitido entrar na lista para chegar mais de 4 horas após o início.");
    }

    // Validation Logic (Duplication)
    const userIdToCheck = isGuest ? `guest-${Date.now()}` : user.uid;
    if (!isGuest) {
        if (session.players.some(p => p.userId === user.uid) || session.waitlist.some(p => p.userId === user.uid)) {
            throw new Error("Você já está nesta lista.");
        }
    }

    // Lógica de atraso (>30min): Só se aplica se NÃO for campeonato e NÃO for resenha
    let isLate = false;
    if (session.type !== 'campeonato' && session.type !== 'resenha') {
        // Usa a mesma lógica de minutos
        isLate = diffMinutes > 30;
    }
    
    const isFull = session.players.length >= session.maxSpots;

    const listPlayer: any = {
        userId: userIdToCheck,
        name: isGuest ? (guestData?.name + ' ' + (guestData?.surname || '')) : (user.nickname || user.fullName),
        isGuest,
        linkedTo: isGuest ? user.uid : null, 
        joinedAt: Date.now(),
        arrivalEstimate: arrivalTime,
        guestContact: isGuest ? guestData : null 
    };

    const updates: any = {};

    // Campeonato Spectator Logic:
    // Se for espectador, vai direto pra waitlist (Torcida).
    // Se for campeonato mas 'player', tenta entrar na main list. Se cheio, vai pra waitlist.
    if (session.type === 'campeonato' && asSpectator) {
         updates.waitlist = [...session.waitlist, listPlayer];
    } else {
         if (isFull || isLate) {
            updates.waitlist = [...session.waitlist, listPlayer];
        } else {
            updates.players = [...session.players, listPlayer];
        }
    }

    await updateDoc(sessionRef, updates);
    
    let logDetails = "";
    if (isGuest) {
        logDetails = `Convidado ${listPlayer.name} adicionado por ${user.fullName} em ${session.name}`;
    } else {
        const roleStr = (session.type === 'campeonato' && asSpectator) ? " (Torcida)" : "";
        logDetails = `${user.fullName} entrou em ${session.name}${roleStr} (Chegada: ${arrivalTime})`;
    }
    
    await this.addLog("JOIN", logDetails, user.fullName);

    // --- PROGRESS NOTIFICATION LOGIC ---
    // Envia notificação para TODOS os usuários ativos quando atinge 50%, 75% ou 100%
    const currentCount = session.players.length + (updates.players ? 1 : 0); // Considera o novo jogador se foi adicionado na main list
    const max = session.maxSpots;
    
    let progressMsg = "";
    if (currentCount === Math.ceil(max * 0.5)) {
        progressMsg = `A lista ${session.name} chegou a 50% de lotação!`;
    } else if (currentCount === Math.ceil(max * 0.75)) {
         progressMsg = `A lista ${session.name} chegou a 75% de lotação!`;
    } else if (currentCount === max) {
         progressMsg = `A lista ${session.name} lotou (100%)!`;
    }

    if (progressMsg) {
        // Pega todos os usuários ativos (role != 0) do cache
        const allActiveUsers = localUsersCache.filter(u => u.role !== 0);

        // Prepara batch de promises para não travar
        const notifPromises = allActiveUsers.map(u => {
            // Verifica se o usuário já está na lista (para personalizar mensagem)
            // Se updates.players existe, o array atual ainda não tem o novo player, mas currentCount já considerou.
            // Aqui verificamos no array antigo + o player atual
            const isInside = session.players.some(p => p.userId === u.uid) || (u.uid === user.uid && !asSpectator && !isGuest && !isLate && !isFull);
            
            let finalMsg = progressMsg;
            // Se não está na lista e ainda tem vaga, manda mensagem de urgência
            if (!isInside && currentCount < max) {
                 finalMsg = `Corre! 🏃 ${progressMsg} Garanta sua vaga!`;
            }

            return this.addNotification(u.uid, finalMsg);
        });
        
        // Executa sem await para não bloquear o retorno da função joinSession
        Promise.all(notifPromises).catch(err => console.error("Erro ao enviar broadcast de notificação:", err));
    }
  },

  async leaveSession(sessionId: string, userId: string) {
    const sessionRef = doc(firestore, "sessions", sessionId);
    const sessionDoc = await getDoc(sessionRef);
    if (!sessionDoc.exists()) throw new Error("Sessão não encontrada");
    
    let session = sessionDoc.data() as GameSession;

    // 1. Identify User and Guests
    const playersToRemove = [userId];
    const linkedGuests = [...session.players, ...session.waitlist]
        .filter(p => p.linkedTo === userId)
        .map(p => p.userId);
    playersToRemove.push(...linkedGuests);

    // 2. Remove
    session.players = session.players.filter(p => !playersToRemove.includes(p.userId));
    session.waitlist = session.waitlist.filter(p => !playersToRemove.includes(p.userId));

    // 3. Promotion Logic
    const startMinutes = getMinutes(session.time);
    
    // Só promove automaticamente se NÃO for campeonato (pois lista de espera lá é torcida)
    // E NÃO for resenha (que não tem espera lógica)
    if (session.type !== 'campeonato' && session.type !== 'resenha') {
        while (session.players.length < session.maxSpots && session.waitlist.length > 0) {
            const candidateIndex = session.waitlist.findIndex(p => {
                const arrMinutes = getMinutes(p.arrivalEstimate);
                
                // Lógica de minutos para promoção
                let diff = arrMinutes - startMinutes;
                if (diff < -720) diff += 1440;

                return diff <= 30; // Elegível se atraso for <= 30 min
            });
            
            if (candidateIndex === -1) break; 
            const [candidate] = session.waitlist.splice(candidateIndex, 1);
            if (candidate) {
                session.players.push(candidate);
            }
        }
    }

    await updateDoc(sessionRef, {
        players: session.players,
        waitlist: session.waitlist
    });

    const user = localUsersCache.find(u => u.uid === userId);
    const authorName = user ? (user.nickname || user.fullName) : "Usuário";
    await this.addLog("LEAVE", `Saiu do jogo ${session.name}.`, authorName);
  },

  async deleteSession(sessionId: string) {
      await deleteDoc(doc(firestore, "sessions", sessionId));
      await this.addLog("DELETE_SESSION", `Sessão ${sessionId} cancelada.`);
  },

  async updatePlayerArrival(sessionId: string, playerId: string, newTime: string) {
    const sessionRef = doc(firestore, "sessions", sessionId);
    const sessionDoc = await getDoc(sessionRef);
    if (!sessionDoc.exists()) return;
    
    const session = sessionDoc.data() as GameSession;

    // Deep clone to modify
    const newPlayers = [...session.players];
    const newWaitlist = [...session.waitlist];

    // Encontra o jogador
    const playerIndex = newPlayers.findIndex(p => p.userId === playerId);
    const waitlistIndex = newWaitlist.findIndex(p => p.userId === playerId);

    const startMinutes = getMinutes(session.time);
    const arrivalMinutes = getMinutes(newTime);
    let diff = arrivalMinutes - startMinutes;
    if (diff < -720) diff += 1440;

    // Se for Campeonato ou Resenha, APENAS atualiza o horário, não move ninguem.
    if (session.type === 'campeonato' || session.type === 'resenha') {
        if (playerIndex !== -1) newPlayers[playerIndex].arrivalEstimate = newTime;
        if (waitlistIndex !== -1) newWaitlist[waitlistIndex].arrivalEstimate = newTime;
        await updateDoc(sessionRef, { players: newPlayers, waitlist: newWaitlist });
        return;
    }

    // Logica padrão para Pelada/Treino (Late -> Waitlist)
    if (playerIndex !== -1) {
        const player = newPlayers[playerIndex];
        player.arrivalEstimate = newTime;

        const isLate = diff > 30;

        if (isLate) {
            newPlayers.splice(playerIndex, 1);
            newWaitlist.push(player);
            
            while (newPlayers.length < session.maxSpots && newWaitlist.length > 0) {
                const candidateIndex = newWaitlist.findIndex(p => {
                    const am = getMinutes(p.arrivalEstimate);
                    let d = am - startMinutes;
                    if (d < -720) d += 1440;
                    return d <= 30;
                });
                
                if (candidateIndex === -1) break;

                const [candidate] = newWaitlist.splice(candidateIndex, 1);
                newPlayers.push(candidate);
            }
            await this.addLog("AUTO_WAITLIST", `Jogador ${player.name} movido para espera (atraso > 30m).`, "Sistema");
        } 
    
    } else if (waitlistIndex !== -1) {
        const player = newWaitlist[waitlistIndex];
        player.arrivalEstimate = newTime;

        const isLate = diff > 30;
        const hasSpot = newPlayers.length < session.maxSpots;

        if (!isLate && hasSpot) {
            newWaitlist.splice(waitlistIndex, 1);
            newPlayers.push(player);
            await this.addLog("PROMOTION", `Jogador ${player.name} subiu da lista de espera.`, "Sistema");
        }
    }

    await updateDoc(sessionRef, { players: newPlayers, waitlist: newWaitlist });
  },

  async togglePlayerAttendance(sessionId: string, playerId: string, status: boolean) {
      const sessionRef = doc(firestore, "sessions", sessionId);
      const session = localSessionsCache.find(s => s.id === sessionId);
      if (!session) return;

      const playerInMain = session.players.find(p => p.userId === playerId);
      // Jogadores na espera também podem ter presença marcada? Vamos assumir que sim, para histórico.
      const playerInWait = session.waitlist.find(p => p.userId === playerId);
      
      const player = playerInMain || playerInWait;

      if (!player) return;

      const wasPresent = !!player.attended;
      const isNowPresent = status;

      // Se nada mudou, ignora
      if (wasPresent === isNowPresent) return;

      const newPlayers = session.players.map(p => {
          if (p.userId === playerId) return { ...p, attended: status };
          return p;
      });
      const newWaitlist = session.waitlist.map(p => {
          if (p.userId === playerId) return { ...p, attended: status };
          return p;
      });

      await updateDoc(sessionRef, { players: newPlayers, waitlist: newWaitlist });

      // Atualiza Stats do Usuário (Se não for convidado)
      if (!player.isGuest) {
          const user = localUsersCache.find(u => u.uid === playerId);
          if (user) {
             const userRef = doc(firestore, "users", playerId);
             
             let newAttended = user.stats.gamesAttended;
             let newMissed = user.stats.gamesMissed;

             if (isNowPresent) {
                 // Marcou como presente
                 newAttended++;
                 // Se ele estava contado como ausente antes (e tinha pontos de falta), reduzimos a falta
                 if (!wasPresent && newMissed > 0) newMissed--;
             } else {
                 // Desmarcou presença (marcou como ausente)
                 newAttended = Math.max(0, newAttended - 1);
                 newMissed++;
             }

             await updateDoc(userRef, { 
                 "stats.gamesAttended": newAttended,
                 "stats.gamesMissed": newMissed
             });
          }
      }
  },

  // --- Notification Methods ---
  async addNotification(userId: string, message: string) {
      const userRef = doc(firestore, "users", userId);
      const user = localUsersCache.find(u => u.uid === userId);
      if (!user) return;

      const newNotif = {
          id: 'notif-' + Date.now() + Math.random(),
          message,
          date: Date.now(),
          read: false
      };
      
      const newNotifications = [newNotif, ...user.notifications];
      await updateDoc(userRef, { notifications: newNotifications });
  },

  async markNotificationsRead(userId: string) {
      const userRef = doc(firestore, "users", userId);
      const user = localUsersCache.find(u => u.uid === userId);
      if (!user) return;

      const newNotifs = user.notifications.map(n => ({ ...n, read: true }));
      await updateDoc(userRef, { notifications: newNotifs });
  },

  async clearNotifications(userId: string) {
      const userRef = doc(firestore, "users", userId);
      await updateDoc(userRef, { notifications: [] });
  }
};