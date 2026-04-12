# 0trace

> Chat et transfert de fichiers P2P purs dans le navigateur pour deux personnes

[![Demo](https://img.shields.io/badge/demo-0trace.org-blue)](https://0trace.org)
[![GitHub](https://img.shields.io/badge/github-momo2029/0trace-green)](https://github.com/momo2029/0trace)
[![License](https://img.shields.io/badge/license-MIT-orange)](LICENSE)

[English](README.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md)

## Features

- Transfert WebRTC P2P pur, sans relais de fichiers côté serveur
- Chat et transfert de fichiers dans une seule session
- Aucun compte, aucune installation, utilisation directe dans le navigateur
- Parcours à deux personnes avec code de salle ou lien de partage
- Codes de salle à 6 caractères faciles à retenir, comme `BOOK23`
- L’URL contient `?code=ROOMCODE`, ce qui permet de tenter de restaurer la même salle après un rafraîchissement
- Prise en charge du streaming de gros fichiers dans les navigateurs modernes
- Interface disponible en chinois, anglais, japonais, coréen, espagnol et français

## Quick Start

### Online

Rendez-vous sur [0trace.org](https://0trace.org).

### Local Deployment

**Method 1: Docker**

```bash
docker run -d -p 2029:2029 ghcr.io/momo2029/0trace:latest
```

Ouvrez ensuite `http://localhost:2029`.

**Method 2: Build from Source**

```bash
git clone https://github.com/momo2029/0trace
cd 0trace
./dev.sh
```

## How It Works

1. Une personne crée une salle.
2. 0trace génère un code de salle à 6 caractères et un lien de partage.
3. L’autre personne ouvre le lien ou saisit le code pour rejoindre la salle.
4. Les deux navigateurs établissent une connexion WebRTC directe.
5. Les messages et les fichiers apparaissent dans la même conversation.

Si la page est rechargée, le paramètre `?code=` dans l’URL permet au même navigateur d’essayer de restaurer la salle. Si les deux côtés quittent la session et que la salle reste vide, elle expire automatiquement après environ 5 minutes.

## Product Positioning

0trace est volontairement strict :

- Seulement 2 personnes par salle
- Aucun relais TURN pour les données de fichiers
- Aucun fallback de transfert côté serveur
- Si une connexion directe ne peut pas être établie, les deux parties doivent changer de réseau et réessayer

Ce choix garde le produit simple et évite que le contenu des fichiers passe par le serveur, mais certaines combinaisons réseau peuvent échouer.

## Architecture

```text
Navigateur A <- signalisation WebSocket -> backend Rust <- signalisation WebSocket -> Navigateur B
      |                                                                                |
      +---------------- canal de données WebRTC P2P (chat + fichiers) -----------------+
```

**Tech Stack**

- Backend: Rust + Axum + Tokio + WebSocket
- Frontend: Vanilla JavaScript + WebRTC API + File System Access API
- Protocol: WebRTC DataChannel + custom message protocol

Voir [ARCHITECTURE.md](ARCHITECTURE.md) pour plus de détails.

## Security And Privacy

- Le contenu des fichiers est transféré directement entre les deux navigateurs
- Le serveur ne sert qu’à la signalisation et à la coordination des salles
- WebRTC utilise un transport chiffré avec DTLS/SRTP
- Toute personne disposant du code de salle ou du lien de partage peut rejoindre la session, il faut donc les traiter comme des informations sensibles
- Les salles vides expirent automatiquement après environ 5 minutes

## Limitations

- Conçu pour exactement 2 participants
- Le mode P2P pur peut échouer sur certaines combinaisons de NAT ou de réseaux d’entreprise
- Si la connexion directe échoue, les utilisateurs doivent changer de réseau et réessayer
- Le streaming de gros fichiers dépend du support des navigateurs modernes

## Development

```bash
./dev.sh
make test
make build
```

Voir [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT License](LICENSE)

## Contributing

Issues et Pull Requests sont les bienvenus.

## Links

- Demo: https://0trace.org
- GitHub: https://github.com/momo2029/0trace
- Issues: https://github.com/momo2029/0trace/issues
