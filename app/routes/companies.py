from fastapi import APIRouter
from app.services.database import supabase

router = APIRouter()

@router.get("/companies")
def get_companies():
    companies = supabase.table("companies").select("*").execute()
    engagements = supabase.table("engagements").select("*").eq("status", "active").execute()
    
    eng_map = {e["company_id"]: e for e in engagements.data}
    
    result = []
    for c in companies.data:
        eng = eng_map.get(c["id"], {})
        result.append({
            **c,
            "stage": eng.get("stage", "New lead"),
            "ai_tag": eng.get("ai_tag", None),
            "ai_class": eng.get("ai_class", "ai-neutral"),
            "last_contact_at": eng.get("last_contact_at", None)
        })
    return result

@router.get("/companies/{company_id}/details")
def get_company_details(company_id: str):
    company = supabase.table("companies").select("*").eq("id", company_id).single().execute()
    people = supabase.table("person_company_history").select("*, people(*)").eq("company_id", company_id).eq("is_current", True).execute()
    tasks = supabase.table("tasks").select("*").eq("company_id", company_id).execute()
    notes = supabase.table("notes").select("*").eq("company_id", company_id).execute()
    activities = supabase.table("activities").select("*").eq("company_id", company_id).order("activity_date", desc=True).execute()
    engagements = supabase.table("engagements").select("*").eq("company_id", company_id).eq("status", "active").execute()

    return {
        "company": company.data,
        "people": [r["people"] | {"role": r["role"]} for r in people.data],
        "tasks": tasks.data,
        "notes": notes.data,
        "activities": activities.data,
        "engagement": engagements.data[0] if engagements.data else None
    }

@router.get("/people")
def get_people():
    result = supabase.table("person_company_history").select("*, people(*), companies(*)").eq("is_current", True).execute()
    return result.data

@router.get("/tasks")
def get_tasks():
    result = supabase.table("tasks").select("*, companies(*)").eq("status", "pending").execute()
    return result.data