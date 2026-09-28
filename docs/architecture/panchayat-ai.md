# Panchayat AI Copilot Architecture

## Overview
The Panchayat AI Copilot provides a contextual, conversational interface for farmers and users to interrogate local weather and agricultural data. It uses a Retrieval-Augmented Generation (RAG) architecture built into the FastAPI backend to deliver **AI-assisted Panchayat-level weather downscaling** explanations and **decision-support** information.

## Architecture Components

### 1. Frontend (`ChatbotDrawer.tsx`)
- Collects user query, selected `gpcode` (Panchayat), `crop`, and local conversation history.
- Sends a structured `POST` request to `/api/v1/assistant/chat`.

### 2. Context Service (`context_service.py`)
- Retrieves static Panchayat metadata (name, block, district, elevation) from the fast in-memory Parquet store (`db["features_dict"]`).
- Automatically fetches the live 7-day operational ECMWF forecast from Open-Meteo, runs it through the XGBoost downscaling model, and attaches the high-resolution rainfall predictions to the context.

### 3. Assistant Service (`assistant_service.py`)
- Orchestrates the RAG flow.
- Constructs a strict `System Prompt` that grounds the LLM in the retrieved context.
- Explicitly enforces anti-hallucination rules (e.g. "Never invent weather values").

### 4. LLM Provider (`llm_provider.py`)
- Abstract base class `LLMProvider` allowing for provider swapping.
- Default implementation `GeminiProvider` uses the `google-genai` SDK and the `gemini-2.5-flash` model.
- Restricts response output to a strict JSON schema (`CopilotResponse`).

## Security & Grounding
- **No Hallucination**: The LLM is strictly instructed to say "Data unavailable" if the `ContextService` fails to fetch the operational forecast.
- **Provider Abstraction**: API keys are isolated in the environment (`LLM_API_KEY`) and are never exposed to the frontend.
- **JSON Structured Output**: The LLM is forced to output a JSON object, preventing arbitrary text injection and ensuring the frontend receives a predictable schema.
- **Model Grounding**: The AI clarifies that model accuracy numbers come from the **2023 Pune historical validation** using the **CHIRPS reference** dataset, rather than falsely claiming 100% accuracy.
- **Decision-Support**: The AI never replaces IMD warnings and avoids offering guaranteed agricultural recommendations.

## Known Limitations
- Conversation history is currently maintained exclusively on the client (React state) and passed with each request. Long conversations may hit token limits, though this is mitigated by the concise nature of agricultural queries.
- Operational forecast is dependent on the free Open-Meteo API. Rate limits or timeouts will result in a graceful fallback message indicating forecast unavailability.
