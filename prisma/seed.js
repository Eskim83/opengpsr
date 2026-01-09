"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🌱 Seeding database...');
    // Create a community source
    const communitySource = await prisma.source.create({
        data: {
            sourceType: client_1.SourceType.COMMUNITY,
            sourceName: 'Community Contribution',
            description: 'Data contributed by the OpenGPSR community',
            trustNote: 'Community-sourced data - verify before use',
        },
    });
    // Create an official registry source
    const registrySource = await prisma.source.create({
        data: {
            sourceType: client_1.SourceType.OFFICIAL_REGISTRY,
            sourceName: 'EU Business Registry',
            description: 'European business registry data',
            sourceUrl: 'https://e-justice.europa.eu/content_find_a_company-489-en.do',
        },
    });
    // Create sample entities
    const entities = [
        {
            name: 'Przykładowa Firma Produkcyjna Sp. z o.o.',
            country: 'PL',
            city: 'Warszawa',
            address: 'ul. Przemysłowa 123',
            vatId: 'PL1234567890',
            email: 'kontakt@przykladowa-firma.pl',
            website: 'https://przykladowa-firma.pl',
            role: client_1.RoleType.MANUFACTURER,
        },
        {
            name: 'Import GmbH',
            country: 'DE',
            city: 'Berlin',
            address: 'Industriestraße 45',
            vatId: 'DE987654321',
            email: 'info@import-gmbh.de',
            role: client_1.RoleType.IMPORTER,
        },
        {
            name: 'EU Safety Representative Ltd',
            country: 'IE',
            city: 'Dublin',
            address: '100 Grand Canal Street',
            vatId: 'IE1234567T',
            email: 'safety@eu-rep.ie',
            website: 'https://eu-rep.ie',
            role: client_1.RoleType.RESPONSIBLE_PERSON,
            marketContext: 'EU',
        },
        {
            name: 'Nordic Electronics AB',
            country: 'SE',
            city: 'Stockholm',
            address: 'Elektronikvägen 10',
            vatId: 'SE556677889901',
            email: 'contact@nordic-electronics.se',
            role: client_1.RoleType.MANUFACTURER,
        },
        {
            name: 'France Distribution SARL',
            country: 'FR',
            city: 'Lyon',
            address: '25 Rue du Commerce',
            vatId: 'FR12345678901',
            email: 'contact@france-distribution.fr',
            role: client_1.RoleType.DISTRIBUTOR,
        },
    ];
    for (const entityData of entities) {
        const entity = await prisma.entity.create({
            data: {
                normalizedName: entityData.name,
                normalizedAddress: entityData.address,
                normalizedCity: entityData.city,
                normalizedCountry: entityData.country,
                normalizedVatId: entityData.vatId,
                normalizedEmail: entityData.email,
                normalizedWebsite: entityData.website,
                roles: {
                    create: {
                        roleType: entityData.role,
                        marketContext: entityData.marketContext,
                    },
                },
                versions: {
                    create: {
                        sourceId: communitySource.id,
                        originalData: entityData,
                        normalizedData: {
                            normalizedName: entityData.name,
                            normalizedAddress: entityData.address,
                            normalizedCity: entityData.city,
                            normalizedCountry: entityData.country,
                            normalizedVatId: entityData.vatId,
                            normalizedEmail: entityData.email,
                            normalizedWebsite: entityData.website,
                        },
                        isCurrent: true,
                    },
                },
            },
        });
        // Add verification for some entities
        if (entityData.country === 'PL' || entityData.country === 'DE') {
            const version = await prisma.entityVersion.findFirst({
                where: { entityId: entity.id, isCurrent: true },
            });
            if (version) {
                await prisma.verificationRecord.create({
                    data: {
                        versionId: version.id,
                        status: client_1.VerificationStatusType.COMMUNITY_CONFIRMED,
                        verifiedBy: 'seed-script',
                        verificationMethod: 'Initial seed data',
                        notes: 'Sample data for development and testing',
                    },
                });
            }
        }
        console.log(`  ✅ Created entity: ${entity.normalizedName}`);
    }
    console.log('\n✨ Seeding completed successfully!');
    console.log(`   Created ${entities.length} entities`);
    console.log(`   Created 2 sources`);
}
main()
    .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map