<p align="center">
  <img src="https://img.shields.io/badge/Souk.AI-v2.0-7c3aed?style=for-the-badge" alt="Souk.AI"/>
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/React_18-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React"/>
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL"/>
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker"/>
  <img src="https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white" alt="OpenAI"/>
</p>

<h1 align="center">Souk.AI</h1>
<h3 align="center">Plateforme SaaS de Digitalisation du Commerce Traditionnel Marocain</h3>

<p align="center">
  <strong>POS intelligent + Carte NFC + IA en Darija + Marketplace B2B</strong>
  <br/>
  <a href="https://soukai.duckdns.org">Demo Live</a>
</p>

---

## Le Probleme

Plus de **3,2 millions de TPE marocaines** gerent leur commerce sur papier :
- **15-20%** du chiffre d'affaires perdu en erreurs de stock et creances non suivies
- Aucun outil de prevision ou d'analyse
- Exclusion financiere des clients non bancarises
- Zero visibilite sur les tendances du marche

## La Solution

**Souk.AI** est une plateforme tout-en-un qui digitalise le commerce traditionnel avec de l'IA, accessible depuis un smartphone ou un navigateur web.

---

## Fonctionnalites

### 1. Point de Vente (POS) Intelligent
- Caisse enregistreuse tactile avec recherche rapide
- Scan de **code-barres** via camera (BarcodeDetector API)
- Vente en **especes, carte Souk.AI (NFC), ou credit client**
- Calcul automatique de la monnaie a rendre
- Historique complet des ventes avec filtre par date/produit
- Retours et remboursements avec protection anti-doublon
- Impression/export de recus

### 2. Gestion des Produits
- Catalogue bilingue **arabe / francais**
- Import automatique par **scan de facture fournisseur** (GPT-4o Vision)
- Detection et fusion de **doublons** (meme produit en arabe et francais)
- Suivi des **dates d'expiration** avec alertes visuelles :
  - Colonne expiration dans le tableau avec code couleur
  - Edition inline (clic direct sur la date)
  - Alertes WhatsApp automatiques (3 jours et 7 jours avant)
- Prix d'achat et prix de vente pour calcul de marge
- Groupes/categories automatiques

### 3. Gestion de Stock & Inventaire
- Stock en temps reel avec seuils d'alerte personnalisables
- **Alertes stock bas** sur le dashboard et par WhatsApp
- Ajustement manuel avec historique d'audit complet
- Mise a jour automatique apres chaque vente/retour
- Vue filtree : tous les produits ou stock bas uniquement

### 4. Previsions IA (Forecasting)
- Prevision de demande sur **7 jours** par produit
- Algorithme statistique : moyenne mobile + saisonnalite jour de semaine + tendance lineaire
- Intervalle de confiance (min/max a +/-25%)
- Recommandation de **reapprovisionnement** automatique
- Graphiques interactifs (Recharts)

### 5. Analytique & Tableaux de Bord
- **Dashboard marchand** : CA du jour, ventes, stock bas, produits expirants, score de credit
- Graphique des ventes sur 7/14/30 jours
- Top produits et tendances
- Revenu mensuel et profit net
- **Dashboard admin** : nombre de marchands, transactions globales, activite quotidienne

### 6. Analyse de Profit
- Calcul automatique de la **marge brute** par produit
- Ventilation des charges (loyer, employes, fournisseurs)
- Profit net par periode
- Identification des produits les plus/moins rentables

### 7. Gestion des Clients & Credit
- Base de donnees clients avec historique d'achats
- **Carnet de credit** : suivi des dettes clients
- Ajout/remboursement de credit par client
- Score de credit automatique base sur l'historique
- Alertes de creances impayees

### 8. Carte Souk.AI (NFC)
- Carte prepayee **NFC** pour les clients non bancarises
- Rechargement par le marchand
- Paiement sans contact en boutique
- Historique des transactions par carte
- Gestion admin : emission, activation, blocage

