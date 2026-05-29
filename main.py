from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from models import OptimizeRequest, OptimizeResponse
import optimizer
import cities_db
import os
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
import flight_api

app = FastAPI(
    title="VoyageOptima API",
    description="Backend API for travel route date optimization",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RefreshLegRequest(BaseModel):
    from_city: str
    to_city: str
    date: str
    mode: str
    selected_class: Optional[str] = None
    force_refresh: Optional[bool] = False

@app.post("/api/optimize", response_model=OptimizeResponse)
def optimize_travel_route(request: OptimizeRequest):
    try:
        response = optimizer.optimize_route(request)
        return response
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/refresh-leg")
def api_refresh_leg(req: RefreshLegRequest):
    try:
        travel_date = datetime.fromisoformat(req.date.replace("Z", "")).date()
        details = flight_api.get_travel_details(
            from_city=req.from_city,
            to_city=req.to_city,
            travel_date=travel_date,
            mode=req.mode,
            force_refresh=req.force_refresh if req.force_refresh is not None else False,
            selected_class=req.selected_class
        )
        return {
            "cost": details["cost"],
            "transport_name": details["transport_name"],
            "alternatives": details["alternatives"],
            "data_source": details["data_source"],
            "cached_at": details["cached_at"],
            "duration": details["duration"],
            "etd": details["etd"],
            "eta": details["eta"],
            "selected_class": details.get("selected_class"),
            "flight_api_calls": flight_api.FLIGHT_API_CALLS,
            "train_api_calls": flight_api.TRAIN_API_CALLS
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/stats")
def get_api_stats():
    return {
        "flight_api_calls": flight_api.FLIGHT_API_CALLS,
        "train_api_calls": flight_api.TRAIN_API_CALLS
    }

@app.get("/api/cities/search")
def search_cities(q: str = Query("", min_length=0), limit: int = 10):
    """Search Indian cities by name prefix for autocomplete."""
    if not q:
        return {"results": cities_db.get_city_list()[:limit]}
    results = cities_db.search_cities(q, limit=limit)
    return {"results": results}


@app.get("/api/cities/{city_name}")
def get_city_details(city_name: str):
    """Get full details for a specific city including airports and railway stations."""
    city = cities_db.get_city_by_name(city_name)
    if not city:
        raise HTTPException(status_code=404, detail=f"City '{city_name}' not found in database.")
    return city

# Get absolute path to the static folder
current_dir = os.path.dirname(os.path.abspath(__file__))
static_dir = os.path.join(current_dir, "static")

# Proactively ensure the static folder exists
if not os.path.exists(static_dir):
    os.makedirs(static_dir)

# Mount static files under /static prefix
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Serve index.html at root
@app.get("/")
def get_index():
    index_path = os.path.join(static_dir, "index.html")
    if not os.path.exists(index_path):
        # Return a temporary simple HTML if index.html is not created yet
        return {"message": "VoyageOptima API is running. Frontend static index.html is being created."}
    return FileResponse(index_path)
