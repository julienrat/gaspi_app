# Jeu Drag & Drop — Configuration

GitHub Pages : https://julienrat.github.io/gaspi_app/

Ce projet est piloté par `config.json`. Le fichier doit rester **JSON strict** (pas de commentaires).
Toutes les positions sont exprimées **en référence à `layout.screen`** et sont mises à l’échelle selon la taille d’écran réelle (origine 0,0 en haut à gauche).

## Ordre des calques (du bas vers le haut)
- Image de fond (`background`)
- Image zone aliments (`startScreen.dropImage`)
- Cartes + dropzones + tray
- Calque décor (`calque`)
- Popups/consignes (`overlay`)

## Sections principales

### `background`
- `color` : couleur de fond de secours.
- `image` : chemin relatif de l’image de fond.
- `size` : taille (`cover`, `contain`, `100% 100%`, etc.).
- `position` : position (ex: `center`).
- `repeat` : répétition (`no-repeat`, `repeat`, etc.).

### `calque`
Image décorative au‑dessus des cartes.
- `src` : image de calque.
- `position` : position (top/left/right/bottom).
- `size` : largeur/hauteur.

### `startScreen`
Écran de démarrage et éléments d’intro.
- `enabled` : active l’écran de démarrage.
- `startButtonSrc` : image du bouton commencer.
- `startButtonSize` : taille de l’image du bouton.
- `dropImage` : image zone aliments (src/position/size).
- `instructionImage` : image consigne (src/position/size).

### `feedback`
Messages visuels après action.
- `successMessage` : image “Bien joué” (src/position/size/duration).
- `completionPopup` : image de fin (src/position/size).

### `hud`
Paramètres du score et du timer.
- `fontFamily` : police du texte.
- `color` : couleur du texte.
- `fontSize` : taille du texte.
- `showScoreBackground` : affiche le fond du score.
- `showTimerBackground` : affiche le fond du timer.
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
Dimensions **de référence** (taille native de l’image de fond).
- `width`, `height`.

### `layout.tray`
Zone d’apparition des cartes (1 par 1).
- `top`, `left`, `right` : position du tray.
- `columns` : nombre de colonnes.
- `showBackground` : affiche le fond du tray.

### `layout.cards`
Taille des cartes.
- `width`, `height` : taille des cartes dans le tray.
- `zoneWidth`, `zoneHeight` : taille des cartes dans les dropzones.

### `layout.dropzones`
Configuration des zones de dépôt.
- `count` : nombre de zones.
- `top`, `left`, `right` : position du bloc de zones.
- `gap` : espace entre zones.
- `defaultWidth`, `defaultHeight` : tailles par défaut.
- `zones[]` : configuration par zone.

Chaque entrée de `zones[]` peut définir :
- `id`
- `label`
- `width`, `height`
- `position`

#### Gravité
`layout.dropzones.gravity` : gravité physique.
- `enabled` : true/false.
- `mode` : `"physics"`.
- `acceleration` : force de gravité.
- `maxSpeed` : vitesse max.
- `bounce` : rebond (0 = aucun).
- `settleEpsilon` : seuil d’arrêt.
- `gap` : espace entre cartes.
- `padding` : marge intérieure.
- `stacking` : empilement ou chevauchement.

### `images`
Cartes à afficher (une par une).
- `count` : nombre d’images.
- `items[]` : liste des images.

Chaque item peut définir :
- `id`, `label`, `src`, `color`.

### `timer`
- `seconds` : durée.
- `autoStart` : démarrage auto.
- `position` : position (top/left/right/bottom ou centre via `x/y`).

### `scoring`
- `correct` : points gagnés si **bonne réponse du premier coup**.
- `wrong` : valeur inutilisée (les erreurs renvoient la carte au tray sans points).
- `total` : total affiché (format `X/total`).
- `position` : position (top/left/right/bottom ou centre via `x/y`).

### `targets`
Règles de solutions et popups.
- `items` : mapping `imageId -> zones`.
- `wrongPopup` : popup erreur par défaut.
- `wrongPopups` : règles d’erreur spécifiques (ex: zones + images).
- `popupDefaults` : position/size/duration par défaut pour tous les popups.

Chaque `items[imageId]` peut être :
- Un tableau de zones, ex: `["1","2"]`.
- Un objet `{ zones: [...], popup: { src, position, size, duration } }`.

Chaque règle de `wrongPopups[]` peut définir :
- `zones` (une zone ou tableau)
- `images` (une image ou tableau)
- `popup` (image affichée si règle match)

## Comportement du jeu
- Les cartes apparaissent **une par une** dans le tray.
- Mauvaise zone : popup erreur, la carte revient au tray.
- Bonne zone : affichage “Bien joué” pendant 5s max, puis clic pour passer à la carte suivante.
- Fin de jeu : popup de fin.

## Exemple minimal
```json
{
  "layout": {
    "screen": { "width": 1280, "height": 720 }
  },
  "images": { "count": 1, "items": [{ "id": "img-1", "src": "images/img-1.png" }] },
  "layout": {
    "dropzones": { "count": 1, "zones": [{ "id": "1" }] }
  }
}
```

## Note importante
Si tu ouvres le projet en `file://`, `config.json` peut ne pas se charger. Utilise un serveur local :
```sh
python -m http.server
```
Puis ouvre `http://localhost:8000`.