### 9. Gestion des Fournisseurs
- Fiche fournisseur avec coordonnees et catalogue
- **Commandes fournisseur** avec suivi de statut
- Paiement fournisseur (especes ou carte Souk.AI)
- Historique des livraisons et paiements
- Catalogue fournisseur consultable (lecture seule)

### 10. Portail Fournisseur (Double Profil)
- Compte **SUPPLIER** separe avec son propre dashboard
- Tableau de bord : commandes en attente, en livraison, CA recu
- Gestion des commandes recues avec changement de statut
- Catalogue produits editable (prix, disponibilite)
- Chat en temps reel avec les marchands (IA-assiste)
- Suivi des paiements recus

### 11. Marketplace B2B
- Place de marche entre marchands
- Publication d'annonces (produits en gros)
- Recherche par categorie, ville, prix
- Systeme de commande avec suivi
- Gestion acheteur/vendeur avec statuts (accepte, expedie, livre, annule)

### 12. Coach IA
- Assistant virtuel intelligent
- Conseils personnalises bases sur les donnees du commerce
- Analyse des performances et recommandations
- Interface chat conversationnelle

### 13. Intelligence de Marche
- Benchmark des prix par categorie et region
- Tendances du marche local
- Analyse concurrentielle
- Donnees agregees anonymisees de la plateforme

### 14. Bot WhatsApp IA
- Interface conversationnelle en **Darija, francais et anglais**
- Commandes naturelles : `"sardines 10 DH"` pour mettre a jour un prix
- Rapport quotidien automatique :
  - Resume des ventes du jour
  - Alertes stock bas
  - Produits proches de l'expiration
  - Previsions de demande
- Reset de mot de passe par OTP WhatsApp

### 15. Gestion des Employes
- Fiches employes avec contrats
- Suivi des salaires et paiements
- Historique des contrats

### 16. Import Sage
- Import de donnees depuis **Sage** (logiciel comptable)
- Mapping automatique des produits et transactions
- Reconciliation des stocks

### 17. Facturation
- Generation de factures PDF (ReportLab)
- Paiement de factures en ligne
- Suivi des factures payees/impayees

### 18. Export de Donnees
- Export des ventes, produits, clients en **CSV/Excel**
- Rapports personnalisables par periode

### 19. Notifications
- Centre de notifications in-app
- Alertes en temps reel (SSE)
- Notifications push WhatsApp programmees
- Types : stock bas, expiration, paiement recu, commande

### 20. Catalogue Public
- Page publique du catalogue marchand
- URL partageable : `/catalogue/:merchantId`
- Vitrine en ligne sans compte requis

### 21. Systeme de Paiement
- Paiements **especes** (auto-complete)
- Paiements **carte Souk.AI** (NFC, validation requise)
- Historique et reconciliation
- Configuration par marchand

### 22. Multi-langue
- Interface en **francais** et **arabe**
- Detection automatique de la langue du navigateur
- i18next integration

---

## Architecture Technique

```
                    +-------------------+
                    |   Nginx (443/80)  |
                    +--------+----------+
                             |
              +--------------+--------------+
              |                             |
    +---------v---------+     +-------------v-----------+
    |   Frontend (React)|     |   Backend (FastAPI)     |
    |   Vite + Tailwind |     |   Uvicorn + async       |
    +-------------------+     +---+-------+-------+-----+
                                  |       |       |
                    +-------------+  +----+----+  +--------+
                    |                |         |           |
              +-----v-----+  +------v---+  +--v------+  +-v--------+
              | PostgreSQL |  |  Redis   |  | Celery  |  | Weaviate |
              | TimescaleDB|  |  Cache   |  | Workers |  | VectorDB |
              +------------+  +----------+  +---------+  +----------+
                                                |
                                          +-----v------+
                                          | Celery Beat|
                                          | (Scheduler)|
                                          +------------+
```

### Stack Technique

