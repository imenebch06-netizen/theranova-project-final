from django.conf import settings
from django.db import models


class Conversation(models.Model):
    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="conversations_patient"
    )
    therapeute = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="conversations_therapeute"
    )
    date_creation = models.DateTimeField(auto_now_add=True)
    derniere_activite = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("patient", "therapeute")
        ordering = ["-derniere_activite"]
        verbose_name = "Conversation"
        verbose_name_plural = "Conversations"

    def __str__(self):
        return f"{self.patient} ↔ {self.therapeute}"


class Message(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sent_messages"
    )
    contenu = models.TextField()
    piece_jointe = models.URLField(max_length=500, blank=True)
    lu = models.BooleanField(default=False)
    date_lecture = models.DateTimeField(null=True, blank=True)
    date_envoi = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["date_envoi"]
        verbose_name = "Message"
        verbose_name_plural = "Messages"

    def __str__(self):
        return f"{self.sender} : {self.contenu[:40]}"


class Notification(models.Model):
    class Type(models.TextChoices):
        CONFIRMATION = "confirmation", "Confirmation"
        RAPPEL = "rappel", "Rappel"
        MESSAGE = "message", "Message"
        ALERTE = "alerte", "Alerte"

    class Statut(models.TextChoices):
        ENVOYEE = "envoyee", "Envoyée"
        LUE = "lue", "Lue"
        ECHOUEE = "echouee", "Échouée"

    class Canal(models.TextChoices):
        EMAIL = "email", "Email"
        SMS = "sms", "SMS"
        PUSH = "push", "Push"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    titre = models.CharField(max_length=255)
    message = models.TextField()
    type = models.CharField(max_length=20, choices=Type.choices, default=Type.MESSAGE)
    statut = models.CharField(max_length=20, choices=Statut.choices, default=Statut.ENVOYEE)
    canal = models.CharField(max_length=20, choices=Canal.choices, default=Canal.PUSH)
    lien = models.CharField(max_length=255, blank=True)
    date_envoi = models.DateTimeField(auto_now_add=True)
    date_lecture = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-date_envoi"]
        indexes = [models.Index(fields=["user", "statut"])]
        verbose_name = "Notification"
        verbose_name_plural = "Notifications"

    def __str__(self):
        return f"{self.user} — {self.titre}"
