/* 
TODO:
1. Make ground tiles as objects
2. Make harcoded map array
*/

const PATH = {
  ASSETS: 'assets',
  ATLAS: 'assets/atlas',
  ICONS: 'assets/icons',
  OBJ: 'assets/obj',
  PARTICLES: 'assets/particles',
};
const config = {
  type: Phaser.AUTO,
  backgroundColor: '#333333',
  parent: 'phaser-example',
  pixelArt: true,
  scale: {
    parent: 'phaser-example',
    mode: Phaser.Scale.FIT,
    width: 1280,
    height: 720,
  },
  physics: {
    default: 'arcade',
    arcade: { debug: true },
  },
  scene: {
    preload,
    create,
    update,
  },
};

const mapWidth = 15;
const mapHeight = 15;
const tileWidthHalf = 21;
const tileHeightHalf = 12;
const centerX = (mapWidth / 2) * tileWidthHalf;
const centerY = -100;

let deploymentStarted = false;

let controls, path, follower, ship, blocks = [];
let gameContainer;

const game = new Phaser.Game(config);

function preload() {
  this.load.atlas('isoblocks', `${PATH.ATLAS}/isoblocks.png`, `${PATH.ATLAS}/isoblocks.json`);
  this.load.image('fullscreen-btn', `${PATH.ICONS}/fullscreen_btn.png`);
  this.load.image('ship', `${PATH.OBJ}/ship.png`);
  this.load.image('lava-block', `${PATH.OBJ}/lava_block.png`);
  this.load.image('par-smoke', `${PATH.PARTICLES}/par-smoke.png`);
}

function create() {
  gameContainer = this.add.container();
  gameContainer.setScale(1.5);

  setCamera.call(this);
  generateMap.call(this);
  initFullscreenButton.call(this);
  listenForPointer.call(this);
}

function update(time, delta) {
  controls.update(delta);
  moveShipByTrajectory.call(this);
}


// CUSTOM METHODS

function generateMap() {
  const shape = new Phaser.Geom.Polygon([
    25, 0,
    46, tileHeightHalf,
    46, 50 - tileHeightHalf,
    tileWidthHalf, 50,
    4, 50 - tileHeightHalf,
    4, tileHeightHalf,
  ]);
  for (var y = 0; y < mapHeight; y++) {
    for (var x = 0; x < mapWidth; x++) {
      const tx = (x - y) * tileWidthHalf;
      const ty = (x + y) * tileHeightHalf;

      const block = (x % 2 === 0) ? 'block-059' : 'block-054';

      const tile = this.add.sprite(tx, ty, 'isoblocks', block)
        .setInteractive(
          shape, Phaser.Geom.Polygon.Contains
        );

      // drawPolygon.call(this, {
      //   shape, gameObj: tile, depth: centerY + ty
      // });

      tile.setData('coords', { x, y });
      tile.setData('type', 'ground');

      tile.setDepth(centerY + ty);

      blocks.push(tile);
      gameContainer.add(tile);
    }
  }
}

function setCamera() {
  const controlConfig = {
    camera: this.cameras.main,
  };

  this.cameras.main.scrollX = -625;
  this.cameras.main.scrollY = -160;

  controls = new Phaser.Cameras.Controls.SmoothedKeyControl(controlConfig);
}

function initFullscreenButton() {
  const fullscreenBtn = this.add.image(config.scale.width - 40, 40, 'fullscreen-btn').setInteractive().setScrollFactor(0);
  fullscreenBtn.setDepth(500);
  fullscreenBtn.on('pointerup', () => {
    if (this.scale.isFullscreen) {
      this.scale.stopFullscreen();
    }
    else {
      this.scale.startFullscreen();
    }
  }, this);
}

function initShuttleCrash(x, y) {
  initShipTrajectory.call(this, { targetX: x, targetY: y });

  ship = this.add.image(0, -600, 'isoblocks', 'block-098').setOrigin(0.5, 0.5);
  ship.setDepth(490);

  const particles = this.add.particles('par-smoke');
  particles.setDepth(490);
  const particleEmitter = particles.createEmitter({
    speed: 20,
    alpha: 0.2,
    scale: { start: 0.3, end: 0 },
    blendMode: 'ADD'
  });
  ship.setData('particles', {
    self: particles,
    emitter: particleEmitter
  })
  gameContainer.add(ship);
  gameContainer.add(particles);
  particleEmitter.startFollow(ship);
}

function initShipTrajectory({ targetX, targetY }) {
  const targetBlock = findBlockByCoord(targetX, targetY);
  if (!targetBlock) {
    return;
  }

  const { x, y } = targetBlock;
  const line = new Phaser.Curves.Line([0, -600, x, y - tileHeightHalf * 2]);

  targetBlock.setTint(0xf5c542);

  follower = { t: 0, vec: new Phaser.Math.Vector2() };
  path = this.add.path();
  path.add(line);

  this.tweens.add({
    targets: follower,
    t: 1,
    ease: 'Linear',
    duration: 4000,
  });
}

function moveShipByTrajectory() {
  if (follower) {
    path.getPoint(follower.t, follower.vec);
    ship.x = follower.vec.x;
    ship.y = follower.vec.y;

    if (follower.t === 1) {
      this.cameras.main.shake(200, 0.005);
      ship.getData('particles').emitter.gravityY = -300;
      ship.getData('particles').emitter.speed = 10;
      ship.getData('particles').emitter.frequency = -1;
      this.time.delayedCall(1000, () => {
        ship.getData('particles').self.destroy();
      });
      follower = undefined;
    }
  }
}

function listenForPointer() {
  if (!deploymentStarted) {
    this.input.on('pointerover', (event, gameObjects) => {
      if (gameObjects && gameObjects[0] && gameObjects[0].getData('type') === 'ground') {
        gameObjects[0].setTint(0xff0000);
      }
    });

    this.input.on('pointerout', (event, gameObjects) => {
      if (gameObjects && gameObjects[0] && gameObjects[0].getData('type') === 'ground') {
        gameObjects[0].clearTint();
      }
    });
    this.input.on('pointerdown', (event, gameObjects) => {
      if (gameObjects && gameObjects[0] && gameObjects[0].getData('type') === 'ground') {
        deploymentStarted = true;

        this.input.off('pointerdown');
        this.input.off('pointerover');
        this.input.off('pointerout');

        const { x, y } = gameObjects[0].getData('coords');
        initShuttleCrash.call(this, x, y);
      }
    });
  }
}

// UTILS

function findBlockByCoord(tx, ty) {
  return blocks.find((block) => {
    const { x, y } = block.getData('coords');
    return x === tx && y === ty;
  });
}

function drawPolygon({ shape, gameObj, depth }) {
  const graphics = this.add.graphics({ x: gameObj.x - gameObj.displayOriginX, y: gameObj.y - gameObj.displayOriginY });

  graphics.lineStyle(1, 0xffffff);

  graphics.beginPath();
  graphics.moveTo(shape.points[0].x, shape.points[0].y);

  for (var i = 1; i < shape.points.length; i++) {
    graphics.lineTo(shape.points[i].x, shape.points[i].y);
  }

  graphics.closePath();
  graphics.strokePath();
  graphics.setDepth(depth + 100);
}
