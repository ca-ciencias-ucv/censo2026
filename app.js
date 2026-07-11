// app.js

document.getElementById('searchForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const searchInput = document.getElementById('searchInput');
    const query = searchInput.value.trim().toLowerCase();
    const container = document.getElementById('resultsContainer');
    const countDisplay = document.getElementById('resultsCount');
    
    if (!query) return;

    // Mostrar estado de carga inicial
    countDisplay.classList.add('hidden');
    container.classList.remove('hidden');
    container.classList.replace('grid', 'block');
    container.innerHTML = `<div class="text-center py-6 text-gray-500 animate-pulse">Buscando coincidencias...</div>`;

    try {
        // Consultar el archivo plano local con el nombre definitivo
        const response = await fetch('./censo_data.json');
        
        if (!response.ok) {
            throw new Error("No se pudo acceder al almacén de datos.");
        }

        const registros = await response.json();

        // Función interna para remover tildes/acentos y caracteres diacríticos
        const normalizarTexto = (texto) => {
            if (!texto) return '';
            return texto
                .toString()
                .toLowerCase()
                // Descompone los caracteres acentuados en su letra base + el acento separado
                .normalize("NFD")
                // Remueve los caracteres del rango de acentos (bloque Unicode de marcas diacríticas)
                .replace(/[\u0300-\u036f]/g, "")
                .trim();
        };

        // Normalizamos el término que introdujo el usuario en el buscador
        const queryNormalizado = normalizarTexto(query);

        // Filtrar coincidencias limpias de acentos y mayúsculas
        const resultados = registros.filter(persona => {
            // Unificamos nombre y apellido en una sola cadena limpia
            const nombreCompleto = normalizarTexto(`${persona.Nombre_norm} ${persona.Apellido_norm}`);
            const cedula = normalizarTexto(persona.Cédula);
            
            // Evaluamos la coincidencia parcial sin importar tildes ni mayúsculas
            return cedula.includes(queryNormalizado) || nombreCompleto.includes(queryNormalizado);
        });

        // Limpiar contenedor para re-renderizar como cuadrícula de fichas
        container.innerHTML = '';
        container.classList.replace('block', 'grid');

        if (resultados.length > 0) {
            // Mostrar contador de registros encontrados
            countDisplay.textContent = `Se encontraron ${resultados.length} coincidencia(s).`;
            countDisplay.classList.remove('hidden');

            // Generar una ficha por cada coincidencia encontrada
            resultados.forEach(persona => {
                const nombre = `${persona.Nombre} ${persona.Apellido}`;
                const relacion = persona["Relación con la facultad"] || persona.Relación || "No especificado";
                const dependencia = persona["Dependencia de adscripción"] || persona.Dependencia || "No especificado";
                const fecha = persona["Fecha de respuesta"] || persona.Fecha || "N/A";

                const ficha = document.createElement('div');
                // Asignación limpia de clases CSS de Tailwind
                ficha.className = "bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between hover:border-blue-300 transition-colors";
                
                ficha.innerHTML = `
                    <div>
                        <div class="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">${relacion}</div>
                        <h3 class="text-gray-900 font-bold text-lg mb-3">${nombre}</h3>
                        
                        <div class="space-y-2 text-sm">
                            <div class="flex justify-between border-b border-gray-100 pb-1">
                                <span class="text-gray-400">Dependencia:</span>
                                <span class="text-gray-700 font-medium text-right">${dependencia}</span>
                            </div>
                            <div class="flex justify-between pt-1">
                                <span class="text-gray-400">Registrado el:</span>
                                <span class="text-gray-600">${fecha}</span>
                            </div>
                        </div>
                    </div>
                `;
                container.appendChild(ficha);
            });

        } else {
            // Caso en el que no hay coincidencias
            countDisplay.classList.add('hidden');
            container.classList.replace('grid', 'block');
            container.innerHTML = `
                <div class="bg-rose-50 border border-rose-200 p-5 rounded-xl text-center">
                    <p class="text-rose-800 font-medium mb-1">No se encontraron miembros registrados con ese criterio.</p>
                    <p class="text-xs text-rose-600">Intenta buscando solo con el primer apellido o verifica el número de cédula.</p>
                </div>
            `;
        }

    } catch (error) {
        console.error(error);
        container.classList.replace('grid', 'block');
        container.innerHTML = `
            <div class="bg-amber-50 border border-amber-200 p-4 rounded-xl text-center text-sm text-amber-800">
                Error de comunicación al consultar el censo. Por favor, intente de nuevo.
            </div>
        `;
    }
});

// VARIABLES GLOBALES PARA ALBERGAR LOS DATOS DE COBERTURA
let dataCobertura = { pregrado: [], postgrado: [], personal: [] };
let miGraficoStacked = null;
let categoriaActual = 'pregrado';

