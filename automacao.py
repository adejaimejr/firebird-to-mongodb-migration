import os
import sys
import glob
import subprocess
import logging
import time
import threading
from datetime import datetime
from pathlib import Path
from prepare_backup import prepare_backup

# Nome do arquivo de log
LOG_FILE = 'automacao.log'

# Limpa o arquivo de log se ele existir
if os.path.exists(LOG_FILE):
    open(LOG_FILE, 'w').close()

# Configuração de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE, encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Registra o início da execução com uma linha separadora
logger.info("="*80)
logger.info(f"Iniciando nova execução em {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
logger.info("="*80)

def read_output(pipe, log_func):
    """Função para ler a saída em uma thread separada"""
    for line in iter(pipe.readline, ''):
        log_func(line.strip())
    pipe.close()

class FirebirdMigration:
    def __init__(self):
        self.gbk_dir = os.path.join(os.getcwd(), 'gbk')
        self.database_dir = os.path.join(os.getcwd(), 'firebird', 'restored')
        self.gbak_path = r'C:\Program Files\Firebird\Firebird_3_0\gbak.exe'
        self.gfix_path = r'C:\Program Files\Firebird\Firebird_3_0\gfix.exe'
        self.db_path = os.path.join(self.database_dir, 'millenium.fdb')
        self.user = 'sysdba'
        self.password = 'masterkey'
        self.last_processed_file = os.path.join(os.getcwd(), 'last_processed.txt')

    def get_last_processed_gbk(self):
        """Lê o último arquivo GBK processado"""
        try:
            if os.path.exists(self.last_processed_file):
                with open(self.last_processed_file, 'r') as f:
                    # Lê todas as linhas e remove espaços em branco
                    return [line.strip() for line in f.readlines() if line.strip()]
            return []
        except Exception as e:
            logger.warning(f"Erro ao ler arquivo de controle: {str(e)}")
            return []

    def was_file_processed(self, filename):
        """Verifica se um arquivo já foi processado anteriormente"""
        processed_files = self.get_last_processed_gbk()
        return filename in processed_files

    def save_last_processed_gbk(self, gbk_file):
        """Salva o nome do último arquivo GBK processado"""
        try:
            with open(self.last_processed_file, 'a') as f:
                f.write(os.path.basename(gbk_file) + '\n')
            logger.info(f"Arquivo de controle atualizado: {os.path.basename(gbk_file)}")
        except Exception as e:
            logger.error(f"Erro ao salvar arquivo de controle: {str(e)}")
            raise

    def get_latest_gbk(self):
        """Encontra o arquivo GBK mais recente que ainda não foi processado"""
        try:
            # Lê o último arquivo processado
            last_processed = self.get_last_processed_gbk()
            
            # Lista todos os arquivos GBK
            gbk_files = glob.glob(os.path.join(self.gbk_dir, '*.gbk'))
            if not gbk_files:
                raise FileNotFoundError("Nenhum arquivo GBK encontrado!")
            
            # Ordena por data de modificação
            gbk_files.sort(key=os.path.getmtime, reverse=True)
            
            # Se não houver arquivo processado anteriormente, retorna o mais recente
            if not last_processed:
                latest_gbk = gbk_files[0]
                logger.info(f"Nenhum arquivo processado anteriormente. Usando o mais recente: {latest_gbk}")
                return latest_gbk
            
            # Procura por arquivos mais recentes que o último processado
            for gbk_file in gbk_files:
                if os.path.basename(gbk_file) not in last_processed:
                    logger.info(f"Arquivo GBK mais recente encontrado: {gbk_file}")
                    return gbk_file
            
            logger.info("Nenhum arquivo novo para processar")
            return None
            
        except Exception as e:
            logger.error(f"Erro ao procurar arquivo GBK: {str(e)}")
            raise

    def disconnect_all_users(self):
        """Tenta desconectar todos os usuários do banco"""
        try:
            logger.info("Tentando desconectar usuários do banco...")
            cmd = [
                self.gfix_path,
                '-shut', 'full',
                '-force', '0',
                f'-user', self.user,
                f'-pass', self.password,
                self.db_path
            ]
            
            process = subprocess.run(
                cmd,
                capture_output=True,
                text=True
            )
            
            # Aguarda um pouco para as conexões serem fechadas
            time.sleep(2)
            
            # Retorna o banco ao modo normal
            cmd = [
                self.gfix_path,
                '-online',
                f'-user', self.user,
                f'-pass', self.password,
                self.db_path
            ]
            
            subprocess.run(cmd, capture_output=True, text=True)
            
        except Exception as e:
            logger.warning(f"Aviso ao tentar desconectar usuários: {str(e)}")

    def remove_existing_db(self):
        """Remove o banco de dados existente se houver"""
        if os.path.exists(self.db_path):
            max_attempts = 3
            for attempt in range(max_attempts):
                try:
                    # Tenta desconectar usuários primeiro
                    self.disconnect_all_users()
                    
                    # Tenta remover o arquivo
                    os.remove(self.db_path)
                    logger.info(f"Banco de dados existente removido: {self.db_path}")
                    break
                except Exception as e:
                    if attempt == max_attempts - 1:
                        logger.error(f"Erro ao remover banco existente após {max_attempts} tentativas: {str(e)}")
                        raise
                    else:
                        logger.warning(f"Tentativa {attempt + 1} falhou, tentando novamente em 2 segundos...")
                        time.sleep(2)

    def restore_database(self, gbk_file):
        """Restaura o banco de dados usando gbak"""
        try:
            # Certifica que o diretório do banco existe
            os.makedirs(self.database_dir, exist_ok=True)

            # Comando para restaurar o banco
            cmd = [
                self.gbak_path,
                '-r',
                gbk_file,
                self.db_path,
                '-user', self.user,
                '-pas', self.password,
                '-v',
                '-rep'
            ]

            logger.info("Iniciando restauração do banco...")
            logger.info(f"Comando: {' '.join(cmd)}")
            
            # Executa o comando
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding='latin1',
                bufsize=1
            )

            # Cria threads para ler stdout e stderr
            stdout_thread = threading.Thread(target=read_output, args=(process.stdout, logger.info))
            stderr_thread = threading.Thread(target=read_output, args=(process.stderr, logger.error))
            
            # Inicia as threads
            stdout_thread.start()
            stderr_thread.start()
            
            # Aguarda o processo terminar
            returncode = process.wait()
            
            # Aguarda as threads terminarem
            stdout_thread.join()
            stderr_thread.join()

            if returncode != 0:
                raise Exception(f"Erro na restauração. Código de retorno: {returncode}")

            logger.info("Restauração concluída com sucesso!")
            
            # Verifica se o arquivo foi criado e tem conteúdo
            if not os.path.exists(self.db_path):
                raise Exception("Arquivo do banco não foi criado")
            
            size = os.path.getsize(self.db_path)
            logger.info(f"Tamanho do banco restaurado: {size/1024/1024:.2f} MB")
            
            if size == 0:
                raise Exception("Banco de dados foi criado mas está vazio")

        except Exception as e:
            logger.error(f"Erro durante a restauração: {str(e)}")
            raise

    def check_nodejs(self):
        """Verifica se o Node.js está instalado e instala as dependências"""
        try:
            # Verifica versão do Node.js e pega o caminho
            process = subprocess.run(['where', 'node'], capture_output=True, text=True)
            if process.returncode != 0:
                raise Exception("Node.js não está instalado")
            
            # Pega o primeiro caminho retornado (pode haver vários)
            node_path = process.stdout.strip().split('\n')[0]
            node_dir = os.path.dirname(node_path)
            npm_path = os.path.join(node_dir, 'npm.cmd')  # No Windows é npm.cmd
            
            # Verifica versão do Node
            process = subprocess.run([node_path, '--version'], capture_output=True, text=True)
            node_version = process.stdout.strip()
            logger.info(f"Node.js versão {node_version} encontrado em {node_path}")
            
            # Verifica versão do npm
            process = subprocess.run([npm_path, '--version'], capture_output=True, text=True)
            if process.returncode != 0:
                raise Exception(f"npm não encontrado em {npm_path}")
            
            npm_version = process.stdout.strip()
            logger.info(f"npm versão {npm_version} encontrado em {npm_path}")
            
            # Instala as dependências
            logger.info("Instalando dependências do projeto...")
            process = subprocess.run([npm_path, 'install'], capture_output=True, text=True)
            if process.returncode != 0:
                raise Exception(f"Erro ao instalar dependências: {process.stderr}")
            
            logger.info("Dependências instaladas com sucesso")
            
            return npm_path  # Retorna o caminho do npm para uso posterior
            
        except Exception as e:
            logger.error(f"Erro ao verificar Node.js: {str(e)}")
            raise

    def run_migration(self):
        """Executa o comando npm run migrate"""
        try:
            # Verifica Node.js e instala dependências
            npm_path = self.check_nodejs()
            
            logger.info("Iniciando migração...")
            
            # Executa npm run migrate usando o caminho completo do npm
            process = subprocess.Popen(
                [npm_path, 'run', 'migrate'],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding='utf-8',
                bufsize=1
            )

            # Cria threads para ler stdout e stderr
            stdout_thread = threading.Thread(target=read_output, args=(process.stdout, logger.info))
            stderr_thread = threading.Thread(target=read_output, args=(process.stderr, logger.error))
            
            # Inicia as threads
            stdout_thread.start()
            stderr_thread.start()
            
            # Aguarda o processo terminar
            returncode = process.wait()
            
            # Aguarda as threads terminarem
            stdout_thread.join()
            stderr_thread.join()

            if returncode != 0:
                raise Exception(f"Erro na migração. Código de retorno: {returncode}")

            logger.info("Migração concluída com sucesso!")

        except Exception as e:
            logger.error(f"Erro durante a migração: {str(e)}")
            raise

    def run(self):
        """Executa todo o processo"""
        try:
            logger.info("Iniciando processo de automação...")
            
            # Encontra o GBK mais recente
            latest_gbk = self.get_latest_gbk()
            if latest_gbk is None:
                return True
                
            # Verifica se já foi processado
            gbk_filename = os.path.basename(latest_gbk)
            if self.was_file_processed(gbk_filename):
                return True
            
            # Registra o arquivo que será processado
            logger.info(f"Arquivo GBK mais recente encontrado: {latest_gbk}")
            
            # Tenta preparar novo backup se necessário
            if not prepare_backup():
                logger.error("Falha na preparação do backup. Abortando processo.")
                return False
            
            # Verifica novamente se o arquivo não foi processado durante a preparação
            if self.was_file_processed(gbk_filename):
                logger.info(f"Arquivo {gbk_filename} foi processado durante a preparação. Abortando.")
                return True
            
            # Remove banco existente
            self.remove_existing_db()
            
            # Restaura o banco
            self.restore_database(latest_gbk)
            
            # Executa a migração
            self.run_migration()
            
            # Salva o arquivo processado
            self.save_last_processed_gbk(latest_gbk)
            
            return False  # Retorna False quando processou um arquivo
            
        except Exception as e:
            logger.error(f"Erro durante o processo: {str(e)}")
            sys.exit(1)

if __name__ == "__main__":
    migration = FirebirdMigration()
    migration.run()
