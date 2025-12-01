import mysql.connector
from settings.config import DB_CONFIG
from decimal import Decimal, InvalidOperation
import binascii
import decimal
import datetime
import os

def _clean_db_results(result):
    if result is None:
        return result
    if isinstance(result, list):
        return [_clean_db_results(row) for row in result]
    
    cleaned_row = {}
    for key, value in result.items():
        if isinstance(value, (datetime.date, decimal.Decimal)):
            cleaned_row[key] = str(value)
        else:
            cleaned_row[key] = value
    return cleaned_row

class DBManager:
    def __init__(self):
        self.config = DB_CONFIG
        self.connection = None

    def connect(self):
        try:
            if self.connection and self.connection.is_connected():
                self.connection.close()
            
            self.connection = mysql.connector.connect(**self.config)
            return True
        except mysql.connector.Error as err:
            self.connection = None
            return False

    def _ensure_connection(self):
        try:
            if not self.connection or not self.connection.is_connected():
                raise mysql.connector.Error("Conexión no existente o cerrada.")
            self.connection.ping(reconnect=True, attempts=3, delay=2)
        except mysql.connector.Error as err:
            self.connect()

    def close(self):
        if self.connection and self.connection.is_connected():
            self.connection.close()

    def get_all_active_residents_for_dropdown(self):
        self._ensure_connection()
        if not self.connection or not self.connection.is_connected():
            return []
        cursor = self.connection.cursor(dictionary=True)
        try:
            cursor.execute("SELECT id, nombre_completo, rut FROM residentes WHERE estado = 'Activo' ORDER BY nombre_completo")
            return _clean_db_results(cursor.fetchall())
        finally:
            cursor.close()

    def create_payment_adjustment(self, resident_id, periodo, monto, observaciones):
        self._ensure_connection()
        if not self.connection or not self.connection.is_connected():
            return False, "Sin conexión a la base de datos."
        cursor = self.connection.cursor()
        try:
            cursor.execute("SELECT id FROM contratos WHERE id_residente = %s AND estado = 'Vigente' LIMIT 1", (resident_id,))
            contrato = cursor.fetchone()
            if not contrato:
                return False, "El residente seleccionado no tiene un contrato vigente."
            
            id_contrato = contrato[0]
            monto_decimal = Decimal(monto)
            
            query = """
                INSERT INTO registros_pago
                (id_contrato, periodo, fecha_pago, monto_esperado, monto_multa, estado, monto_pagado, observaciones) 
                VALUES (%s, %s, NOW(), 0, 0, 'Ajuste', %s, %s)
            """
            params = (id_contrato, periodo, monto_decimal, observaciones)
            cursor.execute(query, params)
            self.connection.commit()
            return True, "Ajuste creado correctamente."
        except (mysql.connector.Error, InvalidOperation) as err:
            self.connection.rollback()
            return False, f"Error al crear el ajuste: {err}"
        finally:
            cursor.close()

    def delete_payment_record(self, payment_id):
        self._ensure_connection()
        if not self.connection or not self.connection.is_connected():
            return False, "Sin conexión a la base de datos."
        cursor = self.connection.cursor()
        try:
            cursor.execute("DELETE FROM registros_pago WHERE id = %s", (payment_id,))
            self.connection.commit()
            if cursor.rowcount > 0:
                return True, "Registro de pago eliminado correctamente."
            else:
                return False, "No se encontró el registro de pago para eliminar."
        except mysql.connector.Error as err:
            self.connection.rollback()
            return False, f"Error de base de datos: {err}"
        finally:
            cursor.close()

    def get_payment_history(self, filters):
        self._ensure_connection()
        if not self.connection or not self.connection.is_connected():
            return {"error": "Conexion_Perdida"}
        
        cursor = self.connection.cursor(dictionary=True)
        
        query = """
            SELECT
                rp.id,
                r.nombre_completo AS residente_nombre,
                r.rut AS residente_rut,
                rp.periodo,
                rp.fecha_pago,
                rp.monto_esperado AS monto_arriendo,
                rp.monto_multa,
                rp.monto_pagado,
                rp.observaciones,
                rp.estado
            FROM registros_pago rp
            JOIN contratos c ON rp.id_contrato = c.id
            JOIN residentes r ON c.id_residente = r.id
        """
        
        params = []
        where_conditions = []

        if filters.get('residente'):
            where_conditions.append("(r.nombre_completo LIKE %s OR r.rut LIKE %s)")
            params.extend([f"%{filters['residente']}%", f"%{filters['residente']}%"])
        
        if filters.get('fecha_desde'):
            where_conditions.append("DATE(rp.fecha_pago) >= %s")
            params.append(filters['fecha_desde'])
            
        if filters.get('fecha_hasta'):
            where_conditions.append("DATE(rp.fecha_pago) <= %s")
            params.append(filters['fecha_hasta'])

        if filters.get('tipo'):
            if filters['tipo'] == 'Multa':
                where_conditions.append("rp.monto_multa > 0")
            elif filters['tipo'] == 'Ajuste':
                where_conditions.append("rp.estado = 'Ajuste'")
        
        if where_conditions:
            query += " WHERE " + " AND ".join(where_conditions)
            
        query += " ORDER BY rp.fecha_pago DESC, r.nombre_completo"
        
        try:
            cursor.execute(query, tuple(params))
            records = _clean_db_results(cursor.fetchall())
            
            total_arriendo = sum(Decimal(r.get('monto_arriendo', '0') or '0') for r in records if r['estado'] != 'Ajuste')
            total_multas = sum(Decimal(r.get('monto_multa', '0') or '0') for r in records if r['estado'] != 'Ajuste')
            total_ajustes = sum(Decimal(r.get('monto_pagado', '0') or '0') for r in records if r['estado'] == 'Ajuste')
            total_general = sum(Decimal(r.get('monto_pagado', '0') or '0') for r in records)

            summary = {
                "total_arriendo": str(total_arriendo),
                "total_multas": str(total_multas),
                "total_ajustes": str(total_ajustes),
                "total_general": str(total_general)
            }
            
            return {"records": records, "summary": summary}
        finally:
            cursor.close()

    def update_payment_record(self, payment_id, data):
        self._ensure_connection()
        if not self.connection or not self.connection.is_connected():
            return False, "Sin conexión a la base de datos."
        cursor = self.connection.cursor()
        try:
            query = """
                UPDATE registros_pago SET
                    monto_esperado = %s,
                    monto_multa = %s,
                    monto_pagado = %s,
                    observaciones = %s
                WHERE id = %s
            """
            params = (
                Decimal(data.get('monto_arriendo', '0')),
                Decimal(data.get('monto_multa', '0')),
                Decimal(data.get('monto_pagado', '0')),
                data.get('observaciones', ''),
                payment_id
            )
            cursor.execute(query, params)
            self.connection.commit()
            return True, "Registro de pago actualizado correctamente."
        except (mysql.connector.Error, InvalidOperation) as err:
            self.connection.rollback()
            return False, f"Error al actualizar el registro: {err}"
        finally:
            cursor.close()
            
    def get_residentes_list(self, search_term=None, status='Activo'):
        self._ensure_connection()
        if not self.connection or not self.connection.is_connected(): 
            return {"error": "Conexion_Perdida"}
        cursor = self.connection.cursor(dictionary=True)
        
        query = """
            SELECT
                r.id AS id_residente, r.nombre_completo AS nombre, r.rut, r.estado,
                GROUP_CONCAT(CONCAT(t.nombre, '-', e.box_numero) SEPARATOR ', ') AS estacionamientos_asignados
            FROM residentes r
            LEFT JOIN contratos c ON r.id = c.id_residente
            LEFT JOIN contrato_estacionamiento ce ON c.id = ce.id_contrato
            LEFT JOIN estacionamientos e ON ce.id_estacionamiento = e.id
            LEFT JOIN torres t ON e.id_torre = t.id
        """
        params = []
        where_conditions = ["r.estado = %s"]
        params.append(status)

        if search_term:
            where_conditions.append("(r.nombre_completo LIKE %s OR r.rut LIKE %s)")
            params.extend([f"%{search_term}%", f"%{search_term}%"])
        
        query += " WHERE " + " AND ".join(where_conditions)
        query += " GROUP BY r.id ORDER BY r.nombre_completo"
        cursor.execute(query, tuple(params))
        return _clean_db_results(cursor.fetchall())

    def get_resident_details(self, resident_id):
        self._ensure_connection()
        if not self.connection or not self.connection.is_connected():
            return {}
        cursor = self.connection.cursor(dictionary=True)
        try:
            
            query = """
                SELECT 
                    r.id, r.nombre_completo, r.rut, r.email, r.telefono, r.estado,
                    ps.nombre_completo as pagador_nombre, ps.rut as pagador_rut,
                    d.id as depto_id, d.numero as depto_numero, t_d.nombre as depto_torre,
                    v.id as vehiculo_id, v.patente, v.marca, v.modelo, v.tag, v.tipo as vehiculo_tipo,
                    c.id as contrato_id, c.id_contrato_archivo, c.fecha_inicio,
                    e.id as est_id, e.box_numero as est_box_numero, t_e.nombre as est_torre, e.tipo as est_tipo
                FROM residentes r
                LEFT JOIN pagadores_secundarios ps ON r.id = ps.id_residente
                LEFT JOIN residente_departamento rd ON r.id = rd.id_residente
                LEFT JOIN departamentos d ON rd.id_departamento = d.id
                LEFT JOIN torres t_d ON d.id_torre = t_d.id
                LEFT JOIN residente_vehiculo rv ON r.id = rv.id_residente
                LEFT JOIN vehiculos v ON rv.id_vehiculo = v.id
                LEFT JOIN contratos c ON r.id = c.id_residente AND c.estado = 'Vigente'
                LEFT JOIN contrato_estacionamiento ce ON c.id = ce.id_contrato
                LEFT JOIN estacionamientos e ON ce.id_estacionamiento = e.id
                LEFT JOIN torres t_e ON e.id_torre = t_e.id
                WHERE r.id = %s;
            """
            cursor.execute(query, (resident_id,))
            rows = _clean_db_results(cursor.fetchall())

            if not rows:
                return {}

            
            first_row = rows[0]
            details = {
                'residente': {
                    'id': first_row['id'], 'nombre_completo': first_row['nombre_completo'],
                    'rut': first_row['rut'], 'email': first_row['email'],
                    'telefono': first_row['telefono'], 'estado': first_row['estado']
                },
                'pagadores_secundarios': [], 'departamentos': [], 'vehiculos': [],
                'contrato': None, 'estacionamientos': []
            }

            if first_row['contrato_id']:
                details['contrato'] = {
                    'id': first_row['contrato_id'],
                    'id_contrato_archivo': first_row['id_contrato_archivo'],
                    'fecha_inicio': first_row['fecha_inicio']
                }

            
            pagadores_seen, deptos_seen, vehiculos_seen, est_seen = set(), set(), set(), set()

            for row in rows:
                if row['pagador_rut'] and row['pagador_rut'] not in pagadores_seen:
                    details['pagadores_secundarios'].append({'nombre_completo': row['pagador_nombre'], 'rut': row['pagador_rut']})
                    pagadores_seen.add(row['pagador_rut'])
                if row['depto_id'] and row['depto_id'] not in deptos_seen:
                    details['departamentos'].append({'id': row['depto_id'], 'numero': row['depto_numero'], 'torre': row['depto_torre']})
                    deptos_seen.add(row['depto_id'])
                if row['vehiculo_id'] and row['vehiculo_id'] not in vehiculos_seen:
                    details['vehiculos'].append({'id': row['vehiculo_id'], 'patente': row['patente'], 'marca': row['marca'], 'modelo': row['modelo'], 'tag': row['tag'], 'tipo': row['vehiculo_tipo']})
                    vehiculos_seen.add(row['vehiculo_id'])
                if row['est_id'] and row['est_id'] not in est_seen:
                    details['estacionamientos'].append({'id': row['est_id'], 'box_numero': row['est_box_numero'], 'torre': row['est_torre'], 'tipo': row['est_tipo']})
                    est_seen.add(row['est_id'])

            return details

        finally:
            cursor.close()

    def get_available_resources(self):
        self._ensure_connection()
        if not self.connection or not self.connection.is_connected(): return {}
        cursor = self.connection.cursor(dictionary=True)
        resources = {}
        
        
        cursor.execute("""
            SELECT d.id, d.numero, t.nombre as torre 
            FROM departamentos d 
            JOIN torres t ON d.id_torre = t.id
            WHERE d.estado = 'DISPONIBLE' 
            ORDER BY t.nombre, CAST(d.numero AS UNSIGNED)
        """)
        resources['departamentos'] = _clean_db_results(cursor.fetchall())
        
        cursor.execute("""
            SELECT e.id, e.box_numero, t.nombre as torre, e.tipo 
            FROM estacionamientos e 
            JOIN torres t ON e.id_torre = t.id
            WHERE e.estado = 'DISPONIBLE' 
            ORDER BY e.tipo, t.nombre, CAST(e.box_numero AS UNSIGNED)
        """)
        resources['estacionamientos'] = _clean_db_results(cursor.fetchall())
        
        cursor.execute("SELECT id, nombre_contrato FROM contratos_archivos ORDER BY nombre_contrato")
        resources['contratos_archivos'] = _clean_db_results(cursor.fetchall())

        cursor.execute("SELECT id, nombre FROM torres ORDER BY nombre")
        resources['torres'] = _clean_db_results(cursor.fetchall())
        
        return resources

    def _execute_transactional_update(self, cursor, resident_id, data, resident_status):
        
        depto_ids_to_remove = tuple(set(data.get("departamentos", [])) - {r['id_departamento'] for r in cursor.fetchall()})

        cursor.execute("UPDATE residentes SET nombre_completo=%s, rut=%s, email=%s, telefono=%s WHERE id=%s",
                       (data['residente']['nombre_completo'], data['residente']['rut'], data['residente']['email'], data['residente']['telefono'], resident_id))
        
        cursor.execute("SELECT id_departamento FROM residente_departamento WHERE id_residente = %s", (resident_id,))
        old_deptos = {r['id_departamento'] for r in cursor.fetchall()}
        new_deptos = set(map(int, data.get("departamentos", [])))
        deptos_to_add = new_deptos - old_deptos
        deptos_to_remove = old_deptos - new_deptos

        if deptos_to_remove:
            deptos_to_remove_tuple = tuple(deptos_to_remove)
            if resident_status == 'Activo':
                cursor.execute(f"UPDATE departamentos SET estado = 'DISPONIBLE' WHERE id IN ({','.join(['%s'] * len(deptos_to_remove_tuple))})", deptos_to_remove_tuple)
            cursor.execute(f"DELETE FROM residente_departamento WHERE id_residente = %s AND id_departamento IN ({','.join(['%s'] * len(deptos_to_remove_tuple))})", (resident_id,) + deptos_to_remove_tuple)
        
        for depto_id in deptos_to_add:
            cursor.execute("INSERT INTO residente_departamento (id_residente, id_departamento) VALUES (%s, %s)", (resident_id, depto_id))
            if resident_status == 'Activo':
                cursor.execute("UPDATE departamentos SET estado = 'OCUPADO' WHERE id = %s", (depto_id,))

        cursor.execute("DELETE FROM pagadores_secundarios WHERE id_residente = %s", (resident_id,))
        for pagador in data.get("pagadores_secundarios", []):
            if pagador.get('nombre_completo') and pagador.get('rut'):
                cursor.execute("INSERT INTO pagadores_secundarios (id_residente, nombre_completo, rut) VALUES (%s, %s, %s)",
                               (resident_id, pagador["nombre_completo"], pagador["rut"]))

        cursor.execute("SELECT v.id FROM vehiculos v JOIN residente_vehiculo rv ON v.id = rv.id_vehiculo WHERE rv.id_residente = %s", (resident_id,))
        old_vehicle_ids = {row['id'] for row in cursor.fetchall()}
        current_vehicle_ids = set()

        for vehiculo in data.get("vehiculos", []):
            veh_id = vehiculo.get('id')
            if veh_id and veh_id in old_vehicle_ids:
                cursor.execute("UPDATE vehiculos SET patente=%s, marca=%s, modelo=%s, tag=%s, tipo=%s WHERE id=%s",
                               (vehiculo["patente"], vehiculo["marca"], vehiculo["modelo"], vehiculo["tag"], vehiculo["tipo"], veh_id))
                current_vehicle_ids.add(veh_id)
            elif vehiculo.get("patente"):
                cursor.execute("INSERT INTO vehiculos (patente, marca, modelo, tag, tipo) VALUES (%s, %s, %s, %s, %s)",
                               (vehiculo["patente"], vehiculo["marca"], vehiculo["modelo"], vehiculo["tag"], vehiculo["tipo"]))
                new_veh_id = cursor.lastrowid
                cursor.execute("INSERT INTO residente_vehiculo (id_residente, id_vehiculo) VALUES (%s, %s)", (resident_id, new_veh_id))
                current_vehicle_ids.add(new_veh_id)
        
        vehicles_to_delete = old_vehicle_ids - current_vehicle_ids
        if vehicles_to_delete:
            vehicles_to_delete_tuple = tuple(vehicles_to_delete)
            cursor.execute(f"DELETE FROM residente_vehiculo WHERE id_vehiculo IN ({','.join(['%s'] * len(vehicles_to_delete_tuple))})", vehicles_to_delete_tuple)
            cursor.execute(f"DELETE FROM vehiculos WHERE id IN ({','.join(['%s'] * len(vehicles_to_delete_tuple))})", vehicles_to_delete_tuple)
        
        cursor.execute("SELECT id, id_contrato_archivo, fecha_inicio FROM contratos WHERE id_residente = %s AND estado = 'Vigente' LIMIT 1", (resident_id,))
        contrato_actual = cursor.fetchone()
        
        new_estacionamientos_data = data.get("estacionamientos", [])
        new_estacionamientos_ids = {e['id'] for e in new_estacionamientos_data}

        if contrato_actual:
            cursor.execute("SELECT id_estacionamiento FROM contrato_estacionamiento WHERE id_contrato = %s", (contrato_actual['id'],))
            old_estacionamientos_ids = {r['id_estacionamiento'] for r in cursor.fetchall()}
            
            est_to_add = new_estacionamientos_ids - old_estacionamientos_ids
            est_to_remove = old_estacionamientos_ids - new_estacionamientos_ids

            if est_to_remove:
                est_to_remove_tuple = tuple(est_to_remove)
                if resident_status == 'Activo':
                    cursor.execute(f"UPDATE estacionamientos SET estado = 'DISPONIBLE' WHERE id IN ({','.join(['%s'] * len(est_to_remove_tuple))})", est_to_remove_tuple)
                cursor.execute(f"DELETE FROM contrato_estacionamiento WHERE id_contrato = %s AND id_estacionamiento IN ({','.join(['%s'] * len(est_to_remove_tuple))})", (contrato_actual['id'],) + est_to_remove_tuple)

            for est_id in est_to_add:
                cursor.execute("INSERT INTO contrato_estacionamiento (id_contrato, id_estacionamiento) VALUES (%s, %s)", (contrato_actual['id'], est_id))
                if resident_status == 'Activo':
                    cursor.execute("UPDATE estacionamientos SET estado = 'OCUPADO' WHERE id = %s", (est_id,))
            
            cursor.execute("UPDATE contratos SET id_contrato_archivo=%s, fecha_inicio=%s WHERE id=%s",
                           (data['contrato']['id_contrato_archivo'], data['contrato']['fecha_inicio'], contrato_actual['id']))

        elif new_estacionamientos_ids or data['contrato'].get('id_contrato_archivo'):
            cursor.execute("INSERT INTO contratos (id_residente, fecha_inicio, id_contrato_archivo) VALUES (%s, %s, %s)",
                           (resident_id, data['contrato']['fecha_inicio'], data['contrato']['id_contrato_archivo']))
            contract_id = cursor.lastrowid
            for est_id in new_estacionamientos_ids:
                cursor.execute("INSERT INTO contrato_estacionamiento (id_contrato, id_estacionamiento) VALUES (%s, %s)", (contract_id, est_id))
                if resident_status == 'Activo':
                    cursor.execute("UPDATE estacionamientos SET estado = 'OCUPADO' WHERE id = %s", (est_id,))

    def save_resident(self, data, resident_id=None):
        self._ensure_connection()
        if not self.connection or not self.connection.is_connected(): return False, "Sin conexión a la base de datos."
        cursor = self.connection.cursor(dictionary=True)
        try:
            cursor.execute("START TRANSACTION;")
            
            if resident_id:
                cursor.execute("SELECT estado FROM residentes WHERE id = %s", (resident_id,))
                result = cursor.fetchone()
                if not result:
                    cursor.execute("ROLLBACK;")
                    return False, "Error: El residente que intenta editar no existe."
                resident_status = result['estado']
                
                self._execute_transactional_update(cursor, resident_id, data, resident_status)
            else:
                cursor.execute("INSERT INTO residentes (nombre_completo, rut, email, telefono, estado) VALUES (%s, %s, %s, %s, 'Activo')",
                               (data['residente']['nombre_completo'], data['residente']['rut'], data['residente']['email'], data['residente']['telefono']))
                new_resident_id = cursor.lastrowid
                
                self._execute_transactional_update(cursor, new_resident_id, data, 'Activo')

            cursor.execute("COMMIT;")
            return True, "Datos guardados correctamente."
        except mysql.connector.Error as err:
            cursor.execute("ROLLBACK;")
            if err.errno == 1062:
                if 'residentes.rut' in err.msg:
                    return False, "El RUT ingresado ya se encuentra registrado."
                elif 'vehiculos.patente' in err.msg:
                    return False, "La patente de vehículo ingresada ya se encuentra registrada."
                elif 'vehiculos.tag' in err.msg:
                    return False, "El TAG de vehículo ingresado ya se encuentra registrado."
                elif 'estacionamientos.idx_box_torre_tipo_unica' in err.msg:
                    return False, "La combinación de Box, Torre y Tipo de estacionamiento ya se encuentra registrada."
                else:
                    return False, "Se encontró un valor duplicado que ya existe en el sistema."
            return False, f"Error de base de datos: {err}"
        finally:
            cursor.close()

    def deactivate_resident(self, resident_id):
        self._ensure_connection()
        if not self.connection or not self.connection.is_connected(): return False
        cursor = self.connection.cursor()
        try:
            cursor.execute("START TRANSACTION;")
            
            cursor.execute("SELECT id_departamento FROM residente_departamento WHERE id_residente = %s", (resident_id,))
            depto_ids = [row[0] for row in cursor.fetchall()]
            if depto_ids:
                depto_ids_tuple = tuple(depto_ids)
                cursor.execute(f"UPDATE departamentos SET estado = 'DISPONIBLE' WHERE id IN ({','.join(['%s']*len(depto_ids_tuple))})", depto_ids_tuple)

            cursor.execute("SELECT id FROM contratos WHERE id_residente = %s", (resident_id,))
            contrato_ids = [row[0] for row in cursor.fetchall()]
            if contrato_ids:
                contrato_ids_tuple = tuple(contrato_ids)
                cursor.execute(f"SELECT id_estacionamiento FROM contrato_estacionamiento WHERE id_contrato IN ({','.join(['%s']*len(contrato_ids_tuple))})", contrato_ids_tuple)
                est_ids = [row[0] for row in cursor.fetchall()]
                if est_ids:
                    est_ids_tuple = tuple(est_ids)
                    cursor.execute(f"UPDATE estacionamientos SET estado = 'DISPONIBLE' WHERE id IN ({','.join(['%s']*len(est_ids_tuple))})", est_ids_tuple)
            
            cursor.execute("UPDATE residentes SET estado = 'Inactivo' WHERE id = %s", (resident_id,))
            
            cursor.execute("COMMIT;")
            return True
        except mysql.connector.Error as err:
            cursor.execute("ROLLBACK;")
            return False
        finally:
            cursor.close()

    def check_and_reactivate_resident(self, resident_id):
        self._ensure_connection()
        if not self.connection or not self.connection.is_connected():
            return False, "Error de Conexión: No se pudo conectar a la base de datos."
        
        cursor = self.connection.cursor(dictionary=True)
        try:
            cursor.execute("START TRANSACTION;")

            cursor.execute("""
                SELECT d.id, t.nombre as torre, d.numero 
                FROM departamentos d 
                JOIN torres t ON d.id_torre = t.id
                JOIN residente_departamento rd ON d.id = rd.id_departamento 
                WHERE rd.id_residente = %s
            """, (resident_id,))
            deptos_asignados = cursor.fetchall()
            depto_ids = [d['id'] for d in deptos_asignados]

            cursor.execute("""
                SELECT e.id, t.nombre as torre, e.box_numero, e.tipo 
                FROM estacionamientos e 
                JOIN torres t ON e.id_torre = t.id
                JOIN contrato_estacionamiento ce ON e.id = ce.id_estacionamiento
                JOIN contratos c ON ce.id_contrato = c.id
                WHERE c.id_residente = %s
            """, (resident_id,))
            estacionamientos_asignados = cursor.fetchall()
            est_ids = [e['id'] for e in estacionamientos_asignados]

            conflicts = []
            if depto_ids:
                depto_ids_tuple = tuple(depto_ids)
                
                query_depto_conflicts = f"SELECT t.nombre as torre, d.numero FROM departamentos d JOIN torres t ON d.id_torre=t.id WHERE d.id IN ({','.join(['%s']*len(depto_ids_tuple))}) AND d.estado = 'OCUPADO'"
                cursor.execute(query_depto_conflicts, depto_ids_tuple)
                deptos_ocupados = cursor.fetchall()
                for d in deptos_ocupados:
                    conflicts.append(f"Departamento {d['torre']}-{d['numero']}")
            
            if est_ids:
                est_ids_tuple = tuple(est_ids)
                query_est_conflicts = f"SELECT t.nombre as torre, e.box_numero, e.tipo FROM estacionamientos e JOIN torres t ON e.id_torre=t.id WHERE e.id IN ({','.join(['%s']*len(est_ids_tuple))}) AND e.estado = 'OCUPADO'"
                cursor.execute(query_est_conflicts, est_ids_tuple)
                est_ocupados = cursor.fetchall()
                for e in est_ocupados:
                    conflicts.append(f"Estacionamiento {e['tipo'].capitalize()} {e['torre']}-{e['box_numero']}")

            if conflicts:
                cursor.execute("ROLLBACK;")
                conflict_list_str = "\n- " + "\n- ".join(conflicts)
                message = (f"Reactivación Bloqueada. El residente no puede ser reactivado porque los siguientes recursos "
                           f"que tenía asignados ya están siendo utilizados por otra persona:{conflict_list_str}\n\n"
                           f"Para reactivar, primero debe editar el perfil del residente inactivo y eliminar estas asignaciones conflictivas.")
                return False, message

            if depto_ids:
                depto_ids_tuple = tuple(depto_ids)
                query_update_deptos = f"UPDATE departamentos SET estado = 'OCUPADO' WHERE id IN ({','.join(['%s']*len(depto_ids_tuple))})"
                cursor.execute(query_update_deptos, depto_ids_tuple)
            if est_ids:
                est_ids_tuple = tuple(est_ids)
                query_update_est = f"UPDATE estacionamientos SET estado = 'OCUPADO' WHERE id IN ({','.join(['%s']*len(est_ids_tuple))})"
                cursor.execute(query_update_est, est_ids_tuple)
            
            cursor.execute("UPDATE residentes SET estado = 'Activo' WHERE id = %s", (resident_id,))
            
            cursor.execute("COMMIT;")
            return True, "Residente ha sido reactivado con éxito."
        
        except mysql.connector.Error as err:
            cursor.execute("ROLLBACK;")
            return False, f"Error de base de datos: {err}"
        finally:
            cursor.close()

    def delete_resident_permanently(self, resident_id):
        self._ensure_connection()
        if not self.connection or not self.connection.is_connected():
            return False, "Sin conexión a la base de datos."
        
        cursor = self.connection.cursor()
        try:
            cursor.execute("START TRANSACTION;")
            cursor.execute("DELETE FROM residentes WHERE id = %s", (resident_id,))
            
            rows_deleted = cursor.rowcount

            if rows_deleted > 0:
                cursor.execute("COMMIT;")
                return True, "Residente y todos sus registros han sido eliminados permanentemente."
            else:
                cursor.execute("ROLLBACK;")
                return False, "No se encontró al residente para eliminar."

        except mysql.connector.Error as err:
            cursor.execute("ROLLBACK;")
            return False, f"Error de base de datos: {err}"
        finally:
            cursor.close()

    def get_contract_templates(self):
        self._ensure_connection()
        if not self.connection or not self.connection.is_connected(): return []
        cursor = self.connection.cursor(dictionary=True)
        try:
            query = """
                SELECT 
                    id, nombre_contrato, nombre_archivo, 
                    DATE_FORMAT(fecha_subida, '%Y-%m-%d') AS fecha_subida 
                FROM contratos_archivos 
                ORDER BY id DESC
            """
            cursor.execute(query)
            return _clean_db_results(cursor.fetchall())
        finally:
            cursor.close()

    def get_contract_template_details(self, template_id):
        self._ensure_connection()
        if not self.connection or not self.connection.is_connected(): 
            return None
        cursor = self.connection.cursor(dictionary=True)
        try:
            query = """
                SELECT 
                    id, nombre_contrato, nombre_archivo, 
                    DATE_FORMAT(fecha_subida, '%Y-%m-%d') AS fecha_subida,
                    descripcion, 
                    precio_primer_estacionamiento_auto,
                    precio_segundo_estacionamiento_auto,
                    precio_estacionamiento_moto,
                    precio_segundo_estacionamiento_moto,
                    precio_multa_uf
                FROM contratos_archivos 
                WHERE id = %s
            """
            cursor.execute(query, (template_id,))
            return _clean_db_results(cursor.fetchone())
        except mysql.connector.Error:
            return None
        finally:
            if cursor:
                cursor.close()
            
    def save_contract_template(self, data, pdf_data=None, template_id=None):
        self._ensure_connection()
        if not self.connection or not self.connection.is_connected():
            return False, "Sin conexión a la base de datos."
        cursor = self.connection.cursor()
        try:
            cursor.execute("START TRANSACTION;")
            if template_id:
                query = """UPDATE contratos_archivos SET
                            nombre_contrato = %s, descripcion = %s, precio_primer_estacionamiento_auto = %s,
                            precio_segundo_estacionamiento_auto = %s, precio_estacionamiento_moto = %s,
                            precio_segundo_estacionamiento_moto = %s, precio_multa_uf = %s
                            WHERE id = %s"""
                params = (data['nombre_contrato'], data.get('descripcion', None), data['p1_auto'], data['p2_auto'],
                          data['p1_moto'], data['p2_moto'], data['multa'], template_id)
                message = "Plantilla de contrato actualizada correctamente."
                cursor.execute(query, params)
            else:
                query = """INSERT INTO contratos_archivos
                            (nombre_contrato, descripcion, nombre_archivo, datos_archivo, 
                             precio_primer_estacionamiento_auto, precio_segundo_estacionamiento_auto,
                             precio_estacionamiento_moto, precio_segundo_estacionamiento_moto, 
                             precio_multa_uf)
                            VALUES (%(nombre_contrato)s, %(descripcion)s, %(nombre_archivo)s, UNHEX(%(datos_archivo)s),
                                    %(p1_auto)s, %(p2_auto)s, %(p1_moto)s, %(p2_moto)s, %(multa)s)"""
                pdf_hex = binascii.hexlify(pdf_data)
                params_dict = {
                    'nombre_contrato': data['nombre_contrato'],
                    'descripcion': data.get('descripcion', None),
                    'nombre_archivo': data['nombre_archivo'],
                    'datos_archivo': pdf_hex,
                    'p1_auto': data['p1_auto'],
                    'p2_auto': data['p2_auto'],
                    'p1_moto': data['p1_moto'],
                    'p2_moto': data['p2_moto'],
                    'multa': data['multa']
                }
                message = "Plantilla de contrato subida correctamente."
                cursor.execute(query, params_dict)
            cursor.execute("COMMIT;")
            return True, message
        except mysql.connector.Error as err:
            cursor.execute("ROLLBACK;")
            return False, f"Error de base de datos: {err}"
        finally:
            cursor.close()

    def delete_contract_template(self, template_id):
        self._ensure_connection()
        if not self.connection or not self.connection.is_connected():
            return False, "Sin conexión a la base de datos."
        cursor = self.connection.cursor()
        try:
            cursor.execute("START TRANSACTION;")
            cursor.execute("DELETE FROM contratos_archivos WHERE id = %s", (template_id,))
            rows_deleted = cursor.rowcount
            if rows_deleted > 0:
                cursor.execute("COMMIT;")
                return True, "Plantilla eliminada correctamente."
            else:
                cursor.execute("ROLLBACK;")
                return False, "No se encontró la plantilla para eliminar."
        except mysql.connector.Error as err:
            cursor.execute("ROLLBACK;")
            if err.errno == 1451:
                return False, "Error: No se puede eliminar esta plantilla porque está siendo utilizada por uno o más residentes."
            return False, f"Error de base de datos: {err}"
            
    def get_contract_file(self, template_id):
        self._ensure_connection()
        if not self.connection or not self.connection.is_connected(): return None
        cursor = self.connection.cursor(dictionary=True)
        try:
            cursor.execute("SELECT nombre_archivo, datos_archivo FROM contratos_archivos WHERE id = %s", (template_id,))
            return cursor.fetchone()
        finally:
            cursor.close()
            
    def get_all_active_residents_for_status(self):
        self._ensure_connection()
        if not self.connection or not self.connection.is_connected(): return []
        cursor = self.connection.cursor(dictionary=True)
        query = """
            SELECT 
                r.id AS id_residente, 
                r.nombre_completo, 
                r.rut, 
                c.id AS id_contrato, 
                c.fecha_inicio,
                ca.nombre_contrato
            FROM residentes r
            JOIN contratos c ON r.id = c.id_residente
            LEFT JOIN contratos_archivos ca ON c.id_contrato_archivo = ca.id
            WHERE r.estado = 'Activo' AND c.estado = 'Vigente'
            AND (
                SELECT COUNT(ce.id_estacionamiento) 
                FROM contrato_estacionamiento ce 
                WHERE ce.id_contrato = c.id
            ) > 0
            ORDER BY r.nombre_completo
        """
        cursor.execute(query)
        return _clean_db_results(cursor.fetchall())

    def get_all_payment_records(self):
        self._ensure_connection()
        if not self.connection or not self.connection.is_connected(): return []
        cursor = self.connection.cursor(dictionary=True)
        query = "SELECT id_contrato, periodo FROM registros_pago WHERE monto_esperado > 0"
        cursor.execute(query)
        return _clean_db_results(cursor.fetchall())

    def get_resident_contract_details(self, resident_id):
        self._ensure_connection()
        if not self.connection or not self.connection.is_connected(): return None
        cursor = self.connection.cursor(dictionary=True)
        query = """
            SELECT 
                r.nombre_completo, c.id AS id_contrato, c.fecha_inicio,
                ca.precio_primer_estacionamiento_auto, ca.precio_segundo_estacionamiento_auto,
                ca.precio_estacionamiento_moto, ca.precio_segundo_estacionamiento_moto,
                ca.precio_multa_uf,
                (SELECT COUNT(e.id) FROM estacionamientos e JOIN contrato_estacionamiento ce ON e.id = ce.id_estacionamiento WHERE ce.id_contrato = c.id AND e.tipo = 'AUTO') AS autos_count,
                (SELECT COUNT(e.id) FROM estacionamientos e JOIN contrato_estacionamiento ce ON e.id = ce.id_estacionamiento WHERE ce.id_contrato = c.id AND e.tipo = 'MOTO') AS motos_count
            FROM residentes r
            JOIN contratos c ON r.id = c.id_residente
            JOIN contratos_archivos ca ON c.id_contrato_archivo = ca.id
            WHERE r.id = %s AND r.estado = 'Activo'
        """
        cursor.execute(query, (resident_id,))
        return _clean_db_results(cursor.fetchone())

    def get_payments_by_resident(self, resident_id):
        self._ensure_connection()
        if not self.connection or not self.connection.is_connected(): return []
        cursor = self.connection.cursor(dictionary=True)
        query = """
            SELECT rp.periodo, rp.estado, rp.id_contrato
            FROM registros_pago rp
            JOIN contratos c ON rp.id_contrato = c.id
            WHERE c.id_residente = %s
        """
        cursor.execute(query, (resident_id,))
        return _clean_db_results(cursor.fetchall())

    def register_bulk_payments(self, payment_list):
        self._ensure_connection()
        if not self.connection or not self.connection.is_connected():
            return False, "Sin conexión a la base de datos."
        cursor = self.connection.cursor()
        try:
            cursor.execute("START TRANSACTION;")

            for payment in payment_list:
                periodo_date = datetime.date.fromisoformat(payment['periodo'])
                cursor.execute("SELECT id, estado FROM registros_pago WHERE id_contrato = %s AND periodo = %s", 
                               (payment['id_contrato'], periodo_date))
                existing_record = cursor.fetchone()

                if existing_record:
                    record_id, estado_actual = existing_record
                    if estado_actual == 'Pagado' and payment.get('monto_multa', Decimal('0')) > 0:
                        query = "UPDATE registros_pago SET monto_multa = monto_multa + %s, monto_pagado = monto_pagado + %s, observaciones = CONCAT(observaciones, %s) WHERE id = %s"
                        cursor.execute(query, (payment['monto_multa'], payment['monto_multa'], f"\\n{payment['observaciones']}", record_id))
                    else: 
                        query = "UPDATE registros_pago SET fecha_pago = NOW(), monto_esperado = %s, monto_multa = %s, estado = 'Pagado', monto_pagado = %s, observaciones = %s WHERE id = %s"
                        cursor.execute(query, (payment['monto_esperado'], payment['monto_multa'], payment['monto_pagado'], payment['observaciones'], record_id))
                else: 
                    query = "INSERT INTO registros_pago (id_contrato, periodo, fecha_pago, monto_esperado, monto_multa, estado, monto_pagado, observaciones) VALUES (%s, %s, NOW(), %s, %s, 'Pagado', %s, %s)"
                    cursor.execute(query, (payment['id_contrato'], periodo_date, payment['monto_esperado'], payment['monto_multa'], payment['monto_pagado'], payment['observaciones']))
            
            cursor.execute("COMMIT;")
            return True, "Pagos registrados correctamente."
        except mysql.connector.Error as err:
            cursor.execute("ROLLBACK;")
            return False, f"Error de base de datos al registrar pagos: {err}"
        except Exception as e:
            cursor.execute("ROLLBACK;")
            return False, f"Error general al procesar pagos: {e}"
        finally:
            cursor.close()
    
    def get_payment_audit_log(self):
        self._ensure_connection()
        if not self.connection or not self.connection.is_connected():
            return []
        cursor = self.connection.cursor(dictionary=True)
        try:
            cursor.execute("SELECT * FROM registros_pago ORDER BY fecha_pago DESC")
            return _clean_db_results(cursor.fetchall())
        except mysql.connector.Error as err:
            print(f"Error al obtener el historial de auditoría de pagos: {err}")
            return []
        finally:
            cursor.close()