"""
Second Brain — AI Engine (Gemini + RAG Pipeline)
"""
import os
import json
import re
from typing import Optional
import google.generativeai as genai

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    _model = genai.GenerativeModel("gemini-1.5-flash")
else:
    _model = None


def _call_gemini(prompt: str, fallback: str = "") -> str:
    if not _model:
        return fallback
    try:
        response = _model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        print(f"Gemini error: {e}")
        return fallback


def simple_similarity(query: str, text: str) -> float:
    """Keyword-based fallback similarity when no embeddings available."""
    query_words = set(query.lower().split())
    text_words = set(text.lower().split())
    if not query_words:
        return 0.0
    intersection = query_words & text_words
    return len(intersection) / len(query_words)


def semantic_search(query: str, documents: list) -> list:
    """
    Search documents using keyword similarity (always works) +
    Gemini synthesis for top results.
    """
    scored = []
    for doc in documents:
        score = simple_similarity(query, doc.get("raw_content", "") + " " + doc.get("title", ""))
        scored.append({**doc, "score": round(min(score * 100, 99), 0)})

    scored.sort(key=lambda x: x["score"], reverse=True)
    top = scored[:5]

    if not top:
        return []

    # Synthesize an AI summary if Gemini is available
    context = "\n\n".join([f"[{d['title']}]: {d['raw_content'][:400]}" for d in top[:3]])
    synthesis = _call_gemini(
        f"You are a knowledge assistant. Based on these documents, answer this query concisely in 2-3 sentences:\n\nQuery: {query}\n\nDocuments:\n{context}\n\nAnswer:",
        fallback=f"Found {len(top)} relevant documents matching your query."
    )

    for item in top:
        item["ai_synthesis"] = synthesis if item == top[0] else None

    return top


