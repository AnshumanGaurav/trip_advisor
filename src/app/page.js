'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  Compass, MapPin, Plus, Plane, Train, Bus, Calendar, Sparkles, Globe,
  Award, Zap, Clock, CreditCard, Lock, Unlock, Check, Info, ShieldCheck,
  Trash2, ArrowRight, ArrowLeft, AlertTriangle
} from 'lucide-react'
import Autocomplete from '../components/Autocomplete'


// Dynamically import Chart.js since it relies on window/document object
let ChartInstance = null;

export default function VoyageOptimaDashboard() {
  // --- Form Input States ---
  const [sourceCity, setSourceCity] = useState('Bangalore')
  const [destinationCity, setDestinationCity] = useState('Bangalore')
  const [destinationTransport, setDestinationTransport] = useState('flight')
  const [destinationTransportClass, setDestinationTransportClass] = useState('Economy')
  const [startDate, setStartDate] = useState('')
  const [stops, setStops] = useState([
    { id: 1, city: 'Delhi', nights: 2, transport: 'flight', preferredClass: 'Economy' }
  ])
  const [stopCounter, setStopCounter] = useState(1)
  const [errorMsg, setErrorMsg] = useState(null)

  // --- App Flow States ---
  const [appState, setAppState] = useState('welcome') // 'welcome' | 'loading' | 'results'
  const [loadingStep, setLoadingStep] = useState(0) // 0 to 4 for animated radar logs

  // --- Backend Results & Local Updates ---
  const [apiResults, setApiResults] = useState(null)
  const [allOptions, setAllOptions] = useState([])
  const [baselineBounds, setBaselineBounds] = useState(null)
  const [activeOptionDate, setActiveOptionDate] = useState(null)
  
  // Custom user locks / preferences
  const [optimizationGoal, setOptimizationGoal] = useState('cost') // 'cost' | 'time'
  const [preferredDate, setPreferredDate] = useState(null)

  // --- Live API Call Counters ---
  const [flightApiCount, setFlightApiCount] = useState(0)
  const [trainApiCount, setTrainApiCount] = useState(0)

  // --- Chart Canvas Refs ---
  const costChartRef = useRef(null)
  const transitChartRef = useRef(null)
  const durationChartRef = useRef(null)

  // Chart instances
  const costChartInst = useRef(null)
  const transitChartInst = useRef(null)
  const durationChartInst = useRef(null)

  // --- Initialize Default Dates ---
  useEffect(() => {
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    setStartDate(tomorrow.toISOString().split('T')[0])
    fetchApiStats()
  }, [])

  // --- API Stats Polling ---
  const fetchApiStats = async () => {
    try {
      const res = await fetch('/api/stats')
      if (res.ok) {
        const stats = await res.json()
        setFlightApiCount(stats.flight_api_calls || 0)
        setTrainApiCount(stats.train_api_calls || 0)
      }
    } catch (err) {
      console.warn('Error fetching API stats:', err)
    }
  }

  // --- Date Formatting Helpers ---
  const formatDateString = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  }

  const formatShortDate = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Duration parser helpers
  const parseDurationToMinutes = (durStr) => {
    if (!durStr) return 0
    let totalMinutes = 0
    const hrMatch = durStr.match(/(\d+)\s*h/)
    const minMatch = durStr.match(/(\d+)\s*m/)
    if (hrMatch) totalMinutes += parseInt(hrMatch[1], 10) * 60
    if (minMatch) totalMinutes += parseInt(minMatch[1], 10)
    return totalMinutes
  }

  const formatMinutesToHoursMins = (totalMins) => {
    const hrs = Math.floor(totalMins / 60)
    const mins = totalMins % 60
    return `${hrs}h ${mins}m`
  }

  const getActiveTravelMins = (opt) => {
    if (!opt || !opt.legs) return 0
    return opt.legs.reduce((sum, leg) => sum + parseDurationToMinutes(leg.duration), 0)
  }

  // --- Dynamic Stops Add/Remove ---
  const handleAddStop = () => {
    const nextId = stopCounter + 1
    setStopCounter(nextId)
    setStops([...stops, { id: nextId, city: '', nights: 2, transport: 'flight', preferredClass: 'Economy' }])
  }

  const handleRemoveStop = (id) => {
    setStops(stops.filter(s => s.id !== id))
  }

  const handleStopChange = (id, field, value) => {
    setStops(stops.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  // Helper to calculate cheapest and fastest bounds per option
  const calculateOptionBounds = (opt) => {
    if (!opt.available) {
      return { cheapestCost: null, cheapestTransit: null, cheapestDuration: null, fastestCost: null, fastestTransit: null, fastestDuration: null }
    }

    let cheapestCost = 0
    let cheapestTransitMins = 0
    let cheapestStayNights = 0

    let fastestCost = 0
    let fastestTransitMins = 0
    let fastestStayNights = 0

    opt.legs.forEach(leg => {
      cheapestStayNights += (leg.nights || 0)
      fastestStayNights += (leg.nights || 0)

      const choices = []
      if (leg.mode === 'train' && leg.alternatives) {
        leg.alternatives.forEach(alt => {
          const classAvail = (alt.classAvailability || []).find(ca => ca.class === leg.selected_class)
          if (classAvail && classAvail.fare) {
            choices.push({
              cost: Math.ceil(classAvail.fare),
              duration: alt.duration
            })
          }
        })
      } else if (leg.mode === 'flight' && leg.alternatives) {
        leg.alternatives.forEach(alt => {
          const costVal = Math.ceil(alt.price !== undefined ? alt.price : alt.cost)
          choices.push({
            cost: costVal,
            duration: alt.duration
          })
        })
      } else if (leg.mode === 'bus' && leg.alternatives) {
        leg.alternatives.forEach(alt => {
          choices.push({
            cost: alt.price,
            duration: alt.duration
          })
        })
      }

      if (choices.length === 0) {
        choices.push({ cost: leg.cost, duration: leg.duration })
      }

      // Cheapest
      const cheapestChoice = choices.reduce((min, c) => c.cost < min.cost ? c : min, choices[0])
      cheapestCost += cheapestChoice.cost
      cheapestTransitMins += parseDurationToMinutes(cheapestChoice.duration)

      // Fastest
      const fastestChoice = choices.reduce((min, c) => parseDurationToMinutes(c.duration) < parseDurationToMinutes(min.duration) ? c : min, choices[0])
      fastestCost += fastestChoice.cost
      fastestTransitMins += parseDurationToMinutes(fastestChoice.duration)
    })

    const cheapestDurationDays = ((cheapestTransitMins / 60.0) + (cheapestStayNights * 24.0)) / 24.0
    const fastestDurationDays = ((fastestTransitMins / 60.0) + (fastestStayNights * 24.0)) / 24.0

    return {
      cheapestCost,
      cheapestTransit: cheapestTransitMins / 60.0,
      cheapestDuration: cheapestDurationDays,
      fastestCost,
      fastestTransit: fastestTransitMins / 60.0,
      fastestDuration: fastestDurationDays
    }
  }

  // --- Form Optimization Submit ---
  const handleOptimizeSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg(null)
    setAppState('loading')
    setLoadingStep(0)

    // Trigger sequential loading step simulation logs
    const interval = setInterval(() => {
      setLoadingStep(prev => {
        if (prev >= 4) {
          clearInterval(interval)
          return 4
        }
        return prev + 1
      })
    }, 550)

    try {
      const payload = {
        source: sourceCity,
        destination: destinationCity,
        destination_transport: destinationTransport,
        start_date: startDate,
        stops: stops.map(s => ({ city: s.city, nights: parseInt(s.nights, 10), transport: s.transport })),
        force_refresh: false
      }

      const response = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorDetails = await response.json()
        throw new Error(errorDetails.detail || 'Optimizer calculation failed.')
      }

      const data = await response.json()
      
      // Keep results
      setApiResults(data)
      setFlightApiCount(data.flight_api_calls || 0)
      setTrainApiCount(data.train_api_calls || 0)
      
      // Format backend options into local reactive options
      const initializedOptions = data.all_options.map(opt => {
        if (!opt.available) return opt
        return {
          ...opt,
          legs: opt.legs.map(leg => ({
            ...leg,
            locked: false,
            // Track active selections
            selected_class: leg.selected_class || (leg.mode === 'train' ? 'SL' : 'Economy')
          }))
        }
      })

      setAllOptions(initializedOptions)

      // Calculate baseline bounds once!
      const initialBounds = initializedOptions.map(opt => calculateOptionBounds(opt))
      setBaselineBounds({
        cheapestCosts: initialBounds.map(b => b.cheapestCost),
        fastestCosts: initialBounds.map(b => b.fastestCost),
        cheapestTransits: initialBounds.map(b => b.cheapestTransit),
        fastestTransits: initialBounds.map(b => b.fastestTransit),
        cheapestDurations: initialBounds.map(b => b.cheapestDuration),
        fastestDurations: initialBounds.map(b => b.fastestDuration)
      })
      
      // Find default active option based on initial cheapest
      const best = initializedOptions.find(o => o.start_date === data.best_option?.start_date) || initializedOptions.find(o => o.available)
      setActiveOptionDate(best ? best.start_date : null)
      setPreferredDate(null)
      setOptimizationGoal('cost')

      // Give 2.2 seconds log viewing time
      setTimeout(() => {
        setAppState('results')
      }, 2300)

    } catch (error) {
      clearInterval(interval)
      setErrorMsg(error.message)
      setAppState('welcome')
    }
  }

  // --- Optimization Goal Apply ---
  const applyGoalToOptionLegs = (option, goal) => {
    if (!option.available || preferredDate === option.start_date) return option

    const updatedLegs = option.legs.map(leg => {
      if (leg.locked) return leg // Skip changes on locked legs

      const choices = []
      if (leg.mode === 'train' && leg.alternatives) {
        leg.alternatives.forEach(alt => {
          const classAvail = (alt.classAvailability || []).find(ca => ca.class === leg.selected_class)
          if (classAvail && classAvail.fare) {
            choices.push({
              cost: Math.ceil(classAvail.fare),
              duration: alt.duration,
              etd: alt.etd,
              eta: alt.eta,
              transport_name: `${alt.trainNumber} - ${alt.trainName} (${leg.selected_class})`,
              trainNumber: alt.trainNumber
            })
          }
        })
      } else if (leg.mode === 'flight' && leg.alternatives) {
        leg.alternatives.forEach(alt => {
          const costVal = Math.ceil(alt.price !== undefined ? alt.price : alt.cost)
          choices.push({
            cost: costVal,
            duration: alt.duration,
            etd: alt.etd,
            eta: alt.eta,
            transport_name: alt.transport_name
          })
        })
      }

      if (choices.length === 0) return leg

      let selected
      if (goal === 'cost') {
        selected = choices.reduce((min, c) => c.cost < min.cost ? c : min, choices[0])
      } else {
        selected = choices.reduce((min, c) => parseDurationToMinutes(c.duration) < parseDurationToMinutes(min.duration) ? c : min, choices[0])
      }

      return {
        ...leg,
        cost: selected.cost,
        duration: selected.duration,
        etd: selected.etd,
        eta: selected.eta,
        transport_name: selected.transport_name,
        selected_train_number: selected.trainNumber,
        selected_flight_name: leg.mode === 'flight' ? selected.transport_name : undefined
      }
    })

    // Recalculate Option Totals
    const total_cost = updatedLegs.reduce((sum, l) => sum + l.cost, 0)
    const total_duration_mins = updatedLegs.reduce((sum, l) => sum + parseDurationToMinutes(l.duration), 0)
    
    // Add stay hours
    const total_stay_nights = updatedLegs.reduce((sum, l) => sum + (l.nights || 0), 0)
    const total_duration_hours = (total_duration_mins / 60.0) + (total_stay_nights * 24.0)

    const days = Math.floor(total_duration_hours / 24)
    const remainingHrs = Math.round(total_duration_hours % 24)
    const total_duration_str = `${days}d ${remainingHrs}h`

    return {
      ...option,
      legs: updatedLegs,
      total_cost,
      total_duration_hours,
      total_duration_str
    }
  }

  // --- Dynamic Option Calculations ---
  const getProcessedOptions = () => {
    return allOptions.map(opt => applyGoalToOptionLegs(opt, optimizationGoal))
  }

  const processedOptions = getProcessedOptions()
  const activeItinerary = processedOptions.find(o => o.start_date === activeOptionDate) || processedOptions.find(o => o.available)

  // Savings / Costs comparisons
  const availableOptions = processedOptions.filter(o => o.available)
  const cheapestItinerary = availableOptions.reduce((prev, curr) => prev?.total_cost < curr?.total_cost ? prev : curr, null)
  const fastestItinerary = availableOptions.reduce((prev, curr) => prev?.total_duration_hours < curr?.total_duration_hours ? prev : curr, null)

  const activeRecommended = optimizationGoal === 'cost' ? cheapestItinerary : fastestItinerary
  const averageCost = apiResults?.average_cost || 0
  const activeSavings = Math.max(0, averageCost - (activeRecommended?.total_cost || 0))

  // --- Leg Update Handler (Class Swapping & Async API Refresh) ---
  const handleLegClassChange = async (legIndex, newClass) => {
    const originalLeg = activeItinerary.legs[legIndex]
    
    // Update local state to show a mini loading state on that card
    setAllOptions(prev => prev.map(opt => {
      if (opt.start_date !== activeOptionDate) return opt
      return {
        ...opt,
        legs: opt.legs.map((leg, idx) => idx === legIndex ? { ...leg, loading: true } : leg)
      }
    }))

    try {
      const res = await fetch('/api/refresh-leg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_city: originalLeg.from_city,
          to_city: originalLeg.to_city,
          date: originalLeg.date,
          mode: originalLeg.mode,
          selected_class: newClass,
          force_refresh: false
        })
      })

      if (!res.ok) throw new Error('Failed to refresh leg details')
      const data = await res.json()

      // Fetch api stats
      fetchApiStats()

      // Update allOptions in state
      setAllOptions(prev => prev.map(opt => {
        if (opt.start_date !== activeOptionDate) return opt
        return {
          ...opt,
          legs: opt.legs.map((leg, idx) => {
            if (idx !== legIndex) return leg
            return {
              ...leg,
              selected_class: newClass,
              loading: false,
              alternatives: data.alternatives,
              // Pre-select cheapest or matching class alternative
              cost: data.cost,
              duration: data.duration,
              etd: data.etd,
              eta: data.eta,
              transport_name: data.transport_name
            }
          })
        }
      }))

    } catch (err) {
      alert(`Error updating leg: ${err.message}`)
      setAllOptions(prev => prev.map(opt => {
        if (opt.start_date !== activeOptionDate) return opt
        return {
          ...opt,
          legs: opt.legs.map((leg, idx) => idx === legIndex ? { ...leg, loading: false } : leg)
        }
      }))
    }
  }

  // --- Leg Lock Toggler ---
  const handleToggleLegLock = (legIndex) => {
    setAllOptions(prev => prev.map(opt => {
      if (opt.start_date !== activeOptionDate) return opt
      return {
        ...opt,
        legs: opt.legs.map((leg, idx) => idx === legIndex ? { ...leg, locked: !leg.locked } : leg)
      }
    }))
  }

  // --- Dynamic Alternative Swapper ---
  const handleSwapAlternative = (legIndex, alt) => {
    setAllOptions(prev => prev.map(opt => {
      if (opt.start_date !== activeOptionDate) return opt
      return {
        ...opt,
        legs: opt.legs.map((leg, idx) => {
          if (idx !== legIndex) return leg

          const isTrain = leg.mode === 'train'
          const costVal = isTrain
            ? Math.ceil((alt.classAvailability?.find(ca => ca.class === leg.selected_class)?.fare || leg.cost))
            : Math.ceil(alt.price !== undefined ? alt.price : alt.cost)

          return {
            ...leg,
            cost: costVal,
            duration: alt.duration,
            etd: alt.etd,
            eta: alt.eta,
            transport_name: isTrain ? `${alt.trainNumber} - ${alt.trainName} (${leg.selected_class})` : alt.transport_name,
            selected_train_number: isTrain ? alt.trainNumber : undefined,
            selected_flight_name: isTrain ? undefined : alt.transport_name,
            locked: true // Auto-lock leg on custom swap!
          }
        })
      }
    }))
  }

  // --- Chart.js Rendering Lifecycle ---
  useEffect(() => {
    if (appState !== 'results' || !processedOptions.length) return

    // Dynamically load Chart.js client-side
    const renderChartsAsync = async () => {
      if (!ChartInstance) {
        const ChartModule = await import('chart.js/auto')
        ChartInstance = ChartModule.default
      }

      const labels = processedOptions.map(opt => formatShortDate(opt.start_date))

      // Cost bounds
      const cheapestCosts = baselineBounds ? baselineBounds.cheapestCosts : processedOptions.map(() => null)
      const fastestCosts = baselineBounds ? baselineBounds.fastestCosts : processedOptions.map(() => null)
      const currentCosts = processedOptions.map(opt => opt.available ? opt.total_cost : null)

      // Transit bounds
      const cheapestTransits = baselineBounds ? baselineBounds.cheapestTransits : processedOptions.map(() => null)
      const fastestTransits = baselineBounds ? baselineBounds.fastestTransits : processedOptions.map(() => null)
      const currentTransits = processedOptions.map(opt => opt.available ? (getActiveTravelMins(opt) / 60.0) : null)

      // Duration bounds
      const cheapestDurations = baselineBounds ? baselineBounds.cheapestDurations : processedOptions.map(() => null)
      const fastestDurations = baselineBounds ? baselineBounds.fastestDurations : processedOptions.map(() => null)
      const currentDurations = processedOptions.map(opt => opt.available ? (opt.total_duration_hours / 24.0) : null)

      // 1. Cost Chart
      if (costChartRef.current) {
        if (costChartInst.current) costChartInst.current.destroy()
        costChartInst.current = new ChartInstance(costChartRef.current.getContext('2d'), {
          type: 'line',
          data: {
            labels,
            datasets: [
              {
                label: 'Cheapest (â‚¹)',
                data: cheapestCosts,
                borderColor: '#10b981',
                borderWidth: 2.5,
                tension: 0.3,
                backgroundColor: 'transparent',
                pointBackgroundColor: '#10b981',
                pointRadius: processedOptions.map(opt => opt.available ? 4 : 0)
              },
              {
                label: 'Fastest (â‚¹)',
                data: fastestCosts,
                borderColor: '#3b82f6',
                borderWidth: 2.5,
                tension: 0.3,
                backgroundColor: 'transparent',
                pointBackgroundColor: '#3b82f6',
                pointRadius: processedOptions.map(opt => opt.available ? 4 : 0)
              },
              {
                label: 'Your Selection (â‚¹)',
                data: currentCosts,
                borderColor: '#f59e0b',
                borderWidth: 2.5,
                borderDash: [5, 5],
                tension: 0.3,
                backgroundColor: 'transparent',
                pointBackgroundColor: '#f59e0b',
                pointRadius: processedOptions.map(opt => opt.start_date === activeOptionDate ? 8 : 0),
                pointStyle: processedOptions.map(opt => opt.start_date === activeOptionDate ? 'circle' : 'triangle')
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: true,
                labels: {
                  color: '#e2e8f0',
                  font: { family: 'Outfit', size: 9, weight: '500' },
                  boxWidth: 10,
                  boxHeight: 10,
                  padding: 8
                }
              }
            },
            scales: {
              x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#a9a3b8', font: { family: 'Inter', size: 10 } } },
              y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#a9a3b8', font: { family: 'Inter', size: 10 } } }
            },
            onClick: (e, elements) => {
              if (elements.length > 0) {
                const idx = elements[0].index
                if (processedOptions[idx].available) {
                  setActiveOptionDate(processedOptions[idx].start_date)
                }
              }
            }
          }
        })
      }

      // 2. Transit Chart
      if (transitChartRef.current) {
        if (transitChartInst.current) transitChartInst.current.destroy()
        transitChartInst.current = new ChartInstance(transitChartRef.current.getContext('2d'), {
          type: 'line',
          data: {
            labels,
            datasets: [
              {
                label: 'Cheapest (Hours)',
                data: cheapestTransits,
                borderColor: '#10b981',
                borderWidth: 2.5,
                tension: 0.3,
                backgroundColor: 'transparent',
                pointBackgroundColor: '#10b981',
                pointRadius: processedOptions.map(opt => opt.available ? 4 : 0)
              },
              {
                label: 'Fastest (Hours)',
                data: fastestTransits,
                borderColor: '#3b82f6',
                borderWidth: 2.5,
                tension: 0.3,
                backgroundColor: 'transparent',
                pointBackgroundColor: '#3b82f6',
                pointRadius: processedOptions.map(opt => opt.available ? 4 : 0)
              },
              {
                label: 'Your Selection (Hours)',
                data: currentTransits,
                borderColor: '#f59e0b',
                borderWidth: 2.5,
                borderDash: [5, 5],
                tension: 0.3,
                backgroundColor: 'transparent',
                pointBackgroundColor: '#f59e0b',
                pointRadius: processedOptions.map(opt => opt.start_date === activeOptionDate ? 8 : 0),
                pointStyle: processedOptions.map(opt => opt.start_date === activeOptionDate ? 'circle' : 'triangle')
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: true,
                labels: {
                  color: '#e2e8f0',
                  font: { family: 'Outfit', size: 9, weight: '500' },
                  boxWidth: 10,
                  boxHeight: 10,
                  padding: 8
                }
              }
            },
            scales: {
              x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#a9a3b8', font: { family: 'Inter', size: 10 } } },
              y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#a9a3b8', font: { family: 'Inter', size: 10 } } }
            },
            onClick: (e, elements) => {
              if (elements.length > 0) {
                const idx = elements[0].index
                if (processedOptions[idx].available) {
                  setActiveOptionDate(processedOptions[idx].start_date)
                }
              }
            }
          }
        })
      }

      // 3. Duration Chart
      if (durationChartRef.current) {
        if (durationChartInst.current) durationChartInst.current.destroy()
        durationChartInst.current = new ChartInstance(durationChartRef.current.getContext('2d'), {
          type: 'line',
          data: {
            labels,
            datasets: [
              {
                label: 'Cheapest (Days)',
                data: cheapestDurations,
                borderColor: '#10b981',
                borderWidth: 2.5,
                tension: 0.3,
                backgroundColor: 'transparent',
                pointBackgroundColor: '#10b981',
                pointRadius: processedOptions.map(opt => opt.available ? 4 : 0)
              },
              {
                label: 'Fastest (Days)',
                data: fastestDurations,
                borderColor: '#3b82f6',
                borderWidth: 2.5,
                tension: 0.3,
                backgroundColor: 'transparent',
                pointBackgroundColor: '#3b82f6',
                pointRadius: processedOptions.map(opt => opt.available ? 4 : 0)
              },
              {
                label: 'Your Selection (Days)',
                data: currentDurations,
                borderColor: '#f59e0b',
                borderWidth: 2.5,
                borderDash: [5, 5],
                tension: 0.3,
                backgroundColor: 'transparent',
                pointBackgroundColor: '#f59e0b',
                pointRadius: processedOptions.map(opt => opt.start_date === activeOptionDate ? 8 : 0),
                pointStyle: processedOptions.map(opt => opt.start_date === activeOptionDate ? 'circle' : 'triangle')
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: true,
                labels: {
                  color: '#e2e8f0',
                  font: { family: 'Outfit', size: 9, weight: '500' },
                  boxWidth: 10,
                  boxHeight: 10,
                  padding: 8
                }
              }
            },
            scales: {
              x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#a9a3b8', font: { family: 'Inter', size: 10 } } },
              y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#a9a3b8', font: { family: 'Inter', size: 10 } } }
            },
            onClick: (e, elements) => {
              if (elements.length > 0) {
                const idx = elements[0].index
                if (processedOptions[idx].available) {
                  setActiveOptionDate(processedOptions[idx].start_date)
                }
              }
            }
          }
        })
      }
    }

    renderChartsAsync()

    return () => {
      if (costChartInst.current) costChartInst.current.destroy()
      if (transitChartInst.current) transitChartInst.current.destroy()
      if (durationChartInst.current) durationChartInst.current.destroy()
    }
  }, [appState, activeOptionDate, optimizationGoal, allOptions, baselineBounds])

  // --- Scroll/Welcome button ---
  const handleScrollToForm = () => {
    setAppState('welcome')
    const form = document.getElementById('route-form')
    if (form) form.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="app-container">

      {/* ==================== WELCOME STATE: Hero Landing ==================== */}
      {appState === 'welcome' && (
        <div className="hero-landing">
          <div className="hero-overlay"></div>

          {/* TOP NAVIGATION */}
          <nav className="top-nav">
            <div className="nav-logo">
              <Compass className="nav-logo-icon" size={22} />
              <span>VoyageOptima</span>
            </div>
            <div className="nav-actions">
              <button className="nav-btn nav-btn-login" type="button">Log in</button>
              <button className="nav-btn nav-btn-signup" type="button">Sign up</button>
            </div>
          </nav>

          {/* HERO CONTENT */}
          <div className="hero-content">
            <h1 className="hero-title">Travel Planner</h1>
            <p className="hero-subtitle">Plan your next adventure</p>

            {/* FORM CARD */}
            <div className="landing-form-card">
              <form onSubmit={handleOptimizeSubmit}>

                {errorMsg && (
                  <div className="error-banner">
                    <div className="error-content-wrapper">
                      <AlertTriangle className="error-icon" size={18} />
                      <span className="error-text">{errorMsg}</span>
                    </div>
                    <button type="button" className="error-close-btn" onClick={() => setErrorMsg(null)}>×</button>
                  </div>
                )}

                {/* TOP ROW: Date | Source | Destination */}
                <div className="form-top-row">
                  <div className="landing-form-group">
                    <label className="landing-label">Start Date</label>
                    <div className="landing-input-wrapper">
                      <Calendar size={16} className="input-icon" />
                      <input
                        type="date"
                        className="landing-input has-icon"
                        id="start-date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="landing-form-group">
                    <label className="landing-label">Source</label>
                    <Autocomplete
                      id="source-city"
                      value={sourceCity}
                      onChange={setSourceCity}
                      placeholder="Source City"
                      required
                      theme="light"
                    />
                  </div>
                  <div className="landing-form-group">
                    <label className="landing-label">Destination</label>
                    <Autocomplete
                      id="destination-city"
                      value={destinationCity}
                      onChange={setDestinationCity}
                      placeholder="Destination City"
                      required
                      theme="light"
                    />
                  </div>
                </div>

                {/* STOPS SECTION */}
                <div className="stops-section-landing">
                  <p className="stops-header-text">Add cities you'd like to explore along the way</p>

                  {stops.map((stop, idx) => (
                    <div key={stop.id} className="stop-block">
                      <div className="stop-block-header">
                        <span className="stop-block-title">Stop {idx + 1}</span>
                        <button
                          type="button"
                          className="stop-delete-btn"
                          title="Remove Stop"
                          onClick={() => handleRemoveStop(stop.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="stop-row-fields">
                        <div className="landing-form-group stop-field-city">
                          <label className="landing-label">City</label>
                          <Autocomplete
                            value={stop.city}
                            onChange={(val) => handleStopChange(stop.id, 'city', val)}
                            placeholder="Search the city you want to explore"
                            required
                            theme="light"
                          />
                        </div>
                        <div className="landing-form-group stop-field-transport">
                          <label className="landing-label">Transport</label>
                          <select
                            className="landing-select"
                            value={stop.transport}
                            onChange={(e) => handleStopChange(stop.id, 'transport', e.target.value)}
                          >
                            <option value="flight">Flight</option>
                            <option value="train">Train</option>
                            <option value="bus">Bus</option>
                          </select>
                        </div>
                        <div className="landing-form-group stop-field-class">
                          <label className="landing-label">Preferred Class</label>
                          <select
                            className="landing-select"
                            value={stop.preferredClass || 'Economy'}
                            onChange={(e) => handleStopChange(stop.id, 'preferredClass', e.target.value)}
                          >
                            <option value="Economy">Economy</option>
                            <option value="Business">Business</option>
                            <option value="SL">SL</option>
                            <option value="3A">3A</option>
                            <option value="2A">2A</option>
                            <option value="1A">1A</option>
                          </select>
                        </div>
                        <div className="landing-form-group stop-field-nights">
                          <label className="landing-label">Nights</label>
                          <input
                            type="number"
                            className="landing-input"
                            min="0"
                            value={stop.nights}
                            onChange={(e) => handleStopChange(stop.id, 'nights', e.target.value)}
                            required
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <button type="button" className="btn-add-city" onClick={handleAddStop}>
                    <Plus size={16} /> Add City
                  </button>
                </div>

                {/* FINAL LEG TRANSPORT */}
                <div className="final-leg-section">
                  <div className="final-leg-row">
                    <div className="landing-form-group">
                      <label className="landing-label">Final leg transport</label>
                      <select
                        className="landing-select"
                        value={destinationTransport}
                        onChange={(e) => setDestinationTransport(e.target.value)}
                      >
                        <option value="flight">Flight</option>
                        <option value="train">Train</option>
                        <option value="bus">Bus</option>
                      </select>
                    </div>
                    <div className="landing-form-group">
                      <label className="landing-label">Class</label>
                      <select
                        className="landing-select"
                        value={destinationTransportClass}
                        onChange={(e) => setDestinationTransportClass(e.target.value)}
                      >
                        <option value="Economy">Economy</option>
                        <option value="Business">Business</option>
                        <option value="SL">SL</option>
                        <option value="3A">3A</option>
                        <option value="2A">2A</option>
                        <option value="1A">1A</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* OPTIMIZE BUTTON */}
                <button type="submit" className="btn-optimize-landing">
                  <Sparkles size={18} /> Optimize My Voyage
                </button>

              </form>
            </div>
          </div>
        </div>
      )}

      {/* ==================== LOADING STATE ==================== */}
      {appState === 'loading' && (
        <div className="loading-fullscreen">
          <div className="loading-card glass-panel">
            <div className="radar-container">
              <div className="radar-ring"></div>
              <div className="radar-ring"></div>
              <div className="radar-ring"></div>
              <Compass className="radar-icon animate-spin" />
            </div>
            <h3>Scanning Travel Window</h3>
            <p>Querying dynamic travel API endpoints for pricing & availability...</p>

            <div className="loading-logs">
              <div className={`log-line ${loadingStep >= 0 ? (loadingStep > 0 ? 'completed' : 'active') : ''}`}>
                {loadingStep > 0 ? <Check size={14} /> : <Compass size={14} className="spin" />}
                Fetching distances & coordinates...
              </div>
              <div className={`log-line ${loadingStep >= 1 ? (loadingStep > 1 ? 'completed' : 'active') : ''}`}>
                {loadingStep > 1 ? <Check size={14} /> : (loadingStep === 1 ? <Compass size={14} className="spin" /> : <Compass size={14} />)}
                Querying flight, train, and bus databases...
              </div>
              <div className={`log-line ${loadingStep >= 2 ? (loadingStep > 2 ? 'completed' : 'active') : ''}`}>
                {loadingStep > 2 ? <Check size={14} /> : (loadingStep === 2 ? <Compass size={14} className="spin" /> : <Compass size={14} />)}
                Summing up multi-leg combinations...
              </div>
              <div className={`log-line ${loadingStep >= 3 ? (loadingStep > 3 ? 'completed' : 'active') : ''}`}>
                {loadingStep > 3 ? <Check size={14} /> : (loadingStep === 3 ? <Compass size={14} className="spin" /> : <Compass size={14} />)}
                Identifying optimal cost valley...
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== RESULTS STATE ==================== */}
      {appState === 'results' && (
        <div className="results-fullwidth">

          {/* BACK BUTTON */}
          <button className="btn-back-to-form" onClick={() => setAppState('welcome')}>
            <ArrowLeft size={16} /> New Search
          </button>


          {/* OPTIMIZATION PREFERENCE PANEL */}
          <div className="optimization-preference-panel glass-panel">
            <div className="opt-preference-header">
              <div>
                <h4>Optimization Preference</h4>
                <p className="subtitle" style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                  Select your primary priority. The dashboard will dynamically update and calculate cost-time trade-offs.
                </p>
              </div>
              <div className="toggle-group">
                <button
                  className={`toggle-btn ${optimizationGoal === 'cost' ? 'active' : ''}`}
                  onClick={() => setOptimizationGoal('cost')}
                >
                  <CreditCard size={12} /> Cheapest
                </button>
                <button
                  className={`toggle-btn ${optimizationGoal === 'time' ? 'active' : ''}`}
                  onClick={() => setOptimizationGoal('time')}
                >
                  <Clock size={12} /> Fastest
                </button>
              </div>
            </div>

            {/* TRADE-OFF IMPACT BANNER */}
            <div className={`tradeoff-banner ${optimizationGoal === 'time' ? 'time-optimized' : ''}`}>
              <Info size={16} />
              <span>
                Currently optimizing for <strong>{optimizationGoal === 'cost' ? 'Cheapest' : 'Fastest'}</strong>. Showing the itinerary with the lowest {optimizationGoal === 'cost' ? 'financial impact' : 'transit time'}.
              </span>
            </div>
          </div>

          {/* TOP STATS CARDS */}
          <section className="stats-grid">
            {/* BEST START DATE (HERO) */}
            <div className="stat-card glass-panel highlight-card">
              <div className="card-glow"></div>
              <div className="stat-icon-wrapper savings-icon">
                <Award size={28} />
              </div>
              <div className="stat-info">
                <p className="stat-label">Best Start Date</p>
                <h3>{formatDateString(activeRecommended?.start_date)}</h3>
                <p className="stat-helper text-emerald">
                  <Compass size={14} /> Save â‚¹{Math.round(activeSavings)} (vs avg)
                </p>
              </div>
            </div>

            {/* CHEAPEST TOTAL COST */}
            <div className="stat-card glass-panel">
              <div className="stat-icon-wrapper cost-icon">
                <CreditCard size={28} />
              </div>
              <div className="stat-info">
                <p className="stat-label">Cheapest Total Cost</p>
                <h3>â‚¹{cheapestItinerary?.total_cost}</h3>
                <p className="stat-helper text-muted">All legs included</p>
              </div>
            </div>

            {/* FASTEST TRIP COST */}
            <div className="stat-card glass-panel">
              <div className="stat-icon-wrapper fastest-icon">
                <Zap size={28} />
              </div>
              <div className="stat-info">
                <p className="stat-label">Fastest Trip Cost</p>
                <h3>â‚¹{fastestItinerary?.total_cost}</h3>
                <p className="stat-helper text-cyan" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={10} /> Trip: {fastestItinerary?.total_duration_str}
                </p>
              </div>
            </div>
          </section>

          {/* CHART CONTAINER */}
          <section className="chart-section glass-panel">
            <div className="chart-header">
              <div>
                <h3>Trip Analytics Dashboard</h3>
                <p className="subtitle">Compare Cost, Active Transit Time & Elapsed Duration per Departure Date</p>
              </div>
              <div className="chart-legend">
                <span className="legend-cheapest"><span className="dot"></span> Selected Date</span>
                <span className="legend-standard"><span className="dot"></span> Other Dates</span>
                <span className="legend-soldout"><span className="dot"></span> Sold Out / Unavailable</span>
              </div>
            </div>

            <div className="charts-container charts-container-3">
              <div className="chart-box">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <CreditCard size={14} style={{ color: 'var(--accent-purple)' }} />
                  <h4 className="chart-box-title" style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                    Trip Cost (INR)
                  </h4>
                </div>
                <div className="chart-wrapper">
                  <canvas ref={costChartRef} id="cost-chart"></canvas>
                </div>
              </div>

              <div className="chart-box">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Zap size={14} style={{ color: '#3b82f6' }} />
                  <h4 className="chart-box-title" style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#3b82f6' }}>
                    Active Transit Time (Hours)
                  </h4>
                </div>
                <div className="chart-wrapper">
                  <canvas ref={transitChartRef} id="transit-chart"></canvas>
                </div>
              </div>

              <div className="chart-box">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Clock size={14} style={{ color: '#06b6d4' }} />
                  <h4 className="chart-box-title" style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#06b6d4' }}>
                    Total Trip Duration (Days)
                  </h4>
                </div>
                <div className="chart-wrapper">
                  <canvas ref={durationChartRef} id="duration-chart"></canvas>
                </div>
              </div>
            </div>
          </section>

          {/* ITINERARY TIMELINE & BREAKDOWN */}
          <section className="details-grid">

            {/* LEFT COLUMN: Timeline */}
            <div className="timeline-column glass-panel">
              <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3>Itinerary Timeline</h3>
                  <p className="subtitle">Detailed breakdown for trip starting on {formatDateString(activeItinerary?.start_date)}</p>
                </div>
                <button
                  className={`btn btn-secondary btn-sm ${preferredDate === activeOptionDate ? 'btn-preferred-active' : ''}`}
                  style={{ borderRadius: '20px' }}
                  onClick={() => setPreferredDate(preferredDate === activeOptionDate ? null : activeOptionDate)}
                >
                  <Check size={12} /> {preferredDate === activeOptionDate ? 'Locked Preference' : 'Set as Preference'}
                </button>
              </div>

              {/* DATE SELECTOR STRIP */}
              <div className="date-selector-strip">
                {processedOptions.map(opt => {
                  const isCheapest = opt.start_date === cheapestItinerary?.start_date
                  const isFastest = opt.start_date === fastestItinerary?.start_date
                  const isActive = opt.start_date === activeOptionDate
                  const isPreferred = opt.start_date === preferredDate

                  const d = new Date(opt.start_date)
                  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' })
                  const dayNum = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })

                  return (
                    <div
                      key={opt.start_date}
                      className={`date-card ${isActive ? 'active' : ''} ${!opt.available ? 'sold-out' : ''} ${isPreferred ? 'preferred-choice' : ''}`}
                      onClick={() => opt.available && setActiveOptionDate(opt.start_date)}
                    >
                      {isPreferred && (
                        <span className="date-card-badge badge-cheapest-date" style={{ background: '#10b981', color: '#fff' }}>â­ Locked</span>
                      )}
                      {!isPreferred && isCheapest && (
                        <span className="date-card-badge badge-cheapest-date">Cheapest</span>
                      )}
                      {!isPreferred && !isCheapest && isFastest && (
                        <span className="date-card-badge badge-cheapest-date" style={{ background: '#06b6d4', color: '#fff' }}>Fastest</span>
                      )}
                      {!opt.available && (
                        <span className="date-card-badge badge-soldout-date">Sold Out</span>
                      )}

                      {opt.available && (
                        <button
                          className={`date-card-lock-btn ${isPreferred ? 'locked' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            setPreferredDate(isPreferred ? null : opt.start_date)
                          }}
                          title="Lock Date Option"
                        >
                          {isPreferred ? <Lock size={10} /> : <Unlock size={10} />}
                        </button>
                      )}

                      <span className="date-card-weekday">{weekday}</span>
                      <span className="date-card-day">{dayNum}</span>
                      <span className="date-card-price">{opt.available ? `â‚¹${opt.total_cost}` : 'â€”'}</span>
                    </div>
                  )
                })}
              </div>

              {/* TIMELINE CONTAINER */}
              <div className="timeline-container">
                {activeItinerary?.legs?.map((leg, legIdx) => {
                  const isLast = legIdx === activeItinerary.legs.length - 1
                  return (
                    <div key={legIdx} className="timeline-node" style={{ position: 'relative' }}>
                      {leg.loading && (
                        <div className="card-mini-loader">
                          <Compass className="animate-spin" /> Querying Travel APIs...
                        </div>
                      )}

                      <div className={`timeline-indicator ${legIdx === 0 ? 'ind-start' : (leg.mode === 'flight' ? 'ind-flight' : leg.mode === 'train' ? 'ind-train' : 'ind-bus')}`}>
                        {legIdx === 0 ? <MapPin size={12} /> : (leg.mode === 'flight' ? <Plane size={12} /> : <Train size={12} />)}
                      </div>

                      <div className="timeline-content">
                        <div className="timeline-content-header">
                          <h4>
                            {leg.from_city} <ArrowRight size={14} style={{ display: 'inline', margin: '0 6px', verticalAlign: 'middle' }} /> {leg.to_city}
                          </h4>
                          <span className="timeline-date">{formatDateString(leg.date)}</span>
                        </div>

                        <div className="timeline-metrics" style={{ margin: '8px 0', display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                          <span style={{ color: 'var(--accent-purple)', fontWeight: '700' }}><CreditCard size={14} /> â‚¹{leg.cost}</span>
                          <span><Clock size={14} /> {leg.duration}</span>
                          <span>Dep: {leg.etd} â€“ Arr: {leg.eta}</span>

                          {/* CLASS SELECTOR */}
                          {leg.mode === 'train' && (
                            <div className="train-class-select-container">
                              <span className="train-class-label">Class</span>
                              <select
                                className="train-class-select"
                                value={leg.selected_class}
                                onChange={(e) => handleLegClassChange(legIdx, e.target.value)}
                              >
                                {['SL', '3A', '2A', '1A'].map(tc => (
                                  <option key={tc} value={tc}>{tc}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {leg.mode === 'flight' && (
                            <div className="flight-class-select-container">
                              <span className="flight-class-label">Class</span>
                              <select
                                className="flight-class-select"
                                value={leg.selected_class}
                                onChange={(e) => handleLegClassChange(legIdx, e.target.value)}
                              >
                                {['Economy', 'Business'].map(fc => (
                                  <option key={fc} value={fc}>{fc}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* LEG LOCK BUTTON */}
                          <button
                            className={`leg-lock-btn ${leg.locked ? 'locked' : ''}`}
                            onClick={() => handleToggleLegLock(legIdx)}
                            title={leg.locked ? 'Unlock choice' : 'Lock choice'}
                          >
                            {leg.locked ? <Lock size={10} style={{ display: 'inline', marginRight: '4px' }} /> : <Unlock size={10} style={{ display: 'inline', marginRight: '4px' }} />}
                            {leg.locked ? 'Locked' : 'Lock Leg'}
                          </button>
                        </div>

                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0' }}>
                          Active Transport: <strong>{leg.transport_name}</strong>
                        </p>

                        {/* ALTERNATIVES PREMIUM TABLE */}
                        {leg.alternatives && leg.alternatives.length > 0 && (
                          <div className="alternatives-container">
                            <table className="alternatives-table">
                              <thead>
                                <tr>
                                  <th>Alternative Option</th>
                                  <th>Times</th>
                                  <th>Duration</th>
                                  <th>Cost</th>
                                  <th>Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {leg.alternatives.map((alt, altIdx) => {
                                  const altCost = leg.mode === 'train'
                                    ? Math.ceil((alt.classAvailability?.find(ca => ca.class === leg.selected_class)?.fare || leg.cost))
                                    : Math.ceil(alt.price !== undefined ? alt.price : alt.cost)

                                  const isSelected = leg.mode === 'train'
                                    ? leg.selected_train_number === alt.trainNumber
                                    : leg.selected_flight_name === alt.transport_name

                                  return (
                                    <tr key={altIdx} style={isSelected ? { background: 'rgba(139, 92, 246, 0.1)' } : {}}>
                                      <td>
                                        <div className="alternatives-carrier">
                                          {leg.mode === 'flight' ? <Plane size={12} /> : <Train size={12} />}
                                          {leg.mode === 'flight' ? alt.transport_name : `${alt.trainNumber} - ${alt.trainName}`}
                                        </div>
                                        {leg.mode === 'train' && (
                                          <div className="train-meta-details">
                                            <span className="train-rating">â˜… {alt.rating || '4.0'}</span>
                                            <span className={`train-pantry ${alt.hasPantry ? 'has-pantry' : ''}`}>
                                              Pantry: {alt.hasPantry ? 'Yes' : 'No'}
                                            </span>
                                          </div>
                                        )}
                                      </td>
                                      <td>{alt.etd} â€“ {alt.eta}</td>
                                      <td>{alt.duration}</td>
                                      <td className="alternatives-price">â‚¹{altCost}</td>
                                      <td>
                                        <button
                                          className={`btn btn-secondary btn-sm`}
                                          style={{ padding: '4px 8px', fontSize: '10px' }}
                                          onClick={() => handleSwapAlternative(legIdx, alt)}
                                        >
                                          {isSelected ? 'Selected' : 'Swap'}
                                        </button>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* NIGHTS STAY BANNER */}
                        {leg.nights > 0 && (
                          <div className="timeline-stay">
                            <Compass size={14} /> Stay {leg.nights} Nights in {leg.to_city}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* FINAL TERMINAL NODE */}
                <div className="timeline-node">
                  <div className="timeline-indicator ind-end">
                    <Award size={12} />
                  </div>
                  <div className="timeline-content" style={{ background: 'rgba(244, 63, 94, 0.05)', borderColor: 'rgba(244, 63, 94, 0.15)' }}>
                    <div className="timeline-content-header">
                      <h4 style={{ color: 'var(--color-danger)' }}>Final Destination Reached!</h4>
                      <span className="timeline-date" style={{ color: 'var(--color-danger)' }}>
                        {formatDateString(activeItinerary?.arrival_date)}
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      End of voyage at <strong>{destinationCity}</strong>. All multi-leg date optimization windows mapped successfully!
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Journey Summary */}
            <div className="summary-column glass-panel">
              <div className="panel-header">
                <h3>Journey Summary</h3>
                <p className="subtitle">Key insights and details</p>
              </div>

              <div className="journey-stats-card">
                <div className="journey-summary-row">
                  <span className="label"><Plane size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '5px' }} /> Departs:</span>
                  <span className="value" style={{ color: 'var(--accent-purple)', fontWeight: '700' }}>
                    {formatDateString(activeItinerary?.start_date)}
                  </span>
                </div>
                <div className="journey-summary-row">
                  <span className="label"><Award size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '5px' }} /> Arrives:</span>
                  <span className="value" style={{ color: '#10b981', fontWeight: '700' }}>
                    {formatDateString(activeItinerary?.arrival_date)}
                  </span>
                </div>
                <div className="journey-summary-row" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '6px', paddingTop: '10px' }}>
                  <span className="label">Total Stops:</span>
                  <span className="value">{activeItinerary?.legs?.length - 1}</span>
                </div>
                <div className="journey-summary-row">
                  <span className="label">Total Nights:</span>
                  <span className="value">{activeItinerary?.legs?.reduce((sum, l) => sum + (l.nights || 0), 0)}</span>
                </div>
                <div className="journey-summary-row">
                  <span className="label">Trip Duration (Elapsed):</span>
                  <span className="value">{activeItinerary?.total_duration_str}</span>
                </div>
                <div className="journey-summary-row">
                  <span className="label">Active Travel Time:</span>
                  <span className="value" style={{ color: 'var(--accent-cyan)', fontWeight: '700' }}>
                    {formatMinutesToHoursMins(getActiveTravelMins(activeItinerary))}
                  </span>
                </div>
              </div>

              <div className="travel-advisory-card">
                <div className="advisory-icon"><ShieldCheck size={24} /></div>
                <div>
                  <h4>Voyage Guarantee</h4>
                  <p>We automatically filter out any start dates that contain sold-out legs, ensuring 100% reservation confidence.</p>
                </div>
              </div>
            </div>

          </section>

        </div>
      )}

    </div>
  )
}

