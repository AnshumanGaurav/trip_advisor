'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Plane, Train } from 'lucide-react'

export default function Autocomplete({ id, value, onChange, placeholder, required, theme }) {
  const [query, setQuery] = useState(value || '')
  const [suggestions, setSuggestions] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [cityDetails, setCityDetails] = useState(null)
  
  const containerRef = useRef(null)
  const debounceRef = useRef(null)

  // Keep query in sync with parent value change
  useEffect(() => {
    setQuery(value || '')
  }, [value])

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch suggestions
  const fetchSuggestions = async (val) => {
    if (val.trim().length < 1) {
      setSuggestions([])
      setIsOpen(false)
      return
    }
    try {
      const res = await fetch(`/api/cities/search?q=${encodeURIComponent(val)}&limit=8`)
      if (res.ok) {
        const data = await res.json()
        setSuggestions(data.results || [])
        setIsOpen(data.results && data.results.length > 0)
      }
    } catch (err) {
      console.warn('Autocomplete fetch error:', err)
    }
  }

  // Handle Input Change
  const handleInputChange = (e) => {
    const val = e.target.value
    setQuery(val)
    onChange(val)
    setActiveIndex(-1)
    
    // Clear previous details if edited
    setCityDetails(null)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(val)
    }, 200)
  }

  // Load details once city is selected
  const loadCityDetails = async (cityName) => {
    try {
      const res = await fetch(`/api/cities/${encodeURIComponent(cityName)}`)
      if (res.ok) {
        const details = await res.json()
        setCityDetails(details)
      }
    } catch (e) {
      console.warn('Error loading city details:', e)
    }
  }

  // Select Item
  const handleSelect = (cityName) => {
    setQuery(cityName)
    onChange(cityName)
    setSuggestions([])
    setIsOpen(false)
    setActiveIndex(-1)
    loadCityDetails(cityName)
  }

  // Handle Key Down
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      if (isOpen && activeIndex >= 0 && suggestions[activeIndex]) {
        e.preventDefault()
        const selectedItem = suggestions[activeIndex]
        const name = typeof selectedItem === 'string' ? selectedItem : selectedItem.display_name
        handleSelect(name)
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  // Fetch initial details if value is already preset on load (e.g. Bangalore, Delhi)
  useEffect(() => {
    if (value && !cityDetails) {
      loadCityDetails(value)
    }
  }, [value])

  const airports = cityDetails?.airports || []
  const stations = cityDetails?.railway_stations || []

  return (
    <div className={`input-wrapper autocomplete-wrapper ${theme === 'light' ? 'light-theme' : ''}`} ref={containerRef}>
      <input
        type="text"
        id={id}
        value={query}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
      />
      {isOpen && suggestions.length > 0 && (
        <ul className="autocomplete-dropdown open">
          {suggestions.map((item, index) => {
            const cityName = typeof item === 'string' ? item : item.display_name
            const state = (typeof item === 'object' && item.state) ? item.state : ''
            return (
              <li
                key={index}
                className={index === activeIndex ? 'active' : ''}
                onClick={() => handleSelect(cityName)}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span className="autocomplete-city-name">{cityName}</span>
                  {state && <span className="autocomplete-city-state">{state}</span>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      
      {theme !== 'light' && (airports.length > 0 || stations.length > 0) && (
        <div className="city-selection-badge">
          <div className="city-selection-badge-inner">
            {airports.slice(0, 1).map((a, idx) => (
              <span key={idx} className="badge badge-airport" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Plane size={10} /> {a.code} – {a.name}
              </span>
            ))}
            {stations.slice(0, 2).map((s, idx) => (
              <span key={idx} className="badge badge-train" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Train size={10} /> {s.code} – {s.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
