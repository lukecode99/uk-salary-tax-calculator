import {
  ENGLAND_WALES_NI,
  SCOTLAND,
  NATIONAL_INSURANCE,
  STUDENT_LOAN,
  PENSION_BASIC_RATE_RELIEF,
} from './taxRates';

export type StudentLoanPlan = 'none' | 'plan1' | 'plan2' | 'plan4' | 'plan5' | 'postgrad';
export type AgeGroup = 'under65' | '65to74' | 'over75';
export type Period = 'annual' | 'monthly' | 'weekly' | 'daily' | 'hourly';

export interface TaxInputs {
  grossSalary: number;          // annual
  pensionPercent: number;       // e.g. 5 = 5%
  scottishRates: boolean;
  studentLoan: StudentLoanPlan;
  payNI: boolean;
  ageGroup: AgeGroup;
  hoursPerWeek: number;
  daysPerWeek: number;
}

export interface PensionBreakdown {
  grossContribution: number;      // total going into pension
  employeeCost: number;           // what employee actually pays from salary
  autoRelief: number;             // 20% basic rate added by provider (RAS) or tax saving (NPA)
  selfAssessmentClaim: number;    // extra relief claimable via tax return (higher/additional rate)
  effectiveCost: number;          // true net cost after all relief
}

export interface TaxResult {
  grossSalary: number;
  pension: PensionBreakdown;
  taxableIncome: number;
  incomeTax: number;
  nationalInsurance: number;
  studentLoanRepayment: number;
  takeHome: number;
}

export interface PeriodResult {
  annual: TaxResult;
  monthly: TaxResult;
  weekly: TaxResult;
  daily: TaxResult;
  hourly: TaxResult;
}

function calcPersonalAllowance(grossIncome: number): number {
  const { personalAllowance, paWithdrawalStart } = ENGLAND_WALES_NI;
  if (grossIncome <= paWithdrawalStart) return personalAllowance;
  const reduction = Math.floor((grossIncome - paWithdrawalStart) / 2);
  return Math.max(0, personalAllowance - reduction);
}

function calcIncomeTaxEngland(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  const { basicRateLimit, higherRateLimit, basicRate, higherRate, additionalRate, personalAllowance } = ENGLAND_WALES_NI;

  const basicBandSize = basicRateLimit - personalAllowance; // 37,700
  let tax = 0;

  if (taxableIncome <= basicBandSize) {
    tax = taxableIncome * basicRate;
  } else if (taxableIncome <= higherRateLimit - personalAllowance) {
    tax = basicBandSize * basicRate + (taxableIncome - basicBandSize) * higherRate;
  } else {
    const higherBandSize = higherRateLimit - basicRateLimit;
    tax = basicBandSize * basicRate + higherBandSize * higherRate + (taxableIncome - (higherRateLimit - personalAllowance)) * additionalRate;
  }

  return tax;
}

function calcIncomeTaxScotland(grossIncome: number, pa: number): number {
  const taxableIncome = Math.max(0, grossIncome - pa);
  if (taxableIncome <= 0) return 0;

  let tax = 0;
  for (const band of SCOTLAND.bands) {
    const bandIncome = Math.min(taxableIncome + pa, band.to) - Math.max(pa, band.from);
    if (bandIncome > 0) {
      tax += bandIncome * band.rate;
    }
  }
  return tax;
}

function calcNI(grossSalary: number, ageGroup: AgeGroup, payNI: boolean): number {
  if (!payNI || ageGroup !== 'under65') return 0;
  const { primaryThreshold, upperEarningsLimit, mainRate, upperRate } = NATIONAL_INSURANCE;
  if (grossSalary <= primaryThreshold) return 0;

  let ni = 0;
  if (grossSalary <= upperEarningsLimit) {
    ni = (grossSalary - primaryThreshold) * mainRate;
  } else {
    ni = (upperEarningsLimit - primaryThreshold) * mainRate + (grossSalary - upperEarningsLimit) * upperRate;
  }
  return ni;
}

