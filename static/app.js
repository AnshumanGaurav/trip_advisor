/* ==========================================
   VoyageOptima - Frontend Application Script
   ========================================== */

let stopCounter = 0;
let globalOptions = [];
window.currentOptimizationGoal = 'cost';
window.preferredItineraryDate = null;
let costChart = null;
let transitChart = null;
let durationChart = null;

// Safe wrapper for Lucide icons
function safeCreateIcons() {
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        try { lucide.createIcons(); } catch (e) { console.warn("Lucide icons:", e); }
    }
}

// ==========================================
// AUTOCOMPLETE ENGINE
// ==========================================

/**
 * Attaches autocomplete behavior to an input field.
 * @param {HTMLInputElement} inputEl  - The city text input
 * @param {HTMLUListElement} dropdownEl - The <ul> dropdown list
 */
function attachAutocomplete(inputEl, dropdownEl) {
    if (!inputEl || !dropdownEl) return;

    let currentFocus = -1;
    let debounceTimer = null;

    inputEl.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => fetchCitySuggestions(inputEl, dropdownEl), 200);
        currentFocus = -1;
    });

    inputEl.addEventListener('keydown', (e) => {
        const items = dropdownEl.querySelectorAll('li');
        if (e.key === 'ArrowDown') {
            currentFocus = Math.min(currentFocus + 1, items.length - 1);
            setActive(items, currentFocus);
            e.preventDefault();
        } else if (e.key === 'ArrowUp') {
            currentFocus = Math.max(currentFocus - 1, 0);
            setActive(items, currentFocus);
            e.preventDefault();
        } else if (e.key === 'Enter') {
            if (currentFocus >= 0 && items[currentFocus]) {
                items[currentFocus].click();
                e.preventDefault();
            }
        } else if (e.key === 'Escape') {
            closeDropdown(dropdownEl);
        }
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!inputEl.contains(e.target) && !dropdownEl.contains(e.target)) {
            closeDropdown(dropdownEl);
        }
    });
}

function setActive(items, index) {
    items.forEach(li => li.classList.remove('active'));
    if (items[index]) {
        items[index].classList.add('active');
        items[index].scrollIntoView({ block: 'nearest' });
    }
}

function closeDropdown(dropdownEl) {
    if (dropdownEl) {
        dropdownEl.classList.remove('open');
        dropdownEl.style.display = '';
    }
}

/** Position the dropdown below the input using fixed coordinates (escapes overflow clipping) */
function positionDropdown(inputEl, dropdownEl) {
    const rect = inputEl.getBoundingClientRect();
    dropdownEl.style.top    = (rect.bottom + 4) + 'px';
    dropdownEl.style.left   = rect.left + 'px';
    dropdownEl.style.width  = rect.width + 'px';
    dropdownEl.style.display = 'block';
}

async function fetchCitySuggestions(inputEl, dropdownEl) {
    const query = inputEl.value.trim();
    if (query.length < 1) {
        closeDropdown(dropdownEl);
        return;
    }
    try {
        const res = await fetch(`/api/cities/search?q=${encodeURIComponent(query)}&limit=8`);
        if (!res.ok) return;
        const data = await res.json();
        renderCitySuggestions(inputEl, dropdownEl, data.results);
    } catch (err) {
        console.warn('Autocomplete fetch error:', err);
    }
}

async function fetchCityDetails(cityName) {
    try {
        const res = await fetch(`/api/cities/${encodeURIComponent(cityName)}`);
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        return null;
    }
}

function renderCitySuggestions(inputEl, dropdownEl, results) {
    dropdownEl.innerHTML = '';
    if (!results || results.length === 0) {
        closeDropdown(dropdownEl);
        return;
    }

    results.forEach(item => {
        const li = document.createElement('li');

        // item can be either a plain string (display_name) or an object {key, display_name, state}
        const cityName = (typeof item === 'string') ? item : item.display_name;
        const state = (typeof item === 'object' && item.state) ? item.state : '';

        const leftSection = document.createElement('div');
        leftSection.style.display = 'flex';
        leftSection.style.flexDirection = 'column';
        leftSection.style.gap = '2px';
        leftSection.innerHTML = `<span class="autocomplete-city-name">${cityName}</span>${state ? `<span class="autocomplete-city-state">${state}</span>` : ''}`;

        li.appendChild(leftSection);
        li.addEventListener('click', () => {
            inputEl.value = cityName;
            closeDropdown(dropdownEl);
            // Eagerly load city details and update tooltip/badge hint
            fetchCityDetails(cityName).then(details => {
                if (details) {
                    showCityBadge(inputEl, details);
                }
            });
        });

        dropdownEl.appendChild(li);
    });

    dropdownEl.classList.add('open');
    positionDropdown(inputEl, dropdownEl);
}

/**
 * Shows a small inline hint below an input after city selection.
 */
function showCityBadge(inputEl, cityDetails) {
    // Remove any existing badge
    const existingBadge = inputEl.parentElement.querySelector('.city-selection-badge');
    if (existingBadge) existingBadge.remove();

    const airports = cityDetails.airports || [];
    const stations = cityDetails.railway_stations || [];
    if (airports.length === 0 && stations.length === 0) return;

    const badge = document.createElement('div');
    badge.className = 'city-selection-badge';

    const airportBadges = airports.slice(0, 1).map(a =>
        `<span class="badge badge-airport">✈ ${a.code} – ${a.name}</span>`
    ).join('');
    const stationBadges = stations.slice(0, 2).map(s =>
        `<span class="badge badge-train">🚉 ${s.code} – ${s.name}</span>`
    ).join('');

    badge.innerHTML = `<div class="city-selection-badge-inner">${airportBadges}${stationBadges}</div>`;
    inputEl.parentElement.appendChild(badge);
}

// DOM Elements
const routeForm = document.getElementById('route-form');
const stopsList = document.getElementById('stops-list');
const addStopBtn = document.getElementById('add-stop-btn');
const startBtn = document.getElementById('welcome-start-btn');

const welcomeState = document.getElementById('welcome-state');
const loadingState = document.getElementById('loading-state');
const resultsState = document.getElementById('results-state');

const loadingTitle = document.getElementById('loading-title');
const loadingSubtitle = document.getElementById('loading-subtitle');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    // Set default search date to tomorrow
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateInput = document.getElementById('start-date');
    if (dateInput) {
        dateInput.value = tomorrow.toISOString().split('T')[0];
        
        // Auto-show date picker when the input is clicked or focused
        dateInput.addEventListener('click', () => {
            try { dateInput.showPicker(); } catch (e) {}
        });
        dateInput.addEventListener('focus', () => {
            try { dateInput.showPicker(); } catch (e) {}
        });
    }

    // Move dropdown elements to <body> so they escape the sidebar's overflow-y:auto clipping
    const sourceDropdown = document.getElementById('source-city-dropdown');
    const destDropdown   = document.getElementById('destination-city-dropdown');
    if (sourceDropdown) document.body.appendChild(sourceDropdown);
    if (destDropdown)   document.body.appendChild(destDropdown);

    // Wire autocomplete for source and destination fields
    const sourceInput = document.getElementById('source-city');
    const destInput   = document.getElementById('destination-city');
    attachAutocomplete(sourceInput, sourceDropdown);
    attachAutocomplete(destInput, destDropdown);

    // Reposition open dropdowns when sidebar is scrolled
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.addEventListener('scroll', () => {
            if (sourceDropdown && sourceDropdown.classList.contains('open')) positionDropdown(sourceInput, sourceDropdown);
            if (destDropdown   && destDropdown.classList.contains('open'))   positionDropdown(destInput, destDropdown);
        });
    }

    // Setup event listeners
    if (addStopBtn) addStopBtn.addEventListener('click', () => addStopCard());
    if (startBtn) startBtn.addEventListener('click', scrollToForm);
    if (routeForm) routeForm.addEventListener('submit', handleOptimizeSubmit);

    // Inject default stop to make it fully working out-of-the-box
    addStopCard("Delhi", 2, "flight");
    
    safeCreateIcons();
    window.fetchApiStats();
});

function scrollToForm() {
    if (welcomeState) welcomeState.classList.remove('active');
    if (routeForm) routeForm.scrollIntoView({ behavior: 'smooth' });
}

// Dynamic Stop Card Builder
function addStopCard(city = "", nights = 2, transport = "flight") {
    stopCounter++;
    const currentId = stopCounter;
    
    const card = document.createElement('div');
    card.className = 'stop-card';
    card.id = `stop-card-${currentId}`;
    
    card.innerHTML = `
        <div class="stop-card-header">
            <span class="stop-card-title">Stop #${currentId}</span>
            <button type="button" class="btn-remove-stop" title="Remove Stop" onclick="removeStopCard(${currentId})">
                <i data-lucide="trash-2"></i>
            </button>
        </div>
        
        <div class="stop-card-inputs">
            <div class="form-group">
                <label for="stop-city-${currentId}">City</label>
                <input type="text" id="stop-city-${currentId}" class="stop-city-input" placeholder="e.g. Paris" required value="${city}">
            </div>
            <div class="form-group">
                <label for="stop-nights-${currentId}">Nights Stay</label>
                <input type="number" id="stop-nights-${currentId}" class="stop-nights-input" min="0" required value="${nights}">
            </div>
        </div>
        
        <div class="form-group">
            <label>Leg Transport Mode <span class="subtitle">(To this stop)</span></label>
            <div class="transport-selector">
                <label class="transport-option">
                    <input type="radio" name="stop_transport_${currentId}" value="flight" ${transport === 'flight' ? 'checked' : ''}>
                    <span class="transport-btn"><i data-lucide="plane"></i> Flight</span>
                </label>
                <label class="transport-option">
                    <input type="radio" name="stop_transport_${currentId}" value="train" ${transport === 'train' ? 'checked' : ''}>
                    <span class="transport-btn"><i data-lucide="train"></i> Train</span>
                </label>
                <label class="transport-option">
                    <input type="radio" name="stop_transport_${currentId}" value="bus" ${transport === 'bus' ? 'checked' : ''}>
                    <span class="transport-btn"><i data-lucide="bus"></i> Bus</span>
                </label>
            </div>
        </div>
    `;
    
    if (stopsList) {
        stopsList.appendChild(card);
    }
    safeCreateIcons();
    recalculateStopLabels();

    // Attach autocomplete to this stop's city input
    const stopCityInput = document.getElementById(`stop-city-${currentId}`);
    if (stopCityInput) {
        const stopDropdown = document.createElement('ul');
        stopDropdown.className = 'autocomplete-dropdown';
        stopDropdown.id = `stop-city-dropdown-${currentId}`;
        document.body.appendChild(stopDropdown);   // attach to body to escape overflow
        attachAutocomplete(stopCityInput, stopDropdown);
    }
}

function removeStopCard(id) {
    const card = document.getElementById(`stop-card-${id}`);
    if (card) {
        // Remove associated autocomplete dropdown from body
        const orphanDropdown = document.getElementById(`stop-city-dropdown-${id}`);
        if (orphanDropdown) orphanDropdown.remove();

        card.style.opacity = '0';
        card.style.transform = 'translateY(-10px)';
        card.style.transition = 'all 0.25s ease-out';
        setTimeout(() => {
            card.remove();
            recalculateStopLabels();
        }, 250);
    }
}

function recalculateStopLabels() {
    if (!stopsList) return;
    const cards = stopsList.querySelectorAll('.stop-card');
    cards.forEach((card, index) => {
        const title = card.querySelector('.stop-card-title');
        if (title) {
            title.textContent = `Stop #${index + 1}`;
        }
    });
}

// State Transition Manager
function switchState(state) {
    if (welcomeState) welcomeState.classList.remove('active');
    if (loadingState) loadingState.classList.remove('active');
    if (resultsState) resultsState.classList.remove('active');
    
    if (state === 'welcome' && welcomeState) {
        welcomeState.classList.add('active');
    } else if (state === 'loading' && loadingState) {
        loadingState.classList.add('active');
    } else if (state === 'results' && resultsState) {
        resultsState.classList.add('active');
    }
}

