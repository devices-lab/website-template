import markdownIt from "markdown-it";
import { full as emoji } from "markdown-it-emoji";
import postcss from "postcss";
import postcssrc from "postcss-load-config";

export default async function(eleventyConfig) {
	let options = {
		html: true,
		breaks: true,
		linkify: true,
	};

    // Use markdown files as our source(s)
	eleventyConfig.setLibrary("md", markdownIt(options));
    eleventyConfig.amendLibrary("md", (mdLib) => mdLib.use(emoji));

	// Include CSS files for processing
	eleventyConfig.setTemplateFormats(["md", "njk", "html", "css"]);
	eleventyConfig.ignores.add("src/_layouts/**/*");

    // Update on any layout changes
	eleventyConfig.addWatchTarget("src/_layouts/**/*");
	eleventyConfig.addWatchTarget("src/**/*.css");
	eleventyConfig.addWatchTarget("src/**/*.js");
	eleventyConfig.addWatchTarget("src/**/*.png");
	eleventyConfig.addWatchTarget("src/**/*.jpg");
	eleventyConfig.addWatchTarget("src/**/*.jpeg");
	eleventyConfig.addWatchTarget("src/**/*.svg");

	eleventyConfig.addPassthroughCopy({ "src/img": "img" });

	// Process CSS with PostCSS
	eleventyConfig.addTemplateFormats("css");
	eleventyConfig.addExtension("css", {
		outputFileExtension: "css",
		compile: async (inputContent) => {
			const { plugins } = await postcssrc();
			const result = await postcss(plugins).process(inputContent, {
				from: undefined
			});
			return async () => result.css;
		}
	});

	return {
		dir: {
			input: "src",
			output: "_site",
			layouts: "_layouts"
		},
		templateFormats: ["md", "njk", "html", "css"],
		markdownTemplateEngine: "njk",
		htmlTemplateEngine: "njk"
	};
};