const appVersion = '2.0.0'; // Updated Version

// --- WEATHER API CONFIGURATION ---
// ⚠️ PASTE YOUR OPENWEATHER API KEY HERE (or use the placeholder for secure deployment)
const openWeatherApiKey = 'API_KEY_PLACEHOLDER';
const openWeatherApiUrl = 'https://api.openweathermap.org/data/2.5/weather';

// --- DATA STRUCTURES ---
let rocketList = [];
let engineList = [];
let flightLog = [];
let currentModalType = null;
let editingItemId = null;
let currentUpdateFlightId = null; // Tracks which flight is being updated

// --- ROCKET SCIENCE CLASSES (from your original rocket logger) ---
class Rocket {
    constructor(data) {
        this.dry_mass = parseFloat(data.dry_mass_g) / 1000.0;
        this.diameter = parseFloat(data.diameter_cm) / 100.0;
        this.radius = this.diameter / 2.0;
        this.nose_cone_type = data.nose_cone_type || 'ogive';
        this.nose_cone_length = parseFloat(data.nose_cone_length_cm) / 100.0;
        this.cog = parseFloat(data.cog_cm) / 100.0;
        this.num_fins = parseInt(data.num_fins);
        this.fin_root_chord = parseFloat(data.fin_root_chord_cm) / 100.0;
        this.fin_tip_chord = parseFloat(data.fin_tip_chord_cm) / 100.0;
        this.fin_semi_span = parseFloat(data.fin_semi_span_cm) / 100.0;
        this.fin_sweep_dist = parseFloat(data.fin_sweep_dist_cm) / 100.0;
        this.nose_to_fin_dist = parseFloat(data.nose_to_fin_dist_cm) / 100.0;
        this.fin_mid_chord_length = this._calculate_mid_chord_length();
    }
    _calculate_mid_chord_length() {
        const x1 = 0, y1 = this.fin_root_chord / 2.0, x2 = this.fin_semi_span, y2 = (this.fin_tip_chord / 2.0) + this.fin_sweep_dist;
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }
    calculate_cop() {
        const XN = this.nose_cone_type === 'cone' ? 0.666 : 0.466;
        const CN_N = 2.0;
        const CN_F = (1 + this.radius / (this.fin_semi_span + this.radius)) * (4 * this.num_fins * Math.pow(this.fin_semi_span / this.diameter, 2) / (1 + Math.sqrt(1 + Math.pow(2 * this.fin_mid_chord_length / (this.fin_root_chord + this.fin_tip_chord), 2))));
        const XF = this.nose_to_fin_dist + (this.fin_sweep_dist / 3) * (this.fin_root_chord + 2 * this.fin_tip_chord) / (this.fin_root_chord + this.fin_tip_chord) + (1 / 6) * (this.fin_root_chord + this.fin_tip_chord - this.fin_root_chord * this.fin_tip_chord / (this.fin_root_chord + this.fin_tip_chord));
        const CN_R = CN_N + CN_F;
        const nose_position = XN * this.nose_cone_length;
        const CoP = (CN_N * nose_position + CN_F * XF) / CN_R;
        return CoP;
    }
}
class Motor {
    constructor(data) {
        this.initial_mass = parseFloat(data.motor_initial_mass_g) / 1000.0;
        this.propellant_mass = parseFloat(data.motor_propellant_mass_g) / 1000.0;
        this.avg_thrust = parseFloat(data.motor_avg_thrust_n);
        this.peak_thrust = parseFloat(data.motor_peak_thrust_n || data.motor_avg_thrust_n);
        this.peak_time = parseFloat(data.motor_peak_time_s || 0.1);
        this.burn_time = parseFloat(data.motor_burn_time_s);
        this.impulse = this.avg_thrust * this.burn_time;
    }
}

// --- LOCALSTORAGE & DATA HANDLING ---
function loadAllData() {
    rocketList = JSON.parse(localStorage.getItem('rocketList')) || [];
    engineList = JSON.parse(localStorage.getItem('engineList')) || [];
    flightLog = JSON.parse(localStorage.getItem('flightLog')) || [];
}
function saveAllData() {
    localStorage.setItem('rocketList', JSON.stringify(rocketList));
    localStorage.setItem('engineList', JSON.stringify(engineList));
    localStorage.setItem('flightLog', JSON.stringify(flightLog));
}

