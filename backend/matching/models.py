from django.conf import settings
from django.db import models


class Categorie(models.Model):
    nom = models.CharField(max_length=120)
    nom_en = models.CharField(max_length=120, blank=True)
    icone = models.CharField(max_length=50, blank=True)
    ordre = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["ordre", "nom"]
        verbose_name = "Catégorie de questionnaire"
        verbose_name_plural = "Catégories de questionnaire"

    def __str__(self):
        return self.nom


class SousCategorie(models.Model):
    categorie = models.ForeignKey(Categorie, on_delete=models.CASCADE, related_name="sous_categories")
    nom = models.CharField(max_length=120)
    nom_en = models.CharField(max_length=120, blank=True)

    class Meta:
        ordering = ["categorie__ordre", "nom"]
        verbose_name = "Sous-catégorie de questionnaire"
        verbose_name_plural = "Sous-catégories de questionnaire"

    def __str__(self):
        return f"{self.categorie.nom} › {self.nom}"


class Question(models.Model):
    sous_categorie = models.ForeignKey(
        SousCategorie, on_delete=models.CASCADE, related_name="questions"
    )
    texte = models.TextField()
    texte_en = models.TextField(blank=True)
    ordre = models.PositiveSmallIntegerField(default=0)
    actif = models.BooleanField(default=True)

    class Meta:
        ordering = ["ordre", "id"]
        verbose_name = "Question"
        verbose_name_plural = "Questions"

    def __str__(self):
        return f"Q{self.ordre} — {self.texte[:60]}"


class ReponseProposee(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="reponses")
    texte = models.CharField(max_length=255)
    texte_en = models.CharField(max_length=255, blank=True)
    score = models.PositiveSmallIntegerField(default=1, help_text="Intensité émotionnelle (0-4)")
    poids = models.JSONField(
        default=dict,
        blank=True,
        help_text="Pondération par code de spécialité, ex. {\"anxiete\": 3}",
    )
    ordre = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["question__ordre", "ordre"]
        verbose_name = "Réponse proposée"
        verbose_name_plural = "Réponses proposées"

    def __str__(self):
        return self.texte


class QuestionnaireSession(models.Model):
    """One questionnaire run — reusable before every new booking."""

    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="questionnaire_sessions"
    )
    reponses = models.JSONField(default=dict, blank=True)
    scores_specialites = models.JSONField(default=dict, blank=True)
    texte_libre = models.TextField(blank=True)
    type_session = models.CharField(max_length=20, default="Individuel")
    sentiment = models.CharField(max_length=20, blank=True)
    niveau_risque = models.CharField(max_length=20, default="faible")
    resume = models.TextField(blank=True)
    resume_en = models.TextField(blank=True)
    recommandations = models.JSONField(default=list, blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_creation"]
        verbose_name = "Session de questionnaire"
        verbose_name_plural = "Sessions de questionnaire"

    def __str__(self):
        return f"Questionnaire #{self.id} — {self.patient}"


class ReponsePatient(models.Model):
    session = models.ForeignKey(
        QuestionnaireSession, on_delete=models.CASCADE, related_name="reponses_patient"
    )
    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="questionnaire_answers"
    )
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    reponse = models.ForeignKey(ReponseProposee, on_delete=models.CASCADE)
    date_saisie = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["question__ordre"]
        verbose_name = "Réponse patient"
        verbose_name_plural = "Réponses patient"

    def __str__(self):
        return f"{self.patient} — {self.question_id}"


class AnalyseIA(models.Model):
    """Audit trail of every AI analysis (report: IA_Analyses)."""

    TYPE_CHOICES = [
        ("humeur", "Humeur"),
        ("questionnaire", "Questionnaire"),
        ("seance", "Séance"),
    ]
    type_analyse = models.CharField(max_length=20, choices=TYPE_CHOICES)
    entite_id = models.PositiveIntegerField(null=True, blank=True)
    utilisateur = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    donnees_entree = models.JSONField(default=dict, blank=True)
    resultats = models.JSONField(default=dict, blank=True)
    recommandations = models.TextField(blank=True)
    date_analyse = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_analyse"]
        verbose_name = "Analyse IA"
        verbose_name_plural = "Analyses IA"

    def __str__(self):
        return f"{self.type_analyse} — {self.date_analyse:%Y-%m-%d %H:%M}"
