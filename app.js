const express = require('express');
const { Pool } = require('pg'); 
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.static(__dirname));
app.use(express.json());

// URL DIRETA PARA ELIMINAR ERRO DE VARIÁVEL NO RENDER
const connectionString = "postgresql://neondb_owner:npg_r6mkt8QLwdoZ@ep-restless-heart-ac4e9km0-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require";

const pool = new Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 1000,
});

// LOG DE CONEXÃO
pool.query('SELECT NOW()', (err, res) => {
    if (err) console.error("❌ ERRO NO BANCO:", err.message);
    else console.log("✅ BANCO CONECTADO COM SUCESSO!");
});

const usuarios = [
    { id: 1, nome: 'Marcos Pedro', email: 'marcospsc.dir@gmail.com', senha: 'admin1205' },
    { id: 2, nome: 'Laurte Leandro', email: 'laurte.adv@gmail.com', senha: 'admin9222' },
    { id: 3, nome: 'Vieira Advocacia', email: 'vieiraadvocacia2018@gmail.com', senha: 'admin1640' }
];

app.post('/api/login', (req, res) => {
    const { email, senha } = req.body;
    const user = usuarios.find(u => u.email === email && u.senha === senha);
    if (user) res.json({ id: user.id, nome: user.nome });
    else res.status(401).json({ erro: "Erro" });
});

// SALVAR TAREFA (Otimizado para não travar o Vieira)
app.post('/api/salvar-tarefa', async (req, res) => {
    const { texto, usuario_id } = req.body;
    let client;
    try {
        client = await pool.connect();
        await client.query('INSERT INTO tarefas (titulo, usuario_id, criado_em, status) VALUES ($1, $2, NOW(), $3)', [texto, usuario_id, 'PENDENTE']);
        res.status(201).send("OK");
    } catch (err) { res.status(500).send(err.message); }
    finally { if (client) client.release(); }
});

app.get('/api/lista-tarefas/:usuario_id', async (req, res) => {
    let client;
    try {
        client = await pool.connect();
        const resDb = await client.query('SELECT * FROM tarefas WHERE usuario_id = $1 ORDER BY criado_em ASC', [req.params.usuario_id]);
        res.json(resDb.rows);
    } catch (err) { res.status(500).send(err.message); }
    finally { if (client) client.release(); }
});

app.put('/api/concluir-tarefa/:id', async (req, res) => {
    let client; try { client = await pool.connect(); await client.query("UPDATE tarefas SET status = 'CONCLUÍDA' WHERE id = $1", [req.params.id]); res.json("OK"); } finally { if (client) client.release(); }
});

app.delete('/api/excluir-tarefa/:id', async (req, res) => {
    let client; try { client = await pool.connect(); await client.query('DELETE FROM tarefas WHERE id = $1', [req.params.id]); res.json("OK"); } finally { if (client) client.release(); }
});

const porta = process.env.PORT || 3000;
app.listen(porta, () => console.log(`🚀 Servidor na porta ${porta}`));