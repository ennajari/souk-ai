# Configuration WhatsApp Business API

## Etape 1: Creer un compte Meta Business

1. Allez sur https://business.facebook.com
2. Cliquez "Creer un compte"
3. Remplissez les informations de votre entreprise
4. Verifiez votre email

## Etape 2: Creer une App Meta

1. Allez sur https://developers.facebook.com
2. Cliquez "Mes applications" > "Creer une application"
3. Choisissez "Business" comme type
4. Donnez un nom (ex: "Souk AI WhatsApp")
5. Selectionnez votre compte Business

## Etape 3: Ajouter WhatsApp a l'App

1. Dans le dashboard de votre app, trouvez "WhatsApp" et cliquez "Configurer"
2. Suivez l'assistant de configuration
3. Vous obtiendrez:
   - **Phone Number ID** (WHATSAPP_PHONE_NUMBER_ID)
   - **Access Token temporaire** (WHATSAPP_ACCESS_TOKEN)

## Etape 4: Configurer le Webhook

1. Dans les parametres WhatsApp de votre app:
   - URL du webhook: `https://votre-domaine.com/api/v1/whatsapp/webhook`
   - Token de verification: mettez la meme valeur que `WHATSAPP_VERIFY_TOKEN` dans votre `.env`
2. Abonnez-vous aux evenements: `messages`

## Etape 5: Generer un Access Token permanent

1. Allez dans "Parametres systeme" de votre compte Business
2. Creez un utilisateur systeme
3. Generez un token avec les permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
4. Copiez ce token dans votre `.env` comme `WHATSAPP_ACCESS_TOKEN`

## Etape 6: Obtenir l'App Secret

1. Dans les parametres de votre app Meta > "Parametres de base"
2. Copiez le "Cle secrete" (App Secret)
3. Mettez-le dans `.env` comme `WHATSAPP_APP_SECRET`

## Etape 7: Ajouter un numero de telephone

Pour la production, vous devez:
1. Ajouter un vrai numero de telephone dans la configuration WhatsApp
2. Verifier le numero par SMS ou appel
3. Soumettre votre app pour revue Meta

## Variables d'environnement finales

```env
WHATSAPP_ACCESS_TOKEN=EAAxxxxx...     # Token permanent
WHATSAPP_PHONE_NUMBER_ID=123456789    # ID du numero
WHATSAPP_VERIFY_TOKEN=mon_token_secret # Votre token custom
WHATSAPP_APP_SECRET=abcdef123456      # App Secret
```

## Test en developpement

Pendant le developpement, vous pouvez:
1. Utiliser le numero de test fourni par Meta
2. Envoyer des messages uniquement aux numeros ajoutes comme "testeurs"
3. Ajouter des testeurs dans: App > Roles > Testeurs

### Tester avec curl

```bash
# Envoyer un message test
curl -X POST "https://graph.facebook.com/v21.0/PHONE_NUMBER_ID/messages" \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "212612345678",
    "type": "text",
    "text": {"body": "Test Souk.AI"}
  }'
```

## Limites et tarification

- **1000 conversations gratuites/mois** (initiees par le business)
- Les conversations initiees par l'utilisateur sont facturees differemment
- Voir: https://developers.facebook.com/docs/whatsapp/pricing
