from passlib.context import CryptContext


pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def check_admin_credentials(db_manager, rut, password):

    if not db_manager.connection or not db_manager.connection.is_connected():
        print("Error: No hay conexión a la base de datos para login.")
        return False
    
    cursor = db_manager.connection.cursor(dictionary=True)
    
    query = "SELECT clave_hash FROM administrador WHERE rut = %s"
    
    try:
       
        cursor.execute(query, (rut,))
        admin = cursor.fetchone()
        
        if admin:
            stored_hash = admin['clave_hash']
            if pwd_context.verify(password, stored_hash):
                print(f"✅ Login exitoso para el administrador con RUT: {rut}")
                return True
            else:
                print(f"❌ Intento de login fallido - Contraseña incorrecta para el RUT: {rut}")
                return False
        else:
        
            print(f"❌ Intento de login fallido - RUT no encontrado: {rut}")
            return False
    except Exception as e:
        print(f"Error en la verificación de credenciales: {e}")
        return False
    finally:
        cursor.close()
