let SD_LIB = {
  DISTANCE_FUNCTIONS: {
    sdSphere: {
      title: 'Sphere',
      fn_name: 'sdSphere',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
        r: 'f32',
      },
      returns: 'f32',
      body: 'return length(p) - r;',
      thumb: '',
    },
    sdEllipsoid: {
      title: 'Ellipsoid',
      fn_name: 'sdEllipsoid',
      extra_info: 'bound (not exact)',
      args: {
        p: 'vec3f',
        r: 'vec3f',
      },
      returns: 'f32',
      body: 'let k0 = length(p / r);\n  let k1 = length(p / (r * r));\n  return k0 * (k0 - 1.) / k1;',
      thumb: '',
    },
    sdBox: {
      title: 'Box',
      fn_name: 'sdBox',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
        b: 'vec3f',
      },
      returns: 'f32',
      body: 'let q = abs(p) - b;\n  return length(max(q, vec3f(0.))) + min(max(q.x, max(q.y, q.z)), 0.);',
      thumb: '',
    },
    sdRoundBox: {
      title: 'Round Box',
      fn_name: 'sdRoundBox',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
        b: 'vec3f',
        r: 'f32',
      },
      returns: 'f32',
      body: 'let q = abs(p) - b;\n  return length(max(q, vec3f(0.))) + min(max(q.x,max(q.y, q.z)), 0.) - r;',
      thumb: '',
    },
    sdBoxFrame: {
      title: 'Box Frame',
      fn_name: 'sdBoxFrame',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
        b: 'vec3f',
        e: 'f32',
      },
      returns: 'f32',
      body: 'let q = abs(p) - b;\n  let w = abs(q + e) - e;\n  return min(min(\n      length(max(vec3f(q.x, w.y, w.z), vec3f(0.))) + min(max(q.x, max(w.y, w.z)), 0.),\n      length(max(vec3f(w.x, q.y, w.z), vec3f(0.))) + min(max(w.x, max(q.y, w.z)), 0.)),\n      length(max(vec3f(w.x, w.y, q.z), vec3f(0.))) + min(max(w.x, max(w.y, q.z)), 0.));',
      thumb: '',
    },
    sdGyroid: {
      title: 'Gyroid',
      fn_name: 'sdGyroid',
      extra_info: 'bound',
      args: {
        p: 'vec3f',
        h: 'f32',
      },
      returns: 'f32',
      body: 'return abs(dot(sin(p), cos(p.zxy))) - h;',
      thumb: '',
    },
    sdTorus: {
      title: 'Torus',
      fn_name: 'sdTorus',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
        R: 'f32',
        r: 'f32',
      },
      returns: 'f32',
      body: 'let q = vec2f(length(p.xz) - R, p.y);\n  return length(q) - r;',
      thumb: '',
    },
    sdCappedTorus: {
      title: 'Capped Torus',
      fn_name: 'sdCappedTorus',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
        R: 'f32',
        r: 'f32',
        sincos: 'vec2f',
      },
      returns: 'f32',
      body: 'let q = vec3f(abs(p.x), p.y, p.z);\n  let k = select(length(q.xy), dot(q.xy, sincos), sincos.y * q.x > sincos.x * q.y);\n  return sqrt(dot(q, q) + R * R - 2. * R * k) - r;',
      thumb: '',
    },
    sdLink: {
      title: 'Link',
      fn_name: 'sdLink',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
        R: 'f32',
        r: 'f32',
        le: 'f32',
      },
      returns: 'f32',
      body: 'let q = vec3f(p.x, max(abs(p.y) - le, 0.), p.z);\n  return length(vec2f(length(q.xy) - R, q.z)) - r;',
      thumb: '',
    },
    sdCapsule: {
      title: 'Capsule / Line',
      fn_name: 'sdCapsule',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
        a: 'vec3f',
        b: 'vec3f',
        r: 'f32',
      },
      returns: 'f32',
      body: 'let pa = p - a;\n  let ba = b - a;\n  let h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.);\n  return length(pa - ba * h) - r;',
      thumb: '',
    },
    sdVerticalCapsule: {
      title: 'Vertical Capsule / Line',
      fn_name: 'sdVerticalCapsule',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
        h: 'f32',
        r: 'f32',
      },
      returns: 'f32',
      body: 'let q = vec3f(p.x, p.y - clamp(p.y, 0., h), p.z);\n  return length(q) - r;',
      thumb: '',
    },
    sdCylinder: {
      title: 'Cylinder',
      fn_name: 'sdCylinder',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
        a: 'vec3f',
        b: 'vec3f',
        r: 'f32',
      },
      returns: 'f32',
      body: 'let ba = b - a;\n  let pa = p - a;\n  let baba = dot(ba, ba);\n  let paba = dot(pa, ba);\n  let x = length(pa * baba - ba * paba) - r * baba;\n  let y = abs(paba - baba * 0.5) - baba * 0.5;\n  let x2 = x * x;\n  let y2 = y * y * baba;\n  let d = x2 * step(0., x) + y2 * step(0., y);\n  let d2 = select(d, -min(x2, y2), max(x, y) < 0.);\n  return sign(d2) * sqrt(abs(d2)) / baba;',
      thumb: '',
    },
    sdVerticalCylinder: {
      title: 'Vertical Cylinder',
      fn_name: 'sdVerticalCylinder',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
        h: 'f32',
        r: 'f32',
      },
      returns: 'f32',
      body: 'let d = abs(vec2f(length(p.xz), p.y)) - vec2f(r, h);\n  return min(max(d.x, d.y), 0.) + length(max(d, vec2f(0.)));',
      thumb: '',
    },
    sdRoundedCylinder: {
      title: 'Rounded Cylinder',
      fn_name: 'sdRoundedCylinder',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
        h: 'f32',
        r: 'f32',
        re: 'f32',
      },
      returns: 'f32',
      body: 'let d = vec2f(length(p.xz) - 2. * r + re, abs(p.y) - h);\n  return min(max(d.x, d.y), 0.) + length(max(d, vec2f(0.))) - re;',
      thumb: '',
    },
    sdInfiniteCylinder: {
      title: 'Infinite Cylinder',
      fn_name: 'sdInfiniteCylinder',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
        c: 'vec3f',
      },
      returns: 'f32',
      body: 'return length(p.xz - c.xy) - c.z;',
      thumb: '',
    },
    sdCone: {
      title: 'Cone',
      fn_name: 'sdCone',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
        h: 'f32',
        sincos: 'vec2f',
      },
      returns: 'f32',
      body: '// Alternatively pass q instead of (sin(alpha), cos(alpha))\n  let q = h * vec2f(sincos.x / sincos.y, -1.);\n  let w = vec2f(length(p.xz), p.y);\n  let a = w - q * clamp(dot(w,q) / dot(q,q), 0., 1.);\n  let b = w - q * vec2f(clamp(w.x / q.x, 0., 1.), 1.);\n  let k = sign(q.y);\n  let d = min(dot(a, a), dot(b, b));\n  let s = max(k * (w.x * q.y - w.y * q.x), k * (w.y - q.y));\n  return sqrt(d) * sign(s);',
      thumb: '',
    },
    sdConeBound: {
      title: 'Cone',
      fn_name: 'sdConeBound',
      extra_info: 'bound (not exact)',
      args: {
        p: 'vec3f',
        h: 'f32',
        sincos: 'vec2f',
      },
      returns: 'f32',
      body: 'return max(dot(sincos.yx, vec2f(length(p.xz), p.y)), -h - p.y);',
      thumb: '',
    },
    sdInfiniteCone: {
      title: 'Infinite Cone',
      fn_name: 'sdInfiniteCone',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
        sincos: 'vec2f',
      },
      returns: 'f32',
      body: 'let q = vec2f(length(p.xz), -p.y);\n  let d = length(q - sincos * max(dot(q, sincos), 0.));\n  return d * select(-1., 1., q.x * sincos.y - q.y * sincos.x > 0.0);',
      thumb: '',
    },
    sdCappedVerticalCone: {
      title: 'Capped Vertical Cone',
      fn_name: 'sdCappedVerticalCone',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
        h: 'f32',
        r1: 'f32',
        r2: 'f32',
      },
      returns: 'f32',
      body: 'let q = vec2f(length(p.xz), p.y);\n  let k1 = vec2f(r2, h);\n  let k2 = vec2f(r2 - r1, 2. * h);\n  let ca = vec2f(q.x - min(q.x, select(r2, r1, q.y < 0.)), abs(q.y) - h);\n  let cb = q - k1 + k2 * clamp(dot(k1 - q, k2) / dot(k2, k2), 0., 1.);\n  let s = select(1., -1., cb.x < 0. && ca.y < 0.);\n  return s * sqrt(min(dot(ca, ca), dot(cb, cb)));',
      thumb: '',
    },
    sdCappedCone: {
      title: 'Capped Cone',
      fn_name: 'sdCappedCone',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
        a: 'vec3f',
        b: 'vec3f',
        ra: 'f32',
        rb: 'f32',
      },
      returns: 'f32',
      body: 'let rba = rb - ra;\n  let baba = dot(b - a, b - a);\n  let papa = dot(p - a, p - a);\n  let paba = dot(p - a, b - a) / baba;\n  let x = sqrt(papa - paba * paba * baba);\n  let cax = max(0.0, x - select(rb, ra, paba < 0.5));\n  let cay = abs(paba - 0.5) - 0.5;\n  let k = rba * rba + baba;\n  let f = clamp((rba * (x - ra) + paba * baba) / k, 0.0, 1.0);\n  let cbx = x - ra - f * rba;\n  let cby = paba - f;\n  let s = select(1., -1., cbx < 0.0 && cay < 0.0);\n  return s * sqrt(min(cax * cax + cay * cay * baba, cbx * cbx + cby * cby * baba));',
      thumb: '',
    },
    sdRoundVerticalCone: {
      title: 'Round Vertical cone',
      fn_name: 'sdRoundVerticalCone',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
        h: 'f32',
        r1: 'f32',
        r2: 'f32',
      },
      returns: 'f32',
      body: 'let q = vec2f(length(p.xz), p.y);\n  let b = (r1 - r2) / h;\n  let a = sqrt(1. - b * b);\n  let k = dot(q, vec2f(-b, a));\n  if (k < 0.) { return length(q) - r1; }\n  if (k > a * h) { return length(q - vec2f(0., h)) - r2; }\n  return dot(q, vec2f(a, b)) - r1;',
      thumb: '',
    },
    sdRoundCone: {
      title: 'Round cone',
      fn_name: 'sdRoundCone',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
        a: 'vec3f',
        b: 'vec3f',
        r1: 'f32',
        r2: 'f32',
      },
      returns: 'f32',
      body: 'let ba = b - a;\n  let l2 = dot(ba, ba);\n  let rr = r1 - r2;\n  let a2 = l2 - rr * rr;\n  let il2 = 1. / l2;\n\n  let pa = p - a;\n  let y = dot(pa, ba);\n  let z = y - l2;\n  let w = pa * l2 - ba * y;\n  let x2 = dot(w, w);\n  let y2 = y * y * l2;\n  let z2 = z * z * l2;\n\n  let k = sign(rr) * rr * rr * x2;\n  if (sign(z) * a2 * z2 > k) { return sqrt(x2 + z2) * il2 - r2; }\n  if (sign(y) * a2 * y2 < k) { return sqrt(x2 + y2) * il2 - r1; }\n  return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;',
      thumb: '',
    },
    sdSolidAngle: {
      title: 'Solid Angle',
      fn_name: 'sdSolidAngle',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
        sincos: 'vec2f',
        r: 'f32',
      },
      returns: 'f32',
      body: 'let q = vec2f(length(p.xz), p.y);\n  let l = length(q) - r;\n  let m = length(q - sincos * clamp(dot(q, sincos), 0., r));\n  return max(l, m * sign(sincos.y * q.x - sincos.x * q.y));',
      thumb: '',
    },
    sdPlane: {
      title: 'Plane',
      fn_name: 'sdPlane',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
        n: 'vec3f',
        h: 'f32',
      },
      returns: 'f32',
      body: '// n must be normalized\n  return dot(p, n) + h;',
      thumb: '',
    },
    sdOctahedron: {
      title: 'Octahedron',
      fn_name: 'sdOctahedron',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
        s: 'f32',
      },
      returns: 'f32',
      body: 'var q: vec3f = abs(p);\n  let m = q.x + q.y + q.z - s;\n  if (3. * q.x < m) {q = q.xyz;}\n  else {if (3. * q.y < m) {q = q.yzx;}\n        else {if (3. * q.z < m) {q = q.zxy;}\n              else {return m * 0.57735027;}}}\n  let k = clamp(0.5 * (q.z - q.y + s), 0., s);\n  return length(vec3f(q.x, q.y - s + k, q.z - k));',
      thumb: '',
    },
    sdOctahedronBound: {
      title: 'Octahedron',
      fn_name: 'sdOctahedronBound',
      extra_info: 'bound (not exact)',
      args: {
        p: 'vec3f',
        s: 'f32',
      },
      returns: 'f32',
      body: 'let q = abs(p);\n  return (q.x + q.y + q.z - s) * 0.57735027;',
      thumb: '',
    },
    sdPyramid: {
      title: 'Pyramid',
      fn_name: 'sdPyramid',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
        h: 'f32',
      },
      returns: 'f32',
      body: 'let m2 = h * h + 0.25;\n  var xz: vec2f = abs(p.xz);\n  xz = select(xz, xz.yx, xz[1] > xz[0]);\n  xz = xz - vec2f(0.5);\n\n  let q = vec3f(xz[1], h * p.y - 0.5 * xz[0], h * xz[0] + 0.5 * p.y);\n  let s = max(-q.x, 0.);\n  let t = clamp((q.y - 0.5 * xz[1]) / (m2 + 0.25), 0., 1.);\n\n  let a = m2 * (q.x + s) * (q.x + s) + q.y * q.y;\n  let b = m2 * (q.x + 0.5 * t) * (q.x + 0.5 * t) + (q.y - m2 * t) * (q.y - m2 * t);\n\n  let d2 = min(a, b) * step(min(q.y, -q.x * m2 - q.y * 0.5), 0.);\n  return sqrt((d2 + q.z * q.z) / m2) * sign(max(q.z, -p.y));',
      thumb: '',
    },
    sdHexPrism: {
      title: 'Hexagonal Prism',
      fn_name: 'sdHexPrism',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
        h: 'vec2f',
      },
      returns: 'f32',
      body: 'let k = vec3f(-0.8660254, 0.5, 0.57735);\n  let a = abs(p);\n  let v = a.xy - 2. * min(dot(k.xy, a.xy), 0.) * k.xy;\n  let d1 = length(v - vec2f(clamp(v.x, -k.z * h.x, k.z * h.x), h.x)) * sign(v.y - h.x);\n  let d2 = a.z - h.y;\n  return min(max(d1, d2), 0.) + length(max(vec2f(d1, d2), vec2f(0.)));',
      thumb: '',
    },
    sdTriPrism: {
      title: 'Triangular Prism',
      fn_name: 'sdTriPrism',
      extra_info: 'bound',
      args: {
        p: 'vec3f',
        h: 'vec2f',
      },
      returns: 'f32',
      body: 'let q = abs(p);\n  return max(q.z - h.y, max(q.x * 0.866025 + p.y * 0.5, -p.y) - h.x * 0.5);',
      thumb: '',
    },
    sdBezier: {
      title: 'Quadratic Bezier',
      fn_name: 'sdBezier',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
        A: 'vec3f',
        B: 'vec3f',
        C: 'vec3f',
      },
      returns: 'vec2f',
      body: 'let a = B - A;\n  let b = A - 2. * B + C;\n  let c = a * 2.;\n  let d = A - p;\n  let kk = 1. / dot(b, b);\n  let kx = kk * dot(a, b);\n  let ky = kk * (2. * dot(a, a) + dot(d, b)) / 3.;\n  let kz = kk * dot(d, a);\n\n  let p1 = ky - kx * kx;\n  let p3 = p1 * p1 * p1;\n  let q = kx * (2.0 * kx * kx - 3.0 * ky) + kz;\n  var h: f32 = q * q + 4. * p3;\n\n  var res: vec2f;\n  if (h >= 0.) {\n    h = sqrt(h);\n    let x = (vec2f(h, -h) - q) / 2.;\n    let uv = sign(x) * pow(abs(x), vec2f(1. / 3.));\n    let t = clamp(uv.x + uv.y - kx, 0., 1.);\n    let f = d + (c + b * t) * t;\n    res = vec2f(dot(f, f), t);\n  } else {\n    let z = sqrt(-p1);\n    let v = acos(q / (p1 * z * 2.)) / 3.;\n    let m = cos(v);\n    let n = sin(v) * 1.732050808;\n    let t = clamp(vec2f(m + m, -n - m) * z - kx, vec2f(0.0), vec2f(1.0));\n    let f = d + (c + b * t.x) * t.x;\n    var dis: f32 = dot(f, f);\n    res = vec2f(dis, t.x);\n\n    let g = d + (c + b * t.y) * t.y;\n    dis = dot(g, g);\n    res = select(res, vec2f(dis, t.y), dis < res.x);\n  }\n  res.x = sqrt(res.x);\n  return res;',
      thumb: '',
    },
    udTriangle: {
      title: 'Triangle',
      fn_name: 'udTriangle',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
        a: 'vec3f',
        b: 'vec3f',
        c: 'vec3f',
      },
      returns: 'f32',
      body: 'let ba = b - a; let pa = p - a;\n  let cb = c - b; let pb = p - b;\n  let ac = a - c; let pc = p - c;\n  let nor = cross(ba, ac);\n   let d1 = ba * clamp(dot(ba, pa) / dot(ba, ba), 0., 1.) - pa;\n  let d2 = cb * clamp(dot(cb, pb) / dot(cb, cb), 0., 1.) - pb;\n  let d3 = ac * clamp(dot(ac, pc) / dot(ac, ac), 0., 1.) - pc;\n   let k0 = min(min(dot(d1, d1), dot(d2, d2)), dot(d3, d3));\n  let k1 = dot(nor, pa) * dot(nor, pa) / dot(nor, nor);\n  let t = sign(dot(cross(ba, nor), pa)) + sign(dot(cross(cb, nor), pb)) +\n      sign(dot(cross(ac, nor), pc));\n  return sqrt(select(k0, k1, t < 2.));',
      thumb: '',
    },
    sdBunny: {
      title: 'Bunny',
      fn_name: 'sdBunny',
      extra_info: 'bound',
      args: {
        p: 'vec3f',
      },
      returns: 'f32',
      body: 'if (dot(p, p) > 1.) { return length(p) - .8; }\n  let q = vec4f(p, 1.);\n  let f00=sin(mat4x4f(-3.02,1.95,-3.42,-.6,3.08,.85,-2.25,-.24,-.29,1.16,-3.74,2.89,-.71,4.5,-3.24,-3.5)*q);\n  let f01=sin(mat4x4f(-.4,-3.61,3.23,-.14,-.36,3.64,-3.91,2.66,2.9,-.54,-2.75,2.71,7.02,-5.41,-1.12,-7.41)*q);\n  let f02=sin(mat4x4f(-1.77,-1.28,-4.29,-3.2,-3.49,-2.81,-.64,2.79,3.15,2.14,-3.85,1.83,-2.07,4.49,5.33,-2.17)*q);\n  let f03=sin(mat4x4f(-.49,.68,3.05,.42,-2.87,.78,3.78,-3.41,-2.65,.33,.07,-.64,-3.24,-5.9,1.14,-4.71)*q);\n  let f10=sin(mat4x4f(-.34,.06,-.59,-.76,.1,-.19,-.12,.44,.64,-.02,-.26,.15,-.16,.21,.91,.15)*f00+\n      mat4x4f(.01,.54,-.77,.11,.06,-.14,.43,.51,-.18,.08,.39,.2,.33,-.49,-.1,.19)*f01+\n      mat4x4f(.27,.22,.43,.53,.18,-.17,.23,-.64,-.14,.02,-.1,.16,-.13,-.06,-.04,-.36)*f02+\n      mat4x4f(-.13,.29,-.29,.08,1.13,.02,-.83,.32,-.32,.04,-.31,-.16,.14,-.03,-.2,.39)*f03+\n      vec4f(.73,-4.28,-1.56,-1.8))+f00;\n  let f11=sin(mat4x4f(-1.11,.55,-.12,-1.00,.16,.15,-.3,.31,-.01,.01,.31,-.42,-.29,.38,-.04,.71)*f00+\n      mat4x4f(.96,-.02,.86,.52,-.14,.6,.44,.43,.02,-.15,-.49,-.05,-.06,-.25,-.03,-.22)*f01+\n      mat4x4f(.52,.44,-.05,-.11,-.56,-.1,-.61,-.4,-.04,.55,.32,-.07,-.02,.28,.26,-.49)*f02+\n      mat4x4f(.02,-.32,.06,-.17,-.59,.00,-.24,.6,-.06,.13,-.21,-.27,-.12,-.14,.58,-.55)*f03+\n      vec4f(-2.24,-3.48,-.8,1.41))+f01;\n  let f12=sin(mat4x4f(.44,-.06,-.79,-.46,.05,-.6,.3,.36,.35,.12,.02,.12,.4,-.26,.63,-.21)*f00+\n      mat4x4f(-.48,.43,-.73,-.4,.11,-.01,.71,.05,-.25,.25,-.28,-.2,.32,-.02,-.84,.16)*f01+\n      mat4x4f(.39,-.07,.9,.36,-.38,-.27,-1.86,-.39,.48,-.2,-.05,.1,-.00,-.21,.29,.63)*f02+\n      mat4x4f(.46,-.32,.06,.09,.72,-.47,.81,.78,.9,.02,-.21,.08,-.16,.22,.32,-.13)*f03+\n      vec4f(3.38,1.2,.84,1.41))+f02;\n  let f13=sin(mat4x4f(-.41,-.24,-.71,-.25,-.24,-.75,-.09,.02,-.27,-.42,.02,.03,-.01,.51,-.12,-1.24)*f00+\n      mat4x4f(.64,.31,-1.36,.61,-.34,.11,.14,.79,.22,-.16,-.29,-.70,.02,-.37,.49,.39)*f01+\n      mat4x4f(.79,.47,.54,-.47,-1.13,-.35,-1.03,-.22,-.67,-.26,.1,.21,-.07,-.73,-.11,.72)*f02+\n      mat4x4f(.43,-.23,.13,.09,1.38,-.63,1.57,-.2,.39,-.14,.42,.13,-.57,-.08,-.21,.21)*f03+\n      vec4f(-.34,-3.28,.43,-.52))+f03;\n  let f20=sin(mat4x4f(-.72,.23,-.89,.52,.38,.19,-.16,-.88,.26,-.37,.09,.63,.29,-.72,.3,-.95)*f10+\n      mat4x4f(-.22,-.51,-.42,-.73,-.32,.00,-1.03,1.17,-.2,-.03,-.13,-.16,-.41,.09,.36,-.84)*f11+\n      mat4x4f(-.21,.01,.33,.47,.05,.2,-.44,-1.04,.13,.12,-.13,.31,.01,-.34,.41,-.34)*f12+\n      mat4x4f(-.13,-.06,-.39,-.22,.48,.25,.24,-.97,-.34,.14,.42,-.00,-.44,.05,.09,-.95)*f13+\n      vec4f(.48,.87,-.87,-2.06))/1.4+f10;\n  let f21=sin(mat4x4f(-.27,.29,-.21,.15,.34,-.23,.85,-.09,-1.15,-.24,-.05,-.25,-.12,-.73,-.17,-.37)*f10+\n      mat4x4f(-1.11,.35,-.93,-.06,-.79,-.03,-.46,-.37,.6,-.37,-.14,.45,-.03,-.21,.02,.59)*f11+\n      mat4x4f(-.92,-.17,-.58,-.18,.58,.6,.83,-1.04,-.8,-.16,.23,-.11,.08,.16,.76,.61)*f12+\n      mat4x4f(.29,.45,.3,.39,-.91,.66,-.35,-.35,.21,.16,-.54,-.63,1.1,-.38,.2,.15)*f13+\n      vec4f(-1.72,-.14,1.92,2.08))/1.4+f11;\n  let f22=sin(mat4x4f(1.00,.66,1.3,-.51,.88,.25,-.67,.03,-.68,-.08,-.12,-.14,.46,1.15,.38,-.1)*f10+\n      mat4x4f(.51,-.57,.41,-.09,.68,-.5,-.04,-1.01,.2,.44,-.6,.46,-.09,-.37,-1.3,.04)*f11+\n      mat4x4f(.14,.29,-.45,-.06,-.65,.33,-.37,-.95,.71,-.07,1.00,-.6,-1.68,-.2,-.00,-.7)*f12+\n      mat4x4f(-.31,.69,.56,.13,.95,.36,.56,.59,-.63,.52,-.3,.17,1.23,.72,.95,.75)*f13+\n      vec4f(-.9,-3.26,-.44,-3.11))/1.4+f12;\n  let f23=sin(mat4x4f(.51,-.98,-.28,.16,-.22,-.17,-1.03,.22,.7,-.15,.12,.43,.78,.67,-.85,-.25)*f10+\n      mat4x4f(.81,.6,-.89,.61,-1.03,-.33,.6,-.11,-.06,.01,-.02,-.44,.73,.69,1.02,.62)*f11+\n      mat4x4f(-.1,.52,.8,-.65,.4,-.75,.47,1.56,.03,.05,.08,.31,-.03,.22,-1.63,.07)*f12+\n      mat4x4f(-.18,-.07,-1.22,.48,-.01,.56,.07,.15,.24,.25,-.09,-.54,.23,-.08,.2,.36)*f13+\n      vec4f(-1.11,-4.28,1.02,-.23))/1.4+f13;\n  return dot(f20,vec4f(.09,.12,-.07,-.03))+dot(f21,vec4f(-.04,.07,-.08,.05))+\n      dot(f22,vec4f(-.01,.06,-.02,.07))+dot(f23,vec4f(-.05,.07,.03,.04))- 0.16;',
      thumb: '',
    },
  },
  BOOLEAN_OPS: {
    opUnion: {
      title: 'Union',
      fn_name: 'opUnion',
      extra_info: 'exact (outside)',
      args: {
        d1: 'f32',
        d2: 'f32',
      },
      returns: 'f32',
      body: 'return min(d1, d2);',
      thumb: '',
    },
    opSubtract: {
      title: 'Subtraction',
      fn_name: 'opSubtract',
      extra_info: 'bound',
      args: {
        d1: 'f32',
        d2: 'f32',
      },
      returns: 'f32',
      body: 'return max(d1, -d2);',
      thumb: '',
    },
    opIntersect: {
      title: 'Intersection',
      fn_name: 'opIntersect',
      extra_info: 'bound',
      args: {
        d1: 'f32',
        d2: 'f32',
      },
      returns: 'f32',
      body: 'return max(d1, d2);',
      thumb: '',
    },
    opChamferUnion: {
      title: 'Chamfer Union',
      fn_name: 'opChamferUnion',
      extra_info: 'bound',
      args: {
        d1: 'f32',
        d2: 'f32',
        r: 'f32',
      },
      returns: 'f32',
      body: 'return min(min(d1, d2), (d1 - r + d2) * 0.5);',
      thumb: '',
    },
    opChamferSubtract: {
      title: 'Chamfer Subtraction',
      fn_name: 'opChamferSubtract',
      extra_info: 'bound',
      args: {
        d1: 'f32',
        d2: 'f32',
        r: 'f32',
      },
      returns: 'f32',
      body: 'return max(max(d1, -d2), (d1 + r - d2) * 0.5);',
      thumb: '',
    },
    opChamferIntersect: {
      title: 'Chamfer Intersection',
      fn_name: 'opChamferIntersect',
      extra_info: 'bound',
      args: {
        d1: 'f32',
        d2: 'f32',
        r: 'f32',
      },
      returns: 'f32',
      body: 'return max(max(d1, d2), (d1 + r + d2) * 0.5);',
      thumb: '',
    },
    opSmoothUnion: {
      title: 'Blend Union',
      fn_name: 'opSmoothUnion',
      extra_info: 'bound',
      args: {
        d1: 'f32',
        d2: 'f32',
        k: 'f32',
      },
      returns: 'f32',
      body: 'let h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0., 1.);\n  return mix(d2, d1, h) - k * h * (1. - h);',
      thumb: '',
    },
    opSmoothSubtract: {
      title: 'Blend Subtraction',
      fn_name: 'opSmoothSubtract',
      extra_info: 'bound',
      args: {
        d1: 'f32',
        d2: 'f32',
        k: 'f32',
      },
      returns: 'f32',
      body: 'let h = clamp(0.5 - 0.5 * (d1 + d2) / k, 0., 1.);\n  return mix(d1, -d2, h) + k * h * (1. - h);',
      thumb: '',
    },
    opSmoothIntersect: {
      title: 'Blend Intersection',
      fn_name: 'opSmoothIntersect',
      extra_info: 'bound',
      args: {
        d1: 'f32',
        d2: 'f32',
        k: 'f32',
      },
      returns: 'f32',
      body: 'let h = clamp(0.5 - 0.5 * (d2 - d1) / k, 0., 1.);\n  return mix(d2, d1, h) + k * h * (1. - h);',
      thumb: '',
    },
  },
  DISPLACEMENT_OPS: {
    opDisplace: {
      title: 'Displacement',
      fn_name: 'opDisplace',
      extra_info: 'bound (not exact)',
      args: {
        d1: 'f32',
        d2: 'f32',
      },
      returns: 'f32',
      body: 'return d1 + d2;',
      thumb: '',
    },
    opTwist: {
      title: 'Twist',
      fn_name: 'opTwist',
      extra_info: 'bound',
      args: {
        p: 'vec3f',
        k: 'f32',
      },
      returns: 'vec3f',
      body: 'let s = sin(k * p.y);\n  let c = cos(k * p.y);\n  let m = mat2x2<f32>(vec2f(c, s), vec2f(-s, c));\n  return vec3f(m * p.xz, p.y);',
      thumb: '',
    },
    opCheapBend: {
      title: 'Bend',
      fn_name: 'opCheapBend',
      extra_info: 'bound',
      args: {
        p: 'vec3f',
        k: 'f32',
      },
      returns: 'vec3f',
      body: 'let s = sin(k * p.x);\n  let c = cos(k * p.x);\n  let m = mat2x2<f32>(vec2f(c, s), vec2f(-s, c));\n  return vec3f(m * p.xy, p.z);',
      thumb: '',
    },
  },
  POSITIONING_OPS: {
    opTranslate: {
      title: 'Translate',
      fn_name: 'opTranslate',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
        t: 'vec3f',
      },
      returns: 'vec3f',
      body: 'return p - t;',
      thumb: '',
    },
    op90RotateX: {
      title: '90 degree rotation: op90RotateX',
      fn_name: 'op90RotateX',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
      },
      returns: 'vec3f',
      body: 'return vec3f(p.x, p.z, -p.y);',
      thumb: '',
    },
    op90RotateY: {
      title: '90 degree rotation: op90RotateY',
      fn_name: 'op90RotateY',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
      },
      returns: 'vec3f',
      body: 'return vec3f(-p.z, p.y, p.x);',
      thumb: '',
    },
    op90RotateZ: {
      title: '90 degree rotation: op90RotateZ',
      fn_name: 'op90RotateZ',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
      },
      returns: 'vec3f',
      body: 'return vec3f(p.y, -p.x, p.z);',
      thumb: '',
    },
    opRotateX: {
      title: 'Rotation around axis: opRotateX',
      fn_name: 'opRotateX',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
        a: 'f32',
      },
      returns: 'vec3f',
      body: 'let s = sin(a); let c = cos(a);\n  return vec3f(p.x, c * p.y + s * p.z, -s * p.y + c * p.z);',
      thumb: '',
    },
    opRotateY: {
      title: 'Rotation around axis: opRotateY',
      fn_name: 'opRotateY',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
        a: 'f32',
      },
      returns: 'vec3f',
      body: 'let s = sin(a); let c = cos(a);\n  return vec3f(c * p.x - s * p.z, p.y, s * p.x + c * p.z);',
      thumb: '',
    },
    opRotateZ: {
      title: 'Rotation around axis: opRotateZ',
      fn_name: 'opRotateZ',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
        a: 'f32',
      },
      returns: 'vec3f',
      body: 'let s = sin(a); let c = cos(a);\n  return vec3f(c * p.x + s * p.y, -s * p.x + c * p.y, p.z);',
      thumb: '',
    },
    opRotateE: {
      title: 'Rotation around free axis',
      fn_name: 'opRotateE',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
        e: 'vec3f',
        a: 'f32',
      },
      returns: 'vec3f',
      body: 'let c = cos(a);\n  return dot(e, p) * (1. - c) * e - cross(e, p) * sin(a) + c * p;',
      thumb: '',
    },
    opScale: {
      title: 'Scale',
      fn_name: 'opScale',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
        s: 'f32',
      },
      returns: 'vec3f',
      body: 'return p / s;',
      thumb: '',
    },
    opTransform: {
      title: 'Free transformation',
      fn_name: 'opTransform',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
        transform: 'mat4x4<f32>',
      },
      returns: 'vec3f',
      body: 'let q = inverse(transform) * vec4f(p, 1.);',
      thumb: '',
    },
    opSymmetryX: {
      title: 'Symmetry: opSymmetryX',
      fn_name: 'opSymmetryX',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
      },
      returns: 'vec3f',
      body: 'return vec3f(abs(p.x), p.y, p.z);',
      thumb: '',
    },
    opSymmetryY: {
      title: 'Symmetry: opSymmetryY',
      fn_name: 'opSymmetryY',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
      },
      returns: 'vec3f',
      body: 'return vec3f(p.x, abs(p.y), p.z);',
      thumb: '',
    },
    opSymmetryZ: {
      title: 'Symmetry: opSymmetryZ',
      fn_name: 'opSymmetryZ',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
      },
      returns: 'vec3f',
      body: 'return vec3f(p.x, p.y, abs(p.z));',
      thumb: '',
    },
    opInfArray: {
      title: 'Infinite Repetition',
      fn_name: 'opInfArray',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
        c: 'vec3f',
      },
      returns: 'vec3f',
      body: 'return p - c * round(p / c);',
      thumb: '',
    },
    opLimArray: {
      title: 'Finite Repetition',
      fn_name: 'opLimArray',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
        c: 'f32',
        lim: 'vec3f',
      },
      returns: 'vec3f',
      body: 'return p - c * clamp(round(p / c), -lim, lim);',
      thumb: '',
    },
  },
  PRIMITIVE_OPS: {
    opElongate: {
      title: 'Elongation: opElongate',
      fn_name: 'opElongate',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
        h: 'vec3f',
      },
      returns: 'vec3f',
      body: 'return p - clamp(p, -h, h);',
      thumb: '',
    },
    opElongateCorrect: {
      title: 'Elongation: opElongateCorrect',
      fn_name: 'opElongateCorrect',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
        h: 'vec3f',
      },
      returns: 'vec4f',
      body: 'let q = abs(p) - h;\n  let sgn = 2. * step(vec3f(0.), p) - vec3f(1.);\n  return vec4f(sgn * max(q, vec3f(0.)), min(max(q.x, max(q.y, q.z)), 0.));',
      thumb: '',
    },
    opRound: {
      title: 'Rounding',
      fn_name: 'opRound',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
        r: 'f32',
      },
      returns: 'f32',
      body: 'return sdfPrimitive3d(p) - r;',
      thumb: '',
    },
    opOnion: {
      title: 'Onion',
      fn_name: 'opOnion',
      extra_info: 'exact',
      args: {
        d: 'f32',
        thickness: 'f32',
      },
      returns: 'f32',
      body: 'return abs(d) - thickness;',
      thumb: '',
    },
    opExtrusion: {
      title: 'Extrusion from 2D SDF',
      fn_name: 'opExtrusion',
      extra_info: 'exact',
      args: {
        d: 'f32',
        z: 'f32',
        h: 'f32',
      },
      returns: 'f32',
      body: 'let w = vec2f(d, abs(z) - h);\n  return min(max(w.x, w.y), 0.) + length(max(w, vec2f(0.)));',
      thumb: '',
    },
    opRevolution: {
      title: 'Revolution from 2D SDF',
      fn_name: 'opRevolution',
      extra_info: 'exact',
      args: {
        p: 'vec3f',
        o: 'f32',
      },
      returns: 'vec2f',
      body: 'return vec2f(length(p.xz) - o, p.y);',
      thumb: '',
    },
    length4: {
      title: 'Change metric: length4',
      fn_name: 'length4',
      extra_info: 'bound',
      args: {
        p: 'vec3f',
      },
      returns: 'f32',
      body: 'var q: vec3f = p * p;\n  q = q * q;\n  return sqrt(sqrt(q.x + q.y + q.z));',
      thumb: '',
    },
    length6: {
      title: 'Change metric: length6',
      fn_name: 'length6',
      extra_info: 'bound',
      args: {
        p: 'vec3f',
      },
      returns: 'f32',
      body: 'var q: vec3f = p * p * p;\n  q = q * q;\n  return pow(q.x + q.y + q.z, 1. / 6.);',
      thumb: '',
    },
    length8: {
      title: 'Change metric: length8',
      fn_name: 'length8',
      extra_info: 'bound',
      args: {
        p: 'vec3f',
      },
      returns: 'f32',
      body: 'var q: vec3f = p * p;\n  q = q * q; q = q * q;\n  return pow(q.x + q.y + q.z, 1. / 8.);',
      thumb: '',
    },
  },
}

