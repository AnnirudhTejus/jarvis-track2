from fastapi import APIRouter
from app.services.database import supabase
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime

router = APIRouter()

# Stage ordering for the funnel
FUNNEL_STAGES = ["Funnel", "Pipeline", "Prospect", "Lead", "Client"]

# Map legacy seed stages to funnel stages
STAGE_ALIAS = {
    "New lead": "Funnel",
    "In conversation": "Pipeline",
    "Proposal sent": "Prospect",
    "Gone cold": "Funnel",
    "Follow up needed": "Pipeline",
    "Closed won": "Client",
    "Closed lost": "Funnel",
    # passthrough for proper stage names
    "Funnel": "Funnel",
    "Pipeline": "Pipeline",
    "Prospect": "Prospect",
    "Lead": "Lead",
    "Client": "Client",
}

def normalise_stage(stage: Optional[str]) -> str:
    if not stage:
        return "Funnel"
    return STAGE_ALIAS.get(stage, "Funnel")


@router.get("/companies")
def get_companies():
    companies = supabase.table("companies").select("*").execute()
    engagements = supabase.table("engagements").select("*").eq("status", "active").execute()

    eng_map = {e["company_id"]: e for e in engagements.data}

    result = []
    for c in companies.data:
        eng = eng_map.get(c["id"], {})
        raw_stage = eng.get("stage", "New lead")
        result.append({
            **c,
            "stage": normalise_stage(raw_stage),
            "raw_stage": raw_stage,
            "ai_tag": eng.get("ai_tag", None),
            "ai_class": eng.get("ai_class", "ai-neutral"),
            "last_contact_at": eng.get("last_contact_at", None)
        })
    return result


@router.get("/dashboard/funnel")
def get_funnel_counts():
    engagements = supabase.table("engagements").select("stage").eq("status", "active").execute()
    counts = {s: 0 for s in FUNNEL_STAGES}
    for e in engagements.data:
        stage = normalise_stage(e.get("stage"))
        counts[stage] = counts.get(stage, 0) + 1
    return {"stages": FUNNEL_STAGES, "counts": counts}


@router.get("/companies/{company_id}/details")
def get_company_details(company_id: str):
    company = supabase.table("companies").select("*").eq("id", company_id).single().execute()
    people = supabase.table("person_company_history").select("*, people(*)").eq("company_id", company_id).eq("is_current", True).execute()
    tasks = supabase.table("tasks").select("*").eq("company_id", company_id).eq("status", "pending").order("due_date").execute()
    notes = supabase.table("notes").select("*").eq("company_id", company_id).order("created_at", desc=True).execute()
    activities = supabase.table("activities").select("*").eq("company_id", company_id).order("activity_date", desc=True).execute()
    engagements = supabase.table("engagements").select("*").eq("company_id", company_id).eq("status", "active").execute()

    eng = engagements.data[0] if engagements.data else None
    return {
        "company": company.data,
        "people": [r["people"] | {"role": r["role"]} for r in people.data],
        "tasks": tasks.data,
        "notes": notes.data,
        "activities": activities.data,
        "engagement": eng,
        "stage": normalise_stage(eng.get("stage") if eng else None),
    }


@router.get("/people")
def get_people():
    result = supabase.table("person_company_history").select("*, people(*), companies(*)").eq("is_current", True).execute()
    return result.data


@router.get("/tasks")
def get_tasks():
    result = supabase.table("tasks").select("*, companies(*)").eq("status", "pending").execute()
    return result.data


# ── Write endpoints ────────────────────────────────────────────────────────────

class TaskIn(BaseModel):
    company_id: str
    text: str
    due_date: Optional[str] = None

class NoteIn(BaseModel):
    company_id: str
    content: str

@router.post("/tasks")
def create_task(body: TaskIn):
    row = {
        "id": str(uuid.uuid4()),
        "company_id": body.company_id,
        "text": body.text,
        "status": "pending",
        "created_at": datetime.utcnow().isoformat(),
    }
    if body.due_date:
        row["due_date"] = body.due_date
    result = supabase.table("tasks").insert(row).execute()
    return result.data[0] if result.data else row


@router.post("/notes")
def create_note(body: NoteIn):
    row = {
        "id": str(uuid.uuid4()),
        "company_id": body.company_id,
        "content": body.content,
        "created_at": datetime.utcnow().isoformat(),
    }
    result = supabase.table("notes").insert(row).execute()
    return result.data[0] if result.data else row