# Jeu Drag & Drop — Configuration

Ce projet est piloté par `config.json`. Le fichier doit rester **JSON strict** (pas de commentaires).

## Sections principales

### `background`
Définit l'image de fond et son affichage.
- `color` : couleur de fond de secours.
- `image` : chemin relatif de l'image.
- `size` : taille du fond (`cover`, `contain`, `100% 100%`, etc.).
- `position` : position du fond (ex: `center`).
- `repeat` : répétition (`no-repeat`, `repeat`, etc.).

### `hud`
Paramètres du score et du timer.
- `fontFamily` : police du texte.
- `color` : couleur du texte.
- `fontSize` : taille du texte (`rem`, `px`, etc.).
- `showScoreBackground` : affiche le fond de la carte score.
- `showTimerBackground` : affiche le fond de la carte timer.
- `showScoreBorder` : affiche la bordure du score.
- `showTimerBorder` : affiche la bordure du timer.
- `scoreDisplay` : `"card"` ou `"text"`.
- `timerDisplay` : `"card"` ou `"text"`.

### `opacity`
Opacités des éléments (0 à 1).
- `hud` : opacité du fond HUD.
- `hudBorder` : opacité de la bordure HUD.
- `tray` : opacité du fond du tray.
- `dropzones` : opacité du fond du bloc dropzones.
- `dropzoneItems` : opacité du fond de chaque zone.

### `debug`
- `showZoneLabels` : affiche/masque `Zone 1`, `Zone 2`, etc.

### `layout.screen`
Dimensions **de référence** (taille native de l’image de fond). Toutes les positions sont mises à l’échelle selon ces dimensions.
- `width`, `height`.

### `layout.tray`
Zone d’apparition des cartes (1 par 1).
- `top`, `left`, `right` : position.
- `columns` : nombre de colonnes.
- `showBackground` : affiche le fond du tray.

### `layout.cards`
Taille des cartes.
- `width`, `height` : taille des cartes.
- `zoneWidth`, `zoneHeight` : taille des cartes dans les dropzones.

### `layout.dropzones`
Configuration des zones de dépôt.
- `count` : nombre de zones.
- `top`, `left`, `right` : position du bloc de zones.
- `gap` : espace entre zones.
- `defaultWidth`, `defaultHeight` : tailles par défaut.
- `zones[]` : configuration par zone (indépendante).
  - `id`, `label`, `width`, `height`, `position`.

#### Gravité
`layout.dropzones.gravity` : gravité physique.
- `enabled` : true/false
- `mode` : `"physics"`
- `acceleration` : force de gravité
- `maxSpeed` : vitesse maximale
- `bounce` : rebond (0 = aucun)
- `settleEpsilon` : seuil d’arrêt
- `gap` : espace entre cartes empilées
- `padding` : marge intérieure

### `images`
Cartes à afficher (une par une).
- `count` : nombre d’images.
- `items[]` : liste des images.
  - `id`, `label`, `src`, `color`.

### `timer`
Paramètres du timer.
- `seconds` : durée.
- `autoStart` : démarrage auto.
- `position` : position du compteur.

### `scoring`
Paramètres du score.
- `correct`, `wrong` : gains/pertes.
- `position` : position du compteur.

### `targets`
Mapping image -> zone correcte.

## Exemple minimal
```json
{
  "layout": {
    "screen": { "width": 1280, "height": 720 }
  },
  "images": { "count": 1, "items": [{ "id": "img-1", "label": "1", "src": "images/img-1.png" }] },
  "dropzones": { "count": 1 }
}
```

## Note importante
Si tu ouvres le projet en `file://`, `config.json` peut ne pas se charger. Utilise un serveur local :
```sh
python -m http.server
```
Puis ouvre `http://localhost:8000`.
