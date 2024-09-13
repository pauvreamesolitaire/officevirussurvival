const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');


// Détection de l'appareil mobile
const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

let tileSize = 32;
let playerSpeed = 2;
let gameRunning = true;

// Chargement des images
const playerImg = new Image();
playerImg.src = 'player.png'; // Image du personnage sans masque

const playerMaskImg = new Image();
playerMaskImg.src = 'player_mask.png'; // Image du personnage avec masque

const virusImg = new Image();
virusImg.src = 'virus.png';

const purifierImg = new Image();
purifierImg.src = 'purifier.png';

const windowClosedImg = new Image();
windowClosedImg.src = 'window_closed.png';

const windowOpenImg = new Image();
windowOpenImg.src = 'window_open.png';

// État du jeu
let player = {
  x: canvas.width / 2 - tileSize / 2,
  y: canvas.height - tileSize * 2, // Positionné vers le bas
  width: tileSize,
  height: tileSize,
  mask: false,
  maskProtections: 3 // Le masque peut prévenir 3 infections
};

let viruses = [];
let purifiers = [];
let purifierLimit = 3; // Nombre limité de purificateurs

// Mise à jour de l'objet "windows"
let windows = {
  isOpen: false,
  width: tileSize * 4, // La fenêtre est plus grande
  height: tileSize * 4
};

// Positionner la fenêtre au centre du canvas
windows.x = (canvas.width - windows.width) / 2;
windows.y = (canvas.height - windows.height) / 2;

let co2Level = 400; // ppm
let temperature = 22; // °C
let virusCount = 0;

// Temps de jeu
let totalGameTime = 8 * 60; // 8 heures en minutes
let timeRemaining = totalGameTime; // Temps restant en minutes

// Gestion des entrées
let keys = {};

document.addEventListener('keydown', (e) => {
  keys[e.key] = true;

  // Commandes spéciales
  if (e.key === 'M' || e.key === 'm') {
    if (player.maskProtections > 0) {
      player.mask = !player.mask;
    } else {
      alert('Votre masque FFP2 n\'a plus de protections !');
      player.mask = false;
    }
    updateHUD();
  }

  if (e.key === 'O' || e.key === 'o') {
    windows.isOpen = !windows.isOpen;
    updateHUD();
  }

  if (e.key === 'P' || e.key === 'p') {
    placePurifier();
  }
  
  if (e.key === ' ' || e.key === 'Spacebar') {
    // Simuler un clic sur le bouton Pause
    pauseButton.click();
  }
});

document.addEventListener('keyup', (e) => {
  keys[e.key] = false;
});

