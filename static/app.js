/* ==========================================
   VoyageOptima - Frontend Application Script
   ========================================== */

let stopCounter = 0;
let globalOptions = [];
let costChart = null;

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

// Render Results Dash
function renderResults(data) {
    const { best_option, all_options, average_cost, savings } = data;
    globalOptions = all_options;
    
    if (!best_option) {
        alert("Alert: No travel options could be optimized because all transport modes on all dates are marked as 'Sold Out'. Try changing dates or modes!");
        switchState('welcome');
        return;
    }
    
    // 1. Update stats panels
    const dateFormatted = formatDateString(best_option.start_date);
    document.getElementById('best-date-display').textContent = dateFormatted;
    document.getElementById('savings-display').innerHTML = `<i data-lucide="trending-down"></i> Save ₹${Math.round(savings)} (vs average)`;
    document.getElementById('best-cost-display').textContent = `₹${best_option.total_cost}`;
    document.getElementById('avg-cost-display').textContent = `₹${Math.round(average_cost)}`;
    document.getElementById('options-count-display').textContent = `From ${all_options.length} options scanned`;
    
    // 2. Render the cost-curve line chart
    renderChart(all_options, best_option);
    
    // 2b. Render the interactive Date Selector Strip
    renderDateSelectorStrip(all_options, best_option);
    
    // 3. Render Timeline and key statistics card for the best starting date
    renderTimeline(best_option);
    
    // Calculate total stops and nights
    const totalStops = best_option.legs.length - 1;
    const totalNights = best_option.legs.reduce((acc, leg, index) => {
        // Last leg is to final destination, no stay nights there
        if (index === best_option.legs.length - 1) return acc;
        // Search stops
        const stop = payloadStopsMatch(leg.to_city, data);
        return acc + (stop ? stop.nights : 0);
    }, 0);
    
    document.getElementById('summary-stops-val').textContent = totalStops;
    document.getElementById('summary-nights-val').textContent = `${totalNights} Nights`;
    
    // Generate a funny simulated distance stat
    const mockDistance = best_option.legs.length * 450 + 250;
    document.getElementById('summary-distance-val').textContent = `${mockDistance} km`;
    
    safeCreateIcons();
}

// Helper to look up stops
function payloadStopsMatch(city, data) {
    if (!stopsList) return { nights: 2 };
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
        
        const card = document.createElement('div');
        card.className = `date-card ${opt.start_date === selectedOption.start_date ? 'active' : ''} ${!opt.available ? 'sold-out' : ''}`;
        card.setAttribute('data-date', opt.start_date);
        
        let badgeHTML = '';
        if (opt.available && opt.total_cost === cheapestCost) {
            badgeHTML = `<span class="date-card-badge badge-cheapest-date">Cheapest</span>`;
        } else if (!opt.available) {
            badgeHTML = `<span class="date-card-badge badge-soldout-date">Sold Out</span>`;
        }
        
        card.innerHTML = `
            ${badgeHTML}
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
    if (!costChart || !globalOptions) return;
    const index = globalOptions.findIndex(o => o.start_date === startDate);
    if (index >= 0) {
        costChart.setActiveElements([{ datasetIndex: 0, index: index }]);
        costChart.tooltip.setActiveElements([{ datasetIndex: 0, index: index }]);
        costChart.update();
    }
}

function formatDateString(dateStr) {
    const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    const dateObj = new Date(dateStr);
    return dateObj.toLocaleDateString('en-US', options);
}
function renderTimeline(option) {
    const container = document.getElementById('timeline-container');
    if (!container) return;
    container.innerHTML = '';
    
    const timelineSubtitle = document.getElementById('timeline-subtitle');
    if (timelineSubtitle) {
        timelineSubtitle.textContent = `Detailed breakdown for trip starting on ${formatDateString(option.start_date)}`;
    }
    
    // Update selector strip active card and scroll it into view
    const activeCard = document.querySelector(`.date-card[data-date="${option.start_date}"]`);
    if (activeCard) {
        document.querySelectorAll('.date-card').forEach(c => c.classList.remove('active'));
        activeCard.classList.add('active');
        activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
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
        let refreshBtn = (leg.data_source === 'Cached' || leg.data_source === 'Dummy') ? `<button class="btn btn-sm" style="font-size: 10px; padding: 2px 6px; margin-left: 8px; background: rgba(255,255,255,0.1); border:none;" onclick="refreshSingleLeg(this, '${leg.from_city}', '${leg.to_city}', '${leg.date}', '${leg.mode}')">Refresh</button>` : '';
 
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
        container.appendChild(legNode);
    });
    
    // 3. Final Arrival node
    const lastLeg = option.legs[option.legs.length - 1];
    const endNode = document.createElement('div');
    endNode.className = 'timeline-node';
    
    // Calculate final arrival date
    const finalDate = new Date(lastLeg.date);
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
                <span class="timeline-date">${formatDateString(finalDate.toISOString())}</span>
            </div>
            <p class="subtitle">Welcome to your destination! Trip completed successfully.</p>
        </div>
    `;
    container.appendChild(endNode);
    safeCreateIcons();
}

