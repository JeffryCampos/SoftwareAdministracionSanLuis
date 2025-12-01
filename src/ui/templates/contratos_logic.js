let currentContractId = null;
let selectedFileContentB64 = null;

const contractFormFieldsHTML = `
    <div class="overflow-y-auto flex-grow pr-2 rounded-lg space-y-4">
        <div class="form-group">
            <h3 class="group-title">Información y Precios</h3>
            <div class="grid grid-cols-2 gap-4 p-4">
                <div class="col-span-2">
                    <label class="block text-sm font-medium text-gray-300 mb-1">Nombre de la Plantilla</label>
                    <input type="text" id="nombre_contrato" class="input-field w-full" placeholder="Ej: Contrato General 2025">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-1">Precio 1er Auto</label>
                    <input type="text" id="p1_auto" class="input-field w-full" placeholder="50.000">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-1">Precio 2do Auto</label>
                    <input type="text" id="p2_auto" class="input-field w-full" placeholder="45.000">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-1">Precio 1ra Moto</label>
                    <input type="text" id="p1_moto" class="input-field w-full" placeholder="30.000">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-1">Precio 2da Moto</label>
                    <input type="text" id="p2_moto" class="input-field w-full" placeholder="25.000">
                </div>
                 <div class="col-span-2">
                    <label class="block text-sm font-medium text-gray-300 mb-1">Valor Multa (UF)</label>
                    <input type="text" id="multa" class="input-field w-full" placeholder="1.5">
                </div>
            </div>
        </div>
    </div>
`;

const contractPlaceholderHTML = `<div class="h-full flex flex-col justify-center items-center text-center"><i class="fas fa-file-alt fa-3x text-gray-500 mb-4"></i><p class="text-gray-400">Seleccione un contrato para ver sus detalles o haga clic en 'Añadir Plantilla'.</p></div>`;
const contractSpinnerHTML = `<div class="h-full flex flex-col justify-center items-center"><i class="fas fa-spinner fa-spin fa-3x text-blue-400"></i><p class="mt-4 text-white">Cargando...</p></div>`;

function formatCLP(numberString, showCurrency = false) {
    if (!numberString) return '';
    try {
        let number = parseFloat(numberString);
        if (isNaN(number)) return '';

        let options = {
            style: showCurrency ? 'currency' : 'decimal',
            currency: 'CLP',
            minimumFractionDigits: 0,
            maximumFractionDigits: (number % 1 === 0) ? 0 : 2
        };

        let formatted = number.toLocaleString('es-CL', options);

        if (showCurrency) {
            return formatted;
        } else {
            return formatted;
        }

    } catch (e) {
        return numberString;
    }
}

function cleanCLP(value) {
    // Si el valor es nulo o indefinido, retornar cadena vacía
    if (!value) return '';

    // Asegurarse de que sea string
    value = String(value);

    // Eliminar símbolos de moneda y espacios
    value = value.replace('$', '').replace(/\s/g, '');

    // En formato chileno: punto (.) es separador de miles, coma (,) es decimal
    // Primero eliminamos los puntos (separadores de miles)
    value = value.replace(/\./g, '');

    // Luego convertimos la coma en punto (para que sea un decimal válido en JS)
    value = value.replace(/,/g, '.');

    // Eliminamos cualquier carácter que no sea número o punto decimal
    value = value.replace(/[^0-9.]/g, '');

    // Asegurarnos de que solo haya un punto decimal
    const parts = value.split('.');
    if (parts.length > 2) {
        value = parts[0] + '.' + parts.slice(1).join('');
    }

    return value;
}

function applyFormat(input) {
    let rawValue = cleanCLP(input.value);
    input.value = formatCLP(rawValue, false);
}

function clearContractFormPanel() {
    document.getElementById('form-title').textContent = 'Panel de Contratos';
    document.getElementById('form-content-area').innerHTML = contractPlaceholderHTML;
    document.getElementById('form-actions').innerHTML = '';
    currentContractId = null;
    updateContractRowSelection(null);
}

function updateContractRowSelection(contractId) {
    document.getElementById('contractsTableBody').querySelectorAll('tr').forEach(row => row.classList.remove('selected-row'));
    if (contractId) {
        const selectedRow = document.getElementById(`contract-row-${contractId}`);
        if (selectedRow) selectedRow.classList.add('selected-row');
    }
}

function initContratosView() {
    clearContractFormPanel();
    loadContractTemplates();
}

