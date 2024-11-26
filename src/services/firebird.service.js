"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const Firebird = __importStar(require("node-firebird"));
const firebird_config_1 = require("../config/firebird.config");
class FirebirdService {
    constructor() {
        console.log('Configuração Firebird:', Object.assign(Object.assign({}, firebird_config_1.firebirdConfig), { password: '****' // ocultando senha no log
         }));
        this.pool = Firebird.pool(5, firebird_config_1.firebirdConfig);
    }
    static getInstance() {
        if (!FirebirdService.instance) {
            FirebirdService.instance = new FirebirdService();
        }
        return FirebirdService.instance;
    }
    query(sql_1) {
        return __awaiter(this, arguments, void 0, function* (sql, params = []) {
            return new Promise((resolve, reject) => {
                this.pool.get((err, db) => {
                    if (err) {
                        console.error('Erro ao obter conexão do pool:', err);
                        reject(err);
                        return;
                    }
                    console.log('Executando query:', sql);
                    db.query(sql, params, (err, result) => {
                        db.detach();
                        if (err) {
                            console.error('Erro na execução da query:', err);
                            reject(err);
                            return;
                        }
                        resolve(result);
                    });
                });
            });
        });
    }
    testConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log('Testando conexão com Firebird...');
                yield this.query('SELECT 1 FROM RDB$DATABASE');
                console.log('Conexão com Firebird estabelecida com sucesso!');
                return true;
            }
            catch (error) {
                console.error('Erro detalhado ao conectar com Firebird:', error);
                return false;
            }
        });
    }
    listTables() {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
            SELECT DISTINCT rdb$relation_name
            FROM rdb$relations
            WHERE rdb$view_blr IS NULL
            AND rdb$system_flag = 0
            ORDER BY rdb$relation_name
        `;
            try {
                console.log('Listando tabelas do Firebird...');
                const tables = yield this.query(sql);
                console.log('Tabelas encontradas:', tables);
                return tables.map((table) => table.RDB$RELATION_NAME.trim());
            }
            catch (error) {
                console.error('Erro detalhado ao listar tabelas:', error);
                throw error;
            }
        });
    }
}
exports.default = FirebirdService;
