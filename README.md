# Kinetic — Combat Lab

A buildless WebGL combat prototype for experimenting with hand-to-hand combinations, wrestling, elastic powers, active ragdolls, balloon rolling, wind, lightning, water, earth and fire powers, cover and peeking, five-wave runs, mobile touch controls, melee weapons, pulse gunplay, optional Easy combo controls, group sparring, and physical environments. Open the hosted Site to play; the checkout deploys the static `dist/` directory.

## Playground

- **Courtyard:** stone training court, planting, benches, chairs, breakable dividers, and a swing bag.
- **Freight depot:** cargo containers, loading scenery, loose crates, tyres, cones, and two swing bags.
- **Rooftop dojo:** city backdrop, vents, rails, spring pads, and open elastic lines.
- **Street yard:** parked cars with separate cabin and body collision, concrete barriers, stone planters, street lighting and garage scenery.
- **Foundry:** working conveyor lanes, reversible machinery, timed air vents, cargo carts, breakable glass cover, and elastic rebound pads inside a steel workshop.

The center of every layout is reserved for the authored combo routes. Static scenery is merged into color batches. Full and Lean detail modes share the same physical arena and objects; Lean omits background decoration and caps rendering resolution.

Spring pads launch both fighters, loose objects, and the balloon form. Anchored swing bags keep their rope length and transfer momentum into bodies. Benches and wood dividers can break under strikes, throws, projectiles, and balloon impacts. Expired debris is removed.

In the Foundry, Y near a control post cycles forward, reverse, and off. Belts carry grounded fighters and loose cargo without splitting clinches or moving committed throws. Vents warn in amber before a blue blast lifts bodies and props; heavier bodies launch lower. Carts retain momentum on wheels but cannot be equipped by either side. Glass blocks strikes until it breaks. Rebound pads turn a recently knocked body into an airborne follow-up. The Springs & machinery option disables powered interactions. Cargo damage requires physical contact; neutral machinery does not award the player a hit.

Four environment trials stage glass breaks, cargo bowling, vent flight, and rebound follow-ups. Each uses a 60-second simulation clock, normal speed, active machinery, a passive partner, and infinite stamina. Goals require actual breaks and contacts. Best times persist locally and remain separate for Manual and each Easy style. R or Retry restores the setup; Free play removes the clock and retains the scene. Changing arena, mode, or combo assistance leaves the trial. Manual rebound uses L → K, then J after the bounce; Easy / Mixed can tap J through the whole sequence.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows | Camera-relative movement; steer during a jump or while inflated |
| J / K / L | Punch / kick / heavy; contextual air, clinch, and floor follow-ups |
| I / E | Launch / grab or throw |
| U | Jump; release a scenery anchor with lift |
| Hold Q / Ctrl | Duck under high attacks; Q retains grip changes in a clinch and mount near a downed target |
| Z / X / V | Elastic punch / whip kick / reel-in grab |
| H | Gale palm; H again lifts; third H makes a cyclone; H then K pulls, H then E dashes, H then L slams (Manual) |
| T | Cycle targets in Group lab; target cards also select opponents |
| Y | Use a nearby Foundry switch: forward → reverse → off |
| G | Ground gust step or one airborne wind redirect per flight; preserves a connected chain |
| N | Reload a held pulse blaster |
| O / P / M | Chain spark / rising voltage / thunderclap (shared focus) |
| F / B | Pick up or drop / stretch-fetch on the ground; B attaches or releases a scenery anchor in the air |
| C | Inflate or unroll |
| J / Space or K / L while inflated | Burst roll / bounce / belly drop |
| O while inflated | Charge the next body collision or belly drop |
| H / I / E / Z / X / V while inflated | Unroll into the corresponding combat move |
| Shift | Guard or parry; brake while inflated |
| Space | Directional evade; air evade / timed landing recovery; release or resist a hold |
| R / Esc | Reset current arena or retry the active trial / pause |
| Drag / scroll / pinch | Orbit and tilt / preferred zoom / touch zoom |

When an object is equipped, J and L swing it, Z extends the swing, E throws it, and V adds elastic power. K and I retain their kicking and launching roles. Attack inputs buffer up to four follow-ups.

## Weapon lab and power flow

Training batons, staffs and pulse blasters lie around every arena. Weapon lab buttons stage a fresh passive practice setup with the selected weapon equipped. Batons alternate a fast diagonal and return swing; staffs alternate thrust and sweep, launch with I, and drop an overhead with L. Z extends either weapon. Both keep kicks, throws, durability, physical pickup and disarming.

With a blaster, J fires a travelling pulse, K kicks, L strikes at close range, Z spends two rounds and 20 wind on a lifting shot, and N reloads the six-round magazine. Reloading takes 0.78 seconds before ammunition returns and can be interrupted by damage or dropping the gun. Ammo persists when a dropped blaster is recovered. Shots capture aim during wind-up, use swept contacts against cover and opponents, and stop at their first contact. Destroying glass opens the path for a later shot. Free aim follows facing; locked aim follows the selected opponent at wind-up. Held guard reduces damage; a timed guard can reflect one pulse into its shooter; dodges can avoid it. Charged shots and shots fired while airborne can mix into physical air attacks. Easy controls reload empty blasters and mix in close kicks. The Pulse rival starts armed in sparring, keeps shooting distance, and reloads between magazines. Difficulty applies once to its shot damage.

Gust step costs 18 wind and 8 stamina when resources are finite, has a 0.65-second cooldown, and retains the combo plus buffered follow-ups. It moves continuously against arena collisions. It can cancel a connected strike, but cannot cancel startup, a miss, a grip, a committed throw, or a reload. Inputs can queue during the step. Twelve new routes connect wind, ordinary strikes and elastic limbs: H → X lifts with the Tempest wheel kick; Z → H → X → J → K → L ends in a rubber axe drop; X → Z → I compresses the arm into a coil spring launcher. A direct Tempest button is also available. The library now contains 238 routes.

Eight transparent atlas sprites distinguish impacts, slash arcs, wind, muzzle flashes, dust, guard contacts, elastic coils and shot sparks. They use world contact positions projected onto the effects canvas, expire quickly, and are capped at 64 live sprites (24 rendered in Lean). The impact option disables them. Pulse tracers use world geometry so cover occludes them. Recoil, reload poses, opposite baton returns, staff grip placement and elastic axe-leg curves supplement the character animations.

## Wave runs and results

Start wave run launches five finite-resource encounters at the selected difficulty. The first wave has two enemies; later waves use the configured group count. Health carries across waves. After clearing waves one through four, choose one: recover up to 50 health, improve air rhythm, improve wind control, or improve balloon handling. Air ranks reduce air-move stamina costs by 10% per rank and add lift/juggle hang time. Wind ranks reduce focus costs by 12% per rank and widen control areas. Balloon ranks improve steering/braking and reduce burst pressure cost. Each perk caps at rank three; all perks reset with the run. Stamina and focus refill between waves. R and normal arena/mode resets leave the run; use Restart run to begin another five-wave attempt.

