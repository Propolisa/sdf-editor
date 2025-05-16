export const SD_LIB_GLSL = {
  // DISTANCE_FUNCTIONS
  sdSphere: {
    args: { p: 'vec3', r: 'float' },
    returns: 'float',
    body: `return length(p) - r;`,
  },
  sdEllipsoid: {
    args: { p: 'vec3', r: 'vec3' },
    returns: 'float',
    body: `float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / k1;`,
  },
  sdBox: {
    args: { p: 'vec3', b: 'vec3' },
    returns: 'float',
    body: `vec3 q = abs(p) - b;
  return length(max(q, vec3(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);`,
  },
  sdRoundBox: {
    args: { p: 'vec3', b: 'vec3', r: 'float' },
    returns: 'float',
    body: `vec3 q = abs(p) - b;
  return length(max(q, vec3(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0) - r;`,
  },
  sdBoxFrame: {
    args: { p: 'vec3', b: 'vec3', e: 'float' },
    returns: 'float',
    body: `vec3 q = abs(p) - b;
  vec3 w = abs(q + vec3(e)) - vec3(e);
  float d1 = length(max(vec3(q.x, w.y, w.z), vec3(0.0)))
             + min(max(q.x, max(w.y, w.z)), 0.0);
  float d2 = length(max(vec3(w.x, q.y, w.z), vec3(0.0)))
             + min(max(w.x, max(q.y, w.z)), 0.0);
  float d3 = length(max(vec3(w.x, w.y, q.z), vec3(0.0)))
             + min(max(w.x, max(w.y, q.z)), 0.0);
  return min(min(d1, d2), d3);`,
  },
  sdGyroid: {
    args: { p: 'vec3', h: 'float' },
    returns: 'float',
    body: `return abs(dot(sin(p), cos(p.zxy))) - h;`,
  },
  sdTorus: {
    args: { p: 'vec3', R: 'float', r: 'float' },
    returns: 'float',
    body: `vec2 q = vec2(length(p.xz) - R, p.y);
  return length(q) - r;`,
  },
  sdCappedTorus: {
    args: { p: 'vec3', R: 'float', r: 'float', sincos: 'vec2' },
    returns: 'float',
    body: `vec3 q = vec3(abs(p.x), p.y, p.z);
  float k = (sincos.y * q.x > sincos.x * q.y)
            ? dot(q.xy, sincos)
            : length(q.xy);
  return sqrt(dot(q, q) + R * R - 2.0 * R * k) - r;`,
  },
  sdLink: {
    args: { p: 'vec3', R: 'float', r: 'float', le: 'float' },
    returns: 'float',
    body: `vec3 q = vec3(p.x, max(abs(p.y) - le, 0.0), p.z);
  return length(vec2(length(q.xy) - R, q.z)) - r;`,
  },
  sdCapsule: {
    args: { p: 'vec3', a: 'vec3', b: 'vec3', r: 'float' },
    returns: 'float',
    body: `vec3 pa = p - a;
  vec3 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;`,
  },
  sdVerticalCapsule: {
    args: { p: 'vec3', h: 'float', r: 'float' },
    returns: 'float',
    body: `vec3 q = vec3(p.x, p.y - clamp(p.y, 0.0, h), p.z);
  return length(q) - r;`,
  },
  sdCylinder: {
    args: { p: 'vec3', a: 'vec3', b: 'vec3', r: 'float' },
    returns: 'float',
    body: `vec3 ba = b - a;
  vec3 pa = p - a;
  float baba = dot(ba, ba);
  float paba = dot(pa, ba);
  float x = length(pa * baba - ba * paba) - r * baba;
  float y = abs(paba - baba * 0.5) - baba * 0.5;
  float x2 = x * x;
  float y2 = y * y * baba;
  float d = x2 * step(0.0, x) + y2 * step(0.0, y);
  float d2 = (max(x, y) < 0.0) ? -min(x2, y2) : d;
  return sign(d2) * sqrt(abs(d2)) / baba;`,
  },
  sdVerticalCylinder: {
    args: { p: 'vec3', h: 'float', r: 'float' },
    returns: 'float',
    body: `vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h);
  return min(max(d.x, d.y), 0.0) + length(max(d, vec2(0.0)));`,
  },
  sdRoundedCylinder: {
    args: { p: 'vec3', h: 'float', r: 'float', re: 'float' },
    returns: 'float',
    body: `vec2 d = vec2(length(p.xz) - 2.0 * r + re, abs(p.y) - h);
  return min(max(d.x, d.y), 0.0) + length(max(d, vec2(0.0))) - re;`,
  },
  sdInfiniteCylinder: {
    args: { p: 'vec3', c: 'vec3' },
    returns: 'float',
    body: `return length(p.xz - c.xy) - c.z;`,
  },
  sdCone: {
    args: { p: 'vec3', h: 'float', sincos: 'vec2' },
    returns: 'float',
    body: `vec2 q = h * vec2(sincos.x / sincos.y, -1.0);
  vec2 w = vec2(length(p.xz), p.y);
  vec2 a = w - q * clamp(dot(w, q) / dot(q, q), 0.0, 1.0);
  vec2 b = w - q * vec2(clamp(w.x / q.x, 0.0, 1.0), 1.0);
  float k = sign(q.y);
  float d = min(dot(a, a), dot(b, b));
  float s = max(k * (w.x * q.y - w.y * q.x), k * (w.y - q.y));
  return sqrt(d) * sign(s);`,
  },
  sdConeBound: {
    args: { p: 'vec3', h: 'float', sincos: 'vec2' },
    returns: 'float',
    body: `return max(dot(sincos.yx, vec2(length(p.xz), p.y)), -h - p.y);`,
  },
  sdInfiniteCone: {
    args: { p: 'vec3', sincos: 'vec2' },
    returns: 'float',
    body: `vec2 q = vec2(length(p.xz), -p.y);
  float d = length(q - sincos * max(dot(q, sincos), 0.0));
  return d * ((q.x * sincos.y - q.y * sincos.x > 0.0) ? 1.0 : -1.0);`,
  },
  sdCappedVerticalCone: {
    args: { p: 'vec3', h: 'float', r1: 'float', r2: 'float' },
    returns: 'float',
    body: `vec2 q = vec2(length(p.xz), p.y);
  vec2 k1 = vec2(r2, h);
  vec2 k2 = vec2(r2 - r1, 2.0 * h);
  vec2 ca = vec2(q.x - min(q.x, (q.y < 0.0 ? r2 : r1)), abs(q.y) - h);
  vec2 cb = q - k1 + k2 * clamp(dot(k1 - q, k2) / dot(k2, k2), 0.0, 1.0);
  float s = (cb.x < 0.0 && ca.y < 0.0) ? -1.0 : 1.0;
  return s * sqrt(min(dot(ca, ca), dot(cb, cb)));`,
  },
  sdCappedCone: {
    args: { p: 'vec3', a: 'vec3', b: 'vec3', ra: 'float', rb: 'float' },
    returns: 'float',
    body: `float rba = rb - ra;
  vec3 ba = b - a;
  float baba = dot(ba, ba);
  float papa = dot(p - a, p - a);
  float paba = dot(p - a, ba) / baba;
  float x = sqrt(papa - paba * paba * baba);
  float cax = max(0.0, x - (paba < 0.5 ? ra : rb));
  float cay = abs(paba - 0.5) - 0.5;
  float k = rba * rba + baba;
  float f = clamp((rba * (x - ra) + paba * baba) / k, 0.0, 1.0);
  float cbx = x - ra - f * rba;
  float cby = paba - f;
  float s = (cbx < 0.0 && cay < 0.0) ? -1.0 : 1.0;
  return s * sqrt(min(cax * cax + cay * cay * baba, cbx * cbx + cby * cby * baba));`,
  },
  sdRoundVerticalCone: {
    args: { p: 'vec3', h: 'float', r1: 'float', r2: 'float' },
    returns: 'float',
    body: `vec2 q = vec2(length(p.xz), p.y);
  float b = (r1 - r2) / h;
  float a = sqrt(1.0 - b * b);
  float k = dot(q, vec2(-b, a));
  if (k < 0.0) return length(q) - r1;
  if (k > a * h) return length(q - vec2(0.0, h)) - r2;
  return dot(q, vec2(a, b)) - r1;`,
  },
  sdRoundCone: {
    args: { p: 'vec3', a: 'vec3', b: 'vec3', r1: 'float', r2: 'float' },
    returns: 'float',
    body: `vec3 ba = b - a;
  float l2 = dot(ba, ba);
  float rr = r1 - r2;
  float a2 = l2 - rr * rr;
  float il2 = 1.0 / l2;
  vec3 pa = p - a;
  float y = dot(pa, ba);
  float z = y - l2;
  vec3 w = pa * l2 - ba * y;
  float x2 = dot(w, w);
  float y2 = y * y * l2;
  float z2 = z * z * l2;
  float k = sign(rr) * rr * rr * x2;
  if (sign(z) * a2 * z2 > k)
      return sqrt(x2 + z2) * il2 - r2;
  if (sign(y) * a2 * y2 < k)
      return sqrt(x2 + y2) * il2 - r1;
  return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;`,
  },
  sdSolidAngle: {
    args: { p: 'vec3', sincos: 'vec2', r: 'float' },
    returns: 'float',
    body: `vec2 q = vec2(length(p.xz), p.y);
  float l = length(q) - r;
  float m = length(q - sincos * clamp(dot(q, sincos), 0.0, r));
  return max(l, m * sign(sincos.y * q.x - sincos.x * q.y));`,
  },
  sdPlane: {
    args: { p: 'vec3', n: 'vec3', h: 'float' },
    returns: 'float',
    body: `return dot(p, n) + h;`,
  },
  sdOctahedron: {
    args: { p: 'vec3', s: 'float' },
    returns: 'float',
    body: `vec3 q = abs(p);
  float m = q.x + q.y + q.z - s;
  if (3.0 * q.x < m) {
    q = vec3(q.x, q.y, q.z);
  } else if (3.0 * q.y < m) {
    q = q.yzx;
  } else if (3.0 * q.z < m) {
    q = q.zxy;
  } else {
    return m * 0.57735027;
  }
  float k = clamp(0.5 * (q.z - q.y + s), 0.0, s);
  return length(vec3(q.x, q.y - s + k, q.z - k));`,
  },
  sdOctahedronBound: {
    args: { p: 'vec3', s: 'float' },
    returns: 'float',
    body: `vec3 q = abs(p);
  return (q.x + q.y + q.z - s) * 0.57735027;`,
  },
  sdPyramid: {
    args: { p: 'vec3', h: 'float' },
    returns: 'float',
    body: `float m2 = h * h + 0.25;
  vec2 xz = abs(p.xz);
  if (xz.y > xz.x) xz = xz.yx;
  xz -= 0.5;
  vec3 q = vec3(xz.y,
                h * p.y - 0.5 * xz.x,
                h * xz.x + 0.5 * p.y);
  float s = max(-q.x, 0.0);
  float t = clamp((q.y - 0.5 * xz.y) / (m2 + 0.25), 0.0, 1.0);
  float a = m2 * (q.x + s) * (q.x + s) + q.y * q.y;
  float b = m2 * (q.x + 0.5 * t) * (q.x + 0.5 * t)
            + (q.y - m2 * t) * (q.y - m2 * t);
  float d2 = min(a, b) * step(min(q.y, -q.x * m2 - q.y * 0.5), 0.0);
  return sqrt((d2 + q.z * q.z) / m2) * sign(max(q.z, -p.y));`,
  },
  sdHexPrism: {
    args: { p: 'vec3', h: 'vec2' },
    returns: 'float',
    body: `vec3 k = vec3(-0.8660254, 0.5, 0.57735);
  vec3 a = abs(p);
  vec2 v = a.xy - 2.0 * min(dot(k.xy, a.xy), 0.0) * k.xy;
  float d1 = length(v - vec2(
                 clamp(v.x, -k.z * h.x, k.z * h.x),
                 h.x)) * sign(v.y - h.x);
  float d2 = a.z - h.y;
  return min(max(d1, d2), 0.0) + length(max(vec2(d1, d2), vec2(0.0)));`,
  },
  sdTriPrism: {
    args: { p: 'vec3', h: 'vec2' },
    returns: 'float',
    body: `vec3 q = abs(p);
  return max(q.z - h.y,
             max(q.x * 0.866025 + p.y * 0.5,
                 -p.y) - 0.5 * h.x);`,
  },
  sdBezier: {
    args: { p: 'vec3', A: 'vec3', B: 'vec3', C: 'vec3' },
    returns: 'float',
    body: `vec3 a = B - A;
  vec3 b = A - 2.0 * B + C;
  vec3 c = 2.0 * a;
  vec3 d = A - p;
  float kk = 1.0 / dot(b, b);
  float kx = kk * dot(a, b);
  float ky = kk * (2.0 * dot(a, a) + dot(d, b)) / 3.0;
  float kz = kk * dot(d, a);
  float p1 = ky - kx * kx;
  float p3 = p1 * p1 * p1;
  float qv = kx * (2.0 * kx * kx - 3.0 * ky) + kz;
  float h = qv * qv + 4.0 * p3;
  vec2 res;
  if (h >= 0.0) {
    h = sqrt(h);
    vec2 x = (vec2(h, -h) - qv) / 2.0;
    vec2 uv = sign(x) * pow(abs(x), vec2(1.0/3.0));
    float t = clamp(uv.x + uv.y - kx, 0.0, 1.0);
    vec3 f = d + (c + b * t) * t;
    res = vec2(dot(f, f), t);
  } else {
    float z = sqrt(-p1);
    float v = acos(qv / (p1 * z * 2.0)) / 3.0;
    float m = cos(v);
    float n = sin(v) * 1.732050808;
    vec2 ts = clamp(vec2(2.0*m, -n - m) * z - kx,
                    vec2(0.0), vec2(1.0));
    vec3 f0 = d + (c + b * ts.x) * ts.x;
    float d0 = dot(f0, f0);
    res = vec2(d0, ts.x);
    vec3 f1 = d + (c + b * ts.y) * ts.y;
    float d1 = dot(f1, f1);
    if (d1 < res.x) res = vec2(d1, ts.y);
  }
  return res.x;`,
  },
  udTriangle: {
    args: { p: 'vec3', a: 'vec3', b: 'vec3', c: 'vec3' },
    returns: 'float',
    body: `vec3 ba = b - a; vec3 pa = p - a;
  vec3 cb = c - b; vec3 pb = p - b;
  vec3 ac = a - c; vec3 pc = p - c;
  vec3 nor = cross(ba, ac);
  vec3 d1 = ba * clamp(dot(ba, pa) / dot(ba, ba), 0.0, 1.0) - pa;
  vec3 d2 = cb * clamp(dot(cb, pb) / dot(cb, cb), 0.0, 1.0) - pb;
  vec3 d3 = ac * clamp(dot(ac, pc) / dot(ac, ac), 0.0, 1.0) - pc;
  float k0 = min(min(dot(d1, d1), dot(d2, d2)), dot(d3, d3));
  float k1 = dot(nor, pa) * dot(nor, pa) / dot(nor, nor);
  float t = sign(dot(cross(ba, nor), pa))
          + sign(dot(cross(cb, nor), pb))
          + sign(dot(cross(ac, nor), pc));
  return sqrt((t < 2.0) ? k0 : k1);`,
  },
  sdBunny: {
    args: { p: 'vec3' },
    returns: 'float',
    body: `//sdf is undefined outside the unit sphere, uncomment to witness the abominations
    if (length(p) > 1.) {
        return length(p)-.8;
    }
    //neural networks can be really compact... when they want to be
    vec4 f00=sin(p.y*vec4(-3.02,1.95,-3.42,-.60)+p.z*vec4(3.08,.85,-2.25,-.24)-p.x*vec4(-.29,1.16,-3.74,2.89)+vec4(-.71,4.50,-3.24,-3.50));
    vec4 f01=sin(p.y*vec4(-.40,-3.61,3.23,-.14)+p.z*vec4(-.36,3.64,-3.91,2.66)-p.x*vec4(2.90,-.54,-2.75,2.71)+vec4(7.02,-5.41,-1.12,-7.41));
    vec4 f02=sin(p.y*vec4(-1.77,-1.28,-4.29,-3.20)+p.z*vec4(-3.49,-2.81,-.64,2.79)-p.x*vec4(3.15,2.14,-3.85,1.83)+vec4(-2.07,4.49,5.33,-2.17));
    vec4 f03=sin(p.y*vec4(-.49,.68,3.05,.42)+p.z*vec4(-2.87,.78,3.78,-3.41)-p.x*vec4(-2.65,.33,.07,-.64)+vec4(-3.24,-5.90,1.14,-4.71));
    vec4 f10=sin(mat4(-.34,.06,-.59,-.76,.10,-.19,-.12,.44,.64,-.02,-.26,.15,-.16,.21,.91,.15)*f00+
        mat4(.01,.54,-.77,.11,.06,-.14,.43,.51,-.18,.08,.39,.20,.33,-.49,-.10,.19)*f01+
        mat4(.27,.22,.43,.53,.18,-.17,.23,-.64,-.14,.02,-.10,.16,-.13,-.06,-.04,-.36)*f02+
        mat4(-.13,.29,-.29,.08,1.13,.02,-.83,.32,-.32,.04,-.31,-.16,.14,-.03,-.20,.39)*f03+
        vec4(.73,-4.28,-1.56,-1.80))/1.0+f00;
    vec4 f11=sin(mat4(-1.11,.55,-.12,-1.00,.16,.15,-.30,.31,-.01,.01,.31,-.42,-.29,.38,-.04,.71)*f00+
        mat4(.96,-.02,.86,.52,-.14,.60,.44,.43,.02,-.15,-.49,-.05,-.06,-.25,-.03,-.22)*f01+
        mat4(.52,.44,-.05,-.11,-.56,-.10,-.61,-.40,-.04,.55,.32,-.07,-.02,.28,.26,-.49)*f02+
        mat4(.02,-.32,.06,-.17,-.59,.00,-.24,.60,-.06,.13,-.21,-.27,-.12,-.14,.58,-.55)*f03+
        vec4(-2.24,-3.48,-.80,1.41))/1.0+f01;
    vec4 f12=sin(mat4(.44,-.06,-.79,-.46,.05,-.60,.30,.36,.35,.12,.02,.12,.40,-.26,.63,-.21)*f00+
        mat4(-.48,.43,-.73,-.40,.11,-.01,.71,.05,-.25,.25,-.28,-.20,.32,-.02,-.84,.16)*f01+
        mat4(.39,-.07,.90,.36,-.38,-.27,-1.86,-.39,.48,-.20,-.05,.10,-.00,-.21,.29,.63)*f02+
        mat4(.46,-.32,.06,.09,.72,-.47,.81,.78,.90,.02,-.21,.08,-.16,.22,.32,-.13)*f03+
        vec4(3.38,1.20,.84,1.41))/1.0+f02;
    vec4 f13=sin(mat4(-.41,-.24,-.71,-.25,-.24,-.75,-.09,.02,-.27,-.42,.02,.03,-.01,.51,-.12,-1.24)*f00+
        mat4(.64,.31,-1.36,.61,-.34,.11,.14,.79,.22,-.16,-.29,-.70,.02,-.37,.49,.39)*f01+
        mat4(.79,.47,.54,-.47,-1.13,-.35,-1.03,-.22,-.67,-.26,.10,.21,-.07,-.73,-.11,.72)*f02+
        mat4(.43,-.23,.13,.09,1.38,-.63,1.57,-.20,.39,-.14,.42,.13,-.57,-.08,-.21,.21)*f03+
        vec4(-.34,-3.28,.43,-.52))/1.0+f03;
    f00=sin(mat4(-.72,.23,-.89,.52,.38,.19,-.16,-.88,.26,-.37,.09,.63,.29,-.72,.30,-.95)*f10+
        mat4(-.22,-.51,-.42,-.73,-.32,.00,-1.03,1.17,-.20,-.03,-.13,-.16,-.41,.09,.36,-.84)*f11+
        mat4(-.21,.01,.33,.47,.05,.20,-.44,-1.04,.13,.12,-.13,.31,.01,-.34,.41,-.34)*f12+
        mat4(-.13,-.06,-.39,-.22,.48,.25,.24,-.97,-.34,.14,.42,-.00,-.44,.05,.09,-.95)*f13+
        vec4(.48,.87,-.87,-2.06))/1.4+f10;
    f01=sin(mat4(-.27,.29,-.21,.15,.34,-.23,.85,-.09,-1.15,-.24,-.05,-.25,-.12,-.73,-.17,-.37)*f10+
        mat4(-1.11,.35,-.93,-.06,-.79,-.03,-.46,-.37,.60,-.37,-.14,.45,-.03,-.21,.02,.59)*f11+
        mat4(-.92,-.17,-.58,-.18,.58,.60,.83,-1.04,-.80,-.16,.23,-.11,.08,.16,.76,.61)*f12+
        mat4(.29,.45,.30,.39,-.91,.66,-.35,-.35,.21,.16,-.54,-.63,1.10,-.38,.20,.15)*f13+
        vec4(-1.72,-.14,1.92,2.08))/1.4+f11;
    f02=sin(mat4(1.00,.66,1.30,-.51,.88,.25,-.67,.03,-.68,-.08,-.12,-.14,.46,1.15,.38,-.10)*f10+
        mat4(.51,-.57,.41,-.09,.68,-.50,-.04,-1.01,.20,.44,-.60,.46,-.09,-.37,-1.30,.04)*f11+
        mat4(.14,.29,-.45,-.06,-.65,.33,-.37,-.95,.71,-.07,1.00,-.60,-1.68,-.20,-.00,-.70)*f12+
        mat4(-.31,.69,.56,.13,.95,.36,.56,.59,-.63,.52,-.30,.17,1.23,.72,.95,.75)*f13+
        vec4(-.90,-3.26,-.44,-3.11))/1.4+f12;
    f03=sin(mat4(.51,-.98,-.28,.16,-.22,-.17,-1.03,.22,.70,-.15,.12,.43,.78,.67,-.85,-.25)*f10+
        mat4(.81,.60,-.89,.61,-1.03,-.33,.60,-.11,-.06,.01,-.02,-.44,.73,.69,1.02,.62)*f11+
        mat4(-.10,.52,.80,-.65,.40,-.75,.47,1.56,.03,.05,.08,.31,-.03,.22,-1.63,.07)*f12+
        mat4(-.18,-.07,-1.22,.48,-.01,.56,.07,.15,.24,.25,-.09,-.54,.23,-.08,.20,.36)*f13+
        vec4(-1.11,-4.28,1.02,-.23))/1.4+f13;
    return dot(f00,vec4(.09,.12,-.07,-.03))+dot(f01,vec4(-.04,.07,-.08,.05))+
        dot(f02,vec4(-.01,.06,-.02,.07))+dot(f03,vec4(-.05,.07,.03,.04))-0.16;`,
  },

  // BOOLEAN_OPS
  opUnion: {
    args: { d1: 'float', d2: 'float' },
    returns: 'float',
    body: `return min(d1, d2);`,
  },
  opSubtract: {
    args: { d1: 'float', d2: 'float' },
    returns: 'float',
    body: `return max(d1, -d2);`,
  },
  opIntersect: {
    args: { d1: 'float', d2: 'float' },
    returns: 'float',
    body: `return max(d1, d2);`,
  },
  opChamferUnion: {
    args: { d1: 'float', d2: 'float', r: 'float' },
    returns: 'float',
    body: `return min(min(d1, d2), (d1 - r + d2) * 0.5);`,
  },
  opChamferSubtract: {
    args: { d1: 'float', d2: 'float', r: 'float' },
    returns: 'float',
    body: `return max(max(d1, -d2), (d1 + r - d2) * 0.5);`,
  },
  opChamferIntersect: {
    args: { d1: 'float', d2: 'float', r: 'float' },
    returns: 'float',
    body: `return max(max(d1, d2), (d1 + r + d2) * 0.5);`,
  },
  opSmoothUnion: {
    args: { d1: 'float', d2: 'float', k: 'float' },
    returns: 'float',
    body: `float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
  return mix(d2, d1, h) - k * h * (1.0 - h);`,
  },
  opSmoothSubtract: {
    args: { d1: 'float', d2: 'float', k: 'float' },
    returns: 'float',
    body: `float h = clamp(0.5 - 0.5 * (d1 + d2) / k, 0.0, 1.0);
  return mix(d1, -d2, h) + k * h * (1.0 - h);`,
  },
  opSmoothIntersect: {
    args: { d1: 'float', d2: 'float', k: 'float' },
    returns: 'float',
    body: `float h = clamp(0.5 - 0.5 * (d2 - d1) / k, 0.0, 1.0);
  return mix(d2, d1, h) + k * h * (1.0 - h);`,
  },

  // DISPLACEMENT_OPS
  opDisplace: {
    args: { d1: 'float', d2: 'float' },
    returns: 'float',
    body: `return d1 + d2;`,
  },
  opTwist: {
    args: { p: 'vec3', k: 'float' },
    returns: 'vec3',
    body: `float s = sin(k * p.y);
  float c = cos(k * p.y);
  mat2 m = mat2(c, s, -s, c);
  return vec3(m * p.xz, p.y);`,
  },
  opCheapBend: {
    args: { p: 'vec3', k: 'float' },
    returns: 'vec3',
    body: `float s = sin(k * p.x);
  float c = cos(k * p.x);
  mat2 m = mat2(c, s, -s, c);
  return vec3(m * p.xy, p.z);`,
  },

  // POSITIONING_OPS
  opTranslate: {
    args: { p: 'vec3', t: 'vec3' },
    returns: 'vec3',
    body: `return p - t;`,
  },
  op90RotateX: {
    args: { p: 'vec3' },
    returns: 'vec3',
    body: `return vec3(p.x, p.z, -p.y);`,
  },
  op90RotateY: {
    args: { p: 'vec3' },
    returns: 'vec3',
    body: `return vec3(-p.z, p.y, p.x);`,
  },
  op90RotateZ: {
    args: { p: 'vec3' },
    returns: 'vec3',
    body: `return vec3(p.y, -p.x, p.z);`,
  },
  opRotateX: {
    args: { p: 'vec3', a: 'float' },
    returns: 'vec3',
    body: `float s = sin(a), c = cos(a);
  return vec3(p.x, c*p.y + s*p.z, -s*p.y + c*p.z);`,
  },
  opRotateY: {
    args: { p: 'vec3', a: 'float' },
    returns: 'vec3',
    body: `float s = sin(a), c = cos(a);
  return vec3(c*p.x - s*p.z, p.y, s*p.x + c*p.z);`,
  },
  opRotateZ: {
    args: { p: 'vec3', a: 'float' },
    returns: 'vec3',
    body: `float s = sin(a), c = cos(a);
  return vec3(c*p.x + s*p.y, -s*p.x + c*p.y, p.z);`,
  },
  opRotateE: {
    args: { p: 'vec3', e: 'vec3', a: 'float' },
    returns: 'vec3',
    body: `float c = cos(a);
  return dot(e, p)*(1.0-c)*e - cross(e,p)*sin(a) + c*p;`,
  },
  opScale: {
    args: { p: 'vec3', s: 'float' },
    returns: 'vec3',
    body: `return p / s;`,
  },
  opTransform: {
    args: { p: 'vec3', transform: 'mat4' },
    returns: 'vec3',
    body: `vec4 q = transform * vec4(p, 1.0);
  return q.xyz;`,
  },
  opSymmetryX: {
    args: { p: 'vec3' },
    returns: 'vec3',
    body: `return vec3(abs(p.x), p.y, p.z);`,
  },
  opSymmetryY: {
    args: { p: 'vec3' },
    returns: 'vec3',
    body: `return vec3(p.x, abs(p.y), p.z);`,
  },
  opSymmetryZ: {
    args: { p: 'vec3' },
    returns: 'vec3',
    body: `return vec3(p.x, p.y, abs(p.z));`,
  },
  opInfArray: {
    args: { p: 'vec3', c: 'vec3' },
    returns: 'vec3',
    body: `return p - c * round(p / c);`,
  },
  opLimArray: {
    args: { p: 'vec3', c: 'float', lim: 'vec3' },
    returns: 'vec3',
    body: `return p - c * clamp(round(p / c), -lim, lim);`,
  },

  // PRIMITIVE_OPS
  opElongate: {
    args: { p: 'vec3', h: 'vec3' },
    returns: 'vec3',
    body: `return p - clamp(p, -h, h);`,
  },
  opElongateCorrect: {
    args: { p: 'vec3', h: 'vec3' },
    returns: 'vec4',
    body: `vec3 q = abs(p) - h;
  vec3 sgn = 2.0 * step(vec3(0.0), p) - vec3(1.0);
  float w = min(max(q.x, max(q.y, q.z)), 0.0);
  return vec4(sgn * max(q, vec3(0.0)), w);`,
  },
  opRound: {
    args: { d: 'float', r: 'float' },
    returns: 'float',
    body: `return d - r;`,
  },
  opOnion: {
    args: { d: 'float', thickness: 'float' },
    returns: 'float',
    body: `return abs(d) - thickness;`,
  },
  opExtrusion: {
    args: { d: 'float', z: 'float', h: 'float' },
    returns: 'float',
    body: `vec2 w = vec2(d, abs(z) - h);
  return min(max(w.x, w.y), 0.0) + length(max(w, vec2(0.0)));`,
  },
  opRevolution: {
    args: { p: 'vec3', o: 'float' },
    returns: 'vec2',
    body: `return vec2(length(p.xz) - o, p.y);`,
  },
  length4: {
    args: { p: 'vec3' },
    returns: 'float',
    body: `vec3 q = p * p;
  q = q * q;
  return sqrt(sqrt(q.x + q.y + q.z));`,
  },
  length6: {
    args: { p: 'vec3' },
    returns: 'float',
    body: `vec3 q = p * p * p;
  q = q * q;
  return pow(q.x + q.y + q.z, 1.0/6.0);`,
  },
  length8: {
    args: { p: 'vec3' },
    returns: 'float',
    body: `vec3 q = p * p;
  q = q * q;
  q = q * q;
  return pow(q.x + q.y + q.z, 1.0/8.0);`,
  },
}

//   delete SD_LIB_GLSL.opRound