// Submit Optimize Request
async function handleOptimizeSubmit(event) {
    event.preventDefault();
    switchState('loading');
    
    // Animate loader logs to make the process feel highly premium
    const log1 = document.getElementById('log-1');
    const log2 = document.getElementById('log-2');
    const log3 = document.getElementById('log-3');
    const log4 = document.getElementById('log-4');
    
    // Reset loading state logger classes
    if (log1) log1.className = 'log-line active';
    if (log2) log2.className = 'log-line';
    if (log3) log3.className = 'log-line';
    if (log4) log4.className = 'log-line';
    
    if (log1) {
        const icon = log1.querySelector('i');
        if (icon) {
            icon.setAttribute('data-lucide', 'circle-dashed');
            icon.classList.add('spin');
        }
    }
    if (log2) {
        const icon = log2.querySelector('i');
        if (icon) {
            icon.setAttribute('data-lucide', 'circle-dashed');
            icon.classList.remove('spin');
        }
    }
    if (log3) {
        const icon = log3.querySelector('i');
        if (icon) {
            icon.setAttribute('data-lucide', 'circle-dashed');
            icon.classList.remove('spin');
        }
    }
    if (log4) {
        const icon = log4.querySelector('i');
        if (icon) {
            icon.setAttribute('data-lucide', 'circle-dashed');
            icon.classList.remove('spin');
        }
    }
    safeCreateIcons();

    // Prepare JSON payload
    const source = document.getElementById('source-city').value;
    const destination = document.getElementById('destination-city').value;
    const destination_transport = document.querySelector('input[name="destination_transport"]:checked').value;
    const start_date = document.getElementById('start-date').value;
    
    const stops = [];
    if (stopsList) {
        const stopCards = stopsList.querySelectorAll('.stop-card');
        stopCards.forEach(card => {
            const id = card.id.split('-').pop();
            const city = card.querySelector('.stop-city-input').value;
            const nights = parseInt(card.querySelector('.stop-nights-input').value, 10);
            const transport = card.querySelector(`input[name="stop_transport_${id}"]:checked`).value;
            
            stops.push({ city, nights, transport });
        });
    }
    
    const payload = {
        source,
        stops,
        destination,
        destination_transport,
        start_date,
        force_refresh: window.forceRefreshNextRequest || false
    };
    window.lastOptimizePayload = payload;
    window.forceRefreshNextRequest = false; // Reset for future requests

    // Progression 500ms triggers
    setTimeout(() => {
        if (log1) {
            log1.className = 'log-line completed';
            const icon = log1.querySelector('i');
            if (icon) {
                icon.setAttribute('data-lucide', 'check-circle-2');
                icon.classList.remove('spin');
            }
        }
        if (log2) {
            log2.className = 'log-line active';
            const icon = log2.querySelector('i');
            if (icon) icon.classList.add('spin');
        }
        safeCreateIcons();
    }, 550);

    setTimeout(() => {
        if (log2) {
            log2.className = 'log-line completed';
            const icon = log2.querySelector('i');
            if (icon) {
                icon.setAttribute('data-lucide', 'check-circle-2');
                icon.classList.remove('spin');
            }
        }
        if (log3) {
            log3.className = 'log-line active';
            const icon = log3.querySelector('i');
            if (icon) icon.classList.add('spin');
        }
        safeCreateIcons();
    }, 1100);

    setTimeout(() => {
        if (log3) {
            log3.className = 'log-line completed';
            const icon = log3.querySelector('i');
            if (icon) {
                icon.setAttribute('data-lucide', 'check-circle-2');
                icon.classList.remove('spin');
            }
        }
        if (log4) {
            log4.className = 'log-line active';
            const icon = log4.querySelector('i');
            if (icon) icon.classList.add('spin');
        }
        safeCreateIcons();
    }, 1650);

    try {
        const response = await fetch('/api/optimize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errorDetails = await response.json();
            throw new Error(errorDetails.detail || 'Optimizer calculation failed.');
        }
        
        const data = await response.json();
        window.updateApiCounters(data.flight_api_calls, data.train_api_calls);
        
        // Wait another 400ms to ensure the user gets to see the final logs completed
        setTimeout(() => {
            if (log4) {
                log4.className = 'log-line completed';
                const icon = log4.querySelector('i');
                if (icon) {
                    icon.setAttribute('data-lucide', 'check-circle-2');
                    icon.classList.remove('spin');
                }
            }
            safeCreateIcons();
            
            setTimeout(() => {
                window.originalCostDataPoints = null;
                window.originalDurationDataPoints = null;
                window.cheapestItineraryCosts = null;
                window.cheapestItineraryDurations = null;
                window.fastestItineraryCosts = null;
                window.fastestItineraryDurations = null;
                window.cheapestActiveDurations = null;
                window.fastestActiveDurations = null;
                renderResults(data);
                switchState('results');
            }, 300);
        }, 2200);
        
    } catch (error) {
        setTimeout(() => {
            alert(`Optimization Error: ${error.message}`);
            switchState('welcome');
        }, 500);
    }
}

function applyOptimizationGoalToItineraries(options, goal) {
    options.forEach(opt => {
        if (!opt.available) return;
        
        // Skip resetting manual custom selections on this date if the user has locked it in as their preferred route!
        if (window.preferredItineraryDate === opt.start_date) {
            return;
        }
        
        opt.legs.forEach(leg => {
            // Skip resetting or swapping this leg if the user has explicitly locked this leg choice!
            if (leg.locked === true) {
                return;
            }
            
            const choices = getLegChoices(leg);
            if (choices.length === 0) return;
            
            let selectedChoice;
            if (goal === 'cost') {
                // Find cheapest choice
                selectedChoice = choices.reduce((minC, c) => c.cost < minC.cost ? c : minC, choices[0]);
            } else {
                // Find fastest choice
                selectedChoice = choices.reduce((minD, c) => parseDurationToMinutes(c.duration) < parseDurationToMinutes(minD.duration) ? c : minD, choices[0]);
            }
            
            // Clear manual selection markers to fully reset back to default cheapest/fastest choices
            leg.selected_train_number = undefined;
            leg.selected_flight_name = undefined;
            
            // Swap the active leg metrics
            leg.cost = selectedChoice.cost;
            leg.duration = selectedChoice.duration;
            leg.etd = selectedChoice.etd;
            leg.eta = selectedChoice.eta;
            
            // Set transport name / selected number
            if (leg.mode === 'train' && leg.alternatives && leg.alternatives.length > 0) {
                const selectedClass = leg.selected_class || 'SL';
                const matchedTrain = leg.alternatives.find(t => {
                    const classAvail = (t.classAvailability || []).find(ca => ca.class === selectedClass);
                    return classAvail && Math.ceil(classAvail.fare) === selectedChoice.cost && t.duration === selectedChoice.duration;
                });
                if (matchedTrain) {
                    leg.selected_train_number = matchedTrain.trainNumber;
                    leg.transport_name = `${matchedTrain.trainNumber} - ${matchedTrain.trainName} (${selectedClass})`;
                }
            } else if (leg.mode === 'flight' && leg.alternatives && leg.alternatives.length > 0) {
                const matchedFlight = leg.alternatives.find(f => {
                    const costVal = Math.ceil(f.price !== undefined ? f.price : f.cost);
                    return costVal === selectedChoice.cost && f.duration === selectedChoice.duration;
                });
                if (matchedFlight) {
                    leg.selected_flight_name = matchedFlight.transport_name;
                    leg.transport_name = matchedFlight.transport_name;
                }
            }
        });
        
        // Recalculate totals for this itinerary option
        recalculateItineraryTotals(opt);
    });
}

function renderResults(data) {
    window.lastOptimizeResults = data;
    const { best_option, all_options, average_cost, savings } = data;
    globalOptions = all_options;
    
    // Apply the active optimization goal to all options to align active selections
    applyOptimizationGoalToItineraries(all_options, window.currentOptimizationGoal);
    
    // Deep clone/copy baseline metrics for cost and duration to keep them from being overridden on leg changes
    if (!window.originalCostDataPoints) {
        window.originalCostDataPoints = all_options.map(opt => opt.available ? opt.total_cost : null);
    }
    if (!window.originalDurationDataPoints) {
        window.originalDurationDataPoints = all_options.map(opt => opt.available ? (opt.total_duration_hours / 24.0) : null);
    }
    if (!window.cheapestItineraryCosts) {
        const boundsList = all_options.map(opt => opt.available ? calculateItineraryBounds(opt) : null);
        window.cheapestItineraryCosts = boundsList.map(b => b ? b.lowestCost : null);
        window.cheapestItineraryDurations = boundsList.map(b => b ? b.timeForLowestCost : null);
        window.fastestItineraryCosts = boundsList.map(b => b ? b.costForBestTime : null);
        window.fastestItineraryDurations = boundsList.map(b => b ? b.bestTime : null);
        window.cheapestActiveDurations = boundsList.map(b => b ? b.cheapestActiveDays : null);
        window.fastestActiveDurations = boundsList.map(b => b ? b.fastestActiveDays : null);
    }
    
    if (!best_option) {
        alert("Alert: No travel options could be optimized because all transport modes on all dates are marked as 'Sold Out'. Try changing dates or modes!");
        switchState('welcome');
        return;
    }
    
    // Resolve Cheapest vs. Fastest available itineraries dynamically
    const availableOptions = all_options.filter(opt => opt.available);
    window.cheapestItinerary = availableOptions.length > 0 
        ? availableOptions.reduce((prev, curr) => prev.total_cost < curr.total_cost ? prev : curr)
        : best_option;
    window.fastestItinerary = availableOptions.length > 0
        ? availableOptions.reduce((prev, curr) => prev.total_duration_hours < curr.total_duration_hours ? prev : curr)
        : best_option;
        
    const recommendedOption = window.currentOptimizationGoal === 'cost' ? window.cheapestItinerary : window.fastestItinerary;
    const activeSavings = Math.max(0, average_cost - recommendedOption.total_cost);
    
    // 1. Update stats panels dynamically
    const dateFormatted = formatDateString(recommendedOption.start_date);
    document.getElementById('best-date-display').textContent = dateFormatted;
    document.getElementById('savings-display').innerHTML = `<i data-lucide="trending-down"></i> Save ₹${Math.round(activeSavings)} (vs average)`;
    document.getElementById('best-cost-display').textContent = `₹${recommendedOption.total_cost}`;
    const fastestCostEl = document.getElementById('fastest-cost-display');
    const fastestDurEl = document.getElementById('fastest-duration-helper');
    if (fastestCostEl && window.fastestItinerary) {
        fastestCostEl.textContent = `₹${window.fastestItinerary.total_cost}`;
    }
    if (fastestDurEl && window.fastestItinerary) {
        const fastestActiveMins = getActiveTravelMins(window.fastestItinerary);
        const fastestActiveStr = formatMinsToHoursMins(fastestActiveMins);
        fastestDurEl.innerHTML = `<i data-lucide="clock" style="width: 10px; height: 10px; display: inline-block; vertical-align: middle; margin-right: 4px;"></i>Trip: ${window.fastestItinerary.total_duration_str} | Transit: ${fastestActiveStr}`;
    }
    
    // 1b. Update trade-off banner
    updateTradeoffBanner();
    
    // 2. Render the Cost & Duration Curve interactive charts
    renderChart(all_options, recommendedOption);
    
    // 2b. Render the interactive Date Selector Strip
    renderDateSelectorStrip(all_options, recommendedOption);
    
    // 3. Render Timeline and key statistics card for the resolved starting date
    renderTimeline(recommendedOption);
    
    // Highlight the active recommended option point on the charts (Your Selection)
    highlightChartPoint(recommendedOption.start_date);
    
    safeCreateIcons();
}

// Helper to look up stops
function payloadStopsMatch(city, data) {
    if (!city || !stopsList) return { nights: 2 };
    // Basic UI stop check
    const stopCards = stopsList.querySelectorAll('.stop-card');
    let matchedNights = 2; // fallback
    stopCards.forEach(card => {
        const cityInput = card.querySelector('.stop-city-input');
        if (cityInput) {
            const cVal = cityInput.value.trim().toLowerCase();
            if (cVal === city.trim().toLowerCase()) {
                const nightsInput = card.querySelector('.stop-nights-input');
                if (nightsInput) {
                    matchedNights = parseInt(nightsInput.value, 10);
                }
            }
        }
    });
    return { nights: matchedNights };
}

