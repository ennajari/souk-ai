# Souk.AI — Stratégie produit

> Positionnement en une phrase : **« La caisse qui vous dit où est votre argent. »**
> Les POS sérieux (Square, Toast, Shopify POS, Lightspeed, Odoo) vendent un *encaissement* ; les carnets
> numériques (Khatabook, OkCredit) vendent un *registre de dettes*. Souk.AI vend une *réponse* :
> combien vous avez perdu cette semaine, combien on vous doit, quoi recommander demain, et l'action à faire.

Les comparaisons concurrentielles ci-dessous viennent de connaissances générales du marché, pas d'une étude
menée pendant cette session : à valider avant un pitch (voir RESEARCH.md).

## 1. Personas

| Persona | Contexte | Douleur n°1 | Ce qui le fait payer |
|---|---|---|---|
| **Si Mohamed, épicier de quartier (Casablanca)** | 300-800 réf., 40 % des clients « à crédit », smartphone Android d'entrée de gamme, 3G instable, parle darija | Le carnet : il oublie qui lui doit quoi, il n'ose pas relancer | Récupérer l'argent du carnet + savoir quoi commander |
| **Priya / Carlos, supérette ou « ethnic store » (New Jersey, Houston)** | 2 000 réf., sales tax par État, cartes bancaires, staff tournant | Ruptures et périmés sur produits importés à rotation lente ; temps passé aux commandes | Moins de casse, commandes fournisseurs préparées automatiquement |
| **Sophie, petit restaurant / traiteur (Lyon, Bruxelles)** | Ingrédients périssables, obligations fiscales lourdes (caisse certifiée, e-facture 2026-27) | Gaspillage et conformité | Anti-gaspillage + conformité « clé en main » via partenaires |
| **Hassan, distributeur/fournisseur** | Livre 150 épiceries, commandes par téléphone/WhatsApp | Commandes imprévisibles, impayés | Commandes agrégées prévisibles + visibilité sur la demande de ses clients |

## 2. Proposition de valeur par marché

| Marché | Offre | Pourquoi ça marche | Prérequis avant de vendre |
|---|---|---|---|
| **Maroc / Afrique du Nord** | Caisse + carnet + WhatsApp darija + prévisions | Le carnet et WhatsApp sont des usages existants ; darija = barrière à l'entrée pour les concurrents | Statut juridique de la carte Souk.AI (partenaire agréé BAM) ; e-facture DGI quand le décret sera publié |
| **Afrique de l'Ouest (SN, CI)** | Même offre, FR, XOF | Mêmes usages (crédit informel, WhatsApp, mobile money) | Intégration mobile money (Wave, Orange Money) via un PSP |
| **Europe (FR, BE, ES, DE)** | « Anti-gaspillage & réassort » pour supérettes et restaurants, branché sur la caisse existante ou la nôtre | La valeur = moins de pertes, pas l'encaissement (marché saturé) | NF525 (FR) / TSE (DE) pour encaisser ; sinon vendre en *add-on* au-dessus d'un POS certifié via import des ventes (Sage, CSV, API) |
| **États-Unis** | Add-on « where is my money » pour indépendants et ethnic/halal stores, multilingue (AR/FR/ES/EN) | Communautés mal servies dans leur langue ; vrai problème de ruptures sur produits importés | Sales tax via Stripe Tax/TaxJar ; paiements via Stripe Terminal/Square ; CCPA |

**Comment le produit « marche » hors Maroc dès aujourd'hui** (fait sur cette branche) : devise, pays et fuseau
par marchand ; numéros internationaux (E.164) ; profils TVA pour 14 pays ; interface anglaise ; montants formatés
par `Intl` dans la devise du marchand ; rapport « argent » indépendant de toute réglementation locale.
**Ce qui manque** : ventilation fiscale sur ticket/facture, moyens de paiement locaux via un PSP, certification
de caisse (FR/DE), traduction des 26 pages encore codées en français.

## 3. Trois différenciateurs défendables

