const express = require('express');
const { Pool } = require('pg'); 
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.static(__dirname));
app.use(express.json());

// CONFIGURAÇÃO DE CONEXÃO BLINDADA (RESOLVE O ERRO DE SSL)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false, // Se tiver URL (Render/Neon), usa SSL. Local (PC), ele ajusta.
    max: 10,
    idleTimeoutMillis: 3000,
});

// LOG DE STATUS NO TERMINAL
pool.query('SELECT NOW()', (err, res) => {
    if (err) console.error("❌ ERRO NO BANCO:", err.message);
    else console.log("✅ BANCO CONECTADO COM SUCESSO!");
});

// LISTA DE USUÁRIOS
let usuarios = [
    { id: 1, nome: 'Marcos Pedro', email: 'marcospsc.dir@gmail.com', senha: 'admin1205' },
    { id: 2, nome: 'Laurte Leandro', email: 'laurte.adv@gmail.com', senha: 'admin9222' },
    { id: 3, nome: 'Vieira Advocacia', email: 'vieiraadvocacia2018@gmail.com', senha: 'admin1640' }
];

app.post('/api/login', (req, res) => {
    const { email, senha } = req.body;
    const user = usuarios.find(u => u.email === email && u.senha === senha);
    if (user) res.json({ id: user.id, nome: user.nome });
    else res.status(401).json({ erro: "Acesso negado" });
});

app.post('/api/alterar-senha', (req, res) => {
    const { usuario_id, novaSenha } = req.body;
    const user = usuarios.find(u => u.id == usuario_id);
    if (user) { user.senha = novaSenha; res.json("OK"); }
    else res.status(404).send("Erro");
});

// SALVAR TAREFA COM INTELIGÊNCIA DE COLUNA
app.post('/api/salvar-tarefa', async (req, res) => {
    const { texto, usuario_id } = req.body;
    let client;
    try {
        client = await pool.connect();
        let dataAgendada = new Date();
        const textoBaixo = texto.toLowerCase();
        
        // Detecção básica de datas (mesmo lógica de antes)
        const meses = { 'janeiro': 0, 'fevereiro': 1, 'março': 2, 'abril': 3, 'maio': 4, 'junho': 5, 'julho': 6, 'agosto': 7, 'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11 };
        for (let m in meses) {
            if (textoBaixo.includes(m)) {
                const dia = textoBaixo.match(/\d+/);
                if (dia) dataAgendada = new Date(2026, meses[m], parseInt(dia[0]), 12, 0, 0);
            }
        }

        await client.query(
            'INSERT INTO tarefas (titulo, usuario_id, criado_em, status) VALUES ($1, $2, $3, $4)', 
            [texto, usuario_id, dataAgendada, 'PENDENTE']
        );
        res.status(201).send("OK");
    } catch (err) {
        console.error("❌ ERRO AO SALVAR:", err.message);
        res.status(500).send(err.message);
    } finally {
        if (client) client.release();
    }
});

app.get('/api/lista-tarefas/:usuario_id', async (req, res) => {
    let client;
    try {
        client = await pool.connect();
        const result = await client.query('SELECT * FROM tarefas WHERE usuario_id = $1 ORDER BY criado_em ASC', [req.params.usuario_id]);
        res.json(result.rows);
    } catch (err) { res.status(500).send(err.message); }
    finally { if (client) client.release(); }
});

app.put('/api/concluir-tarefa/:id', async (req, res) => {
    let client; try {
        client = await pool.connect();
        await client.query("UPDATE tarefas SET status = 'CONCLUÍDA' WHERE id = $1", [req.params.id]);
        res.json("OK");
    } finally { if (client) client.release(); }
});

app.delete('/api/excluir-tarefa/:id', async (req, res) => {
    let client; try {
        client = await pool.connect();
        await client.query('DELETE FROM tarefas WHERE id = $1', [req.params.id]);
        res.json("OK");
    } finally { if (client) client.release(); }
});

const porta = process.env.PORT || 3000;
app.listen(porta, () => console.log(`🚀 Servidor rodando na porta ${porta}`));