# 🏗️ C4 Architecture Diagrams - System Design Visualization

Enterprise-grade architecture documentation using C4 Model (Level 0-3) with PlantUML/Mermaid diagrams.

---

## C4 Model Overview

```
Level 0: System Context (Big Picture)
  └─ Actors, External Systems, Data Flow

Level 1: Container Diagram (Technical Boundaries)
  └─ Services, Databases, Message Queues, APIs

Level 2: Component Diagram (Inside Services)
  └─ Controllers, Services, Repositories, Business Logic

Level 3: Code Diagram (Classes, Methods)
  └─ Class hierarchy, dependencies, interfaces
```

---

## Level 0: System Context Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                     NextGen Market Platform                         │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  NextGen-Market System                                     │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────┐    │  │
│  │  │  API Platform                                   │    │  │
│  │  │  (NestJS, TypeScript)                          │    │  │
│  │  │                                                 │    │  │
│  │  │  - REST APIs                                   │    │  │
│  │  │  - Real-time WebSocket                         │    │  │
│  │  │  - Event Processing                            │    │  │
│  │  └──────────────────────────────────────────────────┘    │  │
│  │                        ↓↑                                  │  │
│  │  ┌──────────────────────────────────────────────────┐    │  │
│  │  │  Data Layer                                     │    │  │
│  │  │  - PostgreSQL (transactional)                   │    │  │
│  │  │  - Redis (caching, sessions)                    │    │  │
│  │  │  - Elasticsearch (full-text search)             │    │  │
│  │  └──────────────────────────────────────────────────┘    │  │
│  └────────────────────────────────────────────────────────────┘  │
│         ↓↑              ↓↑              ↓↑              ↓↑       │
└────┬─────┬──────────────┬──────────────┬──────────────┬──────────┘
     │     │              │              │              │
     ↓ ← → ↓          ← → ↓          ← → ↓          ← → ↓
    ╔═════════════╗  ╔═════════════╗  ╔═════════════╗  ╔═════════════╗
    ║   Web App   ║  ║ Mobile App  ║  ║   Admin     ║  ║  External   ║
    ║  (React)    ║  ║ (React Native)║  ║   Panel     ║  ║   Partners  ║
    ║             ║  ║             ║  ║   (React)   ║  ║   (REST)    ║
    ╚═════════════╝  ╚═════════════╝  ╚═════════════╝  ╚═════════════╝
    Users (B2C)    Users (B2C Mobile) Admins (B2B)   Third-party APIs

External Systems:
  - Payment Gateway (Stripe, PayPal)
  - Email Service (SendGrid)
  - SMS Gateway (Twilio)
  - Audit Log Storage (Azure Blob)
  - Monitoring (Prometheus, Grafana)
```

### PlantUML C0 Diagram

```plantuml
@startuml NextGen-Market-Context
!include <C4/C4_Context>

Person(user, "End User", "Using web/mobile app")
Person(admin, "Administrator", "Managing platform")

System(nextgen, "NextGen Market Platform", "Provides marketplace services")

System_Ext(payment, "Payment Gateway", "Stripe, PayPal")
System_Ext(email, "Email Service", "SendGrid")
System_Ext(sms, "SMS Gateway", "Twilio")
System_Ext(storage, "Cloud Storage", "Azure Blob")
System_Ext(monitoring, "Monitoring Stack", "Prometheus, Grafana")

Rel(user, nextgen, "Uses [HTTPS]")
Rel(admin, nextgen, "Manages [HTTPS]")
Rel(nextgen, payment, "Process payments [REST]")
Rel(nextgen, email, "Send emails [SMTP]")
Rel(nextgen, sms, "Send SMS [REST]")
Rel(nextgen, storage, "Archive logs [Blob API]")
Rel(nextgen, monitoring, "Send metrics [OpenTelemetry]")

