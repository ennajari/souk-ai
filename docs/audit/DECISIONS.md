# DECISIONS (ADR légers)

Format : décision · alternatives · raison · réversibilité. ⚠ = à valider par le fondateur au réveil.

**D1 ⚠ — Admin = drapeau `merchants.is_admin` en base, accordé à `ADMIN_PHONE` par la migration**
- Alternatives : garder l'email (faille S2) ; rendre l'email unique (migration risquée si doublons déjà créés par un attaquant).
- Raison : le téléphone est unique et exige le mot de passe du compte ; l'email est éditable par n'importe qui.
- Réversible : oui (`scripts/grant_admin.py <tel> --revoke`). **Action** : lancer la migration avec `ADMIN_PHONE` défini, ou exécuter le script.

**D2 — PyJWT à la place de python-jose ; claim `ver` pour révoquer**
- Alternatives : refresh tokens + liste noire Redis (plus complet, plus long).
- Raison : python-jose non maintenu (CVE) ; `token_version` révoque toutes les sessions au reset en 1 colonne. Les jetons existants (sans `ver`) restent valides.
- Réversible : oui. Refresh tokens = étape suivante.

**D3 — Rate limiting Redis « fixed window », fail-open**
- Alternatives : slowapi ; limiter dans Nginx (`limit_req`).
- Raison : 40 lignes, aucune dépendance, clés métier (par compte ET par IP). Fail-open : si Redis tombe, la caisse continue de fonctionner (disponibilité > limitation stricte). OTP et PIN ont leur propre compteur.
- Réversible : oui.

**D4 — Encaissement POS côté serveur dans une seule transaction (`POST /transactions/bulk` + `payment_method`)**
- Alternatives : saga/compensation côté client ; garder la facture comme pivot.
- Raison : la seule façon d'avoir « tout ou rien » entre stock, carnet de crédit et débit carte. Compatibilité : appel sans `payment_method` = CASH comme avant.
- Réversible : oui (l'ancien flux facture reste disponible pour les liens de paiement).

**D5 — Idempotence via table `idempotency_keys` (pas Redis)**
- Raison : une vente hors-ligne peut être rejouée des jours plus tard ; une TTL Redis l'aurait oubliée. Clé unique (marchand, clé).
- Réversible : oui (table indépendante). Purge des clés > 90 j à ajouter (tâche Celery).

**D6 — Ventes hors-ligne : CASH uniquement**
- Alternatives : file hors-ligne pour carte/crédit aussi.
- Raison : le crédit (plafond) et la carte (solde, PIN) exigent une validation serveur ; le cash non. Les actions rejetées définitivement (4xx) sont retirées de la file au lieu d'être rejouées à l'infini.
- Réversible : oui.

**D7 ⚠ — Carte Souk.AI : pas de nouvelle fonctionnalité, plafond 10 000 MAD / 24 h / marchand en recharge**
- Alternatives : désactiver la carte ; la laisser telle quelle.
- Raison : risque réglementaire (établissement de paiement / monnaie électronique, voir RESEARCH §1) et faille de création de monnaie (S4). Le plafond limite l'exposition sans casser l'usage existant.
- Réversible : constante `MERCHANT_DAILY_TOPUP_CAP`. **À décider** : partenaire agréé (Cash Plus, M2T…) ou abandon.

**D8 — Prévision : modèle statistique amorti plutôt que ML**
- Alternatives : Prophet, LightGBM, Croston.
- Raison : ~30 points par produit, données rares ; le backtest montre un gain de 6 % (et 37 % en démarrage à froid) sans dépendance ni coût d'infra. Croston serait le prochain candidat pour les produits très lents.
- Réversible : fonction pure unique `forecast_from_history`, testée.

**D9 — Pays/devise/fuseau sur le marchand + profils pays en code (`core/locale.py`)**
- Alternatives : table `countries` en base ; dépendance `phonenumbers`.
- Raison : 14 pays tiennent en 20 lignes lisibles ; pas de nouvelle dépendance. `phonenumbers` deviendra utile au-delà de ~20 pays ou pour la validation stricte.
- Réversible : oui.

**D10 — Ruff limité aux règles de correction (E4/E7/E9/F)**
- Raison : 0 erreur et une CI verte aujourd'hui ; les 335 corrections de style (imports, `UP`) toucheraient tous les fichiers et noieraient la revue. À faire dans un commit dédié.

**D11 — Secrets : retirés de l'arbre, historique NON réécrit**
- Raison : consigne explicite (pas de réécriture d'historique). Les secrets restent dans l'historique git : **rotation obligatoire** (REPORT.md).

**D12 — Pas de refonte visuelle globale (design system, dark mode)**
- Raison : 38 pages ; une refonte non testée visuellement (extension Chrome indisponible, voir BLOCKERS) risquait des régressions. Priorité donnée à l'intégrité de l'argent, à la vitesse (bundle −68 %) et au rapport « argent ».
