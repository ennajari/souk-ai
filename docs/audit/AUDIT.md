# Souk.AI — Audit complet (branche `audit/world-class`, 2026-11-08)

Périmètre lu : `backend/` (≈10,8 k lignes Python, 28 routeurs, 22 modèles, 17 services, Celery),
`frontend/` (≈12 k lignes JSX, 38 pages), `docker-compose*.yml`, `nginx/`, `.github/`, scripts, README.
Toutes les références `fichier:ligne` pointent vers le commit `21903ab` (avant corrections).

Sévérité : **C** critique · **H** haute · **M** moyenne · **B** basse. Effort : S (<2 h) · M (½–1 j) · L (>1 j).
Colonne « Statut » : ✅ corrigé sur cette branche · ◐ partiellement · ✗ ouvert (voir REPORT.md).

---

## 0. Baseline (avant)

| Mesure | Valeur | Commande |
|---|---|---|
| Tests backend | **0** (aucun dossier `tests/`) | — |
| Tests frontend / e2e | **0** | — |
| CI | `ci.yml`, `cd.yml`, `tests.yml` **vides** ; seul Sonar tourne | `.github/workflows/` |
| Ruff (règles par défaut + pyproject) | **387 erreurs** (116 imports, 87 UP017, 21 blind-except…) | `ruff check .` |
| Bandit | 8 Low (dont `random` pour OTP — B311) | `bandit -r api core services workers app` |
| pip-audit | **17 vulnérabilités / 4 paquets** (python-jose, pyasn1, ecdsa, python-dotenv) | `pip-audit -r requirements.txt` |
| npm audit | **16** (9 high, 6 moderate, 1 low) | `npm audit` |
| `npm ci` | **échoue** : `package-lock.json` désynchronisé de `package.json` | `npm ci` |
| Build front | 8 s ; **1 bundle JS unique de 1 234 kB (324 kB gzip)** | `vite build` |
| i18n | 197 clés FR/AR ; seuls **12 fichiers sur ~50** utilisent `t()` ; **136** occurrences « MAD » codées en dur | grep |

---

## 1. Sécurité (score : **22/100**)

