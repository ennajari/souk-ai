# BLOCKERS — rencontrés pendant la session autonome

| # | Blocage | Contournement | Reste à faire |
|---|---|---|---|
| B1 | **Secrets dans l'historique git** (mot de passe SSH du VPS, tokens WhatsApp, app secret, `.env` dans `souk-ai.tar.gz`). Réécrire l'historique est interdit par la consigne. | Retirés de l'arbre et ignorés (commit `7b4744c`). Le fichier `souk-ai.tar.gz` est toujours sur ton disque, non suivi. | **Rotation immédiate** de chaque secret, puis purge d'historique (`git filter-repo`) et force-push décidés par toi. Voir REPORT.md. |
| B2 | Extension Claude in Chrome non connectée : impossible de piloter ton navigateur. | Playwright en headless avec le Chrome système (`channel: 'chrome'`), sans téléchargement. Captures dans `docs/screenshots/`. | Aucun. |
| B3 | `@playwright/test@1.49.1` ne chargeait aucun test sous Node 24 (sortie vide). | Montée en 1.55.0. | Aucun. |
| B4 | Stack complète (`docker compose up`, avec TimescaleDB, Weaviate, Celery, cloudflared) non lancée : trop lourde et le tunnel exige un token. | API + front lancés localement sur Postgres 16 et Redis jetables (mêmes migrations). | Vérifier `make up` sur une machine avec `.env` réel. Weaviate n'expose plus de port hôte (voulu). |
| B5 | Aucun appel réel OpenAI/WhatsApp (consigne). | Envoi WhatsApp désactivé si non configuré ; tests sans clés. | Tester bot/OCR sur un environnement de staging. |
| B6 | Cadre légal de la carte Souk.AI (monnaie électronique / établissement de paiement) et calendrier e-facture DGI : non tranchés par les sources trouvées. | Plafond de recharge + traçabilité ; décision documentée (D7). | Avis juridique (RESEARCH §1-2). |
| B7 | `react-router` : 2 vulnérabilités modérées, corrigées seulement en v7 (version majeure). | Non mis à jour pour éviter une régression non testée sur 38 routes. | Migration v7 dans un commit dédié. |
