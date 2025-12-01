let currentResidentId = null;
let availableResources = null;
let initialFormData = null;

const residentPlaceholderHTML = `<div class="h-full flex flex-col justify-center items-center text-center"><i class="fas fa-paste fa-3x text-gray-500 mb-4"></i><p class="text-gray-400">Seleccione 'Añadir Residente' o haga clic en un residente para ver sus detalles.</p></div>`;
const residentSpinnerHTML = `<div class="h-full flex flex-col justify-center items-center"><i class="fas fa-spinner fa-spin fa-3x text-blue-400"></i><p class="mt-4 text-white">Cargando...</p></div>`;


function initResidentesView() {
    const searchInput = document.getElementById('residenteSearchInput');
    const showInactiveCheckbox = document.getElementById('show-inactive-checkbox');

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            loadResidentesList();
        });
    }
    if (showInactiveCheckbox) {
        showInactiveCheckbox.addEventListener('change', () => {
            loadResidentesList();
        });
    }
    loadResidentesList();
    clearFormPanel();
}

function showToast(message, isSuccess = true) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${isSuccess ? 'success' : 'error'}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (container.contains(toast)) container.removeChild(toast);
        }, 500);
    }, 4000);
}

function showCustomAlert(title, message) {
    const overlay = document.getElementById('custom-alert-overlay');
    const titleEl = document.getElementById('alert-title');
    const messageEl = document.getElementById('alert-message');
    const buttonsEl = document.getElementById('alert-buttons');

    titleEl.textContent = title;
    messageEl.textContent = message;
    buttonsEl.innerHTML = '';

    const okButton = document.createElement('button');
    okButton.textContent = 'Aceptar';
    okButton.className = 'btn-login px-6 py-2';
    okButton.onclick = () => overlay.classList.add('hidden');

    buttonsEl.appendChild(okButton);
    overlay.classList.remove('hidden');
}

function showCustomConfirm(title, message) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('custom-alert-overlay');
        const titleEl = document.getElementById('alert-title');
        const messageEl = document.getElementById('alert-message');
        const buttonsEl = document.getElementById('alert-buttons');

        titleEl.textContent = title;
        messageEl.innerHTML = message;
        buttonsEl.innerHTML = '';

        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancelar';
        cancelButton.className = 'btn-cancel';
        cancelButton.onclick = () => { overlay.classList.add('hidden'); resolve(false); };

        const confirmButton = document.createElement('button');
        confirmButton.textContent = 'Aceptar';
        confirmButton.className = 'btn-login px-6 py-2';
        confirmButton.onclick = () => { overlay.classList.add('hidden'); resolve(true); };

        buttonsEl.appendChild(cancelButton);
        buttonsEl.appendChild(confirmButton);
        overlay.classList.remove('hidden');
    });
}

function updateRowSelection(residentId = null) {
    const tableBody = document.getElementById('residentesTableBody');
    if (!tableBody) return;
    tableBody.querySelectorAll('tr').forEach(row => row.classList.remove('selected-row'));
    if (residentId) {
        const selectedRow = document.getElementById(`row-${residentId}`);
        if (selectedRow) selectedRow.classList.add('selected-row');
    }
}

