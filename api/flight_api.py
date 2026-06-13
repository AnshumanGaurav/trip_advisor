import os
import requests
import math
import hashlib
import logging
import json
from abc import ABC, abstractmethod
from datetime import date, datetime
from typing import Dict, Any, Tuple, List, Optional
import cities_db

logger = logging.getLogger(__name__)

# Load .env file manually since python-dotenv is not installed
def _load_dotenv():
    # Try looking in multiple locations relative to current script / workdir
    for path in [".env", "../.env", "api/.env"]:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            parts = line.split("=", 1)
                            key = parts[0].strip()
                            val = parts[1].strip().strip("'\"")
                            os.environ[key] = val
                break
            except Exception:
                pass

_load_dotenv()
RAPIDAPI_KEY = os.environ.get("RAPIDAPI_KEY", "")
RAPIDAPI_HOST = "fly-scraper.p.rapidapi.com"

# Initialize Supabase client
from supabase import create_client, Client
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

_SUPABASE_CLIENT: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        _SUPABASE_CLIENT = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info("Supabase client initialized successfully.")
    except Exception as e:
        logger.error(f"Error initializing Supabase client: {e}")
else:
    logger.warning("Supabase credentials missing from environment variables.")

FLIGHT_API_CALLS = 0
TRAIN_API_CALLS = 0

# Cache for airport entity IDs: { "City Name": {"skyId": "...", "entityId": "..."} }
_AIRPORT_CACHE: Dict[str, Dict[str, str]] = {
    'delhi': {'skyId': 'DEL', 'entityId': ''}, 'mumbai': {'skyId': 'BOM', 'entityId': ''},
    'bangalore': {'skyId': 'BLR', 'entityId': ''}, 'bengaluru': {'skyId': 'BLR', 'entityId': ''},
    'udaipur': {'skyId': 'UDR', 'entityId': ''}, 'jaipur': {'skyId': 'JAI', 'entityId': ''},
    'ranchi': {'skyId': 'IXR', 'entityId': ''}, 'goa': {'skyId': 'GOI', 'entityId': ''},
    'chennai': {'skyId': 'MAA', 'entityId': ''}, 'hyderabad': {'skyId': 'HYD', 'entityId': ''},
    'kolkata': {'skyId': 'CCU', 'entityId': ''}, 'pune': {'skyId': 'PNQ', 'entityId': ''},
    'ahmedabad': {'skyId': 'AMD', 'entityId': ''}, 'kochi': {'skyId': 'COK', 'entityId': ''},
    'lucknow': {'skyId': 'LKO', 'entityId': ''}, 'guwahati': {'skyId': 'GAU', 'entityId': ''},
    'thiruvananthapuram': {'skyId': 'TRV', 'entityId': ''}, 'bhubaneswar': {'skyId': 'BBI', 'entityId': ''},
    'patna': {'skyId': 'PAT', 'entityId': ''}, 'indore': {'skyId': 'IDR', 'entityId': ''},
    'nagpur': {'skyId': 'NAG', 'entityId': ''}, 'chandigarh': {'skyId': 'IXC', 'entityId': ''},
    'srinagar': {'skyId': 'SXR', 'entityId': ''}, 'varanasi': {'skyId': 'VNS', 'entityId': ''},
    'amritsar': {'skyId': 'ATQ', 'entityId': ''}, 'surat': {'skyId': 'STV', 'entityId': ''},
    'vadodara': {'skyId': 'BDQ', 'entityId': ''}, 'coimbatore': {'skyId': 'CJB', 'entityId': ''},
    'madurai': {'skyId': 'IXM', 'entityId': ''}, 'tiruchirappalli': {'skyId': 'TRZ', 'entityId': ''},
    'visakhapatnam': {'skyId': 'VTZ', 'entityId': ''}, 'vijayawada': {'skyId': 'VGA', 'entityId': ''},
    'trivandrum': {'skyId': 'TRV', 'entityId': ''}, 'london': {'skyId': 'LHR', 'entityId': ''},
    'new york': {'skyId': 'JFK', 'entityId': ''}, 'paris': {'skyId': 'CDG', 'entityId': ''},
    'tokyo': {'skyId': 'HND', 'entityId': ''}, 'dubai': {'skyId': 'DXB', 'entityId': ''},
    'singapore': {'skyId': 'SIN', 'entityId': ''}, 'sydney': {'skyId': 'SYD', 'entityId': ''},
    'hong kong': {'skyId': 'HKG', 'entityId': ''}, 'toronto': {'skyId': 'YYZ', 'entityId': ''},
    'los angeles': {'skyId': 'LAX', 'entityId': ''}, 'san francisco': {'skyId': 'SFO', 'entityId': ''},
    'chicago': {'skyId': 'ORD', 'entityId': ''}, 'frankfurt': {'skyId': 'FRA', 'entityId': ''},
    'amsterdam': {'skyId': 'AMS', 'entityId': ''}, 'bangkok': {'skyId': 'BKK', 'entityId': ''},
    'seoul': {'skyId': 'ICN', 'entityId': ''}, 'kuala lumpur': {'skyId': 'KUL', 'entityId': ''}
}

