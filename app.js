const express = require('express');
const { Pool } = require('pg'); 
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.static(__dirname));
app.use(express.json());

// CONFIGURAÇÃO DE CONEXÃO OTIMIZADA PARA PLANO GRATUITO
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10, 
    idleTimeoutMillis: 2000, 
    connectionTimeoutMillis: 10000,
});

// PING INTERNO PARA MANTER O BANCO E SERVIDOR ATIVOS
setInterval(async () => {
    try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        console.log('🔄 Servidor e Banco Ativos.');
    } catch (err) {
        console.error('⚠️ Erro no Keep-Alive:', err.message);
    }
}, 240000); // 4 minutos

// LISTA DE USUÁRIOS (Senhas iniciais)
let usuariosPermitidos = [
    { id: 1, nome: 'Marcos Pedro', email: 'marcospsc.dir@gmail.com', senha: 'admin1205' },
    { id: 2, nome: 'Laurte Leandro', email: 'laurte.adv@gmail.com', senha: 'admin9222' },
    { id: 3, nome: 'Vieira Advocacia', email: 'vieiraadvocacia2018@gmail.com', senha: 'admin1640' }
];

// 1. LOGIN
app.post('/api/login', (req, res) => {
    const { email, senha } = req.body;
    const usuario = usuariosPermitidos.find(u => u.email === email && u.senha === senha);
    if (usuario) {
        res.json({ id: usuario.id, nome: usuario.nome });
    } else {
        res.status(401).json({ erro: "E-mail ou senha incorretos." });
    }
});

// 2. ALTERAR SENHA
app.post('/api/alterar-senha', (req, res) => {
    const { usuario_id, novaSenha } = req.body;
    const usuario = usuariosPermitidos.find(u => u.id == usuario_id);
    if (usuario && novaSenha.length >= 4) {
        usuario.senha = novaSenha;
        res.json({ mensagem: "Senha alterada com sucesso!" });
    } else {
        res.status(400).json({ erro: "Erro ao alterar senha." });
    }
});

// 3. SALVAR TAREFA (COM LIBERAÇÃO DE CONEXÃO)
app.post('/api/salvar-tarefa', async (req, res) => {
    const { texto, usuario_id } = req.body;
    if (!usuario_id) return res.status(400).send("ID ausente.");

    let client;
    try {
        client = await pool.connect();
        let dataAgendada = new Date(); 
        const textoBaixo = texto.toLowerCase();
        const meses = { 'janeiro': 0, 'fevereiro': 1, 'março': 2, 'abril': 3, 'maio': 4, 'junho': 5, 'julho': 6, 'agosto': 7, 'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11 };

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
            if (matchBarra) dataAgendada = new Date(2026, parseInt(matchBarra[2]) - 1, parseInt(matchBarra[1]), 12, 0, 0);
        }

        await client.query('INSERT INTO tarefas (titulo, usuario_id, criado_em) VALUES ($1, $2, $3)', [texto, usuario_id, dataAgendada]);
        res.status(201).send("OK");
    } catch (err) { res.status(500).send(err.message); }
    finally { if (client) client.release(); }
});

// 4. LISTAR TAREFAS
app.get('/api/lista-tarefas/:usuario_id', async (req, res) => {
    let client;
    try {
        client = await pool.connect();
        const resDb = await client.query('SELECT * FROM tarefas WHERE usuario_id = $1 ORDER BY criado_em ASC', [req.params.usuario_id]);
        res.json(resDb.rows);
    } catch (err) { res.status(500).send(err.message); }
    finally { if (client) client.release(); }
});

// 5. CONCLUIR / EXCLUIR / REAGENDAR
app.put('/api/concluir-tarefa/:id', async (req, res) => {
    let client; try { client = await pool.connect(); await client.query("UPDATE tarefas SET status = 'CONCLUÍDA' WHERE id = $1", [req.params.id]); res.json("OK"); } 
    catch (err) { res.status(500).send(err.message); } finally { if (client) client.release(); }
});

app.delete('/api/excluir-tarefa/:id', async (req, res) => {
    let client; try { client = await pool.connect(); await client.query('DELETE FROM tarefas WHERE id = $1', [req.params.id]); res.json("OK"); } 
    catch (err) { res.status(500).send(err.message); } finally { if (client) client.release(); }
});

app.put('/api/reagendar-ontem/:usuario_id', async (req, res) => {
    let client; try {
        client = await pool.connect();
        const hoje = new Date().toISOString().split('T')[0];
        await client.query("UPDATE tarefas SET criado_em = $1 WHERE usuario_id = $2 AND status = 'PENDENTE' AND criado_em < $1", [hoje, req.params.usuario_id]);
        res.json("OK");
    } catch (err) { res.status(500).send(err.message); } finally { if (client) client.release(); }
});

const porta = process.env.PORT || 3000;
app.listen(porta, () => console.log(`🚀 Sistema Online na porta ${porta}`));