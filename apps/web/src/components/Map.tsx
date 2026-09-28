"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import L from "leaflet";
import { GeoJsonObject } from "geojson";

// Fix Leaflet icons issue with Webpack/Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface MapProps {
  geojsonData: GeoJsonObject | null;
  selectedGpcode?: string | null;
  onSelectPanchayat: (gpcode: string) => void;
}

export default function Map({ geojsonData, selectedGpcode, onSelectPanchayat }: MapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="h-full w-full flex items-center justify-center bg-gray-100">Loading Map...</div>;

  return (
    <div className="h-full w-full border rounded shadow-sm overflow-hidden">
      <MapContainer
        center={[18.5204, 73.8567]} // Pune
        zoom={9}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%", zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {geojsonData && (
          <GeoJSON
            data={geojsonData}
            style={(feature) => {
              const isSelected = feature?.properties?.GPCODE && String(Math.floor(feature.properties.GPCODE)) === selectedGpcode;
              return {
                color: isSelected ? "#1d4ed8" : "#3b82f6",
                weight: isSelected ? 2 : 1,
                fillColor: isSelected ? "#3b82f6" : "#93c5fd",
                fillOpacity: isSelected ? 0.6 : 0.2,
              };
            }}
            onEachFeature={(feature, layer) => {
              layer.on({
                mouseover: (e) => {
                  const isSelected = feature?.properties?.GPCODE && String(Math.floor(feature.properties.GPCODE)) === selectedGpcode;
                  if (!isSelected) {
                    const l = e.target;
                    l.setStyle({
                      fillOpacity: 0.5,
                      weight: 2,
                      color: "#1d4ed8"
                    });
                  }
                },
                mouseout: (e) => {
                  const isSelected = feature?.properties?.GPCODE && String(Math.floor(feature.properties.GPCODE)) === selectedGpcode;
                  if (!isSelected) {
                    const l = e.target;
                    l.setStyle({
                      color: "#3b82f6",
                      weight: 1,
                      fillColor: "#93c5fd",
                      fillOpacity: 0.2,
                    });
                  }
                },
                click: (e) => {
                  const gpcode = feature.properties?.GPCODE;
                  if (gpcode) {
                    onSelectPanchayat(String(Math.floor(gpcode)));
                  }
                },
              });
              
              if (feature.properties?.GPNAME) {
                layer.bindTooltip(feature.properties.GPNAME, { sticky: true });
              }
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
