var ReVenge = /** @class */ (function () {
    function ReVenge() {
        this.settings = {
            aimBot: true,
            infAmmo: true,
            infJump: true,
            spotOn: true,
            esp: true
            // fly: false
        };
        console.log('ReVenge Startup');
        this.insertHooks();
        this.overlay();
    }
    ReVenge.prototype.overlay = function () {
        var _this_1 = this;
        var overlayElement = document.createElement('div');
        overlayElement.style.position = 'fixed';
        overlayElement.style.left = '0';
        overlayElement.style.top = '0';
        overlayElement.style.width = '100px';
        var _loop_1 = function (settingsKey) {
            var toggleElement = document.createElement('button');
            toggleElement.textContent = 'Toggle ' + settingsKey;
            toggleElement.onclick = function () {
                _this_1.settings[settingsKey] = !_this_1.settings[settingsKey];
            };
            overlayElement.appendChild(toggleElement);
        };
        for (var settingsKey in this.settings) {
            _loop_1(settingsKey);
        }
        document.body.appendChild(overlayElement);
        console.log('Inserted UI');
    };
    ReVenge.prototype.insertHooks = function () {
        var _this = this;
        var NetworkManager = window['NetworkManager'];
        var _initialize = NetworkManager.prototype.initialize;
        NetworkManager.prototype.initialize = function () {
            _this.networkManager = this;
            console.log('Hooked Network');
            _initialize.call(this);
        };
        var VengeGuard = window['VengeGuard'];
        VengeGuard.prototype.onCheck = function () {
            this.app.fire('Network:Guard', 1); // Send the all clear to the AC
        };
        console.log('Hooked AC');
        var Movement = window['Movement'];
        var _update = Movement.prototype.update;
        Movement.prototype.update = function (t) {
            if (!_this.movement) {
                _this.movement = this;
                console.log('Hooked Movement');
            }
            _this.tick();
            _update.apply(this, [t]);
            _this.postTick();
        };
        var Label = window['Label'];
        Label.prototype.update = function (t) {
            var pc = window['pc'];
            if (!pc.isSpectator) {
                if (this.player.isDeath) {
                    this.labelEntity.enabled = false;
                    return false;
                }
                if (Date.now() - this.player.lastDamage > 1800 && !_this.settings.esp) {
                    this.labelEntity.enabled = false;
                    return false;
                }
            }
            var e = new pc.Vec3, i = this.currentCamera, a = this.app.graphicsDevice.maxPixelRatio, s = this.screenEntity.screen.scale, n = this.app.graphicsDevice;
            if (e.x > 0 && e.x < this.app.graphicsDevice.width && e.y > 0 && e.y < this.app.graphicsDevice.height && e.z > 0) {
                i.worldToScreen(this.headPoint.getPosition(), e),
                    e.x *= a,
                    e.y *= a,
                    this.labelEntity.setLocalPosition(e.x / s, (n.height - e.y) / s, 0),
                    this.labelEntity.enabled = !0;
            }
            else {
                i.worldToScreen(this.headPoint.getPosition(), e),
                    e.x *= a,
                    e.y *= a,
                    this.labelEntity.enabled = !1;
            }
        };
    };
    ReVenge.prototype.tick = function () {
        if (!this.settings.aimBot)
            return;
        var pc = window['pc'];
        var closest;
        var closestDistance;
        var players = this.networkManager.players;
        var self = this.movement.entity;
        var selfPosition = self.getPosition();
        selfPosition.y += self.collision.height;
        for (var playerIndex = 0; playerIndex < players.length; playerIndex++) {
            var player = players[playerIndex];
            var distanceToSelf = this.getDistanceSq(player.position, selfPosition);
            if (!this.isValid(player))
                continue;
            if (!closestDistance || distanceToSelf < closestDistance) {
                closest = player;
                closestDistance = distanceToSelf;
            }
        }
        if (closest == undefined) {
            return;
        }
        var rayResult = pc.app.systems.rigidbody
            .raycastAll(selfPosition, closest.position)
            .map(function (result) { return result.entity.tags._list.toString(); });
        var Utils = window['Utils'];
        var rayCheck = rayResult.length == 1 && rayResult[0] === 'Player';
        if (closest && rayCheck && this.isValid(closest)) {
            var xRadians = Utils.lookAt(closest.position.x, closest.position.z, selfPosition.x, selfPosition.z);
            this.movement.lookX = this.radToDeg(xRadians) + Math.random() / 10 - Math.random() / 10;
            var closestPosition = closest.position;
            closestPosition.y += closest.collision.height;
            this.movement.lookY = -1 * this.radToDeg(this.getVerticalDistance(closestPosition, selfPosition));
            this.movement.leftMouse = true;
            if (this.settings.spotOn) {
                this.movement.currentWeapon.recoil = this.movement.currentWeapon.spread = 0;
            }
            this.movement.setShooting(this.movement.lastDelta);
        }
        else {
            this.movement.leftMouse = false;
        }
    };
    ReVenge.prototype.isValid = function (enemy) {
        var pc = window['pc'];
        // Alive check
        if (enemy.script.enemy.health <= 0 || !enemy.collision.enabled || enemy.script.enemy.isDeath)
            return false;
        // Team check
        if (pc.currentMode == "TDM" || pc.currentMode == "PLAYLOAD") {
            if (pc.currentTeam == enemy.team) {
                return false;
            }
        }
        return true;
    };
    ReVenge.prototype.postTick = function () {
        if (this.settings.infAmmo) {
            this.movement.setAmmoFull();
            this.movement.isHitting = false;
        }
        if (this.settings.infJump) {
            this.movement.isLanded = true;
            this.movement.bounceJumpTime = 0;
            this.movement.isJumping = false;
        }
    };
    ReVenge.prototype.getVerticalDistance = function (target, self) {
        var yDiff = Math.abs(target.y - self.y);
        var xDiff = Math.sqrt(this.getDistanceSq(target, self));
        return Math.asin(yDiff / xDiff) * (target.y > self.y ? -1 : 1);
    };
    ReVenge.prototype.getDistanceSq = function (target, self) {
        var xDiff = target.x - self.x;
        var yDiff = target.y - self.y;
        var zDiff = target.z - self.z;
        return xDiff * xDiff + yDiff * yDiff + zDiff * zDiff;
    };
    ReVenge.prototype.radToDeg = function (radians) {
        return radians * 57.29577951308232;
    };
    return ReVenge;
}());
window['revenge'] = new ReVenge();
