import base64
import os
from decimal import Decimal, InvalidOperation

def get_list(db_manager):
    return db_manager.get_contract_templates()

def get_details(db_manager, template_id):
    details = db_manager.get_contract_template_details(template_id)
    if details and 'datos_archivo' in details:
        del details['datos_archivo']
    return details

def save(db_manager, data, template_id=None):
    pdf_data = None

    if not template_id:
        file_content_b64 = data.get('file_content_b64')
        if not file_content_b64:
            return False, "Error: No se ha subido ningún archivo."
        
        try:
            pdf_data = base64.b64decode(file_content_b64)
            del data['file_content_b64']
        except (base64.binascii.Error, TypeError) as e:
            return False, f"Error al decodificar el archivo: {e}"

    print(f"DEBUG: Datos recibidos en save: {data}")
    
    def clean_decimal(val, field_name):
        if not val:
            return None
       
        if isinstance(val, (int, float)):
            return Decimal(val)
        
        val_str = str(val).strip()
        if not val_str:
            return None
            
        val_clean = val_str.replace(',', '.')
        
        try:
            return Decimal(val_clean)
        except InvalidOperation:
            raise ValueError(f"El campo '{field_name}' tiene un valor inválido: '{val_str}'")

    try:
        data['p1_auto'] = clean_decimal(data.get('p1_auto'), 'Precio 1er Auto')
        data['p2_auto'] = clean_decimal(data.get('p2_auto'), 'Precio 2do Auto')
        data['p1_moto'] = clean_decimal(data.get('p1_moto'), 'Precio 1ra Moto')
        data['p2_moto'] = clean_decimal(data.get('p2_moto'), 'Precio 2da Moto')
        data['multa'] = clean_decimal(data.get('multa'), 'Valor Multa')
    except ValueError as e:
        print(f"DEBUG: Error de validación: {e}")
        return False, f"Error de validación: {str(e)}"

    return db_manager.save_contract_template(data, pdf_data, template_id)

def delete_by_id(db_manager, template_id):
    return db_manager.delete_contract_template(template_id)

def get_file(db_manager, template_id):
    file_data = db_manager.get_contract_file(template_id)
    if file_data and file_data.get('datos_archivo'):
        file_data['datos_archivo'] = base64.b64encode(file_data['datos_archivo']).decode('utf-8')
        return file_data
    return None

def get_raw_file(db_manager, template_id):
    return db_manager.get_contract_file(template_id)