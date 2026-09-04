# FitCoach

Plataforma para que un nutriólogo administre pacientes y rutinas, y para que los pacientes registren series, repeticiones, peso, tiempo y progreso desde Android o iPhone.

## Estructura

- `web`: panel React privado del nutriólogo.
- `mobile`: aplicación Expo + React Native para pacientes.
- `packages/shared`: contratos y tipos compartidos.
- `supabase/migrations`: esquema y políticas RLS.
- `supabase/functions`: operaciones administrativas protegidas.

## Configuración

```powershell
pnpm install
Copy-Item .env.example .env.local
Copy-Item mobile/.env.example mobile/.env
```

Completa los dos archivos locales con la URL y publishable key del mismo proyecto Supabase. Nunca guardes `service_role`, secret keys o contraseñas en el repositorio.

## Desarrollo

```powershell
pnpm dev:web
pnpm dev:mobile
```

Para Android Studio consulta `mobile/ANDROID_STUDIO.md`. La carpeta `mobile/android` contiene el proyecto nativo, pero los resultados de compilación y la ubicación local del SDK están excluidos de Git.

## Verificación

```powershell
pnpm build
pnpm test
pnpm typecheck
```

## Acceso

El nutriólogo crea el expediente desde el panel. La Edge Function `invite-patient` valida su rol, envía la invitación de Supabase y enlaza la cuenta con `fc_clients`. La baja es lógica y conserva el historial.

En Supabase, agrega `fitcoach://activate` en **Authentication → URL Configuration → Redirect URLs** y configura ese mismo valor en `PATIENT_INVITE_REDIRECT_URL` para la Edge Function. El enlace del correo abrirá la aplicación para que el paciente establezca su contraseña.
