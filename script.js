const appVersion = '2.0.0'; // Updated Version

// --- WEATHER API CONFIGURATION ---
// ⚠️ PASTE YOUR OPENWEATHER API KEY HERE
const openWeatherApiKey = 'YOUR_API_KEY_HERE';
const openWeatherApiUrl = 'https://api.openweathermap.org/data/2.5/weather';


// --- DATA STRUCTURES ---
let rocketList = [];
let engineList = [];
let flightLog = [];
let currentModalType = null;
let editingItemId = null;
let currentUpdateFlightId = null;

// --- DOM ELEMENT REFERENCES ---
// (Your existing DOM references for modals, buttons, etc.)
const updateFlightBtn = document.getElementById('updateFlightBtn');
const updateFlightModal = document.getElementById('updateFlightModal');
const updateFlightSelect = document.getElementById('updateFlightSelect');
const weatherSection = document.getElementById('weatherSection');
const postFlightSection = document.getElementById('postFlightSection');
const getWeatherBtn = document.getElementById('getWeatherBtn');
const weatherDisplay = document.getElementById('weatherDisplay');
const saveUpdateBtn = document.getElementById('saveUpdateBtn');

// --- EVENT LISTENERS ---
// (Your existing listeners for manageRockets, themeToggle, etc.)
updateFlightBtn.addEventListener('click', openUpdateFlightModal);
updateFlightSelect.addEventListener('change', handleUpdateFlightSelection);
getWeatherBtn.addEventListener('click', fetchAndDisplayWeather);
saveUpdateBtn.addEventListener('click', saveFlightUpdate);


// --- NEW AND UPDATED FUNCTIONS ---

function openUpdateFlightModal() {
    // Populate the dropdown with only pending flights
    const pendingFlights = flightLog.filter(f => f.status === 'Pending');
    updateFlightSelect.innerHTML = '<option value="">-- Select a Pending Flight --</option>';
    pendingFlights.forEach(flight => {
        const option = document.createElement('option');
        option.value = flight.id;
        option.textContent = `${flight.rocketName} / ${flight.engineName} (${new Date(flight.flightDate).toLocaleDateString()})`;
        updateFlightSelect.appendChild(option);
    });

    // Reset and hide the form sections
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
    
    // Show the form sections
    weatherSection.classList.remove('hidden');
    postFlightSection.classList.remove('hidden');
    saveUpdateBtn.classList.remove('hidden');

    // Populate existing data
    const flight = flightLog.find(f => f.id === currentUpdateFlightId);
    document.getElementById('flightStatus').value = flight.status === 'Pending' ? 'Success' : flight.status;
    document.getElementById('flightNotes').value = flight.notes || '';
    document.getElementById('csvData').value = flight.rawData || '';

    // Display saved weather if it exists
    if (flight.weather) {
        displayWeatherInModal(flight.weather);
    } else {
        weatherDisplay.innerHTML = '<p class="text-gray-500">No weather data logged yet.</p>';
    }
}

function saveFlightUpdate() {
    if (!currentUpdateFlightId) return;

    const flight = flightLog.find(f => f.id === currentUpdateFlightId);
    
    // Save weather data (if it was fetched and stored on the flight object)
    // The weather is saved when it's fetched, so we just need to save the other parts.

    // Save post-flight report
    flight.status = document.getElementById('flightStatus').value;
    flight.notes = document.getElementById('flightNotes').value;
    
    // Save and analyze flight computer data if present
    const csvText = document.getElementById('csvData').value.trim();
    if (csvText) {
        flight.rawData = csvText;
        analyzeFlightData(currentUpdateFlightId); // This function will also saveAllData
    } else {
        saveAllData();
    }
    
    updateFlightModal.style.display = 'none';
    // Optionally, open the log to show the updated flight
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
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || 'Weather data not found.');
        }
        const data = await response.json();
        
        // Find the current flight and attach the weather data to it
        const flight = flightLog.find(f => f.id === currentUpdateFlightId);
        if (flight) {
            flight.weather = data; // Save the full weather object
            saveAllData(); // Persist the change immediately
        }
        
        displayWeatherInModal(data);

    } catch (error) {
        weatherDisplay.innerHTML = `<p class="text-red-500">Error: ${error.message}</p>`;
    }
}

function displayWeatherInModal(data) {
    // This function creates the HTML to display the weather inside the modal
    weatherDisplay.innerHTML = `
        <div class="grid grid-cols-2 gap-x-4 gap-y-1">
            <span><strong>Temp:</strong> ${Math.round(data.main.temp)}°F</span>
            <span><strong>Feels Like:</strong> ${Math.round(data.main.feels_like)}°F</span>
            <span><strong>Condition:</strong> ${data.weather[0].description}</span>
            <span><strong>Wind:</strong> ${Math.round(data.wind.speed)} mph</span>
            <span><strong>Humidity:</strong> ${data.main.humidity}%</span>
            <span><strong>Visibility:</strong> ${(data.visibility / 1609).toFixed(1)} mi</span>
        </div>
    `;
}

// --- MODIFIED FLIGHT LOG VIEWING ---

function viewFlightDetails(flightId) {
    // This function is now VIEW-ONLY
    const flight = flightLog.find(f => f.id === flightId);
    const container = document.getElementById('flightDetailsContainer');
    document.querySelectorAll('#flightList .item-list-button').forEach(btn => btn.classList.toggle('selected', btn.dataset.id === flightId));

    // Remove the "Edit" button logic
    document.getElementById('editFlightBtn').classList.add('hidden');
    const deleteBtn = document.getElementById('deleteFlightBtn');
    deleteBtn.classList.remove('hidden');
    deleteBtn.onclick = () => deleteFlightLog(flightId);

    // Generate HTML for flight details, including the new weather section
    let weatherHtml = '';
    if (flight.weather) {
        const weatherData = flight.weather;
        weatherHtml = `
            <div>
                <h4 class="font-semibold text-cyan-600 dark:text-cyan-400 mb-2">Launch Conditions</h4>
                <div class="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm bg-gray-100 dark:bg-gray-800/50 p-3 rounded-lg">
                    <span><strong>Temp:</strong> ${Math.round(weatherData.main.temp)}°F</span>
                    <span><strong>Feels Like:</strong> ${Math.round(weatherData.main.feels_like)}°F</span>
                    <span class="capitalize"><strong>Condition:</strong> ${weatherData.weather[0].description}</span>
                    <span><strong>Wind:</strong> ${Math.round(weatherData.wind.speed)} mph</span>
                    <span><strong>Humidity:</strong> ${weatherData.main.humidity}%</span>
                    <span><strong>Visibility:</strong> ${(weatherData.visibility / 1609).toFixed(1)} mi</span>
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        <h3 class="text-xl font-bold">${flight.rocketName} with ${flight.engineName}</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">Date: ${new Date(flight.flightDate).toLocaleString()}</p>
        
        ${weatherHtml}

        <div class="space-y-4 mt-4">
            ...
        </div>
    `;

    // (Your existing chart rendering logic here)
}


// --- Your other existing functions (calculatePerformance, rocket management, etc.) go here ---
// --- No changes are needed for them to work with this new structure. ---
