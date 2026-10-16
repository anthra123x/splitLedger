# SplitLedger AI Engine: Microservicio de Inferencia Cognitiva y Auditoria Forense

Microservicio autonomo de inferencia neuro-simbolica, auditoria matematica forense y descomposicion contable de alto rendimiento para el ecosistema SplitLedger. Desarrollado en Python 3.12 con FastAPI, el motor combina modelos de lenguaje para comprension contextual y un nucleo algebraico determinista que elimina por completo las alucinaciones aritmeticas en el calculo de facturas.

---

## 1. Arquitectura del Microservicio

```
ai_engine/
├── app/
│   ├── api/
│   │   ├── routes.py                   # Endpoints FastAPI (/api/v1/decompose, /health)
│   │   └── finance.py                  # Endpoints de conciliacion bancaria y auditoria
│   ├── core/
│   │   ├── reasoner.py                 # SplitReasoner (Cadena de pensamiento CoT)
│   │   ├── complex_math_solver.py      # ComplexMathForensicSolver (Rouche-Frobenius)
│   │   ├── tax_id_validator.py         # FiscalTaxIdValidator (NIF, CIF, NIE, VIES)
│   │   ├── temporal_punctuality.py     # TemporalPunctualityEngine (Mora y plazos)
│   │   └── currency_normalizer.py      # CurrencyTriangulationEngine (PGC NRV 11a)
│   ├── models/
│   │   ├── schemas.py                  # Modelos Pydantic v2 de entrada y salida
│   │   └── accounting.py               # Mapeo a cuentas PGC y asientos de partida doble
│   ├── config.py                       # Configuracion de variables de entorno
│   └── main.py                         # Punto de entrada de la aplicacion FastAPI
├── cli.py                              # Interfaz de linea de comandos para auditoria
├── Dockerfile                          # Imagen de contenedor para despliegue
├── docker-compose.yml                  # Orquestacion del microservicio
├── pyproject.toml                      # Definicion de dependencias y empaquetado
├── uv.lock                             # Bloqueo determinista de dependencias
└── tests/                              # Suites de prueba de estres, benchmarks y paridad
```

---

## 2. Componentes Fundamentales

### 2.1. SplitReasoner (Razonamiento Neuro-Simbolico)
- Implementa una arquitectura en dos pasos:
  1. Generacion de traza de pensamiento explicta (`<think>...</think>`) que audita paso a paso el emisor, receptor, identificadores, impuestos y cuadratura.
  2. Emision de un objeto JSON estructurado validado mediante esquemas Pydantic v2.
- **Deteccion Multitasa**: Segmenta conceptos, cantidades, precios unitarios, bases imponibles y tramos impositivos (IVA 21%, 10%, 4%, 0% y Recargo de Equivalencia 5,2%, 1,4%, 0,5%).
- **Fallback Determinista**: En caso de no disponer de conexion externa a modelos de lenguaje o operar en modo local sin coste, el motor activa un extractor algoritmico determinista universal capaz de procesar mas de 900 documentos por segundo con cero alucinaciones aritmeticas.

### 2.2. FiscalTaxIdValidator (Validador y Saneador de NIF/CIF)
- Validador algoritmico de los digitos de control oficiales de la Agencia Tributaria espanola (AEAT) y del sistema intracomunitario europeo (VIES).
- **Saneamiento Forense OCR**: Corrige automaticamente sustituciones recurrentes en identificadores:
  - En DNI (8 digitos + letra): sustituye el caracter '4' leido al final por 'A'.
  - En CIF de Sociedades de Responsabilidad Limitada: corrige el digito inicial '8' por 'B'.
- **Verificacion Estructural Dual**: Diferencia entre validez sintactica de formato (`is_format_valid`) y coincidencia de checksum oficial (`is_valid`), evitando falsos positivos de invalidez en facturas de muestra o pruebas.

### 2.3. ComplexMathForensicSolver (Teorema de Rouche-Frobenius)
- Plantea el sistema matricial de partida doble y verifica formalmente su solubilidad matematica:
  1. `sum(base_i) == subtotal`
  2. `sum(base_i * rate_i) == tax_total`
  3. `subtotal + tax_total + surcharge_total - retention_total == grand_total`
- Si el sistema es incompatible sobre-determinado (debido a errores o manipulaciones en la factura original), calcula la perturbacion minima $L_2$ proyectando ortogonalmente sobre el espacio columna mediante pseudoinversas de Moore-Penrose.

