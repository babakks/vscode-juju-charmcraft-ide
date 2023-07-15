export function toValidSymbol(value: string): string {
    return value.replace(/-/g, '_');
}