# UK Salary & Tax Calculator 2026

React Native (Expo) app for iOS and Android. Calculates take-home pay for the 2025/26 UK tax year.

## Features

- 2025/26 income tax rates (England, Wales, NI, Scotland)
- National Insurance (Class 1)
- Personal pension contributions with full relief breakdown:
  - Automatic 20% basic rate relief
  - Higher/additional rate relief claimable via self-assessment
- Student loans: Plan 1, 2, 4 (Scotland), 5, Postgraduate
- Salary comparison (new vs old)
- All periods: annual, monthly, weekly, daily, hourly
- AdMob footer ad integration
- Test suite validating calculation accuracy

## Setup

```bash
npm install
npx expo start
```

## Tests

```bash
npm test
```

## AdMob

Replace test IDs in `src/components/AdBanner.tsx` and `app.json` with your real AdMob app/unit IDs before publishing.

## Tax rates source

HMRC 2025/26 rates: https://www.gov.uk/income-tax-rates
