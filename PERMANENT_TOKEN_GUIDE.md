# Guide: Token WhatsApp Permanent pour Souk.AI

## Probleme
Le token genere depuis "Test de l'API" expire apres **60 minutes**.
Pour la production, vous avez besoin d'un token **sans expiration**.

---

## Solution: System User Token (Recommande)

### Etape 1: Creer un System User dans Meta Business Suite

1. Allez sur **[business.facebook.com](https://business.facebook.com)**
2. Dans le menu gauche: **Parametres** > **Utilisateurs** > **Utilisateurs systeme**
3. Cliquez **"Ajouter"**
4. Nom: `souk-ai-bot`, Role: **Administrateur**
5. Cliquez **"Creer un utilisateur systeme"**

### Etape 2: Attribuer l'application a l'utilisateur systeme

1. Sur la page de l'utilisateur systeme cree
2. Cliquez **"Attribuer des actifs"**
3. Selectionnez **"Applications"** dans le menu
4. Trouvez votre app **Souk.AI**
5. Activez la permission **"Controle total"**
6. Cliquez **"Enregistrer les modifications"**

### Etape 3: Generer le token permanent

1. Sur la page de l'utilisateur systeme
2. Cliquez **"Generer un token"**
3. Selectionnez votre app **Souk.AI**
4. Permissions requises:
   - `whatsapp_business_messaging` ✓
   - `whatsapp_business_management` ✓
5. **Ne definissez PAS de date d'expiration** (laissez "Jamais")
6. Cliquez **"Generer le token"**
7. **COPIEZ ET SAUVEGARDEZ le token** (il ne sera affiche qu'une fois!)

### Etape 4: Mettre a jour le VPS

```bash
# Sur votre VPS:
ssh ubuntu@<VPS_IP>
cd /home/ubuntu/souk-ai
bash scripts/update-whatsapp-token.sh
```

---

## Alternative: Token via App Access Token

Si vous ne pouvez pas creer de System User (compte restreint):

```bash
# Remplacez APP_ID et APP_SECRET par vos valeurs Meta
APP_ID="votre_app_id"
APP_SECRET="votre_app_secret"

curl -X GET \
  "https://graph.facebook.com/oauth/access_token?client_id=${APP_ID}&client_secret=${APP_SECRET}&grant_type=client_credentials"
```

Ce token n'expire pas mais a acces limite (pas d'envoi de messages).

---

## Probleme: Compte WhatsApp Restreint

Votre compte affiche "Compte restreint" car:
- Le numero `+212 655 798315` etait un compte WhatsApp personnel
- Meta a detecte une violation des regles commerciales

### Solution:
1. Allez sur [business.facebook.com](https://business.facebook.com)
2. **Parametres** > **Informations sur le compte**
3. Verifiez si un appel est possible pour debloquer
4. Ou soumettez un appel: **Aide** > **Assistance**
5. Expliquez que vous avez supprime le compte personnel et souhaitez utiliser ce numero pour votre business

### Si le deblocage est impossible:
- Utilisez le **numero test Meta** (`+1 555 158 8048`) pour les demos
- Ajoutez votre numero comme destinataire dans "Test de l'API"
- Achetez un nouveau numero SIM exclusivement pour le business

---

## URL Webhook Permanente

Pour une URL HTTPS permanente sans domaine:

```bash
# Sur le VPS, executer UNE FOIS:
bash scripts/setup-permanent-tunnel.sh
```

Cela configure ngrok avec un domaine statique gratuit qui ne change jamais.

**URL finale:** `https://votre-domaine.ngrok-free.app/api/v1/whatsapp/webhook`

---

## Verification finale

```bash
# Verifier que tout fonctionne:
docker compose logs -f celery --tail=20

# Envoyer un message test WhatsApp et verifier les logs
```
