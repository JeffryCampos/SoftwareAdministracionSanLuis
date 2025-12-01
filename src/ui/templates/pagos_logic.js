let allPaymentRecords = [];

function initPagosView() {
    document.getElementById('pago-btn-filtrar').addEventListener('click', loadPaymentHistory);
    document.getElementById('pago-btn-limpiar').addEventListener('click', clearFiltersAndLoad);
    document.getElementById('btn-show-export-modal').addEventListener('click', showExportOptionsModal);
    document.getElementById('btn-create-adjustment').addEventListener('click', showCreateAdjustmentModal);

    loadPaymentHistory();
}

function cleanCLP(value) {
    if (value === null || value === undefined || value === '') return '0';
    return String(value).replace(/\$|\./g, '').replace(/,/g, '.');
}

function formatCLP(value, withSymbol = false) {
    if (value === null || value === undefined || value === '') {
        return withSymbol ? '$0' : '0';
    }
    const number = parseInt(String(value), 10);
    if (isNaN(number)) {
        return withSymbol ? '$0' : '0';
    }
    const formatted = number.toLocaleString('es-CL');
    return withSymbol ? `$${formatted}` : formatted;
}

function applyFormat(input) {
    let originalValue = input.value;
    let cursorPosition = input.selectionStart;
    let isNegative = originalValue.startsWith('-');

    let cleanValue = originalValue.replace(/[^0-9]/g, '');

    if (cleanValue === '') {
        input.value = isNegative ? '-' : '';
        return;
    }

    let formattedValue = formatCLP(cleanValue);

    if (isNegative && formattedValue !== '0') {
        formattedValue = '-' + formattedValue;
    }

    input.value = formattedValue;

    let newLength = input.value.length;
    let originalLength = originalValue.length;
    let cursorOffset = newLength - originalLength;
    let newCursorPosition = cursorPosition + cursorOffset;

    if (newCursorPosition >= 0) {
        input.setSelectionRange(newCursorPosition, newCursorPosition);
    }
}


function clearFiltersAndLoad() {
    document.getElementById('pago-search-residente').value = '';
    document.getElementById('pago-fecha-desde').value = '';
    document.getElementById('pago-fecha-hasta').value = '';
    document.getElementById('pago-tipo').value = '';
    loadPaymentHistory();
}

async function loadPaymentHistory() {
    const tableBody = document.getElementById('pagos-historial-body');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="7" class="text-center py-8"><i class="fas fa-spinner fa-spin fa-3x text-blue-400"></i></td></tr>';

    const filters = {
        residente: document.getElementById('pago-search-residente').value,
        fecha_desde: document.getElementById('pago-fecha-desde').value || null,
        fecha_hasta: document.getElementById('pago-fecha-hasta').value || null,
        tipo: document.getElementById('pago-tipo').value,
    };

    const historyData = await eel.get_payment_history(filters)();

    if (currentViewName !== 'pagos') return;

    if (historyData.error) {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-red-400">${historyData.error}</td></tr>`;
        return;
    }

    allPaymentRecords = historyData.records;
    renderPaymentTable(allPaymentRecords);
    updateSummary(historyData.summary);
}

