// UK Tax Rates by tax year
export type TaxYear = '2025/26' | '2026/27';

export const TAX_YEARS: TaxYear[] = ['2025/26', '2026/27'];

// The UK tax year runs 6 April – 5 April. Falls back to the latest
// supported year when today's date is outside the supported range.
export function defaultTaxYear(today: Date = new Date()): TaxYear {
  const y = today.getFullYear();
  const taxYearStart = new Date(y, 3, 6); // 6 April
  const startYear = today >= taxYearStart ? y : y - 1;
  const label = `${startYear}/${String((startYear + 1) % 100).padStart(2, '0')}` as TaxYear;
  return TAX_YEARS.includes(label) ? label : TAX_YEARS[TAX_YEARS.length - 1];
}

// England/Wales/NI income tax, personal allowance, and NI thresholds are
// frozen — identical for every supported year. Only Scottish bands and
// student-loan thresholds differ per year (see RATES below).
export const ENGLAND_WALES_NI = {
  personalAllowance: 12570,
  basicRateLimit: 50270,       // PA + basic band (37,700)
  higherRateLimit: 125140,     // above this = additional rate
  paWithdrawalStart: 100000,   // PA reduces £1 per £2 above this
  basicRate: 0.20,
  higherRate: 0.40,
  additionalRate: 0.45,
};

export interface ScottishBand {
  name: string;
  from: number;
  to: number;
  rate: number;
}

export const SCOTLAND = {
  personalAllowance: 12570,
  paWithdrawalStart: 100000,
  higherRateLimit: 125140,
};

export const NATIONAL_INSURANCE = {
  primaryThreshold: 12570,
  upperEarningsLimit: 50270,
  mainRate: 0.08,
  upperRate: 0.02,
};

export const EMPLOYER_NI = {
  secondaryThreshold: 5000,
  rate: 0.15,
};

export interface StudentLoanConfig {
  threshold: number;
  rate: number;
}

export interface RateSet {
  // from/to are the published gross positions (assume full PA); the engine
  // applies band WIDTHS (to - from) to taxable income so a tapered PA
  // shifts every band down rather than swallowing the lowest bands.
  scotlandBands: ScottishBand[];
  studentLoan: {
    plan1: StudentLoanConfig;
    plan2: StudentLoanConfig;
    plan4: StudentLoanConfig;   // Scotland
    plan5: StudentLoanConfig;   // From Aug 2023
    postgrad: StudentLoanConfig;
  };
}

export const RATES: Record<TaxYear, RateSet> = {
  '2025/26': {
    scotlandBands: [
      { name: 'Starter',      from: 12570,  to: 15397,  rate: 0.19 },
      { name: 'Basic',        from: 15397,  to: 27491,  rate: 0.20 },
      { name: 'Intermediate', from: 27491,  to: 43662,  rate: 0.21 },
      { name: 'Higher',       from: 43662,  to: 75000,  rate: 0.42 },
      { name: 'Advanced',     from: 75000,  to: 125140, rate: 0.45 },
      { name: 'Top',          from: 125140, to: Infinity, rate: 0.48 },
    ],
    studentLoan: {
      plan1: { threshold: 26065, rate: 0.09 },
      plan2: { threshold: 28470, rate: 0.09 },
      plan4: { threshold: 32745, rate: 0.09 },
      plan5: { threshold: 25000, rate: 0.09 },
      postgrad: { threshold: 21000, rate: 0.06 },
    },
  },
  '2026/27': {
    scotlandBands: [
      { name: 'Starter',      from: 12570,  to: 16537,  rate: 0.19 },
      { name: 'Basic',        from: 16537,  to: 29526,  rate: 0.20 },
      { name: 'Intermediate', from: 29526,  to: 43662,  rate: 0.21 },
      { name: 'Higher',       from: 43662,  to: 75000,  rate: 0.42 },
      { name: 'Advanced',     from: 75000,  to: 125140, rate: 0.45 },
      { name: 'Top',          from: 125140, to: Infinity, rate: 0.48 },
    ],
    studentLoan: {
      plan1: { threshold: 26900, rate: 0.09 },
      plan2: { threshold: 29385, rate: 0.09 },
      plan4: { threshold: 33795, rate: 0.09 },
      plan5: { threshold: 25000, rate: 0.09 },
      postgrad: { threshold: 21000, rate: 0.06 },
    },
  },
};

export const PENSION_BASIC_RATE_RELIEF = 0.20;