Completing wave five, being defeated, or ending the run opens results: longest actual hit chain, environmental knockouts, health lost, style score, waves cleared, and unique moves. A health-delta ledger counts damage actually lost, including lethal hits and self-inflicted object damage. It excludes healing. Environmental knockout credit requires the final damaging contact to be a player-attributed wall, table, barrier, object, body or bumper impact. Direct wind, lightning and ordinary strikes do not inherit an earlier environment tag. Style awards fresh move families and varied connected attacks, reduces returns from repetition, adds environmental finishes and parries, and subtracts damage taken. Misses, zero-damage transitions and self-hits award no style. Results are local to the current run, with no global leaderboard.

## Lightning

O casts Chain spark: a captured forward aim, one primary contact, then up to two nearby, diminishing jumps (18 / 11 / 7 damage). P casts Rising voltage to launch a target into an air route. M casts Thunderclap for a close radial knockdown or aerial slam. These cost 20 / 25 / 38 shared focus and respect cover, guard, active dodges and actual distance. Focus does not regenerate during either wind or lightning animations. Arcs use swept solid checks and terminate at cover; visual traces are bounded to 32 and expire quickly. Lightning lab places three close practice targets. Six authored routes mix lightning with hands, elastic reach, clinches, wind, and air juggles.

## Mobile web controls

Touch screens expose Fight, Powers, and Tools banks next to the movement pad. Fight contains punches, kicks, heavy strikes, launch, grab and grip switching. Powers contains every elastic, wind, balloon and lightning action. Tools includes pickup/drop, stretch fetch, reload, target switching, gust step, machinery, zoom and center view. Fight labels change to burst, bounce and belly drop while inflated. Hold movement and an attack with separate fingers; Easy combos also supports holding Punch. Block/parry and dodge remain available beneath every bank. Drag the arena to orbit/tilt and pinch to set preferred zoom; automatic framing keeps room for airborne bodies. Very narrow screens use fewer columns, with scrollable control areas in the expanded view. Fresh touch devices default to Lean detail; stored detail preferences are respected. Native choice/results dialogs trap focus, scroll within the viewport and pause combat while open.

## Easy combo controls

Manual is the default. Easy combos maps J to an adaptive mixed chain, K to an air setup/juggle, and L to a finisher. Repeated J taps, or holding J in the interface, can move through hands, feet, air, floor follow-ups, stand-up clinches and throws. Mixed flow, Wind & air, and Wrestling provide different emphases. Each accepted tap requests one move; at most two assisted inputs queue ahead. Requests read the current target and context when they execute. Throws and slams get room to land; stamina, wind energy, contact, guard, cover, and targeting still apply. Low wind energy falls back to ordinary attacks. Balloons keep their original controls, and the Watch action demonstrates literal authored inputs in either mode. Switching control mode clears pending assistance.

The PRESSED history records the requested keys immediately, including buffered taps. It does not substitute the shortcut of a move chosen by assistance. The move readout labels an assisted action separately, for example K → ASSIST: GALE PALM; the K control also receives the visual highlight. Watching a demo does not inject fake pressed keys.

## Partners and practice

Sparring offers an All-rounder, Boxer, Kickboxer, Wrestler, Elastic rival, Scavenger, and Pulse rival, with four difficulty levels. Easy is the default; Gentle reduces damage to 40%, allows at most two attacks per string, and disables grabs and ground attacks. Easy uses 62% damage, three attacks, and no ground follow-ups. Normal uses 82% damage and four attacks; Hard uses full damage and up to six attacks. Lower settings also slow reactions and wind-ups. Enemy health does not rise between rounds. Their plans share the combat rules used by the player. Defensive reactions begin after observing a visible wind-up; sidesteps spend stamina and have a cooldown. Scavengers move to loose props and play the same pickup and release animations.

Group lab offers two or three opponents with still, moving, and live behavior. Still targets wait; moving targets circle and defend without attacking. Live groups keep one attack turn while other enemies flank and seek nearby usable objects. A teammate may approach a player-owned clinch, telegraph a rescue, and attempt one real kick. Only a damaging contact breaks the grip; committing to a throw cancels the pending rescue. Defensive reactions can sidestep visible wind and lightning wind-ups after the selected difficulty delay. Runners are quick and light; bruisers are slow and heavy; grapplers close into wrestling; long-reach rivals use elastic attacks. Variant mass changes knockback, lift, balloon impacts, and body collisions. T switches the next move’s target without redirecting a strike already in progress. A single knockout leaves the other opponents in play; clearing the group starts the next wave.

Wind uses an aimed cone for gale and sky current, and a captured location for updraft, downburst, vacuum pull and cyclone. In Manual, H → K pulls a cluster closer, H → E dashes into a palm strike, and H → H → H creates a cyclone. The direct Pull, Air dash and Cyclone buttons work in both control modes. The dash moves gradually, stops at solids and loses its drive if interrupted. Cyclones last 0.95 seconds, gather bodies and loose props, use at most three low-damage ticks per body, respect cover and held pairs, and cannot stack for one caster. L collapses an existing cyclone into a downburst. Solid cover blocks it. It moves props and bags, with mass-dependent impulses and lift; moving objects can produce subsequent physical contacts. Wind energy costs 18–32 per cast and regenerates at 13 per second between wind and lightning animations. Infinite stamina also grants infinite focus. Nineteen wind routes are included in the 238-route library. The wind lab gathers three targets and a crate for experimentation.

Free practice includes passive, guarding, footwork, parry, and combo/impact partners. Footwork practice moves and defends without attacking. Practice speed can be reduced to 0.75× or 0.5×. Eight challenge setups introduce the interactions. Arena/style/difficulty/group changes start a fresh round; interface preferences are stored locally in the browser.

## Source map

