<?php

namespace App\Services;

class AccountingRulesService
{
    public static function getChartOfAccounts(): array
    {
        return [
            // Grupo 60: Compras y aprovisionamientos
            ['code' => '600000', 'name' => 'Compras de Mercaderías y Hardware (Equipos, Dispositivos)', 'group' => 'Grupo 60 - Compras'],
            ['code' => '602000', 'name' => 'Compras de Otros Aprovisionamientos (Consumibles, Cables)', 'group' => 'Grupo 60 - Compras'],

            // Grupo 62: Servicios exteriores
            ['code' => '621000', 'name' => 'Arrendamientos y Cánones (Oficinas, Coworking, Servidores)', 'group' => 'Grupo 62 - Servicios Exteriores'],
            ['code' => '622000', 'name' => 'Reparaciones y Conservación (Mantenimiento Técnico)', 'group' => 'Grupo 62 - Servicios Exteriores'],
            ['code' => '623000', 'name' => 'Servicios de Profesionales Independientes (Asesoría, Legal, Consultoría)', 'group' => 'Grupo 62 - Servicios Exteriores'],
            ['code' => '624000', 'name' => 'Transportes y Mensajería Logística', 'group' => 'Grupo 62 - Servicios Exteriores'],
            ['code' => '625000', 'name' => 'Primas de Seguros (Ciberseguridad, Responsabilidad Civil)', 'group' => 'Grupo 62 - Servicios Exteriores'],
            ['code' => '626000', 'name' => 'Servicios Bancarios y Similares (Comisiones Pasarelas, Stripe)', 'group' => 'Grupo 62 - Servicios Exteriores'],
            ['code' => '627000', 'name' => 'Publicidad, Propaganda y Relaciones Públicas (Google Ads, Meta)', 'group' => 'Grupo 62 - Servicios Exteriores'],
            ['code' => '628000', 'name' => 'Suministros IT (Cloud, AWS, GCP, SaaS, Licencias)', 'group' => 'Grupo 62 - Servicios Exteriores'],
            ['code' => '628001', 'name' => 'Suministros Generales (Electricidad, Agua, Climatización)', 'group' => 'Grupo 62 - Servicios Exteriores'],
            ['code' => '629000', 'name' => 'Comunicaciones y Telecomunicaciones (Fibra, Telefonía Móvil)', 'group' => 'Grupo 62 - Servicios Exteriores'],
            ['code' => '629001', 'name' => 'Suscripciones y Licencias Software Anuales (GitHub, Jira)', 'group' => 'Grupo 62 - Servicios Exteriores'],
            ['code' => '629002', 'name' => 'Infraestructura Serverless y Base de Datos Cloud (Neon, Vercel)', 'group' => 'Grupo 62 - Servicios Exteriores'],
            ['code' => '629003', 'name' => 'Viajes, Dietas y Desplazamientos (Hotel, Vuelo, Taxi, Renfe)', 'group' => 'Grupo 62 - Servicios Exteriores'],
            ['code' => '629004', 'name' => 'Gastos de Representación y Restauración', 'group' => 'Grupo 62 - Servicios Exteriores'],

            // Grupo 64: Gastos de personal
            ['code' => '640000', 'name' => 'Sueldos y Salarios (Nóminas de Personal Técnico)', 'group' => 'Grupo 64 - Personal'],
            ['code' => '642000', 'name' => 'Seguridad Social a Cargo de la Empresa', 'group' => 'Grupo 64 - Personal'],
            ['code' => '649000', 'name' => 'Otros Gastos Sociales y Formación Técnica', 'group' => 'Grupo 64 - Personal'],

            // Grupo 68: Dotaciones para amortizaciones
            ['code' => '680000', 'name' => 'Amortización del Inmovilizado Intangible (Software Propietario)', 'group' => 'Grupo 68 - Amortizaciones'],
            ['code' => '681000', 'name' => 'Amortización del Inmovilizado Material (Servidores On-Premise)', 'group' => 'Grupo 68 - Amortizaciones'],

            // Grupo 47: Impuestos y retenciones
            ['code' => '472021', 'name' => 'H.P. IVA Soportado (21%)', 'group' => 'Grupo 47 - Impuestos'],
            ['code' => '472010', 'name' => 'H.P. IVA Soportado (10%)', 'group' => 'Grupo 47 - Impuestos'],
            ['code' => '472004', 'name' => 'H.P. IVA Soportado (4%)', 'group' => 'Grupo 47 - Impuestos'],
            ['code' => '475100', 'name' => 'H.P. Acreedora por Retenciones IRPF Profesionales (15%)', 'group' => 'Grupo 47 - Impuestos'],
            ['code' => '475101', 'name' => 'H.P. Acreedora por Retenciones Arrendamientos (19%)', 'group' => 'Grupo 47 - Impuestos'],

            // Grupo 40: Proveedores y Acreedores
            ['code' => '400000', 'name' => 'Proveedores y Acreedores Comerciales', 'group' => 'Grupo 40 - Pasivo Corriente'],
            ['code' => '410000', 'name' => 'Acreedores por Prestaciones de Servicios Varios', 'group' => 'Grupo 40 - Pasivo Corriente'],
        ];
    }

