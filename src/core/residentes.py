def get_list(db_manager, search_term=None, status='Activo'):
    return db_manager.get_residentes_list(search_term, status)

def get_details_for_form(db_manager, resident_id=None):
    response = {}
    response['available'] = db_manager.get_available_resources()
    if resident_id:
        response['details'] = db_manager.get_resident_details(resident_id)
    return response

def save(db_manager, data, resident_id=None):
    return db_manager.save_resident(data, resident_id)

def delete_by_id(db_manager, residente_id):
    return db_manager.deactivate_resident(residente_id)

def reactivate_by_id(db_manager, residente_id):
    return db_manager.check_and_reactivate_resident(residente_id)

def permanently_delete_by_id(db_manager, residente_id):
    return db_manager.delete_resident_permanently(residente_id)