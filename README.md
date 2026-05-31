# VoyageOptima | Smart Multi-Stop Travel Route Date Optimizer

VoyageOptima is a premium, high-performance web application designed to find the absolute cheapest starting date for multi-leg journeys. By modeling dynamic ticket fares, weekly fluctuations, stay-lengths, and transportation modes, it scans a 1-week calendar window to identify the optimal cost valley for your trip.

This repository is built as a hybrid **Next.js App Router (React)** frontend paired with a serverless **FastAPI (Python)** backend, prepared for zero-configuration deployment to **Vercel**!

---

## 📂 Project Structure

```text
TravelApp/
│
├── api/                     # Python Serverless Backend
│   ├── index.py             # Entry point (FastAPI server)
│   ├── optimizer.py         # Optimization scan algorithm
│   ├── cities_db.py         # Indian cities lookup coordinate database
│   ├── flight_api.py        # SOLID transport providers, caching layer
│   ├── models.py            # Pydantic schemas for API request/response
│   └── *.json               # Caching databases
│
├── src/                     # React Frontend (Next.js App Router)
│   ├── app/
│   │   ├── layout.js        # Optimized font loading & metadata
│   │   ├── globals.css      # Premium dark-mode glassmorphic CSS styling
│   │   └── page.js          # Unified React Dashboard & UI Controller
│   └── components/
│       └── Autocomplete.js  # Debounced React Autocomplete city input
│
├── package.json             # Next.js & React dependencies
├── next.config.js           # Local API rewrite proxy rule
├── vercel.json              # Vercel backend routing configuration
└── requirements.txt         # Python backend dependencies
```

---

## 🚀 Local Development Guide

To run this application locally, you will need **Python 3.8+** and **Node.js (LTS)** installed.

### 1. Set Up Python Backend

Open a terminal inside the project directory:

```bash
# 1. Create a virtual environment
python -m venv venv

# 2. Activate virtual environment
# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# On Mac/Linux:
source venv/bin/activate

# 3. Install backend dependencies
pip install -r requirements.txt

# 4. Start the FastAPI backend server
python -m uvicorn api.index:app --port 8000 --reload
```

The backend API will now be running at **[http://127.0.0.1:8000](http://127.0.0.1:8000)**.

### 2. Set Up Next.js Frontend

In a **separate** terminal window (with Node.js installed):

```bash
# 1. Install frontend dependencies
npm install

# 2. Start the Next.js development server
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** in your web browser to access the VoyageOptima dashboard! Next.js will automatically proxy all `/api` requests to the Python FastAPI backend running on port 8000.

---

## ☁️ Deploying to Vercel

Vercel provides native out-of-the-box support for Next.js and Python Serverless Functions in a single repository:

1. Push your project to a remote Git repository (**GitHub**, **GitLab**, or **Bitbucket**).
2. Connect your Vercel account to your Git provider.
3. Import this repository as a **New Project** on Vercel.
4. Click **Deploy**. Vercel will automatically detect both Next.js and the Python backend, install dependencies, configure routing according to `vercel.json`, and make your application live in seconds!
