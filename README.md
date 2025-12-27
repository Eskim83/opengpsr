# OpenGPSR Backend

Central data layer for GPSR (General Product Safety Regulation) entity management.

## Overview

OpenGPSR Backend is a neutral, versioned data infrastructure for storing and sharing information about GPSR responsible entities. It provides:

- **Entity Management**: Store and manage GPSR-relevant business entities
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

### API v1

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/entities` | List entities with full details |
| GET | `/api/v1/entities/:id` | Get entity by ID |
| GET | `/api/v1/entities/:id/versions` | Get version history |
| POST | `/api/v1/entities` | Create new entity |
| PATCH | `/api/v1/entities/:id` | Update entity (creates version) |
| DELETE | `/api/v1/entities/:id` | Deactivate entity |
| POST | `/api/v1/entities/:id/roles` | Add role to entity |
| GET | `/api/v1/sources` | List sources |
| POST | `/api/v1/sources` | Create source |
| GET | `/api/v1/entities/:id/verification` | Get verification history |
| POST | `/api/v1/entities/:id/verification` | Add verification record |
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

### Source
Data origin tracking:
- `COMMUNITY` - Community-contributed
- `PRIMARY_SOURCE` - From the entity itself
- `OFFICIAL_REGISTRY` - From public registries
- `PRODUCT_LABEL` - From product labels
- `WEBSITE` - From entity website
- `API_IMPORT` - Imported via API
- `MANUAL_ENTRY` - Manual entry

### VerificationStatus
Informational verification (NOT legal certification):
- `UNVERIFIED` - Not yet verified
- `COMMUNITY_CONFIRMED` - Confirmed by community
- `PRIMARY_CONFIRMED` - Confirmed by primary source
- `HISTORICAL` - May need update
- `DISPUTED` - Data is disputed
- `OUTDATED` - Marked as outdated

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
