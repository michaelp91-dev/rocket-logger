const appVersion = '1.0.3';

// --- DATA STRUCTURES ---
let rocketList = [];
let engineList = [];
let flightLog = [];
let currentModalType = null;
let editingItemId = null;

// --- ROCKET SCIENCE CLASSES ---
class Rocket {
    constructor(data) {
        this.dry_mass = parseFloat(data.dry_mass_g) / 1000.0;
        this.diameter = parseFloat(data.diameter_cm) / 100.0;
        this.radius = this.diameter / 2.0;
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
        const cn_nose = 2.0, cp_nose = 0.666 * this.nose_cone_length;
        const interference = 1 + (this.radius / (this.fin_semi_span + this.radius));
        const cn_fins = interference * ((4 * this.num_fins * Math.pow(this.fin_semi_span / this.diameter, 2)) / (1 + Math.sqrt(1 + Math.pow(2 * this.fin_mid_chord_length / (this.fin_root_chord + this.fin_tip_chord), 2))));
        const term1 = this.fin_sweep_dist / 3.0 * (this.fin_root_chord + 2 * this.fin_tip_chord) / (this.fin_root_chord + this.fin_tip_chord);
        const term2 = (1.0 / 6.0) * (this.fin_root_chord + this.fin_tip_chord - (this.fin_root_chord * this.fin_tip_chord) / (this.fin_root_chord + this.fin_tip_chord));
        const cp_fins = this.nose_to_fin_dist + term1 + term2;
        return ((cn_nose * cp_nose) + (cn_fins * cp_fins)) / (cn_nose + cn_fins);
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

// --- MODAL & UI MANAGEMENT ---
const manageModal = document.getElementById('manageModal');
const preFlightModal = document.getElementById('preFlightModal');
const flightLogModal = document.getElementById('flightLogModal');

document.getElementById('manageRocketsBtn').addEventListener('click', () => openManageModal('rocket'));
document.getElementById('manageEnginesBtn').addEventListener('click', () => openManageModal('engine'));
document.getElementById('startPreFlightBtn').addEventListener('click', openPreFlightModal);
document.getElementById('viewFlightLogBtn').addEventListener('click', openFlightLogModal);
document.querySelectorAll('.close-modal-btn').forEach(btn => {
    btn.onclick = () => {
        manageModal.style.display = 'none';
        preFlightModal.style.display = 'none';
        flightLogModal.style.display = 'none';
    };
});

// --- FLIGHT LOG & PRE-FLIGHT ---
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
        alert('Please select both a rocket and an engine.');
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
        rawData: ''
    };
    flightLog.unshift(newFlight);
    saveAllData();
    preFlightModal.style.display = 'none';
    openFlightLogModal();
    viewFlightDetails(newFlight.id);
});

function openFlightLogModal() {
    populateFlightList();
    document.getElementById('flightDetailsContainer').innerHTML = '<div class="text-center text-gray-400 p-8">Select a flight to view details.</div>';
    flightLogModal.style.display = 'block';
}

