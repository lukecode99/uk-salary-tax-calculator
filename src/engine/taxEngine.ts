import {
  ENGLAND_WALES_NI,
  SCOTLAND,
  NATIONAL_INSURANCE,
  STUDENT_LOAN,
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
  carBiKTaxableValue: number;  // annual BiK value for display
  carBiKTax: number;           // income tax attributable to the BiK
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
  payeAutoSaving: number;       // income tax saved (marginal rate × employee contrib)
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

// Pass actual PA so band limits are correct when PA is tapered
function calcIncomeTaxEngland(taxableIncome: number, pa: number): number {
  if (taxableIncome <= 0) return 0;
  const { basicRateLimit, higherRateLimit, basicRate, higherRate, additionalRate } = ENGLAND_WALES_NI;
  const basicBandSize = basicRateLimit - pa;
  const higherBandMax = higherRateLimit - pa;

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
  if (!payNI || ageGroup !== 'under66') return 0;
  const { primaryThreshold, upperEarningsLimit, mainRate, upperRate } = NATIONAL_INSURANCE;
  if (grossSalary <= primaryThreshold) return 0;
  if (grossSalary <= upperEarningsLimit) {
    return (grossSalary - primaryThreshold) * mainRate;
  }
  return (upperEarningsLimit - primaryThreshold) * mainRate +
    (grossSalary - upperEarningsLimit) * upperRate;
}

function calcStudentLoan(grossSalary: number, plan: StudentLoanPlan): number {
  if (plan === 'none') return 0;
  const config = STUDENT_LOAN[plan];
  if (grossSalary <= config.threshold) return 0;
  return (grossSalary - config.threshold) * config.rate;
}

function calcMarginalRate(
  taxableIncome: number,
  scottishRates: boolean,
  pa: number,
  adjustedGross: number,
): number {
  if (scottishRates) {
    for (let i = SCOTLAND.bands.length - 1; i >= 0; i--) {
      if (adjustedGross > SCOTLAND.bands[i].from) return SCOTLAND.bands[i].rate;
    }
    return 0;
  }
  const { basicRateLimit, higherRateLimit, basicRate, higherRate, additionalRate } = ENGLAND_WALES_NI;
  if (taxableIncome <= basicRateLimit - pa) return basicRate;
  if (taxableIncome <= higherRateLimit - pa) return higherRate;
  return additionalRate;
}

function calcPensionBreakdown(
  payeContrib: number,
  taxableIncome: number,
  scottishRates: boolean,
  pa: number,
  adjustedGross: number,
): PensionBreakdown {
  if (payeContrib === 0) {
    return { employeeContrib: 0, autoTaxSaving: 0, selfAssessmentClaim: 0, effectiveCost: 0 };
  }
  const marginalRate = calcMarginalRate(taxableIncome, scottishRates, pa, adjustedGross);
  // PAYE net pay: full marginal rate relief is automatic — no SA claim needed
  const autoTaxSaving = payeContrib * marginalRate;
  return {
    employeeContrib: payeContrib,
    autoTaxSaving,
    selfAssessmentClaim: 0,
    effectiveCost: payeContrib - autoTaxSaving,
  };
}

export function calculateFullPension(
  grossSalary: number,
  payeContrib: number,
  payeEmployerContrib: number,
  privateGrossContrib: number,
  scottishRates: boolean,
): FullPensionResult {
  const adjustedGross = grossSalary - payeContrib;
  const pa = calcPersonalAllowance(adjustedGross);
  const taxableIncome = Math.max(0, adjustedGross - pa);
  const marginalRate = calcMarginalRate(taxableIncome, scottishRates, pa, adjustedGross);

  // PAYE: full saving at marginal rate (net pay arrangement — saving is automatic)
  const payeAutoSaving = payeContrib * marginalRate;
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

  // Salary sacrifice + PAYE pension reduce taxable gross; BiK adds to it for income tax only
  const adjustedGross = grossSalary - payeContrib - totalSacrifice;
  const adjustedGrossWithBiK = adjustedGross + biKValue;
  const pa = calcPersonalAllowance(adjustedGrossWithBiK);
  const taxableIncome = Math.max(0, adjustedGrossWithBiK - pa);

  const incomeTax = scottishRates
    ? calcIncomeTaxScotland(adjustedGrossWithBiK, pa)
    : calcIncomeTaxEngland(taxableIncome, pa);

  // BiK tax = tax difference attributable to the BiK benefit
  const taxableIncomeWithoutBiK = Math.max(0, adjustedGross - calcPersonalAllowance(adjustedGross));
  const incomeTaxWithoutBiK = scottishRates
    ? calcIncomeTaxScotland(adjustedGross, calcPersonalAllowance(adjustedGross))
    : calcIncomeTaxEngland(taxableIncomeWithoutBiK, calcPersonalAllowance(adjustedGross));
  const carBiKTax = incomeTax - incomeTaxWithoutBiK;

  // NI: sacrifice reduces NIable earnings; BiK does NOT attract employee NI
  const nationalInsurance = calcNI(grossSalary - totalSacrifice, ageGroup, payNI);
  const studentLoanRepayment = calcStudentLoan(grossSalary, studentLoan);
  const pension = calcPensionBreakdown(payeContrib, taxableIncomeWithoutBiK, scottishRates, calcPersonalAllowance(adjustedGross), adjustedGross);

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
    carBiKTaxableValue: biKValue,
    carBiKTax,
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
      carBiKTaxableValue: r.carBiKTaxableValue * f,
      carBiKTax: r.carBiKTax * f,
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