async function loadResidentesList() {
    const tableBody = document.getElementById('residentesTableBody');
    const searchInput = document.getElementById('residenteSearchInput');
    const showInactiveCheckbox = document.getElementById('show-inactive-checkbox');
    if (!tableBody) return;

    const searchTerm = searchInput ? searchInput.value.trim() : null;
    const status = showInactiveCheckbox && showInactiveCheckbox.checked ? 'Inactivo' : 'Activo';

    tableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4"><i class="fas fa-spinner fa-spin fa-2x text-blue-400"></i></td></tr>';
    try {
        const residentes = await eel.get_residentes_list(searchTerm, status)();

        if (currentViewName !== 'residentes') {
            return;
        }

        if (residentes && residentes.error === "Conexion_Perdida") {
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-red-400">Error de conexión con la base de datos.</td></tr>';
            showDbConnectionErrorModal();
            return;
        }

        tableBody.innerHTML = '';
        if (!residentes || residentes.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4">No se encontraron residentes.</td></tr>';
            return;
        }

        const rowsHtml = residentes.map(res => {
            const isInactive = res.estado === 'Inactivo';
            let actionsHtml = '';
            if (isInactive) {
                actionsHtml = `
                    <button onclick="event.stopPropagation(); reactivateResident(${res.id_residente}, '${res.nombre.replace(/'/g, "\\'")}')" class="text-green-400 hover:text-green-300 mr-2" title="Reactivar Residente"><i class="fas fa-undo"></i></button>
                    <button onclick="event.stopPropagation(); showForm(${res.id_residente})" class="text-blue-400 hover:text-blue-300 mr-2" title="Editar"><i class="fas fa-edit"></i></button>
                    <button onclick="event.stopPropagation(); confirmPermanentDelete(${res.id_residente}, '${res.nombre.replace(/'/g, "\\'")}')" class="text-red-600 hover:text-red-500" title="Eliminar Permanentemente"><i class="fas fa-fire"></i></button>
                `;
            } else {
                actionsHtml = `
                    <button onclick="event.stopPropagation(); showForm(${res.id_residente})" class="text-blue-400 hover:text-blue-300 mr-2" title="Editar"><i class="fas fa-edit"></i></button>
                    <button onclick="event.stopPropagation(); confirmDeleteResidente(${res.id_residente}, '${res.nombre.replace(/'/g, "\\'")}')" class="text-yellow-500 hover:text-yellow-400" title="Desactivar"><i class="fas fa-trash"></i></button>
                `;
            }

            return `
                <tr id="row-${res.id_residente}" class="hover:bg-gray-700 transition-colors cursor-pointer ${isInactive ? 'opacity-60' : ''}" onclick="showDetailsView(${res.id_residente})">
                    <td class="px-6 py-4">${res.nombre || 'N/A'}</td>
                    <td class="px-6 py-4">${formatRutString(res.rut) || 'N/A'}</td>
                    <td class="px-6 py-4 text-center">${res.estacionamientos_asignados || 'Sin Asignar'}</td>
                    <td class="px-6 py-4 text-right">${actionsHtml}</td>
                </tr>
            `;
        }).join('');

        tableBody.innerHTML = rowsHtml;
        updateRowSelection(currentResidentId);

        const stillExists = document.getElementById(`row-${currentResidentId}`);
        if (currentResidentId && !stillExists) {
            clearFormPanel();
        }

    } catch (error) {
        if (currentViewName !== 'residentes') return;
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-red-400">Error al cargar la tabla.</td></tr>';
    }
}

async function confirmPermanentDelete(id, nombre) {
    const confirmationMessage = `<b>¡ADVERTENCIA!</b> Esta acción es irreversible.<br><br>¿Está seguro de que desea eliminar permanentemente a "<b>${nombre}</b>" y todos sus registros asociados (contratos, vehículos, historial de pagos, etc.)?`;
    const userConfirmed = await showCustomConfirm('Confirmar Eliminación Permanente', confirmationMessage);

    if (userConfirmed) {
        const [success, message] = await eel.permanently_delete_residente_by_id(id)();
        if (success) {
            showToast(message, true);
            if (currentResidentId === id) {
                clearFormPanel();
            }
            loadResidentesList();
        } else {
            showToast(message, false);
        }
    }
}

async function confirmDeleteResidente(id, nombre) {
    const userConfirmed = await showCustomConfirm('Confirmar Desactivación', `¿Desactivar a "${nombre}"? El residente podrá ser reactivado más tarde. Sus recursos (departamentos, estacionamientos) serán liberados.`);
    if (userConfirmed) {
        const success = await eel.delete_residente_by_id(id)();
        if (success) {
            showToast('Residente desactivado con éxito.', true);
            loadResidentesList();
            clearFormPanel();
        } else {
            showToast('Error: No se pudo desactivar al residente.', false);
        }
    }
}

