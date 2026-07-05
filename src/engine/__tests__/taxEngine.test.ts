import { calculate, toPeriodResult, TaxInputs, calculateFullPension } from '../taxEngine';
import { defaultTaxYear } from '../taxRates';

const base: TaxInputs = {
  grossSalary: 0,
  payeContrib: 0,
  taxYear: '2026/27',
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

  test('tapered PA at £120,000 — basic band stays £37,700', () => {
    const res = calculate({ ...base, grossSalary: 120000 });
    // PA = 12570 - 10000 = 2570; taxable = 117430
    // Bands are fixed spans of taxable income — the basic band does NOT
    // expand as the PA tapers.
    // basic:  37700 × 20% = 7540
    // higher: (117430 - 37700) × 40% = 31892
    const expected = 37700 * 0.20 + (117430 - 37700) * 0.40;
    expect(r2(res.incomeTax)).toBe(r2(expected));
  });

  test('additional rate at £150,000 (PA fully withdrawn)', () => {
    const res = calculate({ ...base, grossSalary: 150000 });
    // PA = 0; taxable = 150000
    // basic:      37700 × 20% = 7540
    // higher:     (125140 - 37700) × 40% = 34976
    // additional: (150000 - 125140) × 45% = 11187
    const expected = 37700 * 0.20 + 87440 * 0.40 + (150000 - 125140) * 0.45;
    expect(r2(res.incomeTax)).toBe(r2(expected));
  });

  test('£130,000 → income tax £44,703.00 (acceptance)', () => {
    const res = calculate({ ...base, grossSalary: 130000 });
    expect(r2(res.incomeTax)).toBe(44703.00);
    expect(r2(res.nationalInsurance)).toBe(4610.60);
    expect(r2(res.takeHome)).toBe(80686.40);
  });

  test('£110,000 → income tax £33,432.00 (acceptance)', () => {
    const res = calculate({ ...base, grossSalary: 110000 });
    expect(r2(res.incomeTax)).toBe(33432.00);
  });

  test('£100k → £110k marginal income tax = £6,000 (60% zone)', () => {
    const at100 = calculate({ ...base, grossSalary: 100000 });
    const at110 = calculate({ ...base, grossSalary: 110000 });
    expect(r2(at110.incomeTax - at100.incomeTax)).toBe(6000.00);
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
  test('Plan 1 repayment at £35,000 → £729.00', () => {
    const res = calculate({ ...base, grossSalary: 35000, studentLoan: 'plan1' });
    expect(r2(res.studentLoanRepayment)).toBe(r2((35000 - 26900) * 0.09));
    expect(r2(res.studentLoanRepayment)).toBe(729.00);
  });

  test('Plan 2 repayment at £35,000 → £505.35 (£42.11/mo)', () => {
    const res = calculate({ ...base, grossSalary: 35000, studentLoan: 'plan2' });
    expect(r2(res.studentLoanRepayment)).toBe(r2((35000 - 29385) * 0.09));
    expect(r2(res.studentLoanRepayment)).toBe(505.35);
    const periods = toPeriodResult(res, 37.5, 5);
    expect(r2(periods.monthly.studentLoanRepayment)).toBe(42.11);
  });

  test('Plan 4 repayment at £40,000 → £558.45', () => {
    const res = calculate({ ...base, grossSalary: 40000, studentLoan: 'plan4' });
    expect(r2(res.studentLoanRepayment)).toBe(r2((40000 - 33795) * 0.09));
    expect(r2(res.studentLoanRepayment)).toBe(558.45);
  });

  test('student loan uses gross minus salary sacrifice', () => {
    const res = calculate({ ...base, grossSalary: 60000, studentLoan: 'plan2', totalSalaryScrifice: 6000 });
    expect(r2(res.studentLoanRepayment)).toBe(r2((54000 - 29385) * 0.09));
    expect(r2(res.studentLoanRepayment)).toBe(2215.35);
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

  test('higher rate taxpayer — net pay gives automatic full relief, no SA claim', () => {
    // £80k, £4k pension. After pension, marginal rate = 40%.
    // PAYE net-pay contributions get full marginal relief automatically —
    // there is nothing extra to claim via self-assessment.
    const res = calculate({ ...base, grossSalary: 80000, payeContrib: 4000 });
    expect(res.pension.selfAssessmentClaim).toBe(0);
    expect(r2(res.pension.autoTaxSaving)).toBe(r2(4000 * 0.40));
  });
});

// ─── Take-home sanity checks ───────────────────────────────────────────────
describe('Take-home', () => {
  test('£30,000 no deductions → £25,119.60', () => {
    const res = calculate({ ...base, grossSalary: 30000 });
    const tax = 17430 * 0.20;
    const ni = 17430 * 0.08;
    expect(r2(res.takeHome)).toBe(r2(30000 - tax - ni));
    expect(r2(res.takeHome)).toBe(25119.60);
  });

  test('£60,000 no deductions → £45,357.40', () => {
    const res = calculate({ ...base, grossSalary: 60000 });
    expect(r2(res.takeHome)).toBe(45357.40);
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
  test('Scottish £30,000 slightly below English (2026/27 wider 19% starter band)', () => {
    const eng = calculate({ ...base, grossSalary: 30000 });
    const sco = calculate({ ...base, grossSalary: 30000, scottishRates: true });
    // England £3,486 vs Scotland £3,451.07
    expect(r2(eng.incomeTax)).toBe(3486.00);
    expect(sco.incomeTax).toBeLessThan(eng.incomeTax);
  });

  test('Scottish higher rate is 42% vs English 40%', () => {
    const eng = calculate({ ...base, grossSalary: 60000 });
    const sco = calculate({ ...base, grossSalary: 60000, scottishRates: true });
    expect(sco.incomeTax).toBeGreaterThan(eng.incomeTax);
  });

  test('Scottish £30,000 exact calculation → £3,451.07', () => {
    const res = calculate({ ...base, grossSalary: 30000, scottishRates: true });
    // taxable = 17430
    // Starter:      first 3,967 × 19% = 753.73
    // Basic:        next 12,989 × 20% = 2,597.80
    // Intermediate: remaining 474 × 21% = 99.54
    const expected = 3967 * 0.19 + 12989 * 0.20 + 474 * 0.21;
    expect(r2(res.incomeTax)).toBe(r2(expected));
    expect(r2(res.incomeTax)).toBe(3451.07);
  });

  test('Scottish £110,000 → £37,482.05 (tapered PA, band widths on taxable)', () => {
    const res = calculate({ ...base, grossSalary: 110000, scottishRates: true });
    // PA = 7570, taxable = 102430
    // 3967×19% + 12989×20% + 14136×21% + 31338×42% + 40000×45%
    expect(r2(res.incomeTax)).toBe(37482.05);
  });

  test('Scottish £13,000 → £81.70 (income between tapered PA anchor and £12,570 is banded)', () => {
    const res = calculate({ ...base, grossSalary: 13000, scottishRates: true });
    // taxable = 430, all at starter 19%
    expect(r2(res.incomeTax)).toBe(81.70);
  });
});

// ─── Salary sacrifice & BiK (ST-4) ─────────────────────────────────────────
describe('Salary sacrifice', () => {
  test('£60,000 with £6,000 car sacrifice, P11D £25,000 @ 15% BiK', () => {
    const res = calculate({
      ...base,
      grossSalary: 60000,
      totalSalaryScrifice: 6000,
      carBiKValue: 25000 * 0.15, // 3750
    });
    // adjustedGross = 54000; +BiK = 57750; taxable = 45180
    // tax = 37700×20% + 7480×40% = 10532
    expect(r2(res.incomeTax)).toBe(10532.00);
    // NI on 54000: 37700×8% + 3730×2% = 3090.60
    expect(r2(res.nationalInsurance)).toBe(3090.60);
    expect(r2(res.takeHome)).toBe(40377.40);
  });

  test('zero sacrifice → identical to plain calculation', () => {
    const plain = calculate({ ...base, grossSalary: 60000 });
    const zeroed = calculate({ ...base, grossSalary: 60000, totalSalaryScrifice: 0, carBiKValue: 0, privateContrib: 0 });
    expect(zeroed.incomeTax).toBe(plain.incomeTax);
    expect(zeroed.nationalInsurance).toBe(plain.nationalInsurance);
    expect(zeroed.takeHome).toBe(plain.takeHome);
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

// ─── Tax year selection (ST-5) ─────────────────────────────────────────────
describe('Tax year selection', () => {
  test('2025/26 Plan 2 threshold £28,470 → £587.70 at £35,000', () => {
    const res = calculate({ ...base, grossSalary: 35000, studentLoan: 'plan2', taxYear: '2025/26' });
    expect(r2(res.studentLoanRepayment)).toBe(r2((35000 - 28470) * 0.09));
    expect(r2(res.studentLoanRepayment)).toBe(587.70);
  });

  test('2025/26 Scottish £30,000 (bands 15,397 / 27,491)', () => {
    const res = calculate({ ...base, grossSalary: 30000, scottishRates: true, taxYear: '2025/26' });
    // taxable = 17430
    // Starter:      2,827 (15,397−12,570) × 19% = 537.13
    // Basic:        12,094 (27,491−15,397) × 20% = 2,418.80
    // Intermediate: remaining 2,509 × 21%        = 526.89
    const expected = 2827 * 0.19 + 12094 * 0.20 + 2509 * 0.21;
    expect(r2(res.incomeTax)).toBe(r2(expected));
    expect(r2(res.incomeTax)).toBe(3482.82);
  });

  test('2026/27 figures unchanged when year passed explicitly', () => {
    const res = calculate({ ...base, grossSalary: 35000, studentLoan: 'plan2', taxYear: '2026/27' });
    expect(r2(res.studentLoanRepayment)).toBe(505.35);
  });

  test('defaultTaxYear follows the 6 April boundary', () => {
    expect(defaultTaxYear(new Date(2026, 3, 5))).toBe('2025/26');  // 5 Apr 2026
    expect(defaultTaxYear(new Date(2026, 3, 6))).toBe('2026/27');  // 6 Apr 2026
    expect(defaultTaxYear(new Date(2026, 6, 5))).toBe('2026/27');  // 5 Jul 2026
  });

  test('defaultTaxYear clamps to latest supported year', () => {
    expect(defaultTaxYear(new Date(2030, 0, 1))).toBe('2026/27');
  });
});

// ─── Cost to employer (ST-6) ───────────────────────────────────────────────
describe('Cost to employer', () => {
  test('£60,000 no pension → employer NI £8,250, total £68,250', () => {
    const res = calculate({ ...base, grossSalary: 60000 });
    // (60,000 − 5,000) × 15%
    expect(r2(res.employerNI)).toBe(8250.00);
    expect(r2(res.employerCost)).toBe(68250.00);
  });

  test('£60,000 with 3% employer pension → total £70,050', () => {
    const res = calculate({ ...base, grossSalary: 60000, employerPensionContrib: 1800 });
    expect(r2(res.employerPension)).toBe(1800.00);
    expect(r2(res.employerCost)).toBe(70050.00);
  });

  test('salary sacrifice reduces employer NI', () => {
    const res = calculate({ ...base, grossSalary: 60000, totalSalaryScrifice: 6000 });
    expect(r2(res.employerNI)).toBe(r2((54000 - 5000) * 0.15));
  });

  test('employer cost scales by period', () => {
    const annual = calculate({ ...base, grossSalary: 60000 });
    const periods = toPeriodResult(annual, 37.5, 5);
    expect(r2(periods.monthly.employerCost)).toBe(r2(annual.employerCost / 12));
  });
});

// ─── Delta-method pension saving (ST-7) ────────────────────────────────────
describe('Delta-method pension saving', () => {
  test('£110,000 with £10,000 pension → saving £6,000 (60% effective)', () => {
    const res = calculate({ ...base, grossSalary: 110000, payeContrib: 10000 });
    // tax without pension 33,432 − tax with 27,432
    expect(r2(res.pension.autoTaxSaving)).toBe(6000.00);
    expect(r2(res.pension.effectiveCost)).toBe(4000.00);
  });

  test('£55,000 with £6,000 pension → saving £2,146', () => {
    const res = calculate({ ...base, grossSalary: 55000, payeContrib: 6000 });
    // 4,730 spans the higher band @40% (1,892) + 1,270 falls to basic @20% (254)
    expect(r2(res.pension.autoTaxSaving)).toBe(2146.00);
  });

  test('calculateFullPension PAYE saving uses delta method', () => {
    const res = calculateFullPension(110000, 10000, 0, 0, false, '2026/27');
    expect(r2(res.payeAutoSaving)).toBe(6000.00);
  });
});
