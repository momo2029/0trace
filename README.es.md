# 0trace

> Cero-Privacidad P2P Transferencia de Archivos - Compartición de archivos peer-to-peer basada en WebRTC

[![Demo](https://img.shields.io/badge/demo-0trace.org-blue)](https://0trace.org)
[![GitHub](https://img.shields.io/badge/github-momo2029/0trace-green)](https://github.com/momo2029/0trace)
[![License](https://img.shields.io/badge/license-MIT-orange)](LICENSE)

[English](README.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Français](README.fr.md)

## ✨ Características

- 🔒 **Cero Privacidad** - Archivos transferidos vía WebRTC P2P, el servidor no almacena datos
- 🚀 **Ultra Liviano** - Backend Rust < 5MB, frontend JavaScript puro, sin frameworks
- 📦 **Listo para Usar** - Abrir en navegador, no requiere registro o instalación
- 🌐 **Transferencia Cruzada** - Soporta NAT traversal, no limitado a LAN
- 🌍 **Multilingüe** - Chino, inglés, japonés, coreano, español, francés
- ⚡ **Progreso en Tiempo Real** - Transferencia por chunks de 256KB con progreso en vivo

## 🚀 Inicio Rápido

### Usar en Línea

Visita [0trace.org](https://0trace.org) para comenzar a transferir archivos inmediatamente

### Despliegue Local

**Método 1: Docker (Recomendado)**

```bash
docker run -d -p 2029:2029 ghcr.io/momo2029/0trace:latest
```

Acceder a http://localhost:2029

**Método 2: Compilar desde Fuente**

```bash
# Clonar repositorio
git clone https://github.com/momo2029/0trace
cd 0trace

# Ejecutar (requiere Rust 1.75+)
make dev
```

## 📖 Uso

### Enviar Archivos

1. Abrir [0trace.org](https://0trace.org)
2. Seleccionar pestaña "Enviar Archivos"
3. Clic o arrastrar archivos/carpetas
4. Clic en "Copiar Enlace"
5. Compartir enlace con receptor (WeChat/QQ/Email/etc.)

### Recibir Archivos

**Método 1: Clic en Enlace (Recomendado)**
- El receptor hace clic en el enlace compartido
- Recepción automática, sin pasos manuales necesarios

**Método 2: Entrada Manual**
- Seleccionar pestaña "Recibir Archivos"
- Ingresar código de recogida de 6 dígitos
- Clic en "Unirse a la Sala"

## 🏗️ Arquitectura

```
Remitente ←── WebSocket Señalización ──→ Backend Rust ←── WebSocket Señalización ──→ Destinatario
   │                                                                                       │
   └─────────────────────── Transferencia Directa WebRTC P2P (Datos de Archivo) ─────────────┘
```

**Stack Tecnológico:**
- Backend: Rust + Axum + Tokio + WebSocket
- Frontend: Vanilla JavaScript + WebRTC API
- Protocolo: WebRTC DataChannel + Protocolo de Transferencia Personalizado

Ver [ARCHITECTURE.md](ARCHITECTURE.md) para detalles

## 🔒 Seguridad

- ✅ WebRTC provee cifrado DTLS/SRTP integrado
- ✅ Cero retención de datos en servidor (solo señalización)
- ✅ Espacio de código de recogida 34^6 ≈ 1.5 mil millones de combinaciones
- ✅ La sala expira automáticamente después de 1 hora

## ⚠️ Limitaciones

- Máximo 2 personas por sala (1 remitente + 1 destinatario)
- Tamaño de archivo limitado por memoria del navegador
- NAT simétrico requiere servidor TURN (no configurado por defecto)

## 🛠️ Desarrollo

Ver [CONTRIBUTING.md](CONTRIBUTING.md)

```bash
# Modo desarrollo (recarga en caliente)
./dev.sh

# Ejecutar pruebas
make test

# Construir para producción
make build
```

## 📝 Licencia

[MIT License](LICENSE)

## 🙏 Agradecimientos

## 🤝 Contribuir

¡Issues y Pull Requests son bienvenidos!

Por favor lee [Guía de Contribución](CONTRIBUTING.md) antes de enviar PRs

## 📧 Contacto

- Página del Proyecto: https://github.com/momo2029/0trace
- Sitio Demo: https://0trace.org
- Rastreador de Issues: https://github.com/momo2029/0trace/issues
