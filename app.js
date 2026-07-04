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

        // Filtrar coincidencias por Cédula (exacta/parcial) O Nombre Completo (parcial)
        const resultados = registros.filter(persona => {
            const cedula = persona.Cédula ? persona.Cédula.toString().toLowerCase() : '';
            const nombreCompleto = `${persona.Nombre} ${persona.Apellido}`.toLowerCase();
            
            return cedula.includes(query) || nombreCompleto.includes(query);
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
