# Chrome Web Store listing — Français

## Short description

Testeur de design responsive : prévisualisez un site à plusieurs tailles d’écran côte à côte et trouvez où la mise en page casse.

## Detailed description

Trouvez où votre mise en page casse — à toutes les tailles d’écran, en même temps.

Breakpointer affiche n’importe quel site web à plusieurs tailles de viewport côte à côte, directement dans Chrome. Chaque aperçu dispose d’une vraie largeur et d’une vraie hauteur de mise en page : les media queries et les mises en page responsive se comportent exactement comme dans une fenêtre de cette taille.

**Prévisualiser rapidement**
• Cliquez sur le bouton de la barre d’outils et choisissez « Prévisualiser cette page », faites un clic droit sur n’importe quelle page ou n’importe quel lien, appuyez sur Alt+Shift+P, ou tapez « bpt » suivi d’une URL dans la barre d’adresse.
• 30 tailles courantes pour téléphones, pliables, tablettes, portables et ordinateurs de bureau (recherche par nom ou par taille), plus toutes les tailles personnalisées.
• Faites glisser le bord d’un aperçu pour le redimensionner et voyez la page se réorganiser en direct — il s’aimante à vos breakpoints.
• Appuyez sur Ctrl/⌘ + K pour rechercher toutes les commandes, tailles, groupes et pages.
• Un espace de travail pensé pour les longues sessions : une barre latérale des viewports avec une carte des breakpoints, une barre d’état et une minicarte, trois dispositions (sur plusieurs lignes, sur une seule ligne, empilée), six couleurs d’accent et trois styles de canevas.

