# Prueba local en Android Studio

1. Abre Android Studio.
2. Selecciona **Open**.
3. Abre esta carpeta, no la raíz del monorepo:

   `C:\Users\Diego Alonso\Documents\Codex\2026-08-14\v\apps\mobile\android`

4. Espera a que termine **Gradle Sync**. El primer proceso puede descargar Gradle y dependencias.
5. En **Device Manager**, crea o inicia un teléfono virtual con Android 13 o posterior.
6. Selecciona la configuración `app` y pulsa **Run**.

## Servidor de desarrollo

La compilación de depuración necesita Metro para cargar el código JavaScript. Antes de abrir la app en el emulador, ejecuta desde una terminal en `apps/mobile`:

```powershell
$env:NODE_USE_SYSTEM_CA='1'
$env:__UNSAFE_EXPO_HOME_DIRECTORY='C:\Users\Diego Alonso\Documents\Codex\2026-08-14\v\work\expo-home'
$env:EXPO_NO_TELEMETRY='1'
.\node_modules\.bin\expo.CMD start --localhost
```

El emulador de Android puede comunicarse con Metro en la misma computadora. No necesita hotspot ni túnel.

## Cuenta de prueba

Inicia sesión con el correo y contraseña de uno de los usuarios que tengan rol `patient` y un registro activo en `fc_clients`.

Flujo mínimo a verificar:

1. Inicio de sesión.
2. Nombre correcto del paciente.
3. Rutina asignada y días disponibles.
4. Captura de series, repeticiones y peso.
5. Finalización de rutina.
6. Registro de mediciones corporales.
7. Actualización del progreso en el panel web.