// --- DOM ELEMENT REFERENCES ---
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const sunIcon = document.getElementById('sun-icon');
const moonIcon = document.getElementById('moon-icon');
const manageModal = document.getElementById('manageModal');
const preFlightModal = document.getElementById('preFlightModal');
const flightLogModal = document.getElementById('flightLogModal');
const updateFlightBtn = document.getElementById('updateFlightBtn');
const updateFlightModal = document.getElementById('updateFlightModal');
const updateFlightSelect = document.getElementById('updateFlightSelect');
const weatherSection = document.getElementById('weatherSection');
const postFlightSection = document.getElementById('postFlightSection');
const getWeatherBtn = document.getElementById('getWeatherBtn');
const weatherDisplay = document.getElementById('weatherDisplay');
const saveUpdateBtn = document.getElementById('saveUpdateBtn');


// --- EVENT LISTENERS ---
document.getElementById('manageRocketsBtn').addEventListener('click', () => openManageModal('rocket'));
document.getElementById('manageEnginesBtn').addEventListener('click', () => openManageModal('engine'));
document.getElementById('startPreFlightBtn').addEventListener('click', openPreFlightModal);
document.getElementById('viewFlightLogBtn').addEventListener('click', openFlightLogModal);
document.querySelectorAll('.close-modal-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    };
});
themeToggleBtn.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    const newTheme = isDark ? 'dark' : 'light';
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
});
updateFlightBtn.addEventListener('click', openUpdateFlightModal);
updateFlightSelect.addEventListener('change', handleUpdateFlightSelection);
getWeatherBtn.addEventListener('click', fetchAndDisplayWeather);
saveUpdateBtn.addEventListener('click', saveFlightUpdate);


// --- NEW "UPDATE FLIGHT" MODAL FUNCTIONS ---

function openUpdateFlightModal() {
    const pendingFlights = flightLog.filter(f => f.status === 'Pending');
    updateFlightSelect.innerHTML = '<option value="">-- Select a Pending Flight --</option>';
    pendingFlights.forEach(flight => {
        const option = document.createElement('option');
        option.value = flight.id;
        option.textContent = `${flight.rocketName} / ${flight.engineName} (${new Date(flight.flightDate).toLocaleDateString()})`;
        updateFlightSelect.appendChild(option);
    });

    weatherSection.classList.add('hidden');
    postFlightSection.classList.add('hidden');
    saveUpdateBtn.classList.add('hidden');
    weatherDisplay.innerHTML = '';
    updateFlightModal.style.display = 'block';
}

function handleUpdateFlightSelection() {
    currentUpdateFlightId = updateFlightSelect.value;
    if (!currentUpdateFlightId) {
        weatherSection.classList.add('hidden');
        postFlightSection.classList.add('hidden');
        saveUpdateBtn.classList.add('hidden');
        return;
    }
    
    weatherSection.classList.remove('hidden');
    postFlightSection.classList.remove('hidden');
    saveUpdateBtn.classList.remove('hidden');

    const flight = flightLog.find(f => f.id === currentUpdateFlightId);
    document.getElementById('flightStatus').value = flight.status === 'Pending' ? 'Success' : flight.status;
    document.getElementById('flightNotes').value = flight.notes || '';
    document.getElementById('csvData').value = flight.rawData || '';

    if (flight.weather) {
        displayWeatherInModal(flight.weather);
    } else {
        weatherDisplay.innerHTML = '<p class="text-gray-500">No weather data logged yet.</p>';
    }
}

function saveFlightUpdate() {
    if (!currentUpdateFlightId) return;
    const flight = flightLog.find(f => f.id === currentUpdateFlightId);
    
    flight.status = document.getElementById('flightStatus').value;
    flight.notes = document.getElementById('flightNotes').value;
    
    const csvText = document.getElementById('csvData').value.trim();
    if (csvText) {
        flight.rawData = csvText;
        analyzeFlightData(currentUpdateFlightId); // This also calls saveAllData
    } else {
        saveAllData();
    }
    
    updateFlightModal.style.display = 'none';
    openFlightLogModal();
    viewFlightDetails(currentUpdateFlightId);
}

// --- WEATHER APP LOGIC (INTEGRATED) ---

function fetchAndDisplayWeather() {
    if (!currentUpdateFlightId) return;
    weatherDisplay.innerHTML = '<p>Getting location...</p>';
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(onGeoSuccess, onGeoError);
    } else {
        weatherDisplay.innerHTML = '<p class="text-red-500">Geolocation not supported.</p>';
    }
}

function onGeoSuccess(position) {
    const { latitude, longitude } = position.coords;
    fetchWeatherByCoords(latitude, longitude);
}

function onGeoError(error) {
    weatherDisplay.innerHTML = `<p class="text-red-500">Error: ${error.message}</p>`;
}

