// 2025/26 UK Tax Rates
export const TAX_YEAR = '2025/26';

export const ENGLAND_WALES_NI = {
  personalAllowance: 12570,
  basicRateLimit: 50270,       // PA + basic band (37,700)
  higherRateLimit: 125140,     // above this = additional rate
  paWithdrawalStart: 100000,   // PA reduces £1 per £2 above this
  basicRate: 0.20,
  higherRate: 0.40,
  additionalRate: 0.45,
};

export const SCOTLAND = {
  personalAllowance: 12570,
  paWithdrawalStart: 100000,
  higherRateLimit: 125140,
  bands: [
    { name: 'Starter',      from: 12570,  to: 14876,  rate: 0.19 },
    { name: 'Basic',        from: 14876,  to: 26561,  rate: 0.20 },
    { name: 'Intermediate', from: 26561,  to: 43662,  rate: 0.21 },
    { name: 'Higher',       from: 43662,  to: 75000,  rate: 0.42 },
    { name: 'Advanced',     from: 75000,  to: 125140, rate: 0.45 },
    { name: 'Top',          from: 125140, to: Infinity, rate: 0.48 },
  ],
};

export const NATIONAL_INSURANCE = {
  primaryThreshold: 12570,
  upperEarningsLimit: 50270,
  mainRate: 0.08,
  upperRate: 0.02,
};

export const STUDENT_LOAN = {
  plan1: { threshold: 24990, rate: 0.09 },
  plan2: { threshold: 27295, rate: 0.09 },
  plan4: { threshold: 31395, rate: 0.09 },  // Scotland
  plan5: { threshold: 25000, rate: 0.09 },  // From Aug 2023
  postgrad: { threshold: 21000, rate: 0.06 },
};

export const PENSION_BASIC_RATE_RELIEF = 0.20;
