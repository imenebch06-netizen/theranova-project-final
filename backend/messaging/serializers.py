from rest_framework import serializers

from .models import Conversation, Message, Notification


class MessageSerializer(serializers.ModelSerializer):
    sender_nom = serializers.CharField(source="sender.full_name", read_only=True)
    sender_avatar = serializers.URLField(source="sender.avatar", read_only=True)
    mine = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ["id", "conversation", "sender", "sender_nom", "sender_avatar", "contenu",
                  "piece_jointe", "lu", "date_lecture", "date_envoi", "mine"]
        read_only_fields = ["id", "conversation", "sender", "lu", "date_lecture", "date_envoi"]

    def get_mine(self, obj):
        request = self.context.get("request")
        return bool(request and obj.sender_id == request.user.id)


class ConversationSerializer(serializers.ModelSerializer):
    patient_nom = serializers.CharField(source="patient.full_name", read_only=True)
    patient_avatar = serializers.URLField(source="patient.avatar", read_only=True)
    therapeute_nom = serializers.SerializerMethodField()
    therapeute_avatar = serializers.URLField(source="therapeute.avatar", read_only=True)
    dernier_message = serializers.SerializerMethodField()
    non_lus = serializers.SerializerMethodField()
    interlocuteur = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ["id", "patient", "patient_nom", "patient_avatar", "therapeute",
                  "therapeute_nom", "therapeute_avatar", "interlocuteur", "dernier_message",
                  "non_lus", "date_creation", "derniere_activite"]

    def get_therapeute_nom(self, obj):
        profile = getattr(obj.therapeute, "therapist_profile", None)
        return profile.nom_complet if profile else obj.therapeute.full_name

    def get_dernier_message(self, obj):
        message = obj.messages.last()
        if not message:
            return None
        return {
            "contenu": message.contenu[:120],
            "date_envoi": message.date_envoi,
            "sender_id": message.sender_id,
        }

    def get_non_lus(self, obj):
        request = self.context.get("request")
        if not request:
            return 0
        return obj.messages.filter(lu=False).exclude(sender=request.user).count()

    def get_interlocuteur(self, obj):
        request = self.context.get("request")
        if not request:
            return None
        other = obj.therapeute if obj.patient_id == request.user.id else obj.patient
        profile = getattr(other, "therapist_profile", None)
        return {
            "id": other.id,
            "nom": profile.nom_complet if profile else other.full_name,
            "avatar": other.avatar,
            "role": other.role,
        }


class NotificationSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source="get_type_display", read_only=True)
    statut_display = serializers.CharField(source="get_statut_display", read_only=True)

    class Meta:
        model = Notification
        fields = ["id", "titre", "message", "type", "type_display", "statut", "statut_display",
                  "canal", "lien", "date_envoi", "date_lecture"]


class SendMessageSerializer(serializers.Serializer):
    contenu = serializers.CharField(max_length=4000)
    piece_jointe = serializers.URLField(required=False, allow_blank=True)
