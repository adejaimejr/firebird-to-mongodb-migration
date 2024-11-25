import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
    res.json({ message: 'Serviço de Migração Firebird para MongoDB' });
});

app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