function renderDateSelectorStrip(options, selectedOption) {
    const strip = document.getElementById('date-selector-strip');
    if (!strip) return;
    strip.innerHTML = '';
    
    // Find the option with the minimum cost among available ones
    const availableOptions = options.filter(o => o.available);
    let cheapestCost = Infinity;
    if (availableOptions.length > 0) {
        cheapestCost = Math.min(...availableOptions.map(o => o.total_cost));
    }
    
    options.forEach(opt => {
        const d = new Date(opt.start_date);
        const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
        const dayNum = d.toLocaleDateString('en-US', { day: 'numeric' });
        const month = d.toLocaleDateString('en-US', { month: 'short' });
        
        const isPreferred = window.preferredItineraryDate === opt.start_date;
        const card = document.createElement('div');
        card.className = `date-card ${opt.start_date === selectedOption.start_date ? 'active' : ''} ${!opt.available ? 'sold-out' : ''} ${isPreferred ? 'preferred-choice' : ''}`;
        card.setAttribute('data-date', opt.start_date);
        
        let badgeHTML = '';
        if (isPreferred) {
            badgeHTML = `<span class="date-card-badge badge-preferred-date" style="background: var(--color-success); color: #fff; box-shadow: 0 0 5px rgba(16, 185, 129, 0.4);">⭐ Preferred</span>`;
        } else if (opt.available && window.cheapestItinerary && opt.start_date === window.cheapestItinerary.start_date) {
            badgeHTML = `<span class="date-card-badge badge-cheapest-date">Cheapest</span>`;
        } else if (opt.available && window.fastestItinerary && opt.start_date === window.fastestItinerary.start_date) {
            badgeHTML = `<span class="date-card-badge badge-fastest-date" style="background: #06b6d4; color: #fff; box-shadow: 0 0 5px rgba(6, 182, 212, 0.4);">Fastest</span>`;
        } else if (!opt.available) {
            badgeHTML = `<span class="date-card-badge badge-soldout-date">Sold Out</span>`;
        }
        
        let lockBtnHTML = '';
        if (opt.available) {
            lockBtnHTML = `
                <button class="date-card-lock-btn ${isPreferred ? 'locked' : ''}" onclick="event.stopPropagation(); window.toggleLockItineraryDate('${opt.start_date}')" title="${isPreferred ? 'Unlock Date Option' : 'Lock Date Option'}">
                    <i data-lucide="${isPreferred ? 'lock' : 'unlock'}" style="width: 10px; height: 10px;"></i>
                </button>
            `;
        }
        
        card.innerHTML = `
            ${badgeHTML}
            ${lockBtnHTML}
            <span class="date-card-weekday">${weekday}</span>
            <span class="date-card-day">${dayNum} ${month}</span>
            <span class="date-card-price">${opt.available ? '₹' + opt.total_cost : '—'}</span>
        `;
        
        if (opt.available) {
            card.addEventListener('click', () => {
                highlightChartPoint(opt.start_date);
                renderTimeline(opt);
            });
        }
        
        strip.appendChild(card);
    });
}

function highlightChartPoint(startDate) {
    if (!globalOptions) return;
    const index = globalOptions.findIndex(o => o.start_date === startDate);
    if (index >= 0) {
        if (costChart) {
            costChart.setActiveElements([{ datasetIndex: 2, index: index }]);
            costChart.update();
        }
        if (transitChart) {
            transitChart.setActiveElements([{ datasetIndex: 2, index: index }]);
            transitChart.update();
        }
        if (durationChart) {
            durationChart.setActiveElements([{ datasetIndex: 2, index: index }]);
            durationChart.update();
        }
    }
}

function parseDateTime(dateStr, timeStr) {
    if (!timeStr) return new Date(dateStr);
    let [timePart, ampm] = timeStr.trim().split(' ');
    let [hrs, mins] = timePart.split(':').map(Number);
    if (ampm === 'PM' && hrs < 12) hrs += 12;
    if (ampm === 'AM' && hrs === 12) hrs = 0;
    return new Date(`${dateStr}T${String(hrs).padStart(2,'0')}:${String(mins).padStart(2,'0')}:00`);
}

function getArrivalDateTime(leg) {
    const depDt = parseDateTime(leg.date, leg.etd);
    const durationMins = parseDurationToMinutes(leg.duration);
    return new Date(depDt.getTime() + durationMins * 60 * 1000);
}

function mapDatasetIndex(sourceChart, targetChart, sourceDatasetIndex) {
    if (sourceDatasetIndex === 2) return 2; // Your Selection is always datasetIndex 2
    
    const sourceIsCost = (sourceChart === costChart);
    const targetIsCost = (targetChart === costChart);
    
    if (sourceIsCost !== targetIsCost) {
        return sourceDatasetIndex === 0 ? 1 : 0;
    }
    return sourceDatasetIndex;
}

function handleChartHoverSync(event, activeElements, sourceChart) {
    const charts = [costChart, transitChart, durationChart];
    
    if (activeElements && activeElements.length > 0) {
        const index = activeElements[0].index;
        const sourceDatasetIndex = activeElements[0].datasetIndex;
        
        charts.forEach(chart => {
            if (!chart || chart === sourceChart) return;
            
            const targetDatasetIndex = mapDatasetIndex(sourceChart, chart, sourceDatasetIndex);
            
            chart.setActiveElements([{ datasetIndex: targetDatasetIndex, index: index }]);
            chart.tooltip.setActiveElements([{ datasetIndex: targetDatasetIndex, index: index }]);
            chart.update('none');
        });
    } else {
        charts.forEach(chart => {
            if (!chart || chart === sourceChart) return;
            
            chart.setActiveElements([]);
            chart.tooltip.setActiveElements([]);
            chart.update('none');
        });
    }
}

