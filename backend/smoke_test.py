import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from rest_framework.test import APIClient

client = APIClient()


def login(email, password):
    response = client.post("/api/v1/auth/login/", {"email": email, "password": password}, format="json")
    assert response.status_code == 200, (email, response.status_code, response.data)
    return response.data["access"]


def check(label, path, expected=200, method="get", data=None):
    response = getattr(client, method)(path, data or {}, format="json")
    status = response.status_code
    body = response.data if hasattr(response, "data") else response.content
    ok = expected(status) if callable(expected) else status == expected
    print(f"{'OK ' if ok else 'ERR'} {label:38} {status} {str(body)[:110]}")
    return response


# ---------------- patient ----------------
token = login("patient@theranova.dz", "Patient123!")
client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
check("me", "/api/v1/auth/me/")
check("patient dashboard", "/api/v1/dashboard/patient/")
check("therapists", "/api/v1/accounts/therapists/")
check("specialties", "/api/v1/accounts/specialties/")
check("packs", "/api/v1/billing/packs/")
check("wallet", "/api/v1/billing/wallet/")
check("transactions", "/api/v1/billing/transactions/")
check("sessions", "/api/v1/scheduling/sessions/")
check("requests", "/api/v1/scheduling/requests/")
check("mood", "/api/v1/wellbeing/mood/")
check("mood stats", "/api/v1/wellbeing/mood/stats/")
check("insights", "/api/v1/wellbeing/insights/")
check("questionnaire", "/api/v1/matching/questionnaire/")
check("latest recommendation", "/api/v1/matching/recommendations/latest/")
check("history", "/api/v1/matching/history/")
check("notifications", "/api/v1/messaging/notifications/")
check("unread", "/api/v1/messaging/unread/")
check("conversations", "/api/v1/messaging/conversations/")
check("my reviews", "/api/v1/feedback/reviews/me/")
check("complaints", "/api/v1/feedback/complaints/")
check("reports", "/api/v1/feedback/reports/")

# upcoming session -> join might work depending on time
sessions = client.get("/api/v1/scheduling/sessions/").data["results"]
if sessions:
    sid = sessions[0]["id"]
    resp = client.post(f"/api/v1/scheduling/sessions/{sid}/join/")
    print("join session", resp.status_code, str(resp.data)[:150])

# create a new booking then cancel it
slots = client.get("/api/v1/scheduling/slots/?therapeute=1").data
results = slots.get("results", slots) if isinstance(slots, dict) else slots
if results:
    slot_id = results[0]["id"]
    resp = client.post("/api/v1/scheduling/requests/", {
        "creneau": slot_id, "type_session": "Individuel",
        "message": "Test de réservation automatisé",
    }, format="json")
    print("create booking", resp.status_code, str(resp.data)[:160])
    if resp.status_code == 201:
        did = resp.data["id"]
        resp2 = client.post(f"/api/v1/scheduling/requests/{did}/cancel/", {}, format="json")
        print("cancel booking", resp2.status_code, str(resp2.data)[:120])

# ---------------- therapist ----------------
token = login("therapist@theranova.dz", "Therapist123!")
client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
check("therapist dashboard", "/api/v1/dashboard/therapist/")
check("therapist me", "/api/v1/accounts/therapist/me/")
check("my slots", "/api/v1/scheduling/slots/")
check("incoming requests", "/api/v1/scheduling/requests/")
check("therapist sessions", "/api/v1/scheduling/sessions/")
check("dossiers", "/api/v1/clinical/dossiers/")
check("therapist patients", "/api/v1/accounts/therapist/patients/")
check("conversations", "/api/v1/messaging/conversations/")
check("reviews", "/api/v1/feedback/reviews/", expected=lambda s: s == 200)
check("complaints", "/api/v1/feedback/complaints/")

patients = client.get("/api/v1/accounts/therapist/patients/").data
patients = patients.get("results", patients)
if patients:
    pid = patients[0]["user"]["id"] if isinstance(patients[0].get("user"), dict) else patients[0]["user"]
    check("patient overview", f"/api/v1/clinical/patients/{pid}/")
    check("patient mood", f"/api/v1/wellbeing/mood/patient/{pid}/")

dossiers = client.get("/api/v1/clinical/dossiers/").data
dossiers = dossiers.get("results", dossiers)
if dossiers:
    did = dossiers[0]["id"]
    check("dossier notes", f"/api/v1/clinical/dossiers/{did}/notes/")

# ---------------- admin ----------------
token = login("admin@theranova.dz", "Admin123!")
client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
check("admin dashboard", "/api/v1/dashboard/admin/")
check("admin users", "/api/v1/accounts/admin/users/")
check("admin therapists", "/api/v1/accounts/admin/therapists/")
check("admin transactions", "/api/v1/billing/admin/transactions/")
check("admin complaints", "/api/v1/feedback/complaints/")
check("admin reports", "/api/v1/feedback/reports/")
check("therapist review summary", "/api/v1/feedback/reviews/therapist/1/")

print("\nSmoke test complete.")
