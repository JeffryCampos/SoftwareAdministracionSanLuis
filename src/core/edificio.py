import mysql.connector
from src.core.db_manager import _clean_db_results

def get_torres_list(db_manager):
    db_manager._ensure_connection()
    cursor = db_manager.connection.cursor(dictionary=True)
    try:
        query = """
            SELECT 
                t.id, t.nombre,
                (SELECT COUNT(*) FROM departamentos d WHERE d.id_torre = t.id) as num_deptos,
                (SELECT COUNT(*) FROM estacionamientos e WHERE e.id_torre = t.id) as num_estac
            FROM torres t
            ORDER BY t.nombre
        """
        cursor.execute(query)
        return _clean_db_results(cursor.fetchall())
    except Exception as e:
        print(f"Error obteniendo torres: {e}")
        return []
    finally:
        cursor.close()

def create_torre(db_manager, nombre):
    db_manager._ensure_connection()
    cursor = db_manager.connection.cursor()
    try:
        cursor.execute("INSERT INTO torres (nombre) VALUES (%s)", (nombre,))
        db_manager.connection.commit()
        return {'success': True, 'message': 'Torre creada correctamente.'}
    except mysql.connector.Error as err:
        if err.errno == 1062:
            return {'success': False, 'message': 'Ya existe una torre con ese nombre.'}
        return {'success': False, 'message': f"Error de BD: {err}"}
    finally:
        cursor.close()

def delete_torre(db_manager, id_torre):
    db_manager._ensure_connection()
    cursor = db_manager.connection.cursor()
    try:
        cursor.execute("DELETE FROM torres WHERE id = %s", (id_torre,))
        db_manager.connection.commit()
        return {'success': True, 'message': 'Torre eliminada correctamente.'}
    except Exception as e:
        return {'success': False, 'message': f"Error al eliminar: {e}"}
    finally:
        cursor.close()

def get_deptos_by_torre(db_manager, id_torre):
    db_manager._ensure_connection()
    cursor = db_manager.connection.cursor(dictionary=True)
    try:
        query = """
            SELECT id, numero, piso, estado 
            FROM departamentos 
            WHERE id_torre = %s 
            ORDER BY CAST(numero AS UNSIGNED), numero
        """
        cursor.execute(query, (id_torre,))
        return _clean_db_results(cursor.fetchall())
    finally:
        cursor.close()

def get_estac_by_torre(db_manager, id_torre):
    db_manager._ensure_connection()
    cursor = db_manager.connection.cursor(dictionary=True)
    try:
        query = """
            SELECT id, box_numero, tipo, estado 
            FROM estacionamientos 
            WHERE id_torre = %s 
            ORDER BY tipo, CAST(box_numero AS UNSIGNED), box_numero
        """
        cursor.execute(query, (id_torre,))
        return _clean_db_results(cursor.fetchall())
    finally:
        cursor.close()



def create_departamento(db_manager, id_torre, numero, piso):
    db_manager._ensure_connection()
    cursor = db_manager.connection.cursor()
    try:
        
        cursor.execute("SELECT id FROM departamentos WHERE id_torre = %s AND numero = %s", (id_torre, numero))
        if cursor.fetchone():
             return {'success': False, 'message': 'Ya existe ese número de departamento en esta torre.'}

        piso_val = piso if piso and str(piso).strip() != '' else None
        cursor.execute("INSERT INTO departamentos (id_torre, numero, piso) VALUES (%s, %s, %s)", (id_torre, numero, piso_val))
        db_manager.connection.commit()
        return {'success': True, 'message': 'Departamento creado.'}
    except Exception as e:
        return {'success': False, 'message': f"Error: {e}"}
    finally:
        cursor.close()

