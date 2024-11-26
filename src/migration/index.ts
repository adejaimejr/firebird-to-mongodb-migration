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
        // Ajustando sintaxe para Firebird 3.0
        const query = `SELECT FIRST ${batchSize} SKIP ${offset * batchSize} * FROM ${tableName}`;
        db.query(query, [], async (err: any, result: any[]) => {
            if (err) {
                reject(err);
                return;
            }

            if (result && result.length > 0) {
                try {
                    // Sanitiza todos os objetos antes de inserir
                    const transformedData = result.map(row => sanitizeObject(row));

                    await mongoCollection.insertMany(transformedData, { ordered: false });
                    resolve(result.length);
                } catch (error) {
                    console.error(`Erro ao inserir dados no MongoDB para tabela ${tableName}:`, error);
                    reject(error);
                }
            } else {
                resolve(0);
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
                
                // Limpar collection existente se necessário
                if (process.env.CLEAR_COLLECTIONS === 'true') {
                    console.log(`Limpando collection ${tableName.toLowerCase()}`);
                    await collection.deleteMany({});
                }

                const totalRecords = await getTableCount(db, tableName);
                console.log(`Total de registros: ${totalRecords}`);

                let migratedRecords = 0;
                let offset = 0;
                const batchSize = mongoConfig.batchSize;

                while (migratedRecords < totalRecords) {
                    try {
                        const recordsInBatch = await migrateTableBatch(db, tableName, offset, batchSize, collection);
                        if (recordsInBatch === 0) break;

                        migratedRecords += recordsInBatch;
                        offset++;

                        // Mostrar progresso
                        const progress = ((migratedRecords / totalRecords) * 100).toFixed(2);
                        console.log(`Progresso: ${progress}% (${migratedRecords}/${totalRecords})`);
                    } catch (batchError) {
                        console.error(`Erro no lote ${offset} da tabela ${tableName}:`, batchError);
                        // Continua para o próximo lote mesmo se houver erro
                        offset++;
                    }
                }

                db.detach();
                resolve();
            } catch (error) {
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
