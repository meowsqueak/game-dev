// Constants
var MAX_SPIN_RATE = 5.0;   // degrees per update
var SPAWN_INTERVAL_FACTOR = 0.95;   // spawn interval change per spawn
var BULLET_FIRE_RATE = 0.5;  // time between bullets

var GameStates = {};

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
//    this.explosion1;
//    this.explosion2;

    // number of seconds between each enemy
    this.spawn_interval = 4.0;
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
//        this.load.audio('explosion1', 'assets/audio/explosion1.ogg');
//        this.load.audio('explosion2', 'assets/audio/explosion2.mp3');

    },

    create: function () {

        this.explosion1 = this.add.audio('explosion1');
        this.explosion2 = this.add.audio('explosion2');

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
        player = this.add.sprite(game.world.width / 2, game.world.height - 60, 'triangle');
        this.physics.arcade.enable(player);
        player.anchor.setTo(0.5, 0.5);
        player.body.gravity.y = 0;
        player.body.collideWorldBounds = true;

        // enemies will be part of this group
        enemy_group = this.add.group();
        enemy_group.enableBody = true;

        // bullet group properties
        bullet_group = this.add.group();
        bullet_group.enableBody = true;

        // explosion group properties
        explosion_group = this.add.group();
        explosion_group.enableBody = true;

        // controls
        cursors = this.input.keyboard.createCursorKeys();

        // score display
        this.scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '32px', fill: '#0000FF' });

        // start with an enemy
        this.spawnEnemy();
    },

    update: function () {

        // collision checks
        this.physics.arcade.overlap(this.player, this.enemy_group, this.playerHit, null, this);
        this.physics.arcade.overlap(this.bullet_group, this.enemy_group, this.enemyHit, null, this);

        this.player.body.velocity.x = 0;
        if (this.cursors.left.isDown)
        {
            player.body.velocity.x = -250;
        }
        else if (this.cursors.right.isDown)
        {
            player.body.velocity.x = 250;
        }

        // randomly spawn a new enemy

        if (this.cursors.up.isDown)
        {
            this.spawnBullet();
            //var enemy = enemy_group.create(game.world.height / 2, 0, 'pentagon');
            //enemy.body.gravity.y = 100;
            //this.spawnEnemy();
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
            if (item.y > player.y + 100)
            {
                item.destroy();

                // deduct percentage from score
                this.updateScore(this.score * -0.10);
            }

        }, this);

        // background animation
        this.background.tilePosition.y += 0.2;

        // keep player on top
        this.player.bringToTop();
    },

    spawnBullet: function () {
        if (!this.bullet_cooldown)
        {
            bullet = bullet_group.create(player.x, player.y, 'square');
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
        var enemy = enemy_group.create(x, -100, 'pentagon');
        enemy.anchor.setTo(0.5, 0.5);
        enemy.body.gravity.y = 100 + this.rnd.integerInRange(-50, 50);
        enemy.body.velocity.x = this.rnd.normal() * horiz;
        enemy.spin = this.rnd.normal() * MAX_SPIN_RATE;

        // reduce the spawn timer a little
        this.spawn_interval = this.spawn_interval * SPAWN_INTERVAL_FACTOR;

        // reset the timer
        this.time.events.add(Phaser.Timer.SECOND * this.spawn_interval, this.spawnEnemy, this);
    },

    playerHit: function () {

        this.createExplosion('explosionB', player);
        player.kill();

        // game over
        this.state.start('GameOver', false, false, this.score);
    },

    enemyHit: function (bullet, enemy) {

        // play sound
//        this.explosion1.play();

        // create an explosion
        this.createExplosion('explosionA', enemy);

        // score is based on enemy's velocity
        score = (enemy.body.velocity.y + enemy.body.velocity.x) / 10.0
        this.updateScore(score);

        bullet.destroy();
        enemy.destroy();
    },

    createExplosion: function (type, object) {
        var explosion = explosion_group.create(object.x, object.y, type);
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
    },
    update: function () {
        if (cursors.up.isDown)
        {
            this.state.start('Running');
        }
    }
};


var game = new Phaser.Game(800, 600, Phaser.AUTO, '');

game.state.add('Running', GameStates.Running);
game.state.add('GameOver', GameStates.GameOver);

game.state.start('Running');

