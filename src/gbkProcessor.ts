import fs from 'fs';
import iconv from 'iconv-lite';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { Transform } from 'stream';

export class GbkProcessor {
    private filePath: string;
    private encoding: string;
    private backupPath: string;
    private checkpointInterval: number;
    private lastCheckpoint: number;

    constructor(filePath: string, encoding: string = 'win1252') {
        this.filePath = filePath;
        this.encoding = encoding;
        this.backupPath = `${filePath}.backup`;
        this.checkpointInterval = 5000; // Checkpoint a cada 5000 registros
        this.lastCheckpoint = 0;
    }

    public async validateGbkFile(): Promise<boolean> {
        try {
            const stats = await fs.promises.stat(this.filePath);
            if (stats.size === 0) {
                throw new Error('Arquivo GBK vazio');
            }

            // Verificar cabeçalho do arquivo
            const header = await this.readFileHeader();
            if (!this.isValidGbkHeader(header)) {
                throw new Error('Arquivo GBK inválido: cabeçalho incorreto');
            }

            return true;
        } catch (error) {
            console.error('Erro na validação do arquivo GBK:', error);
            return false;
        }
    }

    private async readFileHeader(): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const stream = createReadStream(this.filePath, { start: 0, end: 1023 });
            const chunks: Buffer[] = [];

            stream.on('data', (chunk: Buffer) => chunks.push(chunk));
            stream.on('end', () => resolve(Buffer.concat(chunks)));
            stream.on('error', (err: Error) => reject(err));
        });
    }

    private isValidGbkHeader(header: Buffer): boolean {
        // Por enquanto, vamos apenas verificar se o arquivo tem conteúdo
        return header.length > 0;
    }

    public createDecodingStream(): Transform {
        return new Transform({
            transform(chunk: Buffer, _encoding: string, callback: (error: Error | null, data?: any) => void) {
                try {
                    const decoded = iconv.decode(chunk, 'win1252');
                    callback(null, decoded);
                } catch (error) {
                    callback(error instanceof Error ? error : new Error(String(error)));
                }
            }
        });
    }

    public async createBackup(): Promise<void> {
        try {
            await fs.promises.copyFile(this.filePath, this.backupPath);
            console.log(`Backup criado em: ${this.backupPath}`);
        } catch (error) {
            throw new Error(`Erro ao criar backup: ${error}`);
        }
    }

    public async restoreFromBackup(): Promise<void> {
        try {
            if (await this.hasBackup()) {
                await fs.promises.copyFile(this.backupPath, this.filePath);
                console.log('Arquivo restaurado do backup com sucesso');
            }
        } catch (error) {
            throw new Error(`Erro ao restaurar do backup: ${error}`);
        }
    }

    private async hasBackup(): Promise<boolean> {
        try {
            await fs.promises.access(this.backupPath);
            return true;
        } catch {
            return false;
        }
    }

    public async removeBackup(): Promise<void> {
        try {
            if (await this.hasBackup()) {
                await fs.promises.unlink(this.backupPath);
                console.log('Backup removido com sucesso');
            }
        } catch (error) {
            console.error(`Erro ao remover backup: ${error}`);
        }
    }

    public async createCheckpoint(currentLine: number): Promise<void> {
        if (currentLine - this.lastCheckpoint >= this.checkpointInterval) {
            await fs.promises.writeFile(
                `${this.filePath}.checkpoint`,
                currentLine.toString(),
                'utf8'
            );
            this.lastCheckpoint = currentLine;
            console.log(`Checkpoint criado na linha ${currentLine}`);
        }
    }

    public async getLastCheckpoint(): Promise<number> {
        try {
            const checkpoint = await fs.promises.readFile(
                `${this.filePath}.checkpoint`,
                'utf8'
            );
            return parseInt(checkpoint, 10);
        } catch {
            return 0;
        }
    }

    public async processGbkFile(callback: (line: string) => Promise<void>): Promise<void> {
        try {
            // Criar backup antes de iniciar o processamento
            await this.createBackup();

            const fileStream = createReadStream(this.filePath);
            const decodingStream = this.createDecodingStream();
            const rl = createInterface({
                input: fileStream.pipe(decodingStream),
                crlfDelay: Infinity
            });

            let lineCount = 0;
            const lastCheckpoint = await this.getLastCheckpoint();

            for await (const line of rl) {
                lineCount++;
                
                // Pular linhas já processadas em caso de retomada
                if (lineCount <= lastCheckpoint) {
                    continue;
                }

                await callback(line);
                
                // Criar checkpoint periodicamente
                await this.createCheckpoint(lineCount);

                if (lineCount % 1000 === 0) {
                    console.log(`Processadas ${lineCount} linhas`);
                }
            }

            // Remover backup após processamento bem-sucedido
            await this.removeBackup();
            
        } catch (error) {
            console.error('Erro durante o processamento:', error);
            // Restaurar do backup em caso de erro
            await this.restoreFromBackup();
            throw error;
        }
    }
}
