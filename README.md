# VoyageOptima | Smart Multi-Stop Travel Route Date Optimizer

VoyageOptima is a premium, high-performance web application designed to find the absolute cheapest starting date for multi-leg journeys. By modeling dynamic ticket fares, weekly fluctuations, stay-lengths, and transportation modes, it scans a 1-week calendar window to identify the optimal cost valley for your trip.

---

## 🌟 Key Features

* **1-Week Itinerary Optimization Scan**: Scans departure dates over a 7-day window to calculate the cheapest starting date, maintaining your exact length of stay at each stop.
* **Interactive Date Selector Strip**: A horizontal calendar strip synchronized with a **Chart.js Cost Trend line chart**. Clicking any date card instantly renders the corresponding itinerary timeline.
* **100% Real Flight Data**: Integrated with the **RapidAPI Fly-Scraper** endpoint for real-time economy flight prices (in INR) with exact-date caching and zero mock/dummy fallback data for flights.
* **SOLID Architecture Backend**: Extensively refactored travel transport engine using clean Object-Oriented SOLID design principles (Providers, Factory, and Single-Responsibility components).
* **Rich Alternatives Table**: Displays alternative carrier options with stop counts (e.g. *Non-stop*, *1 stop*) and total duration for each travel leg in a sleek glassmorphic table.
* **Fast Autocomplete Engine**: Instant autocomplete lookups for Indian cities, displaying nearby airports (IATA codes) and railway stations dynamically as you type.

---

## 📂 Project Structure

```text
TravelApp/
│
├── main.py                 # FastAPI web server and routing endpoints
├── optimizer.py            # Optimization algorithm scanning the departure calendar
├── flight_api.py           # SOLID transport providers, factory, and API caching layer
├── cities_db.py            # Static Indian cities coordinate & details database
├── models.py               # Pydantic schemas for API request/response validation
├── .gitignore              # Ignores local pycaches, virtualenvs, and log files
│
└── static/                 # Frontend UI Assets
    ├── index.html          # Dashboard HTML structure
    ├── style.css           # Premium dark-mode glassmorphic styling
    └── app.js              # Chart, autocomplete, and interactive timeline controller
```

---

## 🚀 How to Install and Run

### Prerequisites
* Python 3.8 or higher installed on your system.

### 1. Clone & Set Up Directory
Open your terminal inside the project directory:

```bash
# 1. Create a virtual environment
python -m venv venv

# 2. Activate virtual environment
# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# On Mac/Linux:
source venv/bin/activate
```

### 2. Install Dependencies
Install the required packages using pip:
```bash
pip install fastapi uvicorn requests pydantic
```

### 3. Configure RapidAPI Key (Optional)
The application uses a default RapidAPI key, but you can set your own key as an environment variable to prevent rate limiting:

```bash
# On Windows (PowerShell):
$env:RAPIDAPI_KEY="your_actual_rapidapi_key"

# On Mac/Linux:
export RAPIDAPI_KEY="your_actual_rapidapi_key"
```

### 4. Run the Application
Launch the Uvicorn web server with hot-reload enabled:
```bash
uvicorn main:app --port 8000 --reload
```

Once running, navigate to **[http://127.0.0.1:8000](http://127.0.0.1:8000)** in your web browser to access the VoyageOptima dashboard!

---

## 📋 Production Launch TODOs

Before deploying VoyageOptima as a live consumer product, the following milestones must be completed:

* **🗄️ Database Migration**: Replace the static `cities_db.py` coordinates and the transient in-memory Python dictionaries with a persistent database system (e.g., PostgreSQL) using Redis to cache frequent search queries.
* **🚆 Live Train API Integration**: Replace the distance-based train pricing estimates with actual Indian Railways API endpoints (e.g., IRCTC partner channels) to query real seat inventory and fare structures.
* **🚌 Live Bus API Integration**: Integrate RedBus or AbhiBus partner APIs to query actual tickets, timetables, and availability for inter-city buses.
* **🔐 Login & Authentication**: Implement secure JWT/OAuth2 user registration, login systems, session controls, and profile tables for travelers to save itineraries.
* **💳 Payment Gateway**: Add credit card, UPI, and net banking support (e.g., Stripe, Razorpay) to complete ticket booking checkout directly in the application.
* **✈️ Flight API Upgrades**: Transition from sandboxed fly-scraper credentials to high-rate enterprise GDS portals (e.g., Amadeus, Sabre, or Skyscanner partner APIs) to support direct flight reservations.
