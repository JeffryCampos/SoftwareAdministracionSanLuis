import os

DB_CONFIG = {
    'host': os.environ.get('DB_HOST', '127.0.0.1'),
    'user': os.environ.get('DB_USER', 'root'),
    'password': os.environ.get('DB_PASSWORD', '822499'),
    'database': os.environ.get('DB_DATABASE', 'estacionamiento_db'),
    'port': int(os.environ.get('DB_PORT', 3307)),
    'raise_on_warnings': True,
    'use_pure': True  
}
APP_TITLE = "Gestión de Estacionamiento"




