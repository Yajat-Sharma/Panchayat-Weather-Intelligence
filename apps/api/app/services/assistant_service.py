import json
from typing import Dict, Any, List
from .llm_provider import get_llm_provider
from .context_service import ContextService

class AssistantService:
    def __init__(self, db: Dict[str, Any]):
        self.db = db
        try:
            self.llm = get_llm_provider()
        except ValueError as e:
            self.llm = None
            print(f"LLM Provider initialization failed: {e}")

    def chat(self, gpcode: str, crop: str, message: str, history: List[Dict[str, str]] = None, language: str = "en") -> Dict[str, Any]:
        if gpcode not in self.db.get("features_dict", {}):
            return {
                "answer": "Please select a valid Panchayat.",
                "panchayat": {"gpcode": gpcode},
                "context_used": [],
                "disclaimer": ""
            }
            
        if not self.llm:
            return {
                "answer": "The Panchayat AI is temporarily unavailable due to missing LLM configuration (e.g. GEMINI_API_KEY).",
                "panchayat": {"gpcode": gpcode},
                "context_used": [],
                "disclaimer": "System configuration error."
            }
            
        # 1. Retrieve Context
        context_data = ContextService.get_panchayat_context(gpcode, self.db, crop)

        context_data["user_crop_context"] = crop if crop else "No specific crop selected."

        lang_instruction = ""
        if language == "hi":
            lang_instruction = "13. YOU MUST REPLY IN HINDI (हिंदी). Your entire response must be in Hindi."
        elif language == "mr":
            lang_instruction = "13. YOU MUST REPLY IN MARATHI (मराठी). Your entire response must be in Marathi."

        # 2. Build System Prompt
        system_prompt = f"""ROLE:
You are Panchayat Weather Copilot. You help users understand weather information and agricultural decision-support information for their selected Panchayat.

RULES:
1. Use only the supplied CONTEXT.
2. NEVER invent or fabricate weather values (rainfall, temperature, etc.).
3. NEVER claim unavailable forecasts exist. If `7_day_operational_forecast` is missing, state clearly that you don't have forecast data.
4. Distinguish historical data from forecasts.
5. Use "CHIRPS reference" rather than "ground truth".
6. Explain technical information in simple language. Be concise and use farmer-friendly language.
7. Mention uncertainty when appropriate. Do not present prototype advisory logic as guaranteed agronomic recommendations.
8. If data is missing, say so.
9. Do not claim the model is universally accurate. It is an experimental XGBoost residual model trained on 2023 Pune data; accuracy numbers come from a 2023 historical test, not from verified live forecasts.
10. Do not claim the system replaces IMD or agricultural experts.
11. If the user asks about the model performance, quote only the numbers in `model_validation` (2023 spatial-block cross-validation). If it is missing, say the numbers are unavailable.
12a. When giving farm advice, follow the `advisory` block (its codes and parameters are the same ones the app shows) and explain it; do not contradict it. Mention the p10–p90 range or rain probability when uncertainty matters.
12. If the user asks about their specific crop, tailor your advice based on the supplied context and weather. If no crop is selected, ask them what they are growing.
{lang_instruction}
"""
        
        # 3. Generate Response
        try:
            context_str = json.dumps(context_data, indent=2)
            answer = self.llm.generate_response(system_prompt, context_str, message, history)
            
            return {
                "answer": answer,
                "panchayat": {
                    "gpcode": gpcode,
                    "name": context_data.get("panchayat_name"),
                    "block": context_data.get("block_name"),
                    "district": context_data.get("district_name")
                },
                "context_used": ["weather", "crop", "panchayat_metadata"],
                "disclaimer": "This is a prototype decision-support tool. Always combine AI insights with local field conditions and official IMD warnings."
            }
        except Exception as e:
            print(f"Assistant generation failed: {e}")
            return {
                "answer": "The Panchayat AI is temporarily unavailable. Please try again.",
                "panchayat": {"gpcode": gpcode},
                "context_used": [],
                "disclaimer": "Error occurred during generation."
            }
