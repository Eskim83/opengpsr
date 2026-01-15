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

## 🌐 Public Website

The project has a public informational website available at:

- **Homepage**: [opengpsr.org](https://opengpsr.org/) - Project overview, FAQ, governance
- **API Documentation**: [opengpsr.org/api/docs.html](https://opengpsr.org/api/docs.html) - Interactive OpenAPI docs

Website source code is located in `www/org/` directory.

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
| GET | `/api/public/products/:id/resolved?country=PL` | **Best known truth** for product (v2.0) |
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

### Responsibilities API (v2.0)

Answer the core GPSR question: "Who is responsible for product X in country Y?"

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/responsibilities/product/:productId` | Get responsibilities for a product |
| GET | `/api/v1/responsibilities/product/:productId/resolved?country=PL` | **Best known truth** for product |
| GET | `/api/v1/responsibilities/product/:productId/history` | Full responsibility history |
| GET | `/api/v1/responsibilities/entity/:entityId` | What is this entity responsible for? |
| POST | `/api/v1/responsibilities` | Assign responsibility |
| PUT | `/api/v1/responsibilities/:id/dispute` | Mark as disputed |

**Resolved View Response:**
```json
{
  "productId": "uuid",
  "countryCode": "PL",
  "responsibilities": {
    "RESPONSIBLE_PERSON": {
      "entity": { "id": "...", "normalizedName": "..." },
      "confidence": 85,
      "dataFreshnessDays": 7,
      "hasConflicts": false
    }
  },
  "conflictCount": 0
}
```

### Identifiers API (v2.0)

Entity lookup and deduplication via VAT, EORI, DUNS, etc.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/identifiers/lookup?type=VAT_EU&value=PL123` | Find entity by identifier |
| GET | `/api/v1/identifiers/search?q=123&type=VAT_EU` | Search by partial value |
| GET | `/api/v1/identifiers/entity/:entityId` | Get all identifiers for entity |
| GET | `/api/v1/identifiers/entity/:entityId/duplicates` | Find potential duplicates |
| POST | `/api/v1/identifiers/entity/:entityId` | Add identifier to entity |
| DELETE | `/api/v1/identifiers/:id` | Remove identifier |

**Identifier Types:**
- `VAT_EU` - EU VAT number
- `EORI` - Economic Operators Registration and Identification
- `LEI` - Legal Entity Identifier
- `DUNS` - Dun & Bradstreet Number
- `KRS`, `NIP`, `REGON` - Polish registries
- `GLN` - Global Location Number
- `COMPANY_REGISTER` - Generic company register number

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

### Claim (v2.0)
Granular verification at attribute level:
- `PROPOSED` → `ACCEPTED` / `REJECTED` / `DISPUTED` → `SUPERSEDED`
- Subjects: ENTITY, BRAND, PRODUCT, RESPONSIBILITY, CONTACT, ADDRESS
- Each claim links to Evidence

### Evidence (v2.0)
Supporting material for Claims:
- `URL`, `FILE`, `IMAGE`, `PDF`, `TEXT_SNAPSHOT`, `LABEL_PHOTO`, `REGISTRY_EXTRACT`
- Content hash for integrity
- Expiration tracking

### Address (v2.0)
First-class address entity:
- Types: `REGISTERED`, `OPERATING`, `RETURN`, `SAFETY_CONTACT`
- Normalized search field
- Can be linked to multiple entities

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

## Data Governance & Neutrality

OpenGPSR operates as a neutral, open data repository. The following principles apply:

### Claim Submission
- Any registered source can submit Claims about entity data
- Claims must include supporting Evidence (URLs, documents, registry extracts)
- Automated sources (scrapers, APIs) are marked with `assertionType: DERIVED`

### Dispute Resolution
- Conflicting claims trigger `DISPUTED` status
- Resolution follows Evidence quality hierarchy: official registry > legal document > web source > user submission
- No single source has inherent privilege; confidence is earned through verification

### Legal Disclaimer
- All API responses include `legalStatus: "INFORMATIONAL_ONLY"` (machine-readable)
- Data does NOT constitute legal certification or official GPSR compliance verification
- Users must independently verify data with authoritative sources for legal purposes

### Data Retention
- Superseded claims preserved for audit trail
- Historical queries supported via `?at=YYYY-MM-DD` parameter
- Version history maintained per entity/brand

## License

MIT
