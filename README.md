=============================================================================
BASE DE DATOS - GESTIÓN DE ESTACIONAMIENTO
=============================================================================

UBICACIÓN DE LOS ARCHIVOS SQL
-----------------------------------------------------------------------------
Todos los archivos necesarios para la importación de la base de datos, 
incluyendo los volcados de datos (dumps) y el SQL de la base de datos 
entera, se encuentran ubicados en la carpeta:

   /database

Utilice los scripts contenidos en esta carpeta para crear y poblar la 
estructura inicial en su servidor MySQL antes de iniciar la aplicación.

CONFIGURACIÓN PARA PRUEBAS (CONEXIÓN)
-----------------------------------------------------------------------------
Para ejecutar el software en un entorno local, debe configurar la conexión 
a su instancia de MySQL.

Modifique los parámetros en el archivo: settings/config.py

Busque el diccionario `DB_CONFIG` y actualice los valores (host, usuario, 
contraseña, puerto) según su configuración local:

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

NOTA: Asegúrese de que el puerto coincida con el de su servidor MySQL 
(comúnmente 3306 o 3307).
