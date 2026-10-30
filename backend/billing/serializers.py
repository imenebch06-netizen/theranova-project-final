from rest_framework import serializers

from .models import Abonnement, Pack, Transaction


class PackSerializer(serializers.ModelSerializer):
    prix_unitaire = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = Pack
        fields = ["id", "nom_pack", "description", "prix", "nb_sessions", "prix_unitaire",
                  "duree_jours", "is_featured", "is_active", "ordre"]


class AbonnementSerializer(serializers.ModelSerializer):
    pack = PackSerializer(read_only=True)
    statut_display = serializers.CharField(source="get_statut_display", read_only=True)
    progression = serializers.SerializerMethodField()

    class Meta:
        model = Abonnement
        fields = ["id", "pack", "solde_restants", "statut", "statut_display", "date_debut",
                  "date_fin", "prix_paye", "progression", "date_creation"]

    def get_progression(self, obj):
        if not obj.pack.nb_sessions:
            return 0
        used = obj.pack.nb_sessions - obj.solde_restants
        return round(used / obj.pack.nb_sessions * 100)


class TransactionSerializer(serializers.ModelSerializer):
    pack_nom = serializers.CharField(source="pack.nom_pack", read_only=True)
    patient_nom = serializers.CharField(source="patient.full_name", read_only=True)
    patient_email = serializers.EmailField(source="patient.email", read_only=True)
    facture_numero = serializers.CharField(read_only=True)
    statut_display = serializers.CharField(source="get_statut_display", read_only=True)
    type_display = serializers.CharField(source="get_type_display", read_only=True)
    methode_display = serializers.CharField(source="get_methode_display", read_only=True)
    seance_date = serializers.DateTimeField(source="seance.date_debut", read_only=True)
    therapeute = serializers.CharField(source="seance.therapeute.nom_complet", read_only=True)

    class Meta:
        model = Transaction
        fields = ["id", "reference", "facture_numero", "patient_nom", "patient_email",
                  "montant", "type", "type_display", "statut", "statut_display", "methode",
                  "methode_display", "pack_nom", "abonnement", "seance", "seance_date",
                  "therapeute", "metadata", "date_transaction"]


class PurchaseSerializer(serializers.Serializer):
    pack_id = serializers.IntegerField()
    methode = serializers.ChoiceField(
        choices=["carte", "baridimob", "cib", "credit", "simule"], default="simule"
    )
