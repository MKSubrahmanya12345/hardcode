import Project from "../models/project.model.js";
import { processDesign } from "../services/ai.services.js";
import { getWokwiCircuitContext } from "../lib/wokwi-context.js";

const isIdeaFinalized = (project) => {
  return Boolean(project?.ideaState?.summary?.trim()) && (project?.ideaState?.unknowns?.length ?? 0) === 0;
};

const canStartDesign = (project) => {
  return isIdeaFinalized(project) || project?.meta?.stage === "components" || project?.meta?.stage === "design" || project?.meta?.stage === "build";
};

/*
INIT DESIGN
*/
export const initDesign = async (req, res) => {
  try {
    const { projectId } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (project.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!canStartDesign(project)) {
      return res.status(400).json({
        error: "Finalize Ideation AI before starting Design AI"
      });
    }

    if (!project.designState) {
      project.designState = {
        screens: [],
        theme: "",
        uxFlow: []
      };
    }

    const wokwiContext = await getWokwiCircuitContext(project.wokwiUrl);
    const ai = await processDesign(project, "Start hardware layout guidance", wokwiContext);

    project.designState = {
      screens: ai.screens,
      theme: ai.theme,
      uxFlow: ai.uxFlow
    };

    if (!project.designMessages) project.designMessages = [];

    project.designMessages.push({
      role: "ai",
      content: ai.reply
    });

    await project.save();

    res.json({
      reply: ai.reply,
      designState: project.designState,
      wokwiContext
    });

  } catch (err) {
    console.error("PROJECT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};


/*
CHAT LOOP - DESIGN
*/
export const chatDesign = async (req, res) => {
  try {
    const { projectId, message } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (project.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!canStartDesign(project)) {
      return res.status(400).json({
        error: "Finalize Ideation AI before starting Design AI"
      });
    }

    if (!project.designMessages) project.designMessages = [];

    project.designMessages.push({
      role: "user",
      content: message
    });

    const wokwiContext = await getWokwiCircuitContext(project.wokwiUrl);
    const ai = await processDesign(project, message, wokwiContext);

    project.designState = {
      screens: ai.screens,
      theme: ai.theme,
      uxFlow: ai.uxFlow
    };

    project.designMessages.push({
      role: "ai",
      content: ai.reply
    });

    await project.save();

    res.json({
      reply: ai.reply,
      designState: project.designState,
      wokwiContext
    });

  } catch (err) {
    console.error("PROJECT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

export const getDesignContext = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (project.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const wokwiContext = await getWokwiCircuitContext(project.wokwiUrl);
    res.json({ wokwiContext });
  } catch (err) {
    console.error("DESIGN CONTEXT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};