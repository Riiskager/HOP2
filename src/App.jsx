import { useEffect, useRef, useState } from "react";
import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import "./index.css";

// Datafiler
import { knogler, points } from "./knogler";
import { skins } from "./skins";

export default function App() {
  console.log("App rendered");
  // Reference til video-elementet
  const videoRef = useRef(null);

  // Reference til canvas-elementet
  const canvasRef = useRef(null);

  // Hvilket skin der er aktivt lige nu
  const [skin, setSkin] = useState("");

  useEffect(() => {
    console.log("skin changed:", skin)
 
    let poseLandmarker;
    let running = true;


    // Her gemmer vi alle indlæste billeder
    const loadedImages = {};

    async function init() {
      // =====================================
      // 1. Start webcam
      // =====================================
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true
      });

      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      // =====================================
      // 2. Indlæs ALLE billeder fra alle skins
      // =====================================
      for (const [skinName, skinParts] of Object.entries(skins)) {
        loadedImages[skinName] = {};

        for (const [partName, partData] of Object.entries(skinParts)) {
          const img = new Image();
          img.src = partData.img;

          await new Promise((resolve) => {
            img.onload = resolve;
          });

          loadedImages[skinName][partName] = img;
        }
      }

      // =====================================
      // 3. Initialiser MediaPipe Pose
      // =====================================
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
      );

      poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
        },
        runningMode: "VIDEO"
      });

      // =====================================
      // 4. Canvas setup
      // =====================================
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      // =====================================
      // 5. Tegn-loop
      // =====================================
      function detect() {
        if (!running) return;

        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const result = poseLandmarker.detectForVideo(
          videoRef.current,
          performance.now()
        );

        // Spejlvend canvas så det matcher webcam-visningen
        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);

        if (result.landmarks?.length > 0) {
          const landmarks = result.landmarks[0];
          const currentSkin = skins[skin];
          const currentImages = loadedImages[skin];

          //======================================
          //  Torso
          //======================================

        // skuldre
        const shoulderLeft = landmarks[11];
        const shoulderRight = landmarks[12];

        // hofter
        const hipLeft = landmarks[23];
        const hipRight = landmarks[24];

        // midtpunkter
        const shoulderCenter = {
          x: (shoulderLeft.x + shoulderRight.x) / 2,
          y: (shoulderLeft.y + shoulderRight.y) / 2
        };

        const hipCenter = {
          x: (hipLeft.x + hipRight.x) / 2,
          y: (hipLeft.y + hipRight.y) / 2
        };

        // =====================================
        // TORSO POSITIONER
        // =====================================

        const torsoX1 = shoulderCenter.x * canvas.width;
        const torsoY1 = shoulderCenter.y * canvas.height;

        const torsoX2 = hipCenter.x * canvas.width;
        const torsoY2 = hipCenter.y * canvas.height;

        // fix af underligt drift
        const torsoMidX = (torsoX1 + torsoX2) / 2;
        const torsoMidY = (torsoY1 + torsoY2) / 2;

        // retning
        const torsoDx = torsoX2 - torsoX1;
        const torsoDy = torsoY2 - torsoY1;

        // rotation
        const torsoAngle = Math.atan2(torsoDy, torsoDx);

        // længde
        const torsoLength = Math.sqrt(
          torsoDx * torsoDx + torsoDy * torsoDy
        );

        

        // =====================================
        // TORSO IMAGE
        // =====================================

        const torsoPart = currentSkin.torso;
        const torsoImg = currentImages.torso;

        // Højde
        const torsoAspectRatio = torsoImg.height / torsoImg.width;
        const torsoHeight = torsoLength * torsoAspectRatio;

        if (torsoPart && torsoImg) {

          ctx.save();

          ctx.translate(torsoMidX, torsoMidY);

          ctx.rotate(torsoAngle);

          
          ctx.drawImage(
            torsoImg,
            -torsoLength / 2,
            -torsoHeight / 2 + (torsoPart.offsetY || 0),
            torsoLength,
            torsoHeight
          );

          ctx.restore();
        }

        
          

          // =====================================
          // 6. Tegn alle knogler (arme, ben osv.)
          // =====================================
          Object.entries(knogler).forEach(([name, bone]) => {
            const part = currentSkin[name];
            const img = currentImages[name];

            if (!part || !img) return;

            const start = landmarks[bone.from];
            const end = landmarks[bone.to];

            const x1 = start.x * canvas.width;
            const y1 = start.y * canvas.height;
            const x2 = end.x * canvas.width;
            const y2 = end.y * canvas.height;

            const dx = x2 - x1;
            const dy = y2 - y1;

            const angle = Math.atan2(dy, dx);
            const length = Math.sqrt(dx * dx + dy * dy);

            ctx.save();
            ctx.translate(x1, y1);
            ctx.rotate(angle);


            //ratio
            const aspectRatio = img.height /img.width
            //Skallering
            const drawWidth = length * aspectRatio 
            
            //Hænders specifikke rotation
            

            ctx.drawImage(
              img,
              0,
              part.offsetY || -10,
              length,
              drawWidth
            );
           

            ctx.restore();
          });

          // =====================================
          // 7. Tegn alle punkt-dele (hoved, hænder)
          // =====================================
          Object.entries(points).forEach(([name, index]) => {
            const part = currentSkin[name];
            const img = currentImages[name];

            if (!part || !img) return;

            const point = landmarks[index];
            const x = point.x * canvas.width;
            const y = point.y * canvas.height;

            const size = (part.size || 80) * (part.scale || 1);

          

            ctx.drawImage(
              img,
              x - size / 2 + (part.offsetX || 0),
              y - size / 2 + (part.offsetY || 0),
              size,
              size
            );
          });
        }

        ctx.restore();
        requestAnimationFrame(detect);
      }

      detect();
    }

    init();

    return () => {
      running = false;
    };
  }, [skin]);

  return (
    <div className="screen">
      <video className="video"
        ref={videoRef}
        style={
          {transform: "scaleX(-1)"}
        }
      />

      <canvas className="canvas"
        ref={canvasRef}
      
      />
      <div className="border"/>
      <div className="border2"/>
      <div className="border3"/>

      <div className="text">
        <h1>Skærmløsning</h1>
        <p>Her ser i skærmløsningen til udstillingen <br/>
        Følg guiden for at optimere oplevelsen:
        <br/></p>
        <p>- Tillad brug af kamera <br/><br/>
        - Tryk på en af knapperne, for at aktivere<br/><br/>
        - Stil jer, så så meget af jeres krop er synligt for kameraet.
        </p>
      </div>

      <div className="buttons">
        <button id="knap" onClick={() => setSkin("beta")}>Beta</button>
        <button id="knap" className ="beta2" onClick={() => setSkin("beta2")}>Beta</button>
      </div>
    </div>
  );
}
