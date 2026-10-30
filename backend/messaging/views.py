from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import TherapistProfile, User
from core.permissions import IsAdmin
from core.utils import log_action
from scheduling.models import Seance

from .models import Conversation, Message, Notification
from .serializers import (
    ConversationSerializer,
    MessageSerializer,
    NotificationSerializer,
    SendMessageSerializer,
)


def conversation_for_user(pk, user):
    conversation = get_object_or_404(
        Conversation.objects.select_related("patient", "therapeute"), pk=pk
    )
    if user.role == User.Role.ADMIN:
        return conversation
    if conversation.patient_id != user.id and conversation.therapeute_id != user.id:
        raise PermissionDenied("Cette conversation ne vous concerne pas.")
    return conversation


class ConversationListCreateView(ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ConversationSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Conversation.objects.select_related("patient", "therapeute").prefetch_related("messages")
        if user.role == User.Role.PATIENT:
            qs = qs.filter(patient=user)
        elif user.role == User.Role.THERAPIST:
            qs = qs.filter(therapeute=user)
        return qs

    def post(self, request):
        user = request.user
        if user.role == User.Role.PATIENT:
            profile = get_object_or_404(
                TherapistProfile, pk=request.data.get("therapeute_id"),
                statut=TherapistProfile.Statut.ACTIVE,
            )
            therapist_user = profile.user
            patient_user = user
            if not Seance.objects.filter(patient=user, therapeute=profile).exists():
                raise ValidationError({
                    "detail": "La messagerie s'ouvre après votre première réservation avec ce praticien."
                })
        elif user.role == User.Role.THERAPIST:
            patient_id = request.data.get("patient_id")
            patient_user = get_object_or_404(User, pk=patient_id, role=User.Role.PATIENT)
            therapist_user = user
            if not Seance.objects.filter(patient=patient_user, therapeute=user.therapist_profile).exists():
                raise ValidationError({"detail": "Ce patient ne fait pas partie de votre suivi."})
        else:
            raise PermissionDenied("Les administrateurs ne démarrent pas de conversation clinique.")

        conversation, created = Conversation.objects.get_or_create(
            patient=patient_user, therapeute=therapist_user
        )
        return Response(
            ConversationSerializer(conversation, context={"request": request}).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class MessageListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        conversation = conversation_for_user(pk, request.user)
        messages = conversation.messages.select_related("sender").all()
        conversation.messages.filter(lu=False).exclude(sender=request.user).update(
            lu=True, date_lecture=timezone.now()
        )
        data = MessageSerializer(messages, many=True, context={"request": request}).data
        return Response({
            "conversation": ConversationSerializer(conversation, context={"request": request}).data,
            "messages": data,
        })

    def post(self, request, pk):
        conversation = conversation_for_user(pk, request.user)
        serializer = SendMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = Message.objects.create(
            conversation=conversation,
            sender=request.user,
            contenu=serializer.validated_data["contenu"],
            piece_jointe=serializer.validated_data.get("piece_jointe", ""),
        )
        conversation.save(update_fields=["derniere_activite"])
        recipient = (
            conversation.therapeute
            if conversation.patient_id == request.user.id
            else conversation.patient
        )
        Notification.objects.create(
            user=recipient,
            titre="Nouveau message",
            message=f"{request.user.full_name} : {message.contenu[:100]}",
            type=Notification.Type.MESSAGE,
        )
        log_action(request, "create", "messages", {"conversation": conversation.id})
        return Response(
            MessageSerializer(message, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class UnreadCountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        messages = Message.objects.filter(
            conversation__in=Conversation.objects.filter(
                Q(patient=request.user) | Q(therapeute=request.user)
            ),
            lu=False,
        ).exclude(sender=request.user).count()
        notifications = Notification.objects.filter(user=request.user, statut=Notification.Statut.ENVOYEE).count()
        return Response({"messages": messages, "notifications": notifications, "total": messages + notifications})


class NotificationListView(ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer

    def get_queryset(self):
        qs = Notification.objects.filter(user=self.request.user)
        statut = self.request.query_params.get("statut")
        if statut == "non_lues":
            qs = qs.filter(statut=Notification.Statut.ENVOYEE)
        elif statut:
            qs = qs.filter(statut=statut)
        if self.request.query_params.get("type"):
            qs = qs.filter(type=self.request.query_params["type"])
        return qs


class NotificationReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk=None):
        if pk:
            notification = get_object_or_404(Notification, pk=pk, user=request.user)
            notification.statut = Notification.Statut.LUE
            notification.date_lecture = timezone.now()
            notification.save(update_fields=["statut", "date_lecture"])
            return Response(NotificationSerializer(notification).data)
        updated = Notification.objects.filter(
            user=request.user, statut=Notification.Statut.ENVOYEE
        ).update(statut=Notification.Statut.LUE, date_lecture=timezone.now())
        return Response({"updated": updated})

    def delete(self, request, pk):
        notification = get_object_or_404(Notification, pk=pk, user=request.user)
        notification.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminBroadcastView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        titre = request.data.get("titre", "").strip()
        message = request.data.get("message", "").strip()
        role = request.data.get("role", "")
        if not titre or not message:
            raise ValidationError({"detail": "Le titre et le message sont requis."})
        users = User.objects.filter(is_active=True)
        if role:
            users = users.filter(role=role)
        notifications = [
            Notification(user=user, titre=titre, message=message, type=Notification.Type.MESSAGE)
            for user in users
        ]
        Notification.objects.bulk_create(notifications)
        log_action(request, "moderation", "notifications", {"count": len(notifications)})
        return Response({"sent": len(notifications)})
