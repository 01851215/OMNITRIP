
import { CalendarEvent } from '../types';

export const parseICS = (icsData: string): CalendarEvent[] => {
    const events: CalendarEvent[] = [];
    const lines = icsData.split(/\r\n|\n|\r/);
    
    let inEvent = false;
    let currentEvent: Partial<CalendarEvent> = {};

    for (const line of lines) {
        if (line.startsWith('BEGIN:VEVENT')) {
            inEvent = true;
            currentEvent = { id: `evt-${Date.now()}-${Math.random()}`, source: 'upload', allDay: false };
        } else if (line.startsWith('END:VEVENT')) {
            if (currentEvent.title && currentEvent.start) {
                events.push(currentEvent as CalendarEvent);
            }
            inEvent = false;
            currentEvent = {};
        } else if (inEvent) {
            if (line.startsWith('SUMMARY:')) {
                currentEvent.title = line.substring(8);
            } else if (line.startsWith('DTSTART')) {
                const val = line.split(':')[1];
                if (val) {
                    currentEvent.start = parseICSDate(val);
                    if (val.length === 8) currentEvent.allDay = true;
                }
            } else if (line.startsWith('DTEND')) {
                const val = line.split(':')[1];
                if (val) {
                    currentEvent.end = parseICSDate(val);
                }
            }
        }
    }
    return events;
};

const parseICSDate = (val: string): string => {
    // Format: YYYYMMDDTHHMMSSZ or YYYYMMDD
    try {
        const year = val.substring(0, 4);
        const month = val.substring(4, 6);
        const day = val.substring(6, 8);
        
        if (val.length === 8) {
            return `${year}-${month}-${day}`;
        }
        
        const time = val.split('T')[1];
        const hour = time.substring(0, 2);
        const min = time.substring(2, 4);
        const sec = time.substring(4, 6);
        
        // Simple conversion to ISO string representation
        return `${year}-${month}-${day}T${hour}:${min}:${sec}`;
    } catch (e) {
        return new Date().toISOString();
    }
};

export const getEventsForRange = (events: CalendarEvent[], startStr: string, endStr: string) => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    return events.filter(e => {
        const eStart = new Date(e.start);
        return eStart >= start && eStart <= end;
    });
};