function formatDateString(dateStr) {
    const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    const dateObj = new Date(dateStr);
    return dateObj.toLocaleDateString('en-US', options);
}
function renderTimeline(option) {
    window.currentTimelineOption = option;
    
    // Update Journey Summary card
    if (option) {
        const totalStops = option.legs.length - 1;
        const totalNights = option.legs.reduce((acc, leg, index) => {
            if (index === option.legs.length - 1) return acc;
            const stop = payloadStopsMatch(leg.to_city);
            return acc + (stop ? stop.nights : 0);
        }, 0);
        
        const stopsEl = document.getElementById('summary-stops-val');
        const nightsEl = document.getElementById('summary-nights-val');
        if (stopsEl) stopsEl.textContent = totalStops;
        if (nightsEl) nightsEl.textContent = `${totalNights} Nights`;

        const durEl = document.getElementById('summary-duration-val');
        if (durEl) durEl.textContent = option.total_duration_str;

        const activeEl = document.getElementById('summary-active-time-val');
        if (activeEl) {
            const activeMins = getActiveTravelMins(option);
            activeEl.textContent = formatMinsToHoursMins(activeMins);
        }

        // Departs / Arrives — first leg etd and last leg eta
        const departsEl = document.getElementById('summary-departs-val');
        const arrivesEl = document.getElementById('summary-arrives-val');
        if (departsEl || arrivesEl) {
            const firstLegData = option.legs[0];
            const lastLegData = option.legs[option.legs.length - 1];
            const fmtDate = (dateStr) => {
                const d = new Date(dateStr);
                return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
            };
            if (departsEl) {
                const depDate = fmtDate(firstLegData.date);
                const depTime = firstLegData.etd || '—';
                departsEl.textContent = `${depDate}, ${depTime}`;
            }
            if (arrivesEl) {
                const arrDt = getArrivalDateTime(lastLegData);
                const arrDate = arrDt.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
                const arrTime = lastLegData.eta || '—';
                arrivesEl.textContent = `${arrDate}, ${arrTime}`;
            }
        }
    }

    const container = document.getElementById('timeline-container');
    if (!container) return;
    container.innerHTML = '';
    
    const timelineSubtitle = document.getElementById('timeline-subtitle');
    if (timelineSubtitle) {
        timelineSubtitle.textContent = `Detailed breakdown for trip starting on ${formatDateString(option.start_date)}`;
    }
    
    // Update preferred selection button state in header
    const selectBtn = document.getElementById('select-preferred-btn');
    if (selectBtn) {
        const isPreferred = window.preferredItineraryDate === option.start_date;
        if (isPreferred) {
            selectBtn.className = 'btn btn-secondary btn-sm btn-preferred-active';
            selectBtn.innerHTML = `<i data-lucide="check-circle" style="width: 12px; height: 12px;"></i>Selected Preference`;
        } else {
            selectBtn.className = 'btn btn-secondary btn-sm';
            selectBtn.innerHTML = `<i data-lucide="check" style="width: 12px; height: 12px;"></i>Select as Preference`;
        }
    }
    
    // Update selector strip active card and scroll it into view
    const activeCard = document.querySelector(`.date-card[data-date="${option.start_date}"]`);
    if (activeCard) {
        document.querySelectorAll('.date-card').forEach(c => c.classList.remove('active'));
        activeCard.classList.add('active');
        activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
    
    // 0. Prepend a Selected Preference Alert if active
    if (window.preferredItineraryDate === option.start_date) {
        const prefCard = document.createElement('div');
        prefCard.className = 'preferred-itinerary-card glass-panel';
        prefCard.style.cssText = 'margin-bottom: 20px; padding: 16px 20px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: var(--radius-md); box-shadow: 0 0 15px rgba(16, 185, 129, 0.1); display: flex; align-items: center; gap: 14px;';
        prefCard.innerHTML = `
            <div style="background: var(--color-success); width: 32px; height: 32px; border-radius: 50%; display: flex; justify-content: center; align-items: center; box-shadow: 0 0 8px rgba(16, 185, 129, 0.4); flex-shrink:0;">
                <i data-lucide="check" style="width: 16px; height: 16px; color: #fff;"></i>
            </div>
            <div>
                <h5 style="margin: 0; font-family: 'Outfit'; font-size: 13px; font-weight: 700; color: var(--color-success); text-transform: uppercase; letter-spacing: 0.5px;">✓ Locked In Preferred Route</h5>
                <p style="margin: 3px 0 0 0; font-size: 12px; color: var(--text-primary);">You selected this route starting on <strong>${formatDateString(option.start_date)}</strong> (Cost: <strong>₹${option.total_cost}</strong> | Time: <strong>${option.total_duration_str}</strong>). Perfect choice!</p>
            </div>
        `;
        container.appendChild(prefCard);
    }
    
    // 1. Initial Starting node
    const firstLeg = option.legs[0];
    const startNode = document.createElement('div');
    startNode.className = 'timeline-node';
    startNode.innerHTML = `
        <div class="timeline-indicator ind-start">
            <i data-lucide="map-pin"></i>
        </div>
        <div class="timeline-content">
            <div class="timeline-content-header">
                <h4>Depart from ${firstLeg.from_city} (${firstLeg.from_code || 'N/A'})</h4>
                <span class="timeline-date">${formatDateString(option.start_date)}</span>
            </div>
            <p class="subtitle">Starting point of your optimized journey.</p>
        </div>
    `;
    container.appendChild(startNode);
    
    // 2. Add transport and stop nodes
    option.legs.forEach((leg, index) => {
        const legNode = document.createElement('div');
        legNode.className = 'timeline-node';
        
        let indicatorClass = 'ind-flight';
        let iconName = 'plane';
        if (leg.mode === 'train') {
            indicatorClass = 'ind-train';
            iconName = 'train';
        } else if (leg.mode === 'bus') {
            indicatorClass = 'ind-bus';
            iconName = 'bus';
        }
        
        const isLastLeg = index === option.legs.length - 1;
        const stopMeta = payloadStopsMatch(leg.to_city, null);
        
        let staySectionHTML = '';
        if (!isLastLeg) {
            staySectionHTML = `
                <div class="timeline-stay">
                    <i data-lucide="moon"></i>
                    <span>Stay for ${stopMeta.nights} nights in ${leg.to_city}</span>
                </div>
            `;
        }
        
        let badgeColor = leg.data_source === 'Fresh' ? 'var(--emerald)' : leg.data_source === 'Cached' ? 'var(--accent-blue)' : 'var(--muted)';
        let cachedHint = leg.cached_at ? ` <span style="font-size: 10px; color: var(--muted);">(${new Date(leg.cached_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})</span>` : '';
        let refreshBtn = (leg.data_source === 'Cached' || leg.data_source === 'Dummy' || leg.data_source === 'Real IRCTC API') ? `<button class="btn btn-sm" style="font-size: 10px; padding: 2px 6px; margin-left: 8px; background: rgba(255,255,255,0.1); border:none;" onclick="refreshSingleLeg(this, '${leg.from_city}', '${leg.to_city}', '${leg.date}', '${leg.mode}')">Refresh</button>` : '';
        const isLegLocked = leg.locked === true;
        let legLockBtn = `
            <button class="btn btn-sm btn-leg-lock ${isLegLocked ? 'locked' : ''}" style="font-size: 10px; padding: 2px 6px; margin-left: 8px; border: 1px solid ${isLegLocked ? 'var(--color-success)' : 'rgba(255,255,255,0.15)'}; background: ${isLegLocked ? 'rgba(16, 185, 129, 0.15)' : 'transparent'}; color: ${isLegLocked ? 'var(--color-success)' : 'var(--text-muted)'};" onclick="window.toggleLockLeg(${index})">
                <i data-lucide="${isLegLocked ? 'lock' : 'unlock'}" style="width: 10.5px; height: 10.5px; display: inline-block; vertical-align: middle; margin-right: 4px;"></i>
                ${isLegLocked ? 'Locked' : 'Lock Choice'}
            </button>
        `;
 
        // Specialized premium rendering for trains
        if (leg.mode === 'train' && leg.alternatives && leg.alternatives.length > 0 && leg.alternatives[0].classAvailability) {
            if (!leg.selected_class) {
                leg.selected_class = 'SL';
            }
            const selectedClass = leg.selected_class;
            
            // Get all unique classes available
            const uniqueClasses = [];
            leg.alternatives.forEach(t => {
                (t.allClasses || []).forEach(c => {
                    if (!uniqueClasses.includes(c)) {
                        uniqueClasses.push(c);
                    }
                });
            });
            const classOrder = ["1A", "2A", "3A", "3E", "SL", "2S"];
            uniqueClasses.sort((a, b) => {
                let idxA = classOrder.indexOf(a);
                let idxB = classOrder.indexOf(b);
                if (idxA === -1) idxA = 99;
                if (idxB === -1) idxB = 99;
                return idxA - idxB;
            });
            
            // Find trains containing selectedClass
            const activeTrains = [];
            leg.alternatives.forEach(t => {
                const classAvail = (t.classAvailability || []).find(ca => ca.class === selectedClass);
                if (classAvail) {
                    activeTrains.push({
                        ...t,
                        activeClassDetails: classAvail
                    });
                }
            });
            
            // If user selected a specific train, move it to the front of the list
            if (leg.selected_train_number) {
                const selectedIdx = activeTrains.findIndex(t => t.trainNumber === leg.selected_train_number);
                if (selectedIdx > -1) {
                    const selTrain = activeTrains.splice(selectedIdx, 1)[0];
                    activeTrains.unshift(selTrain);
                }
            } else {
                // Sort by fare ascending
                activeTrains.sort((a, b) => a.activeClassDetails.fare - b.activeClassDetails.fare);
            }
            
            if (activeTrains.length > 0) {
                const primaryTrain = activeTrains[0];
                const altTrains = activeTrains.slice(1);
                
                // Update leg metrics for consistent overall summaries
                leg.cost = Math.ceil(primaryTrain.activeClassDetails.fare);
                leg.duration = primaryTrain.duration;
                leg.etd = primaryTrain.departure;
                leg.eta = primaryTrain.arrival;
                leg.transport_name = `${primaryTrain.trainNumber} - ${primaryTrain.trainName} (${selectedClass})`;
                
                const statusStr = primaryTrain.activeClassDetails.availability.toUpperCase();
                let statusBadgeClass = 'status-badge-available';
                let statusText = primaryTrain.activeClassDetails.displayStatus || 'Available';
                
                if (statusStr.includes('NOT AVAILABLE') || statusStr.includes('CANCELLED') || statusStr.includes('REGRET')) {
                    statusBadgeClass = 'status-badge-unavailable';
                } else if (statusStr.includes('WL') || statusStr.includes('RAC')) {
                    statusBadgeClass = 'status-badge-waitlist';
                }
                
                const pantryClass = primaryTrain.pantry.toLowerCase() === 'yes' ? 'has-pantry' : '';
                const pantryText = primaryTrain.pantry.toLowerCase() === 'yes' ? 'Pantry Car Available' : 'No Pantry Car';
                
                const rating = primaryTrain.rating || 3.5;
                const starsHTML = `<i data-lucide="star" style="width:12px; height:12px; fill: #fbbf24; color: #fbbf24;"></i> ${rating.toFixed(1)}`;
                const dropdownOptions = uniqueClasses.map(c => `<option value="${c}" ${c === selectedClass ? 'selected' : ''}>${c}</option>`).join('');
                
                legNode.innerHTML = `
                    <div class="timeline-indicator ${indicatorClass}">
                        <i data-lucide="${iconName}"></i>
                    </div>
                    <div class="timeline-content">
                        <div class="timeline-content-header">
                            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; width:100%;">
                                <h4>Leg #${index + 1}: ${leg.from_city} (${leg.from_code || 'N/A'}) ➔ ${leg.to_city} (${leg.to_code || 'N/A'}) via Train</h4>
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <span style="font-size: 10px; padding: 2px 6px; border-radius: 4px; border: 1px solid ${badgeColor}; color: ${badgeColor};">${leg.data_source}</span>
                                    ${cachedHint}
                                    ${refreshBtn}
                                    ${legLockBtn}
                                </div>
                                <div class="train-class-select-container">
                                    <span class="train-class-label">Class:</span>
                                    <select class="train-class-select" onchange="handleTrainClassChange(${index}, this.value)">
                                        ${dropdownOptions}
                                    </select>
                                </div>
                            </div>
                            <span class="timeline-date">${formatDateString(leg.date)}</span>
                        </div>
                        <div class="timeline-metrics" style="margin-bottom: 8px; display: flex; align-items: center; gap: 16px;">
                            <span><i data-lucide="credit-card"></i> Cost: <strong>₹${leg.cost}</strong></span>
                            <span><i data-lucide="clock"></i> Duration: ${leg.duration}</span>
                            <span class="status-badge ${statusBadgeClass}">
                                <i data-lucide="info" style="width:12px; height:12px;"></i>
                                ${statusText}
                            </span>
                        </div>
                        <div class="timeline-metrics" style="margin-bottom: 8px; font-weight: 500; color: var(--accent-purple);">
                            <span><i data-lucide="info"></i> ${leg.transport_name}</span>
                        </div>
                        <div class="train-meta-details" style="margin-bottom: 12px; display: flex; gap: 16px;">
                            <span class="train-rating">${starsHTML} Rating</span>
                            <span class="train-pantry ${pantryClass}"><i data-lucide="utensils" style="width:12px; height:12px;"></i> ${pantryText}</span>
                            <span><i data-lucide="map" style="width:12px; height:12px; opacity:0.7;"></i> ${primaryTrain.distanceKm} km</span>
                        </div>
                        
                        ${altTrains.length > 0 ? `
                        <div class="alternatives-container">
                            <button class="btn btn-secondary btn-sm" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'" style="font-size: 11px; padding: 4px 8px; margin-bottom: 6px;">View Other Trains in ${selectedClass} (${altTrains.length})</button>
                            <div style="display: none;">
                                <table class="alternatives-table">
                                    <thead>
                                        <tr>
                                            <th>Train</th>
                                            <th>Schedule</th>
                                            <th>Duration</th>
                                            <th>Status</th>
                                            <th>Price</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${altTrains.map(alt => {
                                            const altStatusStr = alt.activeClassDetails.availability.toUpperCase();
                                            let altStatusBadgeClass = 'status-badge-available';
                                            let altStatusText = alt.activeClassDetails.displayStatus || 'Available';
                                            if (altStatusStr.includes('NOT AVAILABLE') || altStatusStr.includes('CANCELLED') || altStatusStr.includes('REGRET')) {
                                                altStatusBadgeClass = 'status-badge-unavailable';
                                            } else if (altStatusStr.includes('WL') || altStatusStr.includes('RAC')) {
                                                altStatusBadgeClass = 'status-badge-waitlist';
                                            }
                                            return `
                                            <tr>
                                                <td>
                                                    <div class="alternatives-carrier">
                                                        <i data-lucide="train" style="width: 12px; height: 12px; opacity: 0.7;"></i>
                                                        <span>${alt.trainNumber} - ${alt.trainName}</span>
                                                    </div>
                                                </td>
                                                <td><strong>${alt.departure}</strong> ➔ <strong>${alt.arrival}</strong></td>
                                                <td>${alt.duration || 'N/A'}</td>
                                                <td>
                                                    <span class="status-badge ${altStatusBadgeClass}" style="padding: 2px 8px; font-size: 10px;">
                                                        ${altStatusText}
                                                    </span>
                                                </td>
                                                <td class="alternatives-price">₹${Math.ceil(alt.activeClassDetails.fare)}</td>
                                                <td>
                                                    <button class="btn btn-secondary select-alt-btn" onclick="window.selectAlternativeTrain(${index}, '${alt.trainNumber}')" style="font-size: 9.5px; padding: 2px 6px; border-color: var(--color-success); color: var(--color-success); background: transparent;">Select</button>
                                                </td>
                                            </tr>
                                        `}).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        ` : ''}
                        
                        <div class="timeline-metrics" style="color: var(--accent-purple); font-size: 11px; margin-bottom: 12px; gap: 24px;">
                            <span><i data-lucide="play" style="width:12px; height:12px; transform: rotate(90deg);"></i> Depart: <strong>${leg.etd}</strong></span>
                            <span><i data-lucide="play" style="width:12px; height:12px; transform: rotate(90deg);"></i> Arrive: <strong>${leg.eta}</strong></span>
                        </div>
                        ${staySectionHTML}
                    </div>
                `;
            } else {
                legNode.innerHTML = `
                    <div class="timeline-indicator ${indicatorClass}">
                        <i data-lucide="${iconName}"></i>
                    </div>
                    <div class="timeline-content">
                        <div class="timeline-content-header">
                            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                                <h4>Leg #${index + 1}: ${leg.from_city} (${leg.from_code || 'N/A'}) ➔ ${leg.to_city} (${leg.to_code || 'N/A'}) via ${leg.mode.toUpperCase()}</h4>
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <span style="font-size: 10px; padding: 2px 6px; border-radius: 4px; border: 1px solid ${badgeColor}; color: ${badgeColor};">${leg.data_source}</span>
                                    ${cachedHint}
                                    ${refreshBtn}
                                </div>
                            </div>
                            <span class="timeline-date">${formatDateString(leg.date)}</span>
                        </div>
                        <div class="timeline-metrics" style="margin-bottom: 8px;">
                            <span><i data-lucide="credit-card"></i> Cost: <strong>₹${leg.cost}</strong></span>
                            <span><i data-lucide="clock"></i> Duration: ${leg.duration}</span>
                        </div>
                        <div class="timeline-metrics" style="margin-bottom: 8px; font-weight: 500; color: var(--accent-purple);">
                            <span><i data-lucide="info"></i> ${leg.transport_name || 'Generic Transport'}</span>
                        </div>
                        ${leg.alternatives && leg.alternatives.length > 1 ? `
                        <div class="alternatives-container">
                            <button class="btn btn-secondary btn-sm" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'" style="font-size: 11px; padding: 4px 8px; margin-bottom: 6px;">View Other Options (${leg.alternatives.length - 1})</button>
                            <div style="display: none;">
                                <table class="alternatives-table">
                                    <thead>
                                        <tr>
                                            <th>Carrier</th>
                                            <th>Stops</th>
                                            <th>Duration</th>
                                            <th>ETD</th>
                                            <th>ETA</th>
                                            <th>Price</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${leg.alternatives.slice(1).map(alt => `
                                            <tr>
                                                <td>
                                                    <div class="alternatives-carrier">
                                                        <i data-lucide="${leg.mode === 'flight' ? 'plane' : leg.mode === 'train' ? 'train' : 'bus'}" style="width: 12px; height: 12px; opacity: 0.7;"></i>
                                                        <span>${alt.transport_name}</span>
                                                    </div>
                                                </td>
                                                <td>${alt.stops === 0 ? 'Non-stop' : alt.stops === 1 ? '1 stop' : alt.stops + ' stops'}</td>
                                                <td>${alt.duration || 'N/A'}</td>
                                                <td><strong>${alt.etd || 'N/A'}</strong></td>
                                                <td><strong>${alt.eta || 'N/A'}</strong></td>
                                                <td class="alternatives-price">₹${alt.price}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        ` : ''}
                        <div class="timeline-metrics" style="color: var(--accent-purple); font-size: 11px; margin-bottom: 12px; gap: 24px;">
                            <span><i data-lucide="plane-takeoff" style="width:12px; height:12px;"></i> ETD (Depart): <strong>${leg.etd}</strong></span>
                            <span><i data-lucide="plane-landing" style="width:12px; height:12px;"></i> ETA (Arrive): <strong>${leg.eta}</strong></span>
                        </div>
                        ${staySectionHTML}
                    </div>
                `;
            }
        } else if (leg.mode === 'flight') {
            const selectedClass = leg.selected_class || 'economy';
            const dropdownOptions = `
                <option value="economy" ${selectedClass === 'economy' ? 'selected' : ''}>Economy</option>
                <option value="premium_economy" ${selectedClass === 'premium_economy' ? 'selected' : ''}>Premium Economy</option>
                <option value="business" ${selectedClass === 'business' ? 'selected' : ''}>Business</option>
                <option value="first" ${selectedClass === 'first' ? 'selected' : ''}>First Class</option>
            `;
            
            const activeFlights = [...(leg.alternatives || [])];
            if (leg.selected_flight_name) {
                const selectedIdx = activeFlights.findIndex(f => f.transport_name === leg.selected_flight_name);
                if (selectedIdx > -1) {
                    const selFlight = activeFlights.splice(selectedIdx, 1)[0];
                    activeFlights.unshift(selFlight);
                }
            }
            
            if (activeFlights.length > 0) {
                const primaryFlight = activeFlights[0];
                leg.cost = Math.ceil(primaryFlight.price !== undefined ? primaryFlight.price : primaryFlight.cost);
                leg.duration = primaryFlight.duration;
                leg.etd = primaryFlight.etd;
                leg.eta = primaryFlight.eta;
                leg.transport_name = primaryFlight.transport_name;
            }
            const altFlights = activeFlights.slice(1);
            
            legNode.innerHTML = `
                <div class="timeline-indicator ${indicatorClass}">
                    <i data-lucide="${iconName}"></i>
                </div>
                <div class="timeline-content" id="timeline-card-${index}">
                    <div class="timeline-content-header">
                        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; width: 100%;">
                            <h4>Leg #${index + 1}: ${leg.from_city} (${leg.from_code || 'N/A'}) ➔ ${leg.to_city} (${leg.to_code || 'N/A'}) via Flight</h4>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="font-size: 10px; padding: 2px 6px; border-radius: 4px; border: 1px solid ${badgeColor}; color: ${badgeColor};">${leg.data_source}</span>
                                ${cachedHint}
                                ${refreshBtn}
                                ${legLockBtn}
                            </div>
                            <div class="flight-class-select-container">
                                <span class="flight-class-label">Class:</span>
                                <select class="flight-class-select" onchange="handleFlightClassChange(${index}, this.value)">
                                    ${dropdownOptions}
                                </select>
                            </div>
                        </div>
                        <span class="timeline-date">${formatDateString(leg.date)}</span>
                    </div>
                    <div class="timeline-metrics" style="margin-bottom: 8px;">
                        <span><i data-lucide="credit-card"></i> Cost: <strong>₹${leg.cost}</strong></span>
                        <span><i data-lucide="clock"></i> Duration: ${leg.duration}</span>
                    </div>
                    <div class="timeline-metrics" style="margin-bottom: 8px; font-weight: 500; color: var(--accent-purple);">
                        <span><i data-lucide="info"></i> ${leg.transport_name || 'Generic Flight'}</span>
                    </div>
                    ${altFlights.length > 0 ? `
                    <div class="alternatives-container">
                        <button class="btn btn-secondary btn-sm" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'" style="font-size: 11px; padding: 4px 8px; margin-bottom: 6px;">View Other Options (${altFlights.length})</button>
                        <div style="display: none;">
                            <table class="alternatives-table">
                                <thead>
                                    <tr>
                                        <th>Carrier</th>
                                        <th>Stops</th>
                                        <th>Duration</th>
                                        <th>ETD</th>
                                        <th>ETA</th>
                                        <th>Price</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${altFlights.map(alt => `
                                        <tr>
                                            <td>
                                                <div class="alternatives-carrier">
                                                    <i data-lucide="plane" style="width: 12px; height: 12px; opacity: 0.7;"></i>
                                                    <span>${alt.transport_name}</span>
                                                </div>
                                            </td>
                                            <td>${alt.stops === 0 ? 'Non-stop' : alt.stops === 1 ? '1 stop' : alt.stops + ' stops'}</td>
                                            <td>${alt.duration || 'N/A'}</td>
                                            <td><strong>${alt.etd || 'N/A'}</strong></td>
                                            <td><strong>${alt.eta || 'N/A'}</strong></td>
                                            <td class="alternatives-price">₹${alt.price}</td>
                                            <td>
                                                <button class="btn btn-secondary select-alt-btn" onclick="window.selectAlternativeFlight(${index}, '${alt.transport_name}')" style="font-size: 9.5px; padding: 2px 6px; border-color: var(--color-success); color: var(--color-success); background: transparent;">Select</button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    ` : ''}
                    <div class="timeline-metrics" style="color: var(--accent-purple); font-size: 11px; margin-bottom: 12px; gap: 24px;">
                        <span><i data-lucide="plane-takeoff" style="width:12px; height:12px;"></i> ETD (Depart): <strong>${leg.etd}</strong></span>
                        <span><i data-lucide="plane-landing" style="width:12px; height:12px;"></i> ETA (Arrive): <strong>${leg.eta}</strong></span>
                    </div>
                    ${staySectionHTML}
                </div>
            `;
        } else {
            legNode.innerHTML = `
                <div class="timeline-indicator ${indicatorClass}">
                    <i data-lucide="${iconName}"></i>
                </div>
                <div class="timeline-content" id="timeline-card-${index}">
                    <div class="timeline-content-header">
                        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                            <h4>Leg #${index + 1}: ${leg.from_city} (${leg.from_code || 'N/A'}) ➔ ${leg.to_city} (${leg.to_code || 'N/A'}) via ${leg.mode.toUpperCase()}</h4>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="font-size: 10px; padding: 2px 6px; border-radius: 4px; border: 1px solid ${badgeColor}; color: ${badgeColor};">${leg.data_source}</span>
                                ${cachedHint}
                                ${refreshBtn}
                                ${legLockBtn}
                            </div>
                        </div>
                        <span class="timeline-date">${formatDateString(leg.date)}</span>
                    </div>
                    <div class="timeline-metrics" style="margin-bottom: 8px;">
                        <span><i data-lucide="credit-card"></i> Cost: <strong>₹${leg.cost}</strong></span>
                        <span><i data-lucide="clock"></i> Duration: ${leg.duration}</span>
                    </div>
                    <div class="timeline-metrics" style="margin-bottom: 8px; font-weight: 500; color: var(--accent-purple);">
                        <span><i data-lucide="info"></i> ${leg.transport_name || 'Generic Transport'}</span>
                    </div>
                    ${leg.alternatives && leg.alternatives.length > 1 ? `
                    <div class="alternatives-container">
                        <button class="btn btn-secondary btn-sm" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'" style="font-size: 11px; padding: 4px 8px; margin-bottom: 6px;">View Other Options (${leg.alternatives.length - 1})</button>
                        <div style="display: none;">
                            <table class="alternatives-table">
                                <thead>
                                    <tr>
                                        <th>Carrier</th>
                                        <th>Stops</th>
                                        <th>Duration</th>
                                        <th>ETD</th>
                                        <th>ETA</th>
                                        <th>Price</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${leg.alternatives.slice(1).map(alt => `
                                        <tr>
                                            <td>
                                                <div class="alternatives-carrier">
                                                    <i data-lucide="${leg.mode === 'flight' ? 'plane' : leg.mode === 'train' ? 'train' : 'bus'}" style="width: 12px; height: 12px; opacity: 0.7;"></i>
                                                    <span>${alt.transport_name}</span>
                                                </div>
                                            </td>
                                            <td>${alt.stops === 0 ? 'Non-stop' : alt.stops === 1 ? '1 stop' : alt.stops + ' stops'}</td>
                                            <td>${alt.duration || 'N/A'}</td>
                                            <td><strong>${alt.etd || 'N/A'}</strong></td>
                                            <td><strong>${alt.eta || 'N/A'}</strong></td>
                                            <td class="alternatives-price">₹${alt.price}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    ` : ''}
                    <div class="timeline-metrics" style="color: var(--accent-purple); font-size: 11px; margin-bottom: 12px; gap: 24px;">
                        <span><i data-lucide="plane-takeoff" style="width:12px; height:12px;"></i> ETD (Depart): <strong>${leg.etd}</strong></span>
                        <span><i data-lucide="plane-landing" style="width:12px; height:12px;"></i> ETA (Arrive): <strong>${leg.eta}</strong></span>
                    </div>
                    ${staySectionHTML}
                </div>
            `;
        }
        
        container.appendChild(legNode);
    });
    
    // 3. Final Arrival node
    const lastLeg = option.legs[option.legs.length - 1];
    const endNode = document.createElement('div');
    endNode.className = 'timeline-node';
    
    // Calculate final arrival date
    const finalDate = getArrivalDateTime(lastLeg);
    let badgeColor = lastLeg.data_source === 'Fresh' ? 'var(--emerald)' : lastLeg.data_source === 'Cached' ? 'var(--accent-blue)' : 'var(--muted)';
    let cachedHint = lastLeg.cached_at ? ` <span style="font-size: 10px; color: var(--muted);">(${new Date(lastLeg.cached_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})</span>` : '';
    let refreshBtn = ''; // the final destination node does not have a mode or price to refresh

    endNode.innerHTML = `
        <div class="timeline-indicator indicator-destination">
            <i data-lucide="map-pin"></i>
        </div>
        <div class="timeline-content">
            <div class="timeline-content-header">
                <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                    <h4>Arrive at Final Destination: ${lastLeg.to_city}</h4>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 10px; padding: 2px 6px; border-radius: 4px; border: 1px solid ${badgeColor}; color: ${badgeColor};">${lastLeg.data_source}</span>
                        ${cachedHint}
                        ${refreshBtn}
                    </div>
                </div>
                <span class="timeline-date">${formatDateString(finalDate)}</span>
            </div>
            <p class="subtitle">Welcome to your destination! Trip completed successfully.</p>
        </div>
    `;
    container.appendChild(endNode);
    safeCreateIcons();
}

// Helper functions for calculating extreme itinerary options (Cheapest and Fastest)
function parseDurationToMinutes(durStr) {
    if (!durStr) return 0;
    let hours = 0;
    let minutes = 0;
    const hMatch = durStr.match(/(\d+)\s*h/);
    const mMatch = durStr.match(/(\d+)\s*m/);
    if (hMatch) hours = parseInt(hMatch[1], 10);
    if (mMatch) minutes = parseInt(mMatch[1], 10);
    return hours * 60 + minutes;
}

function getActiveTravelMins(option) {
    if (!option || !option.legs) return 0;
    return option.legs.reduce((sum, leg) => sum + parseDurationToMinutes(leg.duration), 0);
}

function formatMinsToHoursMins(totalMins) {
    const hours = Math.floor(totalMins / 60);
    const mins = Math.round(totalMins % 60);
    if (hours > 0) {
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
}

function getLegChoices(leg) {
    const choices = [];
    
    // Add current default choice
    choices.push({
        cost: leg.cost,
        duration: leg.duration,
        etd: leg.etd,
        eta: leg.eta
    });
    
    if (leg.mode === 'train' && leg.alternatives && leg.alternatives.length > 0) {
        const selectedClass = leg.selected_class || 'SL';
        leg.alternatives.forEach(t => {
            const classAvail = (t.classAvailability || []).find(ca => ca.class === selectedClass);
            if (classAvail) {
                choices.push({
                    cost: Math.ceil(classAvail.fare),
                    duration: t.duration,
                    etd: t.departure,
                    eta: t.arrival
                });
            }
        });
    } else if (leg.mode === 'flight' && leg.alternatives && leg.alternatives.length > 0) {
        leg.alternatives.forEach(f => {
            choices.push({
                cost: Math.ceil(f.price !== undefined ? f.price : f.cost),
                duration: f.duration,
                etd: f.etd,
                eta: f.eta
            });
        });
    }
    
    return choices;
}

function calculateItineraryBounds(option) {
    const legsChoices = option.legs.map(leg => getLegChoices(leg));
    
    // 1. Cheapest Combination
    const cheapestChoices = legsChoices.map(choices => {
        return choices.reduce((minC, c) => c.cost < minC.cost ? c : minC, choices[0]);
    });
    const lowestCostVal = cheapestChoices.reduce((sum, c) => sum + c.cost, 0);
    
    // 2. Fastest Combination
    const fastestChoices = legsChoices.map(choices => {
        return choices.reduce((minD, c) => parseDurationToMinutes(c.duration) < parseDurationToMinutes(minD.duration) ? c : minD, choices[0]);
    });
    const costForBestTimeVal = fastestChoices.reduce((sum, c) => sum + c.cost, 0);
    
    const calculateDurationDays = (choicesList) => {
        try {
            const firstChoice = choicesList[0];
            const lastChoice = choicesList[choicesList.length - 1];
            const firstLeg = option.legs[0];
            const lastLeg = option.legs[option.legs.length - 1];
            const startDt = parseDateTime(firstLeg.date, firstChoice.etd);
            const lastLegDepDt = parseDateTime(lastLeg.date, lastChoice.etd);
            const lastLegDurMins = parseDurationToMinutes(lastChoice.duration);
            const endDt = new Date(lastLegDepDt.getTime() + lastLegDurMins * 60 * 1000);
            const diffMs = endDt - startDt;
            if (diffMs > 0) {
                return diffMs / (3600000.0 * 24.0);
            }
        } catch (e) {
            console.error("Failed to calculate boundary duration days:", e);
        }
        return option.total_duration_hours / 24.0;
    };
    
    const valA = calculateDurationDays(cheapestChoices);
    const valB = calculateDurationDays(fastestChoices);
    
    const timeForLowestCostVal = Math.max(valA, valB);
    const bestTimeVal = Math.min(valA, valB);
    
    const cheapestActiveMins = cheapestChoices.reduce((sum, c) => sum + parseDurationToMinutes(c.duration), 0);
    const cheapestActiveDays = cheapestActiveMins / (60.0 * 24.0);
    
    const fastestActiveMins = fastestChoices.reduce((sum, c) => sum + parseDurationToMinutes(c.duration), 0);
    const fastestActiveDays = fastestActiveMins / (60.0 * 24.0);
    
    return {
        lowestCost: lowestCostVal,
        timeForLowestCost: timeForLowestCostVal,
        bestTime: bestTimeVal,
        costForBestTime: costForBestTimeVal,
        cheapestActiveDays: cheapestActiveDays,
        fastestActiveDays: fastestActiveDays
    };
}

// Render Cost Trend Chart (Chart.js)
function renderChart(options, bestOption) {
    const costCanvas = document.getElementById('cost-chart');
    const transitCanvas = document.getElementById('transit-chart');
    const durationCanvas = document.getElementById('duration-chart');
    if (!costCanvas || !durationCanvas) return;
    
    if (costChart) costChart.destroy();
    if (transitChart) transitChart.destroy();
    if (durationChart) durationChart.destroy();
    
    const labels = options.map(opt => {
        const d = new Date(opt.start_date);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    
    const originalOptions = window.lastOptimizeResults ? window.lastOptimizeResults.all_options : options;
    
    // Recommended original values (Baseline)
    const costDataPoints = window.originalCostDataPoints || originalOptions.map(opt => opt.available ? opt.total_cost : null);
    const durationDataPoints = window.originalDurationDataPoints || originalOptions.map(opt => opt.available ? (opt.total_duration_hours / 24.0) : null);
    
    // User custom selection values (Warped active path)
    const customCostDataPoints = options.map(opt => opt.available ? opt.total_cost : null);
    const customDurationDataPoints = options.map(opt => opt.available ? (opt.total_duration_hours / 24.0) : null);
    // Active transit in hours (not fractional days) — more readable for transit chart
    const customActiveHoursDataPoints = options.map(opt => opt.available ? (getActiveTravelMins(opt) / 60.0) : null);
    const customActiveDurationDataPoints = options.map(opt => opt.available ? (getActiveTravelMins(opt) / (60.0 * 24.0)) : null);
    // Bounds in hours for transit chart
    const fastestActiveHours = window.fastestActiveDurations ? window.fastestActiveDurations.map(v => v !== null ? v * 24.0 : null) : null;
    const cheapestActiveHours = window.cheapestActiveDurations ? window.cheapestActiveDurations.map(v => v !== null ? v * 24.0 : null) : null;
    
    // Cost Colors
    const costBackgroundColors = options.map(opt => {
        if (!opt.available) return '#f43f5e';
        if (opt.start_date === bestOption.start_date) return '#10b981';
        return '#8b5cf6';
    });
    const costBorderColors = options.map(opt => {
        if (!opt.available) return 'rgba(244, 63, 94, 0.4)';
        if (opt.start_date === bestOption.start_date) return 'rgba(16, 185, 129, 0.4)';
        return 'rgba(139, 92, 246, 0.4)';
    });
    
    // Duration Colors
    const durationBackgroundColors = options.map(opt => {
        if (!opt.available) return '#f43f5e';
        if (opt.start_date === bestOption.start_date) return '#10b981';
        return '#06b6d4'; // Cyan
    });
    const durationBorderColors = options.map(opt => {
        if (!opt.available) return 'rgba(244, 63, 94, 0.4)';
        if (opt.start_date === bestOption.start_date) return 'rgba(16, 185, 129, 0.4)';
        return 'rgba(6, 182, 212, 0.4)'; // Cyan glow
    });
    
    const pointRadius = options.map(opt => {
        if (!opt.available) return 5;
        if (opt.start_date === bestOption.start_date) return 8;
        return 5;
    });

    const ctxCost = costCanvas.getContext('2d');
    const costGradient = ctxCost.createLinearGradient(0, 0, 0, 250);
    costGradient.addColorStop(0, 'rgba(139, 92, 246, 0.35)');
    costGradient.addColorStop(1, 'rgba(139, 92, 246, 0.00)');
    
    const ctxDur = durationCanvas.getContext('2d');
    const durGradient = ctxDur.createLinearGradient(0, 0, 0, 250);
    durGradient.addColorStop(0, 'rgba(6, 182, 212, 0.35)');
    durGradient.addColorStop(1, 'rgba(6, 182, 212, 0.00)');

    const ctxTransit = transitCanvas ? transitCanvas.getContext('2d') : null;
    const transitGradient = ctxTransit ? ctxTransit.createLinearGradient(0, 0, 0, 250) : null;
    if (transitGradient) {
        transitGradient.addColorStop(0, 'rgba(59, 130, 246, 0.35)');
        transitGradient.addColorStop(1, 'rgba(59, 130, 246, 0.00)');
    }

    if (typeof Chart !== 'undefined') {
        // 1. Cost Chart
        costChart = new Chart(ctxCost, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Cheapest (₹)',
                        data: window.cheapestItineraryCosts || costDataPoints,
                        borderColor: '#10b981', // Emerald Green
                        borderWidth: 3,
                        backgroundColor: 'transparent',
                        fill: false,
                        tension: 0.35,
                        spanGaps: false,
                        pointBackgroundColor: '#10b981',
                        pointBorderColor: 'rgba(16, 185, 129, 0.4)',
                        pointBorderWidth: 2,
                        pointRadius: options.map(opt => opt.available ? 5 : 0),
                        pointHoverRadius: 7,
                        pointHoverBackgroundColor: '#10b981',
                        pointHoverBorderColor: '#ffffff',
                        pointHoverBorderWidth: 2
                    },
                    {
                        label: 'Fastest (₹)',
                        data: window.fastestItineraryCosts || costDataPoints,
                        borderColor: '#3b82f6', // Bright Blue
                        borderWidth: 3,
                        backgroundColor: 'transparent',
                        fill: false,
                        tension: 0.35,
                        spanGaps: false,
                        pointBackgroundColor: '#3b82f6',
                        pointBorderColor: 'rgba(59, 130, 246, 0.4)',
                        pointBorderWidth: 2,
                        pointRadius: options.map(opt => opt.available ? 5 : 0),
                        pointHoverRadius: 7,
                        pointHoverBackgroundColor: '#3b82f6',
                        pointHoverBorderColor: '#ffffff',
                        pointHoverBorderWidth: 2
                    },
                    {
                        label: 'Your Selection (₹)',
                        data: customCostDataPoints,
                        borderColor: '#f59e0b', // Amber
                        borderWidth: 2.5,
                        borderDash: [5, 5],
                        backgroundColor: 'transparent',
                        fill: false,
                        tension: 0.35,
                        spanGaps: false,
                        pointBackgroundColor: '#f59e0b',
                        pointBorderColor: 'rgba(245, 158, 11, 0.4)',
                        pointBorderWidth: 2,
                        pointRadius: options.map((opt, i) => {
                            const isActive = opt.start_date === bestOption.start_date;
                            const origCost = window.originalCostDataPoints ? window.originalCostDataPoints[i] : null;
                            const hasCustom = origCost !== null && opt.total_cost !== origCost;
                            return isActive ? 8 : (hasCustom ? 7 : 0);
                        }),
                        pointStyle: options.map(opt => opt.start_date === bestOption.start_date ? 'circle' : 'triangle'),
                        pointHoverRadius: 9
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                onHover: (event, activeElements) => {
                    handleChartHoverSync(event, activeElements, costChart);
                },
                plugins: {
                    legend: { 
                        display: true,
                        labels: {
                            color: '#e2e8f0',
                            font: { family: 'Outfit', size: 10, weight: '500' },
                            boxWidth: 12,
                            boxHeight: 12,
                            padding: 10
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(11, 8, 23, 0.95)',
                        titleFont: { family: 'Outfit', size: 13, weight: 'bold' },
                        bodyFont: { family: 'Inter', size: 12 },
                        borderColor: 'rgba(139, 92, 246, 0.3)',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            title: function(context) {
                                const index = context[0].dataIndex;
                                return `Start Date: ${formatDateString(options[index].start_date)}`;
                            },
                            label: function(context) {
                                const index = context.dataIndex;
                                const option = options[index];
                                if (!option.available) return `⚠️ Status: Leg Sold Out / Unavailable`;
                                
                                const cheapestCost = window.cheapestItineraryCosts ? window.cheapestItineraryCosts[index] : null;
                                const fastestCost = window.fastestItineraryCosts ? window.fastestItineraryCosts[index] : null;
                                
                                const activeMins = getActiveTravelMins(option);
                                const activeStr = formatMinsToHoursMins(activeMins);
                                
                                let label = `💰 Selected Cost: ₹${option.total_cost}`;
                                if (cheapestCost !== null) {
                                    label += ` (Cheapest: ₹${cheapestCost}`;
                                }
                                if (fastestCost !== null) {
                                    label += `, Fastest: ₹${fastestCost})`;
                                }
                                if (option.start_date === bestOption.start_date) label += ` (🏆 Best Value!)`;
                                
                                return [
                                    label,
                                    `⏱️ Trip Duration: ${option.total_duration_str} | Active Transit: ${activeStr}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.04)', drawBorder: false },
                        ticks: { color: '#6e677c', font: { family: 'Inter', size: 11 } }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.04)', drawBorder: false },
                        ticks: {
                            color: '#6e677c',
                            font: { family: 'Inter', size: 11 },
                            callback: function(value) { return '₹' + value; }
                        }
                    }
                },
                onClick: (e) => {
                    const points = costChart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, true);
                    if (points.length > 0) {
                        const index = points[0].index;
                        const selectedOption = options[index];
                        if (selectedOption.available) {
                            renderTimeline(selectedOption);
                            highlightChartPoint(selectedOption.start_date);
                        } else {
                            alert("Note: This start date is unavailable because one or more transport legs are sold out on this day. Please select a purple or green node!");
                        }
                    }
                }
            }
        });

        // 2. Transit Time Chart (active travel hours per date)
        if (ctxTransit) {
            transitChart = new Chart(ctxTransit, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Fastest (hrs)',
                            data: fastestActiveHours || customActiveHoursDataPoints,
                            borderColor: '#3b82f6',
                            borderWidth: 3,
                            backgroundColor: 'transparent',
                            fill: false,
                            tension: 0.35,
                            spanGaps: false,
                            pointBackgroundColor: '#3b82f6',
                            pointBorderColor: 'rgba(59, 130, 246, 0.4)',
                            pointBorderWidth: 2,
                            pointRadius: options.map(opt => opt.available ? 5 : 0),
                            pointHoverRadius: 7,
                            pointHoverBackgroundColor: '#3b82f6',
                            pointHoverBorderColor: '#ffffff',
                            pointHoverBorderWidth: 2
                        },
                        {
                            label: 'Cheapest (hrs)',
                            data: cheapestActiveHours || customActiveHoursDataPoints,
                            borderColor: '#10b981',
                            borderWidth: 3,
                            backgroundColor: 'transparent',
                            fill: false,
                            tension: 0.35,
                            spanGaps: false,
                            pointBackgroundColor: '#10b981',
                            pointBorderColor: 'rgba(16, 185, 129, 0.4)',
                            pointBorderWidth: 2,
                            pointRadius: options.map(opt => opt.available ? 5 : 0),
                            pointHoverRadius: 7,
                            pointHoverBackgroundColor: '#10b981',
                            pointHoverBorderColor: '#ffffff',
                            pointHoverBorderWidth: 2
                        },
                        {
                            label: 'Your Selection (hrs)',
                            data: customActiveHoursDataPoints,
                            borderColor: '#f59e0b',
                            borderWidth: 2.5,
                            borderDash: [5, 5],
                            backgroundColor: 'transparent',
                            fill: false,
                            tension: 0.35,
                            spanGaps: false,
                            pointBackgroundColor: '#f59e0b',
                            pointBorderColor: 'rgba(245, 158, 11, 0.4)',
                            pointBorderWidth: 2,
                            pointRadius: options.map(opt => opt.start_date === bestOption.start_date ? 8 : (opt.available ? 5 : 0)),
                            pointHoverRadius: 9
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    onHover: (event, activeElements) => {
                        handleChartHoverSync(event, activeElements, transitChart);
                    },
                    plugins: {
                        legend: {
                            display: true,
                            labels: {
                                color: '#e2e8f0',
                                font: { family: 'Outfit', size: 10, weight: '500' },
                                boxWidth: 12, boxHeight: 12, padding: 10
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(11, 8, 23, 0.95)',
                            titleFont: { family: 'Outfit', size: 13, weight: 'bold' },
                            bodyFont: { family: 'Inter', size: 12 },
                            borderColor: 'rgba(59, 130, 246, 0.3)',
                            borderWidth: 1, padding: 12, displayColors: false,
                            callbacks: {
                                title: ctx => `Start Date: ${formatDateString(options[ctx[0].dataIndex].start_date)}`,
                                label: function(context) {
                                    const opt = options[context.dataIndex];
                                    if (!opt.available) return '⚠️ Leg Sold Out / Unavailable';
                                    const mins = getActiveTravelMins(opt);
                                    return `⚡ Active Transit: ${formatMinsToHoursMins(mins)}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
                            ticks: { color: '#6e677c', font: { family: 'Inter', size: 11 } }
                        },
                        y: {
                            grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
                            ticks: {
                                color: '#6e677c',
                                font: { family: 'Inter', size: 11 },
                                callback: v => v.toFixed(1) + ' hrs'
                            }
                        }
                    },
                    onClick: (e) => {
                        const pts = transitChart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, true);
                        if (pts.length > 0) {
                            const sel = options[pts[0].index];
                            if (sel.available) { renderTimeline(sel); highlightChartPoint(sel.start_date); }
                            else alert('This date is unavailable. Please choose a different node.');
                        }
                    }
                }
            });
        }

        // 3. Total Duration Chart (elapsed days)
        durationChart = new Chart(ctxDur, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Fastest (days)',
                        data: window.fastestItineraryDurations || durationDataPoints,
                        borderColor: '#3b82f6',
                        borderWidth: 3,
                        backgroundColor: 'transparent',
                        fill: false,
                        tension: 0.35,
                        spanGaps: false,
                        pointBackgroundColor: '#3b82f6',
                        pointBorderColor: 'rgba(59, 130, 246, 0.4)',
                        pointBorderWidth: 2,
                        pointRadius: options.map(opt => opt.available ? 5 : 0),
                        pointHoverRadius: 7,
                        pointHoverBackgroundColor: '#3b82f6',
                        pointHoverBorderColor: '#ffffff',
                        pointHoverBorderWidth: 2
                    },
                    {
                        label: 'Cheapest (days)',
                        data: window.cheapestItineraryDurations || durationDataPoints,
                        borderColor: '#10b981',
                        borderWidth: 3,
                        backgroundColor: 'transparent',
                        fill: false,
                        tension: 0.35,
                        spanGaps: false,
                        pointBackgroundColor: '#10b981',
                        pointBorderColor: 'rgba(16, 185, 129, 0.4)',
                        pointBorderWidth: 2,
                        pointRadius: options.map(opt => opt.available ? 5 : 0),
                        pointHoverRadius: 7,
                        pointHoverBackgroundColor: '#10b981',
                        pointHoverBorderColor: '#ffffff',
                        pointHoverBorderWidth: 2
                    },
                    {
                        label: 'Your Selection (days)',
                        data: customDurationDataPoints,
                        borderColor: '#f59e0b',
                        borderWidth: 2.5,
                        borderDash: [5, 5],
                        backgroundColor: 'transparent',
                        fill: false,
                        tension: 0.35,
                        spanGaps: false,
                        pointBackgroundColor: '#f59e0b',
                        pointBorderColor: 'rgba(245, 158, 11, 0.4)',
                        pointBorderWidth: 2,
                        pointRadius: options.map((opt, i) => {
                            const isActive = opt.start_date === bestOption.start_date;
                            const origDur = window.originalDurationDataPoints ? window.originalDurationDataPoints[i] : null;
                            const curDur = opt.available ? (opt.total_duration_hours / 24.0) : null;
                            const hasCustom = origDur !== null && curDur !== null && Math.abs(curDur - origDur) > 0.001;
                            return isActive ? 8 : (hasCustom ? 6 : 0);
                        }),
                        pointHoverRadius: 9
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                onHover: (event, activeElements) => {
                    handleChartHoverSync(event, activeElements, durationChart);
                },
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            color: '#e2e8f0',
                            font: { family: 'Outfit', size: 10, weight: '500' },
                            boxWidth: 12, boxHeight: 12, padding: 10
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(11, 8, 23, 0.95)',
                        titleFont: { family: 'Outfit', size: 13, weight: 'bold' },
                        bodyFont: { family: 'Inter', size: 12 },
                        borderColor: 'rgba(6, 182, 212, 0.3)',
                        borderWidth: 1, padding: 12, displayColors: false,
                        callbacks: {
                            title: ctx => `Start Date: ${formatDateString(options[ctx[0].dataIndex].start_date)}`,
                            label: function(context) {
                                const opt = options[context.dataIndex];
                                if (!opt.available) return '⚠️ Leg Sold Out / Unavailable';
                                const elapsed = opt.total_duration_hours / 24.0;
                                const lines = [`⏱️ Elapsed: ${opt.total_duration_str} (${elapsed.toFixed(2)} days)`];
                                if (opt.start_date === bestOption.start_date) lines.push('🏆 Best Value Route!');
                                return lines;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
                        ticks: { color: '#6e677c', font: { family: 'Inter', size: 11 } }
                    },
                    y: {
                        grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
                        ticks: {
                            color: '#6e677c',
                            font: { family: 'Inter', size: 11 },
                            callback: v => v.toFixed(1) + ' days'
                        }
                    }
                },
                onClick: (e) => {
                    const pts = durationChart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, true);
                    if (pts.length > 0) {
                        const sel = options[pts[0].index];
                        if (sel.available) { renderTimeline(sel); highlightChartPoint(sel.start_date); }
                        else alert('This date is unavailable. Please choose a different node.');
                    }
                }
            }
        });
    }
}

async function refreshSingleLeg(btn, from_city, to_city, date, mode) {
    btn.disabled = true;
    btn.innerText = "Refreshing...";
    try {
        const response = await fetch('/api/refresh-leg', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({from_city, to_city, date, mode, force_refresh: true})
        });
        if (!response.ok) throw new Error("Failed to refresh leg");
        const data = await response.json();
        window.updateApiCounters(data.flight_api_calls, data.train_api_calls);
        
        // Update the card UI
        const headerDiv = btn.closest('.timeline-content-header').querySelector('div > div');
        let badgeColor = data.data_source === 'Fresh' ? 'var(--emerald)' : data.data_source === 'Cached' ? 'var(--accent-blue)' : 'var(--muted)';
        let cachedHint = data.cached_at ? ` <span style="font-size: 10px; color: var(--muted);">(${new Date(data.cached_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})</span>` : '';
        
        // Update the badge
        const badgeSpan = headerDiv.querySelector('span:first-child');
        if (badgeSpan) {
            badgeSpan.style.borderColor = badgeColor;
            badgeSpan.style.color = badgeColor;
            badgeSpan.innerText = data.data_source;
        }
        
        // Remove old cached hint and insert new one
        if (headerDiv.childNodes.length > 3) {
            headerDiv.childNodes[3].remove(); 
        }
        
        // Update metrics
        const contentDiv = btn.closest('.timeline-content');
        const costStrong = contentDiv.querySelector('.timeline-metrics strong');
        if (costStrong) costStrong.innerText = '₹' + data.cost;
        
        btn.innerText = "Refreshed!";
        setTimeout(() => btn.remove(), 2000);
        
    } catch (e) {
        console.error(e);
        btn.innerText = "Failed";
        btn.disabled = false;
    }
}

window.reoptimizeWithClasses = async function(legIndex, selectedClass) {
    if (!window.lastOptimizePayload || !window.currentTimelineOption) return;
    
    // Update the class in the last optimize payload
    if (legIndex < window.lastOptimizePayload.stops.length) {
        window.lastOptimizePayload.stops[legIndex].selected_class = selectedClass;
    } else if (legIndex === window.lastOptimizePayload.stops.length) {
        window.lastOptimizePayload.destination_class = selectedClass;
    }
    
    const targetDate = window.currentlySelectedDate || window.currentTimelineOption.start_date;
    
    try {
        const response = await fetch('/api/optimize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(window.lastOptimizePayload)
        });
        
        if (!response.ok) throw new Error("Re-optimization calculation failed.");
        const data = await response.json();
        window.updateApiCounters(data.flight_api_calls, data.train_api_calls);
        
        // Update globalOptions
        globalOptions = data.all_options;
        
        // Deep clone/copy baseline metrics for cost and duration to keep them from being overridden on leg changes
        window.originalCostDataPoints = data.all_options.map(opt => opt.available ? opt.total_cost : null);
        window.originalDurationDataPoints = data.all_options.map(opt => opt.available ? (opt.total_duration_hours / 24.0) : null);
        
        const boundsList = data.all_options.map(opt => opt.available ? calculateItineraryBounds(opt) : null);
        window.cheapestItineraryCosts = boundsList.map(b => b ? b.lowestCost : null);
        window.cheapestItineraryDurations = boundsList.map(b => b ? b.timeForLowestCost : null);
        window.fastestItineraryCosts = boundsList.map(b => b ? b.costForBestTime : null);
        window.fastestItineraryDurations = boundsList.map(b => b ? b.bestTime : null);
        window.cheapestActiveDurations = boundsList.map(b => b ? b.cheapestActiveDays : null);
        window.fastestActiveDurations = boundsList.map(b => b ? b.fastestActiveDays : null);
        
        // Recalculate Cheapest vs. Fastest available itineraries dynamically
        const availableOptions = globalOptions.filter(opt => opt.available);
        const bestOpt = data.best_option;
        window.cheapestItinerary = availableOptions.length > 0 
            ? availableOptions.reduce((prev, curr) => prev.total_cost < curr.total_cost ? prev : curr)
            : bestOpt;
        window.fastestItinerary = availableOptions.length > 0
            ? availableOptions.reduce((prev, curr) => prev.total_duration_hours < curr.total_duration_hours ? prev : curr)
            : bestOpt;
            
        // Update stats cards in UI
        if (bestOpt) {
            const recommendedOption = window.currentOptimizationGoal === 'cost' ? window.cheapestItinerary : window.fastestItinerary;
            const activeSavings = Math.max(0, data.average_cost - recommendedOption.total_cost);
            
            document.getElementById('best-date-display').textContent = formatDateString(recommendedOption.start_date);
            document.getElementById('savings-display').innerHTML = `<i data-lucide="trending-down"></i> Save ₹${Math.round(activeSavings)} (vs average)`;
            document.getElementById('best-cost-display').textContent = `₹${recommendedOption.total_cost}`;
            
            const fastestCostEl = document.getElementById('fastest-cost-display');
            const fastestDurEl = document.getElementById('fastest-duration-helper');
            if (fastestCostEl && window.fastestItinerary) {
                fastestCostEl.textContent = `₹${window.fastestItinerary.total_cost}`;
            }
            if (fastestDurEl && window.fastestItinerary) {
                fastestDurEl.innerHTML = `<i data-lucide="clock" style="width: 10px; height: 10px; display: inline-block; vertical-align: middle; margin-right: 4px;"></i>Duration: ${window.fastestItinerary.total_duration_str}`;
            }
        }
        
        // Find updated option for the same viewed date
        const currentOpt = globalOptions.find(o => o.start_date === targetDate) || bestOpt || window.currentTimelineOption;
        
        // Update the charts, Selector Strip and Timeline
        renderChart(globalOptions, bestOpt || currentOpt);
        renderDateSelectorStrip(globalOptions, currentOpt);
        renderTimeline(currentOpt);
        
    } catch (e) {
        console.error("Failed to re-optimize with new class classes:", e);
        alert("Failed to re-optimize itinerary options. Please check station/airport availability or try again.");
        document.querySelectorAll('.card-mini-loader').forEach(el => el.remove());
    }
};

window.handleTrainClassChange = async function(legIndex, selectedClass) {
    const cardEl = document.getElementById(`timeline-card-${legIndex}`);
    if (cardEl) {
        if (!cardEl.querySelector('.card-mini-loader')) {
            const loader = document.createElement('div');
            loader.className = 'card-mini-loader';
            loader.innerHTML = `
                <i class="spin" data-lucide="refresh-cw" style="width: 18px; height: 18px; color: var(--accent-purple);"></i>
                <span>Re-optimizing train class...</span>
            `;
            cardEl.appendChild(loader);
            safeCreateIcons();
        }
    }
    await window.reoptimizeWithClasses(legIndex, selectedClass);
};

window.handleFlightClassChange = async function(legIndex, selectedClass) {
    const cardEl = document.getElementById(`timeline-card-${legIndex}`);
    if (cardEl) {
        if (!cardEl.querySelector('.card-mini-loader')) {
            const loader = document.createElement('div');
            loader.className = 'card-mini-loader';
            loader.innerHTML = `
                <i class="spin" data-lucide="refresh-cw" style="width: 18px; height: 18px; color: var(--accent-purple);"></i>
                <span>Re-optimizing flight class...</span>
            `;
            cardEl.appendChild(loader);
            safeCreateIcons();
        }
    }
    await window.reoptimizeWithClasses(legIndex, selectedClass);
};

window.updateTradeoffBanner = function() {
    const tradeoffText = document.getElementById('tradeoff-text');
    const tradeoffBanner = document.getElementById('tradeoff-banner');
    if (!tradeoffText || !tradeoffBanner || !window.cheapestItinerary || !window.fastestItinerary) return;
    
    const costDiff = window.fastestItinerary.total_cost - window.cheapestItinerary.total_cost;
    const durationDiff = window.cheapestItinerary.total_duration_hours - window.fastestItinerary.total_duration_hours;
    const durationDiffDays = durationDiff / 24.0;
    
    const cheapestActiveMins = getActiveTravelMins(window.cheapestItinerary);
    const fastestActiveMins = getActiveTravelMins(window.fastestItinerary);
    const activeDiffMins = cheapestActiveMins - fastestActiveMins;
    const activeDiffStr = formatMinsToHoursMins(activeDiffMins);
    
    tradeoffBanner.classList.remove('time-optimized');
    
    if (window.currentOptimizationGoal === 'cost') {
        if (costDiff > 0) {
            let activeText = activeDiffMins > 0 ? ` (and adds <strong>${activeDiffStr}</strong> of active in-transit time)` : ``;
            tradeoffText.innerHTML = `Currently optimized for <strong>Cheapest</strong>. This saves you <strong>₹${costDiff}</strong> compared to the fastest date, but adds <strong>${durationDiffDays.toFixed(1)} days</strong> in overall trip duration${activeText}.`;
        } else {
            tradeoffText.innerHTML = `Currently optimized for <strong>Cheapest</strong>. Showing the itinerary with the lowest financial impact.`;
        }
    } else {
        tradeoffBanner.classList.add('time-optimized');
        if (durationDiff > 0 || activeDiffMins > 0) {
            let activeText = activeDiffMins > 0 ? ` and <strong>${activeDiffStr}</strong> of active in-transit time` : ``;
            tradeoffText.innerHTML = `Currently optimized for <strong>Fastest</strong>. This saves you <strong>${durationDiffDays.toFixed(1)} days</strong> in overall trip duration${activeText}, but adds <strong>₹${costDiff}</strong> to your transport budget.`;
        } else {
            tradeoffText.innerHTML = `Currently optimized for <strong>Fastest</strong>. Showing the itinerary with the shortest transit time.`;
        }
    }
    safeCreateIcons();
};

window.setOptimizationGoal = function(goal) {
    window.currentOptimizationGoal = goal;
    
    const costBtn = document.getElementById('opt-cost-btn');
    const timeBtn = document.getElementById('opt-time-btn');
    
    if (goal === 'cost') {
        if (costBtn) costBtn.classList.add('active');
        if (timeBtn) timeBtn.classList.remove('active');
    } else {
        if (timeBtn) timeBtn.classList.add('active');
        if (costBtn) costBtn.classList.remove('active');
    }
    
    if (window.lastOptimizeResults) {
        renderResults(window.lastOptimizeResults);
    }
};

window.selectPreferredItinerary = function() {
    if (!window.currentTimelineOption) return;
    
    const selectedDate = window.currentTimelineOption.start_date;
    
    if (window.preferredItineraryDate === selectedDate) {
        window.preferredItineraryDate = null;
    } else {
        window.preferredItineraryDate = selectedDate;
    }
    
    renderDateSelectorStrip(globalOptions, window.currentTimelineOption);
    renderTimeline(window.currentTimelineOption);
    safeCreateIcons();
};

window.toggleLockItineraryDate = function(startDate) {
    if (window.preferredItineraryDate === startDate) {
        window.preferredItineraryDate = null;
    } else {
        window.preferredItineraryDate = startDate;
    }
    
    renderDateSelectorStrip(globalOptions, window.currentTimelineOption);
    renderTimeline(window.currentTimelineOption);
    safeCreateIcons();
};

window.toggleLockLeg = function(legIndex) {
    if (!window.currentTimelineOption) return;
    const leg = window.currentTimelineOption.legs[legIndex];
    
    // Toggle the locked state of the specific leg
    leg.locked = !leg.locked;
    
    // Re-render timeline to update lock icon and button styling
    renderTimeline(window.currentTimelineOption);
    safeCreateIcons();
};

window.updateApiCounters = function(flightCalls, trainCalls) {
    const flightEl = document.getElementById('flight-api-count');
    const trainEl = document.getElementById('train-api-count');
    if (flightEl && flightCalls !== undefined) {
        flightEl.textContent = flightCalls;
    }
    if (trainEl && trainCalls !== undefined) {
        trainEl.textContent = trainCalls;
    }
};

window.fetchApiStats = async function() {
    try {
        const res = await fetch('/api/stats');
        if (res.ok) {
            const data = await res.json();
            window.updateApiCounters(data.flight_api_calls, data.train_api_calls);
        }
    } catch (e) {
        console.error("Failed to fetch API stats:", e);
    }
};

window.selectAlternativeTrain = function(legIndex, trainNumber) {
    if (!window.currentTimelineOption) return;
    const leg = window.currentTimelineOption.legs[legIndex];
    leg.selected_train_number = trainNumber;
    
    // Recalculate leg metrics
    const selectedClass = leg.selected_class || 'SL';
    const train = leg.alternatives.find(t => t.trainNumber === trainNumber);
    if (train) {
        const classAvail = (train.classAvailability || []).find(ca => ca.class === selectedClass);
        if (classAvail) {
            leg.cost = Math.ceil(classAvail.fare);
            leg.duration = train.duration;
            leg.etd = train.departure;
            leg.eta = train.arrival;
            leg.transport_name = `${train.trainNumber} - ${train.trainName} (${selectedClass})`;
        }
    }
    
    // Recalculate total cost and duration of the itinerary
    recalculateItineraryTotals(window.currentTimelineOption);
    
    // Re-render results in real time
    renderResultsUpdate();
};

window.selectAlternativeFlight = function(legIndex, flightName) {
    if (!window.currentTimelineOption) return;
    const leg = window.currentTimelineOption.legs[legIndex];
    leg.selected_flight_name = flightName;
    
    // Recalculate leg metrics
    const flight = leg.alternatives.find(f => f.transport_name === flightName);
    if (flight) {
        leg.cost = Math.ceil(flight.price);
        leg.duration = flight.duration;
        leg.etd = flight.etd;
        leg.eta = flight.eta;
        leg.transport_name = flight.transport_name;
    }
    
    // Recalculate total cost and duration of the itinerary
    recalculateItineraryTotals(window.currentTimelineOption);
    
    // Re-render results in real time
    renderResultsUpdate();
};

function recalculateItineraryTotals(option) {
    option.total_cost = option.legs.reduce((sum, l) => sum + l.cost, 0);
    
    try {
        const firstLeg = option.legs[0];
        const lastLeg = option.legs[option.legs.length - 1];
        const startDt = parseDateTime(firstLeg.date, firstLeg.etd);
        const lastLegDepDt = parseDateTime(lastLeg.date, lastLeg.etd);
        const lastLegDurMins = parseDurationToMinutes(lastLeg.duration);
        const endDt = new Date(lastLegDepDt.getTime() + lastLegDurMins * 60 * 1000);
        const diffMs = endDt - startDt;
        if (diffMs > 0) {
            option.total_duration_hours = diffMs / 3600000.0;
            const days = Math.floor(option.total_duration_hours / 24);
            const hours = Math.floor(option.total_duration_hours % 24);
            if (days > 0) {
                option.total_duration_str = `${days}d ${hours}h`;
            } else {
                option.total_duration_str = `${hours}h`;
            }
        }
    } catch (e) {
        console.error("Failed to recalculate itinerary duration:", e);
    }
}

function renderResultsUpdate() {
    if (!window.lastOptimizeResults) return;
    
    // Update stats cards in UI
    const recommendedOption = window.currentOptimizationGoal === 'cost' ? window.cheapestItinerary : window.fastestItinerary;
    const activeSavings = Math.max(0, window.lastOptimizeResults.average_cost - recommendedOption.total_cost);
    
    document.getElementById('best-date-display').textContent = formatDateString(recommendedOption.start_date);
    document.getElementById('savings-display').innerHTML = `<i data-lucide="trending-down"></i> Save ₹${Math.round(activeSavings)} (vs average)`;
    document.getElementById('best-cost-display').textContent = `₹${recommendedOption.total_cost}`;
    
    const fastestCostEl = document.getElementById('fastest-cost-display');
    const fastestDurEl = document.getElementById('fastest-duration-helper');
    if (fastestCostEl && window.fastestItinerary) {
        fastestCostEl.textContent = `₹${window.fastestItinerary.total_cost}`;
    }
    if (fastestDurEl && window.fastestItinerary) {
        const fastestActiveMins = getActiveTravelMins(window.fastestItinerary);
        const fastestActiveStr = formatMinsToHoursMins(fastestActiveMins);
        fastestDurEl.innerHTML = `<i data-lucide="clock" style="width: 10px; height: 10px; display: inline-block; vertical-align: middle; margin-right: 4px;"></i>Trip: ${window.fastestItinerary.total_duration_str} | Transit: ${fastestActiveStr}`;
    }
    
    updateTradeoffBanner();
    renderChart(globalOptions, recommendedOption);
    renderDateSelectorStrip(globalOptions, window.currentTimelineOption);
    renderTimeline(window.currentTimelineOption);
}
