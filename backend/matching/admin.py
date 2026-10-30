from django.contrib import admin

from .models import (
    AnalyseIA,
    Categorie,
    Question,
    QuestionnaireSession,
    ReponsePatient,
    ReponseProposee,
    SousCategorie,
)


class OptionInline(admin.TabularInline):
    model = ReponseProposee
    extra = 0


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ["ordre", "texte", "sous_categorie", "actif"]
    list_filter = ["actif", "sous_categorie__categorie"]
    inlines = [OptionInline]


admin.site.register(Categorie)
admin.site.register(SousCategorie)
admin.site.register(QuestionnaireSession)
admin.site.register(ReponsePatient)
admin.site.register(AnalyseIA)
