const express = require('express');
const { Pool } = require('pg'); 
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.static(__dirname));
app.use(express.json());

// URL DIRETA PARA ELIMINAR ERRO DE VARIÁVEL DE AMBIENTE
const connectionString = "postgresql://neondb_owner:npg_r6mkt8QLwdoZ@ep-restless-heart-ac4e9km0-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require";

const pool = new Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false },
    max: 20, // Aumentado para suportar múltiplos dispositivos
    idleTimeoutMillis: 1000, // Libera a conexão imediatamente após o uso
});

// LOGIN COM OS 3 ACESSOS INTEGRADOS
const usuarios = [
    { id: 1, nome: 'Marcos Pedro', email: 'marcospsc.dir@gmail.com', senha: 'admin1205' },
    { id: 2, nome: 'Laurte Leandro', email: 'laurte.adv@gmail.com', senha: 'admin9222' },
    { id: 3, nome: 'Vieira Advocacia', email: 'vieiraadvocacia2018@gmail.com', senha: 'admin1640' }
];

app.post('/api/login', (req, res) => {
    const { email, senha } = req.body;
    const user = usuarios.find(u => u.email === email && u.senha === senha);
    if (user) res.json({ id: user.id, nome: user.nome });
    else res.status(401).json({ erro: "Acesso Negado" });
});

// SALVAR TAREFA - COM LIBERAÇÃO DE CLIENTE (IMPEDE TRAVAMENTO NO VIEIRA)
app.post('/api/salvar-tarefa', async (req, res) => {
    const { texto, usuario_id } = req.body;
    let client;
    try {
        client = await pool.connect();
        await client.query(
            'INSERT INTO tarefas (titulo, usuario_id, criado_em, status) VALUES ($1, $2, NOW(), $3)', 
            [texto, usuario_id, 'PENDENTE']
        );
        res.status(201).send("OK");
    } catch (err) {
        console.error("Erro no banco:", err.message);
        res.status(500).send("Erro");
    } finally {
        if (client) client.release();
    }
});

// LISTAR TAREFAS
app.get('/api/lista-tarefas/:usuario_id', async (req, res) => {
    let client;
    try {
        client = await pool.connect();
        const result = await client.query('SELECT * FROM tarefas WHERE usuario_id = $1 ORDER BY criado_em ASC', [req.params.usuario_id]);
        res.json(result.rows);
    } catch (err) { res.status(500).send("Erro"); }
    finally { if (client) client.release(); }
});

// CONCLUIR E EXCLUIR
app.put('/api/concluir-tarefa/:id', async (req, res) => {
    let client; try { client = await pool.connect(); await client.query("UPDATE tarefas SET status = 'CONCLUÍDA' WHERE id = $1", [req.params.id]); res.json("OK"); } 
    finally { if (client) client.release(); }
});

app.delete('/api/excluir-tarefa/:id', async (req, res) => {
    let client; try { client = await pool.connect(); await client.query('DELETE FROM tarefas WHERE id = $1', [req.params.id]); res.json("OK"); } 
    finally { if (client) client.release(); }
});

const porta = process.env.PORT || 3000;
app.listen(porta, () => console.log(`✅ Servidor operacional na porta ${porta}`));