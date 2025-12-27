import {
    normalizeName,
    normalizeVatId,
    normalizeEmail,
    normalizePhone,
    normalizeWebsite,
    normalizeCountry,
    normalizeAddress,
} from '../src/utils/normalize';

describe('Normalization Utilities', () => {
    describe('normalizeName', () => {
        it('should normalize company names', () => {
            expect(normalizeName('  Test Company  ')).toBe('Test Company');
            expect(normalizeName('test company ltd')).toBe('Test Company');
            expect(normalizeName('ACME Corp.')).toBe('Acme');
        });

        it('should remove Polish legal suffixes', () => {
            expect(normalizeName('Firma Sp. z o.o.')).toBe('Firma');
            expect(normalizeName('Przedsiębiorstwo S.A.')).toBe('Przedsiębiorstwo');
        });

        it('should handle German legal suffixes', () => {
            expect(normalizeName('Unternehmen GmbH')).toBe('Unternehmen');
        });
    });

    describe('normalizeVatId', () => {
        it('should normalize VAT IDs', () => {
            expect(normalizeVatId('PL 123-456-78-90')).toBe('PL1234567890');
            expect(normalizeVatId('de 123.456.789')).toBe('DE123456789');
        });

        it('should return null for empty input', () => {
            expect(normalizeVatId(null)).toBeNull();
            expect(normalizeVatId(undefined)).toBeNull();
        });
    });

    describe('normalizeEmail', () => {
        it('should lowercase emails', () => {
            expect(normalizeEmail('Test@Example.COM')).toBe('test@example.com');
        });

        it('should trim whitespace', () => {
            expect(normalizeEmail('  test@example.com  ')).toBe('test@example.com');
        });

        it('should return null for empty input', () => {
            expect(normalizeEmail('')).toBeNull();
            expect(normalizeEmail(null)).toBeNull();
        });
    });

    describe('normalizePhone', () => {
        it('should keep only digits and leading +', () => {
            expect(normalizePhone('+48 123 456 789')).toBe('+48123456789');
            expect(normalizePhone('(123) 456-7890')).toBe('1234567890');
        });

        it('should return null for empty input', () => {
            expect(normalizePhone(null)).toBeNull();
        });
    });

    describe('normalizeWebsite', () => {
        it('should add https:// if missing', () => {
            expect(normalizeWebsite('example.com')).toBe('https://example.com');
            expect(normalizeWebsite('www.example.com')).toBe('https://www.example.com');
        });

        it('should lowercase URLs', () => {
            expect(normalizeWebsite('HTTPS://EXAMPLE.COM/')).toBe('https://example.com');
        });

        it('should remove trailing slash', () => {
            expect(normalizeWebsite('https://example.com/')).toBe('https://example.com');
        });

        it('should return null for empty input', () => {
            expect(normalizeWebsite('')).toBeNull();
            expect(normalizeWebsite(null)).toBeNull();
        });
    });

    describe('normalizeCountry', () => {
        it('should uppercase country codes', () => {
            expect(normalizeCountry('pl')).toBe('PL');
            expect(normalizeCountry('de')).toBe('DE');
        });

        it('should trim whitespace', () => {
            expect(normalizeCountry('  pl  ')).toBe('PL');
        });
    });

    describe('normalizeAddress', () => {
        it('should normalize addresses', () => {
            expect(normalizeAddress('  ul. testowa  123  ')).toBe('Ul. Testowa 123');
        });

        it('should return null for empty input', () => {
            expect(normalizeAddress(null)).toBeNull();
        });
    });
});
