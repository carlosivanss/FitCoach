# FitCoach móvil

Aplicación Expo + React Native exclusiva para pacientes.

## Configuración

1. Copia `.env.example` como `.env`.
2. Coloca la URL y publishable key del mismo proyecto Supabase utilizado por el panel web.
3. Agrega `fitcoach://activate` a las Redirect URLs de Supabase Auth.

## Funciones disponibles

- Inicio de sesión exclusivo para perfiles `patient`.
- Activación de invitaciones y creación de contraseña.
- Selección de rutina y día de entrenamiento.
- Registro de series, repeticiones y peso.
- Temporizador automático de descanso.
- Duración y finalización consistente de sesiones.
- Captura e historial de peso, grasa corporal, masa muscular y cintura.
- Resumen de cumplimiento semanal.

## Ejecución

```powershell
pnpm --dir mobile start
pnpm --dir mobile android
```

Para regenerar el proyecto nativo después de cambiar `app.json`:

```powershell
pnpm --dir mobile exec expo prebuild --clean
```
