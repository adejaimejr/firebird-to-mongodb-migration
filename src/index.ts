import express from 'express';
import dotenv from 'dotenv';
import firebirdRoutes from './routes/firebird.routes';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Rotas principais
app.get('/', (req, res) => {
    res.json({ message: 'Serviço de Migração Firebird para MongoDB' });
});

// Rotas do Firebird
app.use('/api/firebird', firebirdRoutes);

app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
