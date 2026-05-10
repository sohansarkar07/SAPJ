"""
Second Brain — AI Engine (Groq Cloud + RAG Pipeline)
Provider  : Groq Cloud  (https://console.groq.com)
Default   : llama3-70b-8192   — free, fast, strong reasoning
Fallback  : llama3-8b-8192    — ultra-fast, still capable
"""
import os
import json
import re
from typing import Optional
from groq import Groq

# ── Config ──────────────────────────────────────────────────────────────────
GROQ_API_KEY   = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL     = os.getenv("GROQ_MODEL", "llama3-70b-8192")   # or mixtral-8x7b-32768
GROQ_MAX_TOKENS = int(os.getenv("GROQ_MAX_TOKENS", "1024"))

_client: Optional[Groq] = None
if GROQ_API_KEY:
    _client = Groq(api_key=GROQ_API_KEY)


# ── Core call ────────────────────────────────────────────────────────────────
def _call_groq(
    prompt: str,
    fallback: str = "",
    system: str = "You are a helpful AI assistant. Be concise and accurate.",
    model: str = GROQ_MODEL,
    max_tokens: int = GROQ_MAX_TOKENS,
    json_mode: bool = False,
) -> str:
    """Single-turn call to Groq. Returns text or fallback on error."""
    if not _client:
        return fallback
    try:
        kwargs = dict(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user",   "content": prompt},
            ],
            max_tokens=max_tokens,
            temperature=0.4,
        )
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}

        resp = _client.chat.completions.create(**kwargs)
        return resp.choices[0].message.content.strip()
    except Exception as e:
        print(f"[Groq error] {e}")
        return fallback


def _safe_json_dict(text: str, fallback_dict: dict) -> dict:
    """Try to extract a JSON object from an LLM response."""
    try:
        m = re.search(r'\{.*\}', text, re.DOTALL)
        return json.loads(m.group() if m else text)
    except Exception:
        return fallback_dict


def _safe_json_list(text: str, fallback_list: list) -> list:
    """Try to extract a JSON array from an LLM response."""
    try:
        m = re.search(r'\[.*\]', text, re.DOTALL)
        return json.loads(m.group() if m else text)
    except Exception:
        return fallback_list


# ── RAG helpers ──────────────────────────────────────────────────────────────
def simple_similarity(query: str, text: str) -> float:
    """Keyword-based similarity score (0–1)."""
    qw = set(query.lower().split())
    tw = set(text.lower().split())
    if not qw:
        return 0.0
    return len(qw & tw) / len(qw)


def semantic_search(query: str, documents: list) -> list:
    """
    Rank docs by keyword similarity, then use Groq to synthesise a brief
    answer from the top results.
    """
    scored = []
    for doc in documents:
        score = simple_similarity(
            query,
            doc.get("raw_content", "") + " " + doc.get("title", "")
        )
        scored.append({**doc, "score": round(min(score * 100, 99), 0)})

    scored.sort(key=lambda x: x["score"], reverse=True)
    top = scored[:5]
    if not top:
        return []

    context = "\n\n".join(
        [f"[{d['title']}]: {d['raw_content'][:400]}" for d in top[:3]]
    )
    synthesis = _call_groq(
        prompt=f"Query: {query}\n\nDocuments:\n{context}\n\nAnswer concisely in 2-3 sentences:",
        fallback=f"Found {len(top)} relevant documents matching your query.",
        system="You are a knowledge-base search assistant. Answer only from the provided documents.",
    )

    for item in top:
        item["ai_synthesis"] = synthesis if item is top[0] else None

    return top


# ── Feature functions ────────────────────────────────────────────────────────
def generate_grant_draft(org_info: str, guidelines: str, past_work: str) -> dict:
    fallback = {
        "org_overview":       f"Based on the provided information: {org_info[:200]}",
        "problem_statement":  "The organization addresses critical gaps in community services.",
        "proposed_solution":  "A comprehensive program combining direct service delivery with capacity building.",
        "expected_impact":    "Year 1: 1,000+ beneficiaries. Year 2: 2,500+ cumulative impact.",
        "budget_breakdown":   "Program delivery: 60%\nStaff: 25%\nAdmin: 15%",
        "timeline":           "Month 1-3: Setup\nMonth 4-12: Implementation\nMonth 13: Evaluation",
    }
    prompt = f"""You are an expert NGO grant writer. Write a complete grant application.

Organization info: {org_info}
Grant guidelines: {guidelines}
Past work & impact: {past_work}

Return ONLY valid JSON with keys: org_overview, problem_statement, proposed_solution,
expected_impact, budget_breakdown, timeline.
Be specific; use real numbers from the data provided."""

    result = _call_groq(prompt, json_mode=True, max_tokens=1500, fallback=json.dumps(fallback))
    return _safe_json_dict(result, fallback)


