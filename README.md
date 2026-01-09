# OpenGPSR Backend

Central data layer for GPSR (General Product Safety Regulation) entity management.

## Overview

OpenGPSR Backend is a neutral, versioned data infrastructure for storing and sharing information about GPSR responsible entities. It provides:

- **Entity Management**: Store and manage GPSR-relevant business entities
- **Brand Management**: Track trade names and trademarks with entity relationships
- **Product References**: Identify products by EAN/GTIN/MPN with safety information
- **Role Tracking**: Track contextual roles (manufacturer, importer, responsible person, etc.)
- **Source Attribution**: Every piece of data has a traceable source
- **Version History**: Full audit trail with no data loss
- **Verification Status**: Informational verification without legal implications

## ⚠️ Disclaimer

This system provides **informational data only**. It does not:
- Guarantee GPSR compliance
- Provide legal certification
- Replace official registries
- Constitute legal advice

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         API Layer                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ Public API  │  │   API v1    │  │      Middleware         │ │
│  │ (rate-ltd)  │  │ (entities,  │  │ (validation, errors,    │ │
│  │             │  │  brands,    │  │  rate limiting)         │ │
│  │             │  │  products)  │  │                         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Service Layer                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ Entity   │ │ Brand    │ │ Product  │ │ Contact  │  ...      │
│  │ Service  │ │ Service  │ │ Service  │ │ Service  │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer (Prisma)                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ Entity   │ │ Brand    │ │ Product  │ │ Safety   │  ...      │
│  │ Version  │ │ Link     │ │ Ref      │ │ Info     │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   PostgreSQL    │
                    └─────────────────┘
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ (or Docker)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd opengpsr-backend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start PostgreSQL (using Docker)
docker-compose up -d

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Seed the database (optional)
npm run db:seed

# Start development server
npm run dev
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | - |
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment | development |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | 900000 |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | 100 |

## API Endpoints

### Public API (Rate Limited)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/public/entities` | List entities (public view) |
| GET | `/api/public/entities/:id` | Get entity details |
| GET | `/api/public/schema` | API schema documentation |
| GET | `/api/public/stats` | Database statistics |

### Entities API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/entities` | List entities with filtering |
| GET | `/api/v1/entities/:id` | Get entity by ID |
| GET | `/api/v1/entities/:id/versions` | Get version history |
| POST | `/api/v1/entities` | Create new entity |
| PATCH | `/api/v1/entities/:id` | Update entity (creates version) |
| DELETE | `/api/v1/entities/:id` | Deactivate entity |
| POST | `/api/v1/entities/:id/roles` | Add role to entity |
| DELETE | `/api/v1/entities/:entityId/roles/:roleId` | Deactivate role |
| GET | `/api/v1/entities/:entityId/verification` | Get verification history |
| POST | `/api/v1/entities/:entityId/verification` | Add verification record |

### Brands API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/brands` | List brands with filtering |
| GET | `/api/v1/brands/:id` | Get brand by ID |
| POST | `/api/v1/brands` | Create new brand |
| PATCH | `/api/v1/brands/:id` | Update brand (creates version) |
| DELETE | `/api/v1/brands/:id` | Deactivate brand |
| POST | `/api/v1/brands/:id/links` | Link brand to entity |
| GET | `/api/v1/brands/:id/entities` | Get linked entities |

### Products API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/products` | List products with filtering |
| GET | `/api/v1/products/:id` | Get product by ID |
| GET | `/api/v1/products/lookup/:identifier` | Find by EAN/GTIN/MPN |
| POST | `/api/v1/products` | Create new product |
| PATCH | `/api/v1/products/:id` | Update product |
| GET | `/api/v1/products/:id/safety` | Get all safety info |
| GET | `/api/v1/products/:id/safety/:countryCode` | Get safety info by country |
| POST | `/api/v1/products/:id/safety` | Add safety info |
| PATCH | `/api/v1/safety/:id` | Update safety info |

### Contacts API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/contacts` | Create electronic contact |
| POST | `/api/v1/contacts/:id/confirm` | Confirm direct communication |
| GET | `/api/v1/contacts/entity/:entityId` | Get entity contacts |
| GET | `/api/v1/contacts/brand/:brandId` | Get brand contacts |
| GET | `/api/v1/contacts/brand/:brandId/safety` | Get all safety contacts |
| DELETE | `/api/v1/contacts/:id` | Deactivate contact |

### Sources & Audit API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/sources` | List sources |
| GET | `/api/v1/sources/:id` | Get source by ID |
| POST | `/api/v1/sources` | Create source |
| GET | `/api/v1/audit/entity/:entityType/:entityId` | Get audit logs for entity |
| GET | `/api/v1/audit/recent` | Get recent audit logs |

## Data Model

### Entity
Core business entity with normalized data for search and integration.

### EntityRole
Contextual GPSR roles:
- `MANUFACTURER` - Producent
- `IMPORTER` - Importer
- `RESPONSIBLE_PERSON` - Osoba odpowiedzialna
- `AUTHORIZED_REP` - Upoważniony przedstawiciel
- `DISTRIBUTOR` - Dystrybutor
- `FULFILLMENT_PROVIDER` - Dostawca usług fulfillment

### Brand
Trade name or registered trademark. Primary entity for e-commerce integrations.

### ProductReference
Product identification (EAN/GTIN/MPN) with safety information per country/language.

### Source
Data origin tracking:
- `COMMUNITY` - Community-contributed
- `PRIMARY_SOURCE` - From the entity itself
- `OFFICIAL_REGISTRY` - From public registries
- `PRODUCT_LABEL` - From product labels
- `WEBSITE` - From entity website
- `API_IMPORT` - Imported via API
- `MANUAL_ENTRY` - Manual entry
- `SAFETY_GATE` - Safety Gate / RAPEX alerts

### VerificationStatus
Informational verification (NOT legal certification):
- `UNVERIFIED` - Not yet verified
- `COMMUNITY_CONFIRMED` - Confirmed by community
- `PRIMARY_CONFIRMED` - Confirmed by primary source
- `HISTORICAL` - May need update
- `DISPUTED` - Data is disputed
- `OUTDATED` - Marked as outdated

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `NOT_FOUND` | 404 | Resource not found |
| `DUPLICATE_ENTRY` | 409 | Resource already exists |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Internal server error |
| `ROUTE_NOT_FOUND` | 404 | API route not found |

## Development

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build for production
npm run build

# Start production server
npm start
```

## License

MIT