# Cache for route prices is now persisted dynamically in flight_cache.json


# =====================================================================
# 1. Single Responsibility: Distance Computation
# =====================================================================

class DistanceCalculator:
    """
    Computes geodetic distance between cities using the Haversine formula.
    Fulfills the Single Responsibility Principle (SRP).
    """
    @staticmethod
    def get_coords(city_name: str) -> Tuple[float, float]:
        """Resolve coordinates for a city, falling back to a deterministic hash for unknown cities."""
        city_key = city_name.lower().strip()
        c = cities_db.INDIAN_CITIES.get(city_key)
        if c:
            return tuple(c["coords"])
        
        # Fallback hash-based lat/lon generation for mock evaluation on unknown cities
        h = hashlib.md5(city_key.encode('utf-8')).hexdigest()
        lat = -60.0 + (int(h[0:8], 16) % 1200000) / 10000.0
        lon = -180.0 + (int(h[8:16], 16) % 3600000) / 10000.0
        return lat, lon

    @classmethod
    def calculate_distance(cls, from_city: str, to_city: str) -> float:
        """Calculate direct distance in kilometers between two cities using Haversine formula."""
        lat1, lon1 = cls.get_coords(from_city)
        lat2, lon2 = cls.get_coords(to_city)
        
        R = 6371.0  # Earth radius in kilometers
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        
        a = (math.sin(dlat / 2) ** 2 + 
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return max(R * c, 50.0)


# =====================================================================
# 2. Interfaces & Abstractions (OCP & LSP)
# =====================================================================

class TransportProvider(ABC):
    """
    Abstract base class representing a transport provider.
    Fulfills Open/Closed and Liskov Substitution Principles.
    """
    @abstractmethod
    def get_details(
        self,
        from_city: str,
        to_city: str,
        from_code: str,
        to_code: str,
        travel_date: date,
        distance_km: float,
        force_refresh: bool = False,
        selected_class: Optional[str] = None
    ) -> Dict[str, Any]:
        """Fetch transport details including carrier, price, duration, and alternatives."""
        pass


# =====================================================================
# 3. Concrete Providers (SRP & OCP)
# =====================================================================

class FlightTransportProvider(TransportProvider):
    """
    Fulfills SRP for flight-specific travel details including API fetching and persistent caching.
    """
    def __init__(self, api_key: str, api_host: str):
        self.api_key = api_key
        self.api_host = api_host
        self._airport_cache = _AIRPORT_CACHE
        self.cache_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "flight_cache.json")
        self._route_cache = {}
        
        # Load persistent disk cache for flights
        if os.path.exists(self.cache_file):
            try:
                with open(self.cache_file, "r", encoding="utf-8") as f:
                    self._route_cache = json.load(f)
            except Exception as e:
                logger.error(f"Error loading flight cache file: {e}")

    def _save_cache(self):
        try:
            with open(self.cache_file, "w", encoding="utf-8") as f:
                json.dump(self._route_cache, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving flight cache file: {e}")

    def get_airport_info(self, city: str) -> Dict[str, str]:
        """Look up airport info statically to completely avoid rate limiting and speed up queries."""
        city = city.lower().strip()
        if city in self._airport_cache:
            return self._airport_cache[city]
        return {"skyId": city[:3].upper(), "entityId": ""}

    def get_details(
        self,
        from_city: str,
        to_city: str,
        from_code: str,
        to_code: str,
        travel_date: date,
        distance_km: float,
        force_refresh: bool = False,
        selected_class: Optional[str] = None
    ) -> Dict[str, Any]:
        # Normalize selected_class to standard Skyscanner cabinClass query params
        cabin_class = "economy"
        if selected_class:
            sc_lower = selected_class.lower().strip()
            if "premium" in sc_lower:
                cabin_class = "premium_economy"
            elif "business" in sc_lower:
                cabin_class = "business"
            elif "first" in sc_lower:
                cabin_class = "first"

        date_str = travel_date.strftime("%Y-%m-%d")
        cache_key = f"{from_city.lower().strip()}_{to_city.lower().strip()}_{date_str}_{cabin_class}"
        
        # 1. Exact Cache match
        entry = None
        if not force_refresh:
            if _SUPABASE_CLIENT:
                try:
                    res = _SUPABASE_CLIENT.table("flight_cache").select("*").eq("key", cache_key).execute()
                    if res.data:
                        entry = res.data[0]
                except Exception as e:
                    logger.error(f"Error querying flight_cache from Supabase: {e}")
            
            if entry is None and cache_key in self._route_cache:
                entry = self._route_cache[cache_key]

        if entry:
            price = entry["price"]
            name = entry["flight_name"]
            alts = entry["alternatives"]
            cached_time = entry["cached_at"]
            dur = entry["duration"]
            etd = entry["etd"]
            eta = entry["eta"]
            
            return self._build_payload(
                from_city, from_code, to_city, to_code, date_str, "flight",
                math.ceil(price), dur, etd, eta, True, name, alts, "Cached", cached_time,
                cabin_class
            )

        from_info = self.get_airport_info(from_city)
        to_info = self.get_airport_info(to_city)

        if not from_info.get("skyId") or not to_info.get("skyId"):
            return self._build_unavailable_payload(from_city, from_code, to_city, to_code, date_str, "flight", cabin_class)

        url = f"https://{self.api_host}/flights/search-one-way"
        querystring = {
            "originSkyId": from_info["skyId"],
            "destinationSkyId": to_info["skyId"],
            "departureDate": date_str,
            "cabinClass": cabin_class,
            "adults": "1",
            "currency": "INR",
            "market": "IN",
            "countryCode": "IN"
        }
        
        headers = {
            "x-rapidapi-key": self.api_key,
            "x-rapidapi-host": self.api_host
        }

        try:
            global FLIGHT_API_CALLS
            FLIGHT_API_CALLS += 1
            res = requests.get(url, headers=headers, params=querystring, timeout=8.0)
            res.raise_for_status()
            data = res.json()
            
            itineraries = data.get('data', {}).get('itineraries', [])
            if itineraries:
                # Sort itineraries strictly by price ascending
                itineraries = sorted([it for it in itineraries if it.get('price', {}).get('raw', -1.0) > 0], key=lambda x: x['price']['raw'])
                alternatives = []
                for it in itineraries[:8]:  # Get up to 8 alternatives
                    try:
                        alt_price = it.get('price', {}).get('raw', -1.0)
                        leg = it['legs'][0]
                        seg = leg['segments'][0]
                        alt_carrier = seg.get('operatingCarrier', {}).get('name') or seg.get('marketingCarrier', {}).get('name') or "Airline"
                        alt_fnum = seg.get('flightNumber', '')
                        alt_name = f"{alt_carrier} {alt_fnum}".strip()
                        
                        dur_mins = leg.get('durationInMinutes', 0)
                        dur_str = f"{dur_mins // 60}h {dur_mins % 60}m" if dur_mins else "N/A"
                        stops = leg.get('stopCount', 0)
                        
                        dep = leg.get('departure')
                        arr = leg.get('arrival')
                        alt_etd = ""
                        alt_eta = ""
                        if dep:
                            alt_etd = datetime.fromisoformat(dep).strftime("%I:%M %p")
                        if arr:
                            alt_eta = datetime.fromisoformat(arr).strftime("%I:%M %p")
                        
                        if alt_price > 0:
                            alternatives.append({
                                "price": math.ceil(alt_price),
                                "transport_name": alt_name,
                                "duration": dur_str,
                                "stops": stops,
                                "etd": alt_etd,
                                "eta": alt_eta
                            })
                    except Exception:
                        pass

                first = itineraries[0]
                price = first.get('price', {}).get('raw', -1.0)
                flight_name = alternatives[0]["transport_name"] if alternatives else "Flight"
                
                duration_str = ""
                etd = ""
                eta = ""
                try:
                    leg = first.get('legs', [{}])[0]
                    dur_mins = leg.get('durationInMinutes', 0)
                    if dur_mins:
                        duration_str = f"{dur_mins // 60}h {dur_mins % 60}m"
                    
                    dep = leg.get('departure')
                    arr = leg.get('arrival')
                    if dep:
                        etd = datetime.fromisoformat(dep).strftime("%I:%M %p")
                    if arr:
                        eta = datetime.fromisoformat(arr).strftime("%I:%M %p")
                except Exception:
                    pass
                    
                if price > 0:
                    cached_time = datetime.now().isoformat()
                    
                    # Store in Supabase
                    if _SUPABASE_CLIENT:
                        try:
                            _SUPABASE_CLIENT.table("flight_cache").upsert({
                                "key": cache_key,
                                "price": float(price),
                                "flight_name": flight_name,
                                "alternatives": alternatives,
                                "duration": duration_str or "2h 30m",
                                "etd": etd or "10:00 AM",
                                "eta": eta or "12:30 PM",
                                "cached_at": cached_time
                            }).execute()
                        except Exception as e:
                            logger.error(f"Error saving flight cache to Supabase: {e}")

                    # Store in persistent route cache
                    self._route_cache[cache_key] = {
                        "price": price,
                        "flight_name": flight_name,
                        "alternatives": alternatives,
                        "cached_at": cached_time,
                        "duration": duration_str or "2h 30m",
                        "etd": etd or "10:00 AM",
                        "eta": eta or "12:30 PM"
                    }
                    self._save_cache()
                    
                    return self._build_payload(
                        from_city, from_code, to_city, to_code, date_str, "flight",
                        math.ceil(price), duration_str or "2h 30m", etd or "10:00 AM", eta or "12:30 PM",
                        True, flight_name, alternatives, "Fresh", cached_time,
                        cabin_class
                    )
            else:
                # Genuinely no flights found for this query in the API response
                return self._build_unavailable_payload(from_city, from_code, to_city, to_code, date_str, "flight", cabin_class)
        except Exception as e:
            error_msg = f"Flight API request failed for {from_city} -> {to_city} on {date_str}. Reason: {str(e)}. Please check your internet connection or RapidAPI key and try again."
            logger.error(error_msg)
            raise RuntimeError(error_msg)


    def _build_payload(self, from_c, from_code, to_c, to_code, date_s, mode, cost, dur, etd, eta, avail, name, alts, src, cached, selected_class=None):
        return {
            "from_city": from_c, "from_code": from_code,
            "to_city": to_c, "to_code": to_code,
            "date": date_s, "mode": mode, "cost": cost,
            "duration": dur, "etd": etd, "eta": eta,
            "available": avail, "transport_name": name,
            "alternatives": alts, "data_source": src, "cached_at": cached,
            "selected_class": selected_class
        }

    def _build_unavailable_payload(self, from_c, from_code, to_c, to_code, date_s, mode, selected_class=None):
        return {
            "from_city": from_c, "from_code": from_code,
            "to_city": to_c, "to_code": to_code,
            "date": date_s, "mode": mode, "cost": 0,
            "duration": "N/A", "etd": "N/A", "eta": "N/A",
            "available": False, "transport_name": "No Flight Available",
            "alternatives": [], "data_source": "None", "cached_at": "",
            "selected_class": selected_class
        }



class TrainTransportProvider(TransportProvider):
    """
    Fulfills SRP for train-specific travel details including live API fetching and persistent caching.
    """
    def __init__(self, api_key: str = RAPIDAPI_KEY, api_host: str = "irctc-api2.p.rapidapi.com"):
        self.api_key = api_key
        self.api_host = api_host
        self.cache_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "irctc_cache.json")
        self.fallback_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "irctc_data.json")
        self._cache = {}
        
        # Load persistent disk cache
        if os.path.exists(self.cache_file):
            try:
                with open(self.cache_file, "r", encoding="utf-8") as f:
                    self._cache = json.load(f)
            except Exception as e:
                logger.error(f"Error loading train cache file: {e}")

    def _save_cache(self):
        try:
            with open(self.cache_file, "w", encoding="utf-8") as f:
                json.dump(self._cache, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving train cache file: {e}")

    def _get_fallback_data(self) -> dict:
        if os.path.exists(self.fallback_file):
            try:
                with open(self.fallback_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error loading train fallback file: {e}")
        return {"success": True, "data": []}

    def get_details(
        self,
        from_city: str,
        to_city: str,
        from_code: str,
        to_code: str,
        travel_date: date,
        distance_km: float,
        force_refresh: bool = False,
        selected_class: Optional[str] = None
    ) -> Dict[str, Any]:
        # Standardize station codes
        src_code = from_code.upper().strip() if from_code and from_code != "N/A" else "NDLS"
        dst_code = to_code.upper().strip() if to_code and to_code != "N/A" else "GKP"
        
        # RapidAPI IRCTC expects date in DD-MM-YYYY format
        date_query_str = travel_date.strftime("%d-%m-%Y")
        
        # Cache key based on source, destination and date
        cache_key = f"{src_code}_{dst_code}_{date_query_str}"
        
        is_cached = False
        cached_at = ""
        train_data = None

        # 1. Look in Cache
        cache_entry = None
        if not force_refresh:
            if _SUPABASE_CLIENT:
                try:
                    res = _SUPABASE_CLIENT.table("train_cache").select("*").eq("key", cache_key).execute()
                    if res.data:
                        cache_entry = res.data[0]
                except Exception as e:
                    logger.error(f"Error querying train_cache from Supabase: {e}")
            
            if cache_entry is None and cache_key in self._cache:
                cache_entry = self._cache[cache_key]

        if cache_entry:
            train_data = cache_entry.get("data")
            cached_at = cache_entry.get("cached_at", "")
            is_cached = True

        # 2. Invoke live RapidAPI if not cached
        if train_data is None:
            url = f"https://{self.api_host}/trainAvailability"
            querystring = {
                "source": src_code,
                "destination": dst_code,
                "date": date_query_str
            }
            headers = {
                "x-rapidapi-key": self.api_key,
                "x-rapidapi-host": self.api_host
            }
            try:
                global TRAIN_API_CALLS
                TRAIN_API_CALLS += 1
                logger.info(f"Fetching real IRCTC live data: {src_code} -> {dst_code} on {date_query_str}")
                res = requests.get(url, headers=headers, params=querystring, timeout=15)
                res.raise_for_status()
                res_json = res.json()
                
                if res_json.get("success") and res_json.get("data"):
                    train_data = res_json.get("data")
                    cached_at = datetime.now().isoformat()
                    
                    # Store in Supabase
                    if _SUPABASE_CLIENT:
                        try:
                            _SUPABASE_CLIENT.table("train_cache").upsert({
                                "key": cache_key,
                                "data": train_data,
                                "cached_at": cached_at
                            }).execute()
                        except Exception as e:
                            logger.error(f"Error saving train cache to Supabase: {e}")

                    # Store in cache
                    self._cache[cache_key] = {
                        "data": train_data,
                        "cached_at": cached_at
                    }
                    self._save_cache()
                    is_cached = False
                else:
                    logger.warning(f"IRCTC API returned unsuccessful status for {cache_key}: {res_json}")
            except Exception as e:
                error_msg = f"Train API request failed for {from_city} ({src_code}) -> {to_city} ({dst_code}) on {date_query_str}. Reason: {str(e)}. Please check your internet connection or RapidAPI key and try again."
                logger.error(error_msg)
                raise RuntimeError(error_msg)

        # 3. Fallback to mock data if live API fails and cache is empty (NO FALLBACK ALLOWED per user guidelines!)
        if train_data is None:
            error_msg = f"Train API request failed for {from_city} ({src_code}) -> {to_city} ({dst_code}) on {date_query_str}. Reason: Unsuccessful API status returned. Please check your RapidAPI key and try again."
            logger.error(error_msg)
            raise RuntimeError(error_msg)

        # 4. Parse the train availability data
        if not train_data:
            return {
                "from_city": from_city, "from_code": src_code,
                "to_city": to_city, "to_code": dst_code,
                "date": travel_date.strftime("%Y-%m-%d"), "mode": "train", "cost": 0,
                "duration": "N/A", "etd": "N/A", "eta": "N/A",
                "available": False, "transport_name": "No Train Available",
                "alternatives": [], "data_source": "None", "cached_at": ""
            }

        # Serialize train alternatives
        alternatives = []
        for t in train_data:
            class_availabilities = []
            for ca in t.get("classAvailability", []):
                class_availabilities.append({
                    "class": ca.get("class"),
                    "availability": ca.get("availability") or "",
                    "fare": float(ca.get("fare") or 0),
                    "prediction": ca.get("prediction"),
                    "displayStatus": ca.get("displayStatus"),
                    "predictionPercent": ca.get("predictionPercent"),
                    "quota": ca.get("quota")
                })
                
            alternatives.append({
                "trainNumber": t.get("trainNumber"),
                "trainName": t.get("trainName"),
                "from_code": t.get("from", {}).get("code"),
                "from_name": t.get("from", {}).get("name"),
                "to_code": t.get("to", {}).get("code"),
                "to_name": t.get("to", {}).get("name"),
                "departure": t.get("departure"),
                "arrival": t.get("arrival"),
                "duration": t.get("duration"),
                "distanceKm": t.get("distanceKm"),
                "pantry": t.get("pantry", "No"),
                "rating": t.get("rating", 3.5),
                "runningDays": t.get("runningDays"),
                "allClasses": t.get("allClasses", []),
                "classAvailability": class_availabilities
            })

        # Find the cheapest train for standard class "SL" (Sleeper) first
        cheapest_train = None
        cheapest_fare = float('inf')
        cheapest_class = "SL"

        for alt in alternatives:
            for ca in alt["classAvailability"]:
                if ca["class"] == "SL" and "CANCELLED" not in ca["availability"] and "REGRET" not in ca["availability"] and ca["fare"] < cheapest_fare:
                    cheapest_fare = ca["fare"]
                    cheapest_train = alt
                    cheapest_class = "SL"

        # If no SL is available, find the absolute cheapest overall
        if cheapest_train is None:
            for alt in alternatives:
                for ca in alt["classAvailability"]:
                    if "CANCELLED" not in ca["availability"] and "REGRET" not in ca["availability"] and ca["fare"] < cheapest_fare:
                        cheapest_fare = ca["fare"]
                        cheapest_train = alt
                        cheapest_class = ca["class"]

        # Default fallback to first train and first class if all are cancelled/sold-out
        if cheapest_train is None and alternatives:
            cheapest_train = alternatives[0]
            cheapest_class = cheapest_train["classAvailability"][0]["class"] if cheapest_train["classAvailability"] else "SL"
            cheapest_fare = float(cheapest_train["classAvailability"][0]["fare"]) if cheapest_train["classAvailability"] else 400

        if not cheapest_train:
            return {
                "from_city": from_city, "from_code": src_code,
                "to_city": to_city, "to_code": dst_code,
                "date": travel_date.strftime("%Y-%m-%d"), "mode": "train", "cost": 0,
                "duration": "N/A", "etd": "N/A", "eta": "N/A",
                "available": False, "transport_name": "No Train Available",
                "alternatives": [], "data_source": "None", "cached_at": ""
            }

        return {
            "from_city": from_city, "from_code": src_code,
            "to_city": to_city, "to_code": dst_code,
            "date": travel_date.strftime("%Y-%m-%d"),
            "mode": "train",
            "cost": math.ceil(cheapest_fare),
            "duration": cheapest_train["duration"],
            "etd": cheapest_train["departure"],
            "eta": cheapest_train["arrival"],
            "available": True,
            "transport_name": f"{cheapest_train['trainNumber']} - {cheapest_train['trainName']} ({cheapest_class})",
            "alternatives": alternatives,
            "data_source": "Cached" if is_cached else "Fresh",
            "cached_at": cached_at,
            "selected_class": cheapest_class
        }


class BusTransportProvider(TransportProvider):
    """
    Fulfills SRP for bus-specific travel calculations.
    100% clean and deterministic distance-based algorithm.
    """
    def get_details(
        self,
        from_city: str,
        to_city: str,
        from_code: str,
        to_code: str,
        travel_date: date,
        distance_km: float,
        force_refresh: bool = False,
        selected_class: Optional[str] = None
    ) -> Dict[str, Any]:
        # Bus pricing: 300 fixed booking fee + 1.8 INR per km
        cost = math.ceil(300 + distance_km * 1.8)
        # Bus duration estimation based on 50 km/h average speed
        dur_mins = int((distance_km / 50.0) * 60)
        duration = f"{dur_mins // 60}h {dur_mins % 60}m"
        date_str = travel_date.strftime("%Y-%m-%d")
        
        alternatives = [
            {"price": cost, "transport_name": "Volvo A/C Sleeper", "duration": duration, "stops": 1, "etd": "10:00 PM", "eta": "04:00 AM"},
            {"price": math.ceil(cost * 0.8), "transport_name": "Standard Express", "duration": f"{int(dur_mins * 1.15) // 60}h {int(dur_mins * 1.15) % 60}m", "stops": 3, "etd": "08:30 PM", "eta": "03:30 AM"}
        ]
        
        return {
            "from_city": from_city, "from_code": from_code,
            "to_city": to_city, "to_code": to_code,
            "date": date_str, "mode": "bus", "cost": cost,
            "duration": duration, "etd": "10:00 PM", "eta": "04:00 AM",
            "available": True, "transport_name": "Volvo A/C Sleeper",
            "alternatives": alternatives, "data_source": "Cached", "cached_at": ""
        }


# =====================================================================
# 4. Provider Factory (OCP & DIP)
# =====================================================================

class TransportProviderFactory:
    """
    Factory to resolve transport providers dynamically.
    Fulfills DIP and supports easy extensibility to new modes.
    """
    def __init__(self, flight_provider: TransportProvider, train_provider: TransportProvider, bus_provider: TransportProvider):
        self._providers = {
            "flight": flight_provider,
            "train": train_provider,
            "bus": bus_provider
        }

    def get_provider(self, mode: str) -> TransportProvider:
        """Resolve the concrete provider instance matching the mode."""
        mode_lower = mode.lower().strip()
        provider = self._providers.get(mode_lower)
        if not provider:
            raise ValueError(f"Unsupported transport mode: '{mode}'")
        return provider


# =====================================================================
# 5. Global Setup, Instantiations & Facade Functions
# =====================================================================

_FLIGHT_PROVIDER = FlightTransportProvider(api_key=RAPIDAPI_KEY, api_host=RAPIDAPI_HOST)
_TRAIN_PROVIDER = TrainTransportProvider()
_BUS_PROVIDER = BusTransportProvider()
_PROVIDER_FACTORY = TransportProviderFactory(_FLIGHT_PROVIDER, _TRAIN_PROVIDER, _BUS_PROVIDER)


def get_travel_details(from_city: str, to_city: str, travel_date: date, mode: str, force_refresh: bool = False, selected_class: Optional[str] = None) -> Dict[str, Any]:
    """
    High-level facade orchestrating coordinates, distance calculations,
    and provider delegation. Respects Dependency Inversion and SOLID principles.
    """
    from_city = from_city.strip().capitalize()
    to_city = to_city.strip().capitalize()
    mode = mode.lower().strip()
    
    # Compute route distance via SRP calculator
    distance = DistanceCalculator.calculate_distance(from_city, to_city)
    
    # Resolve station and airport codes from static database
    from_code = "N/A"
    to_code = "N/A"
    c_from = cities_db.INDIAN_CITIES.get(from_city.lower())
    if c_from:
        from_code = (c_from["airports"][0]["code"] if mode == "flight" and c_from["airports"] 
                     else c_from["railway_stations"][0]["code"] if c_from["railway_stations"] else "N/A")
                     
    c_to = cities_db.INDIAN_CITIES.get(to_city.lower())
    if c_to:
        to_code = (c_to["airports"][0]["code"] if mode == "flight" and c_to["airports"] 
                   else c_to["railway_stations"][0]["code"] if c_to["railway_stations"] else "N/A")
        
    # Delegate to factory-resolved provider (DIP)
    provider = _PROVIDER_FACTORY.get_provider(mode)
    return provider.get_details(from_city, to_city, from_code, to_code, travel_date, distance, force_refresh, selected_class)


def get_real_flight_price(from_city: str, to_city: str, travel_date: date, force_refresh: bool = False) -> Tuple[float, str, list, str, str, str, str, str]:
    """
    Legacy/Backwards-compatible bridge function wrapping our SOLID Flight provider.
    Returns: Tuple (price, flight_name, alternatives, source_type, cached_at_time, duration, etd, eta)
    """
    details = _FLIGHT_PROVIDER.get_details(
        from_city=from_city,
        to_city=to_city,
        from_code="N/A",
        to_code="N/A",
        travel_date=travel_date,
        distance_km=0.0,
        force_refresh=force_refresh
    )
    
    price = float(details["cost"]) if details["available"] else -1.0
    return (
        price,
        details["transport_name"],
        details["alternatives"],
        details["data_source"],
        details["cached_at"],
        details["duration"],
        details["etd"],
        details["eta"]
    )