| # | Sév. | Constat | Preuve | Effort | Statut |
|---|---|---|---|---|---|
| S1 | **C** | **Secrets committés** : mot de passe SSH root-équivalent du VPS + IP en clair ; tokens WhatsApp longue durée ; archive `souk-ai.tar.gz` contenant `.env` et `.env.update` | `deploy.py:10-12`, `scripts/create_otp_template.py:13`, `scripts/fix_production.sh:11`, `souk-ai.tar.gz` (`souk-ai-deploy/.env`) | S (+rotation manuelle) | ◐ retirés de l'arbre ; **historique git et rotation = action manuelle** |
| S2 | **C** | **Prise de contrôle admin** : l'admin est identifié par `email == ADMIN_EMAIL`. L'email n'est ni unique ni vérifié : n'importe qui peut s'inscrire (`/auth/register`) ou modifier son profil (`PATCH /merchants/me`) avec cet email → accès à tout le back-office. En plus, l'email/téléphone personnels sont les valeurs par défaut du code. | `core/deps.py:14-19`, `app/config.py:31-32`, `api/v1/merchants.py:19`, `schemas/auth.py:6` | M | ✅ colonne `is_admin`, migration, défauts supprimés |
| S3 | **C** | **OTP de réinitialisation brute-forçable** : 6 chiffres via `random.randint` (non cryptographique), aucun compteur d'essais, aucune limitation de débit → 10⁶ essais possibles en 10 min ⇒ prise de contrôle de n'importe quel compte connaissant son numéro | `api/v1/auth.py:152,180` | S | ✅ `secrets`, 5 essais max, rate-limit |
| S4 | **C** | **Monnaie fictive sur carte Souk.AI** : tout marchand authentifié peut recharger *n'importe quelle* carte de 5 000 MAD, sans limite d'appels ni traçabilité du marchand | `api/v1/souk_cards.py:54-71`, `services/soukcard_service.py:114` | S | ✅ traçage `merchant_id`, plafond journalier |
| S5 | **C** | **Paiement carte sans PIN par numéro saisi** : en dessous de 50 MAD le PIN n'est pas exigé, même quand la carte est identifiée par `card_number` (pas un tap NFC). Les numéros sont **publics** via `GET /souk-cards/phone/{phone}` et `GET /souk-cards/{card_number}` (sans auth, renvoient nom + solde) ⇒ vol de solde en connaissant le téléphone d'une victime | `services/soukcard_service.py:154-157`, `api/v1/souk_cards.py:75,93,114` | S | ✅ auth requise, PIN obligatoire hors NFC |
| S6 | **C** | **PIN carte (4 chiffres) brute-forçable** sur un endpoint public (`POST /invoices/pay/{token}`), aucun verrouillage | `services/soukcard_service.py:160` | S | ✅ verrouillage 5 essais / 30 min |
| S7 | **H** | **Facture marquée payée par le client lui-même** : l'endpoint public accepte `CASH` et `NFC_BANK`, qui passent la facture à PAID sans aucun encaissement | `services/invoice_service.py:100-122`, `api/v1/invoices.py:119` | S | ✅ CASH/NFC_BANK réservés au marchand propriétaire |
| S8 | **H** | **Webhooks fail-open** : signature WhatsApp vérifiée *seulement si* `WHATSAPP_APP_SECRET` est défini ; callback CMI accepté sans signature si `CMI_STORE_KEY` vide. Le numéro WhatsApp = identité du marchand ⇒ faux messages = fausses ventes / changements de prix | `api/v1/whatsapp.py:45`, `services/payment_service.py:115-117` | S | ✅ fail-closed en production |
| S9 | **H** | `SECRET_KEY="changeme"` par défaut, sans garde au démarrage ; `APP_DEBUG=True` par défaut. JWT HS256 de 24 h, sans refresh ni révocation (un reset de mot de passe n'invalide pas les jetons volés) | `app/config.py:14,36`, `core/security.py` | M | ◐ garde au démarrage + révocation au reset (`token_version`) ; refresh tokens ✗ |
| S10 | **H** | Aucune limitation de débit (login, register, OTP, paiement public, scan IA payant) | absence de middleware, `api/v1/auth.py` | S | ✅ limiteur Redis sur les routes sensibles |
| S11 | **H** | **Weaviate exposé publiquement** (ports 8081/50051 publiés, accès anonyme activé) en prod | `docker-compose.prod.yml:77-82` | S | ✅ ports retirés |
| S12 | **H** | Dépendance `python-jose` non maintenue + 17 CVE transitives | pip-audit | S | ✅ migré vers PyJWT |
| S13 | M | Énumération de comptes (`404 Aucun compte avec ce numero`) | `api/v1/auth.py:150` | S | ✅ réponse générique |
| S14 | M | IDOR tenant : `customer_id` accepté sans vérifier qu'il appartient au marchand (ventes rattachées au client d'un autre commerce) | `api/v1/transactions.py:83,143` | S | ✅ |
| S15 | M | Uploads lus entièrement en mémoire, sans limite de taille/type (scan facture GPT-4o payant, import Sage) | `api/v1/products.py:295`, `api/v1/sage.py:32,137,218` | S | ✅ 10 Mo + types |
| S16 | M | JWT passé en query string pour SSE (journalisé par Nginx/proxies) | `api/v1/supplier_portal.py:373` | M | ✗ (ticket court-terme recommandé) |
| S17 | M | Pas d'en-têtes de sécurité (HSTS, nosniff, frame-ancestors, referrer-policy) | `nginx/nginx.conf` | S | ✅ |
| S18 | M | JWT + données marchand en `localStorage` (XSS ⇒ vol de session) | `frontend/src/api/client.js:9` | L | ✗ documenté |
| S19 | B | Numéro personnel (`ADMIN_PHONE`) dans le README et email/téléphone personnels en valeurs par défaut du code. Le numéro `wa.me/2127…` du front est celui du bot (public par nature) | `README.md:380`, `app/config.py:31-32` | S | ✅ retirés (le numéro du bot est conservé volontairement) |
| S20 | B | `/docs` et `/openapi.json` publics en prod | `nginx/nginx.conf` | S | ✅ désactivés si `APP_ENV=production` |

