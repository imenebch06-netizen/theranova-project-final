from datetime import timedelta
from decimal import Decimal

from django.db.models import Avg, Count, Q, Sum
from django.db.models.functions import Coalesce, TruncMonth
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import PatientProfile, TherapistProfile, User
from billing.models import Transaction
from clinical.models import DossierPatient
from core.permissions import IsAdmin, IsPatient, IsTherapist
from feedback.models import Avis, Reclamation, Report
from matching.models import QuestionnaireSession
from messaging.models import Notification
from scheduling.models import DemandeRDV, Seance
from wellbeing.models import HumeurEntry
from wellbeing.services import compute_stats


def _range(period, date_from=None, date_to=None):
    today = timezone.localdate()
    if period == "day":
        start = today
    elif period == "week":
        start = today - timedelta(days=today.weekday())
    elif period == "year":
        start = today.replace(month=1, day=1)
    elif period == "all":
        start = None
    elif date_from:
        start = date_from
    else:
        start = today.replace(day=1)
    end = date_to or today
    return start, end


class AdminDashboardView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        period = request.query_params.get("period", "month")
        start, end = _range(
            period,
            request.query_params.get("date_from"),
            request.query_params.get("date_to"),
        )

        transactions = Transaction.objects.filter(statut=Transaction.Statut.OK)
        sessions = Seance.objects.all()
        if start:
            transactions = transactions.filter(date_transaction__date__gte=start, date_transaction__date__lte=end)
            sessions = sessions.filter(date_debut__date__gte=start, date_debut__date__lte=end)

        revenue = transactions.filter(
            type__in=[Transaction.Type.PACK, Transaction.Type.SEANCE]
        ).aggregate(total=Coalesce(Sum("montant"), Decimal("0")))["total"]

        completed = sessions.filter(statut=Seance.Statut.TERMINEE).count()
        cancelled_sessions = sessions.filter(statut=Seance.Statut.ANNULEE).count()
        upcoming = Seance.objects.filter(
            statut=Seance.Statut.PREVUE, date_debut__gte=timezone.now()
        ).count()

        demandes = DemandeRDV.objects.all()
        if start:
            demandes = demandes.filter(date_creation__date__gte=start, date_creation__date__lte=end)
        cancellations = demandes.filter(
            statut__in=[DemandeRDV.Statut.ANNULEE, DemandeRDV.Statut.REFUSEE]
        ).count()
        total_decided = completed + cancellations
        completion_rate = round(completed / total_decided * 100, 1) if total_decided else 0

        revenue_by_type = [
            {"type": row["type"], "total": float(row["total"])}
            for row in transactions.filter(
                type__in=[Transaction.Type.PACK, Transaction.Type.SEANCE]
            ).values("type").annotate(total=Sum("montant"))
        ]

        monthly = (
            Transaction.objects.filter(
                statut=Transaction.Statut.OK,
                type__in=[Transaction.Type.PACK, Transaction.Type.SEANCE],
            )
            .annotate(month=TruncMonth("date_transaction"))
            .values("month")
            .annotate(revenue=Sum("montant"), count=Count("id"))
            .order_by("month")[:12]
        )
        monthly_series = [
            {"month": row["month"].strftime("%Y-%m"), "revenue": float(row["revenue"]), "count": row["count"]}
            for row in monthly
        ]

        sessions_series = (
            Seance.objects.filter(statut=Seance.Statut.TERMINEE)
            .annotate(month=TruncMonth("date_debut"))
            .values("month")
            .annotate(count=Count("id"))
            .order_by("month")[:12]
        )

        top_therapists = (
            TherapistProfile.objects.select_related("user")
            .annotate(
                nb_seances=Count("seances", filter=Q(seances__statut=Seance.Statut.TERMINEE)),
            )
            .filter(nb_seances__gt=0)
            .order_by("-nb_seances")[:5]
        )

        complaints = Reclamation.objects.all()
        resolved = complaints.filter(statut=Reclamation.Statut.RESOLUE).count()
        open_complaints = complaints.exclude(
            statut__in=[Reclamation.Statut.RESOLUE, Reclamation.Statut.REJETEE]
        ).count()
        urgent = complaints.filter(priorite=Reclamation.Priorite.HAUTE).exclude(
            statut__in=[Reclamation.Statut.RESOLUE, Reclamation.Statut.REJETEE]
        ).count()

        recent_transactions = Transaction.objects.select_related("patient", "pack").order_by("-date_transaction")[:6]
        recent_complaints = Reclamation.objects.select_related("patient").order_by("-date_creation")[:5]

        return Response({
            "periode": {"start": start, "end": end, "label": period},
            "kpis": {
                "revenus": float(revenue),
                "objectif_revenus": 1250000,
                "seances_terminees": completed,
                "seances_annulees": cancelled_sessions,
                "seances_a_venir": upcoming,
                "taux_completion": completion_rate,
                "annulations": cancellations,
                "utilisateurs": User.objects.count(),
                "patients": User.objects.filter(role=User.Role.PATIENT).count(),
                "therapeutes": User.objects.filter(role=User.Role.THERAPIST).count(),
                "therapeutes_actifs": TherapistProfile.objects.filter(
                    statut=TherapistProfile.Statut.ACTIVE
                ).count(),
                "therapeutes_en_attente": TherapistProfile.objects.filter(
                    statut=TherapistProfile.Statut.PENDING
                ).count(),
                "nouveaux_utilisateurs": User.objects.filter(
                    date_joined__date__gte=start, date_joined__date__lte=end
                ).count() if start else User.objects.count(),
                "reclamations_ouvertes": open_complaints,
                "reclamations_urgentes": urgent,
                "taux_resolution": round(resolved / complaints.count() * 100, 1) if complaints.count() else 0,
                "signalements_ouverts": Report.objects.exclude(statut=Report.Statut.RESOLU).count(),
                "note_moyenne": float(Avis.objects.aggregate(avg=Avg("note"))["avg"] or 0),
            },
            "revenus_par_type": revenue_by_type,
            "series": {
                "revenus": monthly_series,
                "seances": [
                    {"month": row["month"].strftime("%Y-%m"), "count": row["count"]}
                    for row in sessions_series
                ],
            },
            "top_therapeutes": [
                {
                    "id": item.id,
                    "nom": item.nom_complet,
                    "avatar": item.user.avatar,
                    "note": float(item.note_globale),
                    "seances": item.nb_seances,
                    "specialites": [s.nom for s in item.specialites.all()],
                }
                for item in top_therapists
            ],
            "transactions_recentes": [
                {
                    "id": item.id,
                    "reference": item.reference,
                    "patient": item.patient.full_name,
                    "montant": float(item.montant),
                    "type": item.type,
                    "statut": item.statut,
                    "date": item.date_transaction,
                }
                for item in recent_transactions
            ],
            "reclamations_recentes": [
                {
                    "id": item.id,
                    "patient": item.patient.full_name,
                    "categorie": item.categorie,
                    "statut": item.statut,
                    "priorite": item.priorite,
                    "date": item.date_creation,
                }
                for item in recent_complaints
            ],
        })


