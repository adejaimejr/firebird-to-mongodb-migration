import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';

const execAsync = promisify(exec);
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

async function restoreFirebirdBackup(gbkPath: string): Promise<void> {
    console.log('Restaurando backup do Firebird...');
    
    // Configurações do Firebird local
    const possibleGbakPaths = [
        'C:\\Program Files\\Firebird\\Firebird_4_0\\gbak.exe',
        'C:\\Program Files\\Firebird\\Firebird_3_0\\gbak.exe',
        'C:\\Program Files (x86)\\Firebird\\Firebird_4_0\\gbak.exe',
        'C:\\Program Files (x86)\\Firebird\\Firebird_3_0\\gbak.exe'
    ];

    let gbakPathLocal = '';
    for (const path of possibleGbakPaths) {
        if (fs.existsSync(path)) {
            gbakPathLocal = path;
            break;
        }
    }

    if (!gbakPathLocal) {
        throw new Error('gbak.exe não encontrado! Por favor, verifique a instalação do Firebird.');
    }

    // Criar diretório firebird se não existir
    const firebirdDir = path.join(process.cwd(), 'firebird');
    if (!fs.existsSync(firebirdDir)) {
        fs.mkdirSync(firebirdDir);
        console.log('Diretório firebird criado.');
    }

    // Caminho do banco usando alias
    const dbPath = process.env.FIREBIRD_DATABASE || 'millenium_teste';

    // Comando para restaurar o backup
    const command = `"${gbakPathLocal}" -r "${gbkPath}" "${dbPath}" -user ${process.env.FIREBIRD_USER} -pas ${process.env.FIREBIRD_PASSWORD} -v -rep`;
    
    try {
        console.log('Iniciando restauração do backup...');
        console.log(`Arquivo GBK: ${gbkPath}`);
        console.log(`Database: ${dbPath}`);
        console.log(`Comando: ${command}`);
        
        // Aumentando o maxBuffer para 100MB
        const { stdout, stderr } = await execAsync(command, { maxBuffer: 100 * 1024 * 1024 });
        
        if (stdout) console.log('Saída do gbak:', stdout);
        if (stderr) console.error('Erros do gbak:', stderr);
        
        console.log('Backup restaurado com sucesso!');
    } catch (error) {
        console.error('Erro ao restaurar backup:', error);
        throw error;
    }
}

// Executar o script
async function main() {
    try {
        const gbkDirectory = path.join(process.cwd(), 'gbk');
        const mostRecentFile = findMostRecentGbkFile(gbkDirectory);
        const gbkPath = path.join(gbkDirectory, mostRecentFile);
        
        console.log(`Arquivo GBK mais recente encontrado: ${mostRecentFile}`);
        await restoreFirebirdBackup(gbkPath);
        
        console.log('Processo finalizado com sucesso!');
    } catch (error) {
        console.error('Erro:', error instanceof Error ? error.message : 'Erro desconhecido');
        process.exit(1);
    }
}

main();
