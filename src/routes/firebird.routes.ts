import { Router } from 'express';
import FirebirdService from '../services/firebird.service';

const router = Router();
const firebirdService = FirebirdService.getInstance();

// Rota para testar a conexão
router.get('/test', async (req, res) => {
    try {
        const isConnected = await firebirdService.testConnection();
        if (isConnected) {
            res.json({ status: 'success', message: 'Conexão com Firebird estabelecida com sucesso!' });
        } else {
            res.status(500).json({ status: 'error', message: 'Falha ao conectar com Firebird' });
        }
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Erro ao testar conexão', error });
    }
});

// Rota para listar todas as tabelas
router.get('/tables', async (req, res) => {
    try {
        const tables = await firebirdService.listTables();
        res.json({ status: 'success', tables });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Erro ao listar tabelas', error });
    }
});

export default router;
