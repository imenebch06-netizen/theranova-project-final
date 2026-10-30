from django.contrib import admin

from .models import HumeurEntry


@admin.register(HumeurEntry)
class HumeurAdmin(admin.ModelAdmin):
    list_display = ["patient", "date_saisie", "score", "emotion", "alerte"]
    list_filter = ["emotion", "alerte", "date_saisie"]
    search_fields = ["patient__email", "patient__first_name", "patient__last_name"]