| File | Responsibility |
| --- | --- |
| `dist/arenas.js` | Arena definitions and prop placement |
| `dist/yard.js` | Object simulation, springs, bag constraints, collisions, and challenge setups |
| `dist/gadgets.js` | Conveyor forces, switch state, vent timing, launch cooldowns, and machinery ownership |
| `dist/trials.js` | Staged environment trials, real-contact goals, clocks, retries, and local best times |
| `dist/run.js` | Five-wave state, health carry-over, upgrades, attribution and style results |
| `dist/team.js` | Flank positions, fair rescue attempts and group object seeking |
| `dist/lightning.js` | Captured electric casts, swept cover checks, bounded chains and traces |
| `dist/interface.js` | Run dialogs, touch banks, follow-up prompts, balance HUDs and camera gestures |
| `dist/flow.js` | Balance breaks, power marks and links, charge pulses, targeting and contextual opportunities |
| `dist/combat.js` | Combat state, combo routes, grips, throws, damage, and lifecycle |
| `dist/opponent.js` | Sparring decisions, footwork, defenses, styles, and object use |
| `dist/balloon.js` | Inflation, rolling contacts, bouncing, bursting, and unroll follow-ups |
| `dist/wind.js` | Aimed wind contacts, vacuum pull, slipstream dash, cyclone fields, prop impulses, and practice setup |
| `dist/assist.js` | Context-sensitive, bounded, one-request-per-tap assistance |
| `dist/arsenal.js` | Weapon move sets, ammunition, reloads, swept pulse contacts, reflection, and loadout setups |
| `dist/fx.js` / `dist/combat-sprites.svg` | Bounded screen sprites, contact effects, and a transparent eight-cell atlas |
| `dist/physics.js` | Active-ragdoll joints, constraints, contacts, and recovery |
| `dist/wrestling.js` | Shared grip anchors, carry offsets, and paired body-volume constraints |
| `dist/camera.js` | Body-aware action framing, air anticipation, safe margins, orbit and tilt |
| `dist/motion.js` | Travel-driven gait, planted support feet, weight transfer, regional reactions, and inertial pose blending |
| `dist/scenery.js` | Arena art and cached static geometry |
| `dist/render.js` | WebGL meshes, procedural animation, camera, and effects |
| `dist/app.js` | Input, interface, preferences, coaching, and session feedback |

## Character rendering and contact fixes

Full detail uses a 64 × 40 torso (5,248 triangles), 56 × 40 head (4,480), and 48 × 28 limb sections (2,784 each). Upper arms, forearms, thighs and calves have separate tapered muscle profiles. Gloves and shoes use 40 × 28 segments; thumbs, collar connections and corrected surface normals improve the silhouette. Mesh data is generated once and shared. Lean substitutes simple limb and round meshes while retaining the same motion, contacts and actors. The increased geometry does not change bone lengths or combat ranges.

The torso follows a four-control-point spine curve with distributed twist. Movement uses actual travel distance for gait phase, alternating world-space foot plants, bent support knees, pelvis sway and counter motion in the upper body. Strike envelopes include compression, acceleration, contact and follow-through. New poses inherit decaying offsets and velocity from the previous pose. Head, body and leg hits have different recoil and balance changes. Kick support feet and throwers' feet can stay planted while the free limbs move. Final grip IK follows both physical rigs during a paired move. Motion study replays boxing, kicking, a German suplex, a scoop body slam, an air juggle, or incoming player combinations at 0.75× speed.

Active ragdolls share mass-sensitive impulses and angular reactions across every fighter. Uncontrolled airborne victims tilt, roll, trail their arms and fold their legs. Grounded bodies use gravity, joint-length and bend constraints, broader self contacts, mid-limb cover contacts, floor friction, and low-energy sleep. Falling bodies can contact other fighters without disturbing controlled pairs. Head and torso muscles soften briefly after a hit. Recovery blends from the settled pose through a lower stance over 0.72 seconds; a new attack can bring control back sooner. Floor constraints take priority when a prop would otherwise push a joint below ground.

Throws sample their landing pose at contact, release the target into physical ground reaction on impact, and let the thrower blend back up independently. Buffered follow-ups retain their existing timing. Unrolling from balloon form into a nearby launcher can take a short continuous entry step when the physical knockback leaves the target just outside ordinary range; cover and movement collision still apply.

Wrestling uses named, persistent left/right body anchors shared by root-path correction and final hand IK. Carry offsets move bodies onto a hip or shoulder, while torso and head contact constraints prevent them passing through the holder. The paired core follows the authored path, with free limbs retaining secondary motion. Hands release progressively near the landing, and the held legs fold after the lift begins. Sweeps free the reaping foot. Rotating body colliders follow the actual pelvis/chest/head heights when they meet cover. Mounted pairs are exempt from normal fighter spacing and move together against scenery; the mounted pelvis stays under control while upper-body reactions remain physical. Mounted punches lower the torso and aim at the actual body surface.

The action camera runs after the final physical rigs and grips. It fits padded heads, feet, body joints, balloon extents and elastic curves into a safe area beneath the HUD. Upward velocity adds room ahead of a rising fighter. The view lowers its elevation for air action, responds to current body bounds when pulling back, and returns gradually after landing. Framing is recalculated for the current orbit, tilt and aspect ratio, including portrait views and groups. Drag horizontally to orbit, vertically to tilt, or scroll to set the preferred zoom; automatic framing can pull back farther to keep the action visible. Center camera resets orbit, tilt and framing.

Coincident fighter roots now separate deterministically. Bystanders resolve contact against the entire clinched pair, preserving the owner-to-target offset. Environmental interruptions cancel dash drive as well as its action.

## Validation

Run the relevant checks with Node; there are no installation or build steps:

```sh
node scripts/verify.cjs
node scripts/verify-yard.cjs
node scripts/verify-balloon.cjs
node scripts/verify-playground.cjs
node scripts/verify-group-wind.cjs
node scripts/verify-assist-storm.cjs
node scripts/verify-foundry.cjs
node scripts/verify-arsenal-flow.cjs
node scripts/verify-character-dynamics.cjs
node scripts/verify-pair-camera.cjs
node scripts/verify-waves-lightning.cjs
node scripts/verify-page.cjs
node scripts/verify-flow-fusion.cjs
node scripts/verify-motion.cjs
```

The page-entry suite loads the actual HTML and application scripts with a small DOM/renderer adapter. It checks continued frame scheduling, desktop and touch attack captions, physical keys, touch movement and powers, context transitions, wave choices/results, saved Easy controls, and pause/resume. It reproduces the V14 first-frame failure caused by a plain-text touch button lacking the nested caption expected by the old label updater. This suite does not verify browser layout or GPU rendering.

The suites cover the authored routes, object and environment interactions, opponent decisions, grips and escapes, resets, balloon behavior, group attack coordination and target changes, difficulty damage limits, wind cover and energy, assistance queues and stamina, dash interruption, cyclone lifetime and tick limits, character topology, ragdoll motion, and finite animation transforms. Foundry coverage includes both belt directions and off states, cargo attribution, per-body vent cooldowns, held-pair constraints, actual glass and rebound impacts, all four trials in Manual and Easy / Mixed, timeout and retry behavior, record validation, and the distinction between pressed inputs and selected actions. Arsenal coverage includes all new routes at 30/120 fps, weapon mixing and reach, projectile travel and misses, first-contact cover, glass destruction, ammo, reload interruption, charged launch shots, shot blocks and reflections, dodges, automatic reload, enemy difficulty, gust cancel restrictions, reset, and bounded sprite lifetimes. Character dynamics checks cover denser anatomy and normals, support-foot drift, strike timing, distinct hit zones, mass-sensitive impulses, airborne tilt, settled sleep at 30/60/120 fps, wake-up, shared player/enemy rules, recovery, mid-limb cover, floor priority, body contacts, curved skin, elastic attachment, transition displacement, throw grips and release, reset, and the Full/Lean geometry difference. Pair/camera checks cover all eleven throw types, fixed grip assignments, actual hand contact and torso separation, enemy-owned throws at four orientations, the free sweeping leg, centered mounts and ground-strike contact, paired scenery movement, a Foundry cover interaction, high juggles across five aspect ratios and multiple orbits, sudden launches/resizes, return zoom, live elastic/group framing, and manual tilt. Wave/lightning/touch checks cover run lifecycle, finite resources, health carry-over, heal/perk ranks, five-wave completion, actual damage and final-contact KO credit, style variety, self-hit exclusion, electric cover/guard/dodge contacts, route mixing, effects/reset bounds, exclusive team turns, telegraphed rescues and throw protection, visible power reactions, non-scavenger object use, all touch actions, original physical key bindings, pinch/orbit/tilt bounds, and finite electric/group rigs. The motion suite also accepts `--throws` to recheck paired routes after a targeted contact change. Renderer adapters exercise the real pose and mesh math without a browser or GPU; they do not verify shader compilation, frame rate, browser layout, or subjective game feel.


