# 0trace

> Chat y transferencia de archivos P2P pura en el navegador para dos personas

[![Demo](https://img.shields.io/badge/demo-0trace.org-blue)](https://0trace.org)
[![GitHub](https://img.shields.io/badge/github-momo2029/0trace-green)](https://github.com/momo2029/0trace)
[![License](https://img.shields.io/badge/license-MIT-orange)](LICENSE)

[English](README.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Français](README.fr.md)

## Features

- Transferencia WebRTC P2P pura, sin relay de archivos por el servidor
- Chat y transferencia de archivos dentro de una sola sesión
- Sin cuenta, sin instalación, funciona directamente en el navegador
- Flujo para dos personas con código de sala o enlace compartido
- Códigos de sala de 6 caracteres fáciles de recordar, como `BOOK23`
- La URL incluye `?code=ROOMCODE`, así que al recargar se puede intentar restaurar la misma sala
- Soporte para streaming de archivos grandes en navegadores modernos
- Interfaz en chino, inglés, japonés, coreano, español y francés

## Quick Start

### Online

Visita [0trace.org](https://0trace.org).

### Local Deployment

**Method 1: Docker**

```bash
docker run -d -p 2029:2029 ghcr.io/momo2029/0trace:latest
```

Luego abre `http://localhost:2029`.

**Method 2: Build from Source**

```bash
git clone https://github.com/momo2029/0trace
cd 0trace
./dev.sh
```

## How It Works

1. Una persona crea una sala.
2. 0trace genera un código de sala de 6 caracteres y un enlace compartido.
3. La otra persona abre el enlace o introduce el código para unirse.
4. Ambos navegadores establecen una conexión WebRTC directa.
5. Los mensajes y los archivos aparecen en la misma línea de conversación.

Si se recarga la página, el parámetro `?code=` en la URL permite que el mismo navegador intente restaurar esa sala. Si ambas partes se van y la sala queda vacía, caduca automáticamente después de unos 5 minutos.

## Product Positioning

0trace es deliberadamente estricto:

- Solo 2 personas por sala
- Sin relay TURN para los datos de archivos
- Sin fallback de transferencia del lado del servidor
- Si no se puede establecer una conexión directa, ambas partes deben cambiar de red y volver a intentarlo

Esa decisión mantiene el producto simple y evita que el contenido del archivo pase por el servidor, pero también significa que algunas combinaciones de red fallarán.

## Architecture

```text
Navegador A <- señalización WebSocket -> backend Rust <- señalización WebSocket -> Navegador B
      |                                                                             |
      +---------------- canal de datos WebRTC P2P (chat + archivos) ----------------+
```

**Tech Stack**

- Backend: Rust + Axum + Tokio + WebSocket
- Frontend: Vanilla JavaScript + WebRTC API + File System Access API
- Protocol: WebRTC DataChannel + custom message protocol

Consulta [ARCHITECTURE.md](ARCHITECTURE.md) para más detalles.

## Security And Privacy

- El contenido de los archivos se transfiere directamente entre los dos navegadores
- El servidor solo se usa para señalización y coordinación de salas
- WebRTC usa transporte cifrado con DTLS/SRTP
- Cualquiera que tenga el código de sala o el enlace compartido puede entrar, así que deben tratarse como información sensible
- Las salas vacías caducan automáticamente después de unos 5 minutos

## Limitations

- Diseñado para exactamente 2 participantes
- Al ser P2P puro, algunas combinaciones de NAT o redes corporativas pueden fallar
- Si la conectividad directa falla, los usuarios deben cambiar de red y reintentar
- El streaming de archivos grandes depende del soporte del navegador moderno

## Development

```bash
./dev.sh
make test
make build
```

Consulta [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT License](LICENSE)

## Contributing

Issues y Pull Requests son bienvenidos.

## Links

- Demo: https://0trace.org
- GitHub: https://github.com/momo2029/0trace
- Issues: https://github.com/momo2029/0trace/issues