class TherapistDashboardView(APIView):
    permission_classes = [IsTherapist]

    def get(self, request):
        therapist = request.user.therapist_profile
        today = timezone.localdate()
        now = timezone.now()
        week_end = now + timedelta(days=7)

        sessions = Seance.objects.filter(therapeute=therapist).select_related("patient")
        todays = sessions.filter(date_debut__date=today).order_by("date_debut")
        upcoming = sessions.filter(
            date_debut__gte=now, statut=Seance.Statut.PREVUE
        ).order_by("date_debut")[:5]
        pending_requests = DemandeRDV.objects.filter(
            creneau__therapeute=therapist, statut=DemandeRDV.Statut.EN_ATTENTE
        ).select_related("patient", "creneau").order_by("creneau__date_heure_debut")

        patient_ids = list(
            DossierPatient.objects.filter(therapeute=therapist).values_list("patient_id", flat=True)
        ) or list(
            Seance.objects.filter(therapeute=therapist).values_list("patient_id", flat=True)
        )
        moods = HumeurEntry.objects.filter(patient_id__in=patient_ids).order_by("-date_saisie")[:7]
        weekly_moods = HumeurEntry.objects.filter(
            patient_id__in=patient_ids, date_saisie__gte=today - timedelta(days=30)
        )
        mood_stats = compute_stats(list(weekly_moods), 30)

        alerts = HumeurEntry.objects.filter(
            patient_id__in=patient_ids, alerte=True, date_saisie__gte=today - timedelta(days=14)
        ).select_related("patient")

        month_start = today.replace(day=1)
        revenue = Transaction.objects.filter(
            statut=Transaction.Statut.OK,
            type=Transaction.Type.SEANCE,
            seance__therapeute=therapist,
            date_transaction__date__gte=month_start,
        ).aggregate(total=Coalesce(Sum("montant"), Decimal("0")))["total"]

        monthly_sessions = (
            Seance.objects.filter(therapeute=therapist)
            .annotate(month=TruncMonth("date_debut"))
            .values("month")
            .annotate(count=Count("id"))
            .order_by("month")[:6]
        )

        return Response({
            "kpis": {
                "seances_aujourdhui": todays.count(),
                "seances_semaine": sessions.filter(
                    date_debut__gte=now, date_debut__lte=week_end,
                    statut=Seance.Statut.PREVUE,
                ).count(),
                "seances_terminees": sessions.filter(statut=Seance.Statut.TERMINEE).count(),
                "patients_actifs": len(set(patient_ids)),
                "demandes_en_attente": pending_requests.count(),
                "note_globale": float(therapist.note_globale),
                "nombre_avis": therapist.nombre_avis,
                "revenus_mois": float(revenue),
                "humeur_moyenne_patients": mood_stats["moyenne"],
                "alertes_bien_etre": alerts.count(),
            },
            "agenda_du_jour": [
                {
                    "id": s.id,
                    "heure": s.date_debut,
                    "patient": s.patient.full_name,
                    "patient_avatar": s.patient.avatar,
                    "type_session": s.type_session,
                    "statut": s.statut,
                    "can_join": s.accessible_maintenant and s.statut in (Seance.Statut.PREVUE, Seance.Statut.EN_COURS),
                }
                for s in todays
            ],
            "prochaines_seances": [
                {
                    "id": s.id,
                    "date_debut": s.date_debut,
                    "patient": s.patient.full_name,
                    "avatar": s.patient.avatar,
                    "type_session": s.type_session,
                }
                for s in upcoming
            ],
            "demandes": [
                {
                    "id": d.id,
                    "patient": d.patient.full_name,
                    "avatar": d.patient.avatar,
                    "date_debut": d.creneau.date_heure_debut,
                    "type_session": d.type_session,
                    "message": d.message,
                }
                for d in pending_requests[:5]
            ],
            "humeurs_recentes": [
                {
                    "patient": m.patient.full_name,
                    "score": m.score,
                    "emotion": m.emotion,
                    "date": m.date_saisie,
                    "alerte": m.alerte,
                }
                for m in moods
            ],
            "alertes": [
                {"patient": a.patient.full_name, "score": a.score, "date": a.date_saisie,
                 "message": a.message_ia[:160]}
                for a in alerts[:5]
            ],
            "series": [
                {"month": row["month"].strftime("%Y-%m"), "count": row["count"]}
                for row in monthly_sessions
            ],
        })


