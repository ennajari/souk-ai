# Souk.AI v2 - Gestion Intelligente pour Commercants Marocains

Plateforme SaaS avec WhatsApp Business API + Dashboard Web pour la gestion d'inventaire et de ventes.

## Stack

- **Backend**: FastAPI + PostgreSQL + Redis + Celery
- **Frontend**: React 18 + Vite + TailwindCSS
- **AI**: Claude API (intent classification + entity extraction en Darija/FR)
- **WhatsApp**: Meta Cloud API
- **Deploy**: Docker Compose + Nginx

## Demarrage rapide

### 1. Configurer l'environnement

```bash
cp .env.example .env
# Editer .env avec vos valeurs
```

### 2. Lancer avec Docker Compose

```bash
docker-compose up --build
```

Services:
- Frontend: http://localhost:80
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Nginx proxy: http://localhost:8080

### 3. Appliquer les migrations

```bash
docker-compose exec backend alembic upgrade head
```

## Deploiement VPS

```bash
# Sur votre VPS Ubuntu/Debian
git clone <votre-repo> souk-ai
cd souk-ai
cp .env.example .env
# Editer .env avec les vrais credentials

docker-compose -f docker-compose.prod.yml up -d --build
docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

### SSL avec Let's Encrypt

```bash
apt install certbot
certbot certonly --standalone -d votre-domaine.com
# Puis decommenter la section HTTPS dans nginx/nginx.conf
```

## API Endpoints

| Methode | Route | Description |
|---------|-------|-------------|
| POST | /api/v1/auth/register | Inscription |
| POST | /api/v1/auth/login | Connexion |
| GET | /api/v1/auth/me | Profil |
| GET/POST | /api/v1/whatsapp/webhook | Webhook WhatsApp |
| GET/POST | /api/v1/products/ | CRUD produits |
| GET | /api/v1/inventory/ | Inventaire |
| POST | /api/v1/inventory/adjust | Ajuster stock |
| GET/POST | /api/v1/transactions/ | Ventes |
| GET | /api/v1/analytics/dashboard | Stats |
| GET | /api/v1/analytics/sales-chart | Graphiques |

## Configuration WhatsApp

Voir [docs/WHATSAPP_SETUP.md](docs/WHATSAPP_SETUP.md)
