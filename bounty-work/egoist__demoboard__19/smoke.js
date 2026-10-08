// Usage: node smoke.js <repo-root>
const path = require('path')
const Module = require('module')
const assert = require('assert')
const repo = path.resolve(process.argv[2])
const req = m => require(require.resolve(m, { paths: [repo] }))
const babel = req('@babel/core')

// Compile the repo's own src/ files with the repo's babel.config.js
const origJs = Module._extensions['.js']
Module._extensions['.js'] = function (mod, filename) {
  if (filename.startsWith(path.join(repo, 'src') + path.sep)) {
    const code = require('fs').readFileSync(filename, 'utf8')
    // Pass 1: the repo's own config (poi/babel + emotion css prop)
    const esm = babel.transformSync(code, { filename, cwd: repo })
    // Pass 2: ESM -> CJS only, so Node can require it
    const out = babel.transformSync(esm.code, {
      filename,
      configFile: false,
      babelrc: false,
      plugins: [require.resolve('@babel/plugin-transform-modules-commonjs', { paths: [repo] })]
    })
    return mod._compile(out.code, filename)
  }
  return origJs(mod, filename)
}

global.window = { outerWidth: 1280, innerHeight: 800 }

const React = req('react')
const { renderToStaticMarkup } = req('react-dom/server')
const { MemoryRouter } = req('react-router-dom')
const h = React.createElement

const { normalizeSocialLinks } = require(path.join(repo, 'src/utils/socialLinks.js'))
const { SocialLinks } = require(path.join(repo, 'src/SocialLinks.js'))
const { Sidebar } = require(path.join(repo, 'src/Sidebar.js'))
const { create } = require(path.join(repo, 'src/index.js'))