## Reactive combat, balance and linked powers (V16)

Successful contacts build balance pressure. Leg attacks, heavy strikes and environmental collisions produce more pressure; mass resists it and repeatedly using the same move becomes less effective. Guards receive reduced pressure, while whiffs, dodges and parries award none. Pressure decays after 1.7 seconds without a hit. A full meter opens a 1.8-second stagger. A throw started during that opening consumes it for 22% extra landing damage. A recovery interval prevents repeated balance stun locks. Both player and enemies use these rules; resets and wave transitions clear them.

Eight reaction profiles distinguish taps, heavy strikes, body folds, leg buckles, launches, slams, wind and electricity. Joint impulses remain mass dependent. Leg reactions release the affected support foot; recovery braces the hands and brings a knee underneath the body. Clinch regrips blend their attachment anchors and spacing for 0.24 seconds. Throw entries blend from the existing grip over the first 18% of the lift, while loaded throws keep fixed hand assignments and account for both partners' body sizes.

Power links require actual, unguarded contacts and have short, caster-specific windows:

- Storm relay: wind contact followed by an aerial lightning hit adds 5 damage and sustains lift.
- Conductive coil: reel an electrified target within 4.2 seconds, then throw within the stored coil's 5.5-second window. A Storm slam costs 8 additional focus, adds 6 direct damage and sends a covered, dodgeable 10-damage pulse around the landing.
- Gale sling: wind contact followed by an elastic throw within 3.5 seconds costs 8 additional focus, adds 6 damage and releases the target with mass-sensitive launch momentum.
- Charged roll: while inflated, O / Chain spark charges the balloon for 20 focus and 8 stamina. The charge lasts up to six seconds without leaving balloon form. The next actual body collision releases one 8-damage electric pulse; a belly drop instead releases Thunder belly for 10. Cover, held bodies, guard and active dodge checks apply. P / Rising voltage still unrolls into an electric launcher.

Six Fusion routes demonstrate the linked attacks. Easy combos now offers Power fusion: tapping or holding Punch chooses wind, lightning, catches and throws from current context. Depleted focus falls back to ordinary strikes, and remote targets prompt a reel. Assisted short entries advance continuously and respect cover. A single tap still requests a single move.

Auto target selects a reachable, visible partner between actions, keeps an active juggle, and never splits a hold or redirects a strike already in progress. Explicit target selection is respected for 1.2 seconds. The toggle is saved with other preferences. The follow-up bar offers three contextual actions for standing, airborne, grounded, grabbed and balloon states. These buttons perform the labeled action directly even in Easy mode, and disable for obvious distance, focus, pause or full-queue restrictions. Balance meters, power-link cues and charge effects explain the active opening on desktop and mobile.

The flow/fusion suite checks authoritative pressure, misses/blocks/parries, timed breaks and throw consumption, mass/repetition/decay, caster ownership and expiry, cover/dodge/held-body safety, charge costs and single discharge, all Fusion routes at 30/60/120 fps, real Easy-mode links and finite pools, target retention, resets, style attribution, larger paired rigs, regrip continuity and collision-aware assisted entries. The page suite also exercises literal follow-up buttons, balance HUDs, saved targeting preferences, pause and range restrictions with the real HTML and application scripts. The V19 browser checks below add actual shader output and mobile layout inspection; device performance and physical-device feel remain separate work.

## Shared character animation and geometric contact (V17)

The character pose now belongs to the combat simulation. `rig.js` supplies the shared articulated skeleton and two-bone arm/leg IK; `clips.js` adds anticipation, contact, follow-through and recovery key poses for hands, kicks, knees and elbows. Hermite interpolation carries motion through impact. The published IK pose feeds back into the inertial transition memory so a corrected wrist cannot snap back at the next action. The existing inertial transitions and planted support feet continue between clips. Clinch entry blends from the wrists that made contact into the grip, regrips keep their assigned anchors, and an air-to-floor follow-up settles the attacker before the strike reaches the grounded body.

Arms and legs use continuous, weighted two-bone skin meshes. The joint cross section rotates without collapsing when the elbow or knee bends. Sleeves and exposed arms share the same surface profile and deformation; Full and Lean both use the same skinning and skeleton, with different mesh density. Elastic knees have a folded lower-leg segment, and retracting powers retain the wrist/ankle attachment while blending into the next move.

`contact.js` sweeps the displayed fists, feet, knees, elbows, elastic curves and weapon shafts against moving body capsules. Head, torso, arms and legs are separate contact surfaces; an empty part of the old enclosing box cannot take damage. Ordinary strikes capture their aim rather than following a sidestep. Air attacks lead the tumbling body's physical position and align the attacker with its height. Longer assisted/floor entries take time to close the gap. A high guard must intercept with a glove or forearm; low kicks can reach a leg below it. Crossing weapon shafts can clash, spending stamina without applying body damage. Props and solid cover intercept the actual path, and a paired throw still applies its damage once on landing.

Physics and contact advance at a fixed 120 Hz, independent of render frequency. Ragdoll positions, airborne tilt, ground settling and recovery are authoritative in the world; rendering reads those poses without moving the fighter roots or advancing a second solver. Active poses seed the physical body for a subsequent fall. Impact location and contacted region feed the reaction, while sparks, sprites and damage numbers appear at the recorded surface point. Balloon unrolls and held-prop sockets use the same simulation state.

Startup modules are deferred once in dependency order, with versioned asset URLs. The page suite explicitly checks this browser loading contract as well as the live DOM/input flow. The additional `node scripts/verify-articulated-contact.cjs` suite checks geometric misses and hit regions, captured aim, guard interception and low openings, cover/glass, shaft clashes, extended weapons, multiple frame rates, deep skin bends, render/simulation agreement, elastic attachments, rendering independence during balloon/weapon use, and clean resets. The core route suite uses a 12-second budget per route and waits for the final action plus a post-completion interval, so it does not spend most of its time simulating an already completed demonstration.

The V17 verification used the actual simulation, HTML, script loading, mesh generation and renderer math with DOM/WebGL adapters. V19 adds live browser shader compilation and rendered pose inspection, described below.

