import express from 'express';
import { MongoClient } from 'mongodb';
import GBKService from '../services/gbk.service';
import fs from 'fs';
import { ImportRequest, ProgressResponse } from '../types/express';

const router = express.Router();
const gbkService = GBKService.getInstance();

router.post('/import', async (req: express.Request, res: express.Response) => {
    try {
        const { gbkPath, mongoCollection } = req.body as ImportRequest;

        if (!gbkPath || !mongoCollection) {
            return res.status(400).json({
                status: 'error',
                message: 'gbkPath e mongoCollection são obrigatórios'
            });
        }

        if (!fs.existsSync(gbkPath)) {
            return res.status(400).json({
                status: 'error',
                message: 'Arquivo GBK não encontrado'
            });
        }

        const mongoValid = await gbkService.validateMongoConnection(
            process.env.MONGO_URI!,
            process.env.MONGO_DB_NAME!
        );

        if (!mongoValid) {
            return res.status(500).json({
                status: 'error',
                message: 'Não foi possível conectar ao MongoDB'
            });
        }

        console.log('Iniciando parse do arquivo GBK...');
        const data = await gbkService.parseGBKFile(gbkPath);
        
        console.log('Conectando ao MongoDB...');
        const client = await MongoClient.connect(process.env.MONGO_URI!);
        const db = client.db(process.env.MONGO_DB_NAME);
        const collection = db.collection(mongoCollection);
        
        console.log('Exportando dados para MongoDB...');
        await gbkService.exportToMongo(collection, data);
        
        await client.close();
        
        return res.json({
            status: 'success',
            message: 'Dados importados com sucesso',
            recordCount: data.length
        });
    } catch (error: any) {
        console.error('Erro na rota de importação:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Erro ao importar dados',
            error: error.message
        });
    }
});

router.get('/progress', (req: express.Request, res: express.Response) => {
    try {
        const progress: ProgressResponse = {
            status: 'running',
            details: {}
        };

        gbkService.on('progress', (data) => {
            progress.details = data;
        });

        return res.json(progress);
    } catch (error: any) {
        console.error('Erro na rota de progresso:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Erro ao obter progresso',
            error: error.message
        });
    }
});

export default router;
