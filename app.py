import eel
import os
import tkinter
from tkinter import filedialog
import base64
import threading
import sys
import platform
import time
import subprocess
import ctypes
from ctypes import wintypes
import signal
import atexit
import socket

from src.core import edificio as edificio_logic  
from src.core.db_manager import DBManager
from src.core.login import check_admin_credentials
from src.core import residentes as residentes_logic
from src.core import contratos as contratos_logic
from src.core import pagos as pagos_logic
from settings.config import APP_TITLE

db_manager = DBManager()

def cleanup():
    print("\n🧹 Limpiando recursos...")
    
    try:
        if db_manager:
            db_manager.close()
            print("✅ Base de datos cerrada")
    except Exception as e:
        print(f"⚠️  Error al cerrar BD: {e}")
    
    print("✅ Limpieza completada - Puerto liberado")

def signal_handler(signum, frame):
   
    print(f"\n🛑 Señal {signum} recibida. Cerrando aplicación...")
    cleanup()
    os._exit(0)


signal.signal(signal.SIGINT, signal_handler) 
signal.signal(signal.SIGTERM, signal_handler) 


atexit.register(cleanup)

def find_eel_window():
    if platform.system() != 'Windows':
        return None
    
    user32 = ctypes.windll.user32
    
    titles_to_check = [APP_TITLE, "Login - Gestión de Estacionamiento"]
    
    for _ in range(10): 
        for title in titles_to_check:
            hwnd = user32.FindWindowW(None, title)
            if hwnd:
                return hwnd
        time.sleep(0.5)
    return None

def remove_title_bar():
    if platform.system() != 'Windows':
        return

    user32 = ctypes.windll.user32
    hwnd = find_eel_window()

    if hwnd:
        style = user32.GetWindowLongW(hwnd, -16) 
        new_style = style & ~0x00C00000 
        user32.SetWindowLongW(hwnd, -16, new_style)
        
        user32.ShowWindow(hwnd, 3) 
        
        user32.SetWindowPos(hwnd, None, 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0020)
        user32.DrawMenuBar(hwnd)

def check_port_available(port=8080):
    
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        sock.bind(('localhost', port))
        sock.close()
        return True
    except OSError:
        sock.close()
        return False



@eel.expose
def get_torres():
    return edificio_logic.get_torres_list(db_manager)

@eel.expose
def create_torre(nombre):
    return edificio_logic.create_torre(db_manager, nombre)

@eel.expose
def delete_torre(id_torre):
    return edificio_logic.delete_torre(db_manager, id_torre)

@eel.expose
def update_torre(id_torre, nombre):
    return edificio_logic.update_torre(db_manager, id_torre, nombre)

@eel.expose
def get_departamentos_by_torre(id_torre):
    return edificio_logic.get_deptos_by_torre(db_manager, id_torre)

@eel.expose
def get_estacionamientos_by_torre(id_torre):
    return edificio_logic.get_estac_by_torre(db_manager, id_torre)

@eel.expose
def create_departamento(id_torre, numero, piso):
    return edificio_logic.create_departamento(db_manager, id_torre, numero, piso)

@eel.expose
def create_departamentos_batch(id_torre, numero_inicio, numero_fin, piso):
    return edificio_logic.create_departamentos_batch(db_manager, id_torre, numero_inicio, numero_fin, piso)

@eel.expose
def delete_departamento(id_depto):
    return edificio_logic.delete_departamento(db_manager, id_depto)

@eel.expose
def update_departamento(id_depto, numero, piso):
    return edificio_logic.update_departamento(db_manager, id_depto, numero, piso)

@eel.expose
def create_estacionamiento(id_torre, box_numero, tipo):
    return edificio_logic.create_estacionamiento(db_manager, id_torre, box_numero, tipo)

@eel.expose
def create_estacionamientos_batch(id_torre, box_inicio, box_fin, tipo):
    return edificio_logic.create_estacionamientos_batch(db_manager, id_torre, box_inicio, box_fin, tipo)

@eel.expose
def delete_estacionamiento(id_estac):
    return edificio_logic.delete_estacionamiento(db_manager, id_estac)

@eel.expose
def update_estacionamiento(id_estac, box_numero, tipo):
    return edificio_logic.update_estacionamiento(db_manager, id_estac, box_numero, tipo)



@eel.expose
def ping():
    return "pong"

@eel.expose
def reconnect_db():
    return db_manager.connect()

