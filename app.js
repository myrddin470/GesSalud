// Configuración de tu proyecto Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCbfUT-sRs5kKxk2iC_DPZEXIDs9jSJUKM",
    authDomain: "gescontrol-d9b05.firebaseapp.com",
    databaseURL: "https://gescontrol-d9b05-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "gescontrol-d9b05",
    storageBucket: "gescontrol-d9b05.firebasestorage.app",
    messagingSenderId: "281755906517",
    appId: "1:281755906517:web:cacdc5fa1987e9a861cd5c"
};

// Inicialización de Servicios (Corregido: Añadido initializeApp)
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// Variables de Control Global
let currentUser = null;
let currentDate = new Date();
let selectedDateStr = "";
let monthData = {};
const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// Elementos Estructurales del DOM
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const loginError = document.getElementById('login-error');
const calendarGrid = document.getElementById('calendar-grid');
const dayModal = document.getElementById('day-modal');

// =========================================================
// SISTEMA DE AUTENTICACIÓN Y PERSISTENCIA
// =========================================================

auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .catch(err => console.error("Error fijando persistencia de sesión:", err));

auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        loginContainer.classList.add('hidden');    // Como ya nace con 'hidden', aquí no parpadea nada
        appContainer.classList.remove('hidden');   // Muestra el calendario directamente
        setupControlListeners(); 
        loadMonthDataAndRender();
    } else {
        currentUser = null;
        loginContainer.classList.remove('hidden'); // Si no estás logueado, le quita el 'hidden' y aparece
        appContainer.classList.add('hidden');
    }
});

document.getElementById('btn-login').addEventListener('click', () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if(!email || !password) {
        loginError.textContent = "Por favor, rellena todos los campos.";
        return;
    }

    loginError.textContent = "Conectando al servidor...";

    auth.signInWithEmailAndPassword(email, password)
        .then(() => loginError.textContent = "")
        .catch(error => {
            loginError.textContent = "Error de acceso. Comprueba tus datos.";
            console.error(error);
        });
});

document.getElementById('btn-logout').addEventListener('click', () => auth.signOut());

// =========================================================
// MANEJO Y CONSTRUCCIÓN DEL CALENDARIO MODERNO
// =========================================================

function setupControlListeners() {
    const monthSelect = document.getElementById('month-select');
    const yearSelect = document.getElementById('year-select');
    
    if (monthSelect.options.length === 0) {
        monthSelect.innerHTML = monthNames.map((m, i) => `<option value="${i}">${m}</option>`).join('');
        const currentYear = new Date().getFullYear();
        for(let i = currentYear - 3; i <= currentYear + 3; i++) {
            const opt = document.createElement('option');
            opt.value = i; opt.textContent = i;
            yearSelect.appendChild(opt);
        }
    }

    monthSelect.value = currentDate.getMonth();
    yearSelect.value = currentDate.getFullYear();

    monthSelect.onchange = (e) => { currentDate.setMonth(e.target.value); loadMonthDataAndRender(); };
    yearSelect.onchange = (e) => { currentDate.setFullYear(e.target.value); loadMonthDataAndRender(); };
    document.getElementById('btn-prev-month').onclick = () => { currentDate.setMonth(currentDate.getMonth() - 1); loadMonthDataAndRender(); };
    document.getElementById('btn-next-month').onclick = () => { currentDate.setMonth(currentDate.getMonth() + 1); loadMonthDataAndRender(); };
}

document.getElementById('btn-goto-today').addEventListener('click', () => {
    // 1. Reasignamos el objeto global a la fecha de hoy
    currentDate = new Date();

    // 2. Sincronizamos LocalStorage para que todo el ecosistema (y trends.html) se entere
    localStorage.setItem('health_current_month', currentDate.getMonth());
    localStorage.setItem('health_current_year', currentDate.getFullYear());

    // 3. Invocamos tu función de carga
    // Como tu función ya actualiza los selectores .value internamente, todo cambia a la vez
    loadMonthDataAndRender();
});



async function loadMonthDataAndRender() {
    if (!currentUser) return;
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    
    document.getElementById('month-select').value = currentDate.getMonth();
    document.getElementById('year-select').value = currentDate.getFullYear();

    try {
        const snapshot = await db.ref(`usuarios/${currentUser.uid}/${year}-${month}`).once('value');
        monthData = snapshot.val() || {};
    } catch (e) {
        console.warn("Fallo de red en Firebase, renderizando rejilla limpia.", e);
        monthData = {};
    }
    renderCalendar();
}

