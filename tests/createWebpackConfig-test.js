import expect from 'expect'

import createWebpackConfig, {
  COMPAT_CONFIGS,
  getCompatConfig,
  mergeLoaderConfig,
  styleLoaderName,
} from '../src/createWebpackConfig'

function findSassPipelineRule(rules) {
  return rules.filter(rule =>
    rule.test.test('.scss') && rule.exclude
  )[0]
}

function findVendorSassPipelineRule(rules) {
  return rules.filter(rule =>
    rule.test.test('.scss') && rule.include
  )[0]
}

describe('createWebpackConfig()', () => {
  context('with only entry config', () => {
    let config = createWebpackConfig({entry: ['index.js']})
    it('creates a default webpack build config', () => {
      expect(Object.keys(config)).toEqual(['module', 'output', 'plugins', 'resolve', 'entry'])
      expect(config.module.loaders.map(loader => loader.loader || loader.loaders).join('\n'))
        .toContain('babel-loader')
        .toContain('extract-text-webpack-plugin')
        .toContain('css-loader')
        .toContain('postcss-loader')
        .toContain('url-loader')
        .toContain('json-loader')
      expect(config.resolve.extensions).toEqual(['.js', '.json'])
    })
    it('excludes node_modules from babel-loader', () => {
      expect(config.module.loaders[0].exclude.test('node_modules')).toBe(true)
    })
    it('adds default polyfills to the entry chunk', () => {
      expect(config.entry).toEqual([require.resolve('../polyfills'), 'index.js'])
    })
  })

  context('with server config', () => {
    let config = createWebpackConfig({entry: ['index.js'], server: {}})
    it('creates a server webpack config', () => {
      expect(config.module.loaders.map(loader => {
        // The style pipeline will have a list of chained loaders
        if (Array.isArray(loader.loaders)) return loader.loaders.map(loader => loader.loader).join('\n')
        return loader.loader
      }).join('\n'))
        .toContain('babel-loader')
        .toContain('style-loader')
        .toContain('css-loader')
        .toContain('postcss-loader')
        .toContain('url-loader')
        .toContain('json-loader')
      expect(config.resolve.extensions).toEqual(['.js', '.json'])
    })
  })

  context('with polyfill=false config', () => {
    let config = createWebpackConfig({entry: ['index.js'], polyfill: false})
    it('skips default polyfilling', () => {
      expect(config.entry).toEqual(['index.js'])
    })
  })

  let cssPreprocessorPluginConfig = {
    cssPreprocessors: {
      sass: {
        test: /\.scss$/,
        loader: 'path/to/sass-loader.js',
      }
    }
  }

  context('with plugin config for a CSS preprocessor', () => {
    let config = createWebpackConfig({server: true}, cssPreprocessorPluginConfig)
    it('creates a style loading pipeline', () => {
      let loader = findSassPipelineRule(config.module.loaders)
      expect(loader).toExist()
      expect(loader.loaders).toMatch([
        {loader: /style-loader/},
        {loader: /css-loader/},
        {loader: /postcss-loader/},
        {loader: /path\/to\/sass-loader\.js$/},
      ])
      expect(loader.exclude.test('node_modules')).toBe(true, 'app loader should exclude node_modules')
    })
    it('creates a vendor style loading pipeline', () => {
      let loader = findVendorSassPipelineRule(config.module.loaders, 'vendor-sass-pipeline')
      expect(loader).toExist()
      expect(loader.loaders).toMatch([
        {loader: /style-loader/},
        {loader: /css-loader/},
        {loader: /postcss-loader/},
        {loader: /path\/to\/sass-loader\.js$/},
      ])
      expect(loader.include.test('node_modules')).toBe(true, 'vendor loader should include node_modules')
    })
  })

  context('with plugin config for a CSS preprocessor and user config for its loader', () => {
    let config = createWebpackConfig({server: true}, cssPreprocessorPluginConfig, {
      webpack: {
        loaders: {
          sass: {
            query: {
              a: 1,
              b: 2,
            }
          }
        }
      }
    })
    it('applies user config to the preprocessor loader', () => {
      let loader = findSassPipelineRule(config.module.loaders, 'sass-pipeline')
      expect(loader).toExist()
      expect(loader.loaders).toMatch([
        {loader: /style-loader/},
        {loader: /css-loader/},
        {loader: /postcss-loader/},
        {
          loader: /path\/to\/sass-loader\.js$/,
          query: {a: 1, b: 2},
        },
      ])
    })
    it('only applies user config to the appropriate loader', () => {
      let loader = findVendorSassPipelineRule(config.module.loaders, 'vendor-sass-pipeline')
      expect(loader).toExist()
      expect(loader.loaders).toMatch([
        {loader: /style-loader/},
        {loader: /css-loader/},
        {loader: /postcss-loader/},
        {loader: /path\/to\/sass-loader\.js$/},
      ])
    })
  })

  context('with aliases config', () => {
    it('sets up resolve.alias', () => {
      let config = createWebpackConfig({}, {}, {
        webpack: {
          aliases: {
            src: 'test'
          }
        }
      })
      expect(config.resolve.alias.src).toEqual('test')
    })
    it('overwrites build resolve.alias config', () => {
      let config = createWebpackConfig({
        resolve: {
          alias: {
            src: 'fail'
          }
        }
      }, {}, {
        webpack: {
          aliases: {
            src: 'pass'
          }
        }
      })
      expect(config.resolve.alias.src).toEqual('pass')
    })
  })

  context('with aliases config', () => {
    it('overwrites build output.publicPath config', () => {
      let config = createWebpackConfig({
        output: {
          publicPath: 'fail'
        }
      }, {}, {
        webpack: {
          publicPath: 'pass'
        }
      })
      expect(config.output.publicPath).toEqual('pass')
    })
  })

  context('with compat config', () => {
    it('creates and merges compat config', () => {
      let config = createWebpackConfig({}, {}, {
        webpack: {
          compat: {
            enzyme: true,
          }
        }
      })
      expect(config.externals).toEqual(COMPAT_CONFIGS.enzyme.externals)
    })
  })

  context('with extra config', () => {
    it('merges extra config', () => {
      let config = createWebpackConfig({}, {}, {
        webpack: {
          extra: {
            resolve: {
              alias: {
                'test': './test',
              }
            },
            foo: 'bar',
          }
        }
      })
      expect(config.resolve.alias).toEqual({'test': './test'})
      expect(config.foo).toEqual('bar')
    })
  })
})

