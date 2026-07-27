"""Lenient JSON extraction from LLM output."""
from server.integrations.anthropic_llm import lenient_json_parse


def test_plain_json():
    assert lenient_json_parse('{"a": 1}') == {"a": 1}


def test_json_in_fence():
    text = 'הנה התשובה:\n```json\n{"calories": 650, "confidence": "high"}\n```\nבהצלחה!'
    assert lenient_json_parse(text) == {"calories": 650, "confidence": "high"}


def test_json_with_surrounding_prose():
    text = 'בטח! {"a": {"b": 2}} זהו.'
    assert lenient_json_parse(text) == {"a": {"b": 2}}


def test_garbage_returns_none():
    assert lenient_json_parse("שום דבר מובנה כאן") is None
    assert lenient_json_parse("") is None
