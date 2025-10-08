const express = require("express");
const router = express.Router();
const asyncHandler = require("../middleware/AsyncHandler");
const { findTasks, getTaskById, getStoryById, getStoriesByTask, findAllTasks, updateTask, addLinkToTask, bewerberRoutine, createStoryOnTask} = require("../AsanaService");



/**
 * Route: Fetch all tasks from a project, handling pagination
 */
router.get("/tasks", asyncHandler(async (req, res) => {
  const opts = req.query; // Get query params (must include project)

  try {
      const tasks = await findAllTasks(opts);
      res.status(200).json({ message: "Tasks retrieved", tasks });
  } catch (error) {
      res.status(500).json({ message: "Error retrieving tasks", error: error.message });
  }
}));

router.get("/task/:id", asyncHandler(async (req, res) => {
    const taskId = req.params.id;
        const task = await getTaskById(taskId);

        if (!task) {
            return res.status(404).json({ message: `Task with ID ${taskId} not found.` });
        }
        res.status(200).json({ message: "Task retrieved successfully", task });
}));


router.put("/schulungenTasks", asyncHandler(async (req, res) => {
    const opts = {   
        project: "1207931820284879", 
        completed_since: new Date().toISOString(),  
        opt_fields: "assignee, assignee_status, completed, completed_at, completed_by, created_at, created_by, due_at, due_on, followers, html_notes, memberships, modified_at, name, notes, parent, permalink_url, projects"
    };

    let tasks = await findTasks(opts);
    let updatedTasks = await Promise.all(tasks.map(addLinkToTask)); // Add links where needed

    console.log(`✅ ${updatedTasks.length} tasks processed.`);
    res.status(200).json({ message: "Assignment successful", tasks: updatedTasks });
}));

/**
 * Route: Update Task by GID
 */
router.put("/updateTask/:gid", asyncHandler(async (req, res) => {
    const gid = req.params.gid;
    const htmlNotes = `<body><a href="https://straightmonitor.com/mitarbeiter/create/${gid}">Bewerber erstellen</a></body>`;

    await updateTask(gid, { html_notes: htmlNotes});
    res.status(200).json({ message: `✅ Task ${gid} updated successfully.` });
}));

router.patch("/updateTask/:gid", asyncHandler(async (req, res) => {
  const { gid } = req.params;
  const updateData = req.body;

  // Validate that there is data in the body to update with
  if (!updateData || Object.keys(updateData).length === 0) {
    return res.status(400).json({
      success: false,
      message: "Request body cannot be empty. Please provide fields to update.",
    });
  }

  try {
    const response = await updateTask(gid, updateData);
    
    res.status(200).json({
      success: true,
      message: `Task ${gid} updated successfully.`,
      data: response.data // Send back the updated task from Asana
    });
  } catch (error) {
    // The asyncHandler will forward the error, but we can add specific logging
    console.error(`Error in PATCH /updateTask/${gid}:`, error.message);
    // Let asyncHandler handle the response
    throw error;
  }
}));
/**
 * Route: Run Bewerber Routine (updates all necessary tasks)
 */
router.post("/bewerberRoutine", asyncHandler(async (req, res) => {
    await bewerberRoutine();
    res.status(200).json({ message: "✅ Bewerber routine executed successfully." });
}));

router.get("/story/:gid", asyncHandler(async (req, res) => {
    const gid = req.params.gid;
    const story = await getStoryById(gid);

    if(!story) {
        return res.status(404).json({ message: "Not found"});
    }f
    res.status(200).json({ message: "Success: ", story});
}))

router.get("/task/:gid/stories", asyncHandler(async (req, res) => {
    const gid = req.params.gid;
    const stories = await getStoriesByTask(gid);

    if(!stories) {
        return res.status(404).json({ message: "Not found"});
    }
    res.status(200).json({ message: "Success: ", stories});
}));

router.post("/task/:gid/story", asyncHandler(async (req, res) => {
    const {  html_text } = req.body;
    const task_gid = req.params.gid;

    if (!task_gid || !html_text) {
      return res.status(400).json({
        success: false,
        message: "task_gid and html_text are required fields.",
      });
    }
  
    const data = {
      type: "comment",
      html_text: html_text,
    };
  
    try {
      const response = await createStoryOnTask(task_gid, data);
  
      if (!response || response.status !== 201) {
        return res.status(500).json({
          success: false,
          message: "Failed to create story on task.",
          response,
        });
      }
  
      res.status(201).json({
        success: true,
        message: "Story created successfully.",
        data: response.data || response,
      });
    } catch (error) {
      console.error("❌ Error creating story:", error.message);
      res.status(500).json({
        success: false,
        message: "Internal server error while creating story.",
        error: error.message,
      });
    }
  }));

