from datetime import datetime, timedelta
from typing import List, Optional
from models import OptimizeRequest, ItineraryOption, LegDetail, OptimizeResponse
import flight_api

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
        
        for stop in request.stops:
            leg_data = flight_api.get_travel_details(
                from_city=previous_city,
                to_city=stop.city,
                travel_date=current_date,
                mode=stop.transport,
                force_refresh=request.force_refresh
            )
            
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
                cached_at=leg_data.get("cached_at")
            ))
            
            if not leg_data["available"]:
                is_itinerary_available = False
                
            total_cost += leg_data["cost"]
            
            # Advance calendar by the number of nights spent in this intermediate stop
            current_date = current_date + timedelta(days=stop.nights)
            previous_city = stop.city
            
        # Final Leg: Last Stop to Destination
        final_leg_data = flight_api.get_travel_details(
            from_city=previous_city,
            to_city=request.destination,
            travel_date=current_date,
            mode=request.destination_transport,
            force_refresh=request.force_refresh
        )
        
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
            cached_at=final_leg_data.get("cached_at")
        ))
        
        if not final_leg_data["available"]:
            is_itinerary_available = False
            
        total_cost += final_leg_data["cost"]
        
        all_options.append(ItineraryOption(
            start_date=start_date.strftime("%Y-%m-%d"),
            total_cost=total_cost if is_itinerary_available else 0, # 0 indicates sold out / unavailable
            legs=legs_details,
            available=is_itinerary_available
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
        savings=round(savings, 2)
    )
