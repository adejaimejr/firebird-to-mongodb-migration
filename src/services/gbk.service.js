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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const events_1 = require("events");
const mongodb_1 = require("mongodb");
const iconv_lite_1 = __importDefault(require("iconv-lite"));
class GBKService extends events_1.EventEmitter {
    constructor() {
        super();
    }
    static getInstance() {
        if (!GBKService.instance) {
            GBKService.instance = new GBKService();
        }
        return GBKService.instance;
    }
    parseGBKFile(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(`Iniciando leitura do arquivo: ${filePath}`);
                const fileStats = yield fs.promises.stat(filePath);
                console.log(`Tamanho do arquivo: ${fileStats.size} bytes`);
                // Lê o arquivo em chunks para não sobrecarregar a memória
                const fileStream = fs.createReadStream(filePath);
                const chunks = [];
                let totalBytesRead = 0;
                return new Promise((resolve, reject) => {
                    fileStream.on('data', (chunk) => {
                        chunks.push(Buffer.from(chunk));
                        totalBytesRead += chunk.length;
                        // Emite evento de progresso
                        this.emit('progress', {
                            type: 'reading',
                            bytesRead: totalBytesRead,
                            totalBytes: fileStats.size,
                            percentage: ((totalBytesRead / fileStats.size) * 100).toFixed(2)
                        });
                    });
                    fileStream.on('end', () => {
                        try {
                            console.log('Arquivo lido completamente. Iniciando parse...');
                            const buffer = Buffer.concat(chunks);
                            const decodedContent = iconv_lite_1.default.decode(buffer, 'utf8');
                            const tables = this.extractTablesFromGBK(decodedContent);
                            console.log(`Parse concluído. ${tables.length} tabelas encontradas.`);
                            resolve(tables);
                        }
                        catch (error) {
                            console.error('Erro durante o parse:', error);
                            reject(error);
                        }
                    });
                    fileStream.on('error', (error) => {
                        console.error('Erro na leitura do arquivo:', error);
                        reject(error);
                    });
                });
            }
            catch (error) {
                console.error('Erro ao parsear arquivo GBK:', error);
                throw error;
            }
        });
    }
    extractTablesFromGBK(content) {
        try {
            // Implementação básica para extrair dados do arquivo GBK
            const tables = [];
            // Divide o conteúdo em linhas
            const lines = content.split('\n');
            let currentTable = null;
            for (const line of lines) {
                // Remove espaços em branco extras
                const trimmedLine = line.trim();
                // Pula linhas vazias
                if (!trimmedLine)
                    continue;
                // Verifica se é início de uma nova tabela
                if (trimmedLine.startsWith('CREATE TABLE')) {
                    if (currentTable) {
                        tables.push(currentTable);
                    }
                    const tableName = this.extractTableName(trimmedLine);
                    currentTable = {
                        name: tableName,
                        fields: [],
                        data: []
                    };
                }
                // Verifica se é uma linha de dados
                else if (trimmedLine.startsWith('INSERT INTO')) {
                    if (currentTable) {
                        const data = this.extractInsertData(trimmedLine);
                        if (data) {
                            currentTable.data.push(data);
                        }
                    }
                }
            }
            // Adiciona a última tabela se existir
            if (currentTable) {
                tables.push(currentTable);
            }
            return tables;
        }
        catch (error) {
            console.error('Erro ao extrair tabelas:', error);
            return [];
        }
    }
    extractTableName(line) {
        // Extrai o nome da tabela da linha CREATE TABLE
        const match = line.match(/CREATE TABLE\s+(\w+)/i);
        return match ? match[1] : 'unknown_table';
    }
    extractInsertData(line) {
        try {
            // Extrai os dados da linha INSERT INTO
            const match = line.match(/INSERT INTO\s+\w+\s+VALUES\s*\((.*)\)/i);
            if (!match)
                return null;
            const values = match[1].split(',').map(value => {
                value = value.trim();
                // Remove aspas se existirem
                if (value.startsWith("'") && value.endsWith("'")) {
                    value = value.slice(1, -1);
                }
                return value;
            });
            return values;
        }
        catch (error) {
            console.error('Erro ao extrair dados do INSERT:', error);
            return null;
        }
    }
    exportToMongo(mongoCollection, data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const total = data.length;
                let processed = 0;
                console.log(`Iniciando exportação de ${total} registros para MongoDB`);
                // Processa em lotes para melhor performance
                const batchSize = 1000;
                for (let i = 0; i < data.length; i += batchSize) {
                    const batch = data.slice(i, i + batchSize);
                    yield mongoCollection.insertMany(batch);
                    processed += batch.length;
                    this.emit('progress', {
                        type: 'inserting',
                        processed,
                        total,
                        percentage: ((processed / total) * 100).toFixed(2)
                    });
                    console.log(`Progresso: ${processed}/${total} registros`);
                }
                console.log('Exportação concluída com sucesso!');
            }
            catch (error) {
                console.error('Erro ao exportar para MongoDB:', error);
                throw error;
            }
        });
    }
    validateMongoConnection(uri, dbName) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log('Testando conexão com MongoDB...');
                const client = yield mongodb_1.MongoClient.connect(uri);
                const db = client.db(dbName);
                yield db.command({ ping: 1 });
                yield client.close();
                console.log('Conexão com MongoDB estabelecida com sucesso!');
                return true;
            }
            catch (error) {
                console.error('Erro ao validar conexão MongoDB:', error);
                return false;
            }
        });
    }
}
exports.default = GBKService;
