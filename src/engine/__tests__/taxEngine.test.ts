import { calculate, toPeriodResult, TaxInputs, calculateFullPension } from '../taxEngine';

const base: TaxInputs = {
  grossSalary: 0,
  payeContrib: 0,
  scottishRates: false,
  studentLoan: 'none',
  payNI: true,
  ageGroup: 'under66',
  hoursPerWeek: 37.5,
  daysPerWeek: 5,
};

function r2(n: number): number { return Math.round(n * 100) / 100; }

// ─── Personal Allowance ────────────────────────────────────────────────────
describe('Personal Allowance', () => {
  test('full PA at £50,000', () => {
    const res = calculate({ ...base, grossSalary: 50000 });
    expect(res.taxableIncome).toBe(50000 - 12570);
  });

  test('PA tapers above £100,000 — pension reduces adjusted net income', () => {
    // £110k gross, £10k PAYE pension → adjusted net income = £100k → no taper
    const res = calculate({ ...base, grossSalary: 110000, payeContrib: 10000 });
    // adjustedGross = 100000, PA = 12570 (no taper), taxable = 100000 - 12570 = 87430
    expect(res.taxableIncome).toBe(87430);
  });

  test('PA tapers without pension at £110,000', () => {
    const res = calculate({ ...base, grossSalary: 110000 });
    // adjustedGross = 110000, reduction = (110000-100000)/2 = 5000, PA = 7570
    expect(res.taxableIncome).toBe(110000 - 7570);
  });

  test('PA fully withdrawn at £125,140', () => {
    const res = calculate({ ...base, grossSalary: 125140 });
    expect(res.taxableIncome).toBe(125140);
  });

  test('no negative PA above £125,140', () => {
    const res = calculate({ ...base, grossSalary: 200000 });
    expect(res.taxableIncome).toBe(200000);
  });
});

// ─── Income Tax — England ──────────────────────────────────────────────────
describe('Income Tax — England', () => {
  test('zero tax at or below PA', () => {
    const res = calculate({ ...base, grossSalary: 12570 });
    expect(res.incomeTax).toBe(0);
  });

  test('basic rate only at £30,000', () => {
    const res = calculate({ ...base, grossSalary: 30000 });
    // taxable = 17430, all at 20%
    expect(r2(res.incomeTax)).toBe(r2(17430 * 0.20));
  });

  test('basic + higher rate at £60,000', () => {
    const res = calculate({ ...base, grossSalary: 60000 });
    // taxable = 47430 → basic 37700 × 20% + higher 9730 × 40%
    expect(r2(res.incomeTax)).toBe(r2(37700 * 0.20 + 9730 * 0.40));
  });

  test('tapered PA at £120,000 — no additional rate', () => {
    const res = calculate({ ...base, grossSalary: 120000 });
    // PA = 12570 - 10000 = 2570; adjustedGross = 120000; taxable = 117430
    // basicBandSize = 50270 - 2570 = 47700
    // higherBandMax = 125140 - 2570 = 122570
    // 117430 < 122570 → higher rate only
    const pa = 2570;
    const taxable = 120000 - pa;
    const basicSize = 50270 - pa;
    const expected = basicSize * 0.20 + (taxable - basicSize) * 0.40;
    expect(r2(res.incomeTax)).toBe(r2(expected));
  });

  test('additional rate at £150,000 (PA fully withdrawn)', () => {
    const res = calculate({ ...base, grossSalary: 150000 });
    // PA = 0; taxable = 150000
    // basicBandSize = basicRateLimit - pa = 50270 - 0 = 50270
    // higherBandMax = 125140 - 0 = 125140
    // basic:    50270 × 20%   = 10054
    // higher:   74870 × 40%   = 29948
    // additional: 24860 × 45% = 11187
    const expected = 50270 * 0.20 + 74870 * 0.40 + (150000 - 125140) * 0.45;
    expect(r2(res.incomeTax)).toBe(r2(expected));
  });
});

