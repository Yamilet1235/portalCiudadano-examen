# CiudadConecta - Portal Municipal de Atención Ciudadana

Proyecto de examen final de **Desarrollo y Diseño Web**. Implementa **Serie I** (dos pantallas funcionales) y **Serie II** (backend REST, validaciones y Firebase Firestore).

## Requisitos
- **Node.js 22 o superior** y npm
- Git (recomendado)
- Cuenta de Firebase y proyecto en plan **Spark** (gratuito)

## Estructura
```
portal-municipal-quejas/
├── public/
│   ├── index.html      # Dos pantallas: ciudadano y administración
│   ├── styles.css      # Paleta azul, gris, dorado, verde oliva
│   ├── app.js          # Envío, compresión de fotos, login, filtros
│   └── favicon.svg
├── server/
│   └── index.js        # API REST, validaciones, sesión, Firebase
├── .env.example        # Ejemplo de variables privadas
├── .gitignore          # Evita subir claves al repositorio
├── package.json
└── README.md
```

## 1. Crear Firestore (gratis)

1. Abre https://console.firebase.google.com/ y crea un proyecto.
2. En el menú **Compilación / Build → Firestore Database**, selecciona **Crear base de datos**.
3. Elige la edición **Standard**, un lugar adecuado y **modo producción**. **No necesitas reglas públicas**: el acceso lo realiza el backend con Firebase Admin SDK. Deja las reglas de cliente bloqueadas; no uses reglas abiertas.
4. En **Configuración del proyecto (engranaje) → Cuentas de servicio → Firebase Admin SDK**, elige **Generar nueva clave privada**.
5. Coloca el JSON descargado en la raíz del proyecto con el nombre exacto **`serviceAccountKey.json`**. **No compartas ese archivo ni lo subas a GitHub.**

> No usamos Firebase Cloud Storage: requiere el plan Blaze. Para cumplir con el plan gratuito, cada foto se comprime en el navegador y se guarda como una cadena Base64 dentro del documento de Firestore. Funciona para un examen y fotos pequeñas. En producción convendría usar almacenamiento de objetos con controles de seguridad y costo adecuados.

## 2. Configurar el proyecto (Windows / PowerShell)

Abre la carpeta del proyecto en VS Code y luego la terminal:

```powershell
node -v
npm install
Copy-Item .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Abre el archivo `.env` y sustituye:
- `ADMIN_PASSWORD`: contraseña nueva para el Panel Municipal.
- `ADMIN_SESSION_SECRET`: el resultado aleatorio de 64 caracteres del comando anterior.
- Comprueba `GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json`.

**Importante:** el JSON privado debe estar en la raíz junto a `package.json`.

## 3. Iniciar y probar

```powershell
npm run check
npm start
```

Abre **http://localhost:3000**.

**Prueba completa:**
1. En *Portal Ciudadano*, escoge tipo y categoría, llena ubicación y descripción, adjunta foto y envía.
2. Debe aparecer **Solicitud registrada** con un código.
3. Abre *Panel Municipal*, escribe la contraseña de `.env` y entra.
4. El reporte debe aparecer en la tabla; haz clic en **Ver detalle** para ver la foto y la descripción original.
5. Recarga el navegador o reinicia el backend y comprueba que el reporte sigue disponible. Eso demuestra persistencia.
6. En Firebase Console → Firestore Database → Datos, verifica la colección `reportes_ciudadanos` y sus documentos.

## 4. Guardar cambios en Git (PowerShell)

```powershell
git init
git add .
git status
git commit -m "feat: portal municipal con frontend API y Firebase"
```

Si Git solicita configuración de identidad, configúrala con tu usuario/correo reales. **Antes del commit**, confirma que `.env`, `serviceAccountKey.json` y `node_modules` no aparezcan en `git status`.

Si vas a subirlo a GitHub, crea un repositorio privado vacío y conéctalo:

```powershell
git branch -M main
git remote add origin https://github.com/TU-USUARIO/TU-REPOSITORIO.git
git push -u origin main
```

Reemplaza esa URL por la de tu repositorio real; no es una URL lista para usar.

## Endpoints

| Método | Ruta | Acción |
|---|---|---|
| GET | `/api/health` | Estado básico del servidor |
| POST | `/api/reportes` | Registrar queja/reporte y foto comprimida |
| POST | `/api/admin/login` | Iniciar sesión municipal |
| GET | `/api/admin/sesion` | Validar sesión |
| GET | `/api/admin/reportes` | Consultar hasta 100 reportes, requiere sesión |
| POST | `/api/admin/logout` | Cerrar sesión |

## Diseño de los datos en Firestore

Colección `reportes_ciudadanos`:

```text
tipo: Queja | Reporte
categoria: Calles y carreteras | Alumbrado público | Agua potable | Basura y limpieza | Parques y espacios públicos | Otros
ubicacion: string
descripcion: string
nombre: string
fotografia: data:image/jpeg;base64,...
estado: Recibido
creadoEn: Firebase Timestamp
```

## Qué se demuestra ante el ingeniero

- **Serie I:** dos pantallas, formulario y fotografía, confirmación, admin protegido, estadísticas, búsqueda y detalle del reporte.
- **Serie II:** `frontend → API Express → Firestore → API Express → panel de administración`; datos reales, persistencia, validaciones cliente/servidor, manejo de errores, credenciales privadas separadas del frontend.
- **Serie III:** fuera del alcance solicitado; **no** incluye análisis de sentimiento, imagen ni GPT.

## Seguridad y límites del prototipo

- El archivo JSON de Firebase y el `.env` deben ser privados.
- Acceso al panel con contraseña en servidor y cookie HttpOnly de 4 horas.
- Validación de formatos y tamaño de fotografía; máximo 450 KB, para respetar el tamaño de un documento en Firestore.
- Limitación básica de solicitudes por IP.
- Para un despliegue real se requerirían HTTPS, gestión de cuentas y roles, almacenamiento dedicado de imágenes, protección adicional y controles de datos personales.
