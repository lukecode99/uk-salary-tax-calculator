import { StudentLoanPlan, AgeGroup, Period } from './engine/taxEngine';

export type PensionMode = 'percent' | 'fixed';

export interface PensionSettings {
  payeEnabled: boolean;
  payeEmployeeMode: PensionMode;
  payeEmployeeValue: number;
  payeEmployerMode: PensionMode;
  payeEmployerValue: number;
  privateEnabled: boolean;
  privateMode: PensionMode;
  privateValue: number;
}

export interface AppSettings {
  pension: PensionSettings;
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

export const DEFAULT_PENSION: PensionSettings = {
  payeEnabled: false,
  payeEmployeeMode: 'percent',
  payeEmployeeValue: 5,
  payeEmployerMode: 'percent',
  payeEmployerValue: 3,
  privateEnabled: false,
  privateMode: 'percent',
  privateValue: 0,
};

export const DEFAULT_SETTINGS: AppSettings = {
  pension: DEFAULT_PENSION,
  scottishRates: false,
  studentLoan: 'none',
  payNI: true,
  ageGroup: 'under66',
  hoursPerWeek: 37.5,
  daysPerWeek: 5,
};
