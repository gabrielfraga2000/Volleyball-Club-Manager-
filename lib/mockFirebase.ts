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
    
    if (users.some(u => u.email === data.email)) {
      throw new Error("Email já cadastrado.");
    }

    const newUser: User = {
      ...data,
      uid: 'user-' + Date.now(),
      role: 0, // Starts as Pending
      stats: { gamesAttended: 0, gamesMissed: 0 },
      donations: [],
      notifications: [],
      createdAt: Date.now()
    };

    users.push(newUser);
    localStorage.setItem(KEY_USERS, JSON.stringify(users));
    
    this.addLog("REGISTER", `Novo usuário registrado: ${newUser.fullName} (${newUser.email})`);
    
    return newUser;
  },

  logout() {
    localStorage.removeItem(KEY_AUTH_USER);
  },

  getCurrentUser(): User | null {
    const stored = localStorage.getItem(KEY_AUTH_USER);
    if (!stored) return null;
    // Always fetch fresh data from DB using the stored ID to avoid stale state
    const simpleUser = JSON.parse(stored);
    const users = this.getUsers();
    return users.find(u => u.uid === simpleUser.uid) || null;
  },

  // --- User Methods ---
  getUsers(): User[] {
    const stored = localStorage.getItem(KEY_USERS);
    if (!stored) {
      localStorage.setItem(KEY_USERS, JSON.stringify(INITIAL_USERS));
      return INITIAL_USERS;
    }
    return JSON.parse(stored);
  },

  async updateProfile(uid: string, data: Partial<User>) {
    await delay(200);
    const users = this.getUsers();
    const idx = users.findIndex(u => u.uid === uid);
    if (idx === -1) throw new Error("Usuário não encontrado");
    
    users[idx] = { ...users[idx], ...data };
    localStorage.setItem(KEY_USERS, JSON.stringify(users));
    
    // Update auth user if it's the current one
    const currentUser = this.getCurrentUser();
    if (currentUser && currentUser.uid === uid) {
        localStorage.setItem(KEY_AUTH_USER, JSON.stringify(users[idx]));
    }
  },

  async updateUserRole(uid: string, newRole: 0 | 1 | 2 | 3) {
      await delay(200);
      const users = this.getUsers();
      const idx = users.findIndex(u => u.uid === uid);
      if (idx !== -1) {
          const oldRole = users[idx].role;
          users[idx].role = newRole;
          localStorage.setItem(KEY_USERS, JSON.stringify(users));
          this.addLog("ROLE_CHANGE", `Usuário ${users[idx].fullName} alterado de ${oldRole} para ${newRole}`, "Sistema");
      }
  },

  // --- Session Methods ---
  getSessions(): GameSession[] {
    const stored = localStorage.getItem(KEY_SESSIONS);
    return stored ? JSON.parse(stored) : [];
  },

  async createSession(sessionData: Omit<GameSession, 'id' | 'players' | 'waitlist' | 'status'>) {
    await delay(300);
    const sessions = this.getSessions();
    const newSession: GameSession = {
      ...sessionData,
      id: 'session-' + Date.now(),
      players: [],
      waitlist: [],
      status: 'open'
    };
    sessions.push(newSession);
    // Sort by date/time
    sessions.sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());
    
    localStorage.setItem(KEY_SESSIONS, JSON.stringify(sessions));
    this.addLog("CREATE_SESSION", `Sessão criada: ${newSession.name} para ${newSession.date}`);
  },

  async joinSession(sessionId: string, user: User, arrivalTime: string, isGuest = false, guestData?: any) {
    await delay(300);
    const sessions = this.getSessions();
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    if (sessionIndex === -1) throw new Error("Sessão não encontrada.");

    const session = sessions[sessionIndex];
    
    // Check duplication
    const userIdToCheck = isGuest ? `guest-${Date.now()}` : user.uid;
    // For real users, check if already in
    if (!isGuest) {
        if (session.players.some(p => p.userId === user.uid) || session.waitlist.some(p => p.userId === user.uid)) {
            throw new Error("Você já está nesta lista.");
        }
    }

    const startMinutes = getMinutes(session.time);
    const arrivalMinutes = getMinutes(arrivalTime);
    const isLate = arrivalMinutes > (startMinutes + 30); // 30 min tolerance
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
        // Only notify if it was automatic due to full/late (not implicit choice? UI handles implicit)
    } else {
        session.players.push(listPlayer);
    }

    sessions[sessionIndex] = session;
    localStorage.setItem(KEY_SESSIONS, JSON.stringify(sessions));
    
    const logDetails = isGuest 
        ? `Convidado ${listPlayer.name} adicionado por ${user.fullName} em ${session.name}`
        : `${user.fullName} entrou em ${session.name} (Chegada: ${arrivalTime})`;
    
    this.addLog("JOIN", logDetails, user.fullName);
  },

  async leaveSession(sessionId: string, userId: string) {
    await delay(300);
    const sessions = this.getSessions();
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    if (sessionIndex === -1) throw new Error("Sessão não encontrada.");

    const session = sessions[sessionIndex];
    
    // 1. Identify User and Guests
    // Guests are linked via 'linkedTo' property equal to the user's ID
    const playersToRemove = [userId];
    const linkedGuests = [...session.players, ...session.waitlist]
        .filter(p => p.linkedTo === userId)
        .map(p => p.userId);
    
    playersToRemove.push(...linkedGuests);

    // Capture names for logging before removal
    const removedNames: string[] = [];
    [...session.players, ...session.waitlist].forEach(p => {
        if (playersToRemove.includes(p.userId)) {
            removedNames.push(p.name);
        }
    });

    // 2. Remove from lists
    session.players = session.players.filter(p => !playersToRemove.includes(p.userId));
    session.waitlist = session.waitlist.filter(p => !playersToRemove.includes(p.userId));

    // Persist immediately to ensure state is clean
    sessions[sessionIndex] = session;
    localStorage.setItem(KEY_SESSIONS, JSON.stringify(sessions));

    // 3. Promotion Logic
    // Check if spots opened up in the main player list
    let promotedCount = 0;
    while (session.players.length < session.maxSpots && session.waitlist.length > 0) {
        // FIFO: Take the first person from waitlist
        const candidate = session.waitlist.shift(); 
        
        if (candidate) {
            session.players.push(candidate);
            promotedCount++;
            
            // Notify the promoted user (if it's a real user)
            if (!candidate.isGuest) {
                 this.addNotification(candidate.userId, `Vaga liberada! Você subiu da fila de espera para o jogo ${session.name}.`);
            } else if (candidate.linkedTo) {
                 // Notify the host of the guest
                 this.addNotification(candidate.linkedTo, `Vaga liberada! Seu convidado ${candidate.name} subiu da fila de espera em ${session.name}.`);
            }
            
            this.addLog("PROMOTION", `Jogador ${candidate.name} promovido da fila de espera em ${session.name}.`, "Sistema");
        }
    }

    // Save again if changes occurred during promotion
    if (promotedCount > 0) {
        sessions[sessionIndex] = session;
        localStorage.setItem(KEY_SESSIONS, JSON.stringify(sessions));
    }

    // 4. Log the Leave Action
    // Need author name for the log
    const users = this.getUsers();
    const user = users.find(u => u.uid === userId);
    const authorName = user ? (user.nickname || user.fullName) : "Usuário";

    this.addLog("LEAVE", `Saiu do jogo ${session.name}. Removidos: ${removedNames.join(', ')}`, authorName);
  },

  async deleteSession(sessionId: string) {
      await delay(300);
      let sessions = this.getSessions();
      sessions = sessions.filter(s => s.id !== sessionId);
      localStorage.setItem(KEY_SESSIONS, JSON.stringify(sessions));
      this.addLog("DELETE_SESSION", `Sessão ${sessionId} cancelada.`);
  },

  async updatePlayerArrival(sessionId: string, playerId: string, newTime: string) {
    await delay(200);
    const sessions = this.getSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
        const p = session.players.find(p => p.userId === playerId) || session.waitlist.find(p => p.userId === playerId);
        if (p) {
            p.arrivalEstimate = newTime;
            localStorage.setItem(KEY_SESSIONS, JSON.stringify(sessions));
        }
    }
  },

  async togglePlayerAttendance(sessionId: string, playerId: string, status: boolean) {
      await delay(100);
      const sessions = this.getSessions();
      const session = sessions.find(s => s.id === sessionId);
      if (session) {
          const p = session.players.find(p => p.userId === playerId);
          if (p) {
              p.attended = status;
              
              // Update User Stats (Mock implementation - usually this would be more complex)
              if (!p.isGuest) {
                  const users = this.getUsers();
                  const u = users.find(user => user.uid === p.userId);
                  if (u) {
                      if (status) u.stats.gamesAttended++;
                      else u.stats.gamesAttended = Math.max(0, u.stats.gamesAttended - 1);
                      localStorage.setItem(KEY_USERS, JSON.stringify(users));
                  }
              }

              localStorage.setItem(KEY_SESSIONS, JSON.stringify(sessions));
          }
      }
  },

  // --- Notification Methods ---
  addNotification(userId: string, message: string) {
      const users = this.getUsers();
      const user = users.find(u => u.uid === userId);
      if (user) {
          user.notifications.unshift({
              id: 'notif-' + Date.now() + Math.random(),
              message,
              date: Date.now(),
              read: false
          });
          localStorage.setItem(KEY_USERS, JSON.stringify(users));
      }
  },

  markNotificationsRead(userId: string) {
      const users = this.getUsers();
      const user = users.find(u => u.uid === userId);
      if (user) {
          user.notifications.forEach(n => n.read = true);
          localStorage.setItem(KEY_USERS, JSON.stringify(users));
          
          // Sync with auth user
          const currentUser = this.getCurrentUser();
          if (currentUser && currentUser.uid === userId) {
            localStorage.setItem(KEY_AUTH_USER, JSON.stringify(user));
          }
      }
  },

  async clearNotifications(userId: string) {
      await delay(100);
      const users = this.getUsers();
      const user = users.find(u => u.uid === userId);
      if (user) {
          user.notifications = [];
          localStorage.setItem(KEY_USERS, JSON.stringify(users));
          // Sync auth
          const currentUser = this.getCurrentUser();
          if (currentUser && currentUser.uid === userId) {
            localStorage.setItem(KEY_AUTH_USER, JSON.stringify(user));
          }
      }
  }
};