@eel.expose
def check_credentials(rut, password):
    return check_admin_credentials(db_manager, rut, password)



@eel.expose
def get_residentes_list(search_term=None, status='Activo'):
    return residentes_logic.get_list(db_manager, search_term, status)

@eel.expose
def get_form_data(resident_id=None):
    return residentes_logic.get_details_for_form(db_manager, resident_id)

@eel.expose
def save_resident_data(data, resident_id=None):
    return residentes_logic.save(db_manager, data, resident_id)

@eel.expose
def delete_residente_by_id(residente_id):
    return residentes_logic.delete_by_id(db_manager, residente_id)

@eel.expose
def reactivate_residente_by_id(residente_id):
    return residentes_logic.reactivate_by_id(db_manager, residente_id)

@eel.expose
def permanently_delete_residente_by_id(residente_id):
    return residentes_logic.permanently_delete_by_id(db_manager, residente_id)



@eel.expose
def get_contract_templates_list():
    return contratos_logic.get_list(db_manager)

@eel.expose
def get_contract_template_details(template_id):
    return contratos_logic.get_details(db_manager, template_id)

@eel.expose
def save_contract_template_data(data, template_id=None):
    return contratos_logic.save(db_manager, data, template_id)

@eel.expose
def delete_contract_template_by_id(template_id):
    return contratos_logic.delete_by_id(db_manager, template_id)

@eel.expose
def get_contract_file_data(template_id):
    return contratos_logic.get_file(db_manager, template_id)

@eel.expose
def download_contract_file(template_id):
    try:
        file_data = contratos_logic.get_raw_file(db_manager, template_id)
        if not file_data or not file_data.get('datos_archivo'):
            return {'success': False, 'message': "Error: No se encontraron los datos del archivo."}

      
        content_b64 = base64.b64encode(file_data['datos_archivo']).decode('utf-8')

        return {
            'success': True,
            'filename': file_data['nombre_archivo'],
            'content_b64': content_b64
        }
            
    except Exception as e:
        return {'success': False, 'message': f"Se produjo un error al preparar la descarga: {e}"}

@eel.expose
def select_contract_pdf():
    root = tkinter.Tk()
    root.withdraw()
    root.wm_attributes('-topmost', 1)
    
    file_path = filedialog.askopenfilename(
        parent=root,
        title="Seleccionar Contrato PDF",
        filetypes=[("Archivos PDF", "*.pdf")]
    )
    
    root.destroy()
    return file_path
    
@eel.expose
def get_contract_file_data_from_path(file_path):
    if not file_path:
        return {'success': False, 'message': 'No se proporcionó una ruta de archivo.'}
    try:
        with open(file_path, 'rb') as f:
            file_bytes = f.read()
        
        content_b64 = base64.b64encode(file_bytes).decode('utf-8')
        
        return {'success': True, 'content_b64': content_b64}
    except FileNotFoundError:
        return {'success': False, 'message': 'El archivo no fue encontrado en la ruta especificada.'}
    except Exception as e:
        return {'success': False, 'message': f'Error al leer el archivo: {e}'}



@eel.expose
def get_uf_info():
    return pagos_logic.get_uf_data()

@eel.expose
def get_resident_status_list():
    return pagos_logic.get_resident_status_list(db_manager)

@eel.expose
def get_resident_debt_details(resident_id):
    return pagos_logic.get_resident_debt_details(db_manager, resident_id)

@eel.expose
def process_payment(resident_id, meses_a_pagar, cobrar_multas):
    return pagos_logic.process_payment(db_manager, resident_id, meses_a_pagar, cobrar_multas)

@eel.expose
def get_payment_history(filters):
    return pagos_logic.get_payment_history(db_manager, filters)

@eel.expose
def update_payment_record(payment_id, data):
    return pagos_logic.update_payment_record(db_manager, payment_id, data)

@eel.expose
def get_all_active_residents_for_dropdown():
    return pagos_logic.get_all_active_residents_for_dropdown(db_manager)

@eel.expose
def create_payment_adjustment(resident_id, periodo, monto, observaciones):
    return pagos_logic.create_payment_adjustment(db_manager, resident_id, periodo, monto, observaciones)

@eel.expose
def delete_payment_record(payment_id):
    return pagos_logic.delete_payment_record(db_manager, payment_id)

@eel.expose
def export_payment_history_to_excel(records):
    return pagos_logic.export_payment_history_to_excel(records)

@eel.expose
def export_payment_history_to_csv(records):
    return pagos_logic.export_payment_history_to_csv(records)

