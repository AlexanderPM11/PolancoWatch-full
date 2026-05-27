# Guía de Restauración de Base de Datos Supabase (Docker / Staging)

Esta guía documenta el procedimiento correcto para realizar copias de seguridad y restauraciones de la base de datos de Supabase en contenedores Docker, resolviendo problemas de dependencias de extensiones, colisiones de esquemas internos y permisos de triggers.

---

## 1. ¿Por qué la restauración estándar falla?
Supabase no es una base de datos PostgreSQL convencional. Durante el arranque del contenedor, se inicializan automáticamente esquemas críticos (`auth`, `storage`, `graphql`, `extensions`, `realtime`, etc.). 

Si intentas hacer una restauración limpia con `psql` directamente sobre una base de datos ya inicializada:
1. **Errores de duplicados:** Se producen errores tipo `relation already exists` y colisiones de llaves primarias en tablas del sistema (`schema_migrations`, `tenants`).
2. **Aborto en cascada:** PostgreSQL cancela la eliminación de múltiples esquemas si un solo esquema falla por dependencias de extensiones (como `cron` que depende de `pg_cron`).
3. **Permisos de triggers:** Tu copia de seguridad asigna propietarios a los event triggers del sistema (usualmente al rol `postgres`). En el contenedor de Supabase, el rol maestro superusuario es `supabase_admin` y `postgres` no tiene permisos de superusuario por defecto, lo que produce errores de tipo `Must be superuser to create an event trigger`.

---

## 2. Método Automatizado (Recomendado en tu Servidor)
En tu servidor de staging (`84.247.165.31`), ya se encuentra configurado y listo un script automatizado que realiza el proceso completo sin errores.

Para ejecutar la restauración de la base de datos desde la copia `/var/backups/Comodo-Supabase-Stagging.sql`, simplemente corre:

```bash
/root/restore_db.sh
```

---

## 3. Método Manual Paso a Paso (Comandos de Consola)
Si necesitas realizar la restauración de forma manual en un nuevo servidor o contenedor, sigue estos pasos estrictamente en la terminal de tu VPS:

### Paso 1: Elevar privilegios de `postgres` y limpiar la base de datos
Este comando otorga privilegios de superusuario temporalmente a `postgres` (necesario para restaurar la propiedad de los event triggers), elimina las extensiones conflictivas primero, y luego elimina todos los esquemas en cascada de forma individual para evitar abortos:

```bash
docker exec -i [NOMBRE_CONTENEDOR_DB] psql -U supabase_admin -d postgres <<EOF
ALTER ROLE postgres SUPERUSER;
DROP EXTENSION IF EXISTS pg_cron CASCADE;
DROP EXTENSION IF EXISTS pg_graphql CASCADE;
DROP EXTENSION IF EXISTS pg_net CASCADE;
DROP EXTENSION IF EXISTS pgjwt CASCADE;
DROP EXTENSION IF EXISTS supabase_vault CASCADE;
DROP EXTENSION IF EXISTS pgcrypto CASCADE;
DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;
DROP EXTENSION IF EXISTS pg_stat_statements CASCADE;
DROP EXTENSION IF EXISTS vector CASCADE;
DROP PUBLICATION IF EXISTS supabase_realtime;
DROP SCHEMA IF EXISTS public CASCADE;
DROP SCHEMA IF EXISTS auth CASCADE;
DROP SCHEMA IF EXISTS storage CASCADE;
DROP SCHEMA IF EXISTS extensions CASCADE;
DROP SCHEMA IF EXISTS graphql CASCADE;
DROP SCHEMA IF EXISTS graphql_public CASCADE;
DROP SCHEMA IF EXISTS realtime CASCADE;
DROP SCHEMA IF EXISTS _realtime CASCADE;
DROP SCHEMA IF EXISTS vault CASCADE;
DROP SCHEMA IF EXISTS pgbouncer CASCADE;
DROP SCHEMA IF EXISTS supabase_functions CASCADE;
DROP SCHEMA IF EXISTS cron CASCADE;
EOF
```

### Paso 2: Recrear el esquema `public`
PostgreSQL requiere tener el esquema de usuario inicializado antes de cargar las tablas:

```bash
docker exec -i [NOMBRE_CONTENEDOR_DB] psql -U supabase_admin -d postgres -c "CREATE SCHEMA public;"
```

### Paso 3: Restaurar el archivo SQL
Importa los datos del respaldo inyectándolo al contenedor. **Nota:** Usamos `-U supabase_admin` porque es el rol superusuario real de la base de datos:

```bash
cat /var/backups/Comodo-Supabase-Stagging.sql | docker exec -i [NOMBRE_CONTENEDOR_DB] psql -U supabase_admin -d postgres
```

### Paso 4: Revocar privilegios elevados de `postgres` (Seguridad)
Una vez finalizado el proceso de carga de datos y configuración, devuelve al usuario `postgres` a su estado seguro original:

```bash
docker exec -i [NOMBRE_CONTENEDOR_DB] psql -U supabase_admin -d postgres -c "ALTER ROLE postgres NOSUPERUSER;"
```

---

## 4. Buenas Prácticas para Copias de Seguridad (Dumps) con Supabase CLI
Si en el futuro deseas generar respaldos limpios que no contengan los metadatos internos de Supabase (evitando por completo tener que hacer drops complejos), la mejor alternativa es utilizar el **Supabase CLI**:

