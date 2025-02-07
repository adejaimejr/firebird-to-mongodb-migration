import signal
import sys
import threading
import time
import logging
from datetime import datetime
import importlib.util
import os
from dotenv import load_dotenv
import pystray
from PIL import Image, ImageDraw
import io

# Carrega variáveis de ambiente
load_dotenv()

# Configuração do intervalo do scheduler (em minutos)
SCHEDULER_INTERVAL = int(os.getenv('SCHEDULER_INTERVAL', '60'))  # Padrão: 60 minutos

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
current_interval = int(os.getenv('SCHEDULER_INTERVAL', '60'))

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
        result = migration.run()
        
        last_run = datetime.now()
        next_run = datetime.fromtimestamp(time.time() + (current_interval * 60))
        is_error = False
        
        # Se não houver arquivos para processar, log mais conciso
        if result is True:  # Quando retorna True significa que não havia arquivos novos
            logging.info(f"Verificação concluída - Nenhum arquivo novo. Próxima execução em {format_interval(current_interval)}")
        else:
            logging.info(f"Migração concluída com sucesso. Próxima execução em {format_interval(current_interval)}")
        update_icon_status('normal')
        
    except Exception as e:
        logging.error(f"Erro ao executar migração: {str(e)}")
        is_error = True
        update_icon_status('error')

def migration_loop():
    """Loop principal de migração"""
    global running, migration_thread, stop_event, current_interval
    
    while running and not stop_event.is_set():
        try:
            run_migration()
            interval = current_interval * 60  # Converte minutos para segundos
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
    global running
    try:
        logging.info("Scheduler encerrado pelo usuário")
        running = False
        stop_event.set()
        
        if migration_thread and migration_thread.is_alive():
            migration_thread.join(timeout=5)
            if migration_thread.is_alive():
                force_kill_python()
        
        icon.stop()
    except Exception as e:
        logging.error(f"Erro ao encerrar scheduler: {str(e)}")

def on_interval_1(icon, item):
    """Define intervalo para 1 minuto"""
    change_interval(1)

def on_interval_5(icon, item):
    """Define intervalo para 5 minutos"""
    change_interval(5)

def on_interval_10(icon, item):
    """Define intervalo para 10 minutos"""
    change_interval(10)

def on_interval_15(icon, item):
    """Define intervalo para 15 minutos"""
    change_interval(15)

def on_interval_30(icon, item):
    """Define intervalo para 30 minutos"""
    change_interval(30)

def on_interval_60(icon, item):
    """Define intervalo para 60 minutos (1 hora)"""
    change_interval(60)

def on_interval_120(icon, item):
    """Define intervalo para 120 minutos (2 horas)"""
    change_interval(120)

def on_interval_360(icon, item):
    """Define intervalo para 360 minutos (6 horas)"""
    change_interval(360)

def on_interval_720(icon, item):
    """Define intervalo para 720 minutos (12 horas)"""
    change_interval(720)

def on_interval_1440(icon, item):
    """Define intervalo para 1440 minutos (24 horas)"""
    change_interval(1440)

def format_interval(minutes):
    """Formata o intervalo para exibição"""
    if minutes < 60:
        return f"{minutes} minutos"
    elif minutes == 60:
        return "1 hora"
    elif minutes < 1440:
        hours = minutes / 60
        return f"{hours:.0f} horas"
    else:
        days = minutes / 1440
        return f"{days:.0f} dia{'s' if days > 1 else ''}"

def change_interval(minutes):
    """Altera o intervalo do scheduler e reinicia se estiver rodando"""
    global current_interval, running
    current_interval = minutes
    
    # Atualiza o arquivo .env
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
    with open(env_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Procura e atualiza a linha do SCHEDULER_INTERVAL
    found = False
    for i, line in enumerate(lines):
        if line.startswith('SCHEDULER_INTERVAL='):
            lines[i] = f'SCHEDULER_INTERVAL={minutes}  # Intervalo em minutos entre as execuções\n'
            found = True
            break
    
    # Se não encontrou, adiciona ao final
    if not found:
        lines.append(f'\n# Configuração do Scheduler\nSCHEDULER_INTERVAL={minutes}  # Intervalo em minutos entre as execuções\n')
    
    # Salva o arquivo
    with open(env_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    
    logging.info(f"Intervalo alterado para {format_interval(minutes)}")
    
    # Se estiver rodando, reinicia para aplicar novo intervalo
    if running:
        on_restart(icon, None)

def create_icon():
    """Cria o ícone na barra de tarefas"""
    global icon
    
    # Cria o menu
    menu = (
        pystray.MenuItem("Iniciar", on_start),
        pystray.MenuItem("Parar", on_stop),
        pystray.MenuItem("Reiniciar", on_restart),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Intervalo", pystray.Menu(
            pystray.MenuItem("1 minuto", on_interval_1),
            pystray.MenuItem("5 minutos", on_interval_5),
            pystray.MenuItem("10 minutos", on_interval_10),
            pystray.MenuItem("15 minutos", on_interval_15),
            pystray.MenuItem("30 minutos", on_interval_30),
            pystray.MenuItem("1 hora", on_interval_60),
            pystray.MenuItem("2 horas", on_interval_120),
            pystray.MenuItem("6 horas", on_interval_360),
            pystray.MenuItem("12 horas", on_interval_720),
            pystray.MenuItem("24 horas", on_interval_1440),
        )),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Sair", on_exit)
    )
    
    # Cria o ícone
    icon = pystray.Icon(
        "migration_scheduler",
        create_sync_icon(),
        "Scheduler de Migração",
        menu
    )
    
    return icon

if __name__ == "__main__":
    logging.info("Iniciando scheduler de migração")
    
    try:
        create_icon().run()
    except Exception as e:
        logging.error(f"Erro ao criar ícone: {str(e)}")
        sys.exit(1)