## Live input playtest and Controls fix (V18)

The published V17 page was exercised with actual browser keyboard, click and emulated touch input. Observed simulation responses included a four-hit hand/kick mix, a German suplex, a five-hit air chain, elastic hands into a hip throw, wind and lightning lifts, a charged balloon collision into pop-up/air follow-ups, staff combinations, and six blaster shots followed by a full reload. Pause/resume, all four arena switches and return from run results to practice responded. Normal Easy/Gentle inputs cleared wave one, selected Air rhythm and entered wave two; the recorded retired-run result was an eight-hit longest chain, 29 damage taken, 13 unique moves and 476 style points. The other four waves were not completed in this browser session.

A 390×844 touch browser emulator showed no horizontal page overflow, six 61×47 combat buttons, working action banks, a three-hit punch/punch/kick chain, inflate/unroll and movement that stopped on touch cancellation. Both available browser environments reported WebGL unavailable, so these are live input/simulation and UI checks, not a visual playtest of the fighters. Shader output, throw alignment, camera framing, frame rate, animation feel and physical phone behavior still require a WebGL-capable browser/device.

Playtesting exposed a dropped first input immediately after closing Controls: native dialogs clear `open` before asynchronously delivering `close`, while the game previously waited for that event to restore pause. V18 restores pause synchronously on button, backdrop or Escape dismissal, consumes the saved state once, and ignores a stale close event after a newer pause or reopened dialog. The page suite models the delayed native event and verifies the first kick, preserved manual pause, repeated opening and later events, alongside the existing startup, touch, run and preference checks.

## Rendered WebGL playtest and expanded mobile layout (V19)

Chrome Headless Shell 151.0.7922.34 was installed in the test environment with ANGLE's Vulkan SwiftShader renderer. The published game compiled its real shaders and rendered the fighters, scenery, elastic meshes and effects. These checks used actual browser keyboard/touch events and controlled 30 fps render scheduling to inspect repeatable poses on the CPU renderer; WebGL itself was not stubbed.

Rendered samples covered the German suplex and scoop body slam through lift, rotation and landing. The sampled body-slam wrist-to-grip errors were at most 6.6 mm, with damage applied at landing. A five-hit launch/punch/punch/kick/heavy route dealt 86 damage, kept both complete rigs inside the portrait and landscape camera view at the sampled air peak, and returned both fighters to full ragdoll recovery after settling. Elastic punch and coiled hands, a wind lift into Chain spark across three targets, and a charged balloon collision also rendered with finite rig points, zero WebGL errors, and no JavaScript or failed asset requests in those checks. One earlier startup encountered a transient asset response and recovered on reload.

The visual playtest found that expanded touch mode left only about 139 px of arena in a 390×844 portrait viewport and 99 px in an 844×390 landscape viewport. Duplicate setup panels and large overlays squeezed and obscured the fighters. V19 hides those panels while expanded, retains Fight / Powers / Tools, bounds the scrolling control deck, and places compact HUDs along the arena edges. The same emulated viewports now provide about 517 px and 241 px of arena height. All three action banks were checked without horizontal overflow; attack and follow-up buttons retain at least 44 px height. Portrait and landscape air-chain captures used the candidate stylesheet against the actual WebGL game.

This verifies real shader output, sampled throw alignment, air framing, power effects and emulated touch layout. It does not establish hardware-accelerated frame rate, physical-phone input feel, every possible animation transition, or completion of all five waves.

## Player movement, defense and scenery traversal (V20)

U makes a player-controlled ballistic jump, with camera-relative steering and retained horizontal momentum. Ordinary jump attacks use the existing air moves without snapping to a standing target or refreshing lift on every button press. A grounded evade now chooses a forward slip, backstep or sidestep from the requested direction, with distinct travel, duration and posing. A separate air evasion is limited to one per flight.

Hold Q or Ctrl to duck. The shared visible/contact rig bends the knees and torso and lowers the head; committed high strikes stay high instead of tracking into the lowered head. Body and leg attacks still hit the actual crouching body. A clean high miss can create a short counter opening. Q continues to cycle grips and mount in its existing combat contexts. Touch duck releases on pointer-up, cancellation, lost capture, reset and pause.

A descending Space tap arms one 0.18-second recovery attempt per descent. A successful landing restores control quickly and opens a counter without refunding damage. An early attempt expires and cannot be repeatedly retried during the same descent. The cue runs every rendered frame. A tap near the floor prioritizes the breakfall instead of adding an air-evasion impulse that could spoil the landing. Normal jumps absorb the floor impact in a short knee bend. Controlled landings on static tables, benches and ledges retain a valid support surface, permit walking or jumping off, and fall normally if the support breaks or is left behind.

B in the air, or the dedicated Anchor button from either height, selects a visible pillar or wall within 8.5 metres in the movement/facing direction. A visible marker shows the candidate; the displayed stretching hand follows the actual attachment point. The pull accelerates the body rather than teleporting it. B detaches, U releases with lift, and attacks, damage, obstruction, arrival and expiry release the cable. The body sweeps against static cover. Ground B still stretch-fetches a loose object.

G redirects airborne momentum in the movement direction once per flight, provides a small lift and keeps a connected chain available. Jump costs 8 stamina, an anchor 12, air evasion 12, and wind redirection 8 stamina plus 18 shared focus outside infinite practice. Reset, wave transitions and arena changes discard traversal, stance and landing state. Existing balloon and hold controls retain their contexts. Dedicated Jump / Evade / Duck / Anchor / Block buttons remain available across all three mobile banks, with compact portrait and landscape layouts.

`node scripts/verify-mobility.cjs` adds 24 integrated checks for actual high/body/leg contacts, reactive ducking, jump and air-attack behavior, momentum reversal, finite resources, one-use air actions, recovery timing and anti-mashing, grip/KO restrictions, anchors and occlusion, swept cover, support landings and breakage, all four arenas, resets and 30/60/120 fps agreement. The page suite now has 15 checks, including physical keys, Q's contextual behavior, touch cancellation, pause cleanup, anchor-to-jump-to-wind input and the live landing cue. Existing combat, wrestling/camera, geometric contact, character dynamics, weapon, fusion, group/wind, balloon and wave/lightning suites also passed during this change. Browser rendering and physical-device performance are separate from these adapter-based checks.

The public V20 build was then inspected in real Chrome/SwiftShader WebGL with controlled 30 fps scheduling. Actual keyboard input produced the lowered crouch (head about 1.32 m), a steered jump into a wind redirect, a visible pillar attachment, and a successful Space recovery with 0.113 seconds left before landing. Actual touch input exercised duck/cancel, Jump, D-pad air steering, Tools/Gust step, Anchor and release-with-jump. All three portrait banks and landscape Fight had no horizontal overflow; the five defensive buttons measured 70×44 px in portrait and at least 46×44 px in landscape. The arena retained 516 px portrait Fight height and 243 px landscape Fight height. Sampled complete rigs stayed visible and finite, with no JavaScript, asset-request or WebGL errors. Software rendering and emulated touch do not establish hardware frame rate or physical-phone feel.