async function reactivateResident(id, nombre) {
    const userConfirmed = await showCustomConfirm('Confirmar Reactivación', `¿Desea reactivar a "${nombre}"?`);
    if (userConfirmed) {
        const [success, message] = await eel.reactivate_residente_by_id(id)();
        if (success) {
            showToast(message, true);
            loadResidentesList();
        } else {
            showCustomAlert('Reactivación Fallida', message);
        }
    }
}

function clearFormPanel() {
    const formTitle = document.getElementById('form-title');
    const formContentArea = document.getElementById('form-content-area');
    const formActions = document.getElementById('form-actions');
    if (formTitle) formTitle.textContent = 'Panel de Registro';
    if (formContentArea) formContentArea.innerHTML = residentPlaceholderHTML;
    if (formActions) formActions.innerHTML = '';
    currentResidentId = null;
    initialFormData = null;
    availableResources = null;
    updateRowSelection(null);
}

async function handleCancelClick() {
    if (initialFormData) {
        const currentData = collectCurrentFormData();
        if (JSON.stringify(initialFormData) !== JSON.stringify(currentData)) {
            const userConfirmed = await showCustomConfirm('Descartar Cambios', 'Ha realizado cambios. ¿Está seguro de que desea descartarlos?');
            if (userConfirmed) {
                clearFormPanel();
            }
        } else {
            clearFormPanel();
        }
    } else {
        clearFormPanel();
    }
}

async function showDetailsView(residentId) {
    currentResidentId = residentId;
    updateRowSelection(residentId);
    const formTitle = document.getElementById('form-title');
    const formContentArea = document.getElementById('form-content-area');
    const formActions = document.getElementById('form-actions');

    if (formTitle) formTitle.textContent = 'Detalles del Residente';
    if (formContentArea) formContentArea.innerHTML = residentSpinnerHTML;
    if (formActions) formActions.innerHTML = '';

    try {
        if (!availableResources) {
            const formData = await eel.get_form_data(residentId)();
            availableResources = formData.available;
        }
        const formData = await eel.get_form_data(residentId)();
        const formTemplate = document.getElementById('form-template');
        if (formContentArea && formTemplate) formContentArea.innerHTML = formTemplate.innerHTML;

        populateForm(formData.details || {}, true);
        toggleFormLock(true);
        if (formActions) {
            formActions.innerHTML = `
                <button type="button" onclick="clearFormPanel()" class="btn-cancel">Cerrar</button>
                <button type="button" onclick="showForm(${currentResidentId})" class="btn-login px-6 py-2">Editar</button>
            `;
        }
    } catch (error) {
        if (formContentArea) formContentArea.innerHTML = `<p class="text-red-400 p-8">Error al cargar los detalles: ${error}</p>`;
    }
}

async function showForm(residentId = null) {
    currentResidentId = residentId;
    updateRowSelection(residentId);
    const formTitle = document.getElementById('form-title');
    const formContentArea = document.getElementById('form-content-area');
    const formActions = document.getElementById('form-actions');

    if (formTitle) formTitle.textContent = residentId ? 'Editar Residente' : 'Añadir Nuevo Residente';
    if (formContentArea) formContentArea.innerHTML = residentSpinnerHTML;
    if (formActions) formActions.innerHTML = '';

    try {
        if (!availableResources) {
            const formData = await eel.get_form_data(residentId)();
            availableResources = formData.available;
        }
        const formData = await eel.get_form_data(residentId)();
        const formTemplate = document.getElementById('form-template');
        if (formContentArea && formTemplate) formContentArea.innerHTML = formTemplate.innerHTML;

        populateForm(formData.details || {}, false);
        toggleFormLock(false);
        if (formActions) {
            formActions.innerHTML = `
                <button type="button" onclick="handleCancelClick()" class="btn-cancel">Cancelar</button>
                <button type="button" onclick="handleFormSubmit()" id="btn-save" class="btn-login px-6 py-2">Guardar</button>
            `;
        }
        initialFormData = collectCurrentFormData();
    } catch (error) {
        if (formContentArea) formContentArea.innerHTML = `<p class="text-red-400 p-8">Error al cargar el formulario: ${error}</p>`;
    }
}