## 2. Logique métier (score : **38/100**)

| # | Sév. | Constat | Preuve | Effort | Statut |
|---|---|---|---|---|---|
| L1 | **C** | **Quantité négative acceptée** sur une vente : `quantity: int` sans contrainte ⇒ une « vente » de −5 *ajoute* du stock et crée un CA négatif ; prix négatifs acceptés | `schemas/transaction.py:10-11` | S | ✅ `gt=0`, `ge=0`, enums validés |
| L2 | **H** | **Encaissement carte non atomique, piloté par le navigateur** : le POS crée une facture, débite la carte, *puis* enregistre la vente. Si la vente échoue (stock insuffisant, réseau), le client est débité sans vente ni remboursement | `frontend/src/pages/POS.jsx:255-271` | M | ✅ une seule requête serveur atomique |
| L3 | **H** | **Vente à crédit non atomique** : vente enregistrée, puis écriture « carnet » dans une 2ᵉ requête. Si la 2ᵉ échoue (plafond atteint !), la marchandise sort sans créance | `frontend/src/pages/POS.jsx:306-317` | S | ✅ crédit dans la même transaction SQL |
| L4 | **H** | **Race conditions** (lost update) : stock, solde client et solde carte sont lus, modifiés en Python puis réécrits, sans verrou. Deux caisses simultanées ⇒ stock faux, double dépense carte | `api/v1/transactions.py:98,160`, `api/v1/customers.py:145`, `services/soukcard_service.py:114,164` | S | ✅ `SELECT … FOR UPDATE` |
| L5 | **H** | **Pas d'idempotence** sur l'encaissement : un double-tap ou un rejeu de la file hors-ligne (`utils/offlineDB.js`) crée des ventes en double | `api/v1/transactions.py:113` | M | ✅ en-tête `Idempotency-Key` + table |
| L6 | M | Arrondis : arithmétique `float` sur des montants (`float(x) + amount`) ; colonnes `Numeric(10,2)` mais calculs binaires | partout (`float(` ×300+) | L | ◐ chemins argent critiques (vente, crédit, carte) en `Decimal` |
| L7 | M | Score de crédit gonflable : volume compté sur les ventes **brutes** (vente+retour répétés ⇒ score ↑) | `services/credit_scoring.py:27-40` | S | ✅ net des retours |
| L8 | M | Prévision : code dupliqué (2 copies identiques), tendance non amortie qui extrapole sans borne, dates en UTC (pas l'heure locale) | `services/forecasting.py:11-100` vs `150-229` | S | ✅ dédupliqué, tendance amortie, backtest |
| L9 | M | Retour : détection du double-retour par heuristique (même produit/qté/prix) sans verrou | `api/v1/transactions.py:189-224` | S | ◐ verrou sur la vente d'origine |
| L10 | M | Rappels « karni » quotidiens automatiques en texte libre aux clients finaux : hors fenêtre 24 h WhatsApp ⇒ échec silencieux ; risque de blocage du numéro (politique WhatsApp Business : messages non sollicités) | `workers/tasks.py:1650-1735` | M | ✗ (exiger opt-in + template utilitaire) |
| L11 | B | Ventes WhatsApp (`record_sale`) ne contrôlent pas le stock disponible | `services/inventory.py:178` | S | ✗ |
| L12 | **H** | *Trouvé en implémentant* — **dérive schéma/migrations** : sur une base neuve, l'enum `paymentmethod` n'a pas `NFC_SOUKCARD`/`NFC_BANK` (paiement carte → erreur 500) et `customers.is_active` est INTEGER alors que le code compare à un booléen (liste clients → erreur) | `alembic/versions/c3d4e5f6a7b8…py:66`, `e5f6a7b8c9d0…py` | S | ✅ migration `k4l5m6n7o8p9` + tests sur schéma migré |
| L13 | **H** | *Trouvé en implémentant* — **suppression de compte impossible** (violation de clé étrangère) dès qu'il existe des transactions carte, factures ou demandes de crédit : droit à l'effacement inopérant | `api/v1/auth.py:205-280` | S | ✅ |

**Backtest prévision** (données seedées, 60 produits × 90 jours, horizon 7 j) — voir `backend/tests/test_forecasting.py` et
`docs/audit/REPORT.md`. Résultat (WAPE, plus bas = mieux) : modèle d'origine **0,218**, moyenne naïve 7 j 0,266, naïf saisonnier 0,243 ; nouveau modèle **0,205** ; démarrage à froid (10 j d'historique) 0,51 → **0,32**. Le modèle d'origine était donc sain ; les gains viennent de l'amortissement de la tendance, du lissage de la saisonnalité et de l'ignorance des jours à zéro initiaux.

