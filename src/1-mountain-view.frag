// Topside Mountain View: a painted dusk scene in layers. Four pictures (the sky; the
// far valley; the outpost's cliff with its mast; the near ledge with the
// scout) are stacked, and the camera drifts slowly, so near things slide
// past far ones: real depth. Through them: vehicles driving the valley road,
// a drone on patrol sweeping its searchlight, fog streaming through the
// valley and mist drifting in front of the cliff, clouds travelling, the
// mast's light blinking, stars, the odd shooting star, the scout's coat in
// the wind, grass swaying, dust blowing past. The layers come from the
// original painting with what each hides painted in (live/*.png).
// Positions are in the original picture's pixels (1568x672; cropped to 21:9
// it loses 7.7 rows top and bottom).
// still: 0
// detail: .58 .27 .88 .5        the mast's warning light and its glow
// detail: -.3 -.33 .5 .02       the drone's patrol and searchlight
// detail: -.15 -.5 .2 -.2       the vehicles on the valley road
// detail: -.95 -.35 -.68 -.04   the scout, standing

layout(binding = 1) uniform sampler2D source;   // the sky
layout(binding = 2) uniform sampler2D layer1;   // the far valley and mesas (alpha)
layout(binding = 3) uniform sampler2D layer2;   // the outpost: cliff, ruins, mast (alpha)
layout(binding = 4) uniform sampler2D layer3;   // the near ledge, empty (alpha)
layout(binding = 5) uniform sampler2D layer4;   // the scout standing (Lite, and the still)
layout(binding = 6) uniform sampler2D video;    // the scout's performance: colour | mask, side by side (full motion)

const vec2 PIC = vec2(1568., 656.6);
const vec2 CROP = vec2(0., 7.7);
const float PIC_ASPECT = 3440. / 1440.;
const vec2 CENTER = vec2(784., 336.);

vec2 picUV(vec2 u) {     // the picture fills the screen as Omarchy's background does
  float a = resolution.x / resolution.y;
  return a < PIC_ASPECT ? vec2(.5 + (u.x - .5) * a / PIC_ASPECT, u.y)
                        : vec2(u.x, .5 + (u.y - .5) * PIC_ASPECT / a);
}
vec2 tuv(vec2 p) { return (p - CROP) / PIC; }
// Qt hands images over with premultiplied alpha: lay one over col with this.
vec3 over(vec3 col, vec4 layer) { return col * (1. - layer.a) + layer.rgb; }
vec3 straight(vec4 layer) { return layer.a > .001 ? layer.rgb / layer.a : vec3(0.); }

float box(vec2 p, vec4 r, float soft) {
  return smoothstep(r.x - soft, r.x + soft, p.x) * smoothstep(r.z + soft, r.z - soft, p.x)
       * smoothstep(r.y - soft, r.y + soft, p.y) * smoothstep(r.w + soft, r.w - soft, p.y);
}
float leftGround(float x) { return x < 480. ? 510. + x * .09 : 553. + (x - 480.) * 1.1; }
float seg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0., 1.)); }

// ---- the valley road, from far (top) to near ----
const int NR = 16;
const vec2 ROAD[16] = vec2[16](
  vec2(780., 506.), vec2(762., 513.), vec2(748., 517.), vec2(738., 524.), vec2(737., 540.),
  vec2(770., 550.), vec2(800., 556.), vec2(825., 563.), vec2(836., 571.), vec2(842., 582.),
  vec2(838., 591.), vec2(825., 600.), vec2(806., 607.), vec2(785., 613.), vec2(760., 621.), vec2(735., 632.));
float roadLength() {
  float L = 0.;
  for (int i = 1; i < NR; i++) L += length(ROAD[i] - ROAD[i - 1]);
  return L;
}
// The point s (0..1 of the length) along the road, and its direction: a
// smooth Catmull-Rom curve through the road's points, so turns are gradual.
vec2 cr(vec2 a, vec2 b, vec2 c, vec2 d, float f) {
  return .5 * (2. * b + (c - a) * f + (2. * a - 5. * b + 4. * c - d) * f * f + (3. * b - a - 3. * c + d) * f * f * f);
}
vec2 crd(vec2 a, vec2 b, vec2 c, vec2 d, float f) {
  return .5 * ((c - a) + 2. * (2. * a - 5. * b + 4. * c - d) * f + 3. * (3. * b - a - 3. * c + d) * f * f);
}
vec2 roadAt(float s, float L, out vec2 dir) {
  float want = s * L, acc = 0.;
  int seg = NR - 2; float f = 1.;
  for (int i = 1; i < NR; i++) {
    float l = length(ROAD[i] - ROAD[i - 1]);
    if (acc + l >= want) { seg = i - 1; f = clamp((want - acc) / l, 0., 1.); break; }
    acc += l;
  }
  vec2 a = ROAD[max(seg - 1, 0)], b = ROAD[seg], c = ROAD[seg + 1], d = ROAD[min(seg + 2, NR - 1)];
  dir = normalize(crd(a, b, c, d, f) + 1e-4);
  return cr(a, b, c, d, f);
}