function toggleFormLock(isLocked) {
    const form = document.getElementById('resident-form');
    if (!form) return;

    form.querySelectorAll('input, select').forEach(el => {
        el.disabled = isLocked;
    });

    form.querySelectorAll('.btn-delete').forEach(btn => {
        btn.style.display = isLocked ? 'none' : 'block';
    });

    form.querySelectorAll('.add-button-container').forEach(container => {
        container.style.display = isLocked ? 'none' : 'flex';
    });
}

function populateForm(details, isLockedView) {
    const noDataText = `<p class="text-center text-gray-400 italic text-sm">No hay información asignada.</p>`;

    const form = document.getElementById('resident-form');
    if (!form) return;
    if (details.residente) {
        for (const key in details.residente) {
            const input = form.querySelector(`[name=${key}]`);
            if (input) {
                if (key === 'rut') {
                    input.value = formatRutString(details.residente[key]) || '';
                } else {
                    input.value = details.residente[key] || '';
                }
            }
        }
    }

    if (details.pagadores_secundarios?.length > 0) {
        details.pagadores_secundarios.forEach(p => addPagadorRow(p));
    } else if (isLockedView) {
        document.getElementById('pagadores-container').innerHTML = noDataText;
    }

    if (details.departamentos?.length > 0) {
        details.departamentos.forEach(d => addDepartamentoRow(d));
    } else if (isLockedView) {
        document.getElementById('departamentos-container').innerHTML = noDataText;
    }

    if (details.vehiculos?.length > 0) {
        details.vehiculos.forEach(v => addVehiculoRow(v));
    } else if (isLockedView) {
        document.getElementById('vehiculos-container').innerHTML = noDataText;
    }

    const contratoSelect = form.querySelector('[name=id_contrato_archivo]');
    contratoSelect.innerHTML = '';
    if (availableResources.contratos_archivos?.length > 0) {
        availableResources.contratos_archivos.forEach(c => {
            contratoSelect.innerHTML += `<option value="${c.id}">${c.nombre_contrato}</option>`;
        });
    } else {
        contratoSelect.innerHTML = '<option value="">No hay plantillas disponibles</option>';
    }

    if (details.contrato && details.contrato.id_contrato_archivo) {
        contratoSelect.value = details.contrato.id_contrato_archivo;
    }

    if (details.contrato && details.contrato.fecha_inicio) {
        form.querySelector('[name=fecha_inicio]').value = details.contrato.fecha_inicio;
    } else {
        form.querySelector('[name=fecha_inicio]').value = new Date().toISOString().split('T')[0];
    }

    if (details.estacionamientos?.length > 0) {
        details.estacionamientos.forEach(e => addEstacionamientoRow(e));
    } else if (isLockedView) {
        document.getElementById('estacionamientos-container').innerHTML = noDataText;
    }
}

function addPagadorRow(data = {}) {
    const container = document.getElementById('pagadores-container');
    if (!container) return;
    if (container.querySelector('p')) container.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2';
    row.innerHTML = `
        <input type="text" placeholder="Nombre Completo Pagador" class="input-field flex-grow" value="${data.nombre_completo || ''}" data-key="nombre_completo" oninput="this.value = this.value.replace(/[0-9]/g, '')" autocomplete="new-password">
        <input type="text" placeholder="RUT Pagador" class="input-field w-40" value="${formatRutString(data.rut) || ''}" data-key="rut" oninput="formatRut(this)" autocomplete="new-password">
        <button type="button" class="btn-delete" onclick="this.parentElement.remove()">🗑️</button>
    `;
    container.appendChild(row);
}

