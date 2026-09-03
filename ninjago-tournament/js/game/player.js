/* ============================================================
   NT.PlayerController — touch joystick + buttons + keyboard →
   fighter actions. Multitouch: move & attack simultaneously.
   ============================================================ */
NT.PlayerController = class PlayerController {
  constructor(fighter, hud) {
    this.f = fighter; this.hud = hud;
    this.flickT = 0; this.lastFlick = 0; this.blockKey = false;
  }
  update(dt, world) {
    const f = this.f; if (!f) return;
    const In = NT.Input; const joy = this.hud.joystick;
    let mx = 0, mz = 0;
    if (joy.active && joy.mag > 0.12) { mx = joy.dx; mz = joy.dy; }
    else { const k = In.keyAxis(); if (k.active) { mx = k.x; mz = k.y; } }
    f.moveInput.x = mx; f.moveInput.z = mz;
    // joystick flick → dodge
    if (joy.flick) { joy.flick = false; f.moveInput.x = joy.flickX; f.moveInput.z = joy.flickY; f.tryAttack(world, 'dodge'); }
    // keyboard actions (edge-triggered)
    if (In.consumePressed('KeyJ') || In.consumePressed('KeyZ') || In.consumePressed('Enter')) this.press('attack', world);
    if (In.consumePressed('KeyK') || In.consumePressed('KeyX')) this.press('kick', world);
    if (In.consumePressed('KeyL') || In.consumePressed('KeyC')) this.press('jumpslam', world);
    if (In.consumePressed('Space')) this.press('special', world);
    if (In.consumePressed('ShiftLeft') || In.consumePressed('ShiftRight') || In.consumePressed('KeyV')) this.press('dodge', world);
    const blockKey = In.isDown('KeyU') || In.isDown('KeyB') || In.isDown('ControlLeft');
    const blockBtn = this.hud.held.block;
    f.setBlock(blockKey || blockBtn, world);
  }
  press(action, world) {
    const f = this.f; if (!f || f.dead) return;
    switch (action) {
      case 'attack': f.tryAttack(world, 'light'); break;
      case 'kick': f.tryAttack(world, 'kick'); break;
      case 'jumpslam': f.tryAttack(world, 'jumpslam'); break;
      case 'special': f.tryAttack(world, 'special'); break;
      case 'dodge': f.tryAttack(world, 'dodge'); break;
    }
  }
};