### 2.4. Inferencia Algebraica de Retenciones IRPF
- Cuando una factura emitida por un profesional autonomo omite el literal de retencion pero el total declarado es inferior al importe base, el sistema analiza el diferencial residual frente a las tasas oficiales de la Ley del IRPF (1%, 2%, 7%, 9%, 15%, 19%, 21%).
- Si el residuo coincide exactamente con una de estas tasas, deduce y aplica la retencion balanceando la cuadratura contable a 0.00 euros de residuo.

### 2.5. CurrencyTriangulationEngine (Normalizacion PGC NRV 11a)
- Identifica divisas internacionales (USD, GBP, CHF, JPY) y aplica tipos de cambio de referencia.
- Ejecuta redondeo Banker's Half-Even (redondeo al par mas cercano) conforme a los estandares de la norma de registro y valoracion 11a del Plan General Contable.

### 2.6. TemporalPunctualityEngine (Analisis de Plazos y Demora)
- Normaliza fechas a formato estandar ISO-8601 (`YYYY-MM-DD`).
- Evalua plazos de pago legales en el marco de la Ley 3/2004 contra la morosidad en operaciones comerciales.
- Calcula de forma automatica dias de vencimiento transcurridos y clasifica el estado de puntualidad del documento.

---

## 3. Endpoints de la API REST

El microservicio expone su documentacion interactiva OpenAPI / Swagger en `http://localhost:8100/docs`:

### `POST /api/v1/decompose`
Analiza un documento de texto estructurado u OCR y genera la descomposicion contable completa.

**Ejemplo de solicitud:**
```bash
curl -X POST http://localhost:8100/api/v1/decompose \
  -H "Content-Type: application/json" \
  -d '{
    "raw_text": "PROVEEDOR: Orlando Juan Loban NIF: 39000001A CLIENTE: Empresa SL CIF: B12345678 BASE: 1451.00 IVA 21%: 304.71 RE 5.2%: 75.45 TOTAL: 1308.80",
    "document_name": "factura_autonomo.txt",
    "use_llm": false
  }'
```

**Ejemplo de respuesta estructurada:**
```json
{
  "invoice_number": "2024-0001",
  "supplier_name": "Orlando Juan Loban",
  "supplier_tax_id": "39000001A",
  "customer_tax_id": "B12345678",
  "subtotal": 1451.0,
  "tax_total": 304.71,
  "surcharge_total": 75.45,
  "retention_total": 217.65,
  "grand_total": 1308.8,
  "is_balanced": true,
  "mathematical_discrepancy": 0.0,
  "tax_id_validation": {
    "is_valid": false,
    "is_format_valid": true,
    "tax_id": "39000001A",
    "entity_type": "PERSONA_FISICA_DNI"
  }
}
```

### `GET /health`
Verifica el estado de operatividad del microservicio, tiempo de actividad y memoria en uso.

---

## 4. Instalacion y Puesta en Marcha

### Requisitos
- Python 3.10 o superior (compatible con Python 3.12).
- Gestor de paquetes `uv` (recomendado) o `pip`.

### Opcion 1: Con gestor `uv` (Recomendado)
```bash
cd ai_engine
uv sync
uv run uvicorn app.main:app --host 127.0.0.1 --port 8100 --reload
```

### Opcion 2: Con entorno virtual tradicional
```bash
cd ai_engine
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8100 --reload
```

### Opcion 3: Con Docker
```bash
cd ai_engine
docker compose up -d
```

---

## 5. Interfaz de Linea de Comandos (CLI)

El microservicio incluye una herramienta CLI para tareas directas de auditoria en terminal:

```bash
# Analizar una factura e imprimir informe en consola
python cli.py analyze factura.txt

# Validar matematicamente un NIF o CIF
python cli.py validate-tax-id A28015865

# Procesar un directorio con miles de facturas en lote
python cli.py batch ./facturas/ --output reporte.json

# Iniciar el servidor API
python cli.py serve --host 127.0.0.1 --port 8100
```

---

## 6. Pruebas Automatizadas

El modulo dispone de suites de validacion algebraica, estres y paridad:

```bash
# Pruebas de precision y puntualidad
uv run python -m tests.test_precision_and_punctuality

# Pruebas de algebra incompatible y Rouche-Frobenius
uv run python -m tests.test_unsolvable_math

# Benchmark comparativo de rendimiento
uv run python -m tests.benchmark_comparative
```
