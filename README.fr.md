# 0trace

> Zéro-Vie-Privée Transfert P2P de Fichiers - Partage de fichiers pair-à-pair basé sur WebRTC

[![Demo](https://img.shields.io/badge/demo-0trace.org-blue)](https://0trace.org)
[![GitHub](https://img.shields.io/badge/github-momo2029/0trace-green)](https://github.com/momo2029/0trace)
[![License](https://img.shields.io/badge/license-MIT-orange)](LICENSE)

[English](README.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md)

## ✨ Fonctionnalités

- 🔒 **Zéro Vie Privée** - Fichiers transférés via WebRTC P2P, le serveur ne stocke aucune donnée
- 🚀 **Ultra Léger** - Backend Rust < 2MB, frontend JavaScript pur, aucun framework
- 📦 **Prêt à l'Emploi** - Ouvrir dans le navigateur, aucune inscription ou installation nécessaire
- 🌐 **Transversalité Réseau** - Supporte NAT traversal, non limité au LAN
- 🌍 **Multilingue** - Chinois, anglais, japonais, coréen, espagnol, français
- ⚡ **Progression en Temps Réel** - Transfert par chunks de 256KB avec progression en direct

## 🚀 Démarrage Rapide

### Utilisation en Ligne

Visitez [0trace.org](https://0trace.org) pour commencer immédiatement le transfert de fichiers

### Déploiement Local

**Méthode 1: Docker (Recommandé)**

```bash
docker run -d -p 2029:2029 ghcr.io/momo2029/0trace:latest
```

Accédez à http://localhost:2029

**Méthode 2: Compiler depuis les Sources**

```bash
# Cloner le dépôt
git clone https://github.com/momo2029/0trace
cd 0trace

# Exécuter (nécessite Rust 1.75+)
make dev
```

## 📖 Utilisation

### Envoyer des Fichiers

1. Ouvrir [0trace.org](https://0trace.org)
2. Sélectionner l'onglet "Envoyer des Fichiers"
3. Cliquer ou glisser-déposer fichiers/dossiers
4. Cliquer sur "Copier le Lien"
5. Partager le lien avec le destinataire (WeChat/QQ/Email/etc.)

### Recevoir des Fichiers

**Méthode 1: Clic sur Lien (Recommandé)**
- Le destinataire clique sur le lien partagé
- Réception automatique, aucune manipulation manuelle nécessaire

**Méthode 2: Saisie Manuelle**
- Sélectionner l'onglet "Recevoir des Fichiers"
- Entrer le code de ramassage à 6 chiffres
- Clic sur "Rejoindre la Salle"

## 🏗️ Architecture

```
Expéditeur ←── WebSocket Signalisation ──→ Backend Rust ←── WebSocket Signalisation ──→ Destinataire
   │                                                                                      │
   └─────────────────────── Transfert Direct WebRTC P2P (Données de Fichier) ─────────────┘
```

**Stack Technologique:**
- Backend: Rust + Axum + Tokio + WebSocket
- Frontend: Vanilla JavaScript + WebRTC API
- Protocole: WebRTC DataChannel + Protocole de Transfert Personnalisé

Voir [ARCHITECTURE.md](ARCHITECTURE.md) pour plus de détails

## 🔒 Sécurité

- ✅ WebRTC fournit un chiffrement DTLS/SRTP intégré
- ✅ Zéro rétention de données sur le serveur (signalisation uniquement)
- ✅ Espace de code de ramassage 34^6 ≈ 1.5 milliard de combinaisons
- ✅ La salle expire automatiquement après 1 heure

## ⚠️ Limitations

- Maximum 2 personnes par salle (1 expéditeur + 1 destinataire)
- Taille de fichier limitée par la mémoire du navigateur
- NAT symétrique nécessite un serveur TURN (non configuré par défaut)

## 🛠️ Développement

Voir [CONTRIBUTING.md](CONTRIBUTING.md)

```bash
# Mode développement (rechargement à chaud)
./dev.sh

# Exécuter les tests
make test

# Construire pour la production
make build
```

## 📝 Licence

[MIT License](LICENSE)

## 🙏 Remerciements

## 🤝 Contribuer

Les Issues et Pull Requests sont les bienvenues !

Veuillez lire le [Guide de Contribution](CONTRIBUTING.md) avant de soumettre des PRs

## 📧 Contact

- Page du Projet: https://github.com/momo2029/0trace
- Site de Démo: https://0trace.org
- Traqueur d'Issues: https://github.com/momo2029/0trace/issues
