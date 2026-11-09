# Souk.AI — Identité de marque

> **Promesse** : « La caisse qui vous dit où est votre argent. »
> **Personnalité** : chaleureuse, directe, digne de confiance — le bon voisin commerçant qui sait compter.

## Le logo

| Fichier | Usage |
|---|---|
| `frontend/public/logo-icon.svg` | Icône principale (app, favicon, avatar réseaux sociaux) |
| `frontend/public/logo.svg` / `logo.png` | Logo horizontal icône + nom (en-têtes, documents, slides) |
| `frontend/public/logo-mono.svg` | Une couleur (`currentColor`) : tickets imprimés, tampons, fax, broderie |
| `logo-icon-192/512.png`, `logo-icon-maskable-512.png`, `apple-touch-icon.png` | Icônes d'application installée (Android, iOS) |
| `frontend/src/components/BrandMark.jsx` | Le logo dans l'interface (SVG inline, net à toutes les tailles) |

**Ce qu'il raconte.** Une **arche en fer à cheval** — la porte (*bab*) des souks et des médinas : l'entrée de
la boutique. Au centre, une **étoile à huit branches** (*khatam*), motif fondateur du zellige. Ensemble : votre
commerce, ouvert, avec une intelligence au cœur. Le dessin est géométrique et sans texte pour rester
reconnaissable de 16 px (onglet du navigateur) à une enseigne.

**Règles d'usage**
- Taille minimale : 16 px pour l'icône, 96 px de large pour le logo horizontal.
- Zone de protection : un espace vide d'au moins ¼ de la largeur de l'icône tout autour.
- Fond : sable, blanc ou encre. Sur une photo, utiliser l'icône seule (carré terracotta) ou la version mono.
- Interdits : déformer, faire pivoter, changer les couleurs de l'arche ou de l'étoile, ajouter une ombre,
  remettre l'ancienne lettre « S » ou l'ancien réseau neuronal vert.

## Couleurs (tokens Tailwind : `frontend/tailwind.config.js`)

| Token | Hex | Rôle | Contraste |
|---|---|---|---|
| `brand-600` Terracotta | `#C2410C` | Actions principales, marque, liens | blanc dessus 5,2:1 · sur blanc 5,2:1 (AA) |
| `brand-700` | `#9A3412` | Survol, dégradés | |
| `mint-300` | `#5EEAD4` | Étoile du logo, accents décoratifs sur fond sombre | décoratif uniquement |
| `mint-700` Menthe | `#0F766E` | Accent secondaire, argent positif | sur blanc 5,5:1 (AA) |
| `sand-100` Sable | `#FAF7F2` | Fond des pages | |
| `ink-900` Encre | `#1C1917` | Texte | sur sable 16,4:1 |
| `ink-950` | `#0F0D0C` | Surfaces sombres (barre latérale, pages d'accueil) | |

Règles : le texte courant n'utilise jamais un gris plus clair que `gray-500` (4,5:1 sur sable). Les couleurs
sémantiques (vert = encaissé, rouge = perte/erreur, ambre = attention) restent celles de Tailwind. Dans les
graphiques, une teinte différente par catégorie, jamais deux nuances de la même couleur côte à côte.

## Typographie
- **Inter** (latin) et **IBM Plex Sans Arabic** (arabe, darija), toutes deux open source (SIL OFL).
- Titres 800, texte 400-500, chiffres en `tabular-nums` pour que les montants s'alignent.

## Ton
- Parler d'argent concret : « 119 MAD à récupérer », pas « optimisez votre trésorerie ».
- Tutoiement en darija, vouvoiement en français, phrases courtes, un verbe d'action par bouton.
- Ne jamais afficher un chiffre de traction, un avis ou un témoignage qui n'est pas réel et vérifiable.

## Sources consultées
[Visualize Value — logo qui « casse » avant l'entreprise](https://www.visualizevalue.com/blog/your-logo-should-break-before-your-business-does) ·
[4over4 — 6 principes de logo](https://mapp.4over4.com/guide/6-key-principles-of-logo-design) ·
[Zillion Designs — favicons](https://www.zilliondesigns.com/blog/?p=34733) ·
[UX Journal — principes de design POS](https://medium.com/uxjournal/the-design-principles-in-the-pos-system-pos-design-guide-part-2-57d1bcb30ac0) ·
[Square — accélérer l'encaissement](https://squareup.com/gb/en/the-bottom-line/growing-your-team/ring-people-up-faster-6-ways-to-improve-your-checkout-speed).
Retenu : lisibilité à 16 px, test en une couleur, règles d'usage écrites ; en caisse, chaque étape en trop se
répète des milliers de fois, d'où gros boutons et le moins d'écrans possible.
