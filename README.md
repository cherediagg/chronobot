<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/7e5de0e2-38a5-4c46-8930-b428a06dd29b

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Conectar WhatsApp Web

Arranca la aplicación con `npm run dev` y pulsa **Activar Bot y Conectar**. El servidor inicia `chronobot.js`, que crea el cliente real de `whatsapp-web.js`; el QR que emite WhatsApp se muestra en la aplicación y se renueva cuando WhatsApp lo actualiza. Escanéalo desde **WhatsApp > Dispositivos vinculados > Vincular un dispositivo**.

El cliente procesa mensajes entrantes de contactos autorizados y guarda imágenes adjuntas en `public/imagenes/<contacto>/<mes>`. Las credenciales de la sesión local se conservan en `.wwebjs_auth`. Solo puede haber un navegador de WhatsApp Web con ese perfil. Al iniciar desde la web, si ya existe un cliente de ChronoBot, la API lo cierra y arranca una instancia administrada por la web para mostrar sus logs en tiempo real; el cierre conserva las credenciales de WhatsApp. No ejecutes `npm run bot` mientras la web administra el cliente.