function populateFlightList() {
    const listEl = document.getElementById('flightList');
    listEl.innerHTML = '';
    flightLog.forEach(flight => {
        const statusColor = flight.status === 'Success' ? 'text-green-400' : flight.status === 'Failure' ? 'text-red-400' : 'text-yellow-400';
        const button = document.createElement('button');
        button.className = 'item-list-button w-full text-left';
        button.dataset.id = flight.id;
        button.innerHTML = `
            <div class="font-bold">${flight.rocketName} / ${flight.engineName}</div>
            <div class="text-xs text-gray-400">${new Date(flight.flightDate).toLocaleString()}</div>
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
    
    // Show/hide edit and delete buttons
    const editBtn = document.getElementById('editFlightBtn');
    const deleteBtn = document.getElementById('deleteFlightBtn');
    if (flight.status === 'Pending') {
        editBtn.classList.remove('hidden');
        editBtn.onclick = () => editPreFlight(flightId);
    } else {
        editBtn.classList.add('hidden');
    }
    deleteBtn.classList.remove('hidden');
    deleteBtn.onclick = () => deleteFlightLog(flightId);
    
    // Get full rocket and engine data for detailed display
    const rocketData = rocketList.find(r => r.id === flight.rocketId);
    const engineData = engineList.find(e => e.id === flight.engineId);
    
    container.innerHTML = `
        <h3 class="text-xl font-bold">${flight.rocketName} with ${flight.engineName}</h3>
        <p class="text-sm text-gray-400">Date: ${new Date(flight.flightDate).toLocaleString()}</p>
        
        ${flight.status === 'Pending' ? generateRocketEngineDataDisplay(rocketData, engineData) : ''}
        
        <div class="space-y-4 bg-gray-900/50 p-4 rounded-lg">
            <div>
                <h4 class="font-semibold text-cyan-400 mb-2">Pre-Flight Estimates</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <h5 class="font-semibold text-cyan-300 mb-2">Flight Performance</h5>
                        <p>Est. Altitude: <strong>${flight.estimates.total_altitude ? flight.estimates.total_altitude.toFixed(2) : 'N/A'} m</strong></p>
                        <p>Est. Max Velocity: <strong>${flight.estimates.v ? flight.estimates.v.toFixed(2) : 'N/A'} m/s</strong></p>
                        <p>Launch Rod Length: <strong>${flight.launchRodLength || 1.0} m</strong></p>
                        <p>Launch Rod Velocity: <strong class="${flight.estimates.launch_rod_velocity && flight.estimates.launch_rod_velocity >= 10 ? 'text-green-400' : 'text-red-400'}">${flight.estimates.launch_rod_velocity ? flight.estimates.launch_rod_velocity.toFixed(2) : 'N/A'} m/s</strong></p>
                    </div>
                    <div>
                        <h5 class="font-semibold text-cyan-300 mb-2">Stability & Mass</h5>
                        <p>Stability: <strong class="${flight.estimates.stability_calibers && flight.estimates.stability_calibers >= 1.0 ? 'text-green-400' : 'text-red-400'}">${flight.estimates.stability_calibers ? flight.estimates.stability_calibers.toFixed(2) : 'N/A'} cal</strong></p>
                        <p>Loaded Mass: <strong>${flight.estimates.loaded_mass ? (flight.estimates.loaded_mass * 1000).toFixed(1) : 'N/A'} g</strong></p>
                        <p>T/W Ratio: <strong>${flight.estimates.thrust_to_weight_ratio ? flight.estimates.thrust_to_weight_ratio.toFixed(2) : 'N/A'}</strong></p>
                        <p>Min Thrust Needed: <strong>${flight.estimates.min_thrust_needed ? flight.estimates.min_thrust_needed.toFixed(2) : 'N/A'} N</strong></p>
                    </div>
                </div>
                <div class="mt-4">
                    <button id="showDetailsBtn" class="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg text-sm w-full">Show Calculation Details</button>
                    <div id="equationsContainer" class="hidden mt-4 p-4 bg-gray-900 rounded-lg text-xs space-y-4"></div>
                </div>
            </div>
            ${flight.status === 'Pending' ? generatePostFlightForm(flight.id) : generatePostFlightReport(flight)}
        </div>
    `;
    if(flight.status !== 'Pending' && flight.actuals) {
         setTimeout(() => renderCharts(flightId), 100);
    }
    
    // Add event listener for the new button
    document.getElementById('showDetailsBtn').addEventListener('click', (e) => {
        const btn = e.target;
        const container = document.getElementById('equationsContainer');
        const isHidden = container.classList.contains('hidden');
        if (isHidden) {
            container.innerHTML = generateEquationsDisplay(flight);
            // THIS IS THE NEW LINE: Tell MathJax to render the new content
            MathJax.typesetPromise([container]); 
            container.classList.remove('hidden');
            btn.textContent = 'Hide Calculation Details';
        } else {
            container.classList.add('hidden');
            container.innerHTML = '';
            btn.textContent = 'Show Calculation Details';
        }
    });
}

function generateEquationsDisplay(flight) {
    const rocketData = rocketList.find(r => r.id === flight.rocketId);
    const engineData = engineList.find(e => e.id === flight.engineId);
    if (!rocketData || !engineData) return '<p>Rocket or engine data not found.</p>';
    
    // Instantiate classes to perform calculations step-by-step
    const rocket = new Rocket(rocketData);
    const motor = new Motor(engineData);
    const g = 9.80665, rho = 1.2, Cd = 0.75;
    const launchRodLength = flight.launchRodLength;

    // --- Center of Pressure (COP) Calculation ---
    const cn_nose = 2.0;
    const cp_nose_m = 0.666 * rocket.nose_cone_length;
    const interference = 1 + (rocket.radius / (rocket.fin_semi_span + rocket.radius));
    const cn_fins_numerator = 4 * rocket.num_fins * Math.pow(rocket.fin_semi_span / rocket.diameter, 2);
    const cn_fins_denominator = 1 + Math.sqrt(1 + Math.pow(2 * rocket.fin_mid_chord_length / (rocket.fin_root_chord + rocket.fin_tip_chord), 2));
    const cn_fins = interference * (cn_fins_numerator / cn_fins_denominator);
    const term1_num = rocket.fin_root_chord + 2 * rocket.fin_tip_chord;
    const term1_den = rocket.fin_root_chord + rocket.fin_tip_chord;
    const term1 = (rocket.fin_sweep_dist / 3.0) * (term1_num / term1_den);
    const term2_sub = (rocket.fin_root_chord * rocket.fin_tip_chord) / (rocket.fin_root_chord + rocket.fin_tip_chord);
    const term2 = (1.0 / 6.0) * (rocket.fin_root_chord + rocket.fin_tip_chord - term2_sub);
    const cp_fins_m = rocket.nose_to_fin_dist + term1 + term2;
    const cop_m = ((cn_nose * cp_nose_m) + (cn_fins * cp_fins_m)) / (cn_nose + cn_fins);

    // --- Performance Calculation ---
    const loaded_mass = rocket.dry_mass + motor.initial_mass;
    const T = motor.avg_thrust;
    const M = loaded_mass;
    const area = Math.PI * Math.pow(rocket.radius, 2);
    const k = 0.5 * rho * Cd * area;
    const t_burn = motor.burn_time;
    const q = Math.sqrt((T - M * g) / k);
    const x = 2 * k * q / M;
    const v = q * (1 - Math.exp(-x * t_burn)) / (1 + Math.exp(-x * t_burn));
    const yb_num = T - M * g - k * Math.pow(v, 2);
    const yb = (yb_num <= 0) ? 0 : (-M / (2 * k)) * Math.log(yb_num / (T - M * g));
    const yc_num = M * g + k * Math.pow(v, 2);
    const yc = (M / (2 * k)) * Math.log(yc_num / (M * g));
    const total_altitude = yb + yc;
    
    // --- Other Calcs ---
    const thrust_to_weight_ratio = T / (M * g);
    const min_thrust_needed_tm_ratio = (Math.pow(10, 2) / (2 * launchRodLength)) + g;
    const min_thrust_needed = M * min_thrust_needed_tm_ratio;
    const launch_rod_velocity = Math.sqrt(2 * ((motor.peak_thrust - M * g) / M) * launchRodLength);
    
    return `
        <div class="space-y-4">
            <div>
                <h5 class="font-semibold text-cyan-300 mb-2">Center of Pressure (COP)</h5>
                <p class="mb-2">Formula: $COP = \\frac{(C_{N,nose} \\cdot CP_{nose}) + (C_{N,fins} \\cdot CP_{fins})}{C_{N,nose} + C_{N,fins}}$</p>
                <ul class="list-disc list-inside space-y-1 pl-2">
                    <li>Nose Cone $C_{N,nose}$: <strong>${cn_nose.toFixed(2)}</strong> (constant for ogive nose)</li>
                    <li>Nose Cone $CP_{nose}$: $0.666 \\cdot L_{nose}$ = $0.666 \\cdot ${(rocket.nose_cone_length*100).toFixed(2)}\\text{ cm}$ = <strong>${(cp_nose_m*100).toFixed(2)} cm</strong></li>
                    <li>Fin Interference Factor: $1 + \\frac{R}{S+R}$ = $1 + \\frac{{(rocket.radius*100).toFixed(2)}}{${(rocket.fin_semi_span*100).toFixed(2)}+${(rocket.radius*100).toFixed(2)}}$ = <strong>${interference.toFixed(3)}</strong></li>
                    <li>Fins $C_{N,fins}$: <strong>${cn_fins.toFixed(3)}</strong></li>
                    <li>Fins $CP_{fins}$: <strong>${(cp_fins_m*100).toFixed(2)} cm</strong> (from nose tip)</li>
                    <li><strong>Final COP</strong>: <strong>${(cop_m*100).toFixed(2)} cm</strong> (from nose tip)</li>
                </ul>
            </div>
            
            <div>
                <h5 class="font-semibold text-cyan-300 mb-2">Estimated Altitude & Velocity</h5>
                <p class="mb-2">Based on the 1D motion equation with drag.</p>
                <ul class="list-disc list-inside space-y-1 pl-2">
                    <li>Air Density ($\\rho$): <strong>${rho} \\text{ kg/m}^3$</strong>, Drag Coeff. ($C_d$): <strong>${Cd}</strong></li>
                    <li>Cross-sectional Area (A): $\\pi \\cdot r^2$ = $\\pi \\cdot {${(rocket.radius*100).toFixed(2)}}^2 \\text{ cm}^2$ = <strong>${area.toFixed(5)} m^2</strong></li>
                    <li>Drag Parameter (k): $0.5 \\cdot \\rho \\cdot C_d \\cdot A$ = <strong>${k.toFixed(4)}</strong></li>
                    <li>Terminal Velocity under Thrust (q): $\\sqrt{\\frac{T - Mg}{k}}$ = <strong>${q.toFixed(2)} m/s</strong></li>
                    <li>Intermediate value (x): $\\frac{2kq}{M}$ = <strong>${x.toFixed(4)}</strong></li>
                    <li><strong>Est. Max Velocity (v)</strong>: $q \\cdot \\frac{1-e^{-xt}}{1+e^{-xt}}$ = <strong>${v.toFixed(2)} m/s</strong></li>
                    <li>Burnout Altitude ($y_b$): $\\frac{-M}{2k} \\ln(\\frac{T-Mg-kv^2}{T-Mg})$ = <strong>${yb.toFixed(2)} m</strong></li>
                    <li>Coasting Altitude ($y_c$): $\\frac{M}{2k} \\ln(\\frac{Mg+kv^2}{Mg})$ = <strong>${yc.toFixed(2)} m</strong></li>
                    <li><strong>Est. Total Altitude ($y_b + y_c$)</strong>: <strong>${total_altitude.toFixed(2)} m</strong></li>
                </ul>
            </div>

            <div>
                <h5 class="font-semibold text-cyan-300 mb-2">Launch Stability & Thrust</h5>
                <ul class="list-disc list-inside space-y-1 pl-2">
                    <li><strong>Thrust-to-Weight Ratio</strong>: $\\frac{T}{Mg}$ = $\\frac{${T.toFixed(2)} \\text{ N}}{${M.toFixed(3)} \\text{ kg} \\cdot ${g} \\text{ m/s}^2}$ = <strong>${thrust_to_weight_ratio.toFixed(2)}</strong></li>
                    <li><strong>Min Thrust Needed</strong>: $M(\\frac{v_{safe}^2}{2L} + g)$ = ${M.toFixed(3)}(\\frac{10^2}{2 \\cdot ${launchRodLength}} + ${g})$ = <strong>${min_thrust_needed.toFixed(2)} N</strong></li>
                    <li><strong>Launch Rod Velocity</strong>: $\\sqrt{2(\\frac{T_{peak}-Mg}{M})L}$ = $\\sqrt{2(\\frac{${motor.peak_thrust.toFixed(2)}-${M.toFixed(3)}\\cdot${g}}{${M.toFixed(3)}})${launchRodLength}}$ = <strong>${launch_rod_velocity.toFixed(2)} m/s</strong></li>
                </ul>
            </div>
        </div>
    `;
}

function generateRocketEngineDataDisplay(rocketData, engineData) {
    if (!rocketData || !engineData) return '';
    
    const rocket = new Rocket(rocketData);
    const motor = new Motor(engineData);
    
    return `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div class="bg-gray-900/50 p-4 rounded-lg">
                <h4 class="font-semibold text-cyan-400 mb-3">Rocket Data</h4>
                <div class="grid grid-cols-2 gap-2 text-sm">
                    <div><strong>Name:</strong> ${rocketData.rocket_name}</div>
                    <div><strong>Dry Mass:</strong> ${rocketData.dry_mass_g}g</div>
                    <div><strong>Length:</strong> ${rocketData.length_cm}cm</div>
                    <div><strong>Diameter:</strong> ${rocketData.diameter_cm}cm</div>
                    <div><strong>Nose Cone:</strong> ${rocketData.nose_cone_length_cm}cm</div>
                    <div><strong>COG:</strong> ${rocketData.cog_cm}cm</div>
                    <div><strong>Fins:</strong> ${rocketData.num_fins}</div>
                    <div><strong>Root Chord:</strong> ${rocketData.fin_root_chord_cm}cm</div>
                    <div><strong>Tip Chord:</strong> ${rocketData.fin_tip_chord_cm}cm</div>
                    <div><strong>Semi-Span:</strong> ${rocketData.fin_semi_span_cm}cm</div>
                    <div><strong>Sweep:</strong> ${rocketData.fin_sweep_dist_cm}cm</div>
                    <div><strong>Nose to Fin:</strong> ${rocketData.nose_to_fin_dist_cm}cm</div>
                </div>
                <div class="mt-3 pt-3 border-t border-gray-600">
                    <h5 class="font-semibold text-cyan-300 mb-2">Calculated Values</h5>
                    <div class="grid grid-cols-2 gap-2 text-sm">
                        <div><strong>COP:</strong> ${(rocket.calculate_cop() * 100).toFixed(2)}cm</div>
                        <div><strong>Mid Chord:</strong> ${(rocket.fin_mid_chord_length * 100).toFixed(2)}cm</div>
                    </div>
                </div>
            </div>
            
            <div class="bg-gray-900/50 p-4 rounded-lg">
                <h4 class="font-semibold text-cyan-400 mb-3">Engine Data</h4>
                <div class="grid grid-cols-2 gap-2 text-sm">
                    <div><strong>Name:</strong> ${engineData.motor_name}</div>
                    <div><strong>Initial Mass:</strong> ${engineData.motor_initial_mass_g}g</div>
                    <div><strong>Propellant:</strong> ${engineData.motor_propellant_mass_g}g</div>
                    <div><strong>Avg Thrust:</strong> ${engineData.motor_avg_thrust_n}N</div>
                    <div><strong>Peak Thrust:</strong> ${engineData.motor_peak_thrust_n || engineData.motor_avg_thrust_n}N</div>
                    <div><strong>Peak Time:</strong> ${engineData.motor_peak_time_s || 0.1}s</div>
                    <div><strong>Burn Time:</strong> ${engineData.motor_burn_time_s}s</div>
                </div>
            </div>
        </div>
    `;
}

function generatePostFlightForm(flightId) {
    return `
        <div>
            <h4 class="font-semibold text-cyan-400 mb-2">Post-Flight Report</h4>
            <div class="space-y-3">
                <div>
                    <label for="flightStatus" class="text-sm">Flight Outcome:</label>
                    <select id="flightStatus" class="w-full bg-gray-700 rounded p-1 mt-1">
                        <option value="Success">Success</option>
                        <option value="Failure">Failure</option>
                    </select>
                </div>
                <div>
                    <label for="flightNotes" class="text-sm">Notes:</label>
                    <textarea id="flightNotes" rows="3" class="w-full bg-gray-700 rounded p-1 mt-1" placeholder="e.g., Perfect flight, slight weathercocking."></textarea>
                </div>
                <button onclick="saveFlightReport('${flightId}')" class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg">Save Report</button>
            </div>
        </div>
        <div>
            <h4 class="font-semibold text-cyan-400 mb-2">Flight Computer Data</h4>
            <textarea id="csvData" rows="6" class="w-full p-2 bg-gray-700 border border-gray-600 rounded-xl" placeholder="Paste raw CSV data here..."></textarea>
            <button onclick="analyzeFlightData('${flightId}')" class="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg">Analyze Flight Data</button>
        </div>
    `;
}

function generatePostFlightReport(flight) {
     return `
        <div>
            <h4 class="font-semibold text-cyan-400 mb-2">Post-Flight Report</h4>
            <p>Outcome: <strong class="${flight.status === 'Success' ? 'text-green-400' : 'text-red-400'}">${flight.status}</strong></p>
            <p class="text-sm mt-2"><strong>Notes:</strong><br>${flight.notes.replace(/\n/g, '<br>') || 'No notes.'}</p>
        </div>
        ${flight.actuals ? `
        <div>
            <h4 class="font-semibold text-cyan-400 mb-2">Actual Performance</h4>
            <div class="grid grid-cols-3 gap-2 text-center">
                <div class="bg-gray-700 p-2 rounded-lg"><h5 class="text-xs">Max Altitude</h5><p class="font-bold">${flight.actuals.maxAltitude.toFixed(2)} m</p></div>
                <div class="bg-gray-700 p-2 rounded-lg"><h5 class="text-xs">Max G-Force</h5><p class="font-bold">${flight.actuals.maxGForce.toFixed(2)} G</p></div>
                <div class="bg-gray-700 p-2 rounded-lg"><h5 class="text-xs">Top Speed</h5><p class="font-bold">${flight.actuals.maxVelocity.toFixed(2)} m/s</p></div>
            </div>
            <div class="mt-4 bg-gray-700 p-2 rounded-lg h-48 sm:h-64"><canvas id="altitudeChart"></canvas></div>
            <div class="mt-4 bg-gray-700 p-2 rounded-lg h-48 sm:h-64"><canvas id="accelChart"></canvas></div>
        </div>
        ` : '<div><p>No flight computer data was analyzed.</p></div>'}
    `;
}

function saveFlightReport(flightId) {
    const flight = flightLog.find(f => f.id === flightId);
    flight.status = document.getElementById('flightStatus').value;
    flight.notes = document.getElementById('flightNotes').value;
    saveAllData();
    populateFlightList();
    viewFlightDetails(flightId);
}

// --- FLIGHT DATA ANALYSIS ---
function analyzeFlightData(flightId) {
    const flight = flightLog.find(f => f.id === flightId);
    const csvText = document.getElementById('csvData').value.trim();
    if (!csvText) { alert('Please paste CSV data.'); return; }
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    if (lines.length <= 1) { alert('No data rows found.'); return; }

    try {
        const dataLines = lines.slice(1);
        let maxAltitude = -Infinity, maxGForce = -Infinity, maxVelocity = -Infinity, currentVelocity = 0, lastTimeS = 0;
        const basePressureHpa = (parseFloat(dataLines[0].split(',')[1]) / 4.0) / 100.0;
        const gravityG = parseFloat(dataLines[0].split(',')[4]) / 256.0;
        dataLines.forEach(line => {
            const values = line.split(',');
            if (values.length < 6) return;
            const timeS = parseFloat(values[0]) / 1000.0;
            const pressureHpa = (parseFloat(values[1]) / 4.0) / 100.0;
            const ayG = parseFloat(values[4]) / 256.0;
            const altitudeM = 44330.0 * (1.0 - Math.pow(pressureHpa / basePressureHpa, 0.1903));
            const verticalAccelMs2 = (ayG - gravityG) * 9.81;
            currentVelocity += verticalAccelMs2 * (timeS - lastTimeS);
            lastTimeS = timeS;

            if (altitudeM > maxAltitude) maxAltitude = altitudeM;
            if (Math.abs(ayG) > maxGForce) maxGForce = Math.abs(ayG);
            if (currentVelocity > maxVelocity) maxVelocity = currentVelocity;
        });
        flight.actuals = { maxAltitude, maxGForce, maxVelocity };
        flight.rawData = csvText;
        if (flight.status === 'Pending') {
            flight.status = document.getElementById('flightStatus').value;
            flight.notes = document.getElementById('flightNotes').value;
        }
        saveAllData();
        populateFlightList();
        viewFlightDetails(flightId);
    } catch (error) {
        alert("Failed to parse flight data. Please check the format.");
        console.error("Analysis Error:", error);
    }
}

function renderCharts(flightId) {
    const flight = flightLog.find(f => f.id === flightId);
    if (!flight || !flight.actuals) return;

    const dataLines = flight.rawData.split('\n').filter(line => line.trim() !== '').slice(1);
    let processedData = [];
    const basePressureHpa = (parseFloat(dataLines[0].split(',')[1]) / 4.0) / 100.0;

    dataLines.forEach(line => {
         const values = line.split(',');
         if (values.length < 6) return;
         const timeS = parseFloat(values[0]) / 1000.0;
         const pressureHpa = (parseFloat(values[1]) / 4.0) / 100.0;
         const altitudeM = 44330.0 * (1.0 - Math.pow(pressureHpa / basePressureHpa, 0.1903));
         const axG = parseFloat(values[3]) / 256.0;
         const ayG = parseFloat(values[4]) / 256.0;
         const azG = parseFloat(values[5]) / 256.0;
         processedData.push({ timeS, altitudeM, axG, ayG, azG });
    });
    const labels = processedData.map(d => d.timeS.toFixed(3));
    const gridColor = 'rgba(255, 255, 255, 0.1)', fontColor = '#e5e7eb';
    const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: fontColor } } }, scales: { x: { ticks: { color: fontColor }, grid: { color: gridColor } }, y: { ticks: { color: fontColor }, grid: { color: gridColor } } } };
    const altCtx = document.getElementById('altitudeChart')?.getContext('2d');
    if(altCtx) new Chart(altCtx, { type: 'line', data: { labels, datasets: [{ label: 'Altitude (m)', data: processedData.map(d => d.altitudeM), borderColor: '#6366f1', borderWidth: 2, pointRadius: 0 }] }, options: chartOptions });
    const accelCtx = document.getElementById('accelChart')?.getContext('2d');
    if(accelCtx) new Chart(accelCtx, { type: 'line', data: { labels, datasets: [ { label: 'Accel X (G)', data: processedData.map(d => d.axG), borderColor: '#ec4899', borderWidth: 2, pointRadius: 0 }, { label: 'Accel Y (G)', data: processedData.map(d => d.ayG), borderColor: '#22c55e', borderWidth: 2, pointRadius: 0 }, { label: 'Accel Z (G)', data: processedData.map(d => d.azG), borderColor: '#3b82f6', borderWidth: 2, pointRadius: 0 } ] }, options: chartOptions });
}

// --- PERFORMANCE ESTIMATION ---
function calculatePerformance(rocketData, engineData, launchRodLength = 1.0) {
    const rocket = new Rocket(rocketData);
    const motor = new Motor(engineData);
    const g = 9.80665, rho = 1.2, Cd = 0.75;
    const loaded_mass = rocket.dry_mass + motor.initial_mass;
    const T = motor.avg_thrust, M = loaded_mass;
    
    if (T <= M * g) return { error: "Thrust is less than weight." };
    
    const thrust_to_weight_ratio = T / (M * g);
    const min_thrust_needed_tm_ratio = (Math.pow(10, 2) / (2 * launchRodLength)) + g;
    const min_thrust_needed = M * min_thrust_needed_tm_ratio;
    const launch_rod_velocity = Math.sqrt(2 * ((motor.peak_thrust - M * g) / M) * launchRodLength);
    
    // Original altitude calculation
    const area = Math.PI * Math.pow(rocket.radius, 2);
    const k = 0.5 * rho * Cd * area;
    const t = motor.burn_time;
    const q = Math.sqrt((T - M * g) / k);
    const x = 2 * k * q / M;
    const v = q * (1 - Math.exp(-x * t)) / (1 + Math.exp(-x * t));
    const yb_num = T - M * g - k * Math.pow(v, 2);
    const yb = (yb_num <= 0) ? 0 : (-M / (2 * k)) * Math.log(yb_num / (T - M * g));
    const yc = (M / (2 * k)) * Math.log((M * g + k * Math.pow(v, 2)) / (M * g));
    const total_altitude = yb + yc;
    const stability_calibers = (rocket.calculate_cop() - rocket.cog) / rocket.diameter;

    return { 
        total_altitude, 
        v, 
        stability_calibers,
        launch_rod_velocity,
        min_thrust_needed,
        thrust_to_weight_ratio,
        loaded_mass
    };
}

// --- ROCKET/ENGINE MANAGEMENT ---
const rocketFormFields = [{ id: 'rocket_name', label: 'Rocket Name', type: 'text' }, { id: 'dry_mass_g', label: 'Dry Mass (g)', type: 'number' }, { id: 'length_cm', label: 'Length (cm)', type: 'number' }, { id: 'diameter_cm', label: 'Diameter (cm)', type: 'number' }, { id: 'nose_cone_length_cm', label: 'Nose Cone Length (cm)', type: 'number' }, { id: 'cog_cm', label: 'Center of Gravity (cm)', type: 'number' }, { id: 'num_fins', label: 'Number of Fins', type: 'number' }, { id: 'fin_root_chord_cm', label: 'Root Chord (cm)', type: 'number' }, { id: 'fin_tip_chord_cm', label: 'Tip Chord (cm)', type: 'number' }, { id: 'fin_semi_span_cm', label: 'Semi-Span (cm)', type: 'number' }, { id: 'fin_sweep_dist_cm', label: 'Sweep Distance (cm)', type: 'number' }, { id: 'nose_to_fin_dist_cm', label: 'Nose Tip to Fin Root (cm)', type: 'number' }];
const engineFormFields = [{ id: 'motor_name', label: 'Engine Name', type: 'text' }, { id: 'motor_initial_mass_g', label: 'Initial Mass (g)', type: 'number' }, { id: 'motor_propellant_mass_g', label: 'Propellant Mass (g)', type: 'number' }, { id: 'motor_avg_thrust_n', label: 'Average Thrust (N)', type: 'number' }, { id: 'motor_peak_thrust_n', label: 'Peak Thrust (N)', type: 'number' }, { id: 'motor_peak_time_s', label: 'Time to Peak (s)', type: 'number' }, { id: 'motor_burn_time_s', label: 'Burn Time (s)', type: 'number' }];
function generateFormHTML(fields) { return fields.map(f => `<div class="grid grid-cols-1 sm:grid-cols-[1fr_1.5fr] gap-1 sm:gap-2 items-center"><label for="${f.id}" class="text-left sm:text-right">${f.label}:</label><input id="${f.id}" type="${f.type}" placeholder="${f.placeholder || ''}" class="bg-gray-700 rounded p-2 w-full"></div>`).join(''); }
function openManageModal(type) {
    currentModalType = type;
    const isRocket = type === 'rocket';
    document.getElementById('modalTitle').textContent = isRocket ? 'Manage Rockets' : 'Manage Engines';
    document.getElementById('formContainer').innerHTML = generateFormHTML(isRocket ? rocketFormFields : engineFormFields);
    populateModalList();
    clearForm();
    manageModal.style.display = 'block';
}
function populateModalList() {
    const list = currentModalType === 'rocket' ? rocketList : engineList;
    const listEl = document.getElementById('itemList');
    listEl.innerHTML = '';
    list.forEach(item => {
        const button = document.createElement('button');
        button.className = 'item-list-button w-full text-left';
        button.textContent = item.rocket_name || item.motor_name;
        button.dataset.id = item.id;
        listEl.appendChild(button);
    });
}

function displayItemData(itemData) {
    const dataDisplay = document.getElementById('dataDisplay');
    const dataContent = document.getElementById('dataContent');
    
    if (!itemData) {
        dataDisplay.classList.add('hidden');
        return;
    }
    
    dataDisplay.classList.remove('hidden');
    let html = '';
    
    if (currentModalType === 'rocket') {
        const rocket = new Rocket(itemData);
        html = `
            <div class="grid grid-cols-2 gap-4">
                <div><strong>Name:</strong> ${itemData.rocket_name}</div>
                <div><strong>Dry Mass:</strong> ${itemData.dry_mass_g}g</div>
                <div><strong>Length:</strong> ${itemData.length_cm}cm</div>
                <div><strong>Diameter:</strong> ${itemData.diameter_cm}cm</div>
                <div><strong>Nose Cone Length:</strong> ${itemData.nose_cone_length_cm}cm</div>
                <div><strong>Center of Gravity:</strong> ${itemData.cog_cm}cm</div>
                <div><strong>Number of Fins:</strong> ${itemData.num_fins}</div>
                <div><strong>Root Chord:</strong> ${itemData.fin_root_chord_cm}cm</div>
                <div><strong>Tip Chord:</strong> ${itemData.fin_tip_chord_cm}cm</div>
                <div><strong>Semi-Span:</strong> ${itemData.fin_semi_span_cm}cm</div>
                <div><strong>Sweep Distance:</strong> ${itemData.fin_sweep_dist_cm}cm</div>
                <div><strong>Nose to Fin Distance:</strong> ${itemData.nose_to_fin_dist_cm}cm</div>
            </div>
            <div class="mt-4 pt-4 border-t border-gray-600">
                <h5 class="font-semibold text-cyan-300 mb-2">Calculated Values</h5>
                <div class="grid grid-cols-2 gap-4">
                    <div><strong>Center of Pressure:</strong> ${(rocket.calculate_cop() * 100).toFixed(2)}cm</div>
                    <div><strong>Mid Chord Length:</strong> ${(rocket.fin_mid_chord_length * 100).toFixed(2)}cm</div>
                </div>
            </div>
        `;
    } else {
        html = `
            <div class="grid grid-cols-2 gap-4">
                <div><strong>Name:</strong> ${itemData.motor_name}</div>
                <div><strong>Initial Mass:</strong> ${itemData.motor_initial_mass_g}g</div>
                <div><strong>Propellant Mass:</strong> ${itemData.motor_propellant_mass_g}g</div>
                <div><strong>Average Thrust:</strong> ${itemData.motor_avg_thrust_n}N</div>
                <div><strong>Peak Thrust:</strong> ${itemData.motor_peak_thrust_n || itemData.motor_avg_thrust_n}N</div>
                <div><strong>Time to Peak:</strong> ${itemData.motor_peak_time_s || 0.1}s</div>
                <div><strong>Burn Time:</strong> ${itemData.motor_burn_time_s}s</div>
            </div>
        `;
    }
    
    dataContent.innerHTML = html;
}
function clearForm() {
    const fields = currentModalType === 'rocket' ? rocketFormFields : engineFormFields;
    fields.forEach(f => document.getElementById(f.id).value = '');
    editingItemId = null;
    document.getElementById('saveItemBtn').textContent = 'Save as New';
    document.getElementById('deleteItemBtn').classList.add('hidden');
    document.querySelectorAll('.item-list-button.selected').forEach(b => b.classList.remove('selected'));
    displayItemData(null);
}
function saveItem() {
    const list = currentModalType === 'rocket' ? rocketList : engineList;
    const fields = currentModalType === 'rocket' ? rocketFormFields : engineFormFields;
    const data = { id: editingItemId || Date.now().toString() };
    for (const field of fields) {
        const value = document.getElementById(field.id).value;
        if (!value) { alert(`Please fill out the "${field.label}" field.`); return; }
        data[field.id] = value;
    }
    if (editingItemId) {
        const index = list.findIndex(item => item.id === editingItemId);
        list[index] = data;
    } else {
        list.push(data);
    }
    saveAllData();
    manageModal.style.display = 'none';
}
function deleteItem() {
    if (!editingItemId || !confirm('Are you sure?')) return;
    if (currentModalType === 'rocket') rocketList = rocketList.filter(item => item.id !== editingItemId);
    else engineList = engineList.filter(item => item.id !== editingItemId);
    saveAllData();
    populateModalList();
    clearForm();
}
function populateSelect(selectEl, list, nameKey) {
    selectEl.innerHTML = '<option value="">-- Select --</option>';
    list.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item[nameKey];
        selectEl.appendChild(option);
    });
}
document.getElementById('itemList').addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') {
        const id = e.target.dataset.id;
        const list = currentModalType === 'rocket' ? rocketList : engineList;
        const itemData = list.find(item => item.id === id);
        if (itemData) {
            const fields = currentModalType === 'rocket' ? rocketFormFields : engineFormFields;
            fields.forEach(f => document.getElementById(f.id).value = itemData[f.id] || '');
            editingItemId = id;
            document.getElementById('saveItemBtn').textContent = 'Save Changes';
            document.getElementById('deleteItemBtn').classList.remove('hidden');
            document.querySelectorAll('.item-list-button.selected').forEach(b => b.classList.remove('selected'));
            e.target.classList.add('selected');
            displayItemData(itemData);
        }
    }
});
document.getElementById('newItemBtn').addEventListener('click', clearForm);
document.getElementById('saveItemBtn').addEventListener('click', saveItem);
document.getElementById('deleteItemBtn').addEventListener('click', deleteItem);

function editPreFlight(flightId) {
    const flight = flightLog.find(f => f.id === flightId);
    if (!flight || flight.status !== 'Pending') return;
    
    document.getElementById('preFlightRocketSelect').value = flight.rocketId;
    document.getElementById('preFlightEngineSelect').value = flight.engineId;
    document.getElementById('launchRodLength').value = flight.launchRodLength || 1.0;
    
    // Change save button to update mode
    const saveBtn = document.getElementById('savePreFlightBtn');
    saveBtn.textContent = 'Update Pre-Flight';
    saveBtn.onclick = () => updatePreFlight(flightId);
    
    flightLogModal.style.display = 'none';
    preFlightModal.style.display = 'block';
}

function updatePreFlight(flightId) {
    const flight = flightLog.find(f => f.id === flightId);
    const rocketId = document.getElementById('preFlightRocketSelect').value;
    const engineId = document.getElementById('preFlightEngineSelect').value;
    const launchRodLength = parseFloat(document.getElementById('launchRodLength').value) || 1.0;
    
    if (!rocketId || !engineId) {
        alert('Please select both a rocket and an engine.');
        return;
    }

    const rocketData = rocketList.find(r => r.id === rocketId);
    const engineData = engineList.find(e => e.id === engineId);
    const estimates = calculatePerformance(rocketData, engineData, launchRodLength);

    flight.rocketId = rocketId;
    flight.engineId = engineId;
    flight.rocketName = rocketData.rocket_name;
    flight.engineName = engineData.motor_name;
    flight.launchRodLength = launchRodLength;
    flight.estimates = estimates;
    
    saveAllData();
    
    // Reset save button
    const saveBtn = document.getElementById('savePreFlightBtn');
    saveBtn.textContent = 'Save Pre-Flight & Estimate';
    saveBtn.onclick = document.getElementById('savePreFlightBtn').onclick;
    
    preFlightModal.style.display = 'none';
    openFlightLogModal();
    viewFlightDetails(flightId);
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

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    loadAllData();
    
    // Update footer
    const updateTime = new Date().toUTCString();
    const footer = document.getElementById('app-footer');
    if (footer) {
        footer.innerHTML = `Version ${appVersion} | Updated on: ${updateTime}`;
    }

    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => console.log('SW registered'))
            .catch(error => console.log('SW registration failed'));
    }
});