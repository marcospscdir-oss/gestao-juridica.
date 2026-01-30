const express = require('express');
const { Pool } = require('pg'); 
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.static(__dirname));
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_r6mkt8QLwdoZ@ep-restless-heart-ac4e9km0-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000
});

// 1. LOGIN
app.post('/api/login', async (req, res) => {
    const { email, senha } = req.body;
    try {
        const usuario = await pool.query('SELECT id, nome FROM usuarios WHERE email = $1 AND senha = $2', [email, senha]);
        if (usuario.rows.length > 0) res.json(usuario.rows[0]);
        else res.status(401).json({ erro: "Credenciais inválidas" });
    } catch (err) { res.status(500).json({ erro: "Erro no banco" }); }
});

// 2. SALVAR TAREFA (SENSOR DE DATA AUTOMÁTICO)
app.post('/api/salvar-tarefa', async (req, res) => {
    const { texto, usuario_id } = req.body;
    try {
        let dataAgendada = new Date(); // Padrão: Hoje
        
        // REGEX: Procura qualquer data no formato 00/00 em qualquer lugar da frase
        const regexData = /(\d{2})\/(\d{2})/;
        const encontrado = texto.match(regexData);
        
        if (encontrado) {
            const dia = parseInt(encontrado[1]);
            const mes = parseInt(encontrado[2]) - 1; // Janeiro é 0 no JavaScript
            
            // Cria a data para o ano de 2026 (conforme seu projeto)
            dataAgendada = new Date(2026, mes, dia, 12, 0, 0); 
            console.log(`Data detectada: ${dataAgendada}`);
        }

        const novaTarefa = await pool.query(
            'INSERT INTO tarefas (titulo, usuario_id, criado_em) VALUES ($1, $2, $3) RETURNING *', 
            [texto, usuario_id, dataAgendada]
        );
        res.status(201).json(novaTarefa.rows[0]);
    } catch (err) { 
        console.error(err);
        res.status(500).send("Erro ao salvar."); 
    }
});

// 3. LISTAR TAREFAS (ORDENADO POR DATA)
app.get('/api/lista-tarefas/:usuario_id', async (req, res) => {
    try {
        const resultado = await pool.query(
            'SELECT * FROM tarefas WHERE usuario_id = $1 ORDER BY criado_em ASC', 
            [req.params.usuario_id]
        );
        res.json(resultado.rows);
    } catch (err) { res.status(500).send("Erro ao buscar."); }
});

// 4. CONCLUIR E 5. EXCLUIR (MANTIDOS)
app.put('/api/concluir-tarefa/:id', async (req, res) => {
    await pool.query("UPDATE tarefas SET status = 'CONCLUÍDA' WHERE id = $1", [req.params.id]);
    res.json({ mensagem: "OK" });
});

app.delete('/api/excluir-tarefa/:id', async (req, res) => {
    await pool.query('DELETE FROM tarefas WHERE id = $1', [req.params.id]);
    res.json({ mensagem: "Excluída" });
});

const porta = process.env.PORT || 3000;
app.listen(porta, () => console.log(`🚀 Sistema Inteligente na porta ${porta}`));