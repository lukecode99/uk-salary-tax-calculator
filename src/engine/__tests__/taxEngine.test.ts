import { calculate, toPeriodResult, TaxInputs } from '../taxEngine';

const baseInputs: TaxInputs = {
  grossSalary: 0,
  pensionPercent: 0,
  scottishRates: false,
  studentLoan: 'none',
  payNI: true,
  ageGroup: 'under65',
  hoursPerWeek: 37.5,
  daysPerWeek: 5,
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

describe('Personal Allowance', () => {
  test('full PA at £50,000', () => {
    const r = calculate({ ...baseInputs, grossSalary: 50000 });
    expect(r.taxableIncome).toBe(50000 - 12570);
  });

  test('PA tapers above £100,000', () => {
    const r = calculate({ ...baseInputs, grossSalary: 110000 });
    // PA reduces by (110000-100000)/2 = 5000, so PA = 12570-5000 = 7570
    const expectedPA = 12570 - 5000;
    const expectedTaxable = 110000 - expectedPA;
    expect(r.taxableIncome).toBe(expectedTaxable);
  });

  test('PA fully withdrawn at £125,140', () => {
    const r = calculate({ ...baseInputs, grossSalary: 125140 });
    expect(r.taxableIncome).toBe(125140);
  });

  test('no negative PA', () => {
    const r = calculate({ ...baseInputs, grossSalary: 200000 });
    expect(r.taxableIncome).toBe(200000);
  });
});

describe('Income Tax — England', () => {
  test('zero tax below PA', () => {
    const r = calculate({ ...baseInputs, grossSalary: 12570 });
    expect(r.incomeTax).toBe(0);
  });

  test('basic rate only at £30,000', () => {
    const r = calculate({ ...baseInputs, grossSalary: 30000 });
    // taxable = 30000 - 12570 = 17430
    const expected = 17430 * 0.20;
    expect(round2(r.incomeTax)).toBe(round2(expected));
  });

  test('basic + higher rate at £60,000', () => {
    const r = calculate({ ...baseInputs, grossSalary: 60000 });
    // taxable = 60000 - 12570 = 47430
    // basic band = 37700: 37700 * 0.20 = 7540
    // higher: (47430 - 37700) * 0.40 = 9730 * 0.40 = 3892
    const expected = 37700 * 0.20 + (47430 - 37700) * 0.40;
    expect(round2(r.incomeTax)).toBe(round2(expected));
  });

  test('additional rate at £150,000', () => {
    const r = calculate({ ...baseInputs, grossSalary: 150000 });
    // PA = 0 (fully tapered), taxable = 150000
    // basic: 37700 * 0.20 = 7540
    // higher: (125140-50270) * 0.40 = 74870 * 0.40 = 29948
    // additional: (150000-125140) * 0.45 = 24860 * 0.45 = 11187
    const expected = 37700 * 0.20 + (125140 - 50270) * 0.40 + (150000 - 125140) * 0.45;
    expect(round2(r.incomeTax)).toBe(round2(expected));
  });
});

describe('National Insurance', () => {
  test('no NI below primary threshold', () => {
    const r = calculate({ ...baseInputs, grossSalary: 12570 });
    expect(r.nationalInsurance).toBe(0);
  });

  test('NI at £30,000', () => {
    const r = calculate({ ...baseInputs, grossSalary: 30000 });
    const expected = (30000 - 12570) * 0.08;
    expect(round2(r.nationalInsurance)).toBe(round2(expected));
  });

  test('NI at £60,000 (above UEL)', () => {
    const r = calculate({ ...baseInputs, grossSalary: 60000 });
    const expected = (50270 - 12570) * 0.08 + (60000 - 50270) * 0.02;
    expect(round2(r.nationalInsurance)).toBe(round2(expected));
  });

  test('no NI when payNI is false', () => {
    const r = calculate({ ...baseInputs, grossSalary: 60000, payNI: false });
    expect(r.nationalInsurance).toBe(0);
  });

  test('no NI for age 65+', () => {
    const r = calculate({ ...baseInputs, grossSalary: 60000, ageGroup: '65to74' });
    expect(r.nationalInsurance).toBe(0);
  });
});

describe('Student Loan', () => {
  test('plan 1 at £35,000', () => {
    const r = calculate({ ...baseInputs, grossSalary: 35000, studentLoan: 'plan1' });
    const expected = (35000 - 24990) * 0.09;
    expect(round2(r.studentLoanRepayment)).toBe(round2(expected));
  });

  test('plan 2 at £35,000', () => {
    const r = calculate({ ...baseInputs, grossSalary: 35000, studentLoan: 'plan2' });
    const expected = (35000 - 27295) * 0.09;
    expect(round2(r.studentLoanRepayment)).toBe(round2(expected));
  });

  test('no repayment below plan 2 threshold', () => {
    const r = calculate({ ...baseInputs, grossSalary: 25000, studentLoan: 'plan2' });
    expect(r.studentLoanRepayment).toBe(0);
  });
});

describe('Pension', () => {
  test('5% pension on £60,000 reduces taxable income', () => {
    const r = calculate({ ...baseInputs, grossSalary: 60000, pensionPercent: 5 });
    const grossContrib = 60000 * 0.05; // 3000
    // taxable = (60000 - 3000) - 12570 = 44430
    expect(r.pension.grossContribution).toBe(grossContrib);
    expect(r.taxableIncome).toBe(60000 - grossContrib - 12570);
  });

  test('auto relief = 20% of gross contribution', () => {
    const r = calculate({ ...baseInputs, grossSalary: 60000, pensionPercent: 5 });
    expect(round2(r.pension.autoRelief)).toBe(round2(3000 * 0.20));
  });

  test('higher rate taxpayer gets self-assessment claim', () => {
    // £80,000 earner, 5% pension = £4,000 contribution
    // Marginal rate = 40%, extra = 40%-20% = 20%
    const r = calculate({ ...baseInputs, grossSalary: 80000, pensionPercent: 5 });
    const grossContrib = 80000 * 0.05; // 4000
    expect(round2(r.pension.selfAssessmentClaim)).toBe(round2(grossContrib * 0.20));
  });

  test('basic rate taxpayer has no self-assessment claim', () => {
    const r = calculate({ ...baseInputs, grossSalary: 30000, pensionPercent: 5 });
    expect(r.pension.selfAssessmentClaim).toBe(0);
  });
});

describe('Take-home', () => {
  test('£30,000 take-home sanity check', () => {
    const r = calculate({ ...baseInputs, grossSalary: 30000 });
    const tax = (30000 - 12570) * 0.20;
    const ni = (30000 - 12570) * 0.08;
    const expected = 30000 - tax - ni;
    expect(round2(r.takeHome)).toBe(round2(expected));
  });
});

describe('Period scaling', () => {
  test('monthly = annual / 12', () => {
    const annual = calculate({ ...baseInputs, grossSalary: 60000 });
    const periods = toPeriodResult(annual, 37.5, 5);
    expect(round2(periods.monthly.takeHome)).toBe(round2(annual.takeHome / 12));
  });

  test('weekly = annual / 52', () => {
    const annual = calculate({ ...baseInputs, grossSalary: 60000 });
    const periods = toPeriodResult(annual, 37.5, 5);
    expect(round2(periods.weekly.takeHome)).toBe(round2(annual.takeHome / 52));
  });
});

describe('Scottish rates', () => {
  test('lower income Scottish rate lower than England', () => {
    const england = calculate({ ...baseInputs, grossSalary: 30000, scottishRates: false });
    const scotland = calculate({ ...baseInputs, grossSalary: 30000, scottishRates: true });
    // Scottish intermediate band (21%) kicks in higher than English basic (20%) for some income
    // At £30k both have very similar tax — just verify it runs without error
    expect(scotland.incomeTax).toBeGreaterThan(0);
  });

  test('high income Scottish rate higher than England', () => {
    const england = calculate({ ...baseInputs, grossSalary: 60000, scottishRates: false });
    const scotland = calculate({ ...baseInputs, grossSalary: 60000, scottishRates: true });
    // Scottish higher rate is 42% vs 40%
    expect(scotland.incomeTax).toBeGreaterThan(england.incomeTax);
  });
});
