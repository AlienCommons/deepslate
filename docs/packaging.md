# Building and packaging

- `npm run build` removes the generated `lib/` and `dist/` directories, then builds the ESM JavaScript, declarations, source maps, and UMD bundle. It also removes obsolete output for deleted source files and resets TypeScript's incremental build metadata.
- `npm run build:demo` rebuilds only `dist/demo/`, clearing old demo assets without deleting the library bundle. Run it after the library build if you need both outputs.
- `npm pack` and `npm publish` run the library build through `prepack`. A fresh checkout does not need a separate manual build before packing, provided dependencies are installed. `--ignore-scripts` explicitly bypasses this safeguard.
- `npm run clean` removes only generated `lib/` and `dist/` output. Source files and demo resources are not removed.

The npm package includes `lib/` and `dist/deepslate.umd.cjs`, plus npm's standard manifest, README, and license files. Demo output, tests, benchmarks, source files, build scripts, and TypeScript build metadata are not shipped. The standalone Litematic worker and its dependencies remain in `lib/`.

`npm run test:package` runs the packaging regression checks used by CI. In temporary directories, it seeds obsolete artifacts, runs the actual pack/build lifecycle, checks demo rebuild isolation, extracts the resulting tarball, and verifies package exports and a Litematic round trip. These checks use Node.js, npm, and `tar` (available on macOS and the Linux CI runner), and do not publish anything or modify the working tree's build output.
