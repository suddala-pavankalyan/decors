# Fonts

[Figtree](https://github.com/erikdkennedy/figtree) (SIL Open Font License, see `Figtree-OFL.txt`), a variable font with weights 300-900, taken from the `@fontsource-variable/figtree` package.

- `Figtree-Latin.woff2`: Basic Latin, Latin-1 and common punctuation.
- `Figtree-LatinExt.woff2`: Latin Extended, including the rupee sign (U+20B9). It is listed second in the font stack, so the browser uses it only for characters the first file lacks.

The fonts are bundled with the app, so builds never need internet access and visitors never contact a third party.

## Wedding-card section

`GreatVibes-Latin.woff2` (script, for names) and `CormorantGaramond-Latin.woff2` / `CormorantGaramond-Italic-Latin.woff2` (serif, for headings) are used only by the wedding-card section on the home page (`font-script`, `font-display`). Both are under the SIL Open Font License (`Wedding-Fonts-OFL.txt`) and come from the `@fontsource` packages.
