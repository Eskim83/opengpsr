/**
 * Utility functions for data normalization
 * Ensures consistent data format for search and integration
 */

/**
 * Normalize a company/entity name for consistent searching
 */
export function normalizeName(name: string): string {
    return name
        .trim()
        .toLowerCase()
        // Remove common legal suffixes for matching
        .replace(/\b(sp\.?\s*z\.?\s*o\.?\s*o\.?|s\.?a\.?|ltd\.?|gmbh|inc\.?|corp\.?|llc\.?)\b/gi, '')
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        .trim()
        // Capitalize first letter of each word for display
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Normalize a VAT ID by removing spaces and converting to uppercase
 */
export function normalizeVatId(vatId: string | null | undefined): string | null {
    if (!vatId) return null;
    return vatId
        .trim()
        .toUpperCase()
        .replace(/[\s.-]/g, '');
}

/**
 * Normalize an email address
 */
export function normalizeEmail(email: string | null | undefined): string | null {
    if (!email || email === '') return null;
    return email.trim().toLowerCase();
}

/**
 * Normalize a phone number (basic normalization)
 */
export function normalizePhone(phone: string | null | undefined): string | null {
    if (!phone) return null;
    // Keep only digits and leading +
    const cleaned = phone.trim();
    if (cleaned.startsWith('+')) {
        return '+' + cleaned.slice(1).replace(/\D/g, '');
    }
    return cleaned.replace(/\D/g, '');
}

/**
 * Normalize a website URL
 */
export function normalizeWebsite(website: string | null | undefined): string | null {
    if (!website || website === '') return null;
    let url = website.trim().toLowerCase();
    // Add https:// if no protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    // Remove trailing slash
    return url.replace(/\/$/, '');
}

/**
 * Normalize country code to uppercase ISO 3166-1 alpha-2
 */
export function normalizeCountry(country: string): string {
    return country.trim().toUpperCase();
}

/**
 * Normalize address string
 */
export function normalizeAddress(address: string | null | undefined): string | null {
    if (!address) return null;
    return address
        .trim()
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        // Capitalize appropriately
        .replace(/\b\w/g, (char) => char.toUpperCase());
}