// Fonction de mise à jour du jeu
function update() {
  if (!gameRunning || isPaused) return;

  // Décrémenter le temps restant
  if (frameCount % 60 === 0 && timeRemaining > 0) {
    timeRemaining--;
    updateHUD();

    // Vérifier si le joueur a gagné
    if (timeRemaining <= 0) {
      gameRunning = false;
      alert('Félicitations ! Vous avez survécu à la journée de travail.');
      resetGame();
      return;
    }
  }

  // Déplacement du joueur
  if (keys['ArrowUp']) player.y -= playerSpeed;
  if (keys['ArrowDown']) player.y += playerSpeed;
  if (keys['ArrowLeft']) player.x -= playerSpeed;
  if (keys['ArrowRight']) player.x += playerSpeed;

  // Limiter le joueur aux limites du canvas
  player.x = Math.max(0, Math.min(player.x, canvas.width - player.width));
  player.y = Math.max(0, Math.min(player.y, canvas.height - player.height));

  // Déterminer le taux de génération des virus en fonction de l'appareil
  const virusGenerationRate = isMobile ? 0.005 : 0.01;

  // Générer des virus aléatoirement
  if (Math.random() < virusGenerationRate) {
    createVirus();
  }

  // Vérifier les collisions avec les virus
  viruses.forEach((virus, index) => {
    // Déplacer les virus vers le joueur
    let dx = player.x - virus.x;
    let dy = player.y - virus.y;
    let distance = Math.hypot(dx, dy);

    // Déterminer la vitesse des virus en fonction de l'appareil
    const virusSpeed = isMobile ? 0.3 : 0.5;

    virus.x += (dx / distance) * virusSpeed;
    virus.y += (dy / distance) * virusSpeed;

    if (isColliding(player, virus)) {
      if (player.mask && player.maskProtections > 0) {
        // Le masque protège le joueur
        player.maskProtections--;
        updateHUD();
        showMaskProtectionEffect(player.x, player.y);

        if (player.maskProtections === 0) {
          // Le masque n'a plus de protections
          player.mask = false;
          alert('Votre masque FFP2 n\'a plus de protections restantes !');
          updateHUD();
        }
      } else {
        // Le joueur est infecté et la partie recommence
        showInfectionEffect(player.x, player.y);
        gameOver();
        return;
      }

      // Retirer le virus après collision
      viruses.splice(index, 1);
      virusCount--;
      updateHUD();
    }
  });

  // Purificateurs d'air
  purifiers.forEach((purifier, purifierIndex) => {
    // Diminuer progressivement le nombre de virus dans la pièce
    if (frameCount % 60 === 0 && virusCount > 0) {
      // Retirer un virus aléatoire
      viruses.pop();
      virusCount--;
      updateHUD();
    }

    // Gérer la durée de vie du purificateur
    purifier.duration--;
    if (purifier.duration <= 0) {
      purifiers.splice(purifierIndex, 1);
      updateHUD();
    }
  });

  // Mise à jour du niveau de CO₂ et de la température
  if (windows.isOpen) {
    co2Level = Math.max(400, co2Level - 2); // Diminuer le CO₂ jusqu'à 400 ppm
    temperature = Math.max(0, temperature - 0.05); // La température baisse plus lentement
    // Diminuer progressivement le nombre de virus
    if (frameCount % 60 === 0 && virusCount > 0) {
      viruses.pop();
      virusCount--;
      updateHUD();
    }
    // Si la température descend en dessous de 15°C, fermer les fenêtres
    if (temperature <= 15) {
      windows.isOpen = false;
      updateHUD();
    }
  } else {
    co2Level = Math.min(5000, co2Level + 0.5); // Augmenter le CO₂ jusqu'à 5000 ppm
    temperature = Math.min(22, temperature + 0.05); // La température remonte lentement jusqu'à 22°C
  }

  updateHUD();
}