| Couche | Technologie | Role |
|--------|------------|------|
| **Frontend** | React 18, Vite, Tailwind CSS | Interface utilisateur SPA |
| **Backend** | FastAPI, SQLAlchemy 2.0, asyncpg | API REST asynchrone |
| **Base de donnees** | PostgreSQL 16 + TimescaleDB | Stockage relationnel + time-series |
| **Cache** | Redis | Sessions, cache, broker Celery |
| **Taches async** | Celery + Celery Beat | Rapports quotidiens, alertes, forecasts |
| **IA** | OpenAI GPT-4o | Scan factures, coach IA, WhatsApp bot |
| **Recherche** | Weaviate | Recherche semantique vectorielle |
| **Messagerie** | WhatsApp Cloud API | Bot conversationnel, alertes, OTP |
| **Auth** | JWT (python-jose) + bcrypt | Authentification stateless |
| **PDF** | ReportLab | Generation de factures |
| **Reverse Proxy** | Nginx + Cloudflare Tunnel | SSL, routing, securite |
| **Conteneurisation** | Docker Compose (9 services) | Deploiement unifie |

---

## Structure du Projet

```
souk-ai/
├── backend/
│   ├── api/v1/              # 28 modules de routes API
│   │   ├── auth.py          # Inscription, login, reset password
│   │   ├── products.py      # CRUD produits + scan facture IA
│   │   ├── transactions.py  # Ventes et retours
│   │   ├── inventory.py     # Gestion de stock
│   │   ├── analytics.py     # Tableaux de bord et stats
│   │   ├── forecasts.py     # Previsions IA
│   │   ├── marketplace.py   # Place de marche B2B
│   │   ├── suppliers.py     # Gestion fournisseurs
│   │   ├── supplier_portal.py # Portail fournisseur
│   │   ├── customers.py     # Clients et credit
│   │   ├── payments.py      # Paiements
│   │   ├── souk_cards.py    # Cartes NFC
│   │   ├── admin.py         # Panel administration
│   │   ├── coach.py         # Coach IA
│   │   ├── market.py        # Intelligence de marche
│   │   ├── whatsapp.py      # Webhook WhatsApp
│   │   └── router.py        # Routeur principal
│   ├── models/              # 22 modeles SQLAlchemy ORM
│   ├── schemas/             # Schemas Pydantic (validation)
│   ├── services/            # 17 modules de logique metier
│   │   ├── ai_engine.py     # Moteur IA central
│   │   ├── forecasting.py   # Algorithme de prevision
│   │   ├── credit_scoring.py # Score de credit
│   │   ├── payment_service.py # Service de paiement
│   │   ├── market_intelligence.py # Intelligence de marche
│   │   ├── whatsapp.py      # Service WhatsApp
│   │   └── ...
│   ├── workers/             # Taches Celery
│   │   ├── tasks.py         # Rapports quotidiens, alertes
│   │   └── celery_app.py    # Configuration Celery
│   ├── core/                # Config, DB, securite, deps
│   ├── alembic/             # Migrations de base de donnees
│   └── app/main.py          # Point d'entree FastAPI
│
├── frontend/
│   ├── src/
│   │   ├── pages/           # 39 pages React
│   │   │   ├── Dashboard.jsx    # Tableau de bord marchand
│   │   │   ├── POS.jsx          # Point de vente
│   │   │   ├── Products.jsx     # Gestion produits
│   │   │   ├── Inventory.jsx    # Inventaire
│   │   │   ├── Sales.jsx        # Ventes
│   │   │   ├── Analytics.jsx    # Analytique
│   │   │   ├── Forecasts.jsx    # Previsions IA
│   │   │   ├── Suppliers.jsx    # Fournisseurs
│   │   │   ├── Marketplace.jsx  # Marketplace B2B
│   │   │   ├── Customers.jsx    # Clients
│   │   │   ├── Payments.jsx     # Paiements
│   │   │   ├── CoachIA.jsx      # Coach IA
│   │   │   ├── Profit.jsx       # Analyse de profit
│   │   │   ├── SupplierDashboard.jsx  # Dashboard fournisseur
│   │   │   ├── SupplierOrders.jsx     # Commandes fournisseur
│   │   │   ├── AdminDashboard.jsx     # Dashboard admin
│   │   │   └── ...
│   │   ├── components/      # Layout, Sidebar, Header
│   │   ├── context/         # AuthContext (gestion d'etat)
│   │   ├── api/client.js    # Client Axios centralise
│   │   └── main.jsx         # Point d'entree Vite
│   ├── package.json
│   └── vite.config.js
│
├── nginx/                   # Configuration reverse proxy
├── docker-compose.yml       # 9 services Docker
├── requirements.txt         # Dependances Python
├── .env.example             # Template de configuration
└── README.md
```

