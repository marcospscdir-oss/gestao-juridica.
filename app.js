const express = require('express');
const { Pool } = require('pg'); 
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.static(__dirname));
app.use(express.json());

// CONFIGURAÇÃO RIGOROSA PARA NEON (SSL OBRIGATÓRIO)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Essencial para o Render + Neon
    },
    max: 10,
    idleTimeoutMillis: 3000,
    connectionTimeoutMillis: 10000,
});

// TESTE DE CONEXÃO NO LOG (Para você ver no Render se o banco acordou)
pool.query('SELECT NOW()', (err, res) => {
    if (err) console.error("❌ ERRO INICIAL NO BANCO:", err.message);
    else console.log("✅ BANCO DE DADOS CONECTADO EM:", res.rows[0].now);
});

// LOGIN E SENHAS
let usuarios = [
    { id: 1, nome: 'Marcos Pedro', email: 'marcospsc.dir@gmail.com', senha: 'admin1205' },
    { id: 2, nome: 'Laurte Leandro', email: 'laurte.adv@gmail.com', senha: 'admin9222' },
    { id: 3, nome: 'Vieira Advocacia', email: 'vieiraadvocacia2018@gmail.com', senha: 'admin1640' }
];

app.post('/api/login', (req, res) => {
    const { email, senha } = req.body;
    const user = usuarios.find(u => u.email === email && u.senha === senha);
    if (user) res.json({ id: user.id, nome: user.nome });
    else res.status(401).json({ erro: "Credenciais inválidas" });
});

app.post('/api/alterar-senha', (req, res) => {
    const { usuario_id, novaSenha } = req.body;
    const user = usuarios.find(u => u.id == usuario_id);
    if (user) { user.senha = novaSenha; res.json("OK"); }
    else res.status(404).send("Usuário não encontrado");
});

// SALVAR TAREFA (ESTRUTURA LIMPA)
app.post('/api/salvar-tarefa', async (req, res) => {
    const { texto, usuario_id } = req.body;
    let client;
    try {
        client = await pool.connect();
        const dataAgendada = new Date(); // Simplificado para garantir o registro
        await client.query(
            'INSERT INTO tarefas (titulo, usuario_id, criado_em, status) VALUES ($1, $2, $3, $4)', 
            [texto, usuario_id, dataAgendada, 'PENDENTE']
        );
        res.status(201).send("OK");
    } catch (err) {
        console.error("❌ ERRO AO INSERIR:", err.message);
        res.status(500).send(err.message);
    } finally {
        if (client) client.release();
    }
});

app.get('/api/lista-tarefas/:usuario_id', async (req, res) => {
    let client;
    try {
        client = await pool.connect();
        const result = await client.query('SELECT * FROM tarefas WHERE usuario_id = $1 ORDER BY criado_em DESC', [req.params.usuario_id]);
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