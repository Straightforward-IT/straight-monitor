/**
 * WPForms Management Routes
 * API-Endpoints zum Verwalten von WPForms-Feldern
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const WPFormsUpdateService = require('../WPFormsUpdateService');
const asyncHandler = require('../middleware/AsyncHandler');
const Mitarbeiter = require('../models/Mitarbeiter');
const auth = require('../middleware/auth');

/**
 * GET /api/wpforms/config/:formId/:fieldId
 * Holt die aktuelle Konfiguration eines Feldes
 */
router.get(
  '/config/:formId/:fieldId',
  auth,
  asyncHandler(async (req, res) => {
    const { formId, fieldId } = req.params;

    logger.debug(`Fetching config for form ${formId}, field ${fieldId}`);

    try {
      const { formConfig } = await WPFormsUpdateService.getFormConfig(formId);
      
      const field = formConfig.fields?.[fieldId];
      if (!field) {
        return res.status(404).json({
          success: false,
          error: `Field ${fieldId} not found`,
        });
      }

      res.json({
        success: true,
        fieldId,
        formId,
        label: field.label,
        choices: field.choices || {},
      });
    } catch (error) {
      logger.error(`Failed to fetch field config: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  })
);

/**
 * POST /api/wpforms/update-teamleiter
 * Aktualisiert Teamleiter-Auswahlmöglichkeiten
 * 
 * Body:
 * {
 *   team: "hamburg", // "berlin", "hamburg", oder "koeln"
 *   teamleiter: [
 *     { id: "123", vorname: "Max", nachname: "Mustermann" },
 *     ...
 *   ]
 * }
 */
router.post(
  '/update-teamleiter',
  auth,
  asyncHandler(async (req, res) => {
    const { team, teamleiter } = req.body;

    if (!team) {
      return res.status(400).json({
        success: false,
        error: 'team is required',
      });
    }

    if (!Array.isArray(teamleiter)) {
      return res.status(400).json({
        success: false,
        error: 'teamleiter must be an array',
      });
    }

    logger.info(`Updating teamleiter for ${team}`);

    try {
      const result = await WPFormsUpdateService.updateTeamForLocation(
        team,
        teamleiter
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error(`Failed to update teamleiter: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  })
);

/**
 * POST /api/wpforms/sync-teamleiter
 * Synchronisiert Teamleiter aus der Datenbank zu WPForms
 */
router.post(
  '/sync-teamleiter',
  auth,
  asyncHandler(async (req, res) => {
    logger.info('Starting teamleiter sync');

    try {
      const result = await WPFormsUpdateService.syncTeamleiterFromDatabase();

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error(`Failed to sync: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  })
);

/**
 * GET /api/wpforms/teamleiter/:team
 * Holt die aktuelle Liste von Teamleitern für eine Niederlassung
 */
router.get(
  '/teamleiter/:team',
  auth,
  asyncHandler(async (req, res) => {
    const { team } = req.params;

    logger.debug(`Fetching teamleiter for ${team}`);

    try {
      // Normalisiere Niederlassungs-Namen
      const locationMap = {
        berlin: 'Berlin',
        hamburg: 'Hamburg',
        koeln: 'Köln',
      };

      const location = locationMap[team.toLowerCase()];
      if (!location) {
        return res.status(400).json({
          success: false,
          error: `Unknown team: ${team}`,
        });
      }

      // Hol Teamleiter aus Datenbank
      const teamleiter = await Mitarbeiter.find({
        is_teamleiter: true,
        standort: { $in: [location, location.toLowerCase()] },
      }).select('_id vorname nachname email');

      res.json({
        success: true,
        team,
        location,
        count: teamleiter.length,
        data: teamleiter,
      });
    } catch (error) {
      logger.error(`Failed to fetch teamleiter: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  })
);

/**
 * GET /api/wpforms/teamleiter
 * Holt alle Teamleiter gruppiert nach Niederlassung
 */
router.get(
  '/teamleiter',
  auth,
  asyncHandler(async (req, res) => {
    logger.debug('Fetching all teamleiter');

    try {
      const teamleiter = await Mitarbeiter.aggregate([
        {
          $match: {
            is_teamleiter: true,
          },
        },
        {
          $group: {
            _id: '$standort',
            teamleiter: {
              $push: {
                id: '$_id',
                vorname: '$vorname',
                nachname: '$nachname',
                email: '$email',
              },
            },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]);

      res.json({
        success: true,
        data: teamleiter,
      });
    } catch (error) {
      logger.error(`Failed to fetch teamleiter: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  })
);

module.exports = router;