async function showAddView() {
    currentContractId = null;
    updateContractRowSelection(null);

    document.getElementById('form-title').textContent = 'Añadir Nueva Plantilla';
    // Agregamos el input file oculto y cambiamos el onclick del botón
    document.getElementById('form-content-area').innerHTML = contractFormFieldsHTML + `
        <div class="form-group p-4 space-y-3 mt-4">
            <input type="file" id="pdf-upload-input" accept=".pdf" style="display: none;" onchange="handleFileSelect(this)">
            <button onclick="document.getElementById('pdf-upload-input').click()" class="btn-login w-full text-center cursor-pointer">📁 Seleccionar Archivo PDF</button>
            <p id="file-name-label" class="text-center text-gray-400 italic">Ningún archivo seleccionado</p>
        </div>`;
    document.getElementById('form-actions').innerHTML = `
        <button onclick="clearContractFormPanel()" class="btn-cancel">Cancelar</button>
        <button onclick="handleUpload()" class="btn-login bg-green-600 hover:bg-green-700">📤 Subir Nueva Plantilla</button>
    `;

    document.getElementById('p1_auto').oninput = function () { applyFormat(this); };
    document.getElementById('p2_auto').oninput = function () { applyFormat(this); };
    document.getElementById('p1_moto').oninput = function () { applyFormat(this); };
    document.getElementById('p2_moto').oninput = function () { applyFormat(this); };

    document.getElementById('multa').oninput = function () {
        this.value = this.value.replace(/[^0-9,.]/g, '');
    };
}

async function handleFileSelect(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];

        // Validar que sea PDF
        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            showCustomAlert('Archivo Inválido', 'Por favor seleccione un archivo PDF.');
            input.value = ''; // Limpiar selección
            return;
        }

        const fileName = file.name;
        document.getElementById('file-name-label').textContent = fileName;

        // Auto-llenar nombre si está vacío
        let contractNameInput = document.getElementById('nombre_contrato');
        if (!contractNameInput.value) {
            contractNameInput.value = fileName.replace(/\.pdf$/i, '');
        }

        // Leer el archivo a Base64 usando FileReader
        const reader = new FileReader();
        reader.onload = function (e) {
            // El resultado viene como "data:application/pdf;base64,....."
            // Necesitamos extraer solo la parte base64 después de la coma
            const base64String = e.target.result.split(',')[1];
            selectedFileContentB64 = base64String;
        };
        reader.onerror = function (error) {
            console.error('Error al leer el archivo:', error);
            showCustomAlert('Error', 'No se pudo leer el archivo seleccionado.');
            selectedFileContentB64 = null;
        };
        reader.readAsDataURL(file);
    }
}

async function showEditView(contractId) {
    currentContractId = contractId;
    updateContractRowSelection(contractId);

    document.getElementById('form-title').textContent = 'Editar Plantilla';
    document.getElementById('form-content-area').innerHTML = contractSpinnerHTML;
    document.getElementById('form-actions').innerHTML = '';

    const details = await eel.get_contract_template_details(contractId)();
    if (details) {
        document.getElementById('form-content-area').innerHTML = contractFormFieldsHTML;

        document.getElementById('nombre_contrato').value = details.nombre_contrato || '';
        document.getElementById('p1_auto').value = formatCLP(details.precio_primer_estacionamiento_auto, false);
        document.getElementById('p2_auto').value = formatCLP(details.precio_segundo_estacionamiento_auto, false);
        document.getElementById('p1_moto').value = formatCLP(details.precio_estacionamiento_moto, false);
        document.getElementById('p2_moto').value = formatCLP(details.precio_segundo_estacionamiento_moto, false);
        document.getElementById('multa').value = details.precio_multa_uf || '';

        document.getElementById('p1_auto').oninput = function () { applyFormat(this); };
        document.getElementById('p2_auto').oninput = function () { applyFormat(this); };
        document.getElementById('p1_moto').oninput = function () { applyFormat(this); };
        document.getElementById('p2_moto').oninput = function () { applyFormat(this); };
        document.getElementById('multa').oninput = function () {
            this.value = this.value.replace(/[^0-9,.]/g, '');
        };

        document.getElementById('form-actions').innerHTML = `
            <button onclick="showContractDetailsView(${contractId})" class="btn-cancel">Cancelar</button>
            <button onclick="handleUpdate()" class="btn-login">💾 Guardar Cambios</button>
        `;
    } else {
        document.getElementById('form-content-area').innerHTML = `<p class="text-red-400">Error al cargar datos para editar.</p>`;
    }
}