V21 gives the per-frame movement UI sole ownership of the evade button caption: Evade on the ground, Air evade while rising, Recover while descending, and the existing hold/balloon labels in those contexts. This removes an older HUD writer that replaced the new airborne caption with Dodge between updates. The action readout also identifies a clean recovery.

The final V21 timing check keeps recovery eligible until actual floor contact, rather than declaring the last 8 cm of descent grounded. A 5 cm / -5 m/s fall accepts the late tap, while the same input after contact cannot erase the knockdown. The movement suite has 25 checks and the page suite 16 after these refinements.


## Prototype 22 — Cover, earth and fire

Enter attaches to nearby cover or leaves it. WASD shuffles along the chosen face. Hold Q for a contextual peek: over low cover or around the closest available vehicle edge. [ and ] choose a side explicitly; tall cover requires first moving to an edge. The visible crouched/leaning skeleton supplies the projectile capsules. Concealment grants no immunity. Released peeks cancel uncommitted ranged shots; ammunition is spent only when a shot commits. Jumping, evading, melee, incoming damage and destroyed/expired cover release the stance. Cars use separate low body and tall cabin colliders, and only cabin side faces accept cover attachment.

| Key | Power | Focus | Behavior |
| --- | --- | --- | --- |
| 1 | Raise earth cover | 24 | Breakable 90-health wall, 12-second lifetime, maximum three per caster; requires clear ground |
| 2 | Fault-line launcher | 24 | Captured, marked ground target; mass-sensitive lift into J / K / L |
| 3 | Seismic ring | 36 | Close ground sweep and knockdown |
| 4 | Ember shot | 12 | Travelling fire projectile; swept solid/body contacts |
| 5 | Flame trail | 28 | Short clear lane burns for 3.2 seconds; drives enemy evasive movement |
| 6 | Furnace burst | 34 | Close fire knockdown finisher |

All six actions use normal combat startup, shared stamina/focus, the input queue, real damage attribution and style families. Solid scenery blocks attack paths. Fire projectiles, effect pools and burning areas are bounded and expire. Walls become ordinary yard solids, so bullets, wind, bodies, props and the traversal solver encounter the same obstruction.

Learn cover stages a low-barrier shooting exercise. Cover duel equips both fighters with separate blasters and opposite cover positions. Earth / fire lab gathers three passive partners in the street yard. Live ranged opponents seek nearby cover, shuffle to an edge, telegraph peeks and reload normally; close enemies and fire pressure make them leave it.

The cover row remains available in all four touch banks. Hold a peek with one finger and fire with another; pointer cancellation, focus loss, pause and run dialogs release held peeks. The Earth / Fire bank exposes all six powers; the desktop power panel and number keys provide the same actions. Keyboard-focused peek buttons support hold/release with Space or Enter.

New source modules: `dist/cover.js` (stance, face selection, peeking, ranged cover behavior and setups), `dist/elements.js` (casts, walls, projectiles and fire hazards). `node scripts/verify-cover-elements.cjs` checks concealment/exposure, muzzle obstruction, vehicle geometry, interruptions, spawn clearance, bounded lifetimes, mixed air chains, enemy cover behavior and 30/60/120-fps agreement. `node scripts/verify-page.cjs` includes the actual numbered keys, cover keys, touch banks and separate peek/fire pointer controls.

Prototype 23 refines expanded desktop play: secondary panels collapse, the arena fills the remaining window, and Fight / Powers / Earth–Fire / Tools banks remain available beside defense and cover controls.

Cover entry blends over 0.16 seconds, rejects obstructed approaches and preserves collision throughout. Expanded landscape defense buttons retain at least 44-pixel touch targets. Broken and expired temporary earth walls are removed from the prop collection.


## Prototype 24 — Elemental remix

Four exclusive ten-second coatings now strengthen confirmed melee/weapon contacts, wrestling throws and balloon collisions. Shift + 1/2/3/4 selects Fire / Lightning / Earth / Water. Fire adds 25% melee damage plus 2 and ignites; Lightning adds 18% plus 2 and conducts through wet targets; Earth adds 22% plus 3, an extra heavy/throw bonus, and 20% incoming-damage resistance; Water adds 12% plus 1, wets contacts, and resists 12% of incoming damage. Contact charges cost two focus (four for heavies/throws); misses, parries and clean blocks never earn the bonus. A clear button removes the coating while preserving a primed mix. Coatings tint the body and render flames, arcs, stone gauntlets or flowing water around the shared skeleton.

Coating or committing two different elements within six seconds primes an eight-second fusion. 0 requests the release; it pays stamina/focus at normal startup and consumes the stored mix only when committed. The HUD and a touch button expose its exact name and remaining window. Recipes are order independent:

| Mix | Release | Behavior |
| --- | --- | --- |
| Earth + Fire | Lava surge | Ground fault launches and leaves temporary molten pools; damage reaches props along an open lane |
| Fire + Water | Steam cannon | Broad pressure cone launches and briefly disrupts enemy aim |
| Water + Lightning | Thunder Tide | Lifting conductive wave leaves electric water pools |
| Earth + Water | Mudslide | Trips grounded bodies and leaves slowing mud |
| Fire + Lightning | Plasma lance | Swept projectile pierces up to three bodies with declining damage; solids stop it |
| Earth + Lightning | Magnet quake | Pulls bodies and real metal props inward, arms the cargo and launches it |
| Fire + Wind | Firestorm | Finite hot vortex gathers bodies and props into a burning juggle |
| Water + Wind | Typhoon cradle | Water vortex briefly suspends targets; hits or grabs transfer control back to ordinary combat |

Water has six moves: 7 Water dart, 8 Tidal lash, 9 Waterspout cradle, plus Riptide sweep, Hydro cannon and Tide step in the Water tab. Water wets, extinguishes burns and quenches fire/lava pools. Fire meeting wet targets creates a steam pop; lightning meeting wet targets conducts to nearby visible bodies; earth meeting wet targets creates a mud slow. Burn ticks are bounded, preserve ongoing attacks and do not repeatedly interrupt air control. Bubbles expire, break on a real damaging contact, and release when a pair animation takes ownership.

Earth additionally has the geometric Stone-breaker fist, a travelling Boulder pitch and a grounded Stone vault. Fire adds the geometric Blazing uppercut and Comet heel plus a swept Flare rush. Tide step and Flare rush move over time and stop before solid cover. Number keys 1–6 retain their earlier meanings. The Elements bank has Earth / Fire / Water sub-tabs with six actions each. Infuse contains coatings, Clear and Release. Every recipe card explicitly resets free practice with that release ready. Coating/melee and free fusion labs stage targets for experimentation.