---

## Installation & Deploiement

### Prerequis
- Docker & Docker Compose
- Cle API OpenAI (pour les fonctionnalites IA)
- Compte WhatsApp Business API (optionnel)

### Installation locale

```bash
# 1. Cloner le repo
git clone https://github.com/votre-repo/souk-ai.git
cd souk-ai

# 2. Configurer l'environnement
cp .env.example .env
# Editer .env avec vos cles API

# 3. Lancer tous les services
docker compose up -d --build

# 4. Appliquer les migrations
docker compose exec backend alembic upgrade head

# 5. Acceder a l'application
# Frontend : http://localhost
# Backend API : http://localhost:8000/docs
```

### Deploiement VPS (Production)

```bash
# Deployer les modifications
scp -r backend/ ubuntu@VOTRE_IP:/opt/souk-ai/backend/
scp -r frontend/ ubuntu@VOTRE_IP:/opt/souk-ai/frontend/

# Rebuild et redemarrer
ssh ubuntu@VOTRE_IP "cd /opt/souk-ai && docker compose up -d --build"

# Verifier les logs
ssh ubuntu@VOTRE_IP "cd /opt/souk-ai && docker compose logs backend --tail 30"
```

---

## Configuration (.env)

```env
# Base de donnees
POSTGRES_USER=souk
POSTGRES_PASSWORD=votre_mot_de_passe
POSTGRES_DB=soukdb
DATABASE_URL=postgresql+asyncpg://souk:votre_mot_de_passe@postgres:5432/soukdb

# Cache & Celery
REDIS_URL=redis://redis:6379/0

# Securite
SECRET_KEY=votre_cle_secrete_256bits
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# OpenAI (IA)
OPENAI_API_KEY=sk-...

# WhatsApp Cloud API
WHATSAPP_ACCESS_TOKEN=EAAG...
WHATSAPP_PHONE_NUMBER_ID=123456789
WHATSAPP_VERIFY_TOKEN=souk_verify_token
WHATSAPP_APP_SECRET=abc123

# Application
APP_ENV=production
FRONTEND_URL=https://soukai.duckdns.org
ADMIN_PHONE=212XXXXXXXXX
```

---

## API Documentation

L'API REST est documentee automatiquement via **Swagger UI** :

```
https://soukai.duckdns.org/docs
```

### Endpoints principaux

