// Renders frames of a painted, layered live wallpaper shader to PNGs.
//   qml render-seq.qml -- <shader.frag.qsb> <out-dir> <width> <height> <start> <fps> <frames> <detail>
//                         <plate.png> <layer1.png> <layer2.png> <layer3.png> <layer4.png> [video-frames-dir]
// Frames are <out-dir>/f0000.png ... The video, when given, is a folder of its
// frames (v0001.png ...), one per rendered frame (used by tools/build.sh).
import QtQuick
import QtQuick.Window

Window {
  id: win
  readonly property var args: Qt.application.arguments.slice(Qt.application.arguments.indexOf("--") + 1)
  readonly property real start: Number(args[4])
  readonly property real fps: Number(args[5])
  readonly property int frames: Number(args[6])
  property int frame: 0
  width: Number(args[2]); height: Number(args[3])
  visible: true
  color: "black"

  ShaderEffect {
    id: fx
    anchors.fill: parent
    property real time: win.start + win.frame / win.fps
    property size resolution: Qt.size(width, height)
    property rect viewport: Qt.rect(0, 0, 1, 1)
    property real detail: Number(win.args[7] || 0)
    property var source: pic
    property var layer1: l1
    property var layer2: l2
    property var layer3: l3
    property var layer4: l4
    property var video: vid
    fragmentShader: "file://" + win.args[0]
  }

  function file(i) { return win.args[i] ? "file://" + win.args[i] : "" }
  Image { id: pic; visible: false; source: win.file(8); smooth: true }
  Image { id: l1; visible: false; source: win.file(9); smooth: true }
  Image { id: l2; visible: false; source: win.file(10); smooth: true }
  Image { id: l3; visible: false; source: win.file(11); smooth: true }
  Image { id: l4; visible: false; source: win.file(12); smooth: true }
  Image {
    id: vid; visible: false; smooth: true; cache: false
    source: win.args[13] ? "file://" + win.args[13] + "/v" + win.pad(win.frame + 1) + ".png" : win.file(12)
  }

  function pad(n) { var s = String(n); while (s.length < 4) s = "0" + s; return s }
  function next() {
    fx.grabToImage(function(r) {
      r.saveToFile(win.args[1] + "/f" + pad(win.frame) + ".png")
      if (win.frame + 1 >= win.frames) { Qt.quit(); return }
      win.frame += 1
      step.restart()
    })
  }
  Timer { id: step; interval: 60; onTriggered: win.next() }
  Timer { interval: 600; running: true; onTriggered: win.next() }
}
