import * as fs from 'fs';
import { EventEmitter } from 'events';
import { MongoClient } from 'mongodb';
import iconv from 'iconv-lite';

class GBKService extends EventEmitter {
    private static instance: GBKService;

    private constructor() {
        super();
    }

    public static getInstance(): GBKService {
        if (!GBKService.instance) {
            GBKService.instance = new GBKService();
        }
        return GBKService.instance;
    }

    public async parseGBKFile(filePath: string): Promise<any[]> {
        try {
            console.log(`Iniciando leitura do arquivo: ${filePath}`);
            const fileStats = await fs.promises.stat(filePath);
            console.log(`Tamanho do arquivo: ${fileStats.size} bytes`);

            // Lê o arquivo em chunks para não sobrecarregar a memória
            const fileStream = fs.createReadStream(filePath);
            const chunks: Buffer[] = [];
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
                        const decodedContent = iconv.decode(buffer, 'utf8');
                        const tables = this.extractTablesFromGBK(decodedContent);
                        console.log(`Parse concluído. ${tables.length} tabelas encontradas.`);
                        resolve(tables);
                    } catch (error) {
                        console.error('Erro durante o parse:', error);
                        reject(error);
                    }
                });

                fileStream.on('error', (error) => {
                    console.error('Erro na leitura do arquivo:', error);
                    reject(error);
                });
            });
        } catch (error) {
            console.error('Erro ao parsear arquivo GBK:', error);
            throw error;
        }
    }

    private extractTablesFromGBK(content: string): any[] {
        try {
            // Implementação básica para extrair dados do arquivo GBK
            const tables: any[] = [];
            
            // Divide o conteúdo em linhas
            const lines = content.split('\n');
            
            let currentTable: any = null;
            
            for (const line of lines) {
                // Remove espaços em branco extras
                const trimmedLine = line.trim();
                
                // Pula linhas vazias
                if (!trimmedLine) continue;
                
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
        } catch (error) {
            console.error('Erro ao extrair tabelas:', error);
            return [];
        }
    }

    private extractTableName(line: string): string {
        // Extrai o nome da tabela da linha CREATE TABLE
        const match = line.match(/CREATE TABLE\s+(\w+)/i);
        return match ? match[1] : 'unknown_table';
    }

    private extractInsertData(line: string): any | null {
        try {
            // Extrai os dados da linha INSERT INTO
            const match = line.match(/INSERT INTO\s+\w+\s+VALUES\s*\((.*)\)/i);
            if (!match) return null;
            
            const values = match[1].split(',').map(value => {
                value = value.trim();
                // Remove aspas se existirem
                if (value.startsWith("'") && value.endsWith("'")) {
                    value = value.slice(1, -1);
                }
                return value;
            });
            
            return values;
        } catch (error) {
            console.error('Erro ao extrair dados do INSERT:', error);
            return null;
        }
    }

    public async exportToMongo(mongoCollection: any, data: any[]): Promise<void> {
        try {
            const total = data.length;
            let processed = 0;

            console.log(`Iniciando exportação de ${total} registros para MongoDB`);

            // Processa em lotes para melhor performance
            const batchSize = 1000;
            for (let i = 0; i < data.length; i += batchSize) {
                const batch = data.slice(i, i + batchSize);
                await mongoCollection.insertMany(batch);
                
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
        } catch (error) {
            console.error('Erro ao exportar para MongoDB:', error);
            throw error;
        }
    }

    public async validateMongoConnection(uri: string, dbName: string): Promise<boolean> {
        try {
            console.log('Testando conexão com MongoDB...');
            const client = await MongoClient.connect(uri);
            const db = client.db(dbName);
            await db.command({ ping: 1 });
            await client.close();
            console.log('Conexão com MongoDB estabelecida com sucesso!');
            return true;
        } catch (error) {
            console.error('Erro ao validar conexão MongoDB:', error);
            return false;
        }
    }
}

export default GBKService;
