import os
import requests
import math
import hashlib
import logging
from abc import ABC, abstractmethod
from datetime import date, datetime
from typing import Dict, Any, Tuple, List
import cities_db

logger = logging.getLogger(__name__)

RAPIDAPI_KEY = os.environ.get("RAPIDAPI_KEY", "d386e1bb76msh033f50e0c9f3fffp143e6cjsna582a6348118")
RAPIDAPI_HOST = "fly-scraper.p.rapidapi.com"

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

# Cache for route prices to avoid hitting RapidAPI too much during scans
# { ("London", "New York", "2026-05-30"): (base_price, transport_name, alternatives_list, cached_at_iso, duration, etd, eta) }
_ROUTE_PRICE_CACHE: Dict[Tuple[str, str, str], Tuple[float, str, list, str, str, str, str]] = {}


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
        force_refresh: bool = False
    ) -> Dict[str, Any]:
        """Fetch transport details including carrier, price, duration, and alternatives."""
        pass


# =====================================================================
# 3. Concrete Providers (SRP & OCP)
# =====================================================================

class FlightTransportProvider(TransportProvider):
    """
    Fulfills SRP for flight-specific travel details including API fetching and caching.
    """
    def __init__(self, api_key: str, api_host: str):
        self.api_key = api_key
        self.api_host = api_host
        self._airport_cache = _AIRPORT_CACHE
        self._route_cache = _ROUTE_PRICE_CACHE

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
        force_refresh: bool = False
    ) -> Dict[str, Any]:
        date_str = travel_date.strftime("%Y-%m-%d")
        exact_key = (from_city.lower(), to_city.lower(), date_str)
        
        # 1. Exact Cache match
        if not force_refresh and exact_key in self._route_cache:
            price, name, alts, cached_time, dur, etd, eta = self._route_cache[exact_key]
            return self._build_payload(
                from_city, from_code, to_city, to_code, date_str, "flight",
                math.ceil(price), dur, etd, eta, True, name, alts, "Cached", cached_time
            )

        from_info = self.get_airport_info(from_city)
        to_info = self.get_airport_info(to_city)

        if not from_info.get("skyId") or not to_info.get("skyId"):
            return self._build_unavailable_payload(from_city, from_code, to_city, to_code, date_str, "flight")

        url = f"https://{self.api_host}/flights/search-one-way"
        querystring = {
            "originSkyId": from_info["skyId"],
            "destinationSkyId": to_info["skyId"],
            "departureDate": date_str,
            "cabinClass": "economy",
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
            res = requests.get(url, headers=headers, params=querystring, timeout=15)
            res.raise_for_status()
            data = res.json()
            
            itineraries = data.get('data', {}).get('itineraries', [])
            if itineraries:
                # Sort itineraries strictly by price ascending to select cheapest flight option by default
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
                        
                        # Extract stops and duration
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
                
                # Extract timing details
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
                    self._route_cache[exact_key] = (price, flight_name, alternatives, cached_time, duration_str, etd, eta)
                    return self._build_payload(
                        from_city, from_code, to_city, to_code, date_str, "flight",
                        math.ceil(price), duration_str or "2h 30m", etd or "10:00 AM", eta or "12:30 PM",
                        True, flight_name, alternatives, "Fresh", cached_time
                    )
        except Exception as e:
            logger.error(f"Failed to fetch real flight for {exact_key}: {e}")

        # Return strictly unavailable itinerary if no real flights could be resolved
        return self._build_unavailable_payload(from_city, from_code, to_city, to_code, date_str, "flight")

    def _build_payload(self, from_c, from_code, to_c, to_code, date_s, mode, cost, dur, etd, eta, avail, name, alts, src, cached):
        return {
            "from_city": from_c, "from_code": from_code,
            "to_city": to_c, "to_code": to_code,
            "date": date_s, "mode": mode, "cost": cost,
            "duration": dur, "etd": etd, "eta": eta,
            "available": avail, "transport_name": name,
            "alternatives": alts, "data_source": src, "cached_at": cached
        }

    def _build_unavailable_payload(self, from_c, from_code, to_c, to_code, date_s, mode):
        return {
            "from_city": from_c, "from_code": from_code,
            "to_city": to_c, "to_code": to_code,
            "date": date_s, "mode": mode, "cost": 0,
            "duration": "N/A", "etd": "N/A", "eta": "N/A",
            "available": False, "transport_name": "No Flight Available",
            "alternatives": [], "data_source": "None", "cached_at": ""
        }


class TrainTransportProvider(TransportProvider):
    """
    Fulfills SRP for train-specific travel calculations.
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
        force_refresh: bool = False
    ) -> Dict[str, Any]:
        # Train pricing: 800 fixed booking fee + 2.2 INR per km
        cost = math.ceil(800 + distance_km * 2.2)
        # Train duration estimation based on 75 km/h average speed
        dur_mins = int((distance_km / 75.0) * 60)
        duration = f"{dur_mins // 60}h {dur_mins % 60}m"
        date_str = travel_date.strftime("%Y-%m-%d")
        
        alternatives = [
            {"price": cost, "transport_name": "Express Train", "duration": duration, "stops": 1, "etd": "08:00 PM", "eta": "04:00 AM"},
            {"price": math.ceil(cost * 1.3), "transport_name": "Rajdhani Express", "duration": f"{int(dur_mins * 0.8) // 60}h {int(dur_mins * 0.8) % 60}m", "stops": 0, "etd": "05:00 PM", "eta": "11:30 PM"},
            {"price": math.ceil(cost * 0.85), "transport_name": "Superfast Express", "duration": f"{int(dur_mins * 1.1) // 60}h {int(dur_mins * 1.1) % 60}m", "stops": 2, "etd": "10:00 PM", "eta": "07:30 AM"}
        ]
        
        return {
            "from_city": from_city, "from_code": from_code,
            "to_city": to_city, "to_code": to_code,
            "date": date_str, "mode": "train", "cost": cost,
            "duration": duration, "etd": "08:00 PM", "eta": "04:00 AM",
            "available": True, "transport_name": "Express Train",
            "alternatives": alternatives, "data_source": "Cached", "cached_at": ""
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
        force_refresh: bool = False
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


def get_travel_details(from_city: str, to_city: str, travel_date: date, mode: str, force_refresh: bool = False) -> Dict[str, Any]:
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
    return provider.get_details(from_city, to_city, from_code, to_code, travel_date, distance, force_refresh)


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
