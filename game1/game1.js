// Constants
var MAX_SPIN_RATE = 5.0;   // degrees per update
var SPAWN_INTERVAL_FACTOR = 0.95;   // spawn interval change per spawn
var BULLET_FIRE_RATE = 0.5;  // time between bullets
var INITIAL_ENEMY_SPAWN_INTERVAL = 4.0;
var PLAYER_SPEED = 250.0;
var ENEMY_SPAWN_INTERVAL_ADJUST = 50.0;  // determines how fast enemies speed up against score
var ENEMY_SCALE_VARIATION = 0.2;
var ENEMY_SCALE_BASE = 0.3;
var ENEMY_MAX_X_VELOCITY = 500.0;

var GameStates = {};

// TODO:
//  Fix music playing multiple times - DONE
//  Phaser.Cache.isSoundDecoded cache miss
//  Score adjust for asteroid size
//  Side-collision between enemy and rocket causes crash
//  Add touch controls for iPad

GameStates.Boot = function(game) {
};

GameStates.Boot.prototype = {
    preload: function () {
        // load just the loading sprite
        this.load.image('loading', 'assets/loading.png');
    },
    create: function () {
    },
    update: function () {
        this.game.state.start('Preload');
    },
};

GameStates.Preload = function(game) {
};

GameStates.Preload.prototype = {
    preload: function () {
        this.load.image('background', 'assets/background.png');
        this.load.image('player', 'assets/player.png');
        this.load.image('asteroid1', 'assets/asteroid1.png');
        this.load.image('asteroid2', 'assets/asteroid2.png');
        this.load.image('asteroid3', 'assets/asteroid3.png');
        this.load.image('rocket', 'assets/rocket.png');
        this.load.image('flame', 'assets/flame.png');

        this.load.spritesheet('explosionA', 'assets/Exp_type_A.png', 128, 128);
        this.load.spritesheet('explosionB', 'assets/Exp_type_B.png', 192, 192);
        this.load.spritesheet('explosionC', 'assets/Exp_type_C.png', 256, 256);

        // sound effects
        this.load.audio('explosion1', 'assets/audio/explosion1.ogg');
        this.load.audio('explosion2', 'assets/audio/explosion2.ogg');
        this.load.audio('rocket',     'assets/audio/rocket.ogg');

        //  To load an audio file use the following structure.
        //  As with all load operations the first parameter is a unique key, which must be unique between all audio files.

        //  The second parameter is an array containing the same audio file but in different formats.
        //  In this example the music is provided as an mp3 and a ogg (Firefox will want the ogg for example)

        //  The loader works by checking if the browser can support the first file type in the list (mp3 in this case). If it can, it loads it, otherwise
        //  it moves to the next file in the list (the ogg). If it can't load any of them the file will error.

        //this.load.audio('boden', ['assets/audio/bodenstaendig_2000_in_rock_4bit.mp3', 'assets/audio/bodenstaendig_2000_in_rock_4bit.ogg']);

        //  If you know you only need to load 1 type of audio file, you can pass a string instead of an array, like this:
        this.load.audio('music', 'assets/audio/bodenstaendig_2000_in_rock_4bit.ogg');

        // automatic preload bar (not working?)
        this.preloadBar = this.add.sprite(this.game.world.width/2, this.game.world.height/2, 'loading');
        this.preloadBar.anchor.setTo(0.5, 0.5);
        this.load.setPreloadSprite(this.preloadBar);
    },
    create: function () {
    },
    update: function () {
        // wait until music is decoded
        if (this.cache.isSoundDecoded('music'))
        {
            // start music
            music = game.sound.play('music');
            this.game.state.start('Start');
        }
    },
};

GameStates.Start = function(game) {
};

GameStates.Start.prototype = {
    preload: function () {
    },
    create: function () {
        this.background = this.add.tileSprite(0, 0, 1024, 1024, 'background');

        var style = { font: "65px Arial", fill: "#ff0044", align: "center" };
        var text = this.add.text(this.world.centerX, this.world.centerY - 128, "Zoe Saves The Earth!", style);
        text.anchor.set(0.5);

        var style = { font: "31px Arial", fill: "#ff0044", align: "center" };
        var text = this.add.text(this.world.centerX, this.world.centerY, "Left / Right - Move Ship\nUp - Fire Missile", style);
        text.anchor.set(0.5);

        var style2 = { font: "31px Arial", fill: "#ff0044", align: "center" };
        var text2 = this.add.text(this.world.centerX, this.world.centerY + 128, "Hit Space to Start", style2);
        text2.anchor.set(0.5);

        start = this.input.keyboard.addKey(Phaser.Keyboard.SPACEBAR);
        start.onDown.add(this.keyDown, this);
    },
    update: function () {
    },
    keyDown: function (self) {
        this.game.state.start('Running');
    },
};