// Runtime adjustments to some library entries.
SD_LIB.POSITIONING_OPS.opTransform.body = `let q = transform * vec4f(p, 1.);
  return q.xyz;` // Assume precomputed inverse transform.
SD_LIB.PRIMITIVE_OPS.opRound = {
  title: 'Rounding',
  fn_name: 'opRound',
  extra_info: 'exact',
  args: { d: 'f32', r: 'f32' },
  returns: 'f32',
  body: 'return d - r;',
  thumb: '',
}
SD_LIB.DISTANCE_FUNCTIONS.sdBezier.returns = 'f32'
SD_LIB.DISTANCE_FUNCTIONS.sdBezier.body = SD_LIB.DISTANCE_FUNCTIONS.sdBezier.body.replace(
  'return res',
  'return res.x',
)

// Define sets of contextual arguments for each category
export const CONTEXTUAL_ARGUMENTS = {
  DISTANCE_FUNCTIONS: new Set(['p']), // 'p' is contextual in distance functions
  BOOLEAN_OPS: new Set(['d1', 'd2']), // 'd1' and 'd2' are contextual in boolean ops
  DISPLACEMENT_OPS: new Set(['p', 'd1', 'd2']), // 'p', 'd1', and 'd2' are contextual in displacement ops
  POSITIONING_OPS: new Set(['p']), // 'p' is contextual in positioning ops
  PRIMITIVE_OPS: new Set(['p', 'd']), // 'p' and 'd' are contextual in primitive ops
}

