from django.urls import path

from .views import (
    AdminTransactionListView,
    PackListView,
    PurchasePackView,
    SubscriptionListView,
    TransactionDetailView,
    TransactionListView,
    WalletView,
)

urlpatterns = [
    path("packs/", PackListView.as_view(), name="packs"),
    path("purchase/", PurchasePackView.as_view(), name="purchase"),
    path("wallet/", WalletView.as_view(), name="wallet"),
    path("subscriptions/", SubscriptionListView.as_view(), name="subscriptions"),
    path("transactions/", TransactionListView.as_view(), name="transactions"),
    path("transactions/<int:pk>/", TransactionDetailView.as_view(), name="transaction-detail"),
    path("admin/transactions/", AdminTransactionListView.as_view(), name="admin-transactions"),
]
