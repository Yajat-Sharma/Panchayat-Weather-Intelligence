import json

from app.services import llm_provider
from app.services.llm_provider import GroqProvider, get_llm_provider


class FakeResp:
    def raise_for_status(self):
        pass

    def json(self):
        return {"choices": [{"message": {"content": json.dumps({"answer": "Skip irrigation today."})}}]}


def test_groq_request_and_parsing(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    monkeypatch.delenv("MODEL_NAME", raising=False)
    sent = {}

    def fake_post(url, headers=None, json=None, timeout=None):
        sent.update(url=url, headers=headers, body=json)
        return FakeResp()

    monkeypatch.setattr(llm_provider.requests, "post", fake_post)
    provider = get_llm_provider()
    assert isinstance(provider, GroqProvider)
    answer = provider.generate_response("SYS", "{ctx}", "Should I irrigate?",
                                        [{"role": "user", "content": "hi"}, {"role": "model", "content": "hello"}])
    assert answer == "Skip irrigation today."
    assert sent["url"].startswith("https://api.groq.com/")
    assert sent["headers"]["Authorization"] == "Bearer test-key"
    body = sent["body"]
    assert body["model"] == "llama-3.3-70b-versatile"
    assert body["response_format"] == {"type": "json_object"}
    assert [m["role"] for m in body["messages"]] == ["system", "user", "assistant", "user"]
    assert "{ctx}" in body["messages"][0]["content"]