let n = 0
const ok = (cond, msg) => { assert.ok(cond, msg); n++; console.log('  ok -', msg) }
const strip = html => html.replace(/<style[^>]*>.*?<\/style>/gs, '')
const hrefs = html => [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map(m => m[1])

console.log('normalizeSocialLinks')
const obj = normalizeSocialLinks({
  donate: 'https://patreon.com/egoist',
  twitter: '@_egoistlily',
  github: 'egoist/demoboard',
  custom: [{ title: 'Website', link: 'https://egoist.sh' }, 'https://chat.egoist.moe/']
})
assert.deepStrictEqual(obj.map(l => [l.type, l.link, l.title]), [
  ['github', 'https://github.com/egoist/demoboard', 'GitHub'],
  ['twitter', 'https://twitter.com/_egoistlily', 'Twitter'],
  ['donate', 'https://patreon.com/egoist', 'Donate'],
  ['custom', 'https://egoist.sh', 'Website'],
  ['custom', 'https://chat.egoist.moe/', 'chat.egoist.moe']
])
ok(true, 'object form: fixed github/twitter/donate order, shorthands expanded, custom titles default to readable URL')

const arr = normalizeSocialLinks([
  { type: 'twitter', link: 'https://x.com/_egoistlily' },
  { type: 'github', link: 'https://gitlab.com/egoist/demoboard', title: 'Source' },
  { title: 'Docs', link: '/docs' }
])
assert.deepStrictEqual(arr.map(l => [l.type, l.link, l.title]), [
  ['twitter', 'https://x.com/_egoistlily', 'Twitter'],
  ['github', 'https://gitlab.com/egoist/demoboard', 'Source'],
  ['custom', '/docs', 'Docs']
])
ok(true, 'array form keeps given order; absolute URLs and custom titles are kept as-is')

const proto = normalizeSocialLinks([
  { type: 'constructor', link: 'https://a.example' },
  { type: '__proto__', link: 'https://b.example' },
  { type: 'toString', link: 'https://c.example', title: 'C' },
  { type: 'hasOwnProperty', link: 'https://d.example' }
])
assert.deepStrictEqual(proto.map(l => [l.type, l.title]), [
  ['custom', 'a.example'], ['custom', 'b.example'], ['custom', 'C'], ['custom', 'd.example']
])
ok(true, 'Object.prototype names as type fall back to custom (no inherited lookups)')

const protoObj = normalizeSocialLinks({ constructor: 'x', toString: 'y', custom: [] })
assert.deepStrictEqual(protoObj, [])
ok(true, 'object form ignores inherited keys')

for (const v of [undefined, null, false, '', 'egoist', 42, [], {}]) {
  assert.deepStrictEqual(normalizeSocialLinks(v), [], String(v))
}
ok(true, 'empty / invalid option values -> no links')

const dropped = normalizeSocialLinks({
  github: false, twitter: '', donate: { title: 'x' },
  custom: [null, { title: 'no link' }, { link: '   ' }, { link: 42 }, { link: 'https://ok.example' }]
})
assert.deepStrictEqual(dropped.map(l => l.link), ['https://ok.example'])
ok(true, 'entries without a usable link are dropped')

const objOverride = normalizeSocialLinks({ github: { link: 'egoist/demoboard', title: 'Source code', type: 'twitter' } })
assert.deepStrictEqual(objOverride.map(l => [l.type, l.link, l.title]), [['github', 'https://github.com/egoist/demoboard', 'Source code']])
ok(true, 'object value overrides title; key decides the type')

const hosts = normalizeSocialLinks({ github: 'github.com/egoist/demoboard', twitter: 'www.twitter.com/_egoistlily' })
assert.deepStrictEqual(hosts.map(l => l.link), ['https://github.com/egoist/demoboard', 'https://twitter.com/_egoistlily'])
const slashes = normalizeSocialLinks({ github: '/egoist', twitter: '_egoistlily' })
assert.deepStrictEqual(slashes.map(l => l.link), ['https://github.com/egoist', 'https://twitter.com/_egoistlily'])
ok(true, 'scheme-less host-prefixed and slash-prefixed shorthands expand to a single host')

console.log('SocialLinks render')
ok(renderToStaticMarkup(h(SocialLinks, {})) === '', 'renders nothing without links')
ok(renderToStaticMarkup(h(SocialLinks, { links: { custom: [] } })) === '', 'renders nothing for an empty config')

const icon = h('svg', { className: 'discord-icon' })
const html = strip(renderToStaticMarkup(h(SocialLinks, {
  links: {
    github: 'egoist/demoboard',
    twitter: '_egoistlily',
    donate: 'https://patreon.com/egoist',
    custom: [
      { title: 'Website', link: 'https://egoist.sh' },
      { title: 'Discord', link: 'https://chat.egoist.moe', icon }
    ]
  }
})))
assert.deepStrictEqual(hrefs(html), [
  'https://github.com/egoist/demoboard', 'https://twitter.com/_egoistlily',
  'https://patreon.com/egoist', 'https://egoist.sh', 'https://chat.egoist.moe'
])
ok(true, 'renders one <a> per link in order with expanded hrefs')
ok((html.match(/target="_blank" rel="noopener noreferrer"/g) || []).length === 5, 'all links open in a new tab with rel=noopener noreferrer')
ok(/aria-label="GitHub"/.test(html) && /aria-label="Twitter"/.test(html) && /aria-label="Donate"/.test(html), 'built-in links are icon-only with aria-label')
ok(/title="Website"[^>]*>.*?<\/svg><span[^>]*>Website<\/span><\/a>/.test(html) && !/aria-label="Website"/.test(html), 'custom link without icon shows Feather link icon + visible title')
ok(/aria-label="Discord"[^>]*><svg class="discord-icon"><\/svg><\/a>/.test(html), 'custom link with icon renders the given icon only')
ok((html.match(/stroke="currentColor"/g) || []).length === 4, 'Feather (stroke) icons used for the 4 default icons')

const protoHtml = strip(renderToStaticMarkup(h(SocialLinks, { links: [{ type: 'constructor', link: 'https://a.example' }] })))
ok(/<span[^>]*>a\.example<\/span>/.test(protoHtml) && !/function/.test(protoHtml), 'type "constructor" renders as a normal custom link')

console.log('Sidebar render')
const demoboard = create()
demoboard.section('Buttons').add('Primary Button', { component: () => null })
const sidebar = props => strip(renderToStaticMarkup(h(MemoryRouter, null, h(Sidebar, Object.assign({
  title: 'Demo', boards: [demoboard], showMenu: true, setShowMenu() {}, isWide: true
}, props)))))
const withLinks = sidebar({ socialLinks: { github: 'egoist/demoboard' } })
ok(withLinks.indexOf('Primary Button') > -1 && withLinks.indexOf('Primary Button') < withLinks.indexOf('https://github.com/egoist/demoboard'), 'social links render after the boards inside the menu')
const without = sidebar({})
ok(without.indexOf('Primary Button') > -1 && !/<a [^>]*target="_blank"/.test(without), 'sidebar without socialLinks renders as before (no social section)')
ok(sidebar({ showMenu: false, socialLinks: { github: 'a/b' } }).indexOf('github.com') === -1, 'collapsed menu hides the social links with the rest of the menu')

console.log(`\n${n} checks passed`)
// the stub window makes React's scheduler keep polling; exit explicitly
process.exit(0)
