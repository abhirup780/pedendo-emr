export default {
  multipass: true,
  floatPrecision: 2,
  plugins: [
    { name: 'preset-default', params: { overrides: { mergePaths: { force: false }, convertPathData: { floatPrecision: 2 }, cleanupNumericValues: { floatPrecision: 2 } } } },
    'convertStyleToAttrs',
  ],
}
