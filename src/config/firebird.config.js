"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.firebirdConfig = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.firebirdConfig = {
    host: process.env.FIREBIRD_HOST || 'localhost',
    port: Number(process.env.FIREBIRD_PORT) || 3050,
    database: process.env.FIREBIRD_DATABASE || '',
    user: process.env.FIREBIRD_USER || 'SYSDBA',
    password: process.env.FIREBIRD_PASSWORD || 'masterkey',
    lowercase_keys: false,
    role: process.env.FIREBIRD_ROLE || undefined,
    pageSize: 4096
};
