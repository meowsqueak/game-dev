// Constants
var MAX_SPIN_RATE = 5.0;   // degrees per update
var SPAWN_INTERVAL_FACTOR = 0.95;   // spawn interval change per spawn
var BULLET_FIRE_RATE = 0.5;  // time between bullets
var INITIAL_ENEMY_SPAWN_INTERVAL = 4.0;
var PLAYER_SPEED = 250.0;
var ENEMY_SPAWN_INTERVAL_ADJUST = 50.0;  // determines how fast enemies speed up against score

var GameStates = {};

// TODO:
//  fix music playing multiple times
//  side-collision between enemy and rocket causes crash

GameStates.Boot = function(game) {
};

GameStates.Boot.prototype = {
    preload: function () {
        //  To load an audio file use the following structure.
        //  As with all load operations the first parameter is a unique key, which must be unique between all audio files.

        //  The second parameter is an array containing the same audio file but in different formats.
        //  In this example the music is provided as an mp3 and a ogg (Firefox will want the ogg for example)

        //  The loader works by checking if the browser can support the first file type in the list (mp3 in this case). If it can, it loads it, otherwise
        //  it moves to the next file in the list (the ogg). If it can't load any of them the file will error.

        //this.load.audio('boden', ['assets/audio/bodenstaendig_2000_in_rock_4bit.mp3', 'assets/audio/bodenstaendig_2000_in_rock_4bit.ogg']);

        //  If you know you only need to load 1 type of audio file, you can pass a string instead of an array, like this:
        this.load.audio('boden', 'assets/audio/bodenstaendig_2000_in_rock_4bit.ogg');
    },
    create: function () {
        // start music
        music = game.sound.play('boden');
    },
    update: function () {
        this.state.start('Running');
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
    this.scoreText;
    this.background;
    this.explosion1;
    this.explosion2;

    // number of seconds between each enemy
    this.spawn_interval = INITIAL_ENEMY_SPAWN_INTERVAL;
};

GameStates.Running.prototype = {

    preload: function () {
        this.load.image('background', 'assets/background.png');
        this.load.image('square', 'assets/red_square.png');
        this.load.image('triangle', 'assets/purple_triangle.png');
        this.load.image('pentagon', 'assets/green_pentagon.png');
        this.load.spritesheet('explosionA', 'assets/Exp_type_A.png', 128, 128);
        this.load.spritesheet('explosionB', 'assets/Exp_type_B.png', 192, 192);
        this.load.spritesheet('explosionC', 'assets/Exp_type_C.png', 256, 256);

        // sound effects
        this.load.audio('explosion1', 'assets/audio/explosion1.ogg');
        this.load.audio('explosion2', 'assets/audio/explosion2.ogg');
        this.load.audio('rocket',     'assets/audio/rocket.ogg');

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
        this.player = this.add.sprite(this.world.width / 2, this.world.height - 60, 'triangle');
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

        // explosion group properties
        this.explosion_group = this.add.group();
        this.explosion_group.enableBody = true;

        // controls
        this.cursors = this.input.keyboard.createCursorKeys();

        // score display
        this.scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '32px', fill: '#0000FF' });

        // start with an enemy
        this.spawnEnemy();

        // install cheat
        boost = this.input.keyboard.addKey(Phaser.Keyboard.SPACEBAR);
        boost.onDown.add(this.boostScore, this);
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
        }
        else if (this.cursors.right.isDown)
        {
            this.player.body.velocity.x = PLAYER_SPEED;
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
            if ( (item.x < 32 && item.body.velocity.x < 0) ||
                 (item.x > this.world.width - 32 && item.body.velocity.x > 0) )
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

        // keep player on top
        this.player.bringToTop();
    },

    spawnBullet: function () {
        if (!this.bullet_cooldown)
        {
            this.rocket.play();

            bullet = this.bullet_group.create(this.player.x, this.player.y, 'square');
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
        var enemy = this.enemy_group.create(x, -100, 'pentagon');
        enemy.anchor.setTo(0.5, 0.5);
        enemy.body.gravity.y = 100 + this.rnd.integerInRange(-50, 50);
        enemy.body.velocity.x = this.rnd.normal() * horiz;
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
        this.state.start('GameOver', false, false, this.score);
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
        var explosion = this.explosion_group.create(object.x, object.y, type);
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
        this.scoreText.text = 'Score: ' + this.score;
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
        this.cursors = this.input.keyboard.createCursorKeys();
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
        this.state.start('Running', true, true);
        //console.log(game.input.keyboard.event.keyCode);
    },
    render: function () {
        //game.debug.text("Debug: " + this.score.toString(), 16, 16);
    },

};


var game = new Phaser.Game(800, 600, Phaser.AUTO, '');

game.state.add('Boot', GameStates.Boot);
game.state.add('Running', GameStates.Running);
game.state.add('GameOver', GameStates.GameOver);

game.state.start('Boot');