GameStates.Running = function(game) {
    this.player;
    this.cursors;
    this.enemy_group;
    this.bullet_group;
    this.bullet_cooldown = false;
    this.explosion_group;
    this.score = 0;
    this.high_score = 0;
    this.scoreText;
    this.background;
    this.explosion1;
    this.explosion2;

    // number of seconds between each enemy
    this.spawn_interval = INITIAL_ENEMY_SPAWN_INTERVAL;
};

GameStates.Running.prototype = {

    preload: function () {
    },

    create: function () {

        this.explosion1 = this.add.audio('explosion1');
        this.explosion2 = this.add.audio('explosion2');
        this.rocket = this.add.audio('rocket');

        //  Being mp3 files these take time to decode, so we can't play them instantly
        //  Using setDecodedCallback we can be notified when they're ALL ready for use.
        //  The audio files could decode in ANY order, we can never be sure which it'll be.
//        this.sound.setDecodedCallback([ this.explosion1, this.explosion2 ], this.create2, this);
//    },

//    create2: function () {

        // enable the Arcade Physics system
        this.physics.startSystem(Phaser.Physics.ARCADE);

        // background
        this.background = this.add.tileSprite(0, 0, 1024, 1024, 'background');

        // The player and its settings
        this.player = this.add.sprite(this.world.width / 2, this.world.height - 60, 'player');
        this.physics.arcade.enable(this.player);
        this.player.anchor.setTo(0.5, 0.5);
        this.player.body.gravity.y = 0;
        this.player.body.collideWorldBounds = true;

        // enemies will be part of this group
        this.enemy_group = this.add.group();
        this.enemy_group.enableBody = true;

        // bullet group properties
        this.bullet_group = this.add.group();
        this.bullet_group.enableBody = true;
        this.bullet_cooldown = false;

        // explosion group properties
        this.explosion_group = this.add.group();
        this.explosion_group.enableBody = true;

        // controls
        this.cursors = this.input.keyboard.createCursorKeys();

        // score display
        this.score = 0;
        this.scoreText = this.add.text(16, 16, 'Score: 0\nHigh: ' + this.high_score, { fontSize: '32px', fill: '#0000FF' });

        // start with an enemy
        this.spawnEnemy();

        // install cheat
        //boost = this.input.keyboard.addKey(Phaser.Keyboard.SPACEBAR);
        //boost.onDown.add(this.boostScore, this);

        // particles...

        //create an emitter
        this.emitter = this.add.emitter(0, 0, 100);
        this.emitter.makeParticles('flame');
        //this.emitter.scale.setTo(0.15, 0.15);

        // Attach the emitter to the sprite
        this.player.addChild(this.emitter);

        //position the emitter relative to the sprite's anchor location
//        this.emitter.y = -this.player.size.y / 2;
//        this.emitter.x = 0;

        // setup options for the emitter
//        this.emitter.lifespan = 100;
//        this.emitter.maxParticleSpeed = new Phaser.Point(50,-100);
//        this.emitter.minParticleSpeed = new Phaser.Point(-50,-200);
    },

    // cheat
    boostScore: function () {
        this.updateScore(100);
    },

    update: function () {

        // collision checks
        this.physics.arcade.overlap(this.player, this.enemy_group, this.playerHit, null, this);
        this.physics.arcade.overlap(this.bullet_group, this.enemy_group, this.enemyHit, null, this);

        this.player.body.velocity.x = 0;
        if (this.cursors.left.isDown)
        {
            this.player.body.velocity.x = -PLAYER_SPEED;
            this.player.angle = -10;
        }
        else if (this.cursors.right.isDown)
        {
            this.player.body.velocity.x = PLAYER_SPEED;
            this.player.angle = 10;
        }
        else
        {
            this.player.angle = 0;
        }

        // randomly spawn a new enemy

        if (this.cursors.up.isDown)
        {
            this.spawnBullet();
        }

        // rotate enemies as they fall
        this.enemy_group.forEach(function(item) {
            item.angle += item.spin;

            // bounce enemies off the sides of the screen
            half_size = item.width / 2;
            if ( (item.x < half_size && item.body.velocity.x < 0) ||
                 (item.x > this.world.width - half_size && item.body.velocity.x > 0) )
            {
                item.body.velocity.x = -item.body.velocity.x;
            }

            // kill enemies that have fallen past the player
            if (item.y > this.player.y + 100)
            {
                item.destroy();

                // deduct percentage from score
                this.updateScore(this.score * -0.10);
            }

        }, this);

        // background animation, speeds up with score
        background_speed = Math.max(0.2, this.score / 500.0);
        this.background.tilePosition.y += background_speed;

        // emit particles
        //this.emitter.emitParticle();

        // keep player on top
        this.player.bringToTop();
    },

    spawnBullet: function () {
        if (!this.bullet_cooldown)
        {
            this.rocket.play();

            bullet = this.bullet_group.create(this.player.x, this.player.y, 'rocket');
            bullet.anchor.setTo(0.5, 0.5);
            bullet.body.gravity.y = 0;
            bullet.body.velocity.y = -500;
            bullet.scale.setTo(0.4, 0.4);

            // ensure maximum bullet firing rate
            this.bullet_cooldown = true;
            this.time.events.add(Phaser.Timer.SECOND * BULLET_FIRE_RATE, this.clearBulletFlag, this);

            // bullets cost points!
            this.updateScore(-5);
        }
    },

    clearBulletFlag: function () {
        this.bullet_cooldown = false;
    },

    spawnEnemy: function () {

        // as score increases, horizontal velocity increases
        var horiz = this.score;

        var x = this.rnd.integerInRange(8, game.world.width - 32);

        k = Math.abs(this.rnd.normal());
        if (k < 0.5)
        {
            type = 'asteroid1';
        }
        else if (k < 0.75)
        {
            type = 'asteroid2';
        }
        else
        {
            type = 'asteroid3';
        }
        scale = ENEMY_SCALE_BASE + ENEMY_SCALE_VARIATION * this.rnd.normal();

        var enemy = this.enemy_group.create(x, -100, type);
        enemy.scale.setTo(scale, scale);
        enemy.anchor.setTo(0.5, 0.5);
        enemy.body.gravity.y = 100 + this.rnd.integerInRange(-50, 50);
        enemy.body.velocity.x = Math.min(this.rnd.normal() * horiz, ENEMY_MAX_X_VELOCITY);
        enemy.spin = this.rnd.normal() * MAX_SPIN_RATE;

//        // reduce the spawn timer a little
//        this.spawn_interval = this.spawn_interval * SPAWN_INTERVAL_FACTOR;

        // set the spawn timer based on score
        this.spawn_interval = INITIAL_ENEMY_SPAWN_INTERVAL / Math.log(Math.E + this.score / ENEMY_SPAWN_INTERVAL_ADJUST)

        // reset the timer
        this.time.events.add(Phaser.Timer.SECOND * this.spawn_interval, this.spawnEnemy, this);
    },

    playerHit: function () {

        this.explosion2.play();
        this.createExplosion('explosionB', this.player);
        this.player.kill();

        // game over
        this.game.state.start('GameOver', false, false, this.score);
    },

    enemyHit: function (bullet, enemy) {

        // play sound
        this.explosion1.play();

        // create an explosion
        this.createExplosion('explosionA', enemy);

        // score is based on enemy's velocity
        score = (enemy.body.velocity.y + enemy.body.velocity.x) / 10.0
        this.updateScore(score);

        bullet.destroy();
        enemy.destroy();
    },

    createExplosion: function (type, object) {
        // adjust explosion size based on target size
        size = Math.max(object.width, object.height) * 2.5;

        var explosion = this.explosion_group.create(object.x, object.y, type);
        explosion.width = size;
        explosion.height = size;
        explosion.anchor.setTo(0.5, 0.5);
        explosion.body.gravity = object.body.gravity;
        explosion.body.velocity.y = object.body.velocity.y / 2.0;
        explosion.body.velocity.x = object.body.velocity.x / 2.0;
        anim = explosion.animations.add('explode');
        //anim.onStart.add(animationStarted, this);
        anim.onComplete.add(this.explosionAnimationStopped, this);
        anim.play(15, false);
    },

    explosionAnimationStopped: function (sprite, animation) {
        sprite.destroy();
    },

    updateScore: function (amount) {
        this.score = Math.ceil(Math.max(0, this.score + amount));
        this.high_score = Math.max(this.score, this.high_score);
        this.scoreText.text = 'Score: ' + this.score + '\nHigh: ' + this.high_score;
    },

    render: function () {
        //game.debug.text("Spawn interval: " + this.spawn_interval.toString(), 16, 16);
    },

};


