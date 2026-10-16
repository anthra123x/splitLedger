# SplitLedger: Motor Forense de Descomposicion, Auditoria y Conciliacion Contable de Facturas

Plataforma integral de alta precision para el procesamiento, desagregacion multidimensional y conciliacion contable automatizada de facturas, tickets de compra y documentos mercantiles heterogeneos (PDF vectorial, escaneos rasterizados de resolucion variable, imagenes WebP/PNG/JPEG y Facturae/UBL XML).

El sistema implementa una arquitectura desacoplada en tres niveles: interfaz de usuario interactiva de doble panel (React 19 + Vite + TypeScript), API Gateway transaccional y orquestador de ingesta (Laravel 12 / PHP 8) y microservicio de inferencia cognitiva neuro-simbolica y algebra forense (FastAPI / Python 3.12).

---

## 1. Arquitectura del Sistema

```
[ Cliente Web (React 19 + TS) ]
        │
        │ HTTP / Server-Sent Events (SSE)
        ▼
[ API Gateway & Ingesta (Laravel 12) ] ──► [ Almacenamiento Transaccional (Neon PostgreSQL / SQLite) ]
        │
        │ HTTP REST / Port 8100
        ▼
[ Microservicio de Inferencia Cognitiva (FastAPI / Python 3.12) ]
  ├── 1. Sanitizador y Validador Fiscal (FiscalTaxIdValidator)
  ├── 2. Motor de Razonamiento CoT (SplitReasoner)
  ├── 3. Solver Algebraico Forense (ComplexMathForensicSolver - Rouche-Frobenius)
  ├── 4. Normalizador de Divisas PGC NRV 11a (CurrencyTriangulationEngine)
  ├── 5. Analizador de Puntualidad y Plazos (TemporalPunctualityEngine)
  └── 6. Generador de Asientos Contables PGC (DoubleEntrySeat)
```

---

## 2. Flujo de Procesamiento End-to-End

El ciclo de vida de una factura en SplitLedger se ejecuta en seis fases secuenciales:

1. **Ingesta Segura y Deteccion de Tipo**:
   - Ingesta unitaria, masiva o via contenedores comprimidos ZIP.
   - Analisis de cabeceras binarias y proteccion defensiva estricta contra ataques de descompresion (Zip-Slip) y desbordamiento de cuota (Zip-Bombs).
   - Transmision de progreso en tiempo real mediante Server-Sent Events (SSE) en `/api/invoices/upload-stream`.

2. **Extraccion de Capa de Texto y Rasterizacion**:
   - Para documentos electronicos estructurados (Facturae 3.2.x, UBL XML), el parser nativo extrae arboles DOM y nodos contables sin perdida de resolucion.
   - Para documentos escaneados o imagenes, el pipeline ejecuta preprocesamiento de contraste y extraccion optica de caracteres (OCR) multilingue conservando coordenadas espaciales relativas.

3. **Inferencia Cognitiva y Segmentacion Neuro-Simbolica**:
   - El motor `SplitReasoner` evalua las lineas del documento mediante una traza de razonamiento transparente (Chain-of-Thought).
   - Extrae identificadores mercantiles (numero de serie, fechas de emision y vencimiento, razon social del emisor y receptor, domicilios, telefonos, emails e IBAN).
   - Corrige activamente distorsiones OCR recurrentes en NIFs y CIFs (por ejemplo, normalizacion de la letra de control 'A' leida como '4' en DNI o prefijo 'B' leido como '8' en CIF de Sociedades Limitadas).

4. **Reconciliacion Algebraica Forense**:
   - Planteamiento del sistema de restricciones lineales:
     `Total Declarado = Base Imponible + Cuotas IVA + Recargos Equivalencia - Retenciones IRPF`
   - Deteccion automatica de retenciones legales en facturas de profesionales autonomos (1%, 2%, 7%, 9%, 15%, 19%, 21% conforme a la Ley del IRPF).
   - Conciliacion especifica de regimenes especiales, como el Recargo de Equivalencia (5,2%, 1,4%, 0,5%), Inversion de Sujeto Pasivo (Reverse Charge con IVA 0%) y exenciones tributarias.
   - En caso de contradiccion en el documento de origen, el Teorema de Rouche-Frobenius determina la solubilidad del sistema y calcula la proyeccion ortogonal de minimos cuadrados L2.