### 1. Respaldar la Estructura (Esquemas sin Datos)
El CLI filtra automáticamente la estructura núcleo de Supabase:
```bash
supabase db dump --db-url "postgresql://postgres:TU_PASSWORD@IP_DATABASE:5432/postgres" -f schema.sql
```

### 2. Respaldar solo los Datos (Contenido)
```bash
supabase db dump --db-url "postgresql://postgres:TU_PASSWORD@IP_DATABASE:5432/postgres" --data-only -f data.sql
```

### 3. Restaurar en Modo Réplica (Ignorando Triggers)
Para restaurar los datos sin que los triggers del sistema generen registros duplicados de prueba o violaciones de llaves foráneas en cascada:
```bash
# Inyectar modo replica al inicio de la carga del archivo de datos
(echo "SET session_replication_role = replica;"; cat data.sql) | docker exec -i [NOMBRE_CONTENEDOR_DB] psql -U supabase_admin -d postgres
```

---

## 5. Restauración Completa de Supabase (Almacenamiento y Secretos)

Para una restauración 100% funcional, la base de datos PostgreSQL no es suficiente. Debes asegurarte de restaurar los archivos físicos y la configuración.

### A. Respaldar y Restaurar Archivos Físicos (Supabase Storage)
La base de datos contiene únicamente los metadatos de los archivos (en la tabla `storage.objects`). Los archivos binarios reales (imágenes, documentos) se guardan físicamente en el disco o volumen montado del contenedor de Storage (`/var/lib/storage`).

#### ⚠️ IMPORTANTE: Atributos Extendidos (xattrs)
Supabase Storage guarda el `contentType` (`user.supabase.content-type`) y `cacheControl` (`user.supabase.cache-control`) en los atributos extendidos del sistema de archivos. Si copias o comprimes el Storage sin preservar los atributos extendidos, los archivos darán error 500 en Supabase al visualizarlos o descargarlos (`"The extended attribute does not exist"` o `ENODATA`).

El procedimiento correcto y más eficiente consiste en manipular directamente los directorios montados por Dokploy en el host VPS, utilizando `tar` con soporte para atributos extendidos o `rsync`.

Primero, localiza la ruta física del Storage en el host si es necesario (generalmente está bajo la carpeta del compose en `/etc/dokploy/compose/...`):
```bash
docker inspect [NOMBRE_CONTENEDOR_STORAGE] --format '{{range .Mounts}}{{if eq .Destination "/var/lib/storage"}}{{.Source}}{{end}}{{end}}'
```
*En tu servidor de Dokploy actual, la ruta de origen es: `/etc/dokploy/compose/devops-supabase-3mbeiq/files/volumes/storage`*

#### 1. Respaldar en el Host:
```bash
# Comprime el origen preservando atributos extendidos (xattrs) que guardan el contentType del archivo
tar --xattrs --xattrs-include='user.supabase.*' -czf /var/backups/supabase-storage-backup.tar.gz -C /etc/dokploy/compose/[PROJECT_ID_ORIGEN]/files/volumes/storage .
```

#### 2. Restaurar en el Host Destino:
```bash
# A. Borra de forma recursiva el directorio destino para evitar duplicados o archivos residuales
rm -rf /etc/dokploy/compose/[PROJECT_ID_DESTINO]/files/volumes/storage/*

# B. Descomprime el respaldo en el destino aplicando de nuevo todos los atributos extendidos (xattrs)
tar --xattrs --xattrs-include='user.supabase.*' -xzf /var/backups/supabase-storage-backup.tar.gz -C /etc/dokploy/compose/[PROJECT_ID_DESTINO]/files/volumes/storage/

# C. Cambia recursivamente el propietario a root para evitar problemas de permisos de lectura del contenedor
chown -R root:root /etc/dokploy/compose/[PROJECT_ID_DESTINO]/files/volumes/storage

# D. Reinicia el contenedor de almacenamiento para que Supabase reconozca y cargue los archivos
docker restart [NOMBRE_CONTENEDOR_STORAGE]
```

> [!TIP]
> **Alternativa directa con Rsync (Sin crear archivos .tar.gz):**
> Si estás copiando archivos directamente entre carpetas locales del mismo VPS (o entre servidores con SSH), puedes transferirlos en un solo comando conservando permisos (-a), y atributos extendidos (-A -X) con:
> ```bash
> # Copia todos los archivos directamente entre directorios locales del host conservando permisos y xattrs
> rsync -aAX /etc/dokploy/compose/[PROJECT_ID_ORIGEN]/files/volumes/storage/ /etc/dokploy/compose/[PROJECT_ID_DESTINO]/files/volumes/storage/
> ```



### B. Copiar Variables de Entorno y Claves JWT (`.env`)
Los tokens de sesión de tus usuarios (`anon` y `service_role`) y las conexiones se firman con la clave secreta JWT configurada en el archivo `.env` o `docker-compose.yml`.
* **Regla de Oro:** Siempre copia los archivos de configuración (`.env` y configuraciones de `Kong API Gateway`) de tu servidor de origen al de destino. Si estas claves cambian, los usuarios actuales no podrán iniciar sesión y tu API de backend de .NET no se podrá conectar a la base de datos de Supabase.

### C. Desplegar Edge Functions (si aplica)
Las funciones TypeScript no residen en Postgres. Deben ser copiadas en la carpeta montada `./supabase/functions` de tu servidor o ser desplegadas de nuevo utilizando el CLI de Supabase:
```bash
supabase functions deploy [NOMBRE_FUNCION]
```

