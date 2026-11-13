# FitCoach · Panel web

Panel React para administrar pacientes, invitaciones, bajas, rutinas, biblioteca de ejercicios y progreso real almacenado en Supabase.

## Desarrollo local

Desde la raíz del repositorio:

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Completa en `.env.local` solamente `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. Ambas identifican al proyecto desde el navegador y son públicas por diseño. La protección de expedientes depende de las políticas RLS.

Nunca agregues una `service_role`, secret key ni contraseña a archivos `VITE_*`, al código React o al repositorio.

## Invitaciones

El botón **Invitar** llama a la Edge Function `invite-patient`. Despliégala con Supabase CLI y configura `PATIENT_INVITE_REDIRECT_URL` como secreto de la función. Supabase proporciona automáticamente sus credenciales internas dentro de las Edge Functions.

```powershell
supabase functions deploy invite-patient
supabase secrets set PATIENT_INVITE_REDIRECT_URL=fitcoach://activate
```

La función verifica que quien invita sea `admin` o el entrenador principal del paciente antes de utilizar la API administrativa.

## Comandos

- `npm run dev`: servidor local en el puerto 8082.
- `npm run build`: compilación de producción en `dist`.
- `npm test`: pruebas automatizadas.

## Ejercicios

El catálogo mantiene la licencia y atribución incluidas en `EXERCISES_NOTICE.md` y `EXERCISES_LICENSE.md`.

## Puesta en marcha (nutriólogo)

1. `npm install`
2. Copia `.env.example` a `.env.local` y completa solo `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` (nunca una `service_role`).
3. Aplica las migraciones de `supabase/migrations/` (incluida `20261113004230_create_routine_rpc.sql`, que guarda cada rutina en una sola transacción).
4. `npm run dev` y abre `http://localhost:8082`. Para producción: `npm run build` y publica la carpeta `dist/`.

### Roles y verificación en dos pasos
- Cuenta `trainer`: entra con correo y contraseña.
- Cuenta `admin`: las políticas RLS exigen MFA (aal2). La primera vez el panel muestra un QR para tu app de autenticación; después pide el código de 6 dígitos.

### Sin conexión
Los cambios de pacientes, mediciones y rutinas se guardan como borradores del usuario en el navegador y se envían solos al volver Internet. Los que fallen por datos inválidos aparecen en **Ajustes** para descartarlos.

### Navegación y biblioteca
- La navegación vive en la barra superior (Resumen, Pacientes, Rutinas, Ejercicios, Progreso). **Ajustes**, **Sincronizar** y **Cerrar sesión** están en el menú del usuario, arriba a la derecha. Junto a él se ve si hay conexión y cuántos cambios esperan sincronizarse.
- La biblioteca de ejercicios filtra por músculo y busca por nombre, músculo o equipo. La etiqueta Compuesto/Aislado es una aproximación: un ejercicio es compuesto si trabaja 2 o más músculos secundarios en el catálogo.

## Módulo Pacientes (Registrar · Consultar · Modificar)

- **Registrar**: «+ Nuevo paciente» valida los datos en el cliente, crea el expediente con `fc_create_client`, registra el peso inicial y envía la invitación. Sin conexión queda como borrador.
- **Consultar**: búsqueda por nombre, correo, teléfono u objetivo; filtros por estado (Activos, Pausados, Invitación pendiente, Baja) y ficha con estatura, nacimiento, último peso y rutinas.
- **Modificar**: edición con control de concurrencia (no sobrescribe si otro usuario cambió el expediente), baja lógica y reactivación. Los errores de Postgres se muestran en español.
