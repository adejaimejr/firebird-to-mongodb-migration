"use strict";
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
const express_1 = __importDefault(require("express"));
const mongodb_1 = require("mongodb");
const gbk_service_1 = __importDefault(require("../services/gbk.service"));
const fs_1 = __importDefault(require("fs"));
const router = express_1.default.Router();
const gbkService = gbk_service_1.default.getInstance();
router.post('/import', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { gbkPath, mongoCollection } = req.body;
        if (!gbkPath || !mongoCollection) {
            return res.status(400).json({
                status: 'error',
                message: 'gbkPath e mongoCollection são obrigatórios'
            });
        }
        if (!fs_1.default.existsSync(gbkPath)) {
            return res.status(400).json({
                status: 'error',
                message: 'Arquivo GBK não encontrado'
            });
        }
        const mongoValid = yield gbkService.validateMongoConnection(process.env.MONGO_URI, process.env.MONGO_DB_NAME);
        if (!mongoValid) {
            return res.status(500).json({
                status: 'error',
                message: 'Não foi possível conectar ao MongoDB'
            });
        }
        console.log('Iniciando parse do arquivo GBK...');
        const data = yield gbkService.parseGBKFile(gbkPath);
        console.log('Conectando ao MongoDB...');
        const client = yield mongodb_1.MongoClient.connect(process.env.MONGO_URI);
        const db = client.db(process.env.MONGO_DB_NAME);
        const collection = db.collection(mongoCollection);
        console.log('Exportando dados para MongoDB...');
        yield gbkService.exportToMongo(collection, data);
        yield client.close();
        return res.json({
            status: 'success',
            message: 'Dados importados com sucesso',
            recordCount: data.length
        });
    }
    catch (error) {
        console.error('Erro na rota de importação:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Erro ao importar dados',
            error: error.message
        });
    }
}));
router.get('/progress', (req, res) => {
    try {
        const progress = {
            status: 'running',
            details: {}
        };
        gbkService.on('progress', (data) => {
            progress.details = data;
        });
        return res.json(progress);
    }
    catch (error) {
        console.error('Erro na rota de progresso:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Erro ao obter progresso',
            error: error.message
        });
    }
});
exports.default = router;
