# gestion antiquite PC

Version bureau Windows (`.exe`) de **Gestion Antiquités**, générée à partir du même code source web et serveur SQLite, sans modifier la version mobile/Android.

## Prérequis (Windows / PC)

- Node.js 22+
- Dépendances installées à la racine et dans `gestion-antiquite-pc/`

## Lancer en mode bureau local

```bash
npm install --legacy-peer-deps
npm run build
cd gestion-antiquite-pc
npm install --legacy-peer-deps
npm start
```

## Générer l'installateur Windows (`.exe`)

```bash
cd gestion-antiquite-pc
npm run pack:win
```

Les fichiers générés sont placés dans `gestion-antiquite-pc/release/` :
- `gestion-antiquite-PC-Setup-1.0.0.exe` (installateur Windows)
- `gestion-antiquite-PC-Portable-1.0.0.exe` (exécutable portable sans installation)

La base de données locale SQLite (`babsaida.db`) est stockée automatiquement dans le dossier utilisateur Windows (`%APPDATA%\gestion antiquite PC\data`).