/**
 * Route: Enhanced Asana task search with location-based prioritization and local fallback
 */
router.get("/tasks/search", asyncHandler(async (req, res) => {
  const { query, project, includeSchulung = 'true', employeeEmail, employeeLocation } = req.query;

  if (!query || query.trim().length < 2) {
    return res.status(400).json({
      success: false,
      message: "Query parameter is required and must be at least 2 characters.",
    });
  }

  try {
    const registry = require("../config/registry");
    
    // Get project IDs with location-based prioritization
    const projectIds = getProjectIdsWithPriority(registry, project, employeeLocation, includeSchulung === 'true');
    
    console.log(`🔍 Searching for "${query}" with location priority:`, employeeLocation);
    console.log(`📋 Project search order:`, projectIds);

    let allResults = [];
    let searchStats = {
      totalProjects: projectIds.length,
      directMatches: 0,
      fallbackMatches: 0,
      emptyProjects: 0
    };

    // Phase 1: Quick API-based search in prioritized projects
    for (const projectId of projectIds) {
      try {
        const tasks = await findAllTasks({
          project: projectId,
          opt_fields: "gid,name,notes,html_notes,assignee,assignee.name,completed,created_at,permalink_url,memberships,memberships.project.name"
        });

        if (tasks.length === 0) {
          searchStats.emptyProjects++;
          continue;
        }

        // Enhanced matching: name, notes, and fuzzy matching
        const matchingTasks = tasks.filter(task => {
          return isTaskMatch(task, query, employeeEmail);
        });

        if (matchingTasks.length > 0) {
          searchStats.directMatches += matchingTasks.length;
        }

        // Add metadata and project info
        const enhancedTasks = matchingTasks.map(task => enhanceTask(task, query, employeeEmail, registry, projectId));
        allResults.push(...enhancedTasks);

      } catch (error) {
        console.warn(`⚠️ Error searching project ${projectId}:`, error.message);
        // Continue with other projects even if one fails
      }
    }

    // Phase 2: If insufficient results, do local fallback search
    if (allResults.length < 3) {
      console.log(`⚠️ Only ${allResults.length} direct matches found. Starting fallback search...`);
      
      try {
        const fallbackResults = await performFallbackSearch(projectIds, query, employeeEmail, registry);
        allResults.push(...fallbackResults);
        searchStats.fallbackMatches = fallbackResults.length;
      } catch (fallbackError) {
        console.warn(`⚠️ Fallback search failed:`, fallbackError.message);
      }
    }

    // Deduplicate results by task gid (prevent duplicate keys in frontend)
    const seenGids = new Set();
    const uniqueResults = allResults.filter(task => {
      if (seenGids.has(task.gid)) {
        console.log(`🗑️ Removing duplicate task: ${task.gid} - ${task.name}`);
        return false;
      }
      seenGids.add(task.gid);
      return true;
    });

    console.log(`📋 Deduplicated: ${allResults.length} → ${uniqueResults.length} results`);
    
    // Sort by relevance with email priority
    uniqueResults.sort((a, b) => {
      // Prioritize tasks that contain employee email
      if (a.containsEmployeeEmail && !b.containsEmployeeEmail) return -1;
      if (!a.containsEmployeeEmail && b.containsEmployeeEmail) return 1;
      
      // Then by relevance score
      if (a.relevanceScore !== b.relevanceScore) return b.relevanceScore - a.relevanceScore;
      
      // Finally by creation date (newest first)
      return new Date(b.created_at) - new Date(a.created_at);
    });

    // Limit results to prevent overwhelming response
    const limitedResults = uniqueResults.slice(0, 20);

    res.status(200).json({
      success: true,
      message: `Found ${uniqueResults.length} tasks matching "${query}"`,
      data: limitedResults,
      total: uniqueResults.length,
      limited: uniqueResults.length > 20,
      featuredCount: uniqueResults.filter(task => task.containsEmployeeEmail).length,
      searchStats
    });

  } catch (error) {
    console.error("❌ Error searching Asana tasks:", error.message);
    res.status(500).json({
      success: false,
      message: "Internal server error while searching tasks.",
      error: error.message,
    });
  }
}));

/**
 * Helper function to calculate relevance score for task sorting
 */