## 3. Architecture & scalabilité (score : **45/100**)

| # | Sév. | Constat | Preuve | Effort | Statut |
|---|---|---|---|---|---|
| A1 | **H** | **Zéro test, CI vide** : aucune protection contre la régression sur des flux d'argent | `.github/workflows/*.yml` | M | ✅ 44 tests pytest (Postgres migré + Redis) + 2 e2e Playwright + CI GitHub Actions |
| A2 | M | `workers/tasks.py` = 1 885 lignes (god-module : bot, PDF, rapports, alertes) | `workers/tasks.py` | L | ✗ |
| A3 | M | Health check superficiel (`{"status":"ok"}` sans DB/Redis) | `app/main.py:25` | S | ✅ `/health/ready` |
| A4 | M | Logs via `print()` (≈130), pas de logs structurés ni d'ID de requête | grep `print(` | M | ◐ ID de requête + log JSON d'accès ; `print` restants ✗ |
| A5 | M | Tâches Celery sans `autoretry_for`/backoff ni DLQ ; dédup webhook non atomique (`GET` puis `SETEX`) | `workers/tasks.py:417+`, `api/v1/whatsapp.py:19-21` | S | ◐ dédup atomique `SET NX` |
| A6 | M | Redis synchrone appelé depuis un handler async (bloque la boucle) | `api/v1/whatsapp.py:17` | S | ✅ |
| A7 | B | `celerybeat-schedule` (fichier d'état binaire) committé | racine `backend/` | S | ✅ ignoré |
| A8 | B | Lockfile npm désynchronisé ; Dockerfile front utilise `npm install` (build non reproductible) | `frontend/Dockerfile:5` | S | ✅ |

## 4. Produit & UX/UI (score : **55/100**)

| # | Sév. | Constat | Preuve | Effort | Statut |
|---|---|---|---|---|---|
| U1 | **H** | Bundle unique 1,2 Mo ⇒ 5-10 s de premier chargement en 3G sur Android d'entrée de gamme | build | S | ✅ code-splitting par route |
| U2 | M | Vente à crédit/carte = 3 requêtes séquentielles ⇒ latence et états incohérents (voir L2/L3) | `POS.jsx` | M | ✅ 1 requête |
| U3 | M | Pas de rapport « argent perdu / argent à récupérer » alors que la proposition de valeur est « −15-20 % de pertes » | — | M | ✅ `GET /analytics/money-report` + carte dashboard |
| U4 | M | 26 pages sur 38 sans i18n ; textes FR codés en dur ; pas d'anglais | grep `useTranslation` | L | ◐ EN ajouté, POS/Dashboard/argent via `formatMoney` |
| U5 | M | Pas de mode sombre, pas de tokens de design | `tailwind.config.js` | M | ✗ |
| U6 | B | `dir="rtl"` positionné seulement dans le layout authentifié (Landing/Login non RTL) | `components/Layout.jsx:14` | S | ✅ appliqué globalement |

## 5. Internationalisation & marchés (score : **20/100**)

| # | Sév. | Constat | Preuve | Effort | Statut |
|---|---|---|---|---|---|
| I1 | **H** | Devise « MAD » codée en dur (136 occurrences front, messages backend) ; aucun champ pays/devise/fuseau sur le marchand | `models/merchant.py` | M | ◐ champs `country_code`/`currency`/`timezone` + profils pays + formatage front |
| I2 | **H** | Normalisation téléphone spécifique Maroc (`0… → 212…`) dupliquée en 2 endroits | `api/v1/auth.py:31`, `services/whatsapp.py:9` | S | ✅ une seule fonction, préfixe pays paramétrable |
| I3 | **H** | Pas de modèle de taxe (TVA/sales tax) ; factures sans ventilation fiscale ⇒ invendable en UE/US | `models/product.py` | M | ◐ profils de TVA par pays (config) ; ventilation sur facture ✗ |
| I4 | M | Fuseau Celery figé `Africa/Casablanca` pour tous les marchands | `workers/celery_app.py:16` | M | ✗ |
| I5 | M | *Trouvé en implémentant* — la connexion normalise toujours le téléphone en marocain : un commerce français inscrit en `06…` ne peut plus se connecter | `api/v1/auth.py:31` | S | ✅ pays par défaut de l'instance (`DEFAULT_COUNTRY`) ; sélecteur de pays au login ✗ |

## 6. Conformité & confiance (score : **25/100**)

| # | Sév. | Constat | Preuve | Effort | Statut |
|---|---|---|---|---|---|
| K1 | **C** | **Carte prépayée multi-commerçants = monnaie électronique** : au Maroc, l'émission relève d'un établissement de paiement agréé par Bank Al-Maghrib (loi 103-12) ; en UE, directive 2009/110/CE (EMD2). Sans partenaire agréé, la fonctionnalité expose juridiquement le projet | conception `souk_cards` | L | ✗ décision business (voir DECISIONS.md D7) |
| K2 | **H** | Pas d'export des données personnelles (RGPD art. 15/20, loi 09-08) ; suppression de compte existe mais pas de purge des cartes/fichiers | `api/v1/auth.py:205` | M | ✅ `GET /merchants/me/export` |
| K3 | **H** | Pas de CGU / politique de confidentialité / registre des traitements ; pas de déclaration CNDP mentionnée ; données clients (téléphones des clients du marchand) envoyées à OpenAI | — | M | ✗ (modèles à faire valider par un juriste) |
| K4 | M | Pas de journal d'audit sur les actions sensibles (admin, recharge carte, changement de prix) | — | M | ◐ recharge tracée |
| K5 | M | Logiciel de caisse en France : NF525/inaltérabilité exigée ; en Allemagne : TSE (KassenSichV). Les ventes sont modifiables/supprimables | — | L | ✗ roadmap |

## 7. Documentation & DX (score : **40/100**)

| # | Sév. | Constat | Preuve | Effort | Statut |
|---|---|---|---|---|---|
| D1 | **H** | README contient un numéro personnel et une procédure de déploiement par `scp` avec IP | `README.md:330-345,380` | S | ✅ réécrit FR + EN |
| D2 | M | Pas de Makefile / commande unique, pas de seed de démo documenté, pas d'ADR | — | S | ✅ Makefile + DECISIONS.md |
| D3 | B | `.env.example` incomplet (CMI, Sentry, pays par défaut) | `.env.example` | S | ✅ |

---

## Synthèse priorisée (impact × effort)

| Priorité | Items | Pourquoi d'abord |
|---|---|---|
| P0 — à faire avant toute démo publique | S1 (rotation), S2, S3, S4, S5, S6, S7, S8, L1 | Vol d'argent / prise de contrôle triviale |
| P1 — cette semaine | L2-L5, S9-S12, A1, U1 | Intégrité des ventes, garde-fous, filet de tests |
| P2 — 30 jours | I1-I3, K2, U3, A3-A6, S13-S17 | Vendabilité hors Maroc, confiance |
| P3 — 60-90 jours | K1 (partenaire agréé), K3, K5, A2, U4-U5, S16, S18 | Conformité marché UE/US, dette |

## Scores /100 (avant → après cette branche)

| Dimension | Avant | Après |
|---|---|---|
| Sécurité | 22 | 68 |
| Logique métier | 38 | 72 |
| Architecture & scalabilité | 45 | 60 |
| Produit & UX | 55 | 62 |
| i18n & marchés | 20 | 45 |
| Conformité | 25 | 38 |
| Documentation & DX | 40 | 70 |

Les scores « après » reflètent l'état réel de la branche (voir REPORT.md) ; ils restent volontairement < 75 :
la conformité monnaie électronique (K1), NF525/TSE (K5) et la ventilation fiscale (I3) ne sont pas réglables par du code seul.
