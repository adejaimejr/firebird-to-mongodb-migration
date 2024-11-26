import express from 'express';
import dotenv from 'dotenv';
import firebirdRoutes from './routes/firebird.routes';
import gbkRoutes from './routes/gbk.routes';
import { MongoClient } from 'mongodb';

// Carrega as variáveis de ambiente
dotenv.config();

const app = express();

// Middleware para logs
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Middleware para parse do body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware para CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
});

// Rotas principais
app.get('/', (req, res) => {
    res.json({ message: 'Serviço de Migração Firebird para MongoDB' });
});

// Configurar rotas
app.use('/api/firebird', firebirdRoutes);
app.use('/api/gbk', gbkRoutes);

// Middleware de erro
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Erro na aplicação:', err);
    res.status(500).json({
        status: 'error',
        message: 'Erro interno do servidor',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

const PORT = process.env.PORT || 3000;

// Função para testar conexão com MongoDB
async function testMongoConnection() {
    try {
        const client = await MongoClient.connect(process.env.MONGO_URI!);
        await client.close();
        console.log('Conexão com MongoDB testada com sucesso');
        return true;
    } catch (error) {
        console.error('Erro ao conectar com MongoDB:', error);
        return false;
    }
}

// Inicia o servidor
async function startServer() {
    try {
        // Testa conexão com MongoDB antes de iniciar o servidor
        const mongoConnected = await testMongoConnection();
        if (!mongoConnected) {
            console.error('Não foi possível conectar ao MongoDB. Verifique as configurações.');
            process.exit(1);
        }

        const server = app.listen(PORT, () => {
            console.log(`Servidor rodando na porta ${PORT}`);
            console.log('Ambiente:', process.env.NODE_ENV || 'development');
        });

        // Tratamento de erros não capturados
        process.on('uncaughtException', (err) => {
            console.error('Erro não capturado:', err);
            server.close(() => process.exit(1));
        });

        process.on('unhandledRejection', (err) => {
            console.error('Promise não tratada:', err);
            server.close(() => process.exit(1));
        });

        // Graceful shutdown
        process.on('SIGTERM', () => {
            console.log('Recebido SIGTERM. Fechando servidor...');
            server.close(() => {
                console.log('Servidor fechado');
                process.exit(0);
            });
        });

    } catch (error) {
        console.error('Erro ao iniciar servidor:', error);
        process.exit(1);
    }
}

startServer();