async function fetchWeatherByCoords(lat, lon) {
    const url = `${openWeatherApiUrl}?lat=${lat}&lon=${lon}&appid=${openWeatherApiKey}&units=imperial`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error((await response.json()).message || 'Weather data not found.');
        
        const data = await response.json();
        const flight = flightLog.find(f => f.id === currentUpdateFlightId);
        if (flight) {
            flight.weather = data;
            saveAllData();
        }
        displayWeatherInModal(data);
    } catch (error) {
        weatherDisplay.innerHTML = `<p class="text-red-500">Error: ${error.message}</p>`;
    }
}

function displayWeatherInModal(data) {
    weatherDisplay.innerHTML = `
        <div class="grid grid-cols-2 gap-x-4 gap-y-1">
            <span><strong>Temp:</strong> ${Math.round(data.main.temp)}°F</span>
            <span><strong>Feels Like:</strong> ${Math.round(data.main.feels_like)}°F</span>
            <span class="capitalize"><strong>Condition:</strong> ${data.weather[0].description}</span>
            <span><strong>Wind:</strong> ${Math.round(data.wind.speed)} mph</span>
            <span><strong>Humidity:</strong> ${data.main.humidity}%</span>
            <span><strong>Visibility:</strong> ${(data.visibility / 1609).toFixed(1)} mi</span>
        </div>
    `;
}


// --- FLIGHT LOG AND PRE-FLIGHT (UNCHANGED and MODIFIED functions from rocket-logger) ---

function openPreFlightModal() {
    populateSelect(document.getElementById('preFlightRocketSelect'), rocketList, 'rocket_name');
    populateSelect(document.getElementById('preFlightEngineSelect'), engineList, 'motor_name');
    preFlightModal.style.display = 'block';
}

document.getElementById('savePreFlightBtn').addEventListener('click', () => {
    const rocketId = document.getElementById('preFlightRocketSelect').value;
    const engineId = document.getElementById('preFlightEngineSelect').value;
    const launchRodLength = parseFloat(document.getElementById('launchRodLength').value) || 1.0;
    
    if (!rocketId || !engineId) {
        showCustomAlert('Please select both a rocket and an engine.');
        return;
    }

    const rocketData = rocketList.find(r => r.id === rocketId);
    const engineData = engineList.find(e => e.id === engineId);
    const estimates = calculatePerformance(rocketData, engineData, launchRodLength);

    const newFlight = {
        id: Date.now().toString(),
        flightDate: new Date().toISOString(),
        rocketId, engineId,
        rocketName: rocketData.rocket_name,
        engineName: engineData.motor_name,
        launchRodLength,
        status: 'Pending',
        estimates,
        actuals: null,
        notes: '',
        rawData: '',
        weather: null // Add weather property
    };
    flightLog.unshift(newFlight);
    saveAllData();
    preFlightModal.style.display = 'none';
    openFlightLogModal();
    viewFlightDetails(newFlight.id);
});

function openFlightLogModal() {
    populateFlightList();
    document.getElementById('flightDetailsContainer').innerHTML = '<div class="text-center text-gray-500 dark:text-gray-400 p-8">Select a flight to view details.</div>';
    flightLogModal.style.display = 'block';
}

function populateFlightList() {
    const listEl = document.getElementById('flightList');
    listEl.innerHTML = '';
    flightLog.forEach(flight => {
        const statusColor = flight.status === 'Success' ? 'text-green-500' : flight.status === 'Failure' ? 'text-red-500' : 'text-yellow-500';
        const button = document.createElement('button');
        button.className = 'item-list-button w-full text-left';
        button.dataset.id = flight.id;
        button.innerHTML = `
            <div class="font-bold">${flight.rocketName} / ${flight.engineName}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">${new Date(flight.flightDate).toLocaleString()}</div>
            <div class="text-sm font-semibold ${statusColor}">${flight.status}</div>
        `;
        button.onclick = () => viewFlightDetails(flight.id);
        listEl.appendChild(button);
    });
}

