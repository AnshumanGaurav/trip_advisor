"""
Indian Cities Database
======================
A comprehensive database of Indian cities with nearby airports and railway stations.
Used for:
  - City autocomplete suggestions in the UI
  - Fetching correct station/airport codes for mock transport API calls
  - Displaying ETD/ETA with proper station/airport context

Structure:
  {
    "city_key": {
      "display_name": str,        # Human-readable city name
      "state": str,               # State name
      "coords": [lat, lon],       # Geocoordinates for distance calculation
      "airports": [               # List of commercial airports serving the city
        {
          "code": str,            # IATA code
          "name": str,            # Short name shown in UI
          "full_name": str        # Full official name
        }
      ],
      "railway_stations": [       # List of major railway stations in/near the city
        {
          "code": str,            # Indian Railways station code
          "name": str,            # Short name shown in UI
          "full_name": str        # Full official station name
        }
      ]
    }
  }
"""

INDIAN_CITIES = {

    # ── NORTH INDIA ────────────────────────────────────────────────────────────

    "delhi": {
        "display_name": "Delhi",
        "state": "Delhi",
        "coords": [28.6139, 77.2090],
        "airports": [
            {"code": "DEL", "name": "IGI Airport", "full_name": "Indira Gandhi International Airport"}
        ],
        "railway_stations": [
            {"code": "NDLS", "name": "New Delhi", "full_name": "New Delhi Railway Station"},
            {"code": "DLI",  "name": "Old Delhi",  "full_name": "Old Delhi Railway Station"},
            {"code": "NZM",  "name": "Hazrat Nizamuddin", "full_name": "Hazrat Nizamuddin Railway Station"},
            {"code": "ANVT", "name": "Anand Vihar", "full_name": "Anand Vihar Terminal Railway Station"},
            {"code": "DEE",  "name": "Delhi Sarai Rohilla", "full_name": "Delhi Sarai Rohilla Railway Station"}
        ]
    },

    "agra": {
        "display_name": "Agra",
        "state": "Uttar Pradesh",
        "coords": [27.1767, 78.0081],
        "airports": [
            {"code": "AGR", "name": "Agra Airport", "full_name": "Agra Airport (Pandit Deen Dayal Upadhyay Airport)"}
        ],
        "railway_stations": [
            {"code": "AGC",  "name": "Agra Cantt", "full_name": "Agra Cantonment Railway Station"},
            {"code": "AF",   "name": "Agra Fort",  "full_name": "Agra Fort Railway Station"},
            {"code": "RKM",  "name": "Raja Ki Mandi", "full_name": "Raja Ki Mandi Railway Station"},
            {"code": "ABMD", "name": "Agra City",  "full_name": "Agra City Railway Station"}
        ]
    },

    "jaipur": {
        "display_name": "Jaipur",
        "state": "Rajasthan",
        "coords": [26.9124, 75.7873],
        "airports": [
            {"code": "JAI", "name": "Jaipur Airport", "full_name": "Jaipur International Airport"}
        ],
        "railway_stations": [
            {"code": "JP",   "name": "Jaipur Junction", "full_name": "Jaipur Junction Railway Station"},
            {"code": "JPTR", "name": "Jaipur Gandhinagar", "full_name": "Gandhinagar Jaipur Railway Station"},
            {"code": "DPA",  "name": "Durgapura", "full_name": "Durgapura Railway Station"}
        ]
    },

    "udaipur": {
        "display_name": "Udaipur",
        "state": "Rajasthan",
        "coords": [24.5854, 73.7125],
        "airports": [
            {"code": "UDR", "name": "Udaipur Airport", "full_name": "Maharana Pratap Airport"}
        ],
        "railway_stations": [
            {"code": "UDZ", "name": "Udaipur City", "full_name": "Udaipur City Railway Station"}
        ]
    },

    "jodhpur": {
        "display_name": "Jodhpur",
        "state": "Rajasthan",
        "coords": [26.2389, 73.0243],
        "airports": [
            {"code": "JDH", "name": "Jodhpur Airport", "full_name": "Jodhpur Airport"}
        ],
        "railway_stations": [
            {"code": "JU",  "name": "Jodhpur Junction", "full_name": "Jodhpur Junction Railway Station"},
            {"code": "RKB", "name": "Rai Ka Bagh", "full_name": "Rai Ka Bagh Palace Railway Station"}
        ]
    },

    "jaisalmer": {
        "display_name": "Jaisalmer",
        "state": "Rajasthan",
        "coords": [26.9157, 70.9083],
        "airports": [
            {"code": "JSA", "name": "Jaisalmer Airport", "full_name": "Jaisalmer Airport"}
        ],
        "railway_stations": [
            {"code": "JSM", "name": "Jaisalmer", "full_name": "Jaisalmer Railway Station"}
        ]
    },

    "ajmer": {
        "display_name": "Ajmer",
        "state": "Rajasthan",
        "coords": [26.4499, 74.6399],
        "airports": [
            {"code": "JAI", "name": "Jaipur Airport (nearest)", "full_name": "Jaipur International Airport (nearest to Ajmer)"}
        ],
        "railway_stations": [
            {"code": "AII", "name": "Ajmer Junction", "full_name": "Ajmer Junction Railway Station"}
        ]
    },

    "bikaner": {
        "display_name": "Bikaner",
        "state": "Rajasthan",
        "coords": [28.0229, 73.3119],
        "airports": [
            {"code": "BKB", "name": "Bikaner Airport", "full_name": "Nal Airport, Bikaner"}
        ],
        "railway_stations": [
            {"code": "BKN", "name": "Bikaner Junction", "full_name": "Bikaner Junction Railway Station"}
        ]
    },

    "varanasi": {
        "display_name": "Varanasi",
        "state": "Uttar Pradesh",
        "coords": [25.3176, 82.9739],
        "airports": [
            {"code": "VNS", "name": "Varanasi Airport", "full_name": "Lal Bahadur Shastri International Airport"}
        ],
        "railway_stations": [
            {"code": "BSB", "name": "Varanasi Junction", "full_name": "Varanasi Junction Railway Station"},
            {"code": "MGS", "name": "Mughal Sarai", "full_name": "Pt. Deen Dayal Upadhyaya Junction (Mughal Sarai)"},
            {"code": "BCY", "name": "Varanasi City", "full_name": "Varanasi City Railway Station"}
        ]
    },

    "lucknow": {
        "display_name": "Lucknow",
        "state": "Uttar Pradesh",
        "coords": [26.8467, 80.9462],
        "airports": [
            {"code": "LKO", "name": "Lucknow Airport", "full_name": "Chaudhary Charan Singh International Airport"}
        ],
        "railway_stations": [
            {"code": "LJN", "name": "Lucknow Junction", "full_name": "Lucknow Junction Railway Station (NR)"},
            {"code": "LKO", "name": "Lucknow Charbagh", "full_name": "Lucknow Charbagh Railway Station (NER)"},
            {"code": "LMG", "name": "Lucknow Malgodaam", "full_name": "Lucknow Malgodaam Railway Station"},
            {"code": "ANVT","name": "Aishbagh",          "full_name": "Aishbagh Railway Station"}
        ]
    },

    "chandigarh": {
        "display_name": "Chandigarh",
        "state": "Chandigarh (UT)",
        "coords": [30.7333, 76.7794],
        "airports": [
            {"code": "IXC", "name": "Chandigarh Airport", "full_name": "Shaheed Bhagat Singh International Airport"}
        ],
        "railway_stations": [
            {"code": "CDG", "name": "Chandigarh", "full_name": "Chandigarh Railway Station"},
            {"code": "UMB", "name": "Ambala Cantt", "full_name": "Ambala Cantonment Railway Station"}
        ]
    },

    "amritsar": {
        "display_name": "Amritsar",
        "state": "Punjab",
        "coords": [31.6340, 74.8723],
        "airports": [
            {"code": "ATQ", "name": "Amritsar Airport", "full_name": "Sri Guru Ram Dass Jee International Airport"}
        ],
        "railway_stations": [
            {"code": "ASR", "name": "Amritsar Junction", "full_name": "Amritsar Junction Railway Station"}
        ]
    },

    "jammu": {
        "display_name": "Jammu",
        "state": "Jammu & Kashmir",
        "coords": [32.7266, 74.8570],
        "airports": [
            {"code": "IXJ", "name": "Jammu Airport", "full_name": "Jammu Airport"}
        ],
        "railway_stations": [
            {"code": "JAT", "name": "Jammu Tawi", "full_name": "Jammu Tawi Railway Station"}
        ]
    },

    "srinagar": {
        "display_name": "Srinagar",
        "state": "Jammu & Kashmir",
        "coords": [34.0837, 74.7973],
        "airports": [
            {"code": "SXR", "name": "Srinagar Airport", "full_name": "Sheikh ul-Alam International Airport"}
        ],
        "railway_stations": []   # No broad-gauge rail connectivity yet
    },

    "leh": {
        "display_name": "Leh",
        "state": "Ladakh",
        "coords": [34.1526, 77.5771],
        "airports": [
            {"code": "IXL", "name": "Leh Airport", "full_name": "Kushok Bakula Rimpochee Airport"}
        ],
        "railway_stations": []   # No railway connectivity
    },

    "shimla": {
        "display_name": "Shimla",
        "state": "Himachal Pradesh",
        "coords": [31.1048, 77.1734],
        "airports": [
            {"code": "SLV", "name": "Shimla Airport", "full_name": "Jubbarhatti Airport"}
        ],
        "railway_stations": [
            {"code": "SML", "name": "Shimla", "full_name": "Shimla Railway Station (narrow gauge)"},
            {"code": "KLK", "name": "Kalka",  "full_name": "Kalka Railway Station (broad gauge terminus)"}
        ]
    },

    "dehradun": {
        "display_name": "Dehradun",
        "state": "Uttarakhand",
        "coords": [30.3165, 78.0322],
        "airports": [
            {"code": "DED", "name": "Dehradun Airport", "full_name": "Jolly Grant Airport"}
        ],
        "railway_stations": [
            {"code": "DDN", "name": "Dehradun", "full_name": "Dehradun Railway Station"},
            {"code": "HW",  "name": "Haridwar Junction", "full_name": "Haridwar Junction Railway Station"}
        ]
    },

    "haridwar": {
        "display_name": "Haridwar",
        "state": "Uttarakhand",
        "coords": [29.9457, 78.1642],
        "airports": [
            {"code": "DED", "name": "Jolly Grant Airport (nearest)", "full_name": "Jolly Grant Airport, Dehradun (nearest to Haridwar)"}
        ],
        "railway_stations": [
            {"code": "HW", "name": "Haridwar Junction", "full_name": "Haridwar Junction Railway Station"}
        ]
    },

    "agartala": {
        "display_name": "Agartala",
        "state": "Tripura",
        "coords": [23.8315, 91.2868],
        "airports": [
            {"code": "IXA", "name": "Agartala Airport", "full_name": "Maharaja Bir Bikram Airport"}
        ],
        "railway_stations": [
            {"code": "AGTL", "name": "Agartala", "full_name": "Agartala Railway Station"}
        ]
    },

    # ── WEST INDIA ─────────────────────────────────────────────────────────────

    "mumbai": {
        "display_name": "Mumbai",
        "state": "Maharashtra",
        "coords": [19.0760, 72.8777],
        "airports": [
            {"code": "BOM", "name": "Mumbai Airport", "full_name": "Chhatrapati Shivaji Maharaj International Airport"},
        ],
        "railway_stations": [
            {"code": "CSTM", "name": "Mumbai CST",      "full_name": "Chhatrapati Shivaji Maharaj Terminus"},
            {"code": "BCT",  "name": "Mumbai Central",  "full_name": "Mumbai Central Railway Station"},
            {"code": "LTT",  "name": "Lokmanya Tilak",  "full_name": "Lokmanya Tilak Terminus"},
            {"code": "BDTS", "name": "Bandra Terminus",  "full_name": "Bandra Terminus Railway Station"},
            {"code": "DR",   "name": "Dadar",            "full_name": "Dadar Railway Station"}
        ]
    },

    "pune": {
        "display_name": "Pune",
        "state": "Maharashtra",
        "coords": [18.5204, 73.8567],
        "airports": [
            {"code": "PNQ", "name": "Pune Airport", "full_name": "Pune International Airport"}
        ],
        "railway_stations": [
            {"code": "PUNE", "name": "Pune Junction",  "full_name": "Pune Junction Railway Station"},
            {"code": "GGNR", "name": "Ghorpadi",       "full_name": "Ghorpadi Railway Station"},
            {"code": "HPN",  "name": "Hadapsar",       "full_name": "Hadapsar Railway Station"},
            {"code": "SSVR", "name": "Shivajinagar",   "full_name": "Shivajinagar Railway Station"}
        ]
    },

    "ahmedabad": {
        "display_name": "Ahmedabad",
        "state": "Gujarat",
        "coords": [23.0225, 72.5714],
        "airports": [
            {"code": "AMD", "name": "Ahmedabad Airport", "full_name": "Sardar Vallabhbhai Patel International Airport"}
        ],
        "railway_stations": [
            {"code": "ADI",  "name": "Ahmedabad Junction", "full_name": "Ahmedabad Junction Railway Station"},
            {"code": "SBIB", "name": "Sabarmati",          "full_name": "Sabarmati Junction Railway Station"}
        ]
    },

    "surat": {
        "display_name": "Surat",
        "state": "Gujarat",
        "coords": [21.1702, 72.8311],
        "airports": [
            {"code": "STV", "name": "Surat Airport", "full_name": "Surat Airport"}
        ],
        "railway_stations": [
            {"code": "ST", "name": "Surat", "full_name": "Surat Railway Station"}
        ]
    },

    "vadodara": {
        "display_name": "Vadodara",
        "state": "Gujarat",
        "coords": [22.3072, 73.1812],
        "airports": [
            {"code": "BDQ", "name": "Vadodara Airport", "full_name": "Vadodara Airport"}
        ],
        "railway_stations": [
            {"code": "BRC", "name": "Vadodara Junction", "full_name": "Vadodara Junction Railway Station"}
        ]
    },

    "rajkot": {
        "display_name": "Rajkot",
        "state": "Gujarat",
        "coords": [22.3039, 70.8022],
        "airports": [
            {"code": "RAJ", "name": "Rajkot Airport", "full_name": "Rajkot Airport"}
        ],
        "railway_stations": [
            {"code": "RJT", "name": "Rajkot Junction", "full_name": "Rajkot Junction Railway Station"}
        ]
    },

    "nagpur": {
        "display_name": "Nagpur",
        "state": "Maharashtra",
        "coords": [21.1458, 79.0882],
        "airports": [
            {"code": "NAG", "name": "Nagpur Airport", "full_name": "Dr. Babasaheb Ambedkar International Airport"}
        ],
        "railway_stations": [
            {"code": "NGP",  "name": "Nagpur Junction",  "full_name": "Nagpur Junction Railway Station"},
            {"code": "NGPK", "name": "Nagpur Khapri",    "full_name": "Khapri Railway Station"}
        ]
    },

    "aurangabad": {
        "display_name": "Aurangabad",
        "state": "Maharashtra",
        "coords": [19.8762, 75.3433],
        "airports": [
            {"code": "IXU", "name": "Aurangabad Airport", "full_name": "Aurangabad Airport"}
        ],
        "railway_stations": [
            {"code": "AWB", "name": "Aurangabad", "full_name": "Aurangabad Railway Station"}
        ]
    },

    "nashik": {
        "display_name": "Nashik",
        "state": "Maharashtra",
        "coords": [19.9975, 73.7898],
        "airports": [
            {"code": "ISK", "name": "Nashik Airport", "full_name": "Ozar Airport (Nashik)"}
        ],
        "railway_stations": [
            {"code": "NK",  "name": "Nashik Road",  "full_name": "Nashik Road Railway Station"},
            {"code": "DWK", "name": "Devlali",      "full_name": "Devlali Railway Station"}
        ]
    },

    "goa": {
        "display_name": "Goa",
        "state": "Goa",
        "coords": [15.2993, 74.1240],
        "airports": [
            {"code": "GOI", "name": "Goa Airport (Dabolim)", "full_name": "Goa International Airport (Dabolim)"},
            {"code": "GOX", "name": "Mopa Airport",          "full_name": "Manohar International Airport (North Goa)"}
        ],
        "railway_stations": [
            {"code": "MAO",  "name": "Madgaon",       "full_name": "Madgaon Railway Station (South Goa)"},
            {"code": "THVM", "name": "Thivim",        "full_name": "Thivim Railway Station (North Goa)"},
            {"code": "VSG",  "name": "Vasco Da Gama", "full_name": "Vasco Da Gama Railway Station"}
        ]
    },

    # ── SOUTH INDIA ────────────────────────────────────────────────────────────

    "bangalore": {
        "display_name": "Bangalore",
        "state": "Karnataka",
        "coords": [12.9716, 77.5946],
        "airports": [
            {"code": "BLR", "name": "Kempegowda Airport", "full_name": "Kempegowda International Airport"}
        ],
        "railway_stations": [
            {"code": "SBC",  "name": "Bengaluru City",     "full_name": "Krantivira Sangolli Rayanna (Bengaluru City) Railway Station"},
            {"code": "YPR",  "name": "Yeshwanthpur",       "full_name": "Yeshwanthpur Junction Railway Station"},
            {"code": "BNC",  "name": "Bengaluru Cantonment","full_name": "Bengaluru Cantonment Railway Station"},
            {"code": "BAND", "name": "Banaswadi",          "full_name": "Banaswadi Railway Station"}
        ]
    },

    "mysore": {
        "display_name": "Mysore",
        "state": "Karnataka",
        "coords": [12.2958, 76.6394],
        "airports": [
            {"code": "MYQ", "name": "Mysore Airport", "full_name": "Mysore Airport"}
        ],
        "railway_stations": [
            {"code": "MYS", "name": "Mysuru Junction", "full_name": "Mysuru Junction Railway Station"}
        ]
    },

    "mangalore": {
        "display_name": "Mangalore",
        "state": "Karnataka",
        "coords": [12.9141, 74.8560],
        "airports": [
            {"code": "IXE", "name": "Mangalore Airport", "full_name": "Mangaluru International Airport"}
        ],
        "railway_stations": [
            {"code": "MAQ",  "name": "Mangaluru Central",  "full_name": "Mangaluru Central Railway Station"},
            {"code": "MAJN", "name": "Mangaluru Junction", "full_name": "Mangaluru Junction Railway Station"}
        ]
    },

    "hubli": {
        "display_name": "Hubli",
        "state": "Karnataka",
        "coords": [15.3647, 75.1240],
        "airports": [
            {"code": "HBX", "name": "Hubli Airport", "full_name": "Hubli Airport"}
        ],
        "railway_stations": [
            {"code": "UBL", "name": "Hubballi Junction", "full_name": "Hubballi Junction Railway Station"}
        ]
    },

    "chennai": {
        "display_name": "Chennai",
        "state": "Tamil Nadu",
        "coords": [13.0827, 80.2707],
        "airports": [
            {"code": "MAA", "name": "Chennai Airport", "full_name": "Chennai International Airport"}
        ],
        "railway_stations": [
            {"code": "MAS",  "name": "Chennai Central",     "full_name": "Chennai Central Railway Station"},
            {"code": "MS",   "name": "Chennai Egmore",      "full_name": "Chennai Egmore Railway Station"},
            {"code": "MSB",  "name": "Chennai Beach",       "full_name": "Chennai Beach Railway Station"},
            {"code": "MMCC", "name": "Chennai Mambalam",    "full_name": "Mambalam Railway Station"}
        ]
    },

    "coimbatore": {
        "display_name": "Coimbatore",
        "state": "Tamil Nadu",
        "coords": [11.0168, 76.9558],
        "airports": [
            {"code": "CJB", "name": "Coimbatore Airport", "full_name": "Coimbatore International Airport"}
        ],
        "railway_stations": [
            {"code": "CBE",  "name": "Coimbatore Junction", "full_name": "Coimbatore Junction Railway Station"},
            {"code": "CBI",  "name": "Coimbatore North",    "full_name": "Coimbatore North Railway Station"}
        ]
    },

    "madurai": {
        "display_name": "Madurai",
        "state": "Tamil Nadu",
        "coords": [9.9252, 78.1198],
        "airports": [
            {"code": "IXM", "name": "Madurai Airport", "full_name": "Madurai Airport"}
        ],
        "railway_stations": [
            {"code": "MDU", "name": "Madurai Junction", "full_name": "Madurai Junction Railway Station"}
        ]
    },

    "tiruchirapalli": {
        "display_name": "Tiruchirapalli",
        "state": "Tamil Nadu",
        "coords": [10.7905, 78.7047],
        "airports": [
            {"code": "TRZ", "name": "Trichy Airport", "full_name": "Tiruchirappalli International Airport"}
        ],
        "railway_stations": [
            {"code": "TPJ", "name": "Trichy Junction", "full_name": "Tiruchirappalli Junction Railway Station"}
        ]
    },

    "tirunelveli": {
        "display_name": "Tirunelveli",
        "state": "Tamil Nadu",
        "coords": [8.7139, 77.7567],
        "airports": [
            {"code": "TCR", "name": "Tuticorin Airport (nearest)", "full_name": "Thoothukudi Airport (nearest to Tirunelveli)"}
        ],
        "railway_stations": [
            {"code": "TEN", "name": "Tirunelveli Junction", "full_name": "Tirunelveli Junction Railway Station"}
        ]
    },

    "hyderabad": {
        "display_name": "Hyderabad",
        "state": "Telangana",
        "coords": [17.3850, 78.4867],
        "airports": [
            {"code": "HYD", "name": "RGIA Hyderabad", "full_name": "Rajiv Gandhi International Airport"}
        ],
        "railway_stations": [
            {"code": "HYB", "name": "Hyderabad Deccan", "full_name": "Hyderabad Deccan (Nampally) Railway Station"},
            {"code": "SC",  "name": "Secunderabad",     "full_name": "Secunderabad Junction Railway Station"},
            {"code": "KCG", "name": "Kacheguda",        "full_name": "Kacheguda Railway Station"},
            {"code": "LPI", "name": "Lingampalli",      "full_name": "Lingampalli Railway Station"}
        ]
    },

    "visakhapatnam": {
        "display_name": "Visakhapatnam",
        "state": "Andhra Pradesh",
        "coords": [17.6868, 83.2185],
        "airports": [
            {"code": "VTZ", "name": "Vizag Airport", "full_name": "Visakhapatnam Airport"}
        ],
        "railway_stations": [
            {"code": "VSKP", "name": "Visakhapatnam Junction", "full_name": "Visakhapatnam Junction Railway Station"},
            {"code": "DVD",  "name": "Duvvada",                "full_name": "Duvvada Railway Station"}
        ]
    },

    "vijayawada": {
        "display_name": "Vijayawada",
        "state": "Andhra Pradesh",
        "coords": [16.5062, 80.6480],
        "airports": [
            {"code": "VGA", "name": "Vijayawada Airport", "full_name": "Vijayawada Airport"}
        ],
        "railway_stations": [
            {"code": "BZA", "name": "Vijayawada Junction", "full_name": "Vijayawada Junction Railway Station"}
        ]
    },

    "tirupati": {
        "display_name": "Tirupati",
        "state": "Andhra Pradesh",
        "coords": [13.6288, 79.4192],
        "airports": [
            {"code": "TIR", "name": "Tirupati Airport", "full_name": "Tirupati Airport"}
        ],
        "railway_stations": [
            {"code": "TPTY", "name": "Tirupati", "full_name": "Tirupati Railway Station"}
        ]
    },

    "kochi": {
        "display_name": "Kochi",
        "state": "Kerala",
        "coords": [9.9312, 76.2673],
        "airports": [
            {"code": "COK", "name": "Cochin Airport", "full_name": "Cochin International Airport"}
        ],
        "railway_stations": [
            {"code": "ERS",  "name": "Ernakulam Junction", "full_name": "Ernakulam Junction Railway Station (South)"},
            {"code": "ERN",  "name": "Ernakulam Town",     "full_name": "Ernakulam Town Railway Station (North)"},
            {"code": "AWY",  "name": "Aluva",              "full_name": "Aluva Railway Station"}
        ]
    },

    "thiruvananthapuram": {
        "display_name": "Thiruvananthapuram",
        "state": "Kerala",
        "coords": [8.5241, 76.9366],
        "airports": [
            {"code": "TRV", "name": "Trivandrum Airport", "full_name": "Trivandrum International Airport"}
        ],
        "railway_stations": [
            {"code": "TVC", "name": "Trivandrum Central", "full_name": "Thiruvananthapuram Central Railway Station"}
        ]
    },

    "kozhikode": {
        "display_name": "Kozhikode",
        "state": "Kerala",
        "coords": [11.2588, 75.7804],
        "airports": [
            {"code": "CCJ", "name": "Calicut Airport", "full_name": "Calicut International Airport"}
        ],
        "railway_stations": [
            {"code": "CLT", "name": "Kozhikode", "full_name": "Kozhikode Railway Station"}
        ]
    },

    "pondicherry": {
        "display_name": "Pondicherry",
        "state": "Puducherry",
        "coords": [11.9416, 79.8083],
        "airports": [
            {"code": "PNY", "name": "Pondicherry Airport", "full_name": "Pondicherry Airport"}
        ],
        "railway_stations": [
            {"code": "PDY", "name": "Puducherry", "full_name": "Puducherry Railway Station"}
        ]
    },

    # ── EAST INDIA ─────────────────────────────────────────────────────────────

    "kolkata": {
        "display_name": "Kolkata",
        "state": "West Bengal",
        "coords": [22.5726, 88.3639],
        "airports": [
            {"code": "CCU", "name": "Kolkata Airport", "full_name": "Netaji Subhas Chandra Bose International Airport"}
        ],
        "railway_stations": [
            {"code": "HWH",  "name": "Howrah Junction",  "full_name": "Howrah Junction Railway Station"},
            {"code": "SDAH", "name": "Sealdah",          "full_name": "Sealdah Railway Station"},
            {"code": "KOAA", "name": "Kolkata Station",  "full_name": "Kolkata Railway Station"}
        ]
    },

    "bhubaneswar": {
        "display_name": "Bhubaneswar",
        "state": "Odisha",
        "coords": [20.2961, 85.8245],
        "airports": [
            {"code": "BBI", "name": "Bhubaneswar Airport", "full_name": "Biju Patnaik International Airport"}
        ],
        "railway_stations": [
            {"code": "BBS", "name": "Bhubaneswar", "full_name": "Bhubaneswar Railway Station"}
        ]
    },

    "puri": {
        "display_name": "Puri",
        "state": "Odisha",
        "coords": [19.8133, 85.8314],
        "airports": [
            {"code": "BBI", "name": "Bhubaneswar Airport (nearest)", "full_name": "Biju Patnaik International Airport (nearest to Puri)"}
        ],
        "railway_stations": [
            {"code": "PURI", "name": "Puri", "full_name": "Puri Railway Station"}
        ]
    },

    "patna": {
        "display_name": "Patna",
        "state": "Bihar",
        "coords": [25.5941, 85.1376],
        "airports": [
            {"code": "PAT", "name": "Patna Airport", "full_name": "Lok Nayak Jayaprakash Airport"}
        ],
        "railway_stations": [
            {"code": "PNBE", "name": "Patna Junction",    "full_name": "Patna Junction Railway Station"},
            {"code": "PNC",  "name": "Patna Sahib",       "full_name": "Patna Sahib Railway Station"},
            {"code": "RGD",  "name": "Rajendra Nagar",    "full_name": "Rajendra Nagar Terminal Railway Station"}
        ]
    },

    "guwahati": {
        "display_name": "Guwahati",
        "state": "Assam",
        "coords": [26.1445, 91.7362],
        "airports": [
            {"code": "GAU", "name": "Guwahati Airport", "full_name": "Lokpriya Gopinath Bordoloi International Airport"}
        ],
        "railway_stations": [
            {"code": "GHY",  "name": "Guwahati",          "full_name": "Guwahati Railway Station"},
            {"code": "ASVL", "name": "Kamakhya",          "full_name": "Kamakhya Railway Station"},
            {"code": "NTSK", "name": "New Tinsukia",      "full_name": "New Tinsukia Junction Railway Station"}
        ]
    },

    "ranchi": {
        "display_name": "Ranchi",
        "state": "Jharkhand",
        "coords": [23.3441, 85.3096],
        "airports": [
            {"code": "IXR", "name": "Ranchi Airport", "full_name": "Birsa Munda Airport"}
        ],
        "railway_stations": [
            {"code": "RNC", "name": "Ranchi Junction", "full_name": "Ranchi Junction Railway Station"}
        ]
    },

    "imphal": {
        "display_name": "Imphal",
        "state": "Manipur",
        "coords": [24.8170, 93.9368],
        "airports": [
            {"code": "IMF", "name": "Imphal Airport", "full_name": "Bir Tikendrajit International Airport"}
        ],
        "railway_stations": []   # No railway connectivity currently
    },

    # ── CENTRAL INDIA ──────────────────────────────────────────────────────────

    "bhopal": {
        "display_name": "Bhopal",
        "state": "Madhya Pradesh",
        "coords": [23.2599, 77.4126],
        "airports": [
            {"code": "BHO", "name": "Bhopal Airport", "full_name": "Raja Bhoj Airport"}
        ],
        "railway_stations": [
            {"code": "BPL",  "name": "Bhopal Junction",  "full_name": "Bhopal Junction Railway Station"},
            {"code": "HBJ",  "name": "Habibganj",        "full_name": "Rani Kamlapati Railway Station (Habibganj)"}
        ]
    },

    "indore": {
        "display_name": "Indore",
        "state": "Madhya Pradesh",
        "coords": [22.7196, 75.8577],
        "airports": [
            {"code": "IDR", "name": "Indore Airport", "full_name": "Devi Ahilya Bai Holkar Airport"}
        ],
        "railway_stations": [
            {"code": "INDB", "name": "Indore Junction", "full_name": "Indore Junction Railway Station"}
        ]
    },

    "jabalpur": {
        "display_name": "Jabalpur",
        "state": "Madhya Pradesh",
        "coords": [23.1815, 79.9864],
        "airports": [
            {"code": "JLR", "name": "Jabalpur Airport", "full_name": "Jabalpur Airport (Dumna Airport)"}
        ],
        "railway_stations": [
            {"code": "JBP", "name": "Jabalpur Junction", "full_name": "Jabalpur Junction Railway Station"}
        ]
    },

    "gwalior": {
        "display_name": "Gwalior",
        "state": "Madhya Pradesh",
        "coords": [26.2183, 78.1828],
        "airports": [
            {"code": "GWL", "name": "Gwalior Airport", "full_name": "Gwalior Airport"}
        ],
        "railway_stations": [
            {"code": "GWL", "name": "Gwalior Junction", "full_name": "Gwalior Junction Railway Station"}
        ]
    },

    "raipur": {
        "display_name": "Raipur",
        "state": "Chhattisgarh",
        "coords": [21.2514, 81.6296],
        "airports": [
            {"code": "RPR", "name": "Raipur Airport", "full_name": "Swami Vivekananda Airport"}
        ],
        "railway_stations": [
            {"code": "R", "name": "Raipur Junction", "full_name": "Raipur Junction Railway Station"}
        ]
    },

    # ── ADDITIONAL CITIES ──────────────────────────────────────────────────────

    "prayagraj": {
        "display_name": "Prayagraj",
        "state": "Uttar Pradesh",
        "coords": [25.4358, 81.8463],
        "airports": [
            {"code": "IXD", "name": "Prayagraj Airport", "full_name": "Bamrauli Airport, Prayagraj"}
        ],
        "railway_stations": [
            {"code": "PRYJ", "name": "Prayagraj Junction", "full_name": "Prayagraj Junction Railway Station (formerly Allahabad)"},
            {"code": "ALD",  "name": "Allahabad City",     "full_name": "Allahabad City Railway Station"}
        ]
    },

    "siliguri": {
        "display_name": "Siliguri",
        "state": "West Bengal",
        "coords": [26.7271, 88.3953],
        "airports": [
            {"code": "IXB", "name": "Bagdogra Airport", "full_name": "Bagdogra International Airport, Siliguri"}
        ],
        "railway_stations": [
            {"code": "NJP",  "name": "New Jalpaiguri Junction", "full_name": "New Jalpaiguri Junction Railway Station"},
            {"code": "SGUJ", "name": "Siliguri Junction",       "full_name": "Siliguri Junction Railway Station"}
        ]
    },

    "manali": {
        "display_name": "Manali",
        "state": "Himachal Pradesh",
        "coords": [32.2396, 77.1887],
        "airports": [
            {"code": "KUU", "name": "Kullu-Manali Airport", "full_name": "Kullu-Manali Airport, Bhuntar (50 km from Manali)"}
        ],
        "railway_stations": [
            {"code": "CDG", "name": "Chandigarh (nearest)", "full_name": "Chandigarh Junction Railway Station (~315 km)"},
            {"code": "KLK", "name": "Kalka",                "full_name": "Kalka Railway Station (~310 km)"}
        ]
    },

    "shillong": {
        "display_name": "Shillong",
        "state": "Meghalaya",
        "coords": [25.5788, 91.8933],
        "airports": [
            {"code": "SHL", "name": "Shillong Airport", "full_name": "Shillong Airport, Umroi, Meghalaya"}
        ],
        "railway_stations": [
            {"code": "GHY", "name": "Guwahati (nearest)", "full_name": "Guwahati Railway Station (~100 km from Shillong)"}
        ]
    },

    "gangtok": {
        "display_name": "Gangtok",
        "state": "Sikkim",
        "coords": [27.3389, 88.6065],
        "airports": [
            {"code": "PYG", "name": "Pakyong Airport", "full_name": "Pakyong Airport, Sikkim"},
            {"code": "IXB", "name": "Bagdogra Airport (alternate)", "full_name": "Bagdogra International Airport, Siliguri (alternate)"}
        ],
        "railway_stations": [
            {"code": "NJP", "name": "New Jalpaiguri (nearest)", "full_name": "New Jalpaiguri Junction Railway Station (~145 km from Gangtok)"}
        ]
    },

    "itanagar": {
        "display_name": "Itanagar",
        "state": "Arunachal Pradesh",
        "coords": [27.0869, 93.6099],
        "airports": [
            {"code": "HGI", "name": "Donyi Polo Airport", "full_name": "Donyi Polo Airport, Hollongi, Arunachal Pradesh"}
        ],
        "railway_stations": [
            {"code": "NHLN", "name": "Naharlagun", "full_name": "Naharlagun Railway Station (nearest to Itanagar)"}
        ]
    },

    "kohima": {
        "display_name": "Kohima",
        "state": "Nagaland",
        "coords": [25.6747, 94.1100],
        "airports": [
            {"code": "DMU", "name": "Dimapur Airport (nearest)", "full_name": "Dimapur Airport, Nagaland (74 km from Kohima)"}
        ],
        "railway_stations": [
            {"code": "DMV", "name": "Dimapur (nearest)", "full_name": "Dimapur Railway Station (~74 km from Kohima)"}
        ]
    },

    "dimapur": {
        "display_name": "Dimapur",
        "state": "Nagaland",
        "coords": [25.9092, 93.7266],
        "airports": [
            {"code": "DMU", "name": "Dimapur Airport", "full_name": "Dimapur Airport, Nagaland"}
        ],
        "railway_stations": [
            {"code": "DMV", "name": "Dimapur", "full_name": "Dimapur Railway Station"}
        ]
    },

    "aizawl": {
        "display_name": "Aizawl",
        "state": "Mizoram",
        "coords": [23.7307, 92.7173],
        "airports": [
            {"code": "AJL", "name": "Lengpui Airport", "full_name": "Lengpui Airport, Aizawl, Mizoram"}
        ],
        "railway_stations": [
            {"code": "SANG", "name": "Sairang (nearest)", "full_name": "Sairang Railway Station (~30 km from Aizawl)"}
        ]
    },

}


