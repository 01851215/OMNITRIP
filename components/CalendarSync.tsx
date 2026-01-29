
import React, { useState, useRef, useEffect } from 'react';
import { Calendar, Upload, Plus, Trash2, CheckCircle, X, Loader2, CloudLightning, Mail, Shield, Clock, AlertTriangle, Lock, LogOut, Settings, ChevronDown, User } from 'lucide-react';
import { CalendarEvent } from '../types';
import { parseICS } from '../services/calendarService';

interface CalendarSyncProps {
    isOpen: boolean;
    onClose: () => void;
    events: CalendarEvent[];
    setEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
}

interface ConnectionState {
    id: string; // Unique connection ID
    provider: 'google' | 'outlook';
    accountName: string; // e.g. user@gmail.com
    connectedAt: number;
    expiresAt: number | null; // Timestamp
    scope: string[];
}

const CalendarSync: React.FC<CalendarSyncProps> = ({ isOpen, onClose, events, setEvents }) => {
    const [view, setView] = useState<'list' | 'add' | 'permission'>('list');
    const [manualEvent, setManualEvent] = useState({ title: '', date: '', startTime: '09:00', endTime: '10:00' });
    
    // Auth State
    const [targetProvider, setTargetProvider] = useState<'google' | 'outlook' | null>(null);
    const [accessDuration, setAccessDuration] = useState<string>('session'); 
    
    // Custom Duration State
    const [customVal, setCustomVal] = useState<number>(1);
    const [customUnit, setCustomUnit] = useState<'hours' | 'days' | 'weeks'>('days');

    const [connections, setConnections] = useState<ConnectionState[]>([]);
    const [isAuthenticating, setIsAuthenticating] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Persist Events & Connections
    useEffect(() => {
        const savedEvents = localStorage.getItem('omnitrip_calendar_events');
        const savedConns = localStorage.getItem('omnitrip_calendar_connections');
        
        if (savedEvents && events.length === 0) {
            setEvents(JSON.parse(savedEvents));
        }
        if (savedConns) {
            const parsedConns: ConnectionState[] = JSON.parse(savedConns);
            // Filter expired
            const validConns = parsedConns.filter(c => !c.expiresAt || Date.now() < c.expiresAt);
            setConnections(validConns);
            if (validConns.length !== parsedConns.length) {
                localStorage.setItem('omnitrip_calendar_connections', JSON.stringify(validConns));
            }
        }
    }, []);

    useEffect(() => {
        if (events.length > 0) {
            localStorage.setItem('omnitrip_calendar_events', JSON.stringify(events));
        }
        localStorage.setItem('omnitrip_calendar_connections', JSON.stringify(connections));
    }, [events, connections]);

    // --- Actions ---

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                const text = evt.target?.result as string;
                const newEvents = parseICS(text);
                setEvents(prev => [...prev, ...newEvents]);
                alert(`Imported ${newEvents.length} events!`);
            };
            reader.readAsText(file);
        }
    };

    const initiateAuth = (provider: 'google' | 'outlook') => {
        setTargetProvider(provider);
        setAccessDuration('session'); // Reset default
        setView('permission');
    };

    const confirmAuth = () => {
        if (!targetProvider) return;
        
        setIsAuthenticating(true);
        
        // Calculate Expiry
        let expiresAt: number | null = null;
        const now = Date.now();
        
        if (accessDuration === 'custom') {
            const multipliers = {
                'hours': 3600 * 1000,
                'days': 86400 * 1000,
                'weeks': 7 * 86400 * 1000
            };
            expiresAt = now + (customVal * multipliers[customUnit]);
        } else {
            switch(accessDuration) {
                case '1hour': expiresAt = now + 3600 * 1000; break;
                case '1day': expiresAt = now + 86400 * 1000; break;
                case '30days': expiresAt = now + 30 * 86400 * 1000; break;
                case 'forever': expiresAt = 253402300000000; break; // Far future
                case 'session': expiresAt = now + 3600 * 1000; break; // Default roughly 1h
            }
        }

        // Simulate API Handshake delay
        setTimeout(() => {
            const newConnId = `conn_${Date.now()}`;
            const mockAccountName = targetProvider === 'google' 
                ? `user${Math.floor(Math.random()*100)}@gmail.com`
                : `employee${Math.floor(Math.random()*100)}@outlook.com`;

            const newConnection: ConnectionState = {
                id: newConnId,
                provider: targetProvider,
                accountName: mockAccountName,
                connectedAt: now,
                expiresAt,
                scope: ['calendar.readonly', 'calendar.events.readonly']
            };

            setConnections(prev => [...prev, newConnection]);
            
            // Auto-fetch initial data for this specific connection
            fetchMockData(targetProvider, newConnId);
            
            setIsAuthenticating(false);
            setView('list');
        }, 2000);
    };

    const fetchMockData = (provider: 'google' | 'outlook', connectionId: string) => {
        let mockEvents: CalendarEvent[] = [];
        // We prefix ID with connectionId to track ownership
        if (provider === 'google') {
            mockEvents = [
                { id: `${connectionId}-1`, title: 'Team Sync (GMeet)', start: new Date(Date.now() + 86400000).toISOString(), end: new Date(Date.now() + 90000000).toISOString(), allDay: false, source: 'google' },
                { id: `${connectionId}-2`, title: 'Flight Reminder', start: new Date(Date.now() + 172800000).toISOString(), end: new Date(Date.now() + 172800000).toISOString(), allDay: true, source: 'google' },
            ];
        } else {
            mockEvents = [
                { id: `${connectionId}-1`, title: 'Quarterly Review (Teams)', start: new Date(Date.now() + 100000000).toISOString(), end: new Date(Date.now() + 103600000).toISOString(), allDay: false, source: 'outlook' },
                { id: `${connectionId}-2`, title: 'Sync with Manager', start: new Date(Date.now() + 200000000).toISOString(), end: new Date(Date.now() + 201800000).toISOString(), allDay: false, source: 'outlook' },
            ];
        }
        setEvents(prev => [...prev, ...mockEvents]);
    };

    const disconnect = (id: string) => {
        if (confirm("Disconnect this account? associated events will be removed.")) {
            setConnections(prev => prev.filter(c => c.id !== id));
            // Remove events belonging to this connection ID
            setEvents(prev => prev.filter(e => !e.id.startsWith(id)));
        }
    };

    const addManualEvent = () => {
        if (!manualEvent.title || !manualEvent.date) return;
        const start = `${manualEvent.date}T${manualEvent.startTime}:00`;
        const end = `${manualEvent.date}T${manualEvent.endTime}:00`;
        
        setEvents(prev => [...prev, {
            id: `m-${Date.now()}`,
            title: manualEvent.title,
            start,
            end,
            allDay: false,
            source: 'manual'
        }]);
        setManualEvent({ title: '', date: '', startTime: '09:00', endTime: '10:00' });
        setView('list');
    };

    const deleteEvent = (id: string) => {
        setEvents(prev => prev.filter(e => e.id !== id));
    };

    const getSourceIcon = (source: CalendarEvent['source']) => {
        switch(source) {
            case 'google': return <CloudLightning size={14} className="text-red-500" />;
            case 'outlook': return <Mail size={14} className="text-blue-600" />;
            case 'upload': return <Upload size={14} className="text-orange-500" />;
            default: return <Calendar size={14} className="text-gray-400" />;
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] bg-omni-dark/60 backdrop-blur-sm flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-md max-h-[85vh] rounded-[2.5rem] border-4 border-omni-dark shadow-cartoon-lg flex flex-col overflow-hidden animate-in zoom-in-95">
                
                <div className="bg-omni-blue p-6 border-b-4 border-omni-dark flex justify-between items-center">
                    <h2 className="text-xl font-black flex items-center gap-2">
                        <Calendar className="text-omni-dark"/> SYNC CENTER
                    </h2>
                    <button onClick={onClose} className="w-10 h-10 bg-white rounded-full border-2 border-omni-dark flex items-center justify-center hover:bg-gray-100">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-gray-50 custom-scrollbar space-y-6">
                    
                    {/* VIEW: LIST (MAIN) */}
                    {view === 'list' && (
                        <>
                            {/* Connected Accounts List */}
                            {connections.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="font-black text-xs uppercase text-gray-400 ml-1">Connected Accounts</h3>
                                    {connections.map(conn => (
                                        <div key={conn.id} className="bg-white p-3 rounded-2xl border-2 border-omni-dark flex justify-between items-center shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-full border-2 ${conn.provider === 'google' ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
                                                    {conn.provider === 'google' ? <CloudLightning size={16} className="text-red-500"/> : <Mail size={16} className="text-blue-600"/>}
                                                </div>
                                                <div>
                                                    <p className="font-black text-xs text-omni-dark">{conn.accountName}</p>
                                                    <p className="text-[9px] font-bold text-gray-400">
                                                        Expires: {conn.expiresAt && conn.expiresAt > 2000000000000 ? 'Never' : new Date(conn.expiresAt || 0).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <button onClick={() => disconnect(conn.id)} className="text-gray-300 hover:text-red-500 p-2 transition-colors" title="Disconnect">
                                                <LogOut size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Add New Connection Buttons */}
                            <div>
                                <h3 className="font-black text-xs uppercase text-gray-400 ml-1 mb-2">{connections.length > 0 ? "Add Another Account" : "Connect Accounts"}</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <button 
                                        onClick={() => initiateAuth('google')}
                                        className="bg-white p-4 rounded-2xl border-4 border-gray-200 hover:border-red-400 hover:bg-red-50 transition-all flex flex-col items-center gap-2 group"
                                    >
                                        <CloudLightning size={24} className="text-red-500 group-hover:scale-110 transition-transform"/>
                                        <span className="font-black text-xs text-center">GOOGLE CAL</span>
                                    </button>

                                    <button 
                                        onClick={() => initiateAuth('outlook')}
                                        className="bg-white p-4 rounded-2xl border-4 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all flex flex-col items-center gap-2 group"
                                    >
                                        <Mail size={24} className="text-blue-600 group-hover:scale-110 transition-transform"/>
                                        <span className="font-black text-xs text-center">OUTLOOK</span>
                                    </button>
                                </div>
                            </div>

                            {/* File Upload & Manual Actions */}
                            <div className="grid grid-cols-2 gap-4 pt-2 border-t-2 border-dashed border-gray-200">
                                <div className="relative">
                                    <input type="file" accept=".ics" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full h-full bg-white p-4 rounded-2xl border-4 border-gray-200 hover:border-omni-dark hover:bg-yellow-50 transition-all flex flex-col items-center gap-2 group"
                                    >
                                        <Upload size={24} className="text-orange-500 group-hover:scale-110 transition-transform"/>
                                        <span className="font-black text-xs text-center">UPLOAD .ICS</span>
                                    </button>
                                </div>
                                <button 
                                    onClick={() => setView('add')} 
                                    className="w-full h-full bg-white p-4 rounded-2xl border-4 border-gray-200 hover:border-omni-dark hover:bg-green-50 transition-all flex flex-col items-center gap-2 group"
                                >
                                    <Plus size={24} className="text-green-500 group-hover:scale-110 transition-transform"/>
                                    <span className="font-black text-xs text-center">MANUAL BLOCK</span>
                                </button>
                            </div>

                            {/* Event List */}
                            <div className="pt-2">
                                <h3 className="font-black text-xs uppercase text-gray-400 mb-3 ml-1">Busy Slots ({events.length})</h3>
                                {events.length === 0 ? (
                                    <div className="text-center py-8 opacity-50">
                                        <Calendar size={48} className="text-gray-300 mx-auto mb-2" />
                                        <p className="text-xs font-bold text-gray-400">Calendar is clear!</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {events.map(evt => (
                                            <div key={evt.id} className="bg-white p-3 rounded-xl border-2 border-omni-dark flex justify-between items-center group">
                                                <div className="flex items-start gap-2">
                                                    <div className="mt-0.5">{getSourceIcon(evt.source)}</div>
                                                    <div>
                                                        <p className="font-black text-xs">{evt.title}</p>
                                                        <p className="text-[10px] font-bold text-gray-500">
                                                            {new Date(evt.start).toLocaleDateString()} • {new Date(evt.start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button onClick={() => deleteEvent(evt.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* VIEW: PERMISSION (OAUTH SIM) */}
                    {view === 'permission' && (
                        <div className="flex flex-col h-full animate-in slide-in-from-right">
                            <div className="flex-1 flex flex-col items-center text-center gap-6 py-4">
                                {/* Provider Logo */}
                                <div className="w-20 h-20 bg-white rounded-full border-4 border-gray-100 shadow-sm flex items-center justify-center relative">
                                    {targetProvider === 'google' ? <CloudLightning size={40} className="text-red-500"/> : <Mail size={40} className="text-blue-600"/>}
                                    <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full border-4 border-white flex items-center justify-center">
                                        <Shield size={14} className="text-white" />
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-xl font-black mb-2">Connect {targetProvider === 'google' ? 'Google' : 'Outlook'}?</h3>
                                    <p className="text-xs font-bold text-gray-500 max-w-[250px] mx-auto">
                                        Omnitrip wants to access your calendar to prevent double-booking during your trip.
                                    </p>
                                </div>

                                <div className="w-full bg-yellow-50 border-2 border-yellow-200 rounded-xl p-3 text-left">
                                    <p className="text-[10px] font-black text-yellow-700 uppercase mb-2 flex items-center gap-1"><Lock size={10}/> Permissions Requested</p>
                                    <ul className="text-xs font-bold text-gray-600 space-y-1">
                                        <li className="flex items-center gap-2"><CheckCircle size={12} className="text-green-500"/> View all calendar events</li>
                                        <li className="flex items-center gap-2"><CheckCircle size={12} className="text-green-500"/> View free/busy information</li>
                                    </ul>
                                </div>

                                <div className="w-full bg-gray-50 p-4 rounded-xl border-2 border-omni-dark">
                                    <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block text-left flex items-center gap-1"><Clock size={10}/> Grant Access For:</label>
                                    
                                    <div className="relative">
                                        <select 
                                            value={accessDuration} 
                                            onChange={(e) => setAccessDuration(e.target.value)}
                                            className="w-full p-3 bg-white border-2 border-omni-dark rounded-xl font-bold text-sm focus:outline-none appearance-none"
                                        >
                                            <option value="session">This Session Only</option>
                                            <option value="1hour">1 Hour</option>
                                            <option value="1day">1 Day</option>
                                            <option value="30days">30 Days</option>
                                            <option value="forever">Forever (Until Revoked)</option>
                                            <option value="custom">Custom Duration...</option>
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-omni-dark" size={16} />
                                    </div>

                                    {/* Custom Duration Inputs */}
                                    {accessDuration === 'custom' && (
                                        <div className="flex gap-2 mt-3 animate-in slide-in-from-top-2">
                                            <input 
                                                type="number" 
                                                min="1"
                                                value={customVal}
                                                onChange={(e) => setCustomVal(parseInt(e.target.value) || 1)}
                                                className="w-20 p-3 bg-white border-2 border-omni-dark rounded-xl font-black text-center text-sm"
                                            />
                                            <div className="relative flex-1">
                                                <select 
                                                    value={customUnit}
                                                    onChange={(e) => setCustomUnit(e.target.value as any)}
                                                    className="w-full p-3 bg-white border-2 border-omni-dark rounded-xl font-bold text-sm focus:outline-none appearance-none"
                                                >
                                                    <option value="hours">Hours</option>
                                                    <option value="days">Days</option>
                                                    <option value="weeks">Weeks</option>
                                                </select>
                                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-omni-dark" size={16} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-3 mt-auto">
                                <button 
                                    onClick={() => setView('list')}
                                    disabled={isAuthenticating}
                                    className="flex-1 py-3 font-black text-gray-400 hover:bg-gray-100 rounded-xl transition-colors"
                                >
                                    DENY
                                </button>
                                <button 
                                    onClick={confirmAuth}
                                    disabled={isAuthenticating}
                                    className="flex-1 bg-omni-green border-2 border-omni-dark rounded-xl py-3 font-black shadow-cartoon-sm active:translate-y-1 transition-all flex items-center justify-center gap-2"
                                >
                                    {isAuthenticating ? <Loader2 className="animate-spin"/> : "ALLOW"}
                                </button>
                            </div>
                            
                            <p className="text-[8px] text-gray-300 text-center mt-4">
                                Secure connection via {targetProvider === 'google' ? 'Google OAuth 2.0' : 'Microsoft Identity Platform'}
                            </p>
                        </div>
                    )}

                    {/* VIEW: ADD MANUAL */}
                    {view === 'add' && (
                        <div className="animate-in slide-in-from-right">
                            <h3 className="font-black text-lg mb-4">Add Busy Slot</h3>
                            <div className="space-y-4">
                                <input placeholder="Event Name" value={manualEvent.title} onChange={e => setManualEvent({...manualEvent, title: e.target.value})} className="w-full p-3 border-2 border-gray-200 rounded-xl text-sm font-bold" />
                                <input type="date" value={manualEvent.date} onChange={e => setManualEvent({...manualEvent, date: e.target.value})} className="w-full p-3 border-2 border-gray-200 rounded-xl text-sm font-bold" />
                                <div className="flex gap-3">
                                    <input type="time" value={manualEvent.startTime} onChange={e => setManualEvent({...manualEvent, startTime: e.target.value})} className="flex-1 p-3 border-2 border-gray-200 rounded-xl text-sm font-bold" />
                                    <input type="time" value={manualEvent.endTime} onChange={e => setManualEvent({...manualEvent, endTime: e.target.value})} className="flex-1 p-3 border-2 border-gray-200 rounded-xl text-sm font-bold" />
                                </div>
                                <div className="flex gap-2 mt-4">
                                    <button onClick={() => setView('list')} className="flex-1 py-3 font-bold text-gray-400">CANCEL</button>
                                    <button onClick={addManualEvent} className="flex-1 bg-omni-green py-3 rounded-xl border-2 border-omni-dark font-black text-sm shadow-cartoon-sm active:translate-y-0.5">ADD BLOCK</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CalendarSync;
