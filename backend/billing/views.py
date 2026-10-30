from django.db.models import Sum
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import PatientProfile, User
from core.permissions import IsAdmin, IsPatient
from core.utils import log_action

from .models import Abonnement, Pack, Transaction
from .serializers import AbonnementSerializer, PackSerializer, PurchaseSerializer, TransactionSerializer
from .services import PaymentError, purchase_pack


class PackListView(ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = PackSerializer
    pagination_class = None
    queryset = Pack.objects.filter(is_active=True)


class PurchasePackView(APIView):
    permission_classes = [IsPatient]

    def post(self, request):
        serializer = PurchaseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        pack = get_object_or_404(Pack, pk=serializer.validated_data["pack_id"], is_active=True)
        key = request.headers.get("Idempotency-Key") or f"pack-{request.user.id}-{pack.id}-{pack.nb_sessions}"
        try:
            transaction, created = purchase_pack(
                request.user, pack, serializer.validated_data["methode"], idempotency_key=key
            )
        except PaymentError as exc:
            raise ValidationError({"detail": str(exc)})

        if transaction.statut != Transaction.Statut.OK:
            return Response({
                "detail": "Le paiement a échoué. Aucun montant n'a été débité.",
                "transaction": TransactionSerializer(transaction).data,
            }, status=status.HTTP_402_PAYMENT_REQUIRED)

        profile = PatientProfile.objects.get(user=request.user)
        log_action(request, "payment", "transactions",
                   {"pack": pack.id, "montant": str(transaction.montant), "created": created})
        return Response({
            "detail": "Pack activé avec succès.",
            "transaction": TransactionSerializer(transaction).data,
            "abonnement": AbonnementSerializer(transaction.abonnement).data if transaction.abonnement else None,
            "solde": profile.solde,
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class WalletView(APIView):
    permission_classes = [IsPatient]

    def get(self, request):
        profile, _ = PatientProfile.objects.get_or_create(user=request.user)
        subscriptions = Abonnement.objects.filter(patient=request.user).select_related("pack")
        actifs = subscriptions.filter(statut=Abonnement.Statut.ACTIF)
        return Response({
            "solde": profile.solde,
            "abonnements": AbonnementSerializer(actifs, many=True).data,
            "historique": AbonnementSerializer(subscriptions[:10], many=True).data,
            "total_depense": float(
                Transaction.objects.filter(
                    patient=request.user, statut=Transaction.Statut.OK,
                    type__in=[Transaction.Type.PACK, Transaction.Type.SEANCE]
                ).aggregate(total=Sum("montant"))["total"] or 0
            ),
        })


class SubscriptionListView(ListAPIView):
    permission_classes = [IsPatient]
    serializer_class = AbonnementSerializer

    def get_queryset(self):
        return Abonnement.objects.filter(patient=self.request.user).select_related("pack")


class TransactionListView(ListAPIView):
    permission_classes = [IsPatient]
    serializer_class = TransactionSerializer

    def get_queryset(self):
        qs = Transaction.objects.filter(patient=self.request.user).select_related(
            "pack", "seance__therapeute"
        )
        params = self.request.query_params
        if params.get("type"):
            qs = qs.filter(type=params["type"])
        if params.get("statut"):
            qs = qs.filter(statut=params["statut"])
        if params.get("date_from"):
            qs = qs.filter(date_transaction__date__gte=params["date_from"])
        if params.get("date_to"):
            qs = qs.filter(date_transaction__date__lte=params["date_to"])
        if params.get("search"):
            qs = qs.filter(reference__icontains=params["search"])
        return qs


class TransactionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        transaction = get_object_or_404(
            Transaction.objects.select_related("pack", "seance__therapeute__user"), pk=pk
        )
        if transaction.patient_id != request.user.id and request.user.role != User.Role.ADMIN:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Cette transaction ne vous appartient pas.")
        data = TransactionSerializer(transaction).data
        data["facture"] = {
            "numero": transaction.facture_numero,
            "date": transaction.date_transaction,
            "client": transaction.patient.full_name,
            "email": transaction.patient.email,
            "libelle": transaction.pack.nom_pack if transaction.pack else "Séance de thérapie",
            "montant": float(transaction.montant),
            "tva": 0,
            "total": float(transaction.montant),
            "emetteur": "TheraNova — ESTIN Béjaïa",
        }
        return Response(data)


class AdminTransactionListView(ListAPIView):
    permission_classes = [IsAdmin]
    serializer_class = TransactionSerializer
    search_fields = ["reference", "patient__email", "patient__first_name", "patient__last_name"]

    def get_queryset(self):
        qs = Transaction.objects.select_related("patient", "pack", "seance__therapeute").all()
        params = self.request.query_params
        if params.get("type"):
            qs = qs.filter(type=params["type"])
        if params.get("statut"):
            qs = qs.filter(statut=params["statut"])
        if params.get("date_from"):
            qs = qs.filter(date_transaction__date__gte=params["date_from"])
        if params.get("date_to"):
            qs = qs.filter(date_transaction__date__lte=params["date_to"])
        return qs
