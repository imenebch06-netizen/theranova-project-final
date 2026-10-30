from django.contrib import admin

from .models import Avis, Reclamation, Report


@admin.register(Avis)
class AvisAdmin(admin.ModelAdmin):
    list_display = ["patient", "therapeute", "note", "visible", "date_creation"]
    list_filter = ["note", "visible"]


@admin.register(Reclamation)
class ReclamationAdmin(admin.ModelAdmin):
    list_display = ["id", "patient", "categorie", "statut", "priorite", "date_creation"]
    list_filter = ["statut", "priorite", "categorie"]


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ["sujet", "type", "auteur", "priorite", "statut", "date_creation"]
    list_filter = ["type", "statut", "priorite"]
