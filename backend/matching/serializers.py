from rest_framework import serializers

from accounts.serializers import TherapistCardSerializer

from .models import Categorie, Question, QuestionnaireSession, ReponseProposee


class OptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReponseProposee
        fields = ["id", "texte", "texte_en", "score", "ordre"]


class QuestionSerializer(serializers.ModelSerializer):
    reponses = OptionSerializer(many=True, read_only=True)
    categorie = serializers.CharField(source="sous_categorie.categorie.nom", read_only=True)
    categorie_en = serializers.CharField(source="sous_categorie.categorie.nom_en", read_only=True)
    sous_categorie = serializers.CharField(source="sous_categorie.nom", read_only=True)

    class Meta:
        model = Question
        fields = ["id", "ordre", "texte", "texte_en", "categorie", "categorie_en",
                  "sous_categorie", "reponses"]


class CategorySerializer(serializers.ModelSerializer):
    questions = serializers.SerializerMethodField()

    class Meta:
        model = Categorie
        fields = ["id", "nom", "nom_en", "icone", "ordre", "questions"]

    def get_questions(self, obj):
        questions = [q for sub in obj.sous_categories.all() for q in sub.questions.all()]
        questions.sort(key=lambda q: (q.ordre, q.id))
        return QuestionSerializer(questions, many=True).data


class SubmitSerializer(serializers.Serializer):
    answers = serializers.DictField(child=serializers.IntegerField(), allow_empty=False)
    texte_libre = serializers.CharField(required=False, allow_blank=True, max_length=4000)
    type_session = serializers.ChoiceField(
        choices=["Individuel", "Couple", "Famille"], required=False, default="Individuel"
    )
    langue = serializers.ChoiceField(choices=["fr", "en", "ar"], required=False, default="")
    budget = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)


class RecommendationSerializer(serializers.Serializer):
    therapist = TherapistCardSerializer()
    score = serializers.IntegerField()
    affinite = serializers.IntegerField()
    raisons = serializers.ListField(child=serializers.CharField())
    prochain_creneau = serializers.DateTimeField(allow_null=True)


class SessionSerializer(serializers.ModelSerializer):
    recommandations = serializers.SerializerMethodField()

    class Meta:
        model = QuestionnaireSession
        fields = ["id", "type_session", "scores_specialites", "sentiment", "niveau_risque",
                  "resume", "resume_en", "recommandations", "texte_libre", "date_creation"]

    def get_recommandations(self, obj):
        from accounts.models import TherapistProfile

        results = []
        for item in obj.recommandations or []:
            profile = (
                TherapistProfile.objects.select_related("user")
                .prefetch_related("specialites")
                .filter(pk=item.get("therapist_id"))
                .first()
            )
            if not profile:
                continue
            results.append({
                "therapist": TherapistCardSerializer(profile).data,
                "score": item.get("score", 0),
                "affinite": item.get("affinite", 0),
                "raisons": item.get("raisons", []),
                "raisons_en": item.get("raisons_en", []),
                "prochain_creneau": item.get("prochain_creneau"),
            })
        return results


class HistorySerializer(serializers.ModelSerializer):
    specialite_principale = serializers.SerializerMethodField()
    top_therapeute = serializers.SerializerMethodField()

    class Meta:
        model = QuestionnaireSession
        fields = ["id", "date_creation", "type_session", "sentiment", "niveau_risque",
                  "specialite_principale", "top_therapeute", "resume", "resume_en"]

    def get_specialite_principale(self, obj):
        scores = obj.scores_specialites or {}
        if not scores:
            return None
        code = next(iter(scores))
        from accounts.models import Specialite

        specialite = Specialite.objects.filter(code=code).first()
        return {
            "code": code,
            "nom": specialite.nom if specialite else code,
            "nom_en": (specialite.nom_en if specialite else "") or (specialite.nom if specialite else code),
            "score": scores[code],
        }

    def get_top_therapeute(self, obj):
        from accounts.models import TherapistProfile
        from accounts.serializers import UserSerializer

        recommendations = obj.recommandations or []
        if not recommendations:
            return None
        profile = TherapistProfile.objects.select_related("user").filter(
            pk=recommendations[0].get("therapist_id")
        ).first()
        if not profile:
            return None
        return {"id": profile.id, "nom": profile.nom_complet,
                "avatar": profile.user.avatar, "score": recommendations[0].get("score")}
