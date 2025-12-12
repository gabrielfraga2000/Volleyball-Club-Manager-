import { User, GameSession, ListPlayer, UserStats, AppNotification, SystemLog } from '../types';

const API_URL = '/api';

// --- Helper Functions ---
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const getMinutes = (timeStr: string | undefined) => {
    if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
};

// We will keep a local cache for synchronous getters to keep the app feeling fast
// But we must initialize this cache at app start
let localUsersCache: User[] = [];
let localSessionsCache: GameSession[] = [];

export const db = {
  // --- Logger Methods ---
  async getLogs(): Promise<SystemLog[]> {
    const res = await fetch(`${API_URL}/logs`);
    if (!res.ok) return [];
    return res.json();
  },

  async addLog(action: string, details: string, authorName?: string) {
    const newLog: SystemLog = {
      id: 'log-' + Date.now() + Math.random(),
      timestamp: Date.now(),
      action,
      details,
      authorName
    };
    await fetch(`${API_URL}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLog)
    });
  },

  // --- Sync Methods (Maintained for React Components that need Sync Data) ---
  // The components must call refreshData() to update these caches
  getUsersSync(): User[] {
      return localUsersCache;
  },
  
  getSessionsSync(): GameSession[] {
      return localSessionsCache;
  },

  async refreshData() {
      try {
        const res = await fetch(`${API_URL}/data`);
        if (res.ok) {
            const data = await res.json();
            localUsersCache = data.users;
            localSessionsCache = data.sessions;
        }
      } catch (e) {
          console.error("Failed to refresh data", e);
      }
      return { users: localUsersCache, sessions: localSessionsCache };
  },

  // --- Auth Methods ---
  async login(email: string, passwordDOB: string): Promise<User> {
    const res = await fetch(`${API_URL}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, dob: passwordDOB })
    });
    
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Falha no login");
    }

    const user = await res.json();
    localStorage.setItem('vg_auth_user_v2', JSON.stringify(user));
    return user;
  },

  async register(data: Omit<User, 'uid' | 'role' | 'stats' | 'donations' | 'notifications' | 'createdAt'>): Promise<User> {
    const newUser: User = {
      ...data,
      uid: 'user-' + Date.now(),
      role: 1, 
      stats: { gamesAttended: 0, gamesMissed: 0 },
      donations: [],
      notifications: [
        {
            id: 'welcome-' + Date.now(),
            message: "Bem-vindo ao Manhãzinha! Sua conta foi criada e você já pode participar dos jogos.",
            date: Date.now(),
            read: false
        }
      ],
      createdAt: Date.now()
    };

    const res = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Falha ao registrar");
    }
    
    await this.addLog("REGISTER", `Novo usuário registrado: ${newUser.fullName} (${newUser.email})`);
    
    // Auto-login after register
    localStorage.setItem('vg_auth_user_v2', JSON.stringify(newUser));
    // Update cache
    await this.refreshData();
    return newUser;
  },

  logout() {
    localStorage.removeItem('vg_auth_user_v2');
  },

  getCurrentUser(): User | null {
    const stored = localStorage.getItem('vg_auth_user_v2');
    if (!stored) return null;
    return JSON.parse(stored);
  },

  // --- User Methods ---
  async getUsers(): Promise<User[]> {
      await this.refreshData();
      return localUsersCache;
  },

  async updateProfile(uid: string, data: Partial<User>) {
    const users = await this.getUsers();
    const user = users.find(u => u.uid === uid);
    if (!user) throw new Error("Usuário não encontrado");
    
    const updatedUser = { ...user, ...data };
    
    await fetch(`${API_URL}/users/${uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedUser)
    });

    // Update auth user if it's the current one
    const currentUser = this.getCurrentUser();
    if (currentUser && currentUser.uid === uid) {
        localStorage.setItem('vg_auth_user_v2', JSON.stringify(updatedUser));
    }
    await this.refreshData();
  },

  async updateUserRole(uid: string, newRole: 0 | 1 | 2 | 3) {
      const users = await this.getUsers();
      const user = users.find(u => u.uid === uid);
      if (!user) return;
      
      const oldRole = user.role;
      user.role = newRole;
      
      // Update User in DB
      await fetch(`${API_URL}/users/${uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
      });

      await this.addLog("ROLE_CHANGE", `Usuário ${user.fullName} alterado de ${oldRole} para ${newRole}`, "Sistema");

      // NOTIFICATION LOGIC
      let notifMsg = "";
      if (newRole === 1 && oldRole === 0) {
          notifMsg = "🎉 Sua conta foi aprovada! Agora você pode entrar nos jogos.";
      } else if (newRole === 2) {
          notifMsg = "🛡️ Você foi promovido a Ademiro! Acesse o painel pelo seu perfil.";
      } else if (newRole === 0) {
          notifMsg = "⚠️ Sua conta voltou para status pendente.";
      } else {
          notifMsg = `Seu nível de acesso foi alterado para ${newRole}.`;
      }
      
      if (notifMsg) {
          await this.addNotification(uid, notifMsg);
      }
      await this.refreshData();
  },

  // --- Session Methods ---
  async getSessions(): Promise<GameSession[]> {
      await this.refreshData();
      return localSessionsCache;
  },

  async createSession(sessionData: Omit<GameSession, 'id' | 'players' | 'waitlist' | 'status'>) {
    const newSession: GameSession = {
      ...sessionData,
      id: 'session-' + Date.now(),
      players: [],
      waitlist: [],
      status: 'open'
    };
    
    await fetch(`${API_URL}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSession)
    });
    
    await this.addLog("CREATE_SESSION", `Sessão criada: ${newSession.name} para ${newSession.date}`);
    await this.refreshData();
  },

  async joinSession(sessionId: string, user: User, arrivalTime: string, isGuest = false, guestData?: any) {
    // Need fresh data to check constraints
    await this.refreshData();
    const sessions = localSessionsCache;
    const session = sessions.find(s => s.id === sessionId);
    if (!session) throw new Error("Sessão não encontrada.");

    // Check duplication
    const userIdToCheck = isGuest ? `guest-${Date.now()}` : user.uid;
    if (!isGuest) {
        if (session.players.some(p => p.userId === user.uid) || session.waitlist.some(p => p.userId === user.uid)) {
            throw new Error("Você já está nesta lista.");
        }
    }

    const startMinutes = getMinutes(session.time);
    const arrivalMinutes = getMinutes(arrivalTime);
    const isLate = arrivalMinutes > (startMinutes + 30);
    const isFull = session.players.length >= session.maxSpots;

    const listPlayer: ListPlayer = {
        userId: userIdToCheck,
        name: isGuest ? (guestData?.name + ' ' + (guestData?.surname || '')) : (user.nickname || user.fullName),
        isGuest,
        linkedTo: isGuest ? user.uid : undefined,
        joinedAt: Date.now(),
        arrivalEstimate: arrivalTime,
        guestContact: isGuest ? guestData : undefined
    };

    if (isFull || isLate) {
        session.waitlist.push(listPlayer);
    } else {
        session.players.push(listPlayer);
        // Progress Notification Logic (simplified for brevity, assume similar to before)
    }

    // Save Updated Session
    await fetch(`${API_URL}/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(session)
    });
    
    const logDetails = isGuest 
        ? `Convidado ${listPlayer.name} adicionado por ${user.fullName} em ${session.name}`
        : `${user.fullName} entrou em ${session.name} (Chegada: ${arrivalTime})`;
    
    await this.addLog("JOIN", logDetails, user.fullName);
    await this.refreshData();
  },

  async leaveSession(sessionId: string, userId: string) {
    await this.refreshData();
    const sessions = localSessionsCache;
    const session = sessions.find(s => s.id === sessionId);
    if (!session) throw new Error("Sessão não encontrada.");

    // 1. Identify User and Guests
    const playersToRemove = [userId];
    const linkedGuests = [...session.players, ...session.waitlist]
        .filter(p => p.linkedTo === userId)
        .map(p => p.userId);
    
    playersToRemove.push(...linkedGuests);

    const removedNames: string[] = [];
    [...session.players, ...session.waitlist].forEach(p => {
        if (playersToRemove.includes(p.userId)) removedNames.push(p.name);
    });

    // 2. Remove
    session.players = session.players.filter(p => !playersToRemove.includes(p.userId));
    session.waitlist = session.waitlist.filter(p => !playersToRemove.includes(p.userId));

    // 3. Promotion Logic
    const startMinutes = getMinutes(session.time);
    while (session.players.length < session.maxSpots && session.waitlist.length > 0) {
        const candidateIndex = session.waitlist.findIndex(p => {
            const arrMinutes = getMinutes(p.arrivalEstimate);
            return arrMinutes <= (startMinutes + 30);
        });
        
        if (candidateIndex === -1) break; 
        const [candidate] = session.waitlist.splice(candidateIndex, 1);
        if (candidate) {
            session.players.push(candidate);
            if (!candidate.isGuest) {
                 await this.addNotification(candidate.userId, `Vaga liberada! Você subiu da fila de espera para o jogo ${session.name}.`);
            } else if (candidate.linkedTo) {
                 await this.addNotification(candidate.linkedTo, `Vaga liberada! Seu convidado ${candidate.name} subiu da fila de espera em ${session.name}.`);
            }
        }
    }

    // Save
    await fetch(`${API_URL}/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(session)
    });

    // Log
    const user = localUsersCache.find(u => u.uid === userId);
    const authorName = user ? (user.nickname || user.fullName) : "Usuário";
    await this.addLog("LEAVE", `Saiu do jogo ${session.name}. Removidos: ${removedNames.join(', ')}`, authorName);
    await this.refreshData();
  },

  async deleteSession(sessionId: string) {
      await fetch(`${API_URL}/sessions/${sessionId}`, { method: 'DELETE' });
      await this.addLog("DELETE_SESSION", `Sessão ${sessionId} cancelada.`);
      await this.refreshData();
  },

  async updatePlayerArrival(sessionId: string, playerId: string, newTime: string) {
    await this.refreshData();
    const session = localSessionsCache.find(s => s.id === sessionId);
    if (session) {
        const p = session.players.find(p => p.userId === playerId) || session.waitlist.find(p => p.userId === playerId);
        if (p) {
            p.arrivalEstimate = newTime;
            await fetch(`${API_URL}/sessions/${sessionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(session)
            });
            await this.refreshData();
        }
    }
  },

  async togglePlayerAttendance(sessionId: string, playerId: string, status: boolean) {
      await this.refreshData();
      const session = localSessionsCache.find(s => s.id === sessionId);
      if (session) {
          const p = session.players.find(p => p.userId === playerId);
          if (p) {
              p.attended = status;
              
              if (!p.isGuest) {
                  const u = localUsersCache.find(user => user.uid === p.userId);
                  if (u) {
                      if (status) u.stats.gamesAttended++;
                      else u.stats.gamesAttended = Math.max(0, u.stats.gamesAttended - 1);
                      // Update user stats in DB
                      await fetch(`${API_URL}/users/${u.uid}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(u)
                      });
                  }
              }

              // Update Session in DB
              await fetch(`${API_URL}/sessions/${sessionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(session)
              });
              await this.refreshData();
          }
      }
  },

  // --- Notification Methods ---
  async addNotification(userId: string, message: string) {
      // Need to fetch user first
      const users = await this.getUsers();
      const user = users.find(u => u.uid === userId);
      if (user) {
          user.notifications.unshift({
              id: 'notif-' + Date.now() + Math.random(),
              message,
              date: Date.now(),
              read: false
          });
          await fetch(`${API_URL}/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(user)
          });
      }
  },

  async markNotificationsRead(userId: string) {
      const users = await this.getUsers();
      const user = users.find(u => u.uid === userId);
      if (user) {
          user.notifications.forEach(n => n.read = true);
          await fetch(`${API_URL}/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(user)
          });
          
          const currentUser = this.getCurrentUser();
          if (currentUser && currentUser.uid === userId) {
            localStorage.setItem('vg_auth_user_v2', JSON.stringify(user));
          }
      }
  },

  async clearNotifications(userId: string) {
      const users = await this.getUsers();
      const user = users.find(u => u.uid === userId);
      if (user) {
          user.notifications = [];
          await fetch(`${API_URL}/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(user)
          });
          
          const currentUser = this.getCurrentUser();
          if (currentUser && currentUser.uid === userId) {
            localStorage.setItem('vg_auth_user_v2', JSON.stringify(user));
          }
      }
  }
};
