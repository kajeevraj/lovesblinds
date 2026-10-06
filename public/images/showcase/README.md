# Showcase photos

Drop photos into the folder for the line, then deploy. No code change is needed.

- Folders: `hero`, `roller`, `zebra`, `shangri-la`, `roman`, `cellular`, `drapery`
- File names: `<slug>-<room>-<nn>.jpg`, for example `roller-bedroom-01.jpg`
- Drapery files are `drapery-curtains-<room>-<nn>.jpg` or `drapery-dream-<room>-<nn>.jpg`
- Hero files are `hero-<room>-<nn>.jpg`
- JPG or PNG in. The build writes resized JPEG and WebP copies (hero 2000 px wide, line images 1200 px, quality 80) and `src/data/showcase.json`.
- Files starting with `_` or `.` are ignored.
