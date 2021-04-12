interface Position {
    x: number;
    y: number;
    z: number;
}

interface NetworkManager {
    players: Array<Enemy>;
}

interface CollisionBox {
    height: number;
    enabled: boolean;
}

interface Entity {
    enabled: boolean
    collision: CollisionBox;

    getPosition(): Position;
}

interface Enemy extends Entity {
    playerId: string;
    username: string;
    team: string;
    weapon: string;
    position: Position;
    isActivated: boolean;
    health: number; //100
    isDeath: boolean;
}

interface Weapon {
    recoil: number;
    spread: number;
}

interface Movement {
    isHitting: boolean;
    isLanded: boolean;
    bounceJumpTime: number;
    isJumping: boolean;
    entity: Entity;
    lookX: number;
    lookY: number;
    leftMouse: boolean;
    currentWeapon: Weapon;
    lastDelta: number;

    setShooting(delta: number);

    setAmmoFull();
}

class ReVenge {
    networkManager: NetworkManager;
    movement: Movement;
    settings = {
        aimBot: true,
        infAmmo: true,
        infJump: true,
        spotOn: true,
        // fly: false
    }
    playerData: object

    constructor() {
        console.log('ReVenge Startup');
        this.insertHooks();
        this.overlay();
    }

    overlay() {
        const overlayElement = document.createElement('div');
        overlayElement.style.position = 'fixed';
        overlayElement.style.left = '0';
        overlayElement.style.top = '0';
        overlayElement.style.width = '100px';
        for (let settingsKey in this.settings) {
            const toggleElement = document.createElement('button');
            toggleElement.textContent = 'Toggle ' + settingsKey;
            toggleElement.onclick = () => {
                this.settings[settingsKey] = !this.settings[settingsKey];
            }
            overlayElement.appendChild(toggleElement);
        }
        document.body.appendChild(overlayElement);
        console.log('Inserted UI');
    }

    insertHooks() {
        const _this = this;
        const NetworkManager = window['NetworkManager'];
        const _initialize = NetworkManager.prototype.initialize;
        NetworkManager.prototype.initialize = function () {
            _this.networkManager = this;
            console.log('Hooked Network');
            _initialize.call(this);
        }

        const VengeGuard = window['VengeGuard']
        VengeGuard.prototype.onCheck = function () {
            this.app.fire('Network:Guard', 1); // Send the all clear to the AC
        }
        console.log('Hooked AC')

        const Movement = window['Movement'];
        const _update = Movement.prototype.update;
        Movement.prototype.update = function (t) {
            if (!_this.movement) {
                _this.movement = this;
                console.log('Hooked Movement');
            }
            _this.tick();
            _update.apply(this, [t])
            _this.postTick();
        }
    }

    tick() {
        if (!this.settings.aimBot) return;

        const pc = window['pc'];

        let closest: Enemy
        let closestDistance: number;
        const players = this.networkManager.players;

        const self: Entity = this.movement.entity;
        const selfPosition: Position = self.getPosition();

        selfPosition.y += self.collision.height;

        for (let playerIndex = 0; playerIndex < players.length; playerIndex++) {
            const player: Enemy = players[playerIndex];
            const distanceToSelf = this.getDistanceSq(player.position, selfPosition);
            if (!this.isValid(player)) continue;
            if (!closestDistance || distanceToSelf < closestDistance) {
                closest = player
                closestDistance = distanceToSelf;
            }
        }

        if (closest == undefined) {
            return;
        }

        const rayResult = pc.app.systems.rigidbody
            .raycastAll(selfPosition, closest.position)
            .map(result => result.entity.tags._list.toString());
        const Utils = window['Utils'];
        const rayCheck = rayResult.length == 1 && rayResult[0] === 'Player';
        if (closest && rayCheck && this.isValid(closest)) {
            const xRadians = Utils.lookAt(
                closest.position.x,
                closest.position.z,
                selfPosition.x,
                selfPosition.z
            );
            this.movement.lookX = this.radToDeg(xRadians) + Math.random() / 10 - Math.random() / 10;
            const closestPosition = closest.position;
            closestPosition.y += closest.collision.height;
            this.movement.lookY = -1 * this.radToDeg(this.getHorizontalDirection(closestPosition, selfPosition))
            this.movement.leftMouse = true;
            if (this.settings.spotOn) {
                this.movement.currentWeapon.recoil = this.movement.currentWeapon.spread = 0;
            }
            this.movement.setShooting(this.movement.lastDelta);
        } else {
            this.movement.leftMouse = false;
        }
    }

    isValid(enemy: Enemy) {
        const pc = window['pc'];
        // Alive check
        if (enemy.health <= 0 || !enemy.collision.enabled || enemy.isDeath) return false;
        // Team check
        if (pc.currentMode == "TDM" || pc.currentMode == "PLAYLOAD") {
            if (pc.currentTeam == enemy.team) {
                return false;
            }
        }
        return true;
    }

    postTick() {
        if (this.settings.infAmmo) {
            this.movement.setAmmoFull();
            this.movement.isHitting = false;
        }
        if (this.settings.infJump) {
            this.movement.isLanded = true;
            this.movement.bounceJumpTime = 0;
            this.movement.isJumping = false;
        }
    }

    getHorizontalDirection(target: Position, self: Position): number {
        const yDiff = Math.abs(target.y - self.y)
        const xDiff = Math.sqrt(this.getDistanceSq(target, self))
        return Math.asin(yDiff / xDiff) * (target.y > self.y ? -1 : 1)
    }

    getDistanceSq(target: Position, self: Position): number {
        const xDiff = target.x - self.x
        const yDiff = target.y - self.y
        const zDiff = target.z - self.z
        return xDiff * xDiff + yDiff * yDiff + zDiff * zDiff
    }

    radToDeg(radians: number): number {
        return radians * 57.29577951308232
    }

}

window['revenge'] = new ReVenge();