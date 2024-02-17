const esbuild = require("esbuild");
const path = require("path");
const removeBlockPlugin = require(".//plugins//removeBlockPlugin");

(async () => {
    await esbuild.build({
        logLevel: 'info',
        entryPoints: [path.resolve(__dirname, 'src', 'emulator', 'gba.ts')],
        bundle: true,
        platform: 'browser',
        outfile: path.resolve(__dirname, 'dist', 'tsgba.js'),
        plugins: [removeBlockPlugin],
    });
})();