def create_departamentos_batch(db_manager, id_torre, numero_inicio, numero_fin, piso):
    
    db_manager._ensure_connection()
    cursor = db_manager.connection.cursor()
    try:
        created_count = 0
        errors = []
        
   
        inicio = int(numero_inicio)
        fin = int(numero_fin)
        
        if inicio > fin:
            return {'success': False, 'message': 'El número inicial debe ser menor o igual al final.'}
        
        piso_val = piso if piso and str(piso).strip() != '' else None
        
        for num in range(inicio, fin + 1):
            numero_str = str(num)
            
            cursor.execute("SELECT id FROM departamentos WHERE id_torre = %s AND numero = %s", (id_torre, numero_str))
            if cursor.fetchone():
                errors.append(f"Depto {numero_str} ya existe")
                continue
            
            try:
                cursor.execute("INSERT INTO departamentos (id_torre, numero, piso) VALUES (%s, %s, %s)", 
                             (id_torre, numero_str, piso_val))
                created_count += 1
            except Exception as e:
                errors.append(f"Error en {numero_str}: {str(e)}")
        
        db_manager.connection.commit()
        
        if created_count == 0:
            return {'success': False, 'message': 'No se creó ningún departamento. ' + '; '.join(errors)}
        elif errors:
            return {'success': True, 'message': f'Se crearon {created_count} departamentos. Errores: {"; ".join(errors)}'}
        else:
            return {'success': True, 'message': f'Se crearon {created_count} departamentos exitosamente.'}
    except Exception as e:
        db_manager.connection.rollback()
        return {'success': False, 'message': f"Error: {e}"}
    finally:
        cursor.close()

def delete_departamento(db_manager, id_depto):
    db_manager._ensure_connection()
    cursor = db_manager.connection.cursor()
    try:
        
        cursor.execute("SELECT estado FROM departamentos WHERE id = %s", (id_depto,))
        row = cursor.fetchone()
        if row and row[0] == 'OCUPADO':
             return {'success': False, 'message': 'No se puede eliminar: El departamento está ocupado por un residente.'}

        cursor.execute("DELETE FROM departamentos WHERE id = %s", (id_depto,))
        db_manager.connection.commit()
        return {'success': True, 'message': 'Departamento eliminado.'}
    except Exception as e:
        return {'success': False, 'message': f"Error: {e}"}
    finally:
        cursor.close()

def update_departamento(db_manager, id_depto, numero, piso):
    db_manager._ensure_connection()
    cursor = db_manager.connection.cursor()
    try:
      
        cursor.execute("SELECT id_torre FROM departamentos WHERE id = %s", (id_depto,))
        row = cursor.fetchone()
        if not row:
             return {'success': False, 'message': 'Departamento no encontrado.'}
        id_torre = row[0]

        cursor.execute("SELECT id FROM departamentos WHERE id_torre = %s AND numero = %s AND id != %s", (id_torre, numero, id_depto))
        if cursor.fetchone():
             return {'success': False, 'message': 'Ya existe ese número de departamento en esta torre.'}

        piso_val = piso if piso and str(piso).strip() != '' else None
        cursor.execute("UPDATE departamentos SET numero = %s, piso = %s WHERE id = %s", (numero, piso_val, id_depto))
        db_manager.connection.commit()
        return {'success': True, 'message': 'Departamento actualizado.'}
    except Exception as e:
        return {'success': False, 'message': f"Error: {e}"}
    finally:
        cursor.close()



def create_estacionamiento(db_manager, id_torre, box_numero, tipo):
    db_manager._ensure_connection()
    cursor = db_manager.connection.cursor()
    try:
        
        cursor.execute("SELECT id FROM estacionamientos WHERE id_torre = %s AND box_numero = %s AND tipo = %s", (id_torre, box_numero, tipo))
        if cursor.fetchone():
             return {'success': False, 'message': f'Ya existe el {tipo} box {box_numero} en esta torre.'}

        cursor.execute("INSERT INTO estacionamientos (id_torre, box_numero, tipo) VALUES (%s, %s, %s)", (id_torre, box_numero, tipo))
        db_manager.connection.commit()
        return {'success': True, 'message': 'Estacionamiento creado.'}
    except Exception as e:
        return {'success': False, 'message': f"Error: {e}"}
    finally:
        cursor.close()

