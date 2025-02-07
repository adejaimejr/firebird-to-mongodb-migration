import os
import sys
import py7zr
import shutil
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
import logging
import re

# Nome do arquivo de log (usando o mesmo do automacao.py)
LOG_FILE = 'automacao.log'

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

def find_latest_backup(backup_dir):
    """Encontra o arquivo de backup mais recente no diretório especificado."""
    try:
        files = [f for f in os.listdir(backup_dir) if f.endswith('.7z') and f.startswith('bckfdb-')]
        if not files:
            logger.error(f"Nenhum arquivo de backup encontrado em {backup_dir}")
            return None
        
        # Ordena os arquivos por data no nome (formato: bckfdb-YYYY-MM-DD-HH.MM.7z)
        latest = max(files, key=lambda x: re.search(r'bckfdb-(\d{4}-\d{2}-\d{2}-\d{2}\.\d{2})', x).group(1))
        return os.path.join(backup_dir, latest)
    except Exception as e:
        logger.error(f"Erro ao buscar arquivo de backup: {str(e)}")
        return None

def get_gbk_filename(backup_file):
    """Converte o nome do arquivo .7z para o correspondente .gbk"""
    base_name = os.path.basename(backup_file)
    return base_name.replace('.7z', '.gbk')

def check_if_exists(gbk_dir, gbk_filename):
    """Verifica se o arquivo já existe no diretório gbk"""
    gbk_path = Path(gbk_dir) / gbk_filename
    return gbk_path.exists()

def extract_and_move(backup_file, gbk_dir):
    """Extrai o arquivo 7z e move seu conteúdo para o diretório gbk."""
    try:
        # Criar diretório temporário para extração
        temp_dir = Path("temp_extract")
        temp_dir.mkdir(exist_ok=True)
        
        # Extrair arquivo
        logger.info(f"Extraindo {backup_file}")
        with py7zr.SevenZipFile(backup_file, mode='r') as z:
            z.extractall(temp_dir)
        
        # Mover arquivos para diretório gbk
        for item in temp_dir.iterdir():
            dest_path = Path(gbk_dir) / item.name
            if dest_path.exists():
                dest_path.unlink()  # Remove arquivo existente
            shutil.move(str(item), str(dest_path))
            logger.info(f"Arquivo movido com sucesso: {item.name}")
        
        # Limpar diretório temporário
        shutil.rmtree(temp_dir)
        return True
    except Exception as e:
        logger.error(f"Erro durante extração/movimentação: {str(e)}")
        if temp_dir.exists():
            shutil.rmtree(temp_dir)
        return False

def prepare_backup():
    """Função principal que será chamada pelo automacao.py"""
    try:
        logger.info("="*80)
        logger.info("Iniciando preparação do backup")
        logger.info("="*80)
        
        # Carregar variáveis de ambiente
        load_dotenv()
        gbk_path = os.getenv('GBK_PATH')
        
        if not gbk_path:
            logger.error("GBK_PATH não encontrado no arquivo .env")
            return False
            
        # Encontrar backup mais recente
        latest_backup = find_latest_backup(gbk_path)
        if not latest_backup:
            return False
            
        # Diretório gbk local
        local_gbk_dir = Path("gbk")
        if not local_gbk_dir.exists():
            local_gbk_dir.mkdir()
        
        # Verificar se o arquivo já existe
        gbk_filename = get_gbk_filename(latest_backup)
        if check_if_exists(local_gbk_dir, gbk_filename):
            logger.info(f"Arquivo {gbk_filename} já existe na pasta gbk. Nenhuma ação necessária.")
            return True
            
        # Extrair e mover arquivos
        logger.info(f"Iniciando extração do arquivo {latest_backup}")
        success = extract_and_move(latest_backup, local_gbk_dir)
        
        if success:
            logger.info("Preparação do backup concluída com sucesso!")
            return True
        else:
            logger.error("Falha na preparação do backup")
            return False
            
    except Exception as e:
        logger.error(f"Erro durante execução: {str(e)}")
        return False

if __name__ == "__main__":
    prepare_backup()
