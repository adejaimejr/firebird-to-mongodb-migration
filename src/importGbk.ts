import { MongoClient } from 'mongodb';
import fs from 'fs';
import iconv from 'iconv-lite';
import dotenv from 'dotenv';
import path from 'path';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { GbkProcessor } from './gbkProcessor';

// Configurar dotenv com o caminho correto para o arquivo .env
const envPath = path.resolve(__dirname, '../.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error('Erro ao carregar .env:', result.error);
    process.exit(1);
}

console.log('Variáveis de ambiente carregadas:', {
    mongoUri: process.env.MONGO_URI ? 'Configurado' : 'Não configurado',
    mongoDbName: process.env.MONGO_DB_NAME ? 'Configurado' : 'Não configurado'
});

function findMostRecentGbkFile(directory: string): string {
    const files = fs.readdirSync(directory);
    const gbkFiles = files
        .filter(file => file.startsWith('bckfdb-') && file.endsWith('.gbk'))
        .map(file => {
            const match = file.match(/bckfdb-(\d{4})-(\d{2})-(\d{2})-(\d{2})\.(\d{2})/);
            if (!match) return { file, date: new Date(0) };
            const [_, year, month, day, hour, minute] = match;
            return {
                file,
                date: new Date(
                    parseInt(year),
                    parseInt(month) - 1,
                    parseInt(day),
                    parseInt(hour),
                    parseInt(minute)
                )
            };
        })
        .sort((a, b) => b.date.getTime() - a.date.getTime());

    if (gbkFiles.length === 0) {
        throw new Error('Nenhum arquivo GBK encontrado no diretório!');
    }

    return gbkFiles[0].file;
}

async function importGbkToMongo(gbkPath: string, collection: string) {
    let client: MongoClient | null = null;
    
    try {
        // Converter caminho relativo para absoluto
        const absolutePath = path.resolve(__dirname, gbkPath);
        console.log('Iniciando importação...');
        console.log(`Arquivo GBK: ${absolutePath}`);
        console.log(`Database: ${process.env.MONGO_DB_NAME}`);

        // Verificar se o arquivo existe
        if (!fs.existsSync(absolutePath)) {
            throw new Error(`Arquivo GBK não encontrado: ${absolutePath}`);
        }

        // Verificar variáveis de ambiente
        if (!process.env.MONGO_URI || !process.env.MONGO_DB_NAME) {
            throw new Error('Variáveis MONGO_URI e MONGO_DB_NAME são obrigatórias');
        }

        // Inicializar o processador GBK
        const gbkProcessor = new GbkProcessor(absolutePath);
        
        // Validar arquivo GBK
        console.log('Validando arquivo GBK...');
        const isValid = await gbkProcessor.validateGbkFile();
        if (!isValid) {
            throw new Error('Arquivo GBK inválido ou corrompido');
        }

        // Conectar ao MongoDB com as novas configurações
        console.log('Conectando ao MongoDB...');
        client = await MongoClient.connect(process.env.MONGO_URI, {
            connectTimeoutMS: 30000,
            socketTimeoutMS: 45000
        });

        const db = client.db(process.env.MONGO_DB_NAME);
        const col = db.collection(collection);

        // Criar índices necessários
        console.log('Criando índices...');
        await col.createIndex({ importId: 1 });

        // Processar arquivo GBK
        const batchSize = parseInt(process.env.BATCH_SIZE || '1000');
        let batch: any[] = [];
        let totalProcessed = 0;

        console.log('Iniciando processamento do arquivo...');
        
        // Verificar último checkpoint
        const lastCheckpoint = await gbkProcessor.getLastCheckpoint();
        if (lastCheckpoint > 0) {
            console.log(`Retomando importação a partir da linha ${lastCheckpoint}`);
            // Recuperar último importId do MongoDB
            const lastRecord = await col.findOne({}, { sort: { importId: -1 } });
            if (lastRecord) {
                totalProcessed = lastRecord.importId;
            }
        }

        await gbkProcessor.processGbkFile(async (line) => {
            try {
                if (line.trim()) {
                    const data = {
                        content: line,
                        importId: totalProcessed + 1,
                        createdAt: new Date()
                    };
                    batch.push(data);

                    if (batch.length >= batchSize) {
                        await col.insertMany(batch, { ordered: false });
                        totalProcessed += batch.length;
                        console.log(`Importados ${totalProcessed} registros`);
                        batch = [];
                    }
                }
            } catch (error) {
                console.error('Erro ao processar linha:', error);
                throw error; // Propagar erro para ativar mecanismo de restauração
            }
        });

        // Inserir registros restantes
        if (batch.length > 0) {
            await col.insertMany(batch, { ordered: false });
            totalProcessed += batch.length;
            console.log(`Importação concluída. Total de registros: ${totalProcessed}`);
        }

    } catch (error) {
        console.error('Erro durante a importação:', error);
        throw error;
    } finally {
        if (client) {
            await client.close();
        }
    }
}

// Verificar argumentos da linha de comando
const args = process.argv.slice(2);
if (args.length !== 2) {
    console.log('Uso: ts-node importGbk.ts <caminho-arquivo-gbk> <nome-da-collection>');
    process.exit(1);
}

const gbkPath = args[0];
const collectionName = args[1];

// Executar importação
importGbkToMongo(gbkPath, collectionName)
    .then(() => {
        console.log('Importação finalizada com sucesso!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Erro durante a importação:', error);
        process.exit(1);
    });
