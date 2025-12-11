"use client"

import React, { useState, useEffect, useMemo } from 'react'

interface Event {
  id: string
  clientId: string
  eventName: string
  zipCode: string
  address?: string
  latitude: number
  longitude: number
  startDate: string
  endDate: string
  status: 'active' | 'completed' | 'cancelled'
  notes: string
  conflicts: string[]
}

interface Client {
  id: string
  name: string
  contactEmail: string
  contactPhone: string
  assignedZipCodes: string[]
  color: string
  status: 'active' | 'inactive'
  createdDate: string
}

const generateId = () => Math.random().toString(36).substr(2, 9)

const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 3959
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

const getZipCodeCoordinates = (zipCode: string) => {
  const hash = zipCode.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return {
    zipCode,
    latitude: 40.7128 + (hash % 200) / 100 - 1,
    longitude: -74.0060 + (hash % 200) / 100 - 1,
    city: 'City',
    state: 'NY'
  }
}

const initialClients: Client[] = [
  { 
    id: '1', 
    name: 'Acme Events', 
    contactEmail: 'contact@acme.com', 
    contactPhone: '555-0101', 
    assignedZipCodes: ['10001', '10002', '10003'], 
    color: '#3b82f6',
    status: 'active',
    createdDate: '2024-01-15'
  },
  { 
    id: '2', 
    name: 'Premier Productions', 
    contactEmail: 'info@premier.com', 
    contactPhone: '555-0102', 
    assignedZipCodes: ['10004', '10005'], 
    color: '#10b981',
    status: 'active',
    createdDate: '2024-01-20'
  },
]

const initialEvents: Event[] = [
  {
    id: '1',
    clientId: '1',
    eventName: 'Corporate Gala 2024',
    zipCode: '10001',
    address: '123 Main St, New York, NY 10001',
    latitude: 40.7489,
    longitude: -73.9680,
    startDate: '2024-03-15',
    endDate: '2024-03-15',
    status: 'active',
    notes: 'Annual corporate event',
    conflicts: []
  },
]

