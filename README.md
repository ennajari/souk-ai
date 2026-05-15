# Souk.AI

**Gestion intelligente pour les commercants marocains** -- Plateforme SaaS tout-en-un combinant point de vente (POS), gestion de stock, paiements NFC, intelligence artificielle et marketplace B2B.

> Deploye sur [soukai.duckdns.org](https://soukai.duckdns.org)

---

## Sommaire

- [Fonctionnalites](#fonctionnalites)
- [Architecture](#architecture)
- [Stack technique](#stack-technique)
- [Structure du projet](#structure-du-projet)
- [Installation locale](#installation-locale)
- [Variables d'environnement](#variables-denvironnement)
- [Deploiement VPS](#deploiement-vps)
- [API Reference](#api-reference)
- [Systeme de paiement](#systeme-de-paiement)
- [Carte Souk.AI](#carte-soukai)
- [Base de donnees](#base-de-donnees)
- [Licence](#licence)

---

## Fonctionnalites

### Point de Vente (POS)
- Caisse tactile optimisee pour la vitesse (6 clients / 5 min)
- Scan code-barres via camera ou lecteur physique
- Liaison automatique code-barres ↔ produit
- 3 modes de paiement en 1 clic : **Cash**, **Credit** (carnet), **NFC**
- Ticket de caisse imprimable (80mm thermique)
- Support bilingue francais / arabe (RTL)

### Gestion de stock
- Inventaire en temps reel avec seuils d'alerte
- Ajustement de stock avec historique complet
- Import depuis factures fournisseurs via OCR (GPT-4o Vision)
- Import fichiers Sage (articles + ventes)
- Previsions de stock par IA (forecasting)

### Paiements
- **Especes** -- enregistrement instantane
- **Carte Souk.AI** -- carte prepayee rechargeable NFC (type tramway Casablanca)
- **Carte bancaire NFC** -- paiement sans contact
- **CMI** -- passerelle de paiement en ligne marocaine
- **CashPlus** -- paiement par voucher
- **Credit** -- carnet de credit client avec suivi des dettes

### Intelligence artificielle
- Previsions de ventes et de stock (ML)
- Coach IA pour conseils business personnalises
- Analyse de marche et benchmarking concurrentiel
- Extraction automatique de produits depuis photos de factures
- Recherche semantique de produits (Weaviate)

### Commerce
- Carnet de credit client (dettes / paiements)
- Gestion fournisseurs et commandes
- Marketplace B2B inter-commercants
- Catalogue public partageable
- Factures et historique de transactions
- Export CSV (produits, transactions, profits)

### Notifications
- Bot WhatsApp pour alertes de stock et rapports
- Notifications in-app

---

## Architecture

```
                    Internet
                       |
                 Cloudflare Tunnel
                       |
                   +-------+
                   | Nginx |  (SSL + reverse proxy)
                   +---+---+
                   /       \
          +-------+         +----------+
          |Frontend|         | Backend  |
          | React  |         | FastAPI  |
          | :80    |         | :8000    |
          +--------+         +----+-----+
                                  |
                    +-------------+-------------+
                    |             |              |
               +----+----+  +----+----+  +------+------+
               |PostgreSQL|  |  Redis  |  |  Weaviate   |
               |TimescaleDB| | (cache) |  | (vector DB) |
               |  :5432   |  | :6379  |  |   :8081     |
               +----------+  +--------+  +-------------+
                    |
              +-----+------+
              |   Celery    |
              | Worker+Beat |
              +-------------+
```

---

## Stack technique

| Couche | Technologie |
|--------|------------|
| **Frontend** | React 18, Vite 6, Tailwind CSS 3, React Router 6, Recharts, i18next |
| **Backend** | Python 3.12, FastAPI 0.115, SQLAlchemy 2.0 (async), Pydantic 2 |
| **Base de donnees** | PostgreSQL 16 (TimescaleDB), Alembic (migrations) |
| **Cache / Queue** | Redis 7, Celery 5.4 |
| **IA** | OpenAI GPT-4o (OCR + coach), Weaviate (recherche semantique) |
| **Auth** | JWT (HS256), bcrypt |
| **Deploiement** | Docker Compose, Nginx, Cloudflare Tunnel, Let's Encrypt |
| **NFC** | Web NFC API (NDEFReader) -- Android Chrome |

---

## Structure du projet

```
souk-ai/
├── backend/
│   ├── alembic/              # Migrations de base de donnees
│   │   └── versions/         # Fichiers de migration
│   ├── api/v1/               # Endpoints REST
│   │   ├── auth.py           # Inscription / connexion
│   │   ├── products.py       # CRUD produits + dedup + merge
│   │   ├── transactions.py   # Ventes / achats / retours + batch
│   │   ├── inventory.py      # Stock + alertes
│   │   ├── customers.py      # Carnet de credit
│   │   ├── invoices.py       # Factures + paiement public
│   │   ├── souk_cards.py     # Carte Souk.AI (NFC)
│   │   ├── payments.py       # CMI / CashPlus / NFC
│   │   ├── suppliers.py      # Fournisseurs + commandes
│   │   ├── marketplace.py    # B2B listings + orders
│   │   ├── analytics.py      # Dashboard + graphiques
│   │   ├── forecasts.py      # Previsions IA
│   │   ├── market.py         # Intelligence de marche
│   │   ├── coach.py          # Coach IA
│   │   ├── whatsapp.py       # Webhook WhatsApp
│   │   ├── sage.py           # Import Sage
│   │   ├── export.py         # Export CSV
│   │   └── ...
│   ├── models/               # Modeles SQLAlchemy
│   │   ├── merchant.py       # Commercant
│   │   ├── product.py        # Produit (name_fr + name_ar)
│   │   ├── transaction.py    # Transaction (SALE/PURCHASE/RETURN)
│   │   ├── inventory.py      # Stock + seuil d'alerte
│   │   ├── customer.py       # Client + carnet credit
│   │   ├── souk_card.py      # Carte NFC prepayee
│   │   ├── invoice.py        # Facture avec token public
│   │   ├── payment.py        # Paiement (CMI/NFC/Cash/CashPlus)
│   │   ├── supplier.py       # Fournisseur
│   │   ├── marketplace.py    # Listing + Order B2B
│   │   ├── forecast.py       # Prevision
│   │   └── ...
│   ├── services/             # Logique metier
│   │   ├── inventory.py      # Gestion stock + recherche produit
│   │   ├── payment_service.py    # CMI + CashPlus + NFC
│   │   ├── soukcard_service.py   # Carte Souk.AI
│   │   ├── invoice_service.py    # Factures + paiement
│   │   └── ...
│   ├── workers/              # Taches Celery
│   │   ├── celery_app.py     # Configuration Celery
│   │   └── tasks.py          # WhatsApp, PDF, analytics, alertes
│   ├── core/
│   │   ├── database.py       # Engine async + pool (10 conn)
│   │   ├── deps.py           # Dependencies (auth middleware)
│   │   └── security.py       # JWT + bcrypt
│   ├── app/
│   │   ├── main.py           # FastAPI app + CORS
│   │   └── config.py         # Settings (env)
│   ├── schemas/              # Pydantic schemas (request/response)
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── POS.jsx           # Caisse (page principale)
│   │   │   ├── Dashboard.jsx     # Tableau de bord
│   │   │   ├── Products.jsx      # Gestion produits + scan facture
│   │   │   ├── Inventory.jsx     # Inventaire + ajustements
│   │   │   ├── Sales.jsx         # Historique ventes
│   │   │   ├── Payments.jsx      # Factures + Carte Souk.AI + config
│   │   │   ├── PayInvoice.jsx    # Page paiement publique (client)
│   │   │   ├── Customers.jsx     # Carnet de credit
│   │   │   ├── Suppliers.jsx     # Fournisseurs
│   │   │   ├── Marketplace.jsx   # B2B
│   │   │   ├── Analytics.jsx     # Analyses
│   │   │   ├── Profit.jsx        # Marges + profits
│   │   │   ├── Forecasts.jsx     # Previsions IA
│   │   │   ├── Settings.jsx      # Parametres
│   │   │   └── ...
│   │   ├── components/
│   │   │   ├── Sidebar.jsx       # Navigation laterale
│   │   │   ├── Layout.jsx        # Layout RTL-aware
│   │   │   ├── BarcodeScanner.jsx
│   │   │   ├── StatsCard.jsx
│   │   │   └── ...
│   │   ├── api/
│   │   │   └── client.js        # Axios client + toutes les APIs
│   │   ├── context/
│   │   │   └── AuthContext.jsx   # Auth state (JWT + merchant)
│   │   ├── i18n/                 # Traductions fr/ar
│   │   └── App.jsx              # Routes
│   ├── Dockerfile
│   └── package.json
│
├── nginx/
│   ├── nginx.conf          # SSL + proxy /api → backend, / → frontend
│   └── Dockerfile
│
├── docker-compose.yml      # 7 services
└── .env                    # Variables d'environnement
```

---

## Installation locale

### Prerequis

- Docker + Docker Compose
- Git

### Demarrage

```bash
# Cloner le projet
git clone https://github.com/ennajari/souk-ai.git
cd souk-ai

# Configurer l'environnement
cp .env.example .env
# Editer .env avec vos cles (voir section Variables d'environnement)

# Lancer tous les services
docker compose up -d --build

# Executer les migrations
docker compose exec backend alembic upgrade head
```

L'application est accessible sur :
- **Frontend** : http://localhost (port 80)
- **Backend API** : http://localhost/api/v1/
- **Swagger docs** : http://localhost/docs

### Developpement (sans Docker)

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (dans un autre terminal)
cd frontend
npm install
npm run dev
```

---

## Variables d'environnement

| Variable | Description | Defaut |
|----------|------------|--------|
| `DATABASE_URL` | URL PostgreSQL async | `postgresql+asyncpg://souk_user:changeme@localhost:5432/souk_db` |
| `REDIS_URL` | URL Redis | `redis://localhost:6379/0` |
| `SECRET_KEY` | Cle secrete JWT | `changeme` |
| `OPENAI_API_KEY` | Cle API OpenAI (OCR + coach IA) | -- |
| `WHATSAPP_ACCESS_TOKEN` | Token WhatsApp Cloud API | -- |
| `WHATSAPP_PHONE_NUMBER_ID` | ID numero WhatsApp | -- |
| `WHATSAPP_APP_SECRET` | Secret app WhatsApp | -- |
| `BACKEND_CORS_ORIGINS` | Origines CORS (JSON array) | `["http://localhost:5173"]` |
| `FRONTEND_URL` | URL du frontend | `http://localhost:8080` |
| `CLOUDFLARED_TUNNEL_TOKEN` | Token tunnel Cloudflare | -- |
| `POSTGRES_USER` | Utilisateur PostgreSQL | `souk_user` |
| `POSTGRES_PASSWORD` | Mot de passe PostgreSQL | `postgres123` |
| `POSTGRES_DB` | Nom de la base | `souk_db` |

---

## Deploiement VPS

### Infrastructure

- **VPS** : OVH, Ubuntu
- **Domaine** : soukai.duckdns.org
- **SSL** : Let's Encrypt (certbot)
- **Tunnel** : Cloudflare Tunnel (cloudflared)

### Deployer une mise a jour

```bash
# Sur le VPS
ssh ubuntu@<VPS_IP>
cd /opt/souk-ai

# Migration si necessaire
sudo docker compose exec backend alembic upgrade head

# Rebuild + restart
sudo docker compose up -d --build --force-recreate

# Verifier les logs
sudo docker compose logs -f --tail=50 backend
```

### Commandes utiles

```bash
# Status des conteneurs
sudo docker compose ps

# Logs d'un service
sudo docker compose logs -f backend
sudo docker compose logs -f nginx

# Acces shell backend
sudo docker compose exec backend bash

# Renouveler le certificat SSL
sudo certbot renew
```

---

## API Reference

Base URL : `/api/v1`

### Authentification

| Methode | Endpoint | Description |
|---------|----------|------------|
| `POST` | `/auth/register` | Inscription commercant |
| `POST` | `/auth/login` | Connexion (retourne JWT) |
| `GET` | `/auth/me` | Profil connecte |

### Produits

| Methode | Endpoint | Description |
|---------|----------|------------|
| `GET` | `/products/` | Liste des produits |
| `POST` | `/products/` | Creer un produit (detection doublons fr/ar) |
| `PATCH` | `/products/{id}` | Modifier un produit |
| `DELETE` | `/products/{id}` | Desactiver un produit |
| `POST` | `/products/{keep}/merge/{remove}` | Fusionner deux doublons |
| `POST` | `/products/scan-invoice` | OCR facture fournisseur (GPT-4o Vision) |

### Transactions

| Methode | Endpoint | Description |
|---------|----------|------------|
| `GET` | `/transactions/` | Historique (filtrable par type) |
| `POST` | `/transactions/` | Creer une transaction |
| `POST` | `/transactions/bulk` | Creer plusieurs transactions (POS batch) |
| `POST` | `/transactions/{id}/return` | Retour / annulation |

### Carte Souk.AI

| Methode | Endpoint | Description |
|---------|----------|------------|
| `POST` | `/souk-cards/register` | Enregistrer une nouvelle carte |
| `POST` | `/souk-cards/topup` | Recharger une carte |
| `GET` | `/souk-cards/nfc/{uid}` | Chercher carte par NFC UID |
| `GET` | `/souk-cards/phone/{phone}` | Chercher par telephone |
| `GET` | `/souk-cards/{number}` | Consulter le solde |
| `GET` | `/souk-cards/{number}/transactions` | Historique carte |

### Factures

| Methode | Endpoint | Description |
|---------|----------|------------|
| `POST` | `/invoices/` | Creer une facture |
| `GET` | `/invoices/` | Liste des factures |
| `GET` | `/invoices/pay/{token}` | Consulter facture (public, sans auth) |
| `POST` | `/invoices/pay/{token}` | Payer une facture (public, sans auth) |

### Autres endpoints

| Module | Prefix | Fonctionnalites |
|--------|--------|----------------|
| Inventaire | `/inventory/` | Stock, alertes, ajustements, logs |
| Clients | `/customers/` | CRUD + entrees credit (CREDIT / PAYMENT) |
| Fournisseurs | `/suppliers/` | CRUD + commandes |
| Paiements | `/payments/` | CMI / CashPlus / NFC + config marchand |
| Analytics | `/analytics/` | Dashboard, graphiques ventes, profits |
| Previsions | `/forecasts/` | Previsions de ventes par produit (IA) |
| Marketplace | `/marketplace/` | Listings, commandes B2B |
| Marche | `/market/` | Benchmark, tendances, prix concurrents |
| Export | `/export/` | CSV produits, transactions, profits |
| WhatsApp | `/whatsapp/` | Webhook bot WhatsApp |
| Coach IA | `/coach/` | Conseils business personnalises |

Documentation interactive Swagger : `/docs`

---

## Systeme de paiement

### Flux POS (Caisse)

```
Commercant scanne / selectionne produits
                 |
           Panier rempli
                 |
     +-----------+-----------+
     |           |           |
   [Cash]    [Credit]     [NFC]
   1 clic     1 clic     Terminal
     |           |           |
     |      Entree dans    Scan NFC
     |      le carnet        |
     |      de credit   +----+----+
     |      du client   |         |
     |           |    Souk.AI  Bancaire
     |           |   PIN→Debit   OK
     |           |      |         |
     +-----------+------+---------+
                 |
      POST /transactions/bulk
         (1 seul appel API)
                 |
          Ticket imprime
```

### Methodes de paiement

| Methode | Type | Temps | Description |
|---------|------|-------|-------------|
| **Cash** | Direct | ~1s | 1 clic, pas de modal |
| **Credit** | Direct | ~1s | 1 clic, client requis, ajoute au carnet |
| **NFC Souk.AI** | Terminal | ~5s | Scan carte → PIN 4-6 chiffres → debit |
| **NFC Bancaire** | Terminal | ~3s | Scan carte → paiement direct |
| **CMI** | En ligne | ~30s | Redirection passerelle bancaire marocaine |
| **CashPlus** | Voucher | -- | Code a presenter chez agent CashPlus |

---

## Carte Souk.AI

Carte prepayee rechargeable NFC, inspiree des cartes de tramway de Casablanca.

### Caracteristiques

- **Numero** : 16 chiffres (prefixe `9212`)
- **Identification** : NFC UID (numero de serie materiel)
- **Securite** : PIN 4-6 chiffres (SHA-256)
- **Rechargement** : via application bancaire ou admin
- **Solde** : affiche lors du paiement NFC

### Flux de paiement NFC

```
1. Client approche la carte du telephone Android
2. Web NFC API lit le UID de la carte
3. GET /souk-cards/nfc/{uid} → info carte + solde
4. Client saisit son PIN (4-6 chiffres)
5. POST /invoices/pay/{token} → debit carte
6. Transaction enregistree, ticket imprime
```

### Prerequis NFC

- Telephone Android avec NFC active
- Chrome (seul navigateur supportant Web NFC API)
- HTTPS obligatoire (fonctionne en production)

---

## Base de donnees

### Schema principal

```
merchants ─┬── products ──── inventory
            │       └─────── transactions
            ├── customers ── credit_entries
            ├── suppliers ── supplier_orders
            ├── invoices
            ├── payments
            └── marketplace_listings ── marketplace_orders

souk_cards ──── card_transactions
```

### Migrations

```bash
# Creer une nouvelle migration
docker compose exec backend alembic revision --autogenerate -m "description"

# Appliquer les migrations
docker compose exec backend alembic upgrade head

# Rollback d'une migration
docker compose exec backend alembic downgrade -1
```

---

## Optimisations de performance

Le systeme est optimise pour servir **6 clients en 5 minutes** :

| Optimisation | Impact |
|-------------|--------|
| Batch transactions (`POST /bulk`) | 1 requete au lieu de N par vente |
| 1-click Cash / Credit | Pas de modal, paiement instantane |
| Debounce recherche (120ms) | Pas de lag avec 500+ produits |
| Chargement parallele | Produits + clients en `Promise.all` |
| Pool DB (10 conn + 5 overflow) | Support clients simultanes |
| Lazy loading optimise | Pas de chargement inutile des relations |
| CORS preflight cache (1h) | Elimine les requetes OPTIONS repetees |
| Timeout API (20s) | Pas de requetes bloquees indefiniment |
| Detection doublons produits | Evite les duplications fr ↔ ar |
| Fusion produits (`/merge`) | Nettoie les doublons existants |

---

## Langues supportees

| Langue | Code | Direction |
|--------|------|-----------|
| Francais | `fr` | LTR (gauche → droite) |
| Arabe | `ar` | RTL (droite ← gauche) |

L'interface detecte automatiquement la langue du navigateur. Le changement est disponible dans le header.

---

## Licence

Projet prive -- Tous droits reserves.

Developpe par **Abdellah Ennajari** -- 2025/2026

---

*Souk.AI -- Gestion intelligente pour les commercants marocains*
