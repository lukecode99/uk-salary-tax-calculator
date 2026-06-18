import { StudentLoanPlan, AgeGroup, Period } from './engine/taxEngine';

export interface AppSettings {
  pensionPercent: number;
  scottishRates: boolean;
  studentLoan: StudentLoanPlan;
  payNI: boolean;
  ageGroup: AgeGroup;
  hoursPerWeek: number;
  daysPerWeek: number;
}

export interface AppState {
  newSalary: string;
  oldSalary: string;
  inputPeriod: Period;
  resultPeriod: Period;
  settings: AppSettings;
}

export const DEFAULT_SETTINGS: AppSettings = {
  pensionPercent: 5,
  scottishRates: false,
  studentLoan: 'none',
  payNI: true,
  ageGroup: 'under65',
  hoursPerWeek: 37.5,
  daysPerWeek: 5,
};