// ─── National Insurance ────────────────────────────────────────────────────
describe('National Insurance', () => {
  test('no NI below primary threshold', () => {
    expect(calculate({ ...base, grossSalary: 12570 }).nationalInsurance).toBe(0);
  });

  test('NI at £30,000', () => {
    const res = calculate({ ...base, grossSalary: 30000 });
    expect(r2(res.nationalInsurance)).toBe(r2((30000 - 12570) * 0.08));
  });

  test('NI above UEL at £60,000', () => {
    const res = calculate({ ...base, grossSalary: 60000 });
    const expected = (50270 - 12570) * 0.08 + (60000 - 50270) * 0.02;
    expect(r2(res.nationalInsurance)).toBe(r2(expected));
  });

  test('no NI when payNI is false', () => {
    expect(calculate({ ...base, grossSalary: 60000, payNI: false }).nationalInsurance).toBe(0);
  });

  test('no NI for age 66+', () => {
    expect(calculate({ ...base, grossSalary: 60000, ageGroup: '66to74' }).nationalInsurance).toBe(0);
    expect(calculate({ ...base, grossSalary: 60000, ageGroup: 'over75' }).nationalInsurance).toBe(0);
  });

  test('NI is on gross salary, not post-pension', () => {
    // NI is calculated on gross salary, pension doesn't reduce NI
    const withPension = calculate({ ...base, grossSalary: 30000, payeContrib: 1500 });
    const noPension = calculate({ ...base, grossSalary: 30000 });
    expect(withPension.nationalInsurance).toBe(noPension.nationalInsurance);
  });
});

// ─── Student Loan ──────────────────────────────────────────────────────────
describe('Student Loan', () => {
  test('Plan 1 repayment at £35,000', () => {
    const res = calculate({ ...base, grossSalary: 35000, studentLoan: 'plan1' });
    expect(r2(res.studentLoanRepayment)).toBe(r2((35000 - 24990) * 0.09));
  });

  test('Plan 2 repayment at £35,000', () => {
    const res = calculate({ ...base, grossSalary: 35000, studentLoan: 'plan2' });
    expect(r2(res.studentLoanRepayment)).toBe(r2((35000 - 27295) * 0.09));
  });

  test('Plan 4 repayment at £40,000', () => {
    const res = calculate({ ...base, grossSalary: 40000, studentLoan: 'plan4' });
    expect(r2(res.studentLoanRepayment)).toBe(r2((40000 - 31395) * 0.09));
  });

  test('Plan 5 repayment', () => {
    const res = calculate({ ...base, grossSalary: 35000, studentLoan: 'plan5' });
    expect(r2(res.studentLoanRepayment)).toBe(r2((35000 - 25000) * 0.09));
  });

  test('Postgrad repayment at 6%', () => {
    const res = calculate({ ...base, grossSalary: 30000, studentLoan: 'postgrad' });
    expect(r2(res.studentLoanRepayment)).toBe(r2((30000 - 21000) * 0.06));
  });

  test('no repayment below threshold', () => {
    expect(calculate({ ...base, grossSalary: 25000, studentLoan: 'plan2' }).studentLoanRepayment).toBe(0);
  });
});

// ─── Pension ───────────────────────────────────────────────────────────────
describe('PAYE Pension', () => {
  test('5% on £60,000 reduces taxable income', () => {
    const res = calculate({ ...base, grossSalary: 60000, payeContrib: 3000 });
    // adjustedGross = 57000, PA = 12570 (no taper), taxable = 44430
    expect(res.pension.employeeContrib).toBe(3000);
    expect(res.taxableIncome).toBe(57000 - 12570);
  });

  test('pension contribution reduces PA taper for earners near £100k', () => {
    // £108k gross, £8k pension → adjusted = £100k → full PA = £12,570
    const withPension = calculate({ ...base, grossSalary: 108000, payeContrib: 8000 });
    const noPension = calculate({ ...base, grossSalary: 108000 });
    expect(withPension.taxableIncome).toBeLessThan(noPension.taxableIncome);
  });

  test('basic rate taxpayer — autoTaxSaving = 20% of contribution', () => {
    const res = calculate({ ...base, grossSalary: 30000, payeContrib: 1500 });
    expect(r2(res.pension.autoTaxSaving)).toBe(r2(1500 * 0.20));
  });

  test('basic rate taxpayer — no SA claim', () => {
    const res = calculate({ ...base, grossSalary: 30000, payeContrib: 1500 });
    expect(res.pension.selfAssessmentClaim).toBe(0);
  });

  test('higher rate taxpayer has SA claim', () => {
    // £80k, £4k pension. After pension, marginal rate = 40%
    const res = calculate({ ...base, grossSalary: 80000, payeContrib: 4000 });
    expect(res.pension.selfAssessmentClaim).toBeGreaterThan(0);
  });
});