function calcStudentLoan(grossSalary: number, plan: StudentLoanPlan): number {
  if (plan === 'none') return 0;
  const config = STUDENT_LOAN[plan];
  if (grossSalary <= config.threshold) return 0;
  return (grossSalary - config.threshold) * config.rate;
}

function calcMarginalRate(taxableIncome: number, scottishRates: boolean, pa: number, grossSalary: number): number {
  if (scottishRates) {
    // Determine which Scottish band
    const income = grossSalary;
    for (let i = SCOTLAND.bands.length - 1; i >= 0; i--) {
      if (income > SCOTLAND.bands[i].from) return SCOTLAND.bands[i].rate;
    }
    return 0;
  }
  const { basicRateLimit, higherRateLimit, basicRate, higherRate, additionalRate } = ENGLAND_WALES_NI;
  const basicBandSize = basicRateLimit - pa;
  if (taxableIncome <= basicBandSize) return basicRate;
  if (taxableIncome <= higherRateLimit - pa) return higherRate;
  return additionalRate;
}

function calcPension(grossSalary: number, pensionPercent: number, taxableIncome: number, scottishRates: boolean, pa: number): PensionBreakdown {
  const grossContribution = grossSalary * (pensionPercent / 100);
  // Net pay arrangement: pension deducted pre-tax, employee pays full gross contribution from gross
  const employeeCost = grossContribution;

  // Tax saving = basic rate on the contribution (effectively the "auto relief" in NPA)
  const autoRelief = grossContribution * PENSION_BASIC_RATE_RELIEF;

  // Extra relief for higher/additional rate taxpayers
  const marginalRate = calcMarginalRate(taxableIncome, scottishRates, pa, grossSalary);
  const extraRate = Math.max(0, marginalRate - PENSION_BASIC_RATE_RELIEF);
  const selfAssessmentClaim = grossContribution * extraRate;

  const effectiveCost = employeeCost - autoRelief - selfAssessmentClaim;

  return {
    grossContribution,
    employeeCost,
    autoRelief,
    selfAssessmentClaim,
    effectiveCost,
  };
}

export function calculate(inputs: TaxInputs): TaxResult {
  const {
    grossSalary,
    pensionPercent,
    scottishRates,
    studentLoan,
    payNI,
    ageGroup,
  } = inputs;

  const pa = calcPersonalAllowance(grossSalary);
  const pensionContribution = grossSalary * (pensionPercent / 100);
  // Pension reduces taxable income (net pay arrangement)
  const adjustedGross = grossSalary - pensionContribution;
  const taxableIncome = Math.max(0, adjustedGross - pa);

  const incomeTax = scottishRates
    ? calcIncomeTaxScotland(adjustedGross, pa)
    : calcIncomeTaxEngland(taxableIncome);

  const nationalInsurance = calcNI(grossSalary, ageGroup, payNI);
  const studentLoanRepayment = calcStudentLoan(grossSalary, studentLoan);

  const pension = calcPension(grossSalary, pensionPercent, taxableIncome, scottishRates, pa);

  const takeHome = grossSalary - pensionContribution - incomeTax - nationalInsurance - studentLoanRepayment;

  return {
    grossSalary,
    pension,
    taxableIncome,
    incomeTax,
    nationalInsurance,
    studentLoanRepayment,
    takeHome,
  };
}

const WEEKS_PER_YEAR = 52;

export function toPeriodResult(annual: TaxResult, hoursPerWeek: number, daysPerWeek: number): PeriodResult {
  function scale(result: TaxResult, factor: number): TaxResult {
    return {
      grossSalary: result.grossSalary * factor,
      pension: {
        grossContribution: result.pension.grossContribution * factor,
        employeeCost: result.pension.employeeCost * factor,
        autoRelief: result.pension.autoRelief * factor,
        selfAssessmentClaim: result.pension.selfAssessmentClaim * factor,
        effectiveCost: result.pension.effectiveCost * factor,
      },
      taxableIncome: result.taxableIncome * factor,
      incomeTax: result.incomeTax * factor,
      nationalInsurance: result.nationalInsurance * factor,
      studentLoanRepayment: result.studentLoanRepayment * factor,
      takeHome: result.takeHome * factor,
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
