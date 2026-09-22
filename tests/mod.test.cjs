const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const theme = JSON.parse(read('theme.json'));
const prefs = JSON.parse(read('preferences.json')).filter((p) => p.property);
const css = read(theme.style);
const prefix = `mod.${theme.id}.`;
const byProperty = new Map(prefs.map((p) => [p.property, p]));

function declarations(source) {
  const out = [];
  const stack = [];
  let buffer = '';
  for (const char of source.replace(/\/\*[\s\S]*?\*\//g, '')) {
    if (char === '{') { stack.push(buffer.trim()); buffer = ''; }
    else if (char === '}') { assert.ok(stack.length, 'unbalanced }'); stack.pop(); buffer = ''; }
    else if (char === ';') {
      const [property, ...value] = buffer.split(':');
      if (property.trim()) out.push({
        property: property.trim(), value: value.join(':').trim(),
        selectors: stack.filter((s) => !s.startsWith('@')), context: [...stack],
      });
      buffer = '';
    } else buffer += char;
  }
  assert.equal(stack.length, 0, 'unbalanced {');
  assert.equal(buffer.trim(), '', 'trailing text outside a block');
  return out;
}

const decls = declarations(css);
const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
const rule = (d) => d.selectors.at(-1);
const targets = (d) => rule(d).split(',').map((s) => s.trim().split(/\s+/).at(-1));
const path_ = (d) => d.selectors.join(' ');

function conditionLeaves(conditions) {
  return (conditions ?? []).flatMap((condition) => {
    if (condition.if || condition.not) return [condition.if ?? condition.not];
    return conditionLeaves(condition.conditions);
  });
}

test('package metadata supports GitHub updates and every preference uses the new mod id', () => {
  const homepage = new URL(theme.homepage);
  assert.equal(theme.id, 'tab-state-highlighter');
  assert.equal(theme.name, 'Tab State Highlighter');
  assert.equal(homepage.origin, 'https://github.com');
  assert.equal(homepage.pathname, `/01-1/${theme.id}`);
  assert.match(theme.version, /^2\./);
  assert.ok(Date.parse(theme.updatedAt) > Date.parse(theme.createdAt));
  assert.ok(fs.existsSync(path.join(root, theme.style)));
  assert.ok(fs.existsSync(path.join(root, theme.preferences)));

  for (const pref of prefs) {
    assert.ok(pref.property.startsWith(prefix), pref.property);
    assert.ok(['dropdown', 'checkbox', 'string'].includes(pref.type), pref.property);
    if (pref.type === 'dropdown') {
      assert.ok(pref.options.some((o) => o.value === pref.defaultValue), pref.property);
      assert.equal(pref.placeholder, false, pref.property);
    }
    if (conditionLeaves(pref.conditions).length > 1 && (pref.conditions ?? []).some((c) => c.not)) {
      assert.equal(pref.operator, 'AND', pref.property);
    }
    for (const { property, value } of conditionLeaves(pref.conditions)) {
      const referenced = byProperty.get(property);
      assert.ok(referenced, `${pref.property} condition references ${property}`);
      assert.ok(referenced.options.some((o) => o.value === value), `${property}=${value}`);
    }
  }
});

test('every stylesheet preference and generated variable has a matching setting', () => {
  const uses = [...css.matchAll(/-moz-pref\("([^"]+)"(?:,\s*"([^"]*)")?\)/g)];
  assert.ok(uses.length > 0);
  for (const [, property, value] of uses) {
    const pref = byProperty.get(property);
    assert.ok(pref, `unknown preference ${property}`);
    if (value === undefined) assert.equal(pref.type, 'checkbox', property);
    else assert.ok(pref.options.some((o) => o.value === value), `${property}=${value}`);
  }
  for (const [, name] of css.matchAll(/var\(--mod-([a-z0-9-]+)/g)) {
    const pref = prefs.find((p) => p.property.replaceAll('.', '-') === `mod-${name}`);
    assert.equal(pref?.type, 'string', name);
  }
});

test('every non-default dropdown option and checkbox changes the stylesheet', () => {
  for (const pref of prefs) {
    if (pref.type === 'checkbox') assert.ok(css.includes(`-moz-pref("${pref.property}")`), pref.property);
    if (pref.type !== 'dropdown') continue;
    for (const { value } of pref.options) {
      if (value === pref.defaultValue) continue;
      assert.ok(css.includes(`-moz-pref("${pref.property}", "${value}")`), `${pref.property}=${value}`);
    }
  }
});

test('default dropdown values are fall-through behavior', () => {
  for (const pref of prefs.filter((p) => p.type === 'dropdown')) {
    const positive = new RegExp(`(^|[^t] )-moz-pref\\("${pref.property.replaceAll('.', '\\.')}", "${pref.defaultValue}"\\)`, 'm');
    assert.ok(!positive.test(css), `${pref.property} relies on its default being written`);
  }
  assert.equal(byProperty.get(`${prefix}loaded.effect`).defaultValue, 'ring');
  assert.equal(byProperty.get(`${prefix}unloaded.effect`).defaultValue, 'off');
  assert.equal(byProperty.get(`${prefix}unloaded.color`).defaultValue, 'same');
});

test('the stylesheet only changes the documented tab sub-elements', () => {
  const allowed = {
    '.tabbrowser-tab': ['filter'],
    '.tab-background': ['outline', 'outline-offset'],
    '.tab-background::after': null,
    '.tab-icon-image': ['opacity', 'filter', 'transition'],
    '.tab-stack': ['opacity', 'filter', 'transition'],
    '.tab-content': ['position'],
    '.tab-content::after': null,
  };
  for (const d of decls) {
    for (const element of targets(d)) {
      if (d.property.startsWith('--')) {
        assert.equal(element, '.tabbrowser-tab', path_(d));
        continue;
      }
      const key = element.startsWith('.tabbrowser-tab') ? '.tabbrowser-tab' : element;
      assert.ok(key in allowed, `${d.property} on unexpected element ${element}`);
      if (allowed[key]) assert.ok(allowed[key].includes(d.property), `${d.property} on ${element}`);
      if (allowed[key] && element !== '.tab-content::after') assert.match(d.value, /!important$/, `${d.property} on ${element}`);
    }
  }
  assert.ok(!/\.tab-background::before/.test(code));
  assert.ok(!code.includes('[zen-essential]'));
});

test('loaded and unloaded visual rules target mutually exclusive tab states', () => {
  const visual = decls.filter((d) => !d.property.startsWith('--'));
  for (const d of visual) {
    const p = path_(d);
    assert.ok(p.includes('.tabbrowser-tab'), p);
    if (d.property === 'opacity') assert.ok(p.includes('[pending]'), p);
    const isMarker = d.property === 'outline' || d.property === 'position' ||
      (d.property === 'content' && d.value === '""') || d.value.includes('drop-shadow');
    if (isMarker) {
      const loaded = p.includes('.tabbrowser-tab:not([pending])');
      const unloaded = p.includes('.tabbrowser-tab[pending]');
      assert.notEqual(loaded, unloaded, p);
    }
  }
});

test('loaded and unloaded effects are separate and unloaded can copy loaded appearance', () => {
  const loaded = byProperty.get(`${prefix}loaded.effect`);
  const unloaded = byProperty.get(`${prefix}unloaded.effect`);
  assert.deepEqual(loaded.options.map((o) => o.value), ['ring', 'tab-glow', 'tab-overlay-glow', 'glow', 'dot', 'ring-dot', 'off']);
  assert.deepEqual(unloaded.options.map((o) => o.value), ['same', 'ring', 'tab-glow', 'tab-overlay-glow', 'glow', 'dot', 'ring-dot', 'off']);
  assert.ok(css.includes('-moz-pref("mod.tab-state-highlighter.unloaded.effect", "same")'));
  assert.match(css, /var\(--tsh-loaded-ring-width\) solid var\(--tsh-loaded-color\)/);
  assert.match(css, /var\(--tsh-loaded-dot-size\)/);
  assert.match(css, /var\(--tsh-loaded-glow-color\)/);
});

test('whole-tab glow never draws a ring', () => {
  const outlines = decls.filter((d) => d.property === 'outline' && d.value.includes('-ring-width'));
  assert.ok(outlines.length >= 3, 'ring rules missing');
  for (const d of outlines) {
    const positiveEffects = d.context.filter((c) => !c.startsWith('@media not') && c.includes('.effect'));
    const explicitRing = positiveEffects.some((c) => c.includes('"ring"') || c.includes('"ring-dot"'));
    const excludesTabGlow = d.context.some((c) => c.startsWith('@media not') && c.includes('"tab-glow"'));
    assert.ok(explicitRing || excludesTabGlow, path_(d));
  }
});

test('outside and overlay whole-tab glows remain separate options', () => {
  const wholeTabGlows = decls.filter((d) =>
    d.property === 'filter' &&
    d.value.includes('drop-shadow') &&
    d.context.some((c) => !c.startsWith('@media not') && c.includes('"tab-glow"'))
  );
  assert.equal(wholeTabGlows.length, 3);
  for (const d of wholeTabGlows) assert.ok(targets(d)[0].startsWith('.tabbrowser-tab'), path_(d));

  const overlayGlows = decls.filter((d) =>
    d.property === 'background' &&
    d.value.includes('radial-gradient') &&
    d.context.some((c) => c.includes('"tab-overlay-glow"'))
  );
  assert.equal(overlayGlows.length, 3);
  for (const d of overlayGlows) assert.deepEqual(targets(d), ['.tab-background::after'], path_(d));
});

test('numeric marker controls are state-specific and glow strength is uncapped without changing radius', () => {
  const numeric = {
    [`${prefix}loaded.ring-width`]: 2,
    [`${prefix}loaded.glow-strength`]: 100,
    [`${prefix}loaded.dot-size`]: 5,
    [`${prefix}unloaded.ring-width`]: 2,
    [`${prefix}unloaded.glow-strength`]: 100,
    [`${prefix}unloaded.dot-size`]: 5,
  };
  for (const [property, defaultValue] of Object.entries(numeric)) {
    const pref = byProperty.get(property);
    assert.equal(pref?.type, 'string', property);
    assert.equal(pref?.value, 'num', property);
    assert.equal(pref?.defaultValue, defaultValue, property);
    assert.ok(css.includes(`var(--${property.replaceAll('.', '-')}, ${defaultValue})`), property);
  }

  const radius = decls.find((d) => d.property === '--tsh-glow-radius');
  assert.equal(radius?.value, '5px');
  for (const state of ['loaded', 'unloaded']) {
    const level = decls.find((d) => d.property === `--tsh-${state}-glow-level`);
    const opacity = decls.find((d) => d.property === `--tsh-${state}-glow-opacity`);
    assert.match(level?.value, new RegExp(`${state}-glow-strength`));
    assert.ok(!level.value.includes('clamp'));
    assert.match(opacity?.value, /\/ \(var\(.+-glow-level\) \+ 50\)/);
  }

  const glowFilters = decls.filter((d) => d.property === 'filter' && d.value.includes('drop-shadow'));
  assert.equal(glowFilters.length, 6);
  for (const d of glowFilters) {
    assert.equal([...d.value.matchAll(/drop-shadow/g)].length, 3);
    assert.equal([...d.value.matchAll(/var\(--tsh-glow-radius\)/g)].length, 3);
  }
});

test('explicit fading scope only dims discarded tabs and never restores full color', () => {
  const dims = decls.filter((d) => d.property === 'opacity' && d.value.includes('--tsh-unloaded-opacity'));
  assert.deepEqual(dims.map((d) => targets(d)[0]).sort(), ['.tab-icon-image', '.tab-icon-image', '.tab-stack', '.tab-stack']);
  for (const d of dims) {
    const explicit = d.context.some((c) => !c.startsWith('@media not') && c.includes('"explicit"'));
    if (explicit) assert.ok(path_(d).includes('[pending][discarded]'), path_(d));
    else {
      assert.ok(d.context.some((c) => c.startsWith('@media not') && c.includes('"explicit"')), path_(d));
      assert.ok(!path_(d).includes('discarded'), path_(d));
    }
  }
  const never = decls.find((d) => d.property === 'opacity' && d.value === '1 !important' && d.context.some((c) => c.includes('"never"')));
  assert.ok(never, 'never block missing');
  assert.deepEqual(targets(never).sort(), ['.tab-icon-image', '.tab-stack']);
  assert.ok(never.selectors.includes('.tabbrowser-tab[pending]'));
});

test('README documents every setting and the renamed repository', () => {
  const readme = read('README.md');
  assert.ok(readme.startsWith('# Tab State Highlighter'));
  assert.ok(readme.includes(theme.homepage));
  for (const pref of prefs) {
    const label = pref.label.split(' (')[0];
    assert.ok(readme.includes(label), `README is missing "${label}"`);
  }
  assert.ok(readme.includes('Same as loaded tabs'));
  assert.ok(readme.includes('Neo Zen'));
});
