const express = require('express');
const { Pool } = require('pg'); 
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.static(__dirname));
app.use(express.json());

// CONFIGURAÇÃO DEFINITIVA DO BANCO
const pool = new Pool({
    // Usa a variável do Render ou o seu link direto do Neon se rodar local
    connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_r6mkt8QLwdoZ@ep-restless-heart-ac4e9km0-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require',
    ssl: {
        rejectUnauthorized: false // ESSENCIAL: Resolve o erro de SSL no seu PC e no Render
    },
    connectionTimeoutMillis: 20000 // Espera o banco acordar
});

// 1. LOGIN
app.post('/api/login', async (req, res) => {
    const { email, senha } = req.body;
    try {
        const usuario = await pool.query(
            'SELECT id, nome FROM usuarios WHERE email = $1 AND senha = $2', 
            [email, senha]
        );
        if (usuario.rows.length > 0) {
            res.json(usuario.rows[0]);
        } else {
            res.status(401).json({ erro: "E-mail ou senha incorretos." });
        }
    } catch (err) { 
        console.error(err);
        res.status(500).json({ erro: "Erro ao conectar no banco." }); 
    }
});

// 2. SALVAR TAREFA
app.post('/api/salvar-tarefa', async (req, res) => {
    const { texto, usuario_id } = req.body;
    try {
        const novaTarefa = await pool.query(
            'INSERT INTO tarefas (titulo, usuario_id) VALUES ($1, $2) RETURNING *', 
            [texto, usuario_id]
        );
        res.status(201).json(novaTarefa.rows[0]);
    } catch (err) { res.status(500).send("Erro ao salvar."); }
});

// 3. LISTAR TAREFAS
app.get('/api/lista-tarefas/:usuario_id', async (req, res) => {
    const { usuario_id } = req.params;
    try {
        const resultado = await pool.query(
            'SELECT * FROM tarefas WHERE usuario_id = $1 ORDER BY criado_em DESC', 
            [usuario_id]
        );
        res.json(resultado.rows);
    } catch (err) { res.status(500).send("Erro ao buscar."); }
});

// 4. CONCLUIR TAREFA
app.put('/api/concluir-tarefa/:id', async (req, res) => {
    try {
        await pool.query("UPDATE tarefas SET status = 'CONCLUÍDA' WHERE id = $1", [req.params.id]);
        res.json({ mensagem: "OK" });
    } catch (err) { res.status(500).send("Erro."); }
});

// 5. EXCLUIR TAREFA
app.delete('/api/excluir-tarefa/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM tarefas WHERE id = $1', [req.params.id]);
        res.json({ mensagem: "Excluída" });
    } catch (err) { res.status(500).send("Erro."); }
});

// 6. RELATÓRIO
app.get('/api/relatorio/:usuario_id', async (req, res) => {
    try {
        const stats = await pool.query(`
            SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'CONCLUÍDA') as concluidas
            FROM tarefas WHERE usuario_id = $1 AND criado_em > NOW() - INTERVAL '7 days'
        `, [req.params.usuario_id]);
        res.json(stats.rows[0]);
    } catch (err) { res.status(500).send("Erro."); }
});

const porta = process.env.PORT || 3000;
app.listen(porta, () => console.log(`🚀 Servidor pronto na porta ${porta}`));