# SplitLedger Backend: API Gateway, Ingesta y Orquestacion Contable

Servicio central de API Gateway, ingesta multiformato, persistencia transaccional y orquestacion contable del ecosistema SplitLedger. Desarrollado sobre el framework Laravel 12 (PHP 8.2+), el backend coordina el procesamiento de documentos mercantiles, la integracion con motores OCR locales y remotos, la comunicacion desacoplada con el microservicio de inferencia cognitiva de IA y la persistencia en base de datos (PostgreSQL Serverless en Neon o SQLite local).

---

## 1. Arquitectura y Componentes del Backend

El backend esta estructurado bajo una jerarquia limpia de capas (Controlador -> Servicio -> Repositorio/Modelo Eloquent -> DTO/Validadores):

```
backend/
├── app/
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── InvoiceController.php       # CRUD, Ingesta streaming SSE, Exportacion ZIP
│   │   │   ├── ProfileController.php       # Perfil del auditor, balance historico y paridad
│   │   │   └── MetricsController.php       # Metricas agregadas de facturas y volumen
│   │   └── Middleware/                     # CORS, Headers defensivos y rate limiting
│   ├── Models/
│   │   ├── Invoice.php                     # Cabecera mercantil, impuestos y metadatos
│   │   └── InvoiceItem.php                 # Partidas desagregadas, PGC y coordenadas
│   └── Services/
│       ├── SplitLlmEngineService.php       # Enlace con microservicio Python e inferencia
│       ├── OcrService.php                  # Extraccion local Tesseract y saneamiento
│       ├── ElectronicInvoiceParserService.php # Parser Facturae 3.2.x y UBL XML
│       ├── SpatialTokenizerService.php     # Tokenizacion 2D y clasificacion lexica
│       └── AccountingRulesService.php      # Reglas de clasificacion PGC y centros de coste
├── config/                                 # Configuraciones de app, database, cors, filesystems
├── database/
│   ├── migrations/                         # Esquema de tablas invoices e invoice_items
│   └── seeders/                            # Semillas de prueba
├── routes/
│   ├── api.php                             # Definicion de rutas REST y endpoints de streaming
│   └── web.php
└── tests/                                  # Suites de prueba automatizadas
```

---

## 2. Flujo de Ingesta y Descomposicion

1. **Recepcion de Documentos**:
   - `InvoiceController::upload`: Procesa archivos individuales o multiples de manera sincrona.
   - `InvoiceController::uploadStream`: Procesa lotes asincronos y archivos ZIP masivos transmitiendo telemetria en tiempo real mediante Server-Sent Events (SSE).

2. **Deteccion y Extraccion**:
   - Si el archivo es un XML estructurado (Facturae o UBL), `ElectronicInvoiceParserService` extrae directamente los nodos contables, bases y cuotas impositivas.
   - Si es un documento escaneado (PDF rasterizado, imagen WebP, PNG, JPEG, TIFF), `OcrService` ejecuta preprocesamiento visual y extraccion via Tesseract OCR con generacion de posiciones relativas.

3. **Orquestacion de Inferencia con el Microservicio de IA**:
   - `SplitLlmEngineService` envia el texto estructurado al microservicio FastAPI (`http://127.0.0.1:8100/api/v1/decompose`).
   - El microservicio ejecuta el razonamiento CoT, sanea los identificadores fiscales (NIF/CIF), balancea el sistema algebraico mediante Rouche-Frobenius y genera el asiento contable de partida doble.
   - En caso de indisponibilidad temporal del microservicio Python, `SplitLlmEngineService` activa de inmediato un motor de extraccion heuristica determinista neuro-simbolica de respaldo sin interrumpir la operacion.

4. **Persistencia Transaccional**:
   - Se persiste la cabecera `Invoice` y la coleccion de `InvoiceItem` dentro de una transaccion SQL atomica (`DB::transaction`).

---

## 3. Especificacion de Endpoints REST

### Gestion y Consulta de Facturas

#### `GET /api/invoices`
Retorna el listado paginado de facturas con metadatos calculados.
- **Parametros de consulta**:
  - `page` (int, default: 1): Numero de pagina.
  - `limit` (int, default: 15): Registros por pagina.
  - `status` (string, opcional): Filtrar por `reconciled`, `discrepant`, `pending`, `foreign_currency`.
  - `search` (string, opcional): Busqueda por numero de factura, proveedor o cliente.

#### `GET /api/invoices/{id}`
Obtiene el detalle completo de una factura por su UUID, incluyendo:
- Identificadores mercantiles (NIF/CIF emisor y receptor saneados).
- Desglose de importes (Subtotal, Cuota IVA, Recargo de Equivalencia, Retenciones IRPF, Total Liquidacion).
- Array de partidas desagregadas con cuenta contable PGC y centro de coste.
- Diagnostico de validacion de NIF oficial y conformidad estructural (`is_format_valid`).
- Analisis temporal de vencimiento y puntualidad comercial.
- Conversion de moneda extranjera (PGC NRV 11a) si la divisa difiere de EUR.
- Asiento contable de partida doble (Debe / Haber).

