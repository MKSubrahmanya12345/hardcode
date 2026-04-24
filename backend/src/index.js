import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./lib/db.js";
import { checkWokwiCliReady } from "./lib/wokwi.js";
import cookieParser from "cookie-parser";


import projectRoutes from "./routes/project.route.js";
import ideationRoutes from "./routes/ideation.route.js";
import authRoutes from "./routes/auth.route.js";
import componentsRoutes from "./routes/components.route.js";
import designRoutes from "./routes/design.route.js";
import wokwiRoutes from "./routes/wokwi.route.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });



const app = express();
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));
app.use(cookieParser());

app.use(express.json());

app.use("/api", ideationRoutes);
app.use("/api", projectRoutes);
app.use("/api", componentsRoutes);
app.use("/api", designRoutes);
app.use("/api", wokwiRoutes);
app.use("/api/auth", authRoutes);


app.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
  checkWokwiCliReady();
  connectDB();
});