let DEFAULT_VALUES = {
  DISTANCE_FUNCTIONS: {
    sdSphere: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      r: 1.0, // Radius of the sphere, set to 1.
    },
    sdEllipsoid: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      r: [1.0, 1.0, 1.0], // Ellipsoid radii, set to unit sphere.
    },
    sdBox: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      b: [1.0, 1.0, 1.0], // Box half-size, set to unit box.
    },
    sdRoundBox: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      b: [1.0, 1.0, 1.0], // Box half-size, set to unit box.
      r: 0.1, // Radius of rounding, small value.
    },
    sdBoxFrame: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      b: [1.0, 1.0, 1.0], // Box half-size, set to unit box.
      e: 0.1, // Edge extension, small value.
    },
    sdGyroid: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      h: 0.0001, // Threshold parameter, set to 1.
    },
    sdTorus: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      R: 2.0, // Major radius of the torus, set to 2.
      r: 0.5, // Minor radius of the torus, set to 0.5.
    },
    sdCappedTorus: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      R: 2.0, // Major radius of the torus, set to 2.
      r: 0.5, // Minor radius of the torus, set to 0.5.
      sincos: [0, 1], // Default to a basic angle, sin = 0, cos = 1.
    },
    sdLink: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      R: 2.0, // Link radius, set to 2.
      r: 0.5, // Radius of the link, set to 0.5.
      le: 1.0, // Length extension, set to 1.
    },
    sdCapsule: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      a: [0, 0, 0], // First capsule endpoint, set to the origin for simplicity.
      b: [0, 1, 0], // Second capsule endpoint, set to [0, 1, 0].
      r: 1.0, // Capsule radius, set to 1.
    },
    sdVerticalCapsule: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      h: 2.0, // Capsule height, set to 2.
      r: 1.0, // Capsule radius, set to 1.
    },
    sdCylinder: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      a: [0, 0, 0], // First cylinder endpoint, set to the origin for simplicity.
      b: [0, 1, 0], // Second cylinder endpoint, set to [0, 1, 0].
      r: 1.0, // Cylinder radius, set to 1.
    },
    sdVerticalCylinder: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      h: 2.0, // Cylinder height, set to 2.
      r: 1.0, // Cylinder radius, set to 1.
    },
    sdRoundedCylinder: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      h: 2.0, // Cylinder height, set to 2.
      r: 1.0, // Cylinder radius, set to 1.
      re: 0.1, // Edge radius, set to a small value.
    },
    sdInfiniteCylinder: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      c: [1.0, 0.0, 0.0], // Cylinder center, set to [1, 0, 0].
    },
    sdCone: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      h: 2.0, // Cone height, set to 2.
      sincos: [0, 1], // Default to a basic angle, sin = 0, cos = 1.
    },
    sdConeBound: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      h: 2.0, // Cone height, set to 2.
      sincos: [0, 1], // Default to a basic angle, sin = 0, cos = 1.
    },
    sdInfiniteCone: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      sincos: [0, 1], // Default to a basic angle, sin = 0, cos = 1.
    },
    sdCappedVerticalCone: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      h: 2.0, // Cone height, set to 2.
      r1: 1.0, // Radius at the base of the cone, set to 1.
      r2: 0.5, // Radius at the tip of the cone, set to 0.5.
    },
    sdCappedCone: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      a: [0, 0, 0], // First cone endpoint, set to the origin for simplicity.
      b: [0, 1, 0], // Second cone endpoint, set to [0, 1, 0].
      ra: 1.0, // Base radius of the cone, set to 1.
      rb: 0.5, // Tip radius of the cone, set to 0.5.
    },
    sdRoundVerticalCone: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      h: 2.0, // Cone height, set to 2.
      r1: 1.0, // Base radius of the cone, set to 1.
      r2: 0.5, // Tip radius of the cone, set to 0.5.
    },
    sdRoundCone: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      a: [0, 0, 0], // First cone endpoint, set to the origin for simplicity.
      b: [0, 1, 0], // Second cone endpoint, set to [0, 1, 0].
      r1: 1.0, // Base radius of the cone, set to 1.
      r2: 0.5, // Tip radius of the cone, set to 0.5.
    },
    sdSolidAngle: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      sincos: [0, 1], // Default to a basic angle, sin = 0, cos = 1.
      r: 1.0, // Threshold radius, set to 1.
    },
    sdPlane: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      n: [0, 1, 0], // Normal vector, set to [0, 1, 0].
      h: 0.0, // Distance from the origin to the plane, set to 0.
    },
    sdOctahedron: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      s: 1.0, // Scale of the octahedron, set to 1.
    },
    sdOctahedronBound: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      s: 1.0, // Scale of the octahedron, set to 1.
    },
    sdPyramid: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      h: 1.0, // Height of the pyramid, set to 1.
    },
    sdHexPrism: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      h: [1.0, 1.0], // Height, set to [1, 1].
    },
    sdTriPrism: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      h: [1.0, 1.0], // Height, set to [1, 1].
    },
    sdBezier: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      A: [0, 0, 0], // Control point A, set to the origin for simplicity.
      B: [0, 1, 0], // Control point B, set to [0, 1, 0].
      C: [0, 0, 1], // Control point C, set to [0, 0, 1].
    },
    udTriangle: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      a: [0, 0, 0], // Vertex A of the triangle, set to the origin for simplicity.
      b: [1, 0, 0], // Vertex B of the triangle, set to [1, 0, 0].
      c: [0, 1, 0], // Vertex C of the triangle, set to [0, 1, 0].
    },
    sdBunny: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
    },
  },
  BOOLEAN_OPS: {
    opUnion: {
      d1: 1.0, // First distance, set to 1.
      d2: 1.0, // Second distance, set to 1.
    },
    opSubtract: {
      d1: 1.0, // First distance, set to 1.
      d2: 1.0, // Second distance, set to 1.
    },
    opIntersect: {
      d1: 1.0, // First distance, set to 1.
      d2: 1.0, // Second distance, set to 1.
    },
    opChamferUnion: {
      d1: 1.0, // First distance, set to 1.
      d2: 1.0, // Second distance, set to 1.
      r: 0.1, // Chamfer radius, small value.
    },
    opChamferSubtract: {
      d1: 1.0, // First distance, set to 1.
      d2: 1.0, // Second distance, set to 1.
      r: 0.1, // Chamfer radius, small value.
    },
    opChamferIntersect: {
      d1: 1.0, // First distance, set to 1.
      d2: 1.0, // Second distance, set to 1.
      r: 0.1, // Chamfer radius, small value.
    },
    opSmoothUnion: {
      d1: 1.0, // First distance, set to 1.
      d2: 1.0, // Second distance, set to 1.
      k: 0.1, // Smoothness factor, small value.
    },
    opSmoothSubtract: {
      d1: 1.0, // First distance, set to 1.
      d2: 1.0, // Second distance, set to 1.
      k: 0.1, // Smoothness factor, small value.
    },
    opSmoothIntersect: {
      d1: 1.0, // First distance, set to 1.
      d2: 1.0, // Second distance, set to 1.
      k: 0.1, // Smoothness factor, small value.
    },
  },
  DISPLACEMENT_OPS: {
    opDisplace: {
      d1: 1.0, // First distance, set to 1.
      d2: 1.0, // Second distance, set to 1.
    },
    opTwist: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      k: 1.0, // Twist factor, set to 1.
    },
    opCheapBend: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      k: 1.0, // Bend factor, set to 1.
    },
  },
  POSITIONING_OPS: {
    opTranslate: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      t: [1, 1, 1], // Translation vector, set to [1, 1, 1].
    },
    op90RotateX: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
    },
    op90RotateY: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
    },
    op90RotateZ: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
    },
    opRotateX: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      a: 1.0, // Angle, set to 1 radian.
    },
    opRotateY: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      a: 1.0, // Angle, set to 1 radian.
    },
    opRotateZ: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      a: 1.0, // Angle, set to 1 radian.
    },
    opRotateE: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      e: [1, 0, 0], // Rotation axis, set to [1, 0, 0].
      a: 1.0, // Angle, set to 1 radian.
    },
    opScale: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      s: 1.0, // Scale factor, set to 1.
    },
    opTransform: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      transform: [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ], // Identity matrix.
    },
    opSymmetryX: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
    },
    opSymmetryY: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
    },
    opSymmetryZ: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
    },
    opInfArray: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      c: [1, 1, 1], // Repetition vector, set to [1, 1, 1].
    },
    opLimArray: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      c: 1.0, // Repetition step, set to 1.
      lim: [10, 10, 10], // Repetition limits, set to [10, 10, 10].
    },
  },
  PRIMITIVE_OPS: {
    opElongate: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      h: [1.0, 1.0, 1.0], // Elongation limits, set to unit values.
    },
    opElongateCorrect: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      h: [1.0, 1.0, 1.0], // Elongation limits, set to unit values.
    },
    opRound: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      r: 1.0, // Rounding radius, set to 1.
    },
    opOnion: {
      d: 1.0, // Distance, set to 1.
      thickness: 0.1, // Onion skin thickness, set to 0.1.
    },
    opExtrusion: {
      d: 1.0, // Distance, set to 1.
      z: 0.0, // Extrusion start, set to 0.
      h: 1.0, // Extrusion height, set to 1.
    },
    opRevolution: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
      o: 1.0, // Revolution radius, set to 1.
    },
    length4: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
    },
    length6: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
    },
    length8: {
      p: [0, 0, 0], // Point in space, set to the origin for simplicity.
    },
  },
}

