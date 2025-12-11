import { User, GameSession, ListPlayer, UserStats, AppNotification, SystemLog } from '../types';

// Storage Keys
const KEY_USERS = 'vg_users_v2';
const KEY_SESSIONS = 'vg_sessions_v2';
const KEY_AUTH_USER = 'vg_auth_user_v2';
const KEY_LOGS = 'vg_system_logs_v1';

// --- Initial Mock Data ---

// 0. DEV User (Top Level)
const MOCK_DEV: User = {
  uid: 'dev-001',
  fullName: 'Desenvolvedor Master',
  nickname: 'Dev',
  email: 'dev@volley.com',
  phone: '0000000000',
  dob: '01012000',
  gender: 'O',
  role: 3, // Dev Role
  stats: { gamesAttended: 0, gamesMissed: 0 },
  donations: [],
  notifications: [],
  createdAt: Date.now()
};

// 1. Admin User
const MOCK_ADMIN: User = {
  uid: 'admin-001',
  fullName: 'Admin Sistema',
  nickname: 'Admin',
  email: 'admin@volley.com',
  phone: '0000000000',
  dob: '01012000',
  gender: 'O',
  role: 2, // Admin Role
  stats: { gamesAttended: 100, gamesMissed: 0 },
  donations: [],
  notifications: [],
  createdAt: Date.now()
};

// 2. Standard Player 1
const MOCK_USER_1: User = {
  uid: 'user-001',
  fullName: 'Ana Silva',
  nickname: 'Ana',
  email: 'ana@volley.com',
  phone: '11999999999',
  dob: '11111111',
  gender: 'F',
  role: 1, // Player Role
  stats: { gamesAttended: 12, gamesMissed: 1 },
  donations: [],
  notifications: [],
  createdAt: Date.now()
};

// 3. Standard Player 2
const MOCK_USER_2: User = {
  uid: 'user-002',
  fullName: 'Bruno Santos',
  nickname: 'Brunão',
  email: 'bruno@volley.com',
  phone: '11888888888',
  dob: '22222222',
  gender: 'M',
  role: 1, // Player Role
  stats: { gamesAttended: 5, gamesMissed: 0 },
  donations: [],
  notifications: [],
  createdAt: Date.now()
};

// 4. Standard Player 3
const MOCK_USER_3: User = {
  uid: 'user-003',
  fullName: 'Carla Dias',
  email: 'carla@volley.com',
  phone: '11777777777',
  dob: '33333333',
  gender: 'F',
  role: 1, // Player Role
  stats: { gamesAttended: 20, gamesMissed: 2 },
  donations: [],
  notifications: [],
  createdAt: Date.now()
};

// Initial Array
const INITIAL_USERS = [MOCK_DEV, MOCK_ADMIN, MOCK_USER_1, MOCK_USER_2, MOCK_USER_3];

// Helper to simulate delay
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// Helper to calculate minutes from HH:MM - ROBUST VERSION
const getMinutes = (timeStr: string | undefined) => {
    if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
};

