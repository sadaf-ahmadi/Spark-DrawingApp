import React, { useEffect, useState, useRef } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { db } from "../firebase/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";

function DisplayPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const selectedScene = searchParams.get("theme");
  const { imageUrl } = location.state || {};
  const [backgroundImage, setBackgroundImage] = useState(imageUrl);
  const [topDrawings, setTopDrawings] = useState([]);
  const [centerDrawings, setCenterDrawings] = useState([]);
  const [bottomDrawings, setBottomDrawings] = useState([]);
  const [coordinates, setCoordinates] = useState([]);
  const [readCount, setReadCount] = useState(0);
  const containerRef = useRef(null);

  const incrementReadCount = (count) => {
    setReadCount((prevCount) => prevCount + count);
  };

  useEffect(() => {
    const fetchScene = async () => {
      if (selectedScene) {
        try {
          console.log("Fetching scene for selected scene:", selectedScene);
          const docRef = doc(db, "Themes", selectedScene);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            setCoordinates(data.coordinates || []);
            incrementReadCount(1); // Counting the read for the scene document
            if (!backgroundImage) {
              setBackgroundImage(data.background_img);
            }
          } else {
            console.log("No such document!");
          }
        } catch (error) {
          console.error("Error fetching scene:", error);
        }
      }
    };

    fetchScene();
  }, [selectedScene, backgroundImage]);

  useEffect(() => {
    const fetchDrawings = async () => {
      if (coordinates.length === 0) return;

      try {
        // Fetch drawings based on the fetched coordinates
        const topCoords = coordinates.filter((coord) => coord.area === "top");
        const centerCoords = coordinates.filter(
          (coord) => coord.area === "center"
        );
        const bottomCoords = coordinates.filter(
          (coord) => coord.area === "bottom"
        );

        console.log("Top coordinates: ", topCoords);
        console.log("Center coordinates: ", centerCoords);
        console.log("Bottom coordinates: ", bottomCoords);

        const topDrawingsQuery = query(
          collection(db, "Drawings"),
          where("displayArea", "==", "top"),
          where("theme_id", "==", doc(db, "Themes", selectedScene)),
          orderBy("created_at", "desc"),
          limit(topCoords.length)
        );
        const centerDrawingsQuery = query(
          collection(db, "Drawings"),
          where("displayArea", "==", "center"),
          where("theme_id", "==", doc(db, "Themes", selectedScene)),
          orderBy("created_at", "desc"),
          limit(centerCoords.length)
        );
        const bottomDrawingsQuery = query(
          collection(db, "Drawings"),
          where("displayArea", "==", "bottom"),
          where("theme_id", "==", doc(db, "Themes", selectedScene)),
          orderBy("created_at", "desc"),
          limit(bottomCoords.length)
        );

        const [
          topDrawingsSnapshot,
          centerDrawingsSnapshot,
          bottomDrawingsSnapshot,
        ] = await Promise.all([
          getDocs(topDrawingsQuery),
          getDocs(centerDrawingsQuery),
          getDocs(bottomDrawingsQuery),
        ]);

        setTopDrawings(topDrawingsSnapshot.docs.map((doc) => doc.data()));
        setCenterDrawings(centerDrawingsSnapshot.docs.map((doc) => doc.data()));
        setBottomDrawings(bottomDrawingsSnapshot.docs.map((doc) => doc.data()));

        incrementReadCount(topDrawingsSnapshot.docs.length);
        incrementReadCount(centerDrawingsSnapshot.docs.length);
        incrementReadCount(bottomDrawingsSnapshot.docs.length);

        console.log(
          "Top drawings: ",
          topDrawingsSnapshot.docs.map((doc) => doc.data())
        );
        console.log(
          "Center drawings: ",
          centerDrawingsSnapshot.docs.map((doc) => doc.data())
        );
        console.log(
          "Bottom drawings: ",
          bottomDrawingsSnapshot.docs.map((doc) => doc.data())
        );
      } catch (error) {
        console.error("Error fetching drawings:", error);
      }
    };

    fetchDrawings();
  }, [coordinates, selectedScene]);

  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      const aspectRatio = 1920 / 1080;
      const windowAspectRatio = window.innerWidth / window.innerHeight;

      if (windowAspectRatio > aspectRatio) {
        container.style.width = `${window.innerHeight * aspectRatio}px`;
        container.style.height = `${window.innerHeight}px`;
      } else {
        container.style.width = `${window.innerWidth}px`;
        container.style.height = `${window.innerWidth / aspectRatio}px`;
      }
    };

    handleResize(); // Initial call
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    console.log(`Total database reads: ${readCount}`);
  }, [readCount]);

  const renderDrawings = (drawings, areaCoords) => {
    console.log(`Rendering drawings for area: ${drawings.length}`);
    return drawings.map((drawing, index) => {
      const coord = areaCoords[index];
      return (
        <img
          key={index}
          src={drawing.enhanced_drawings[0]}
          alt={`Drawing ${index}`}
          style={{
            position: "absolute",
            width: "13%",
            height: "13%",
            top: `${coord.y}%`,
            left: `${coord.x}%`,
            objectFit: "contain",
          }}
        />
      );
    });
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        backgroundColor: "black",
        overflow: "hidden",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        ref={containerRef}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          maxWidth: "1920px",
          maxHeight: "1080px",
        }}
      >
        {backgroundImage && (
          <img
            src={backgroundImage}
            alt="Background"
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: "100%",
              height: "100%",
              objectFit: "contain",
              transform: "translate(-50%, -50%)",
            }}
          />
        )}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
          }}
        >
          {renderDrawings(
            topDrawings,
            coordinates.filter((coord) => coord.area === "top")
          )}
          {renderDrawings(
            centerDrawings,
            coordinates.filter((coord) => coord.area === "center")
          )}
          {renderDrawings(
            bottomDrawings,
            coordinates.filter((coord) => coord.area === "bottom")
          )}
        </div>
      </div>
    </div>
  );
}

export default DisplayPage;