def create_estacionamientos_batch(db_manager, id_torre, box_inicio, box_fin, tipo):
   
    db_manager._ensure_connection()
    cursor = db_manager.connection.cursor()
    try:
        created_count = 0
        errors = []
        
      
        inicio = int(box_inicio)
        fin = int(box_fin)
        
        if inicio > fin:
            return {'success': False, 'message': 'El número inicial debe ser menor o igual al final.'}
        
        for num in range(inicio, fin + 1):
            box_str = str(num)
            
            cursor.execute("SELECT id FROM estacionamientos WHERE id_torre = %s AND box_numero = %s AND tipo = %s", 
                         (id_torre, box_str, tipo))
            if cursor.fetchone():
                errors.append(f"Box {box_str} ({tipo}) ya existe")
                continue
            
            try:
                cursor.execute("INSERT INTO estacionamientos (id_torre, box_numero, tipo) VALUES (%s, %s, %s)", 
                             (id_torre, box_str, tipo))
                created_count += 1
            except Exception as e:
                errors.append(f"Error en {box_str}: {str(e)}")
        
        db_manager.connection.commit()
        
        if created_count == 0:
            return {'success': False, 'message': 'No se creó ningún estacionamiento. ' + '; '.join(errors)}
        elif errors:
            return {'success': True, 'message': f'Se crearon {created_count} estacionamientos. Errores: {"; ".join(errors)}'}
        else:
            return {'success': True, 'message': f'Se crearon {created_count} estacionamientos exitosamente.'}
    except Exception as e:
        db_manager.connection.rollback()
        return {'success': False, 'message': f"Error: {e}"}
    finally:
        cursor.close()

def delete_estacionamiento(db_manager, id_estac):
    db_manager._ensure_connection()
    cursor = db_manager.connection.cursor()
    try:
        cursor.execute("SELECT estado FROM estacionamientos WHERE id = %s", (id_estac,))
        row = cursor.fetchone()
        if row and row[0] == 'OCUPADO':
             return {'success': False, 'message': 'No se puede eliminar: El estacionamiento está ocupado.'}

        cursor.execute("DELETE FROM estacionamientos WHERE id = %s", (id_estac,))
        db_manager.connection.commit()
        return {'success': True, 'message': 'Estacionamiento eliminado.'}
    except Exception as e:
        return {'success': False, 'message': f"Error: {e}"}
    finally:
        cursor.close()

def update_estacionamiento(db_manager, id_estac, box_numero, tipo):
    db_manager._ensure_connection()
    cursor = db_manager.connection.cursor()
    try:
        
        cursor.execute("SELECT id_torre FROM estacionamientos WHERE id = %s", (id_estac,))
        row = cursor.fetchone()
        if not row:
             return {'success': False, 'message': 'Estacionamiento no encontrado.'}
        id_torre = row[0]

        cursor.execute("SELECT id FROM estacionamientos WHERE id_torre = %s AND box_numero = %s AND tipo = %s AND id != %s", (id_torre, box_numero, tipo, id_estac))
        if cursor.fetchone():
             return {'success': False, 'message': f'Ya existe el {tipo} box {box_numero} en esta torre.'}

        cursor.execute("UPDATE estacionamientos SET box_numero = %s, tipo = %s WHERE id = %s", (box_numero, tipo, id_estac))
        db_manager.connection.commit()
        return {'success': True, 'message': 'Estacionamiento actualizado.'}
    except Exception as e:
        return {'success': False, 'message': f"Error: {e}"}
    finally:
        cursor.close()


def update_torre(db_manager, id_torre, nombre):
    db_manager._ensure_connection()
    cursor = db_manager.connection.cursor()
    try:
        cursor.execute("UPDATE torres SET nombre = %s WHERE id = %s", (nombre, id_torre))
        db_manager.connection.commit()
        return {'success': True, 'message': 'Torre actualizada correctamente.'}
    except mysql.connector.Error as err:
        if err.errno == 1062:
            return {'success': False, 'message': 'Ya existe una torre con ese nombre.'}
        return {'success': False, 'message': f"Error de BD: {err}"}
    finally:
        cursor.close()