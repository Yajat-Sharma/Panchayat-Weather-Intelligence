import os
from abc import ABC, abstractmethod
from google import genai
from pydantic import BaseModel

class CopilotResponse(BaseModel):
    answer: str

class LLMProvider(ABC):
    @abstractmethod
    def generate_response(self, system_prompt: str, context: str, user_message: str, history: list = None) -> str:
        """
        Abstract method to generate a response from the LLM.
        """
        pass

class GeminiProvider(LLMProvider):
    def __init__(self):
        self.api_key = os.getenv("LLM_API_KEY")
        self.model_name = os.getenv("MODEL_NAME", "gemini-2.5-flash")
        if not self.api_key:
            raise ValueError("LLM_API_KEY environment variable is missing.")
        self.client = genai.Client(api_key=self.api_key)
        
    def generate_response(self, system_prompt: str, context: str, user_message: str, history: list = None) -> str:
        full_system_prompt = f"{system_prompt}\n\nCONTEXT:\n{context}"
        
        contents = []
        if history:
            for msg in history:
                role = "user" if msg.get("role") == "user" else "model"
                contents.append(
                    {"role": role, "parts": [{"text": msg.get("content", "")}]}
                )
                
        contents.append(
            {"role": "user", "parts": [{"text": user_message}]}
        )
        
        config = {
            "system_instruction": full_system_prompt,
            "temperature": 0.2, # Keep temperature low to prevent hallucination
            "response_mime_type": "application/json",
            "response_schema": CopilotResponse,
        }
        
        response = self.client.models.generate_content(
            model=self.model_name,
            contents=contents,
            config=config,
        )
        
        return response.parsed.answer

def get_llm_provider() -> LLMProvider:
    provider_name = os.getenv("LLM_PROVIDER", "gemini").lower()
    if provider_name == "gemini":
        return GeminiProvider()
    else:
        raise ValueError(f"Unsupported LLM provider: {provider_name}")