function renderCalendar() {
    calendarGrid.innerHTML = '';
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const today = new Date();
    const isCurrentYear = year === today.getFullYear();
    const isCurrentMonth = month === today.getMonth();
    
    let firstDayIndex = new Date(year, month, 1).getDay();
    firstDayIndex = (firstDayIndex === 0) ? 7 : firstDayIndex; 

    for (let i = 1; i < firstDayIndex; i++) {
        const div = document.createElement('div');
        div.className = 'day-cell empty';
        calendarGrid.appendChild(div);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const cell = document.createElement('div');
        const dayStr = String(day).padStart(2, '0');
        const data = monthData[dayStr];
        
        const gridPosition = (firstDayIndex - 1 + day);
        const isSunday = gridPosition % 7 === 0;

        cell.className = 'day-cell';
        
        if (isSunday || data?.tipo === 'festivo') {
            cell.classList.add('is-festivo');
        }

        if (isCurrentYear && isCurrentMonth && day === today.getDate()) {
            cell.classList.add('is-today');
        }

        let innerContent = `<span class="day-number">${day}</span>`;
        
        if (data) {
            let dotsHtml = '<div class="day-indicators">';
            if (data.peso) {
                dotsHtml += `<div class="dot dot-weight" title="Peso: ${data.peso} kg"></div>`;
            }
            if (data.glucosa) {
                // RANGO AJUSTADO: NORMAL DE 70 A 100 mg/dL
                const esDesajuste = data.glucosa < 70 || data.glucosa > 100;
                const claseGlucosa = esDesajuste ? 'dot-glucose-alert' : 'dot-glucose';
                const textoTooltip = esDesajuste ? `¡Desajuste! Glucosa: ${data.glucosa} mg/dL` : `Glucosa normal: ${data.glucosa} mg/dL`;
                
                dotsHtml += `<div class="dot ${claseGlucosa}" title="${textoTooltip}"></div>`;
            }
            dotsHtml += '</div>';
            innerContent += dotsHtml;
        }

        cell.innerHTML = innerContent;
        
        cell.onclick = () => openModal(day, data, isSunday);
        calendarGrid.appendChild(cell);
    }
}

// =========================================================
// LÓGICA DEL CONTROLADOR DEL MODAL INTERACTIVO
// =========================================================

function openModal(day, data, isSunday) {
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const year = currentDate.getFullYear();
    const dayStr = String(day).padStart(2, '0');
    selectedDateStr = `${year}-${month}-${dayStr}`;

    document.getElementById('modal-date-title').textContent = `${dayStr}/${month}/${year}`;
    
    if (data) {
        document.getElementById('day-type').value = data.tipo || 'laborable';
        document.getElementById('peso').value = data.peso || '';
        document.getElementById('glucosa').value = data.glucosa || '';
        document.getElementById('btn-delete').classList.remove('hidden');
    } else {
        document.getElementById('day-type').value = isSunday ? 'festivo' : 'laborable';
        document.getElementById('peso').value = '';
        document.getElementById('glucosa').value = '';
        document.getElementById('btn-delete').classList.add('hidden');
    }
    
    dayModal.classList.remove('hidden');
}


document.getElementById('btn-save').onclick = async () => {
    if (!selectedDateStr || !currentUser) return;
    
    const [year, month, day] = selectedDateStr.split('-');
    const typeValue = document.getElementById('day-type').value;
    const pesoValue = document.getElementById('peso').value;
    const glucosaValue = document.getElementById('glucosa').value;

    const payload = { tipo: typeValue };

    if (pesoValue && !isNaN(pesoValue)) payload.peso = parseFloat(pesoValue);
    if (glucosaValue && !isNaN(glucosaValue)) payload.glucosa = parseInt(glucosaValue, 10);

    try {
        await db.ref(`usuarios/${currentUser.uid}/${year}-${month}/${day}`).set(payload);
        dayModal.classList.add('hidden');
        loadMonthDataAndRender();
    } catch (err) {
        alert("Fallo de Firebase al guardar:\n" + err.message);
    }
};

document.getElementById('btn-delete').onclick = async () => {
    if (!selectedDateStr || !currentUser) return;
    if (!confirm("¿Deseas eliminar permanentemente los registros de esta tarjeta?")) return;

    const [year, month, day] = selectedDateStr.split('-');
    
    try {
        await db.ref(`usuarios/${currentUser.uid}/${year}-${month}/${day}`).remove();
        dayModal.classList.add('hidden');
        loadMonthDataAndRender();
    } catch (err) {
        console.error(err);
    }
};