function renderPaymentTable(records) {
    const tableBody = document.getElementById('pagos-historial-body');

    if (!records || records.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center py-8">No se encontraron registros con los filtros seleccionados.</td></tr>';
        allPaymentRecords = [];
        return;
    }

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const [year, month, day] = dateString.split(' ')[0].split('-');
        return `${day}/${month}/${year}`;
    };

    const formatPeriod = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString + 'T00:00:00');
        return date.toLocaleString('es-CL', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase());
    };

    const rowsHtml = records.map(rec => {
        const isAdjustment = rec.estado === 'Ajuste';
        let periodoDisplay = isAdjustment ? (rec.observaciones || 'Ajuste').split('\n')[0] : formatPeriod(rec.periodo);

        return `
            <tr class="${isAdjustment ? 'bg-yellow-900 bg-opacity-30' : ''}">
                <td class="px-6 py-4">
                    <div class="font-medium">${rec.residente_nombre}</div>
                    <div class="text-xs text-gray-400">${formatRutString(rec.residente_rut)}</div>
                </td>
                <td class="px-6 py-4">${periodoDisplay}</td>
                <td class="px-6 py-4 text-center">${formatDate(rec.fecha_pago)}</td>
                <td class="px-6 py-4 text-right">${isAdjustment ? '-' : formatCLP(rec.monto_arriendo, true)}</td>
                <td class="px-6 py-4 text-right">${isAdjustment ? '-' : formatCLP(rec.monto_multa, true)}</td>
                <td class="px-6 py-4 text-right font-bold ${isAdjustment && parseFloat(rec.monto_pagado) < 0 ? 'text-red-400' : ''}">${formatCLP(rec.monto_pagado, true)}</td>
                <td class="px-6 py-4 text-center">
                    <button onclick="showEditPaymentModal(${rec.id})" class="text-blue-400 hover:text-blue-300" title="Editar Registro">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    tableBody.innerHTML = rowsHtml;
}

function updateSummary(summary) {
    document.getElementById('summary-total-arriendo').textContent = formatCLP(summary.total_arriendo, true);
    document.getElementById('summary-total-multas').textContent = formatCLP(summary.total_multas, true);
    document.getElementById('summary-total-ajustes').textContent = formatCLP(summary.total_ajustes, true);
    document.getElementById('summary-total-general').textContent = formatCLP(summary.total_general, true);
}

function showEditPaymentModal(paymentId) {
    const record = allPaymentRecords.find(rec => rec.id === paymentId);
    if (!record) return;

    const isAdjustment = record.estado === 'Ajuste';

    const modalHTML = `
        <div class="space-y-4">
            <div class="p-3 border border-gray-600 rounded-lg bg-gray-900 bg-opacity-50">
                <p><strong>Residente:</strong> ${record.residente_nombre}</p>
                <p><strong>Período:</strong> ${isAdjustment ? 'N/A (Ajuste)' : new Date(record.periodo + 'T00:00:00').toLocaleString('es-CL', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}</p>
                <p><strong>Fecha de Registro:</strong> ${new Date(record.fecha_pago).toLocaleDateString('es-CL')}</p>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label for="modal-monto-arriendo" class="block text-sm font-medium text-gray-300 mb-1">Monto Arriendo</label>
                    <input type="text" id="modal-monto-arriendo" class="input-field w-full text-right" value="${formatCLP(record.monto_arriendo)}" ${isAdjustment ? 'disabled' : ''} oninput="applyFormat(this)">
                </div>
                <div>
                    <label for="modal-monto-multa" class="block text-sm font-medium text-gray-300 mb-1">Monto Multa</label>
                    <input type="text" id="modal-monto-multa" class="input-field w-full text-right" value="${formatCLP(record.monto_multa)}" ${isAdjustment ? 'disabled' : ''} oninput="applyFormat(this)">
                </div>
                <div>
                    <label for="modal-total-pagado" class="block text-sm font-medium text-gray-300 mb-1">Total Pagado</label>
                    <input type="text" id="modal-total-pagado" class="input-field w-full text-right" value="${formatCLP(record.monto_pagado)}" oninput="applyFormat(this)">
                </div>
            </div>

            <div>
                <label for="modal-observaciones" class="block text-sm font-medium text-gray-300 mb-1">Observaciones</label>
                <textarea id="modal-observaciones" class="input-field w-full" rows="3">${record.observaciones || ''}</textarea>
            </div>

            <div class="border-t border-gray-700 pt-4">
                 <label class="block text-sm font-medium text-red-400 mb-2">Zona Peligrosa</label>
                 <button id="modal-btn-delete" class="btn-cancel bg-red-600 hover:bg-red-700 w-full">Eliminar este registro de pago</button>
            </div>
        </div>
    `;

    const confirmButton = document.createElement('button');
    confirmButton.textContent = 'Guardar Cambios';
    confirmButton.className = 'btn-login px-6 py-2';

    const resultPromise = showCustomConfirmWithContent('Editar Registro de Pago', modalHTML, confirmButton, 'Cancelar');

    resultPromise.then(result => {
        if (result.confirmed) {
            handleUpdatePayment(record.id, isAdjustment);
        }
    });

    document.getElementById('modal-btn-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('custom-alert-overlay').classList.add('hidden');
        confirmDeletePayment(paymentId);
    });
}

async function handleUpdatePayment(paymentId, isAdjustment) {
    const data = {
        monto_arriendo: isAdjustment ? '0' : cleanCLP(document.getElementById('modal-monto-arriendo').value),
        monto_multa: isAdjustment ? '0' : cleanCLP(document.getElementById('modal-monto-multa').value),
        monto_pagado: cleanCLP(document.getElementById('modal-total-pagado').value),
        observaciones: document.getElementById('modal-observaciones').value,
    };

    const [success, message] = await eel.update_payment_record(paymentId, data)();
    showToast(message, success);
    if (success) {
        document.getElementById('custom-alert-overlay').classList.add('hidden');
        loadPaymentHistory();
    }
}

async function showCreateAdjustmentModal() {
    const residents = await eel.get_all_active_residents_for_dropdown()();
    if (!residents || residents.length === 0) {
        showCustomAlert("Error", "No hay residentes activos para crear un ajuste.");
        return;
    }

    const residentOptions = residents.map(r => `<option value="${r.id}">${r.nombre_completo} (${r.rut})</option>`).join('');

    const modalHTML = `
        <div class="space-y-4">
            <div>
                <label for="adj-residente" class="block text-sm font-medium text-gray-300 mb-1">Residente</label>
                <select id="adj-residente" class="input-field w-full" placeholder="Buscar residente...">${residentOptions}</select>
            </div>
             <div>
                <label for="adj-periodo" class="block text-sm font-medium text-gray-300 mb-1">Período de Aplicación</label>
                <input type="month" id="adj-periodo" class="input-field w-full">
            </div>
            <div>
                <label for="adj-monto" class="block text-sm font-medium text-gray-300 mb-1">Monto del Ajuste</label>
                <input type="text" id="adj-monto" class="input-field w-full text-right" placeholder="Ej: 5.000 (cobro) o -2.500 (crédito)" oninput="applyFormat(this)">
            </div>
            <div>
                <label for="adj-observaciones" class="block text-sm font-medium text-gray-300 mb-1">Justificación (Obligatorio)</label>
                <textarea id="adj-observaciones" class="input-field w-full" rows="3" placeholder="Ej: Crédito por pago adelantado."></textarea>
            </div>
        </div>
    `;

    const confirmButton = document.createElement('button');
    confirmButton.textContent = 'Crear Ajuste';
    confirmButton.className = 'btn-login px-6 py-2';

    showCustomConfirmWithContent('Crear Nuevo Ajuste', modalHTML, confirmButton, 'Cancelar');

    // Sobrescribir el onclick para manejar la validación y evitar el cierre automático
    confirmButton.onclick = handleCreateAdjustment;

    new Choices('#adj-residente', {
        searchPlaceholderValue: "Escribe para buscar...",
        itemSelectText: "Presiona para seleccionar",
        noResultsText: 'No se encontraron resultados',
        shouldSort: false,
    });
}

async function handleCreateAdjustment() {
    const residentId = document.getElementById('adj-residente').value;
    const periodoInput = document.getElementById('adj-periodo').value;
    const monto = document.getElementById('adj-monto').value;
    const observaciones = document.getElementById('adj-observaciones').value;

    if (!residentId || !periodoInput || !monto || !observaciones) {
        showToast("Todos los campos son obligatorios.", false);
        return;
    }
    const periodo = `${periodoInput}-01`;
    const montoLimpio = cleanCLP(monto);

    const [success, message] = await eel.create_payment_adjustment(residentId, periodo, montoLimpio, observaciones)();
    showToast(message, success);
    if (success) {
        document.getElementById('custom-alert-overlay').classList.add('hidden');
        loadPaymentHistory();
    }
}


async function confirmDeletePayment(paymentId) {
    const record = allPaymentRecords.find(rec => rec.id === paymentId);
    if (!record) return;

    const confirmationMessage = `
        <p class="mb-4">¿Está seguro de que desea eliminar este registro de pago de forma permanente?</p>
        <div class="text-left p-3 border border-gray-600 rounded-lg bg-gray-900 bg-opacity-50">
            <p><strong>Residente:</strong> ${record.residente_nombre}</p>
            <p><strong>Total:</strong> ${formatCLP(record.monto_pagado, true)}</p>
            <p><strong>Fecha:</strong> ${new Date(record.fecha_pago).toLocaleDateString('es-CL')}</p>
        </div>
        <p class="mt-4 text-yellow-400"><i class="fas fa-exclamation-triangle mr-2"></i><b>Advertencia:</b> Esta acción no se puede deshacer.</p>
    `;

    const result = await showCustomConfirmWithContent('Confirmar Eliminación', confirmationMessage, 'Eliminar Permanentemente', 'Cancelar');
    if (result.confirmed) {
        const [success, message] = await eel.delete_payment_record(paymentId)();
        showToast(message, success);
        if (success) {
            loadPaymentHistory();
        }
    }
}

function showCustomConfirmWithContent(title, contentHTML, confirmButton, cancelText) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('custom-alert-overlay');
        const titleEl = document.getElementById('alert-title');
        const messageEl = document.getElementById('alert-message');
        const buttonsEl = document.getElementById('alert-buttons');

        titleEl.textContent = title;
        messageEl.innerHTML = contentHTML;
        buttonsEl.innerHTML = '';

        const cancelButton = document.createElement('button');
        cancelButton.textContent = cancelText || 'Cancelar';
        cancelButton.className = 'btn-cancel';
        cancelButton.onclick = () => { overlay.classList.add('hidden'); resolve({ confirmed: false }); };

        buttonsEl.appendChild(cancelButton);

        let confirmBtn;
        if (typeof confirmButton === 'string') {
            confirmBtn = document.createElement('button');
            confirmBtn.textContent = confirmButton;
            confirmBtn.className = 'btn-login px-6 py-2';
        } else {
            confirmBtn = confirmButton;
        }

        confirmBtn.onclick = () => {
            overlay.classList.add('hidden');
            resolve({ confirmed: true });
        };
        buttonsEl.appendChild(confirmBtn);

        overlay.classList.remove('hidden');
    });
}

async function showExportOptionsModal() {
    const modalHTML = `
        <div class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-300 mb-1">¿Qué datos desea exportar?</label>
                <select id="export-type" class="input-field w-full">
                    <option value="current">Vista Actual (con filtros de pantalla)</option>
                    <option value="full_range">Historial Completo (por rango de fechas)</option>
                    <option value="full_all">Historial Completo (sin filtros)</option>
                </select>
            </div>
            <div id="export-date-range" class="hidden grid grid-cols-2 gap-4">
                <div>
                    <label for="export-fecha-desde" class="block text-sm font-medium text-gray-300 mb-1">Desde</label>
                    <input type="date" id="export-fecha-desde" class="input-field w-full">
                </div>
                <div>
                    <label for="export-fecha-hasta" class="block text-sm font-medium text-gray-300 mb-1">Hasta</label>
                    <input type="date" id="export-fecha-hasta" class="input-field w-full">
                </div>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-300 mb-1">Formato</label>
                <select id="export-format" class="input-field w-full">
                    <option value="excel">Excel (.xlsx)</option>
                    <option value="pdf">PDF (.pdf)</option>
                    <option value="csv">CSV (.csv)</option>
                </select>
            </div>
        </div>`;

    const resultPromise = showCustomConfirmWithContent('Opciones de Exportación', modalHTML, 'Generar Reporte', 'Cancelar');

    const exportTypeSelect = document.getElementById('export-type');
    const dateRangeDiv = document.getElementById('export-date-range');
    exportTypeSelect.addEventListener('change', () => {
        dateRangeDiv.classList.toggle('hidden', exportTypeSelect.value !== 'full_range');
    });

    const result = await resultPromise;
    if (result.confirmed) {
        const exportType = document.getElementById('export-type').value;
        const format = document.getElementById('export-format').value;
        const fechaDesde = document.getElementById('export-fecha-desde').value || null;
        const fechaHasta = document.getElementById('export-fecha-hasta').value || null;

        handleExport(exportType, format, { fecha_desde: fechaDesde, fecha_hasta: fechaHasta });
    }
}

async function handleExport(exportType, format, dateRange) {
    const btn = document.getElementById('btn-show-export-modal');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Generando...';

    let file_b64;
    let fileName;
    const timestamp = new Date().toISOString().slice(0, 10);
    let filters = {};

    try {
        if (exportType === 'current') {
            if (allPaymentRecords.length === 0) {
                showToast("No hay datos en la vista actual para exportar.", false);
                return;
            }
            if (format === 'excel') {
                file_b64 = await eel.export_payment_history_to_excel(allPaymentRecords)();
                fileName = `Vista_Actual_Pagos_${timestamp}.xlsx`;
            } else if (format === 'pdf') {
                file_b64 = await eel.export_payment_history_to_pdf(allPaymentRecords)();
                fileName = `Vista_Actual_Pagos_${timestamp}.pdf`;
            } else {
                file_b64 = await eel.export_payment_history_to_csv(allPaymentRecords)();
                fileName = `Vista_Actual_Pagos_${timestamp}.csv`;
            }
        } else {
            if (exportType === 'full_range') {
                filters = dateRange;
                fileName = `Historial_por_Fechas_${timestamp}`;
            } else {
                fileName = `Historial_Completo_${timestamp}`;
            }

            if (format === 'excel') {
                file_b64 = await eel.export_full_history_to_excel(filters)();
                fileName += '.xlsx';
            } else if (format === 'pdf') {
                file_b64 = await eel.export_full_history_to_pdf(filters)();
                fileName += '.pdf';
            } else {
                file_b64 = await eel.export_full_history_to_csv(filters)();
                fileName += '.csv';
            }
        }

        if (file_b64) {
            let mimeType = 'text/csv;charset=utf-8;';
            if (format === 'excel') {
                mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            } else if (format === 'pdf') {
                mimeType = 'application/pdf';
            }
            const byteCharacters = atob(file_b64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mimeType });

            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast("Exportación generada con éxito.", true);
        } else {
            showToast("No se encontraron datos para exportar con los criterios seleccionados.", false);
        }

    } catch (error) {
        showToast("Ocurrió un error inesperado durante la exportación.", false);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-file-export mr-2"></i>Exportar';
    }
}