// Render Cost Trend Chart (Chart.js)
function renderChart(options, bestOption) {
    const chartCanvas = document.getElementById('cost-chart');
    if (!chartCanvas) return;
    
    if (costChart) {
        costChart.destroy();
    }
    
    const labels = options.map(opt => {
        const d = new Date(opt.start_date);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    
    const dataPoints = options.map(opt => {
        return opt.available ? opt.total_cost : null;
    });
    
    const pointBackgroundColors = options.map(opt => {
        if (!opt.available) return '#f43f5e';
        if (opt.start_date === bestOption.start_date) return '#10b981';
        return '#8b5cf6';
    });
    
    const pointBorderColors = options.map(opt => {
        if (!opt.available) return 'rgba(244, 63, 94, 0.4)';
        if (opt.start_date === bestOption.start_date) return 'rgba(16, 185, 129, 0.4)';
        return 'rgba(139, 92, 246, 0.4)';
    });
    
    const pointRadius = options.map(opt => {
        if (!opt.available) return 5;
        if (opt.start_date === bestOption.start_date) return 8;
        return 5;
    });

    const ctx = chartCanvas.getContext('2d');
    const chartGradient = ctx.createLinearGradient(0, 0, 0, 300);
    chartGradient.addColorStop(0, 'rgba(139, 92, 246, 0.35)');
    chartGradient.addColorStop(1, 'rgba(139, 92, 246, 0.00)');

    if (typeof Chart !== 'undefined') {
        costChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Total Itinerary Cost (₹)',
                    data: dataPoints,
                    borderColor: '#8b5cf6',
                    borderWidth: 3,
                    backgroundColor: chartGradient,
                    fill: true,
                    tension: 0.35,
                    spanGaps: false,
                    pointBackgroundColor: pointBackgroundColors,
                    pointBorderColor: pointBorderColors,
                    pointBorderWidth: 2,
                    pointRadius: pointRadius,
                    pointHoverRadius: 9,
                    pointHoverBackgroundColor: pointBackgroundColors,
                    pointHoverBorderColor: '#ffffff',
                    pointHoverBorderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
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
                                const option = options[index];
                                return `Start Date: ${formatDateString(option.start_date)}`;
                            },
                            label: function(context) {
                                const index = context.dataIndex;
                                const option = options[index];
                                if (!option.available) {
                                    return `⚠️ Status: Leg Sold Out / Unavailable`;
                                }
                                let label = `💰 Total Cost: ₹${option.total_cost}`;
                                if (option.start_date === bestOption.start_date) {
                                    label += ` (🏆 Best Value!)`;
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.04)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#6e677c',
                            font: { family: 'Inter', size: 11 }
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.04)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#6e677c',
                            font: { family: 'Inter', size: 11 },
                            callback: function(value) {
                                return '₹' + value;
                            }
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
                        } else {
                            alert("Note: This start date is unavailable because one or more transport legs are sold out on this day. Please select a purple or green node!");
                        }
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
            body: JSON.stringify({from_city, to_city, date, mode})
        });
        if (!response.ok) throw new Error("Failed to refresh leg");
        const data = await response.json();
        
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
