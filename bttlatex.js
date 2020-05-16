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

(async () => {
	let text = await runAppleScript(`
		tell application "System Events"
			return value of text area 1 of scroll area 4 of splitter group 1 of window "Messages" of application process "Messages"
		end tell
	`);
	
	let matches = text.match(/([\s\S]*)\\math(?:\s+|(?=[^A-Za-z]))([\s\S]*)\\endmath([\s\S]*)$/);
	if (matches) {
		let pretext = matches[1];
		let transformed = matches[2];
		let posttext = matches[3];

		for (macro in custom_macros) {
			if (!(macros.hasOwnProperty(macro))) {
				if (typeof custom_macros[macro] == "function") {
					macros[macro] = {type: "func", args: custom_macros[macro].length, preparse: false, value: function() {
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
					macros[macro] = {type: "text", value: custom_macros[macro].toString()};
				}
			}
		}

		transformed = asLaTeX(transformed);
		
		runAppleScript(`
			tell application "System Events"
				set value of text area 1 of scroll area 4 of splitter group 1 of window "Messages" of application process "Messages" to "` + (pretext + transformed + posttext).replace(/\n/g, "n").replace(/\\/g, "\\\\") + `"
			end tell
		`);
	
		//returnToBTT(transformed);
	} else {
		//returnToBTT(text);
	}
})();

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
	macrowithat: /^\\([^A-Za-z@]|[@A-Za-z]+)/
};

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

function getArg(str, i = 0) {
	let whitespace = str.substr(i).match(/^\s*/)[0].length;
	str = str.substr(i + whitespace);
	if (str.length == 0) {
		return -1;
	}
	if (str[0] == "{") {
		let open = 1;
		for (var n = 1; n < str.length && open > 0; n++) {
			if (str[n] == "{") {
				open++;
			} else if (str[n] == "}") {
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

function addCodePoint(offset, str, i = 0) {
	return String.fromCodePoint(offset + str.codePointAt(i));
}

function unwrap(str) {
	str = str.trimStart();
	if (str[0] == "{" && str[str.length - 1] == "}") {
		return str.substring(1, str.length - 1).trimStart();;
	} else {
		return str;
	}
}

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
	aleph: {type: "token", value: tok.ord("\u2135")},
	alpha: {type: "token", value: tok.ord("\u03b1")},
	amalg: {type: "token", value: tok.bin("\u2a3f")},
	angle: {type: "token", value: tok.ord("\u2220")},
	arccos: {type: "text", value: "\\mathop{\\textrm{arccos}}"},
	arcsin: {type: "text", value: "\\mathop{\\textrm{arcsin}}"},
	arctan: {type: "text", value: "\\mathop{\\textrm{arctan}}"},
	arg: {type: "text", value: "\\mathop{\\textrm{arg}}"},
	ast: {type: "token", value: tok.bin("*")},
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
	bullet: {type: "token", value: tok.bin("\u2219")},
	cap: {type: "token", value: tok.bin("\u22c2")},
	cdot: {type: "token", value: tok.bin("\u00b7")},
	cdotp: {type: "token", value: tok.punct("\u00b7")},
	cdots: {type: "token", value: tok.inner("\u00b7\u00b7\u00b7")},
	centerdot: {type: "token", value: tok.bin("\u00b7")},
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
	ddots: {type: "token", value: tok.inner("\u22f1")},
	deg: {type: "text", value: "\\mathop{\\textrm{deg}}"},
	delta: {type: "token", value: tok.ord("\u03f5")},
	det: {type: "text", value: "\\mathop{\\textrm{det}}"},
	diamond: {type: "token", value: tok.bin("\u25c7")},
	diamondsuit: {type: "token", value: tok.ord("\u2662")},
	dim: {type: "text", value: "\\mathop{\\textrm{dim}}"},
	div: {type: "token", value: tok.bin("\u00f7")},
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
	mathrm: {type: "func", args: 1, preparse: true, value: p1 => ({type: "token", value: tok.ord([...p1].map(plainChar).join(""))})},
	mathtt: {type: "func", args: 1, preparse: true, value: function(p1) {
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
	not: {type: "func", args: 1, preparse: true, value: p1 => ({type: "token", value: tok.rel(`${p1}\u0338`)})},
	nu: {type: "token", value: tok.ord("\u03bd")},
	odot: {type: "token", value: tok.bin("\u2299")},
	oint: {type: "token", value: tok.op("\u222e")},
	ointop: {type: "token", value: tok.op("\u222e")},
	omega: {type: "token", value: tok.ord("\u03c9")},
	ominus: {type: "token", value: tok.bin("\u2296")},
	oplus: {type: "token", value: tok.bin("\u2295")},
	oslash: {type: "token", value: tok.bin("\u2298")},
	otimes: {type: "token", value: tok.bin("\u2297")},
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
	times: {type: "token", value: tok.bin("\u00d7")},
	top: {type: "token", value: tok.bin("\u22a4")},
	triangle: {type: "token", value: tok.ord("\u25b3")},
	triangleleft: {type: "token", value: tok.bin("\u25c1")},
	triangleright: {type: "token", value: tok.bin("\u25b9")},
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
	"d@superscript": {type: "func", args: 1, preparse: true, value: function(p1) {
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
				case "\u2005":
				case "\u2006":
					break;
				default:
					supertext += char;
					break;
			}
		}
		return {type: "token", value: tok.script(supertext)};
	}},
	"d@subscript": {type: "func", args: 1, preparse: true, value: function(p1) {
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
				case "\u2005":
				case "\u2006":
					break;
				default:
					subtext += char;
					break;
			}
		}
		return {type: "token", value: tok.script(subtext)};
	}}
};

function asLaTeX(str) {
	let toks = [];
	let atAllowed = false;
	while (str) {
		if (str[0] == "\\") {
			let match = str.match(atAllowed ? reg.macrowithat : reg.macro);
			atAllowed = false;
			if (match && match[1]) {
				let name = match[1];
				let macro = macros[name];
				if (macro) {
					if (macro.type == "token") {
						toks.push(macro.value);
						str = str.substr(match[0].length);
					} else if (macro.type == "func") {
						let args = [];
						let j = match[0].length;
						for (let n = 0; n < macro.args; n++) {
							let argIndex = getArg(str, j);
							if (!~argIndex) {
								break;
							}
							args.push(unwrap(str.substring(j, argIndex)));
							j = argIndex;
						}
						if (args.length == macro.args) {
							if (macro.preparse) {
								args = args.map(function(str) {
									return asLaTeX(str);
								});
							}
							let returnValue = macro.value(...args);
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
			toks.push(tok.ord(addCodePoint(0x1d3f3, str, 0)));
			str = str.substr(1);
		} else if (reg.letter.lowercase.test(str[0])) {
			if (str[0] == "h") {
				toks.push(tok.ord(String.fromCodePoint(0x1d629)));
			} else {
				toks.push(tok.ord(addCodePoint(0x1d3ed, str, 0)));
			}
			str = str.substr(1);
		} else if (reg.supscr.test(str[0])) {
			str = "\\d@superscript " + str.substr(1);
			atAllowed = true;
			returnToBTT(str)
		} else if (reg.subscr.test(str[0])) {
			str = "\\d@subscript " + str.substr(1);
			atAllowed = true;
		} else {
			if (!reg.whitespace.test(str[0])) {
				toks.push(tok.lookup(str[0]));
			}
			str = str.substr(1);
		}
	}

	if (toks.length == 0) {
		return "";
	}

	if (toks[0].type == 2 || toks[0].type == 8) {
		toks[0].type = 0;
	}
	
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
	
	if (toks[toks.length - 1].type == 2) {
		toks[toks.length - 1].type = 0;
	}
	
	let ret = toks[0].value;
	
	for (let i = 1; i < toks.length; i++) {
		let combo = toks[i - 1].type * 8 + toks[i].type;
		switch (combo) {
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
				ret += "\u2006"; // 3/18 ems
				break;
			 case 002:
			 case 020:
			 case 021:
			 case 024:
			 case 027:
			 case 052:
			 case 072:
			 	ret += "\u2006"; // 4/18 ems
				break;
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