function calculateRelevanceScore(task, query, employeeEmail) {
  let score = 0;
  
  // Exact name match gets highest score
  if (task.name.toLowerCase() === query.toLowerCase()) score += 100;
  
  // Name starts with query gets high score
  else if (task.name.toLowerCase().startsWith(query.toLowerCase())) score += 50;
  
  // Name contains query gets medium score
  else if (task.name.toLowerCase().includes(query.toLowerCase())) score += 25;
  
  // Bonus points for containing employee email
  if (employeeEmail) {
    if (task.notes && task.notes.toLowerCase().includes(employeeEmail.toLowerCase())) score += 75;
    if (task.html_notes && task.html_notes.toLowerCase().includes(employeeEmail.toLowerCase())) score += 75;
  }
  
  // Bonus for incomplete tasks (more likely to be relevant)
  if (!task.completed) score += 10;
  
  return score;
}

/**
 * Route: Debug - List all configured Asana project IDs
 */
router.get("/projects/debug", asyncHandler(async (req, res) => {
  const registry = require("../config/registry");
  
  const teams = registry.listTeams();
  const projectInfo = teams.map(team => ({
    team: team.key,
    displayName: team.displayName,
    bewerberProject: team.asana?.projectId || null,
    dispositionProject: team.asana?.dispositionProjectId || null,
    schulungProject: team.asana?.schulungProjectId || null
  }));

  const allBewerber = registry.getAsanaProjectIds();
  const allDisposition = registry.getAsanaDispositionProjectIds();
  const allSchulung = registry.getAsanaSchulungProjectIds();
  const allProjects = registry.getAllAsanaProjectIds();

  res.status(200).json({
    success: true,
    message: "Asana project configuration",
    data: {
      teams: projectInfo,
      summary: {
        bewerberProjects: allBewerber,
        dispositionProjects: allDisposition,
        schulungProjects: allSchulung,
        allProjects: allProjects,
        totalCount: allProjects.length
      }
    }
  });
}));

// Helper Functions for Enhanced Search

/**
 * Get project IDs with location-based prioritization
 */
function getProjectIdsWithPriority(registry, specificProject, employeeLocation, includeSchulung) {
  if (specificProject) {
    return [specificProject];
  }

  const allProjectIds = registry.getAllAsanaProjectIds(null, includeSchulung);
  
  if (!employeeLocation) {
    return allProjectIds;
  }

  // Normalize location string for better matching
  const normalizedLocation = normalizeLocation(employeeLocation);
  const prioritizedIds = [];
  const otherIds = [];

  for (const projectId of allProjectIds) {
    const teamInfo = getTeamByProjectId(registry, projectId);
    if (teamInfo && normalizeLocation(teamInfo.displayName) === normalizedLocation) {
      prioritizedIds.push(projectId);
    } else {
      otherIds.push(projectId);
    }
  }

  console.log(`📍 Location "${employeeLocation}" prioritized ${prioritizedIds.length} projects`);
  return [...prioritizedIds, ...otherIds];
}

/**
 * Normalize location strings for comparison (köln -> koeln, etc.)
 */
function normalizeLocation(location) {
  if (!location) return '';
  return location.toLowerCase()
    .trim()
    .replace(/ö/g, 'oe')
    .replace(/ä/g, 'ae')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z]/g, '');
}

/**
 * Get team info by project ID
 */
function getTeamByProjectId(registry, projectId) {
  const teams = registry.listTeams();
  return teams.find(team => 
    team.asana?.projectId === projectId ||
    team.asana?.dispositionProjectId === projectId ||
    team.asana?.schulungProjectId === projectId
  );
}

/**
 * Enhanced task matching with fuzzy search
 */
function isTaskMatch(task, query, employeeEmail) {
  if (!task.name) return false;

  const queryLower = query.toLowerCase();
  const taskName = task.name.toLowerCase();
  const taskNotes = (task.notes || '').toLowerCase();
  const taskHtmlNotes = (task.html_notes || '').toLowerCase();

  // Exact name match (highest priority)
  if (taskName === queryLower) return true;
  
  // Name starts with query
  if (taskName.startsWith(queryLower)) return true;
  
  // Name contains query
  if (taskName.includes(queryLower)) return true;
  
  // Fuzzy matching for common typos/variations
  if (fuzzyMatch(taskName, queryLower)) return true;
  
  // Notes contain query
  if (taskNotes.includes(queryLower) || taskHtmlNotes.includes(queryLower)) return true;
  
  // Email-based matching (if task notes contain employee email)
  if (employeeEmail) {
    const emailLower = employeeEmail.toLowerCase();
    if (taskNotes.includes(emailLower) || taskHtmlNotes.includes(emailLower)) return true;
  }
  
  return false;
}

