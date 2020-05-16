# BTTLaTeX
Script to use LaTeX in iMessage using BetterTouchTool

In BetterTouchTool, make a "Key Sequences/Typed Words" trigger for the Messages app. I have it to run on the recorded sequence "H" since typing `\math` or `\endmath` both end in `h` and trigger it. For the Action, choose "Run Real JavaScript" and paste the file into text editor box. Save it and that's it.

In Messages, type something like `\math\sum_{i=0}^{100} \int_{-3}^i \, (f(x)) dx\endmath` (must be wrapped in `\math ... \endmath` delimiters so the scirpt knows where to look). After typing the last `h` in `\endmath` (make sure it actually triggers by typing the "H", since BTT isn't listening for a "⌘V", just an "H"), the text should be replaced with "∑ᵢ₌₀¹⁰⁰ ∫₋₃ⁱ  (𝑓(𝑥))𝑑𝑥".

Obviously, you're not gonna be typing your math PhD dissertation in Messages. Formatting is extremely limited compared to true LaTeX since you can only type plain Unicode text characters in Messages. Since there is a subscript "i" character in Unicode (`ᵢ U+1D62`), typing `_i` will correctly transform `i` into `ᵢ`. There is no such thing as a superscript "∞" character, or a subscript "n" character, so typing `\math\sum_{n=0}^\infty\endmath` will not work; instead you'll get "∑𝑛₌₀∞" ("=" and "0" *do* have subscript counterparts, so they *will* be converted). There are a lot of other limitations to this like the fact that you can't make different sized delimiters with `\left ... \right`, but for the most it gets the job done.