@enduml
```

---

## Level 1: Container Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        NextGen Market Platform                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        User Interface                              │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐        │   │
│  │  │  Web UI      │  │  Mobile App  │  │  Admin Dashboard │        │   │
│  │  │  (React)     │  │  (React Nat.)│  │  (React)         │        │   │
│  │  │  Port: 3000  │  │  Port: 3001  │  │  Port: 3002      │        │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘        │   │
│  │         ↓↑                ↓↑                 ↓↑                     │   │
│  │  ┌────────────────────────────────────────────────────┐           │   │
│  │  │         API Gateway & Load Balancer               │           │   │
│  │  │         (NGINX Ingress)                           │           │   │
│  │  │         - TLS 1.2+                                 │           │   │
│  │  │         - Rate Limiting (100 req/s)               │           │   │
│  │  │         - WAF (ModSecurity)                        │           │   │
│  │  │         - Blue-Green/Canary Deployment            │           │   │
│  │  └────────────────────────────────────────────────────┘           │   │
│  │         ↓↑                                                          │   │
│  │  ┌────────────────────────────────────────────────────┐           │   │
│  │  │              API Microservices                    │           │   │
│  │  │  ┌──────────────┐  ┌──────────────┐             │           │   │
│  │  │  │ API Core     │  │ Invoice Mgmt │             │           │   │
│  │  │  │ Service      │  │ Service      │             │           │   │
│  │  │  │ (3000)       │  │ (3001)       │             │           │   │
│  │  │  └──────────────┘  └──────────────┘             │           │   │
│  │  │  ┌──────────────┐  ┌──────────────┐             │           │   │
│  │  │  │ Auth Service │  │ Fraud        │             │           │   │
│  │  │  │ (3002)       │  │ Detection    │             │           │   │
│  │  │  │              │  │ (3003)       │             │           │   │
│  │  │  └──────────────┘  └──────────────┘             │           │   │
│  │  │  ┌──────────────┐  ┌──────────────┐             │           │   │
│  │  │  │ Tax Service  │  │ Payment      │             │           │   │
│  │  │  │ (3004)       │  │ Service      │             │           │   │
│  │  │  │              │  │ (3005)       │             │           │   │
│  │  │  └──────────────┘  └──────────────┘             │           │   │
│  │  └────────────────────────────────────────────────────┘           │   │
│  │         ↓↑                   ↓↑                   ↓↑             │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │   │
│  │  │ PostgreSQL   │  │ Redis Cache  │  │ RabbitMQ    │          │   │
│  │  │ (Transact.)  │  │ (Session)    │  │ (Events)    │          │   │
│  │  │ Port: 5432   │  │ Port: 6379   │  │ Port: 5672  │          │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘          │   │
│  │         ↓↑                                                       │   │
│  │  ┌────────────────────────────────────────────────┐            │   │
│  │  │     Observability Stack                       │            │   │
│  │  │  - Prometheus (metrics)                       │            │   │
│  │  │  - Grafana (visualization)                    │            │   │
│  │  │  - Loki (logs)                                 │            │   │
│  │  │  - Jaeger (tracing)                            │            │   │
│  │  │  - AlertManager (alerting)                     │            │   │
│  │  └────────────────────────────────────────────────┘            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│         ↓↑              ↓↑              ↓↑                             │
└─────────┬───────────────┬───────────────┬──────────────────────────────┘
          │               │               │
       External APIs: Payment Gateway, Email Service, SMS Gateway
```

### PlantUML C1 Diagram