async function showContractDetailsView(contractId) {
    currentContractId = contractId;
    updateContractRowSelection(contractId);

    document.getElementById('form-title').textContent = 'Detalles de la Plantilla';
    document.getElementById('form-content-area').innerHTML = contractSpinnerHTML;
    document.getElementById('form-actions').innerHTML = '';

    const details = await eel.get_contract_template_details(contractId)();

    if (details) {
        const formatPriceDisplay = (price) => price ? formatCLP(price, true) : 'No definido';
        const detailsHTML = `
            <div class="space-y-4 text-white">
                <div class="form-group p-4">
                    <h3 class="group-title">Información General</h3>
                    <div class="p-4 space-y-2">
                        <p><strong class="font-semibold text-gray-400 w-40 inline-block">Nombre:</strong> ${details.nombre_contrato || 'N/A'}</p>
                        <p><strong class="font-semibold text-gray-400 w-40 inline-block">Archivo:</strong> ${details.nombre_archivo || 'N/A'}</p>
                    </div>
                </div>
                <div class="form-group p-4">
                    <h3 class="group-title">Precios Base</h3>
                     <div class="p-4 grid grid-cols-2 gap-2">
                        <p><strong class="font-semibold text-gray-400">1er Auto:</strong> ${formatPriceDisplay(details.precio_primer_estacionamiento_auto)}</p>
                        <p><strong class="font-semibold text-gray-400">2do Auto:</strong> ${formatPriceDisplay(details.precio_segundo_estacionamiento_auto)}</p>
                        <p><strong class="font-semibold text-gray-400">1ra Moto:</strong> ${formatPriceDisplay(details.precio_estacionamiento_moto)}</p>
                        <p><strong class="font-semibold text-gray-400">2da Moto:</strong> ${formatPriceDisplay(details.precio_segundo_estacionamiento_moto)}</p>
                    </div>
                </div>
                <div class="form-group p-4">
                     <h3 class="group-title">Multas</h3>
                      <div class="p-4">
                        <p><strong class="font-semibold text-gray-400">Valor Multa:</strong> ${details.precio_multa_uf || 'No definido'} UF</p>
                      </div>
                </div>
            </div>`;
        document.getElementById('form-content-area').innerHTML = detailsHTML;
        document.getElementById('form-actions').innerHTML = `
            <button onclick="clearContractFormPanel()" class="btn-cancel">Cerrar</button>
            <button onclick="showEditView(${contractId})" class="btn-login">Editar</button>
        `;
    } else {
        document.getElementById('form-content-area').innerHTML = `<p class="text-red-400">Error al cargar los detalles del contrato.</p>`;
    }
}

