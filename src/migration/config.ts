import dotenv from 'dotenv';
import { Options } from 'node-firebird';
import path from 'path';

dotenv.config();

// Caminho do banco restaurado
const restoredDbPath = path.join(process.cwd(), 'firebird', 'restored', 'millenium.fdb');

export const firebirdConfig: Options = {
    host: process.env.FIREBIRD_HOST || 'localhost',
    port: Number(process.env.FIREBIRD_PORT) || 3050,
    database: restoredDbPath,
    user: process.env.FIREBIRD_USER || 'SYSDBA',
    password: process.env.FIREBIRD_PASSWORD || 'masterkey',
    lowercase_keys: false,
    pageSize: 4096
};

export const mongoConfig = {
    url: process.env.MONGO_URI || 'mongodb://localhost:27017',
    dbName: process.env.MONGO_DB_NAME || 'millenium_db',
    batchSize: Number(process.env.BATCH_SIZE) || 1000
};