// === 1. Contextual‐arguments meta map ===
const CONTEXTUAL_META = {
  p: {
    human_name: 'Point',
    description: 'The 3D point at which to evaluate the operation.',
    contextual: true,
  },
  d: {
    human_name: 'Distance',
    description: 'The signed distance input to the primitive operation.',
    contextual: true,
  },
  d1: {
    human_name: 'First Distance',
    description: 'The first signed distance input for the boolean/displacement operation.',
    contextual: true,
  },
  d2: {
    human_name: 'Second Distance',
    description: 'The second signed distance input for the boolean/displacement operation.',
    contextual: true,
  },
}

// === 2. Non‐contextual META_VALUES index ===
const META_VALUES = {
  DISTANCE_FUNCTIONS: {
    sdSphere: {
      r: { human_name: 'Radius', description: 'Radius of the sphere.', contextual: false },
    },
    sdEllipsoid: {
      r: {
        human_name: 'Radii',
        description: 'Ellipsoid radii along X, Y and Z axes.',
        contextual: false,
      },
    },
    sdBox: {
      b: {
        human_name: 'Half-size',
        description: 'Half-sizes of the box on each axis.',
        contextual: false,
      },
    },
    sdRoundBox: {
      b: {
        human_name: 'Half-size',
        description: 'Half-sizes of the box on each axis.',
        contextual: false,
      },
      r: {
        human_name: 'Corner Radius',
        description: 'Radius used to round the box edges.',
        contextual: false,
      },
    },
    sdBoxFrame: {
      b: {
        human_name: 'Half-size',
        description: 'Half-sizes of the box on each axis.',
        contextual: false,
      },
      e: {
        human_name: 'Edge Thickness',
        description: 'Thickness of the frame edges.',
        contextual: false,
      },
    },
    sdGyroid: {
      h: {
        human_name: 'Threshold',
        description: 'Threshold parameter controlling the gyroid.',
        contextual: false,
      },
    },
    sdTorus: {
      R: {
        human_name: 'Major Radius',
        description: 'Distance from the centre of the tube to torus centre.',
        contextual: false,
      },
      r: {
        human_name: 'Minor Radius',
        description: 'Radius of the tube itself.',
        contextual: false,
      },
    },
    sdCappedTorus: {
      R: {
        human_name: 'Major Radius',
        description: 'Distance from the centre of the tube to torus centre.',
        contextual: false,
      },
      r: {
        human_name: 'Minor Radius',
        description: 'Radius of the tube itself.',
        contextual: false,
      },
      sincos: {
        human_name: 'Sine/Cosine',
        description: 'Precomputed sine and cosine for cap orientation.',
        contextual: false,
      },
    },
    sdLink: {
      R: {
        human_name: 'Link Radius',
        description: 'Main radius of the link shape.',
        contextual: false,
      },
      r: {
        human_name: 'Tube Radius',
        description: 'Radius of the linking tube.',
        contextual: false,
      },
      le: {
        human_name: 'Extension',
        description: 'Length extension beyond the ring.',
        contextual: false,
      },
    },
    sdCapsule: {
      a: {
        human_name: 'Endpoint A',
        description: 'First endpoint of the capsule.',
        contextual: false,
      },
      b: {
        human_name: 'Endpoint B',
        description: 'Second endpoint of the capsule.',
        contextual: false,
      },
      r: {
        human_name: 'Radius',
        description: 'Radius around the line segment.',
        contextual: false,
      },
    },
    sdVerticalCapsule: {
      h: {
        human_name: 'Height',
        description: 'Height of the vertical capsule.',
        contextual: false,
      },
      r: {
        human_name: 'Radius',
        description: 'Radius of the vertical capsule.',
        contextual: false,
      },
    },
    sdCylinder: {
      a: {
        human_name: 'Base Point',
        description: "One end of the cylinder's axis.",
        contextual: false,
      },
      b: {
        human_name: 'Top Point',
        description: "Other end of the cylinder's axis.",
        contextual: false,
      },
      r: { human_name: 'Radius', description: 'Radius of the cylinder.', contextual: false },
    },
    sdVerticalCylinder: {
      h: {
        human_name: 'Half-height',
        description: 'Half the height of the vertical cylinder.',
        contextual: false,
      },
      r: {
        human_name: 'Radius',
        description: 'Radius of the vertical cylinder.',
        contextual: false,
      },
    },
    sdRoundedCylinder: {
      h: {
        human_name: 'Half-height',
        description: 'Half the height of the cylinder.',
        contextual: false,
      },
      r: { human_name: 'Radius', description: 'Radius of the cylinder.', contextual: false },
      re: {
        human_name: 'Edge Radius',
        description: 'Radius for the rounded edges.',
        contextual: false,
      },
    },
    sdInfiniteCylinder: {
      c: {
        human_name: 'Axis Center',
        description: 'XY center and Z-radius for infinite cylinder.',
        contextual: false,
      },
    },
    sdCone: {
      h: {
        human_name: 'Height',
        description: 'Height of the cone from apex to base.',
        contextual: false,
      },
      sincos: {
        human_name: 'Sine/Cosine',
        description: 'Sine and cosine of the cone angle.',
        contextual: false,
      },
    },
    sdConeBound: {
      h: {
        human_name: 'Height',
        description: 'Height of the cone from apex to base.',
        contextual: false,
      },
      sincos: {
        human_name: 'Sine/Cosine',
        description: 'Sine and cosine of the cone bound angle.',
        contextual: false,
      },
    },
    sdInfiniteCone: {
      sincos: {
        human_name: 'Sine/Cosine',
        description: 'Sine and cosine for the infinite cone angle.',
        contextual: false,
      },
    },
    sdCappedVerticalCone: {
      h: { human_name: 'Height', description: 'Height of the vertical cone.', contextual: false },
      r1: {
        human_name: 'Base Radius',
        description: 'Radius at the base of the cone.',
        contextual: false,
      },
      r2: {
        human_name: 'Top Radius',
        description: 'Radius at the tip of the cone.',
        contextual: false,
      },
    },
    sdCappedCone: {
      a: {
        human_name: 'Point A',
        description: 'First apex point of the capped cone.',
        contextual: false,
      },
      b: {
        human_name: 'Point B',
        description: 'Second apex point of the capped cone.',
        contextual: false,
      },
      ra: { human_name: 'Radius A', description: 'Radius at point A.', contextual: false },
      rb: { human_name: 'Radius B', description: 'Radius at point B.', contextual: false },
    },
    sdRoundVerticalCone: {
      h: { human_name: 'Height', description: 'Height of the vertical cone.', contextual: false },
      r1: { human_name: 'Base Radius', description: 'Radius at the base.', contextual: false },
      r2: { human_name: 'Tip Radius', description: 'Radius at the tip.', contextual: false },
    },
    sdRoundCone: {
      a: {
        human_name: 'Point A',
        description: 'First control point of the round cone.',
        contextual: false,
      },
      b: {
        human_name: 'Point B',
        description: 'Second control point of the round cone.',
        contextual: false,
      },
      r1: { human_name: 'Radius A', description: 'Radius at point A.', contextual: false },
      r2: { human_name: 'Radius B', description: 'Radius at point B.', contextual: false },
    },
    sdSolidAngle: {
      sincos: {
        human_name: 'Sine/Cosine',
        description: 'Sine and cosine defining the solid angle.',
        contextual: false,
      },
      r: {
        human_name: 'Radius',
        description: 'Threshold radius for the solid angle.',
        contextual: false,
      },
    },
    sdPlane: {
      n: {
        human_name: 'Normal',
        description: 'Unit normal vector of the plane.',
        contextual: false,
      },
      h: {
        human_name: 'Offset',
        description: 'Signed distance from origin along the normal.',
        contextual: false,
      },
    },
    sdOctahedron: {
      s: { human_name: 'Size', description: 'Scale of the octahedron.', contextual: false },
    },
    sdOctahedronBound: {
      s: { human_name: 'Size', description: 'Scale of the octahedron bound.', contextual: false },
    },
    sdPyramid: {
      h: { human_name: 'Height', description: 'Height of the pyramid.', contextual: false },
    },
    sdHexPrism: {
      h: {
        human_name: 'Heights',
        description: 'XY half-heights for the hexagonal prism.',
        contextual: false,
      },
    },
    sdTriPrism: {
      h: {
        human_name: 'Heights',
        description: 'Half-height & half-thickness for triangular prism.',
        contextual: false,
      },
    },
    sdBezier: {
      A: {
        human_name: 'Control A',
        description: 'First control point of the quadratic Bézier.',
        contextual: false,
      },
      B: {
        human_name: 'Control B',
        description: 'Second control point of the quadratic Bézier.',
        contextual: false,
      },
      C: {
        human_name: 'Control C',
        description: 'End point of the quadratic Bézier.',
        contextual: false,
      },
    },
    udTriangle: {
      a: {
        human_name: 'Vertex A',
        description: 'First vertex of the triangle.',
        contextual: false,
      },
      b: {
        human_name: 'Vertex B',
        description: 'Second vertex of the triangle.',
        contextual: false,
      },
      c: {
        human_name: 'Vertex C',
        description: 'Third vertex of the triangle.',
        contextual: false,
      },
    },
  },

  BOOLEAN_OPS: {
    opChamferUnion: {
      r: { human_name: 'Radius', description: 'Chamfer radius for union.', contextual: false },
    },
    opChamferSubtract: {
      r: {
        human_name: 'Radius',
        description: 'Chamfer radius for subtraction.',
        contextual: false,
      },
    },
    opChamferIntersect: {
      r: {
        human_name: 'Radius',
        description: 'Chamfer radius for intersection.',
        contextual: false,
      },
    },
    opSmoothUnion: {
      k: {
        human_name: 'Blend Factor',
        description: 'Smoothness factor for union.',
        contextual: false,
      },
    },
    opSmoothSubtract: {
      k: {
        human_name: 'Blend Factor',
        description: 'Smoothness factor for subtraction.',
        contextual: false,
      },
    },
    opSmoothIntersect: {
      k: {
        human_name: 'Blend Factor',
        description: 'Smoothness factor for intersection.',
        contextual: false,
      },
    },
  },

  DISPLACEMENT_OPS: {
    opTwist: {
      k: {
        human_name: 'Twist Strength',
        description: 'Twist applied per unit Y.',
        contextual: false,
      },
    },
    opCheapBend: {
      k: {
        human_name: 'Bend Strength',
        description: 'Bend applied per unit X.',
        contextual: false,
      },
    },
  },

  POSITIONING_OPS: {
    opTranslate: {
      t: {
        human_name: 'Translation',
        description: 'Vector by which to translate.',
        contextual: false,
      },
    },
    opRotateX: {
      a: {
        human_name: 'Angle',
        description: 'Rotation angle around X-axis (rad).',
        contextual: false,
      },
    },
    opRotateY: {
      a: {
        human_name: 'Angle',
        description: 'Rotation angle around Y-axis (rad).',
        contextual: false,
      },
    },
    opRotateZ: {
      a: {
        human_name: 'Angle',
        description: 'Rotation angle around Z-axis (rad).',
        contextual: false,
      },
    },
    opRotateE: {
      e: {
        human_name: 'Axis',
        description: 'Unit vector defining rotation axis.',
        contextual: false,
      },
      a: {
        human_name: 'Angle',
        description: 'Rotation angle about axis (rad).',
        contextual: false,
      },
    },
    opScale: {
      s: { human_name: 'Scale Factor', description: 'Uniform scale to apply.', contextual: false },
    },
    opTransform: {
      transform: {
        human_name: 'Matrix',
        description: '4×4 transform matrix to apply.',
        contextual: false,
      },
    },
    opInfArray: {
      c: {
        human_name: 'Spacing',
        description: 'Vector spacing for infinite repetition.',
        contextual: false,
      },
    },
    opLimArray: {
      c: { human_name: 'Spacing', description: 'Step distance for repetition.', contextual: false },
      lim: { human_name: 'Limits', description: 'Max repeats along each axis.', contextual: false },
    },
  },

  PRIMITIVE_OPS: {
    opElongate: {
      h: { human_name: 'Limits', description: 'Extent vector for elongation.', contextual: false },
    },
    opElongateCorrect: {
      h: { human_name: 'Limits', description: 'Extent vector for elongation.', contextual: false },
    },
    opRound: {
      r: { human_name: 'Radius', description: 'Amount to round the primitive.', contextual: false },
    },
    opOnion: {
      thickness: {
        human_name: 'Thickness',
        description: 'Onion shell thickness.',
        contextual: false,
      },
    },
    opExtrusion: {
      z: {
        human_name: 'Z-offset',
        description: 'Starting Z value for extrusion.',
        contextual: false,
      },
      h: {
        human_name: 'Half-height',
        description: 'Half-height of the extrusion.',
        contextual: false,
      },
    },
    opRevolution: {
      o: {
        human_name: 'Radius',
        description: 'Radius of revolution around Y-axis.',
        contextual: false,
      },
    },
  },
}

