const express = require('express');
const { Pool } = require('pg'); 
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.static(__dirname));
app.use(express.json());

// CONFIGURAÇÃO DO BANCO NA NUVEM (NEON)
const pool = new Pool({
    connectionString: 'COLE_AQUI_SUA_STRING_DO_NEON',
    ssl: { rejectUnauthorized: false } // Obrigatório para o Neon
});

// 1. ROTA DE LOGIN: Identifica se é o Marcos ou o Laurte
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
        res.status(500).send("Erro no servidor de login."); 
    }
});

// 2. SALVAR TAREFA: Vincula a tarefa ao ID de quem está logado
app.post('/api/salvar-tarefa', async (req, res) => {
    const { texto, usuario_id } = req.body;
    try {
        const novaTarefa = await pool.query(
            'INSERT INTO tarefas (titulo, usuario_id) VALUES ($1, $2) RETURNING *', 
            [texto, usuario_id]
        );
        res.status(201).json(novaTarefa.rows[0]);
    } catch (err) { 
        console.error(err);
        res.status(500).send("Erro ao salvar tarefa."); 
    }
});

// 3. LISTAR TAREFAS: Filtra para mostrar apenas o que pertence ao usuário logado
app.get('/api/lista-tarefas/:usuario_id', async (req, res) => {
    const { usuario_id } = req.params;
    try {
        const resultado = await pool.query(
            'SELECT * FROM tarefas WHERE usuario_id = $1 ORDER BY criado_em DESC', 
            [usuario_id]
        );
        res.json(resultado.rows);
    } catch (err) { 
        console.error(err);
        res.status(500).send("Erro ao buscar tarefas."); 
    }
});

// 4. CONCLUIR TAREFA
app.put('/api/concluir-tarefa/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("UPDATE tarefas SET status = 'CONCLUÍDA' WHERE id = $1", [id]);
        res.json({ mensagem: "Tarefa concluída!" });
    } catch (err) { res.status(500).send("Erro ao concluir."); }
});

// 5. EXCLUIR TAREFA
app.delete('/api/excluir-tarefa/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM tarefas WHERE id = $1', [id]);
        res.json({ mensagem: "Excluída com sucesso!" });
    } catch (err) { res.status(500).send("Erro ao excluir."); }
});

// 6. REAGENDAR (Puxar pendências de ontem para hoje)
app.post('/api/reagendar', async (req, res) => {
    const { usuario_id } = req.body;
    try {
        const resultado = await pool.query(
            "UPDATE tarefas SET criado_em = NOW() WHERE status = 'PENDENTE' AND criado_em < CURRENT_DATE AND usuario_id = $1",
            [usuario_id]
        );
        res.json({ quantidade: resultado.rowCount });
    } catch (err) { res.status(500).send("Erro ao reagendar."); }
});

// 7. RELATÓRIO DE DESEMPENHO (Últimos 7 dias)
app.get('/api/relatorio/:usuario_id', async (req, res) => {
    const { usuario_id } = req.params;
    try {
        const stats = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'CONCLUÍDA') as concluidas
            FROM tarefas 
            WHERE usuario_id = $1 AND criado_em > NOW() - INTERVAL '7 days'
        `, [usuario_id]);
        res.json(stats.rows[0]);
    } catch (err) { res.status(500).send("Erro no relatório."); }
});

const porta = process.env.PORT || 3000;
app.listen(porta, () => console.log(`🚀 Sistema Online na porta ${porta}`));