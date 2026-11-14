# FitCoach móvil

Aplicación Expo + React Native exclusiva para pacientes.

## Configuración

1. Copia `.env.example` como `.env`.
2. Coloca la URL y publishable key del mismo proyecto Supabase utilizado por el panel web.
3. Agrega `fitcoach://activate` a las Redirect URLs de Supabase Auth.

## Funciones disponibles

Pantallas basadas en el PDF de diseño (`export.pdf`):

- **Inicio**: saludo, calendario semanal con ✓ (entrenaste) y ✕ (día de rutina sin registrar), tarjeta del entrenamiento de hoy y accesos a *Crea tu rutina*, *Fito IA*, *Mis rutinas* y *Agregar lesiones*.
- **Progreso**: sesiones de la semana, peso / grasa / masa muscular / cintura con variación, evolución de peso, cumplimiento por día y registro de medidas.
- **Login** y **Recupera tu cuenta** (enlace por correo); activación de invitaciones.
- **Rutina del día**: ejercicios Pendiente / Completado, menú por ejercicio (reemplazar, reemplazar y no sugerir, nota, video e instrucciones, favorito) y *Finalizar rutina*.
- **Registro por serie**: repeticiones, peso en **kg o lb** por serie, ✓ por serie, agregar serie y temporizador de descanso.
- **Fito IA** (5 pasos): lugar, equipo, días, enfoque/músculos y tiempo. Usa la Edge Function `generate-routine`.
- **Crea tu rutina**: nombre/objetivo/días, selector de ejercicios con búsqueda y filtros (grupo, tipo, músculo), series/reps/descanso y *Organiza tu semana*.
- **Lesiones**: se registran y se envían a Fito como limitaciones.
- Nombres de ejercicios en español (`src/data/exerciseNamesEs.ts`, generado desde `web/scripts/exercise-names-es.tsv`).

Migraciones que usa la app: `20261114180953_workout_set_units.sql` y `20261114181725_patient_routine_actions.sql`.

## Ejecución

```powershell
pnpm --dir mobile start
pnpm --dir mobile android
```

Para regenerar el proyecto nativo después de cambiar `app.json`:

```powershell
pnpm --dir mobile exec expo prebuild --clean
```

## Vista previa en navegador (solo desarrollo)

```powershell
pnpm --dir mobile exec expo start --web
```

En web la sesión se guarda en `localStorage`; en iOS/Android va al llavero seguro.