export default function TerritoryManagementApp() {
  const [activeTab, setActiveTab] = useState<'map' | 'events' | 'clients' | 'upload'>('map')
  const [clients, setClients] = useState<Client[]>(initialClients)
  const [events, setEvents] = useState<Event[]>(initialEvents)
  const [showEventForm, setShowEventForm] = useState(false)
  const [showClientForm, setShowClientForm] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterClient, setFilterClient] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [showActiveOnly, setShowActiveOnly] = useState(true)
  const [uploadFile, setUploadFile] = useState<File | null>(null)

  const [eventForm, setEventForm] = useState({
    clientId: '',
    eventName: '',
    zipCode: '',
    address: '',
    startDate: '',
    endDate: '',
    status: 'active' as 'active' | 'completed' | 'cancelled',
    notes: ''
  })

  const [clientForm, setClientForm] = useState({
    name: '',
    contactEmail: '',
    contactPhone: '',
    assignedZipCodes: '',
    status: 'active' as 'active' | 'inactive'
  })

  useEffect(() => {
    const savedClients = localStorage.getItem('territoryClientsV2')
    const savedEvents = localStorage.getItem('territoryEventsV2')
    
    if (savedClients) setClients(JSON.parse(savedClients))
    if (savedEvents) setEvents(JSON.parse(savedEvents))
  }, [])

  useEffect(() => {
    localStorage.setItem('territoryClientsV2', JSON.stringify(clients))
  }, [clients])

  useEffect(() => {
    localStorage.setItem('territoryEventsV2', JSON.stringify(events))
  }, [events])

  useEffect(() => {
    const updatedEvents = events.map(event => {
      const conflicts: string[] = []
      
      events.forEach(otherEvent => {
        if (event.id !== otherEvent.id) {
          const eventStart = new Date(event.startDate)
          const eventEnd = new Date(event.endDate)
          const otherStart = new Date(otherEvent.startDate)
          const otherEnd = new Date(otherEvent.endDate)
          
          const datesOverlap = eventStart <= otherEnd && eventEnd >= otherStart
          
          if (datesOverlap) {
            const distance = haversineDistance(
              event.latitude,
              event.longitude,
              otherEvent.latitude,
              otherEvent.longitude
            )
            
            if (distance <= 15) {
              conflicts.push(otherEvent.id)
            }
          }
        }
      })
      
      return { ...event, conflicts }
    })
    
    if (JSON.stringify(updatedEvents) !== JSON.stringify(events)) {
      setEvents(updatedEvents)
    }
  }, [events])

  const checkConflicts = (newEvent: Partial<Event>): string[] => {
    if (!newEvent.latitude || !newEvent.longitude || !newEvent.startDate) return []
    
    const conflicts: string[] = []
    const eventStart = new Date(newEvent.startDate)
    const eventEnd = new Date(newEvent.endDate || newEvent.startDate)
    
    events.forEach(event => {
      const otherStart = new Date(event.startDate)
      const otherEnd = new Date(event.endDate)
      
      const datesOverlap = eventStart <= otherEnd && eventEnd >= otherStart
      
      if (datesOverlap) {
        const distance = haversineDistance(
          newEvent.latitude!,
          newEvent.longitude!,
          event.latitude,
          event.longitude
        )
        
        if (distance <= 15) {
          conflicts.push(event.id)
        }
      }
    })
    
    return conflicts
  }

  const checkZipCodeRights = (clientId: string, zipCode: string): boolean => {
    const client = clients.find(c => c.id === clientId)
    if (!client) return false
    
    const otherClientHasZip = clients.some(c => 
      c.id !== clientId && c.status === 'active' && c.assignedZipCodes.includes(zipCode)
    )
    
    return !otherClientHasZip || client.assignedZipCodes.includes(zipCode)
  }

  const handleEventSubmit = () => {
    if (!eventForm.zipCode) {
      alert('Zip code is required')
      return
    }

    if (!checkZipCodeRights(eventForm.clientId, eventForm.zipCode)) {
      alert(`This zip code (${eventForm.zipCode}) is assigned to another client. You cannot schedule events here.`)
      return
    }
    
    const coords = getZipCodeCoordinates(eventForm.zipCode)
    
    const newEvent: Event = {
      id: selectedEvent?.id || generateId(),
      clientId: eventForm.clientId,
      eventName: eventForm.eventName,
      zipCode: eventForm.zipCode,
      address: eventForm.address,
      latitude: coords.latitude,
      longitude: coords.longitude,
      startDate: eventForm.startDate,
      endDate: eventForm.endDate || eventForm.startDate,
      status: eventForm.status,
      notes: eventForm.notes,
      conflicts: []
    }
    
    const conflicts = checkConflicts(newEvent)
    
    if (conflicts.length > 0 && !selectedEvent) {
      const conflictDetails = conflicts.map(id => {
        const event = events.find(e => e.id === id)
        return event ? `${event.eventName} (${event.zipCode})` : ''
      }).join(', ')
      
      const proceed = window.confirm(
        `Warning: This event conflicts with ${conflicts.length} existing event(s): ${conflictDetails}. Do you want to proceed anyway?`
      )
      
      if (!proceed) return
    }
    
    if (selectedEvent) {
      setEvents(events.map(e => e.id === selectedEvent.id ? newEvent : e))
    } else {
      setEvents([...events, newEvent])
    }
    
    resetEventForm()
  }

  const resetEventForm = () => {
    setEventForm({
      clientId: '',
      eventName: '',
      zipCode: '',
      address: '',
      startDate: '',
      endDate: '',
      status: 'active',
      notes: ''
    })
    setSelectedEvent(null)
    setShowEventForm(false)
  }

  const handleClientSubmit = () => {
    const zipCodes = clientForm.assignedZipCodes
      .split(',')
      .map(z => z.trim())
      .filter(z => z.match(/^\d{5}$/))
    
    const newClient: Client = {
      id: selectedClient?.id || generateId(),
      name: clientForm.name,
      contactEmail: clientForm.contactEmail,
      contactPhone: clientForm.contactPhone,
      assignedZipCodes: zipCodes,
      color: selectedClient?.color || `#${Math.floor(Math.random()*16777215).toString(16)}`,
      status: clientForm.status,
      createdDate: selectedClient?.createdDate || new Date().toISOString().split('T')[0]
    }
    
    if (selectedClient) {
      setClients(clients.map(c => c.id === selectedClient.id ? newClient : c))
    } else {
      setClients([...clients, newClient])
    }
    
    resetClientForm()
  }

  const resetClientForm = () => {
    setClientForm({
      name: '',
      contactEmail: '',
      contactPhone: '',
      assignedZipCodes: '',
      status: 'active'
    })
    setSelectedClient(null)
    setShowClientForm(false)
  }

  const handleEditEvent = (event: Event) => {
    setSelectedEvent(event)
    setEventForm({
      clientId: event.clientId,
      eventName: event.eventName,
      zipCode: event.zipCode,
      address: event.address || '',
      startDate: event.startDate,
      endDate: event.endDate,
      status: event.status,
      notes: event.notes
    })
    setShowEventForm(true)
  }

  const handleEditClient = (client: Client) => {
    setSelectedClient(client)
    setClientForm({
      name: client.name,
      contactEmail: client.contactEmail,
      contactPhone: client.contactPhone,
      assignedZipCodes: client.assignedZipCodes.join(', '),
      status: client.status
    })
    setShowClientForm(true)
  }

  const handleDeleteEvent = (id: string) => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      setEvents(events.filter(e => e.id !== id))
    }
  }

  const handleDeleteClient = (id: string) => {
    if (window.confirm('Are you sure you want to delete this client? All associated events will also be deleted.')) {
      setClients(clients.filter(c => c.id !== id))
      setEvents(events.filter(e => e.clientId !== id))
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadFile(file)
      alert('Excel file uploaded successfully! In production, this would parse the file and import clients.')
    }
  }

  const downloadTemplate = () => {
    const template = `Client Name,Contact Email,Contact Phone,Assigned Zip Codes (comma-separated),Status
Acme Events,contact@acme.com,555-0101,"10001,10002,10003",active
Premier Productions,info@premier.com,555-0102,"10004,10005",active`
    
    const blob = new Blob([template], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'client-import-template.csv'
    a.click()
  }

  const exportData = () => {
    const data = {
      clients,
      events,
      exportDate: new Date().toISOString()
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `territory-data-${new Date().toISOString().split('T')[0]}.json`
    a.click()
  }

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      const matchesSearch = event.eventName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          event.zipCode.includes(searchTerm)
      const matchesClient = filterClient === 'all' || event.clientId === filterClient
      const matchesStatus = filterStatus === 'all' || event.status === filterStatus
      const matchesActive = !showActiveOnly || event.status === 'active'
      
      return matchesSearch && matchesClient && matchesStatus && matchesActive
    })
  }, [events, searchTerm, filterClient, filterStatus, showActiveOnly])

  const displayedEvents = showActiveOnly ? filteredEvents.filter(e => e.status === 'active') : filteredEvents

  const stats = useMemo(() => {
    const activeEvents = events.filter(e => e.status === 'active').length
    const totalConflicts = events.reduce((sum, e) => sum + e.conflicts.length, 0) / 2
    const activeClients = clients.filter(c => c.status === 'active').length
    const totalZipCodes = new Set(clients.flatMap(c => c.assignedZipCodes)).size
    
    return { activeEvents, totalConflicts, activeClients, totalZipCodes }
  }, [events, clients])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Territory Manager</h1>
                <p className="text-xs text-gray-500">Event Territory Management System</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => setShowEventForm(true)} 
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-sm text-sm font-medium"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Event
              </button>
              <button 
                onClick={() => setShowClientForm(true)} 
                className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                New Client
              </button>
              <button 
                onClick={exportData}
                className="inline-flex items-center px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                title="Export Data"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-4 py-4 border-t border-gray-200">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.activeEvents}</p>
              <p className="text-xs text-gray-600">Active Events</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{stats.totalConflicts}</p>
              <p className="text-xs text-gray-600">Conflicts</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{stats.activeClients}</p>
              <p className="text-xs text-gray-600">Active Clients</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">{stats.totalZipCodes}</p>
              <p className="text-xs text-gray-600">Zip Codes</p>
            </div>
          </div>
          
          <div className="flex space-x-8 border-t border-gray-200">
            {['map', 'events', 'clients', 'upload'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors capitalize ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab === 'upload' ? 'Import/Export' : tab}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'map' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showActiveOnly}
                      onChange={(e) => setShowActiveOnly(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Show Active Events Only</span>
                  </label>
                  
                  <select
                    value={filterClient}
                    onChange={(e) => setFilterClient(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Clients</option>
                    {clients.filter(c => c.status === 'active').map(client => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="text-sm text-gray-600">
                  Displaying {displayedEvents.length} event(s)
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold">Territory Map</h2>
                <p className="text-sm text-gray-600 mt-1">Visual representation of all events with 15-mile radius zones</p>
              </div>
              <div className="p-6">
                <div className="relative bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg overflow-hidden border-2 border-blue-200" style={{ height: '600px' }}>
                  <div className="absolute inset-0" style={{
                    backgroundImage: 'linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px)',
                    backgroundSize: '50px 50px'
                  }} />
                  
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative w-full h-full">
                      {displayedEvents.map(event => {
                        const client = clients.find(c => c.id === event.clientId)
                        const hasConflicts = event.conflicts.length > 0
                        
                        return (
                          <div
                            key={event.id}
                            className="absolute cursor-pointer group"
                            style={{
                              left: `${((event.longitude + 74.0060) / 0.5) * 100}%`,
                              top: `${((40.8 - event.latitude) / 0.2) * 100}%`,
                              transform: 'translate(-50%, -50%)'
                            }}
                          >
                            <div
                              className={`absolute rounded-full border-2 transition-all duration-300 ${
                                hasConflicts 
                                  ? 'bg-red-500 border-red-600 opacity-30 animate-pulse' 
                                  : 'bg-blue-500 border-blue-600 opacity-20'
                              }`}
                              style={{
                                width: '140px',
                                height: '140px',
                                left: '50%',
                                top: '50%',
                                transform: 'translate(-50%, -50%)'
                              }}
                            />
                            
                            <div
                              className={`w-10 h-10 rounded-full border-3 shadow-xl flex items-center justify-center transform transition-all duration-200 hover:scale-125 ${
                                hasConflicts ? 'border-red-700 animate-bounce' : 'border-white'
                              }`}
                              style={{ backgroundColor: client?.color }}
                            >
                              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                              </svg>
                            </div>
                            
                            <div className="absolute left-full ml-3 top-0 bg-white rounded-lg shadow-2xl p-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 border border-gray-200">
                              <div className="flex items-center space-x-2 mb-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: client?.color }} />
                                <p className="font-bold text-base">{event.eventName}</p>
                              </div>
                              <p className="text-sm text-gray-700 font-medium">{client?.name}</p>
                              <p className="text-xs text-gray-600 mt-1"><strong>Zip:</strong> {event.zipCode}</p>
                              {event.address && <p className="text-xs text-gray-500 mt-1">{event.address}</p>}
                              <p className="text-xs text-gray-600 mt-1 font-semibold">{event.startDate} to {event.endDate}</p>
                              {hasConflicts && (
                                <div className="mt-2 pt-2 border-t border-gray-200">
                                  <p className="text-xs text-red-700 flex items-center font-bold">
                                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    {event.conflicts.length} Conflict{event.conflicts.length > 1 ? 's' : ''}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  
                  <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-xl p-4 space-y-3 border border-gray-200 max-h-96 overflow-y-auto">
                    <p className="font-bold text-sm mb-3 text-gray-800">Legend</p>
                    {clients.filter(c => c.status === 'active').map(client => (
                      <div key={client.id} className="flex items-center space-x-3">
                        <div
                          className="w-5 h-5 rounded-full border-2 border-white shadow-md flex-shrink-0"
                          style={{ backgroundColor: client.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-700 block truncate">{client.name}</span>
                          <span className="text-xs text-gray-500">{client.assignedZipCodes.length} zip codes</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'events' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Search Events</label>
                  <input
                    type="text"
                    placeholder="Search by name or zip..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Filter by Client</label>
                  <select
                    value={filterClient}
                    onChange={(e) => setFilterClient(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Clients</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Filter by Status</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setSearchTerm('')
                      setFilterClient('all')
                      setFilterStatus('all')
                    }}
                    className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {filteredEvents.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 py-12 text-center">
                  <p className="text-gray-500">No events found</p>
                  <button
                    onClick={() => setShowEventForm(true)}
                    className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Create First Event
                  </button>
                </div>
              ) : (
                filteredEvents.map(event => {
                  const client = clients.find(c => c.id === event.clientId)
                  const hasConflicts = event.conflicts.length > 0
                  
                  return (
                    <div key={event.id} className={`bg-white rounded-lg shadow-sm border p-6 ${hasConflicts ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-3">
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: client?.color }} />
                            <h3 className="text-lg font-semibold">{event.eventName}</h3>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              event.status === 'active' ? 'bg-green-100 text-green-800' :
                              event.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {event.status}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                            <div>
                              <p><strong>Client:</strong> {client?.name}</p>
                              <p><strong>Zip Code:</strong> {event.zipCode}</p>
                              {event.address && <p><strong>Address:</strong> {event.address}</p>}
                            </div>
                            <div>
                              <p><strong>Start:</strong> {event.startDate}</p>
                              <p><strong>End:</strong> {event.endDate}</p>
                              {event.notes && <p><strong>Notes:</strong> {event.notes}</p>}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex space-x-2 ml-4">
                          <button
                            onClick={() => handleEditEvent(event)}
                            className="p-2 text-gray-600 hover:text-blue-600 border border-gray-300 rounded-md"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteEvent(event.id)}
                            className="p-2 text-gray-600 hover:text-red-600 border border-gray-300 rounded-md"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'clients' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clients.map(client => {
              const clientEvents = events.filter(e => e.clientId === client.id)
              
              return (
                <div key={client.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
                  <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-5 h-5 rounded-full" style={{ backgroundColor: client.color }} />
                        <h3 className="text-lg font-semibold">{client.name}</h3>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        client.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {client.status}
                      </span>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditClient(client)}
                        className="flex-1 px-3 py-1.5 text-sm text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteClient(client.id)}
                        className="flex-1 px-3 py-1.5 text-sm text-red-600 border border-red-600 rounded-md hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  
                  <div className="p-6 space-y-4">
                    <div className="space-y-2 text-sm">
                      <p><strong>Email:</strong> {client.contactEmail}</p>
                      <p><strong>Phone:</strong> {client.contactPhone}</p>
                      <p><strong>Events:</strong> {clientEvents.length}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm font-semibold mb-2">Assigned Territories ({client.assignedZipCodes.length})</p>
                      <div className="flex flex-wrap gap-2">
                        {client.assignedZipCodes.map(zip => (
                          <span key={zip} className="px-2.5 py-1 rounded-md text-xs font-medium bg-purple-100 text-purple-800">
                            {zip}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold mb-4">Import Clients</h3>
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <p className="text-sm text-gray-600 mb-2">Click to upload Excel or CSV</p>
                    </label>
                  </div>
                  
                  <button
                    onClick={downloadTemplate}
                    className="w-full px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                  >
                    Download Template
                  </button>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold mb-4">Export Data</h3>
                <button
                  onClick={exportData}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
                >
                  Export All Data
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {showEventForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-end">
          <div className="bg-white w-full max-w-md h-full overflow-y-auto shadow-xl">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">{selectedEvent ? 'Edit Event' : 'New Event'}</h2>
              <button onClick={resetEventForm} className="p-1 text-gray-600 hover:text-gray-900">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Client *</label>
                <select
                  value={eventForm.clientId}
                  onChange={(e) => setEventForm({ ...eventForm, clientId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a client</option>
                  {clients.filter(c => c.status === 'active').map(client => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Event Name *</label>
                <input
                  type="text"
                  value={eventForm.eventName}
                  onChange={(e) => setEventForm({ ...eventForm, eventName: e.target.value })}
                  placeholder="Corporate Gala 2024"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Zip Code * (Required)</label>
                <input
                  type="text"
                  value={eventForm.zipCode}
                  onChange={(e) => setEventForm({ ...eventForm, zipCode: e.target.value })}
                  placeholder="10001"
                  maxLength={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Address (Optional)</label>
                <input
                  type="text"
                  value={eventForm.address}
                  onChange={(e) => setEventForm({ ...eventForm, address: e.target.value })}
                  placeholder="123 Main St, New York, NY"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Date *</label>
                  <input
                    type="date"
                    value={eventForm.startDate}
                    onChange={(e) => setEventForm({ ...eventForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">End Date *</label>
                  <input
                    type="date"
                    value={eventForm.endDate}
                    onChange={(e) => setEventForm({ ...eventForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  value={eventForm.status}
                  onChange={(e) => setEventForm({ ...eventForm, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={eventForm.notes}
                  onChange={(e) => setEventForm({ ...eventForm, notes: e.target.value })}
                  placeholder="Additional details..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={handleEventSubmit}
                  disabled={!eventForm.clientId || !eventForm.eventName || !eventForm.zipCode || !eventForm.startDate || !eventForm.endDate}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {selectedEvent ? 'Update' : 'Create'}
                </button>
                <button onClick={resetEventForm} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showClientForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-end">
          <div className="bg-white w-full max-w-md h-full overflow-y-auto shadow-xl">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">{selectedClient ? 'Edit Client' : 'New Client'}</h2>
              <button onClick={resetClientForm} className="p-1 text-gray-600 hover:text-gray-900">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Client Name *</label>
                <input
                  type="text"
                  value={clientForm.name}
                  onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                  placeholder="Acme Events"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Contact Email *</label>
                <input
                  type="email"
                  value={clientForm.contactEmail}
                  onChange={(e) => setClientForm({ ...clientForm, contactEmail: e.target.value })}
                  placeholder="contact@acme.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Contact Phone *</label>
                <input
                  type="tel"
                  value={clientForm.contactPhone}
                  onChange={(e) => setClientForm({ ...clientForm, contactPhone: e.target.value })}
                  placeholder="555-0101"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  value={clientForm.status}
                  onChange={(e) => setClientForm({ ...clientForm, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Assigned Zip Codes</label>
                <textarea
                  value={clientForm.assignedZipCodes}
                  onChange={(e) => setClientForm({ ...clientForm, assignedZipCodes: e.target.value })}
                  placeholder="10001, 10002, 10003"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Enter zip codes separated by commas</p>
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={handleClientSubmit}
                  disabled={!clientForm.name || !clientForm.contactEmail || !clientForm.contactPhone}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {selectedClient ? 'Update' : 'Create'}
                </button>
                <button onClick={resetClientForm} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}