/**
 * Simple fuzzy matching for common variations
 */
function fuzzyMatch(taskName, query) {
  // Remove common separators and compare
  const cleanTask = taskName.replace(/[-_\s]/g, '');
  const cleanQuery = query.replace(/[-_\s]/g, '');
  
  if (cleanTask.includes(cleanQuery)) return true;
  
  // Check if words are in different order
  const taskWords = taskName.split(/\s+/);
  const queryWords = query.split(/\s+/);
  
  if (queryWords.length > 1) {
    const allWordsPresent = queryWords.every(word => 
      taskWords.some(taskWord => taskWord.toLowerCase().includes(word.toLowerCase()))
    );
    return allWordsPresent;
  }
  
  return false;
}

/**
 * Enhance task with metadata
 */
function enhanceTask(task, query, employeeEmail, registry, projectId) {
  const hasEmailInNotes = employeeEmail && (
    (task.notes && task.notes.toLowerCase().includes(employeeEmail.toLowerCase())) ||
    (task.html_notes && task.html_notes.toLowerCase().includes(employeeEmail.toLowerCase()))
  );

  const teamInfo = getTeamByProjectId(registry, projectId);
  const projectType = getProjectType(teamInfo, projectId);

  return {
    ...task,
    containsEmployeeEmail: hasEmailInNotes,
    projectInfo: {
      id: projectId,
      name: task.memberships?.[0]?.project?.name || `${teamInfo?.displayName || 'Unknown'} ${projectType}`,
      team: teamInfo?.key || 'unknown',
      type: projectType
    },
    relevanceScore: calculateRelevanceScore(task, query, employeeEmail)
  };
}

/**
 * Get project type (Bewerber, Disposition, Schulung)
 */
function getProjectType(teamInfo, projectId) {
  if (!teamInfo) return 'Unknown';
  
  if (teamInfo.asana?.projectId === projectId) return 'Bewerber';
  if (teamInfo.asana?.dispositionProjectId === projectId) return 'Disposition';
  if (teamInfo.asana?.schulungProjectId === projectId) return 'Schulung';
  
  return 'Unknown';
}

/**
 * Fallback search: fetch all tasks and search locally
 */
async function performFallbackSearch(projectIds, query, employeeEmail, registry) {
  console.log(`🔄 Starting fallback search across ${projectIds.length} projects...`);
  
  const fallbackResults = [];
  let tasksSearched = 0;
  
  for (const projectId of projectIds) {
    try {
      // Get ALL tasks from project (no filtering)
      const allTasks = await findAllTasks({
        project: projectId,
        opt_fields: "gid,name,notes,html_notes,assignee,assignee.name,completed,created_at,permalink_url,memberships,memberships.project.name",
        limit: 200 // Increase limit for fallback
      });

      tasksSearched += allTasks.length;

      // Local search with more aggressive matching
      const localMatches = allTasks.filter(task => {
        if (!task.name) return false;
        
        const taskName = task.name.toLowerCase();
        const queryLower = query.toLowerCase();
        
        // Very fuzzy matching for fallback
        if (taskName.includes(queryLower)) return true;
        
        // Word-by-word matching
        const taskWords = taskName.split(/\s+/);
        const queryWords = queryLower.split(/\s+/);
        
        const wordMatchCount = queryWords.filter(qWord => 
          taskWords.some(tWord => tWord.includes(qWord) || qWord.includes(tWord))
        ).length;
        
        // If most words match, consider it a match
        return wordMatchCount >= Math.ceil(queryWords.length * 0.7);
      });

      const enhancedMatches = localMatches.map(task => enhanceTask(task, query, employeeEmail, registry, projectId));
      fallbackResults.push(...enhancedMatches);

      // Limit fallback results to prevent overwhelming response
      if (fallbackResults.length >= 10) {
        console.log(`📊 Fallback search found enough results (${fallbackResults.length}), stopping early`);
        break;
      }

    } catch (error) {
      console.warn(`⚠️ Fallback search failed for project ${projectId}:`, error.message);
      continue;
    }
  }

  console.log(`📈 Fallback search completed: ${fallbackResults.length} results from ${tasksSearched} tasks`);
  return fallbackResults;
}

module.exports = router;