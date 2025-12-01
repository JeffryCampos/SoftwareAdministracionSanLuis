let allResidents = [];
let currentSortColumn = 'nombre_completo';
let currentSortDirection = 'asc';

async function initEstadoView() {
    const searchInput = document.getElementById('residentSearchInput');
    searchInput.addEventListener('input', renderResidentsList);
    
    try {
        const ufInfo = await eel.get_uf_info()();
        if (ufInfo) {
            updateUfDisplay(ufInfo);
        }
    } catch (e) {
        console.error("No se pudo cargar la info de la UF inicialmente.", e);
    }
    
    loadResidentsList();
}

function updateUfDisplay(data) {
    const dateDisplay = document.getElementById('current-date-display');
    const ufDisplay = document.getElementById('current-uf-display');
    
    if (dateDisplay) {
        dateDisplay.textContent = data.current_date;
    }
    if (ufDisplay) {
        const ufValue = parseFloat(data.uf_value);
        ufDisplay.textContent = `$${ufValue.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
}

async function loadResidentsList() {
    const tableBody = document.getElementById('residentes-list-body');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4"><i class="fas fa-spinner fa-spin fa-2x text-blue-400"></i></td></tr>';
    
    try {
        const data = await eel.get_resident_status_list()();

        if (currentViewName !== 'estado') {
            return;
        }

        if (data && !data.error) {
            allResidents = data.status_list;
            if (data.uf_info) updateUfDisplay(data.uf_info);
            sortResidents(currentSortColumn, true);
        } else {
             if (currentViewName === 'estado') tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-red-400">Error al cargar la lista.</td></tr>';
        }
    } catch (e) {
        if (currentViewName === 'estado') tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-red-400">Error de conexión.</td></tr>';
    }
}

function sortResidents(column, maintainDirection = false) {
    if (!maintainDirection) {
        if (currentSortColumn === column) {
            currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            currentSortColumn = column;
            currentSortDirection = 'asc';
        }
    }

    allResidents.sort((a, b) => {
        let valA = a[column];
        let valB = b[column];
        let comparison = 0;

        if (typeof valA === 'string') {
            comparison = valA.localeCompare(valB);
        } else {
            comparison = valA - valB;
        }
        
        return currentSortDirection === 'asc' ? comparison : -comparison;
    });

    renderResidentsList();
}

function renderResidentsList() {
    const tableBody = document.getElementById('residentes-list-body');
    const filterInput = document.getElementById('residentSearchInput');
    if (!tableBody || !filterInput) return;
    const filter = filterInput.value.toLowerCase();

    const filteredResidents = allResidents.filter(r => 
        r.nombre_completo.toLowerCase().includes(filter) || (r.rut && r.rut.toLowerCase().includes(filter))
    );

    const rowsHtml = filteredResidents.map(resident => {
        let statusBadgeClass = 'status-al-dia';
        if (resident.estado === 'Atrasado') {
            statusBadgeClass = 'status-atrasado';
        } else if (resident.estado === 'Pendiente') {
            statusBadgeClass = 'status-pendiente';
        } else if (resident.estado === 'Monto Pendiente') {
            statusBadgeClass = 'status-monto-pendiente';
        } else if (resident.estado === 'Adelantado') {
            statusBadgeClass = 'status-adelantado';
        }

        return `
        <tr id="resident-row-${resident.id_residente}" class="cursor-pointer hover:bg-gray-700" onclick="loadPaymentDetails(${resident.id_residente})">
            <td class="px-6 py-4">
                <div class="font-medium">${resident.nombre_completo}</div>
                <div class="text-xs text-gray-400">${formatRutString(resident.rut)}</div>
            </td>
            <td class="px-6 py-4">${resident.nombre_contrato || 'N/A'}</td>
            <td class="px-6 py-4 text-center">${resident.dia_pago}</td>
            <td class="px-6 py-4 text-center">${resident.dias_atraso}</td>
            <td class="px-6 py-4 text-center">
                <span class="status-badge ${statusBadgeClass}">${resident.estado}</span>
            </td>
        </tr>
        `;
    }).join('');
    
    tableBody.innerHTML = rowsHtml || '<tr><td colspan="5" class="text-center py-4">No se encontraron residentes.</td></tr>';
    if (currentResidentId) {
        const activeRow = document.getElementById(`resident-row-${currentResidentId}`);
        if (activeRow) activeRow.classList.add('selected-row');
    }
}

function resetPaymentView() {
    document.getElementById('payment-details-wrapper').classList.add('hidden');
    const placeholder = document.getElementById('payment-placeholder');
    placeholder.classList.remove('hidden');
    placeholder.innerHTML = `<i class="fas fa-hand-pointer fa-3x mb-4"></i><p>Seleccione un residente de la lista para gestionar sus pagos.</p>`;
}

async function loadPaymentDetails(residentId) {
    if (currentResidentId) {
        const oldRow = document.getElementById(`resident-row-${currentResidentId}`);
        if(oldRow) oldRow.classList.remove('selected-row');
    }
    currentResidentId = residentId;
    const newRow = document.getElementById(`resident-row-${currentResidentId}`);
    if(newRow) newRow.classList.add('selected-row');

    const wrapper = document.getElementById('payment-details-wrapper');
    const placeholder = document.getElementById('payment-placeholder');
    const header = document.getElementById('payment-details-header');
    const list = document.getElementById('payment-details-list');
    const footer = document.getElementById('payment-details-footer');

    placeholder.innerHTML = `<div class="h-full flex flex-col justify-center items-center"><i class="fas fa-spinner fa-spin fa-3x text-blue-400"></i><p class="mt-4 text-white">Cargando Deudas...</p></div>`;
    wrapper.classList.add('hidden');
    placeholder.classList.remove('hidden');

    header.innerHTML = '';
    list.innerHTML = '';
    footer.innerHTML = '';

    const debtDetails = await eel.get_resident_debt_details(residentId)();

    if (currentViewName !== 'estado') return;

    if (!debtDetails || debtDetails.error) {
        placeholder.innerHTML = `<p class="text-red-400">Error al cargar los detalles.</p>`;
        return;
    }

    const formatNumber = (numStr) => {
        const num = parseFloat(numStr);
        return isNaN(num) ? '0' : num.toLocaleString('es-CL');
    };

    const hasDebts = debtDetails.meses_adeudados && debtDetails.meses_adeudados.length > 0;
    const hasFutureMonths = debtDetails.meses_futuros_disponibles && debtDetails.meses_futuros_disponibles.length > 0;

    header.innerHTML = `<h2 class="text-2xl font-bold text-white">${debtDetails.nombre_completo}</h2>`;

    let listHtml = '';
    let footerHtml = '';

    if (hasDebts) {
        listHtml += `<h3 class="group-title">Deudas Pendientes</h3>`;
        debtDetails.meses_adeudados.forEach((mes, index) => {
            listHtml += `
                <div class="flex items-center p-2 rounded-lg bg-gray-800 bg-opacity-50">
                    <input type="checkbox" id="mes-adeudado-${index}" data-iso="${mes.periodo_iso}" class="month-checkbox h-5 w-5 rounded text-blue-500">
                    <label for="mes-adeudado-${index}" class="ml-3 flex-grow text-white">${mes.periodo_display}</label>
                    <span class="text-gray-300">$${formatNumber(mes.monto)}</span>
                </div>
            `;
        });
    }
    
    if (hasFutureMonths) {
        listHtml += `<h3 class="group-title mt-4">Abonos (Pagos Adelantados)</h3>`;
        debtDetails.meses_futuros_disponibles.forEach((mes, index) => {
            listHtml += `
                <div class="flex items-center p-2 rounded-lg bg-gray-800 bg-opacity-50">
                    <input type="checkbox" id="mes-futuro-${index}" data-iso="${mes.periodo_iso}" class="month-checkbox h-5 w-5 rounded text-blue-500">
                    <label for="mes-futuro-${index}" class="ml-3 flex-grow text-white">${mes.periodo_display}</label>
                    <span class="text-gray-300">$${formatNumber(mes.monto)}</span>
                </div>
            `;
        });
    }
    
    if (hasDebts || hasFutureMonths) {
        if (hasDebts) {
            footerHtml += `<div class="form-group mb-4">
                <h3 class="group-title">Multas por Atraso</h3>
                <div class="p-4">
                    <div class="flex items-center">
                        <input type="checkbox" id="cobrar-multa" class="h-5 w-5 rounded text-blue-500" ${debtDetails.multas.cantidad > 0 ? '' : 'disabled'}>
                        <label for="cobrar-multa" class="ml-3 flex-grow text-white">Aplicar multa por atraso (Total: ${debtDetails.multas.cantidad} multas)</label>
                        <span class="text-gray-300">$${formatNumber(debtDetails.multas.monto_total)}</span>
                    </div>
                </div>
            </div>`;
        }
        
        footerHtml += `<h3 class="text-xl font-bold text-white text-right">TOTAL A PAGAR: <span id="total-a-pagar">$0</span></h3>
                       <button id="btn-registrar-pago" class="btn-login w-full mt-4" disabled>Registrar Pago</button>`;

        if (debtDetails.multas && debtDetails.multas.cantidad >= 3) {
            footerHtml += `<button id="btn-desactivar-residente" class="btn-cancel bg-red-600 hover:bg-red-700 w-full mt-2">Desactivar Residente</button>`;
        }
    
        list.innerHTML = listHtml;
        footer.innerHTML = footerHtml;

        wrapper.classList.remove('hidden');
        placeholder.classList.add('hidden');
        
        addEventListenersToPaymentForm(debtDetails);
        
        if (debtDetails.multas && debtDetails.multas.cantidad >= 3) {
            document.getElementById('btn-desactivar-residente').onclick = () => {
                confirmDeactivateResidentFromPayments(residentId, debtDetails.nombre_completo);
            };
        }
    } else {
        placeholder.innerHTML = `<div class="h-full flex flex-col justify-center items-center text-center">
                                    <h2 class="text-2xl font-bold text-white mb-4">${debtDetails.nombre_completo}</h2>
                                    <div class="text-green-400 p-8">
                                        <i class="fas fa-check-circle fa-3x mb-4"></i>
                                        <p>El residente está al día.</p>
                                    </div>
                                 </div>`;
    }
}

async function confirmDeactivateResidentFromPayments(residentId, residentName) {
    const userConfirmed = await showCustomConfirm('Confirmar Desactivación', `¿Desactivar a "${residentName}"? El residente podrá ser reactivado más tarde. Sus recursos (departamentos, estacionamientos) serán liberados.`);
    if (userConfirmed) {
        const success = await eel.delete_residente_by_id(residentId)();
        if (success) {
            showToast('Residente desactivado con éxito.', true);
            loadResidentsList();
            resetPaymentView();
            currentResidentId = null;
        } else {
            showToast('Error: No se pudo desactivar al residente.', false);
        }
    }
}

function addEventListenersToPaymentForm(debtDetails) {
    const checkboxes = Array.from(document.querySelectorAll('.month-checkbox'));
    const multaCheckbox = document.getElementById('cobrar-multa');
    
    const allPayableMonths = [...(debtDetails.meses_adeudados || []), ...(debtDetails.meses_futuros_disponibles || [])]
        .sort((a, b) => a.periodo_iso.localeCompare(b.periodo_iso));

    checkboxes.forEach(cb => {
        cb.addEventListener('change', (event) => {
            handleHierarchicalSelection(checkboxes, event.target, allPayableMonths);
            updateTotal(allPayableMonths, debtDetails.multas);
        });
    });

    if (multaCheckbox) {
        multaCheckbox.addEventListener('change', () => updateTotal(allPayableMonths, debtDetails.multas));
    }

    document.getElementById('btn-registrar-pago').addEventListener('click', async () => {
        const confirmed = await showCustomConfirm('Confirmar Pago', '¿Está seguro de que desea registrar el pago?');
        if(confirmed) {
            const btn = document.getElementById('btn-registrar-pago');
            btn.disabled = true;
            btn.textContent = 'Procesando...';

            const mesesSeleccionados = allPayableMonths.filter(month => {
                const cb = document.querySelector(`.month-checkbox[data-iso="${month.periodo_iso}"]`);
                return cb && cb.checked;
            });
            
            const cobrarMultas = {
                aplicar: multaCheckbox ? multaCheckbox.checked : false,
                cantidad: debtDetails.multas ? debtDetails.multas.cantidad : 0,
                monto_total: debtDetails.multas ? debtDetails.multas.monto_total : '0'
            };

            const [success, message] = await eel.process_payment(currentResidentId, mesesSeleccionados, cobrarMultas)();

            showToast(message, success);
            if (success) {
                loadResidentsList();
                resetPaymentView();
                currentResidentId = null;
            } else {
                btn.disabled = false;
                btn.textContent = 'Registrar Pago';
            }
        }
    });
}

function handleHierarchicalSelection(checkboxes, target, allPayableMonths) {
    const clickedIso = target.dataset.iso;
    const clickedIndex = allPayableMonths.findIndex(m => m.periodo_iso === clickedIso);

    if (target.checked) {
        for (let i = 0; i <= clickedIndex; i++) {
            const iso = allPayableMonths[i].periodo_iso;
            const cb = checkboxes.find(c => c.dataset.iso === iso);
            if (cb) cb.checked = true;
        }
    } else {
        for (let i = clickedIndex; i < allPayableMonths.length; i++) {
            const iso = allPayableMonths[i].periodo_iso;
            const cb = checkboxes.find(c => c.dataset.iso === iso);
            if (cb) cb.checked = false;
        }
    }
}

function updateTotal(allPayableMonths, multas) {
    let total = new Decimal(0);
    const multaCheckbox = document.getElementById('cobrar-multa');
    const btn = document.getElementById('btn-registrar-pago');
    let mesSeleccionado = false;

    allPayableMonths.forEach(month => {
        const cb = document.querySelector(`.month-checkbox[data-iso="${month.periodo_iso}"]`);
        if (cb && cb.checked) {
            total = total.plus(new Decimal(month.monto));
            mesSeleccionado = true;
        }
    });

    if (multaCheckbox && multaCheckbox.checked) {
        total = total.plus(new Decimal(multas.monto_total));
    }

    const totalNumber = parseFloat(total.toString());
    document.getElementById('total-a-pagar').textContent = `$${totalNumber.toLocaleString('es-CL')}`;
    btn.disabled = !mesSeleccionado;
}