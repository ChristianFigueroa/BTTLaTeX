// Christian Figueroa <figgchristian@gmail.com>
// https://github.com/ChristianFigueroa/BTTLaTeX


// User Preferences
// If you want to add any custom macros, add it to the `custom_macros` object below
// It includes examples for both types of macros (plain text or functions)
const custom_macros = {
	// Define plain replacement strings
	R: `\\mathbb{R}`,
	N: `\\mathbb{N}`,
	Z: `\\mathbb{Z}`,
	C: `\\mathbb{C}`,
	// Or define functions that can include JS code
	macroThatMultiplies: function(param1, param2) {
		return `${param1} \\times ${param2} = ${param1 * param2}`;
	},
	// Macros that return null/undefined, or throw an error, will not expand.
	// Return the empty string "" if you actually want it to expand to nothing.
	macroThatFails: function() {
		// throw new Error();
		// or
		// return null;
		// or
		// return;
	},
	// Functions will absorb as many arguments as there are in the function signature (excluding optional arguments)
	// This function absorbs 11 arguments (p12 and p13 don't count)
	// Functions can also absorb more than the standard 9 argument limit from TeX.
	macroWithABunchOfArgs: function(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12=12, p13=13) {
		return `Idk,\\ whatever\\ you\\ want`;
	},
	// These are just non-standard additions that make a macro for missing Greek letters
	// \Alpha is just a regular "A" character, but isn't defined by standard LaTeX since, really, you could just type "A"
	Alpha: `\\mathrm{A}`,
	Beta: `\\mathrm{B}`,
	Epsilon: `\\mathrm{E}`,
	Zeta: `\\mathrm{Z}`,
	Eta: `\\mathrm{H}`,
	Iota: `\\mathrm{I}`,
	Kappa: `\\mathrm{K}`,
	Mu: `\\mathrm{M}`,
	Nu: `\\mathrm{N}`,
	Omicron: `\\mathrm{O}`,
	omicron: `\\mathrm{o}`,
	Rho: `\\mathrm{P}`,
	Tau: `\\mathrm{T}`,
	Chi: `\\mathrm{X}`
};

// The code that actually gets run; the rest of this file is just function declarations that get called from here
(async () => {
	// Get the text in the user's Messages text field using an AppleScript
	let text = await runAppleScript(`
		tell application "System Events"
			return value of text area 1 of scroll area 4 of splitter group 1 of window "Messages" of application process "Messages"
		end tell
	`);
	
	// Look for any \math ... \endmath delimiters denoting LaTeX that should be parsed
	let matches = text.match(/([\s\S]*)\\math(?:\s+|(?=[^A-Za-z]))([\s\S]*)\\endmath([\s\S]*)$/);
	// If there was a match for any, parse the text and replace the text field's text
	if (matches) {
		// `pretext` and `posttext` are text outside of \math ... \endmath delimiters that should not be altered
		// `transformed` is the tranformed LaTeX text
		let pretext = matches[1];
		let transformed = matches[2];
		let posttext = matches[3];

		// Add any custom macros the user defined above to the macro list so that they will be used
		for (macro in custom_macros) {
			if (!(macros.hasOwnProperty(macro))) {
				// If the macro is a function, make a wrapper around it to produce the expected result type
				if (typeof custom_macros[macro] == "function") {
					macros[macro] = {type: "func", args: custom_macros[macro].length, preparse: false, value: function() {
						// Make a try/catch block so that an error in the user's code will fail silently as a misread macro
						try {
							let returnValue = this(...arguments);
							if (returnValue == undefined || returnValue == null) {
								return {type: "none"};
							} else {
								return {type: "text", value: returnValue.toString()};
							}
						} catch (e) {
							return {type: "none"};
						}
					}.bind(custom_macros[macro])}
				} else {
					// If the macro is just a plain text replacement, make a macor entry for it
					macros[macro] = {type: "text", value: custom_macros[macro].toString()};
				}
			}
		}

		// Read the text as LaTeX and return the Unicode equivalent
		transformed = asLaTeX(transformed);
		
		// Make the replacement in the Messages app so that the text gets auto-replaced seamlessly
		runAppleScript(`
			tell application "System Events"
				set value of text area 1 of scroll area 4 of splitter group 1 of window "Messages" of application process "Messages" to "` + (pretext + transformed + posttext).replace(/\n/g, "n").replace(/\\/g, "\\\\") + `"
			end tell
		`);
	}
})();

// Regexes that get used later
const reg = {
	letter: {
		capital: /[A-Z]/,
		lowercase: /[a-z]/
	},
	whitespace: /\s/,
	supscr: /\^/,
	subscr: /_/,
	digit: /\d/,
	macro: /^\\([^A-Za-z]|[A-Za-z]+)/,
	macrowithat: /^\\([^A-Za-z@]|[@A-Za-z]+)/,
	groupopen: /\{/,
	groupclose: /\}/
};