| Methode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/api/v1/auth/register` | Inscription marchand/fournisseur |
| `POST` | `/api/v1/auth/login` | Connexion (phone + password) |
| `GET` | `/api/v1/products/` | Liste des produits |
| `POST` | `/api/v1/products/scan-invoice` | Scan facture par IA (GPT-4o Vision) |
| `GET` | `/api/v1/products/expiring/soon` | Produits proches expiration |
| `POST` | `/api/v1/transactions/` | Enregistrer une vente |
| `GET` | `/api/v1/inventory/` | Etat du stock |
| `GET` | `/api/v1/inventory/alerts` | Alertes stock bas |
| `GET` | `/api/v1/analytics/dashboard` | Stats du tableau de bord |
| `GET` | `/api/v1/analytics/sales-chart` | Graphique des ventes |
| `GET` | `/api/v1/forecasts/` | Previsions de demande 7 jours |
| `GET` | `/api/v1/marketplace/listings` | Annonces marketplace B2B |
| `POST` | `/api/v1/marketplace/orders` | Passer une commande B2B |
| `GET` | `/api/v1/credit/score` | Score de credit du marchand |
| `GET` | `/api/v1/supplier-portal/dashboard` | Stats portail fournisseur |
| `POST` | `/api/v1/whatsapp/webhook` | Webhook WhatsApp entrant |
| `GET` | `/api/v1/admin/monitoring` | Monitoring admin |

---

## Roles Utilisateurs

| Role | Acces | Route |
|------|-------|-------|
| **Marchand** | POS, Produits, Stock, Ventes, Analytics, Fournisseurs, Marketplace, Credit, Coach IA, Employes | `/dashboard` |
| **Fournisseur** | Dashboard, Commandes recues, Catalogue, Paiements, Chat, Parametres | `/supplier-dashboard` |
| **Admin** | Marchands, Cartes Souk.AI, Paiements globaux, Demandes de credit, Monitoring | `/admin` |

---

## Taches Automatisees (Celery Beat)

| Tache | Frequence | Description |
|-------|-----------|-------------|
| `send_daily_reports` | Chaque jour a 8h | Resume WhatsApp : ventes + alertes stock + expirations |
| `send_expiry_alerts` | Chaque jour a 7h | Alerte WhatsApp pour produits expirant sous 3 jours |
| `update_forecasts` | Chaque jour a 6h | Recalcul des previsions de demande |
| `update_market_benchmarks` | Chaque semaine | Mise a jour des benchmarks de prix |

---

## Securite

- Authentification **JWT** avec expiration configurable (24h par defaut)
- Mots de passe hashes avec **bcrypt** (salt automatique)
- Protection CORS configuree par environnement
- Validation stricte des entrees par **Pydantic**
- Separation des roles : Marchand / Fournisseur / Admin
- Routes protegees par dependencies FastAPI (`get_current_merchant`, `get_current_supplier`, `check_is_admin`)
- OTP par WhatsApp pour le reset de mot de passe (6 digits, expire en 10 min)
- Conteneurs Docker non-root (`appuser`)
- Nginx reverse proxy avec HTTPS

---

## Screenshots

| Dashboard Marchand | Point de Vente | Gestion Produits |
|---|---|---|
| Stats, ventes, alertes | Caisse tactile, scan | Catalogue, expiration |

| Marketplace B2B | Dashboard Admin | Previsions IA |
|---|---|---|
| Annonces, commandes | Monitoring global | Graphiques 7 jours |

---

## Roadmap

- [x] POS intelligent avec scan code-barres
- [x] Gestion de stock avec alertes
- [x] Scan de factures par IA (GPT-4o Vision)
- [x] Carte Souk.AI NFC
- [x] Bot WhatsApp IA (Darija/FR/EN)
- [x] Marketplace B2B
- [x] Portail fournisseur (double profil)
- [x] Previsions de demande IA
- [x] Intelligence de marche
- [x] Coach IA
- [x] Import Sage
- [x] Dates d'expiration avec alertes
- [ ] Application mobile (React Native)
- [ ] Paiement mobile (CMI / CashPlus)
- [ ] Programme de fidelite client
- [ ] Multi-boutique pour un meme marchand

---

## Auteur

**Abdellah Ennajari**

| | |
|---|---|
| Email | abdellahennajari2018@gmail.com |
| Tel | +212 667 156 625 |
| Ville | Casablanca, Maroc |

---

## Licence

Projet prive — Tous droits reserves.

---

<p align="center">
  <strong>Souk.AI</strong> — Digitaliser le commerce marocain avec l'intelligence artificielle
  <br/>
  <sub>Projet soumis au programme PPEJ 2026 (CONFEJES / Ministere de la Jeunesse)</sub>
</p>
