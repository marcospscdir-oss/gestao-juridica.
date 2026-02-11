const express = require('express');
const { Pool } = require('pg'); 
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.static(__dirname));
app.use(express.json());

// CONFIGURAÇÃO DE CONEXÃO: Aqui resolvemos o erro da senha
// Se estiver no Render, ele lê a variável DATABASE_URL. 
// Se estiver local, ele tenta ler sua variável ou cai no erro se estiver vazia.
// CONFIGURAÇÃO DE CONEXÃO DINÂMICA
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Só ativa SSL se houver uma URL e não for localhost
    ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') 
        ? { rejectUnauthorized: false } 
        : false,
    max: 10,
    idleTimeoutMillis: 3000,
});

// LOG PARA O VS CODE - Aqui você confirma se o erro sumiu
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error("❌ ERRO NO BANCO:", err.message);
        console.log("DICA: No VS Code, rode: $env:DATABASE_URL='SUA_URL_DO_NEON_AQUI'");
    } else {
        console.log("✅ BANCO CONECTADO COM SUCESSO!");
    }
});

// USUÁRIOS (Estrutura padrão que já vínhamos usando)
let usuariosPermitidos = [
    { id: 1, nome: 'Marcos Pedro', email: 'marcospsc.dir@gmail.com', senha: 'admin1205' },
    { id: 2, nome: 'Laurte Leandro', email: 'laurte.adv@gmail.com', senha: 'admin9222' },
    { id: 3, nome: 'Vieira Advocacia', email: 'vieiraadvocacia2018@gmail.com', senha: 'admin1640' }
];

app.post('/api/login', (req, res) => {
    const { email, senha } = req.body;
    const usuario = usuariosPermitidos.find(u => u.email === email && u.senha === senha);
    if (usuario) res.json({ id: usuario.id, nome: usuario.nome });
    else res.status(401).json({ erro: "E-mail ou senha incorretos." });
});

// SALVAR TAREFA (Usando NOW() para garantir que salve no banco Neon)
app.post('/api/salvar-tarefa', async (req, res) => {
    const { texto, usuario_id } = req.body;
    let client;
    try {
        client = await pool.connect();
        await client.query('INSERT INTO tarefas (titulo, usuario_id, criado_em, status) VALUES ($1, $2, NOW(), $3)', [texto, usuario_id, 'PENDENTE']);
        res.status(201).send("OK");
    } catch (err) {
        console.error("Erro ao salvar:", err.message);
        res.status(500).send(err.message);
    } finally {
        if (client) client.release();
    }
});

// LISTAR (A interface vai organizar nas 4 colunas que já existem)
app.get('/api/lista-tarefas/:usuario_id', async (req, res) => {
    let client;
    try {
        client = await pool.connect();
        const resultado = await client.query('SELECT * FROM tarefas WHERE usuario_id = $1 ORDER BY criado_em ASC', [req.params.usuario_id]);
        res.json(resultado.rows);
    } catch (err) { res.status(500).send(err.message); }
    finally { if (client) client.release(); }
});

// REAGENDAR, CONCLUIR E EXCLUIR
app.put('/api/concluir-tarefa/:id', async (req, res) => {
    let client; try { client = await pool.connect(); await client.query("UPDATE tarefas SET status = 'CONCLUÍDA' WHERE id = $1", [req.params.id]); res.json("OK"); } finally { if (client) client.release(); }
});

app.delete('/api/excluir-tarefa/:id', async (req, res) => {
    let client; try { client = await pool.connect(); await client.query('DELETE FROM tarefas WHERE id = $1', [req.params.id]); res.json("OK"); } finally { if (client) client.release(); }
});

app.put('/api/reagendar-ontem/:usuario_id', async (req, res) => {
    let client; try {
        client = await pool.connect();
        const hoje = new Date().toISOString().split('T')[0];
        await client.query("UPDATE tarefas SET criado_em = $1 WHERE usuario_id = $2 AND status = 'PENDENTE' AND criado_em < $1", [hoje, req.params.usuario_id]);
        res.json("OK");
    } finally { if (client) client.release(); }
});

const porta = process.env.PORT || 3000;
app.listen(porta, () => console.log(`🚀 Servidor rodando na porta ${porta}`));