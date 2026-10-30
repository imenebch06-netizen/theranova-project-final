from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsPatient
from core.utils import log_action

from .models import (
    AnalyseIA,
    Categorie,
    Question,
    QuestionnaireSession,
    ReponsePatient,
)
from .serializers import (
    CategorySerializer,
    HistorySerializer,
    SessionSerializer,
    SubmitSerializer,
)
from .services import (
    analyze_text,
    build_summary,
    compute_specialty_scores,
    recommend_therapists,
)


class QuestionnaireView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        categories = Categorie.objects.prefetch_related(
            "sous_categories__questions__reponses"
        ).all()
        data = CategorySerializer(categories, many=True).data
        total = sum(len(category["questions"]) for category in data)
        return Response({"categories": data, "total_questions": total})


class SubmitQuestionnaireView(APIView):
    permission_classes = [IsPatient]

    @transaction.atomic
    def post(self, request):
        serializer = SubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        questions = list(Question.objects.filter(actif=True).prefetch_related("reponses"))
        answers = data["answers"]

        missing = [str(q.id) for q in questions if str(q.id) not in answers]
        if missing:
            return Response(
                {"detail": "Merci de répondre à toutes les questions.", "missing": missing},
                status=status.HTTP_400_BAD_REQUEST,
            )

        selected = []
        session = QuestionnaireSession.objects.create(
            patient=request.user,
            texte_libre=data.get("texte_libre", ""),
            type_session=data["type_session"],
        )

        for question in questions:
            option = next((o for o in question.reponses.all() if o.id == answers[str(question.id)]), None)
            if not option:
                return Response(
                    {"detail": f"Réponse invalide pour la question {question.id}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            selected.append(option)
            ReponsePatient.objects.create(
                session=session,
                patient=request.user,
                question=question,
                reponse=option,
            )

        text_analysis = analyze_text(data.get("texte_libre", ""))
        scores = compute_specialty_scores(selected, text_analysis)
        ranked = recommend_therapists(
            scores,
            type_session=data["type_session"],
            langue=data.get("langue", ""),
            budget=data.get("budget"),
            limit=3,
        )

        names = [item["therapist"].nom_complet for item in ranked]
        session.scores_specialites = scores
        session.sentiment = text_analysis["sentiment"]
        session.niveau_risque = "eleve" if text_analysis["risque"] else (
            "modere" if text_analysis["sentiment"] == "negatif" else "faible"
        )
        session.resume = build_summary(scores, text_analysis["sentiment"], text_analysis["risque"], names)
        session.resume_en = build_summary(
            scores, text_analysis["sentiment"], text_analysis["risque"], names, lang="en"
        )
        session.recommandations = [
            {
                "therapist_id": item["therapist"].id,
                "score": item["score"],
                "affinite": item["affinite"],
                "raisons": item["raisons"],
                "raisons_en": item.get("raisons_en", []),
                "prochain_creneau": item["prochain_creneau"].isoformat()
                if item["prochain_creneau"] else None,
            }
            for item in ranked
        ]
        session.reponses = {
            "answers": answers,
            "sentiment": text_analysis,
        }
        session.save()

        AnalyseIA.objects.create(
            type_analyse="questionnaire",
            entite_id=session.id,
            utilisateur=request.user,
            donnees_entree={"answers": answers, "texte_libre": data.get("texte_libre", "")},
            resultats={
                "scores": scores,
                "sentiment": text_analysis,
                "recommandations": session.recommandations,
            },
            recommandations=session.resume,
        )
        log_action(request, "create", "questionnaire", {"session": session.id})

        return Response(SessionSerializer(session).data, status=status.HTTP_201_CREATED)


class LatestRecommendationView(APIView):
    permission_classes = [IsPatient]

    def get(self, request):
        session = QuestionnaireSession.objects.filter(patient=request.user).first()
        if not session:
            return Response({"detail": "Aucun questionnaire complété."}, status=404)
        return Response(SessionSerializer(session).data)


class QuestionnaireHistoryView(ListAPIView):
    permission_classes = [IsPatient]
    serializer_class = HistorySerializer

    def get_queryset(self):
        return QuestionnaireSession.objects.filter(patient=self.request.user)


class RecommendationDetailView(APIView):
    permission_classes = [IsPatient]

    def get(self, request, pk):
        session = get_object_or_404(QuestionnaireSession, pk=pk, patient=request.user)
        return Response(SessionSerializer(session).data)
