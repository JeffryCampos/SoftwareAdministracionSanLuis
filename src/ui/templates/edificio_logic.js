
if (typeof window.edificioState === 'undefined') {
    window.edificioState = {
        selectedTorreId: null,
        selectedTorreNombre: '',
        initialized: false
    };
}


function initEdificio() {

    if (window.edificioState.initialized) {
        cargarTorres();
        return;
    }


    const checkAndInit = () => {
        const torresListElement = document.getElementById('torres-list');
        if (torresListElement) {
            window.edificioState.initialized = true;
            cargarTorres();
        } else {

            requestAnimationFrame(checkAndInit);
        }
    };

    checkAndInit();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEdificio);
} else {

    requestAnimationFrame(initEdificio);
}



function showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = show ? 'flex' : 'none';
}

function showEdificioToast(icon, title) {
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        background: '#1f2937',
        color: '#fff',
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer)
            toast.addEventListener('mouseleave', Swal.resumeTimer)
        }
    });
    Toast.fire({ icon: icon, title: title });
}



function filtrarTorres(searchTerm) {
    const listContainer = document.getElementById('torres-list');
    const items = listContainer.querySelectorAll('div[onclick*="seleccionarTorre"]');

    searchTerm = searchTerm.toLowerCase().trim();

    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        if (text.includes(searchTerm)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

function filtrarDepartamentos(searchTerm) {
    const listContainer = document.getElementById('deptos-list');
    const items = listContainer.children;

    searchTerm = searchTerm.toLowerCase().trim();

    Array.from(items).forEach(item => {
        const text = item.textContent.toLowerCase();
        if (text.includes(searchTerm)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

function filtrarEstacionamientos(searchTerm) {
    const listContainer = document.getElementById('estac-list');
    const items = listContainer.children;

    searchTerm = searchTerm.toLowerCase().trim();

    Array.from(items).forEach(item => {
        const text = item.textContent.toLowerCase();
        if (text.includes(searchTerm)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}



async function cargarTorres() {
    const listContainer = document.getElementById('torres-list');
    const loader = document.getElementById('loading-torres');

    if (!listContainer) return;

    if (listContainer.children.length === 0 && loader) loader.style.display = 'flex';

    try {
        const torres = await eel.get_torres()();
        listContainer.innerHTML = '';
        if (loader) loader.style.display = 'none';

        if (torres.length === 0) {
            listContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-gray-400 gap-4 p-8">
                    <i class="fas fa-city text-5xl opacity-20"></i>
                    <p>No hay torres registradas</p>
                </div>`;
            return;
        }

        torres.forEach(t => {
            const item = document.createElement('div');
            item.className = `flex justify-between items-center p-4 mb-2 rounded-xl bg-white bg-opacity-5 border border-transparent transition-all cursor-pointer hover:bg-opacity-10 hover:translate-x-1 ${window.edificioState.selectedTorreId === t.id ? 'active' : ''}`;
            item.onclick = () => seleccionarTorre(t.id, t.nombre);

            item.innerHTML = `
                <div class="flex flex-col gap-1">
                    <span class="font-semibold text-gray-100">${t.nombre}</span>
                    <div class="flex gap-3 text-sm text-gray-400">
                        <span><i class="fas fa-building"></i> ${t.num_deptos} Deptos</span>
                        <span><i class="fas fa-car"></i> ${t.num_estac} Estac</span>
                    </div>
                </div>
                <div class="flex gap-2 opacity-60 hover:opacity-100 transition-opacity">
                    <button onclick="editarTorre(event, ${t.id}, '${t.nombre}')" class="bg-transparent border-none text-gray-400 p-1 rounded cursor-pointer transition-all hover:bg-blue-500 hover:bg-opacity-10 hover:text-blue-400" title="Editar">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button onclick="eliminarTorre(event, ${t.id}, '${t.nombre}')" class="bg-transparent border-none text-gray-400 p-1 rounded cursor-pointer transition-all hover:bg-red-500 hover:bg-opacity-10 hover:text-red-400" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            listContainer.appendChild(item);
        });
    } catch (e) {
        console.error(e);
        if (loader) loader.style.display = 'none';
        showEdificioToast('error', 'Error al cargar torres');
    }
}

function seleccionarTorre(id, nombre) {
    window.edificioState.selectedTorreId = id;
    window.edificioState.selectedTorreNombre = nombre;


    const badge = document.getElementById('selected-torre-badge');
    badge.textContent = nombre;
    badge.classList.remove('hidden');

    document.getElementById('btn-add-depto').disabled = false;
    document.getElementById('btn-add-estac').disabled = false;


    document.getElementById('search-deptos-container').style.display = 'block';
    document.getElementById('search-estac-container').style.display = 'block';


    document.getElementById('deptos-placeholder').style.display = 'none';
    document.getElementById('deptos-list').style.display = 'block';
    document.getElementById('estac-placeholder').style.display = 'none';
    document.getElementById('estac-list').style.display = 'block';

    cargarTorres();
    cargarContenidoTorre(id);
}

async function crearTorre() {
    const { value: nombre } = await Swal.fire({
        title: 'Nueva Torre',
        input: 'text',
        inputLabel: 'Nombre de la torre',
        inputPlaceholder: 'Ej: Torre A',
        background: '#1f2937', color: '#fff',
        confirmButtonColor: '#3b82f6',
        showCancelButton: true,
        cancelButtonColor: '#4b5563',
        inputValidator: (value) => {
            if (!value) return 'El nombre es obligatorio'
        }
    });

    if (nombre) {
        showLoading(true);
        const res = await eel.create_torre(nombre)();
        showLoading(false);

        if (res.success) {
            showEdificioToast('success', 'Torre creada');
            cargarTorres();
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: res.message, background: '#1f2937', color: '#fff' });
        }
    }
}

async function editarTorre(e, id, currentName) {
    e.stopPropagation();
    const { value: nombre } = await Swal.fire({
        title: 'Editar Torre',
        input: 'text',
        inputValue: currentName,
        background: '#1f2937', color: '#fff',
        confirmButtonColor: '#3b82f6',
        showCancelButton: true
    });

    if (nombre && nombre !== currentName) {
        showLoading(true);
        const res = await eel.update_torre(id, nombre)();
        showLoading(false);

        if (res.success) {
            showEdificioToast('success', 'Torre actualizada');
            if (window.edificioState.selectedTorreId === id) window.edificioState.selectedTorreNombre = nombre;
            cargarTorres();
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: res.message, background: '#1f2937', color: '#fff' });
        }
    }
}

async function eliminarTorre(e, id, nombre) {
    e.stopPropagation();
    const res = await Swal.fire({
        title: '¿Estás seguro?',
        text: `Se eliminará la torre "${nombre}" y todo su contenido.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#4b5563',
        confirmButtonText: 'Sí, eliminar',
        background: '#1f2937', color: '#fff'
    });

    if (res.isConfirmed) {
        showLoading(true);
        const resp = await eel.delete_torre(id)();
        showLoading(false);

        if (resp.success) {
            showEdificioToast('success', 'Torre eliminada');
            if (window.edificioState.selectedTorreId === id) resetSelection();
            cargarTorres();
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: resp.message, background: '#1f2937', color: '#fff' });
        }
    }
}

function resetSelection() {
    window.edificioState.selectedTorreId = null;
    window.edificioState.selectedTorreNombre = '';
    document.getElementById('selected-torre-badge').classList.add('hidden');
    document.getElementById('btn-add-depto').disabled = true;
    document.getElementById('btn-add-estac').disabled = true;


    document.getElementById('search-deptos-container').style.display = 'none';
    document.getElementById('search-estac-container').style.display = 'none';

    document.getElementById('deptos-list').style.display = 'none';
    document.getElementById('deptos-placeholder').style.display = 'flex';
    document.getElementById('estac-list').style.display = 'none';
    document.getElementById('estac-placeholder').style.display = 'flex';
}



async function cargarContenidoTorre(id) {

    const deptosList = document.getElementById('deptos-list');
    deptosList.innerHTML = '<div class="spinner mx-auto my-8"></div>';

    const deptos = await eel.get_departamentos_by_torre(id)();
    deptosList.innerHTML = '';

    if (deptos.length === 0) {
        deptosList.innerHTML = '<div class="flex items-center justify-center h-full text-gray-400"><p>Sin departamentos</p></div>';
    } else {
        deptos.forEach(d => {
            const badgeClass = d.estado === 'DISPONIBLE' ? 'bg-green-500 bg-opacity-15 text-green-400 border-green-500' : 'bg-red-500 bg-opacity-15 text-red-400 border-red-500';
            const item = document.createElement('div');
            item.className = 'flex justify-between items-center p-4 mb-2 rounded-xl bg-white bg-opacity-5 border border-transparent transition-all hover:bg-opacity-10';
            item.innerHTML = `
                <div class="flex flex-col gap-1">
                    <span class="font-semibold text-gray-100">Depto ${d.numero}</span>
                    <div class="flex gap-3 text-sm text-gray-400">
                        <span class="px-2 py-0.5 rounded text-xs font-bold uppercase border ${badgeClass}">${d.estado}</span>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button onclick="editarDepartamento(${d.id}, '${d.numero}')" class="bg-transparent border-none text-gray-400 p-1 rounded cursor-pointer transition-all hover:bg-blue-500 hover:bg-opacity-10 hover:text-blue-400"><i class="fas fa-pen"></i></button>
                    <button onclick="eliminarDepto(${d.id})" class="bg-transparent border-none text-gray-400 p-1 rounded cursor-pointer transition-all hover:bg-red-500 hover:bg-opacity-10 hover:text-red-400"><i class="fas fa-trash"></i></button>
                </div>
            `;
            deptosList.appendChild(item);
        });
    }


    const estacList = document.getElementById('estac-list');
    estacList.innerHTML = '<div class="spinner mx-auto my-8"></div>';

    const estacs = await eel.get_estacionamientos_by_torre(id)();
    estacList.innerHTML = '';

    if (estacs.length === 0) {
        estacList.innerHTML = '<div class="flex items-center justify-center h-full text-gray-400"><p>Sin estacionamientos</p></div>';
    } else {
        estacs.forEach(e => {
            const badgeClass = e.estado === 'DISPONIBLE' ? 'bg-green-500 bg-opacity-15 text-green-400 border-green-500' : 'bg-red-500 bg-opacity-15 text-red-400 border-red-500';
            const icon = e.tipo === 'AUTO' ? 'fa-car' : 'fa-motorcycle';
            const item = document.createElement('div');
            item.className = 'flex justify-between items-center p-4 mb-2 rounded-xl bg-white bg-opacity-5 border border-transparent transition-all hover:bg-opacity-10';
            item.innerHTML = `
                <div class="flex flex-col gap-1">
                    <span class="font-semibold text-gray-100">Box ${e.box_numero}</span>
                    <div class="flex gap-3 text-sm text-gray-400">
                        <span><i class="fas ${icon}"></i> ${e.tipo}</span>
                        <span class="px-2 py-0.5 rounded text-xs font-bold uppercase border ${badgeClass}">${e.estado}</span>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button onclick="editarEstacionamiento(${e.id}, '${e.box_numero}', '${e.tipo}')" class="bg-transparent border-none text-gray-400 p-1 rounded cursor-pointer transition-all hover:bg-blue-500 hover:bg-opacity-10 hover:text-blue-400"><i class="fas fa-pen"></i></button>
                    <button onclick="eliminarEstacionamiento(${e.id})" class="bg-transparent border-none text-gray-400 p-1 rounded cursor-pointer transition-all hover:bg-red-500 hover:bg-opacity-10 hover:text-red-400"><i class="fas fa-trash"></i></button>
                </div>
            `;
            estacList.appendChild(item);
        });
    }
}



async function crearDepartamento() {
    const { value: formValues } = await Swal.fire({
        title: '<i class="fas fa-building" style="margin-right: 0.5rem;"></i>Nuevo(s) Departamento(s)',
        html: `
            <div style="padding: 1.5rem 1rem;">
                <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; text-align: left; color: #9ca3af; font-size: 0.875rem; margin-bottom: 0.5rem; font-weight: 500;">
                        <i class="fas fa-hashtag" style="margin-right: 0.5rem; color: #60a5fa;"></i>Número Inicio
                    </label>
                    <input id="swal-numero-inicio" type="number" class="swal2-input" placeholder="Ej: 101" 
                        style="background: #374151; color: white; border: 1px solid #4b5563; border-radius: 0.5rem; width: 100%; margin: 0; padding: 0.75rem;">
                </div>
                <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; text-align: left; color: #9ca3af; font-size: 0.875rem; margin-bottom: 0.5rem; font-weight: 500;">
                        <i class="fas fa-hashtag" style="margin-right: 0.5rem; color: #60a5fa;"></i>Número Fin
                    </label>
                    <input id="swal-numero-fin" type="number" class="swal2-input" placeholder="Ej: 110" 
                        style="background: #374151; color: white; border: 1px solid #4b5563; border-radius: 0.5rem; width: 100%; margin: 0; padding: 0.75rem;">
                </div>
                <div style="background: linear-gradient(135deg, #1e3a5f 0%, #1a2332 100%); border-left: 4px solid #3b82f6; padding: 1rem; border-radius: 0.5rem; margin-top: 1.5rem;">
                    <p style="color: #93c5fd; font-size: 0.875rem; margin: 0; display: flex; align-items: center; line-height: 1.5;">
                        <i class="fas fa-lightbulb" style="margin-right: 0.75rem; font-size: 1.25rem; color: #fbbf24;"></i>
                        <span>Ingresa el mismo número en ambos campos para crear solo uno</span>
                    </p>
                </div>
            </div>
        `,
        focusConfirm: false,
        background: '#1f2937',
        color: '#fff',
        confirmButtonColor: '#3b82f6',
        cancelButtonColor: '#6b7280',
        confirmButtonText: '<i class="fas fa-check" style="margin-right: 0.5rem;"></i>Crear',
        cancelButtonText: '<i class="fas fa-times" style="margin-right: 0.5rem;"></i>Cancelar',
        showCancelButton: true,
        width: '34rem',
        preConfirm: () => {
            const inicio = document.getElementById('swal-numero-inicio').value;
            const fin = document.getElementById('swal-numero-fin').value;

            if (!inicio || !fin) {
                Swal.showValidationMessage('Debes ingresar ambos números');
                return false;
            }

            if (parseInt(inicio) > parseInt(fin)) {
                Swal.showValidationMessage('El número inicial debe ser menor o igual al final');
                return false;
            }

            return [inicio, fin];
        }
    });

    if (formValues) {
        const [inicio, fin] = formValues;


        if (inicio === fin) {
            const res = await eel.create_departamento(window.edificioState.selectedTorreId, inicio, null)();
            if (res.success) {
                showEdificioToast('success', res.message);
                cargarContenidoTorre(window.edificioState.selectedTorreId);
                cargarTorres();
            } else {
                Swal.fire({ icon: 'error', title: 'Error', text: res.message, background: '#1f2937', color: '#fff' });
            }
        } else {

            const res = await eel.create_departamentos_batch(window.edificioState.selectedTorreId, inicio, fin, null)();
            if (res.success) {
                showEdificioToast('success', res.message);
                cargarContenidoTorre(window.edificioState.selectedTorreId);
                cargarTorres();
            } else {
                Swal.fire({ icon: 'error', title: 'Error', text: res.message, background: '#1f2937', color: '#fff' });
            }
        }
    }
}

async function editarDepartamento(id, currentNum) {
    const { value: numero } = await Swal.fire({
        title: 'Editar Departamento',
        input: 'text',
        inputValue: currentNum,
        inputLabel: 'Número del departamento',
        background: '#1f2937', color: '#fff',
        confirmButtonColor: '#3b82f6',
        showCancelButton: true,
        inputValidator: (value) => {
            if (!value) return 'El número es obligatorio';
        }
    });

    if (numero && numero !== currentNum) {
        const res = await eel.update_departamento(id, numero, null)();
        if (res.success) {
            showEdificioToast('success', 'Departamento actualizado');
            cargarContenidoTorre(window.edificioState.selectedTorreId);
            cargarTorres();
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: res.message, background: '#1f2937', color: '#fff' });
        }
    }
}

async function eliminarDepto(id) {
    const res = await Swal.fire({
        title: '¿Eliminar?',
        text: "Esta acción no se puede deshacer",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        background: '#1f2937', color: '#fff'
    });

    if (res.isConfirmed) {
        const resp = await eel.delete_departamento(id)();
        if (resp.success) {
            showEdificioToast('success', 'Departamento eliminado');
            cargarContenidoTorre(window.edificioState.selectedTorreId);
            cargarTorres();
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: resp.message, background: '#1f2937', color: '#fff' });
        }
    }
}



async function crearEstacionamiento() {
    const { value: formValues } = await Swal.fire({
        title: '<i class="fas fa-car" style="margin-right: 0.5rem;"></i>Nuevo(s) Estacionamiento(s)',
        html: `
            <div style="padding: 1.5rem 1rem;">
                <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; text-align: left; color: #9ca3af; font-size: 0.875rem; margin-bottom: 0.5rem; font-weight: 500;">
                        <i class="fas fa-hashtag" style="margin-right: 0.5rem; color: #60a5fa;"></i>Número Box Inicio
                    </label>
                    <input id="swal-box-inicio" type="number" class="swal2-input" placeholder="Ej: 1" 
                        style="background: #374151; color: white; border: 1px solid #4b5563; border-radius: 0.5rem; width: 100%; margin: 0; padding: 0.75rem;">
                </div>
                <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; text-align: left; color: #9ca3af; font-size: 0.875rem; margin-bottom: 0.5rem; font-weight: 500;">
                        <i class="fas fa-hashtag" style="margin-right: 0.5rem; color: #60a5fa;"></i>Número Box Fin
                    </label>
                    <input id="swal-box-fin" type="number" class="swal2-input" placeholder="Ej: 10" 
                        style="background: #374151; color: white; border: 1px solid #4b5563; border-radius: 0.5rem; width: 100%; margin: 0; padding: 0.75rem;">
                </div>
                <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; text-align: left; color: #9ca3af; font-size: 0.875rem; margin-bottom: 0.5rem; font-weight: 500;">
                        <i class="fas fa-car-side" style="margin-right: 0.5rem; color: #60a5fa;"></i>Tipo de Vehículo
                    </label>
                    <select id="swal-tipo" class="swal2-input" style="background: #374151; color: white; border: 1px solid #4b5563; border-radius: 0.5rem; width: 100%; margin: 0; padding: 0.75rem;">
                        <option value="AUTO">🚗 Auto</option>
                        <option value="MOTO">🏍️ Moto</option>
                    </select>
                </div>
                <div style="background: linear-gradient(135deg, #1e3a5f 0%, #1a2332 100%); border-left: 4px solid #3b82f6; padding: 1rem; border-radius: 0.5rem; margin-top: 1.5rem;">
                    <p style="color: #93c5fd; font-size: 0.875rem; margin: 0; display: flex; align-items: center; line-height: 1.5;">
                        <i class="fas fa-lightbulb" style="margin-right: 0.75rem; font-size: 1.25rem; color: #fbbf24;"></i>
                        <span>Ingresa el mismo número en ambos campos para crear solo uno</span>
                    </p>
                </div>
            </div>
        `,
        focusConfirm: false,
        background: '#1f2937', color: '#fff',
        confirmButtonColor: '#3b82f6',
        cancelButtonColor: '#6b7280',
        confirmButtonText: '<i class="fas fa-check" style="margin-right: 0.5rem;"></i>Crear',
        cancelButtonText: '<i class="fas fa-times" style="margin-right: 0.5rem;"></i>Cancelar',
        showCancelButton: true,
        width: '34rem',
        preConfirm: () => {
            const inicio = document.getElementById('swal-box-inicio').value;
            const fin = document.getElementById('swal-box-fin').value;
            const tipo = document.getElementById('swal-tipo').value;

            if (!inicio || !fin) {
                Swal.showValidationMessage('Debes ingresar ambos números');
                return false;
            }

            if (parseInt(inicio) > parseInt(fin)) {
                Swal.showValidationMessage('El número inicial debe ser menor o igual al final');
                return false;
            }

            return [inicio, fin, tipo];
        }
    });

    if (formValues) {
        const [inicio, fin, tipo] = formValues;


        if (inicio === fin) {
            const res = await eel.create_estacionamiento(window.edificioState.selectedTorreId, inicio, tipo)();
            if (res.success) {
                showEdificioToast('success', res.message);
                cargarContenidoTorre(window.edificioState.selectedTorreId);
                cargarTorres();
            } else {
                Swal.fire({ icon: 'error', title: 'Error', text: res.message, background: '#1f2937', color: '#fff' });
            }
        } else {
            // Crear en lote
            const res = await eel.create_estacionamientos_batch(window.edificioState.selectedTorreId, inicio, fin, tipo)();
            if (res.success) {
                showEdificioToast('success', res.message);
                cargarContenidoTorre(window.edificioState.selectedTorreId);
                cargarTorres();
            } else {
                Swal.fire({ icon: 'error', title: 'Error', text: res.message, background: '#1f2937', color: '#fff' });
            }
        }
    }
}

async function editarEstacionamiento(id, currentBox, currentTipo) {
    const { value: formValues } = await Swal.fire({
        title: 'Editar Estacionamiento',
        html: `
            <input id="swal-edit-box" class="swal2-input" placeholder="Número Box" value="${currentBox}" style="background: #374151; color: white;">
            <select id="swal-edit-tipo" class="swal2-input" style="background: #374151; color: white;">
                <option value="AUTO" ${currentTipo === 'AUTO' ? 'selected' : ''}>Auto</option>
                <option value="MOTO" ${currentTipo === 'MOTO' ? 'selected' : ''}>Moto</option>
            </select>
        `,
        focusConfirm: false,
        background: '#1f2937', color: '#fff',
        confirmButtonColor: '#3b82f6',
        showCancelButton: true,
        preConfirm: () => {
            return [
                document.getElementById('swal-edit-box').value,
                document.getElementById('swal-edit-tipo').value
            ]
        }
    });

    if (formValues && formValues[0]) {
        const res = await eel.update_estacionamiento(id, formValues[0], formValues[1])();
        if (res.success) {
            showEdificioToast('success', 'Estacionamiento actualizado');
            cargarContenidoTorre(window.edificioState.selectedTorreId);
            cargarTorres();
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: res.message, background: '#1f2937', color: '#fff' });
        }
    }
}

async function eliminarEstacionamiento(id) {
    const res = await Swal.fire({
        title: '¿Eliminar?',
        text: "Esta acción no se puede deshacer",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        background: '#1f2937', color: '#fff'
    });

    if (res.isConfirmed) {
        const resp = await eel.delete_estacionamiento(id)();
        if (resp.success) {
            showEdificioToast('success', 'Estacionamiento eliminado');
            cargarContenidoTorre(window.edificioState.selectedTorreId);
            cargarTorres();
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: resp.message, background: '#1f2937', color: '#fff' });
        }
    }
}

window.crearTorre = crearTorre;
window.editarTorre = editarTorre;
window.eliminarTorre = eliminarTorre;
window.seleccionarTorre = seleccionarTorre;
window.crearDepartamento = crearDepartamento;
window.editarDepartamento = editarDepartamento;
window.eliminarDepto = eliminarDepto;
window.crearEstacionamiento = crearEstacionamiento;
window.editarEstacionamiento = editarEstacionamiento;
window.eliminarEstacionamiento = eliminarEstacionamiento;
window.filtrarTorres = filtrarTorres;
window.filtrarDepartamentos = filtrarDepartamentos;
window.filtrarEstacionamientos = filtrarEstacionamientos;