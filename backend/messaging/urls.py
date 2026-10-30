from django.urls import path

from .views import (
    AdminBroadcastView,
    ConversationListCreateView,
    MessageListView,
    NotificationListView,
    NotificationReadView,
    UnreadCountView,
)

urlpatterns = [
    path("conversations/", ConversationListCreateView.as_view(), name="conversations"),
    path("conversations/<int:pk>/messages/", MessageListView.as_view(), name="conversation-messages"),
    path("unread/", UnreadCountView.as_view(), name="unread"),
    path("notifications/", NotificationListView.as_view(), name="notifications"),
    path("notifications/read-all/", NotificationReadView.as_view(), name="notifications-read-all"),
    path("notifications/<int:pk>/read/", NotificationReadView.as_view(), name="notification-read"),
    path("notifications/<int:pk>/", NotificationReadView.as_view(), name="notification-delete"),
    path("broadcast/", AdminBroadcastView.as_view(), name="broadcast"),
]
