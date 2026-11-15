# Runbook d'exploitation — Souk.AI

À garder à jour. Chaque section est une procédure à suivre telle quelle, de préférence à deux.

## Vue d'ensemble

```
push sur main ──► CI (lint, tests, migrations, audits, e2e) ──► Release images (GHCR, tag = commit)
                                                                        │
serveur :  docker compose pull + up  ◄──────── IMAGE_TAG=<commit> ──────┘
```
Le commerçant n'a **aucun matériel** à installer : l'application tourne dans le cloud ; son téléphone (ou
tablette/PC) est la caisse. Une douchette USB/Bluetooth ou une imprimante sont **optionnelles**. Aucun Raspberry Pi.

## 1. Premier déploiement

1. Serveur Linux avec Docker (2 vCPU / 4 Go suffisent pour le pilote).
2. `git clone` du dépôt dans `/opt/souk-ai`, puis `cp .env.example .env` et remplir **au minimum** :
   `POSTGRES_*`, `SECRET_KEY` (`openssl rand -hex 32`), `APP_ENV=production`, `ADMIN_PHONE`,
   `WHATSAPP_*` (dont `WHATSAPP_APP_SECRET`, sinon les webhooks sont refusés), `CMI_STORE_KEY` si CMI,
   `SENTRY_DSN`, `BACKUP_UPLOAD_CMD`.
3. Accès aux images (paquets GHCR privés) : `echo <token GitHub read:packages> | docker login ghcr.io -u ennajari --password-stdin`.
4. `IMAGE_TAG=<commit> docker compose -f docker-compose.prod.yml up -d` — les migrations s'appliquent au démarrage
   du backend ; le compte `ADMIN_PHONE` devient admin (sinon : `docker compose exec backend python -m scripts.grant_admin <tel>`).
5. Vérifier : `curl -fsS https://<domaine>/health/ready` → `{"status":"ok", …}`.

## 2. Déployer une nouvelle version

```bash
cd /opt/souk-ai && git pull               # compose + scripts de déploiement
export IMAGE_TAG=<7 premiers caractères du commit>   # visible dans GitHub → Actions → Release images
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps   # backend "healthy" en ~1 min
```
Faire une sauvegarde manuelle juste avant un déploiement qui contient une migration (§4).

## 3. Revenir en arrière (rollback)

```bash
export IMAGE_TAG=<commit précédent>
docker compose -f docker-compose.prod.yml up -d
```
Les migrations sont **additives** (nouvelles colonnes/tables) : l'ancienne version fonctionne avec le schéma
récent. Ne lancer `alembic downgrade` que si une migration elle-même est en cause, et après sauvegarde.

## 4. Sauvegardes

- Le service `db-backup` fait un `pg_dump` quotidien dans `./backups` (format custom, vérifié par `pg_restore --list`,
  14 jours de rétention). Manuel : `docker compose -f docker-compose.prod.yml run --rm db-backup --once`.
- **Une sauvegarde sur le même serveur n'est pas une sauvegarde.** Renseigner `BACKUP_UPLOAD_CMD`, par ex.
  `rclone copy {} b2:souk-backups` (Backblaze B2, S3, Google Drive… via rclone). `{}` = chemin du fichier.
- **Exercice de restauration une fois par mois** (une sauvegarde jamais restaurée n'existe pas) :
  ```bash
  docker compose -f docker-compose.prod.yml exec postgres sh /deploy/restore.sh /backups/<fichier>.dump restore_check
  # comparer : select count(*) from transactions;  dans les deux bases, puis : dropdb restore_check
  ```
  (monter `./deploy` et `./backups` dans le service postgres pour cet exercice, ou utiliser `db-backup`).
- Testé le 2026-11-15 : sauvegarde + restauration d'une base de démo, mêmes 280 transactions des deux côtés.

## 5. Surveillance

- **Erreurs** : `SENTRY_DSN` (sentry.io, offre gratuite, ou GlitchTip auto-hébergé — même SDK). API et workers
  Celery remontent les exceptions ; aucune donnée personnelle envoyée (`send_default_pii=False`).
- **Disponibilité** : un moniteur externe gratuit (UptimeRobot, Better Stack…) sur `https://<domaine>/health/ready`
  toutes les minutes, alerte par SMS/WhatsApp/e-mail. `ready` vérifie PostgreSQL et Redis.
- **Logs** : une ligne JSON par requête avec `rid` (renvoyé dans l'en-tête `X-Request-ID`) :
  `docker compose -f docker-compose.prod.yml logs backend | grep <rid>`.
- **Tâches planifiées** : `docker compose -f docker-compose.prod.yml logs celery-beat` doit montrer les envois
  (rapports 00:00, alertes 08:00/09:00, rappels 10:00, prévisions 01:00 — heure de Casablanca).

## 6. Figer la version de la base

```bash
docker compose -f docker-compose.prod.yml exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB \
  -tAc "select current_setting('server_version'), (select extversion from pg_extension where extname='timescaledb')"
```
Remplacer `timescale/timescaledb:latest-pg16` par `timescale/timescaledb:<extversion>-pg16` (la version **affichée**,
jamais une plus ancienne : l'extension ne se rétrograde pas).

## 7. Incident : l'API ne répond plus

1. `docker compose -f docker-compose.prod.yml ps` — quel service n'est pas `healthy` ?
2. `docker compose -f docker-compose.prod.yml logs --tail 200 backend` ; `/health/ready` dit si c'est la base ou Redis.
3. Disque plein ? `df -h` (les sauvegardes et les logs Docker sont les suspects habituels).
4. Si une version vient d'être déployée : rollback (§3), puis analyse à froid.
5. Les caisses continuent d'encaisser **en espèces hors ligne** pendant la panne ; elles se resynchronisent seules,
   sans doublon (clé d'idempotence), au retour du service.

## 8. Fuite de secret

Changer immédiatement le secret chez le fournisseur (Meta, OpenAI, hébergeur…), mettre à jour `.env`, redémarrer.
Changer `SECRET_KEY` déconnecte tous les utilisateurs (voulu). Ne jamais committer `.env` ni une sauvegarde.

`deploy.py` (upload de fichiers par SSH) est **obsolète** : utiliser les images versionnées ci-dessus.
