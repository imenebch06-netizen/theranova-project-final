from rest_framework import serializers

from .models import HumeurEntry


class HumeurSerializer(serializers.ModelSerializer):
    emotion_display = serializers.CharField(source="get_emotion_display", read_only=True)

    class Meta:
        model = HumeurEntry
        fields = ["id", "score", "emotion", "emotion_display", "note", "message_ia",
                  "alerte", "tags", "date_saisie", "date_creation", "date_modification"]
        read_only_fields = ["id", "message_ia", "alerte", "date_creation", "date_modification"]


class HumeurCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = HumeurEntry
        fields = ["score", "emotion", "note", "tags"]

    def validate_score(self, value):
        if not 1 <= value <= 10:
            raise serializers.ValidationError("Le score doit être compris entre 1 et 10.")
        return value
