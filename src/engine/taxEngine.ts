import {
  ENGLAND_WALES_NI,
  NATIONAL_INSURANCE,
  EMPLOYER_NI,
  RATES,
  RateSet,
  TaxYear,
  defaultTaxYear,
  ScottishBand,
  PENSION_BASIC_RATE_RELIEF,
} from './taxRates';

export type StudentLoanPlan = 'none' | 'plan1' | 'plan2' | 'plan4' | 'plan5' | 'postgrad';
// NI stops at State Pension Age (currently 66). Labels display "Under 66", "66-74", "75+".
export type AgeGroup = 'under66' | '66to74' | 'over75';
export type Period = 'annual' | 'monthly' | 'weekly' | 'daily' | 'hourly';

export interface TaxInputs {
  grossSalary: number;
  payeContrib: number;          // annual £ PAYE employee pension contribution
  privateContrib?: number;      // annual £ private pension gross contribution
  totalSalaryScrifice?: number; // annual £ total salary sacrifice (car, bike, etc.)
  carBiKValue?: number;         // annual taxable BiK value (P11D × rate) — adds to income tax only
  employerPensionContrib?: number; // annual £ employer pension (for cost-to-employer)
  taxYear?: TaxYear;            // defaults to the current tax year
  scottishRates: boolean;
  studentLoan: StudentLoanPlan;
  payNI: boolean;
  ageGroup: AgeGroup;
  hoursPerWeek: number;
  daysPerWeek: number;
}

export interface PensionBreakdown {
  employeeContrib: number;
  autoTaxSaving: number;          // income tax saved on pension contribution
  selfAssessmentClaim: number;    // extra relief for higher/additional rate taxpayers
  effectiveCost: number;          // true net cost after all relief
}

export interface TaxResult {
  grossSalary: number;
  pension: PensionBreakdown;
  adjustedNetIncome: number;
  taxableIncome: number;
  incomeTax: number;
  nationalInsurance: number;
  studentLoanRepayment: number;
  privatePension: number;
  salarySacrifice: number;     // annual £ sacrificed (car, bike, etc.)
  carBiKTaxableValue: number;  // annual BiK value for display
  carBiKTax: number;           // income tax attributable to the BiK
  employerNI: number;          // employer's Class 1 secondary NI
  employerPension: number;     // employer pension contribution
  employerCost: number;        // gross + employer NI + employer pension
  takeHome: number;
}

export interface PeriodResult {
  annual: TaxResult;
  monthly: TaxResult;
  weekly: TaxResult;
  daily: TaxResult;
  hourly: TaxResult;
}

export interface FullPensionResult {
  // PAYE pension
  payeEmployee: number;
  payeEmployer: number;
  payeAutoSaving: number;       // income tax saved (tax without contrib − tax with)
  payeSaClaim: number;          // extra SA claim for HR/AR beyond basic 20%
  // Private pension (relief at source)
  privateGross: number;         // gross contribution going in
  privateYouPay: number;        // what employee physically pays (gross × 0.8)
  privateBasicRelief: number;   // HMRC adds 20% (gross × 0.2)
  privateSaClaim: number;       // extra SA claim for HR/AR
  // Totals
  totalPot: number;
  totalTaxSaving: number;
  netCostEmployee: number;
}

// PA taper uses adjusted net income (post pension-contribution income)
function calcPersonalAllowance(adjustedIncome: number): number {
  const { personalAllowance, paWithdrawalStart } = ENGLAND_WALES_NI;
  if (adjustedIncome <= paWithdrawalStart) return personalAllowance;
  const reduction = Math.floor((adjustedIncome - paWithdrawalStart) / 2);
  return Math.max(0, personalAllowance - reduction);
}

// Bands are fixed spans of TAXABLE income — they do not expand when the PA
// tapers. Basic = first £37,700 taxable; higher = £37,701–£125,140 taxable;
// additional above (PA is always £0 by the time taxable exceeds £125,140).
function calcIncomeTaxEngland(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  const { personalAllowance, basicRateLimit, higherRateLimit, basicRate, higherRate, additionalRate } = ENGLAND_WALES_NI;
  const basicBandSize = basicRateLimit - personalAllowance; // 37,700
  const higherBandMax = higherRateLimit;                    // 125,140 of taxable income

  if (taxableIncome <= basicBandSize) {
    return taxableIncome * basicRate;
  } else if (taxableIncome <= higherBandMax) {
    return basicBandSize * basicRate + (taxableIncome - basicBandSize) * higherRate;
  } else {
    const higherBandSize = higherBandMax - basicBandSize;
    return basicBandSize * basicRate + higherBandSize * higherRate +
      (taxableIncome - higherBandMax) * additionalRate;
  }
}

