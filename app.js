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

app.post('/api/salvar-tarefa', async (req, res) => {
    const { texto, usuario_id } = req.body;
    try {
        let dataAgendada = new Date(); // Padrão é hoje
        const textoBaixo = texto.toLowerCase();
        
        // 1. Lista de meses para converter texto em número
        const meses = {
            'janeiro': 0, 'fevereiro': 1, 'março': 2, 'abril': 3, 'maio': 4, 'junho': 5,
            'julho': 6, 'agosto': 7, 'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11
        };

        // 2. Tenta encontrar formato "14 de fevereiro"
        let dataDetectada = false;
        for (let mesNome in meses) {
            if (textoBaixo.includes(mesNome)) {
                const diaMatch = textoBaixo.match(/\d+/); // Pega o primeiro número (o dia)
                if (diaMatch) {
                    dataAgendada = new Date(2026, meses[mesNome], parseInt(diaMatch[0]), 12, 0, 0);
                    dataDetectada = true;
                    break;
                }
            }
        }

        // 3. Se não achou texto, tenta o formato "14/02"
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

// Mantenha as outras rotas (login, lista-tarefas, concluir, excluir) iguais às anteriores
app.get('/api/lista-tarefas/:usuario_id', async (req, res) => {
    const resultado = await pool.query('SELECT * FROM tarefas WHERE usuario_id = $1 ORDER BY criado_em ASC', [req.params.usuario_id]);
    res.json(resultado.rows);
});
app.post('/api/login', async (req, res) => {
    const { email, senha } = req.body;
    const usuario = await pool.query('SELECT id, nome FROM usuarios WHERE email = $1 AND senha = $2', [email, senha]);
    if (usuario.rows.length > 0) res.json(usuario.rows[0]);
    else res.status(401).json({ erro: "Erro" });
});
app.put('/api/concluir-tarefa/:id', async (req, res) => {
    await pool.query("UPDATE tarefas SET status = 'CONCLUÍDA' WHERE id = $1", [req.params.id]);
    res.json({ mensagem: "OK" });
});
app.delete('/api/excluir-tarefa/:id', async (req, res) => {
    await pool.query('DELETE FROM tarefas WHERE id = $1', [req.params.id]);
    res.json({ mensagem: "OK" });
});

const porta = process.env.PORT || 3000;
app.listen(porta, () => console.log(`🚀 Porta ${porta}`));