// Fonction de dessin
function draw() {
	if (isPaused) {
		// Afficher un écran de pause
		ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.fillStyle = '#fff';
		ctx.font = '30px Arial';
		ctx.textAlign = 'center';
		ctx.fillText('Jeu en pause', canvas.width / 2, canvas.height / 2);
		return;
	  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Dessiner les fenêtres
  if (windows.isOpen) {
    ctx.drawImage(windowOpenImg, windows.x, windows.y, windows.width, windows.height);
  } else {
    ctx.drawImage(windowClosedImg, windows.x, windows.y, windows.width, windows.height);
  }

  // Dessiner les purificateurs
  purifiers.forEach((purifier) => {
    ctx.drawImage(purifierImg, purifier.x, purifier.y, purifier.width, purifier.height);
  });

  // Dessiner le joueur
  if (player.mask) {
    ctx.drawImage(playerMaskImg, player.x, player.y, player.width, player.height);
  } else {
    ctx.drawImage(playerImg, player.x, player.y, player.width, player.height);
  }

  // Dessiner les virus
  viruses.forEach((virus) => {
    ctx.drawImage(virusImg, virus.x, virus.y, virus.width, virus.height);
  });

  // Dessiner les effets visuels
  drawInfectionEffects();
  drawMaskProtectionEffects();
}

// Boucle principale du jeu
let frameCount = 0;

function gameLoop() {
  if (!gameRunning || isPaused) return;

  frameCount++;
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// Vérification de collision
function isColliding(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

// Mise à jour du HUD
function updateHUD() {
  // Mettre à jour le temps restant
  let hours = Math.floor(timeRemaining / 60);
  let minutes = timeRemaining % 60;
  let timeString = `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}`;
  document.getElementById('timeRemaining').innerText = timeString;

  document.getElementById('co2Level').innerText = Math.round(co2Level);
  document.getElementById('temperature').innerText = Math.round(temperature);
  document.getElementById('virusCount').innerText = virusCount;
  document.getElementById('maskStatus').innerText = player.mask ? 'Oui' : 'Non';
  document.getElementById('maskProtections').innerText = player.maskProtections;
  document.getElementById('purifierCount').innerText = purifierLimit - purifiers.length;
}

// Gestion de la fin du jeu
function gameOver() {
  alert('Vous avez été infecté ! La partie recommence.');
  resetGame();
}

// Fonction pour réinitialiser le jeu
function resetGame() {
  // Réinitialiser les variables du jeu
  gameRunning = true;
  timeRemaining = totalGameTime;
  frameCount = 0;

  // Réinitialiser l'état du joueur
  player.x = canvas.width / 2 - tileSize / 2;
  player.y = canvas.height - tileSize * 2;
  player.mask = false;
  player.maskProtections = 3;

  // Réinitialiser les autres variables du jeu
  viruses = [];
  virusCount = 0;
  purifiers = [];
  co2Level = 400;
  temperature = 22;
  windows.isOpen = false;

  // Réinitialiser l'état des touches
  keys = {}; // Ajout pour éviter que le personnage se déplace tout seul

  updateHUD();
  
  isPaused = false; // Assurer que le jeu n'est pas en pause
  pauseButton.textContent = 'Pause';
  disableControls(false);


  // Redémarrer la boucle du jeu
  gameLoop();
}

// Placement d'un purificateur d'air
function placePurifier() {
  if (purifiers.length < purifierLimit) {
    purifiers.push({
      x: player.x,
      y: player.y,
      width: tileSize,
      height: tileSize,
      duration: 600 // Durée de vie en frames (~10 secondes à 60fps)
    });
    updateHUD();
  } else {
    alert('Vous n\'avez plus de purificateurs disponibles !');
  }
}

// Création d'un virus
function createVirus() {
  // Les virus apparaissent aléatoirement autour des bords du canvas
  let positions = [
    { x: Math.random() * canvas.width, y: 0 }, // Haut
    { x: Math.random() * canvas.width, y: canvas.height - tileSize / 2 }, // Bas
    { x: 0, y: Math.random() * canvas.height }, // Gauche
    { x: canvas.width - tileSize / 2, y: Math.random() * canvas.height } // Droite
  ];
  let pos = positions[Math.floor(Math.random() * positions.length)];
  let virus = {
    x: pos.x,
    y: pos.y,
    width: tileSize / 2,
    height: tileSize / 2
  };
  viruses.push(virus);
  virusCount++;
  updateHUD();
}

// Effets visuels lors d'une infection
let infectionEffects = [];

function showInfectionEffect(x, y) {
  infectionEffects.push({ x: x, y: y, alpha: 1 });
}

function drawInfectionEffects() {
  infectionEffects.forEach((effect, index) => {
    ctx.fillStyle = `rgba(255, 0, 0, ${effect.alpha})`;
    ctx.beginPath();
    ctx.arc(effect.x + player.width / 2, effect.y + player.height / 2, 30, 0, Math.PI * 2);
    ctx.fill();
    effect.alpha -= 0.05;
    if (effect.alpha <= 0) {
      infectionEffects.splice(index, 1);
    }
  });
}

// Effets visuels lorsque le masque protège le joueur
let maskProtectionEffects = [];

function showMaskProtectionEffect(x, y) {
  maskProtectionEffects.push({ x: x, y: y, alpha: 1 });
}

function drawMaskProtectionEffects() {
  maskProtectionEffects.forEach((effect, index) => {
    ctx.fillStyle = `rgba(0, 0, 255, ${effect.alpha})`;
    ctx.beginPath();
    ctx.arc(effect.x + player.width / 2, effect.y + player.height / 2, 30, 0, Math.PI * 2);
    ctx.fill();
    effect.alpha -= 0.05;
    if (effect.alpha <= 0) {
      maskProtectionEffects.splice(index, 1);
    }
  });
}

let isPaused = false; // Indique si le jeu est en pause

// Récupération des boutons de contrôle tactile
const upButton = document.getElementById('upButton');
const downButton = document.getElementById('downButton');
const leftButton = document.getElementById('leftButton');
const rightButton = document.getElementById('rightButton');
const maskButton = document.getElementById('maskButton');
const purifierButton = document.getElementById('purifierButton');
const windowButton = document.getElementById('windowButton');
const pauseButton = document.getElementById('pauseButton');

// Gestion des événements tactiles pour les boutons de déplacement
upButton.addEventListener('touchstart', () => keys['ArrowUp'] = true);
upButton.addEventListener('touchend', () => keys['ArrowUp'] = false);

downButton.addEventListener('touchstart', () => keys['ArrowDown'] = true);
downButton.addEventListener('touchend', () => keys['ArrowDown'] = false);

leftButton.addEventListener('touchstart', () => keys['ArrowLeft'] = true);
leftButton.addEventListener('touchend', () => keys['ArrowLeft'] = false);

rightButton.addEventListener('touchstart', () => keys['ArrowRight'] = true);
rightButton.addEventListener('touchend', () => keys['ArrowRight'] = false);

// Gestion des événements tactiles pour les boutons d'action
maskButton.addEventListener('touchstart', () => {
  if (player.maskProtections > 0) {
    player.mask = !player.mask;
  } else {
    alert('Votre masque FFP2 n\'a plus de protections !');
    player.mask = false;
  }
  updateHUD();
});

purifierButton.addEventListener('touchstart', () => {
  placePurifier();
});

windowButton.addEventListener('touchstart', () => {
  windows.isOpen = !windows.isOpen;
  updateHUD();
});

pauseButton.addEventListener('click', () => {
  isPaused = !isPaused;
  if (isPaused) {
    pauseButton.textContent = 'Reprendre';
    // Désactiver les contrôles pendant la pause
    disableControls(true);
  } else {
    pauseButton.textContent = 'Pause';
    // Réactiver les contrôles
    disableControls(false);
    // Reprendre le jeu
    gameLoop();
  }
});

// Fonction pour désactiver ou activer les contrôles
function disableControls(disable) {
  upButton.disabled = disable;
  downButton.disabled = disable;
  leftButton.disabled = disable;
  rightButton.disabled = disable;
  maskButton.disabled = disable;
  purifierButton.disabled = disable;
  windowButton.disabled = disable;
}

// Ajuster la vitesse du joueur en fonction de l'appareil
function adjustPlayerSpeed() {
  playerSpeed = isMobile ? tileSize / 10 : 2;
}

// Fonction pour ajuster la taille du canvas en fonction de la taille de la fenêtre
function resizeCanvas() {
  let width = window.innerWidth - 40; // Soustraction des marges horizontales (20px de chaque côté)
  let height = window.innerHeight - 200; // Ajustement pour laisser de l'espace pour le HUD et les contrôles

  // Définir la taille maximale du canvas
  const maxCanvasSize = 600; // Vous pouvez ajuster cette valeur
  const canvasSize = Math.min(width, height);

  // Taille finale du canvas
  const finalCanvasSize = Math.min(canvasSize, maxCanvasSize);

  canvas.width = finalCanvasSize;
  canvas.height = finalCanvasSize;

  // Recalculer tileSize en fonction de la nouvelle largeur du canvas
  tileSize = canvas.width / 15; // Diviseur ajusté pour les sprites
  
  // Ajuster la vitesse du joueur
  adjustPlayerSpeed();

  // Repositionner les éléments du jeu
  player.width = tileSize;
  player.height = tileSize;
  player.x = canvas.width / 2 - player.width / 2;
  player.y = canvas.height - player.height * 2;

  windows.width = tileSize * 4;
  windows.height = tileSize * 4;
  windows.x = (canvas.width - windows.width) / 2;
  windows.y = (canvas.height - windows.height) / 2;

  // Redimensionner les virus
  viruses.forEach(virus => {
    virus.width = tileSize * 0.8;
    virus.height = tileSize * 0.8;
  });

  // Redimensionner les purificateurs
  purifiers.forEach(purifier => {
    purifier.width = tileSize;
    purifier.height = tileSize;
  });
}




window.addEventListener('resize', resizeCanvas);

// Appeler resizeCanvas au démarrage pour ajuster la taille initiale
resizeCanvas();

if (isPaused) {
  pauseButton.textContent = 'Reprendre';
} else {
  pauseButton.textContent = 'Pause';
}



// Démarrage du jeu après le chargement des images
let imagesLoaded = 0;
[playerImg, playerMaskImg, virusImg, purifierImg, windowClosedImg, windowOpenImg].forEach(
  (img) => {
    img.onload = () => {
      imagesLoaded++;
      if (imagesLoaded === 6) {
        gameLoop();
      }
    };
  }
);