// Object to unify token creation
// Calling tok.ord() will return an Ord token (represented as a plain JSON object)
// "script" and "accent" tokens are special in that they are interpreted differently at the end
// The "lookup" function takes a character argument and returns the corresponding token that that character should yield normally
// For example, "+" would create a Bin token in LaTeX, so tok.lookup("+") will return tok.bin("+")
const tok = {
	ord:    a => ({type: 0, value: a}),
	op:     a => ({type: 1, value: a}),
	bin:    a => ({type: 2, value: a}),
	rel:    a => ({type: 3, value: a}),
	open:   a => ({type: 4, value: a}),
	close:  a => ({type: 5, value: a}),
	punct:  a => ({type: 6, value: a}),
	inner:  a => ({type: 7, value: a}),
	script: a => ({type: 8, value: a}),
	accent: a => ({type: 9, value: a}),
	lookup: function(char) {
		if (/[-*#+–\/]/.test(char)) {
			return tok.bin(char == "-" ? "\u2212" : char);
		} else if (/[=~<>:]/.test(char)) {
			return tok.rel(char);
		} else if (/[(\[{]/.test(char)) {
			return tok.open(char);
		} else if (/[)\]}?]/.test(char)) {
			return tok.close(char);
		} else if (/[,;!]/.test(char)) {
			return tok.punct(char);
		} else {
			return tok.ord(char);
		}
	}
};

// Parses the given string for the next argument to a macro
// Returns the index in the string that points to the end of the argument
// A { ... } group will be looked at until the corresponding "}" token is found (i.e. nesting is taken into account)
// If there is no { ... } group, the first character is returned by itself
// If the first character looks like it may be the start of a macro name, the entire macro is returned
// If there are no more tokens to absorb into an argument, a -1 is returned
function getArg(str, i = 0) {
	// Whitespace is stripped from the string since a space character wouldn't be treated as an argument in LaTeX
	let whitespace = str.substr(i).match(/^\s*/)[0].length;
	str = str.substr(i + whitespace);
	if (str.length == 0) {
		return -1;
	}
	if (reg.groupopen.test(str[0])) {
		let open = 1;
		for (var n = 1; n < str.length && open > 0; n++) {
			if (reg.groupopen.test(str[n])) {
				open++;
			} else if (reg.groupclose.test(str[n])) {
				open--;
			}
		}
		return open == 0 ? whitespace + n + i : -1;
	} else if (reg.macro.test(str)) {
		return whitespace + str.match(reg.macro)[0].length + i;
	} else {
		return whitespace + 1 + i;
	}
}

// Helper function that will add two code points together and return the resulting character
// Passing 3 and "a" for example will add 3 to the "a" character's Unicode code point (which would result in "d")
function addCodePoint(offset, str, i = 0) {
	return String.fromCodePoint(offset + str.codePointAt(i));
}

// Unwraps a group of characters if surrounded by "{ ... }"
// If the string isn't surrounded, the string is returned unaltered
// It assumes the string is just one group (e.g. something like "{a}{b}" would be unwrapped into "a}{b"), but this isn't a problem where it gets called
function unwrap(str) {
	str = str.trimStart();
	if (str[0] == "{" && str[str.length - 1] == "}") {
		return str.substring(1, str.length - 1).trimStart();;
	} else {
		return str;
	}
}

// Converts letters that have been parsed into their plain letter version
// For example, parsing "a" would result in "𝑎", which this function turns back into "a" when called
// This is helpful for macros that read their argument's individual letters and would rather look at "a" than "\u{1d44e}" for "𝑎"
function plainChar(char) {
	if (/[\u{1d44e}-\u{1d454}\u{1d456}-\u{1d467}]/u.test(char)) {
		return addCodePoint(-0x1d3ed, char);
	} else if (char == "\u{1d629}") {
		return "h";
	} else if (/[\u{1d434}-\u{1d44d}]/u.test(char)) {
		return addCodePoint(-0x1d3f3, char);
	}

	return char;
}

// A list of macros
// Some are macros that are defined in LaTeX or by packages like amsmath
// Not all macros are defined since some don't have good Unicode equivalents (or i just didn't see it or something)
// A lot of macros came from this reference:
// http://milde.users.sourceforge.net/LUCR/Math/unimathsymbols.pdf
let macros = {
	Delta: {type: "token", value: tok.ord("\u0394")},
	Gamma: {type: "token", value: tok.ord("\u0393")},
	Im: {type: "text", value: "\\mathfrak{I}"},
	Lambda: {type: "token", value: tok.ord("\u039b")},
	Leftarrow: {type: "token", value: tok.rel("\u21d0")},
	Micro: {type: "token", value: tok.ord("\u00b5")},
	Omega: {type: "token", value: tok.ord("\u03a9")},
	P: {type: "token", value: tok.ord("\u00b6")},
	Phi: {type: "token", value: tok.ord("\u03a6")},
	Pr: {type: "text", value: "\\mathop{\\textrm{Pr}}"},
	Psi: {type: "token", value: tok.ord("\u03a8")},
	Re: {type: "text", value: "\\mathfrak{R}"},
	Rightarrow: {type: "token", value: tok.rel("\u21d2")},
	Pi: {type: "token", value: tok.ord("\u03a0")},
	S: {type: "token", value: tok.ord("\u00a7")},
	Theta: {type: "token", value: tok.ord("\u0398")},
	Upsilon: {type: "token", value: tok.ord("\u03d2")},
	acute: {type: "token", value: tok.accent("\u0301")},
	aleph: {type: "token", value: tok.ord("\u2135")},
	alpha: {type: "token", value: tok.ord("\u03b1")},
	amalg: {type: "token", value: tok.bin("\u2a3f")},
	angle: {type: "token", value: tok.ord("\u2220")},
	arccos: {type: "text", value: "\\mathop{\\textrm{arccos}}"},
	arcsin: {type: "text", value: "\\mathop{\\textrm{arcsin}}"},
	arctan: {type: "text", value: "\\mathop{\\textrm{arctan}}"},
	arg: {type: "text", value: "\\mathop{\\textrm{arg}}"},
	ast: {type: "token", value: tok.bin("*")},
	bar: {type: "token", value: tok.accent("\u0304")},
	beta: {type: "token", value: tok.ord("\u03b2")},
	bigcap: {type: "token", value: tok.op("\u22c2")},
	bigcirc: {type: "token", value: tok.bin("\u25ef")},
	bigcup: {type: "token", value: tok.op("\u22c3")},
	bigodot: {type: "token", value: tok.op("\u2a00")},
	bigoplus: {type: "token", value: tok.op("\u2a01")},
	bigotimes: {type: "token", value: tok.op("\u2a02")},
	bigsqcap: {type: "token", value: tok.op("\u2a05")},
	bigsqcup: {type: "token", value: tok.op("\u2a06")},
	bigtriangledown: {type: "token", value: tok.bin("\u25bd")},
	bigtriangleup: {type: "token", value: tok.bin("\u25b3")},
	biguplus: {type: "token", value: tok.op("\u2a04")},
	bigvee: {type: "token", value: tok.op("\u22c1")},
	bigwedge: {type: "token", value: tok.op("\u22c0")},
	bmod: {type: "text", value: "\\mathbin{\\textrm{mod}}"},
	bot: {type: "token", value: tok.ord("\u22a5")},
	breve: {type: "token", value: tok.accent("\u0306")},
	bullet: {type: "token", value: tok.bin("\u2219")},
	cap: {type: "token", value: tok.bin("\u22c2")},
	cdot: {type: "token", value: tok.bin("\u00b7")},
	cdotp: {type: "token", value: tok.punct("\u00b7")},
	cdots: {type: "token", value: tok.inner("\u00b7\u00b7\u00b7")},
	centerdot: {type: "token", value: tok.bin("\u00b7")},
	check: {type: "token", value: tok.accent("\u030c")},
	checkmark: {type: "token", value: tok.ord("\u2713")},
	chi: {type: "token", value: tok.ord("\u03c7")},
	circ: {type: "token", value: tok.bin("\u26ac")},
	circledR: {type: "token", value: tok.ord("\u00ae")},
	clubsuit: {type: "token", value: tok.ord("\u2663")},
	color: {type: "token", value: tok.punct(":")},
	coprod: {type: "token", value: tok.op("\u2210")},
	copyright: {type: "token", value: tok.ord("\u00a9")},
	cos: {type: "text", value: "\\mathop{\\textrm{cos}}"},
	cosh: {type: "text", value: "\\mathop{\\textrm{cosh}}"},
	cot: {type: "text", value: "\\mathop{\\textrm{cot}}"},
	coth: {type: "text", value: "\\mathop{\\textrm{coth}}"},
	csc: {type: "text", value: "\\mathop{\\textrm{csc}}"},
	cup: {type: "token", value: tok.bin("\u22c3")},
	dag: {type: "token", value: tok.bin("\u2020")},
	dagger: {type: "token", value: tok.bin("\u2020")},
	ddag: {type: "token", value: tok.bin("\u2021")},
	ddagger: {type: "token", value: tok.bin("\u2021")},
	ddot: {type: "token", value: tok.accent("\u0308")},
	ddots: {type: "token", value: tok.inner("\u22f1")},
	deg: {type: "text", value: "\\mathop{\\textrm{deg}}"},
	delta: {type: "token", value: tok.ord("\u03f5")},
	det: {type: "text", value: "\\mathop{\\textrm{det}}"},
	diamond: {type: "token", value: tok.bin("\u25c7")},
	diamondsuit: {type: "token", value: tok.ord("\u2662")},
	dim: {type: "text", value: "\\mathop{\\textrm{dim}}"},
	div: {type: "token", value: tok.bin("\u00f7")},
	dot: {type: "token", value: tok.accent("\u0307")},
	dots: {type: "token", value: tok.op("\u2026")},
	ell: {type: "token", value: tok.ord("\u2113")},
	emptyset: {type: "token", value: tok.ord("\u2205")},
	enspace: {type: "token", value: tok.ord("\u2005\u2005")},
	epsilon: {type: "token", value: tok.ord("\u03f5")},
	eta: {type: "token", value: tok.ord("\u03b7")},
	eth: {type: "token", value: tok.ord("\u00f0")},
	exists: {type: "token", value: tok.ord("\u2203")},
	exp: {type: "text", value: "\\mathop{\\textrm{exp}}"},
	flat: {type: "token", value: tok.ord("\u266d")},
	forall: {type: "token", value: tok.ord("\u2200")},
	gamma: {type: "token", value: tok.ord("\u03b3")},
	gcd: {type: "text", value: "\\mathop{\\textrm{gcd}}"},
	grave: {type: "token", value: tok.accent("\u0300")},
	hat: {type: "token", value: tok.accent("\u0302")},
	hbar: {type: "token", value: tok.ord("\u210f")},
	heartsuit: {type: "token", value: tok.ord("\u2661")},
	hom: {type: "text", value: "\\mathop{\\textrm{hom}}"},
	hslash: {type: "token", value: tok.ord("\u210f")},
	imath: {type: "token", value: tok.ord("\u0131")},
	inf: {type: "text", value: "\\mathop{\\textrm{inf}}"},
	infty: {type: "token", value: tok.ord("\u221e")},
	int: {type: "token", value: tok.op("\u222b")},
	intop: {type: "token", value: tok.op("\u222b")},
	iota: {type: "token", value: tok.ord("\u03b9")},
	jmath: {type: "token", value: tok.ord("\u0237")},
	kappa: {type: "token", value: tok.ord("\u03ba")},
	ker: {type: "text", value: "\\mathop{\\textrm{ker}}"},
	lambda: {type: "token", value: tok.ord("\u03bb")},
	ldotp: {type: "token", value: tok.punct(".")},
	ldots: {type: "token", value: tok.inner("\u2026")},
	lgroup: {type: "token", value: tok.open("\u27ee")},
	leftrightharpoons: {type: "token", value: tok.rel("\u21cb")},
	leftarrow: {type: "token", value: tok.rel("\u2190")},
	lg: {type: "text", value: "\\mathop{\\textrm{lg}}"},
	lhd: {type: "token", value: tok.ord("\u22b2")},
	lim: {type: "text", value: "\\mathop{\\textrm{lim}}"},
	limits: {type: "text", value: ""},
	liminf: {type: "text", value: "\\mathop{\\textrm{lim}\\,\\textrm{inf}}"},
	limsup: {type: "text", value: "\\mathop{\\textrm{lim}\\,\\textrm{sup}}"},
	ln: {type: "text", value: "\\mathop{\\textrm{ln}}"},
	lnot: {type: "token", value: tok.ord("\u00ac")},
	log: {type: "text", value: "\\mathop{\\textrm{log}}"},
	maltese: {type: "token", value: tok.ord("\u2720")},
	mathbb: {type: "func", args: 1, preparse: true, value: function(p1) {
		// Converts letters and numbers into their double-struck version (e.g. N -> ℕ)
		let toks = [];
		for (const char of p1) {
			let plain = plainChar(char)
			if (/[a-zA-Z\d\u{2124}\u{03a0}\u{03c0}\u{03b3}\u{0393}\u{03a3}]/u.test(plain)) {
				if (/[a-z]/.test(plain)) {
					toks.push(tok.ord(addCodePoint(0x1d4f1, plain)));
				} else if (/\d/.test(plain)) {
					toks.push(tok.ord(addCodePoint(0x1d7a8, plain)));
				} else if (/[ABD-GI-MOS-Y]/.test(plain)) {
					toks.push(tok.ord(addCodePoint(0x1d4f7, plain)));
				} else if (plain == "C") {
					toks.push(tok.ord("\u2102"));
				} else if (plain == "H") {
					toks.push(tok.ord("\u210d"));
				} else if (plain == "N") {
					toks.push(tok.ord("\u2115"));
				} else if (plain == "P") {
					toks.push(tok.ord("\u2119"));
				} else if (plain == "Q") {
					toks.push(tok.ord("\u211a"));
				} else if (plain == "R") {
					toks.push(tok.ord("\u211d"));
				} else if (plain == "Z") {
					toks.push(tok.ord("\u2124"));
				} else if (plain == "\u03c0") {
					toks.push(tok.ord("\u213c"));
				} else if (plain == "\u03a0") {
					toks.push(tok.ord("\u213f"));
				} else if (plain == "\u03b3") {
					toks.push(tok.ord("\u213d"));
				} else if (plain == "\u0393") {
					toks.push(tok.ord("\u213e"));
				} else if (plain == "\u03a3") {
					toks.push(tok.ord("\u2140"));
				}
			} else {
				toks.push(tok.ord(char));
			}
		}
		return {type: "tokens", value: toks};
	}},
	mathbin: {type: "func", args: 1, preparse: true, value: p1 => ({type: "token", value: tok.bin(p1)})},
	mathclose: {type: "func", args: 1, preparse: true, value: p1 => ({type: "token", value: tok.close(p1)})},
	mathfrak: {type: "func", args: 1, preparse: true, value: function(p1) {
		// Converts letters to ther fraktur version (e.g. R -> ℜ)
		let toks = [];
		for (const char of p1) {
			let plain = plainChar(char)
			if (/[a-zA-Z]/u.test(plain)) {
				if (/[a-z]/.test(plain)) {
					toks.push(tok.ord(addCodePoint(0x1d4bd, plain)));
				} else if (/[ABD-GJ-QS-Y]/.test(plain)) {
					toks.push(tok.ord(addCodePoint(0x1d4c3, plain)));
				} else if (plain == "C") {
					toks.push(tok.ord("\u212d"));
				} else if (plain == "H") {
					toks.push(tok.ord("\u210c"));
				} else if (plain == "I") {
					toks.push(tok.ord("\u2111"));
				} else if (plain == "R") {
					toks.push(tok.ord("\u211c"));
				} else if (plain == "Z") {
					toks.push(tok.ord("\u2128"));
				}
			} else {
				toks.push(tok.ord(char));
			}
		}
		return {type: "tokens", value: toks};
	}},
	mathop: {type: "func", args: 1, preparse: true, value: p1 => ({type: "token", value: tok.op(p1)})},
	mathopen: {type: "func", args: 1, preparse: true, value: p1 => ({type: "token", value: tok.open(p1)})},
	mathord: {type: "func", args: 1, preparse: true, value: p1 => ({type: "token", value: tok.ord(p1)})},
	mathpunct: {type: "func", args: 1, preparse: true, value: p1 => ({type: "token", value: tok.punct(p1)})},
	mathrel: {type: "func", args: 1, preparse: true, value: p1 => ({type: "token", value: tok.rel(p1)})},
	mathring: {type: "token", value: tok.accent("\u030a")},
	mathrm: {type: "func", args: 1, preparse: true, value: p1 => ({type: "token", value: tok.ord([...p1].map(plainChar).join(""))})},
	mathtt: {type: "func", args: 1, preparse: true, value: function(p1) {
		// Converts letters and numbers into their monospace version (e.g. A -> 𝙰)
		let toks = [];
		for (const char of p1) {
			let plain = plainChar(char)
			if (/[a-zA-Z\d]/u.test(plain)) {
				if (/[a-z]/.test(plain)) {
					toks.push(tok.ord(addCodePoint(0x1d629, plain)));
				} else if (/[A-Z]/.test(plain)) {
					toks.push(tok.ord(addCodePoint(0x1d62f, plain)));
				} else if (/\d/.test(plain)) {
					toks.push(tok.ord(addCodePoint(0x1d7c6, plain)));
				}
			} else {
				toks.push(tok.ord(char));
			}
		}
		return {type: "tokens", value: toks};
	}},
	max: {type: "text", value: "\\mathop{\\textrm{max}}"},
	min: {type: "text", value: "\\mathop{\\textrm{min}}"},
	mod: {type: "func", args: 1, preparse: false, value: p1 => ({type: "text", value: `\\quad\\textrm{mod}\\,\\,${p1}`})},
	mp: {type: "token", value: tok.bin("\u2213")},
	mu: {type: "token", value: tok.ord("\u03bc")},
	nabla: {type: "token", value: tok.ord("\u2207")},
	natural: {type: "token", value: tok.ord("\u266e")},
	neg: {type: "token", value: tok.ord("\u00ac")},
	not: {type: "token", value: tok.accent("\u0338")},
	nu: {type: "token", value: tok.ord("\u03bd")},
	odot: {type: "token", value: tok.bin("\u2299")},
	oint: {type: "token", value: tok.op("\u222e")},
	ointop: {type: "token", value: tok.op("\u222e")},
	omega: {type: "token", value: tok.ord("\u03c9")},
	ominus: {type: "token", value: tok.bin("\u2296")},
	oplus: {type: "token", value: tok.bin("\u2295")},
	oslash: {type: "token", value: tok.bin("\u2298")},
	otimes: {type: "token", value: tok.bin("\u2297")},
	overline: {type: "token", value: tok.accent("\u0305")},
	partial: {type: "token", value: tok.ord("\u2202")},
	phi: {type: "token", value: tok.ord("\u03d5")},
	pi: {type: "token", value: tok.ord("\u03c0")},
	pm: {type: "token", value: tok.bin("\u00b1")},
	pmod: {type: "func", args: 1, preparse: false, value: p1 => ({type: "text", value: `\\quad(\\textrm{mod}\\,\\,${p1})`})},
	pounds: {type: "token", value: tok.ord("\u00a3")},
	prime: {type: "token", value: tok.ord("\u2032")},
	prod: {type: "token", value: tok.op("\u220f")},
	psi: {type: "token", value: tok.ord("\u03c8")},
	quad: {type: "token", value: tok.ord("\u2005\u2005\u2005\u2005")},
	qquad: {type: "token", value: tok.ord("\u2005\u2005\u2005\u2005\u2005\u2005\u2005\u2005")},
	rgroup: {type: "token", value: tok.close("\u27ef")},
	rhd: {type: "token", value: tok.bin("\u22b3")},
	rho: {type: "token", value: tok.ord("\u03c1")},
	rightarrow: {type: "token", value: tok.rel("\u2192")},
	rightleftharpoons: {type: "token", value: tok.rel("\u21cc")},
	sec: {type: "text", value: "\\mathop{\\textrm{sec}}"},
	setminus: {type: "token", value: tok.ord("\u2216")},
	sharp: {type: "token", value: tok.ord("\u266f")},
	Sigma: {type: "token", value: tok.ord("\u03a3")},
	sigma: {type: "token", value: tok.ord("\u03c3")},
	sin: {type: "text", value: "\\mathop{\\textrm{sin}}"},
	sinh: {type: "text", value: "\\mathop{\\textrm{sinh}}"},
	smallint: {type: "token", value: tok.op("\u222b")},
	spadesuit: {type: "token", value: tok.ord("\u2660")},
	sqcap: {type: "token", value: tok.bin("\u2293")},
	sqcup: {type: "token", value: tok.bin("\u2294")},
	sqrt: {type: "func", args: 1, preparse: false, value: p1 => ({type: "text", value: `\\surd(${p1})`})},
	star: {type: "token", value: tok.bin("\u2b51")},
	sum: {type: "token", value: tok.op("\u2211")},
	sup: {type: "text", value: "\\mathop{\\textrm{sup}}"},
	surd: {type: "token", value: tok.ord("\u221a")},
	tan: {type: "text", value: "\\mathop{\\textrm{tan}}"},
	tanh: {type: "text", value: "\\mathop{\\textrm{tanh}}"},
	tau: {type: "token", value: tok.ord("\u03c4")},
	text: {type: "func", args: 1, preparse: false, value: p1 => ({type: "token", value: tok.ord(p1)})},
	textrm: {type: "func", args: 1, preparse: false, value: p1 => ({type: "token", value: tok.ord(p1)})},
	theta: {type: "token", value: tok.ord("\u03b8")},
	tilde: {type: "token", value: tok.ord("\u0303")},
	times: {type: "token", value: tok.bin("\u00d7")},
	top: {type: "token", value: tok.bin("\u22a4")},
	triangle: {type: "token", value: tok.ord("\u25b3")},
	triangleleft: {type: "token", value: tok.bin("\u25c1")},
	triangleright: {type: "token", value: tok.bin("\u25b9")},
	underbar: {type: "token", value: tok.accent("\u0331")},
	underline: {type: "token", value: tok.accent("\u0332")},
	unlhd: {type: "token", value: tok.bin("\u22b4")},
	unrhd: {type: "token", value: tok.bin("\u22b5")},
	upsilon: {type: "token", value: tok.ord("\u03c5")},
	varepsilon: {type: "token", value: tok.ord("\u03b5")},
	varkappa: {type: "token", value: tok.ord("\u03f0")},
	varphi: {type: "token", value: tok.ord("\u03c6")},
	varpi: {type: "token", value: tok.ord("\u03d6")},
	varrho: {type: "token", value: tok.ord("\u03f1")},
	varsigma: {type: "token", value: tok.ord("\u03c2")},
	vartheta: {type: "token", value: tok.ord("\u03d1")},
	vdots: {type: "token", value: tok.ord("\u22ee")},
	vee: {type: "token", value: tok.bin("\u2228")},
	wedge: {type: "token", value: tok.bin("\u2227")},
	wp: {type: "token", value: tok.ord("\u2118")},
	wr: {type: "token", value: tok.bin("\u2240")},
	Xi: {type: "token", value: tok.ord("\u039e")},
	xi: {type: "token", value: tok.ord("\u03be")},
	zeta: {type: "token", value: tok.ord("\u03b6")},
	" ": {type: "token", value: tok.ord("\u00a0")},
	"#": {type: "token", value: tok.ord("#")},
	"$": {type: "token", value: tok.ord("$")},
	"%": {type: "token", value: tok.ord("%")},
	"&": {type: "token", value: tok.ord("&")},
	"\\": {type: "token", value: tok.ord("\\")},
	",": {type: "token", value: tok.ord("\u2006")},
	";": {type: "token", value: tok.ord("\u2005")},
	">": {type: "token", value: tok.ord("\u2006")},
	"^": {type: "token", value: tok.ord("^")},
	"-": {type: "token", value: tok.ord("_")},
	"{": {type: "token", value: tok.ord("{")},
	"}": {type: "token", value: tok.ord("}")},
	"~": {type: "token", value: tok.ord("~")},
	// Special macros that aren't callable directly by the user (since macros can't have "@" in them)
	"s@perscript": {type: "func", args: 1, preparse: true, value: function(p1) {
		// Converts its argument into its superscript equivalent
		// Only characters with a good superscript version in Unicode are converted, the rest are left as-is
		// Special cases:
		// 	\u26ac (from \circ) gets converted to \u00b0 (the degree symbol)
		// 	\u2032 (from \prime) gets converted to ' (an apostrophe)
		// 	\u1d40 (from \top) gets converted to a modifer captial T, which happens to look like a superscript \top symbol (for the transpose symbole for example)
		// 	\u00a0 (from \ ) gets converted into a slightly smaller space to emulate a space that got shrunken down a little
		let supertext = "";
		for (const char of p1) {
			const plain = plainChar(char);
			switch (plain) {
				case "0":
				case "4":
				case "5":
				case "6":
				case "7":
				case "8":
				case "9":
					supertext += addCodePoint(0x2040, plain);
					break;
				case "1":
					supertext += "\u00b9";
					break;
				case "2":
					supertext += "\u00b2";
					break;
				case "3":
					supertext += "\u00b3";
					break;
				case "+":
					supertext += "\u207a";
					break;
				case "-":
				case "\u2013":
				case "\u2212":
					supertext += "\u207b";
					break;
				case "=":
					supertext += "\u207c";
					break;
				case "(":
				case ")":
					supertext += addCodePoint(0x2055, plain);
					break;
				case "i":
					supertext += "\u2071";
					break;
				case "n":
					supertext += "\u207f";
					break;
				case "\u26ac": // \circ
					supertext += "\u00b0"
					break;
				case "\u2032": // \prime
					supertext += "'";
					break;
				case "\u22a4": // \top
					supertext += "\u1d40";
					break;
				case "\u00a0": // no-break space
					supertext += "\u2006";
					break;
				default:
					supertext += char;
					break;
			}
		}
		return {type: "token", value: tok.script(supertext)};
	}},
	"s@bscript": {type: "func", args: 1, preparse: true, value: function(p1) {
		// Converts its argument into its superscript equivalent
		// Only characters with a good superscript version in Unicode are converted, the rest are left as-is
		// Special cases:
		// 	\u00a0 (from \ ) gets converted into a slightly smaller space to emulate a space that got shrunken down a little
		let subtext = "";
		for (const char of p1) {
			const plain = plainChar(char);
			switch (plain) {
				case "0":
				case "1":
				case "2":
				case "3":
				case "4":
				case "5":
				case "6":
				case "7":
				case "8":
				case "9":
					subtext += addCodePoint(0x2050, plain);
					break;
				case "+":
					subtext += "\u208a";
					break;
				case "-":
				case "\u2013":
				case "\u2212":
					subtext += "\u208b";
					break;
				case "=":
					subtext += "\u208c";
					break;
				case "(":
				case ")":
					subtext += addCodePoint(0x2065, plain);
					break;
				case "i":
					subtext += "\u1d62";
					break;
				case "r":
					subtext += "\u1d63";
					break;
				case "u":
					subtext += "\u1d64";
					break;
				case "v":
					subtext += "\u1d65";
					break;
				case "a":
					subtext += "\u2090";
					break;
				case "e":
					subtext += "\u2091";
					break
				case "o":
					subtext += "\u2092";
					break;
				case "x":
					subtext += "\u2093";
					break;
				case "j":
					subtext += "\u2c7c";
					break;
				case "\u00a0":
					subtext += "\u2006";
					break;
				default:
					subtext += char;
					break;
			}
		}
		return {type: "token", value: tok.script(subtext)};
	}}
};

// Converts a string of LaTeX characters into the best Unicode approximation it can get
function asLaTeX(str) {
	// Stores tokens (kind of like "atoms" from the TeXbook) that will be combined later
	let toks = [];
	// Boolean indicating if macros should be read with "@" in them
	// This should not be accessible by the user (since there is no \makeatletter macro, or catcode-changing at all for that matter)
	// This is only special macros like "s@perscript" (converts its argument into superscripts) that get called by the code, not the user
	let atAllowed = false;

	// Iterate until the entire string is consumed
	while (str) {
		// Check for macro control sequences
		if (str[0] == "\\") {
			let match = str.match(atAllowed ? reg.macrowithat : reg.macro);
			atAllowed = false;
			// Only procede if a valid macro name was spelled out
			if (match && match[1]) {
				let name = match[1];
				let macro = macros[name];
				// Only procede if there's a defined macro with that name
				if (macro) {
					// There are three types of macros: token, func, and text
					// The user can only define func and text macros since token macros are basically just slightly more efficient versions of text macros
					// Token macros will add their values directly to the token list
					// Function macros will run a function and do something with the result depending on the result type
					// Text macros will add their values to the front of the string to be parsed by the parser as LaTeX code
					if (macro.type == "token") {
						// Add token macro directly to the token list
						toks.push(macro.value);
						// Jump ahead to after the end of the macro's name
						str = str.substr(match[0].length);
					} else if (macro.type == "func") {
						// Stores a list of arguments that will be passed to the function
						let args = [];
						// Keeps track of where the end of the arguments are in the string, so that the function name and arguments will be taken off
						let j = match[0].length;

						// Get the number of args that the function specifies it needs
						// This is done by looking at the string and either retrieving one character, or a group of characters (if a "{ ... }" group is found)
						for (let n = 0; n < macro.args; n++) {
							let argIndex = getArg(str, j);
							if (!~argIndex) {
								break;
							}
							args.push(unwrap(str.substring(j, argIndex)));
							j = argIndex;
						}

						// Only continue if there are enough arguments to pass to the function
						if (args.length == macro.args) {
							// If the function wants its arguments to be parsed beforehand, parse the arguments as LaTeX code
							// This is to differentiate between passing an argument like "\infty" or passing "∞" (i.e. the parsed version of the code)
							if (macro.preparse) {
								args = args.map(asLaTeX);
							}
							// Run the function with the arguments
							let returnValue = macro.value(...args);

							// The function should return either a token (or list of tokens) or plain text
							// Tokens get added directly to the token list
							// Text gets added to the front of the string to be parsed
							// If the return type isn't a token (list) or text, then assume the function failed
							if (returnValue.type == "token") {
								toks.push(returnValue.value);
								str = str.substr(j);
							} else if (returnValue.type == "tokens") {
								toks = toks.concat(returnValue.value);
								str = str.substr(j);
							} else if (returnValue.type == "text") {
								str = returnValue.value + str.substr(j);
							} else {
								toks.push(tok.ord("\\"));
								str = str.substr(1);
							}
						} else {
							toks.push(tok.ord("\\"));
							str = str.substr(1);
						}
					} else if (macro.type == "text") {
						// Add the macro's textual replacement to the front of the string
						str = macro.value + str.substr(match[0].length);
					}
				} else {
					toks.push(tok.ord("\\"));
					str = str.substr(1);
				}
			} else {
				toks.push(tok.ord("\\"));
				str = str.substr(1);
			}
		} else if (reg.letter.capital.test(str[0])) {
			// Capital letters get converted to their italic "math-looking" version
			toks.push(tok.ord(addCodePoint(0x1d3f3, str, 0)));
			str = str.substr(1);
		} else if (reg.letter.lowercase.test(str[0])) {
			// Same thing happens to lowercase letters
			// "h" gets an exception because of a special exception with Unicode
			if (str[0] == "h") {
				toks.push(tok.ord(String.fromCodePoint(0x1d629)));
			} else {
				toks.push(tok.ord(addCodePoint(0x1d3ed, str, 0)));
			}
			str = str.substr(1);
		} else if (reg.supscr.test(str[0])) {
			// A superscript character ("^") will call the \s@perscript macro, which returns the superscript version of its argument
			str = "\\s@perscript " + str.substr(1);
			atAllowed = true;
			returnToBTT(str)
		} else if (reg.subscr.test(str[0])) {
			// A subscript character ("_") will call the \s@bscript macro, which returns the subscript version of its argument
			str = "\\s@bscript " + str.substr(1);
			atAllowed = true;
		} else if (reg.groupopen.test(str[0])) {
			// An opening group character "{" means a new group is starting
			// The end of the group will be looked for, taking nesting into account, and used as the argument to \mathord
			let open = 1;
			for (var n = 1; n < str.length && open > 0; n++) {
				if (reg.groupopen.test(str[n])) {
					open++;
				} else if (reg.groupclose.test(str[n])) {
					open--;
				}
			}

			if (open) {
				// If the group is still open (i.e. no "}" closing group token), treat the "{" as a "\{" to avoid errors
				toks.push(tok.lookup(str[0]));
			} else {
				// Treat the { ... } group as an argument to \mathord since a { ... } has Ord spacing
				// Delegating it to \mathord prevents having to parse the { ... } group unnecessarily here
				str = "\\mathord" + str;
			}
		} else {
			// If the character is not special, add it to the token list unchanged (except for whitespace, which gets stripped away)
			if (!reg.whitespace.test(str[0])) {
				toks.push(tok.lookup(str[0]));
			}
			str = str.substr(1);
		}
	}

	// Return nothing if there are no tokens to continue parsing
	if (toks.length == 0) {
		return "";
	}

	// Apply accents to the next token's first character and discard the accent token
	for (let i = 0; i < toks.length; i++) {
		if (toks[i].type == 9) {
			if (i == toks.length - 1) {
				toks.push(tok.ord("\u00a0"));
			}

			let value = [...toks[i + 1].value];
			value.splice(1, 0, toks[i].value);
			toks[i + 1].value = value.join("");

			toks.splice(i--, 1);
		}
	}

	// Convert first token to Ord if it's a Bin token or a (super/sub)script
	if (toks[0].type == 2 || toks[0].type == 8) {
		toks[0].type = 0;
	}
	
	// Combine (super/sub)scripts with their corresponding token and convert Bin tokens to Ord in certain contexts
	for (let i = 1; i < toks.length; i++) {
		if (toks[i].type == 8) {
			toks[i - 1].value += toks[i].value;
			toks.splice(i, 1);
			i--;
		} else if (toks[i].type == 2) {
			if (toks[i - 1].type != 0 && toks[i - 1].type != 5 && toks[i].type != 7) {
				toks[i].type = 0;
			}
		} else if ((toks[i].type == 3 || toks[i].type == 5 || toks[i].type == 6) && toks[i - 1].type == 2) {
			toks[i - 1].type == 0;
		}
	}
	
	// Change last token to Ord if it's a Bin token
	if (toks[toks.length - 1].type == 2) {
		toks[toks.length - 1].type = 0;
	}
	
	// Assign first token directly since it doesn't need space in front of it
	let ret = toks[0].value;
	
	// Assign spacing between tokens depending on their type
	for (let i = 1; i < toks.length; i++) {
		let combo = toks[i - 1].type * 8 + toks[i].type;
		// From the TeXbook (Chapter 18)
		// There's a table showing corresponding spaces that go in between certain token pairs
		// The octal numbers below are written in the pattern "0lr" where "l" is the number for the left token and "r" is for the right
		// The number "021" would correspond to a Bin token (2) being followed by an Op token (1) (the numbers correspond to the row or column in the TeXbook's table)
		switch (combo) {
			// No space between tokens
			case 000:
			case 004:
			case 005:
			case 006:
			case 014:
			case 015:
			case 016:
			case 033:
			case 035:
			case 036:
			case 040:
			case 041:
			case 043:
			case 044:
			case 045:
			case 046:
			case 047:
			case 050:
			case 054:
			case 055:
			case 056:
			case 075:
				break;
			// Thin space (3/18 ems) between tokens
			case 001:
			case 007:
			case 010:
			case 011:
			case 017:
			case 051:
			case 057:
			case 060:
			case 061:
			case 063:
			case 064:
			case 065:
			case 066:
			case 067:
			case 070:
			case 071:
			case 074:
			case 076:
			case 077:
				ret += "\u2006";
				break;
			// Medium space (4/18) between tokens
			// Since there is no "4/18 of an em" Unicode character, the "1/6 of an em" character is used instead (U+2006, six-per-em space)
			case 002:
			case 020:
			case 021:
			case 024:
			case 027:
			case 052:
			case 072:
			 	ret += "\u2006";
				break;
			// Thick space (5/18) between tokens
			// // Since there is no "5/18 of an em" Unicode character, the "1/4 of an em" character is used instead (U+2005, four-per-em space)
			case 003:
			case 013:
			case 030:
			case 031:
			case 034:
			case 037:
			case 053:
			case 073:
				ret += "\u2005" // 5/18 ems
				break;
		}
		ret += toks[i].value;
	}
	return ret;
}
