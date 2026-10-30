# TheraNova

**Plateforme de thérapie en ligne et de suivi psychologique — React + Django REST Framework.**
Interface bilingue français / anglais, trois espaces métier (patient, thérapeute, administrateur) et données de démonstration prêtes à l'emploi.

> Projet académique. Les paiements, la visioconférence et le moteur de recommandation sont simulés localement et documentés comme remplaçables par des services réels.

---

## Sommaire

- [Aperçu fonctionnel](#aperçu-fonctionnel)
- [Stack technique](#stack-technique)
- [Architecture du dépôt](#architecture-du-dépôt)
- [Démarrage rapide](#démarrage-rapide)
- [Comptes de démonstration](#comptes-de-démonstration)
- [Variables d'environnement](#variables-denvironnement)
- [Passer sur MySQL](#passer-sur-mysql)
- [Parcours et routes de l'interface](#parcours-et-routes-de-linterface)
- [Carte de l'API](#carte-de-lapi)
- [Recommandation par questionnaire](#recommandation-par-questionnaire)
- [Paiements et téléconsultation](#paiements-et-téléconsultation)
- [Charte graphique et bilingue](#charte-graphique-et-bilingue)
- [Tests et vérifications](#tests-et-vérifications)
- [Limites et passage en production](#limites-et-passage-en-production)
- [Dépannage](#dépannage)
- [Liens](#liens)

---

## Aperçu fonctionnel

### Espace public

- Page d'accueil, présentation de la démarche, contact.
- Annuaire des thérapeutes avec recherche, filtres par spécialité, langue, modalité et tarif.
- Fiche thérapeute détaillée : présentation, spécialités, langues, tarifs, avis.
- Offres et packs de séances.
- Inscription patient et candidature thérapeute.
- Bascule FR / EN persistante et connexion JWT ou Google (démo).

### Espace patient (`/app`)

- Tableau de bord avec prochaine séance, humeur, recommandations et activité.
- Questionnaire d'orientation en 12 questions et recommandation personnalisée de thérapeutes.
- Réservation par créneau, type de séance (individuel, couple, famille), participants invités et message.
- Suivi des demandes, confirmation / refus, paiement par participant, annulation.
- Séances à venir et passées, accès à la téléconsultation dans la fenêtre autorisée.
- Journal d'humeur quotidien, statistiques et messages de soutien générés localement.
- Portefeuille, achats de packs, abonnements et historique des transactions.
- Messagerie avec les thérapeutes et notifications.
- Avis, réclamations et signalements.
- Gestion du profil, du mot de passe et des préférences.

### Espace thérapeute (`/pro`)

- Tableau de bord d'activité et indicateurs.
- Agenda : disponibilités, création de créneaux simples ou en lot, blocage / suppression.
- Demandes de rendez-vous entrantes : accepter, refuser, consulter les participants.
- Liste des patients suivis et dossier patient consolidé.
- Dossiers cliniques, notes de séance, plans de suivi et rapports.
- Séances, lien de visioconférence et clôture de séance.
- Messagerie, avis reçus et paramètres du profil professionnel.

### Espace administrateur (`/admin`)

- Tableau de bord global avec période (`jour`, `semaine`, `mois`, `année`, `tout`) et objectif de revenus.
- Gestion des utilisateurs : recherche, filtrage, activation / désactivation.
- Modération et validation des thérapeutes.
- Supervision des séances et des transactions, factures consultables.
- Réclamations et signalements avec réponse.
- Diffusion de notifications à tous les utilisateurs.
- Paramètres de la plateforme.

### Transverse

- Authentification JWT avec rotation du refresh token et rafraîchissement automatique côté client.
- Contrôle d'accès par rôle côté API et côté routes React.
- Pagination, filtres, recherche et tri DRF.
- Journal d'audit, notifications, messagerie.
- Interface entièrement bilingue FR / EN.

---

## Stack technique

| Couche | Technologies |
| --- | --- |
| Frontend | React 18, Vite 5, React Router 6, Tailwind CSS 3, Axios, Recharts, Lucide, date-fns |
| Backend | Python, Django 5.2, Django REST Framework, SimpleJWT, django-filter, CORS |
| Base de données | SQLite par défaut, MySQL configurable par variable d'environnement |
| Authentification | JWT (email + mot de passe), Google OAuth2 / OpenID Connect avec mode démo |
| Paiement | Simulé (BaridiMob, Edahabia, CIB) |
| Visioconférence | Lien Google Meet de démonstration, activable côté configuration |
| IA | Moteur local à règles pondérées, isolé dans un service remplaçable |

---

## Architecture du dépôt

```text
theranova-project/
├── backend/
│   ├── config/              # settings, urls, wsgi/asgi
│   ├── core/                # modèles de base, pagination, exceptions, audit, paramètres
│   ├── accounts/            # utilisateurs, profils, spécialités, auth, modération
│   ├── matching/            # questionnaire, scoring, recommandations
│   ├── scheduling/          # créneaux, demandes, participants, séances, visio
│   ├── clinical/            # dossiers, notes, rapports, vue patient
│   ├── billing/             # packs, abonnements, portefeuille, transactions
│   ├── wellbeing/           # humeur, statistiques, insights
│   ├── feedback/            # avis, réclamations, signalements
│   ├── messaging/           # conversations, messages, notifications
│   ├── dashboard/           # agrégats patient / thérapeute / admin
│   ├── smoke_test.py        # vérification des endpoints par rôle
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/      # UI, layouts, composants réutilisables
│   │   ├── contexts/        # Auth, I18n, Toast
│   │   ├── lib/             # client Axios, helpers
│   │   ├── pages/           # pages publiques, patient, thérapeute, admin
│   │   ├── App.jsx          # routes et guards
│   │   └── index.css        # Tailwind et classes de design
│   ├── README.md            # consignes de design / Figma fournies par l'équipe
│   └── vite.config.js       # proxy local /api -> 127.0.0.1:8000
├── design/                  # ressources de design
└── README.md
```

---

## Démarrage rapide

### Prérequis

- Python **3.11+**
- Node.js **18+** et npm
- Git

### 1. Backend

```powershell
cd backend

python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

Copy-Item .env.example .env
python manage.py migrate
python manage.py seed_demo --force
python manage.py runserver 127.0.0.1:8000
```

Sous macOS / Linux, remplacer l'activation et la copie par :

```bash
python3 -m venv .venv
source .venv/bin/activate
cp .env.example .env
```

- API : <http://127.0.0.1:8000/api/v1/>
- Administration Django : <http://127.0.0.1:8000/admin/>

### 2. Frontend

Dans un second terminal :

```powershell
cd frontend
npm install
npm run dev
```

- Application : <http://127.0.0.1:5173>
- Vite proxifie `/api` vers `http://127.0.0.1:8000`.

> Le frontend doit être lancé après le backend. Si le port 8000 est occupé, adapter le proxy dans `frontend/vite.config.js`.

### 3. Vérification en une commande

```powershell
cd backend
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe smoke_test.py
```

### Réinitialiser les données de démonstration

```powershell
cd backend
.\.venv\Scripts\python.exe manage.py seed_demo --force
```

`--force` vide les données applicatives et recrée un jeu cohérent. Le mot de passe des comptes de démonstration est réinitialisé.

---

## Comptes de démonstration

| Rôle | Email | Mot de passe | Accès |
| --- | --- | --- | --- |
| Administrateur | `admin@theranova.dz` | `Admin123!` | `/admin` |
| Patient | `patient@theranova.dz` | `Patient123!` | `/app` |
| Thérapeute | `therapist@theranova.dz` | `Therapist123!` | `/pro` |
| Patient secondaire | `karim@theranova.dz` | `Patient123!` | `/app` |

Le bouton **Continuer avec Google** utilise un compte Google simulé (`demo.google@theranova.dz`) en mode `DEBUG` et sans `GOOGLE_CLIENT_ID`. En production, renseigner les identifiants OAuth et transmettre un vrai jeton Google.

Le jeu de démonstration comprend notamment 6 thérapeutes, 4 patients, 12 questions bilingues, plusieurs centaines de créneaux, 13 séances, 15 transactions et 30 entrées d'humeur. Une séance à venir est créée quelques minutes après le seed pour tester la téléconsultation.

---

## Variables d'environnement

Copier `backend/.env.example` vers `backend/.env`.

| Variable | Défaut | Description |
| --- | --- | --- |
| `DJANGO_SECRET_KEY` | clé de développement | **À remplacer** en production |
| `DJANGO_DEBUG` | `True` | Désactiver en production |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1` | Hôtes autorisés, séparés par des virgules |
| `DB_ENGINE` | `sqlite` | `sqlite` ou `mysql` |
| `DB_NAME` | `theranova` | Base MySQL |
| `DB_USER` | `root` | Utilisateur MySQL |
| `DB_PASSWORD` | vide | Mot de passe MySQL |
| `DB_HOST` | `127.0.0.1` | Hôte MySQL |
| `DB_PORT` | `3306` | Port MySQL |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Origines frontend autorisées |
| `GOOGLE_CLIENT_ID` | vide | Active la vérification réelle des jetons Google |
| `GOOGLE_CLIENT_SECRET` | vide | Secret OAuth côté serveur |
| `GOOGLE_MEET_ENABLED` | `False` | Active la génération de liens Meet |
| `PAYMENT_PROVIDER` | `simulated` | Fournisseur de paiement |
| `EMAIL_BACKEND` | backend console/mémoire | Backend d'e-mail Django |
| `SECURE_SSL_REDIRECT` | `True` hors DEBUG | Redirection HTTPS en production |

Le frontend n'utilise pas de fichier `.env` : il appelle l'API via le proxy Vite en développement.

---

## Passer sur MySQL

1. Créer la base :

```sql
CREATE DATABASE theranova
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

2. Installer le pilote :

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pip install mysqlclient
```

3. Renseigner `backend/.env` :

```dotenv
DB_ENGINE=mysql
DB_NAME=theranova
DB_USER=root
DB_PASSWORD=votre_mot_de_passe
DB_HOST=127.0.0.1
DB_PORT=3306
```

4. Appliquer les migrations et recharger les données :

```powershell
python manage.py migrate
python manage.py seed_demo --force
```

Aucun changement de code n'est nécessaire : le choix du moteur est centralisé dans `backend/config/settings.py`.

---

## Parcours et routes de l'interface

### Public

| Route | Page |
| --- | --- |
| `/` | Accueil |
| `/therapeutes` | Annuaire |
| `/therapeutes/:id` | Fiche thérapeute |
| `/packs` | Offres et packs |
| `/a-propos` | Présentation |
| `/contact` | Contact |
| `/connexion` | Connexion |
| `/inscription` | Inscription patient |
| `/inscription/therapeute` | Candidature thérapeute |

### Patient

| Route | Page |
| --- | --- |
| `/app` | Tableau de bord |
| `/app/questionnaire` | Questionnaire et recommandation |
| `/app/reserver` | Réservation |
| `/app/seances` | Séances |
| `/app/humeur` | Journal d'humeur |
| `/app/paiements` | Portefeuille et transactions |
| `/app/messages` | Messagerie |
| `/app/retours` | Avis et réclamations |
| `/app/parametres` | Profil et préférences |

### Thérapeute

| Route | Page |
| --- | --- |
| `/pro` | Tableau de bord |
| `/pro/agenda` | Agenda et disponibilités |
| `/pro/demandes` | Demandes de rendez-vous |
| `/pro/patients` | Patients suivis |
| `/pro/patients/:id` | Dossier patient |
| `/pro/seances` | Séances |
| `/pro/messages` | Messagerie |
| `/pro/avis` | Avis reçus |
| `/pro/parametres` | Profil professionnel |

### Administrateur

| Route | Page |
| --- | --- |
| `/admin` | Tableau de bord |
| `/admin/utilisateurs` | Utilisateurs |
| `/admin/therapeutes` | Modération des thérapeutes |
| `/admin/seances` | Séances |
| `/admin/paiements` | Transactions |
| `/admin/reclamations` | Réclamations et signalements |
| `/admin/parametres` | Paramètres |

Les routes privées sont protégées par `ProtectedRoute` et redirigent vers `/connexion`. Un utilisateur connecté qui ouvre `/espace` est envoyé vers l'accueil de son rôle.

---

## Carte de l'API

Base : `http://127.0.0.1:8000/api/v1/`

| Module | Préfixe | Principaux endpoints |
| --- | --- | --- |
| Authentification | `/auth/` | `login/`, `refresh/`, `logout/`, `register/patient/`, `register/therapist/`, `google/`, `me/`, `password/` |
| Comptes | `/accounts/` | `specialties/`, `therapists/`, `therapists/:id/`, `therapist/me/`, `therapist/patients/`, `admin/users/`, `admin/therapists/` |
| Matching | `/matching/` | `questionnaire/`, `questionnaire/submit/`, `recommendations/latest/`, `recommendations/:id/`, `history/` |
| Planning | `/scheduling/` | `slots/`, `availability/:therapist_id/`, `requests/`, `requests/:id/pay/`, `sessions/`, `sessions/:id/join/`, `sessions/:id/complete/` |
| Clinique | `/clinical/` | `dossiers/`, `dossiers/:id/notes/`, `notes/:id/`, `patients/:id/`, `sessions/:id/report/` |
| Facturation | `/billing/` | `packs/`, `purchase/`, `wallet/`, `subscriptions/`, `transactions/`, `admin/transactions/` |
| Bien-être | `/wellbeing/` | `mood/`, `mood/today/`, `mood/save/`, `mood/stats/`, `mood/patient/:id/`, `insights/` |
| Feedback | `/feedback/` | `reviews/`, `reviews/me/`, `reviews/create/`, `complaints/`, `reports/` |
| Messagerie | `/messaging/` | `conversations/`, `conversations/:id/messages/`, `notifications/`, `unread/`, `broadcast/` |
| Tableaux de bord | `/dashboard/` | `patient/`, `therapist/`, `admin/` |

Toutes les routes, hors inscription, connexion et annuaire public, exigent `Authorization: Bearer <access_token>`. Les permissions fines sont appliquées par rôle et par objet dans les vues.

Le format de pagination DRF est `{ count, next, previous, results }`. Le client `frontend/src/lib/api.js` expose `getAll()` pour parcourir toutes les pages et `unwrap()` pour normaliser les réponses.

---

## Recommandation par questionnaire

Le parcours de matching est entièrement fonctionnel et local :

1. Le patient répond à 12 questions réparties en catégories (état émotionnel, relations, événements de vie, etc.).
2. Chaque option porte un score et des poids par spécialité.
3. Les scores sont normalisés, puis comparés aux spécialités des thérapeutes disponibles.
4. Les trois meilleurs profils sont proposés avec un résumé et des raisons, en français **et** en anglais.
5. L'historique des passations et la dernière recommandation sont conservés.

Le moteur se trouve dans `backend/matching/services.py` (`compute_specialty_scores`, `recommend_therapists`, `build_summary`). Il est volontairement isolé pour être remplacé par un service d'IA externe sans modifier les modèles ni l'interface.

> Les recommandations sont indicative et ne constituent pas un diagnostic médical.

---

## Paiements et téléconsultation

### Paiement simulé

- Méthodes proposées : **BaridiMob**, **Edahabia**, **CIB**.
- Le paiement est enregistré comme transaction et met à jour le portefeuille / l'abonnement.
- Une réservation de couple ou de famille peut être réglée **par participant** ; chaque participant confirme ou refuse sa part.
- Aucun numéro de carte n'est traité et aucun prestataire réel n'est contacté.

Le point d'intégration est `PAYMENT_PROVIDER` dans `backend/config/settings.py` et les vues de `backend/billing/`.

### Téléconsultation

- Un lien de visioconférence de démonstration est associé aux séances.
- Le bouton de connexion est actif de **15 minutes avant** à **30 minutes après** le début de la séance.
- En production, remplacer la génération de lien par l'API Google Meet / Calendar et stocker les identifiants côté serveur.

---

## Charte graphique et bilingue

| Couleur | Hex | Usage |
| --- | --- | --- |
| Sauge | `#CCD5B5` | Accents doux, fonds secondaires |
| Bleu canard | `#1A5255` | Couleur primaire, actions, navigation |
| Crème | `#FFFBF0` | Fond principal |
| Encre | `#102F31` | Texte |
| Terracotta | `#C97B5A` | Alertes douces, accents chauds |

Typographie : **Lato**. Les tokens Tailwind sont définis dans `frontend/tailwind.config.js` (`cream`, `sage`, `teal`, `ink`, `line`, etc.).

Le bilingue repose sur `useI18n()` et l'appel `t("texte français", "English text")`. La langue est mémorisée dans `localStorage` sous `theranova.lang` et appliquée à l'ensemble des pages, y compris les contenus générés par le questionnaire.

---

## Tests et vérifications

```powershell
# Backend
cd backend
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run
.\.venv\Scripts\python.exe smoke_test.py

# Frontend
cd ..\frontend
npm run build
```

`smoke_test.py` se connecte successivement avec les comptes patient, thérapeute et administrateur, puis vérifie les endpoints clés. Il crée et annule une réservation de test ; relancer `seed_demo --force` si l'on souhaite retrouver un état de démonstration exact.

Le build Vite peut afficher un avertissement de taille de bundle supérieur à 500 kB. Il n'empêche pas le fonctionnement ; une découpe par route (`React.lazy`) peut être ajoutée ultérieurement.

---

## Limites et passage en production

Ce dépôt est une démonstration complète, pas une plateforme médicale certifiée. Avant toute mise en production :

- définir un `DJANGO_SECRET_KEY` fort, `DJANGO_DEBUG=False`, HTTPS et des cookies sécurisés ;
- remplacer SQLite par MySQL et sauvegarder les données ;
- configurer un vrai fournisseur OAuth Google et vérifier les jetons côté serveur ;
- intégrer les prestataires de paiement réels et ne jamais stocker de données de carte ;
- remplacer le moteur de recommandation local et les messages d'humeur par des services validés cliniquement ;
- brancher Google Meet / Calendar avec gestion des consentements ;
- revoir les politiques de conservation, de chiffrement et d'accès aux dossiers cliniques ;
- ajouter supervision, sauvegardes, tests automatisés d'intégration et journalisation centralisée.

Les données de démonstration ne contiennent aucune information réelle.

---

## Dépannage

| Problème | Solution |
| --- | --- |
| `Activate.ps1` bloqué par PowerShell | `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` |
| Le frontend reçoit `ECONNREFUSED` | Démarrer Django sur `127.0.0.1:8000` |
| Erreur CORS | Vérifier `CORS_ALLOWED_ORIGINS` et l'URL exacte du frontend |
| Les comptes de démo n'existent plus | `python manage.py seed_demo --force` |
| Le bouton Google échoue | En DEBUG : vérifier que le backend tourne ; sinon renseigner `GOOGLE_CLIENT_ID` |
| Les données MySQL ne sont pas utilisées | Vérifier `DB_ENGINE=mysql` et redémarrer Django |
| Migration manquante | `python manage.py migrate` |
| Port 5173 occupé | Vite choisit un autre port ; adapter alors `CORS_ALLOWED_ORIGINS` |

---

## Liens

- **Dépôt GitHub** : <https://github.com/minari9797/theranova-project>
- **Maquette Figma** : <https://www.figma.com/design/bANRANbYQJ8o9Q0NuyQ4tV/theranova-design>
- **Consignes frontend d'origine** : [`frontend/README.md`](frontend/README.md)

---

Réalisé dans le cadre du projet **TheraNova** — soin, orientation et suivi psychologique accessibles.
