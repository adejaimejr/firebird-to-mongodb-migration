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
const express_1 = require("express");
const firebird_service_1 = __importDefault(require("../services/firebird.service"));
const router = (0, express_1.Router)();
const firebirdService = firebird_service_1.default.getInstance();
// Rota para testar a conexão
router.get('/test', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const isConnected = yield firebirdService.testConnection();
        if (isConnected) {
            res.json({ status: 'success', message: 'Conexão com Firebird estabelecida com sucesso!' });
        }
        else {
            res.status(500).json({ status: 'error', message: 'Falha ao conectar com Firebird' });
        }
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: 'Erro ao testar conexão', error });
    }
}));
// Rota para listar todas as tabelas
router.get('/tables', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const tables = yield firebirdService.listTables();
        res.json({ status: 'success', tables });
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: 'Erro ao listar tabelas', error });
    }
}));
exports.default = router;
