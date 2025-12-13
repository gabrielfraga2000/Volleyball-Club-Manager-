
export type UserRole = 0 | 1 | 2 | 3; // 0: Pending, 1: Player, 2: Admin, 3: Dev

export interface SystemLog {
  id: string;
  timestamp: number;
  action: string; // ex: "JOIN", "LEAVE", "CREATE_SESSION"
  details: string;
  authorName?: string;
}

export interface AppNotification {
  id: string;
  message: string;
  date: number;
  read: boolean;
}

export interface Donation {
  id: string;
  amount: number;
  date: number;
}

export interface UserStats {
  gamesAttended: number;
  gamesMissed: number;
}

export interface User {
  uid: string;
  fullName: string;
  nickname?: string; // New field for display name
  nicknameLastUpdated?: number; // Timestamp da última troca
  nicknameChangeCount?: number; // Contador de trocas
  email: string;
  phone: string;
  dob: string; // Format ddmmyyyy for password logic
  gender: 'M' | 'F' | 'O';
  role: UserRole;
  stats: UserStats;
  donations: Donation[];
  notifications: AppNotification[];
  photoUrl?: string;
  createdAt: number;
}

export interface ListPlayer {
  userId: string;
  name: string; // Snapshot name (or guest name)
  isGuest: boolean;
  linkedTo?: string; // If guest, who invited them?
  joinedAt: number;
  arrivalEstimate: string; // HH:MM format
  attended?: boolean; // New field for attendance check
  guestContact?: {
    name: string;
    surname: string;
    email: string;
    phone: string;
  };
}

export type SessionType = 'pelada' | 'treino' | 'campeonato' | 'resenha';
export type GenderRestriction = 'M' | 'F' | 'all';

export interface GameSession {
  id: string;
  name: string;
  date: string; // ISO Date
  time: string;
  guestWindowOpenTime: number; // Timestamp when guests are allowed
  maxSpots: number;
  players: ListPlayer[];
  waitlist: ListPlayer[];
  createdBy: string;
  status: 'open' | 'closed';
  
  // New Fields
  type: SessionType;
  genderRestriction: GenderRestriction;
  allowGuests: boolean;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
}