def get_city_list():
    """Returns sorted list of city display names for autocomplete."""
    return sorted([v["display_name"] for v in INDIAN_CITIES.values()])


def get_city_by_name(name: str):
    """Look up a city by display name or key (case-insensitive)."""
    name_lower = name.strip().lower()
    # Direct key match
    if name_lower in INDIAN_CITIES:
        return INDIAN_CITIES[name_lower]
    # Display name match
    for key, city in INDIAN_CITIES.items():
        if city["display_name"].lower() == name_lower:
            return city
    return None


def get_coords(city_name: str):
    """Get coordinates for a city. Falls back to mock_api hashing for unknown cities."""
    city = get_city_by_name(city_name)
    if city:
        return city["coords"]
    return None


def get_airports(city_name: str):
    """Get list of airports for a city."""
    city = get_city_by_name(city_name)
    if city:
        return city.get("airports", [])
    return []


def get_railway_stations(city_name: str):
    """Get list of railway stations for a city."""
    city = get_city_by_name(city_name)
    if city:
        return city.get("railway_stations", [])
    return []


def get_primary_station_code(city_name: str, mode: str) -> str:
    """
    Return the primary transport code for a given city and mode.
    Used for displaying in travel cards.
    """
    city = get_city_by_name(city_name)
    if not city:
        return city_name[:3].upper()
    if mode == "flight":
        airports = city.get("airports", [])
        return airports[0]["code"] if airports else "N/A"
    elif mode in ("train", "bus"):
        stations = city.get("railway_stations", [])
        return stations[0]["code"] if stations else "N/A"
    return "N/A"


def search_cities(query: str, limit: int = 10):
    """
    Intelligent, case-insensitive fuzzy search for cities.
    Matches against city name, state name, airport codes, and railway station codes.
    """
    query = query.strip().lower()
    if not query:
        return []

    results = []
    for key, city in INDIAN_CITIES.items():
        display = city["display_name"].lower()
        state = city["state"].lower()
        
        # Extract codes for searching
        airport_codes = [a["code"].lower() for a in city.get("airports", [])]
        station_codes = [s["code"].lower() for s in city.get("railway_stations", [])]
        
        score = -1
        
        # Priority 1: Exact prefix match on city name
        if display.startswith(query):
            score = 0
        # Priority 2: Exact match on airport or station code
        elif query in airport_codes or query in station_codes:
            score = 1
        # Priority 3: Substring match in city name
        elif query in display:
            score = 2
        # Priority 4: Substring match in state name
        elif query in state:
            score = 3
            
        if score != -1:
            results.append({
                "key": key,
                "display_name": city["display_name"],
                "state": city["state"],
                "score": score
            })
            
    # Sort by score (best match first), then alphabetically
    results.sort(key=lambda x: (x["score"], x["display_name"]))
    return results[:limit]
