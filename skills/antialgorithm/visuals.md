# antialgorithm: visuals

Read this with SKILL.md for any piece made to be looked at: posters, covers, promo images, page layouts, icons, SVG work. The rules in SKILL.md still hold.

Do not use the look that a tool or a model would produce with no instructions. If the palette, layout, lighting, pose or framing is what you would get from a plain prompt, it is the default.

Pick the look from the subject itself: its material, its place, its time, its mood. Let one strong decision lead and keep the rest in its service, instead of many safe decisions that cancel each other.

Do not center, balance and smooth it all by habit. Balance is a choice, not a starting point.

The method marks below are for posters, covers, promo images and other pieces made to be looked at. They do not apply to:

- Interfaces get their own section at the end of this file.
- Pixel art and block models: when another skill or tool owns how they are drawn, use this skill only to choose the subject, palette and composition.

A new subject is not enough. AI images are known by their finish, not by their topic. The finish is: smooth gradients, soft glow, perfect geometry, tiles that repeat with no change, clean edges on all shapes, even spacing, one default font, and the same polish on all parts. If the image has this finish, it looks made by AI whatever it shows.

Take the method from the seed or the subject, then make the image look made by that method, not by a vector tool. Each method leaves its own marks, and those marks replace the AI finish:

- Print and paint: few inks, colors that miss their place, uneven ink, broken edges, the grain of the paper.
- Screens and machines: the pixel or dot grid, scan lines, bleed and bloom, faded bands, steps where a gradient runs out of colors, the font the machine has.
- Camera and science: sensor grain or noise, light that falls off, blur where focus or motion puts it, the false colors of the instrument, a crop the camera chose.
- Material and light: the seams, joints and thickness of the material, and light that bends, reflects or glows the way that material does.

Keep these marks real and sparse, not a noise filter laid over a clean image. Some methods are clean by nature, such as a glossy render, a CAD drawing or a spreadsheet chart. Keep those clean and let their light, grid and tools say what they are.

Do not reach for a hand-drawn wobble when the method is not made by hand. A wobbly line on an LED board, an x-ray or a 3D render is a second default laid over the first. Look at the result at icon size: if it reads as a flat vector drawing whatever the seed said, the method is missing.

When the method is made by hand, code must carry the hand in the geometry, not only in the surface on top of it:

- No line is exactly straight and no curve is a clean math function. Points drift a little, strokes swell and thin, ends are blunt or overshoot.
- Repeated marks, such as hatching, dots, stripes or tiles, change in spacing, length and angle from one to the next.
- Shapes sit slightly off the grid and slightly off each other. Fills do not meet their outlines exactly.
- Letters are not a system font in a perfect row. Draw them, cut them, stamp them or at least break their edges, and let their baseline and spacing move a little.
- The layout is placed by eye, not snapped to equal columns and equal gaps.

Look at the result at full size. If a hand-made piece has lines that look plotted, curves that look computed or text that looks typed, it still reads as machine made, however much grain is on it.

Typing coordinates by hand gives clean marks. Generate the method's marks with a short script instead of writing them one by one. Stop at the number of marks the eye needs: a poster built from thousands of tiny pieces is slow to make and heavy to open, so keep an SVG under about 200 KB. For an SVG, `python3 scripts/rough.py in.svg out.svg [--amount 1.0]` breaks straight lines, rects, polygons, circles and paths, moves repeated marks off their even spacing, and shakes letters a little while keeping small text calm. Use it only for methods made by hand, such as print, paint, cut paper, stamps, chalk and ink. It is a start, not a style: the method and the design still have to carry the look.

Before showing any SVG, run `python3 scripts/check.py file.svg`. It renders the image at full size and at icon size, and lists text that runs off an edge, is covered by a shape, has low contrast or is too small. Fix all of it, run it again, then open both renders and look at them yourself. It does not see letters drawn as paths or text that spills out of its own box, so check those by eye. For other formats, render the image and do the same checks by eye.

A flaw may change how the work looks, never stop it from doing its job. Find the parts the work needs in order to work: the information someone must read, the thing someone must press, the shape someone must recognize, the detail someone must find. Those parts stay whole, clear and in place. They are never cut by an edge, covered, broken by texture or lost in the style. Roughness belongs to the rest. Check those parts before you show the work.

Let text be part of the image, not labels placed on top of it. Choose the type for the method and the subject, let it be cut off, pressed, crowded or turned when that serves the piece.

Leave out what has no job. A decorative shape, glow, frame or icon that only fills space is a sign of the default.

## Interfaces

An app screen, dashboard, web page or game HUD has a default shell, and that shell gives it away faster than its colors: a top bar with search, bell and avatar, a sidebar, a row of stat cards, rounded panels in a grid, chips, progress bars, a table and one accent color on a dark or white ground. A new subject poured into this shell still reads as a template. Change all three layers, not one:

1. Layout from the subject. Find the one question the user opens the screen to answer, and let the whole page be the shape of that answer. A schedule app can be the day itself, one pixel per minute across the full width. A tool about a place can be the place. Cards, tables and panels come back only when this case needs them.
2. A method that carries the data. Take the method from a visual seed or the subject, then let its own physics show the states: light and dark, ink and paper, worn and new, on and off. If a state could be swapped for any color without losing meaning, the method is only paint.
3. Type and color with poster scale. One huge stacked statement and huge markers next to small exact data. Take the colors from a place at a set hour or from the subject's material, and let them mean something, such as the hour, the zone or the state, instead of one accent on gray.

The method may own the surface, the ground and the big shapes. It never owns the working parts: data lines up with its axis, labels sit inside their areas, buttons are plain and pressable, and small text stays readable on whatever is behind it. Roughness, texture and silhouettes go behind or below the data, never through it.

When the subject is already set, by the user or by an idea seed, roll a visual seed and keep the subject's axes with `--keep`, so only the look is rolled.

If a standing rule of the user limits the look, such as a gray-only interface rule, follow it, and when the result comes back as flat or plain, say which rule shaped it. Lift the rule for one piece only when the user asks for the thing it forbids, and say so.

`check.py` judges text size against the image side, which suits posters. A 1440 px screen has normal 12 px labels, so run it with `--min-text 0.6` for interfaces. With many labels it takes minutes, so run it in the background.
