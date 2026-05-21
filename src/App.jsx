
//Importering af react komponenter og mediapipe værktøjer
import { useEffect, useRef, useState } from "react";
import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import "./index.css";

// Datafiler
import { knogler, points } from "./knogler"; //knogler.js, hvor jeg definerer underarm, overarm, torso osv
import { skins } from "./skins"; //Hvor jeg bruger de samme navne som i knogler, til at definere hvilke billeder, der passer dertil

export default function App() {
  console.log("App rendered"); //early stage check, for at se om funktionen virker
  // Reference til video-elementet
  const videoRef = useRef(null);

  // Reference til canvas-elementet
  const canvasRef = useRef(null);

  // Hvilket skin der er aktivt lige nu
  const [skin, setSkin] = useState(""); //Er først aktivt når man klikker på knap

  useEffect(() => {
    console.log("skin changed:", skin)
 
    let poseLandmarker;
    let running = true;


    // Her gemmesalle indlæste billeder
    const loadedImages = {};

    async function init() {
      // =====================================
      // Start webcam
      // =====================================
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true
      });

      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      // =====================================
      // Indlæs ALLE billeder fra alle skins
      // =====================================
      for (const [skinName, skinParts] of Object.entries(skins)) {
        loadedImages[skinName] = {}; //omdanner skin objects til arrays og danner et tomt objekt at have dem i
                                     //Gemmer ikke billederne endnu
        for (const [partName, partData] of Object.entries(skinParts)) {//går gennem alle "skins" for at finde parts(overarm, ben osv) samt deres tilhørende billede
          const img = new Image();
          img.src = partData.img;  //Begynder at loade billederne

          await new Promise((resolve) => {
            img.onload = resolve; //venter på at billederne loades, så den kan køre videre
          });

          loadedImages[skinName][partName] = img; //gemmer nu de loadede billeder sammen med deres tilhørende navn
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
        canvas.height = videoRef.current.videoHeight; //Canvas højde og drøjde er = videoen(det virker dog ikke)

        ctx.clearRect(0, 0, canvas.width, canvas.height); //Først sletter vi alt på vores canvas

        //Gemmer koodinaterne til en posemakør lige nu
        const result = poseLandmarker.detectForVideo( 
          videoRef.current, //frame
          performance.now() //timestamp
        ); //burde gerne bruges til at smoothe bevægelse ud

        // Spejlvend canvas så det matcher webcam-visningen
        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);

        if (result.landmarks?.length > 0) { //Hvis result returnerer en liste med landmarks, og listen er over 0
          const landmarks = result.landmarks[0];
          const currentSkin = skins[skin];
          const currentImages = loadedImages[skin];
          //Gem her: koordinaterne til alle landmarks, det valgte skin, og de loadede billeder, der tilhører skinnet

          //======================================
          //  Torsoens position(kunne ikke gøres i bones, da den ikke er statisk)
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

        // fix af underligt drift mod den ene side
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
        const torsoHeight = torsoLength * torsoAspectRatio; //sørger for at billedet ser normalt ud

        if (torsoPart && torsoImg) {

          ctx.save();

          ctx.translate(torsoMidX, torsoMidY);

          ctx.rotate(torsoAngle);

          
          ctx.drawImage(
            torsoImg,
            -torsoLength / 2, //x koordinat
            -torsoHeight / 2 + (torsoPart.offsetY || 0), //y koordinat
            torsoLength, //Længde
            torsoHeight //Højde
          ); //sørger for at tegne billedt med alle disse informationer i mente

          ctx.restore();
        }

        
          

          // =====================================
          // 6. Tegn alle knogler (arme, ben osv.)
          // =====================================
          Object.entries(knogler).forEach(([name, bone]) => { //for alle objekter
            const part = currentSkin[name]; 
            const img = currentImages[name];

            if (!part || !img) return; //hvis der hverken er del eller billede

            const start = landmarks[bone.from]; //hvor billedet starter fra
            const end = landmarks[bone.to]; //hvor billedet slutter

            //Gemmer x og y koordinaterne for start og slut
            const x1 = start.x * canvas.width;
            const y1 = start.y * canvas.height;
            const x2 = end.x * canvas.width;
            const y2 = end.y * canvas.height;

            //udregner længden mellem punkterne
            const dx = x2 - x1;
            const dy = y2 - y1;

            
            const angle = Math.atan2(dy, dx); //udregner rotation

            const length = Math.sqrt(dx * dx + dy * dy); //pythagoras, for at udregne længden

            ctx.save();
            ctx.translate(x1, y1);
            ctx.rotate(angle);


            //ratio
            const aspectRatio = img.height / img.width; 
            const thickness = part.thickness || 1;

            const drawWidth = length * aspectRatio * thickness; //tilføjet for manuelt at kunne rette via tykkelse
            
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

            //Her ville det være fedt at lave noget rotation
            //ud fra underarmens vinkel f.eks
            //Eller at billedet ændrer sig når punktet er under midten af canvasset
            //Det blev skrottet

            ctx.drawImage(
              img,
              x - size / 2 + (part.offsetX || 0),
              y - size / 2 + (part.offsetY || 0),
              size,
              size
            );
          });
        }

        ctx.restore(); //nulstiller
        requestAnimationFrame(detect); //på næste frame, kør detect igen
      }

      detect(); //kører detect første gang
    }

    init(); //starter forberedelse af kamera, mediapipe, billeder osv.

    return () => { //renser det hele når skin ændres eller unloades
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
        <button id="knap" onClick={() => setSkin("beta")}>Hvid</button>
        <button id="knap" className ="beta2" onClick={() => setSkin("beta2")}>Pink</button>
      </div>
    </div>
  );
}