function viewFlightDetails(flightId) {
    const flight = flightLog.find(f => f.id === flightId);
    const container = document.getElementById('flightDetailsContainer');
    document.querySelectorAll('#flightList .item-list-button').forEach(btn => btn.classList.toggle('selected', btn.dataset.id === flightId));

    // This is now VIEW-ONLY. Edit button is always hidden.
    document.getElementById('editFlightBtn').classList.add('hidden');
    const deleteBtn = document.getElementById('deleteFlightBtn');
    deleteBtn.classList.remove('hidden');
    deleteBtn.onclick = () => deleteFlightLog(flightId);
    
    let weatherHtml = '';
    if (flight.weather) {
        const weather = flight.weather;
        weatherHtml = `
            <div>
                <h4 class="font-semibold text-cyan-600 dark:text-cyan-400 mb-2">Launch Conditions</h4>
                <div class="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm bg-gray-100 dark:bg-gray-800/50 p-3 rounded-lg">
                    <span><strong>Temp:</strong> ${Math.round(weather.main.temp)}°F</span>
                    <span><strong>Feels Like:</strong> ${Math.round(weather.main.feels_like)}°F</span>
                    <span class="capitalize"><strong>Condition:</strong> ${weather.weather[0].description}</span>
                    <span><strong>Wind:</strong> ${Math.round(weather.wind.speed)} mph</span>
                    <span><strong>Humidity:</strong> ${weather.main.humidity}%</span>
                    <span><strong>Visibility:</strong> ${(weather.visibility / 1609).toFixed(1)} mi</span>
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        <h3 class="text-xl font-bold">${flight.rocketName} with ${flight.engineName}</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">Date: ${new Date(flight.flightDate).toLocaleString()}</p>
        ${weatherHtml}
        <div class="space-y-4 bg-gray-100 dark:bg-gray-800/50 p-4 rounded-lg mt-4">
            <div>
                <h4 class="font-semibold text-cyan-600 dark:text-cyan-400 mb-2">Pre-Flight Estimates</h4>
                <p>Est. Altitude: <strong>${flight.estimates.total_altitude ? flight.estimates.total_altitude.toFixed(2) : 'N/A'} m</strong></p>
                </div>
            ${flight.status !== 'Pending' ? generatePostFlightReport(flight) : '<p class="text-center text-gray-500">This flight is pending and has not been updated.</p>'}
        </div>
    `;

    if(flight.status !== 'Pending' && flight.actuals) {
         setTimeout(() => renderCharts(flightId), 100);
    }
}

function generatePostFlightReport(flight) {
    // This function remains largely the same, just used for display
     return `
        <div>
            <h4 class="font-semibold text-cyan-600 dark:text-cyan-400 mb-2">Post-Flight Report</h4>
            <p>Outcome: <strong class="${flight.status === 'Success' ? 'text-green-500' : 'text-red-500'}">${flight.status}</strong></p>
            <p class="text-sm mt-2"><strong>Notes:</strong><br>${flight.notes.replace(/\n/g, '<br>') || 'No notes.'}</p>
        </div>
        ${flight.actuals ? `
        <div>
            <h4 class="font-semibold text-cyan-600 dark:text-cyan-400 my-2">Actual Performance</h4>
            <div class="mt-4 bg-gray-200 dark:bg-gray-700 p-2 rounded-lg h-48 sm:h-64"><canvas id="altitudeChart"></canvas></div>
            <div class="mt-4 bg-gray-200 dark:bg-gray-700 p-2 rounded-lg h-48 sm:h-64"><canvas id="accelChart"></canvas></div>
        </div>
        ` : '<div><p>No flight computer data was analyzed.</p></div>'}
    `;
}

function deleteFlightLog(flightId) {
    if (!confirm('Are you sure you want to delete this flight log? This action cannot be undone.')) return;
    
    flightLog = flightLog.filter(f => f.id !== flightId);
    saveAllData();
    populateFlightList();
    document.getElementById('flightDetailsContainer').innerHTML = '<div class="text-center text-gray-400 p-8">Select a flight to view details.</div>';
    document.getElementById('editFlightBtn').classList.add('hidden');
    document.getElementById('deleteFlightBtn').classList.add('hidden');
}


// --- ALL OTHER ORIGINAL FUNCTIONS ---
// (The code for analyzeFlightData, renderCharts, openManageModal, saveItem, deleteItem, etc.
// remains exactly the same as in your original rocket logger script. Paste them here.)
// --- For brevity, I am omitting the large blocks of code that do not change ---
// --- You should copy them from your original "script.js" file and paste them below ---

function analyzeFlightData(flightId) { /* ... your original code ... */ }
function renderCharts(flightId) { /* ... your original code ... */ }
function showCustomAlert(message) { /* ... your original code ... */ }
function calculatePerformance(rocketData, engineData, launchRodLength = 1.0) { /* ... your original code ... */ }
function openManageModal(type) { /* ... your original code ... */ }
// ... and so on for all your other helper functions.


// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    loadAllData();
    
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme) {
        applyTheme(savedTheme);
    } else {
        applyTheme(systemPrefersDark ? 'dark' : 'light');
    }
    
    const updateTime = new Date().toUTCString();
    const footer = document.getElementById('app-footer');
    if (footer) {
        footer.innerHTML = `Version ${appVersion} | ${updateTime}`;
    }

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => console.log('SW registered'))
            .catch(error => console.log('SW registration failed'));
    }
});
