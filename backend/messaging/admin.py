from django.contrib import admin

from .models import Conversation, Message, Notification


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ["patient", "therapeute", "derniere_activite"]
    inlines = [MessageInline]


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["user", "titre", "type", "statut", "date_envoi"]
    list_filter = ["type", "statut", "canal"]
    search_fields = ["user__email", "titre"]