    public static function getCostCenters(): array
    {
        return [
            'CC-IT-INFRA',
            'CC-ENG-DEV',
            'CC-CORP-OPS',
            'CC-ADMIN-LEGAL',
            'CC-SALES-MKT'
        ];
    }

    public static function classifyLineItem(string $concept, string $supplier = ''): array
    {
        $text = mb_strtolower($concept . ' ' . $supplier);

        // 1. Cloud, Hosting, Software SaaS
        if (preg_match('/(aws|amazon|google cloud|gcp|azure|hosting|servidor|cloud|ec2|s3|database|vps|acens|vercel|github|stripe)/i', $text)) {
            return [
                'account_code' => '628.000',
                'account_name' => 'Suministros IT (Cloud & Hosting)',
                'cost_center' => 'CC-IT-INFRA'
            ];
        }

        // 2. Hardware, Devices, Components & Goods
        if (preg_match('/(hardware|disco|ssd|nvme|monitor|pantalla|switch|router|port[áa]til|laptop|ordenador|teclado|rat[oó]n|dell|cisco|samsung|producto|mercader[íi]a|art[íi]culo|material)/i', $text)) {
            return [
                'account_code' => '600.000',
                'account_name' => 'Compras de Mercaderías y Hardware',
                'cost_center' => 'CC-ENG-DEV'
            ];
        }

        // 3. Telecommunications & Connectivity
        if (preg_match('/(telef[oó]nica|fibra|m[oó]vil|sip|internet|vodafone|orange|movistar|centralita|roaming|datos ilimitados)/i', $text)) {
            return [
                'account_code' => '629.000',
                'account_name' => 'Comunicaciones y Telecomunicaciones',
                'cost_center' => 'CC-CORP-OPS'
            ];
        }

        // 4. Professional Freelance Services, Legal, Audit, Software Architecture
        if (preg_match('/(abogad|asesor|consultor|auditor|honorari|notar|ingenier|desarrollo|refactor|owasp|arquitecto|freelance|irpf)/i', $text)) {
            return [
                'account_code' => '623.000',
                'account_name' => 'Servicios de Profesionales Independientes',
                'cost_center' => 'CC-ADMIN-LEGAL'
            ];
        }

        // 5. Hospitality, Restaurant, Meals, Food
        if (preg_match('/(restaurante|comida|almuerzo|cena|men[úu]|vino|gastrobar|taberna|cafeter[íi]a|catering)/i', $text)) {
            return [
                'account_code' => '629.004',
                'account_name' => 'Gastos de Restauración y Dietas',
                'cost_center' => 'CC-CORP-OPS'
            ];
        }

        // 6. Travel, Taxis, Hotels, Trains
        if (preg_match('/(taxi|uber|cabify|hotel|vuelo|avi[oó]n|tren|renfe|peaje|gasolina)/i', $text)) {
            return [
                'account_code' => '629.003',
                'account_name' => 'Viajes y Desplazamientos',
                'cost_center' => 'CC-SALES-MKT'
            ];
        }

        // 7. Advertising & Marketing
        if (preg_match('/(google ads|meta ads|publicidad|marketing|campa[ñn]a|seo|branding|linkedin ads)/i', $text)) {
            return [
                'account_code' => '627.000',
                'account_name' => 'Publicidad y Propaganda',
                'cost_center' => 'CC-SALES-MKT'
            ];
        }

        // 8. Rent & Coworking
        if (preg_match('/(alquiler|arrendamiento|coworking|oficina|wework)/i', $text)) {
            return [
                'account_code' => '621.000',
                'account_name' => 'Arrendamientos y Cánones',
                'cost_center' => 'CC-CORP-OPS'
            ];
        }

        // 9. Logistics, Transport & Freight
        if (preg_match('/(transporte|paletizado|flete|env[íi]o|mensajer[íi]a|log[íi]stica|portes|courier|dhl|fedex|ups|seur)/i', $text)) {
            return [
                'account_code' => '624.000',
                'account_name' => 'Transportes y Mensajería Logística',
                'cost_center' => 'CC-CORP-OPS'
            ];
        }

        // 10. Insurance Premiums
        if (preg_match('/(seguro|p[oó]liza|prima|aseguradora|cobertura|mapfre|allianz|mutua)/i', $text)) {
            return [
                'account_code' => '625.000',
                'account_name' => 'Primas de Seguros',
                'cost_center' => 'CC-ADMIN-LEGAL'
            ];
        }

        // 11. Maintenance, Repairs & Technical Support
        if (preg_match('/(reparaci[oó]n|mantenimiento|conservaci[oó]n|revisi[oó]n|aver[íi]a)/i', $text)) {
            return [
                'account_code' => '622.000',
                'account_name' => 'Reparaciones y Conservación',
                'cost_center' => 'CC-CORP-OPS'
            ];
        }

        // 12. Banking Services & Payment Gateway Fees
        if (preg_match('/(comisi[oó]n bancaria|banco|tarjeta|tpv|pasarela|redsys|intercambio)/i', $text)) {
            return [
                'account_code' => '626.000',
                'account_name' => 'Servicios Bancarios y Similares',
                'cost_center' => 'CC-ADMIN-LEGAL'
            ];
        }

        return [
            'account_code' => '628.000',
            'account_name' => 'Suministros IT / Servicios Generales',
            'cost_center' => 'CC-CORP-OPS'
        ];
    }
}