function addVehiculoRow(data = {}) {
    const container = document.getElementById('vehiculos-container');
    if (!container) return;
    if (container.querySelector('p')) container.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'p-4 border border-gray-700 rounded-lg space-y-2 relative bg-gray-900 bg-opacity-20';
    row.innerHTML = `
        <input type="hidden" data-key="id" value="${data.id || ''}">
        <button type="button" class="btn-delete absolute top-2 right-2" onclick="this.parentElement.remove()">🗑️</button>
        <div class="grid grid-cols-2 gap-4">
            <div>
                <label class="block text-xs font-medium text-gray-400 mb-1">Patente</label>
                <input type="text" placeholder="Ej: ABCD-12" class="input-field w-full" value="${data.patente || ''}" data-key="patente" autocomplete="new-password">
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-400 mb-1">Marca</label>
                <input type="text" placeholder="Ej: Toyota" class="input-field w-full" value="${data.marca || ''}" data-key="marca" autocomplete="new-password">
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-400 mb-1">Modelo</label>
                <input type="text" placeholder="Ej: Yaris" class="input-field w-full" value="${data.modelo || ''}" data-key="modelo" autocomplete="new-password">
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-400 mb-1">TAG</label>
                <input type="text" placeholder="Ej: 123456789" class="input-field w-full" value="${data.tag || ''}" data-key="tag" autocomplete="new-password">
            </div>
        </div>
        <div>
            <label class="block text-xs font-medium text-gray-400 mb-1">Tipo de Vehículo</label>
            <select class="input-field w-full" data-key="tipo">
                <option value="AUTO" ${data.tipo === 'AUTO' ? 'selected' : ''}>AUTO</option>
                <option value="MOTO" ${data.tipo === 'MOTO' ? 'selected' : ''}>MOTO</option>
            </select>
        </div>
    `;
    container.appendChild(row);
}

function getTorresOptionsHTML(selectedTorre) {
    let options = '';
    if (availableResources && availableResources.torres) {
        availableResources.torres.forEach(t => {
            const isSelected = t.nombre === selectedTorre ? 'selected' : '';
            options += `<option value="${t.nombre}" ${isSelected}>${t.nombre}</option>`;
        });
    } else {
        // Fallback si no hay torres cargadas
        options = '<option>A</option><option>B</option><option>C</option>';
    }
    return options;
}

function addDepartamentoRow(data = {}) {
    const container = document.getElementById('departamentos-container');
    if (!container) return;
    if (container.querySelector('p')) container.innerHTML = '';

    if (!data.id) {
        const selectedIds = Array.from(document.querySelectorAll('#departamentos-container .depto-numero-select')).map(select => parseInt(select.value));
        const nextAvailable = availableResources.departamentos.find(depto => !selectedIds.includes(depto.id));
        if (!nextAvailable) {
            showCustomAlert('Aviso', 'No hay más departamentos disponibles para agregar.');
            return;
        }
        data = nextAvailable;
    }

    const row = document.createElement('div');
    row.className = 'flex items-center gap-2';
    const torresOptions = getTorresOptionsHTML(data.torre);

    row.innerHTML = `
        <span class="text-sm text-gray-300">Torre:</span>
        <select class="input-field depto-torre-select">${torresOptions}</select>
        <span class="text-sm text-gray-300 ml-2">Nº:</span>
        <select class="input-field flex-grow depto-numero-select" data-key="id"></select>
        <button type="button" class="btn-delete" onclick="this.parentElement.remove()">🗑️</button>
    `;
    container.appendChild(row);
    const torreSelect = row.querySelector('.depto-torre-select');
    const numeroSelect = row.querySelector('.depto-numero-select');
    torreSelect.addEventListener('change', () => updateNumeroCombo(torreSelect, numeroSelect, data));
    if (data.torre) torreSelect.value = data.torre;
    updateNumeroCombo(torreSelect, numeroSelect, data);
}

function updateNumeroCombo(torreSelect, numeroSelect, selectedData) {
    const selectedTorre = torreSelect.value;
    numeroSelect.innerHTML = '';
    const filteredDeptos = availableResources.departamentos.filter(d => d.torre === selectedTorre);
    if (selectedData.id && !filteredDeptos.some(d => d.id === selectedData.id)) {
        numeroSelect.innerHTML += `<option value="${selectedData.id}">${selectedData.numero} (Asignado)</option>`;
    }
    filteredDeptos.forEach(d => {
        numeroSelect.innerHTML += `<option value="${d.id}">${d.numero}</option>`;
    });
    if (selectedData.id) numeroSelect.value = selectedData.id;
}