```plantuml
@startuml NextGen-Market-Containers
!include <C4/C4_Container>

Person(user, "User", "Web/Mobile user")
Person(admin, "Administrator", "Platform admin")

Container_Boundary(nextgen, "NextGen Market") {
    Container(web, "Web UI", "React", "Web application")
    Container(mobile, "Mobile App", "React Native", "Mobile application")
    Container(admin_ui, "Admin UI", "React", "Admin dashboard")
    
    Container(ingress, "API Gateway", "NGINX Ingress", "- TLS 1.2+\n- Rate Limiting\n- WAF (ModSecurity)")
    
    Container_Boundary(api_services, "Microservices (Kubernetes)") {
        Container(api_core, "API Core", "NestJS", "Main API service")
        Container(auth_svc, "Auth Service", "NestJS", "Authentication")
        Container(invoice_svc, "Invoice Service", "NestJS", "Invoice management")
        Container(fraud_svc, "Fraud Detection", "Python", "Fraud detection")
        Container(tax_svc, "Tax Service", "NestJS", "Tax calculations")
        Container(payment_svc, "Payment Service", "NestJS", "Payment processing")
    }
    
    Container_Boundary(data, "Data Layer") {
        ContainerDb(postgres, "PostgreSQL", "Database", "Transactional data")
        Container(redis, "Redis", "Cache", "Session & cache data")
        Container(rabbitmq, "RabbitMQ", "Message Queue", "Event streaming")
    }
    
    Container_Boundary(observability, "Observability") {
        Container(prometheus, "Prometheus", "Monitoring", "Metrics collection")
        Container(grafana, "Grafana", "Visualization", "Dashboards & alerts")
        Container(loki, "Loki", "Log Storage", "Log aggregation")
        Container(jaeger, "Jaeger", "Tracing", "Distributed tracing")
    }
}

System_Ext(payment_gw, "Payment Gateway", "Stripe/PayPal")
System_Ext(email_svc, "Email Service", "SendGrid")
System_Ext(sms_svc, "SMS Gateway", "Twilio")

Rel(user, web, "Uses")
Rel(user, mobile, "Uses")
Rel(admin, admin_ui, "Manages")
Rel(web, ingress, "API calls [HTTPS]")
Rel(mobile, ingress, "API calls [HTTPS]")
Rel(admin_ui, ingress, "API calls [HTTPS]")
Rel(ingress, api_core, "Route requests")
Rel(ingress, auth_svc, "Route auth")
Rel(ingress, invoice_svc, "Route invoices")
Rel(ingress, fraud_svc, "Route fraud checks")
Rel(ingress, tax_svc, "Route tax calcs")
Rel(ingress, payment_svc, "Route payments")
Rel(api_core, postgres, "Read/Write [TCP:5432]")
Rel(api_core, redis, "Cache [TCP:6379]")
Rel(api_core, rabbitmq, "Publish events [TCP:5672]")
Rel(api_core, prometheus, "Send metrics")
Rel(api_core, loki, "Send logs")
Rel(api_core, jaeger, "Send traces")
Rel(payment_svc, payment_gw, "API calls")
Rel(api_core, email_svc, "Send emails")
Rel(api_core, sms_svc, "Send SMS")

@enduml
```

---

## Level 2: Component Diagram (API Core Service)

