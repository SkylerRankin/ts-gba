/**
 * An ESBuild plugin to remove TypeScript codeblocks during the build process.
 */

const fs = require("fs");

const removalStart = "// #REMOVE_IN_BUILD_START";
const removalEnd = "// #REMOVE_IN_BUILD_END";

const RemoveBlockPlugin = {
    name: "remove-block",
    async setup(build) {
        build.onLoad({ filter: /.ts$/ }, async args => {
            let text = fs.readFileSync(args.path, "utf8");
            let start = text.indexOf(removalStart);
            while (start >= 0) {
                const end = text.indexOf(removalEnd, start);
                if (end === -1) {
                    text = text.substring(0, start);
                    break;
                } else {
                    text = text.substring(0, start) + text.substring(end + removalEnd.length);
                    start = text.indexOf(removalStart, end);
                }
            }
            return { contents: text, loader: "ts" };
        });
    },
};

module.exports = RemoveBlockPlugin;
