# RESEARCH — sources, ce qu'on en retient, décision

Règle : rien de non vérifié n'est présenté comme un fait. Les points marqués **[à vérifier]** reposent sur des
sources secondaires (éditeurs de logiciels, presse) ou sur mes connaissances antérieures et doivent être
confirmés sur un texte officiel avant d'être utilisés commercialement.

## 1. Carte Souk.AI = monnaie électronique / établissement de paiement (Maroc)

- Sources : [Bank Al-Maghrib — Systèmes et moyens de paiement](https://www.bkam.ma/ar/switch/to/fre-FR/14525) ;
  [La Vie Éco — premiers agréments](https://www.lavieeco.com/?p=121179) ;
  [FNH — BAM officialise les premiers agréments](https://fnh.ma/article/actualite-financiere-maroc/etablissements-de-paiement-bam-officialise-les-premiers-agrements) ;
  [Mondaq — Banking regulation comparative guide](https://www.mondaq.com/finance/1085608/banking-regulation-comparative-guide) ;
  [Loi 103-12 (texte, adala.justice.gov.ma)](https://adala.justice.gov.ma/api/uploads/2024/03/15/loi%20relative%20aux%20etablissements%20de%20credit%20et%20organismes%20assimiles-1710514746601.pdf).
- Retenu : la loi 103-12 a créé les « établissements de paiement », soumis à **agrément** du gouverneur de BAM
  (premiers agréments en 2018 : Wafacash, Cash Plus, M2T, NAPS…). BAM plafonne les soldes des comptes de paiement.
  Le cadre précis de la monnaie électronique n'a pas été trouvé dans les résultats **[à vérifier sur bkam.ma]**.
- Décision : une carte prépayée **multi-commerçants**, rechargée en espèces chez un marchand et dépensée chez un
  autre, ressemble fonctionnellement à un service de paiement. Ne pas l'étendre sans avis juridique ; viser un
  partenariat avec un établissement agréé (DECISIONS D7). Dans le code : plafond de recharge 24 h par marchand
  et traçabilité du marchand receveur (AUDIT S4, K1).

## 2. Facturation électronique — Maroc (DGI)

- Sources : [Medias24, 16/04/2026 — DGI, lancement en préparation](https://medias24.com/2026/04/16/dgi-facturation-electronique-lancement-en-preparation-les-details-avec-younes-idrissi-kaitouni-1660967/) ;
  [Upsilon Consulting](https://upsilon-consulting.com/facturation-electronique-maroc-2026/) ;
  [Inyad — calendrier](https://inyad.com/blog/calendrier-obligation-facturation-electronique-maroc) ;
  [EDICOM — format UBL](https://edicomgroup.com/fr/blog/maroc-obligation-facturation-electronique) ;
  [ClicPaie (mise en garde)](https://clicpaie.ma/blogs/facture-electronique-maroc/).
- Retenu : obligation annoncée par la DGI pour 2026, en préparation en avril 2026 ; dates par catégorie et
  format (UBL cité par un éditeur) **[à vérifier : décret d'application / BO]**.
- Décision : ne pas coder de format DGI maintenant. Les factures restent PDF ; l'export de données (JSON) et un
  futur export UBL sont listés en roadmap 60 j. Garder la ventilation TVA par ligne comme prérequis (AUDIT I3).

## 3. Facturation électronique — France (cible Europe)

- Sources : [Cegid — calendrier](https://www.cegid.com/fr/facturation-electronique/facture-electronique-obligatoire/calendrier-facture-electronique/) ;
  [Abby — dates](https://abby.fr/guide/facturation-electronique/facturation-electronique-date) ;
  [Keobiz](https://www.keobiz.fr/le-mag/facturation-electronique-calendrier-2026-2027/) ;
  [B2Brouter](https://www.b2brouter.net/fr/facture-electronique-calendrier/).
- Retenu (sources éditeurs, cohérentes entre elles) : **réception** obligatoire pour toutes les entreprises
  assujetties depuis le 1er sept. 2026 ; **émission** et e-reporting pour PME/TPE au 1er sept. 2027
  **[à vérifier sur impots.gouv.fr]**. Le B2C caisse relève de l'e-reporting, pas de la facture.
- Décision : pour la France, Souk.AI doit (a) passer par une plateforme agréée (PA) plutôt que d'en devenir une,
  (b) traiter la conformité caisse (NF525 / inaltérabilité des ventes) **avant** de vendre en France — AUDIT K5.
  Les ventes sont aujourd'hui modifiables ; la roadmap prévoit un journal chaîné (hash) des tickets.

## 4. WhatsApp Business — fenêtre 24 h, templates, opt-in

- Sources : [Bird — customer service window](https://bird.com/docs/knowledge-base/whatsapp/customer-service-window) ;
  [Courier — message types](https://www.courier.com/guides/whatsapp-message-types) ;
  [Rasayel — messaging policy](https://learn.rasayel.io/en/books/whatsapp/whatsapp-business/whatsapp-business-messaging-policy) ;
  [WhatsApp Business policy (Meta)](https://whatsappbusiness.com/policy/?product=marketing).
- Retenu : texte libre seulement dans les 24 h suivant le dernier message du client ; hors fenêtre, uniquement des
  templates approuvés **et** après opt-in du destinataire. La tarification a changé en 2025-2026 (sources
  divergentes) **[à vérifier sur la grille Meta]**.
- Décision : le rappel « karni » automatique quotidien en texte libre (`workers/tasks.py:1650`) échoue hors
  fenêtre et contacte des clients finaux qui n'ont pas donné d'opt-in → AUDIT L10. Recommandation : opt-in
  explicite enregistré sur la fiche client + template utilitaire + fréquence max hebdomadaire. Le reçu de crédit
  (template d'abord, texte ensuite) est conservé, mais envoyé en tâche de fond.

## 5. Taux de TVA par pays (profils `backend/core/locale.py`)

- Valeurs saisies depuis mes connaissances, **non revérifiées pendant cette session [à vérifier]** :
  MA 20/14/10/7 ; FR 20/10/5,5/2,1 ; BE 21/12/6 ; ES 21/10/4 ; DE 19/7 ; IT 22/10/5/4 ; NL 21/9 ; GB 20/5/0 ;
  DZ 19/9 ; TN 19/13/7 ; SN 18/10 ; CI 18/9 ; US : pas de TVA fédérale (sales tax par État/comté) ; CA : GST 5 % + provinces.
- Décision : les taux sont des **valeurs par défaut modifiables**, jamais calculées en dur sur une facture sans
  validation par le marchand. Pour les US, s'appuyer sur un moteur tiers (Stripe Tax / TaxJar / Avalara) plutôt
  que maintenir des milliers de juridictions.

## 6. Prévision — méthode d'évaluation

- Référence méthodologique (connaissances générales, pas de source consultée en session) : comparer à des
  baselines naïves (moyenne mobile, naïf saisonnier) avec une métrique pondérée (WAPE) robuste aux jours à zéro,
  contrairement au MAPE.
- Décision : backtest en origine glissante intégré aux tests (`backend/tests/test_forecasting.py`) ; le modèle
  doit battre la moyenne 7 j d'au moins 15 % en WAPE pour passer la CI.
