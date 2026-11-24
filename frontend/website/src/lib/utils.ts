import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function rupeesToPaise(value: number | string): number {
    if (typeof value === "string") {
        const normalized = value.trim();
        if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(normalized)) return 0;
        const [rupees, paise = ""] = normalized.split(".");
        return Number(rupees) * 100 + Number(paise.padEnd(2, "0").slice(0, 2));
    }
    if (!Number.isFinite(value)) return 0;
    const rupees = Math.trunc(value);
    const paise = Math.round((value - rupees) * 100);
    return rupees * 100 + paise;
}

export function paiseToRupeesString(paise: number): string {
    const safePaise = Number.isSafeInteger(paise) ? paise : 0;
    const absolute = Math.abs(safePaise);
    const rupees = Math.trunc(absolute / 100);
    const remainder = absolute % 100;
    const sign = safePaise < 0 ? "-" : "";
    return `${sign}${rupees}.${remainder.toString().padStart(2, "0")}`;
}

export function paiseDiscount(discountPercentHundredths: number, subtotalPaise: number): number {
    if (!Number.isSafeInteger(subtotalPaise) || !Number.isSafeInteger(discountPercentHundredths)) return 0;
    if (discountPercentHundredths <= 0) return subtotalPaise;
    if (discountPercentHundredths >= 10000) return 0;
    return Math.floor((subtotalPaise * (10000 - discountPercentHundredths) + 5000) / 10000);
}

export function generateWhatsAppMessage(
    date: string,
    revenue: number,
    footfall: number,
    lowStock: any[]
) {
    const alerts = lowStock.length > 0
        ? lowStock.map(i => `[ALERT] ${i.clinic_name} is low on '${i.item_name}'.`).join('\n   ')
        : 'All systems synced.'

    return encodeURIComponent(
        `*JEEVIKA CLINICAL INTELLIGENCE REPORT*\n` +
        `Date: ${date}\n` +
        `Total Revenue: ₹${revenue}\n` +
        `Total Patients: ${footfall}\n` +
        `${alerts}`
    )
}
export function getStartOfTodayIST() {
    const now = new Date();
    const istDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(now);
    return `${istDate}T00:00:00+05:30`;
}

export function getTodayIST() {
    const now = new Date();
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(now); // Returns YYYY-MM-DD
}

export function numberToWords(num: number): string {
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const inWords = (n: number): string => {
        if (n < 20) return a[n] ?? '';
        if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' : '') + a[n % 10];
        if (n < 1000) return a[Math.floor(n / 100)] + 'Hundred ' + (n % 100 !== 0 ? 'and ' + inWords(n % 100) : '');
        if (n < 100000) return inWords(Math.floor(n / 1000)) + 'Thousand ' + (n % 1000 !== 0 ? inWords(n % 1000) : '');
        if (n < 10000000) return inWords(Math.floor(n / 100000)) + 'Lakh ' + (n % 100000 !== 0 ? inWords(n % 100000) : '');
        return inWords(Math.floor(n / 10000000)) + 'Crore ' + (n % 10000000 !== 0 ? inWords(n % 10000000) : '');
    };

    const whole = Math.floor(Math.abs(num));
    const decimal = Math.round((Math.abs(num) - whole) * 100);
    
    let result = inWords(whole) + 'Rupees ';
    if (decimal > 0) {
        result += 'and ' + inWords(decimal) + 'Paise ';
    }
    return result + 'Only';
}
