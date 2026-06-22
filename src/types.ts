import { StudentLoanPlan, AgeGroup, Period } from './engine/taxEngine';

export type PensionMode = 'percent' | 'fixed' | 'monthly';
export type SacrificeMode = 'fixed' | 'monthly'; // £/yr or £/mo only (no % for sacrifice)

export interface SacrificeItem {
  enabled: boolean;
  mode: SacrificeMode;
  value: number;
}

export interface CarSchemeSettings extends SacrificeItem {
  p11dValue: number;  // P11D list price of car (£)
  bikRate: number;    // HMRC CO2-based BiK rate (%, e.g. 15)
}

export interface SalaryScrificeSettings {
  car: CarSchemeSettings;
  bike: SacrificeItem;
}

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
  sacrifice: SalaryScrificeSettings;
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

export const DEFAULT_SACRIFICE: SalaryScrificeSettings = {
  car: { enabled: false, mode: 'monthly', value: 0, p11dValue: 0, bikRate: 0 },
  bike: { enabled: false, mode: 'monthly', value: 0 },
};

export const DEFAULT_SETTINGS: AppSettings = {
  pension: DEFAULT_PENSION,
  sacrifice: DEFAULT_SACRIFICE,
  scottishRates: false,
  studentLoan: 'none',
  payNI: true,
  ageGroup: 'under66',
  hoursPerWeek: 37.5,
  daysPerWeek: 5,
};
