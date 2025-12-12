
import express from 'express';
import sqlite3 from 'sqlite3';
import cors from 'cors';
import { open } from 'sqlite';
import fs from 'fs';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

let db;

// Função para iniciar conexão
async function initServer() {
  const dbFile = './database.sqlite';
  
  // Verifica se o arquivo existe
  if (!fs.existsSync(dbFile)) {
      console.log("⚠️ Arquivo database.sqlite não encontrado. Criando automaticamente...");
      // Se não existir, a gente roda o open que cria vazio, e o código abaixo cria as tabelas.
      // Mas recomendamos rodar npm run db:init para garantir os dados iniciais.
  }

  try {
    db = await open({
      filename: dbFile,
      driver: sqlite3.Database
    });

    // Garante tabelas (caso o usuário não tenha rodado o init_db)
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

    console.log('✅ Conectado ao SQLite.');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });

  } catch (e) {
    console.error('❌ Falha ao iniciar servidor:', e);
    process.exit(1);
  }
}

initServer();

// --- Routes ---

app.get('/api/data', async (req, res) => {
  try {
    const usersRaw = await db.all('SELECT data FROM users');
    const sessionsRaw = await db.all('SELECT data FROM sessions ORDER BY date ASC, time ASC');
    
    const users = usersRaw.map(u => JSON.parse(u.data));
    const sessions = sessionsRaw.map(s => JSON.parse(s.data));
    
    res.json({ users, sessions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Auth & User Operations
app.post('/api/users/login', async (req, res) => {
  const { email, dob } = req.body;
  if (!db) return res.status(500).json({ error: "Database not ready" });
  
  try {
    const result = await db.get('SELECT data FROM users WHERE email = ?', email);
    if (!result) return res.status(404).json({ error: "Usuário não encontrado." });
    
    const user = JSON.parse(result.data);
    // Simple password check (DOB)
    if (user.dob !== dob) return res.status(401).json({ error: "Senha incorreta (Data de Nascimento)." });
    
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users', async (req, res) => {
  const user = req.body;
  try {
    await db.run('INSERT INTO users (uid, email, data) VALUES (?, ?, ?)', 
      user.uid, user.email, JSON.stringify(user));
    res.json(user);
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
        return res.status(400).json({ error: "Email já cadastrado." });
    }
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/users/:uid', async (req, res) => {
  const { uid } = req.params;
  const updatedUser = req.body;
  try {
    await db.run('UPDATE users SET data = ? WHERE uid = ?', JSON.stringify(updatedUser), uid);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Session Operations
app.post('/api/sessions', async (req, res) => {
  const session = req.body;
  try {
    await db.run('INSERT INTO sessions (id, date, time, data) VALUES (?, ?, ?, ?)',
      session.id, session.date, session.time, JSON.stringify(session));
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/sessions/:id', async (req, res) => {
  const { id } = req.params;
  const session = req.body;
  try {
    await db.run('UPDATE sessions SET data = ?, date = ?, time = ? WHERE id = ?', 
      JSON.stringify(session), session.date, session.time, id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/sessions/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.run('DELETE FROM sessions WHERE id = ?', id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Logs
app.get('/api/logs', async (req, res) => {
  try {
    const logsRaw = await db.all('SELECT data FROM logs ORDER BY timestamp DESC LIMIT 200');
    const logs = logsRaw.map(l => JSON.parse(l.data));
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/logs', async (req, res) => {
  const log = req.body;
  try {
    await db.run('INSERT INTO logs (id, timestamp, data) VALUES (?, ?, ?)',
      log.id, log.timestamp, JSON.stringify(log));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