async function loadContractTemplates() {
    const tableBody = document.getElementById('contractsTableBody');
    tableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4"><i class="fas fa-spinner fa-spin fa-2x text-blue-400"></i></td></tr>';

    try {
        const templates = await eel.get_contract_templates_list()();

        if (currentViewName !== 'contratos') {
            return;
        }

        tableBody.innerHTML = '';

        if (!templates || templates.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4">No hay plantillas de contrato.</td></tr>';
            return;
        }

        const rowsHtml = templates.map(t => {
            let fechaFormateada = t.fecha_subida || 'N/A';

            if (t.fecha_subida && t.fecha_subida.includes('-')) {
                const parts = t.fecha_subida.split('-');
                fechaFormateada = `${parts[2]}/${parts[1]}/${parts[0]}`;
            }

            return `
                <tr id="contract-row-${t.id}" class="cursor-pointer hover:bg-gray-700" onclick="showContractDetailsView(${t.id})">
                    <td class="px-6 py-4 whitespace-nowrap">${t.nombre_contrato || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap">${t.nombre_archivo || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-center">${fechaFormateada}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <button onclick="event.stopPropagation(); showEditView(${t.id})" class="text-blue-400 hover:text-blue-300" title="Editar"><i class="fas fa-edit"></i></button>
                        <button onclick="event.stopPropagation(); handleView(${t.id})" class="text-green-400 hover:text-green-300" title="Ver PDF"><i class="fas fa-eye"></i></button>
                        <button onclick="event.stopPropagation(); handleDownload(${t.id})" class="text-indigo-400 hover:text-indigo-300" title="Descargar PDF"><i class="fas fa-download"></i></button>
                        <button onclick="event.stopPropagation(); handleDelete(${t.id}, '${t.nombre_contrato.replace(/'/g, "\\'")}')" class="text-red-500 hover:text-red-400" title="Eliminar"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
        tableBody.innerHTML = rowsHtml;
        updateContractRowSelection(currentContractId);
    } catch (error) {
        if (currentViewName !== 'contratos') return;
        console.error("Error al cargar las plantillas:", error);
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-red-400">Error al mostrar los datos.</td></tr>';
    }
}

// Función triggerFileSelect antigua eliminada/reemplazada por handleFileSelect
function triggerFileSelect() {
    // Mantener por compatibilidad si algo lo llama, pero redirigir al input
    const input = document.getElementById('pdf-upload-input');
    if (input) input.click();
}

async function handleUpload() {
    const inputP1Auto = document.getElementById('p1_auto');
    const inputP2Auto = document.getElementById('p2_auto');
    const inputP1Moto = document.getElementById('p1_moto');
    const inputP2Moto = document.getElementById('p2_moto');
    const inputMulta = document.getElementById('multa');

    const data = {
        nombre_contrato: document.getElementById('nombre_contrato').value,
        p1_auto: cleanCLP(inputP1Auto.value),
        p2_auto: cleanCLP(inputP2Auto.value),
        p1_moto: cleanCLP(inputP1Moto.value),
        p2_moto: cleanCLP(inputP2Moto.value),
        multa: inputMulta.value.replace(',', '.'),
        file_content_b64: selectedFileContentB64,
        nombre_archivo: document.getElementById('file-name-label').textContent
    };
    if (!data.nombre_contrato || !data.file_content_b64) {
        showCustomAlert('Datos Incompletos', 'Debe proporcionar un nombre y seleccionar un archivo PDF.');
        return;
    }
    const [success, message] = await eel.save_contract_template_data(data)();
    showToast(message, success);
    if (success) {
        loadContractTemplates();
        clearContractFormPanel();
    }
}

async function handleUpdate() {
    if (!currentContractId) return;

    const inputP1Auto = document.getElementById('p1_auto');
    const inputP2Auto = document.getElementById('p2_auto');
    const inputP1Moto = document.getElementById('p1_moto');
    const inputP2Moto = document.getElementById('p2_moto');
    const inputMulta = document.getElementById('multa');

    const data = {
        nombre_contrato: document.getElementById('nombre_contrato').value,
        p1_auto: cleanCLP(inputP1Auto.value),
        p2_auto: cleanCLP(inputP2Auto.value),
        p1_moto: cleanCLP(inputP1Moto.value),
        p2_moto: cleanCLP(inputP2Moto.value),
        multa: inputMulta.value.replace(',', '.'),
    };

    if (!data.nombre_contrato) {
        showCustomAlert('Datos Incompletos', 'El nombre no puede estar vacío.');
        return;
    }
    const [success, message] = await eel.save_contract_template_data(data, currentContractId)();
    showToast(message, success);
    if (success) {
        showToast(message, success);
        if (success) {
            loadContractTemplates();
            clearContractFormPanel();
        }
    }
}

async function handleDelete(templateId, templateName) {
    const confirmed = await showCustomConfirm('Confirmar Eliminación', `¿Está seguro de que desea eliminar la plantilla "${templateName}"?`);
    if (confirmed) {
        const [success, message] = await eel.delete_contract_template_by_id(templateId)();
        showToast(message, success);
        if (success) {
            loadContractTemplates();
            clearContractFormPanel();
        }
    }
}

async function handleView(templateId) {
    const fileData = await eel.get_contract_file_data(templateId)();
    if (!fileData) {
        showCustomAlert('Error', 'No se pudo obtener el archivo del contrato.');
        return;
    }
    const byteCharacters = atob(fileData.datos_archivo);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 100);
}

async function handleDownload(templateId) {
    showToast("Preparando descarga...", true);
    try {
        const response = await eel.download_contract_file(templateId)();

        if (response.success) {
            const link = document.createElement('a');
            link.href = `data:application/pdf;base64,${response.content_b64}`;
            link.download = response.filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast("Descarga iniciada.", true);
        } else {
            showToast(response.message, false);
        }
    } catch (error) {
        console.error("Error en descarga:", error);
        showToast("Error al intentar descargar el archivo.", false);
    }
}