# SIH Demonstration Script: Panchayat Weather Intelligence

**Estimated Duration:** 3–5 minutes

## STEP 1: Introduction
- **Action:** Open the application homepage (`http://localhost:3000`).
- **Script:** "Welcome to Panchayat Weather Intelligence. Our goal is to provide precise, hyper-local weather downscaling and agricultural decision-support directly at the Gram Panchayat level. Today, coarse weather forecasts often miss local variations. We solve this using AI."

## STEP 2: Panchayat Selection
- **Action:** Select a Panchayat in Pune (e.g., Pirangut or a nearby Panchayat on the map).
- **Script:** "Here we see the Pune district. When we select a specific Panchayat, we immediately see its exact boundaries, area, and elevation profile retrieved from our spatial database."

## STEP 3: Panchayat Weather Context
- **Action:** Point out the "Today's Weather" and "7-Day Outlook" sections in the side panel/mobile view.
- **Script:** "The system immediately fetches the live operational forecast for this exact Panchayat. However, this isn't just the coarse forecast."

## STEP 4: Coarse → Downscaled Weather
- **Action:** Expand the **Data & Model (Advanced)** accordion. Show the "Historical Downscaling" chart (if viewing historical data) or explain the operational pathway.
- **Script:** "We integrate the ECMWF IFS 0.25 degree forecast via Open-Meteo. Our XGBoost residual model takes this coarse input, combines it with the Panchayat's high-resolution Copernicus DEM terrain features, and dynamically downscales the prediction. This corrects local biases."

## STEP 5: Explain Model Validation
- **Action:** Point to the **Model Validation (2023)** metrics inside the accordion.
- **Script:** "This model isn't a black box. The numbers here are read live from our validation file: in the 2023 Pune historical experiment, spatial-block validation against CHIRPS reduced rainfall RMSE by 38.45% compared with the coarse ERA5 baseline. The table shows the same test for each variable and how often the truth fell inside our 80% range. These are historical results; the live forecast itself is not yet verified."

## STEP 5b: High-resolution map — coarse vs downscaled
- **Action:** In the map's **Forecast layer** control choose **Coarse**, then **Downscaled** (Rainfall, Today). Try **Max temp** too.
- **Script:** "This is the problem statement in one picture. The coarse forecast is blocky: every Panchayat in a 27 km cell gets the same number. After downscaling, each Panchayat has its own value on the same colour scale. For temperature, you can see the Ghats come out cooler."

## STEP 5c: Block → Panchayat
- **Action:** In the Panchayat header, tap the **block name** (e.g. *Ambegaon Block*). Show the block value, the Panchayat range and the ranked list. Then open **Your own block forecast**, enter e.g. *Rainfall 40 mm, Max temp 31 °C*, and press **Downscale**.
- **Script:** "Agro-met bulletins arrive at block level. Here the block value is a single line, and every Panchayat gets its own estimate. We can even type in an IMD block bulletin and get Panchayat-level numbers instantly."

## STEP 6: Agricultural Intelligence
- **Action:** Use the horizontal Crop Selector ("What are you growing?") to select **Soybean**, then **Rice**, and show the Irrigation advice change. Point to the five advisory rows (Irrigation, Spraying, Heat stress, Fungal & pest risk, Field work).
- **Script:** "Weather data alone isn't enough. We translate these AI-downscaled predictions into actionable agricultural intelligence. Based on the selected crop and the downscaled rainfall, we generate real-time, farmer-friendly decision-support advisories."

## STEP 7: Ask Panchayat AI Copilot
- **Action:** Click the **Ask Panchayat AI** floating button (or the bottom nav icon on mobile).
- **Script:** "To make this entirely accessible, we built the Panchayat AI Copilot. It uses a Retrieval-Augmented Generation (RAG) architecture grounded strictly in our application's data."

## STEP 8: Copilot Grounding Test
- **Action:** Type into the chat: *"Should I irrigate today?"*
- **Script:** "The AI reads the exact downscaled rainfall and the crop context. It provides a cautious, data-backed answer without hallucinating."

## STEP 9: Downscaling Explanation
- **Action:** Type into the chat: *"Why is the AI rainfall different from the forecast?"*
- **Script:** "We can interrogate the model. The AI understands the downscaling process and will explain that it adjusted the coarse forecast based on this specific Panchayat's elevation and terrain."

## STEP 10: System Methodology
- **Action:** Type into the chat: *"How does this system work?"*
- **Script:** "The AI acts as an interactive guide to our methodology, ensuring transparency for farmers and stakeholders."

## STEP 11: Mobile Version (Optional)
- **Action:** Open Chrome DevTools (F12), toggle Device Toolbar (Ctrl+Shift+M), and set to an iPhone 12 Pro (390px width). Refresh.
- **Script:** "Crucially, this is a mobile-first product. The layout intelligently shifts to a touch-friendly interface, complete with a native-feeling bottom navigation bar and full-screen Copilot, designed for the devices farmers actually use."