// ─── Take-home sanity checks ───────────────────────────────────────────────
describe('Take-home', () => {
  test('£30,000 no deductions', () => {
    const res = calculate({ ...base, grossSalary: 30000 });
    const tax = 17430 * 0.20;
    const ni = 17430 * 0.08;
    expect(r2(res.takeHome)).toBe(r2(30000 - tax - ni));
  });

  test('£50,000 no deductions', () => {
    const res = calculate({ ...base, grossSalary: 50000 });
    const tax = 37430 * 0.20;
    const ni = (37700 * 0.08);  // 50000-12570=37430, but NI = 50000-12570 = 37430 × 0.08
    const expectedTax = (50000 - 12570) * 0.20;
    const expectedNI = (50000 - 12570) * 0.08;
    expect(r2(res.takeHome)).toBe(r2(50000 - expectedTax - expectedNI));
  });

  test('grossSalary - all deductions = takeHome', () => {
    const res = calculate({
      ...base,
      grossSalary: 60000,
      payeContrib: 3000,
      studentLoan: 'plan2',
    });
    const expected = 60000 - res.pension.employeeContrib - res.incomeTax -
      res.nationalInsurance - res.studentLoanRepayment;
    expect(r2(res.takeHome)).toBe(r2(expected));
  });
});

// ─── Period scaling ────────────────────────────────────────────────────────
describe('Period scaling', () => {
  test('monthly = annual / 12', () => {
    const annual = calculate({ ...base, grossSalary: 60000 });
    const periods = toPeriodResult(annual, 37.5, 5);
    expect(r2(periods.monthly.takeHome)).toBe(r2(annual.takeHome / 12));
  });

  test('weekly = annual / 52', () => {
    const annual = calculate({ ...base, grossSalary: 60000 });
    const periods = toPeriodResult(annual, 37.5, 5);
    expect(r2(periods.weekly.takeHome)).toBe(r2(annual.takeHome / 52));
  });
});

// ─── Scottish rates ────────────────────────────────────────────────────────
describe('Scottish rates', () => {
  test('Scottish £30,000 tax > English (intermediate 21% > basic 20%)', () => {
    const eng = calculate({ ...base, grossSalary: 30000 });
    const sco = calculate({ ...base, grossSalary: 30000, scottishRates: true });
    // Scottish: Starter 19% on 2306, Basic 20% on 11685, Intermediate 21% on 3439
    // English: Basic 20% on 17430
    expect(sco.incomeTax).toBeGreaterThan(eng.incomeTax);
  });

  test('Scottish higher rate is 42% vs English 40%', () => {
    const eng = calculate({ ...base, grossSalary: 60000 });
    const sco = calculate({ ...base, grossSalary: 60000, scottishRates: true });
    expect(sco.incomeTax).toBeGreaterThan(eng.incomeTax);
  });

  test('Scottish £30,000 exact calculation', () => {
    const res = calculate({ ...base, grossSalary: 30000, scottishRates: true });
    // Starter: 14876-12570 = 2306 × 19% = 438.14
    // Basic:  26561-14876 = 11685 × 20% = 2337
    // Intermediate: 30000-26561 = 3439 × 21% = 722.19
    const expected = 2306 * 0.19 + 11685 * 0.20 + 3439 * 0.21;
    expect(r2(res.incomeTax)).toBe(r2(expected));
  });
});

// ─── Full pension calculator ───────────────────────────────────────────────
describe('calculateFullPension', () => {
  test('basic rate taxpayer — no SA claims', () => {
    const res = calculateFullPension(30000, 1500, 900, 0, false);
    expect(res.payeSaClaim).toBe(0);
    expect(res.privateSaClaim).toBe(0);
  });

  test('private pension — you pay 80% of gross', () => {
    const res = calculateFullPension(60000, 0, 0, 1000, false);
    expect(r2(res.privateYouPay)).toBe(800);
    expect(r2(res.privateBasicRelief)).toBe(200);
    expect(res.privateGross).toBe(1000);
  });

  test('higher rate taxpayer gets SA claim on private pension', () => {
    const res = calculateFullPension(80000, 0, 0, 2000, false);
    // marginalRate = 40%, SAclaim = 2000 × (40%-20%) = 400
    expect(r2(res.privateSaClaim)).toBe(400);
  });

  test('total pot = all contributions combined', () => {
    const res = calculateFullPension(60000, 3000, 1800, 1000, false);
    expect(res.totalPot).toBe(3000 + 1800 + 1000);
  });
});
