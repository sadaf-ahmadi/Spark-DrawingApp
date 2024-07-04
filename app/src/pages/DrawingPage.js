import React, { useRef, useState, useMemo, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { storage, db, auth } from "../firebase/firebase";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { collection, addDoc, doc } from "firebase/firestore";
import Canvas from "../components/Canvas";
import Toolbox from "../components/Toolbox";
import ColorPicker from "../components/ColorPicker";
import TextInput from "../components/TextInput";
import LineWidthPicker from "../components/LineWidthPicker";
import ActionButtons from "../components/ActionButton"; 
import "./DrawingPage.css";


function DrawingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const canvasRef = useRef(null);
  const [isPressed, setIsPressed] = useState(false);
  const [selectedColor, setSelectedColor] = useState("black");
  const [mode, setMode] = useState("pencil");
  const [showTextInput, setShowTextInput] = useState(false);
  const [inputText, setInputText] = useState("");
  const { selectedScene, area } = location.state || {};
  const [showColorPopup, setShowColorPopup] = useState(false);
  const [lineWidth, setLineWidth] = useState(5);
  const [showEraserPopup, setShowEraserPopup] = useState(false);
  const [showFillPopup, setShowFillPopup] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [colors, setColors] = useState(["black", "red", "green", "orange", "blue", "purple"]);


  const uploadDrawing = async () => {
    const canvas = canvasRef.current;
    const base64Image = canvas.toDataURL("image/png");

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
    if (!blob) return;

    const displayArea =
      area === "air"
        ? "top"
        : area === "land"
        ? "center"
        : area === "water"
        ? "bottom"
        : "undefined";

    let originalUrl = "";
    const uploadImage = async (path, imageBlob) => {
      const storageReference = storageRef(storage, path);
      const snapshot = await uploadBytes(storageReference, imageBlob);
      return getDownloadURL(snapshot.ref);
    };

    originalUrl = await uploadImage(`drawing/original-${Date.now()}.png`, blob);

    const sendToBaseten = async (base64Img) => {
      const url = "/model_versions/q48rmd3/predict"; // Replace with your Baseten endpoint
      const headers = {
        Authorization: "Api-Key 13235osK.AVglR2jVhzMHR1txMuFJCD49TEmV6FXY",
        "Content-Type": "application/json",
      };

      const imageData = base64Img.split(",")[1];
      const data = {
        prompt: "an angel fish",
        images_data: imageData,
        guidance_scale: 8,
        lcm_steps: 50,
        seed: 2159232,
        num_inference_steps: 4,
        strength: 0.7,
        width: 512,
        height: 512,
      };

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: headers,
          body: JSON.stringify(data),
        });

        if (response.ok) {
          const jsonResponse = await response.json();
          return `data:image/png;base64,${jsonResponse.model_output.image}`;
        } else {
          console.error("Server returned an error", response.statusText);
          return null;
        }
      } catch (error) {
        console.error("Error sending image to server:", error);
        return null;
      }
    };

    const enhancedBase64 = await sendToBaseten(base64Image);
    if (!enhancedBase64) return;

    const enhancedBlob = await fetch(enhancedBase64)
      .then((res) => res.blob())
      .catch((error) =>
        console.error("Error converting base64 to Blob:", error)
      );

    const enhancedUrl = await uploadImage(
      `drawing/enhanced-${Date.now()}.png`,
      enhancedBlob
    );

    const currentUser = auth.currentUser;
    const drawingsCollection = collection(db, "Drawings");
    const themeRef = doc(db, "Themes", selectedScene);

    let userRef;
    if (currentUser) {
      userRef = doc(db, "Users", currentUser.email);
    } else {
      userRef = doc(db, "Users", "guest");
    }

    const drawingData = {
      created_at: new Date(),
      original_drawing: originalUrl,
      enhanced_drawings: [enhancedUrl],
      user_id: userRef,
      theme_id: themeRef,
      email: currentUser ? currentUser.email : "guest",
      displayArea: displayArea,
      isReviewed: false,
    };

    const docRef = await addDoc(drawingsCollection, drawingData);

    navigate("/review", {
      state: { docId: docRef.id },
    });
  };
  

  const generateRandomColors = () => {
    const canvas = canvasRef.current;
    const currentDrawing = canvas.toDataURL();

    const randomColors = Array.from({ length: 6 }, () => `#${Math.floor(Math.random() * 16777215).toString(16)}`);
    setColors(randomColors);

    const context = canvas.getContext("2d");
    const img = new Image();
    img.src = currentDrawing;
    img.onload = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(img, 0, 0);
    };
  };

  const updateDraw = (e) => {
    if (!isPressed) return;

    const canvas = canvasRef.current;
    const offsetX =
      e.nativeEvent.offsetX !== undefined
        ? e.nativeEvent.offsetX
        : (e.touches[0]?.clientX || 0) - canvas.getBoundingClientRect().left;
    const offsetY =
      e.nativeEvent.offsetY !== undefined
        ? e.nativeEvent.offsetY
        : (e.touches[0]?.clientY || 0) - canvas.getBoundingClientRect().top;

    const context = canvas.getContext("2d");
    if (mode === "eraser") {
      context.globalCompositeOperation = "destination-out";
      context.strokeStyle = "rgba(0,0,0,1)";
    } else {
      context.globalCompositeOperation = "source-over";
      context.strokeStyle = selectedColor;
    }
  
    context.lineWidth = lineWidth;
    context.lineCap = "round";
    context.lineJoin = "round";
  
    context.lineTo(offsetX, offsetY);
    context.stroke();
  };

  const setColor = (color) => {
    const context = canvasRef.current.getContext("2d");
    context.strokeStyle = color;
    setSelectedColor(color);
    setMode("pencil");
  };

  const toggleColorPicker = () => {
    setShowEraserPopup(false);
    setShowColorPopup(!showColorPopup);
    setShowFillPopup(false);
  };

  const setWidth = (width) => {
    const context = canvasRef.current.getContext("2d");
    context.lineWidth = width;
    setLineWidth(width);
  };

  const setEraser = () => {
    setShowEraserPopup(!showEraserPopup);
    setShowColorPopup(false);
    setShowFillPopup(false);
    setMode("eraser");
  };

  const handleDescribeDrawing = () => {
    setShowTextInput(true);
  };

  const handleFill = () => {
    setShowColorPopup(false);
    setShowEraserPopup(false);
    setShowFillPopup(!showFillPopup);
    setMode("fill");
  };

  const handleTextSubmit = () => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    context.font = "20px Arial";
    context.fillStyle = "black";
    context.fillText(inputText, 50, 50);
    setInputText("");
    setShowTextInput(false);
    saveHistory(); 
  };

  const drawingRef = useRef(null); // Ref to store current drawing

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        // Save current drawing to a data URL
        drawingRef.current = canvas.toDataURL();
  
        // Resize the canvas
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
  
        // Restore the saved drawing
        const context = canvas.getContext("2d");
        const img = new Image();
        img.src = drawingRef.current;
        img.onload = () => {
          context.drawImage(img, 0, 0);
        };
      }
    };
  
    window.addEventListener("resize", handleResize);
  
    // Initial resize
    handleResize();
  
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);
  

  const saveHistory = () => {
    const canvas = canvasRef.current;
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(canvas.toDataURL());
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      const img = new Image();
      img.src = history[newIndex];
      img.onload = () => {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(img, 0, 0);
      };
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      const img = new Image();
      img.src = history[newIndex];
      img.onload = () => {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(img, 0, 0);
      };
    }
  };

  useEffect(() => {
    if (canvasRef.current) {
      saveHistory();
    }
  }, []);

  useEffect(() => {
    if (!isPressed) {
      saveHistory();
    }
  }, [isPressed]);

  //fill functionality
  const floodFill = (x, y, fillColor) => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
  console.log("this is inside flood fill")
    const targetColor = getColorAtPixel(data, x, y);
    if (colorsMatch(targetColor, fillColor)) {
      console.log("inside colour match")
      return;
    }
  
    const stack = [[x, y]];
    while (stack.length > 0) {
      console.log("stack length > 0")
      const [cx, cy] = stack.pop();

    if (cx < 0 || cy < 0 || cx >= canvas.width || cy >= canvas.height) {
      continue;
    }

    const currentIndex = (cy * canvas.width + cx) * 4;
    if (!colorsMatch(getColorAtPixel(data, cx, cy), targetColor)) {
      continue;
    }

    setColorAtPixel(data, cx, cy, fillColor);
    stack.push([cx + 1, cy]);
    stack.push([cx - 1, cy]);
    stack.push([cx, cy + 1]);
    stack.push([cx, cy - 1]);
    }
  
    context.putImageData(imageData, 0, 0);
    saveHistory(); // Save the state after filling
  };
  
  const getColorAtPixel = (data, x, y) => {
    const index = (y * canvasRef.current.width + x) * 4;
    return [data[index], data[index + 1], data[index + 2], data[index + 3]];
  };
  
  const setColorAtPixel = (data, x, y, color) => {
    const index = (y * canvasRef.current.width + x) * 4;
    data[index] = color[0];
    data[index + 1] = color[1];
    data[index + 2] = color[2];
    data[index + 3] = color[3];
  };
  
  const colorsMatch = (color1, color2) => {
    return color1[0] === color2[0] && color1[1] === color2[1] && color1[2] === color2[2] && color1[3] === color2[3];
  };

  const hexToRGBA = (hex) => {
    let r = 0, g = 0, b = 0, a = 255;
    if (hex.length === 7) {
      r = parseInt(hex.slice(1, 3), 16);
      g = parseInt(hex.slice(3, 5), 16);
      b = parseInt(hex.slice(5, 7), 16);
    }
    return [r, g, b, a];
  };

  const handleCanvasClick = (event) => {
    console.log("canvas is clicked")
    if (mode === "fill") {
      console.log("mode is fill");
      // const canvas = canvasRef.current;
      // const rect = canvas.getBoundingClientRect();
      // const x = event.clientX - rect.left;
      // const y = event.clientY - rect.top;
      // const fillColor = hexToRGBA(selectedColor);
  
      // floodFill(x, y, fillColor); 
    }
  };
  


  
  return (
    <div className="DrawingPage">
      <div className="top-toolbar">
        <ActionButtons
          onClear={() => {
            const canvas = canvasRef.current;
            const context = canvas.getContext("2d");
            context.clearRect(0, 0, canvas.width, canvas.height);
            saveHistory();
          }}
          onUndo={undo}
          onRedo={redo}
          undoDisabled={historyIndex <= 0}
          redoDisabled={historyIndex >= history.length - 1}
        />
        <button className="completeButton" onClick={uploadDrawing}>
          Upload
        </button>
      </div>
      <div className="canvas-container" onClick={handleCanvasClick}>
        <Canvas
          ref={canvasRef}
          colors={colors}
          selectedColor={selectedColor}
          lineWidth={lineWidth}
          mode={mode}
          setIsPressed={setIsPressed}
          updateDraw={updateDraw}
        />
      </div>
      <div className="bottom-toolbar">
  <Toolbox
    setEraser={setEraser}
    toggleColorPicker={toggleColorPicker}
    handleFill={handleFill}
    handleDescribeDrawing={handleDescribeDrawing}
  />
  {showFillPopup && (
    <ColorPicker
      colors={colors}
      selectedColor={selectedColor}
      setColor={setColor}
      showColorPopup={showFillPopup}
      generateRandomColors={generateRandomColors}
      floodFill={floodFill}
      canvasRef={canvasRef}
    />
  )}
  {showColorPopup && (
    <>
      <ColorPicker
        colors={colors}
        selectedColor={selectedColor}
        setColor={setColor}
        showColorPopup={showColorPopup}
        generateRandomColors={generateRandomColors}
        canvasRef={canvasRef}
      />
      <LineWidthPicker
        setWidth={setWidth}
        lineWidth={lineWidth}
        showLineWidthPopup={showColorPopup}
      />
    </>
  )}
  {showEraserPopup && (
    <LineWidthPicker
      setWidth={setWidth}
      lineWidth={lineWidth}
      showLineWidthPopup={showEraserPopup}
    />
  )}
  <TextInput
    showTextInput={showTextInput}
    inputText={inputText}
    setInputText={setInputText}
    handleTextSubmit={handleTextSubmit}
  />
</div>
    </div>
  );
}

export default DrawingPage;
