# Fonts

Vendored purely so `npm run og` can render the social preview card in the same
face the site uses for headings. Nothing here is served to visitors — the site
itself loads its webfonts from Google Fonts.

## DMSerifDisplay-Regular.ttf

- Family: DM Serif Display, by Colophon Foundry
- Source: <https://github.com/google/fonts/tree/main/ofl/dmserifdisplay>
- Licence: SIL Open Font License 1.1 (`OFL.txt`)

`OFL.txt` is the upstream licence file from that directory. Its copyright line
names Adobe and "Source" rather than DM Serif, which looks wrong at first
glance but is correct: DM Serif is derived from Adobe's Source Serif, so the
notice carries the original attribution forward as the OFL requires.

The remaining faces on the card use Montserrat, which is expected to be present
on the machine running the script; the renderer falls back to another sans if it
is not.