GameStates.GameOver = function(game) {
    this.cursors;
    this.score;
};

GameStates.GameOver.prototype = {
    init: function (score) {
        this.score = score;
    },
    preload: function () {
    },
    create: function () {
        var style = { font: "65px Arial", fill: "#ff0044", align: "center" };
        var text = this.add.text(this.world.centerX, this.world.centerY, "Game Over\nScore " + this.score, style);
        text.anchor.set(0.5);

        var style2 = { font: "31px Arial", fill: "#ff0044", align: "center" };
        var text2 = this.add.text(this.world.centerX, this.world.centerY + 128, "Hit Space to Restart", style2);
        text2.anchor.set(0.5);

        restart = this.input.keyboard.addKey(Phaser.Keyboard.SPACEBAR);
        restart.onDown.add(this.keyDown, this);
    },
    update: function () {
    },
    keyDown: function (self) {
        this.game.state.start('Running');
        //console.log(game.input.keyboard.event.keyCode);
    },
    render: function () {
        //game.debug.text("Debug: " + this.score.toString(), 16, 16);
    },

};


var game = new Phaser.Game(800, 600, Phaser.AUTO, '');

game.state.add('Boot', GameStates.Boot);
game.state.add('Preload', GameStates.Preload);
game.state.add('Start', GameStates.Start);
game.state.add('Running', GameStates.Running);
game.state.add('GameOver', GameStates.GameOver);

game.state.start('Boot');
