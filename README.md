# 🏗️ Architecture Documentation

## 📋 Table des Matières

- [Architecture MVP](#architecture-mvp)
- [Architecture Complète](#architecture-complète)
- [Flux de Traitement des Messages](#flux-de-traitement-des-messages)
- [Modèle de Données](#modèle-de-données)
- [Pipeline CI/CD](#pipeline-cicd)
- [Machine d'État Conversationnelle](#machine-détat-conversationnelle)
- [Stratégie de Scalabilité](#stratégie-de-scalabilité)
- [Architecture de Sécurité](#architecture-de-sécurité)

---

## 🚀 Architecture MVP

Cette architecture représente la phase initiale du projet (Mois 1-3), conçue pour un déploiement rapide et efficace.

```mermaid
flowchart TB
    subgraph MVP["🚀 MVP Architecture (Month 1-3)"]
        direction TB
        
        subgraph Entry["Entry Points"]
            WH["POST /webhook/whatsapp<br/>Incoming Messages"]
            CRON["Cron Jobs<br/>Daily Alerts"]
        end
        
        subgraph Core["Core Services"]
            direction LR
            MSG["MessageHandler<br/>parse_message()"]
            AI["AIEngine<br/>process_intent()"]
            INV["InventoryService<br/>update_stock()"]
            NOTIFY["NotificationService<br/>send_alert()"]
        end
        
        subgraph Storage["Data Storage"]
            direction LR
            DB[("PostgreSQL<br/>merchants, products,<br/>transactions")]
            CACHE[("Redis<br/>sessions,<br/>rate limits")]
        end
        
        subgraph External["External APIs"]
            direction LR
            WHISPER["Whisper API<br/>transcribe()"]
            CLAUDE["Claude API<br/>chat()"]
            WAPI["WhatsApp API<br/>send_message()"]
        end
    end
    
    WH --> MSG
    MSG --> AI
    AI --> WHISPER
    AI --> CLAUDE
    AI --> INV
    INV --> DB
    INV --> CACHE
    INV --> NOTIFY
    NOTIFY --> WAPI
    CRON --> INV
    
    style MVP fill:#f0f4f8
    style Entry fill:#e3f2fd
    style Core fill:#e8f5e9
    style Storage fill:#fff3e0
    style External fill:#fce4ec
```

### Composants Principaux

- **Entry Points** : Points d'entrée pour les messages WhatsApp et les tâches planifiées
- **Core Services** : Services métier essentiels pour le traitement des messages et la gestion de l'inventaire
- **Data Storage** : Base de données PostgreSQL et cache Redis
- **External APIs** : Intégrations avec Whisper, Claude et WhatsApp

---

## 🏛️ Architecture Complète

Architecture de production scalable et hautement disponible.

```mermaid
flowchart TB
    subgraph Client["Client Layer"]
        WA["📱 WhatsApp<br/>90%+ users"]
        WEB["💻 Web Dashboard<br/>Suppliers/Admins"]
        MOB["📲 Future: Mobile App"]
    end
    
    subgraph Edge["Edge / CDN"]
        CF["CloudFlare<br/>DDoS Protection<br/>SSL Termination"]
    end
    
    subgraph LB["Load Balancing"]
        ALB["AWS ALB / Nginx<br/>Round Robin<br/>Health Checks"]
    end
    
    subgraph API["API Layer (Stateless)"]
        API1["FastAPI Pod 1"]
        API2["FastAPI Pod 2"]
        API3["FastAPI Pod N"]
    end
    
    subgraph Queue["Message Queue"]
        RMQ["RabbitMQ / Redis Streams<br/>- message_processing<br/>- order_processing<br/>- notifications"]
    end
    
    subgraph Workers["Worker Layer (Async)"]
        W1["Worker 1<br/>Message Processing"]
        W2["Worker 2<br/>ML Inference"]
        W3["Worker 3<br/>Notifications"]
    end
    
    subgraph AI["AI Services"]
        subgraph Realtime["Real-time"]
            STT["Whisper<br/>(self-hosted or API)"]
            LLM["Claude API<br/>(external)"]
            TTS["Azure TTS<br/>(external)"]
        end
        subgraph Batch["Batch Processing"]
            FORECAST["Forecast Service<br/>(Prophet + TFT)"]
            CREDIT["Credit Scoring<br/>(XGBoost)"]
        end
    end
    
    subgraph Cache["Caching Layer"]
        REDIS["Redis Cluster<br/>- Session store<br/>- Rate limiting<br/>- Hot data cache<br/>- Pub/Sub"]
    end
    
    subgraph DB["Database Layer"]
        subgraph Primary["Primary (Write)"]
            PG_M["PostgreSQL Master<br/>- merchants<br/>- transactions<br/>- orders"]
        end
        subgraph Replica["Replicas (Read)"]
            PG_R1["PostgreSQL Replica 1"]
            PG_R2["PostgreSQL Replica 2"]
        end
        subgraph TimeSeries["Time-Series"]
            TSDB["TimescaleDB<br/>- sales_history<br/>- forecasts"]
        end
        subgraph Vector["Vector Store"]
            PINECONE["Pinecone<br/>- product_embeddings"]
        end
    end
    
    subgraph Storage["Object Storage"]
        S3["AWS S3 / MinIO<br/>- Voice recordings<br/>- ML model artifacts<br/>- Backups"]
    end
    
    subgraph Monitoring["Observability"]
        PROM["Prometheus<br/>Metrics"]
        GRAF["Grafana<br/>Dashboards"]
        SENTRY["Sentry<br/>Error Tracking"]
        ELK["ELK Stack<br/>Logs"]
    end

    WA --> CF
    WEB --> CF
    MOB --> CF
    CF --> ALB
    ALB --> API1
    ALB --> API2
    ALB --> API3
    
    API1 --> REDIS
    API2 --> REDIS
    API3 --> REDIS
    
    API1 --> RMQ
    API2 --> RMQ
    API3 --> RMQ
    
    RMQ --> W1
    RMQ --> W2
    RMQ --> W3
    
    W1 --> STT
    W1 --> LLM
    W1 --> TTS
    W2 --> FORECAST
    W2 --> CREDIT
    W3 --> WA
    
    W1 --> PG_M
    W2 --> TSDB
    W1 --> PINECONE
    
    PG_M --> PG_R1
    PG_M --> PG_R2
    
    API1 --> PG_R1
    API2 --> PG_R2
    
    STT --> S3
    
    API1 --> PROM
    W1 --> PROM
    PROM --> GRAF
    API1 --> SENTRY
    W1 --> ELK

    style Client fill:#e1f5fe
    style Edge fill:#fff3e0
    style LB fill:#f3e5f5
    style API fill:#e8f5e9
    style Queue fill:#ffe0b2
    style Workers fill:#f0f4c3
    style AI fill:#e1bee7
    style Cache fill:#ffccbc
    style DB fill:#b2dfdb
    style Storage fill:#c5cae9
    style Monitoring fill:#ffecb3
```

### Couches d'Architecture

1. **Client Layer** : Interfaces utilisateur (WhatsApp, Web, Mobile)
2. **Edge/CDN** : Protection DDoS et terminaison SSL via CloudFlare
3. **Load Balancing** : Répartition de charge avec AWS ALB
4. **API Layer** : Pods FastAPI sans état pour haute disponibilité
5. **Message Queue** : File d'attente asynchrone avec RabbitMQ
6. **Workers** : Traitement asynchrone spécialisé
7. **AI Services** : Services d'IA en temps réel et batch
8. **Caching** : Cluster Redis pour performance
9. **Database** : PostgreSQL avec réplicas et TimescaleDB
10. **Monitoring** : Observabilité complète avec Prometheus, Grafana, Sentry et ELK

---

## 🔄 Flux de Traitement des Messages

Séquence détaillée du traitement d'un message vocal en arabe dialectal.

```mermaid
sequenceDiagram
    autonumber
    participant M as 🏪 Merchant
    participant WA as 📱 WhatsApp
    participant API as ⚡ API Gateway
    participant Q as 📬 Queue
    participant W as ⚙️ Worker
    participant STT as 🎤 Whisper
    participant LLM as 🧠 Claude
    participant DB as 💾 PostgreSQL
    participant ML as 📊 ML Models

    M->>WA: Voice: "بعت 10 كراتن حليب"
    WA->>API: Webhook POST /webhook
    API->>API: Validate signature
    API->>Q: Enqueue message
    API-->>WA: 200 OK (< 5s)
    
    Q->>W: Dequeue message
    W->>STT: Transcribe audio
    STT-->>W: "بعت 10 كراتن حليب"
    
    W->>LLM: Extract intent & entities
    LLM-->>W: {intent: "record_sale", product: "حليب", qty: 10}
    
    W->>DB: Match product (fuzzy search)
    DB-->>W: product_id: "milk_001"
    
    W->>DB: UPDATE inventory SET qty = qty - 10
    W->>DB: INSERT transaction
    
    W->>ML: Check restock threshold
    ML-->>W: {needs_restock: true, days_until_stockout: 2}
    
    W->>WA: Send confirmation + alert
    WA->>M: "✅ سجلت 10 حليب. باقي 5. طلب قريبا؟"
```

### Étapes du Flux

1. Le commerçant envoie un message vocal
2. Réception du webhook WhatsApp
3. Validation de la signature
4. Mise en file d'attente du message
5. Réponse rapide à WhatsApp (< 5s)
6. Traitement asynchrone du message
7. Transcription audio avec Whisper
8. Extraction de l'intention et des entités avec Claude
9. Correspondance du produit dans la base de données
10. Mise à jour de l'inventaire
11. Vérification du seuil de réapprovisionnement
12. Envoi de confirmation et alerte si nécessaire

---

## 💾 Modèle de Données

Schéma entité-relation de la base de données.

```mermaid
erDiagram
    MERCHANT ||--o{ TRANSACTION : makes
    MERCHANT ||--o{ ORDER : places
    MERCHANT ||--o{ CONVERSATION : has
    MERCHANT ||--o{ CREDIT_SCORE : has
    MERCHANT }|--|| LOCATION : located_at
    
    PRODUCT ||--o{ TRANSACTION : involves
    PRODUCT ||--o{ ORDER_ITEM : includes
    PRODUCT ||--o{ INVENTORY : tracked_in
    PRODUCT }|--|| CATEGORY : belongs_to
    
    ORDER ||--|{ ORDER_ITEM : contains
    ORDER }|--|| SUPPLIER : fulfilled_by
    
    MERCHANT {
        uuid id PK
        string phone_number UK
        string business_name
        string preferred_language
        enum business_category
        float credit_score
        boolean is_active
        timestamp created_at
        timestamp last_active
    }
    
    LOCATION {
        uuid id PK
        uuid merchant_id FK
        float latitude
        float longitude
        string address
        string city
        string neighborhood
    }
    
    PRODUCT {
        uuid id PK
        string name_ar
        string name_fr
        uuid category_id FK
        string barcode
        decimal unit_price
        string unit_type
        vector embedding
        boolean is_active
    }
    
    CATEGORY {
        uuid id PK
        string name_ar
        string name_fr
        string slug
    }
    
    INVENTORY {
        uuid id PK
        uuid merchant_id FK
        uuid product_id FK
        int quantity
        int reorder_threshold
        timestamp last_updated
    }
    
    TRANSACTION {
        uuid id PK
        uuid merchant_id FK
        uuid product_id FK
        int quantity
        decimal unit_price
        decimal total_amount
        enum type
        enum source
        timestamp recorded_at
    }
    
    ORDER {
        uuid id PK
        uuid merchant_id FK
        uuid supplier_id FK
        enum status
        decimal total_amount
        timestamp created_at
        timestamp delivered_at
    }
    
    ORDER_ITEM {
        uuid id PK
        uuid order_id FK
        uuid product_id FK
        int quantity
        decimal unit_price
    }
    
    SUPPLIER {
        uuid id PK
        string name
        string contact_phone
        string[] product_categories
        json delivery_zones
        boolean is_active
    }
    
    CONVERSATION {
        uuid id PK
        uuid merchant_id FK
        json messages
        string current_intent
        json context
        timestamp started_at
        timestamp last_message_at
    }
    
    CREDIT_SCORE {
        uuid id PK
        uuid merchant_id FK
        float score
        float credit_limit
        json factors
        timestamp calculated_at
    }
```

### Entités Principales

- **MERCHANT** : Informations des commerçants
- **PRODUCT** : Catalogue de produits bilingue
- **INVENTORY** : Gestion des stocks par commerçant
- **TRANSACTION** : Historique des ventes et achats
- **ORDER** : Commandes aux fournisseurs
- **SUPPLIER** : Base de données fournisseurs
- **CONVERSATION** : Historique conversationnel
- **CREDIT_SCORE** : Scoring de crédit des commerçants

---

## 🔄 Pipeline CI/CD

Pipeline d'intégration et de déploiement continu.

```mermaid
flowchart LR
    subgraph Dev["👨‍💻 Development"]
        CODE["Code Push"]
        PR["Pull Request"]
    end
    
    subgraph CI["🔄 Continuous Integration"]
        LINT["Lint & Format<br/>ruff, black, eslint"]
        TEST["Unit Tests<br/>pytest, jest"]
        SEC["Security Scan<br/>bandit, trivy"]
        BUILD["Build Images<br/>Docker"]
    end
    
    subgraph CD["🚀 Continuous Deployment"]
        STG["Deploy Staging<br/>Auto"]
        E2E["E2E Tests<br/>Playwright"]
        APPROVE["Manual Approval"]
        PROD["Deploy Production<br/>Blue-Green"]
    end
    
    subgraph Monitor["📊 Post-Deploy"]
        HEALTH["Health Checks"]
        METRICS["Metrics Alert"]
        ROLLBACK["Auto Rollback"]
    end
    
    CODE --> PR
    PR --> LINT
    LINT --> TEST
    TEST --> SEC
    SEC --> BUILD
    BUILD --> STG
    STG --> E2E
    E2E --> APPROVE
    APPROVE --> PROD
    PROD --> HEALTH
    HEALTH --> METRICS
    METRICS --> ROLLBACK
    
    style Dev fill:#e3f2fd
    style CI fill:#fff3e0
    style CD fill:#e8f5e9
    style Monitor fill:#fce4ec
```

### Phases du Pipeline

1. **Development** : Push de code et pull request
2. **Continuous Integration** : Linting, tests, scan de sécurité, build Docker
3. **Continuous Deployment** : Déploiement staging, tests E2E, approbation manuelle, déploiement production
4. **Post-Deploy** : Health checks, alertes métriques, rollback automatique

---

## 🤖 Machine d'État Conversationnelle

Gestion des états de conversation avec les utilisateurs.

```mermaid
stateDiagram-v2
    [*] --> Idle: New User / Session Timeout
    
    Idle --> Greeting: Message Received
    Greeting --> IdentifyIntent: Process Message
    
    IdentifyIntent --> RecordSale: intent=sale
    IdentifyIntent --> CheckInventory: intent=inventory
    IdentifyIntent --> PlaceOrder: intent=order
    IdentifyIntent --> GetHelp: intent=help
    IdentifyIntent --> Unknown: intent=unknown
    
    RecordSale --> ConfirmSale: Extract entities
    ConfirmSale --> UpdateInventory: User confirms
    ConfirmSale --> RecordSale: User corrects
    UpdateInventory --> CheckRestock: Stock updated
    CheckRestock --> SendAlert: Low stock
    CheckRestock --> Idle: Stock OK
    SendAlert --> Idle: Alert sent
    
    CheckInventory --> ShowInventory: Fetch data
    ShowInventory --> Idle: Display results
    
    PlaceOrder --> SelectProducts: Start order
    SelectProducts --> ConfirmOrder: Products selected
    ConfirmOrder --> ProcessOrder: User confirms
    ConfirmOrder --> SelectProducts: User modifies
    ProcessOrder --> OrderComplete: Order placed
    OrderComplete --> Idle: Confirmation sent
    
    GetHelp --> ShowHelp: Display options
    ShowHelp --> Idle: Help shown
    
    Unknown --> Clarify: Ask for clarification
    Clarify --> IdentifyIntent: User clarifies
    Clarify --> Idle: Max retries reached
```

### États Principaux

- **Idle** : État d'attente
- **Greeting** : Message d'accueil
- **IdentifyIntent** : Identification de l'intention
- **RecordSale** : Enregistrement de vente
- **CheckInventory** : Consultation de stock
- **PlaceOrder** : Passation de commande
- **GetHelp** : Assistance utilisateur

---

## 📈 Stratégie de Scalabilité

Plan de croissance par phases avec estimation des coûts.

```mermaid
flowchart TB
    subgraph Phase1["📊 Phase 1: 0-1K Merchants"]
        P1_API["1-2 API Pods"]
        P1_WORKER["1-2 Workers"]
        P1_DB["Single PostgreSQL<br/>+ Redis"]
        P1_COST["$200-500/month"]
    end
    
    subgraph Phase2["📈 Phase 2: 1K-10K Merchants"]
        P2_API["3-5 API Pods<br/>Auto-scaling"]
        P2_WORKER["3-5 Workers<br/>Dedicated queues"]
        P2_DB["PostgreSQL<br/>+ Read Replica<br/>+ Redis Cluster"]
        P2_COST["$1,000-2,000/month"]
    end
    
    subgraph Phase3["🚀 Phase 3: 10K-100K Merchants"]
        P3_API["10-20 API Pods<br/>Multi-region"]
        P3_WORKER["10+ Workers<br/>Specialized"]
        P3_DB["PostgreSQL Cluster<br/>+ Sharding<br/>+ TimescaleDB<br/>+ Redis Sentinel"]
        P3_COST["$5,000-15,000/month"]
    end
    
    Phase1 --> Phase2
    Phase2 --> Phase3
    
    style Phase1 fill:#c8e6c9
    style Phase2 fill:#fff9c4
    style Phase3 fill:#ffccbc
```

### Phases de Croissance

- **Phase 1 (0-1K commerçants)** : Infrastructure minimale, coût $200-500/mois
- **Phase 2 (1K-10K commerçants)** : Auto-scaling et réplicas, coût $1,000-2,000/mois
- **Phase 3 (10K-100K commerçants)** : Multi-région et sharding, coût $5,000-15,000/mois

---

## 🔒 Architecture de Sécurité

Défense en profondeur avec plusieurs couches de protection.

```mermaid
flowchart TB
    subgraph External["🌐 External"]
        USER["Users"]
        ATTACKER["Threats"]
    end
    
    subgraph Perimeter["🛡️ Perimeter Security"]
        WAF["AWS WAF<br/>SQL Injection<br/>XSS Protection"]
        DDOS["CloudFlare<br/>DDoS Mitigation"]
        RATE["Rate Limiting<br/>100 req/min"]
    end
    
    subgraph Network["🔒 Network Security"]
        VPC["VPC<br/>Private Subnets"]
        SG["Security Groups<br/>Firewall Rules"]
        TLS["TLS 1.3<br/>End-to-End"]
    end
    
    subgraph App["🔐 Application Security"]
        AUTH["Authentication<br/>Phone Verification"]
        AUTHZ["Authorization<br/>RBAC"]
        VALID["Input Validation<br/>Pydantic Schemas"]
        SECRETS["Secrets Manager<br/>AWS Secrets"]
    end
    
    subgraph Data["💾 Data Security"]
        ENCRYPT["Encryption at Rest<br/>AES-256"]
        MASK["Data Masking<br/>PII Protection"]
        AUDIT["Audit Logs<br/>1 Year Retention"]
        BACKUP["Encrypted Backups<br/>Daily"]
    end
    
    subgraph Compliance["📋 Compliance"]
        CNDP["CNDP<br/>Morocco Data Protection"]
        GDPR["GDPR Principles"]
        PCI["PCI-DSS<br/>(if payments)"]
    end
    
    USER --> WAF
    ATTACKER --> WAF
    WAF --> DDOS
    DDOS --> RATE
    RATE --> VPC
    VPC --> SG
    SG --> TLS
    TLS --> AUTH
    AUTH --> AUTHZ
    AUTHZ --> VALID
    VALID --> SECRETS
    SECRETS --> ENCRYPT
    ENCRYPT --> MASK
    MASK --> AUDIT
    AUDIT --> BACKUP
    
    Data --> Compliance
    
    style External fill:#ffcdd2
    style Perimeter fill:#fff9c4
    style Network fill:#c8e6c9
    style App fill:#bbdefb
    style Data fill:#e1bee7
    style Compliance fill:#d7ccc8
```

### Couches de Sécurité

1. **Perimeter Security** : WAF, protection DDoS, rate limiting
2. **Network Security** : VPC, security groups, TLS 1.3
3. **Application Security** : Authentification, autorisation, validation des entrées
4. **Data Security** : Chiffrement au repos, masquage des données, audit logs
5. **Compliance** : CNDP (Maroc), GDPR, PCI-DSS

---

## 📝 Notes

- Tous les diagrammes sont générés avec Mermaid
- L'architecture est conçue pour être scalable et résiliente
- Les coûts sont des estimations basées sur AWS/Azure
- La sécurité suit une approche de défense en profondeur
- Le système supporte l'arabe dialectal marocain et le français

---

## 🚀 Démarrage Rapide

Pour commencer avec ce projet, consultez la documentation de déploiement dans le dossier `/docs`.

## 📞 Support

Pour toute question ou assistance, contactez l'équipe de développement.

---

**Dernière mise à jour** : Décembre 2024