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
  getDoc
} from "firebase/firestore";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut 
} from "firebase/auth";
import { db, auth } from "./firebase";
import { User, GameSession, ListPlayer, SystemLog } from '../types';

// --- Local Cache for Synchronous Reads ---
// Isso permite que o resto do app continue usando db.getUsers() sem precisar mudar tudo para async/await imediatamente.
let localUsersCache: User[] = [];
let localSessionsCache: GameSession[] = [];
let localLogsCache: SystemLog[] = [];

// --- Listeners de Tempo Real ---
// Inicia assim que o arquivo é importado para manter o cache atualizado
const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
  localUsersCache = snapshot.docs.map(doc => doc.data() as User);
});

const unsubSessions = onSnapshot(query(collection(db, "sessions"), orderBy("date", "asc")), (snapshot) => {
  localSessionsCache = snapshot.docs.map(doc => doc.data() as GameSession);
});

const unsubLogs = onSnapshot(query(collection(db, "logs"), orderBy("timestamp", "desc"), limit(200)), (snapshot) => {
  localLogsCache = snapshot.docs.map(doc => doc.data() as SystemLog);
});

// --- Helper Functions ---
const getMinutes = (timeStr: string | undefined) => {
    if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
};

export const db = {
  // --- Logger Methods ---
  getLogs(): SystemLog[] {
    return localLogsCache;
  },

  async addLog(action: string, details: string, authorName?: string) {
    const newLog: SystemLog = {
      id: 'log-' + Date.now() + Math.random(),
      timestamp: Date.now(),
      action,
      details,
      authorName
    };
    // Grava no Firestore
    await setDoc(doc(db, "logs", newLog.id), newLog);
  },

  // --- Auth Methods ---
  async login(email: string, passwordDOB: string): Promise<User> {
    // 1. Login no Firebase Auth
    const userCredential = await signInWithEmailAndPassword(auth, email, passwordDOB);
    const firebaseUser = userCredential.user;

    // 2. Buscar dados adicionais no Firestore (role, stats, etc)
    const userDocRef = doc(db, "users", firebaseUser.uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      throw new Error("Usuário autenticado, mas dados de perfil não encontrados.");
    }

    const userData = userDoc.data() as User;
    
    // Salva no localStorage apenas para persistência de sessão rápida no frontend
    localStorage.setItem('vg_auth_user_v2', JSON.stringify(userData));
    return userData;
  },

  async register(data: Omit<User, 'uid' | 'role' | 'stats' | 'donations' | 'notifications' | 'createdAt'>): Promise<User> {
    // 1. Criar Auth User
    // A senha será a data de nascimento (dob) conforme sua lógica
    const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.dob);
    const firebaseUser = userCredential.user;

    // 2. Criar Documento no Firestore
    const newUser: User = {
      ...data,
      uid: firebaseUser.uid, // Usa o UID real do Firebase Auth
      role: 1, 
      stats: { gamesAttended: 0, gamesMissed: 0 },
      donations: [],
      notifications: [
        {
            id: 'welcome-' + Date.now(),
            message: "Bem-vindo ao Manhãzinha! Sua conta foi criada.",
            date: Date.now(),
            read: false
        }
      ],
      createdAt: Date.now()
    };

    await setDoc(doc(db, "users", firebaseUser.uid), newUser);
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
    const userRef = doc(db, "users", uid);
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
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, { role: newRole });

      await this.addLog("ROLE_CHANGE", `Usuário ${user.fullName} alterado de ${oldRole} para ${newRole}`, "Sistema");

      // Notification Logic
      let notifMsg = "";
      if (newRole === 1 && oldRole === 0) {
          notifMsg = "🎉 Sua conta foi aprovada!";
      } else if (newRole === 2) {
          notifMsg = "🛡️ Você foi promovido a Ademiro!";
      } else if (newRole === 0) {
          notifMsg = "⚠️ Sua conta voltou para status pendente.";
      }
      
      if (notifMsg) {
          await this.addNotification(uid, notifMsg);
      }
  },

  // --- Session Methods ---
  getSessions(): GameSession[] {
    return localSessionsCache;
  },

  async createSession(sessionData: Omit<GameSession, 'id' | 'players' | 'waitlist' | 'status'>) {
    // Cria ID manualmente ou deixa o Firestore criar.
    // Para manter consistência com sua tipagem que exige 'id', vamos criar um ref.
    const newSessionRef = doc(collection(db, "sessions"));
    
    const newSession: GameSession = {
      ...sessionData,
      id: newSessionRef.id,
      players: [],
      waitlist: [],
      status: 'open'
    };
    
    await setDoc(newSessionRef, newSession);
    await this.addLog("CREATE_SESSION", `Sessão criada: ${newSession.name} para ${newSession.date}`);
  },

  async joinSession(sessionId: string, user: User, arrivalTime: string, isGuest = false, guestData?: any) {
    const sessionRef = doc(db, "sessions", sessionId);
    const sessionDoc = await getDoc(sessionRef);
    
    if (!sessionDoc.exists()) throw new Error("Sessão não encontrada.");
    const session = sessionDoc.data() as GameSession;

    // Validation Logic (Same as before)
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

    const updates: any = {};

    if (isFull || isLate) {
        updates.waitlist = [...session.waitlist, listPlayer];
    } else {
        updates.players = [...session.players, listPlayer];
        
        // Progress Notifications (Simplified for API)
        const count = session.players.length + 1;
        if (count === session.maxSpots) {
             // Example: notify logic could be here
        }
    }

    await updateDoc(sessionRef, updates);
    
    const logDetails = isGuest 
        ? `Convidado ${listPlayer.name} adicionado por ${user.fullName} em ${session.name}`
        : `${user.fullName} entrou em ${session.name} (Chegada: ${arrivalTime})`;
    
    await this.addLog("JOIN", logDetails, user.fullName);
  },

  async leaveSession(sessionId: string, userId: string) {
    const sessionRef = doc(db, "sessions", sessionId);
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
    while (session.players.length < session.maxSpots && session.waitlist.length > 0) {
        const candidateIndex = session.waitlist.findIndex(p => {
            const arrMinutes = getMinutes(p.arrivalEstimate);
            return arrMinutes <= (startMinutes + 30);
        });
        
        if (candidateIndex === -1) break; 
        const [candidate] = session.waitlist.splice(candidateIndex, 1);
        if (candidate) {
            session.players.push(candidate);
            // Notify candidate logic here...
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
      await deleteDoc(doc(db, "sessions", sessionId));
      await this.addLog("DELETE_SESSION", `Sessão ${sessionId} cancelada.`);
  },

  async updatePlayerArrival(sessionId: string, playerId: string, newTime: string) {
    const sessionRef = doc(db, "sessions", sessionId);
    const session = localSessionsCache.find(s => s.id === sessionId); // Use cache for quick lookup
    if (!session) return;

    // Deep clone to modify
    const newPlayers = [...session.players];
    const newWaitlist = [...session.waitlist];

    let p = newPlayers.find(p => p.userId === playerId);
    if (p) p.arrivalEstimate = newTime;
    
    p = newWaitlist.find(p => p.userId === playerId);
    if (p) p.arrivalEstimate = newTime;

    await updateDoc(sessionRef, { players: newPlayers, waitlist: newWaitlist });
  },

  async togglePlayerAttendance(sessionId: string, playerId: string, status: boolean) {
      const sessionRef = doc(db, "sessions", sessionId);
      const session = localSessionsCache.find(s => s.id === sessionId);
      if (!session) return;

      const newPlayers = session.players.map(p => {
          if (p.userId === playerId) return { ...p, attended: status };
          return p;
      });

      await updateDoc(sessionRef, { players: newPlayers });

      // Update User Stats
      const player = session.players.find(p => p.userId === playerId);
      if (player && !player.isGuest) {
          const user = localUsersCache.find(u => u.uid === playerId);
          if (user) {
             const userRef = doc(db, "users", playerId);
             const newAttended = status ? user.stats.gamesAttended + 1 : Math.max(0, user.stats.gamesAttended - 1);
             await updateDoc(userRef, { "stats.gamesAttended": newAttended });
          }
      }
  },

  // --- Notification Methods ---
  async addNotification(userId: string, message: string) {
      const userRef = doc(db, "users", userId);
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
      const userRef = doc(db, "users", userId);
      const user = localUsersCache.find(u => u.uid === userId);
      if (!user) return;

      const newNotifs = user.notifications.map(n => ({ ...n, read: true }));
      await updateDoc(userRef, { notifications: newNotifs });
  },

  async clearNotifications(userId: string) {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, { notifications: [] });
  }
};