5. **Mapeo y Generacion de Partida Doble PGC**:
   - Clasificacion automatizada de partidas en cuentas contables del Plan General Contable espanol (Grupo 6 para compras y gastos, Grupo 47 para IVA soportado, recargos y retenciones, Grupo 40/41 para proveedores y acreedores).
   - Comprobacion estricta de cuadratura: la suma total del Debe coincide exactamente con la suma total del Haber.

6. **Persistencia y Visualizacion Interactiva**:
   - Registro en base de datos con estructura relacional transaccional (Invoice e InvoiceItem).
   - Renderizado en la estacion de trabajo frontend con resaltado de partidas, seleccion interactiva y capacidad de rectificacion manual en tiempo real.

---

## 3. Modulos Principales

### Motor Cognitivo (`ai_engine/`)

- **`SplitReasoner`** (`app/core/reasoner.py`): Orquesta la traza de pensamiento CoT, el analisis tabular multitasa y la reconciliacion sintetica de importes y descuentos.
- **`FiscalTaxIdValidator`** (`app/core/tax_id_validator.py`): Validador forense de NIF (DNI personas fisicas), NIE (ciudadanos comunitarios/extranjeros), CIF (entidades juridicas por tipologia de sociedad) y operadores intracomunitarios VIES.
- **`ComplexMathForensicSolver`** (`app/core/complex_math_solver.py`): Analizador algebraico que evalua la paridad de partida doble, calcula normas de error residual y diagnostica sistemas incompatibles sobre-determinados.
- **`CurrencyTriangulationEngine`** (`app/core/currency_normalizer.py`): Triangulador de divisas extranjeras (USD, GBP, CHF, JPY) hacia EUR aplicando redondeo Banker's Half-Even segun la norma de valoracion 11a del PGC.
- **`TemporalPunctualityEngine`** (`app/core/temporal_punctuality.py`): Normalizador de plazos de pago comerciales (Ley 3/2004 de morosidad comercial), calculo de dias de demora y clasificacion de estado de vencimiento.

### Backend Transaccional (`backend/`)

- **`InvoiceController`** (`app/Http/Controllers/InvoiceController.php`): Controlador REST con soporte para paginacion, filtrado por estados y rangos de fechas, streaming SSE y exportacion en ZIP.
- **`OcrService`** (`app/Services/OcrService.php`): Motor de integracion OCR local con preprocesamiento de imagenes y limpieza automatica de temporales.
- **`SplitLlmEngineService`** (`app/Services/SplitLlmEngineService.php`): Adaptador de conexion HTTP con el microservicio de IA local y fallback heuristico determinista.
- **`ProfileController`** y **`MetricsController`**: Gestion de auditoria contable de usuario, control de cuotas y metricas operativas en tiempo real.

### Frontend de Alta Precision (`client/`)

- **`WorkspaceView`** (`src/views/WorkspaceView.tsx`): Centro de control con zona de carga reactiva, monitor de transmision SSE y tabla historica de facturas.
- **`DetailView`** (`src/views/DetailView.tsx`): Vista analitica dividida: visor estructurado de la factura en el panel izquierdo (con datos de emisor, receptor, partidas e identificadores) y libro mayor contable PGC con asiento de partida doble y herramientas de conciliacion en el panel derecho.
- **`ProfileModal`** (`src/components/ProfileModal.tsx`): Despliegue de credenciales, balance historico y volumen acumulado de facturas procesadas.

---

## 4. Endpoints de la API REST

| Metodo | Ruta | Descripcion |
| :--- | :--- | :--- |
| `GET` | `/api/invoices` | Listado paginado de facturas con soporte para busqueda y filtros de estado. |
| `GET` | `/api/invoices/{id}` | Recupera el desglose completo, partidas y asiento contable de una factura. |
| `POST` | `/api/invoices/upload` | Carga sincrona de archivos (PDF, imagenes, hojas de calculo, JSON, XML). |
| `POST` | `/api/invoices/upload-stream` | Carga y procesamiento asincrono de lotes con telemetria en tiempo real via SSE. |
| `PUT` | `/api/invoices/{id}` | Actualiza partidas contables, importes y estado de conciliacion. |
| `DELETE` | `/api/invoices/{id}` | Elimina el registro contable y los archivos fisicos asociados. |
| `GET` | `/api/invoices/export-zip` | Exportacion de dossier contable en ZIP (incluye CSV maestro, JSON e informe de auditoria). |
| `GET` | `/api/user/profile` | Datos de perfil del auditor, volumen acumulado y tasa de paridad contable. |
| `GET` | `/api/metrics/summary` | Metricas globales de volumen procesado, importes y precision media. |
| `POST` | `/api/v1/decompose` | Endpoint del microservicio Python para descomposicion cognitiva y calculo forense. |

