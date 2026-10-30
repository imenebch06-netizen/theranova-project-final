from django.contrib import admin

from .models import Creneau, DemandeRDV, GoogleMeetSession, ParticipantDemande, Seance, SessionParticipant


@admin.register(Creneau)
class CreneauAdmin(admin.ModelAdmin):
    list_display = ["therapeute", "date_heure_debut", "date_heure_fin", "statut"]
    list_filter = ["statut", "therapeute"]
    date_hierarchy = "date_heure_debut"


class ParticipantInline(admin.TabularInline):
    model = ParticipantDemande
    extra = 0


@admin.register(DemandeRDV)
class DemandeAdmin(admin.ModelAdmin):
    list_display = ["id", "patient", "creneau", "type_session", "statut", "prix_total", "date_creation"]
    list_filter = ["statut", "type_session"]
    inlines = [ParticipantInline]


class SessionParticipantInline(admin.TabularInline):
    model = SessionParticipant
    extra = 0


@admin.register(Seance)
class SeanceAdmin(admin.ModelAdmin):
    list_display = ["id", "patient", "therapeute", "date_debut", "statut", "type_session", "prix_final"]
    list_filter = ["statut", "type_session"]
    inlines = [SessionParticipantInline]


admin.site.register(GoogleMeetSession)
