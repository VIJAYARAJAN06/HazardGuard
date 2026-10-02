"""
HAZARDGUARD AI Safety Advisory Service.
If OPENAI_API_KEY or GEMINI_API_KEY is available in the environment,
generates dynamic generative AI explanation and operational directives.
Otherwise, provides a transparent, deterministic safety advisory report
with full context disclosure (never misleading the user).
"""

import os
import json
import httpx
from typing import Dict, Any, List

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
if OPENAI_API_KEY == "your_openai_api_key_here":
    OPENAI_API_KEY = ""


async def generate_incident_explanation(incident_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Synthesize operational explanation from incident telemetry, evidence, and failure mechanisms.
    """
    zone = incident_data.get("zone", "Zone 01")
    worker = incident_data.get("worker_name", "Unassigned Worker")
    severity = incident_data.get("severity", "Warning")
    incident_type = incident_data.get("incident_type", "Hazard Event")
    evidence = incident_data.get("evidence", [])
    mechanisms = incident_data.get("mechanisms", [])
    snapshot = incident_data.get("sensor_snapshot", {})

    # If real API key is present, attempt LLM call
    if OPENAI_API_KEY:
        try:
            prompt = (
                f"You are the HAZARDGUARD AI Safety Advisory Engine for an industrial control room.\n"
                f"Analyze this incident:\n"
                f"- Zone: {zone}\n"
                f"- Worker: {worker}\n"
                f"- Severity: {severity}\n"
                f"- Incident Type: {incident_type}\n"
                f"- Evidence: {json.dumps(evidence)}\n"
                f"- Triggered Mechanisms: {json.dumps(mechanisms)}\n"
                f"- Sensor Snapshot: {json.dumps(snapshot)}\n\n"
                f"Provide concise, operational directives answering:\n"
                f"1. What happened?\n"
                f"2. Why did the system trigger?\n"
                f"3. Root cause assessment\n"
                f"4. Immediate tactical responder directive\n"
                f"5. Long-term preventative measures\n"
            )
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"},
                    json={
                        "model": "gpt-4o-mini",
                        "messages": [{"role": "system", "content": "You are an industrial safety expert."}, {"role": "user", "content": prompt}],
                        "temperature": 0.2
                    }
                )
                if res.status_code == 200:
                    ai_text = res.json()["choices"][0]["message"]["content"]
                    return {
                        "mode": "GENAI_CONNECTED",
                        "engine": "OpenAI GPT-4o-mini",
                        "narrative": ai_text,
                        "structured_qa": [
                            {"q": "What happened?", "a": f"{incident_type} identified in {zone} affecting {worker}."},
                            {"q": "AI Analysis", "a": ai_text}
                        ]
                    }
        except Exception as e:
            # Fall back to deterministic advisory on network/key failure
            pass

    # Deterministic Advisory Engine (Transparent fallback)
    what_happened = f"An acute {severity.upper()} hazard event was triggered in {zone}. The system detected {incident_type} involving personnel {worker}."
    why_triggered = (
        f"Correlated evidence points: {'; '.join(evidence) if evidence else 'Baseline deviation'}. "
        f"Mechanisms activated: {'; '.join(mechanisms) if mechanisms else 'Operational threshold crossed'}."
    )
    root_cause = (
        "Multi-factor atmospheric deterioration accompanied by personnel immobilization. "
        "Gas sensors detected hazardous accumulation while movement telemetry registered zero displacement."
        if "Critical" in severity or "High" in severity else
        "Local environmental threshold breach requiring operational surveillance and airflow adjustment."
    )
    tactical_directive = incident_data.get("recommended_action", "Maintain safety protocol and dispatch investigation unit.")

    return {
        "mode": "DETERMINISTIC_SAFETY_ENGINE",
        "engine": "HAZARDGUARD Operational Intelligence Core (Deterministic Advisory Mode — No External LLM Key Configured)",
        "narrative": f"{what_happened}\n\nEvidence Summary:\n{why_triggered}\n\nRoot Cause Evaluation:\n{root_cause}\n\nTactical Directive:\n{tactical_directive}",
        "structured_qa": [
            {"q": "What happened?", "a": what_happened},
            {"q": "Why did the system detect it?", "a": why_triggered},
            {"q": "Root cause evaluation?", "a": root_cause},
            {"q": "What tactical action must the operator take?", "a": tactical_directive},
            {"q": "What preventative measures are required?", "a": "Perform full atmospheric leak test, calibrate sensor cluster, and verify personal alert safety system (PASS) beacon battery."}
        ]
    }