```
┌──────────────────────────────────────────────────────────────────┐
│                    API Core Service (NestJS)                    │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐│
│  │              REST Controllers                             ││
│  │  ┌──────────────────┐  ┌──────────────────┐              ││
│  │  │ UsersController  │  │ InvoicesController│              ││
│  │  │ /api/users       │  │ /api/invoices    │              ││
│  │  │ GET, POST, PUT   │  │ GET, POST, PUT   │              ││
│  │  └──────────────────┘  └──────────────────┘              ││
│  │  ┌──────────────────┐  ┌──────────────────┐              ││
│  │  │ ProductsControl. │  │ OrdersController │              ││
│  │  │ /api/products    │  │ /api/orders      │              ││
│  │  │ GET, POST, PUT   │  │ GET, POST, PUT   │              ││
│  │  └──────────────────┘  └──────────────────┘              ││
│  └────────────────────────────────────────────────────────────┘│
│           ↓↑                                                    │
│  ┌────────────────────────────────────────────────────────────┐│
│  │              Business Logic Services                       ││
│  │  ┌──────────────────┐  ┌──────────────────┐              ││
│  │  │ UserService      │  │ InvoiceService   │              ││
│  │  │ - Register       │  │ - Create invoice │              ││
│  │  │ - Authenticate   │  │ - Calculate tax  │              ││
│  │  │ - Manage profile │  │ - Send email     │              ││
│  │  └──────────────────┘  └──────────────────┘              ││
│  │  ┌──────────────────┐  ┌──────────────────┐              ││
│  │  │ PaymentService   │  │ ProductService   │              ││
│  │  │ - Process payment│  │ - List products  │              ││
│  │  │ - Refund         │  │ - Search products│              ││
│  │  │ - Validate card  │  │ - Get details    │              ││
│  │  └──────────────────┘  └──────────────────┘              ││
│  └────────────────────────────────────────────────────────────┘│
│           ↓↑                                                    │
│  ┌────────────────────────────────────────────────────────────┐│
│  │              Data Access Layer (Repositories)              ││
│  │  ┌──────────────────┐  ┌──────────────────┐              ││
│  │  │ UserRepository   │  │ InvoiceRepository│              ││
│  │  │ - Find by ID     │  │ - Find by ID     │              ││
│  │  │ - Create         │  │ - Create         │              ││
│  │  │ - Update         │  │ - Update         │              ││
│  │  │ - Delete         │  │ - Query list     │              ││
│  │  └──────────────────┘  └──────────────────┘              ││
│  │  ┌──────────────────┐  ┌──────────────────┐              ││
│  │  │ CacheRepository  │  │ ProductRepository│              ││
│  │  │ - Get from cache │  │ - Search         │              ││
│  │  │ - Set in cache   │  │ - Get details    │              ││
│  │  │ - Invalidate     │  │ - Bulk insert    │              ││
│  │  └──────────────────┘  └──────────────────┘              ││
│  └────────────────────────────────────────────────────────────┘│
│           ↓↑                                                    │
│  ┌────────────────────────────────────────────────────────────┐│
│  │              Cross-Cutting Concerns                        ││
│  │  ┌──────────────────┐  ┌──────────────────┐              ││
│  │  │ AuthGuard        │  │ ValidationPipe   │              ││
│  │  │ - JWT validation │  │ - DTO validation │              ││
│  │  │ - Permission check│ - Type checking  │              ││
│  │  └──────────────────┘  └──────────────────┘              ││
│  │  ┌──────────────────┐  ┌──────────────────┐              ││
│  │  │ ErrorHandler     │  │ LoggingInterceptor│              ││
│  │  │ - Exception catch│  │ - Request logs   │              ││
│  │  │ - Format errors  │  │ - Response logs  │              ││
│  │  │ - Send alerts    │  │ - Performance    │              ││
│  │  └──────────────────┘  └──────────────────┘              ││
│  └────────────────────────────────────────────────────────────┘│
│           ↓↑         ↓↑         ↓↑                             │
└─────────────┬──────────┬──────────┬──────────────────────────────┘
              │          │          │
           PostgreSQL   Redis     RabbitMQ
          (Database)  (Cache)     (Events)
```

### PlantUML C2 Diagram

