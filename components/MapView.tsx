
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { ItineraryItem, WalkingRoute, ExplorePlace, FriendMember } from '../types';
import { Navigation } from 'lucide-react';

interface MapViewProps {
  items?: ItineraryItem[];
  center?: [number, number];
  isFullView?: boolean;
  route?: WalkingRoute | null;
  explorePlaces?: ExplorePlace[];
  journeyTrace?: { coordinates: [number, number][], summary: string } | null;
  squadMembers?: FriendMember[];
  userLocation?: { lat: number, lng: number, accuracy?: number } | null;
}

const MapView: React.FC<MapViewProps> = ({ 
    items = [], center, isFullView, route, explorePlaces = [], journeyTrace, squadMembers = [], userLocation 
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Layer[]>([]);
  const squadMarkersRef = useRef<L.Layer[]>([]);
  const userMarkerRef = useRef<L.Layer | null>(null);
  const userAccuracyRef = useRef<L.Layer | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);

  // Animation Refs
  const movingMarkerRef = useRef<L.Marker | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    
    // If map already exists, don't recreate it
    if (mapRef.current) return;

    const mapCenter = center || (items.length > 0 && items[0].lat && items[0].lng 
      ? [items[0].lat, items[0].lng] 
      : [0, 0]) as [number, number];

    const mapInstance = L.map(containerRef.current, {
      center: mapCenter,
      zoom: 13,
      zoomControl: false,
    });
    mapRef.current = mapInstance;

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
    }).addTo(mapInstance);

    L.control.zoom({ position: 'bottomright' }).addTo(mapInstance);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersRef.current = [];
        squadMarkersRef.current = [];
        userMarkerRef.current = null;
        userAccuracyRef.current = null;
        routeLayerRef.current = null;
        if (movingMarkerRef.current) movingMarkerRef.current.remove();
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Update User Location Marker
  useEffect(() => {
      if (!mapRef.current) return;
      const map = mapRef.current;

      // Clean up old user markers
      if (userMarkerRef.current) userMarkerRef.current.remove();
      if (userAccuracyRef.current) userAccuracyRef.current.remove();

      if (userLocation) {
          // Accuracy Circle
          if (userLocation.accuracy) {
              userAccuracyRef.current = L.circle([userLocation.lat, userLocation.lng], {
                  radius: userLocation.accuracy,
                  color: '#bae6fd',
                  fillColor: '#bae6fd',
                  fillOpacity: 0.3,
                  weight: 1
              }).addTo(map);
          }

          // Pulsing Dot
          const pulsingIcon = L.divIcon({
              className: 'user-pulse-icon',
              html: `<div class="w-4 h-4 bg-omni-blue border-2 border-white rounded-full shadow-[0_0_0_rgba(186,230,253,0.4)] animate-[pulse_2s_infinite]"></div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8]
          });

          userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
              icon: pulsingIcon,
              zIndexOffset: 1000
          }).addTo(map);

          // Only pan if it's the first fix or user requests it (logic handled in parent usually, 
          // but here we just ensure map contains it if no other items)
          if (items.length === 0 && explorePlaces.length === 0 && !route) {
              map.setView([userLocation.lat, userLocation.lng], map.getZoom());
          }
      }
  }, [userLocation, items.length, explorePlaces.length, route]);

  // Update Squad Members
  useEffect(() => {
      if (!mapRef.current) return;
      const map = mapRef.current;

      // Clear old squad markers
      squadMarkersRef.current.forEach(m => m.remove());
      squadMarkersRef.current = [];

      squadMembers.forEach(member => {
          if (member.lat && member.lng && member.status === 'active') {
              const avatarIcon = L.divIcon({
                  className: 'squad-icon',
                  html: `
                    <div style="background-color: ${member.avatarColor};" class="w-8 h-8 rounded-full border-2 border-white shadow-md flex items-center justify-center font-bold text-[10px] text-omni-dark relative">
                        ${member.name.charAt(0)}
                        ${member.isSpeaking ? '<div class="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border border-white"></div>' : ''}
                    </div>
                    <div class="absolute top-8 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur px-1 rounded text-[8px] font-bold whitespace-nowrap">${member.name}</div>
                  `,
                  iconSize: [32, 32],
                  iconAnchor: [16, 16]
              });

              const marker = L.marker([member.lat, member.lng], { icon: avatarIcon }).addTo(map);
              squadMarkersRef.current.push(marker);
          }
      });
  }, [squadMembers]);

  // Effect for handling items, routes, explore places, and traces
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    // Clear old markers and layers safely
    markersRef.current.forEach(layer => {
        try {
            layer.remove();
        } catch (e) {
            console.warn("Failed to remove layer", e);
        }
    });
    markersRef.current = [];
    
    if (routeLayerRef.current) {
      try {
        routeLayerRef.current.remove();
      } catch (e) { console.warn(e); }
      routeLayerRef.current = null;
    }
    
    if (movingMarkerRef.current) {
        movingMarkerRef.current.remove();
        movingMarkerRef.current = null;
    }
    if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
    }

    const bounds = L.latLngBounds([]);

    // 0. Draw Yearly Journey Trace (Animation Mode)
    if (journeyTrace && journeyTrace.coordinates.length > 0) {
        const coords = journeyTrace.coordinates;

        // Draw static path
        routeLayerRef.current = L.polyline(coords, {
            color: '#fde047', // Omni Yellow
            weight: 4,
            dashArray: '10, 10',
            opacity: 0.8
        }).addTo(map);

        // Add markers for stops
        coords.forEach((coord, i) => {
            const marker = L.circleMarker(coord, {
                radius: 6,
                fillColor: '#334155',
                color: '#fff',
                weight: 2,
                fillOpacity: 1
            }).addTo(map);
            markersRef.current.push(marker);
            bounds.extend(coord);
        });

        // Add Moving Marker (Plane)
        const planeIcon = L.divIcon({
            className: 'plane-icon',
            html: '<div style="font-size: 24px;">✈️</div>',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });

        const movingMarker = L.marker(coords[0], { icon: planeIcon }).addTo(map);
        movingMarkerRef.current = movingMarker;

        // Simple animation loop along the path
        let startTime: number | null = null;
        const duration = 10000; // 10 seconds for full loop

        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = (timestamp - startTime) / duration;
            
            if (progress < 1) {
                // Determine current segment
                const totalSegments = coords.length - 1;
                const segmentProgress = progress * totalSegments;
                const segmentIndex = Math.floor(segmentProgress);
                const t = segmentProgress - segmentIndex;

                if (segmentIndex < totalSegments) {
                    const start = coords[segmentIndex];
                    const end = coords[segmentIndex + 1];
                    const lat = start[0] + (end[0] - start[0]) * t;
                    const lng = start[1] + (end[1] - start[1]) * t;
                    movingMarker.setLatLng([lat, lng]);
                }
                animationFrameRef.current = requestAnimationFrame(animate);
            } else {
                // Loop
                startTime = timestamp;
                animationFrameRef.current = requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
        map.fitBounds(bounds, { padding: [50, 50] });
        return; // Exit early so we don't draw other stuff in this mode
    }

    // 1. Draw Explore Places (if active)
    if (explorePlaces.length > 0) {
        explorePlaces.forEach((place, index) => {
            const marker = L.marker([place.lat, place.lng], {
                icon: L.divIcon({
                    className: 'explore-icon',
                    html: `
                        <div style="background-color: #fde047; border: 3px solid #334155; border-radius: 12px; padding: 4px; box-shadow: 2px 2px 0 #334155; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; font-weight: 900; font-size: 14px;">
                            ${index + 1}
                        </div>
                    `,
                    iconSize: [32, 32],
                    iconAnchor: [16, 32],
                    popupAnchor: [0, -32]
                })
            }).addTo(map);

            const popupContent = `
                <div class="p-2 min-w-[160px]">
                   <div class="font-black text-omni-dark text-sm">${place.name}</div>
                   <div class="text-[10px] text-white bg-omni-dark px-1.5 py-0.5 rounded-full w-fit mt-1">${place.category}</div>
                   <div class="text-xs text-gray-500 italic mt-1 line-clamp-2">${place.description}</div>
                   <div class="mt-2 text-xs font-bold text-omni-dark">⭐️ ${place.rating}</div>
                </div>
             `;
             marker.bindPopup(popupContent);
             markersRef.current.push(marker);
             bounds.extend([place.lat, place.lng]);
        });
    }

    // 2. Draw Walking Route if active
    if (route && route.waypoints.length > 0) {
        const latlngs: L.LatLngExpression[] = route.waypoints.map(wp => [wp.lat, wp.lng]);
        
        // Draw path
        routeLayerRef.current = L.polyline(latlngs, {
            color: '#334155',
            weight: 5,
            dashArray: '10, 10',
            className: 'path-dash'
        }).addTo(map);
        
        // Draw Route Markers
        route.waypoints.forEach((wp, idx) => {
             const isStart = idx === 0;
             const isEnd = idx === route.waypoints.length - 1;
             
             let bg = '#fde047'; // yellow
             if (isStart) bg = '#bbf7d0'; // green
             if (isEnd) bg = '#fbcfe8'; // pink

             const marker = L.marker([wp.lat, wp.lng], {
                icon: L.divIcon({
                    className: 'walk-stop-icon',
                    html: `<span>${idx + 1}</span>`,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12],
                })
             }).addTo(map);
             
             const popupContent = `
                <div class="p-2 min-w-[150px]">
                   <div class="font-black text-omni-dark text-sm">${wp.name}</div>
                   <div class="text-xs text-gray-500 italic mb-1">${wp.description}</div>
                   ${isStart ? '<span class="bg-omni-green px-2 py-0.5 rounded text-[10px] font-black uppercase">Start</span>' : ''}
                   ${isEnd ? '<span class="bg-omni-pink px-2 py-0.5 rounded text-[10px] font-black uppercase">Finish</span>' : ''}
                </div>
             `;
             marker.bindPopup(popupContent);
             markersRef.current.push(marker);
             bounds.extend([wp.lat, wp.lng]);
        });
        
    } else if (explorePlaces.length === 0 && items.length > 0) {
        // 3. Draw Standard Itinerary Items (Only if not exploring or mixing)
        const validItems = items.filter(i => i.lat && i.lng);
        
        validItems.forEach((item, index) => {
            const marker = L.marker([item.lat!, item.lng!], {
            icon: L.divIcon({
                className: 'custom-div-icon',
                html: `<span>${index + 1}</span>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            })
            }).addTo(map);
            
            const directionsUrl = userLocation 
            ? `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${item.lat},${item.lng}&travelmode=walking`
            : `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`;

            const popupContent = document.createElement('div');
            popupContent.className = 'p-2 flex flex-col gap-2 min-w-[150px]';
            popupContent.innerHTML = `
            <div class="font-black text-omni-dark text-base">${item.activity}</div>
            <div class="text-xs text-gray-500 font-bold uppercase tracking-wider">${item.time}</div>
            <div class="text-xs italic text-gray-400 mb-1">${item.location}</div>
            <a href="${directionsUrl}" target="_blank" class="bg-omni-yellow border-2 border-omni-dark p-2 rounded-xl text-xs font-black flex items-center justify-center gap-1 shadow-cartoon-sm hover:translate-y-0.5 transition-all text-center">
                🚀 HOW TO GET HERE?
            </a>
            `;

            marker.bindPopup(popupContent);
            markersRef.current.push(marker);
            bounds.extend([item.lat!, item.lng!] as [number, number]);
        });
    }

    // Auto-fit bounds logic
    if (squadMembers.length > 0 && userLocation) {
        // Fit squad + user
        // Fix: Use double array to pass array of points, because [lat, lng] is interpreted as one point by bounds constructor if simple array
        const squadBounds = L.latLngBounds([[userLocation.lat, userLocation.lng]]);
        squadMembers.forEach(m => {
            if (m.lat && m.lng && m.status === 'active') squadBounds.extend([m.lat, m.lng]);
        });
        map.fitBounds(squadBounds, { padding: [50, 50], maxZoom: 16 });
    } else if (!bounds.isValid()) {
        if (userLocation) {
            map.setView([userLocation.lat, userLocation.lng], 15);
        } else if (center) {
           map.setView(center, 13);
        } else if (map.getZoom() < 10) {
            map.setView([48.8566, 2.3522], 13); // Paris default
        }
    } else {
        map.fitBounds(bounds, { padding: [50, 50] });
    }
    
    // Invalidate size to ensure map renders correctly if container resized
    const timer = setTimeout(() => {
        if (mapRef.current) mapRef.current.invalidateSize();
    }, 400);

    return () => clearTimeout(timer);

  }, [items, route, userLocation, explorePlaces, center, journeyTrace, squadMembers]);

  return <div ref={containerRef} className="w-full h-full min-h-[300px]" />;
};

export default MapView;