class PatientDashboardView(APIView):
    permission_classes = [IsPatient]

    def get(self, request):
        from billing.models import Abonnement

        profile, _ = PatientProfile.objects.get_or_create(user=request.user)
        now = timezone.now()
        next_session = (
            Seance.objects.filter(patient=request.user, date_debut__gte=now)
            .exclude(statut=Seance.Statut.ANNULEE)
            .select_related("therapeute__user")
            .order_by("date_debut")
            .first()
        )
        completed = Seance.objects.filter(patient=request.user, statut=Seance.Statut.TERMINEE).count()
        entries = list(
            HumeurEntry.objects.filter(
                patient=request.user, date_saisie__gte=timezone.localdate() - timedelta(days=30)
            )
        )
        stats = compute_stats(entries, 30)
        today_entry = next((e for e in entries if e.date_saisie == timezone.localdate()), None)
        latest_questionnaire = QuestionnaireSession.objects.filter(patient=request.user).first()
        transactions = Transaction.objects.filter(patient=request.user).select_related("pack")[:4]
        notifications = Notification.objects.filter(
            user=request.user, statut=Notification.Statut.ENVOYEE
        )[:5]
        abonnement = Abonnement.objects.filter(
            patient=request.user, statut=Abonnement.Statut.ACTIF
        ).select_related("pack").first()

        return Response({
            "patient": {
                "id": request.user.id,
                "nom": request.user.full_name,
                "prenom": request.user.first_name,
                "avatar": request.user.avatar,
            },
            "kpis": {
                "solde": profile.solde,
                "seances_terminees": completed,
                "humeur_moyenne": stats["moyenne"],
                "serie_humeur": stats["serie_actuelle"],
                "humeur_aujourdhui": today_entry.score if today_entry else None,
                "notifications": Notification.objects.filter(
                    user=request.user, statut=Notification.Statut.ENVOYEE
                ).count(),
                "abonnement": abonnement.pack.nom_pack if abonnement else None,
                "abonnement_fin": abonnement.date_fin if abonnement else None,
            },
            "prochaine_seance": {
                "id": next_session.id,
                "date_debut": next_session.date_debut,
                "date_fin": next_session.date_fin,
                "type_session": next_session.type_session,
                "statut": next_session.statut,
                "therapeute": next_session.therapeute.nom_complet,
                "therapeute_avatar": next_session.therapeute.user.avatar,
                "can_join": next_session.accessible_maintenant,
            } if next_session else None,
            "humeur": stats,
            "recommandation": {
                "id": latest_questionnaire.id,
                "resume": latest_questionnaire.resume,
                "date": latest_questionnaire.date_creation,
                "top": (
                    latest_questionnaire.recommandations[0]["score"]
                    if latest_questionnaire and latest_questionnaire.recommandations else None
                ),
            } if latest_questionnaire else None,
            "transactions": [
                {
                    "id": t.id,
                    "reference": t.reference,
                    "montant": float(t.montant),
                    "type": t.type,
                    "statut": t.statut,
                    "date": t.date_transaction,
                    "pack": t.pack.nom_pack if t.pack else None,
                }
                for t in transactions
            ],
            "notifications": [
                {"id": n.id, "titre": n.titre, "message": n.message, "type": n.type, "date": n.date_envoi}
                for n in notifications
            ],
        })