Easy combos adds **Element remix**: it applies a coating when absent, mixes water, earth, fire and lightning with actual hands, kicks, catches and throws, and uses a ready release in a suitable context. Finite sessions fall back to ordinary attacks when focus is low. K requests air setups and L finishes or releases an available fusion. Original Manual inputs and authored routes remain available.

`dist/infusion.js` owns coatings, recipes, status reactions and fusion fields. `dist/element-visuals.js` reads published rigs without modifying combat. `dist/elements.js` owns all eighteen earth/fire/water actions, travelling projectiles and bounded hazards. `scripts/verify-elemental-remix.cjs` verifies damage/costs, contact requirements, resistance, throws, status reactions, recipes, interrupted/expired releases, cover, piercing, metal cargo, bubbles, water movement, bounded lifetimes, assistance and 30/60/120-fps agreement. Page tests exercise the actual number keys, Shift shortcuts, element tabs, coatings, recipe cards, quick release, saved assistance and pause.

Prototype 25 ensures water quenching checks solid cover and compacts the ready-fusion HUD on portrait phones. All eight fusion releases were rendered in real WebGL; mobile checks used phone-browser emulation, with portrait/landscape controls and touch release verified.


## Prototype 26 — Elemental mastery and effects

There are now 27 earth/fire/water moves and 253 authored routes. The Elements bank keeps six buttons visible per page: tap **More moves** for the new techniques, or **Core moves** to return. This page choice carries across the three element tabs. Desktop shortcuts use Alt + 1–9; original letters, digits and Shift coating shortcuts remain intact.

| Element | Shortcuts | Added moves |
| --- | --- | --- |
| Earth | Alt + 1 / 2 / 3 | Crag uppercut: physical hand launcher. Ridge breaker: travelling ground ridge, stopped by real cover, launching each body once. Quarry hammer: physical heavy/air slam. |
| Fire | Alt + 4 / 5 / 6 | Cinder jab: fast melee link. Dragon breath: four short pressure pulses in a cover-limited lane, ending on interruption or an accepted cancel. Phoenix dive: descending heel/air slam. |
| Water | Alt + 7 / 8 / 9 | Current palm: fast wetting hand. Undertow ring: open-path radial pull, with mass-dependent momentum. Waterwheel kick: real foot-contact launcher. |

Fifteen added routes include Crag uppercut → J → K → V → E, Cinder jab → I → K → Phoenix dive, Waterwheel kick → J → K → V → E, and a water-to-fire aerial finish that primes Steam on actual contacts. Earth, Fire and Water filters are available in the move library. Three featured cards load the coach and the matching advanced element page. Easy + Element remix also uses the new hand and kick attacks.

`element-particles.js` draws a bounded, batched, depth-tested particle pass after opaque scenery. Animated procedural flame alpha replaces every elemental cone. Fire has turbulent tongues, soft smoke, drifting embers, a hot core and nearby warm light. Water has translucent streams, highlighted drops, spiral spouts, foam and animated ground ripples. Earth has irregular faceted stone, rising ridges, chipped cover and dust plumes. Lava uses animated molten veins. Full and Lean retain the same authoritative contacts and powers, with separate particle budgets. Rendering never advances gameplay.

Validation: core route suite; elemental remix suite; advanced moves, lane collision, interruption/cancel, finite resource, frame-rate agreement, read-only presentation and budget tests in `scripts/verify-elemental-mastery.cjs`; actual page entry-point tests for Alt inputs, touch paging and coaching cards; cover, articulated contacts, paired wrestling and camera regressions. GPU/browser visual checks are separate from these Node suites.


## Prototype 27 — Character detail, physical elements and shared controls

Fighters now have articulated fingers and thumbs, facial features and expressions, distinct hair, jacket seams, wraps and shoe details. They use the same physical joints and weighted skin as melee contacts. Full detail renders the individual fingers and clothing detail; Lean keeps simplified hands on the same rig. Locomotion adds lateral balance, braking and head compensation; hits drive standing secondary motion and move changes blend through follow-through. No downloaded character assets are required.

The **Flow** control bank brings six element selections, tap/hold casting, utility, a coating shortcut, ground aiming and a held directed throw together. The wheel pauses the round and restores its previous pause state when closed. Aim places a ground marker; drag on the arena to move it, or use a standard gamepad's right stick. Buffered casts retain the aim and element chosen when requested. Charges cancel on damage, pause, lost touch capture and controller disconnection.

| Default keyboard input | Flow action |
| --- | --- |
| Backtick | Element wheel: Fire, Water, Earth, Wind, Lightning, Stretch |
| Semicolon | Tap primary; hold for the alternate cast; automatic release at 1.3 simulation seconds |
| Apostrophe | Element utility |
| Comma | Coat with the selected Fire, Water, Earth or Lightning element |
| Period | In a clinch: hold directed throw, steer with movement or ground aim, release to launch |
| Slash | Toggle ground aim |

Water's held cast creates a 2.2-second current that wets ground and pushes opponents and loose cargo according to mass. Utility starts a steerable surf on wet ground, ending on dry ground, solid cover, interruption or an accepted attack. Earth's held cast or stationary utility raises a temporary terrace under standing riders or at the aimed patch; riders can jump, land, grapple and fall when its support breaks or expires. Moving Earth utility leaves physical ridge remnants along Ridge breaker. Fire builds heat only from confirmed fire contacts; at 35 heat, its utility or held cast releases stored heat. Wooden furniture can ignite, take periodic damage and spread to open nearby wood; water extinguishes it and briefly prevents re-ignition. Burning props and currents have bounded lifetimes and budgets.

Directed throws keep the paired elastic throw animation for the load, rotate toward movement or the aim marker, and then release an attributed physical ragdoll. Element, hold duration and target mass change launch speed/height. Water leaves a non-damaging current wake. This adds one directed throw with six element variations; it does not add six new wrestling clips. There are now 30 Earth/Fire/Water moves plus the existing 253 authored routes. The four practice labs reset into current/surf, terrace/ridge, heat/materials or directed-throw setups.

Controls supports keyboard rebinding with conflict swaps, saved locally. Original default keys remain available. A standard gamepad maps left stick to movement, right stick to aim, X to punch, Y to kick, RB to heavy, A to jump, B to evade, LT to guard and RT to tap/hold power. LB opens the wheel; left stick chooses and A confirms. D-pad down grabs and holds a directed throw after entering a clinch, up switches target, left coats and right uses utility. View / Back ducks or changes clinch grip; left stick click inflates; Start pauses. The wheel and bindings include touch controls; expanded phone play retains movement and defensive actions.

New regression coverage: `node scripts/verify-physical-powers.cjs` checks finite-resource casting, interruption, buffered aim, support transitions, rider expiry, elevated clinches, physical currents, surfing, ignition/quenching, all six directed releases, keyboard conflicts and standard-gamepad edges/disconnection. `verify-page.cjs` exercises the actual entry point, touch cancellation, wheel pause/restore, rebinding/persistence, practice resets and controller-trigger dispatch through a DOM adapter. Existing route, camera/wrestling, articulated-contact, character-dynamics, movement, elemental-mastery, remix and cover suites remain applicable. Browser/WebGL and phone-layout checks are performed separately; controller emulation does not certify physical hardware.