**Trouver où ça casse**
• Score responsive : une note de 0 à 100 pour chaque page — voyez ce qui coûte le plus de points, dans l’audit, les rapports et Vérifier des pages.
• Notes : épinglez ce qui ne va pas sur n’importe quel aperçu (touche N) et copiez un rapport de bug prêt à coller, avec la page, les tailles de viewport et vos notes — ou enregistrez tous les aperçus avec leurs notes en une seule image.
• Vérifier des pages : toute une liste de pages — vos pages enregistrées, les liens d’une page ou le sitemap du site — vérifiée à chaque viewport en une seule passe. Voyez quelles pages cassent et à quelles tailles, puis copiez le tableau en Markdown ou téléchargez un rapport HTML.
• Analyser toutes les largeurs : la page est vérifiée à chaque largeur d’une plage, et la première et la dernière largeur de chaque problème sont trouvées au pixel près — sur un graphique avec la hauteur de la page, ses breakpoints et vos viewports. Ajoutez un viewport à la pire largeur en un clic.
• Audit : tous les problèmes de toutes les tailles au même endroit, le poids de la page, les requêtes, les pixels d’image, le Largest Contentful Paint et le décalage de mise en page par taille, ainsi que l’échelle typographique des titres, du texte et des boutons — copiez n’importe quelle partie sous forme de tableau Markdown.
• Images responsive : chaque image face à sa largeur d’affichage à chaque viewport — trop grande, trop petite ou de la bonne taille — avec un attribut sizes et des largeurs srcset suggérés, prêts à copier, ainsi que des conseils sur AVIF/WebP, le chargement différé et width/height.
• Audit des couleurs de la page : les couleurs du texte, des arrière-plans et des bordures à toutes les tailles, à copier sous forme de variables CSS.
• Meta et réseaux sociaux : l’affichage de la page dans les résultats de recherche et les aperçus de liens (approximatif), avec vérification de son titre, de sa description, de son image sociale, de son adresse canonique, des robots et des icônes, et le plan de ses titres.
• Boîte à outils CSS (touche U) : typographie fluide avec clamp() — une taille ou toute une échelle typographique — calculée pour chaque viewport que vous prévisualisez, unités converties à chaque taille (px, rem, em, vw, vh…), vos breakpoints sous forme de code (media queries, mixins Sass, Tailwind, JavaScript), un sélecteur de couleur (HEX, RGB, HSL, OKLCH) et des rapports d’aspect — plus un calculateur de grille auto-fit, du code d’images responsive (<picture>, sizes, srcset) et un testeur de media queries.
• Media queries : toutes les media queries du CSS de la page et les tailles auxquelles elles s’appliquent — avec les trous et les chevauchements entre breakpoints signalés (une largeur où aucun des deux côtés ne s’applique, ou bien les deux), et un viewport ajouté à cet endroit en un clic.
• Checklist QA : cochez des vérifications manuelles — le menu, les formulaires, les images, les fenêtres contextuelles — pour chaque viewport, modifiez la liste selon votre projet et copiez les résultats sous forme de rapport Markdown.
• Contrôle visuel : enregistrez une référence de chaque viewport, comparez après une modification et voyez ce qui a bougé, pixel par pixel — côte à côte, avec un curseur ou avec les différences encadrées.
• Éléments (touche J) : toutes les balises de la page et le CSS de chacune, comme les outils de développement du navigateur (F12) : l’arbre HTML, les règles correspondantes avec les déclarations remplacées barrées, les media queries et les fichiers sources, les valeurs calculées et le modèle de boîte, à la taille de n’importe quel aperçu, plus un résumé HTML et CSS : nombre et profondeur des éléments, ids en double, balises obsolètes, images sans alt, styles en ligne et !important.
• Inspecteur : cliquez sur un élément dans un aperçu et comparez sa taille, son display, sa police, ses espacements et sa mise en page à chaque taille — ce qui change est mis en évidence — et mesurez la distance jusqu’à un second élément à chaque taille.
• Breakpoints lus dans le CSS de la page elle-même, ainsi que ceux de Tailwind, Bootstrap, Material UI, Chakra UI, Ant Design, Bulma, Foundation ou les vôtres — étiquetez chaque viewport et testez les deux côtés de chaque breakpoint.
• Clair et sombre côte à côte : affichez n’importe quel aperçu avec les styles clairs ou sombres de la page.
• Les vérifications responsive détectent le défilement horizontal (et l’élément qui le provoque), une balise viewport manquante, le texte minuscule, les cibles tactiles trop petites, le texte tronqué par son conteneur, le texte peu contrasté, les images floues, les éléments qui couvrent l’écran, les décalages de mise en page et les lignes trop longues pour être lues sur grand écran — et les mettent en évidence directement dans la page.
• Faites défiler un aperçu et les autres affichent le même contenu ; cliquez sur un lien et tous les aperçus l’ouvrent.
• Contours de mise en page, grille de colonnes, règles en pixels, barres de défilement masquées et CSS en direct appliqué à toutes les tailles à la fois — enregistrez sous forme d’extraits le CSS que vous utilisez souvent.
• Comparer deux adresses : un second aperçu à côté de chaque viewport, p. ex. la préproduction à côté de la production, qui suit les mêmes pages.
• Simulez le daltonisme et la vision floue, les mouvements réduits et les animations en pause, les styles d’écran tactile (hover: none, pointer: coarse), et mettez la mise en page à l’épreuve avec un texte traduit plus long, l’écriture de droite à gauche et le texte à 200 %.
• Mesurez en pixels CSS, vérifiez le contraste des couleurs selon les WCAG avec une pipette, et superposez une maquette à un aperçu pour comparer pixel par pixel.
• Ouvrez chaque viewport dans une vraie fenêtre à sa taille exacte (pour les sites qui demandent votre connexion), gardez un aperçu flottant toujours au premier plan à côté de votre éditeur, ou prévisualisez dans le panneau latéral la page que vous consultez.
• Captures de la page entière, espacement du texte (WCAG), styles prefers-contrast et d’impression, étiquettes de taille d’image et d’ordre de tabulation, et grille de ligne de base.

