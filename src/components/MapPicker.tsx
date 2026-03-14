import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface MapPickerProps {
  position: { lat: number; lng: number } | null;
  onPositionChange: (coords: { lat: number; lng: number }) => void;
}

const MapPicker = ({ position, onPositionChange }: MapPickerProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  // Default to Biguaçu center
  const defaultPosition = { lat: -27.4944, lng: -48.6553 };
  const currentPosition = position || defaultPosition;

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    // Initialize map with mobile-friendly settings (no zoom gestures)
    const map = L.map(mapContainer.current, {
      center: [currentPosition.lat, currentPosition.lng],
      zoom: 16,
      scrollWheelZoom: false,
      touchZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      zoomControl: true,
      dragging: true,
    });

    // Add tile layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // Add draggable marker
    const marker = L.marker([currentPosition.lat, currentPosition.lng], {
      draggable: true,
    }).addTo(map);

    // Handle marker drag
    marker.on("dragend", () => {
      const latlng = marker.getLatLng();
      onPositionChange({ lat: latlng.lat, lng: latlng.lng });
    });

    // Handle map click
    map.on("click", (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      onPositionChange({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    mapRef.current = map;
    markerRef.current = marker;
    setIsMapReady(true);

    // Cleanup
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Update marker and map view when position changes externally
  useEffect(() => {
    if (!isMapReady || !mapRef.current || !markerRef.current || !position) return;

    const currentMarkerPos = markerRef.current.getLatLng();
    
    // Only update if position actually changed
    if (
      Math.abs(currentMarkerPos.lat - position.lat) > 0.00001 ||
      Math.abs(currentMarkerPos.lng - position.lng) > 0.00001
    ) {
      markerRef.current.setLatLng([position.lat, position.lng]);
      mapRef.current.setView([position.lat, position.lng], mapRef.current.getZoom());
    }
  }, [position, isMapReady]);

  return (
    <div 
      ref={mapContainer}
      className="w-full h-[250px] rounded-xl overflow-hidden border border-border shadow-sm"
      style={{ zIndex: 1, touchAction: "pan-x pan-y" }}
    />
  );
};

export default MapPicker;
