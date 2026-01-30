const express = require('express');
const { Pool } = require('pg'); 
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.static(__dirname));
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// 1. SALVAR TAREFA (COM INTELIGÊNCIA DE DATA)
app.post('/api/salvar-tarefa', async (req, res) => {
    const { texto, usuario_id } = req.body;
    try {
        let dataAgendada = new Date(); 
        const textoBaixo = texto.toLowerCase();
        const meses = {
            'janeiro': 0, 'fevereiro': 1, 'março': 2, 'abril': 3, 'maio': 4, 'junho': 5,
            'julho': 6, 'agosto': 7, 'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11
        };

        let dataDetectada = false;
        for (let mesNome in meses) {
            if (textoBaixo.includes(mesNome)) {
                const diaMatch = textoBaixo.match(/\d+/); 
                if (diaMatch) {
                    dataAgendada = new Date(2026, meses[mesNome], parseInt(diaMatch[0]), 12, 0, 0);
                    dataDetectada = true;
                    break;
                }
            }
        }

        if (!dataDetectada) {
            const regexBarra = /(\d{2})\/(\d{2})/;
            const matchBarra = texto.match(regexBarra);
            if (matchBarra) {
                dataAgendada = new Date(2026, parseInt(matchBarra[2]) - 1, parseInt(matchBarra[1]), 12, 0, 0);
            }
        }

        const novaTarefa = await pool.query(
            'INSERT INTO tarefas (titulo, usuario_id, criado_em) VALUES ($1, $2, $3) RETURNING *', 
            [texto, usuario_id, dataAgendada]
        );
        res.status(201).json(novaTarefa.rows[0]);
    } catch (err) { res.status(500).send("Erro ao salvar."); }
});

// 2. LISTAR TAREFAS
app.get('/api/lista-tarefas/:usuario_id', async (req, res) => {
    try {
        const resultado = await pool.query('SELECT * FROM tarefas WHERE usuario_id = $1 ORDER BY criado_em ASC', [req.params.usuario_id]);
        res.json(resultado.rows);
    } catch (err) { res.status(500).send("Erro ao listar."); }
});

// 3. LOGIN
app.post('/api/login', async (req, res) => {
    const { email, senha } = req.body;
    try {
        const usuario = await pool.query('SELECT id, nome FROM usuarios WHERE email = $1 AND senha = $2', [email, senha]);
        if (usuario.rows.length > 0) res.json(usuario.rows[0]);
        else res.status(401).json({ erro: "Erro" });
    } catch (err) { res.status(500).send("Erro no login."); }
});

// 4. CONCLUIR E EXCLUIR
app.put('/api/concluir-tarefa/:id', async (req, res) => {
    await pool.query("UPDATE tarefas SET status = 'CONCLUÍDA' WHERE id = $1", [req.params.id]);
    res.json({ mensagem: "OK" });
});

app.delete('/api/excluir-tarefa/:id', async (req, res) => {
    await pool.query('DELETE FROM tarefas WHERE id = $1', [req.params.id]);
    res.json({ mensagem: "OK" });
});

// --- NOVAS ROTAS PARA OS BOTÕES DO TOPO ---

// 5. REAGENDAR ONTEM (Move pendentes antigos para hoje)
app.put('/api/reagendar-ontem/:usuario_id', async (req, res) => {
    try {
        const { usuario_id } = req.params;
        const hoje = new Date().toISOString().split('T')[0];
        await pool.query(
            "UPDATE tarefas SET criado_em = $1 WHERE usuario_id = $2 AND status = 'PENDENTE' AND criado_em < $1", 
            [hoje, usuario_id]
        );
        res.json({ mensagem: "Sucesso" });
    } catch (err) { res.status(500).send("Erro ao reagendar."); }
});

// 6. RELATÓRIO DE PRODUTIVIDADE (Alimenta o painel visual)
app.get('/api/relatorio/:usuario_id', async (req, res) => {
    try {
        const { usuario_id } = req.params;
        const stats = await pool.query(`
            SELECT 
                COUNT(*) as total, 
                COUNT(*) FILTER (WHERE status = 'CONCLUÍDA') as concluidas
            FROM tarefas 
            WHERE usuario_id = $1 AND criado_em > NOW() - INTERVAL '30 days'
        `, [usuario_id]);
        res.json(stats.rows[0]);
    } catch (err) { res.status(500).send("Erro no relatório."); }
});

const porta = process.env.PORT || 3000;
app.listen(porta, () => console.log(`🚀 Sistema Online na porta ${porta}`));