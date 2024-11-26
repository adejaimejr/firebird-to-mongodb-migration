import * as Firebird from 'node-firebird';
import { firebirdConfig } from '../config/firebird.config';

class FirebirdService {
    private static instance: FirebirdService;
    private pool: any;

    private constructor() {
        console.log('Configuração Firebird:', {
            ...firebirdConfig,
            password: '****' // ocultando senha no log
        });
        this.pool = Firebird.pool(5, firebirdConfig);
    }

    public static getInstance(): FirebirdService {
        if (!FirebirdService.instance) {
            FirebirdService.instance = new FirebirdService();
        }
        return FirebirdService.instance;
    }

    public async query(sql: string, params: any[] = []): Promise<any> {
        return new Promise((resolve, reject) => {
            this.pool.get((err: any, db: any) => {
                if (err) {
                    console.error('Erro ao obter conexão do pool:', err);
                    reject(err);
                    return;
                }

                console.log('Executando query:', sql);
                db.query(sql, params, (err: any, result: any) => {
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
    }

    public async testConnection(): Promise<boolean> {
        try {
            console.log('Testando conexão com Firebird...');
            await this.query('SELECT 1 FROM RDB$DATABASE');
            console.log('Conexão com Firebird estabelecida com sucesso!');
            return true;
        } catch (error) {
            console.error('Erro detalhado ao conectar com Firebird:', error);
            return false;
        }
    }

    public async listTables(): Promise<string[]> {
        const sql = `
            SELECT DISTINCT rdb$relation_name
            FROM rdb$relations
            WHERE rdb$view_blr IS NULL
            AND rdb$system_flag = 0
            ORDER BY rdb$relation_name
        `;
        
        try {
            console.log('Listando tabelas do Firebird...');
            const tables = await this.query(sql);
            console.log('Tabelas encontradas:', tables);
            return tables.map((table: any) => table.RDB$RELATION_NAME.trim());
        } catch (error) {
            console.error('Erro detalhado ao listar tabelas:', error);
            throw error;
        }
    }
}

export default FirebirdService;