```plantuml
@startuml NextGen-API-Components
!include <C4/C4_Component>

Container_Boundary(api, "API Core Service") {
    Component(users_ctrl, "Users Controller", "NestJS Controller", "GET/POST/PUT /api/users")
    Component(invoices_ctrl, "Invoices Controller", "NestJS Controller", "GET/POST /api/invoices")
    Component(orders_ctrl, "Orders Controller", "NestJS Controller", "GET/POST /api/orders")
    Component(products_ctrl, "Products Controller", "NestJS Controller", "GET /api/products")
    
    Component(users_svc, "Users Service", "NestJS Service", "User management")
    Component(invoices_svc, "Invoices Service", "NestJS Service", "Invoice generation")
    Component(orders_svc, "Orders Service", "NestJS Service", "Order processing")
    Component(products_svc, "Products Service", "NestJS Service", "Product catalog")
    
    Component(users_repo, "Users Repository", "TypeORM", "User data access")
    Component(invoices_repo, "Invoices Repository", "TypeORM", "Invoice data access")
    Component(cache_repo, "Cache Repository", "Redis", "Cache operations")
    Component(products_repo, "Products Repository", "TypeORM", "Product data access")
    
    Component(auth_guard, "Auth Guard", "NestJS Guard", "JWT validation")
    Component(validation_pipe, "Validation Pipe", "NestJS Pipe", "DTO validation")
    Component(error_handler, "Error Handler", "Middleware", "Exception handling")
    Component(logging_inter, "Logging Interceptor", "NestJS Interceptor", "Request/Response logging")
}

ContainerDb(postgres, "PostgreSQL", "Database")
Container(redis, "Redis", "Cache")
Container(rabbitmq, "RabbitMQ", "Message Queue")

Rel(users_ctrl, auth_guard, "Uses")
Rel(users_ctrl, validation_pipe, "Uses")
Rel(users_ctrl, users_svc, "Calls")
Rel(invoices_ctrl, invoices_svc, "Calls")
Rel(orders_ctrl, orders_svc, "Calls")
Rel(products_ctrl, products_svc, "Calls")

Rel(users_svc, users_repo, "Uses")
Rel(invoices_svc, invoices_repo, "Uses")
Rel(orders_svc, cache_repo, "Uses")
Rel(products_svc, products_repo, "Uses")

Rel(users_repo, postgres, "Read/Write")
Rel(invoices_repo, postgres, "Read/Write")
Rel(cache_repo, redis, "Get/Set")
Rel(products_repo, postgres, "Read/Write")

Rel(users_svc, rabbitmq, "Publish events")
Rel(orders_svc, rabbitmq, "Publish events")

Rel(users_ctrl, logging_inter, "Uses")
Rel(users_ctrl, error_handler, "Uses")

@enduml
```

---

## Level 3: Code Diagram (Class Structure)

```
User Aggregate:
├── User (Entity)
│   ├── id: UUID
│   ├── email: string
│   ├── password_hash: string
│   ├── created_at: DateTime
│   ├── updated_at: DateTime
│   └── Methods:
│       ├── SetPassword(password: string)
│       ├── VerifyPassword(password: string): boolean
│       ├── UpdateProfile(data: UserUpdateDTO)
│       └── Deactivate()

Invoice Aggregate:
├── Invoice (Entity)
│   ├── id: UUID
│   ├── user_id: UUID
│   ├── invoice_number: string
│   ├── total_amount: Decimal
│   ├── status: InvoiceStatus (Draft, Sent, Paid, Cancelled)
│   ├── created_at: DateTime
│   └── Methods:
│       ├── AddLineItem(item: LineItem)
│       ├── RemoveLineItem(itemId: UUID)
│       ├── CalculateTax(): Decimal
│       ├── Send()
│       └── MarkAsPaid()
│
├── LineItem (Value Object)
│   ├── id: UUID
│   ├── product_id: UUID
│   ├── quantity: int
│   ├── unit_price: Decimal
│   └── Methods:
│       └── GetTotal(): Decimal

Payment Aggregate:
├── Payment (Entity)
│   ├── id: UUID
│   ├── invoice_id: UUID
│   ├── amount: Decimal
│   ├── status: PaymentStatus (Pending, Completed, Failed, Refunded)
│   ├── payment_method: PaymentMethod
│   ├── transaction_id: string
│   ├── created_at: DateTime
│   └── Methods:
│       ├── Process()
│       ├── Refund()
│       └── MarkAsCompleted()
│
├── PaymentMethod (Value Object)
│   ├── type: PaymentType (Card, Bank, Wallet)
│   ├── reference: string
│   └── Methods:
│       └── Validate(): boolean
```

### PlantUML C3 Diagram

