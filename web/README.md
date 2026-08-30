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
supabase secrets set PATIENT_INVITE_REDIRECT_URL=https://tu-app-movil-o-web/activar
```

La función verifica que quien invita sea `admin` o el entrenador principal del paciente antes de utilizar la API administrativa.

## Comandos

- `npm run dev`: servidor local en el puerto 8082.
- `npm run build`: compilación de producción en `dist`.
- `npm test`: pruebas automatizadas.

## Ejercicios

El catálogo mantiene la licencia y atribución incluidas en `EXERCISES_NOTICE.md` y `EXERCISES_LICENSE.md`.
