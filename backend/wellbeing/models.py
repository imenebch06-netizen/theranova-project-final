from django.conf import settings
from django.db import models
from django.utils import timezone


class HumeurEntry(models.Model):
    class Emotion(models.TextChoices):
        JOYEUX = "joyeux", "Joyeux"
        CALME = "calme", "Calme"
        NEUTRE = "neutre", "Neutre"
        ANXIEUX = "anxieux", "Anxieux"
        TRISTE = "triste", "Triste"
        EN_COLERE = "en_colere", "En colère"
        FATIGUE = "fatigue", "Fatigue"

    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="humeurs"
    )
    score = models.PositiveSmallIntegerField(help_text="1 (très mal) à 10 (excellent)")
    emotion = models.CharField(max_length=20, choices=Emotion.choices, default=Emotion.NEUTRE)
    note = models.TextField(blank=True)
    message_ia = models.TextField(blank=True)
    alerte = models.BooleanField(default=False)
    tags = models.JSONField(default=list, blank=True)
    date_saisie = models.DateField(default=timezone.localdate)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date_saisie"]
        unique_together = ("patient", "date_saisie")
        indexes = [models.Index(fields=["patient", "date_saisie"])]
        verbose_name = "Entrée d'humeur"
        verbose_name_plural = "Entrées d'humeur"

    def __str__(self):
        return f"{self.patient} — {self.date_saisie} : {self.score}/10"

    @property
    def jour(self):
        return self.date_saisie.strftime("%A")
