import { Options } from 'node-firebird';
import dotenv from 'dotenv';

dotenv.config();

export const firebirdConfig: Options = {
    host: process.env.FIREBIRD_HOST || 'localhost',
    port: Number(process.env.FIREBIRD_PORT) || 3050,
    database: process.env.FIREBIRD_DATABASE || '',
    user: process.env.FIREBIRD_USER || 'SYSDBA',
    password: process.env.FIREBIRD_PASSWORD || 'masterkey',
    lowercase_keys: false,
    role: process.env.FIREBIRD_ROLE || null,
    pageSize: 4096
};
