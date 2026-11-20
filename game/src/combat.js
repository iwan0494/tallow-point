// combat.js — punch + shoot. Shooting raycasts from the camera through the
// mouse point; hitting a cop raises wanted, hitting a ped scares them.
// Damage, armor and the DEAD state live here. Classic script, TP.
window.TP = window.TP || {};
(function (TP) {
  'use strict';

  function createCombat(scene, camera) {
    var raycaster = new THREE.Raycaster();
    var health = 100;
    var armor = 0;
    var dead = false;
    var shootCooldown = 0;

    function shoot(mouse, targets, onHit) {
      if (shootCooldown > 0 || dead) return false;
      shootCooldown = 0.28;
      var ndc = new THREE.Vector2(
        (mouse.x / window.innerWidth) * 2 - 1,
        -(mouse.y / window.innerHeight) * 2 + 1
      );
      raycaster.setFromCamera(ndc, camera);
      var meshes = [];
      targets.forEach(function (t) {
        if (t.mesh) meshes.push(t.mesh);
      });
      var hits = raycaster.intersectObjects(meshes, true);
      if (hits.length > 0) {
        var hit = hits[0];
        var obj = hit.object;
        while (obj && !obj.userData.owner) obj = obj.parent;
        if (onHit) onHit(obj ? obj.userData.owner : null, hit.point);
        return true;
      }
      return false;
    }

    function punch(nearby, onHit) {
      if (dead) return false;
      var hitAny = false;
      nearby.forEach(function (t) {
        if (t.pos && t._hit) return;
        if (onHit) onHit(t);
        hitAny = true;
      });
      return hitAny;
    }

    function damage(amount) {
      if (dead) return;
      var absorbed = Math.min(armor, amount);
      armor -= absorbed;
      health -= (amount - absorbed);
      if (health <= 0) { health = 0; dead = true; }
    }

    function heal(amount) { health = Math.min(100, health + amount); }
    function addArmor(amount) { armor = Math.min(100, armor + amount); }

    function respawn() {
      health = 100; armor = 0; dead = false;
    }

    function update(dt) {
      if (shootCooldown > 0) shootCooldown -= dt;
    }

    return {
      shoot: shoot, punch: punch, damage: damage, heal: heal,
      addArmor: addArmor, respawn: respawn, update: update,
      get health() { return health; },
      get armor() { return armor; },
      get dead() { return dead; },
    };
  }

  TP.Combat = { create: createCombat };
})(window.TP);
