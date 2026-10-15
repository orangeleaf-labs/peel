---
title: Chat con AI
description: Asistente integrado con más de 90 herramientas para crear, modificar y analizar diseños.
---

# Chat con AI

Pulsa <kbd>⌘</kbd><kbd>J</kbd> o <kbd>Ctrl</kbd><kbd>J</kbd>. El asistente puede crear formas, modificar estilos, configurar disposiciones, trabajar con componentes y analizar el documento.

## Configurar modelos

La primera vez que abres OpenPencil, la configuración guiada pregunta en qué debe ayudarte la IA y qué usas ya: un agente de programación como Claude Code, Codex o Gemini CLI en la aplicación de escritorio o una clave de la API de Anthropic. Conecta ese acceso y lo asigna a los roles **Design agent** y **Vision**, sin tocar lo que configuraste a mano. Puedes omitirla y volver a ejecutarla desde **Ajustes → IA y agentes → Iniciar la configuración guiada**. Para configurar los modelos a mano:

1. Abre el chat.
2. Selecciona el icono de ajustes.
3. Añade un perfil y configura conexión, identificador del modelo, credenciales y capacidades.

Puedes guardar varios perfiles y asignarlos por separado a diseño, revisiones, tareas rápidas y entrada de imágenes. Los perfiles que comparten una conexión reutilizan la misma credencial almacenada de forma segura.

## Proveedores

Peel usa únicamente la API de Anthropic. Obtén una clave en [console.anthropic.com](https://console.anthropic.com) y elige un modelo Claude de la lista integrada, que viene con la aplicación, de modo que elegir modelo no contacta con ningún otro servicio. Las solicitudes van directamente a `api.anthropic.com`; no hay URL base personalizada. En la aplicación de escritorio, la clave se guarda en el almacén de credenciales del sistema operativo.

## Agentes ACP y MCP remoto

La aplicación de escritorio puede ejecutar agentes ACP y conectarlos a servidores remotos de confianza que implementen [Model Context Protocol](https://modelcontextprotocol.io/). En **Ajustes → Conexiones MCP**, añade un extremo HTTP transmisible, un nombre y, si hace falta, un token Bearer.

El token se guarda en el almacén seguro de credenciales, no en los ajustes ordinarios, y solo se recupera al iniciar la sesión ACP.

## Herramientas

Las herramientas cubren lectura, creación, modificación, estructura, variables, vectores, análisis, descripción, generación de código e imágenes de stock. Cada llamada actúa sobre el editor activo y participa en su historial de deshacer cuando corresponde.

## Verificación visual

El asistente puede comprobar su trabajo visualmente. Con `export_image` activada, captura una imagen tras crear o modificar diseños y la compara con lo que se pidió. `diff_visual`, activada por defecto, compara un objeto editado con una copia de referencia y devuelve los píxeles y la región que cambiaron, de modo que el asistente puede confirmar que la edición se limitó a su objetivo.

Las herramientas de inspección incluyen `get_jsx`, `diff_create` y `diff_jsx` para diferencias estructurales, `diff_visual` para diferencias de píxeles y `describe` para el rol semántico y la detección de problemas de diseño.

## Consejos

- Puedes recorrer otras páginas mientras se genera una respuesta: el asistente sigue trabajando en la página donde empezó el mensaje y sus vistas previas aparecen al volver. Mientras estás en otra página, el chat indica en cuál trabaja y ofrece **Ir a la página** para volver. Si el asistente cambia de página por su cuenta, tu vista lo sigue.

## Privacidad y costes

Las solicitudes se envían al proveedor configurado. Revisa sus condiciones, política de datos y precios antes de enviar documentos sensibles. OpenPencil no incluye créditos de modelos.