describe('styleLoaderName()', () => {
  it('returns the given value if a falsy prefix was given', () => {
    let name = styleLoaderName(null)
    expect(name('css')).toEqual('css')
    expect(name('style')).toEqual('style')
  })
  it('prefixes the value if a prefix was given', () => {
    let name = styleLoaderName('vendor')
    expect(name('css')).toEqual('vendor-css')
    expect(name('style')).toEqual('vendor-style')
  })
  it('returns the prefix if it ends with the given value', () => {
    let name = styleLoaderName('sass')
    expect(name('css')).toEqual('sass-css')
    expect(name('sass')).toEqual('sass')
    name = styleLoaderName('vendor-sass')
    expect(name('css')).toEqual('vendor-sass-css')
    expect(name('sass')).toEqual('vendor-sass')
  })
})

describe('mergeLoaderConfig()', () => {
  const TEST_RE = /\.test$/
  const EXCLUDE_RE = /node_modules/
  let loader = {test: TEST_RE, loader: 'one', exclude: EXCLUDE_RE}
  it('merges default, build and user config for a loader', () => {
    expect(mergeLoaderConfig(
      {...loader, query: {a: 1}},
      {query: {b: 2}},
      {query: {c: 3}},
    )).toEqual({
      test: TEST_RE,
      loader: 'one',
      exclude: EXCLUDE_RE,
      query: {a: 1, b: 2, c: 3},
    })
  })
  it('only adds a query prop if the merged query has props', () => {
    expect(mergeLoaderConfig(loader, {}, {})).toEqual({
      test: TEST_RE,
      loader: 'one',
      exclude: EXCLUDE_RE,
    })
  })
  it('removes the merged query when it has no properties', () => {
    expect(mergeLoaderConfig(loader, {}, {query: {}})).toEqual({
      test: TEST_RE,
      loader: 'one',
      exclude: EXCLUDE_RE,
    })
  })
  it('appends lists when merging queries', () => {
    expect(mergeLoaderConfig(
      loader,
      {query: {optional: ['two']}},
      {query: {optional: ['three']}}
    )).toEqual({
      test: TEST_RE,
      loader: 'one',
      exclude: EXCLUDE_RE,
      query: {
        optional: ['two', 'three'],
      },
    })
  })
  it('deep merges queries', () => {
    expect(mergeLoaderConfig(
      loader,
      {query: {nested: {a: true}}},
      {query: {nested: {b: true}}},
    )).toEqual({
      test: TEST_RE,
      loader: 'one',
      exclude: EXCLUDE_RE,
      query: {
        nested: {
          a: true,
          b: true,
        }
      }
    })
  })
})

describe('getCompatConfig()', () => {
  it('returns null if nothing was configured', () => {
    expect(getCompatConfig()).toBe(null)
  })
  it('skips falsy config', () => {
    expect(getCompatConfig({enzyme: false, moment: false, sinon: false})).toBe(null)
  })
  it('supports enzyme', () => {
    expect(getCompatConfig({enzyme: true})).toEqual(COMPAT_CONFIGS.enzyme)
  })
  it('supports moment', () => {
    let config = getCompatConfig({moment: {locales: ['de', 'en-gb']}})
    expect(config.plugins).toExist()
    expect(config.plugins.length).toBe(1)
    expect(config.plugins[0].resourceRegExp).toEqual(/moment[/\\]locale$/)
    expect(config.plugins[0].newContentRegExp).toEqual(/^\.\/(de|en-gb)$/)
  })
  it('supports sinon', () => {
    expect(getCompatConfig({sinon: true})).toEqual(COMPAT_CONFIGS.sinon)
  })
})
