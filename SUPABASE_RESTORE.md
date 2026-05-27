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

Para respaldar y restaurar correctamente, sigue uno de estos métodos:

#### Opción 1: Método Universal (Usando `docker cp` y `tar` con xattrs - Recomendado)
Este método no requiere saber en qué ruta física del disco del servidor están los archivos, ya que se leen directamente del contenedor.

1. **Respaldar el Storage (Origen):**
   ```bash
   # Copiar los archivos del contenedor a una carpeta temporal del host
   docker cp [NOMBRE_CONTENEDOR_STORAGE]:/var/lib/storage /var/backups/storage_temp
   
   # Comprimir la carpeta temporal preservando xattrs
   tar --xattrs --xattrs-include='user.supabase.*' -czf /var/backups/supabase-storage-backup.tar.gz -C /var/backups/storage_temp .
   
   # Eliminar la carpeta temporal
   rm -rf /var/backups/storage_temp
   ```
2. **Restaurar el Storage (Destino):**
   ```bash
   # Crear carpeta temporal y extraer el backup preservando xattrs
   mkdir -p /var/backups/storage_restore
   tar --xattrs --xattrs-include='user.supabase.*' -xzf /var/backups/supabase-storage-backup.tar.gz -C /var/backups/storage_restore
   
   # Limpiar el directorio actual dentro del contenedor de destino
   docker exec -u 0 [NOMBRE_CONTENEDOR_STORAGE] rm -rf /var/lib/storage/*
   
   # Copiar los archivos restaurados al contenedor de destino
   docker cp /var/backups/storage_restore/. [NOMBRE_CONTENEDOR_STORAGE]:/var/lib/storage/
   
   # Limpiar carpeta temporal y reiniciar el contenedor para refrescar permisos
   rm -rf /var/backups/storage_restore
   docker restart [NOMBRE_CONTENEDOR_STORAGE]
   ```

#### Opción 2: Método Directo en el Host (Ruta de Dokploy con rsync o tar con xattrs)
Si prefieres manipular los directorios en el servidor directamente, primero localiza la ruta física ejecutando:
```bash
docker inspect [NOMBRE_CONTENEDOR_STORAGE] --format '{{range .Mounts}}{{if eq .Destination "/var/lib/storage"}}{{.Source}}{{end}}{{end}}'
```
*En tu servidor de Dokploy actual, la ruta origen es: `/etc/dokploy/compose/devops-supabase-3mbeiq/files/volumes/storage`*

1. **Respaldar en el Host:**
   ```bash
   tar --xattrs --xattrs-include='user.supabase.*' -czf /var/backups/supabase-storage-backup.tar.gz -C /etc/dokploy/compose/devops-supabase-3mbeiq/files/volumes/storage .
   ```
2. **Restaurar en el Host:**
   ```bash
   # Limpiar la ruta física de destino
   rm -rf /etc/dokploy/compose/[PROJECT_ID_DESTINO]/files/volumes/storage/*
   
   # Descomprimir los archivos preservando xattrs
   tar --xattrs --xattrs-include='user.supabase.*' -xzf /var/backups/supabase-storage-backup.tar.gz -C /etc/dokploy/compose/[PROJECT_ID_DESTINO]/files/volumes/storage/
   
   # O si copias directamente entre carpetas del host sin tar, usa rsync con -aAX para preservar xattrs:
   # rsync -aAX /etc/dokploy/compose/[PROJECT_ID_ORIGEN]/files/volumes/storage/ /etc/dokploy/compose/[PROJECT_ID_DESTINO]/files/volumes/storage/
   
   # Reiniciar el contenedor
   docker restart [NOMBRE_CONTENEDOR_STORAGE]
   ```

#### 🛠️ ¿Cómo solucionar si ya copiaste los archivos y faltan los atributos extendidos?
Si ya migraste los archivos y no puedes visualizarlos/descargarlos porque perdiste los xattrs, ejecuta este script Python directamente en tu servidor para reconstruirlos a partir de los archivos `.json` de metadatos (necesita el paquete `attr` instalado: `apt-get install attr`):
```python
# Crear y ejecutar como script de Python en el servidor (ej: python3 restore_xattrs.py)
import os, json, subprocess

storage_dir = "/etc/dokploy/compose/[PROJECT_ID]/files/volumes/storage"

for root, dirs, files in os.walk(storage_dir):
    for file in files:
        if file.endswith(".json"):
            json_path = os.path.join(root, file)
            file_path = json_path[:-5]
            if os.path.exists(file_path):
                try:
                    with open(json_path, 'r', encoding='utf-8') as f:
                        meta = json.load(f).get("metadata", {})
                    if meta.get("contentType"):
                        subprocess.run(["setfattr", "-n", "user.supabase.content-type", "-v", meta["contentType"], file_path], check=True)
                    if meta.get("cacheControl"):
                        subprocess.run(["setfattr", "-n", "user.supabase.cache-control", "-v", meta["cacheControl"], file_path], check=True)
                    print(f"Restaurado xattrs para: {file_path}")
                except Exception as e:
                    print(f"Error en {file_path}: {e}")
```


### B. Copiar Variables de Entorno y Claves JWT (`.env`)
Los tokens de sesión de tus usuarios (`anon` y `service_role`) y las conexiones se firman con la clave secreta JWT configurada en el archivo `.env` o `docker-compose.yml`.
* **Regla de Oro:** Siempre copia los archivos de configuración (`.env` y configuraciones de `Kong API Gateway`) de tu servidor de origen al de destino. Si estas claves cambian, los usuarios actuales no podrán iniciar sesión y tu API de backend de .NET no se podrá conectar a la base de datos de Supabase.

### C. Desplegar Edge Functions (si aplica)
Las funciones TypeScript no residen en Postgres. Deben ser copiadas en la carpeta montada `./supabase/functions` de tu servidor o ser desplegadas de nuevo utilizando el CLI de Supabase:
```bash
supabase functions deploy [NOMBRE_FUNCION]
```

