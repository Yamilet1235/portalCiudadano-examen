# CiudadConecta - Portal Municipal de Atención Ciudadana

Proyecto de examen final de **Desarrollo y Diseño Web**. Implementa **Serie I** (dos pantallas funcionales) y **Serie II** (backend REST, validaciones y Firebase Firestore).

## Requisitos
- **Node.js 22 o superior** y npm
- Git (recomendado)
- Cuenta de Firebase y proyecto en plan **Spark** (gratuito)

## 1. Estructura
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

*Importante:** el JSON privado debe estar en la raíz junto a `package.json`.

## 2. Iniciar y probar

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

## 3. Guardar cambios en Git 

```powershell
git init
git add .
git status
git commit -m "feat: portal municipal con frontend API y Firebase"
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


## Seguridad y límites del prototipo

- El archivo JSON de Firebase y el `.env` deben ser privados.
- Acceso al panel con contraseña en servidor y cookie HttpOnly de 4 horas.
- Validación de formatos y tamaño de fotografía; máximo 450 KB, para respetar el tamaño de un documento en Firestore.
- Limitación básica de solicitudes por IP.
- Para un despliegue real se requerirían HTTPS, gestión de cuentas y roles, almacenamiento dedicado de imágenes, protección adicional y controles de datos personales.