export const db = {
  // --- Logger Methods ---
  getLogs(): SystemLog[] {
    const stored = localStorage.getItem(KEY_LOGS);
    return stored ? JSON.parse(stored) : [];
  },

  addLog(action: string, details: string, authorName?: string) {
    const logs = this.getLogs();
    const newLog: SystemLog = {
      id: 'log-' + Date.now() + Math.random(),
      timestamp: Date.now(),
      action,
      details,
      authorName
    };
    logs.unshift(newLog); // Add to top
    // Keep max 200 logs to prevent overflow in mock
    if (logs.length > 200) logs.pop();
    localStorage.setItem(KEY_LOGS, JSON.stringify(logs));
  },

  // --- Auth Methods ---
  async login(email: string, passwordDOB: string): Promise<User> {
    await delay(300);
    const users = this.getUsers();
    const user = users.find(u => u.email === email);
    
    if (!user) throw new Error("Usuário não encontrado.");
    if (user.dob !== passwordDOB) throw new Error("Credenciais inválidas (Senha é sua data de nascimento ddmmaaaa).");
    
    // Refresh user data from DB before storing to auth
    localStorage.setItem(KEY_AUTH_USER, JSON.stringify(user));
    return user;
  },

  async register(data: Omit<User, 'uid' | 'role' | 'stats' | 'donations' | 'notifications' | 'createdAt'>): Promise<User> {
    await delay(500);
    const users = this.getUsers();
    if (users.some(u => u.email === data.email)) throw new Error("Email já cadastrado.");

    const newUser: User = {
      ...data,
      // Default nickname is First Name
      nickname: data.fullName.split(' ')[0],
      uid: 'user-' + Date.now(),
      role: 1, // DEFAULT IS NOW 1 (USER/PLAYER), NOT 0 (PENDING)
      stats: { gamesAttended: 0, gamesMissed: 0 },
      donations: [],
      notifications: [{
        id: 'notif-' + Date.now(),
        message: 'Bem-vindo ao VolleyGroup! Verifique a aba Jogos para participar.',
        date: Date.now(),
        read: false
      }],
      createdAt: Date.now()
    };

    users.push(newUser);
    this.saveUsers(users);
    this.addLog("CADASTRO", `Novo usuário registrado: ${newUser.fullName}`, newUser.fullName);
    localStorage.setItem(KEY_AUTH_USER, JSON.stringify(newUser));
    return newUser;
  },

  async logout() {
    localStorage.removeItem(KEY_AUTH_USER);
  },

  getCurrentUser(): User | null {
    const stored = localStorage.getItem(KEY_AUTH_USER);
    if (!stored) return null;
    
    // Always try to get the freshest version from the user list if possible
    const localUser = JSON.parse(stored);
    const users = this.getUsers();
    const freshUser = users.find(u => u.uid === localUser.uid);
    return freshUser || localUser;
  },

  // --- Firestore / Data Methods ---
  getUsers(): User[] {
    const stored = localStorage.getItem(KEY_USERS);
    if (!stored) {
      this.saveUsers(INITIAL_USERS);
      return INITIAL_USERS;
    }
    return JSON.parse(stored);
  },

  saveUsers(users: User[]) {
    localStorage.setItem(KEY_USERS, JSON.stringify(users));
  },

  async updateProfile(uid: string, data: Partial<User>): Promise<User> {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.uid === uid);
    if (idx === -1) throw new Error("Usuário não encontrado");

    users[idx] = { ...users[idx], ...data };
    this.saveUsers(users);
    
    // Update Local Storage if it's the current user
    const current = this.getCurrentUser();
    if (current && current.uid === uid) {
       localStorage.setItem(KEY_AUTH_USER, JSON.stringify(users[idx]));
    }
    
    this.addLog("UPDATE_PERFIL", `Atualizou perfil (ex: apelido para ${data.nickname})`, users[idx].fullName);
    return users[idx];
  },

  async updateUserRole(targetUid: string, newRole: 0 | 1 | 2 | 3): Promise<void> {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.uid === targetUid);
    if (idx > -1) {
      const oldRole = users[idx].role;
      users[idx].role = newRole;
      this.saveUsers(users);
      this.addLog("ADMIN_ROLE", `Alterou permissão de ${users[idx].fullName} de ${oldRole} para ${newRole}`, "Admin");
    }
  },

  getSessions(): GameSession[] {
    const stored = localStorage.getItem(KEY_SESSIONS);
    return stored ? JSON.parse(stored) : [];
  },

  saveSessions(sessions: GameSession[]) {
    localStorage.setItem(KEY_SESSIONS, JSON.stringify(sessions));
  },

  async createSession(sessionData: Omit<GameSession, 'id' | 'players' | 'waitlist' | 'status'>): Promise<void> {
    const sessions = this.getSessions();
    const newSession: GameSession = {
      ...sessionData,
      id: 'sess-' + Date.now(),
      players: [],
      waitlist: [],
      status: 'open'
    };
    sessions.unshift(newSession); 
    this.saveSessions(sessions);
    
    // LOG
    const users = this.getUsers();
    const creator = users.find(u => u.uid === sessionData.createdBy)?.fullName || "Admin";
    this.addLog("NOVA_SESSAO", `Sessão criada: ${newSession.name} (${newSession.date})`, creator);
  },

  async deleteSession(sessionId: string): Promise<void> {
    const sessions = this.getSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    // Notify all users in the list
    const allPlayerIds = [
      ...session.players.map(p => p.linkedTo || p.userId),
      ...session.waitlist.map(p => p.linkedTo || p.userId)
    ];
    // Deduplicate IDs 
    const uniqueUserIds = [...new Set(allPlayerIds)];

    const users = this.getUsers();
    let usersUpdated = false;

    // Filter only real users (exclude 'guest-...') to prevent finding undefined users
    uniqueUserIds.forEach(uid => {
      if (!uid.startsWith('guest-')) {
        const userIdx = users.findIndex(u => u.uid === uid);
        if (userIdx > -1) {
          users[userIdx].notifications.unshift({
            id: 'alert-' + Date.now() + Math.random(),
            message: `URGENTE: A sessão "${session.name}" agendada para ${session.date} foi CANCELADA pelo admin.`,
            date: Date.now(),
            read: false
          });
          usersUpdated = true;
        }
      }
    });

    if (usersUpdated) this.saveUsers(users);

    // Remove session
    const newSessions = sessions.filter(s => s.id !== sessionId);
    this.saveSessions(newSessions);

    // LOG
    this.addLog("CANCELAR_SESSAO", `Sessão cancelada: ${session.name} - Partida apagada do sistema.`, "Admin");
  },

  // --- Complex Transaction Logic ---
  async joinSession(sessionId: string, user: User, arrivalTime: string, isGuest = false, guestData?: any): Promise<void> {
    const sessions = this.getSessions();
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    if (sessionIndex === -1) throw new Error("Sessão não encontrada");
    
    const session = sessions[sessionIndex];
    
    if (isGuest) {
      if (Date.now() < session.guestWindowOpenTime) {
        throw new Error("A janela para convidados ainda não abriu.");
      }
      // Check if user already has a guest
      const existingGuest = session.players.find(p => p.linkedTo === user.uid) || session.waitlist.find(p => p.linkedTo === user.uid);
      if (existingGuest) throw new Error("Você já tem um convidado nesta lista.");
    } else {
      if (session.players.some(p => p.userId === user.uid)) throw new Error("Você já está na lista.");
    }

    const playerEntry: ListPlayer = {
      userId: isGuest ? `guest-${Date.now()}` : user.uid,
      // If registered user, use Nickname or Fullname. If guest, use guest data.
      name: isGuest ? `${guestData.name} ${guestData.surname}` : (user.nickname || user.fullName),
      isGuest,
      linkedTo: isGuest ? user.uid : undefined,
      guestContact: guestData,
      joinedAt: Date.now(),
      arrivalEstimate: arrivalTime,
      attended: false // Default to false
    };

    // Late Check Logic
    const sessionMins = getMinutes(session.time);
    const arrivalMins = getMinutes(arrivalTime);
    // If arrival is more than 30 mins after session start, FORCE waitlist
    const isLate = (arrivalMins - sessionMins) > 30;

    let logDetail = "";
    
    // Condition to join MAIN LIST:
    // 1. Not Late
    // 2. Spots available
    if (!isLate && session.players.length < session.maxSpots) {
      session.players.push(playerEntry);
      if (!isGuest) {
         await this.incrementStats(user.uid, 'gamesAttended');
      }
      logDetail = isGuest 
        ? `${user.fullName} adicionou convidado: ${playerEntry.name}`
        : `${user.fullName} (como ${playerEntry.name}) entrou na lista principal`;
    } else {
      // Goes to Waitlist either because full OR late
      session.waitlist.push(playerEntry);
      const reason = isLate ? "Atraso > 30min" : "Lista Cheia";
      logDetail = isGuest 
        ? `${user.fullName} adicionou convidado na FILA (${reason}): ${playerEntry.name}`
        : `${user.fullName} entrou na FILA (${reason})`;
    }

    this.saveSessions(sessions);
    this.addLog(isGuest ? "ADD_CONVIDADO" : "ENTRAR_LISTA", `${logDetail} - ${session.name}`, user.fullName);
  },

  async updatePlayerArrival(sessionId: string, userId: string, newTime: string): Promise<void> {
    const sessions = this.getSessions();
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    if (sessionIndex === -1) throw new Error("Sessão não encontrada");
    const session = sessions[sessionIndex];

    // Find Player
    let isInMain = true;
    let pIdx = session.players.findIndex(p => p.userId === userId);
    
    if (pIdx === -1) {
        isInMain = false;
        pIdx = session.waitlist.findIndex(p => p.userId === userId);
    }
    
    if (pIdx === -1) throw new Error("Jogador não encontrado na lista.");

    // Update Time
    const player = isInMain ? session.players[pIdx] : session.waitlist[pIdx];
    player.arrivalEstimate = newTime;

    // Check Logic
    const sessionMins = getMinutes(session.time);
    const arrivalMins = getMinutes(newTime);
    const isLate = (arrivalMins - sessionMins) > 30;

    // Case 1: Player is in Main List BUT is now late -> Move to Waitlist
    if (isInMain && isLate) {
        // Remove from players
        session.players.splice(pIdx, 1);
        // Add to waitlist
        session.waitlist.push(player);
        
        // Since a spot opened in Main, check if we can promote someone from Waitlist
        // Promote first person who is NOT late
        const validWaiterIdx = session.waitlist.findIndex(p => {
            const pMins = getMinutes(p.arrivalEstimate);
            return (pMins - sessionMins) <= 30;
        });

        if (validWaiterIdx > -1) {
            const promoted = session.waitlist.splice(validWaiterIdx, 1)[0];
            session.players.push(promoted);

            // NOTIFY PROMOTED USER
            const users = this.getUsers();
            const recipientId = promoted.isGuest ? promoted.linkedTo : promoted.userId;
            const uIdx = users.findIndex(u => u.uid === recipientId);
            if (uIdx > -1 && recipientId) { // Check recipientId is valid
                users[uIdx].notifications.unshift({
                    id: `n-${Date.now()}-${Math.random()}`,
                    message: `Vaga liberada! ${promoted.isGuest ? 'Seu convidado ' + promoted.name : 'Você'} entrou na lista principal de "${session.name}" pois outro jogador atrasou.`,
                    date: Date.now(),
                    read: false
                });
                this.saveUsers(users);
            }
        }
    }
    // Case 2: Player is in Waitlist AND is now on time AND there is space -> Move to Main
    else if (!isInMain && !isLate && session.players.length < session.maxSpots) {
        // Remove from waitlist
        session.waitlist.splice(pIdx, 1);
        // Add to players
        session.players.push(player);

         // NOTIFY SELF (Less critical since they just did the action, but good for consistency/log)
         const users = this.getUsers();
         const recipientId = player.isGuest ? player.linkedTo : player.userId;
         const uIdx = users.findIndex(u => u.uid === recipientId);
         if (uIdx > -1 && recipientId) {
            users[uIdx].notifications.unshift({
                id: `n-${Date.now()}-${Math.random()}`,
                message: `Horário ajustado! ${player.isGuest ? 'Seu convidado ' + player.name : 'Você'} entrou na lista principal de "${session.name}".`,
                date: Date.now(),
                read: false
            });
            this.saveUsers(users);
        }
    }

    this.saveSessions(sessions);
  },

  async leaveSession(sessionId: string, userId: string): Promise<void> {
    console.log("--- DEBUG LEAVE SESSION START ---", { sessionId, userId });
    this.addLog("[DEBUG] START", `Iniciando saída: Sessão ${sessionId}, User ${userId}`, "SYSTEM");

    const sessions = this.getSessions();
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    if (sessionIndex === -1) {
         console.error("DEBUG: Sessão não encontrada");
         this.addLog("[DEBUG] ERROR", `Sessão não encontrada`, "SYSTEM");
         throw new Error("Sessão não encontrada ao tentar sair.");
    }
    
    const session = sessions[sessionIndex];
    console.log("DEBUG: Sessão encontrada", session.name);

    // Find user name for logging before removing
    let userName = "Desconhecido";
    const mainPlayer = session.players.find(p => p.userId === userId) || session.waitlist.find(p => p.userId === userId);
    
    if (!mainPlayer) {
        // Also check if user is an owner of a guest but somehow not in the list themselves (rare edge case, but checking)
        // If not in list, maybe we only remove their guests?
        console.warn("DEBUG: Usuário principal não está na lista. Verificando apenas convidados.");
        this.addLog("[DEBUG] WARN", `Usuário principal não encontrado na lista.`, "SYSTEM");
    } else {
        userName = mainPlayer.name;
    }

    // IDs to remove (user + their guests)
    const idsToRemove: string[] = [userId];
    const removedNames: string[] = [userName];
    
    // Find guests linked to this user in both lists
    [...session.players, ...session.waitlist].forEach(p => {
      if (p.linkedTo === userId) {
         idsToRemove.push(p.userId);
         removedNames.push(p.name);
      }
    });

    console.log("DEBUG: IDs para remover", idsToRemove);
    this.addLog("[DEBUG] INFO", `IDs identificados para remoção: ${idsToRemove.join(', ')}`, "SYSTEM");

    // 1. FILTER OUT (CRITICAL STEP - MUST HAPPEN)
    const countMainBefore = session.players.length;
    const countWaitBefore = session.waitlist.length;

    session.players = session.players.filter(p => !idsToRemove.includes(p.userId));
    session.waitlist = session.waitlist.filter(p => !idsToRemove.includes(p.userId));
    
    const countMainAfter = session.players.length;
    const countWaitAfter = session.waitlist.length;

    console.log(`DEBUG: Players ${countMainBefore}->${countMainAfter}, Wait ${countWaitBefore}->${countWaitAfter}`);
    this.addLog("[DEBUG] REMOVE", `Remoção concluída. Principal: ${countMainBefore}->${countMainAfter}`, "SYSTEM");

    // Save IMMEDIATELY after removal to ensure the user is out, even if promotion logic fails
    this.saveSessions(sessions);

    // 2. PROMOTE LOGIC (Try Catch Block to prevent crash)
    try {
        const sessionMins = getMinutes(session.time);
        let promotedSomeone = false;

        // Re-read sessions to be safe or work on current ref
        while (session.players.length < session.maxSpots && session.waitlist.length > 0) {
            // Find first valid waiter
            const validWaiterIdx = session.waitlist.findIndex(p => {
                const pMins = getMinutes(p.arrivalEstimate);
                return (pMins - sessionMins) <= 30;
            });

            if (validWaiterIdx > -1) {
                const promoted = session.waitlist.splice(validWaiterIdx, 1)[0];
                session.players.push(promoted);
                promotedSomeone = true;
                
                console.log("DEBUG: Promovendo", promoted.name);
                this.addLog("[DEBUG] PROMOTION", `Promovendo ${promoted.name} da espera`, "SYSTEM");

                // NOTIFY PROMOTED USER
                // Note: We need to be careful not to crash here either
                try {
                    const users = this.getUsers();
                    const recipientId = promoted.isGuest ? promoted.linkedTo : promoted.userId;
                    const uIdx = users.findIndex(u => u.uid === recipientId);
                    if (uIdx > -1 && recipientId) { 
                        users[uIdx].notifications.unshift({
                            id: `n-${Date.now()}-${Math.random()}`,
                            message: `Vaga liberada! ${promoted.isGuest ? 'Seu convidado ' + promoted.name : 'Você'} saiu da espera e entrou na lista principal de "${session.name}".`,
                            date: Date.now(),
                            read: false
                        });
                        this.saveUsers(users);
                    }
                } catch (notifErr) {
                    console.error("Erro ao notificar promoção", notifErr);
                }

            } else {
                // All remaining in waitlist are late, stop promoting
                break;
            }
        }

        if (promotedSomeone) {
            this.saveSessions(sessions);
        }

    } catch (e) {
        console.error("Erro na lógica de promoção automática:", e);
        this.addLog("[DEBUG] ERROR_PROMOTION", `Erro ao promover: ${e}`, "SYSTEM");
        // Do not throw, because we successfully removed the user already.
    }

    // LOG FINAL
    this.addLog("SAIR_LISTA", 
      `${userName} saiu da sessão ${session.name}. Removidos: ${removedNames.join(', ')}.`, 
      userName
    );
    console.log("--- DEBUG LEAVE SESSION END ---");
  },

  async togglePlayerAttendance(sessionId: string, userId: string, attended: boolean): Promise<void> {
    const sessions = this.getSessions();
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    if (sessionIndex === -1) return;

    const session = sessions[sessionIndex];
    // Check main players
    const pIdx = session.players.findIndex(p => p.userId === userId);
    if (pIdx > -1) {
        session.players[pIdx].attended = attended;
    } else {
        // Check waitlist (just in case)
        const wIdx = session.waitlist.findIndex(p => p.userId === userId);
        if (wIdx > -1) {
            session.waitlist[wIdx].attended = attended;
        }
    }
    
    this.saveSessions(sessions);
    // Don't log every click to avoid spam, or log only bulk updates if needed.
  },

  async incrementStats(uid: string, field: keyof UserStats) {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.uid === uid);
    if (idx > -1) {
      users[idx].stats[field]++;
      this.saveUsers(users);
    }
  },

  async markNotificationsRead(uid: string) {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.uid === uid);
    if (idx > -1) {
      users[idx].notifications.forEach(n => n.read = true);
      this.saveUsers(users);
    }
  },

  async clearNotifications(uid: string) {
     const users = this.getUsers();
    const idx = users.findIndex(u => u.uid === uid);
    if (idx > -1) {
      users[idx].notifications = [];
      this.saveUsers(users);
    }
  }
};