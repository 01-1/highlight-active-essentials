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

// Walks nested CSS (as Firefox parses it) and yields every declaration with
// the chain of selectors/at-rules enclosing it. Strings never contain braces
// or semicolons in this sheet, so a character scan is sufficient.
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
const target = (d) => rule(d).split(/\s+/).at(-1);
const path_ = (d) => d.selectors.join(' ');

test('package points at existing files and uses the mod id as the pref prefix', () => {
  assert.ok(fs.existsSync(path.join(root, theme.style)));
  assert.ok(fs.existsSync(path.join(root, theme.preferences)));
  assert.equal(theme.preferences, 'preferences.json');
  for (const pref of prefs) {
    assert.ok(pref.property.startsWith(prefix), pref.property);
    assert.ok(['dropdown', 'checkbox', 'string'].includes(pref.type), pref.property);
    if (pref.type === 'dropdown') {
      assert.ok(pref.options.some((o) => o.value === pref.defaultValue), pref.property);
      assert.equal(pref.placeholder, false, pref.property);
    }
    for (const condition of pref.conditions ?? []) {
      const { property, value } = condition.if ?? condition.not;
      const referenced = byProperty.get(property);
      assert.ok(referenced, `${pref.property} condition references ${property}`);
      assert.ok(referenced.options.some((o) => o.value === value), `${property}=${value}`);
    }
  }
});

test('every preference the stylesheet reads exists with a matching option', () => {
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

test('every non-default option and every checkbox changes something', () => {
  for (const pref of prefs) {
    if (pref.type === 'checkbox') assert.ok(css.includes(`-moz-pref("${pref.property}")`), pref.property);
    if (pref.type !== 'dropdown') continue;
    for (const { value } of pref.options) {
      if (value === pref.defaultValue) continue;
      assert.ok(css.includes(`-moz-pref("${pref.property}", "${value}")`), `${pref.property}=${value}`);
    }
  }
});

test('defaults are the fall-through: the sheet never needs the default value to be written', () => {
  // Sine only writes a preference once its settings panel is opened, so a
  // default must be what happens when -moz-pref() reports nothing at all.
  for (const pref of prefs.filter((p) => p.type === 'dropdown')) {
    const positive = new RegExp(`(^|[^t] )-moz-pref\\("${pref.property.replaceAll('.', '\\.')}", "${pref.defaultValue}"\\)`, 'm');
    assert.ok(!positive.test(css), `${pref.property} relies on its default being written`);
  }
  assert.equal(byProperty.get(`${prefix}loaded.hide-on-selected`).defaultValue, false);
});

test('only touches properties that Zen, Firefox, and Neo Zen leave alone', () => {
  const allowed = {
    '.tab-background': ['outline', 'outline-offset'],
    '.tab-icon-image': ['opacity', 'filter', 'transition'],
    '.tab-content': ['position'],
    '.tab-content::after': null, // owned entirely by this mod
  };
  for (const d of decls) {
    const element = target(d);
    if (d.property.startsWith('--')) {
      assert.equal(element, '.tabbrowser-tab[zen-essential="true"]', path_(d));
      continue;
    }
    assert.ok(element in allowed, `${d.property} on unexpected element ${element}`);
    if (allowed[element]) assert.ok(allowed[element].includes(d.property), `${d.property} on ${element}`);
    if (element !== '.tab-content::after') assert.match(d.value, /!important$/, `${d.property} on ${element}`);
  }
  assert.ok(!/\.tab-background::(before|after)/.test(code));
  for (const d of decls) {
    if (target(d).startsWith('.tabbrowser-tab')) assert.ok(d.property.startsWith('--'), `${d.property} set on the tab element itself`);
  }
});

test('loaded and unloaded rules cannot both match the same tab', () => {
  const marker = (d) => ['outline', 'filter', 'content', 'position'].includes(d.property) && d.value !== 'none !important';
  const essential = (d) => d.selectors.some((s) => s.includes('[zen-essential="true"]'));
  for (const d of decls.filter((d) => !d.property.startsWith('--'))) {
    assert.ok(essential(d), path_(d));
    const p = path_(d);
    if (target(d) === '.tab-icon-image' && d.property === 'opacity') assert.ok(p.includes('[pending]'), p);
    else if (marker(d) && !p.includes('[pending] ') && !p.includes('[discarded]')) assert.ok(p.includes(':not([pending])'), p);
  }
});

test('explicit scope only dims [discarded] tabs and "never" restores full color', () => {
  const dims = decls.filter((d) => d.property === 'opacity' && d.value.includes('--hae-unloaded-opacity'));
  assert.equal(dims.length, 2);
  const explicit = dims.find((d) => d.context.some((c) => c.includes('"explicit")') && !c.startsWith('@media not')));
  const all = dims.find((d) => d !== explicit);
  assert.ok(rule(explicit).includes('[pending][discarded]'), path_(explicit));
  assert.ok(rule(all).includes('[pending]') && !rule(all).includes('discarded'), path_(all));
  assert.ok(all.context.some((c) => c.startsWith('@media not') && c.includes('"explicit")')));
  const never = decls.find((d) => d.property === 'opacity' && d.value === '1 !important' && !d.property.startsWith('--'));
  assert.ok(never.context.some((c) => c.includes('"never")')));
  assert.equal(rule(never), '.tabbrowser-tab[zen-essential="true"][pending] .tab-icon-image');
});

test('README documents every setting', () => {
  const readme = read('README.md');
  for (const pref of prefs) {
    const label = pref.label.split(' (')[0];
    assert.ok(readme.includes(label), `README is missing "${label}"`);
  }
  assert.ok(readme.includes('Neo Zen'));
});
