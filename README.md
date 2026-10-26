# Topside Mountain View

An animated theme for [Omarchy](https://omarchy.org). A scout on a ledge at dusk, looking out over
the mesas: his coat moving in the wind, a radio mast blinking on the far cliff, a drone on patrol, a
convoy crawling through the fog in the valley. Now and then he kneels to watch the road through
binoculars, then walks off the ledge and later walks back.

> **Animated with [omarchy-live-wallpaper](https://github.com/Gleasonmt/omarchy-live-wallpaper).**
> Install that plugin too (below) to make the wallpaper move and to get the
> **Topside Mountain View Lite** version. Without it the theme still works, with a still wallpaper.

![Topside Mountain View, moving](media/topside-mountain-view.webp)

## Install

Theme and plugin together:

```bash
omarchy theme install https://github.com/Gleasonmt/omarchy-topside-mountain-view-theme && omarchy plugin add https://github.com/Gleasonmt/omarchy-live-wallpaper --enable --yes
```

or one at a time:

```bash
omarchy theme install https://github.com/Gleasonmt/omarchy-topside-mountain-view-theme
omarchy plugin add https://github.com/Gleasonmt/omarchy-live-wallpaper --enable
```

Then pick **Topside Mountain View** in Omarchy menu → Style → Theme. The first line is the theme
(colors, wallpaper, icons, keyboard lighting); the second makes the wallpaper move,
and also adds **Topside Mountain View Lite** to the picker. Without the plugin you get the theme
with a still wallpaper.

Already have the plugin? Run `omarchy plugin update`: this scene needs its support for
picture layers and video. Update the theme itself with `omarchy theme update`.

## Topside Mountain View Lite

The same scene with the scout standing still and only small details alive (the mast's light,
the drone, the vehicles). It uses the least power, which makes it good for battery or a
calmer desktop:

![Topside Mountain View Lite](media/topside-mountain-view-lite.webp)

## How it moves

The scene is four pictures stacked in depth (`live/*.png`: the sky, the far valley, the
cliff with the mast, the near ledge) and a GPU shader (`live/1-mountain-view.frag.qsb`,
source in `src/`) that drifts a camera slowly across them, so near things slide past far
ones, and draws the fog, clouds, lights, drone and vehicles. The scout is a looping
2-minute video (`live/scout.mp4`, colour and mask side by side) that the
[live-wallpaper plugin](https://github.com/Gleasonmt/omarchy-live-wallpaper) decodes on the GPU.
`backgrounds/1-mountain-view.png` is a frame of it, used by the lock screen and when the
plugin isn't installed. Everything pauses while a window covers the screen. See the plugin's
README for frame rates and battery settings.

The painting and the scout's movement were made with AI image and video models, then
cut into layers, cleaned up and animated by hand. The look is inspired by films and
games; no logos or characters are used.

## Making changes

The scene is `src/1-mountain-view.frag` (with `src/common.glsl`); `src/scene.json` lists
the pictures and the video it uses. Edit it, then run

```bash
tools/build.sh           # rebuilds live/*.frag.qsb and live/*.json, the still in backgrounds/ and preview.jpg
tools/build.sh --media   # also the animated previews in media/ (a few minutes)
```

and commit the results. Needs `qt6-shadertools`, `qt6-declarative`, ImageMagick, jq and
(for `--media`) ffmpeg. To try a change on your own desktop, run
`omarchy theme update` after pushing, or copy the built files into
`~/.config/omarchy/themes/topside-mountain-view/`.

## License

[MIT](LICENSE)
