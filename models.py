from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict

class StopInput(BaseModel):
    city: str = Field(..., description="Name of the intermediate city")
    nights: int = Field(..., description="Number of nights to spend in this city", ge=0)
    transport: str = Field(..., description="Transport mode to reach this city (flight, train, bus)")

class OptimizeRequest(BaseModel):
    source: str = Field(..., description="Starting city")
    stops: List[StopInput] = Field(default_factory=list, description="Intermediate stops in order")
    destination: str = Field(..., description="Final destination city")
    destination_transport: str = Field(..., description="Transport mode from last stop to destination")
    start_date: str = Field(..., description="Base start date (YYYY-MM-DD)")
    force_refresh: bool = Field(False, description="Whether to bypass the cached data")

class LegDetail(BaseModel):
    from_city: str
    from_code: Optional[str] = None
    to_city: str
    to_code: Optional[str] = None
    date: str
    mode: str  # "flight", "train", "bus"
    cost: float
    duration: str
    etd: str
    eta: str
    available: bool = True
    transport_name: Optional[str] = None
    alternatives: List[Dict[str, Any]] = []
    data_source: str = "Dummy"
    cached_at: Optional[str] = None

class ItineraryOption(BaseModel):
    start_date: str
    total_cost: int
    legs: List[LegDetail]
    available: bool

class OptimizeResponse(BaseModel):
    best_option: Optional[ItineraryOption] = None
    all_options: List[ItineraryOption]
    average_cost: float
    savings: float