Prototype 28 corrects the grounded/air context of raised-terrace targets, including default attacks, assistance, follow-up labels, the Ready state and elevated stand-up/mount transitions. The public WebGL pass found this while checking the terrace; regression coverage includes feet above the terrace, a real standing punch and a stand-up pickup at its height.


## Prototype 29 — World building and fullscreen field guide

The arena has its own **Guide / Combos / World / Coach** bar, available in normal, expanded and native fullscreen play. F1 toggles the guide and F2 toggles the pinned combo (both rebindable). Controls show current keyboard assignments or standard-gamepad prompts where available, with contextual hands, kicks, clinch and weapon labels. Movement, defence, all six power controls and object interactions are included. Browsing pauses simulation, clears held inputs and restores the previous pause on close; gamepad B also closes it. Native fullscreen uses the document root so controls, power selection and run dialogs remain available. Unsupported or denied fullscreen requests keep the expanded CSS fallback. Leaving browser fullscreen restores the page layout.

The combo book filters the real 253 routes by category or text and shows each actual move beside its current key. At most 24 matching cards render at once; filtering exposes the others. **Pin & return** changes only the coaching route and preserves the current round. The small in-arena coach highlights confirmed progress and identifies the next key and move. **Watch practice demo** explicitly resets free practice and is disabled in an active wave run. Manual steps are labelled when Easy assistance is enabled. Key binding configuration remains reachable from inside the guide.

**Canal Market** is the sixth physical arena: sunset shop fronts, striped market awnings, a distant bridge, lanterns, dry central paving, shallow side channels, breakable tables and dividers, movable crates/barrels, solid cover and a brass sluice wheel. The central authored-combo lane remains clear. Channel water wets and extinguishes fighters and grounded cargo, can be surfed with Water utility, and quenches nearby reachable fire. Its current moves bodies and cargo according to mass and can be reversed or stopped at the wheel with the interaction key. The machinery toggle stops force while water remains wet. Clinches move as pairs; committed throws and held or retrieved objects stay under their own controller. Neutral current motion grants no fabricated damage, ownership or combo hits. These are shallow surface channels, not a deep-water swimming simulation. Full and Lean share the same physics; Lean reduces the decorative backdrop.

All six arenas have a short world description and environment tips in the World tab. Arena travel is explicit about resetting the current round and is disabled during wave runs. A compact location label and a nearby-switch action remain inside the arena, so the user need not leave fullscreen to operate machinery.

Validation: `node scripts/verify-world-guide.cjs` exercises guide pause/restore and input cancellation, route filtering and pinning, real-contact coach progression, rebinding, contextual controls, safe bindings handoff, native fullscreen and its fallback, controller dismissal, world travel/wave guards, canal wetting/surfing, current direction/mass/off state, sluice operation, cargo/held-pair behavior and frame-rate agreement. Existing page startup and Foundry checks remain applicable. `node scripts/verify-playground.cjs --routes-only --arena=canal` replays every authored route against the new arena; the full suite also exercises all arena art and opponents. Browser/GPU checks cover the live published build separately.

Prototype 30 keeps an already-open dialog above the browser fullscreen layer when fullscreen entry completes asynchronously, without losing its prior pause state. The guide header and tabs stay reachable while scrolling, and selected-power tap/hold/utility guidance links directly to the Flow controls.

Prototype 31 makes pinned routes easier to use on touch: Pin selects the control bank and element page for the opener. **Show next buttons** opens the bank for the next confirmed step without executing it or resetting the fight. The coach keeps showing the real key and move alongside this touch navigation.


## Prototype 32 — panels, fighter studio, district detail

The page practice sidebar starts hidden; Open practice panel restores its drills and library. In-arena Menu opens a corner drawer instead of a toolbar across the fighters. Guide shortcuts remain F1/F2. Fighter in that menu opens a paused cosmetic studio: four presets, four skin tones, four hairstyles, top/trouser/wrap colors, browser-local save, and reset. Cosmetics never alter skeleton or collision.

Optional north-up Radar displays real fighters and loose props. Canal gets dock boards, a moored skiff, bollards and produce; Street gets a bus shelter and shop signs; Rooftop gets another skyline layer. Perimeter lamps and planting extend every district. These background additions sit outside collision boundaries. Element casts/coating/contacts get animated fire, water, earth or aura sprites; heavy impacts add expanding shock rings and short-lived cracks. Effects cap at 64 sprites and 16 marks, with a smaller Lean budget.

Validation: node scripts/verify-studio.cjs; node scripts/verify-world-guide.cjs; node scripts/verify-page.cjs.

## Prototype 33 — Kiln Warden, Easy powers, fighter wardrobe and district journal

Menu → Boss introduces Rook, the Kiln Warden. Challenge resets the round into a finite Foundry duel at the chosen difficulty. Phases unlock below 65% and 30% health: marked quake, locked fault strip, and facing-locked flame fan. Wind-ups can be interrupted by confirmed damage or control; specials leave a recovery opening. Jumping avoids the low quake, sideways movement avoids the fault, solid cover/evades/positioning avoid the fan. Rook shares normal contact, wrestling and ragdoll rules. Results freeze the encounter for Rematch or Back to practice; no automatic reset. Best clear, difficulty, longest chain and actual damage/interrupt counts save locally.

Easy powers is a new touch bank and a Menu shortcut. Choose any of six elements; Combo requests one contextual move per tap. Queued requests resolve at action startup, retaining the element selected when tapped, using actual air/clinch/ground state. Launch, Finish, Big cast, Coat and Fusion have explicit no-hold buttons. Low focus falls back to ordinary strikes. Optional power-key combo mode uses the current Power binding (default semicolon); Make H your Power key explicitly swaps the old H action and enables that mode. Existing keys are otherwise unchanged. Hold/aim controls remain available in Flow.

Fighter studio adds Classic/Track stripes/Guild guard outfits, headband/visor, beard, hair and shoe colors, a 20-character name, six presets, shuffle, and two browser-local outfit slots. All changes are cosmetic. Old saves migrate through validated defaults.

Twelve brass markers across six arenas unlock browser-local district stories. World shows discoveries and hints for undiscovered landmarks. The foundry gains the Warden's kiln, guild standards and chimney smoke. There are no stat rewards or gated boss access.

Checks: `verify-boss-quick.cjs` covers zones, phases, difficulty, interruptions, throws, results/retries, fixed-step behavior, quick powers, journal and cosmetic persistence; existing page, world-guide, core routes, and studio checks remain applicable.

Prototype 34 refines the live-verified Easy powers layout: desktop selected-element contrast is explicit under fullscreen styles. Phones use a single element selector, three stacked primary actions, and a collapsible Big cast / Coat / Fusion section. A ready fusion highlights that section. Advanced and optional key controls remain inside it.