```plantuml
@startuml NextGen-Classes
!include <C4/C4_Component>

class User {
    -id: UUID
    -email: String
    -passwordHash: String
    -createdAt: DateTime
    -updatedAt: DateTime
    --
    +setPassword(password: String): void
    +verifyPassword(password: String): boolean
    +updateProfile(data: UserDTO): void
    +deactivate(): void
}

class Invoice {
    -id: UUID
    -userId: UUID
    -invoiceNumber: String
    -totalAmount: Decimal
    -status: InvoiceStatus
    -lineItems: List<LineItem>
    -createdAt: DateTime
    --
    +addLineItem(item: LineItem): void
    +removeLineItem(itemId: UUID): void
    +calculateTax(): Decimal
    +send(): void
    +markAsPaid(): void
}

class LineItem {
    -id: UUID
    -productId: UUID
    -quantity: int
    -unitPrice: Decimal
    --
    +getTotal(): Decimal
}

class Payment {
    -id: UUID
    -invoiceId: UUID
    -amount: Decimal
    -status: PaymentStatus
    -transactionId: String
    -paymentMethod: PaymentMethod
    -createdAt: DateTime
    --
    +process(): void
    +refund(): void
    +markAsCompleted(): void
}

class PaymentMethod {
    -type: PaymentType
    -reference: String
    --
    +validate(): boolean
}

enum InvoiceStatus {
    DRAFT
    SENT
    PAID
    CANCELLED
}

enum PaymentStatus {
    PENDING
    COMPLETED
    FAILED
    REFUNDED
}

enum PaymentType {
    CARD
    BANK
    WALLET
}

Invoice "1" --* "many" LineItem
Invoice "1" --* "many" Payment
Payment "1" -- "1" PaymentMethod
Invoice --> InvoiceStatus
Payment --> PaymentStatus
PaymentMethod --> PaymentType

@enduml
```

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Azure Cloud Platform                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │            Azure Kubernetes Service (AKS)                │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │           Ingress (NGINX)                           │ │  │
│  │  │  - TLS Termination (1.2+)                          │ │  │
│  │  │  - Rate Limiting                                    │ │  │
│  │  │  - WAF (ModSecurity)                                │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │         ↓↑                                                 │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │      Production Namespace (3 Availability Zones)  │ │  │
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐   │ │  │
│  │  │  │ Pod 1      │  │ Pod 2      │  │ Pod 3      │   │ │  │
│  │  │  │ (API Core) │  │ (API Core) │  │ (API Core) │   │ │  │
│  │  │  │ 500m/512Mi │  │ 500m/512Mi │  │ 500m/512Mi │   │ │  │
│  │  │  └────────────┘  └────────────┘  └────────────┘   │ │  │
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐   │ │  │
│  │  │  │ Invoice    │  │ Auth       │  │ Payment    │   │ │  │
│  │  │  │ Microserv. │  │ Microserv. │  │ Microserv. │   │ │  │
│  │  │  └────────────┘  └────────────┘  └────────────┘   │ │  │
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐   │ │  │
│  │  │  │ HPA/VPA    │  │ Network    │  │ Pod Sec.   │   │ │  │
│  │  │  │ Auto-scale │  │ Policies   │  │ Standards  │   │ │  │
│  │  │  └────────────┘  └────────────┘  └────────────┘   │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │         ↓↑                                                 │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │      Database Namespace                            │ │  │
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐   │ │  │
│  │  │  │ PostgreSQL │  │ PostgreSQL │  │ PostgreSQL │   │ │  │
│  │  │  │ Primary    │  │ Replica 1  │  │ Replica 2  │   │ │  │
│  │  │  │ 1000m/2Gi  │  │ 1000m/2Gi  │  │ 1000m/2Gi  │   │ │  │
│  │  │  └────────────┘  └────────────┘  └────────────┘   │ │  │
│  │  │  Replication: Primary → Replicas (continuous)    │ │  │
│  │  │  Backup: Hourly snapshots to Azure Blob Storage  │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │         ↓↑                                                 │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │      Cache & Message Queue                          │ │  │
│  │  │  ┌────────────┐  ┌──────────────┐                 │ │  │
│  │  │  │ Redis      │  │ RabbitMQ     │                 │ │  │
│  │  │  │ 250m/256Mi │  │ 500m/512Mi   │                 │ │  │
│  │  │  └────────────┘  └──────────────┘                 │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────┘  │
│         ↓↑                                                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │         Observability Stack (Monitoring Namespace)      │  │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────────┐      │  │
│  │  │ Prometheus │  │ Grafana    │  │ AlertManager │      │  │
│  │  │ Metrics    │  │ Dashboards │  │ Alerting     │      │  │
│  │  └────────────┘  └────────────┘  └──────────────┘      │  │
│  │  ┌────────────┐  ┌────────────┐                        │  │
│  │  │ Loki       │  │ Jaeger     │                        │  │
│  │  │ Logs       │  │ Tracing    │                        │  │
│  │  └────────────┘  └────────────┘                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│         ↓↑                                                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Backup & Recovery                           │  │
│  │  ┌───────────────────────────────────────────────────┐  │  │
│  │  │ Azure Blob Storage                               │  │  │
│  │  │ - Database snapshots (hourly)                    │  │  │
│  │  │ - Volume snapshots (hourly)                      │  │  │
│  │  │ - etcd backups (5-minute)                         │  │  │
│  │  │ - Configuration backups (6-hourly)               │  │  │
│  │  │ - Retention: 30-90 days                          │  │  │
│  │  └───────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### User Registration Flow