async function inicializarDashboard() {
    try {
        // Carga simultánea de los tres archivos JSON definidos
        const [resPre, resPost, resPers] = await Promise.all([
            fetch('./status_pregrado.json').then(r => r.ok ? r.json() : []),
            fetch('./status_postgrado.json').then(r => r.ok ? r.json() : []),
            fetch('./status_dependencias.json').then(r => r.ok ? r.json() : [])
        ]);

        dataCobertura.pregrado = resPre;
        dataCobertura.postgrado = resPost;
        dataCobertura.personal = resPers;

        // Renderizar por defecto la primera categoría
        renderizarMetricas('pregrado');

    } catch (error) {
        console.error("Error al cargar los JSON de control de estado:", error);
    }
}

function renderizarMetricas(categoria) {
    categoriaActual = categoria;
    const registros = dataCobertura[categoria];
    const tablaBody = document.getElementById('tablaCoberturaBody');
    tablaBody.innerHTML = '';

    // Configurar etiquetas de tabla y gráfico según la estructura de los JSON
    let campoLlave = 'carrera';
    let tituloGrafico = 'Estatus de Respuestas en Pregrado';
    document.getElementById('thNombre').textContent = 'Carreras de Pregrado';

    if (categoria === 'postgrado') {
        campoLlave = 'Postgrado';
        tituloGrafico = 'Estatus de Respuestas en Postgrado';
        document.getElementById('thNombre').textContent = 'Programas de Postgrado';
    } else if (categoria === 'personal') {
        campoLlave = 'dependencia';
        tituloGrafico = 'Estatus de Respuestas en Personal de Dependencias';
        document.getElementById('thNombre').textContent = 'Dependencia / Escuela / Instituto';
    }

    document.getElementById('graficoTitulo').textContent = tituloGrafico;

    // Arrays para recolectar la información del gráfico
    let labels = [];
    let datosRespondieron = [];
    let datosFaltan = [];

    registros.forEach(item => {
        const nombreElemento = item[campoLlave] || "Desconocido";
        const parcial = parseInt(item.parcial) || 0;
        const total = parseInt(item.total) || 0;
        const faltan = total - parcial >= 0 ? total - parcial : 0;

        labels.push(nombreElemento);
        datosRespondieron.push(parcial);
        datosFaltan.push(faltan);

        // Inyectar fila correspondiente en la tabla
        const fila = document.createElement('tr');
        fila.className = "hover:bg-slate-50 transition-colors";
        fila.innerHTML = `
            <td class="px-4 py-2.5 font-medium text-gray-700">${nombreElemento}</td>
            <td class="px-4 py-2.5 text-center font-bold text-emerald-700 bg-emerald-50/20">${parcial}</td>
            <td class="px-4 py-2.5 text-center font-medium text-rose-600 bg-rose-50/20">${faltan}</td>
            <td class="px-4 py-2.5 text-center font-bold text-gray-800 bg-gray-50">${total}</td>
        `;
        tablaBody.appendChild(fila);
    });

    // RENDERIZAR O ACTUALIZAR GRÁFICO STACKED BARS
    const ctx = document.getElementById('chartStackedBars').getContext('2d');
    
    // Si ya existía un gráfico previo, se destruye para evitar superposiciones visuales
    if (miGraficoStacked) {
        miGraficoStacked.destroy();
    }

    miGraficoStacked = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Ya respondieron',
                    data: datosRespondieron,
                    backgroundColor: '#10b981', // Verde esmeralda para respuestas exitosas
                },
                {
                    label: 'Faltan por responder',
                    data: datosFaltan,
                    backgroundColor: '#f43f5e', // Rosa/Rojo suave para identificar brechas
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { 
                    stacked: true, 
                    ticks: { font: { size: 10 }, maxRotation: 45, minRotation: 0 } 
                },
                y: { 
                    stacked: true, 
                    beginAtZero: true 
                }
            },
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

// Controlador para cambiar de pestañas de manera interactiva
function cambiarCategoria(categoria) {
    // Resetear estilos de todos los botones
    ['pregrado', 'postgrado', 'personal'].forEach(cat => {
        const btn = document.getElementById(`btn-${cat}`);
        btn.className = "px-4 py-2 font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent whitespace-nowrap cursor-pointer";
    });

    // Resaltar botón activo
    const btnActivo = document.getElementById(`btn-${categoria}`);
    btnActivo.className = "px-4 py-2 font-bold border-b-2 border-blue-900 text-blue-900 whitespace-nowrap cursor-pointer";

    // Re-dibujar el panel
    renderizarMetricas(categoria);
}

// Ejecutar automáticamente al cargar la página
document.addEventListener('DOMContentLoaded', inicializarDashboard);
