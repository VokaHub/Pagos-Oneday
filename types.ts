export enum Oficina {
  'O1201' = '1201',
  'O203B' = '203B',
  'O211B' = '211B',
  'O232B' = '232B',
  'O323' = '323'
}

export enum EstadoPago {
  Pendiente = 'Pendiente',
  Pagado = 'Pagado',
  PlanMensual = 'Plan Mensual',
  CreditoMensual = 'Crédito Mensual',
}

export interface Payment {
  id: string; // Internal unique ID
  recordId?: string | number; // Optional ID from imported file
  cliente: string;
  telefono?: string;
  oficina: Oficina;
  horas: number;
  monto: number;
  boleta: string;
  fecha: string; // Fecha del servicio
  fechaPago?: string; // Nueva fecha de pago
  estado: EstadoPago;
  metodoPago: string;
  notas?: string;
  revisado?: boolean;
  originalMonto?: number;
  comprobanteImg?: string;
}

export type SortType = 'date' | 'client-asc' | 'client-desc';

export type FilterState = {
  searchTerm: string;
  oficina: Oficina[];
  estado: EstadoPago | 'todos';
  fecha: string; // Fecha de Servicio
  fechaPago: string; // Fecha de Pago
  mes: number;
  año: number;
  sortBy: SortType;
}

// --- Definiciones de Dueños y Cuentas Bancarias ---

export const OWNER_CAROLINA_ORTEGA = 'Carolina Ortega';
export const OWNER_SERGIO_ORTIZ = 'Sergio Ortiz';

export interface BankAccountInfo {
  bank: string;
  accountName: string;
  accountNumber: string;
  accountType: string;
}

// 1201 y 203B: Monetaria BI Carolina Ortega (7500016162)
// 211B: Monetaria BI Sergio Ortiz (3250058298)
// 232B y 323: Ahorro BI Carolina Ortega (3629438)
export const OFFICE_BANK_DETAILS: Record<Oficina, BankAccountInfo> = {
  [Oficina.O1201]: {
    bank: 'Banco Industrial',
    accountName: 'Carolina Ortega',
    accountNumber: '7500016162',
    accountType: 'Monetaria',
  },
  [Oficina.O203B]: {
    bank: 'Banco Industrial',
    accountName: 'Carolina Ortega',
    accountNumber: '7500016162',
    accountType: 'Monetaria',
  },
  [Oficina.O211B]: {
    bank: 'Banco Industrial',
    accountName: 'Sergio Ortiz',
    accountNumber: '3250058298',
    accountType: 'Monetaria',
  },
  [Oficina.O232B]: {
    bank: 'Banco Industrial',
    accountName: 'Carolina Ortega',
    accountNumber: '3629438',
    accountType: 'Ahorro',
  },
  [Oficina.O323]: {
    bank: 'Banco Industrial',
    accountName: 'Carolina Ortega',
    accountNumber: '3629438',
    accountType: 'Ahorro',
  },
};

export const OFFICE_OWNERS: Record<Oficina, string> = {
  [Oficina.O1201]: OWNER_CAROLINA_ORTEGA,
  [Oficina.O203B]: OWNER_CAROLINA_ORTEGA,
  [Oficina.O211B]: OWNER_SERGIO_ORTIZ,
  [Oficina.O232B]: OWNER_CAROLINA_ORTEGA,
  [Oficina.O323]: OWNER_CAROLINA_ORTEGA,
};

export const BANK_DETAILS: { [key: string]: BankAccountInfo } = {
  [OWNER_CAROLINA_ORTEGA]: {
    bank: 'Banco Industrial',
    accountName: 'Carolina Ortega',
    accountNumber: '7500016162',
    accountType: 'Monetaria',
  },
  [OWNER_SERGIO_ORTIZ]: {
    bank: 'Banco Industrial',
    accountName: 'Sergio Ortiz',
    accountNumber: '3250058298',
    accountType: 'Monetaria',
  },
};

// Lista de clientes frecuentes para autocompletado rápido
export const DEFAULT_CLIENTS_LIST: string[] = [
  'Alejandra Pineda',
  'Ana Hernández',
  'Ana Luisa Tarano',
  'Ana Mora',
  'Ana Mota',
  'Anali Camas',
  'Anali Enríquez',
  'Andrea Benavente',
  'Andrea Furlan',
  'Anita Arana',
  'Bárbara Silvana',
  'Baudilio Bracamonte',
  'Byron Cifuentes',
  'Carla de León',
  'Carolina Ortega',
  'Cisel Pérez',
  'Daniela Barrios',
  'Diana Rubio',
  'Diego del Valle',
  'Diego Monroy',
  'Edgar Monzón',
  'Elsa Sandoval',
  'Eva Mesa',
  'Fernanda López',
  'Flor Hernández',
  'Gabriela Samayoa',
  'Iliana Salazar',
  'Jimena Rosales',
  'Katherine Marroquín',
  'Laura López',
  'Liliana Herrera',
  'Luisa Ortiz',
  'María José Aceituno',
  'María Sosa',
  'Mariana Contreras',
  'Marlin Ajcot',
  'Mónica Mayorga',
  'Olivia Cáceres',
  'Renato Durán',
  'Vivian González',
];
