import { AccountingAccount } from '../types/index.js';

export const PGC_ACCOUNTS: AccountingAccount[] = [
  { code: '628000', name: 'Suministros IT (Hosting, Cloud, Software, Licencias)' },
  { code: '629000', name: 'Comunicaciones y Telecomunicaciones (Fibra, Telefonía)' },
  { code: '629002', name: 'Servicios Profesionales Cloud e Infraestructura' },
  { code: '623000', name: 'Servicios de Profesionales Independientes (Asesoría, Legal, Consultoría)' },
  { code: '600000', name: 'Compras de Mercaderías y Hardware (Equipos, Dispositivos)' },
  { code: '622000', name: 'Reparaciones y Conservación' },
  { code: '627000', name: 'Publicidad, Propaganda y Relaciones Públicas' },
  { code: '621000', name: 'Arrendamientos y Cánones (Oficinas, Coworking)' },
  { code: '625000', name: 'Primas de Seguros' },
  { code: '629003', name: 'Viajes, Dietas y Desplazamientos (Hotel, Avión, Taxi)' },
  { code: '629004', name: 'Gastos de Representación y Restauración' },
  { code: '624000', name: 'Transportes y Mensajería' }
];

export const COST_CENTERS: string[] = [
  'DevOps',
  'Data',
  'Management',
  'Operations',
  'AI-Research',
  'Marketing',
  'Sales',
  'IT-Hardware',
  'General'
];

export class AccountingRulesService {
  static getAccounts(): AccountingAccount[] {
    return PGC_ACCOUNTS;
  }

  static getCostCenters(): string[] {
    return COST_CENTERS;
  }

  static matchAccountAndCenter(concept = '', supplier = ''): { account_code: string; account_name: string; cost_center: string } {
    const text = `${concept} ${supplier}`.toLowerCase();

    // 1. Cloud, Hosting, Software, SaaS, IT Services
    if (
      text.includes('aws') || text.includes('amazon') || text.includes('azure') ||
      text.includes('google cloud') || text.includes('cloud') || text.includes('ec2') ||
      text.includes('s3') || text.includes('server') || text.includes('hosting') ||
      text.includes('github') || text.includes('vercel') || text.includes('openai') ||
      text.includes('stripe') || text.includes('saas') || text.includes('software') ||
      text.includes('licencia') || text.includes('database') || text.includes('domain') ||
      text.includes('dominio') || text.includes('docker')
    ) {
      return {
        account_code: '628000',
        account_name: 'Suministros IT',
        cost_center: (text.includes('data') || text.includes('bigquery') || text.includes('analytics'))
          ? 'Data'
          : (text.includes('ai') || text.includes('llm') || text.includes('model') ? 'AI-Research' : 'DevOps')
      };
    }

    // 2. Hardware, Devices, Laptops, Computers, Electronics
    if (
      text.includes('hardware') || text.includes('portátil') || text.includes('laptop') ||
      text.includes('ordenador') || text.includes('teclado') || text.includes('monitor') ||
      text.includes('pantalla') || text.includes('disco') || text.includes('ssd') ||
      text.includes('memoria') || text.includes('ram') || text.includes('apple') ||
      text.includes('dell') || text.includes('hp') || text.includes('lenovo') ||
      text.includes('mouse') || text.includes('cable') || text.includes('switch') ||
      text.includes('router') || text.includes('servidor físico')
    ) {
      return {
        account_code: '600000',
        account_name: 'Compras de Mercaderías y Hardware',
        cost_center: 'IT-Hardware'
      };
    }

    // 3. Telecommunications, Phone, Fiber, Mobile
    if (
      text.includes('telefonica') || text.includes('telefónica') || text.includes('vodafone') ||
      text.includes('orange') || text.includes('movistar') || text.includes('fibra') ||
      text.includes('troncal') || text.includes('internet') || text.includes('sip') ||
      text.includes('móvil') || text.includes('linea') || text.includes('roaming')
    ) {
      return {
        account_code: '629000',
        account_name: 'Comunicaciones y Telecomunicaciones',
        cost_center: 'Operations'
      };
    }

    // 4. Professional Services, Consulting, Legal, Engineering, Audit, Freelance
    if (
      text.includes('asesor') || text.includes('consultor') || text.includes('legal') ||
      text.includes('abogad') || text.includes('auditor') || text.includes('notar') ||
      text.includes('profesional') || text.includes('ingenier') || text.includes('desarrollo') ||
      text.includes('honorarios') || text.includes('irpf')
    ) {
      return {
        account_code: '623000',
        account_name: 'Servicios de Profesionales Independientes',
        cost_center: 'Management'
      };
    }

    // 5. Advertising, Marketing, PR, Campaigns
    if (
      text.includes('ads') || text.includes('marketing') || text.includes('meta') ||
      text.includes('facebook') || text.includes('google ads') || text.includes('campaña') ||
      text.includes('publicidad') || text.includes('branding') || text.includes('seo') ||
      text.includes('linkedin ads')
    ) {
      return {
        account_code: '627000',
        account_name: 'Publicidad y RRPP',
        cost_center: 'Marketing'
      };
    }

    // 6. Travel, Hotels, Taxis, Trains, Flights, Vehicle Fuel
    if (
      text.includes('hotel') || text.includes('vuelo') || text.includes('avion') ||
      text.includes('tren') || text.includes('renfe') || text.includes('taxi') ||
      text.includes('uber') || text.includes('cabify') || text.includes('peaje') ||
      text.includes('gasolina') || text.includes('combustible') || text.includes('parking')
    ) {
      return {
        account_code: '629003',
        account_name: 'Viajes y Desplazamientos',
        cost_center: 'Sales'
      };
    }

    // 7. Meals, Restaurants, Food, Catering
    if (
      text.includes('restaurante') || text.includes('comida') || text.includes('almuerzo') ||
      text.includes('cena') || text.includes('cafeteria') || text.includes('catering') ||
      text.includes('mercadona') || text.includes('supermercado')
    ) {
      return {
        account_code: '629004',
        account_name: 'Dietas y Restauración',
        cost_center: 'General'
      };
    }

    // 8. Rent, Office Lease, Coworking
    if (
      text.includes('alquiler') || text.includes('renta') || text.includes('arrendamiento') ||
      text.includes('coworking') || text.includes('oficina') || text.includes('wework')
    ) {
      return {
        account_code: '621000',
        account_name: 'Arrendamientos y Cánones',
        cost_center: 'Operations'
      };
    }

    // 9. Repairs and Maintenance
    if (text.includes('reparaci') || text.includes('mantenimiento') || text.includes('conservaci')) {
      return {
        account_code: '622000',
        account_name: 'Reparaciones y Conservación',
        cost_center: 'Operations'
      };
    }

    // 10. Shipping, Courier, Transport
    if (text.includes('envio') || text.includes('transporte') || text.includes('mensajeria') || text.includes('dhl') || text.includes('ups') || text.includes('correos') || text.includes('seur')) {
      return {
        account_code: '624000',
        account_name: 'Transportes y Mensajería',
        cost_center: 'Operations'
      };
    }

    return {
      account_code: '628000',
      account_name: 'Suministros IT',
      cost_center: 'General'
    };
  }
}
