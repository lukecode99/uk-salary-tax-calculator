import {
  ENGLAND_WALES_NI,
  SCOTLAND,
  NATIONAL_INSURANCE,
  EMPLOYER_NI,
  RATES,
  RateSet,
  TaxYear,
  defaultTaxYear,
  ScottishBand,
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
  payePensionViaSacrifice?: boolean; // workplace pension by salary sacrifice (reduces NI + SL too)
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
  niSaving: number;               // employee NI saved (salary-sacrifice method only)
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
  privatePension: number;        // gross relief-at-source contribution
  privatePensionPaid: number;    // what actually leaves the bank (gross × 0.8)
  salarySacrifice: number;     // annual £ sacrificed (car, bike, etc.)
  carBiKTaxableValue: number;  // annual BiK value for display
  carBiKTax: number;           // income tax attributable to the BiK
  employerNI: number;          // employer's Class 1 secondary NI + Class 1A on BiK
  employerPension: number;     // employer pension contribution
  employerCost: number;        // gross + employer NI + employer pension
  takeHome: number;            // payslip take-home (private pension not yet deducted)
  takeHomeAfterPrivate: number; // take-home after paying the private pension
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
  payeNiSaving: number;         // employee NI saved (salary-sacrifice method only)
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

// Scottish bands are fixed spans of TAXABLE income (set by the annual Scottish
// Rate Resolution). The published positions assume a full PA, so lower-band
// boundaries convert to taxable by subtracting £12,570 — but the Top rate
// starts at £125,140 of TAXABLE income (where the PA is already nil), matching
// the rUK additional-rate point. Fixed spans mean a tapered PA pushes income
// through the bands rather than expanding them.
function calcIncomeTaxScotland(taxableIncome: number, bands: ScottishBand[]): number {
  if (taxableIncome <= 0) return 0;
  const { personalAllowance, higherRateLimit } = SCOTLAND;
  const toTaxable = (b: number) =>
    b === Infinity || b >= higherRateLimit ? b : Math.max(0, b - personalAllowance);

  let tax = 0;
  for (const band of bands) {
    const from = toTaxable(band.from);
    if (taxableIncome <= from) break;
    tax += (Math.min(taxableIncome, toTaxable(band.to)) - from) * band.rate;
  }
  return tax;
}

// Income tax on a given adjusted gross (PA computed from it) — the single
// entry point used for delta comparisons (BiK tax, pension saving).
function calcIncomeTax(adjustedGross: number, scottishRates: boolean, rates: RateSet): number {
  const pa = calcPersonalAllowance(adjustedGross);
  const taxableIncome = Math.max(0, adjustedGross - pa);
  return scottishRates
    ? calcIncomeTaxScotland(taxableIncome, rates.scotlandBands)
    : calcIncomeTaxEngland(taxableIncome);
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

export interface FullPensionOptions {
  totalSacrifice?: number;     // other salary sacrifice (car, bike) — reduces the tax base
  carBiKValue?: number;        // taxable benefit in kind — raises the tax base
  payeViaSacrifice?: boolean;  // workplace pension taken by salary sacrifice (saves NI too)
}

export function calculateFullPension(
  grossSalary: number,
  payeContrib: number,
  payeEmployerContrib: number,
  privateGrossContrib: number,
  scottishRates: boolean,
  taxYear?: TaxYear,
  opts: FullPensionOptions = {},
): FullPensionResult {
  const rates = RATES[taxYear ?? defaultTaxYear()];
  const totalSacrifice = opts.totalSacrifice ?? 0;
  const biKValue = opts.carBiKValue ?? 0;
  const baseGross = grossSalary - totalSacrifice + biKValue;
  const adjustedGross = baseGross - payeContrib;

  // PAYE net pay: saving = tax without the contribution minus tax with it
  // (delta method — captures PA-taper effects a single marginal rate misses)
  const payeAutoSaving = payeContrib > 0
    ? calcIncomeTax(baseGross, scottishRates, rates) - calcIncomeTax(adjustedGross, scottishRates, rates)
    : 0;
  // No SA claim for PAYE net pay — saving already happens automatically
  const payeSaClaim = 0;
  // Salary-sacrifice workplace pensions also avoid employee NI; net-pay ones don't
  const niBase = grossSalary - totalSacrifice;
  const payeNiSaving = opts.payeViaSacrifice && payeContrib > 0
    ? calcNI(niBase, 'under66', true) - calcNI(niBase - payeContrib, 'under66', true)
    : 0;

  // Private (relief at source): employee pays 80% of gross, provider claims 20%.
  // The extra SA claim is the band-extension relief: HMRC extends the basic and
  // higher limits by the gross contribution, which is identical to taxing
  // (income − gross), so claim = tax delta minus the 20% already at source.
  // This captures the 60% PA-taper zone and band-spanning contributions exactly.
  const privateYouPay = privateGrossContrib * 0.8;
  const privateBasicRelief = privateGrossContrib * 0.2;
  const privateSaClaim = privateGrossContrib > 0
    ? Math.max(0,
        calcIncomeTax(adjustedGross, scottishRates, rates) -
        calcIncomeTax(adjustedGross - privateGrossContrib, scottishRates, rates) -
        privateBasicRelief)
    : 0;

  const totalPot = payeContrib + payeEmployerContrib + privateGrossContrib;
  const totalTaxSaving = payeAutoSaving + payeNiSaving + privateBasicRelief + privateSaClaim;
  const netCostEmployee = payeContrib + privateYouPay - payeAutoSaving - payeNiSaving - privateSaClaim - privateBasicRelief;

  return {
    payeEmployee: payeContrib,
    payeEmployer: payeEmployerContrib,
    payeAutoSaving,
    payeSaClaim,
    payeNiSaving,
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

  // NI and student loan: sacrifice reduces NIable/repayable earnings; BiK
  // attracts neither. A salary-sacrifice workplace pension reduces both bases;
  // a net-pay one reduces neither (it only reduces taxable pay).
  const viaSacrifice = inputs.payePensionViaSacrifice ?? false;
  const niBase = grossSalary - totalSacrifice - (viaSacrifice ? payeContrib : 0);
  const nationalInsurance = calcNI(niBase, ageGroup, payNI);
  const studentLoanRepayment = calcStudentLoan(niBase, studentLoan, rates);

  // Pension saving via delta: tax on the same basis without the PAYE
  // contribution minus tax with it (BiK included in both legs)
  const autoTaxSaving = payeContrib > 0
    ? calcIncomeTax(adjustedGrossWithBiK + payeContrib, scottishRates, rates) - incomeTax
    : 0;
  const niSaving = viaSacrifice && payeContrib > 0
    ? calcNI(grossSalary - totalSacrifice, ageGroup, payNI) - nationalInsurance
    : 0;
  const pension: PensionBreakdown = {
    employeeContrib: payeContrib,
    autoTaxSaving,
    niSaving,
    selfAssessmentClaim: 0, // PAYE — full relief is automatic
    effectiveCost: payeContrib - autoTaxSaving - niSaving,
  };

  // Cost to employer: gross pay + Class 1 NI on post-sacrifice pay
  // + Class 1A NI on any BiK + employer pension
  const employerNI = calcEmployerNI(niBase) + biKValue * EMPLOYER_NI.rate;
  const employerCost = grossSalary + employerNI + employerPension;

  const takeHome = grossSalary - payeContrib - totalSacrifice - incomeTax - nationalInsurance - studentLoanRepayment;
  // Relief at source: the private pension leaves the bank AFTER payroll,
  // at 80% of the gross contribution
  const privatePensionPaid = privateContrib * 0.8;
  const takeHomeAfterPrivate = takeHome - privatePensionPaid;
  // ANI includes taxable benefits (BiK) and deducts gross pension contributions
  const adjustedNetIncome = Math.max(0, grossSalary - payeContrib - totalSacrifice + biKValue - privateContrib);

  return {
    grossSalary,
    pension,
    adjustedNetIncome,
    taxableIncome,
    incomeTax,
    nationalInsurance,
    studentLoanRepayment,
    privatePension: privateContrib,
    privatePensionPaid,
    salarySacrifice: totalSacrifice,
    carBiKTaxableValue: biKValue,
    carBiKTax,
    employerNI,
    employerPension,
    employerCost,
    takeHome,
    takeHomeAfterPrivate,
  };
}

// ---- Adjusted Net Income (for the childcare £100k cliff-edge) ----
// ANI = total taxable income minus grossed-up pension contributions and Gift Aid.
// On the Pension screen the reduction we model is workplace (net-pay) employee
// contributions plus the GROSS of any relief-at-source private contribution; both
// reduce ANI. Employer contributions do not. If ANI is £100,000 or more, Tax-Free
// Childcare and the 15/30 funded hours are lost entirely — no taper, a hard cut-off,
// tested per parent.
export const CHILDCARE_ANI_THRESHOLD = 100000;

export interface AniResult {
  grossSalary: number;
  pensionDeduction: number;    // payeEmployee + privateGross + salary sacrifice
  biKValue: number;            // taxable benefits (e.g. company-car BiK) — adds to ANI
  adjustedNetIncome: number;
  threshold: number;
  isOver: boolean;             // true if ANI >= threshold (childcare support lost)
  headroom: number;            // if under: how much more income before the cliff (>= 0)
  overBy: number;              // if over: how far over the threshold (>= 0)
  grossPensionToThreshold: number; // extra gross pension needed to land on the threshold
  netPensionToThreshold: number;   // what you physically pay via relief at source (× 0.8)
}

// pensionDeduction = net-pay employee contributions + gross relief-at-source
// contributions + salary sacrifice. biKValue (taxable benefits) ADDS to ANI.
export function calculateAni(grossSalary: number, pensionDeduction: number, biKValue: number = 0): AniResult {
  const ani = Math.max(0, grossSalary - pensionDeduction + biKValue);
  const threshold = CHILDCARE_ANI_THRESHOLD;
  const isOver = ani >= threshold;
  const overBy = isOver ? ani - threshold : 0;
  return {
    grossSalary,
    pensionDeduction,
    biKValue,
    adjustedNetIncome: ani,
    threshold,
    isOver,
    headroom: isOver ? 0 : threshold - ani,
    overBy,
    grossPensionToThreshold: overBy,
    netPensionToThreshold: overBy * 0.8,
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
        niSaving: r.pension.niSaving * f,
        selfAssessmentClaim: r.pension.selfAssessmentClaim * f,
        effectiveCost: r.pension.effectiveCost * f,
      },
      adjustedNetIncome: r.adjustedNetIncome * f,
      taxableIncome: r.taxableIncome * f,
      incomeTax: r.incomeTax * f,
      nationalInsurance: r.nationalInsurance * f,
      studentLoanRepayment: r.studentLoanRepayment * f,
      privatePension: r.privatePension * f,
      privatePensionPaid: r.privatePensionPaid * f,
      salarySacrifice: r.salarySacrifice * f,
      carBiKTaxableValue: r.carBiKTaxableValue * f,
      carBiKTax: r.carBiKTax * f,
      employerNI: r.employerNI * f,
      employerPension: r.employerPension * f,
      employerCost: r.employerCost * f,
      takeHome: r.takeHome * f,
      takeHomeAfterPrivate: r.takeHomeAfterPrivate * f,
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