**Partager ce que vous voyez**
• Image vitrine : votre page à plusieurs tailles dans des cadres d’appareil simples sur un fond, prête pour un portfolio, un client ou une publication.
• Mode présentation : seulement les aperçus, en plein écran, pour le partage d’écran et les démos client — avec défilement automatique, chaque aperçu défilant tout seul de haut en bas.
• Badge de score : copiez le score responsive sous forme de badge SVG pour un README ou un rapport client — et voyez le score de chaque page jour après jour.
• Annoter une capture : tous les aperçus dans une seule image avec flèches, cadres, étapes numérotées et pixellisation pour masquer les détails privés.
• Captures d’un aperçu ou de l’espace de travail, tous les viewports dans une seule image légendée, copie dans le presse-papiers, et un rapport HTML de chaque taille avec ses problèmes.
• Ouvrez n’importe quel aperçu dans une vraie fenêtre à la taille exacte.

**Travailler à votre façon**
• Enregistrez des groupes de viewports comme « QA du paiement » et passez de l’un à l’autre en un clic ; huit groupes intégrés, dont les tailles d’écran les plus utilisées et les tailles de redistribution WCAG.
• Concentrez-vous sur un seul viewport, naviguez d’une page à l’autre, ajoutez une étoile aux pages que vous testez souvent, zoomez avec Ctrl/⌘ + molette et déplacez la vue avec Space + glisser.
• Les rechargements conservent la position de défilement de chaque aperçu et peuvent être automatiques ; partagez un lien d’espace de travail qui ouvre la page avec vos viewports.
• Exportez et importez votre configuration pour la partager avec votre équipe.
• Un design clair et sombre épuré, des raccourcis clavier pour tout, en anglais, vietnamien, espagnol, portugais, français, allemand, russe, japonais, chinois et indonésien.
• Nouveau ici ? Dix-huit guides pas à pas, un guide d’utilisation complet, une checklist de prise en main qui se coche toute seule et le mode « C’est quoi ? » (H) : pointez n’importe quel contrôle pour voir à quoi il sert.

**Breakpointer Pro** (essai gratuit de 7 jours ; tout ce qui précède reste gratuit)
• Vérifications d’accessibilité à chaque taille : images sans texte alternatif, boutons et liens sans nom (souvent le bouton de menu composé d’une seule icône qui n’apparaît que sur téléphone), champs sans libellé, focus clavier sur des éléments masqués comme un menu hors écran fermé, et langue de page manquante.
• Synchro des clics et de la saisie : ouvrez un menu ou remplissez un formulaire dans un aperçu et tous les aperçus de la page font de même — les formulaires ne sont jamais envoyés deux fois, et les mots de passe et champs de paiement ne sont jamais copiés.
• Masquez les bandeaux de cookies des outils de consentement courants pour des captures et des vérifications propres (rien n’est accepté).
• Projets : enregistrez pour chaque site la page, les viewports, les breakpoints, la grille, le CSS en direct et la comparaison, et passez d’un client à l’autre en un clic (un projet est gratuit).
• Budgets de performance : fixez des limites de poids de page, de requêtes, de LCP et de CLS, et voyez chaque aperçu qui les dépasse.
• Votre marque — nom, logo et lien — sur les rapports et les images que vous envoyez à vos clients.
• Exports CSV et JSON de Vérifier des pages, des analyses de largeurs et des audits.
• Les licences sont vérifiées dans votre navigateur : pas de compte, rien n’est envoyé.

**Confidentialité dès la conception**
• Pas de compte, pas de statistiques, pas de serveur. Les paramètres restent dans votre navigateur.
• Aucun accès à vos sites à l’installation. Certains sites bloquent leur affichage dans d’autres pages, et les outils qui agissent dans les pages ont aussi besoin de votre autorisation ; vous pouvez autoriser Breakpointer sur un site (ou sur tous les sites) quand vous en avez besoin — ou seulement jusqu’à la fermeture de Chrome — et retirer l’accès à tout moment.
• Les références du contrôle visuel restent dans votre navigateur et ne sont jamais envoyées.

**Bon à savoir**
Breakpointer change la taille du viewport ; il n’émule pas l’agent utilisateur, la densité de pixels, la saisie tactile ni le moteur de navigateur d’un appareil. L’état de connexion et les cookies tiers peuvent se comporter différemment dans les aperçus.
