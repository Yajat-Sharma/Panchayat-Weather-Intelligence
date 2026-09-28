import json
import os
from abc import ABC, abstractmethod
from pathlib import Path

import requests
from dotenv import load_dotenv
from pydantic import BaseModel

# apps/api/.env (gitignored) holds GROQ_API_KEY etc.; real environment variables win.
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

class CopilotResponse(BaseModel):
    answer: str

class LLMProvider(ABC):
    @abstractmethod
    def generate_response(self, system_prompt: str, context: str, user_message: str, history: list = None) -> str:
        """
        Abstract method to generate a response from the LLM.
        """
        pass

class GroqProvider(LLMProvider):
    """Groq's OpenAI-compatible chat completions API, in JSON mode."""

    URL = "https://api.groq.com/openai/v1/chat/completions"

    def __init__(self):
        self.api_key = os.getenv("GROQ_API_KEY") or os.getenv("LLM_API_KEY")
        self.model_name = os.getenv("MODEL_NAME", "llama-3.3-70b-versatile")
        if not self.api_key:
            raise ValueError("GROQ_API_KEY environment variable is missing.")

    def generate_response(self, system_prompt: str, context: str, user_message: str, history: list = None) -> str:
        messages = [{
            "role": "system",
            "content": f"{system_prompt}\n\nCONTEXT:\n{context}\n\n"
                       'Respond with a JSON object of the form {"answer": "<your reply>"}.',
        }]
        for msg in history or []:
            role = "user" if msg.get("role") == "user" else "assistant"
            messages.append({"role": role, "content": msg.get("content", "")})
        messages.append({"role": "user", "content": user_message})

        resp = requests.post(
            self.URL,
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={
                "model": self.model_name,
                "messages": messages,
                "temperature": 0.2,  # keep low to prevent hallucination
                "response_format": {"type": "json_object"},
            },
            timeout=30,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        return CopilotResponse(**json.loads(content)).answer


class GeminiProvider(LLMProvider):
    def __init__(self):
        from google import genai

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
    provider_name = os.getenv("LLM_PROVIDER", "groq").lower()
    if provider_name == "groq":
        return GroqProvider()
    if provider_name == "gemini":
        return GeminiProvider()
    else:
        raise ValueError(f"Unsupported LLM provider: {provider_name}")
