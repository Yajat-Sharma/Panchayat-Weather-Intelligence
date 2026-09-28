# SIH Demonstration Fallback Protocol

This document outlines the exact fallback procedures to follow if live APIs (Open-Meteo, ECMWF, or the LLM) fail during the live Smart India Hackathon (SIH) pitch.

## 1. Network Failure / API Unavailability
If the live Open-Meteo or ECMWF endpoint is unresponsive:
- **Action:** The system will gracefully failover to the cached `mock_weather_data.json` inside the frontend/backend.
- **Transparency:** The UI will automatically display a yellow banner: `Offline Demo Mode: Displaying historical 2023 cached reference data due to network unavailability.`
- **Talking Point:** "To ensure demonstration continuity during network issues, we have seamlessly failed over to a cached historical reference set from 2023. Our downscaling pipeline behaves identically on this cached data."

## 2. LLM / AI Copilot Timeout
If the AI Copilot API times out or hits rate limits:
- **Action:** The backend will return a standard fallback response matrix based on the currently selected crop and rainfall delta.
- **Transparency:** The UI will display a tag next to the AI response: `Rule-based Fallback Active`.
- **Talking Point:** "Our system features a resilient architecture. If the generative AI endpoint is unreachable, we fall back to a localized, rule-based agronomic advisory matrix, ensuring the Panchayat user never receives a blank screen."

## 3. Map Tile Server Failure
If the Leaflet map tiles fail to load:
- **Action:** The map will fall back to displaying the raw GeoJSON geometries over a solid gray background `#f3f4f6`.
- **Talking Point:** "Even without a basemap, our Panchayat geometries are loaded locally, allowing uninterrupted spatial selection and navigation."

## 4. Total System Catastrophe
- **Action:** Switch immediately to the pre-recorded video walkthrough located in the `assets/` folder.
- **Talking Point:** "While our live system is being restored, let's walk through our comprehensive video demonstration, recorded earlier today, showing the full end-to-end flow."
