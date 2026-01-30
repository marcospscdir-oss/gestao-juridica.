const express = require('express');
const { Pool } = require('pg'); 
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.static(__dirname));
app.use(express.json());

// CONFIGURAÇÃO DO BANCO NA NUVEM (NEON)
const pool = new Pool({
    // Usa a variável que você configurou no Render
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    // Aumenta o tempo de espera para dar tempo do banco "acordar"
    connectionTimeoutMillis: 10000 
});

// 1. LOGIN: Verifica se é o Marcos ou o Laurte
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
        res.status(500).send("Erro ao conectar com o banco de dados."); 
    }
});

// 2. SALVAR TAREFA: Agora vinculada ao usuário logado
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

// 3. LISTAR TAREFAS: Mostra apenas o que é de cada usuário
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

const porta = process.env.PORT || 3000;
app.listen(porta, () => console.log(`🚀 Servidor rodando na porta ${porta}`));