1. **Le rapport « Où est votre argent ? » comme écran d'accueil** : créances, périmés, invendus, marge manquée,
   chacun relié à une action (relancer, solder, recommander). Défendable parce qu'il exige *à la fois* la caisse,
   le stock, les dates d'expiration et le carnet dans la même base, ce qu'aucun carnet seul ni aucun POS seul n'a.
2. **WhatsApp-first en langue locale (darija/arabe/français/anglais)** : le commerçant gère prix, ventes et
   rapports depuis WhatsApp. Défendable par les données d'entraînement (alias de produits locaux, darija) et les
   templates approuvés.
3. **Réseau fournisseurs ↔ commerçants** : chaque épicerie qui prévoit sa demande alimente la prévision agrégée
   du fournisseur (`services/supplier_aggregation.py`). Effet de réseau : plus il y a de commerçants, plus
   l'offre fournisseur est utile, et inversement.

## 4. Pricing suggéré (hypothèses à tester)

| Plan | Maroc / Afrique | Europe / US | Contenu |
|---|---|---|---|
| **Gratuit** | 0 | 0 | Caisse, 100 produits, carnet 20 clients, rapport « argent » hebdo |
| **Pro** | 99 MAD / mois | 29 € / 29 $ par mois | Illimité, prévisions + réassort, WhatsApp IA, multi-appareils, export comptable |
| **Business** | 249 MAD / mois | 79 € / 79 $ | Multi-boutiques, employés & rôles, portail fournisseur, API |
| **Fournisseur** | % sur commandes (1-2 %) ou 499 MAD / mois | sur devis | Commandes agrégées, catalogue, paiements |

Logique : le plan payant doit coûter moins qu'**une semaine de pertes évitées** (l'écran « argent » le montre).
Les frais WhatsApp/OpenAI par marchand sont plafonnés côté code (limites d'appel) pour protéger la marge.

## 5. KPIs d'impact (mesurés dans le produit)

| KPI | Définition | Source dans l'app | Cible 90 j (hypothèse) |
|---|---|---|---|
| Pertes de stock évitées | Valeur au coût des périmés, mois N vs mois 1 | `money-report.lost` | −30 % |
| Créances recouvrées | Paiements carnet / créances ouvertes début de mois | `credit_entries` | +20 pts |
| Ruptures sur best-sellers | Marge manquée / semaine | `money-report.missed_sales_per_week` | −40 % |
| Marge brute | (prix − coût) / prix sur ventes | `/analytics/profit` | +2 pts |
| Temps de vente | Taps et secondes par vente | e2e : 2 taps, 0,5 s (local) | ≤ 3 taps, < 5 s en 3G |
| Activation | Inscription → 1re vente | e2e : inscription → tableau de bord 1,9 s | 1re vente < 5 min |
| Précision prévision | WAPE 7 j vs moyenne naïve | `tests/test_forecasting.py` | ≥ 15 % meilleur que naïf (CI) |

## 6. Roadmap 30 / 60 / 90 jours

**J+30 — Confiance & pilote**
- Rotation de tous les secrets exposés, purge de l'historique git, déploiement de cette branche (REPORT §Actions).
- Opt-in client pour les rappels WhatsApp + template utilitaire hebdomadaire (AUDIT L10).
- 10 épiceries pilotes à Casablanca : mesurer les KPIs ci-dessus depuis l'écran « argent ».
- Refresh tokens + SSE sans jeton dans l'URL (S9, S16).

**J+60 — Prêt pour un 2e marché**
- Taux de TVA par produit + ventilation sur ticket et facture ; export comptable (CSV/FEC, UBL pour la DGI quand le décret sera publié).
- Traduction des 26 pages restantes (EN complet, ES) ; design tokens + mode sombre.
- PSP unique (Stripe / CMI / mobile money) derrière une interface `PaymentProvider`.
- Décision carte Souk.AI : partenaire agréé ou retrait.

**J+90 — Europe / US en add-on**
- Import des ventes depuis les POS existants (CSV/API) pour vendre l'anti-gaspillage sans certification de caisse.
- Journal de tickets chaîné (hash) : première étape vers NF525/TSE.
- Réassort automatique envoyé au fournisseur (WhatsApp/portail) avec la quantité prévue et son explication.