// Scottish bands apply as fixed WIDTHS of taxable income (starter = first
// £3,967 taxable, basic = next £12,989, ...) so income between a tapered PA
// and £12,570 gross is still banded.
function calcIncomeTaxScotland(grossIncome: number, pa: number, bands: ScottishBand[]): number {
  let remaining = Math.max(0, grossIncome - pa);
  if (remaining <= 0) return 0;

  let tax = 0;
  for (const band of bands) {
    const width = band.to === Infinity ? Infinity : band.to - band.from;
    const slice = Math.min(remaining, width);
    tax += slice * band.rate;
    remaining -= slice;
    if (remaining <= 0) break;
  }
  return tax;
}

// Income tax on a given adjusted gross (PA computed from it) — the single
// entry point used for delta comparisons (BiK tax, pension saving).
function calcIncomeTax(adjustedGross: number, scottishRates: boolean, rates: RateSet): number {
  const pa = calcPersonalAllowance(adjustedGross);
  return scottishRates
    ? calcIncomeTaxScotland(adjustedGross, pa, rates.scotlandBands)
    : calcIncomeTaxEngland(Math.max(0, adjustedGross - pa));
}

function calcNI(grossSalary: number, ageGroup: AgeGroup, payNI: boolean): number {
  if (!payNI || ageGroup !== 'under66') return 0;
  const { primaryThreshold, upperEarningsLimit, mainRate, upperRate } = NATIONAL_INSURANCE;
  if (grossSalary <= primaryThreshold) return 0;
  if (grossSalary <= upperEarningsLimit) {
    return (grossSalary - primaryThreshold) * mainRate;
  }
  return (upperEarningsLimit - primaryThreshold) * mainRate +
    (grossSalary - upperEarningsLimit) * upperRate;
}

// Employer Class 1 secondary NI: 15% on everything above the £5,000
// secondary threshold (no upper limit). Sacrifice reduces NIable pay.
function calcEmployerNI(niableEarnings: number): number {
  const { secondaryThreshold, rate } = EMPLOYER_NI;
  return Math.max(0, niableEarnings - secondaryThreshold) * rate;
}

function calcStudentLoan(grossSalary: number, plan: StudentLoanPlan, rates: RateSet): number {
  if (plan === 'none') return 0;
  const config = rates.studentLoan[plan];
  if (grossSalary <= config.threshold) return 0;
  return (grossSalary - config.threshold) * config.rate;
}

function calcMarginalRate(
  taxableIncome: number,
  scottishRates: boolean,
  pa: number,
  adjustedGross: number,
  rates: RateSet,
): number {
  if (scottishRates) {
    const bands = rates.scotlandBands;
    for (let i = bands.length - 1; i >= 0; i--) {
      if (adjustedGross > bands[i].from) return bands[i].rate;
    }
    return 0;
  }
  const { personalAllowance, basicRateLimit, higherRateLimit, basicRate, higherRate, additionalRate } = ENGLAND_WALES_NI;
  if (taxableIncome <= basicRateLimit - personalAllowance) return basicRate;
  if (taxableIncome <= higherRateLimit) return higherRate;
  return additionalRate;
}

export function calculateFullPension(
  grossSalary: number,
  payeContrib: number,
  payeEmployerContrib: number,
  privateGrossContrib: number,
  scottishRates: boolean,
  taxYear?: TaxYear,
): FullPensionResult {
  const rates = RATES[taxYear ?? defaultTaxYear()];
  const adjustedGross = grossSalary - payeContrib;
  const pa = calcPersonalAllowance(adjustedGross);
  const taxableIncome = Math.max(0, adjustedGross - pa);
  const marginalRate = calcMarginalRate(taxableIncome, scottishRates, pa, adjustedGross, rates);

  // PAYE net pay: saving = tax without the contribution minus tax with it
  // (delta method — captures PA-taper effects a single marginal rate misses)
  const payeAutoSaving = payeContrib > 0
    ? calcIncomeTax(grossSalary, scottishRates, rates) - calcIncomeTax(adjustedGross, scottishRates, rates)
    : 0;
  // No SA claim for PAYE net pay — saving already happens automatically
  const payeSaClaim = 0;

  // Private (relief at source): employee pays 80% of gross, provider claims 20%
  const privateYouPay = privateGrossContrib * 0.8;
  const privateBasicRelief = privateGrossContrib * 0.2;
  const privateSaClaim = privateGrossContrib * Math.max(0, marginalRate - PENSION_BASIC_RATE_RELIEF);

  const totalPot = payeContrib + payeEmployerContrib + privateGrossContrib;
  const totalTaxSaving = payeAutoSaving + privateBasicRelief + privateSaClaim;
  const netCostEmployee = payeContrib + privateYouPay - payeAutoSaving - privateSaClaim - privateBasicRelief;

  return {
    payeEmployee: payeContrib,
    payeEmployer: payeEmployerContrib,
    payeAutoSaving,
    payeSaClaim,
    privateGross: privateGrossContrib,
    privateYouPay,
    privateBasicRelief,
    privateSaClaim,
    totalPot,
    totalTaxSaving,
    netCostEmployee,
  };
}

