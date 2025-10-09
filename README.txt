Golf Swing Visualizer V2.1 (Auto-align)
-----------------------------------------
Files:
- index.html
- style.css
- app_pose.js
- README.txt

What's new in V2.1:
- Auto-align button that uses a pose detector (TensorFlow.js / MoveNet or BlazePose via CDN) to detect shoulders and align P-7 to P-1.
- The auto-align flow currently adjusts scale and translation to match shoulder midpoints and shoulder width. Rotation is approximated; for fine rotation correction you can slightly adjust with flip or manual dragging. This approach avoids heavy math and keeps everything in-browser.

Notes and limitations:
- Auto-align requires the CDN pose libraries to load (internet connection). If scripts fail to load (offline), auto-align will show an alert but the rest of the app still works.
- Pose detection may fail if images don't show the full body or are low-resolution. Best results: full-body photos taken at similar distances/angles.
- For a more precise solution (rotation + non-rigid transforms), we can add an explicit image rotation control and/or compute an affine transform using several keypoints (shoulders + hips + knees). I can add that next.
- If you want the app to work fully offline, we can vendor the TF.js + model files and host them alongside the app (bigger ZIP).

If you'd like, I'll now:
- add precise rotation and affine transform (preferred for best alignment), or
- vendor the TF.js/model files so Auto-align works offline, or
- tweak auto-align to prefer hips when shoulders are occluded.

Which should I do next?

