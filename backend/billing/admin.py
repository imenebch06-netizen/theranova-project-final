from django.contrib import admin

from .models import Abonnement, Pack, Transaction


@admin.register(Pack)
class PackAdmin(admin.ModelAdmin):
    list_display = ["nom_pack", "prix", "nb_sessions", "is_active", "is_featured"]
    list_editable = ["is_active", "is_featured"]


@admin.register(Abonnement)
class AbonnementAdmin(admin.ModelAdmin):
    list_display = ["patient", "pack", "solde_restants", "statut", "date_fin"]
    list_filter = ["statut", "pack"]


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ["reference", "patient", "montant", "type", "statut", "methode", "date_transaction"]
    list_filter = ["statut", "type", "methode"]
    search_fields = ["reference", "patient__email"]