def generate_grant_draft(org_info: str, guidelines: str, past_work: str) -> dict:
    prompt = f"""You are an expert NGO grant writer. Write a complete grant application with these sections:
1. Organization Overview
2. Problem Statement  
3. Proposed Solution
4. Expected Impact (with specific numbers)
5. Budget Breakdown (with line items)
6. Timeline

Organization info: {org_info}
Grant guidelines: {guidelines}
Past work & impact data: {past_work}

Return as JSON with keys: org_overview, problem_statement, proposed_solution, expected_impact, budget_breakdown, timeline.
Be specific, use real numbers from the data provided."""

    fallback = json.dumps({
        "org_overview": f"Based on the provided information: {org_info[:200]}",
        "problem_statement": "The organization addresses critical gaps in community services affecting thousands of beneficiaries.",
        "proposed_solution": "A comprehensive program combining direct service delivery with capacity building.",
        "expected_impact": "Year 1: 1,000+ beneficiaries. Year 2: 2,500+ cumulative impact.",
        "budget_breakdown": "Program delivery: 60%\nStaff: 25%\nAdmin: 15%",
        "timeline": "Month 1-3: Setup\nMonth 4-12: Implementation\nMonth 13: Evaluation"
    })

    result = _call_gemini(prompt, fallback=fallback)
    try:
        # Extract JSON from response
        json_match = re.search(r'\{.*\}', result, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
        return json.loads(result)
    except Exception:
        return json.loads(fallback)


def generate_impact_report(data: str, period: str) -> dict:
    prompt = f"""You are an NGO impact report writer. Create a professional quarterly impact report for {period} using this data:

{data}

Return JSON with keys: executive_summary, programs_overview, beneficiary_impact, financial_summary, volunteer_contribution, stories_from_field, looking_ahead.
Be specific with numbers. Write in professional donor-ready language."""

    fallback = json.dumps({
        "executive_summary": f"In {period}, the organization made significant strides in program delivery.",
        "programs_overview": "Core programs continued with strong community engagement.",
        "beneficiary_impact": "Hundreds of beneficiaries served across multiple programs.",
        "financial_summary": "Budget utilized efficiently with strong accountability.",
        "volunteer_contribution": "Volunteers contributed meaningfully to program delivery.",
        "stories_from_field": "Community members shared positive feedback on program impact.",
        "looking_ahead": "Next quarter will focus on scaling successful programs."
    })

    result = _call_gemini(prompt, fallback=fallback)
    try:
        json_match = re.search(r'\{.*\}', result, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
        return json.loads(result)
    except Exception:
        return json.loads(fallback)


def generate_mentee_brief(mentee_name: str, session_history: str, action_items: str) -> str:
    prompt = f"""You are an AI assistant for a mentor. Generate a concise pre-session brief (3-4 bullet points) for a session with {mentee_name}.

Session history: {session_history}
Previous action items: {action_items}

Format: Start with the most important follow-up, then current status, then what to focus on today. Keep it under 100 words. Be specific."""

    return _call_gemini(
        prompt,
        fallback=f"• Last session: Review notes for {mentee_name}.\n• Action items assigned: {action_items[:100]}\n• Focus today: Check progress on assigned tasks and set new goals."
    )


def generate_volunteer_schedule(availability_data: str, programs: str) -> list:
    prompt = f"""You are a volunteer coordinator AI. Given this availability data and program needs, create an optimal schedule.

Volunteer availability: {availability_data}
Programs needing volunteers: {programs}

Return a JSON array of objects with: volunteer_name, program_name, shift_date (YYYY-MM-DD), shift_time, status (confirmed/pending).
Create 5-8 schedule entries."""

    fallback = json.dumps([
        {"volunteer_name": "Volunteer 1", "program_name": "Program A", "shift_date": "2026-05-15", "shift_time": "9AM-1PM", "status": "confirmed"},
        {"volunteer_name": "Volunteer 2", "program_name": "Program B", "shift_date": "2026-05-16", "shift_time": "2PM-6PM", "status": "pending"},
    ])

    result = _call_gemini(prompt, fallback=fallback)
    try:
        json_match = re.search(r'\[.*\]', result, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
        return json.loads(result)
    except Exception:
        return json.loads(fallback)


def generate_flashcards(content: str, deck_name: str) -> list:
    prompt = f"""Extract key facts from this content and create flashcards for spaced repetition learning.

Content: {content[:2000]}
Deck: {deck_name}

Return a JSON array of objects with: question, answer.
Create 5-8 clear, specific question-answer pairs. Focus on important facts, numbers, dates, and concepts."""

    fallback = json.dumps([
        {"question": "What is the main topic of this document?", "answer": f"Key information from {deck_name}"},
        {"question": "What are the key facts?", "answer": "Important details extracted from the document."},
    ])

    result = _call_gemini(prompt, fallback=fallback)
    try:
        json_match = re.search(r'\[.*\]', result, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
        return json.loads(result)
    except Exception:
        return json.loads(fallback)


def generate_morning_digest(documents: list, user_name: str = "User") -> dict:
    context = "\n".join([f"- {d.get('title', '')}: {d.get('summary', d.get('raw_content', ''))[:200]}" for d in documents[:10]])
    prompt = f"""You are a personal AI assistant. Generate a morning digest for {user_name} based on recent documents.

Recent activity:
{context}

Return JSON with keys: greeting, top_priorities (list of 3), action_items (list of 3), key_insights (list of 2).
Be specific. Reference actual content from the documents."""

    fallback = json.dumps({
        "greeting": f"Good morning, {user_name}! Here's your daily briefing.",
        "top_priorities": ["Review grant application deadline", "Check volunteer schedule", "Follow up on pending emails"],
        "action_items": ["Complete impact report section", "Confirm volunteer assignments", "Reply to donor email"],
        "key_insights": ["3 new documents indexed overnight", "Grant deadline approaching in 3 days"]
    })

    result = _call_gemini(prompt, fallback=fallback)
    try:
        json_match = re.search(r'\{.*\}', result, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
        return json.loads(result)
    except Exception:
        return json.loads(fallback)


def extract_text_from_pdf(file_bytes: bytes) -> str:
    try:
        import pdfplumber
        import io
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            return "\n".join(page.extract_text() or "" for page in pdf.pages)
    except Exception:
        try:
            import PyPDF2
            import io
            reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception:
            return ""


def summarize_document(content: str, title: str) -> str:
    return _call_gemini(
        f"Summarize this document in 2-3 sentences, highlighting key facts and numbers:\n\nTitle: {title}\nContent: {content[:3000]}",
        fallback=f"Document: {title}. Content processed and indexed."
    )


def extract_action_items(content: str) -> list:
    result = _call_gemini(
        f"Extract all action items, tasks, and follow-ups from this text. Return as JSON array of strings:\n\n{content[:2000]}",
        fallback="[]"
    )
    try:
        return json.loads(result)
    except Exception:
        return []


def generate_project_brief(emails: str, project_name: str) -> str:
    return _call_gemini(
        f"You are a project manager AI. Synthesize this client communication into a clear project brief for {project_name}:\n\n{emails[:3000]}\n\nInclude: client preferences, key decisions made, pending items, tech stack, deadline. Under 200 words.",
        fallback=f"Project brief for {project_name}: Review all client communications for full context."
    )
