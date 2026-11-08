# REPORT — résumé exécutif (branche `audit/world-class`)

**Constat.** Le produit est riche (22 modules) mais n'était pas prêt pour de vrais clients : **aucun test**, CI vide,
et plusieurs failles **critiques** exploitables sans compétence particulière. N'importe qui pouvait devenir admin
(email non vérifié), réinitialiser le mot de passe d'un compte (OTP sans limite d'essais), créer de l'argent sur
les cartes Souk.AI, payer jusqu'à 50 MAD avec la carte d'un autre en connaissant son téléphone, ou marquer
lui-même une facture comme payée. Il y avait aussi des **secrets en clair** dans le dépôt (mot de passe SSH du
VPS, tokens WhatsApp, `.env` dans une archive). Côté métier, une vente carte ou crédit pouvait laisser un client
débité sans vente, ou de la marchandise sortie sans dette ; les quantités négatives créaient du stock.

**Corrigé / ajouté** (18 commits atomiques, chacun relié à un constat d'AUDIT.md) :

| Mesure | Avant | Après |
|---|---|---|
| Tests automatisés | 0 | **44** intégration (Postgres migré + Redis) + **2** e2e Playwright |
| CI | vide | lint, tests, aller-retour migration, pip-audit, bandit, build, npm audit, e2e |
| Failles critiques/hautes de sécurité (AUDIT S1-S12) | 12 ouvertes | **11 corrigées dans le code** ; S1 (secrets) exige une rotation manuelle |
| Vulnérabilités Python (pip-audit) | 17 | **0** |
| Vulnérabilités npm | 16 (9 hautes) | **2 modérées** (react-router, majeure v7) |
| Erreurs ruff, règles de correction (E4/E7/E9/F) | 20 (dont 5 faux positifs SQLAlchemy) | **0** |
| Bandit medium/high | 0 | 0 (le `random` de l'OTP est remplacé) |
| JS initial | 1 234 kB (324 kB gzip) | **393 kB (126 kB gzip)**, −68 % |
| Vente au POS (e2e, local) | non mesurée | **2 taps, confirmée en ~0,5 s** |
| Inscription → tableau de bord (e2e, local) | non mesurée | **~1,9 s** |
| Prévision, WAPE 7 j (backtest synthétique) | 0,218 (naïf : 0,266) | **0,205** ; démarrage à froid 0,51 → **0,32** |
| Langues | FR, AR | FR, AR (RTL partout), **EN** |
| Marchés | Maroc en dur | devise/pays/fuseau par marchand, 14 profils pays |

Les nouveautés pour les commerçants : écran **« Où est votre argent ? »** (créances, périmés, invendus, marge
perdue par rupture), **ventes en espèces hors ligne**, encaissement en **une seule requête atomique**, badge
« périmé » en caisse, **export de ses données** et suppression de compte réparée.

**Reste à faire, par priorité**
1. **P0** : rotation des secrets + purge de l'historique (voir ci-dessous) ; déployer la migration avec `ADMIN_PHONE`.
2. **P0** : décision juridique sur la carte Souk.AI (établissement de paiement agréé ?), RESEARCH §1.
3. **P1** : opt-in + template pour les rappels « karni » (risque de blocage du numéro WhatsApp) ; refresh tokens ; SSE sans jeton en URL.
4. **P1** : TVA par produit et ventilation sur ticket/facture ; traduction des 26 pages encore en français.
5. **P2** : NF525/TSE avant toute vente de la caisse en France/Allemagne ; design tokens + mode sombre ; découpage de `workers/tasks.py`.

**Risques restants** : secrets toujours présents dans l'historique git ; carte prépayée sans cadre réglementaire ;
JWT en `localStorage` (vol en cas de XSS) ; cache du service worker contenant des réponses API après déconnexion ;
stack complète (Timescale, Weaviate, Celery) non lancée pendant la session (API et front testés sur Postgres 16
+ Redis) ; taux de TVA saisis de mémoire, à revérifier.

## Actions manuelles requises (toi)
1. **Changer le mot de passe SSH du VPS** (il est dans l'historique de `deploy.py`) et passer en authentification par clé ; désactiver le login par mot de passe.
2. **Révoquer et régénérer** : token WhatsApp (Meta Business → System User), `WHATSAPP_APP_SECRET`, et **tous** les secrets du `.env` contenu dans `souk-ai.tar.gz` (Postgres, `SECRET_KEY`, OpenAI, Cloudflare tunnel…). Changer `SECRET_KEY` déconnecte tout le monde : c'est voulu.
3. Purger l'historique (`git filter-repo --path souk-ai.tar.gz --invert-paths` + remplacement des chaînes secrètes), puis force-push **après** avoir prévenu les collaborateurs. Si le dépôt a été public, considérer les secrets comme compromis.
4. Déployer avec `APP_ENV=production`, `WHATSAPP_APP_SECRET` et `CMI_STORE_KEY` renseignés (sinon les webhooks sont refusés), et `ADMIN_PHONE` défini au moment de `alembic upgrade head`.

## Les 5 prochaines actions recommandées
1. Faire les 4 actions manuelles ci-dessus, puis relire et merger `audit/world-class` (CI verte requise).
2. Lancer un pilote de 10 épiceries et suivre les KPIs de l'écran « argent » (STRATEGY §5).
3. Obtenir un avis juridique sur la carte Souk.AI et choisir : partenaire agréé ou retrait.
4. Mettre les rappels WhatsApp en conformité (opt-in, template utilitaire, fréquence hebdomadaire).
5. Ajouter TVA par produit + traduction complète EN, prérequis pour un 2e marché.
