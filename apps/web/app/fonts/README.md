# Fonts

`Inter-Variable.woff2` is [Inter](https://rsms.me/inter/) 4.1 (SIL Open Font License, see `Inter-OFL.txt`), a variable font with weight (100–900) and optical-size axes.

It is trimmed to what the site needs, so it is 86 KB instead of 344 KB: Basic Latin, Latin-1 and Latin Extended-A, common punctuation, currency symbols (including the rupee sign ₹) and arrows, with the OpenType features `kern liga calt ccmp locl mark mkmk case tnum pnum zero frac sups subs ss01 cv11`.

The font is bundled with the app, so builds never need internet access and visitors never contact a third party.

To add characters (for example another script), re-run the trim from the full font:

```
npm pack inter-ui@4 && tar -xzf inter-ui-4.1.1.tgz
pip install fonttools brotli
pyftsubset package/variable/InterVariable.woff2 --unicodes="U+0020-007E,U+00A0-00FF,..." \
  --layout-features='kern,liga,calt,ccmp,locl,mark,mkmk,case,tnum,pnum,zero,frac,sups,subs,ss01,cv11' \
  --flavor=woff2 --no-hinting --output-file=Inter-Variable.woff2
```
