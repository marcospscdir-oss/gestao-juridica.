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

// LISTA DE USUÁRIOS
let usuariosPermitidos = [
    { id: 1, nome: 'Marcos Pedro', email: 'marcospsc.dir@gmail.com', senha: 'admin1205' },
    { id: 2, nome: 'Laurte Leandro', email: 'laurte.adv@gmail.com', senha: 'admin9222' },
    { id: 3, nome: 'Vieira Advocacia', email: 'vieiraadvocacia2018@gmail.com', senha: 'admin1640' }
];

app.post('/api/login', (req, res) => {
    const { email, senha } = req.body;
    const usuario = usuariosPermitidos.find(u => u.email === email && u.senha === senha);
    if (usuario) res.json({ id: usuario.id, nome: usuario.nome });
    else res.status(401).json({ erro: "Erro" });
});

app.post('/api/alterar-senha', (req, res) => {
    const { usuario_id, novaSenha } = req.body;
    const usuario = usuariosPermitidos.find(u => u.id == usuario_id);
    if (usuario) { usuario.senha = novaSenha; res.json("OK"); }
    else res.status(400).send("Erro");
});

// ROTA DE SALVAMENTO COM LOG COMPLETO
app.post('/api/salvar-tarefa', async (req, res) => {
    const { texto, usuario_id } = req.body;
    console.log(`Tentando salvar para o usuário ${usuario_id}: ${texto}`);
    
    try {
        const query = 'INSERT INTO tarefas (titulo, usuario_id, status) VALUES ($1, $2, $3) RETURNING *';
        const valores = [texto, usuario_id, 'PENDENTE'];
        
        const resultado = await pool.query(query, valores);
        console.log("SUCESSO NO BANCO:", resultado.rows[0]);
        res.status(201).json(resultado.rows[0]);
    } catch (err) { 
        console.error("ERRO FATAL NO BANCO NEON:", err.message);
        res.status(500).send("Erro no banco: " + err.message); 
    }
});

app.get('/api/lista-tarefas/:usuario_id', async (req, res) => {
    try {
        const resDb = await pool.query('SELECT * FROM tarefas WHERE usuario_id = $1 ORDER BY id DESC', [req.params.usuario_id]);
        res.json(resDb.rows);
    } catch (err) { res.status(500).send(err.message); }
});

app.put('/api/concluir-tarefa/:id', async (req, res) => {
    await pool.query("UPDATE tarefas SET status = 'CONCLUÍDA' WHERE id = $1", [req.params.id]);
    res.json("OK");
});

app.delete('/api/excluir-tarefa/:id', async (req, res) => {
    await pool.query('DELETE FROM tarefas WHERE id = $1', [req.params.id]);
    res.json("OK");
});

const porta = process.env.PORT || 3000;
app.listen(porta, () => console.log(`🚀 Teste de Força Bruta na porta ${porta}`));