@eel.expose
def export_payment_history_to_pdf(records):
    return pagos_logic.export_payment_history_to_pdf_current_view(records)

@eel.expose
def export_full_history_to_excel(filters):
    return pagos_logic.export_full_history_to_excel(db_manager, filters)

@eel.expose
def export_full_history_to_csv(filters):
    return pagos_logic.export_full_history_to_csv(db_manager, filters)

@eel.expose
def export_full_history_to_pdf(filters):
    return pagos_logic.export_payment_history_to_pdf(db_manager, filters)

@eel.expose
def export_audit_log_to_excel():
    return pagos_logic.export_audit_log_to_excel(db_manager)

@eel.expose
def export_audit_log_to_csv():
    return pagos_logic.export_audit_log_to_csv(db_manager)



def get_base_path():
    
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))

def restart_app():
    
    print("🔄 Reiniciando aplicación...")
    
    
    time.sleep(1.5)
    
    executable = sys.executable
    args = sys.argv[:]
    
    if getattr(sys, 'frozen', False):
        
        args = sys.argv[1:]
    
    print(f"Ejecutando: {executable} {args}")
    
   
    subprocess.Popen([executable] + args)
    
    
    cleanup()
    os._exit(0)

@eel.expose
def set_app_mode_and_restart(mode):
    
    try:
        mode_file = os.path.join(get_base_path(), 'mode.conf')
        
        
        if mode == 'chrome':
            mode_to_save = 'desktop'
        elif mode == 'browser':
            mode_to_save = 'browser'
        else:
            mode_to_save = 'desktop'
            
        with open(mode_file, 'w') as f:
            f.write(mode_to_save)
        
        print(f"✅ Modo guardado: {mode_to_save}. Reiniciando...")
        
        
        threading.Thread(target=restart_app).start()
        
        return {'success': True, 'message': f'Reiniciando en modo {mode_to_save}...'}
    except Exception as e:
        print(f"Error al guardar modo: {e}")
        return {'success': False, 'message': f'Error al cambiar modo: {e}'}

@eel.expose
def get_app_mode():
    
    try:
        mode_file = os.path.join(get_base_path(), 'mode.conf')
        if os.path.exists(mode_file):
            with open(mode_file, 'r') as f:
                mode = f.read().strip()
                return mode if mode in ['desktop', 'browser'] else 'desktop'
    except:
        pass
    return 'desktop'

def main():
    
    if not check_port_available(8080):
        print("⚠️  ADVERTENCIA: El puerto 8080 está ocupado.")
        print("🔧 Intentando liberar el puerto...")
        time.sleep(2)
        
        if not check_port_available(8080):
            print("❌ No se pudo liberar el puerto 8080.")
            print("💡 Solución: Cierra todas las instancias de Python y vuelve a intentar.")
            print("   O ejecuta: netstat -ano | findstr :8080")
            print("   Luego: taskkill /F /PID [número_del_proceso]")
            sys.exit(1)
    
    db_manager.connect()
    
    uf_thread = threading.Thread(target=pagos_logic.periodic_uf_updater, daemon=True)
    uf_thread.start()
    
    if getattr(sys, 'frozen', False):
        eel_folder = os.path.join(sys._MEIPASS, 'ui/templates')
    else:
        eel_folder = os.path.join(os.path.dirname(__file__), 'src', 'ui', 'templates')

    eel.init(eel_folder)
    
    
    start_page = 'login.html'
    
    
    app_mode = get_app_mode()
    
   
    try:
        if app_mode == 'browser':
            
            print("🌐 Iniciando en modo NAVEGADOR (se abrirá en tu navegador predeterminado)...")
            print("💡 Para volver al modo escritorio, usa el botón en la esquina superior derecha del login")
            
            eel.start(start_page, size=(1280, 720), port=8080, mode='default')
        else:
            
            print("🖥️  Iniciando en modo ESCRITORIO (ventana de aplicación)...")
            print("💡 Para cambiar a modo navegador, usa el botón en la esquina superior derecha del login")
            threading.Timer(0.5, remove_title_bar).start()
            
            eel.start(start_page, size=(1280, 720), port=8080, mode='chrome')
    except KeyboardInterrupt:
        print("\n⚠️  Interrupción detectada. Cerrando...")
        cleanup()
    except Exception as e:
        print(f"\n❌ Error al iniciar: {e}")
        cleanup()
        raise

if __name__ == '__main__':
    main()
