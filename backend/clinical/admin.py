from django.contrib import admin

from .models import DossierPatient, NoteClinique, RapportSeance


class NoteInline(admin.TabularInline):
    model = NoteClinique
    extra = 0


@admin.register(DossierPatient)
class DossierAdmin(admin.ModelAdmin):
    list_display = ["patient", "therapeute", "statut", "date_ouverture", "progression"]
    list_filter = ["statut"]
    search_fields = ["patient__email", "patient__first_name", "patient__last_name"]
    inlines = [NoteInline]


admin.site.register(NoteClinique)
admin.site.register(RapportSeance)