function addEstacionamientoRow(data = {}) {
    const numDepartamentos = document.querySelectorAll('#departamentos-container > div').length;
    const numEstacionamientos = document.querySelectorAll('#estacionamientos-container > div').length;
    if (numEstacionamientos >= numDepartamentos * 2) {
        showCustomAlert('Límite Alcanzado', 'No puede asignar más de 2 estacionamientos por departamento.');
        return;
    }
    const container = document.getElementById('estacionamientos-container');
    if (!container) return;
    if (container.querySelector('p')) container.innerHTML = '';

    if (!data.id) {
        const selectedIds = Array.from(document.querySelectorAll('#estacionamientos-container .est-box-select')).map(select => parseInt(select.value));
        const nextAvailable = availableResources.estacionamientos.find(est => !selectedIds.includes(est.id));
        if (!nextAvailable) {
            showCustomAlert('Aviso', 'No hay más estacionamientos disponibles para agregar.');
            return;
        }
        data = nextAvailable;
    }

    const row = document.createElement('div');
    row.className = 'flex items-center gap-2';
    const torresOptions = getTorresOptionsHTML(data.torre);

    row.innerHTML = `
        <span class="text-sm text-gray-300">Tipo:</span>
        <select class="input-field est-tipo-select"><option>AUTO</option><option>MOTO</option></select>
        <span class="text-sm text-gray-300 ml-2">Torre:</span>
        <select class="input-field est-torre-select">${torresOptions}</select>
        <span class="text-sm text-gray-300 ml-2">Box:</span>
        <select class="input-field flex-grow est-box-select" data-key="id"></select>
        <button type="button" class="btn-delete" onclick="this.parentElement.remove()">🗑️</button>
    `;
    container.appendChild(row);
    const tipoSelect = row.querySelector('.est-tipo-select');
    const torreSelect = row.querySelector('.est-torre-select');
    const boxSelect = row.querySelector('.est-box-select');
    tipoSelect.addEventListener('change', () => updateBoxCombo(tipoSelect, torreSelect, boxSelect, data));
    torreSelect.addEventListener('change', () => updateBoxCombo(tipoSelect, torreSelect, boxSelect, data));
    if (data.tipo) tipoSelect.value = data.tipo;
    if (data.torre) torreSelect.value = data.torre;
    updateBoxCombo(tipoSelect, torreSelect, boxSelect, data);
}

function updateBoxCombo(tipoSelect, torreSelect, boxSelect, originalData) {
    const selectedTipo = tipoSelect.value;
    const selectedTorre = torreSelect.value;
    boxSelect.innerHTML = '';

    const filteredSpots = availableResources.estacionamientos.filter(e => e.tipo === selectedTipo && e.torre === selectedTorre);

    let isOriginalDataStillValid = (originalData.id && originalData.tipo === selectedTipo && originalData.torre === selectedTorre);

    if (isOriginalDataStillValid && !filteredSpots.some(e => e.id === originalData.id)) {
        boxSelect.innerHTML += `<option value="${originalData.id}">${originalData.box_numero} (Asignado)</option>`;
    }

    filteredSpots.forEach(e => {
        boxSelect.innerHTML += `<option value="${e.id}">${e.box_numero}</option>`;
    });

    if (isOriginalDataStillValid) {
        boxSelect.value = originalData.id;
    }
}

function collectCurrentFormData() {
    const form = document.getElementById('resident-form');
    if (!form) return null;
    const data = {};
    data.residente = {
        nombre_completo: form.querySelector('[name=nombre_completo]').value,
        rut: form.querySelector('[name=rut]').value,
        email: form.querySelector('[name=email]').value,
        telefono: form.querySelector('[name=telefono]').value,
    };
    data.pagadores_secundarios = Array.from(document.querySelectorAll('#pagadores-container > div')).map(row => ({
        nombre_completo: row.querySelector('[data-key=nombre_completo]').value,
        rut: row.querySelector('[data-key=rut]').value,
    }));
    data.departamentos = Array.from(document.querySelectorAll('#departamentos-container > div')).map(row => row.querySelector('[data-key=id]').value);
    data.vehiculos = Array.from(document.querySelectorAll('#vehiculos-container > div')).map(row => ({
        id: row.querySelector('[data-key=id]').value,
        patente: row.querySelector('[data-key=patente]').value,
        marca: row.querySelector('[data-key=marca]').value,
        modelo: row.querySelector('[data-key=modelo]').value,
        tag: row.querySelector('[data-key=tag]').value,
        tipo: row.querySelector('[data-key=tipo]').value,
    }));
    data.contrato = {
        id_contrato_archivo: form.querySelector('[name=id_contrato_archivo]').value,
        fecha_inicio: form.querySelector('[name=fecha_inicio]').value,
    };
    data.estacionamientos = Array.from(document.querySelectorAll('#estacionamientos-container > div')).map(row => row.querySelector('[data-key=id]').value);
    return data;
}

