import * as firebird from 'node-firebird';
import { MongoClient } from 'mongodb';
import { firebirdConfig, mongoConfig } from './config';

// Função para sanitizar strings
function sanitizeString(str: any): any {
    if (str === null || str === undefined) return null;
    if (typeof str !== 'string') return str;

    return str
        .normalize('NFD') // Decompõe os caracteres em seus componentes
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[^\x20-\x7E]/g, '') // Remove caracteres não-ASCII
        .replace(/�/g, '') // Remove caracteres inválidos específicos
        .trim(); // Remove espaços extras
}

// Função para sanitizar objeto completo
function sanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== 'object') return sanitizeString(obj);

    const newObj: any = {};
    for (const key in obj) {
        if (obj[key] instanceof Date) {
            newObj[key.trim()] = obj[key];
        } else if (Buffer.isBuffer(obj[key])) {
            newObj[key.trim()] = obj[key].toString('base64');
        } else if (typeof obj[key] === 'object') {
            newObj[key.trim()] = sanitizeObject(obj[key]);
        } else {
            newObj[key.trim()] = sanitizeString(obj[key]);
        }
    }
    return newObj;
}

async function getTables(): Promise<string[]> {
    return new Promise((resolve, reject) => {
        firebird.attach(firebirdConfig, (err, db) => {
            if (err) {
                reject(err);
                return;
            }

            const query = `
                SELECT RDB$RELATION_NAME
                FROM RDB$RELATIONS
                WHERE RDB$SYSTEM_FLAG = 0
                AND RDB$RELATION_TYPE = 0
                ORDER BY RDB$RELATION_NAME
            `;

            db.query(query, [], (err, result) => {
                if (err) {
                    reject(err);
                    return;
                }

                const tables = result.map(row => row.RDB$RELATION_NAME.trim());
                db.detach();
                resolve(tables);
            });
        });
    });
}

async function getTableCount(db: any, tableName: string): Promise<number> {
    return new Promise((resolve, reject) => {
        // Usando sintaxe correta para Firebird 3.0
        const countQuery = `SELECT COUNT(1) as TOTAL FROM ${tableName}`;
        db.query(countQuery, [], (err: any, result: any[]) => {
            if (err) reject(err);
            else resolve(result[0].TOTAL || 0);
        });
    });
}

async function migrateTableBatch(db: any, tableName: string, offset: number, batchSize: number, mongoCollection: any): Promise<number> {
    return new Promise((resolve, reject) => {
        const query = `SELECT FIRST ${batchSize} SKIP ${offset} * FROM ${tableName}`;
        
        db.query(query, [], async (err: any, result: any[]) => {
            if (err) {
                reject(err);
                return;
            }

            if (result.length === 0) {
                resolve(0);
                return;
            }

            try {
                // Sanitiza os dados
                const sanitizedData = result.map(row => sanitizeObject(row));

                // Divide em lotes menores se necessário
                const maxBatchSize = 1000;
                for (let i = 0; i < sanitizedData.length; i += maxBatchSize) {
                    const batch = sanitizedData.slice(i, i + maxBatchSize);
                    await mongoCollection.insertMany(batch, { ordered: false });
                }

                resolve(result.length);
            } catch (error) {
                reject(error);
            }
        });
    });
}

async function migrateTable(tableName: string, mongoDb: any): Promise<void> {
    return new Promise((resolve, reject) => {
        firebird.attach(firebirdConfig, async (err, db) => {
            if (err) {
                reject(err);
                return;
            }

            try {
                console.log(`\nIniciando migração da tabela ${tableName}`);
                const collection = mongoDb.collection(tableName.toLowerCase());
                
                // Limpa a collection antes de inserir
                console.log(`Limpando collection ${tableName.toLowerCase()}`);
                await collection.deleteMany({});

                // Obtém o total de registros
                const total = await getTableCount(db, tableName);
                console.log(`Total de registros: ${total}`);

                // Define o tamanho do lote baseado na tabela
                // Tabelas conhecidas por terem registros grandes usam lotes menores
                let batchSize = 25000;
                const largeTables = ['MOV_ESTOQUE', 'PRODUTOS', 'CLIENTES'];
                if (largeTables.includes(tableName)) {
                    batchSize = 1000; // Lote menor para tabelas grandes
                }

                let processedCount = 0;
                while (processedCount < total) {
                    try {
                        const count = await migrateTableBatch(db, tableName, processedCount, batchSize, collection);
                        processedCount += count;
                        
                        // Mostra progresso
                        if (total > 0) {
                            const progress = Math.round((processedCount / total) * 100);
                            console.log(`Progresso: ${progress}% (${processedCount}/${total})`);
                        }
                    } catch (batchError: any) {
                        // Se der erro por tamanho, reduz o lote pela metade e tenta novamente
                        if (batchError.code === 10334) { // BSONObjectTooLarge
                            batchSize = Math.max(100, Math.floor(batchSize / 2));
                            console.log(`Reduzindo tamanho do lote para ${batchSize} e tentando novamente...`);
                            continue;
                        }
                        throw batchError;
                    }
                }

                console.log(`✅ Tabela ${tableName} migrada com sucesso`);
                db.detach();
                resolve();
            } catch (error) {
                console.error(`Erro ao migrar tabela ${tableName}:`, error);
                db.detach();
                reject(error);
            }
        });
    });
}

async function main() {
    try {
        console.log('Iniciando processo de migração...');
        console.log(`Usando tamanho de lote: ${mongoConfig.batchSize}`);
        
        // Conectar ao MongoDB
        const mongoClient = await MongoClient.connect(mongoConfig.url);
        const mongoDb = mongoClient.db(mongoConfig.dbName);
        
        // Pegar lista de tabelas
        const tables = await getTables();
        console.log(`\nEncontradas ${tables.length} tabelas para migrar`);
        
        // Migrar cada tabela
        for (const table of tables) {
            try {
                await migrateTable(table, mongoDb);
                console.log(`✅ Tabela ${table} migrada com sucesso`);
            } catch (error) {
                console.error(`❌ Erro ao migrar tabela ${table}:`, error);
                // Continua para a próxima tabela mesmo se houver erro
            }
        }
        
        await mongoClient.close();
        console.log('\nMigração concluída!');
        
    } catch (error) {
        console.error('Erro durante a migração:', error);
        process.exit(1);
    }
}

main();
