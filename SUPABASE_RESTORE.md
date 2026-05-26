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
La base de datos contiene los metadatos (en la tabla `storage.objects`), pero los archivos reales (imágenes, documentos) se guardan en el volumen de Docker de Storage.

1. **Respaldar el Storage (Servidor de Origen):**
   ```bash
   tar -czf /var/backups/supabase-storage-backup.tar.gz -C /var/lib/docker/volumes/[VOLUMEN_STORAGE_ORIGEN]/_data .
   ```
2. **Restaurar el Storage (Servidor de Destino):**
   ```bash
   # Limpiar carpeta de destino
   rm -rf /var/lib/docker/volumes/[VOLUMEN_STORAGE_DESTINO]/_data/*
   
   # Extraer archivos binarios
   tar -xzf /var/backups/supabase-storage-backup.tar.gz -C /var/lib/docker/volumes/[VOLUMEN_STORAGE_DESTINO]/_data/
   
   # Reiniciar contenedor de storage para recargar permisos
   docker restart [CONTENEDOR_STORAGE_DESTINO]
   ```

### B. Copiar Variables de Entorno y Claves JWT (`.env`)
Los tokens de sesión de tus usuarios (`anon` y `service_role`) y las conexiones se firman con la clave secreta JWT configurada en el archivo `.env` o `docker-compose.yml`.
* **Regla de Oro:** Siempre copia los archivos de configuración (`.env` y configuraciones de `Kong API Gateway`) de tu servidor de origen al de destino. Si estas claves cambian, los usuarios actuales no podrán iniciar sesión y tu API de backend de .NET no se podrá conectar a la base de datos de Supabase.

### C. Desplegar Edge Functions (si aplica)
Las funciones TypeScript no residen en Postgres. Deben ser copiadas en la carpeta montada `./supabase/functions` de tu servidor o ser desplegadas de nuevo utilizando el CLI de Supabase:
```bash
supabase functions deploy [NOMBRE_FUNCION]
```

