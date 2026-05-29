from datetime import datetime, timedelta, time
from typing import List, Optional
from models import OptimizeRequest, ItineraryOption, LegDetail, OptimizeResponse
import flight_api

def parse_time(time_str: str) -> tuple:
    time_str = time_str.strip().upper()
    import re
    # Check for AM/PM format (e.g. "10:00 AM" or "03:45 PM")
    ampm_match = re.match(r'(\d+):(\d+)\s*(AM|PM)', time_str)
    if ampm_match:
        h = int(ampm_match.group(1))
        m = int(ampm_match.group(2))
        ampm = ampm_match.group(3)
        if ampm == "PM" and h < 12:
            h += 12
        elif ampm == "AM" and h == 12:
            h = 0
        return h, m
        
    # Check for 24h format (e.g. "22:00" or "05:10")
    h24_match = re.match(r'(\d+):(\d+)', time_str)
    if h24_match:
        return int(h24_match.group(1)), int(h24_match.group(2))
        
    return 12, 0 # default fallback

def parse_duration(dur_str: str) -> timedelta:
    hours = 0
    minutes = 0
    import re
    h_match = re.search(r'(\d+)\s*h', dur_str)
    m_match = re.search(r'(\d+)\s*m', dur_str)
    if h_match:
        hours = int(h_match.group(1))
    if m_match:
        minutes = int(m_match.group(1))
    return timedelta(hours=hours, minutes=minutes)

def optimize_route(request: OptimizeRequest) -> OptimizeResponse:
    # Parse base start date
    base_date = datetime.strptime(request.start_date, "%Y-%m-%d").date()
    
    all_options: List[ItineraryOption] = []
    
    # Scan a 1-week window (7 days) starting from base_date
    for day_offset in range(7):
        start_date = base_date + timedelta(days=day_offset)
        current_date = start_date
        
        legs_details: List[LegDetail] = []
        is_itinerary_available = True
        total_cost = 0
        
        # Build the legs array
        # Leg 1: Source to Stop 1
        previous_city = request.source
        
        first_leg_dep_datetime = None
        last_leg_arr_datetime = None
        
        for stop in request.stops:
            leg_data = flight_api.get_travel_details(
                from_city=previous_city,
                to_city=stop.city,
                travel_date=current_date,
                mode=stop.transport,
                force_refresh=request.force_refresh,
                selected_class=stop.selected_class
            )
            
            # Parse departure time and duration to find actual arrival date
            etd_str = leg_data.get("etd", "12:00 PM")
            duration_str = leg_data.get("duration", "2h 0m")
            dep_hour, dep_min = parse_time(etd_str)
            
            dep_dt = datetime.combine(current_date, time(dep_hour, dep_min))
            arr_dt = dep_dt + parse_duration(duration_str)
            arr_date = arr_dt.date()
            
            if first_leg_dep_datetime is None:
                first_leg_dep_datetime = dep_dt
                
            legs_details.append(LegDetail(
                from_city=leg_data["from_city"],
                from_code=leg_data["from_code"],
                to_city=leg_data["to_city"],
                to_code=leg_data["to_code"],
                date=leg_data["date"],
                mode=leg_data["mode"],
                cost=leg_data["cost"],
                duration=leg_data["duration"],
                etd=leg_data["etd"],
                eta=leg_data["eta"],
                available=leg_data["available"],
                transport_name=leg_data.get("transport_name"),
                alternatives=leg_data.get("alternatives", []),
                data_source=leg_data.get("data_source", "Dummy"),
                cached_at=leg_data.get("cached_at"),
                selected_class=leg_data.get("selected_class")
            ))
            
            if not leg_data["available"]:
                is_itinerary_available = False
                
            total_cost += leg_data["cost"]
            
            # Option A: Advance calendar by the number of nights spent in this intermediate stop after arrival
            current_date = arr_date + timedelta(days=stop.nights)
            previous_city = stop.city
            
        # Final Leg: Last Stop to Destination
        final_leg_data = flight_api.get_travel_details(
            from_city=previous_city,
            to_city=request.destination,
            travel_date=current_date,
            mode=request.destination_transport,
            force_refresh=request.force_refresh,
            selected_class=request.destination_class
        )
        
        # Parse final leg timing to find arrival
        f_etd_str = final_leg_data.get("etd", "12:00 PM")
        f_dur_str = final_leg_data.get("duration", "2h 0m")
        f_dep_hour, f_dep_min = parse_time(f_etd_str)
        
        f_dep_dt = datetime.combine(current_date, time(f_dep_hour, f_dep_min))
        f_arr_dt = f_dep_dt + parse_duration(f_dur_str)
        
        if first_leg_dep_datetime is None:
            first_leg_dep_datetime = f_dep_dt
        last_leg_arr_datetime = f_arr_dt
        
        legs_details.append(LegDetail(
            from_city=final_leg_data["from_city"],
            from_code=final_leg_data["from_code"],
            to_city=final_leg_data["to_city"],
            to_code=final_leg_data["to_code"],
            date=final_leg_data["date"],
            mode=final_leg_data["mode"],
            cost=final_leg_data["cost"],
            duration=final_leg_data["duration"],
            etd=final_leg_data["etd"],
            eta=final_leg_data["eta"],
            available=final_leg_data["available"],
            transport_name=final_leg_data.get("transport_name"),
            alternatives=final_leg_data.get("alternatives", []),
            data_source=final_leg_data.get("data_source", "Dummy"),
            cached_at=final_leg_data.get("cached_at"),
            selected_class=final_leg_data.get("selected_class")
        ))
        
        if not final_leg_data["available"]:
            is_itinerary_available = False
            
        total_cost += final_leg_data["cost"]
        
        # Calculate overall vacation duration
        total_duration_hours = 0.0
        total_duration_str = ""
        if first_leg_dep_datetime and last_leg_arr_datetime:
            delta = last_leg_arr_datetime - first_leg_dep_datetime
            total_duration_hours = delta.total_seconds() / 3600.0
            
            days = int(total_duration_hours // 24)
            hours = int(total_duration_hours % 24)
            mins = int((total_duration_hours * 60) % 60)
            if days > 0:
                total_duration_str = f"{days}d {hours}h"
            else:
                total_duration_str = f"{hours}h {mins}m"
        
        all_options.append(ItineraryOption(
            start_date=start_date.strftime("%Y-%m-%d"),
            total_cost=total_cost if is_itinerary_available else 0, # 0 indicates sold out / unavailable
            legs=legs_details,
            available=is_itinerary_available,
            total_duration_hours=round(total_duration_hours, 2),
            total_duration_str=total_duration_str
        ))
        
    # Find the best option (minimum total_cost among available options)
    available_options = [opt for opt in all_options if opt.available]
    best_option: Optional[ItineraryOption] = None
    average_cost = 0.0
    savings = 0.0
    
    if available_options:
        best_option = min(available_options, key=lambda opt: opt.total_cost)
        average_cost = sum(opt.total_cost for opt in available_options) / len(available_options)
        savings = max(0.0, average_cost - best_option.total_cost)
        
    return OptimizeResponse(
        best_option=best_option,
        all_options=all_options,
        average_cost=round(average_cost, 2),
        savings=round(savings, 2),
        flight_api_calls=flight_api.FLIGHT_API_CALLS,
        train_api_calls=flight_api.TRAIN_API_CALLS
    )