```
User → Web UI → API Gateway → Auth Service → UserService → UserRepository → PostgreSQL
  ↓                                                              ↓
  └─ Validate email → Hash password → Create user → Send verification email
```

### Payment Processing Flow

```
User → Web UI → API Gateway → Payment Service → Payment Gateway (Stripe)
         ↓                            ↓
       Validate             → Process transaction
         ↓                            ↓
      Create Invoice ← ← ← Create Payment record
         ↓                            ↓
    Calculate Tax              Send confirmation email
         ↓                            ↓
  Update inventory         Publish PaymentProcessed event
         ↓                            ↓
   Send receipt          Cache invalidation
```

### Invoice Generation Flow

```
API → Invoice Service → Calculate Tax Service → Tax calculation
  ↓                            ↓
  └─ Get user data    → Invoice Repository → Database
     Get line items   → Combine data → Generate PDF
     Get tax rules    → Store invoice → Send email
     Get company info
```

---

## Integration Points

```
System Integrations:

┌─ Payment Gateway (Stripe)
│  ├─ Endpoint: https://api.stripe.com
│  ├─ Auth: API Key (header)
│  ├─ Operations: Process payment, Refund, List transactions
│  └─ Retry: Exponential backoff (3 retries)

┌─ Email Service (SendGrid)
│  ├─ Endpoint: https://api.sendgrid.com
│  ├─ Auth: API Key (header)
│  ├─ Operations: Send email, Get template
│  └─ Retry: Exponential backoff (5 retries)

┌─ SMS Gateway (Twilio)
│  ├─ Endpoint: https://api.twilio.com
│  ├─ Auth: AccountSID + AuthToken
│  ├─ Operations: Send SMS
│  └─ Retry: Exponential backoff (3 retries)

┌─ Azure Blob Storage
│  ├─ Endpoint: https://*.blob.core.windows.net
│  ├─ Auth: Storage Key
│  ├─ Operations: Upload, Download, List blobs
│  └─ Retry: Exponential backoff (10 retries)
```

---

## Status: ✅ Enterprise-Grade Architecture Documentation

Complete C4 model (Level 0-3) with system context, containers, components, and code design documented.

**Tools Used**: PlantUML (free), Mermaid (free), ASCII diagrams (free)

**For Visual Export**:
1. Copy PlantUML code to: https://www.plantuml.com/plantuml/uml/
2. Export as PNG/SVG
3. Or: `plantuml -Tpng diagram.puml`
