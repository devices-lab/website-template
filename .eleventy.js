import markdownIt from "markdown-it";
import { full as emoji } from "markdown-it-emoji";
import postcss from "postcss";
import postcssrc from "postcss-load-config";
import eleventyNavigationPlugin from "@11ty/eleventy-navigation";
import markdownItAnchor from "markdown-it-anchor";
import markdownItContainer from "markdown-it-container";
import syntaxHighlight from "@11ty/eleventy-plugin-syntaxhighlight";
import pluginTOC from "eleventy-plugin-toc";
import { fileURLToPath } from 'url';
import file from "node:fs";
import path from 'path';
import { cpSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { glob } from 'glob';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageSrcPath = path.join(__dirname, 'src' );

function isObject(item) {
	return item && typeof item === "object" && !Array.isArray(item);
}

function deepMerge(target, ...sources) {
	if (!sources.length) return target;
	const source = sources.shift();
	
	if (isObject(target) && isObject(source)) {
		for (const key in source) {
			if (isObject(source[key])) {
				if (!target[key]) Object.assign(target, { [key]: {} });
				deepMerge(target[key], source[key]);
			} else {
				Object.assign(target, { [key]: source[key] });
			}
		}
	}
	return deepMerge(target, ...sources);
}

export default async function(eleventyConfig, options = {}) {
	// Load package.json and do a tiny bit of preprocessing to make it easier to render later
	const siteData = JSON.parse(file.readFileSync("./package.json", "utf-8"));

	if( siteData.extra ) {
		if( siteData.extra.keywords && typeof siteData.extra.keywords === 'string' )
			siteData.extra.keywords = siteData.extra.keywords.split(',').map( kw => kw.trim() );
		
		if( siteData.extra.hwidx && typeof siteData.extra.hwidx === 'string' )
			siteData.extra.hwidx = siteData.extra.hwidx.split(',').map( hw => hw.trim() );

		if( siteData.author && siteData.author.match(/(.*)<(.*)>/) ) {
			const authorMatch = siteData.author.match(/(.*)<(.*)>/);
			siteData.author = { name: authorMatch[1].trim(), email: authorMatch[2].trim() };
		}

		if( siteData.contributors && Array.isArray(siteData.contributors) ) {
			siteData.contributors = siteData.contributors.map( contributor => {
				if( typeof contributor === 'string' && contributor.match(/(.*)<(.*)>/) ) {
					const contributorMatch = contributor.match(/(.*)<(.*)>/);
					return { name: contributorMatch[1].trim(), email: contributorMatch[2].trim() };
				}
				else if (typeof contributor === 'string') {
					return { name: contributor.trim() };
				}
				else if (typeof contributor === 'object' && contributor.name) {
					return { name: contributor.name.trim(), email: contributor.email ? contributor.email.trim() : undefined };
				}
				
				return contributor;
			});
		}
	}
	eleventyConfig.addGlobalData( "site", siteData );
	
	// Determine target input dir from the options list
	const __targetInputDir = options.inputDir || 'src';
	const __syncChanges = options.syncChanges || false;
	
	eleventyConfig.on('eleventy.before', async () => {
		
		if (__syncChanges) {
			console.warn( "[user-doc-base]   Warning: Copying any changed content files from user-doc-base to target project." );
			console.warn( "[user-doc-base]            This will overwrite any existing files in the target project!" );
			console.warn( "[user-doc-base]            Did you mean to do this?" );
		}
		
		// Find all layout files, and copy any missing ones to the target.
		// This is to work around an 11ty limitation where it doesn't look for layouts
		// in node_modules of dependencies.
		//
		// This will have the odd effect of 'fixing' the layouts in time in the target project,
		// so if the user-doc-base package is updated, only _new_ non-existent layouts will be
		// copied over next time eleventy is run.
		//
		// For downstream projects to update their layouts, they will need to delete the relevant
		// layout files from their src/_layouts directory to allow the new ones to be copied over.
		const themeFiles = [
			...await glob("**/*.css", { cwd: packageSrcPath }),
			...await glob("**/*.njk", { cwd: packageSrcPath }),
			...await glob("img/**/*", { cwd: packageSrcPath, nodir: true }),
		];
		themeFiles.forEach( file => {
			const sourcePath = path.join( packageSrcPath, file );
			const targetPath = path.join( process.cwd(), __targetInputDir, file );
			
			const targetDir = path.dirname( targetPath );
			if (!existsSync(targetDir)) {
				console.log(`[user-doc-base]   Missing required target directory: ${path.relative(process.cwd(), targetDir)}, creating! ✓` );
				mkdirSync(targetDir, { recursive: true });
			}
			
			if (!existsSync(targetPath)) {
				console.log( `[user-doc-base]   Copying missing content file from user-doc-base: ${file} ✓` );
				cpSync( sourcePath, targetPath );
			}
			else {
				if( __syncChanges ) {
					if( !Buffer.from(readFileSync(sourcePath)).equals(Buffer.from(readFileSync(targetPath || ''))) ) {
						console.log( `[user-doc-base]   Copying changed content file from user-doc-base to target project, overwriting: ${file} ✓` );
						cpSync( sourcePath, targetPath );
					}
				}
				else
					console.log( `[user-doc-base]   Content file from user-doc-base already exists in target project, skipping: ${file}` );
			}
		});
	});
	
	// Use markdown files as our source(s)
	eleventyConfig.setLibrary(
		"md",
		markdownIt(
			{
				html: true,
				breaks: true,
				linkify: true,
			}
		)
	);
	eleventyConfig.amendLibrary("md", (mdLib) => mdLib.use(emoji).use(markdownItAnchor));
	eleventyConfig.addPlugin(eleventyNavigationPlugin);
	eleventyConfig.addPlugin(syntaxHighlight);
	eleventyConfig.addPlugin(pluginTOC, {
		tags: ["h1", "h2", "h3", "h4"],
		wrapper: "nav",
		wrapperClass: "table-of-contents",
		flat: false
	});
	
	eleventyConfig.amendLibrary("md", (mdLib) => mdLib.use(markdownItContainer, 'note', {
		
		validate: function(params) {
			return params.trim().match(/^note\s+(.*)$/);
		},
		
		render: function (tokens, idx) {
			var m = tokens[idx].info.trim().match(/^note\s+(.*)$/);
			
			if (tokens[idx].nesting === 1)
				return `<div class="note">\n<h3>${mdLib.utils.escapeHtml(m[1])}</h3>\n`;
			else
				return '</div>\n';
		}
	}));
	
	eleventyConfig.amendLibrary("md", (mdLib) =>
		mdLib.use(markdownItContainer, "warning", {
		validate: function (params) {
			return params.trim().match(/^warning\s+(.*)$/);
		},
		
		render: function (tokens, idx) {
			var m = tokens[idx].info.trim().match(/^warning\s+(.*)$/);
			
			if (tokens[idx].nesting === 1)
				return `<div class="warning">\n<h3>${mdLib.utils.escapeHtml(m[1])}</h3>\n`;
			else return "</div>\n";
		},
	}));

	eleventyConfig.addShortcode("makecode", function(url) {
		const embedUrl = url.replace( "https://makecode.microbit.org/", "https://makecode.microbit.org/---codeembed#pub:" );
		return [
			`<div style="position:relative;height:calc(300px + 5em);width:100%;overflow:hidden;">`,
			`<iframe style="position:absolute;top:0;left:0;width:100%;height:100%;padding:1rem" src="${embedUrl}" allowfullscreen="allowfullscreen" frameborder="0" sandbox="allow-scripts allow-same-origin"></iframe>`,
			`</div>`,
			`<div class="button-row" style="display:flex;justify-content:center;margin-bottom:2rem;">`,
			`<a href="${url}" class="button" target="_blank" rel="noopener">Open in MakeCode</a>`,
			`</div>`
		].join('\n');
	});

	// Include CSS files for processing
	eleventyConfig.addTemplateFormats(["md", "njk", "html", "css"]);

	// Update on any layout changes
	eleventyConfig.addWatchTarget("src/_layouts/**/*");
	eleventyConfig.addWatchTarget("src/**/*.css");
	eleventyConfig.addWatchTarget("src/**/*.js");
	eleventyConfig.addWatchTarget("src/**/*.png");
	eleventyConfig.addWatchTarget("src/**/*.jpg");
	eleventyConfig.addWatchTarget("src/**/*.jpeg");
	eleventyConfig.addWatchTarget("src/**/*.svg");

	// Include our data files as watch targets
	eleventyConfig.addWatchTarget("package.json");
	eleventyConfig.addWatchTarget("src/**/*.json");

	//eleventyConfig.addPassthroughCopy({ "src/css": "css" });
	eleventyConfig.addPassthroughCopy({ "src/img": "img" });

	// Build some custom collections to aid navigation and content structuring
	eleventyConfig.addCollection("pages", function(collectionApi) {
		return collectionApi.getAll();
	});

	// Process CSS with PostCSS
	eleventyConfig.addTemplateFormats("css");
	eleventyConfig.addExtension("css", {
		outputFileExtension: "css",
		compile: async (inputContent) => {
			// Load PostCSS config from target project, with fallback to Tailwind
			let plugins = [];
			try {
				const { plugins: configPlugins } = await postcssrc();
				plugins = configPlugins;
			} catch (e) {
				// Fallback if no postcss.config.js found
				const tailwindConfigPath = path.join(__dirname, "tailwind.config.js");
				plugins = [
					(await import('tailwindcss')).default({ config: tailwindConfigPath }),
					(await import('autoprefixer')).default()
				];
			}
			
			const result = await postcss(plugins).process(inputContent, { from: undefined });
			
			return async () => result.css;
		}
	});

	return {
		markdownTemplateEngine: "njk",
		htmlTemplateEngine: "njk",
	}
};