def generate_impact_report(data: str, period: str) -> dict:
    fallback = {
        "executive_summary":     f"In {period}, the organization made significant strides.",
        "programs_overview":     "Core programs continued with strong community engagement.",
        "beneficiary_impact":    "Hundreds of beneficiaries served across multiple programs.",
        "financial_summary":     "Budget utilized efficiently with strong accountability.",
        "volunteer_contribution":"Volunteers contributed meaningfully to program delivery.",
        "stories_from_field":    "Community members shared positive feedback on program impact.",
        "looking_ahead":         "Next quarter will focus on scaling successful programs.",
    }
    prompt = f"""You are an NGO impact report writer. Create a professional impact report for {period}.

Data: {data}

Return ONLY valid JSON with keys: executive_summary, programs_overview, beneficiary_impact,
financial_summary, volunteer_contribution, stories_from_field, looking_ahead.
Use specific numbers. Write in professional donor-ready language."""

    result = _call_groq(prompt, json_mode=True, max_tokens=1500, fallback=json.dumps(fallback))
    return _safe_json_dict(result, fallback)


def generate_mentee_brief(mentee_name: str, session_history: str, action_items: str) -> str:
    return _call_groq(
        prompt=f"""Generate a concise pre-session brief (3-4 bullet points) for a session with {mentee_name}.

Session history: {session_history}
Previous action items: {action_items}

Start with the most important follow-up, then current status, then today's focus. Under 100 words.""",
        fallback=(
            f"• Last session: Review notes for {mentee_name}.\n"
            f"• Action items: {action_items[:100]}\n"
            "• Focus today: Check progress on assigned tasks and set new goals."
        ),
        system="You are a mentoring assistant. Be concise and action-oriented.",
    )


def generate_volunteer_schedule(availability_data: str, programs: str) -> list:
    fallback = [
        {"volunteer_name": "Volunteer 1", "program_name": "Program A", "shift_date": "2026-05-15", "shift_time": "9AM-1PM",  "status": "confirmed"},
        {"volunteer_name": "Volunteer 2", "program_name": "Program B", "shift_date": "2026-05-16", "shift_time": "2PM-6PM",  "status": "pending"},
    ]
    prompt = f"""You are a volunteer coordinator. Create an optimal schedule.

Availability: {availability_data}
Programs needing volunteers: {programs}

Return ONLY a valid JSON array of 5-8 objects with keys:
volunteer_name, program_name, shift_date (YYYY-MM-DD), shift_time, status (confirmed/pending)."""

    result = _call_groq(prompt, json_mode=False, max_tokens=800, fallback=json.dumps(fallback))
    return _safe_json_list(result, fallback)


def generate_flashcards(content: str, deck_name: str) -> list:
    fallback = [
        {"question": "What is the main topic?",  "answer": f"Key information from {deck_name}"},
        {"question": "What are the key facts?",  "answer": "Important details extracted from the document."},
    ]
    prompt = f"""Create flashcards for spaced-repetition learning.

Content: {content[:2000]}
Deck: {deck_name}

Return ONLY a valid JSON array of 5-8 objects with keys: question, answer.
Focus on facts, numbers, dates, and concepts."""

    result = _call_groq(prompt, json_mode=False, max_tokens=800, fallback=json.dumps(fallback))
    return _safe_json_list(result, fallback)


def generate_morning_digest(documents: list, user_name: str = "User") -> dict:
    context = "\n".join(
        [f"- {d.get('title','')}: {d.get('summary', d.get('raw_content',''))[:200]}"
         for d in documents[:10]]
    )
    fallback = {
        "greeting":        f"Good morning, {user_name}! Here's your daily briefing.",
        "top_priorities":  ["Review grant application deadline", "Check volunteer schedule", "Follow up on pending emails"],
        "action_items":    ["Complete impact report section", "Confirm volunteer assignments", "Reply to donor email"],
        "key_insights":    ["3 new documents indexed overnight", "Grant deadline approaching in 3 days"],
    }
    prompt = f"""Generate a morning digest for {user_name}.

Recent activity:
{context}

Return ONLY valid JSON with keys: greeting (string), top_priorities (list of 3 strings),
action_items (list of 3 strings), key_insights (list of 2 strings).
Reference actual content from the documents."""

    result = _call_groq(prompt, json_mode=True, max_tokens=600, fallback=json.dumps(fallback))
    return _safe_json_dict(result, fallback)


def summarize_document(content: str, title: str) -> str:
    return _call_groq(
        prompt=f"Summarize in 2-3 sentences, highlighting key facts and numbers.\n\nTitle: {title}\nContent: {content[:3000]}",
        fallback=f"Document: {title}. Content processed and indexed.",
        system="You are a document summarizer. Be brief and factual.",
    )


def extract_action_items(content: str) -> list:
    result = _call_groq(
        prompt=f"Extract all action items, tasks, and follow-ups. Return ONLY a JSON array of strings:\n\n{content[:2000]}",
        fallback="[]",
        system="You are a task extractor. Return only a JSON array.",
    )
    try:
        return json.loads(result)
    except Exception:
        return []


def generate_project_brief(emails: str, project_name: str) -> str:
    return _call_groq(
        prompt=(
            f"Synthesise this client communication into a clear project brief for {project_name}.\n\n"
            f"{emails[:3000]}\n\n"
            "Include: client preferences, key decisions, pending items, tech stack, deadline. Under 200 words."
        ),
        fallback=f"Project brief for {project_name}: Review all client communications for full context.",
        system="You are a project manager AI. Be concise and structured.",
    )


def extract_text_from_pdf(file_bytes: bytes) -> str:
    try:
        import pdfplumber, io
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            return "\n".join(page.extract_text() or "" for page in pdf.pages)
    except Exception:
        try:
            import PyPDF2, io
            reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception:
            return ""
