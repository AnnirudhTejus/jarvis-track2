from fastapi import APIRouter
from app.services.database import supabase
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

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


@router.get("/dashboard/stats")
def get_dashboard_stats():
    from datetime import date, timedelta
    today = date.today().isoformat()
    cutoff = (date.today() - timedelta(days=30)).isoformat()

    def q_tasks():
        return supabase.table("tasks").select("*, companies(name, initials, avatar_color)").eq("status", "pending").lte("due_date", today).execute()

    def q_active_companies():
        return supabase.table("engagements").select("company_id").eq("status", "active").execute()

    def q_recent_activity():
        # companies that have had any activity in last 30 days
        return supabase.table("activities").select("company_id").gte("activity_date", cutoff).execute()

    def q_recent_notes():
        return supabase.table("notes").select("company_id").gte("created_at", cutoff).eq("archived", False).execute()

    with ThreadPoolExecutor(max_workers=4) as ex:
        f_tasks    = ex.submit(q_tasks)
        f_active   = ex.submit(q_active_companies)
        f_activity = ex.submit(q_recent_activity)
        f_notes    = ex.submit(q_recent_notes)

    tasks          = f_tasks.result()
    active_cos     = f_active.result()
    recent_act     = f_activity.result()
    recent_notes   = f_notes.result()

    # companies with activity or notes in last 30d
    engaged_ids = set(
        [r["company_id"] for r in recent_act.data if r.get("company_id")] +
        [r["company_id"] for r in recent_notes.data if r.get("company_id")]
    )
    all_active_ids = {r["company_id"] for r in active_cos.data}
    stale_ids = all_active_ids - engaged_ids

    # fetch stale company details
    stale_companies = []
    if stale_ids:
        stale_result = supabase.table("companies").select("id, name, initials, avatar_color, industry, location").in_("id", list(stale_ids)).execute()
        stale_companies = stale_result.data

    return {
        "tasks_due_count": len(tasks.data),
        "tasks_due": tasks.data,
        "stale_companies_count": len(stale_ids),
        "stale_companies": stale_companies,
        "done_today_count": 0,
    }


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
    def q_company():
        return supabase.table("companies").select("*").eq("id", company_id).single().execute()
    def q_people():
        return supabase.table("person_company_history").select("*, people(*)").eq("company_id", company_id).eq("is_current", True).eq("people.archived", False).execute()
    def q_notes():
        return supabase.table("notes").select("*").eq("company_id", company_id).order("created_at", desc=True).execute()
    def q_activities():
        return supabase.table("activities").select("*").eq("company_id", company_id).order("activity_date", desc=True).execute()
    def q_engagements():
        return supabase.table("engagements").select("*").eq("company_id", company_id).eq("status", "active").execute()

    with ThreadPoolExecutor(max_workers=5) as ex:
        f_company     = ex.submit(q_company)
        f_people      = ex.submit(q_people)
        f_notes       = ex.submit(q_notes)
        f_activities  = ex.submit(q_activities)
        f_engagements = ex.submit(q_engagements)

    company     = f_company.result()
    people      = f_people.result()
    notes       = f_notes.result()
    activities  = f_activities.result()
    engagements = f_engagements.result()

    eng = engagements.data[0] if engagements.data else None
    return {
        "company": company.data,
        "people": [r["people"] | {"role": r["role"]} for r in people.data],
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

class PersonTaskIn(BaseModel):
    person_id: str
    text: str
    due_date: Optional[str] = None

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

@router.post("/people/{person_id}/tasks")
def create_person_task(person_id: str, body: PersonTaskIn):
    row = {
        "id": str(uuid.uuid4()),
        "person_id": person_id,
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

class NoteEditIn(BaseModel):
    content: str

@router.patch("/notes/{note_id}")
def edit_note(note_id: str, body: NoteEditIn):
    result = supabase.table("notes").update({"content": body.content}).eq("id", note_id).execute()
    return result.data[0] if result.data else {"id": note_id}

@router.patch("/notes/{note_id}/archive")
def archive_note(note_id: str):
    result = supabase.table("notes").update({"archived": True}).eq("id", note_id).execute()
    return {"id": note_id, "archived": True}


# ── Log activity ──────────────────────────────────────────────────────────────

class ActivityIn(BaseModel):
    company_id: str
    activity_type: str          # "call", "meeting", "email", "other"
    activity_date: str          # ISO date string
    notes: Optional[str] = None
    person_id: Optional[str] = None

@router.post("/activities")
def log_activity(body: ActivityIn):
    # activity_date column is timestamptz — send as full ISO datetime
    activity_dt = body.activity_date
    if len(activity_dt) == 10:  # plain "YYYY-MM-DD" date string
        activity_dt = activity_dt + "T00:00:00+00:00"
    row = {
        "id": str(uuid.uuid4()),
        "company_id": body.company_id,
        "activity_type": body.activity_type,
        "activity_date": activity_dt,
        "notes": body.notes,
        "person_id": body.person_id,
        "created_at": datetime.utcnow().isoformat(),
    }
    result = supabase.table("activities").insert(row).execute()

    # Update last_contact_at on the active engagement
    supabase.table("engagements").update({
        "last_contact_at": body.activity_date,
        "updated_at": datetime.utcnow().isoformat(),
    }).eq("company_id", body.company_id).eq("status", "active").execute()

    return result.data[0] if result.data else row


# ── Task completion ────────────────────────────────────────────────────────────

@router.patch("/tasks/{task_id}/done")
def complete_task(task_id: str):
    result = supabase.table("tasks").update({"status": "done"}).eq("id", task_id).execute()
    return result.data[0] if result.data else {"id": task_id, "status": "done"}


# ── Task edit ─────────────────────────────────────────────────────────────────

class TaskEditIn(BaseModel):
    text: str
    due_date: Optional[str] = None

@router.patch("/tasks/{task_id}")
def edit_task(task_id: str, body: TaskEditIn):
    update = {"text": body.text, "due_date": body.due_date}
    result = supabase.table("tasks").update(update).eq("id", task_id).execute()
    return result.data[0] if result.data else {"id": task_id}


# ── Stage change ───────────────────────────────────────────────────────────────

class StageIn(BaseModel):
    stage: str

@router.patch("/companies/{company_id}/stage")
def change_stage(company_id: str, body: StageIn):
    stage = normalise_stage(body.stage)
    result = supabase.table("engagements").update({
        "stage": stage,
        "updated_at": datetime.utcnow().isoformat()
    }).eq("company_id", company_id).eq("status", "active").execute()
    return {"company_id": company_id, "stage": stage}


# ── Person detail ──────────────────────────────────────────────────────────────

@router.get("/people/{person_id}")
def get_person_detail(person_id: str):
    def q_person():
        r = supabase.table("people").select("*").eq("id", person_id).execute()
        return r.data[0] if r.data else None
    def q_history():
        return supabase.table("person_company_history").select("*, companies(*)").eq("person_id", person_id).order("from_date", desc=True).execute()
    def q_notes():
        return supabase.table("notes").select("*").eq("person_id", person_id).eq("archived", False).order("created_at", desc=True).execute()
    def q_activities():
        return supabase.table("activities").select("*").eq("person_id", person_id).order("activity_date", desc=True).execute()
    def q_tasks():
        return supabase.table("tasks").select("*").eq("person_id", person_id).order("due_date").execute()

    with ThreadPoolExecutor(max_workers=5) as ex:
        f_person     = ex.submit(q_person)
        f_history    = ex.submit(q_history)
        f_notes      = ex.submit(q_notes)
        f_activities = ex.submit(q_activities)
        f_tasks      = ex.submit(q_tasks)

    person     = f_person.result()
    history    = f_history.result()
    notes      = f_notes.result()
    activities = f_activities.result()
    tasks      = f_tasks.result()

    if not person:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Person not found")

    current = next((r for r in history.data if r.get("is_current")), None)
    return {
        "person": person,
        "current_role": current.get("role") if current else None,
        "current_company": current.get("companies") if current else None,
        "history": history.data,
        "notes": notes.data,
        "activities": activities.data,
        "tasks": tasks.data,
    }


# ── Person note ────────────────────────────────────────────────────────────────

class PersonNoteIn(BaseModel):
    person_id: str
    content: str

@router.post("/people/{person_id}/notes")
def create_person_note(person_id: str, body: PersonNoteIn):
    row = {
        "id": str(uuid.uuid4()),
        "person_id": person_id,
        "content": body.content,
        "created_at": datetime.utcnow().isoformat(),
    }
    result = supabase.table("notes").insert(row).execute()
    return result.data[0] if result.data else row


# ── Add company ────────────────────────────────────────────────────────────────

class CompanyIn(BaseModel):
    name: str
    industry: Optional[str] = None
    location: Optional[str] = None
    website: Optional[str] = None
    stage: Optional[str] = "Funnel"

@router.post("/companies")
def create_company(body: CompanyIn):
    import re
    words = [w for w in re.split(r'\s+', body.name) if w]
    initials = ''.join(w[0] for w in words[:2]).upper()
    colors = ["av-purple", "av-teal", "av-amber", "av-blue"]
    avatar_color = colors[len(body.name) % len(colors)]

    company_row = {
        "id": str(uuid.uuid4()),
        "name": body.name,
        "industry": body.industry,
        "location": body.location,
        "website": body.website,
        "initials": initials,
        "avatar_color": avatar_color,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    company_result = supabase.table("companies").insert(company_row).execute()
    company = company_result.data[0] if company_result.data else company_row

    engagement_row = {
        "id": str(uuid.uuid4()),
        "company_id": company["id"],
        "stage": body.stage,
        "status": "active",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    supabase.table("engagements").insert(engagement_row).execute()
    return company


# ── Add person ─────────────────────────────────────────────────────────────────

class PersonIn(BaseModel):
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin: Optional[str] = None
    company_id: Optional[str] = None
    role: Optional[str] = None

@router.post("/people")
def create_person(body: PersonIn):
    person_row = {
        "id": str(uuid.uuid4()),
        "full_name": body.full_name,
        "email": body.email,
        "phone": body.phone,
        "linkedin": body.linkedin,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    person_result = supabase.table("people").insert(person_row).execute()
    person = person_result.data[0] if person_result.data else person_row

    if body.company_id:
        history_row = {
            "id": str(uuid.uuid4()),
            "person_id": person["id"],
            "company_id": body.company_id,
            "role": body.role,
            "is_current": True,
            "created_at": datetime.utcnow().isoformat(),
        }
        supabase.table("person_company_history").insert(history_row).execute()

    return person


# ── Edit company ───────────────────────────────────────────────────────────────

class CompanyEditIn(BaseModel):
    name: str
    industry: Optional[str] = None
    location: Optional[str] = None
    website: Optional[str] = None

@router.patch("/companies/{company_id}")
def edit_company(company_id: str, body: CompanyEditIn):
    import re
    words = [w for w in re.split(r'\s+', body.name) if w]
    initials = ''.join(w[0] for w in words[:2]).upper()
    update = {
        "name": body.name,
        "initials": initials,
        "industry": body.industry,
        "location": body.location,
        "website": body.website,
        "updated_at": datetime.utcnow().isoformat(),
    }
    result = supabase.table("companies").update(update).eq("id", company_id).execute()
    return result.data[0] if result.data else {"id": company_id}


# ── Edit person ────────────────────────────────────────────────────────────────

class PersonEditIn(BaseModel):
    full_name: str
    role: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin: Optional[str] = None

@router.patch("/people/{person_id}")
def edit_person(person_id: str, body: PersonEditIn):
    update = {
        "full_name": body.full_name,
        "email": body.email,
        "phone": body.phone,
        "linkedin": body.linkedin,
        "updated_at": datetime.utcnow().isoformat(),
    }
    supabase.table("people").update(update).eq("id", person_id).execute()
    # Update role in person_company_history if they have a current company
    if body.role is not None:
        supabase.table("person_company_history").update({"role": body.role}).eq("person_id", person_id).eq("is_current", True).execute()
    return {"id": person_id}


# ── Archive person ─────────────────────────────────────────────────────────────

@router.patch("/people/{person_id}/archive")
def archive_person(person_id: str):
    result = supabase.table("people").update({"archived": True}).eq("id", person_id).execute()
    return {"id": person_id, "archived": True}