void main() {
  vec2 u = viewport.xy + qt_TexCoord0 * viewport.zw;
  vec2 s = picUV(u) * PIC + CROP;          // screen position, in picture pixels
  // On screens narrower than the picture (16:9 and the like) its sides are
  // cut off and the scout sits right at the left edge: in full motion,
  // frame it a little further left so he stays clear (the mast still fits).
  float aspect = resolution.x / resolution.y;
  float narrow = smoothstep(PIC_ASPECT, PIC_ASPECT - .4, aspect);
  s.x -= 35. * narrow * (1. - detail);
  float t = time;

  // ---- the camera: a slow drift (Lite: still, so its patches match) ----
  // each layer is read at s + cam * depth: near ones slide the most. A slight
  // zoom keeps the picture's edges off screen.
  // (about 40 s side to side, with a gentle float up and down)
  vec2 cam = vec2(30. * sin(ST * .16) + 6. * sin(ST * .07), 11. * sin(ST * .11)) * (1. - detail);
  // (enough to hide the picture's edges as it sways; a narrow screen already
  // has the picture's sides to spare, so it only needs the vertical margin)
  float zoom = mix(mix(1.06, 1.035, narrow), 1., detail);
  vec2 z = CENTER + (s - CENTER) / zoom;
  // (the sky and the far mesas are nearly at infinity: almost the same shift,
  // so their meeting line never opens up)
  vec2 pS = z + cam * .08, pF = z + cam * .16, pO = z + cam * .6, pN = z + cam;
  vec2 pD = z + cam * .4;                  // the drone flies between valley and cliff

  // Where the near ledge is solid (its grass sways at most a few pixels),
  // nothing behind it shows: skip drawing it. Each effect below also only
  // runs where it can show, so the GPU isn't busy with the whole screen.
  // (worked out before any of those branches: a GPU takes texture detail
  // levels and pixel sizes from neighbouring pixels, which a branch can leave
  // out at its edges)
  float pxPic = max(fwidth(z.x), .3);          // a screen pixel, in picture pixels
  vec2 skyDx = dFdx(tuv(pS)), skyDy = dFdy(tuv(pS));
  float solidNear = min(texture(layer3, tuv(pN)).a, min(texture(layer3, tuv(pN + vec2(6., 0.))).a, texture(layer3, tuv(pN - vec2(6., 0.))).a));
  vec3 col = vec3(0.);
  if (solidNear < .999) {

  // ---- sky: clouds travel (two-phase scroll), stars twinkle, a shooting star ----
  col = textureGrad(source, tuv(pS), skyDx, skyDy).rgb;
  float cloudBand = smoothstep(345., 300., pS.y) * smoothstep(140., 200., pS.y) * (1. - detail);
  if (cloudBand > 0.) {
    float ph = fract(t * .02);
    vec3 sky1 = textureGrad(source, tuv(pS - vec2(ph * 60., 0.)), skyDx, skyDy).rgb, sky2 = textureGrad(source, tuv(pS - vec2(fract(ph + .5) * 60., 0.)), skyDx, skyDy).rgb;
    col = mix(col, mix(sky2, sky1, 1. - abs(2. * ph - 1.)), cloudBand);
  }
  float slum = dot(col, vec3(.3, .55, .15));
  float star = smoothstep(.45, .7, slum) * smoothstep(210., 120., pS.y) * (1. - box(pS, vec4(255., 100., 300., 145.), 6.));
  vec2 sc = floor(pS / 3.);
  col *= 1. + star * .9 * sin(t * (1.3 + hash21(sc) * 3.) + hash21(sc) * 40.);
  float shot = floor(t / 17.), sp = fract(t / 17.);
  if (hash11(shot) > .35 && sp < .06 && detail < .5) {
    vec2 s0 = vec2(300. + hash11(shot + .1) * 900., 30. + hash11(shot + .2) * 90.);
    vec2 sd = normalize(vec2(1., .38));
    vec2 head = s0 + sd * sp / .06 * 260.;
    vec2 v = pS - head;
    float alongS = dot(v, -sd), across = abs(dot(v, vec2(-sd.y, sd.x)));
    col += vec3(.9, .95, 1.) * smoothstep(.9, 0., across) * smoothstep(60., 0., alongS) * step(0., alongS) * (1. - sp / .06) * 1.4;
  }

  // ---- now and then a small flock of birds crosses the dusk sky ----
  float flight = floor(t / 47.), fp = fract(t / 47.);
  if (detail < .5 && hash11(flight + 3.) > .3 && fp < .5) {
    float y0 = 150. + 110. * hash11(flight + 4.);
    float dir = hash11(flight + 5.) > .5 ? 1. : -1.;
    vec2 lead = vec2(dir > 0. ? mix(-60., 1650., fp * 2.) : mix(1650., -60., fp * 2.), y0 + 10. * sin(fp * 9.));
    for (int i = 0; i < 6; i++) {
      float fi = float(i);
      vec2 bp = lead + vec2(-dir * (8. + 7. * fi), (mod(fi, 2.) * 2. - 1.) * (4. + 3. * fi) + 1.5 * sin(t * 1.3 + fi));
      vec2 q = pS - bp;
      float flap = sin(t * 9. + fi * 1.7);
      float wing = abs(q.x) < 3.2 ? abs(q.y - (abs(q.x) * (.55 * flap) - .3)) : 9.;
      col = mix(col, vec3(.06, .045, .07), (1. - smoothstep(.25, .75, wing)) * .8);
    }
  }

  // ---- the far valley, its fog drifting, and the vehicles on its road ----
  vec4 far = texture(layer1, tuv(pF));
  vec3 fc = straight(far);
  float flum = dot(fc, vec3(.3, .55, .15));
  float fogPix = smoothstep(.18, .3, flum) * smoothstep(400., 440., pF.y) * (1. - detail);
  // (a drifting veil of light over the fog, not a sliding copy of the layer:
  // a copy would carry the mesas' lit faces along with it as ghosts)
  if (fogPix > 0.) {
    float veil = fbm(vec2(pF.x * .011 - t * .045, pF.y * .045 + fbm(pF * .006 + t * .02)));
    fc += vec3(.05, .045, .065) * (veil - .45) * 2.2 * fogPix;
  }
  col = mix(col, fc, far.a);
  if (far.a > 0. && pF.x > 620. && pF.x < 960. && pF.y > 440. && pF.y < 700.) {
    vec2 p = pF;
    vec3 light = vec3(0.);
    float px = pxPic;
    float L = roadLength();
    for (int k = 0; k < 4; k++) {
      float fk = float(k);
      // one speed and even spacing: a little convoy that never overtakes
      float s = fract(t * 4.5 / L + fk * .25);
      vec2 dir;
      vec2 at = roadAt(s, L, dir);
      at.y += .25 * sin(t * 9. + fk * 2.);                   // a little bounce on the dirt road
      float size = mix(.6, 1.6, smoothstep(505., 632., at.y));   // nearer, bigger
      float fade = smoothstep(0., .06, s) * smoothstep(1., .93, s);
      // seen from the front the two lights are apart; on a bend, seen from the
      // side, they close up into one
      float facing = clamp(abs(dir.y) * 1.3, .15, 1.);
      vec2 side = vec2(1.4 * size * facing, 0.);
      // the vehicle itself: a small dark shape just behind and above its lights
      vec2 bc = at - dir * 1.6 * size + vec2(0., -.9 * size);
      vec2 bq = (p - bc) / vec2((1.9 * facing + 1.4 * (1. - facing)) * size, 1.1 * size);
      float bodyMask = 1. - smoothstep(1. - px / size, 1. + px / size, max(abs(bq.x), abs(bq.y) * 1.3));
      col = mix(col, vec3(.05, .045, .06), bodyMask * fade * .85);
      // headlights, and their beams lighting the road ahead
      float d = min(length(p - at - side), length(p - at + side));
      light += vec3(1., .93, .78) * fade * (exp(-d / (.4 * size)) * 2.6 + exp(-d / (2.2 * size)) * .4);
      vec2 r = p - at;
      float fwd = dot(r, dir), lat = dot(r, vec2(-dir.y, dir.x));
      float beamShape = smoothstep(0., 2. * size, fwd) * exp(-max(fwd, 0.) / (14. * size)) * exp(-abs(lat) / (1.2 * size + max(fwd, 0.) * .35));
      light += vec3(1., .9, .72) * fade * beamShape * .35;
      // a faint trail of dust behind it, catching its lights
      float back = -fwd, dust = smoothstep(0., 3. * size, back) * exp(-max(back, 0.) / (12. * size)) * exp(-abs(lat) / (2. * size + max(back, 0.) * .25));
      light += vec3(.8, .72, .7) * fade * dust * .08 * (.6 + .4 * noise(p * .4 - dir * t * 3.));
    }
    col += light * far.a;
  }
  if (pF.y > 405. && far.a > 0. && detail < .5) {
    float wisps = fbm(vec2(pF.x * .007 - t * .06, pF.y * .028) + vec2(fbm(pF * .006 + vec2(t * .03, 0.)) * 1.5, 0.));
    col = mix(col, vec3(.64, .57, .76), smoothstep(.42, .8, wisps) * .3 * smoothstep(405., 450., pF.y) * far.a * (1. - detail));
  }

  // ---- the drone, between the valley and the cliff ----
  {
    vec2 p = pD;
    float a = t * .11;
    vec2 dp = vec2(830. + 150. * sin(a), 420. + 14. * sin(a * 2.) + 1.5 * sin(t * 1.3));
    // (its spot sways up to 100 to either side and 140 below it)
    if (abs(p.x - dp.x) < 170. && p.y > dp.y - 30. && p.y < dp.y + 230.) {
    float bank = cos(a) * .22;                               // tilts into its turns
    vec2 q = p - dp;
    q = mat2(cos(bank), -sin(bank), sin(bank), cos(bank)) * q;
    float px = pxPic;
    float aa = px * .9;
    // body: a rounded shell, a darker underside, the camera gimbal below
    float shell = length(q / vec2(4.2, 1.9)) - 1.;
    float belly = length((q - vec2(0., 1.)) / vec2(3.2, 1.3)) - 1.;
    float gimbal = length(q - vec2(0., 2.7)) - 1.05;
    // four arms in perspective: front pair lower and wider, back pair higher
    vec2 mFL = vec2(-12., .6), mFR = vec2(12., .6), mBL = vec2(-8.5, -2.4), mBR = vec2(8.5, -2.4);
    float arms = min(min(seg(q, vec2(-2., .3), mFL), seg(q, vec2(2., .3), mFR)),
                     min(seg(q, vec2(-1.5, -.6), mBL), seg(q, vec2(1.5, -.6), mBR))) - .45;
    float motors = min(min(length(q - mFL), length(q - mFR)), min(length(q - mBL), length(q - mBR))) - .9;
    float skids = min(seg(q, vec2(-3.5, 1.2), vec2(-4.6, 4.4)), seg(q, vec2(3.5, 1.2), vec2(4.6, 4.4)));
    skids = min(skids, min(seg(q, vec2(-6.2, 4.4), vec2(-2.8, 4.4)), seg(q, vec2(2.8, 4.4), vec2(6.2, 4.4)))) - .3;
    float solid = min(min(min(shell, belly), gimbal), min(min(arms, motors), skids));
    float droneMask = 1. - smoothstep(-aa, aa, solid);
    // propellers spinning: faint blurred discs (a real prop is a blur at speed)
    float props = 0.;
    vec2 M[4] = vec2[4](mFL, mFR, mBL, mBR);
    for (int i = 0; i < 4; i++) {
      vec2 pq = (q - M[i] - vec2(0., -.9)) / vec2(5.2, 1.15);
      float r = length(pq);
      props = max(props, (1. - smoothstep(1. - aa / 4., 1. + aa / 4., r)) * (.28 + .22 * smoothstep(.6, 1., r)) * (.92 + .08 * sin(t * 60. + float(i))));
    }
    col = mix(col, vec3(.05, .045, .06), props * .55);
    // the shell catches a little of the sunset glow on its top edge
    vec3 droneCol = mix(vec3(.035, .03, .04), vec3(.25, .14, .16), smoothstep(.3, -1., q.y / 1.9) * step(shell, 0.) * .6);
    col = mix(col, droneCol, droneMask);
    // navigation lights (red left, green right) and a white strobe
    col += vec3(1., .1, .08) * exp(-length(q - mFL) / .7) * 1.4;
    col += vec3(.2, 1., .35) * exp(-length(q - mFR) / .7) * 1.4;
    float strobe = step(.93, fract(t * .7));
    col += vec3(1.) * exp(-length(q - vec2(0., -1.6)) / .8) * strobe * 2.;
    // the searchlight: a cone sweeping down to a moving spot on the valley floor
    vec2 spot = dp + vec2(70. * sin(t * .37) + 30. * sin(t * .91), 115. + 25. * sin(t * .29));
    vec2 lamp = dp + vec2(0., 3.2);   // under the gimbal
    vec2 sv = spot - lamp;
    float along = clamp(dot(p - lamp, sv) / dot(sv, sv), 0., 1.);
    float width = mix(1., 16., along);
    float beam = smoothstep(width, 0., length(p - lamp - sv * along)) * step(0., dot(p - lamp, sv)) * step(dot(p - lamp, sv), dot(sv, sv));
    float spotLit = exp(-length((p - spot) * vec2(1., 2.2)) / 14.);
    float behind = 1.;   // the near ledge is drawn over it anyway
    col += vec3(1., .95, .85) * (beam > 0. ? beam * .1 * (.6 + .4 * fbm(p * .05 + t * .3)) : 0.) * behind + vec3(1., .95, .85) * spotLit * .5 * behind;
    col += vec3(1., .97, .9) * exp(-length(p - lamp) / 1.1) * 1.4;
    }
  }

  // ---- the outpost: cliff, ruins, the mast with its guy wires and light ----
  vec4 outp = texture(layer2, tuv(pO));
  col = over(col, outp);
  {
    vec2 p = pO;
    float px = pxPic;
    // guy wires from the mast down to the cliff (the painted ones stayed in the sky)
    vec2 top = vec2(1266., 130.), mid = vec2(1266., 230.);
    float wires = min(min(seg(p, top, vec2(1170., 362.)), seg(p, top, vec2(1388., 370.))),
                      min(seg(p, mid, vec2(1200., 360.)), seg(p, mid, vec2(1340., 362.))));
    col = mix(col, vec3(.08, .06, .09), (1. - smoothstep(.0, px * 1.2, wires)) * .32);   // fine lines, a pixel wide
    vec2 lp = vec2(1267., 77.);
    float ld = length(p - lp);
    float blink = smoothstep(.0, .08, fract(t * .45)) * smoothstep(.5, .38, fract(t * .45));
    col = mix(col, col * vec3(.5, .7, .75), exp(-ld / 3.) * (1. - blink) * outp.a);
    col += vec3(1., .1, .05) * blink * (exp(-ld / 2.5) * 1.6 + exp(-ld / 14.) * .45 + exp(-ld / 70.) * .12);
    col += vec3(1., .15, .08) * blink * exp(-length((p - vec2(1260., 380.)) * vec2(.6, 1.)) / 70.) * .06 * outp.a;
  }

  // ---- a campfire inside the ruin: flickering light in its window and on
  // the ground below, smoke drifting up and away on the wind ----
  {
    vec2 p = pO;
    float flick = .7 + .2 * sin(t * 9.) * sin(t * 5.3 + 1.) + .1 * noise(vec2(t * 7., 0.));
    vec2 w = p - vec2(1134., 377.);
    float win = (1. - smoothstep(2., 3.4, abs(w.x))) * (1. - smoothstep(2.6, 4., abs(w.y)));
    vec3 fire = vec3(1., .5, .16);
    col = mix(col, fire * (1.6 + .6 * flick), win * .9 * outp.a);
    col += fire * flick * (exp(-length(w) / 5.) * .35 + exp(-length((p - vec2(1138., 398.)) * vec2(.5, 1.)) / 10.) * .12);
    // smoke: rising from behind the ruin, leaning left with the wind
    float h = 362. - p.y;                                   // height above the roof
    float cx = 1152. - h * .45 - 4. * sin(h * .05 - t * .6);
    float wdt = 2. + h * .12;
    float plume = smoothstep(wdt, 0., abs(p.x - cx)) * smoothstep(0., 6., h) * smoothstep(130., 30., h);
    if (plume > 0.) {
      float puffs = fbm(vec2((p.x - cx) * .15, h * .06 - t * .5));
      col = mix(col, vec3(.42, .38, .46), plume * smoothstep(.35, .75, puffs) * .3 * (1. - detail * .0));
    }
  }

  // ---- low mist drifting in front of the cliff (between it and the ledge) ----
  vec2 pM = z + cam * .8;
  if (pM.y > 440. && pM.y < 672. && detail < .5) {
    float mist = fbm(vec2(pM.x * .01 - t * .08, pM.y * .04) + vec2(fbm(pM * .008 - t * .02), 0.));
    col = mix(col, vec3(.6, .53, .72), smoothstep(.5, .85, mist) * smoothstep(440., 520., pM.y) * smoothstep(672., 600., pM.y) * .3 * (1. - detail));
  }

  }   // (behind the near ledge)

  // ---- the near ledge and the scout: grass sways, the coat flaps ----
  vec2 off = vec2(0.);
  float edge = exp(-abs(pN.y - leftGround(pN.x)) / 16.) * step(pN.x, 600.);
  float gust = .5 + .5 * sin(t * .4) * sin(t * .17 + 2.);
  off.x += edge * (sin(t * 2.2 + pN.x * .11) * 2. + (noise(pN * .1 + t * 1.3) - .5) * 2.) * (.4 + gust);
  vec4 near = texture(layer3, tuv(pN - off));
  col = over(col, near);
  // The scout, from generated video cut out of a green screen, played by
  // the plugin at 24 fps: he stands with his coat in the wind, then kneels to
  // watch the road through binoculars, stands, readies his rifle and walks
  // off the ledge; then he walks back on (a 2-minute loop). In Lite (and the
  // still) he only stands. Boxes: what the standing picture and the clip
  // cover, in picture pixels. The clip reaches past the picture's left edge,
  // so on wide screens he walks right off it instead of out of his box.
  const vec4 STAND_BOX = vec4(70., 389., 315.25, 582.);
  const vec4 CELL_BOX = vec4(-10.5, 389., 315.25, 582.);
  vec4 box4 = detail > .5 ? STAND_BOX : CELL_BOX;
  vec2 lu = (pN - box4.xy) / (box4.zw - box4.xy);
  // He's drawn 2-3 times smaller than his video and picture, so one sample a
  // pixel would skip most of them and his edges would stair-step and shimmer:
  // average a 3x3 grid across each pixel instead (its spacing worked out
  // here, outside the branch).
  vec2 ldx = dFdx(lu) / 3., ldy = dFdy(lu) / 3.;
  if (all(greaterThanEqual(lu, vec2(0.))) && all(lessThan(lu, vec2(1.)))) {
    vec4 scout = vec4(0.);
    for (int i = -1; i <= 1; i++)
      for (int j = -1; j <= 1; j++) {
        vec2 q = lu + float(i) * ldx + float(j) * ldy;
        if (detail > .5) scout += texture(layer4, q);
        else {
          // colour | mask side by side; the mask's edge is pulled in a
          // little so the green screen's thin outline doesn't show as a rim
          float x = clamp(q.x * .5, 1. / 1392., .5 - 1. / 1392.);
          vec3 c = texture(video, vec2(x, q.y)).rgb;
          float a = smoothstep(.3, .95, texture(video, vec2(.5 + x, q.y)).r);
          scout += vec4(c * a, a);
        }
      }
    col = over(col, scout / 9.);
  }

  // ---- dust blowing across the foreground ----
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 mp = s * (.04 + fi * .025) + vec2(-t * (.9 + fi * .5), sin(t * .5 + fi + s.x * .01) * .4);
    vec2 cell = floor(mp), f = fract(mp) - .5;
    float h = hash21(cell + fi * 11.);
    if (h > .9 && detail < .5) col += vec3(.85, .75, .9) * smoothstep(.07, 0., length(f * vec2(.5, 1.))) * (h - .9) * 3. * smoothstep(380., 560., s.y);
  }

  vec2 e = min(qt_TexCoord0, 1. - qt_TexCoord0) * viewport.zw * resolution;
  float alpha = detail > .5 ? smoothstep(0., 14., min(e.x, e.y)) : 1.;
  fragColor = vec4(col * alpha, alpha) * qt_Opacity;
}
