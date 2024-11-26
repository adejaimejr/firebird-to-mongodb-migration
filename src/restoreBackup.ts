import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

function findMostRecentGbkFile(directory: string): string {
    const files = fs.readdirSync(directory);
    const gbkFiles = files
        .filter(file => file.startsWith('bckfdb-') && file.endsWith('.gbk'))
        .map(file => {
            const match = file.match(/bckfdb-(\d{4})-(\d{2})-(\d{2})-(\d{2})\.(\d{2})/);
            if (!match) return { file, date: new Date(0) };
            const [_, year, month, day, hour, minute] = match;
            return {
                file,
                date: new Date(
                    parseInt(year),
                    parseInt(month) - 1,
                    parseInt(day),
                    parseInt(hour),
                    parseInt(minute)
                )
            };
        })
        .sort((a, b) => b.date.getTime() - a.date.getTime());

    if (gbkFiles.length === 0) {
        throw new Error('Nenhum arquivo GBK encontrado no diretório!');
    }

    return gbkFiles[0].file;
}

async function restoreBackup(gbkPath: string, databaseName: string): Promise<void> {
    try {
        console.log('Iniciando restauração do backup...');
        console.log(`Arquivo GBK: ${gbkPath}`);
        console.log(`Database: ${databaseName}`);

        // Verificar se o arquivo existe
        if (!fs.existsSync(gbkPath)) {
            throw new Error(`Arquivo não encontrado: ${gbkPath}`);
        }

        // Verificar variáveis de ambiente
        if (!process.env.FIREBIRD_PATH) {
            throw new Error('Variável de ambiente FIREBIRD_PATH é obrigatória');
        }

        const gbrestorePath = path.join(process.env.FIREBIRD_PATH, 'gbak.exe');
        if (!fs.existsSync(gbrestorePath)) {
            throw new Error(`Executável gbak não encontrado em: ${gbrestorePath}`);
        }

        // Construir o comando de restauração
        const databasePath = path.join(process.env.FIREBIRD_DB_PATH || '', `${databaseName}.FDB`);
        const command = `"${gbrestorePath}" -c -v -user SYSDBA -password masterkey "${gbkPath}" "${databasePath}"`;

        console.log('Executando comando de restauração...');
        console.log(`Comando: ${command}`);

        // Executar o comando
        const childProcess = exec(command);

        // Capturar saída do processo
        childProcess.stdout?.on('data', (data) => {
            console.log(`stdout: ${data}`);
        });

        childProcess.stderr?.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });

        // Aguardar conclusão do processo
        await new Promise<void>((resolve, reject) => {
            childProcess.on('close', (code) => {
                if (code === 0) {
                    console.log('Restauração concluída com sucesso!');
                    resolve();
                } else {
                    reject(new Error(`Processo falhou com código: ${code}`));
                }
            });

            childProcess.on('error', (error) => {
                reject(error);
            });
        });

    } catch (error) {
        console.error('Erro durante a restauração:', error);
        throw error;
    }
}

// Verificar argumentos da linha de comando
const args = process.argv.slice(2);
if (args.length !== 1) {
    console.log('Uso: ts-node restoreBackup.ts <nome-do-banco>');
    process.exit(1);
}

const databaseName = args[0];
const gbkDirectory = path.join(process.cwd(), 'gbk');
const mostRecentFile = findMostRecentGbkFile(gbkDirectory);
const gbkPath = path.join(gbkDirectory, mostRecentFile);

// Executar a restauração
restoreBackup(gbkPath, databaseName)
    .then(() => {
        console.log('Processo finalizado com sucesso.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Falha no processo:', error);
        process.exit(1);
    });