export function calculate(inputs: TaxInputs): TaxResult {
  const { grossSalary, payeContrib, scottishRates, studentLoan, payNI, ageGroup } = inputs;
  const privateContrib = inputs.privateContrib ?? 0;
  const totalSacrifice = inputs.totalSalaryScrifice ?? 0;
  const biKValue = inputs.carBiKValue ?? 0;
  const employerPension = inputs.employerPensionContrib ?? 0;
  const rates = RATES[inputs.taxYear ?? defaultTaxYear()];

  // Salary sacrifice + PAYE pension reduce taxable gross; BiK adds to it for income tax only
  const adjustedGross = grossSalary - payeContrib - totalSacrifice;
  const adjustedGrossWithBiK = adjustedGross + biKValue;
  const pa = calcPersonalAllowance(adjustedGrossWithBiK);
  const taxableIncome = Math.max(0, adjustedGrossWithBiK - pa);

  const incomeTax = calcIncomeTax(adjustedGrossWithBiK, scottishRates, rates);

  // BiK tax = tax difference attributable to the BiK benefit
  const carBiKTax = incomeTax - calcIncomeTax(adjustedGross, scottishRates, rates);

  // NI and student loan: sacrifice reduces NIable/repayable earnings; BiK attracts neither
  const nationalInsurance = calcNI(grossSalary - totalSacrifice, ageGroup, payNI);
  const studentLoanRepayment = calcStudentLoan(grossSalary - totalSacrifice, studentLoan, rates);

  // Pension saving via delta: tax on the same basis without the PAYE
  // contribution minus tax with it (BiK included in both legs)
  const autoTaxSaving = payeContrib > 0
    ? calcIncomeTax(adjustedGrossWithBiK + payeContrib, scottishRates, rates) - incomeTax
    : 0;
  const pension: PensionBreakdown = {
    employeeContrib: payeContrib,
    autoTaxSaving,
    selfAssessmentClaim: 0, // PAYE net pay — full relief is automatic
    effectiveCost: payeContrib - autoTaxSaving,
  };

  // Cost to employer: gross pay + employer NI on post-sacrifice pay + employer pension
  const employerNI = calcEmployerNI(grossSalary - totalSacrifice);
  const employerCost = grossSalary + employerNI + employerPension;

  const takeHome = grossSalary - payeContrib - totalSacrifice - incomeTax - nationalInsurance - studentLoanRepayment;
  const adjustedNetIncome = grossSalary - payeContrib - totalSacrifice - privateContrib;

  return {
    grossSalary,
    pension,
    adjustedNetIncome,
    taxableIncome,
    incomeTax,
    nationalInsurance,
    studentLoanRepayment,
    privatePension: privateContrib,
    salarySacrifice: totalSacrifice,
    carBiKTaxableValue: biKValue,
    carBiKTax,
    employerNI,
    employerPension,
    employerCost,
    takeHome,
  };
}

const WEEKS_PER_YEAR = 52;

export function toPeriodResult(annual: TaxResult, hoursPerWeek: number, daysPerWeek: number): PeriodResult {
  function scale(r: TaxResult, f: number): TaxResult {
    return {
      grossSalary: r.grossSalary * f,
      pension: {
        employeeContrib: r.pension.employeeContrib * f,
        autoTaxSaving: r.pension.autoTaxSaving * f,
        selfAssessmentClaim: r.pension.selfAssessmentClaim * f,
        effectiveCost: r.pension.effectiveCost * f,
      },
      adjustedNetIncome: r.adjustedNetIncome * f,
      taxableIncome: r.taxableIncome * f,
      incomeTax: r.incomeTax * f,
      nationalInsurance: r.nationalInsurance * f,
      studentLoanRepayment: r.studentLoanRepayment * f,
      privatePension: r.privatePension * f,
      salarySacrifice: r.salarySacrifice * f,
      carBiKTaxableValue: r.carBiKTaxableValue * f,
      carBiKTax: r.carBiKTax * f,
      employerNI: r.employerNI * f,
      employerPension: r.employerPension * f,
      employerCost: r.employerCost * f,
      takeHome: r.takeHome * f,
    };
  }

  return {
    annual,
    monthly: scale(annual, 1 / 12),
    weekly: scale(annual, 1 / WEEKS_PER_YEAR),
    daily: scale(annual, 1 / (WEEKS_PER_YEAR * daysPerWeek)),
    hourly: scale(annual, 1 / (WEEKS_PER_YEAR * hoursPerWeek)),
  };
}