async function handleFormSubmit() {
    const form = document.getElementById('resident-form');
    if (!form) return;

    if (!form.querySelector('[name=nombre_completo]').value || !form.querySelector('[name=rut]').value) {
        showCustomAlert('Validación Fallida', 'El nombre y RUT del residente son obligatorios.');
        return;
    }
    if (document.querySelectorAll('#departamentos-container > div').length === 0) {
        showCustomAlert('Validación Fallida', 'Es obligatorio asignar al menos un departamento.');
        return;
    }
    if (!form.querySelector('[name=id_contrato_archivo]').value) {
        showCustomAlert('Validación Fallida', 'Es obligatorio seleccionar una plantilla de contrato.');
        return;
    }

    const currentData = collectCurrentFormData();
    const dataToSend = JSON.parse(JSON.stringify(currentData));
    dataToSend.residente.rut = dataToSend.residente.rut.replace(/\./g, '').replace('-', '');
    dataToSend.pagadores_secundarios.forEach(p => p.rut = p.rut.replace(/\./g, '').replace('-', ''));
    dataToSend.departamentos = dataToSend.departamentos.map(id => parseInt(id)).filter(Boolean);
    dataToSend.vehiculos.forEach(v => v.id = parseInt(v.id) || null);
    dataToSend.contrato.id_contrato_archivo = dataToSend.contrato.id_contrato_archivo || null;
    dataToSend.estacionamientos = dataToSend.estacionamientos.map(rowId => {
        const estRow = Array.from(document.querySelectorAll('#estacionamientos-container > div')).find(r => r.querySelector('[data-key=id]').value == rowId);
        if (!estRow) return null;
        const boxSelect = estRow.querySelector('.est-box-select');
        return {
            id: parseInt(rowId),
            tipo: estRow.querySelector('.est-tipo-select').value,
            torre: estRow.querySelector('.est-torre-select').value,
            box_numero: boxSelect.options[boxSelect.selectedIndex].text.split(' ')[0]
        };
    }).filter(Boolean);

    const btn = document.getElementById('btn-save');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    const [success, message] = await eel.save_resident_data(dataToSend, currentResidentId)();

    showToast(message, success);
    btn.disabled = false;
    btn.textContent = 'Guardar';

    if (success) {
        loadResidentesList();
        clearFormPanel();
    }
}

function showDbConnectionErrorModal() {
    const overlay = document.getElementById('custom-alert-overlay');
    const titleEl = document.getElementById('alert-title');
    const messageEl = document.getElementById('alert-message');
    const buttonsEl = document.getElementById('alert-buttons');

    titleEl.textContent = '¡Conexión Perdida!';
    messageEl.innerHTML = 'Se ha perdido la conexión con la base de datos. Esto puede ser temporal.';
    buttonsEl.innerHTML = '';

    const exitButton = document.createElement('button');
    exitButton.textContent = 'Salir de la Aplicación';
    exitButton.className = 'btn-cancel bg-red-600 hover:bg-red-700';
    exitButton.onclick = () => window.close();

    const reconnectButton = document.createElement('button');
    reconnectButton.textContent = 'Intentar Reconectar';
    reconnectButton.className = 'btn-login px-6 py-2';
    reconnectButton.onclick = () => {
        overlay.classList.add('hidden');
        loadResidentesList();
    };

    buttonsEl.appendChild(exitButton);
    buttonsEl.appendChild(reconnectButton);
    overlay.classList.remove('hidden');
}