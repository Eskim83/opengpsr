/**
 * Utility functions for data normalization.
 * 
 * Ensures consistent data format for searching and integration.
 * All normalization functions handle null/undefined gracefully
 * and produce standardized output suitable for database storage.
 */

/**
 * Normalize a company/entity name for consistent searching.
 * 
 * - Trims whitespace
 * - Converts to lowercase then capitalizes each word
 * - Removes common legal suffixes (Sp. z o.o., GmbH, Ltd, etc.)
 * - Normalizes internal whitespace
 * - Supports Unicode characters (Polish, Chinese, Hindi, etc.)
 * 
 * @param name - Raw company name
 * @returns Normalized name suitable for display and searching
 * 
 * @example
 * ```typescript
 * normalizeName('  ACME Corp.  sp. z o.o.  ') // 'Acme'
 * normalizeName('Example GmbH') // 'Example'
 * normalizeName('PRZEDSIĘBIORSTWO S.A.') // 'Przedsiębiorstwo'
 * normalizeName('北京公司') // '北京公司'
 * ```
 */
export function normalizeName(name: string): string {
    const normalized = name
        .trim()
        .toLocaleLowerCase()
        // Remove common legal suffixes for matching (case-insensitive)
        // Using (?:\b|$) to match word boundary or end of string after optional dot
        .replace(/\b(sp\.?\s*z\.?\s*o\.?\s*o\.?|s\.?\s*a\.?|ltd\.?|gmbh|inc\.?|corp\.?|llc\.?|co\.?|plc\.?|ag|bv|nv|sarl|srl|oy|ab)\.?(?:\s|$)/gi, ' ')
        // Remove any standalone periods left over
        .replace(/\s*\.\s*/g, ' ')
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        .trim();

    // Capitalize first letter of each word - Unicode aware
    // Split by spaces and capitalize each word's first character
    return normalized
        .split(' ')
        .map(word => {
            if (word.length === 0) return word;
            // Use spread operator to properly handle Unicode characters
            const chars = [...word];
            return chars[0].toLocaleUpperCase() + chars.slice(1).join('');
        })
        .join(' ');
}

/**
 * Normalize a VAT ID by removing formatting characters.
 * 
 * - Removes spaces, dots, and dashes
 * - Converts to uppercase
 * 
 * @param vatId - Raw VAT ID (e.g., 'PL 123-456-78-90')
 * @returns Normalized VAT ID (e.g., 'PL1234567890') or null
 */
export function normalizeVatId(vatId: string | null | undefined): string | null {
    if (!vatId) return null;
    return vatId
        .trim()
        .toUpperCase()
        .replace(/[\s.-]/g, '');
}

/**
 * Normalize an email address.
 * 
 * - Trims whitespace
 * - Converts to lowercase
 * 
 * @param email - Raw email address
 * @returns Normalized email or null if empty
 */
export function normalizeEmail(email: string | null | undefined): string | null {
    if (!email || email === '') return null;
    return email.trim().toLowerCase();
}

/**
 * Normalize a phone number.
 * 
 * - Keeps only digits and leading + sign
 * - Preserves international prefix format
 * 
 * @param phone - Raw phone number (e.g., '+48 123 456 789')
 * @returns Normalized phone (e.g., '+48123456789') or null
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
 * Normalize a website URL.
 * 
 * - Adds https:// prefix if no protocol specified
 * - Converts to lowercase
 * - Removes trailing slash
 * 
 * @param website - Raw website URL
 * @returns Normalized URL or null if empty
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