---

## 5. Instalacion y Puesta en Marcha

### Requisitos Previos

- **Node.js**: Version 18.0 o superior (compatible con Node 20 LTS / 22).
- **PHP**: Version 8.2 o superior, con extensiones `pdo`, `pdo_sqlite`, `pdo_pgsql`, `mbstring`, `zip`, `fileinfo`.
- **Python**: Version 3.10 o superior (recomendado gestor `uv` o entorno virtual `venv`).
- **Tesseract OCR**: Binario instalado en el sistema (`tesseract-ocr`).

### Configuracion de Entorno

1. Configurar variables del backend en `backend/.env`:
```bash
cp backend/.env.example backend/.env
```

2. Definir conexion a base de datos y microservicio en `backend/.env`:
```env
APP_NAME=SplitLedger
APP_ENV=local
APP_URL=http://localhost:8000

DB_CONNECTION=sqlite
# Para Neon PostgreSQL Serverless:
# DB_CONNECTION=pgsql
# DB_URL=postgresql://user:password@endpoint.neon.tech/neondb?sslmode=require

AI_ENGINE_URL=http://127.0.0.1:8100
OPENROUTER_API_KEY=
OPENROUTER_DEFAULT_MODEL=openrouter/free
```

3. Instalar dependencias:
```bash
# Dependencias generales y frontend
npm install
cd client && npm install && cd ..

# Dependencias backend PHP
cd backend && composer install && cd ..

# Dependencias microservicio Python
cd ai_engine && uv sync  # O: python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
cd ..
```

4. Ejecutar migraciones de base de datos:
```bash
php backend/artisan migrate --force
```

---

## 6. Ejecucion de los Servicios

Para levantar la estacion de trabajo completa en modo desarrollo:

```bash
# Iniciar backend Laravel y frontend Vite
npm run dev
```

En terminales independientes (arquitectura modular):

```bash
# Terminal 1: Microservicio Python FastAPI (puerto 8100)
cd ai_engine && uv run uvicorn app.main:app --host 127.0.0.1 --port 8100 --reload

# Terminal 2: Servidor API Laravel 12 (puerto 8000)
php backend/artisan serve --port 8000

# Terminal 3: Cliente Frontend Vite (puerto 5173 o 5174)
cd client && npm run dev
```

- **Acceso Web SplitLedger**: [http://localhost:5173](http://localhost:5173)
- **API Laravel**: [http://localhost:8000](http://localhost:8000)
- **Docs Microservicio AI**: [http://localhost:8100/docs](http://localhost:8100/docs)

---

## 7. Pruebas y Control de Calidad

El repositorio incorpora suites de pruebas automatizadas:

```bash
# Validacion integral de regresion, streaming SSE, cuotas y exportacion ZIP
python3 tests/test_debts_and_features.py

# Validacion de perfiles de usuario y filtros avanzados
python3 tests/test_profile_and_filtered_export.py

# Compilacion y comprobacion de tipos frontend
cd client && npm run build
```

---

## 8. Seguridad y Cumplimiento Normativo

- **Principio de Minimo Privilegio**: No se almacenan secretos ni credenciales en el arbol de codigo fuente. Todo parametro sensible se gestiona via `.env`.
- **Defensa en Profundidad (OWASP)**:
  - Validacion estricta de tipos MIME en frontera y limitacion de tamano de payload (50 MB).
  - Sanitizacion de nombres de archivo mediante identificadores UUIDv4.
  - Consultas parametrizadas mediante sentencias preparadas (prevencion de inyeccion SQL).
  - Mitigacion contra ataques de denegacion de servicio y compresion maliciosa (Zip-Slip y Zip-Bombs).
- **Plan General Contable (PGC)**: Cumplimiento de la normativa contable espanola, garantizando que todo gasto y cuota impositiva derive en asientos de partida doble formalmente equilibrados.
