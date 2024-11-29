import signal
import sys
import threading
import time
import logging
from datetime import datetime
import importlib.util
import os
import pystray
from PIL import Image, ImageDraw
import io

# Configuração do logging
log_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'logs')
os.makedirs(log_dir, exist_ok=True)

log_file = os.path.join(log_dir, f'scheduler_{datetime.now().strftime("%Y%m%d")}.log')
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[
        logging.FileHandler(log_file, encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)

# Variáveis globais para controle
running = False
migration_thread = None
last_run = None
next_run = None
icon = None
is_error = False
stop_event = threading.Event()

def handler_stop_signals(signum, frame):
    """Handler para sinais de parada"""
    global running
    logging.info(f"Recebido sinal de parada: {signum}")
    if running:
        on_stop(icon, None)

# Registra handlers para sinais de parada
signal.signal(signal.SIGINT, handler_stop_signals)
signal.signal(signal.SIGTERM, handler_stop_signals)

def create_sync_icon(color='blue'):
    """Cria um ícone de sincronização"""
    # Cria uma nova imagem com fundo transparente
    image = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    
    # Define as cores
    colors = {
        'blue': (0, 114, 239),
        'green': (0, 200, 81),
        'red': (255, 0, 0)
    }
    icon_color = colors.get(color, colors['blue'])
    
    # Desenha o círculo de sincronização
    center = 32
    radius = 20
    arrow_width = 8
    
    # Desenha as setas circulares
    draw.arc((center-radius, center-radius, center+radius, center+radius), 
             45, 315, fill=icon_color, width=arrow_width)
    
    # Desenha as pontas das setas
    arrow_points = [(center+radius-5, center-radius+5),
                   (center+radius+5, center-radius-5),
                   (center+radius+5, center-radius+10)]
    draw.polygon(arrow_points, fill=icon_color)
    
    return image

def update_icon_text():
    """Atualiza o texto do ícone com informações de status"""
    global last_run, next_run, is_error, running
    
    if is_error:
        return "Erro na última execução! Clique com botão direito para ver opções."
    
    if not running:
        return "Scheduler parado. Clique com botão direito para iniciar."
    
    if last_run and next_run:
        return f"Última execução: {last_run.strftime('%H:%M:%S')}\nPróxima execução: {next_run.strftime('%H:%M:%S')}"
    
    return "Aguardando primeira execução..."

def update_icon_status(status='normal'):
    """Atualiza o ícone de acordo com o status"""
    global icon
    try:
        if icon:
            if status == 'error':
                new_icon = create_sync_icon('red')
            elif status == 'running':
                new_icon = create_sync_icon('green')
            else:
                new_icon = create_sync_icon('blue')
            
            icon.icon = new_icon
            icon.title = update_icon_text()
    except Exception as e:
        logging.error(f"Erro ao atualizar ícone: {str(e)}")

def run_migration():
    """Executa a migração"""
    global last_run, next_run, is_error, stop_event
    try:
        if stop_event.is_set():
            return

        logging.info("Iniciando execução da migração")
        update_icon_status('running')
        
        # Importa o módulo automacao.py dinamicamente
        spec = importlib.util.spec_from_file_location(
            "automacao",
            os.path.join(os.path.dirname(os.path.abspath(__file__)), "automacao.py")
        )
        automacao = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(automacao)
        
        # Cria e executa a migração
        migration = automacao.FirebirdMigration()
        migration.run()
        
        last_run = datetime.now()
        next_run = datetime.fromtimestamp(time.time() + 3600)
        is_error = False
        
        logging.info("Migração concluída com sucesso")
        update_icon_status('normal')
        
    except Exception as e:
        logging.error(f"Erro ao executar migração: {str(e)}")
        is_error = True
        update_icon_status('error')

def migration_loop():
    """Loop principal de migração"""
    global running, migration_thread, stop_event
    interval = 3600  # 1 hora em segundos
    
    while running and not stop_event.is_set():
        try:
            run_migration()
            # Divide o sleep em intervalos menores para responder mais rápido ao stop
            for _ in range(interval):
                if not running or stop_event.is_set():
                    break
                time.sleep(1)
        except Exception as e:
            logging.error(f"Erro no loop do scheduler: {str(e)}")
            # Em caso de erro, aguarda 1 minuto antes de tentar novamente
            for _ in range(60):
                if not running or stop_event.is_set():
                    break
                time.sleep(1)

def force_kill_python():
    """Força o encerramento de processos Python relacionados"""
    try:
        os.system('taskkill /F /IM python.exe')
    except:
        pass

def on_start(icon, item):
    """Inicia a migração"""
    global running, migration_thread, stop_event
    if not running:
        stop_event.clear()
        running = True
        migration_thread = threading.Thread(target=migration_loop)
        migration_thread.daemon = True
        migration_thread.start()
        logging.info("Scheduler iniciado")
        update_icon_status('running')

def on_stop(icon, item):
    """Para a migração"""
    global running, migration_thread, stop_event
    if running:
        logging.info("Parando scheduler...")
        running = False
        stop_event.set()
        
        if migration_thread and migration_thread.is_alive():
            migration_thread.join(timeout=5)
            if migration_thread.is_alive():
                logging.warning("Thread não finalizou no timeout - forçando parada")
                force_kill_python()
        
        logging.info("Scheduler parado")
        update_icon_status('normal')

def on_restart(icon, item):
    """Reinicia a migração"""
    on_stop(icon, item)
    time.sleep(1)  # Pequena pausa para garantir que parou
    on_start(icon, item)

def on_exit(icon, item):
    """Encerra o programa"""
    try:
        if running:
            on_stop(icon, item)
        icon.stop()
        logging.info("Scheduler encerrado pelo usuário")
        sys.exit(0)
    except Exception as e:
        logging.error(f"Erro ao encerrar scheduler: {str(e)}")
        sys.exit(1)

def create_icon():
    """Cria o ícone na barra de tarefas"""
    global icon
    
    menu = pystray.Menu(
        pystray.MenuItem("Iniciar", on_start, default=True),  # Define Iniciar como ação padrão
        pystray.MenuItem("Parar", on_stop),
        pystray.MenuItem("Reiniciar", on_restart),
        pystray.MenuItem("Sair", on_exit)
    )
    
    icon = pystray.Icon(
        "scheduler",
        create_sync_icon(),
        "Scheduler de Migração",
        menu
    )
    
    icon.run()

if __name__ == "__main__":
    logging.info("Iniciando scheduler de migração")
    
    try:
        create_icon()
    except Exception as e:
        logging.error(f"Erro ao criar ícone: {str(e)}")
        sys.exit(1)