#### `PUT /api/invoices/{id}`
Permite al auditor rectificar manualmente partidas, bases, cuotas impositivas o cuentas contables. Al guardar, el backend recalcula automaticamente las sumas, evalua la paridad y actualiza el estado a `reconciled`.

#### `DELETE /api/invoices/{id}`
Elimina de forma segura el registro en base de datos y purga los archivos binarios almacenados en disco.

---

### Ingesta Masiva y Streaming SSE

#### `POST /api/invoices/upload-stream`
Endpoint de alta concurrencia que acepta colecciones de archivos o contenedores comprimidos ZIP.
- **Cabeceras de respuesta**: `Content-Type: text/event-stream`, `Cache-Control: no-cache`.
- **Estructura de eventos**:
  - `init`: Notifica el total de documentos extraidos y listos para procesamiento.
  - `progress`: Informa el indice actual, nombre de archivo y fase de procesamiento.
  - `item_processed`: Emite el payload completo de la factura recien conciliada.
  - `item_error`: Registra fallos no bloqueantes por documento con mensaje sanitizado.
  - `complete`: Resumen de cierre con total de facturas procesadas e importe acumulado.

---

### Exportacion y Dossier Contable

#### `GET /api/invoices/export-zip`
Genera y descarga un archivo comprimido ZIP con el dossier contable completo.
- **Parametros de filtrado**:
  - `ids`: Lista de UUIDs separados por coma para exportacion selectiva.
  - `date_from` / `date_to`: Rango de fechas de expedicion.
  - `limit`: Limite maximo de registros empaquetados (control de cuota).
- **Contenido del ZIP**:
  1. `SplitLedger_Libro_Mayor_Consolidado.csv`: Libro diario maestro en formato CSV delimitado por comas con codificacion UTF-8 BOM para apertura nativa en Microsoft Excel sin corrupcion de caracteres.
  2. `INFORME_AUDITORIA_FORENSE.txt`: Resumen ejecutivo con totales de base imponible, desglose de IVA por tramos (21%, 10%, 4%), recargos de equivalencia y retenciones IRPF.
  3. Carpeta `desgloses_json/`: Ficheros JSON estructurados individuales por cada documento procesado.
  4. Carpeta `documentos_fuente/`: Archivos originales preservados.

---

### Perfil y Metricas del Auditor

#### `GET /api/user/profile`
Devuelve la informacion del perfil del auditor autenticado, empresa asignada, estadisticas historicas de volumen contable auditado, paridad porcentual de balanceo y limites operativos.

#### `GET /api/metrics/summary`
Retorna indicadores clave de rendimiento (KPIs): volumen acumulado en EUR, cantidad de facturas conciliadas, precision promedio de extraccion y tiempo medio de procesamiento.

---

## 4. Configuracion y Variables de Entorno

El archivo de configuracion principal es `backend/.env`. Se proporciona una plantilla en `backend/.env.example`:

```env
APP_NAME=SplitLedger
APP_ENV=local
APP_KEY=base64:...
APP_DEBUG=true
APP_URL=http://localhost:8000

# Base de datos: SQLite para desarrollo local
DB_CONNECTION=sqlite

# O conexion a Neon PostgreSQL Serverless:
# DB_CONNECTION=pgsql
# DB_URL=postgresql://user:password@endpoint.neon.tech/neondb?sslmode=require

# Microservicio de IA local (SplitReasoner)
AI_ENGINE_URL=http://127.0.0.1:8100

# Proveedor remoto LLM (opcional para inferencia en la nube)
OPENROUTER_API_KEY=
OPENROUTER_DEFAULT_MODEL=openrouter/free
```

---

## 5. Medidas de Seguridad y Endurecimiento (OWASP)

1. **Defensa contra Zip-Slip y Zip-Bombs**:
   - Inspeccion estricta de rutas dentro de archivos ZIP para bloquear secuencias de escape de directorio (`..`, `/`, `\`).
   - Limitacion a un maximo de 300 documentos por contenedor ZIP para prevenir agotamiento de memoria o denegacion de servicio.

2. **Cero Secretos en Codigo**:
   - Ninguna credencial de base de datos ni token de API se almacena en el repositorio. Todo parametro sensible proviene de variables de entorno protegidas por `.gitignore`.

3. **Prevencion de Inyeccion SQL (SQLi)**:
   - Todas las consultas de lectura, filtrado y escritura se ejecutan mediante el ORM Eloquent y sentencias preparadas parametrizadas en PDO.

4. **Saneamiento de Salidas y Manejo de Errores**:
   - Los bloques de captura de excepciones registran el detalle del error en los logs internos (`storage/logs/laravel.log`) pero devuelven al cliente respuestas JSON limpias sin exponer volcados de pila (stack traces).