// === 3. Patch SD_LIB: inject defaults + both contextual and non-contextual meta ===
Object.keys(SD_LIB).forEach((category) => {
  Object.keys(SD_LIB[category]).forEach((fnName) => {
    const func = SD_LIB[category][fnName]
    func.meta = func.meta || {}
    func.getInstance = function () {
      const args = {}
      for (const [k, type] of Object.entries(func.args)) {
        if (CONTEXTUAL_ARGUMENTS[category]?.has(k)) continue
        if (func.defaults && k in func.defaults)
          args[k] = JSON.parse(JSON.stringify(func.defaults[k]))
      }

      let modifiers =
        category === 'DISTANCE_FUNCTIONS'
          ? [
              { op: 'opTranslate', args: { t: [0.0, -0.5, 0.0] } },
              { op: 'opRotateY', args: { a: 0 } },
              { op: 'opRotateX', args: { a: 0 } },
              { op: 'opRotateZ', args: { a: 0 } },
              { op: 'opScale', args: { s: 1 } },
            ]
          : undefined

      let material =
        category === 'DISTANCE_FUNCTIONS' ? { r: 5.0, g: 1.0, b: 0.0, a: 1.0 } : undefined
      return {
        op: fnName,
        args,
        material,
        modifiers,
        children: category === 'BOOLEAN_OPS' ? [] : undefined,
      }
    }

    Object.keys(func.args).forEach((arg) => {
      // a) defaults (skip contextual)
      if (!CONTEXTUAL_ARGUMENTS[category]?.has(arg)) {
        const dv = DEFAULT_VALUES[category]?.[fnName]?.[arg]
        if (dv !== undefined) {
          func.defaults = func.defaults || {}
          if (!(arg in func.defaults)) func.defaults[arg] = dv
        } else {
          console.warn(`No default for ${category}.${fnName}.${arg}`)
        }
      }

      // b) meta
      if (CONTEXTUAL_ARGUMENTS[category]?.has(arg)) {
        // use global contextual map
        if (CONTEXTUAL_META[arg]) {
          func.meta[arg] = CONTEXTUAL_META[arg]
        }
      } else {
        // use per‐function META_VALUES
        const m = META_VALUES[category]?.[fnName]?.[arg]
        if (m) {
          func.meta[arg] = m
        }
      }
    })
  })
})

class _SD_LIB {
  constructor() {
    Object.assign(this, SD_LIB)
    Object.entries(SD_LIB).forEach(([cat_name, cat]) => {
      Object.values(cat).forEach((fn_def) => {
        ;(fn_def.category = cat_name), (this[fn_def.fn_name] = fn_def)
      })
    })
  }
}

let lib = new _SD_LIB()
export default lib