document.getElementById('btn-cancel').onclick = () => dayModal.classList.add('hidden');
document.getElementById('btn-close-modal').onclick = () => dayModal.classList.add('hidden');

// =========================================================
// GENERACIÓN GENERADOR DE INFORME PDF PROFESIONAL
// =========================================================

document.getElementById('btn-pdf').onclick = () => {
    if (!currentUser) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const year = currentDate.getFullYear();
    const monthNum = currentDate.getMonth();
    const monthStr = String(monthNum + 1).padStart(2, '0');
    const monthName = monthNames[monthNum];
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(79, 70, 229); 
    doc.text(`INFORME MENSUAL DE SALUD`, 14, 22);
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(`Período de control: ${monthName} de ${year}`, 14, 32);
    doc.text(`ID de cuenta activa: ${currentUser.email || currentUser.uid}`, 14, 38);
    
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(14, 44, 196, 44);
    
    doc.setFillColor(241, 245, 249);
    doc.rect(14, 52, 182, 9, "F");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text("FECHA", 20, 58);
    doc.text("PESO CORPORAL", 85, 58);
    doc.text("NIVEL GLUCOSA", 145, 58);
    
    doc.setDrawColor(203, 213, 225);
    doc.line(14, 61, 196, 61);
    
    let verticalCursor = 69;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    
    const daysInMonth = new Date(year, monthNum + 1, 0).getDate();
    let recordsPrinted = 0;

    for (let day = 1; day <= daysInMonth; day++) {
        const dayStr = String(day).padStart(2, '0');
        const data = monthData[dayStr];
        
        if (data && (data.peso || data.glucosa)) {
            recordsPrinted++;
            
            const fullDateText = `${dayStr}/${monthStr}/${year}`;
            const pesoText = data.peso ? `${data.peso.toFixed(1)} kg` : "---";
            const glucosaText = data.glucosa ? `${data.glucosa} mg/dL` : "---";
            
            doc.text(fullDateText, 20, verticalCursor);
            doc.text(pesoText, 85, verticalCursor);
            doc.text(glucosaText, 145, verticalCursor);
            
            doc.setDrawColor(241, 245, 249);
            doc.line(14, verticalCursor + 3, 196, verticalCursor + 3);
            
            verticalCursor += 9;
            
            if (verticalCursor > 265) {
                doc.addPage();
                verticalCursor = 25;
            }
        }
    }
    
    if (recordsPrinted === 0) {
        doc.setFont("helvetica", "italic");
        doc.setTextColor(148, 163, 184);
        doc.text("No existen mediciones cargadas para el mes seleccionado.", 18, verticalCursor + 5);
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("Documento automatizado emitido por la aplicación de control de salud ©JCOS", 14, 287);
    
    doc.save(`informe_salud_${year}_${monthStr}.pdf`);
};

// =========================================================
// ACCESO A LA PÁGINA DE TENDENCIAS Y GRÁFICOS
// =========================================================

document.getElementById('btn-trends').onclick = async () => {
    if (!currentUser) return;
    
    const btn = document.getElementById('btn-trends');
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Cargando...</span>';

    try {
        const snapshot = await db.ref(`usuarios/${currentUser.uid}`).once('value');
        const totalHistory = snapshot.val() || {};

        localStorage.setItem('health_history_data', JSON.stringify(totalHistory));
        localStorage.setItem('health_current_year', currentDate.getFullYear());
        localStorage.setItem('health_current_month', currentDate.getMonth());

        window.location.href = 'trends.html';

    } catch (err) {
        alert("Error al recopilar el histórico para las tendencias.");
        console.error(err);
    } finally {
        btn.innerHTML = originalContent;
    }
};

// =========================================================
// PROCESAMIENTO DE ARCHIVOS (BACKUPS JSON)
// =========================================================

document.getElementById('btn-export').onclick = async () => {
    if (!currentUser) return;
    const snapshot = await db.ref(`usuarios/${currentUser.uid}`).once('value');
    const blob = new Blob([JSON.stringify(snapshot.val() || {}, null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_salud_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

document.getElementById('file-import').onchange = (e) => {
    const file = e.target.files[0];
    if (!file || !currentUser) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const data = JSON.parse(event.target.result);
            if (confirm("¿Confirmas la sobreescritura total de la base de datos con esta copia?")) {
                await db.ref(`usuarios/${currentUser.uid}`).set(data);
                loadMonthDataAndRender();
            }
        } catch (err) {
            alert("El archivo JSON no es válido.");
        }
        document.getElementById('file-import').value = '';
    };
    reader.readAsText(file);
};