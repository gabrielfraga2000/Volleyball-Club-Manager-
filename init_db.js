
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs';

// Dados Iniciais (Seed)
const SEED_USER = {
  uid: "user-1765497156842",
  fullName: "Gabriel Fraga",
  nickname: "Gabriel",
  email: "gabriel.fraga2000@gmail.com",
  phone: "22998910728",
  dob: "09072000",
  gender: "M",
  role: 3, // Dev/Admin
  stats: { gamesAttended: 0, gamesMissed: 0 },
  donations: [],
  notifications: [],
  createdAt: 1765497156842
};

const SEED_SESSION = {
    id: 'session-default-1212',
    name: 'Vôlei de Quinta',
    date: '2025-12-12',
    time: '19:00',
    guestWindowOpenTime: 0,
    maxSpots: 18,
    players: [],
    waitlist: [],
    createdBy: 'system',
    status: 'open'
};

(async () => {
    const dbFile = './database.sqlite';

    try {
        console.log(`🔨 Inicializando criação do banco de dados em: ${dbFile}`);

        // Abre (ou cria) o arquivo
        const db = await open({
            filename: dbFile,
            driver: sqlite3.Database
        });

        console.log('✅ Arquivo de banco de dados conectado/criado.');

        // Cria Tabelas
        await db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                uid TEXT PRIMARY KEY,
                email TEXT UNIQUE,
                data TEXT
            );
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                date TEXT,
                time TEXT,
                data TEXT
            );
            CREATE TABLE IF NOT EXISTS logs (
                id TEXT PRIMARY KEY,
                timestamp INTEGER,
                data TEXT
            );
        `);
        console.log('✅ Tabelas verificadas.');

        // Seed Usuário
        const userExists = await db.get('SELECT uid FROM users WHERE uid = ?', SEED_USER.uid);
        if (!userExists) {
            await db.run('INSERT INTO users (uid, email, data) VALUES (?, ?, ?)', 
                SEED_USER.uid, SEED_USER.email, JSON.stringify(SEED_USER));
            console.log('👤 Usuário Admin (Gabriel) criado.');
        } else {
            console.log('ℹ️ Usuário Admin já existe.');
        }

        // Seed Sessão
        const sessionExists = await db.get('SELECT id FROM sessions WHERE id = ?', SEED_SESSION.id);
        if (!sessionExists) {
            await db.run('INSERT INTO sessions (id, date, time, data) VALUES (?, ?, ?, ?)', 
                SEED_SESSION.id, SEED_SESSION.date, SEED_SESSION.time, JSON.stringify(SEED_SESSION));
            console.log('🏐 Sessão Inicial (12/12) criada.');
        } else {
            console.log('ℹ️ Sessão Inicial já existe.');
        }

        console.log('\n🎉 SUCESSO! O arquivo database.sqlite está pronto.');
        console.log('👉 Agora você pode rodar "npm run server" para iniciar o servidor.');

    } catch (e) {
        console.error('❌ Erro ao criar banco de dados:', e);
    }
})();
